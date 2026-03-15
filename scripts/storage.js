/**
 * STORAGE HELPERS
 * Promisifying chrome.storage makes async/await logic much cleaner. No nested callbacks needed
 */
export const storageLocal = {
    get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
    set: (data) => new Promise((resolve) => chrome.storage.local.set(data, resolve))
};

export const storageSession = {
    get: (keys) => new Promise((resolve) => chrome.storage.session.get(keys, resolve)),
    set: (data) => new Promise((resolve) => chrome.storage.session.set(data, resolve))
};
