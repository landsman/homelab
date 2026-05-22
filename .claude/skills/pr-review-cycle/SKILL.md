---
name: pr-review-cycle
description: Ship a branch end-to-end with a Gemini Code Assist feedback loop. Creates a branch, commits the change, pushes, opens a PR, then iterates with Gemini reviews (resolving, replying, or fixing) for up to N rounds. Use when the user says "ship this and iterate with gemini", "open a PR and cycle reviews", "do the full review dance", "go through the gemini cycle", or invokes this skill explicitly.
disable-model-invocation: false
---

# PR Review Cycle (with Gemini Code Assist)

Drive a complete branch-to-merge-candidate cycle: branch → commit → push → PR → iterate on Gemini reviews. The whole thing is one continuous loop until either Gemini stops finding issues, the agreed iteration cap is hit, or the user calls it done.

## Preflight

Before doing any of the steps, verify the environment. If any check fails, stop and tell the user.

1. **Repo + remote**: `git rev-parse --is-inside-work-tree` is `true`, and `git remote -v` includes an `origin` pointing at GitHub.
2. **gh CLI**: `gh --version` succeeds, and `gh auth status` shows a logged-in account.
3. **Clean branch state**: the user is on the main branch (`main` or `master`) OR on a branch whose only purpose is the change about to ship. If on a stale branch with unrelated commits, ask before continuing.
4. **Pre-existing staged changes**: if `git status` shows files staged from before this session (especially `AD` entries from prior tool runs), do NOT use plain `git commit` — those will get swept in. Use `git commit --only -- <paths>` so only the work-related files land.

## Step 1 — Branch

Create a descriptive branch name from the change topic. Convention: `<scope>-<kebab-summary>` (e.g. `dashboard-shift-shortcuts`, `api-fix-cache-key`).

```bash
git checkout -b <branch-name>
```

If the user is mid-conversation with uncommitted dashboard/etc. changes already on the working tree, branch first, then stage — never destructively reset.

## Step 2 — Code change

Make the change. If the change is already done in the working tree (most common case when this skill is invoked after a coding session), skip to Step 3. Otherwise, do the work the user described, running the project's local checks before committing (typecheck, format, tests — check the Makefile or `package.json` for the canonical targets).

## Step 3 — Commit

Use `git commit --only -- <paths>` (NOT `git commit -a`) so pre-existing index state is preserved. Stage explicitly with `git add <paths>`.

Match the repo's existing commit-message style — read `git log --oneline -10` and follow it. End the message with the standard trailer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Use a HEREDOC for the message so multi-line bodies format correctly.

## Step 4 — Push

```bash
git push -u origin <branch-name>
```

Pick up the PR URL from the push output (`Create a pull request for ... by visiting: ...`) — that's the same as `https://github.com/<owner>/<repo>/pull/new/<branch>`.

## Step 5 — Open the PR

```bash
gh pr create --title "<short title>" --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] ...

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- Title: imperative, under ~70 chars, e.g. `dashboard: require Shift for all keyboard shortcuts`.
- Summary: 1–3 bullets, focus on the WHY.
- Test plan: bulleted checklist of what to verify.
- Capture the returned PR number — you'll need it throughout the cycle.

If `gh` returns a "uncommitted changes" warning about unrelated AD entries from the user's index, that's harmless — call it out once in the user-facing summary.

## Step 6 — Wait for Gemini

Gemini Code Assist auto-reviews new PRs (and replies to explicit `/gemini review` triggers). Typical turnaround is **5–7 minutes**. To wait without burning prompt cache:

- Use `ScheduleWakeup` with `delaySeconds: 270` (stays inside the 5-min cache window) and re-fire the same skill prompt.
- If the first poll comes up empty, schedule another 270s wakeup.
- Never sleep in a loop synchronously; the harness wakes you back.

## Step 7 — Read and triage Gemini comments

Use the GraphQL API to fetch review threads with their resolution state:

```bash
gh api graphql -f query='
{
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <pr>) {
      reviewThreads(first: 30) {
        nodes {
          id isResolved path line
          comments(first: 5) {
            nodes { id author { login } body commit { oid } createdAt }
          }
        }
      }
    }
  }
}'
```

For each **open** thread authored by `gemini-code-assist`:

1. **Read the comment fully** — including the inline `suggestion` block.
2. **Decide**: is the suggestion correct, partially correct, wrong, or already addressed?

### Triage rules

| Verdict | Action |
|---|---|
| Correct and worth fixing | Update the code. Don't reply yet — fix first, push, then resolve the thread in one go (see Step 8). |
| Already fixed in a later commit | Resolve the thread via the mutation in Step 8. No reply needed; the GitHub UI marks it "outdated" naturally. |
| Wrong / not applicable | Reply on the thread explaining why (see "Replying" below). Do NOT resolve — let the user resolve after reading. |
| Partially right / needs nuance | Reply explaining the constraint, then either implement a partial fix or leave it. |

### Replying to a Gemini comment (when not fixing)

Replies are posted as inline review comments on the same thread. Use the REST API:

```bash
gh api -X POST repos/<owner>/<repo>/pulls/<pr>/comments/<root-comment-id>/replies \
  -f body="$(cat <<'EOF'
<your explanation here>

— Claude Code
EOF
)"
```

**Always sign replies with `— Claude Code` on its own line at the bottom.** Keep replies concise: state what the comment got wrong (or what the constraint is), one or two sentences. Don't lecture.

## Step 8 — Push fixes and resolve threads

When you've changed code in response to one or more threads:

1. Commit each logical fix as its own commit (don't bundle unrelated fixes).
2. `git push` to the same branch.
3. Resolve every thread you addressed using GraphQL:

```bash
gh api graphql -f query='
mutation($t: ID!) {
  resolveReviewThread(input: { threadId: $t }) { thread { id isResolved } }
}' -F t=<THREAD_ID>
```

## Step 9 — Trigger the next review

Gemini does NOT auto-re-review on subsequent pushes — you must ask explicitly:

```bash
gh pr comment <pr> --body "/gemini review"
```

Then go back to Step 6 (wait → poll → triage).

## Iteration cap

Default: **5 cycles**. Track the count and tell the user where you are ("Cycle 3 of 5: 1 new comment, fixing now"). Stop early if:

- Gemini's new review has no comments (all clean).
- Two consecutive cycles surface only the same already-rejected comments.
- The user says to stop or merge.

After the cap, summarise: what was changed, what threads remain open and why, and ask the user whether to merge, push more, or abandon.

## What NOT to do

- Don't force-push to overwrite the branch unless the user explicitly asks. New commits are the default.
- Don't skip pre-commit hooks (`--no-verify`) unless the user asks — investigate failures instead.
- Don't auto-merge. The user merges.
- Don't reply on the PR pretending to be the user — every reply you author should end with `— Claude Code`.
- Don't poll with `sleep` loops or short `ScheduleWakeup` repeats inside the 300s cache-miss zone; either stay under 270s or go 1200s+ if waiting on something slow.
- Don't resolve a thread you didn't actually address — that hides feedback from the user.