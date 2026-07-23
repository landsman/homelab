# Open Graph card

Source for the social-share image (`og:image` / `twitter:image`), shown when
`insuit.cz` is linked on X, LinkedIn, Slack, etc.

```
og.html      the card — edit this
photo.jpg    portrait (grayscale is applied in CSS)
*.woff2      SYMLINKS into @fontsource/fira-mono (node_modules), created by
             `make install` — gitignored, so no font is committed for the card
```

The rendered PNG is **not committed**. CI regenerates it and hands it to the
deploy as an artifact (see `.github/workflows/insuit-deploy.yml`), so it's never
stored in git and never goes stale.

## Preview / regenerate locally

From `insuit/`:

```bash
make install   # deps, font symlinks, chromium
make og        # renders og/og.html → site/assets/icons/og-image.png (gitignored)
```

`make og` uses **Playwright's headless Chromium** — maintained (Microsoft),
provider-independent, and the same engine locally and in CI (no third-party
Docker image to rot, nothing tied to Cloudflare). `og.html` is self-contained
(relative paths), so you can also just open it in a browser at 1200×630 and
screenshot.

## Notes

- Fira Mono (SIL OFL) comes from the `@fontsource/fira-mono` dev dependency; the
  site ships its own committed 400 weight, so nothing is duplicated in git.
- Card size is 1200×630 (1.91:1), the size `og:image:width/height` declare in
  `site/index.html`. Keep them in sync if you change the canvas.
