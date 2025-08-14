/**
 * SecureVault Password Manager - Main Application Logic
 * Handles authentication, password management, and Chrome extension communication
 */

class PasswordVault {
    constructor() {
        this.currentUser = null;
        this.userPassword = null; // Used for encryption/decryption
        this.entries = [];
        this.editingEntryId = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthState();
        this.loadDemoLogos(); // For demo purposes
    }

    setupEventListeners() {
        // Authentication
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Password confirmation in register
        document.getElementById('confirmPassword').addEventListener('input', () => {
            this.checkPasswordMatch();
        });

        document.getElementById('registerPassword').addEventListener('input', () => {
            this.checkPasswordMatch();
        });

        // Entry management
        document.getElementById('addEntryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddEntry();
        });

        document.getElementById('editEntryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEditEntry();
        });

        // Modal controls
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('editModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    checkAuthState() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            // Note: We don't save the password for security, user must re-enter
            this.showLoginForm();
        }
    }

    showLoginForm() {
        document.getElementById('login-form').classList.add('active');
        document.getElementById('register-form').classList.remove('active');
    }

    showRegisterForm() {
        document.getElementById('register-form').classList.add('active');
        document.getElementById('login-form').classList.remove('active');
    }

    checkPasswordMatch() {
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const indicator = document.getElementById('password-match-indicator');

        if (password.length > 0 && confirmPassword.length > 0) {
            if (password === confirmPassword) {
                indicator.textContent = '✓ Passwords match';
                indicator.className = 'password-indicator match';
            } else {
                indicator.textContent = '✗ Passwords do not match';
                indicator.className = 'password-indicator no-match';
            }
        } else {
            indicator.textContent = '';
            indicator.className = 'password-indicator';
        }
    }

    async handleRegister() {
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        if (password.length < 8) {
            alert('Password must be at least 8 characters long!');
            return;
        }

        try {
            // Check if user already exists
            const existingUsers = JSON.parse(localStorage.getItem('users') || '{}');
            if (existingUsers[email]) {
                alert('User with this email already exists!');
                return;
            }

            // Hash password for storage
            const hashedPassword = await cryptoUtils.hashPassword(password);

            // Save user
            existingUsers[email] = {
                email: email,
                hashedPassword: hashedPassword,
                createdAt: new Date().toISOString()
            };

            localStorage.setItem('users', JSON.stringify(existingUsers));
            
            alert('Registration successful! Please login.');
            this.showLoginForm();
            
            // Clear form
            document.getElementById('registerForm').reset();
            this.checkPasswordMatch();
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed. Please try again.');
        }
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const users = JSON.parse(localStorage.getItem('users') || '{}');
            const user = users[email];

            if (!user) {
                alert('User not found!');
                return;
            }

            // Verify password
            const isValidPassword = await cryptoUtils.verifyPassword(password, user.hashedPassword);
            
            if (!isValidPassword) {
                alert('Invalid password!');
                return;
            }

            // Login successful
            this.currentUser = user;
            this.userPassword = password; // Store for encryption/decryption
            localStorage.setItem('currentUser', JSON.stringify(user));

            this.showMainApp();
            await this.loadUserEntries();
            
            // Notify Chrome extension about login
            this.notifyExtension('user_logged_in', { email: email });
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    }

    handleLogout() {
        this.currentUser = null;
        this.userPassword = null;
        this.entries = [];
        localStorage.removeItem('currentUser');
        
        // Notify Chrome extension about logout
        this.notifyExtension('user_logged_out');
        
        this.showAuthForm();
    }

    showAuthForm() {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        
        // Clear forms
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
    }

    showMainApp() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        document.getElementById('userEmail').textContent = this.currentUser.email;
        document.getElementById('loginForm').reset();
    }

    async loadUserEntries() {
        try {
            const userDataKey = `entries_${this.currentUser.email}`;
            const encryptedData = localStorage.getItem(userDataKey);
            
            if (encryptedData) {
                const decryptedData = await cryptoUtils.decrypt(encryptedData, this.userPassword);
                this.entries = JSON.parse(decryptedData);
            } else {
                this.entries = [];
            }
            
            this.renderEntries();
        } catch (error) {
            console.error('Error loading entries:', error);
            // If decryption fails, might be due to password change, reset entries
            this.entries = [];
            this.renderEntries();
        }
    }

    async saveUserEntries() {
        try {
            const userDataKey = `entries_${this.currentUser.email}`;
            const dataToEncrypt = JSON.stringify(this.entries);
            const encryptedData = await cryptoUtils.encrypt(dataToEncrypt, this.userPassword);
            
            localStorage.setItem(userDataKey, encryptedData);
            
            // Notify Chrome extension about data update
            this.notifyExtension('entries_updated', this.entries);
        } catch (error) {
            console.error('Error saving entries:', error);
            alert('Failed to save entries. Please try again.');
        }
    }

    async handleAddEntry() {
        const platformName = document.getElementById('platformName').value.trim();
        const platformUsername = document.getElementById('platformUsername').value.trim();
        const platformPassword = document.getElementById('platformPassword').value;

        if (!platformName || !platformUsername || !platformPassword) {
            alert('Please fill in all fields!');
            return;
        }

        // Check for duplicate platform
        if (this.entries.some(entry => entry.platform.toLowerCase() === platformName.toLowerCase())) {
            alert('An entry for this platform already exists!');
            return;
        }

        const newEntry = {
            id: Date.now().toString(),
            platform: this.capitalizePlatform(platformName),
            username: platformUsername,
            password: platformPassword,
            createdAt: new Date().toISOString()
        };

        this.entries.push(newEntry);
        await this.saveUserEntries();
        this.renderEntries();

        // Clear form
        document.getElementById('addEntryForm').reset();
        
        alert('Password entry added successfully!');
    }

    async handleEditEntry() {
        const platformName = document.getElementById('editPlatformName').value.trim();
        const platformUsername = document.getElementById('editPlatformUsername').value.trim();
        const platformPassword = document.getElementById('editPlatformPassword').value;

        if (!platformName || !platformUsername || !platformPassword) {
            alert('Please fill in all fields!');
            return;
        }

        const entryIndex = this.entries.findIndex(entry => entry.id === this.editingEntryId);
        if (entryIndex === -1) {
            alert('Entry not found!');
            return;
        }

        // Check for duplicate platform (excluding current entry)
        const duplicateEntry = this.entries.find(entry => 
            entry.platform.toLowerCase() === platformName.toLowerCase() && 
            entry.id !== this.editingEntryId
        );

        if (duplicateEntry) {
            alert('An entry for this platform already exists!');
            return;
        }

        this.entries[entryIndex] = {
            ...this.entries[entryIndex],
            platform: this.capitalizePlatform(platformName),
            username: platformUsername,
            password: platformPassword,
            updatedAt: new Date().toISOString()
        };

        await this.saveUserEntries();
        this.renderEntries();
        this.closeModal();
        
        alert('Password entry updated successfully!');
    }

    async handleDeleteEntry(entryId) {
        if (!confirm('Are you sure you want to delete this password entry?')) {
            return;
        }

        this.entries = this.entries.filter(entry => entry.id !== entryId);
        await this.saveUserEntries();
        this.renderEntries();
        
        alert('Password entry deleted successfully!');
    }

    capitalizePlatform(platform) {
        return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
    }

    renderEntries() {
        const entriesList = document.getElementById('entriesList');
        const emptyState = document.getElementById('emptyState');

        if (this.entries.length === 0) {
            entriesList.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        
        entriesList.innerHTML = this.entries.map(entry => `
            <div class="entry-card">
                <div class="platform-logo">
                    ${this.getPlatformLogo(entry.platform)}
                </div>
                <div class="entry-details">
                    <div class="platform-name">${entry.platform}</div>
                    <div class="username-display">Username: ${entry.username}</div>
                    <div class="password-container">
                        <span class="password-display" data-entry-id="${entry.id}">
                            ${'#'.repeat(entry.password.length)}
                        </span>
                        <button class="toggle-password" onclick="vault.togglePassword('${entry.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                <div class="entry-actions">
                    <button class="btn-small btn-edit" onclick="vault.openEditModal('${entry.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-small btn-delete" onclick="vault.handleDeleteEntry('${entry.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    getPlatformLogo(platform) {
        // Try to get logo from various sources
        const platformLower = platform.toLowerCase();
        
        // First try: Use a logo API service
        const logoUrl = `https://logo.clearbit.com/${platformLower}.com`;
        
        // Return img element with fallback to icon
        return `
            <img src="${logoUrl}" 
                 alt="${platform}" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                 style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
            <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background: #f8f9fa; border-radius: 8px;">
                <i class="fas fa-globe" style="font-size: 24px; color: #667eea;"></i>
            </div>
        `;
    }

    togglePassword(entryId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (!entry) return;

        const passwordDisplay = document.querySelector(`[data-entry-id="${entryId}"]`);
        const toggleButton = passwordDisplay.nextElementSibling.querySelector('i');

        if (passwordDisplay.textContent === '#'.repeat(entry.password.length)) {
            // Show password
            passwordDisplay.textContent = entry.password;
            toggleButton.className = 'fas fa-eye-slash';
        } else {
            // Hide password
            passwordDisplay.textContent = '#'.repeat(entry.password.length);
            toggleButton.className = 'fas fa-eye';
        }
    }

    openEditModal(entryId) {
        const entry = this.entries.find(e => e.id === entryId);
        if (!entry) return;

        this.editingEntryId = entryId;
        
        document.getElementById('editPlatformName').value = entry.platform;
        document.getElementById('editPlatformUsername').value = entry.username;
        document.getElementById('editPlatformPassword').value = entry.password;
        
        document.getElementById('editModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('editModal').style.display = 'none';
        this.editingEntryId = null;
        document.getElementById('editEntryForm').reset();
    }

    // Chrome Extension Communication
    notifyExtension(action, data = null) {
        // Post message to Chrome extension content script
        window.postMessage({
            type: 'VAULT_UPDATE',
            action: action,
            data: data,
            timestamp: Date.now()
        }, '*');

        // Also try to communicate with extension directly if available
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: 'VAULT_UPDATE',
                action: action,
                data: data,
                timestamp: Date.now()
            }).catch(() => {
                // Extension not available, ignore error
            });
        }
    }

    // Public method to get password for a domain (for Chrome extension)
    getPasswordForDomain(domain) {
        if (!this.currentUser || !this.entries) {
            return null;
        }

        // Try to match domain with platform names
        const normalizedDomain = domain.toLowerCase().replace('www.', '');
        
        for (const entry of this.entries) {
            const platformLower = entry.platform.toLowerCase();
            
            // Direct match
            if (normalizedDomain.includes(platformLower) || platformLower.includes(normalizedDomain)) {
                return {
                    platform: entry.platform,
                    username: entry.username,
                    password: entry.password
                };
            }
            
            // Try with .com extension
            if (normalizedDomain.includes(platformLower + '.com') || (platformLower + '.com').includes(normalizedDomain)) {
                return {
                    platform: entry.platform,
                    username: entry.username,
                    password: entry.password
                };
            }
        }

        return null;
    }

    // Demo logos for development (remove in production)
    loadDemoLogos() {
        // This method can be used to preload common platform logos
        const commonPlatforms = ['gmail', 'facebook', 'twitter', 'instagram', 'linkedin', 'github'];
        commonPlatforms.forEach(platform => {
            const img = new Image();
            img.src = `https://logo.clearbit.com/${platform}.com`;
        });
    }
}

// Initialize the application
const vault = new PasswordVault();

// Listen for messages from Chrome extension
window.addEventListener('message', (event) => {
    if (event.data.type === 'EXTENSION_REQUEST') {
        const { action, domain } = event.data;
        
        if (action === 'get_password') {
            const passwordData = vault.getPasswordForDomain(domain);
            
            // Send response back to extension
            window.postMessage({
                type: 'VAULT_RESPONSE',
                action: 'password_data',
                data: passwordData,
                requestId: event.data.requestId
            }, '*');
        }
    }
});

// Expose vault instance globally for inline event handlers
window.vault = vault;