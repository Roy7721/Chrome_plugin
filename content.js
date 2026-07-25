// content.js — runs INSIDE the YouTube page.
// Its only job: read comments off the page when asked. Nothing else.

const COMMENT_SELECTOR = "#content-text";

// Read whatever comments are in the page RIGHT NOW.
function collectComments() {
  const nodes = document.querySelectorAll(COMMENT_SELECTOR);
  return Array.from(nodes)
    .map(el => el.innerText.trim())
    .filter(text => text.length > 0);
}

// A pause you can 'await'. Plain setTimeout can't be awaited; this can.
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Scroll down repeatedly until we have enough comments, or until
// scrolling stops producing new ones (we've hit the bottom).
async function loadComments(target = 100, maxScrolls = 15) {
  let lastCount = -1;
  let stuckRounds = 0;

  for (let i = 0; i < maxScrolls; i++) {
    const comments = collectComments();

    // Enough collected — stop early.
    if (comments.length >= target) {
      return comments.slice(0, target);
    }

    // No new comments since last round? Count how many times in a row.
    if (comments.length === lastCount) {
      stuckRounds++;
      if (stuckRounds >= 3) {
        return comments;   // three dead rounds = nothing more is coming
      }
    } else {
      stuckRounds = 0;     // we grew, so reset the pati
    }
    lastCount = comments.length;

    // Jump to the bottom of the page, which triggers Yo
    window.scrollTo(0, document.documentElement.scrollHeight);
    await wait(1000);      // give YouTube a second to f
  }

  return collectComments().slice(0, target);
}

// Sit and wait to be asked. This is what replaces the s
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "SCRAPE_COMMENTS") {
    return;                      // not for us, ignore it
  }

  const originalScrollY = window.scrollY;   // remember

  loadComments(message.limit)
    .then(comments => {
      window.scrollTo(0, originalScrollY);  // put them
      sendResponse({ ok: true, comments: comments });
    })
    .catch(error => {
      sendResponse({ ok: false, error: String(error) });
    });

  return true;   // ⚠️ critical — explained below
});
