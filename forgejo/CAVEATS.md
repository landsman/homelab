# Forgejo caveats

What the Forgejo application itself cannot do, on this instance (16.0.5), and what to do
instead. The registry, package and Actions limits are the runner's:
[forgejo-runner/CAVEATS.md](../forgejo-runner/CAVEATS.md).

## A review conversation cannot be resolved, or replied to, over the API

The API has no endpoint to resolve or unresolve a pull request review conversation, and none
to reply inside one (checked against the instance's `/swagger.v1.json`, 2026-10-06). So a bot,
a CI job or an agent driving a pull request through the API or an MCP server can address every
point of a review and still leave every thread open.

- Resolving is a web route only, `POST /{owner}/{repo}/issues/resolve_conversation`. It needs a
  browser session and a CSRF token; an API token does not get through.
- The nearest thing to a reply, `POST /repos/{owner}/{repo}/pulls/{index}/reviews/{id}/comments`,
  places a comment by path and line. On a stale review (the branch was rebased since), the line
  no longer matches and the comment lands on the current code instead of in the thread.
- An MCP server cannot add it: it only calls what the API has.

**Instead:** post one comment on the pull request that maps each review point to its fix, and
resolve the threads in the browser.

Upstream: [forgejo/forgejo#14734](https://codeberg.org/forgejo/forgejo/issues/14734).

## An email invite is a dead end while registration is disabled

This instance has `DISABLE_REGISTRATION = true`, but a team page still offers to invite an email
address. Forgejo sends the mail; the link asks the person to sign in, and they have no account
and cannot create one. "Forgot password" for that address sends nothing, so it is no way in
either. Nothing tells the inviting owner.

**Instead:** create the account as admin (Site Administration → User Accounts, or
`forgejo admin user create`) with a random password nobody keeps. The person sets their own
through "Forgot password", which works once the account exists. Add them to the team by
username.

Upstream: [forgejo/forgejo#14726](https://codeberg.org/forgejo/forgejo/issues/14726); the same
request in Gitea since 2022,
[go-gitea/gitea#21419](https://github.com/go-gitea/gitea/issues/21419).

## An open issue or pull request page does not update itself

New comments, a comment edited in place, reactions and the checks/merge box all stay as they
were when the page loaded; only a reload shows them. A bot that posts "working…" and later
edits it into a result looks stuck until then. Nothing is blocking a live channel: the instance
has none for page content. Its only push channel, `/user/events` (EventSource, not a
websocket), drives the notification bell and the stopwatch, and upstream reports even that
broken from 15.0 up to 17.0
([forgejo/forgejo#13511](https://codeberg.org/forgejo/forgejo/pulls/13511)). It does get through
Cloudflare: `curl -I https://git.insuit.cz/user/events` answers `200 text/event-stream`
(2026-10-08).

**Instead:** reload. Let a bot mention whoever asked when it first posts, so the notification
arrives without one; whether an edit notifies again has not been checked.

Upstream, for the checks box: [forgejo/forgejo#12906](https://codeberg.org/forgejo/forgejo/issues/12906).
No issue was found for comments (Codeberg API search, 2026-10-08).
