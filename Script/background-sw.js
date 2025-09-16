let converting = false;
let converting_tab = -1;
let convert_progress = {
  title: "",
  from_page: -1,
  cur_page: -1,
  to_page: -1,
  page_count: -1,
  time_begin: 0
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "start_converting":
      converting = true;
      convert_progress = message.convert_progress;
      break;
    case "update_tabid":
      converting_tab = message.tabid;
      break;
    case "is_converting":
      sendResponse({ converting, converting_tab });
      break;
    case "get_progress":
      sendResponse({ convert_progress });
      break;
    case "stop_converting":
      converting = false;
      converting_tab = -1;
      break;
    case "update_progress":
      convert_progress = message.convert_progress;
      if (convert_progress.cur_page === convert_progress.to_page) {
        converting = false;
        converting_tab = -1;
      }
      break;
    case "cancel_convert":
      converting = false;
      converting_tab = -1;
      break;
  }
  return true; // async response ok
});
