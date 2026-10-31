---
name: social-search
description: Search X/Twitter, Hacker News, and Bluesky and return structured results.
disable-model-invocation: true
---

Search X, Hacker News, and Bluesky unless the user limits the scope. Run the searches in parallel and combine the most relevant results with source links.

Refine queries when results are sparse or off-topic. Pull the thread and try alternative terms. Don't report anything if the platform didn't return a match.

## X

Use [twitter-cli](https://github.com/public-clis/twitter-cli) with the current user's Chrome X session. Chrome profiles are detected automatically; set `TWITTER_CHROME_PROFILE` only when a specific profile is needed.

Use Python 3.13 to avoid native dependency builds with Python 3.15, and the Git source for the latest X API compatibility fixes.

```bash
QUERY='your search query'
TWITTER_BROWSER=chrome \
  nix run 'nixpkgs#uv' -- tool run --python 3.13 \
  --from 'git+https://github.com/public-clis/twitter-cli.git' \
  twitter search "$QUERY" --max 20 --json
```

Do not add filters unless the user requests them. Queries support exact phrases, `OR`, exclusions (`-term`), and X operators such as `from:handle` or `filter:follows`. For language, dates, media, or engagement filters, check `twitter search --help`.

Use `--type latest` for chronological results; the default is `top`.

Check `.ok` before reading posts from `.data`. Build URLs as `https://x.com/<author.screenName>/status/<id>`. Retry once on transient API/network errors; stop on authentication or rate-limit errors. If cookies are missing or expired, ask the user to sign in to X in Chrome; never print cookie values.

## Hacker News

Search stories by relevance with the [HN Algolia API](https://hn.algolia.com/api):

```bash
QUERY='your search query'
curl -fsSLG 'https://hn.algolia.com/api/v1/search' \
  --data-urlencode "query=$QUERY" \
  --data-urlencode 'tags=story' \
  --data-urlencode 'hitsPerPage=20' |
  jq '{hits: [.hits[] | {title, url, discussion_url: ("https://news.ycombinator.com/item?id=" + .objectID), points, num_comments, author, created_at}]}'
```

Use `/search_by_date` for newest first. Other tags include `comment`, `ask_hn`, `show_hn`, and `front_page`; comments use `comment_text`, `story_title`, and `story_id`. Use `numericFilters=points>100,num_comments>20` when requested.

## Bluesky

Search posts without authentication using the [Bluesky API](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/searchPostsV2.json):

```bash
QUERY='your search query'
curl -fsSLG 'https://api.bsky.app/xrpc/app.bsky.feed.searchPostsV2' \
  --data-urlencode "query=$QUERY" \
  --data-urlencode 'limit=20' |
  jq '{cursor, posts: [.posts[] | {author: .author.handle, text: .record.text, created_at: .record.createdAt, likes: .likeCount, reposts: .repostCount, replies: .replyCount, url: ("https://bsky.app/profile/" + .author.handle + "/post/" + (.uri | split("/") | last))}]}'
```

Optional parameters: `sort=top|recent`, `authors=handle`, `mentions=handle`, `languages=en`, `since=YYYY-MM-DD`, `until=YYYY-MM-DD`, `hasMedia=true`, `excludeReplies=true`, `allTime=true`. Repeat array parameters to provide multiple values.
