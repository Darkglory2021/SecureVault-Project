/**
 * Popup Script for SecureVault Chrome Extension
 * Handles the popup interface and communication with background script
 */

class PopupController {
    constructor() {
        this.currentTab = null;
        this.vaultStatus = {
            isLoggedIn: false,
            userEmail: null,
            entriesCount: 0
        };
        
        this.init();
    }

    async init() {
        await this.getCurrentTab();
        await this.loadVaultStatus();
        this.setupEventListeners();
        this.updateUI();
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
        } catch (error) {
            console.error('Error getting current tab:', error);
        }
    }

    async loadVaultStatus() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'POPUP_REQUEST_STATUS'
            });

            if (response) {
                this.vaultStatus = response;
            }
        } catch (error) {
            console.error('Error loading vault status:', error);
        }
    }

    setupEventListeners() {
        // Open webapp button
        document.getElementById('open-webapp-btn').addEventListener('click', () => {
            this.openWebApp();
        });

        // Autofill button
        document.getElementById('autofill-btn').addEventListener('click', () => {
            this.requestAutofill();
        });
    }

    updateUI() {
        // Hide loading, show content
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');

        // Update status
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const userInfo = document.getElementById('user-info');
        const stats = document.getElementById('stats');

        if (this.vaultStatus.isLoggedIn) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Connected';
            userInfo.textContent = `Logged in as ${this.vaultStatus.userEmail}`;
            userInfo.classList.remove('hidden');
            stats.classList.remove('hidden');
            
            document.getElementById('entries-count').textContent = this.vaultStatus.entriesCount;
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Not Connected';
            userInfo.classList.add('hidden');
            stats.classList.add('hidden');
        }

        // Update current site info
        this.updateCurrentSiteInfo();
    }

    async updateCurrentSiteInfo() {
        const siteDomainEl = document.getElementById('site-domain');
        const passwordStatusEl = document.getElementById('password-status');
        const autofillBtn = document.getElementById('autofill-btn');

        if (!this.currentTab || !this.currentTab.url) {
            siteDomainEl.textContent = 'Unable to access current site';
            passwordStatusEl.classList.add('hidden');
            autofillBtn.classList.add('hidden');
            return;
        }

        try {
            const url = new URL(this.currentTab.url);
            const domain = url.hostname;
            
            siteDomainEl.textContent = domain;

            // Check if we have password for this domain
            if (this.vaultStatus.isLoggedIn) {
                const response = await chrome.runtime.sendMessage({
                    type: 'GET_PASSWORD_DATA',
                    domain: domain
                });

                if (response && response.passwordData) {
                    passwordStatusEl.innerHTML = `
                        <svg class="icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
                            <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                        </svg>
                        Password available for ${response.passwordData.platform}
                    `;
                    passwordStatusEl.className = 'password-available';
                    autofillBtn.classList.remove('hidden');
                } else {
                    passwordStatusEl.innerHTML = `
                        <svg class="icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
                            <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
                        </svg>
                        No password saved for this site
                    `;
                    passwordStatusEl.className = 'password-available no-password';
                    autofillBtn.classList.add('hidden');
                }
            } else {
                passwordStatusEl.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;">
                        <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
                    </svg>
                    Please login to SecureVault first
                `;
                passwordStatusEl.className = 'password-available no-password';
                autofillBtn.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error updating current site info:', error);
            siteDomainEl.textContent = 'Invalid URL';
            passwordStatusEl.classList.add('hidden');
            autofillBtn.classList.add('hidden');
        }
    }

    async openWebApp() {
        try {
            await chrome.runtime.sendMessage({
                type: 'POPUP_OPEN_WEBAPP'
            });
            
            // Close popup after opening webapp
            window.close();
        } catch (error) {
            console.error('Error opening webapp:', error);
        }
    }

    async requestAutofill() {
        if (!this.currentTab || !this.currentTab.url) {
            return;
        }

        try {
            const url = new URL(this.currentTab.url);
            const domain = url.hostname;

            await chrome.runtime.sendMessage({
                type: 'REQUEST_AUTOFILL',
                domain: domain
            });

            // Show success feedback
            const autofillBtn = document.getElementById('autofill-btn');
            const originalText = autofillBtn.innerHTML;
            
            autofillBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                </svg>
                Password Filled!
            `;
            autofillBtn.style.background = '#28a745';

            setTimeout(() => {
                autofillBtn.innerHTML = originalText;
                autofillBtn.style.background = '';
            }, 2000);

            // Close popup after a short delay
            setTimeout(() => {
                window.close();
            }, 1500);

        } catch (error) {
            console.error('Error requesting autofill:', error);
            
            // Show error feedback
            const autofillBtn = document.getElementById('autofill-btn');
            const originalText = autofillBtn.innerHTML;
            
            autofillBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
                </svg>
                Error!
            `;
            autofillBtn.style.background = '#dc3545';

            setTimeout(() => {
                autofillBtn.innerHTML = originalText;
                autofillBtn.style.background = '';
            }, 2000);
        }
    }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PopupController();
    });
} else {
    new PopupController();
}