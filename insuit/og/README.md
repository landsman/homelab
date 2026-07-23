# Open Graph card

Source for the social-share image (`og:image` / `twitter:image`), shown when
`insuit.cz` is linked on X, LinkedIn, Slack, etc.

```
og.html                          the card — edit this
photo.jpg                        portrait (grayscale is applied in CSS)
fira-mono-latin-700-normal.woff2 name weight (used only here; the site ships
                                 only the 400 weight)
fira-mono-latin-400-normal.woff2 SYMLINK → ../site/assets/fonts/... (gitignored,
                                 created by `make install`, so the 400 weight
                                 isn't committed twice)
```

## Regenerate

CI does this automatically: **`.github/workflows/insuit-og.yml`** re-renders the
card and commits the PNG whenever a PR changes anything under `og/`. You don't
have to run it by hand.

To preview locally (from `insuit/`):

```bash
make install   # once — creates the font symlink
make og        # renders og/og.html → ../site/assets/icons/og-image.png
```

`make og` renders at 1200×630 with headless **Chromium in Docker** — no local
browser, and the same image on any machine or in CI (that's why it's
provider-independent rather than tied to a local Chrome or to Cloudflare). It
mounts the whole `insuit/` dir so the font symlink resolves, and loads `og.html`
over `file://`, so no dev server is needed. Override the image with
`make og OG_RENDER_IMAGE=…`.

`og.html` is self-contained (relative paths), so you can also just open it in a
browser at 1200×630 and screenshot.

## Notes

- Fira Mono is licensed under the SIL OFL — see
  [`../site/assets/fonts/fira-mono-LICENSE.txt`](../site/assets/fonts/fira-mono-LICENSE.txt).
- Card size is 1200×630 (1.91:1), the size `og:image:width/height` declare in
  `site/index.html`. Keep them in sync if you change the canvas.
