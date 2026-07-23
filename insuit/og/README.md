# Open Graph card

Source for the social-share image (`og:image` / `twitter:image`), shown when
`insuit.cz` is linked on X, LinkedIn, Slack, etc.

```
og.html                          the card — edit this
photo.jpg                        portrait (grayscale is applied in CSS)
fira-mono-latin-400-normal.woff2 body weight
fira-mono-latin-700-normal.woff2 name weight (not shipped with the site,
                                 which only uses 400)
```

## Regenerate

From `insuit/`:

```bash
make og
```

Renders `og.html` at 1200×630 via headless Chrome into
`../site/assets/icons/og-image.png` — the only file that ships. Chrome loads
`og.html` directly (`file://`), so no dev server is needed. Override the browser
path with `make og CHROME=/path/to/chrome` if it isn't at the macOS default.

The `og.html` is self-contained (relative font/photo paths), so you can also
just open it in a browser at 1200×630 and screenshot.

## Notes

- Fira Mono is licensed under the SIL OFL — see
  [`../site/assets/fonts/fira-mono-LICENSE.txt`](../site/assets/fonts/fira-mono-LICENSE.txt).
- Card size is 1200×630 (1.91:1), the size `og:image:width/height` declare in
  `site/index.html`. Keep them in sync if you change the canvas.
