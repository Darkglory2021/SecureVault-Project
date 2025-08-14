/**
 * Background Service Worker for SecureVault Chrome Extension
 * Handles communication between popup, content scripts, and web app
 */

class BackgroundService {
    constructor() {
        this.passwordData = [];
        this.isUserLoggedIn = false;
        this.userEmail = null;
        
        this.init();
    }

    init() {
        this.setupMessageListeners();
        this.loadStoredData();
    }

    setupMessageListeners() {
        // Listen for messages from content scripts and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Listen for tab updates to check for login pages
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.checkForLoginPage(tabId, tab.url);
            }
        });
    }

    async handleMessage(message, sender, sendResponse) {
        console.log('Background received message:', message);

        switch (message.type) {
            case 'VAULT_UPDATE':
                await this.handleVaultUpdate(message);
                sendResponse({ success: true });
                break;

            case 'GET_PASSWORD_DATA':
                const passwordData = await this.getPasswordForDomain(message.domain);
                sendResponse({ passwordData });
                break;

            case 'REQUEST_AUTOFILL':
                await this.requestAutofill(message.domain, sender.tab.id);
                sendResponse({ success: true });
                break;

            case 'POPUP_REQUEST_STATUS':
                sendResponse({
                    isLoggedIn: this.isUserLoggedIn,
                    userEmail: this.userEmail,
                    entriesCount: this.passwordData.length
                });
                break;

            case 'POPUP_OPEN_WEBAPP':
                chrome.tabs.create({ url: 'http://localhost:8000' }); // Adjust URL as needed
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ error: 'Unknown message type' });
        }
    }

    async handleVaultUpdate(message) {
        console.log('Handling vault update:', message.action);

        switch (message.action) {
            case 'user_logged_in':
                this.isUserLoggedIn = true;
                this.userEmail = message.data.email;
                await this.saveToStorage('userStatus', {
                    isLoggedIn: true,
                    email: message.data.email
                });
                break;

            case 'user_logged_out':
                this.isUserLoggedIn = false;
                this.userEmail = null;
                this.passwordData = [];
                await this.saveToStorage('userStatus', {
                    isLoggedIn: false,
                    email: null
                });
                await this.saveToStorage('passwordData', []);
                break;

            case 'entries_updated':
                this.passwordData = message.data || [];
                await this.saveToStorage('passwordData', this.passwordData);
                break;
        }

        // Notify all content scripts about the update
        this.broadcastToContentScripts(message);
    }

    async broadcastToContentScripts(message) {
        try {
            const tabs = await chrome.tabs.query({});
            
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'VAULT_STATUS_UPDATE',
                    isLoggedIn: this.isUserLoggedIn,
                    passwordData: this.passwordData
                }).catch(() => {
                    // Ignore errors for tabs that don't have content script
                });
            }
        } catch (error) {
            console.error('Error broadcasting to content scripts:', error);
        }
    }

    async getPasswordForDomain(domain) {
        if (!this.isUserLoggedIn || !this.passwordData.length) {
            return null;
        }

        const normalizedDomain = domain.toLowerCase().replace('www.', '');
        
        for (const entry of this.passwordData) {
            const platformLower = entry.platform.toLowerCase();
            
            // Direct match
            if (normalizedDomain.includes(platformLower) || platformLower.includes(normalizedDomain)) {
                return {
                    platform: entry.platform,
                    password: entry.password
                };
            }
            
            // Try with .com extension
            if (normalizedDomain.includes(platformLower + '.com') || (platformLower + '.com').includes(normalizedDomain)) {
                return {
                    platform: entry.platform,
                    password: entry.password
                };
            }
        }

        return null;
    }

    async checkForLoginPage(tabId, url) {
        if (!this.isUserLoggedIn) return;

        try {
            const domain = new URL(url).hostname;
            const passwordData = await this.getPasswordForDomain(domain);

            if (passwordData) {
                // Notify content script that we have password data for this domain
                chrome.tabs.sendMessage(tabId, {
                    type: 'PASSWORD_AVAILABLE',
                    domain: domain,
                    platform: passwordData.platform
                }).catch(() => {
                    // Content script might not be ready yet
                });
            }
        } catch (error) {
            console.error('Error checking for login page:', error);
        }
    }

    async requestAutofill(domain, tabId) {
        const passwordData = await this.getPasswordForDomain(domain);
        
        if (passwordData) {
            chrome.tabs.sendMessage(tabId, {
                type: 'AUTOFILL_PASSWORD',
                passwordData: passwordData
            }).catch((error) => {
                console.error('Error sending autofill message:', error);
            });
        }
    }

    async saveToStorage(key, data) {
        try {
            await chrome.storage.local.set({ [key]: data });
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    async loadFromStorage(key) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key];
        } catch (error) {
            console.error('Error loading from storage:', error);
            return null;
        }
    }

    async loadStoredData() {
        try {
            const userStatus = await this.loadFromStorage('userStatus');
            if (userStatus) {
                this.isUserLoggedIn = userStatus.isLoggedIn || false;
                this.userEmail = userStatus.email || null;
            }

            const passwordData = await this.loadFromStorage('passwordData');
            if (passwordData) {
                this.passwordData = passwordData;
            }

            console.log('Loaded stored data:', {
                isLoggedIn: this.isUserLoggedIn,
                userEmail: this.userEmail,
                entriesCount: this.passwordData.length
            });
        } catch (error) {
            console.error('Error loading stored data:', error);
        }
    }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
    console.log('SecureVault extension started');
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('SecureVault extension installed');
});