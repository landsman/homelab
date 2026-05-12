# IP Address Feature

Displays the current device's IPv4 and IPv6 addresses in the header via external API calls.

## How it works

### Architecture

```
Browser → api4.ipify.org → returns IPv4 address
Browser → api6.ipify.org → returns IPv6 address
```

Both services support CORS, so the browser calls them directly — no nginx proxy needed.

### Hook (`use-ip-address.ts`)

Uses two React Query queries to fetch IPv4 and IPv6 in parallel:

- Results are cached for **5 minutes** (`staleTime: 1000 * 60 * 5`)
- `retry: false` — avoids retrying when offline
- Integrates with `useNetworkStatus` — when the device comes back online, both queries are invalidated and re-fetched automatically

### Component (`ip-address.tsx`)

A clickable button that copies all available IP addresses to the clipboard. Behaviour varies by viewport:

**Desktop (`sm+`)**

- Shown inline in the `homelab · dashboard` status row in the header
- Displays `IPv4 · IPv6` (IPv6 truncates at `10rem`, expands to `16rem` on `lg+`)

**Mobile (< `sm`)**

- Shown on the right side of the navigation row (Row 2 of the header)
- Displays `IPv4` only to fit small screens (375 px / iPhone 13 mini)
- When IPv6 is also available, shows a compact `(+ipv6)` badge
- When only IPv4 is available (no IPv6), shows a red `(no ipv6)` badge

**All viewports**

- Shows `…` while loading
- Shows a red `offline` label when the network is down
- Shows `local` when neither address is available online
- On click: copies all available addresses (`IPv4 · IPv6`) to clipboard via `copyToClipboard` util
- Tooltip: `Click to copy your IP` → switches to `Copied!` for 1.5 s after a successful copy
- `[touch-action:manipulation]` eliminates the 300 ms iOS tap delay
- No page jump on iOS — the clipboard fallback textarea is anchored at `top:0 left:0`, `readonly`, and focused with `preventScroll: true`

## Future improvements

- **Self-hosted IP detection service** — instead of relying on the external `ipify.org` APIs, it would be better to run a small self-hosted service on the Raspberry Pi (e.g., a tiny HTTP server that simply returns `$remote_addr`). This removes the dependency on a third-party service, works fully offline/on the local network, and avoids any potential privacy or availability concerns.
