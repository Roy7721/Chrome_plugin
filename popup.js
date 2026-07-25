// popup.js — the popup's behavior. Runs when the popup opens.
// Kept deliberately dumb: it collects a click, asks background to do the work,
// and draws the result. No scraping, no fetch here.

const analyzeBtn = document.getElementById("analyzeBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

// Run this function whenever the button is clicked.
analyzeBtn.addEventListener("click", () => {
  // 1. Find the tab the user is looking at. Here 'currentWindow' really is
  //    the browser window, because the popup belongs to it.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    // Guard: only works on a YouTube video page.
    if (!tab || !tab.url || !tab.url.includes("youtube.com/watch")) {
      statusEl.textContent = "Open a YouTube video first.";
      return;
    }

    // 2. Show a working state and stop double-clicks.
    analyzeBtn.disabled = true;
    statusEl.textContent = "Analyzing… (scrolling to load comments)";

    // 3. Hand the job to background — the same ANALYZE call you tested by hand.
    chrome.runtime.sendMessage(
      { type: "ANALYZE", tabId: tab.id, limit: 100 },
      (response) => {
        analyzeBtn.disabled = false;

        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error: " + chrome.runtime.lastError.message;
          return;
        }
        if (!response || !response.ok) {
          statusEl.textContent = "Error: " + (response ? response.error : "no reply");
          return;
        }

        // 4. Success — draw the bars.
        render(response.summary);
      }
    );
  });
});

// Turn a summary object into the on-screen bars.
function render(summary) {
  const { total, counts } = summary;

  statusEl.textContent = `Analyzed ${total} comments.`;
  resultsEl.style.display = "block";   // reveal the hidden block

  setBar("pos", counts.positive, total);
  setBar("neu", counts.neutral, total);
  setBar("neg", counts.negative, total);
}

// Size one bar and set its number.
function setBar(key, count, total) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  document.getElementById(key + "Bar").style.width = percent + "%";
  document.getElementById(key + "Count").textContent = count;
}