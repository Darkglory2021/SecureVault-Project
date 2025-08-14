/**
 * Crypto utility functions for password encryption/decryption
 * Uses AES-GCM for secure encryption with user's password as key derivation source
 */

class CryptoUtils {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12; // 96 bits recommended for GCM
        this.saltLength = 16;
        this.tagLength = 16;
        this.iterations = 100000; // PBKDF2 iterations
    }

    /**
     * Generate cryptographically secure random bytes
     */
    generateRandomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    /**
     * Derive encryption key from password using PBKDF2
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        
        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveKey']
        );

        // Derive AES key
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: this.algorithm,
                length: this.keyLength
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt data using AES-GCM
     */
    async encrypt(plaintext, password) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);
            
            // Generate random salt and IV
            const salt = this.generateRandomBytes(this.saltLength);
            const iv = this.generateRandomBytes(this.ivLength);
            
            // Derive key from password
            const key = await this.deriveKey(password, salt);
            
            // Encrypt data
            const encryptedBuffer = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                data
            );
            
            // Combine salt + iv + encrypted data
            const encrypted = new Uint8Array(encryptedBuffer);
            const result = new Uint8Array(salt.length + iv.length + encrypted.length);
            result.set(salt, 0);
            result.set(iv, salt.length);
            result.set(encrypted, salt.length + iv.length);
            
            // Return as base64 string
            return btoa(String.fromCharCode(...result));
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt data using AES-GCM
     */
    async decrypt(encryptedData, password) {
        try {
            // Convert base64 back to bytes
            const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            
            // Extract salt, IV, and encrypted data
            const salt = data.slice(0, this.saltLength);
            const iv = data.slice(this.saltLength, this.saltLength + this.ivLength);
            const encrypted = data.slice(this.saltLength + this.ivLength);
            
            // Derive key from password
            const key = await this.deriveKey(password, salt);
            
            // Decrypt data
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                key,
                encrypted
            );
            
            // Convert back to string
            const decoder = new TextDecoder();
            return decoder.decode(decryptedBuffer);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data - invalid password or corrupted data');
        }
    }

    /**
     * Hash password for authentication (separate from encryption key derivation)
     */
    async hashPassword(password, salt = null) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        
        // Generate salt if not provided
        if (!salt) {
            salt = this.generateRandomBytes(this.saltLength);
        }
        
        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            data,
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        // Derive hash
        const hashBuffer = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        
        const hash = new Uint8Array(hashBuffer);
        const result = new Uint8Array(salt.length + hash.length);
        result.set(salt, 0);
        result.set(hash, salt.length);
        
        return btoa(String.fromCharCode(...result));
    }

    /**
     * Verify password against stored hash
     */
    async verifyPassword(password, storedHash) {
        try {
            // Extract salt from stored hash
            const hashData = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
            const salt = hashData.slice(0, this.saltLength);
            
            // Hash the provided password with the same salt
            const computedHash = await this.hashPassword(password, salt);
            
            // Compare hashes
            return computedHash === storedHash;
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }
}

// Global instance
window.cryptoUtils = new CryptoUtils();