import { api } from './api.js';

const STORAGE_KEY = 'vocab_sail_user';
const DATA_KEY = 'vocab_sail_data';

export const dataManager = {
    allWords: [],
    user: null, // { nickname, email, progress: {}, points, streak, ... }

    // SRS Config
    SRS: {
        RED: { nextReview: 1 },    // 1 day
        YELLOW: { nextReview: 3 }, // 3 days
        GREEN: { nextReview: 7 }   // 7 days
    },

    async init() {
        // Load words
        try {
            const response = await fetch('allvoc.json');
            this.allWords = await response.json();
        } catch (e) {
            console.error("Failed to load vocabulary", e);
        }

        // Load local user
        const storedUser = localStorage.getItem(STORAGE_KEY);
        if (storedUser) {
            this.user = JSON.parse(storedUser);
        }
    },

    async login(nickname, password) {
        try {
            const userData = await api.login(nickname, password);
            this.user = userData;
            this.saveLocal();
            return true;
        } catch (e) {
            throw e;
        }
    },

    async register(nickname, password, email) {
        return await api.register(nickname, password, email);
    },

    logout() {
        this.user = null;
        localStorage.removeItem(STORAGE_KEY);
    },

    saveLocal() {
        if (this.user) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
        }
    },

    async sync() {
        if (!this.user) return;
        try {
            // Prepare payload
            const payload = {
                totalLearned: this.user.totalLearned || 0,
                streak: this.user.streak || 0,
                points: this.user.points || 0,
                progress: this.user.progress || {},
                customBooks: this.user.customBooks || [],
                currentBook: this.user.currentBook || ""
            };
            await api.sync(this.user.nickname, payload);
        } catch (e) {
            console.warn("Sync failed, working offline", e);
        }
    },

    // --- Book Management ---

    getBookshelf() {
        // Group allWords into categories
        const geptBooks = [
            { id: 'gept_elem', title: '全民英檢 初級', category: '全民英檢(初級)', color: '#4CAF50' },
            { id: 'gept_inter', title: '全民英檢 中級', category: '全民英檢(中級)', color: '#FFC107' },
            { id: 'gept_high', title: '全民英檢 中高級', category: '全民英檢(中高級)', color: '#F44336' }
        ];

        const customBooks = [
            { id: 'custom_world', title: '單字環遊世界', category: '單字環遊世界', color: '#2196F3' }
        ];

        // Add user defined books
        if (this.user && this.user.customBooks) {
            this.user.customBooks.forEach(b => {
                customBooks.push({ ...b, isUserCreated: true, color: '#9C27B0' });
            });
        }

        return { geptBooks, customBooks };
    },

    getWordsForBook(bookId) {
        const books = this.getBookshelf();
        const allBooks = [...books.geptBooks, ...books.customBooks];
        const book = allBooks.find(b => b.id === bookId);

        if (!book) return [];

        if (book.isUserCreated) {
            // User created book logic (words are stored as IDs or strings in the book object)
            // Assuming book.words is an array of word strings
            return this.allWords.filter(w => book.words.includes(w.word));
        } else if (book.id === 'custom_world') {
             // Logic for "Vocabulary Around the World" - user said "all words regardless of category or unsorted"
             // But actually maybe it's a specific subset?
             // "自編教材的那個就是不管初中高還是沒分類都有" -> Suggests it includes everything or a mix.
             // For now, let's just return everything that DOESN'T match the GEPT categories, or just random selection?
             // Or maybe it matches "無" category? Let's assume "無" + "Others".
             return this.allWords.filter(w => !w.category.includes('全民英檢'));
        } else {
            // Standard GEPT
            return this.allWords.filter(w => w.category === book.category);
        }
    },

    // --- Learning Progress ---

    getLessons(bookId) {
        const words = this.getWordsForBook(bookId);
        const lessons = [];
        const CHUNK_SIZE = 7;

        for (let i = 0; i < words.length; i += CHUNK_SIZE) {
            const chunk = words.slice(i, i + CHUNK_SIZE);
            // Check status of these words
            const lessonStatus = this.getLessonStatus(chunk);
            lessons.push({
                id: i / CHUNK_SIZE + 1,
                words: chunk,
                status: lessonStatus // 'new', 'in-progress', 'completed'
            });
        }
        return lessons;
    },

    getLessonStatus(words) {
        if (!this.user || !this.user.progress) return 'new';

        let learnedCount = 0;
        words.forEach(w => {
            const p = this.user.progress[w.word];
            if (p && p.status === 'green') learnedCount++;
        });

        if (learnedCount === words.length) return 'completed';
        if (learnedCount > 0) return 'in-progress';
        return 'new';
    },

    // SRS Logic
    getDueReviewWords() {
        if (!this.user || !this.user.progress) return [];
        const now = new Date().getTime();
        const dueWords = [];

        Object.keys(this.user.progress).forEach(wordStr => {
            const p = this.user.progress[wordStr];
            if (p.nextReview && p.nextReview <= now) {
                const wordObj = this.allWords.find(w => w.word === wordStr);
                if (wordObj) dueWords.push(wordObj);
            }
        });
        return dueWords;
    },

    updateWordProgress(word, rating) {
        // rating: 'red', 'yellow', 'green'
        if (!this.user) return;
        if (!this.user.progress) this.user.progress = {};

        const now = new Date();
        const daysToAdd = this.SRS[rating.toUpperCase()].nextReview;
        const nextReviewDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000).getTime();

        this.user.progress[word] = {
            status: rating,
            lastReview: now.getTime(),
            nextReview: nextReviewDate
        };

        if (rating === 'green') {
            // Increment total learned if not already counted (this logic is simplified)
             // Ideally we check if it was already green.
        }

        this.saveLocal();
    },

    addCustomBook(title, wordList) {
        if (!this.user) return;
        if (!this.user.customBooks) this.user.customBooks = [];

        const newBook = {
            id: 'custom_' + Date.now(),
            title: title,
            words: wordList, // array of strings
            isUserCreated: true
        };
        this.user.customBooks.push(newBook);
        this.saveLocal();
        this.sync();
    }
};
