(function () {
  const seenTweetIds = new Set();
  let currentAccountHandle = "";
  let observerStarted = false;

  function normalizeHandle(handle) {
    return String(handle ?? "").trim().replace(/^@/, "").toLowerCase();
  }

  function queryText(root, selector) {
    return root.querySelector(selector)?.innerText?.trim() ?? "";
  }

  function extractTweetId(article) {
    const statusLink = Array.from(article.querySelectorAll('a[href*="/status/"]')).find((link) =>
      /\/status\/\d+/.test(link.getAttribute("href") || ""),
    );
    const href = statusLink?.getAttribute("href") || "";
    return href.match(/\/status\/(\d+)/)?.[1] ?? "";
  }

  function extractTweetHandle(article) {
    const profileLink = Array.from(article.querySelectorAll('a[href^="/"]')).find((link) => {
      const href = link.getAttribute("href") || "";
      return /^\/[^/]+$/.test(href);
    });
    return (profileLink?.getAttribute("href") || "").replace("/", "");
  }

  function extractMetric(article, testId, fallbackTestId) {
    const primary = article.querySelector(`button[data-testid="${testId}"]`)?.getAttribute("aria-label") || "";
    const fallback = fallbackTestId
      ? article.querySelector(`button[data-testid="${fallbackTestId}"]`)?.getAttribute("aria-label") || ""
      : "";
    const label = primary || fallback;
    return label.match(/([\d,.]+)/)?.[1]?.replace(/,/g, "") || "0";
  }

  function extractViews(article) {
    const link = Array.from(article.querySelectorAll("a[aria-label]")).find((node) =>
      (node.getAttribute("aria-label") || "").includes("views"),
    );
    return link?.getAttribute("aria-label")?.match(/([\d,.]+)\s+views/i)?.[1]?.replace(/,/g, "") || "0";
  }

  function extractMediaUrls(article) {
    const imageUrls = Array.from(article.querySelectorAll("img[src]"))
      .map((node) => node.getAttribute("src") || "")
      .filter((src) => src.startsWith("https://pbs.twimg.com/media/") || src.includes("/media/"));

    const videoUrls = Array.from(article.querySelectorAll("video"))
      .map((node) => node.getAttribute("poster") || "")
      .filter(Boolean);

    return {
      imageMediaUrls: [...new Set(imageUrls)],
      videoMediaUrls: [...new Set(videoUrls)],
    };
  }

  function extractTweet(article) {
    const tweetId = extractTweetId(article);
    const handle = extractTweetHandle(article);
    if (!tweetId || !handle) {
      return null;
    }

    const { imageMediaUrls, videoMediaUrls } = extractMediaUrls(article);
    const mediaType = [];
    if (imageMediaUrls.length) {
      mediaType.push("Image");
    }
    if (videoMediaUrls.length) {
      mediaType.push("Video");
    }

    return {
      tweetId,
      handle,
      content: queryText(article, 'div[data-testid="tweetText"]'),
      tweetCreatedAt: article.querySelector("time")?.getAttribute("datetime") || "",
      likes: extractMetric(article, "like", "unlike"),
      retweets: extractMetric(article, "retweet", "unretweet"),
      replies: extractMetric(article, "reply"),
      bookmarks: extractMetric(article, "bookmark", "removeBookmark"),
      views: extractViews(article),
      mediaType,
      imageMediaUrls,
      videoMediaUrls,
      scrapedFromUrl: window.location.href,
      profileUrl: `https://x.com/${handle.replace(/^@/, "")}`,
      language: article.querySelector('div[data-testid="tweetText"]')?.getAttribute("lang") || "",
      tweetType: ["Tweet"],
      conversationId: tweetId,
      inReplyToTweetId: null,
      inReplyToUserHandle: null,
      retweetOriginalAuthor: null,
      isAd: article.innerText.includes("\nAd\n") || article.innerText === "Ad",
      hasShowMore: Boolean(article.querySelector('button[data-testid="tweet-text-show-more-link"]')),
      quotedTweet: null,
    };
  }

  function findCurrentAccountHandle() {
    const accountMenu = document.querySelector('[aria-label="Account menu"]');
    if (!accountMenu) {
      return "";
    }

    const textNode = Array.from(accountMenu.querySelectorAll("span")).find((node) =>
      normalizeHandle(node.textContent).startsWith("@"),
    );

    return normalizeHandle(textNode?.textContent);
  }

  async function notifyAccountHandle() {
    const handle = findCurrentAccountHandle();
    if (!handle || handle === currentAccountHandle) {
      return;
    }

    currentAccountHandle = handle;
    try {
      await chrome.runtime.sendMessage({
        type: "ACCOUNT_DETECTED",
        account: { handle: `@${handle}` },
      });
    } catch (error) {
      console.error("Failed to send detected account", error);
    }
  }

  async function captureArticle(article) {
    const tweet = extractTweet(article);
    if (!tweet || seenTweetIds.has(tweet.tweetId)) {
      return;
    }

    seenTweetIds.add(tweet.tweetId);
    try {
      await chrome.runtime.sendMessage({ type: "TWEET_CAPTURED", tweet });
    } catch (error) {
      console.error("Failed to send captured tweet", error);
    }
  }

  function scan(root = document) {
    notifyAccountHandle();
    const articles = root.querySelectorAll?.('article[role="article"]') || [];
    articles.forEach((article) => {
      captureArticle(article);
    });
  }

  function startObserver() {
    if (observerStarted) {
      return;
    }

    observerStarted = true;
    scan(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          if (node.matches?.('article[role="article"]')) {
            captureArticle(node);
            continue;
          }

          scan(node);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.body) {
    startObserver();
  } else {
    window.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }
})();
