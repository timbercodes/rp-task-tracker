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
