// Funktion zum Aktualisieren des Toolbar-Icons
async function update_icon() {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
        const tab = tabs[0];
        if (!tab) return;

        if (is_valid_page(tab.url)) {
            chrome.action.setIcon({ path: "assets/icon-64.png", tabId: tab.id });
        } else {
            chrome.action.setIcon({ path: "assets/icon-64-disabled.png", tabId: tab.id });
        }
    } catch (err) {
        console.error(err);
    }
}

// Prüft, ob die URL gültig ist
function is_valid_page(url) {
    return /https:\/\/.*\/ebook\/.*/.test(url);
}

// Event-Listener für V3 Service Worker
chrome.tabs.onActivated.addListener(update_icon);
chrome.tabs.onUpdated.addListener(update_icon);
chrome.windows.onFocusChanged.addListener(update_icon);

// Conversion-Status
let converting = false;
let converting_tab = -1;
let convert_progress = {
    title: '',
    from_page: -1,
    cur_page: -1,
    to_page: -1,
    page_count: -1,
    time_begin: 0,
};

// Nachrichtenlistener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === "start_converting") {
        converting = true;
        convert_progress = message.convert_progress;
    } else if (message.type === "update_tabid") {
        converting_tab = message.tabid;
    } else if (message.type === "is_converting") {
        sendResponse({ converting, converting_tab });
    } else if (message.type === "get_progress") {
        sendResponse({ convert_progress });
    } else if (message.type === "stop_converting") {
        converting = false;
        converting_tab = -1;
    } else if (message.type === "update_progress") {
        convert_progress = message.convert_progress;
        if (convert_progress.cur_page === convert_progress.to_page) {
            converting = false;
            converting_tab = -1;
        }
    } else if (message.type === "remove_materialize_css") {
        // Beispiel: keine Aktion nötig
    }

    // Async Response
    return true;
});

// Initial Icon-Update beim Laden des Service Workers
update_icon();