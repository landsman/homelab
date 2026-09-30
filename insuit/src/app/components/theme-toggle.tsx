import { useEffect, useState } from "react";

/* Theme override.
   The OS drives the theme by default (see styles/tokens.css); this only handles
   the manual override and persists it. The stored override is applied to
   <html> by the inline script in index.html, before first paint. */

type Theme = "light" | "dark";

const OS_DARK = "(prefers-color-scheme: dark)";
const root = document.documentElement;

const osTheme = (): Theme => (matchMedia(OS_DARK).matches ? "dark" : "light");
const activeTheme = (): Theme => (root.dataset.theme as Theme | undefined) ?? osTheme();

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
  const [active, setActive] = useState(activeTheme);

  // Keep the label honest when the OS flips and no override is set.
  useEffect(() => {
    const os = matchMedia(OS_DARK);
    const sync = () => setActive(activeTheme());
    os.addEventListener("change", sync);
    return () => os.removeEventListener("change", sync);
  }, []);

  // Flip the theme. Landing back on what the OS says drops the override
  // entirely, so the page resumes following the system from then on.
  const toggle = () => {
    const next: Theme = active === "dark" ? "light" : "dark";
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
  const label = `Switch to ${active === "dark" ? "light" : "dark"} theme`;

  return (
    <button
      className="theme-toggle"
      type="button"
      title={label}
      aria-label={label}
      onClick={toggle}
    >
      <span className="icon-theme" aria-hidden="true" />
    </button>
  );
}
