
// background.js — the service worker. No page, no UI.
// Full network access, so THIS is the file that talks to Flask.
// Job: popup asks -> we get comments from the tab -> we POST to Flask -> we reply.

const FLASK_URL = "https://yt-sentiment-api.ashysmoke-d4f578eb.koreacentral.azurecontainerapps.io/predict";

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
  let res;
  try {
    res = await fetch(FLASK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: comments }),
    });
  } catch (e) {
    throw new Error("Couldn't reach the API — it may be waking up. Try again in a few seconds.");
  }

  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  return res.json();
}

// Turn the raw predictions into counts the popup can draw.
function summarize(predictions) {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  const samples = { positive: [], neutral: [], negative: [] };
  const MAX_SAMPLES = 3;

  for (const item of predictions) {
    // Map the numeric label to a name we can use as a key.
    let key;
    if (item.sentiment === 1) key = "positive";
    else if (item.sentiment === 0) key = "neutral";
    else if (item.sentiment === -1) key = "negative";
    else continue;   // unknown label — skip it

    counts[key]++;                          // tally

    if (samples[key].length < MAX_SAMPLES) {
      samples[key].push(item.comment);      // keep up to 3 real comments
    }
  }

  return { total: predictions.length, counts: counts, samples: samples };
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