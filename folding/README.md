# folding

[Folding@home](https://foldingathome.org) on the pollos boxes, using CPU time
nothing else wants. Tried on `saul` first; meant for the
[forgejo-runner](../forgejo-runner) boxes next, so they fold between CI jobs.

## Only when idle

There is no watcher that pauses folding when a job starts. The container runs
with `cpu_shares: 2` against the default 1024 of every other container, so the
kernel hands the cores to a CI job the moment it asks and folding gets the rest.
`oom_score_adj: 1000` and `mem_limit: 2g` do the same for memory: under pressure
this is what gets killed, and `restart` brings it back.

What the weight cannot give back: a box folding at 100 % runs hot, so a job
starting on it gets less turbo, and it shares the CPU caches. If CI gets
measurably slower on a runner box, pause folding there while
`docker ps --filter name=WORKFLOW` is non-empty.

## Setup

1. Sign in at [app.foldingathome.org](https://app.foldingathome.org), copy the
   account token from the account settings into 1Password.
2. From the laptop: `make rsync HOST=saul.pollos`
3. On the box, first start only:

       cd folding && echo "ACCOUNT_TOKEN=<token>" > .env && make up

   The box then shows up in the web app under its hostname, where team, CPU
   count and pause are set. After that `.env` can go; the link lives in `data/`.

No port is published: the client connects out to the account, and the web app
is the control panel.
