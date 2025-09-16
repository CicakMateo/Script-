let btn = document.getElementById("convert-btn");
let progress_bar = document.getElementsByClassName("progress")[0];
let progress = document.getElementsByClassName("determinate")[0];
let tabid;

progress_bar.style.display = "none";

// Funktion, wenn Buch nicht geöffnet ist
const disable_popup = () => {
    document.getElementById("cur-book").innerText = 'Buch nicht geöffnet';
    btn.classList.add("disabled");
};

// Popup initialisieren
const initPopup = async () => {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
        if (!tabs || !tabs[0]) {
            console.error("Keine aktive Registerkarte gefunden!");
            disable_popup();
            return;
        }

        const tab = tabs[0];
        tabid = tab.id;

        if (!tab.url.match(/https:\/\/.*\/ebook\/.*/)) {
            disable_popup();
            return;
        }

        chrome.tabs.sendMessage(tabid, { type: "valid" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                disable_popup();
                return;
            }

            if (response && response.injected) {
                document.getElementById("cur-book").innerText = response.title;
            } else {
                disable_popup();
            }
        });

    } catch (e) {
        console.error("Fehler beim Initialisieren des Popups:", e);
        disable_popup();
    }
};

// Klick auf „Konvertieren“-Button
btn.onclick = async () => {
    if (!tabid) return;

    try {
        // Scripts injizieren
        await chrome.scripting.executeScript({
            target: { tabId },
            files: [
                "libraries/browser-polyfill.min.js",
                "libraries/materialize/materialize.min.js",
                "libraries/pdfkit.standalone.min.js",
                "libraries/svg-to-pdfkit.min.js",
                "libraries/saveSvgAsPng.js",
                "scripts/inject.js"
            ]
        });

        // CSS injizieren
        await chrome.scripting.insertCSS({
            target: { tabId },
            files: [
                "libraries/materialize/materialize.min.css",
                "scripts/inject.css"
            ]
        });

        chrome.runtime.sendMessage({ type: "update_tabid", tabid }, (res) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
            } else {
                console.log("Tab-ID aktualisiert");
            }
        });

        console.log("Alle Scripts und CSS injiziert");
        window.close();

    } catch (err) {
        console.error("Fehler beim Injezieren der Scripts:", err);
    }
};

// Conversion Status UI
let ui_cur_page = document.getElementById("cur-page");
let ui_num_pages = document.getElementById("num-pages");
let ui_timer = document.getElementById("timer");

// Status abfragen
chrome.runtime.sendMessage({ type: "is_converting" }, (msg) => {
    if (!msg) return;

    if (msg.converting) {
        document.getElementById("cur-book-text").style.display = "none";
        document.getElementById("converting-text").style.display = null;
        document.getElementById("convert-details").style.display = null;
        progress_bar.style.display = null;
        btn.innerText = "Abbrechen";

        const intervalId = setInterval(() => {
            chrome.runtime.sendMessage({ type: "get_progress" }, (msg) => {
                if (!msg) return;
                let { cur_page, from_page, to_page, time_begin, title } = msg.convert_progress;

                document.getElementById("cur-converting").innerText = title;
                ui_cur_page.innerText = cur_page - from_page + 1;
                ui_num_pages.innerText = to_page - from_page + 1;

                if (!(time_begin instanceof Date)) time_begin = Date.parse(time_begin);
                let elapsed = Math.round((new Date() - time_begin) / 1000);
                let remaining_time = Math.round(elapsed / (cur_page - from_page + 1) * (to_page - cur_page));
                let hours = Math.floor(remaining_time / 3600);
                remaining_time -= hours * 3600;
                let minutes = Math.floor(remaining_time / 60);
                let seconds = remaining_time % 60;

                ui_timer.innerText = hours !== Infinity ? `${hours}h ${minutes}m ${seconds}s` : "Nicht berechenbar";
                progress.style.width = (100 * (cur_page - from_page + 1) / (to_page - from_page)) + "%";
            });
        }, 250);

        btn.onclick = () => {
            chrome.runtime.sendMessage({ type: "cancel_convert", tabid: msg.converting_tab }, () => {});
            clearInterval(intervalId);
            window.close();
        };

    } else {
        document.getElementById("cur-book-text").style.display = null;
        document.getElementById("converting-text").style.display = "none";
        progress_bar.style.display = "none";
        btn.innerText = "Konvertieren";
    }
});

// Popup initialisieren
initPopup();