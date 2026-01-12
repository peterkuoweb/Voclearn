import { dom, tts } from './utils.js';

export class Game {
    constructor(words, container, onComplete, isReviewMode = false) {
        this.words = words;
        this.container = container;
        this.onComplete = onComplete;
        this.isReviewMode = isReviewMode;

        this.phases = ['flashcards', 'sentence', 'matching', 'spelling', 'review'];
        if (this.isReviewMode) {
            // SRS Review might skip straight to testing? Or full cycle?
            // Prompt says: "Lesson starts with flashcards...". SRS review usually is just testing.
            // But prompt says "Course completion same flow".
            // Let's stick to the full flow for now as per "Red/Yellow/Green review also triggers flow".
            // Actually, prompt says: "Before lesson... review... user can skip... red/yellow logic".
            // Let's keep it simple: Standard flow for now.
        }

        this.currentPhaseIndex = 0;
        this.currentWordIndex = 0;

        this.results = {}; // word -> rating (green/yellow/red)

        // Redo queue for "Red" rated words at the end
        this.redoQueue = [];
    }

    start() {
        this.currentPhaseIndex = 0;
        this.currentWordIndex = 0;
        this.runPhase();
    }

    runPhase() {
        if (this.currentPhaseIndex >= this.phases.length) {
            // All phases done. Check redo queue.
            if (this.redoQueue.length > 0) {
                // Restart with redo words
                alert("Reviewing words marked as 'Red'...");
                this.words = [...this.redoQueue];
                this.redoQueue = [];
                this.start(); // Restart flow for these words
            } else {
                this.onComplete(this.results);
            }
            return;
        }

        const phase = this.phases[this.currentPhaseIndex];
        this.container.innerHTML = ''; // Clear view

        // Render phase UI
        if (phase === 'flashcards') this.renderFlashcards();
        else if (phase === 'sentence') this.renderSentenceBuilder();
        else if (phase === 'matching') this.renderMatching();
        else if (phase === 'spelling') this.renderSpelling();
        else if (phase === 'review') this.renderSelfCheck();
    }

    nextPhase() {
        this.currentPhaseIndex++;
        this.currentWordIndex = 0;
        this.runPhase();
    }

    // --- Phase 1: Flashcards ---
    renderFlashcards() {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const word = this.words[this.currentWordIndex];

        const wrapper = dom.create('div', 'w-100 h-100');
        wrapper.innerHTML = `
            <div class="learning-header">
                <span>Flashcards (${this.currentWordIndex + 1}/${this.words.length})</span>
                <button class="btn" id="next-fc">Next</button>
            </div>
            <div class="card-container">
                <div class="flashcard" id="flashcard">
                    <div class="card-face card-front">
                        <h1>${word.word}</h1>
                        <p style="color:#999; font-size:0.8rem;">Tap to Flip</p>
                    </div>
                    <div class="card-face card-back">
                        <h3>${word.word}</h3>
                        <p>${word.part_of_speech}</p>
                        <p style="color:var(--primary-color)">${word.definition_zh}</p>
                        <button class="btn" id="play-audio">🔊 Play</button>
                    </div>
                </div>
            </div>
        `;
        this.container.appendChild(wrapper);

        const card = wrapper.querySelector('#flashcard');
        card.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                card.classList.toggle('flipped');
            }
        };

        wrapper.querySelector('#play-audio').onclick = () => {
            tts.playAudio(word.word);
        };

        wrapper.querySelector('#next-fc').onclick = () => {
            this.currentWordIndex++;
            this.renderFlashcards();
        };
    }

    // --- Phase 2: Sentence Builder ---
    renderSentenceBuilder() {
        // "Example sentence Chinese shown, drag English words to order"
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const wordData = this.words[this.currentWordIndex];
        // Clean sentence: remove punctuation for splitting, but keep for display?
        // Simplification: Split by space.
        // If no example, skip.
        if (!wordData.example_en) {
            this.currentWordIndex++;
            this.renderSentenceBuilder();
            return;
        }

        const sentenceParts = wordData.example_en.split(' ');
        const shuffledParts = dom.shuffle([...sentenceParts]);

        const wrapper = dom.create('div', 'w-100 h-100');
        wrapper.innerHTML = `
            <div class="learning-header">
                <span>Sentence (${this.currentWordIndex + 1}/${this.words.length})</span>
            </div>
            <div style="padding:20px; text-align:center;">
                <h3>${wordData.example_zh}</h3>
            </div>
            <div class="sentence-area" id="drop-zone"></div>
            <div class="word-bank" id="drag-source"></div>
        `;
        this.container.appendChild(wrapper);

        const dropZone = wrapper.querySelector('#drop-zone');
        const dragSource = wrapper.querySelector('#drag-source');

        shuffledParts.forEach((txt, idx) => {
            const el = dom.create('div', 'draggable-word', txt);
            el.dataset.txt = txt;

            el.onclick = () => {
                // Toggle between source and drop
                if (el.parentNode === dragSource) {
                    dropZone.appendChild(el);
                } else {
                    dragSource.appendChild(el);
                }
                checkSentence();
            };
            dragSource.appendChild(el);
        });

        const checkSentence = () => {
            const currentSentence = [...dropZone.children].map(el => el.dataset.txt).join(' ');
            // Simple check (case sensitive? punctuation? simplified for now)
            // Ideally we strip punctuation for comparison
            const target = wordData.example_en.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
            const current = currentSentence.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");

            if (current === target) {
                // Correct!
                dropZone.style.borderColor = 'green';
                setTimeout(() => {
                    this.currentWordIndex++;
                    this.renderSentenceBuilder();
                }, 1000);
            }
        };
    }

    // --- Phase 3: Matching ---
    renderMatching() {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const wordData = this.words[this.currentWordIndex];

        // Get 2 distractors from current lesson words or random
        let options = [wordData];
        const distractors = this.words.filter(w => w !== wordData);
        // If not enough words in lesson, pick matching phase might be buggy if lesson size < 3.
        // Assuming lesson size >= 3 usually. If not, maybe skip or dupe?
        if (distractors.length >= 2) {
             const selected = dom.shuffle(distractors).slice(0, 2);
             options.push(...selected);
        } else {
             // Just repeat to avoid crash
             options.push(...distractors);
        }

        options = dom.shuffle(options);

        const wrapper = dom.create('div', 'w-100 h-100');
        wrapper.innerHTML = `
            <div class="learning-header">
                <span>Matching (${this.currentWordIndex + 1}/${this.words.length})</span>
            </div>
            <div style="padding:40px; text-align:center;">
                <h1>${wordData.word}</h1>
            </div>
            <div class="word-bank" style="flex-direction:column">
            </div>
        `;

        const bank = wrapper.querySelector('.word-bank');
        options.forEach(opt => {
            const btn = dom.create('button', 'btn w-100 mt-20', opt.definition_zh);
            btn.style.background = 'white';
            btn.style.border = '1px solid #ccc';

            btn.onclick = () => {
                if (opt === wordData) {
                    btn.style.background = '#4CAF50';
                    btn.style.color = 'white';
                    setTimeout(() => {
                        this.currentWordIndex++;
                        this.renderMatching();
                    }, 500);
                } else {
                    btn.style.background = '#F44336';
                    btn.style.color = 'white';
                    // Shake?
                }
            };
            bank.appendChild(btn);
        });

        this.container.appendChild(wrapper);
    }

    // --- Phase 4: Spelling (Listening) ---
    renderSpelling() {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const wordData = this.words[this.currentWordIndex];

        const wrapper = dom.create('div', 'w-100 h-100');
        wrapper.innerHTML = `
            <div class="learning-header">
                <span>Spelling (${this.currentWordIndex + 1}/${this.words.length})</span>
                <button class="btn" id="skip-btn" style="background:#999">Skip</button>
            </div>
            <div style="padding:40px; text-align:center;">
                <button class="btn" id="play-spelling">🔊 Play Sound</button>
                <div class="mt-20">
                    <input type="text" id="spelling-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                        style="font-size:1.5rem; padding:10px; width:80%; text-align:center;" />
                </div>
                <div id="feedback" class="mt-20"></div>
            </div>
            <!-- Keyboard spacer for mobile -->
            <div style="height:200px"></div>
        `;

        this.container.appendChild(wrapper);

        const input = wrapper.querySelector('#spelling-input');
        input.focus();

        // Auto play
        tts.playAudio(wordData.word);

        wrapper.querySelector('#play-spelling').onclick = () => tts.playAudio(wordData.word);

        const check = () => {
            const val = input.value.trim().toLowerCase();
            if (val === wordData.word.toLowerCase()) {
                wrapper.querySelector('#feedback').textContent = "Correct!";
                wrapper.querySelector('#feedback').style.color = 'green';
                setTimeout(() => {
                    this.currentWordIndex++;
                    this.renderSpelling();
                }, 800);
            }
        };

        input.addEventListener('input', check);

        wrapper.querySelector('#skip-btn').onclick = () => {
            this.currentWordIndex++;
            this.renderSpelling();
        };
    }

    // --- Phase 5: Self Check (Review) ---
    renderSelfCheck() {
        if (this.currentWordIndex >= this.words.length) {
            this.nextPhase();
            return;
        }

        const wordData = this.words[this.currentWordIndex];

        const wrapper = dom.create('div', 'w-100 h-100');
        wrapper.innerHTML = `
            <div class="learning-header">
                <span>Final Review (${this.currentWordIndex + 1}/${this.words.length})</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:20px;">
                <h1>${wordData.word}</h1>
                <div id="review-details" class="hidden">
                    <p>${wordData.definition_zh}</p>
                    <p>${wordData.example_en}</p>
                </div>
                <button class="btn mt-20" id="show-ans">Show Details</button>

                <div class="review-actions hidden" id="actions">
                    <button class="circle-btn btn-green" data-rating="green">Easy</button>
                    <button class="circle-btn btn-yellow" data-rating="yellow">Ok</button>
                    <button class="circle-btn btn-red" data-rating="red">Hard</button>
                </div>
            </div>
        `;
        this.container.appendChild(wrapper);

        const showBtn = wrapper.querySelector('#show-ans');
        const details = wrapper.querySelector('#review-details');
        const actions = wrapper.querySelector('#actions');

        showBtn.onclick = () => {
            details.classList.remove('hidden');
            actions.classList.remove('hidden');
            actions.style.display = 'flex'; // override
            showBtn.style.display = 'none';
        };

        const handleRating = (rating) => {
            this.results[wordData.word] = rating;

            if (rating === 'red') {
                // Add to redo queue if not already there
                if (!this.redoQueue.includes(wordData)) {
                    this.redoQueue.push(wordData);
                }
            }

            this.currentWordIndex++;
            this.renderSelfCheck();
        };

        actions.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => handleRating(btn.dataset.rating);
        });
    }
}
