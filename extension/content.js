/**
 * Content Script for SecureVault Chrome Extension
 * Detects password fields and provides autofill functionality
 */

class ContentScript {
    constructor() {
        this.isVaultLoggedIn = false;
        this.passwordData = [];
        this.currentDomain = window.location.hostname;
        this.autofillButton = null;
        this.passwordFields = [];
        
        this.init();
    }

    init() {
        this.setupMessageListeners();
        this.detectPasswordFields();
        this.requestVaultStatus();
        
        // Re-scan for password fields when DOM changes
        this.observeDOM();
    }

    setupMessageListeners() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        // Listen for messages from the web app (if on vault website)
        window.addEventListener('message', (event) => {
            if (event.data.type === 'VAULT_UPDATE') {
                this.handleVaultMessage(event.data);
            }
        });
    }

    handleMessage(message, sender, sendResponse) {
        console.log('Content script received message:', message);

        switch (message.type) {
            case 'VAULT_STATUS_UPDATE':
                this.isVaultLoggedIn = message.isLoggedIn;
                this.passwordData = message.passwordData || [];
                this.updateAutofillUI();
                sendResponse({ success: true });
                break;

            case 'PASSWORD_AVAILABLE':
                this.showAutofillOption(message.platform);
                sendResponse({ success: true });
                break;

            case 'AUTOFILL_PASSWORD':
                this.autofillPassword(message.passwordData);
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: true });
        }
    }

    handleVaultMessage(data) {
        // Forward vault messages to background script
        chrome.runtime.sendMessage({
            type: 'VAULT_UPDATE',
            action: data.action,
            data: data.data
        }).catch(() => {
            // Background script might not be ready
        });
    }

    requestVaultStatus() {
        chrome.runtime.sendMessage({
            type: 'POPUP_REQUEST_STATUS'
        }).then(response => {
            if (response) {
                this.isVaultLoggedIn = response.isLoggedIn;
                this.passwordData = [];
                this.updateAutofillUI();
            }
        }).catch(() => {
            // Background script might not be ready
        });
    }

    detectPasswordFields() {
        // Find all password input fields
        this.passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));
        
        // Also look for email/username fields that might be part of login forms
        const emailFields = Array.from(document.querySelectorAll('input[type="email"], input[type="text"]'))
            .filter(field => {
                const placeholder = field.placeholder.toLowerCase();
                const name = field.name.toLowerCase();
                const id = field.id.toLowerCase();
                
                return placeholder.includes('email') || placeholder.includes('username') ||
                       name.includes('email') || name.includes('username') || name.includes('login') ||
                       id.includes('email') || id.includes('username') || id.includes('login');
            });

        console.log(`Found ${this.passwordFields.length} password fields and ${emailFields.length} email/username fields`);

        // If we have password fields, check if we have matching credentials
        if (this.passwordFields.length > 0) {
            this.checkForMatchingCredentials();
        }
    }

    async checkForMatchingCredentials() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_PASSWORD_DATA',
                domain: this.currentDomain
            });

            if (response && response.passwordData) {
                this.showAutofillOption(response.passwordData.platform);
            }
        } catch (error) {
            console.error('Error checking for matching credentials:', error);
        }
    }

    showAutofillOption(platform) {
        if (!this.isVaultLoggedIn || this.passwordFields.length === 0) {
            return;
        }

        // Remove existing autofill button if any
        this.removeAutofillButton();

        // Create autofill button
        this.autofillButton = document.createElement('div');
        this.autofillButton.id = 'securevault-autofill-btn';
        this.autofillButton.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                border: none;
                outline: none;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>
                </svg>
                Fill ${platform} Password
            </div>
        `;

        // Add click event
        this.autofillButton.addEventListener('click', () => {
            this.requestAutofill();
        });

        document.body.appendChild(this.autofillButton);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.removeAutofillButton();
        }, 5000);
    }

    removeAutofillButton() {
        if (this.autofillButton) {
            this.autofillButton.remove();
            this.autofillButton = null;
        }
    }

    requestAutofill() {
        chrome.runtime.sendMessage({
            type: 'REQUEST_AUTOFILL',
            domain: this.currentDomain
        }).catch((error) => {
            console.error('Error requesting autofill:', error);
        });
    }

    autofillPassword(passwordData) {
        console.log('Autofilling password for:', passwordData.platform);

        // Fill password fields
        this.passwordFields.forEach(field => {
            if (field.offsetParent !== null) { // Check if field is visible
                field.value = passwordData.password;
                
                // Trigger input events to notify the page
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Show success notification
        this.showNotification(`Password filled for ${passwordData.platform}`, 'success');
        
        // Remove autofill button
        this.removeAutofillButton();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            background: ${type === 'success' ? '#28a745' : '#667eea'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    updateAutofillUI() {
        if (this.isVaultLoggedIn && this.passwordFields.length > 0) {
            this.checkForMatchingCredentials();
        } else {
            this.removeAutofillButton();
        }
    }

    observeDOM() {
        const observer = new MutationObserver((mutations) => {
            let shouldRecheck = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if new password fields were added
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            if (node.matches && node.matches('input[type="password"]')) {
                                shouldRecheck = true;
                            } else if (node.querySelectorAll) {
                                const passwordFields = node.querySelectorAll('input[type="password"]');
                                if (passwordFields.length > 0) {
                                    shouldRecheck = true;
                                }
                            }
                        }
                    });
                }
            });

            if (shouldRecheck) {
                setTimeout(() => {
                    this.detectPasswordFields();
                }, 500); // Small delay to let the DOM settle
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ContentScript();
    });
} else {
    new ContentScript();
}