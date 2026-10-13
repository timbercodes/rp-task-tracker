/**
 * RP Task Tracker - Background Service Worker
 * Built for Chrome Extension Manifest V3.
 * Handles extension lifecycle events and browser action clicks.
 */

/**
 * Listens for clicks on the extension icon in the browser toolbar.
 * Opens the main dashboard in a new full-size tab for a better user experience,
 * rather than confining it to a small popup.
 */
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'dashboard/dashboard.html' });
});

/**
 * Dynamically registers content scripts only for saved forum URLs.
 * @param {Array} forums - Array of forum objects from storage
 */
async function updateContentScripts(forums) {
    // 1. Clear previously registered scripts to avoid duplicates
    try {
        await chrome.scripting.unregisterContentScripts({ ids: ["forum-tracker-script"] });
    } catch (e) {
        // Ignore error if scripts were not registered yet
    }

    if (!forums || forums.length === 0) return;

    // 2. Format URL patterns (e.g., *://*.example.com/* and *://example.com/*)
    const matchPatterns = forums.flatMap(f => {
        // Strip http://, https:// and trailing paths to get the clean domain
        const cleanUrl = f.url.replace(/^https?:\/\//, '').split('/')[0];
        return [
            `*://${cleanUrl}/*`,    // For bare domains (myforum.com)
            `*://*.${cleanUrl}/*`   // For subdomains (www.myforum.com, my.myforum.com)
        ];
    });

    // 3. Register the script only for the matched URLs
    await chrome.scripting.registerContentScripts([{
        id: "forum-tracker-script",
        matches: matchPatterns,
        js: ["scripts/utils.js", "scripts/content.js"],
        css: ["scripts/content.css"],
        runAt: "document_idle"
    }]);
}

// Initialize on extension startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['savedForums'], (result) => {
        updateContentScripts(result.savedForums);
    });
});

// Initialize on extension installation or update
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['savedForums'], (result) => {
        updateContentScripts(result.savedForums);
    });
});

// Listen for changes in forum settings and update scripts dynamically
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.savedForums) {
        updateContentScripts(changes.savedForums.newValue);
    }
});
