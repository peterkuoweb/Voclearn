const API_URL = 'https://script.google.com/macros/s/AKfycbyR_aKVkSoHuBnpBj_7EPQzB1HGbvQyH7yIsFTYnCIfniVWwYA0RC3d-8RgZvQd5M4aJg/exec';

export const api = {
    async request(action, method = 'GET', data = null) {
        let url = `${API_URL}?action=${action}`;
        const options = {
            method: method,
        };

        if (method === 'POST') {
            // GAS requires POST data to be text/plain or application/x-www-form-urlencoded to avoid preflight issues sometimes,
            // but standard fetch with JSON usually works if the script handles OPTIONS.
            // However, the provided script uses `e.postData.contents`, so raw body is expected.
            // To be safe with CORS on GAS, text/plain is often safest.
            options.headers = {
                'Content-Type': 'text/plain;charset=utf-8',
            };
            options.body = JSON.stringify({ action, ...data });
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            if (result.error) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async register(nickname, password, email) {
        return this.request('register', 'POST', { nickname, password, email });
    },

    async login(nickname, password) {
        return this.request('login', 'POST', { nickname, password });
    },

    async sync(nickname, progressData) {
        // progressData includes: totalLearned, streak, points, progress, customBooks, currentBook
        return this.request('sync', 'POST', { nickname, ...progressData });
    },

    async getSettings() {
        return this.request('getSettings');
    },

    async getUsers() {
        return this.request('getUsers');
    }
};
