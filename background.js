
// background.js — the service worker. No page, no UI.
// Full network access, so THIS is the file that talks to Flask.
// Job: popup asks -> we get comments from the tab -> we POST to Flask -> we reply.

const FLASK_URL = "http://127.0.0.1:5000/predict";

// Ask the content script (inside a specific tab) to scrape comments.
// Wrapped in a Promise so we can 'await' it like everything else.
function requestComments(tabId, limit) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "SCRAPE_COMMENTS", limit: limit },
      (response) => {
        // If content.js isn't loaded in this tab, Chrome sets this error.
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error(response ? response.error : "No response from page"));
          return;
        }
        resolve(response.comments);
      }
    );
  });
}

// Send the comments to Flask and get back the predictions.
async function predict(comments) {
  const res = await fetch(FLASK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comments: comments }),
  });

  if (!res.ok) {
    throw new Error(`Flask returned ${res.status}`);
  }

  return res.json();   // -> [{ comment, sentiment }, ...]
}

// Turn the raw predictions into counts the popup can draw.
function summarize(predictions) {
  const counts = { positive: 0, neutral: 0, negative: 0 };

  for (const item of predictions) {
    if (item.sentiment === 1) counts.positive++;
    else if (item.sentiment === 0) counts.neutral++;
    else if (item.sentiment === -1) counts.negative++;
  }

  return { total: predictions.length, counts: counts };
}

// The whole pipeline, start to finish.
async function analyze(tabId, limit) {
  const comments = await requestComments(tabId, limit);

  if (comments.length === 0) {
    throw new Error("No comments found on this page.");
  }

  const predictions = await predict(comments);
  const summary = summarize(predictions);

  // Persist the result so it survives even if the worker sleeps.
  await chrome.storage.local.set({ lastSummary: summary });

  return summary;
}

// Listen for the popup's request.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "ANALYZE") {
    return;
  }

  analyze(message.tabId, message.limit || 100)
    .then(summary => sendResponse({ ok: true, summary: summary }))
    .catch(error => sendResponse({ ok: false, error: String(error) }));

  return true;   // async reply — keep the channel open (same rule as content.js)
});