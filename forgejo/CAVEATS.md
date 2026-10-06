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
