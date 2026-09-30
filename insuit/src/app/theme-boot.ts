/**
 * Runs inline in <head>, before first paint: puts a stored theme override on
 * <html>. The toggle that writes it is components/theme-toggle.tsx. Safari in
 * private mode throws on storage access, hence the try.
 */
export const THEME_BOOT = `try {
  var theme = localStorage.getItem("theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {}`;
