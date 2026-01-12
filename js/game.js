import { dom, tts } from './utils.js';

export class Game {
    constructor(words, container, onComplete, isReviewMode = false) {
        this.words = words;
        this.container = container;
        this.onComplete = onComplete;
        this.isReviewMode = isReviewMode;

        this.phases = ['flashcards', 'sentence', 'matching', 'spelling', 'review'];
        this.currentPhaseIndex = 0;
        this.currentWordIndex = 0;
        this.results = {}; // word -> rating (green/yellow/red)
        this.redoQueue = [];
    }

    start() {
        this.currentPhaseIndex = 0;
        this.currentWordIndex = 0;
        this.runPhase();
    }

    renderProgressBar() {
        // Calculate total progress
        // Total steps = phases * words? Or just words in current phase?
        // Let's do a simple progress bar for current phase
        const progress = (this.currentWordIndex / this.words.length) * 100;

        const header = dom.create('div', 'game-header');
        header.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="btn-glass" style="padding:5px 10px; border-radius:10px; font-size:0.8rem; cursor:pointer;" onclick="location.reload()">×</span>
                <span style="font-weight:bold; color:var(--sunset-orange);">Level 1</span>
                <span>${this.currentWordIndex + 1} / ${this.words.length}</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width:${progress}%">
                    <div class="ship-marker">⛵</div>
                </div>
            </div>
        `;
        return header;
    }

    runPhase() {
        if (this.currentPhaseIndex >= this.phases.length) {
            if (this.redoQueue.length > 0) {
                alert("Reviewing words marked as 'Red'...");
                this.words = [...this.redoQueue];
                this.redoQueue = [];
                this.start();
            } else {
                this.onComplete(this.results);
            }
            return;
        }

        const phase = this.phases[this.currentPhaseIndex];
        this.container.innerHTML = '';

        // Add progress bar (except for maybe intro?)
        this.container.appendChild(this.renderProgressBar());

        const contentWrapper = dom.create('div', 'w-100 h-100');
        contentWrapper.style.paddingTop = "80px"; // Space for header
        contentWrapper.style.display = "flex";
        contentWrapper.style.flexDirection = "column";
        this.container.appendChild(contentWrapper);

        if (phase === 'flashcards') this.renderFlashcards(contentWrapper);
        else if (phase === 'sentence') this.renderSentenceBuilder(contentWrapper);
        else if (phase === 'matching') this.renderMatching(contentWrapper);
        else if (phase === 'spelling') this.renderSpelling(contentWrapper);
        else if (phase === 'review') this.renderSelfCheck(contentWrapper);
    }

    nextPhase() {
        this.currentPhaseIndex++;
        this.currentWordIndex = 0;
        this.runPhase();
    }

    // --- Phase 1: Flashcards ---
    renderFlashcards(wrapper) {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const word = this.words[this.currentWordIndex];

        const cardWrapper = dom.create('div', 'flashcard-wrapper');
        cardWrapper.innerHTML = `
            <div class="flashcard" id="flashcard">
                <div class="card-face card-front">
                    <div class="card-hero">
                        <i style="font-size:1.5rem; color:rgba(255,255,255,0.7)">🔊</i>
                    </div>
                    <div class="card-content">
                        <div style="color:var(--sunset-orange); font-size:0.8rem; margin-bottom:10px; letter-spacing:2px;">WORD OF THE DAY</div>
                        <div class="word-title">${word.word}</div>
                        <div class="pronunciation">/${word.word.toLowerCase()}/</div>
                        <p style="margin-top:20px; font-size:0.9rem; color:#8892b0; max-width:80%;">
                            Think of sailing across the ocean...
                        </p>
                    </div>
                </div>
                <div class="card-face card-back">
                    <h3 style="font-size:2rem; margin-bottom:10px;">${word.word}</h3>
                    <p style="color:var(--sunset-orange); font-style:italic;">${word.part_of_speech}</p>
                    <p style="font-size:1.2rem; margin-top:20px;">${word.definition_zh}</p>
                    <button class="btn btn-glass mt-20" id="play-audio-back">🔊 Play Audio</button>
                </div>
            </div>
        `;

        const btnContainer = dom.create('div', 'w-100 flex-row mt-20');
        btnContainer.innerHTML = `
            <button class="btn btn-glass" style="width:50px;" id="prev-fc">←</button>
            <button class="btn" style="flex:1;" id="flip-btn">Flip Card</button>
            <button class="btn btn-glass" style="width:50px;" id="next-fc">→</button>
        `;

        wrapper.appendChild(cardWrapper);
        wrapper.appendChild(btnContainer);

        const card = cardWrapper.querySelector('#flashcard');
        const flipBtn = btnContainer.querySelector('#flip-btn');

        // Hero Audio Icon
        cardWrapper.querySelector('.card-hero').onclick = (e) => {
            e.stopPropagation();
            tts.playAudio(word.word);
        };

        // Back Audio Button
        cardWrapper.querySelector('#play-audio-back').onclick = (e) => {
            e.stopPropagation();
            tts.playAudio(word.word);
        };

        flipBtn.onclick = () => card.classList.toggle('flipped');
        card.onclick = () => card.classList.toggle('flipped');

        btnContainer.querySelector('#next-fc').onclick = () => {
            this.currentWordIndex++;
            this.runPhase(); // re-render
        };

        // Auto play on show?
        // tts.playAudio(word.word);
    }

    // --- Phase 2: Sentence Builder ---
    renderSentenceBuilder(wrapper) {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const wordData = this.words[this.currentWordIndex];
        if (!wordData.example_en) {
            this.currentWordIndex++;
            this.runPhase();
            return;
        }

        const sentenceParts = wordData.example_en.split(' ');
        const shuffledParts = dom.shuffle([...sentenceParts]);

        wrapper.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center; padding:20px; text-align:center;">
                <div style="color:var(--sunset-orange); margin-bottom:10px;">⚠️ TRANSLATE THIS</div>
                <h2 style="font-size:1.8rem; margin-bottom:30px;">${wordData.example_zh}</h2>

                <div class="sentence-zone" id="drop-zone">
                    <span style="color:rgba(255,255,255,0.2); pointer-events:none;">Tap words below to build</span>
                </div>

                <div class="sentence-zone" id="drag-source" style="border:none; background:transparent;"></div>
            </div>
            <div style="padding:20px;">
                <button class="btn btn-orange w-100" id="check-ans">Check Answer</button>
            </div>
        `;

        const dropZone = wrapper.querySelector('#drop-zone');
        const dragSource = wrapper.querySelector('#drag-source');
        const checkBtn = wrapper.querySelector('#check-ans');

        // Helper to update empty state text
        const updateDropZoneText = () => {
            const hasChildren = [...dropZone.children].some(c => c.classList.contains('pill-word'));
            const placeholder = dropZone.querySelector('span');
            if (placeholder) placeholder.style.display = hasChildren ? 'none' : 'block';
        };

        shuffledParts.forEach((txt) => {
            const el = dom.create('div', 'pill-word', txt);
            el.dataset.txt = txt;
            el.onclick = () => {
                if (el.parentNode === dragSource) dropZone.appendChild(el);
                else dragSource.appendChild(el);
                updateDropZoneText();
            };
            dragSource.appendChild(el);
        });

        checkBtn.onclick = () => {
            const currentSentence = [...dropZone.querySelectorAll('.pill-word')].map(el => el.dataset.txt).join(' ');
            const target = wordData.example_en.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
            const current = currentSentence.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");

            if (current === target) {
                checkBtn.textContent = "Correct! ✔";
                checkBtn.classList.replace('btn-orange', 'btn-green');
                setTimeout(() => {
                    this.currentWordIndex++;
                    this.runPhase();
                }, 1000);
            } else {
                checkBtn.textContent = "Try Again ❌";
                checkBtn.classList.replace('btn-orange', 'btn-red');
                setTimeout(() => {
                    checkBtn.textContent = "Check Answer";
                    checkBtn.classList.replace('btn-red', 'btn-orange');
                }, 1000);
            }
        };
    }

    // --- Phase 3: Matching ---
    renderMatching(wrapper) {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const wordData = this.words[this.currentWordIndex];

        let options = [wordData];
        const distractors = this.words.filter(w => w !== wordData);
        if (distractors.length >= 2) {
             options.push(...dom.shuffle(distractors).slice(0, 2));
        } else {
             options.push(...distractors);
        }
        options = dom.shuffle(options);

        wrapper.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <div class="ripple-btn" style="width:150px; height:150px; font-size:2rem; animation:none; box-shadow:0 0 30px rgba(46,154,254,0.3); margin-bottom:40px;">
                    ${wordData.word}
                </div>
                <div style="width:90%; max-width:350px; display:flex; flex-direction:column; gap:15px;" id="options-container">
                </div>
            </div>
        `;

        const container = wrapper.querySelector('#options-container');
        options.forEach(opt => {
            const btn = dom.create('button', 'btn btn-glass w-100', opt.definition_zh);
            btn.style.textAlign = 'left';
            btn.style.padding = "20px";
            btn.style.borderRadius = "16px";

            btn.onclick = () => {
                if (opt === wordData) {
                    btn.style.background = 'var(--success)';
                    btn.style.borderColor = 'var(--success)';
                    setTimeout(() => {
                        this.currentWordIndex++;
                        this.runPhase();
                    }, 500);
                } else {
                    btn.style.background = 'var(--error)';
                    btn.style.borderColor = 'var(--error)';
                }
            };
            container.appendChild(btn);
        });
    }

    // --- Phase 4: Spelling (Listening) ---
    renderSpelling(wrapper) {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const wordData = this.words[this.currentWordIndex];

        wrapper.innerHTML = `
            <div class="listening-container">
                <div class="ripple-btn" id="play-ripple">🔊</div>
                <p style="margin-top:20px;">Tap to play</p>

                <input type="text" id="spelling-input" class="input-field"
                    placeholder="Type what you hear..."
                    style="margin-top:40px; width:80%; font-size:1.5rem;"
                    autocomplete="off">
            </div>
            <div style="padding:20px; display:flex; justify-content:flex-end;">
                <button class="btn btn-glass" id="skip-btn" style="padding:10px 20px;">Skip</button>
            </div>
        `;

        const input = wrapper.querySelector('#spelling-input');
        input.focus();

        // Auto play
        tts.playAudio(wordData.word);

        wrapper.querySelector('#play-ripple').onclick = () => {
            tts.playAudio(wordData.word);
        };

        input.addEventListener('input', () => {
            const val = input.value.trim().toLowerCase();
            if (val === wordData.word.toLowerCase()) {
                input.style.borderColor = 'var(--success)';
                input.style.color = 'var(--success)';
                setTimeout(() => {
                    this.currentWordIndex++;
                    this.runPhase();
                }, 800);
            }
        });

        wrapper.querySelector('#skip-btn').onclick = () => {
            this.currentWordIndex++;
            this.runPhase();
        };
    }

    // --- Phase 5: Self Check (Review) ---
    renderSelfCheck(wrapper) {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const wordData = this.words[this.currentWordIndex];

        wrapper.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:20px;">
                <div class="glass-card" style="width:100%; max-width:350px; min-height:300px; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <h1 style="margin-bottom:10px;">${wordData.word}</h1>
                    <div class="pronunciation" style="margin-bottom:30px;">/${wordData.word.toLowerCase()}/</div>

                    <div id="review-content" style="opacity:0; transition:opacity 0.3s; display:none;">
                        <h3 style="color:var(--text-white);">${wordData.definition_zh}</h3>
                        <p style="margin-top:10px; font-style:italic;">${wordData.example_en || ''}</p>
                    </div>

                    <button class="btn mt-20" id="show-ans">Show Details</button>
                </div>

                <div class="review-actions hidden" id="actions" style="margin-top:30px;">
                    <button class="circle-btn btn-red" data-rating="red" style="width:70px; height:70px;">✖</button>
                    <button class="circle-btn btn-yellow" data-rating="yellow" style="width:70px; height:70px;">?</button>
                    <button class="circle-btn btn-green" data-rating="green" style="width:70px; height:70px;">✔</button>
                </div>
            </div>
        `;

        const showBtn = wrapper.querySelector('#show-ans');
        const content = wrapper.querySelector('#review-content');
        const actions = wrapper.querySelector('#actions');

        showBtn.onclick = () => {
            content.style.display = 'block';
            setTimeout(() => content.style.opacity = 1, 10);
            actions.classList.remove('hidden');
            actions.style.display = 'flex';
            showBtn.style.display = 'none';
        };

        const handleRating = (rating) => {
            this.results[wordData.word] = rating;
            if (rating === 'red') {
                if (!this.redoQueue.includes(wordData)) this.redoQueue.push(wordData);
            }
            this.currentWordIndex++;
            this.runPhase();
        };

        actions.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => handleRating(btn.dataset.rating);
        });
    }
}
