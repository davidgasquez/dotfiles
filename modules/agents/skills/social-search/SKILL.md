---
name: social-search
description: Search X/Twitter, Hacker News, and Bluesky and return structured results.
disable-model-invocation: true
---

Search X, Hacker News, and Bluesky unless the user limits the scope. Run the searches in parallel and combine the most relevant results with source links.

Iterate and tweak the searches until you've covered the desired search.

## X

Use the current Brave profile's X session:

```bash
QUERY='your search query'
TWITTER_BROWSER=brave TWITTER_CHROME_PROFILE=Default \
  uvx --from 'git+https://github.com/public-clis/twitter-cli.git' \
  twitter search "$QUERY" --max 20 --json
```

Do not add filters unless the user requests them. Common query operators:

- Exact phrase: `"data platform"`
- Either term: `AI OR agents`
- Exclude term: `AI -crypto`
- Account: `from:handle`, `to:handle`
- Followed accounts: `filter:follows`
- Content: `filter:links`, `filter:media`, `filter:images`, `filter:videos`
- Exclude: `-filter:replies`, `-filter:retweets`
- Language/date: `lang:en`, `since:YYYY-MM-DD`, `until:YYYY-MM-DD`
- Engagement: `min_faves:10`, `min_retweets:5`

Use `--type Latest` for chronological results; the default is Top. Other types: `Photos`, `Videos`.

Read posts from `.data`. Build URLs as `https://x.com/<author.screenName>/status/<id>`. Retry once on `api_error` or HTTP 0.

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
