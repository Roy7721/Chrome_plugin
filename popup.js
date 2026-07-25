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
    statusEl.textContent = "Scrolling to load comments…";

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

  statusEl.textContent = "";
  resultsEl.style.display = "block";

  // headline — pickVerdict now returns a plain string
  document.getElementById("verdict").textContent = pickVerdict(counts);
  document.getElementById("subhead").textContent =
    `Analyzed ${total} comment${total === 1 ? "" : "s"}`;

  // bars
  setBar("pos", counts.positive, total);
  setBar("neu", counts.neutral, total);
  setBar("neg", counts.negative, total);

  // sample cards — pass counts so the badge shows the real total
  renderSamples(samples, counts);
}

// Pick the headline based on which category has the most. No emoji.
function pickVerdict(counts) {
  const max = Math.max(counts.positive, counts.neutral, counts.negative);
  if (max === 0) return "No comments found";
  if (max === counts.positive) return "Mostly positive";
  if (max === counts.negative) return "Mostly negative";
  return "Mostly neutral";
}

// Size one bar, set its percent and count.
function setBar(key, count, total) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  document.getElementById(key + "Bar").style.width = percent + "%";
  document.getElementById(key + "Percent").textContent = percent + "%";
  document.getElementById(key + "Count").textContent = count;
}

// Build the sample cards from scratch.
function renderSamples(samples, counts) {
  const container = document.getElementById("samples");
  container.innerHTML = "";

  const groups = [
    { key: "positive", cls: "pos", label: "Positive" },
    { key: "negative", cls: "neg", label: "Negative" },
    { key: "neutral",  cls: "neu", label: "Neutral" },
  ];

  for (const group of groups) {
    const comments = samples[group.key];
    if (comments.length === 0) continue;

    const card = document.createElement("div");
    card.className = "sample-group " + group.cls;

    const header = document.createElement("div");
    header.className = "sample-header";

    const label = document.createElement("span");
    label.textContent = group.label;

    const badge = document.createElement("span");
    badge.className = "sample-badge";
    badge.textContent = counts[group.key];

    header.appendChild(label);
    header.appendChild(badge);
    card.appendChild(header);

    for (const comment of comments) {
      const item = document.createElement("div");
      item.className = "sample-item";
      item.textContent = comment;
      card.appendChild(item);
    }

    container.appendChild(card);
  }
}