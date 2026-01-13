// Speech Synthesis Utility
export const tts = {
    speak(text, rate = 1.0) {
        return new Promise((resolve, reject) => {
            if (!window.speechSynthesis) {
                console.warn('TTS not supported');
                resolve();
                return;
            }

            // Cancel any pending speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = rate;

            utterance.onend = () => {
                resolve();
            };

            utterance.onerror = (e) => {
                console.error('TTS Error', e);
                resolve(); // Resolve anyway to not block flow
            };

            window.speechSynthesis.speak(utterance);
        });
    },

    async playAudio(word) {
        // Attempt to play MP3 if exists (mock check), else fall back to TTS
        // Since we can't really check if file exists on static host easily without 404,
        // we try to load Audio.

        const audioPath = `audio/${word}.mp3`; // Hypothetical path

        // For this environment, we assume we might not have the MP3s yet.
        // We will try to create an Audio object.

        return new Promise((resolve) => {
            const audio = new Audio(audioPath);

            // If it plays, good.
            const playPromise = audio.play();

            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Autoplay started!
                    audio.onended = resolve;
                }).catch(error => {
                    // Auto-play was prevented or file not found. Fallback to TTS.
                    // console.log("Audio file failed or blocked, using TTS", error);
                    this.speak(word).then(resolve);
                });
            } else {
                this.speak(word).then(resolve);
            }
        });
    }
};

export const dom = {
    create(tag, className, text = '') {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text) el.textContent = text;
        return el;
    },

    // Shuffle array
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};
