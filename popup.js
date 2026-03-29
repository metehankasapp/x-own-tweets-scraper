const app = document.getElementById("app");

function normalizeHandle(handle) {
  return String(handle ?? "").trim().replace(/^@/, "").toLowerCase();
}

function csvEscape(value) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function toCsvRows(tweets) {
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

function buildCsv(rows) {
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

function downloadTweets(filename, tweets) {
  const csv = buildCsv(toCsvRows(tweets));
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
  const isOnX = /^https:\/\/([^.]+\.)?x\.com\//i.test(tab?.url ?? "");
  return { isOnX };
}

async function getPopupState() {
  const [{ tweets, xAccountInfo }, tabState] = await Promise.all([
    chrome.storage.local.get(["tweets", "xAccountInfo"]),
    getActiveTabState(),
  ]);

  const allTweets = Array.isArray(tweets) ? tweets : [];
  const accountHandle = normalizeHandle(xAccountInfo?.handle);
  const ownTweets = accountHandle
    ? allTweets.filter((tweet) => normalizeHandle(tweet.handle) === accountHandle)
    : allTweets;

  return {
    isOnX: tabState.isOnX,
    accountHandle,
    ownTweets,
    totalCount: ownTweets.length,
  };
}

function getStatusText(state) {
  if (!state.isOnX) {
    return {
      title: "Open X first",
      copy: "The scraper only runs on x.com pages.",
    };
  }

  if (!state.accountHandle) {
    return {
      title: "Account not detected yet",
      copy: "Open your profile and give the page a second to detect your handle.",
    };
  }

  return {
    title: "Ready to export",
    copy: "Scroll through your profile to collect more posts into local storage.",
  };
}

function render(state) {
  const status = getStatusText(state);
  const accountLabel = state.accountHandle ? `@${state.accountHandle}` : "Waiting for account";

  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <h1>Own Tweets CSV</h1>
        <p>Export your posts from X as a local CSV file.</p>
      </header>

      <section class="panel">
        <div class="row">
          <span class="label">Status</span>
          <span class="badge">Local only</span>
        </div>
        <div class="value">${status.title}</div>
        <p class="help">${status.copy}</p>
      </section>

      <section class="panel">
        <div class="item">
          <span class="label">Account</span>
          <span class="text">${accountLabel}</span>
        </div>
        <div class="item">
          <span class="label">Posts</span>
          <span class="count">${state.totalCount}</span>
        </div>
      </section>

      <section class="panel">
        <span class="label">How it works</span>
        <p class="help">Open your X profile, scroll to load tweets, then export the collected data.</p>
      </section>

      <section class="actions">
        <button id="export-button" ${state.totalCount ? "" : "disabled"}>Export My Tweets</button>
        <button id="clear-button" class="secondary" ${state.totalCount ? "" : "disabled"}>Clear Local Data</button>
      </section>
    </main>
  `;

  document.getElementById("export-button")?.addEventListener("click", () => {
    const filename = state.accountHandle ? `x-${state.accountHandle}-tweets.csv` : "x-tweets.csv";
    downloadTweets(filename, state.ownTweets);
  });

  document.getElementById("clear-button")?.addEventListener("click", async () => {
    await chrome.storage.local.set({ tweets: [] });
    render(await getPopupState());
  });
}

function renderError(message) {
  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <h1>Own Tweets CSV</h1>
        <p>Popup failed to load.</p>
      </header>
      <section class="panel">
        <span class="label">Error</span>
        <div class="value">${message}</div>
      </section>
    </main>
  `;
}

getPopupState().then(render).catch((error) => {
  console.error("Popup failed to initialize", error);
  renderError(error instanceof Error ? error.message : "Unknown error");
});
