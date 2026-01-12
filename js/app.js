import { dataManager } from './data.js';
import { dom, tts } from './utils.js';
import { Game } from './game.js';

// --- Global State ---
let currentTab = 'learn';
let currentBookId = null; // Store currently selected book
let gameInstance = null;

// --- Initialization ---
async function init() {
    await dataManager.init();

    const loading = document.getElementById('loading-state');
    const authForms = document.getElementById('auth-forms');

    loading.style.display = 'none';

    if (dataManager.user) {
        // Auto login
        showMainApp();
    } else {
        // Show Auth
        authForms.classList.remove('hidden');
        authForms.style.display = 'flex';
        authForms.style.flexDirection = 'column';
        authForms.style.alignItems = 'center';
    }

    setupAuthListeners();
    setupNavigation();
}

function setupAuthListeners() {
    const nickInput = document.getElementById('intro-nickname');
    const passInput = document.getElementById('intro-password');
    const emailInput = document.getElementById('intro-email');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const msg = document.getElementById('auth-msg');

    let isRegisterMode = false;

    registerBtn.onclick = async () => {
        if (!isRegisterMode) {
            // Switch to register UI
            emailInput.style.display = 'block';
            loginBtn.style.display = 'none';
            registerBtn.textContent = 'Submit Registration';
            isRegisterMode = true;
            return;
        }

        // Perform Register
        const nick = nickInput.value.trim();
        const pass = passInput.value.trim();
        const email = emailInput.value.trim();

        if (!/^[A-Za-z0-9]+$/.test(nick)) {
            msg.textContent = "Nickname must be English alphanumeric.";
            return;
        }

        msg.textContent = "Registering...";
        try {
            await dataManager.register(nick, pass, email);
            alert("Registration successful! Please login.");
            location.reload();
        } catch (e) {
            msg.textContent = e.message;
        }
    };

    loginBtn.onclick = async () => {
        const nick = nickInput.value.trim();
        const pass = passInput.value.trim();

        msg.textContent = "Logging in...";
        try {
            await dataManager.login(nick, pass);
            showMainApp();
        } catch (e) {
            msg.textContent = e.message;
        }
    };
}

function showMainApp() {
    document.getElementById('intro-view').classList.remove('active');
    document.getElementById('main-layout').classList.add('active');

    // Set default book if user has one
    if (dataManager.user.currentBook) {
        currentBookId = dataManager.user.currentBook;
    }

    renderTab('learn');
}

// --- Navigation ---

function setupNavigation() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderTab(currentTab);
        });
    });
}

function renderTab(tabName) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';

    if (tabName === 'learn') renderLearnTab(container);
    else if (tabName === 'materials') renderMaterialsTab(container);
    else if (tabName === 'profile') renderProfileTab(container);
}

// --- Tab Renderers ---

function renderLearnTab(container) {
    if (!currentBookId) {
        container.innerHTML = `
            <div style="padding:40px; text-align:center;">
                <h2>No Book Selected</h2>
                <p>Please go to "Materials" to select a book.</p>
                <button class="btn" onclick="document.querySelector('[data-tab=materials]').click()">Go to Bookshelf</button>
            </div>
        `;
        return;
    }

    // Get lessons
    const lessons = dataManager.getLessons(currentBookId);

    // Header
    const header = dom.create('div', 'profile-header');
    header.innerHTML = `<h2>Lesson Plan</h2><p>Book: ${getBookTitle(currentBookId)}</p>`;
    container.appendChild(header);

    // SRS Check Button (Review)
    const dueWords = dataManager.getDueReviewWords();
    if (dueWords.length > 0) {
        const srsBtn = dom.create('div', 'btn mt-20', `Review Due Words (${dueWords.length})`);
        srsBtn.style.background = '#FF5722';
        srsBtn.style.color = 'white';
        srsBtn.style.width = '80%';
        srsBtn.style.margin = '20px auto';
        srsBtn.style.display = 'block';
        srsBtn.onclick = () => startReviewSession(dueWords);
        container.appendChild(srsBtn);
    }

    // Lesson Grid
    const grid = dom.create('div', 'lesson-list');
    grid.style.padding = '20px';

    lessons.forEach(lesson => {
        const node = dom.create('div', `lesson-node ${lesson.status}`, lesson.id);
        node.onclick = () => showLessonDetail(lesson);
        grid.appendChild(node);
    });

    container.appendChild(grid);
}

function renderMaterialsTab(container) {
    const shelf = dataManager.getBookshelf();

    container.innerHTML = '<h2 style="padding:20px;">Book Shelf</h2>';

    // GEPT
    const row1 = dom.create('div', 'shelf-row');
    shelf.geptBooks.forEach(book => {
        const bookEl = createBookEl(book);
        row1.appendChild(bookEl);
    });
    container.appendChild(dom.create('h3', '', 'GEPT Series'));
    container.appendChild(row1);

    // Custom
    const row2 = dom.create('div', 'shelf-row');
    shelf.customBooks.forEach(book => {
        const bookEl = createBookEl(book);
        row2.appendChild(bookEl);
    });

    // Add Book Button
    const addBtn = dom.create('div', 'book');
    addBtn.style.background = '#ddd';
    addBtn.innerHTML = '<span>+ Add<br>Material</span>';
    addBtn.onclick = showAddMaterialUI;
    row2.appendChild(addBtn);

    container.appendChild(dom.create('h3', '', 'Custom / Other'));
    container.appendChild(row2);
}

function createBookEl(book) {
    const el = dom.create('div', 'book', book.title);
    el.style.backgroundColor = book.color || '#fff8e1';
    if (book.isUserCreated) el.style.color = 'white';

    el.onclick = () => {
        if (confirm(`Select "${book.title}" as your current book?`)) {
            currentBookId = book.id;
            dataManager.user.currentBook = book.id;
            dataManager.saveLocal();
            dataManager.sync(); // Sync selection
            alert('Book selected! Go to "Learn" tab.');
            document.querySelector('[data-tab=learn]').click();
        }
    };
    return el;
}

function renderProfileTab(container) {
    const user = dataManager.user;

    const header = dom.create('div', 'profile-header');
    header.innerHTML = `
        <h1>${user.nickname}</h1>
        <p>${user.email}</p>
        <p>Points: ${user.points || 0}</p>
    `;
    container.appendChild(header);

    const content = dom.create('div', '', '');
    content.style.padding = '20px';

    // Stats
    const stats = dom.create('div', 'stat-card');
    const learnedCount = Object.values(user.progress || {}).filter(p => p.status === 'green').length;
    stats.innerHTML = `<h3>Statistics</h3><p>Total Learned: ${learnedCount}</p>`;
    content.appendChild(stats);

    // Settings
    const settings = dom.create('div', 'stat-card');
    settings.innerHTML = `
        <h3>Settings</h3>
        <label><input type="checkbox" checked> Sound Effects</label><br><br>
        <label>Speech Rate: <input type="range" min="0.5" max="1.5" step="0.1" value="1.0" onchange="window.speechRate=this.value"></label><br><br>
        <button class="btn" style="background:#999" id="logout-btn">Logout</button>
        <br><br>
        <a href="mailto:mail@peterkuo.run.place">Contact Us</a>
    `;
    content.appendChild(settings);

    // Word List Button
    const listBtn = dom.create('button', 'btn w-100 mt-20', 'View All Words');
    listBtn.onclick = () => {
        alert("This feature would show a huge list. Implementing pagination later.");
    };
    content.appendChild(listBtn);

    container.appendChild(content);

    document.getElementById('logout-btn').onclick = () => {
        dataManager.logout();
        location.reload();
    };
}

// --- Dialogs & Overlays ---

function showLessonDetail(lesson) {
    // Show modal or overlay
    // Ideally this opens a pre-game screen
    const confirmed = confirm(`Start Lesson ${lesson.id}?\nWords: ${lesson.words.length}`);
    if (confirmed) {
        startLesson(lesson.words, false); // false = not review mode
    }
}

function startLesson(words, isReview) {
    const view = document.getElementById('learning-view');
    view.classList.add('active');

    // Init Game
    gameInstance = new Game(words, view, (results) => {
        // Game Over Callback
        view.classList.remove('active');
        if (results) {
            // Update progress
            // results is map of word -> rating
            Object.keys(results).forEach(word => {
                dataManager.updateWordProgress(word, results[word]);
            });
            // Give points
            if (!isReview) dataManager.user.points = (dataManager.user.points || 0) + 10;
            dataManager.saveLocal();
            dataManager.sync();

            alert("Lesson Complete!");
            renderTab('learn'); // Refresh
        }
    }, isReview);

    gameInstance.start();
}

function startReviewSession(words) {
    if(words.length === 0) return;
    startLesson(words, true);
}

function getBookTitle(id) {
    const shelf = dataManager.getBookshelf();
    const all = [...shelf.geptBooks, ...shelf.customBooks];
    const b = all.find(x => x.id === id);
    return b ? b.title : id;
}

function showAddMaterialUI() {
    const title = prompt("Enter Book Name:");
    if (!title) return;

    const keyword = prompt("Search for words to add (e.g. 'apple'):");
    if (!keyword) return;

    // Search
    const matches = dataManager.allWords.filter(w => w.word.toLowerCase().includes(keyword.toLowerCase()));

    if (matches.length === 0) {
        const r = confirm("No words found. Report missing word?");
        if (r) window.open('https://forms.gle/Le9oskkQBiupqwET7', '_blank');
        return;
    }

    // In a real app, we'd have a UI to select multiple. For now, add all matches (limit 20).
    const limited = matches.slice(0, 20).map(w => w.word);

    dataManager.addCustomBook(title, limited);
    alert(`Created book "${title}" with ${limited.length} words.`);
    renderTab('materials');
}

// Bootstrap
init();
window.speechRate = 1.0;
