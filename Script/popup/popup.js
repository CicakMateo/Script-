document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("convert-btn");
  const progress_bar = document.getElementsByClassName("progress")[0];
  const progress = document.getElementsByClassName("determinate")[0];
  const ui_cur_page = document.getElementById("cur-page");
  const ui_num_pages = document.getElementById("num-pages");
  const ui_timer = document.getElementById("timer");

  let tabId;

  progress_bar.style.display = "none";

  const disable_popup = () => {
    document.getElementById("cur-book").innerText = "Buch nicht geöffnet";
    btn.classList.add("disabled");
  };

  // Guard: chrome.scripting verfügbar?
  if (!chrome.scripting) {
    console.error("chrome.scripting ist undefined. Chrome/Edge aktualisieren (>= 88) oder Manifest/Permissions prüfen.");
    disable_popup();
    return;
  }

  // Init
  (async () => {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
      if (!tabs || !tabs[0]) {
        console.error("Keine aktive Registerkarte gefunden");
        disable_popup();
        return;
      }
      const tab = tabs[0];
      tabId = tab.id;

      if (!/https:\/\/.*\/ebook\/.*/.test(tab.url || "")) {
        disable_popup();
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: "valid" }, (response) => {
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
  })();

  // Klick: Konvertieren / Abbrechen
  btn.onclick = async () => {
    if (!tabId) return;

    // Wenn gerade Konvertierung läuft, abbrechen:
    chrome.runtime.sendMessage({ type: "is_converting" }, (msg) => {
      if (msg && msg.converting) {
        chrome.runtime.sendMessage({ type: "cancel_convert", tabid: msg.converting_tab }, () => {});
        window.close();
      }
    });

    try {
      // CSS zuerst (optional)
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: [
          "libraries/materialize/materialize.min.css",
          "scripts/inject.css"
        ]
      });

      // Scripts injizieren (Reihenfolge wichtig)
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

      chrome.runtime.sendMessage({ type: "update_tabid", tabid: tabId }, () => {});
      window.close();
    } catch (err) {
      console.error("Fehler beim Injizieren der Scripts:", err);
    }
  };

  // UI: laufende Konvertierung anzeigen
  chrome.runtime.sendMessage({ type: "is_converting" }, (msg) => {
    if (!msg) return;

    if (msg.converting) {
      document.getElementById("cur-book-text").style.display = "none";
      document.getElementById("converting-text").style.display = null;
      document.getElementById("convert-details").style.display = null;
      progress_bar.style.display = null;
      btn.innerText = "Abbrechen";

      const intervalId = setInterval(() => {
        chrome.runtime.sendMessage({ type: "get_progress" }, (res) => {
          if (!res) return;
          let { cur_page, from_page, to_page, time_begin, title } = res.convert_progress;
          document.getElementById("cur-converting").innerText = title;

          ui_cur_page.innerText = cur_page - from_page + 1;
          ui_num_pages.innerText = to_page - from_page + 1;

          if (!(time_begin instanceof Date)) time_begin = Date.parse(time_begin);
          const elapsed = Math.round((Date.now() - time_begin) / 1000);
          const donePages = Math.max(1, cur_page - from_page + 1);
          const remaining_time = Math.round(elapsed / donePages * Math.max(0, to_page - cur_page));
          let rt = remaining_time;
          const h = Math.floor(rt / 3600); rt -= h * 3600;
          const m = Math.floor(rt / 60); const s = rt % 60;

          ui_timer.innerText = Number.isFinite(remaining_time) ? `${h}h ${m}m ${s}s` : "Nicht berechenbar";
          const denom = Math.max(1, to_page - from_page);
          progress.style.width = (100 * (cur_page - from_page + 1) / denom) + "%";
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
});
