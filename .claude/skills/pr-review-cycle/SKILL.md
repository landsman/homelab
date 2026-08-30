---
name: pr-review-cycle
description: Ship a branch end-to-end with a Claude review feedback loop. Creates a branch, commits the change, pushes, opens a PR, then iterates on review findings (fixing, rejecting, re-triggering) for up to N rounds. Use when the user says "ship this and iterate", "open a PR and cycle reviews", "do the full review dance", or invokes this skill explicitly.
disable-model-invocation: false
---

# PR Review Cycle

Drive a complete branch-to-merge-candidate cycle: branch → commit → push → PR →
iterate on review findings. One continuous loop until the review comes back
clean, the iteration cap is hit, or the user calls it done.

## Who reviews

Two paths, both Claude, both already wired up in this repo.

**Automatic** — Anthropic's managed Code Review app reviews per the repo's
Review Behavior setting. Findings land as inline comments tagged 🔴 Important /
🟡 Nit / 🟣 Pre-existing, plus a `Claude Code Review` check run that never
blocks merge. What it reports is tuned by [`REVIEW.md`](../../../REVIEW.md) at
the repo root — read that before arguing with a finding, because half of what
looks like a bad review is a rule that file already covers.

**On demand** — a PR comment containing `@claude` triggers
[`.github/workflows/claude-mentions.yml`](../../../.github/workflows/claude-mentions.yml),
which calls the shared `landsman/config/.github/workflows/claude.yml`. That
workflow is gated to comments authored by `landsman` that contain `@claude`, so
a `gh pr comment` you post with the user's token passes; a comment from anyone
else never allocates a runner.

Never post `/gemini review` — Gemini Code Assist is not used in this repo.

## Preflight

Verify the environment before any step. If a check fails, stop and tell the user.

1. **Repo + remote**: `git rev-parse --is-inside-work-tree` is `true`, and `git remote -v` includes an `origin` pointing at GitHub.
2. **gh CLI**: `gh --version` succeeds and `gh auth status` shows a logged-in account.
3. **Clean branch state**: the user is on `main` OR on a branch whose only purpose is the change about to ship. A stale branch with unrelated commits needs asking first.
4. **Pre-existing staged changes**: if `git status` shows files staged from before this session, do NOT use plain `git commit` — use `git commit --only -- <paths>` so only the work-related files land.

## Step 1 — Branch

Never commit to `main`. Name the branch `<scope>-<kebab-summary>`
(`dashboard-shift-shortcuts`, `api-fix-cache-key`).

```bash
git checkout -b <branch-name>
```

Uncommitted work already in the tree: branch first, then stage. Never
destructively reset.

## Step 2 — Code change

If the change is already in the working tree — the common case when this skill
is invoked after a coding session — skip to Step 3. Otherwise do the work, then
run the project's local checks before committing (`make typecheck`, `make
format`, `make qa`; check the Makefile for the canonical targets).

## Step 3 — Commit

Stage explicitly with `git add <paths>`, then `git commit --only -- <paths>`
(never `git commit -a`) so pre-existing index state is preserved. Use a HEREDOC
so multi-line bodies format correctly.

Message convention is `<type>: <subject>`, or `<type>(<scope>): <subject>` —
lowercase, no full stop, subject says **why** rather than what. Types:
`security`, `deps`, `devops`, `fe`, `be`, `docs`, `chore`.

No `Co-Authored-By:` trailer, no session URL, no mention of the tool that typed
it — in the commit message, the PR body, or a reply.

## Step 4 — Push

```bash
git push -u origin <branch-name>
```

## Step 5 — Open the PR

```bash
gh pr create --title "<short title>" --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] ...
EOF
)"
```

Title: imperative, under ~70 chars, same convention as the commit subject.
Summary: 1–3 bullets on the why. Capture the PR number — you need it throughout.

## Step 6 — Wait for the review

The managed app reviews on PR open and on subsequent pushes. Give it a few
minutes, then poll; if nothing has appeared after two polls, check whether a
`Claude Code Review` check run exists at all (`gh pr checks <pr>`) before
assuming the review is slow — it may simply not be enabled for the repo, in
which case trigger it explicitly per Step 9.

Use `ScheduleWakeup` to wait rather than a synchronous `sleep` loop; the harness
wakes you back. Match the delay to the review's real turnaround (a few minutes),
not to a cache window.

## Step 7 — Read and triage

Fetch review threads with their resolution state:

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 30) {
        nodes {
          id isResolved path line
          comments(first: 20) {
            nodes { id author { login } body createdAt }
          }
        }
      }
    }
  }
}' -F owner="<owner>" -F repo="<repo>" -F pr=<pr>
```

Triage every **open** thread you did not author, whatever the tag on it.

| Verdict | Action |
|---|---|
| Correct and worth fixing | Fix the code. Do not reply — push, and the re-review resolves the thread itself (Step 8). |
| Already fixed in a later commit | Leave it. The next re-review marks it outdated. |
| Wrong / not applicable | Reply saying why, then resolve the thread by hand. This is the only case where you resolve manually. |
| Partially right | Reply with the constraint, implement the part that holds, treat the rest as a rejection. |

**Replying does not notify Claude.** A reply is for the user reading the thread
later, not a way to continue a conversation with the reviewer — the only thing
that triggers another look is a push or an `@claude` comment.

```bash
gh api -X POST repos/<owner>/<repo>/pulls/<pr>/comments/<root-comment-id>/replies \
  -f body="<one or two sentences on the constraint the finding missed>"
```

Resolve a rejected thread:

```bash
gh api graphql -f query='
mutation($t: ID!) {
  resolveReviewThread(input: { threadId: $t }) { thread { id isResolved } }
}' -F t=<THREAD_ID>
```

## Step 8 — Push fixes

Each logical fix is its own commit — never amend, never squash, never
`reset --soft` and recommit. Follow-up work goes on top as a new commit; the
branch is squash-merged at the end anyway, so a long branch costs nothing.

```bash
git push
```

The push triggers a re-review, which resolves the threads it considers
addressed. You do not resolve those yourself.

## Step 9 — Next round

If the push did not produce a new review, ask for one explicitly:

```bash
gh pr comment <pr> --body "@claude review"
```

`@claude review always` subscribes the PR to a review on every push, which is
worth posting once up front on a branch you expect to iterate on. Then back to
Step 6.

## Iteration cap

Default **5 cycles**. Track it and say where you are ("Cycle 3 of 5: one new
finding, fixing now"). Stop early when the review is clean, when two consecutive
cycles surface only already-rejected findings, or when the user says so.
`REVIEW.md` tells the reviewer to post Important findings only after round one,
so a third round full of nits is a signal something is misconfigured.

After the cap, summarise what changed, which threads are still open and why, and
ask whether to merge, keep pushing, or abandon.

## What NOT to do

- Don't force-push to overwrite the branch unless asked. New commits are the default.
- Don't skip hooks (`--no-verify`) unless asked — investigate the failure instead.
- Don't auto-merge. The user merges, squash-merge, `gh pr merge <n> --squash --delete-branch`.
- Don't resolve a thread you didn't actually address — that hides feedback from the user.
- Don't re-report what CI already catches, and don't argue a finding `REVIEW.md` already rules out of scope.
