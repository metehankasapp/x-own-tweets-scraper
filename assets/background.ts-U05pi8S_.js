const TWEETS_KEY = "tweets";
const X_INFO_KEY = "xAccountInfo";

async function getStoredTweets() {
  const stored = await chrome.storage.local.get(TWEETS_KEY);
  return Array.isArray(stored[TWEETS_KEY]) ? stored[TWEETS_KEY] : [];
}

async function saveStoredTweets(tweets) {
  await chrome.storage.local.set({ [TWEETS_KEY]: tweets });
}

function upsertTweet(existingTweets, incomingTweet) {
  if (!incomingTweet?.tweetId) {
    return existingTweets;
  }

  const nextTweets = [...existingTweets];
  const existingIndex = nextTweets.findIndex((tweet) => tweet.tweetId === incomingTweet.tweetId);

  if (existingIndex >= 0) {
    nextTweets[existingIndex] = incomingTweet;
  } else {
    nextTweets.push(incomingTweet);
  }

  return nextTweets;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TWEET_EXTRACTED") {
    (async () => {
      try {
        const tweets = await getStoredTweets();
        const nextTweets = upsertTweet(tweets, message.tweet);
        await saveStoredTweets(nextTweets);
        sendResponse({ success: true, count: nextTweets.length });
      } catch (error) {
        console.error("Failed to store tweet", error);
        sendResponse({ success: false });
      }
    })();

    return true;
  }

  if (message?.type === "X_INFO_EXTRACTED") {
    chrome.storage.local
      .set({ [X_INFO_KEY]: message.xAccountInfo ?? {} })
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Failed to store X account info", error);
        sendResponse({ success: false });
      });

    return true;
  }

  if (message?.type === "NEWS_EXTRACTED" || message?.type === "TRENDS_EXTRACTED") {
    sendResponse({ success: true, ignored: true });
    return false;
  }

  return false;
});
