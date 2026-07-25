// popup.js — the popup's behavior.
// Collects a click, asks background to do the work, draws the result.

const analyzeBtn = document.getElementById("analyzeBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

analyzeBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    if (!tab || !tab.url || !tab.url.includes("youtube.com/watch")) {
      statusEl.textContent = "Open a YouTube video first.";
      return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing…";
    statusEl.textContent = "Scrolling to load comments. Meanwhile How was youe day dude?";

    chrome.runtime.sendMessage(
      { type: "ANALYZE", tabId: tab.id, limit: 100 },
      (response) => {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "Analyze again";

        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error: " + chrome.runtime.lastError.message;
          return;
        }
        if (!response || !response.ok) {
          statusEl.textContent = "Error: " + (response ? response.error : "no reply");
          return;
        }

        render(response.summary);
      }
    );
  });
});

// ---- rendering ----

function render(summary) {
  const { total, counts, samples } = summary;

  statusEl.textContent = "";              // clear the "scrolling…" line
  resultsEl.style.display = "block";      // reveal the results block

  // headline
  const verdict = pickVerdict(counts);
  document.getElementById("verdict").textContent = verdict.emoji + " " + verdict.text;
  document.getElementById("subhead").textContent =
    `Analyzed ${total} comment${total === 1 ? "" : "s"}`;

  // bars
  setBar("pos", counts.positive, total);
  setBar("neu", counts.neutral, total);
  setBar("neg", counts.negative, total);

  // sample comments
  renderSamples(samples);
}

// Pick the headline based on which category has the most.
function pickVerdict(counts) {
  const max = Math.max(counts.positive, counts.neutral, counts.negative);
  if (max === 0) return { emoji: "🤔", text: "No comments found" };
  if (max === counts.positive) return { emoji: "😊", text: "Mostly positive" };
  if (max === counts.negative) return { emoji: "😠", text: "Mostly negative" };
  return { emoji: "😐", text: "Mostly neutral" };
}

// Size one bar, set its percent and count.
function setBar(key, count, total) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  document.getElementById(key + "Bar").style.width = percent + "%";
  document.getElementById(key + "Percent").textContent = percent + "%";
  document.getElementById(key + "Count").textContent = count;
}

// Build the sample-comment boxes from scratch.
function renderSamples(samples) {
  const container = document.getElementById("samples");
  container.innerHTML = "";   // wipe any previous run's boxes

  const groups = [
    { key: "positive", heading: "😊 Positive examples" },
    { key: "negative", heading: "😠 Negative examples" },
    { key: "neutral",  heading: "😐 Neutral examples" },
  ];

  for (const group of groups) {
    const comments = samples[group.key];
    if (comments.length === 0) continue;   // skip empty categories

    const groupDiv = document.createElement("div");
    groupDiv.className = "sample-group";

    const heading = document.createElement("div");
    heading.className = "sample-heading";
    heading.textContent = group.heading;
    groupDiv.appendChild(heading);

    for (const comment of comments) {
      const item = document.createElement("div");
      item.className = "sample-item";
      item.textContent = comment;
      groupDiv.appendChild(item);
    }

    container.appendChild(groupDiv);
  }
}