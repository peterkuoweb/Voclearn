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
    setupCustomBookModal();
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
    header.innerHTML = `<h2>Voyage Map</h2><p>${getBookTitle(currentBookId)}</p>`;
    container.appendChild(header);

    // SRS Check Button (Review)
    const dueWords = dataManager.getDueReviewWords();
    if (dueWords.length > 0) {
        const srsBtn = dom.create('div', 'btn btn-orange mt-20', `Review Due Words (${dueWords.length})`);
        srsBtn.style.width = '80%';
        srsBtn.style.margin = '20px auto';
        srsBtn.style.display = 'block';
        srsBtn.onclick = () => startReviewSession(dueWords);
        container.appendChild(srsBtn);
    }

    // Lesson Map (Voyage Path)
    const mapContainer = dom.create('div', 'voyage-map');
    const pathLine = dom.create('div', 'path-line');
    mapContainer.appendChild(pathLine);

    lessons.forEach((lesson, index) => {
        const node = dom.create('div', `lesson-node ${lesson.status}`, lesson.id);

        // Stagger nodes slightly
        if (index % 2 === 0) node.style.transform = "translateX(-20px)";
        else node.style.transform = "translateX(20px)";

        // Lock/Unlock logic (visual only for now based on status)
        if (lesson.status === 'completed') {
            node.innerHTML = '✔';
        } else if (lesson.status === 'in-progress') {
            node.style.borderColor = 'var(--sunset-orange)';
            node.style.color = 'var(--sunset-orange)';
        }

        node.onclick = () => showLessonDetail(lesson);
        mapContainer.appendChild(node);
    });

    container.appendChild(mapContainer);
}

function renderMaterialsTab(container) {
    const shelf = dataManager.getBookshelf();

    container.innerHTML = '<h2 style="padding:20px;">Book Shelf</h2>';

    const shelfGrid = dom.create('div', 'shelf-container');

    // GEPT Section
    shelfGrid.appendChild(dom.create('h3', '', 'GEPT Series'));
    const grid1 = dom.create('div', 'shelf-grid');
    shelf.geptBooks.forEach(book => {
        grid1.appendChild(createBookEl(book));
    });
    shelfGrid.appendChild(grid1);

    // Custom Section
    shelfGrid.appendChild(dom.create('h3', '', 'Custom / Other'));
    const grid2 = dom.create('div', 'shelf-grid');
    shelf.customBooks.forEach(book => {
        grid2.appendChild(createBookEl(book));
    });

    // Add Book Button
    const addBtn = dom.create('div', 'book-3d');
    addBtn.style.background = '#334155';
    addBtn.innerHTML = '<span style="font-size:30px;">+</span><span>Add Material</span>';
    addBtn.onclick = showAddMaterialUI;
    grid2.appendChild(addBtn);

    shelfGrid.appendChild(grid2);
    container.appendChild(shelfGrid);
}

function createBookEl(book) {
    const el = dom.create('div', 'book-3d', book.title);
    // Custom colors based on book.color if available, else default gradient
    if (book.color) {
        el.style.background = `linear-gradient(135deg, ${book.color}, #333)`;
    }

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
        <p style="color:var(--sunset-orange); font-weight:bold;">Points: ${user.points || 0}</p>
    `;
    container.appendChild(header);

    const content = dom.create('div', '', '');
    content.style.padding = '20px';

    // Stats
    const stats = dom.create('div', 'glass-card');
    const learnedCount = Object.values(user.progress || {}).filter(p => p.status === 'green').length;
    stats.innerHTML = `<h3>Statistics</h3><p>Total Learned: ${learnedCount}</p>`;
    content.appendChild(stats);

    // Settings
    const settings = dom.create('div', 'glass-card');
    settings.style.marginTop = '20px';
    settings.innerHTML = `
        <h3>Settings</h3>
        <label style="display:block; margin-bottom:10px;"><input type="checkbox" checked> Sound Effects</label>
        <label style="display:block; margin-bottom:20px;">Speech Rate: <input type="range" min="0.5" max="1.5" step="0.1" value="1.0" onchange="window.speechRate=this.value"></label>
        <button class="btn btn-glass w-100" id="logout-btn">Logout</button>
        <div style="margin-top:20px; text-align:center;">
            <a href="mailto:mail@peterkuo.run.place" style="color:var(--neon-blue);">Contact Us</a>
        </div>
    `;
    content.appendChild(settings);

    container.appendChild(content);

    document.getElementById('logout-btn').onclick = () => {
        dataManager.logout();
        location.reload();
    };
}

// --- Dialogs & Overlays ---

function showLessonDetail(lesson) {
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

// --- Custom Book Modal Logic ---

let customBookState = {
    selectedWords: []
};

function setupCustomBookModal() {
    const modal = document.getElementById('custom-book-modal');
    const searchInput = document.getElementById('cb-search');
    const resultsContainer = document.getElementById('cb-results-list');
    const selectedContainer = document.getElementById('cb-selected-list');
    const countSpan = document.getElementById('cb-count');
    const saveBtn = document.getElementById('cb-save');
    const cancelBtn = document.getElementById('cb-cancel');

    // Update modal class to match new CSS
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) modalContent.className = 'modal-card'; // replace class

    cancelBtn.onclick = () => {
        modal.classList.remove('open');
        customBookState.selectedWords = [];
        document.getElementById('cb-title').value = '';
        searchInput.value = '';
        resultsContainer.innerHTML = '';
        updateSelectedUI();
    };

    saveBtn.onclick = () => {
        const title = document.getElementById('cb-title').value.trim();
        if (!title) {
            alert("Please enter a book title.");
            return;
        }
        if (customBookState.selectedWords.length === 0) {
            alert("Please select at least one word.");
            return;
        }

        dataManager.addCustomBook(title, customBookState.selectedWords);
        alert(`Book "${title}" created!`);
        modal.classList.remove('open');
        renderTab('materials');
    };

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        resultsContainer.innerHTML = '';
        if (val.length < 2) return;

        const matches = dataManager.allWords
            .filter(w => w.word.toLowerCase().includes(val))
            .slice(0, 10); // Limit results

        matches.forEach(w => {
            const div = dom.create('div', 'search-result-item', '');
            div.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:bold; color:var(--text-white);">${w.word}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${w.definition_zh.substr(0, 15)}...</div>
                </div>
                <button class="btn btn-glass" style="padding:5px 12px; font-size:0.8rem;">Add</button>
            `;

            div.querySelector('button').onclick = () => {
                if (!customBookState.selectedWords.includes(w.word)) {
                    customBookState.selectedWords.push(w.word);
                    updateSelectedUI();
                }
            };
            resultsContainer.appendChild(div);
        });
    });

    function updateSelectedUI() {
        selectedContainer.innerHTML = '';
        countSpan.textContent = customBookState.selectedWords.length;

        customBookState.selectedWords.forEach(word => {
            const tag = dom.create('div', '', word);
            tag.style.background = 'var(--neon-blue)';
            tag.style.color = '#fff';
            tag.style.padding = '4px 10px';
            tag.style.borderRadius = '12px';
            tag.style.fontSize = '12px';
            tag.style.display = 'inline-block';
            tag.style.cursor = 'pointer';
            tag.style.marginRight = '5px';
            tag.style.marginBottom = '5px';

            tag.onclick = () => {
                customBookState.selectedWords = customBookState.selectedWords.filter(x => x !== word);
                updateSelectedUI();
            };
            selectedContainer.appendChild(tag);
        });
    }
}

function showAddMaterialUI() {
    const modal = document.getElementById('custom-book-modal');
    modal.classList.add('open');
}

// Bootstrap
init();
window.speechRate = 1.0;
