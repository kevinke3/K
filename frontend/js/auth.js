class Auth {
    constructor() {
        this.token = localStorage.getItem('kapcha_token');
        this.user = JSON.parse(localStorage.getItem('kapcha_user') || 'null');
        this.init();
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                this.token = result.access_token;
                this.user = result.user;
                localStorage.setItem('kapcha_token', this.token);
                localStorage.setItem('kapcha_user', JSON.stringify(this.user));
                this.updateUI();
                window.location.href = 'gallery.html';
            } else {
                this.showError('loginError', result.error);
            }
        } catch (error) {
            this.showError('loginError', 'Login failed. Please try again.');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            username: formData.get('username'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                this.showSuccess('registerError', 'Registration successful! Please login.');
                e.target.reset();
            } else {
                this.showError('registerError', result.error);
            }
        } catch (error) {
            this.showError('registerError', 'Registration failed. Please try again.');
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('kapcha_token');
        localStorage.removeItem('kapcha_user');
        this.updateUI();
        window.location.href = 'index.html';
    }

    updateUI() {
        const authLinks = document.getElementById('authLinks');
        const userLinks = document.getElementById('userLinks');
        const usernameSpan = document.getElementById('username');

        if (this.user) {
            if (authLinks) authLinks.classList.add('hidden');
            if (userLinks) userLinks.classList.remove('hidden');
            if (usernameSpan) usernameSpan.textContent = this.user.username;
        } else {
            if (authLinks) authLinks.classList.remove('hidden');
            if (userLinks) userLinks.classList.add('hidden');
        }
    }

    getAuthHeader() {
        return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.className = 'error';
        }
    }

    showSuccess(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.className = 'success';
        }
    }
}

// Initialize auth
const auth = new Auth();