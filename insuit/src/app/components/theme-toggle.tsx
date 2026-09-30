import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages.js";

/* Theme override.
   The OS drives the theme by default (see styles/tokens.css); this only handles
   the manual override and persists it. The stored override is applied to
   <html> by the inline script in the document's head (app/theme-boot.ts),
   before first paint. */

type Theme = "light" | "dark";

const OS_DARK = "(prefers-color-scheme: dark)";

const osTheme = (): Theme => (matchMedia(OS_DARK).matches ? "dark" : "light");
const activeTheme = (): Theme =>
  (document.documentElement.dataset.theme as Theme | undefined) ?? osTheme();

/** Persist the override, or clear it. Failures are ignored — the theme still
    applies for the current page view. */
function store(theme: Theme | null) {
  try {
    if (theme === null) localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    /* Storage unavailable. */
  }
}

export function ThemeToggle() {
  // Unknown until the page runs in a browser: the prerendered button is hidden,
  // since without JS it would do nothing and the OS preference already applies.
  const [active, setActive] = useState<Theme | null>(null);

  useEffect(() => {
    const os = matchMedia(OS_DARK);
    const sync = () => setActive(activeTheme());
    sync();
    // Keep the label honest when the OS flips and no override is set.
    os.addEventListener("change", sync);
    return () => os.removeEventListener("change", sync);
  }, []);

  // Flip the theme. Landing back on what the OS says drops the override
  // entirely, so the page resumes following the system from then on.
  const toggle = () => {
    const root = document.documentElement;
    const next: Theme = activeTheme() === "dark" ? "light" : "dark";
    if (next === osTheme()) {
      delete root.dataset.theme;
      store(null);
    } else {
      root.dataset.theme = next;
      store(next);
    }
    setActive(next);
  };

  // The label names the theme a click would switch to — on aria-label for
  // screen readers, on title so a sighted user gets the same answer on hover.
  const label =
    active === null
      ? m.common_theme_switch()
      : active === "dark"
        ? m.common_theme_to_light()
        : m.common_theme_to_dark();

  return (
    <button
      className="theme-toggle"
      type="button"
      title={label}
      aria-label={label}
      hidden={active === null}
      onClick={toggle}
    >
      <span className="icon-theme" aria-hidden="true" />
    </button>
  );
}
