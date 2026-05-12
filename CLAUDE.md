# Project Rules for Claude

## Stack
- **welcome-page**: Vite + React + TypeScript + Tailwind CSS
- Always use **TypeScript** — never plain JS for new code
- Use `make` targets, never raw `npm` commands — see `welcome-page/Makefile` for all targets
- Run `make typecheck` to verify types, `make format` to format after edits
- Common targets: `make dev`, `make build`, `make qa`, `make docker-build`, `make typecheck`

## Routing (TanStack Router — file-based)
- Routes live in `src/routes/` — the Vite plugin auto-generates `src/routeTree.gen.ts` at build/dev time; never edit that file manually
- `src/routes/__root.tsx` — root layout (Header, Footer, ConfigModal); shared across all pages
- `src/routes/index.tsx` — home page (`/`), service shortcut grid
- `src/routes/status.tsx` — status monitor (`/status`), existing status cards
- Router is registered in `main.tsx` via `createRouter` + `RouterProvider`; type registration via `declare module '@tanstack/react-router'`
- Use `<Link to="/">` for navigation — paths are type-checked at compile time
- Use `useRouterState({ select: s => s.location.pathname })` to read current path

## Hotkeys (`@tanstack/hotkeys`)
- `@tanstack/hotkeys` is framework-agnostic — use the `useHotkey` wrapper at `src/app/hooks/use-hotkey.ts`
- `useHotkey(key, handler)` registers via `HotkeyManager` singleton and cleans up on unmount
- Home page services define a `shortcut` field in `src/features/home/services.ts`; rendered as `<kbd>` hints on cards
- Cast user-supplied strings to `Hotkey` type when calling `manager.register(key as Hotkey, ...)`

## Home page (`src/features/home/`)
- `services.ts` — `HOME_CATEGORIES` array of `{ label, services[] }` where each service has `name`, `url`, optional `icon` (resolves to `/icons/services/<icon>.svg`), optional `shortcut`
- `home-page.tsx` — renders category sections with a responsive `grid` (auto-fill, 100–120 px columns); falls back to initial letter if no icon SVG exists
- To add a service: add an entry to `HOME_CATEGORIES` in `services.ts`; add its SVG to `public/icons/services/` if needed

## Code style
- Keep solutions minimal — don't add features, refactors, or comments beyond what was asked
- No docstrings or type annotations on unchanged code
- Prefer editing existing files over creating new ones
- After editing files, always run prettier on changed files

## SVG icons
- Brand/service logos go in `public/icons/<name>.svg` (20×20 viewBox) so the browser can cache them
- UI icons that need `currentColor` (chevron, refresh, settings gear, etc.) stay inline in JSX — moving them to `<img>` breaks color theming
- Icon filename defaults to `service.name.toLowerCase()`; override with `icon` field on the `Service` object

## Status page services (`services.ts`)
- Supported platforms: `atlassian` | `statusio` | `instatus` | `google-workspace`
- `atlassian` — fetch `/api/v2/summary.json`
- `statusio` — requires `statusioId`; fetch `https://api.status.io/1.0/status/<id>`
- `instatus` — fetch `/summary.json` + `/components.json`
- `google-workspace` — fetch `https://www.google.com/appsstatus/dashboard/incidents.json`
- Before adding a service, verify the platform by checking network requests on the status page
- Sections: `'external'` (default) | `'homelab'`

## UI patterns
- Tooltips: use `<Tooltip>` from `src/app/components/tooltip.tsx` — supports `placement="top" | "bottom"`; black bg, white text, arrow pointer
- Accordion sections: full-width clickable button with `aria-expanded` + `aria-controls` / `role="region"` + `aria-labelledby`
- Drag-and-drop: `@dnd-kit/sortable` with `rectSortingStrategy`; order persisted to `localStorage`
- Collapse state persisted to `localStorage`
- Layout: CSS `columns-[320px]` (masonry) within each section — not a fixed grid

## Accessibility
- Decorative SVGs get `aria-hidden="true"`
- Interactive elements need `aria-label` when icon-only
- Modal closable with ESC key via `useEffect` keydown listener
- Tooltips on truncated text and interactive controls

## New services
- Every new service must claim a **unique host port** — check `.docs/PORTS.md` before choosing, pick the next free one
- Add the new port to `.docs/PORTS.md` and to the service's own README under `## Ports`
- Suggest exposing the service via a new Cloudflare Zero Trust Tunnel subdomain pointing at `http://<pi-host>:<port>` — remind the user to add it under **Published application routes** on the tunnel in the Cloudflare dashboard (Zero Trust → Networks → Tunnels)

## Deployment
- Docker: multi-stage build (`node:20-alpine` → `nginx:alpine`)
- Target: `linux/arm64` (Raspberry Pi)
- `make docker-build` to build the image
- GitHub Actions: `.github/workflows/welcome-page-build.yml`
