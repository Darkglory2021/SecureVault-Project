# SecureVault Password Manager

## Video Demo: https://youtu.be/x4GPqpWKCOU

## Description

SecureVault is a fully client-side, zero-backend password manager implemented as both a Chrome extension and a companion web application. It leverages cryptographic techniques—namely PBKDF2 for key derivation and AES-GCM for encryption to keep your credentials safe entirely within your browser environment. By storing only ciphertext and salted hashes in `localStorage`, SecureVault ensures that no sensitive data ever leaves your machine. The extension detects when you navigate to a domain for which you have saved credentials, prompts you via a popup, and, with your consent, autofills the login form. The web app offers an alternative interface for managing your vault entries outside of the extension.

## Table of Contents

1. [Features](#features)  
2. [Getting Started](#getting-started)  
   - [Prerequisites](#prerequisites)  
   - [Installation](#installation)  
3. [Usage](#usage)  
4. [Project Architecture](#project-architecture)  
   - [manifest.json](#manifestjson)  
   - [background.js](#backgroundjs)  
   - [content.js](#contentjs)  
   - [popup.html & popup.js](#popuphtml--popupjs)  
   - [crypto.js](#cryptojs)  
   - [app.js, index.html & styles.css](#appjs-indexhtml--stylescss)  
   - [Icons](#icons)  
5. [Design Decisions](#design-decisions)  
6. [Future Work](#future-work) 

## Features

- **Client-Side Only**: All cryptographic operations, authentication, and data storage occur locally in the browser—no external servers.  
- **Strong Encryption**: Master password is processed via PBKDF2 (100,000 iterations) to produce a 256-bit AES-GCM key.  
- **Secure Authentication**: Master password verification uses a salted hash, never storing the raw password.  
- **Domain-Aware Autofill**: Matches the current hostname to saved credentials and prompts the user for one-click login.  
- **Vault Management**: Add, edit, or delete entries from a popup or standalone web app.  
- **Real-Time Sync**: Changes propagate instantly across service worker, popup UI, and content scripts.  
- **Lightweight UI**: Minimal dependencies, responsive design, and clear success/error feedback.  

## Getting Started

### Prerequisites

- Latest version of Chrome (or Chromium-based browser).  
- Basic familiarity with Chrome extension installation and developer mode.  
- Node.js and npm (optional, for running the web app locally).  

### Installation

1. **Clone the repository**:  
   ```bash
   git clone https://github.com/your-github-username/SecureVault.git
   cd SecureVault/extension

2. **Load the extension**  
   - Open Chrome and navigate to `chrome://extensions`.  
   - Enable **Developer mode**.  
   - Click **Load unpacked** and select the `extension/` folder.  

3. **Run the web app (optional)**  
   ```bash
   cd ../project
   npm install
   npm run serve

4. **Then open your browser to http://localhost:5000.**

### Usage

1. **Register / Login:** Click the lock icon in the toolbar, set a master password, and save.

2. **Add Credentials:** In the popup, enter the platform name, URL, username, and password.  

3. **Autofill:** Visit the platform’s login page; a prompt appears asking if you want to autofill.

4. **Manage Vault:** Use the popup or web app to review, update, or delete entries.

### Project Architecture

### manifest.json

Defines the extension’s metadata, permissions (`storage`, `activeTab`, `scripting`), and entry points:

*   **background.js** (service worker)  
*   **content.js** (injected script)  
*   **popup.html** (UI)  

### background.js

*   Manages the encrypted vault state in `localStorage`.  
*   Listens for vault updates and broadcasts state to content scripts.  
*   Monitors web navigation events to detect domain matches.  

### content.js

*   Injects into every webpage to identify login forms.  
*   Communicates with the service worker to request decrypted credentials.  
*   Prompts the user and performs autofill upon consent.  

### popup.html & popup.js

*   Renders a simple UI for listing and managing vault entries.  
*   Handles user input for adding, editing, and deleting credentials.  
*   Encrypts data with `crypto.js` and sends updates to the background script.  

### crypto.js

*   Implements PBKDF2 key derivation with a random salt.  
*   Provides AES-GCM encryption/decryption routines.  
*   Contains `hashPassword` and `verifyPassword` for secure master-password authentication.  

### app.js, index.html & styles.css

*   Standalone web app mirroring popup functionality.  
*   Uses the same crypto routines for offline vault management.  
*   Styled with minimal CSS for a clean, responsive UI.  

### Icons

*   `icons/lock-16.png`, `icons/lock-32.png`, `icons/lock-128.png` used for toolbar and UI elements.  

---

## Design Decisions

*   **Zero-Backend Model**: Data remains entirely on-device for maximum privacy, eliminating server vulnerabilities.  
*   **PBKDF2 Iterations**: 100,000 iterations balance security against brute-force and in-browser performance.  
*   **AES-GCM**: Combines encryption with integrity checks, ensuring confidentiality and tamper detection.  
*   **localStorage vs IndexedDB**: Chosen for simplicity and synchronous reads in content scripts; IndexedDB may be adopted later for larger vaults.  
*   **Service Worker Broadcasts**: Enables instant vault-state sync without polling via Chrome messaging APIs.  
*   **Popup UI Simplicity**: Minimal design to keep the UX clear; advanced features (e.g., tagging, search) reserved for future updates.  

---

## Future Work

*   **End-to-End Cross-Device Sync**: Add optional encrypted sync via user-provided cloud endpoints.  
*   **Biometric Unlock**: Integrate WebAuthn or Chrome OS fingerprint/pin APIs.  
*   **WebAssembly Crypto**: Migrate heavy crypto ops to WASM for lower latency.  
*   **Advanced Autofill Rules**: Support pattern-based form matching and SSO workflows.  
*   **Mobile Extension Support**: Build companion extensions for Firefox and mobile browsers.  
