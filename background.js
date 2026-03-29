const STORAGE_KEYS = {
  tweets: "tweets",
  account: "xAccountInfo",
};

function normalizeHandle(handle) {
  return String(handle ?? "").trim().replace(/^@/, "").toLowerCase();
}

async function readStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function writeStorage(payload) {
  await chrome.storage.local.set(payload);
}

async function storeDetectedAccount(accountInfo) {
  const nextHandle = normalizeHandle(accountInfo?.handle);
  if (!nextHandle) {
    return;
  }

  await writeStorage({
    [STORAGE_KEYS.account]: {
      handle: `@${nextHandle}`,
      detectedAt: new Date().toISOString(),
    },
  });
}

function mergeTweet(existingTweets, incomingTweet) {
  const tweetId = incomingTweet?.tweetId;
  if (!tweetId) {
    return existingTweets;
  }

  const nextTweets = [...existingTweets];
  const existingIndex = nextTweets.findIndex((tweet) => tweet.tweetId === tweetId);

  if (existingIndex === -1) {
    nextTweets.push(incomingTweet);
  } else {
    nextTweets[existingIndex] = incomingTweet;
  }

  return nextTweets;
}

async function storeCapturedTweet(incomingTweet) {
  const [{ tweets = [], xAccountInfo }] = await Promise.all([
    readStorage([STORAGE_KEYS.tweets, STORAGE_KEYS.account]),
  ]);

  const accountHandle = normalizeHandle(xAccountInfo?.handle);
  const tweetHandle = normalizeHandle(incomingTweet?.handle);

  if (accountHandle && tweetHandle && accountHandle !== tweetHandle) {
    return tweets.length;
  }

  const nextTweets = mergeTweet(Array.isArray(tweets) ? tweets : [], incomingTweet);
  await writeStorage({ [STORAGE_KEYS.tweets]: nextTweets });
  return nextTweets.length;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ACCOUNT_DETECTED") {
    storeDetectedAccount(message.account)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("Failed to store detected account", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message?.type === "TWEET_CAPTURED") {
    storeCapturedTweet(message.tweet)
      .then((count) => sendResponse({ ok: true, count }))
      .catch((error) => {
        console.error("Failed to store captured tweet", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  return false;
});
