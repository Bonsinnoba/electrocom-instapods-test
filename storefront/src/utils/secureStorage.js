/**
 * secureStorage.js
 * A wrapper for localStorage that provides user-scoping and basic obfuscation.
 * While real encryption is possible, this layer focuses on architectural separation
 * and preventing simple plain-text inspection of metadata.
 */

const APP_PREFIX = 'ehub_v3';

// Simple obfuscation to prevent plain-text "shoulder surfing"
const obfuscate = (str) => {
    if (!str) return str;
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch {
        return str;
    }
};

const deobfuscate = (str) => {
    if (!str) return str;
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch {
        return str;
    }
};

export const secureStorage = {
    /**
     * Set a value in storage, scoped specifically to the current user.
     */
    setItem: (key, value, userId = 'guest') => {
        try {
            const id = userId || 'guest';
            const fullKey = `${APP_PREFIX}_${key}_${id}`;
            
            // Minimize data if it's the user object to avoid QuotaExceededError
            let processedValue = value;
            if (key === 'user' && value && typeof value === 'object') {
                processedValue = { ...value };
                if (processedValue.profileImage && processedValue.profileImage.length > 5000) {
                    console.warn(`[secureStorage] profileImage too large for ${id}, omitting from storage.`);
                    delete processedValue.profileImage;
                }
            }

            const stringValue = JSON.stringify(processedValue);
            localStorage.setItem(fullKey, obfuscate(stringValue));
        } catch (e) {
            console.error(`Failed to set secure storage for ${key}`, e);
            
            // If quota exceeded, try to clear non-essential data or just log
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.warn('[secureStorage] Quota exceeded. Attempting self-heal...');
                // Optional: clear other keys with APP_PREFIX to make room
                try {
                    // Logic to clear old logs or non-essential keys could go here
                } catch (e2) {
                    console.warn('Failed to clear storage for quota:', e2);
                }
            }
        }
    },

    /**
     * Get a value from storage for the current user.
     */
    getItem: (key, userId = 'guest') => {
        try {
            const id = userId || 'guest';
            const fullKey = `${APP_PREFIX}_${key}_${id}`;
            const saved = localStorage.getItem(fullKey);
            if (!saved) return null;
            return JSON.parse(deobfuscate(saved));
        } catch (e) {
            console.warn(`Failed to parse secure storage for ${key}`, e);
            return null;
        }
    },

    /**
     * Remove a specific key for the user.
     */
    removeItem: (key, userId = 'guest') => {
        try {
            const id = userId || 'guest';
            const fullKey = `${APP_PREFIX}_${key}_${id}`;
            localStorage.removeItem(fullKey);
        } catch (e) {
            console.error(`Failed to remove secure storage for ${key}`, e);
        }
    },

    /**
     * Clear generic app data (not recommended unless full reset).
     */
    clear: () => {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(APP_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.error('Failed to clear secure storage', e);
        }
    }
};
