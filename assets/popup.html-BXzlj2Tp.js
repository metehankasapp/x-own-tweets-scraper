const app = document.getElementById("app");

function normalizeHandle(handle) {
  return String(handle ?? "").trim().replace(/^@/, "").toLowerCase();
}

function csvEscape(value) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function makeTweetRows(tweets) {
  return tweets.map((tweet) => ({
    tweetId: tweet.tweetId ?? "",
    handle: tweet.handle ?? "",
    content: tweet.content ?? "",
    tweetCreatedAt: tweet.tweetCreatedAt ?? "",
    likes: tweet.likes ?? "",
    retweets: tweet.retweets ?? "",
    replies: tweet.replies ?? "",
    views: tweet.views ?? "",
    bookmarks: tweet.bookmarks ?? "",
    mediaType: Array.isArray(tweet.mediaType) ? tweet.mediaType.join("|") : "",
    imageMediaUrls: Array.isArray(tweet.imageMediaUrls) ? tweet.imageMediaUrls.join("|") : "",
    videoMediaUrls: Array.isArray(tweet.videoMediaUrls) ? tweet.videoMediaUrls.join("|") : "",
    scrapedFromUrl: tweet.scrapedFromUrl ?? "",
    profileUrl: tweet.profileUrl ?? "",
    language: tweet.language ?? "",
    tweetType: Array.isArray(tweet.tweetType) ? tweet.tweetType.join("|") : "",
    conversationId: tweet.conversationId ?? "",
    inReplyToTweetId: tweet.inReplyToTweetId ?? "",
    inReplyToUserHandle: tweet.inReplyToUserHandle ?? "",
    retweetOriginalAuthor: tweet.retweetOriginalAuthor ?? "",
    isAd: tweet.isAd ? "true" : "false",
    hasShowMore: tweet.hasShowMore ? "true" : "false",
    quotedTweet: tweet.quotedTweet ? JSON.stringify(tweet.quotedTweet) : "",
  }));
}

function rowsToCsv(rows) {
  const headers = Object.keys(rows[0] ?? {
    tweetId: "",
    handle: "",
    content: "",
    tweetCreatedAt: "",
    likes: "",
    retweets: "",
    replies: "",
    views: "",
    bookmarks: "",
    mediaType: "",
    imageMediaUrls: "",
    videoMediaUrls: "",
    scrapedFromUrl: "",
    profileUrl: "",
    language: "",
    tweetType: "",
    conversationId: "",
    inReplyToTweetId: "",
    inReplyToUserHandle: "",
    retweetOriginalAuthor: "",
    isAd: "",
    hasShowMore: "",
    quotedTweet: "",
  });

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(filename, tweets) {
  const csv = rowsToCsv(makeTweetRows(tweets));
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function getActiveTabState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  const isOnX = /^https:\/\/([^.]+\.)?x\.com\//i.test(url);
  let isReady = false;

  if (isOnX && tab?.id != null) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "CHECK_CONTENT_READY" });
      isReady = response?.isObserving === true;
    } catch (_error) {
      isReady = false;
    }
  }

  return { isOnX, isReady };
}

async function getPopupData() {
  const [{ tweets, xAccountInfo }, tabState] = await Promise.all([
    chrome.storage.local.get(["tweets", "xAccountInfo"]),
    getActiveTabState(),
  ]);

  const allTweets = Array.isArray(tweets) ? tweets : [];
  const currentHandle = normalizeHandle(xAccountInfo?.handle);
  const ownTweets = currentHandle
    ? allTweets.filter((tweet) => normalizeHandle(tweet.handle) === currentHandle)
    : [];

  return {
    allTweets,
    ownTweets,
    currentHandle,
    ...tabState,
  };
}

function statusCopy(data) {
  if (!data.isOnX) {
    return {
      title: "Open X to start",
      detail: "This extension only works on x.com pages.",
      tone: "idle",
    };
  }

  if (!data.isReady) {
    return {
      title: "Refresh the tab",
      detail: "Reload the current X page if the content script is not active yet.",
      tone: "warn",
    };
  }

  return {
    title: "Ready to capture",
    detail: "Scroll your profile or open tweet pages to collect posts into local storage.",
    tone: "ok",
  };
}

function render(data) {
  const status = statusCopy(data);
  const accountLabel = data.currentHandle ? `@${data.currentHandle}` : "No account detected";

  app.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="hero-top">
          <div class="badge">LOCAL ONLY</div>
          <div class="brand-mark" aria-hidden="true">X</div>
        </div>
        <h1>Own Tweets Scraper</h1>
        <p>Collect your X posts locally and export them as CSV.</p>
      </section>

      <section class="panel status-panel ${status.tone}">
        <div class="eyebrow">Status</div>
        <div class="status-title">${status.title}</div>
        <div class="status-detail">${status.detail}</div>
      </section>

      <section class="stats">
        <div class="stat-card">
          <div class="eyebrow">Detected account</div>
          <div class="stat-text">${accountLabel}</div>
        </div>
        <div class="stat-card accent">
          <div class="eyebrow">Stored posts</div>
          <div class="stat-number">${data.ownTweets.length}</div>
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">How to use</div>
        <div class="steps">
          <span>1. Open your X profile</span>
          <span>2. Scroll to load more posts</span>
          <span>3. Export the collected CSV</span>
        </div>
      </section>

      <section class="actions">
        <button id="export-own" ${data.ownTweets.length ? "" : "disabled"}>Export My Tweets</button>
        <button id="clear-all" ${data.allTweets.length ? "" : "disabled"} class="secondary">Clear Local Data</button>
      </section>
    </div>
  `;

  document.getElementById("export-own")?.addEventListener("click", () => {
    const suffix = data.currentHandle || "my";
    downloadCsv(`x-${suffix}-tweets.csv`, data.ownTweets);
  });

  document.getElementById("clear-all")?.addEventListener("click", async () => {
    await chrome.storage.local.set({ tweets: [] });
    render(await getPopupData());
  });
}

function renderError(message) {
  app.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="hero-top">
          <div class="badge">LOCAL ONLY</div>
          <div class="brand-mark" aria-hidden="true">X</div>
        </div>
        <h1>Own Tweets Scraper</h1>
        <p>Popup failed to load.</p>
      </section>
      <section class="panel status-panel warn">
        <div class="eyebrow">Error</div>
        <div class="status-title">${message}</div>
      </section>
    </div>
  `;
}

const style = document.createElement("style");
style.textContent = `
  :root {
    --bg: #f5efe4;
    --ink: #171411;
    --muted: #665e55;
    --line: rgba(23, 20, 17, 0.14);
    --panel: rgba(255, 251, 245, 0.84);
    --accent: #d95f31;
    --accent-dark: #9f3211;
    --accent-soft: #f4d7c2;
    --ok: #1f8f61;
    --warn: #b36a10;
    --shadow: 0 16px 40px rgba(90, 57, 27, 0.12);
  }

  * {
    box-sizing: border-box;
  }

  body {
    width: 360px;
    min-height: 440px;
    margin: 0;
    overflow: auto;
    background:
      radial-gradient(circle at top left, rgba(217, 95, 49, 0.18), transparent 34%),
      radial-gradient(circle at bottom right, rgba(20, 106, 122, 0.14), transparent 32%),
      var(--bg);
    color: var(--ink);
    font-family: "Avenir Next", "Segoe UI", sans-serif;
  }

  .shell {
    padding: 16px;
    display: grid;
    gap: 12px;
  }

  .hero,
  .panel,
  .stat-card {
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: var(--shadow);
  }

  .hero {
    padding: 16px;
    background:
      linear-gradient(145deg, rgba(255, 247, 240, 0.95), rgba(255, 252, 247, 0.88)),
      var(--panel);
  }

  .hero h1 {
    margin: 10px 0 6px;
    font-size: 28px;
    line-height: 0.95;
    letter-spacing: -0.04em;
    font-family: Georgia, "Times New Roman", serif;
  }

  .hero p {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--muted);
  }

  .hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 9px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid var(--line);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  .brand-mark {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: #fff7f0;
    font-size: 18px;
    font-weight: 900;
  }

  .panel {
    padding: 14px;
    background: rgba(255, 252, 247, 0.78);
  }

  .status-panel.ok {
    border-color: rgba(31, 143, 97, 0.26);
  }

  .status-panel.warn {
    border-color: rgba(179, 106, 16, 0.28);
  }

  .status-panel.idle {
    border-color: var(--line);
  }

  .eyebrow {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .status-title,
  .stat-text,
  .stat-number {
    margin-top: 8px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .status-title {
    font-size: 18px;
  }

  .status-detail {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted);
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 120px;
    gap: 12px;
  }

  .stat-card {
    padding: 14px;
    background: rgba(255, 252, 247, 0.88);
  }

  .stat-card.accent {
    background: linear-gradient(180deg, #fff2e7, #ffe3cf);
  }

  .stat-text {
    font-size: 16px;
    word-break: break-word;
  }

  .stat-number {
    font-size: 34px;
    line-height: 1;
  }

  .steps {
    margin-top: 8px;
    display: grid;
    gap: 8px;
  }

  .steps span {
    padding: 9px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    color: var(--ink);
  }

  .actions {
    display: grid;
    gap: 10px;
  }

  button {
    appearance: none;
    border: 1px solid rgba(15, 14, 12, 0.1);
    border-radius: 14px;
    padding: 13px 14px;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: #fffaf5;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: transform 120ms ease, opacity 120ms ease, box-shadow 120ms ease;
    box-shadow: 0 10px 24px rgba(159, 50, 17, 0.18);
  }

  button.secondary {
    background: rgba(255, 252, 247, 0.84);
    color: var(--ink);
    box-shadow: none;
  }

  button:not(:disabled):hover {
    transform: translateY(-1px);
  }

  button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
    box-shadow: none;
  }
`;
document.head.appendChild(style);

getPopupData().then(render).catch((error) => {
  console.error("Popup init failed", error);
  renderError(error instanceof Error ? error.message : "Unknown error");
});
