/* Theme override.
   The OS drives the theme by default (see css/tokens.css); this only handles
   the manual override and persists it.

   Loaded blocking in <head> on purpose — a stored override has to land on
   <html> before first paint, or the page flashes the OS theme first. */

/** @typedef {'light' | 'dark'} Theme */

(function () {
  var root = document.documentElement;
  var OS_DARK = "(prefers-color-scheme: dark)";

  /**
   * The theme the operating system currently asks for.
   * @returns {Theme}
   */
  function osTheme() {
    return matchMedia(OS_DARK).matches ? "dark" : "light";
  }

  /**
   * Read the stored override. Safari in private mode throws on storage access.
   * @returns {string | null} The stored value, or null if unset or unreadable.
   */
  function read() {
    try {
      return localStorage.getItem("theme");
    } catch {
      return null;
    }
  }

  /**
   * Persist the override, or clear it. Failures are ignored — the theme still
   * applies for the current page view.
   * @param {Theme | null} value Theme to store, or null to drop the override.
   * @returns {void}
   */
  function write(value) {
    try {
      if (value === null) localStorage.removeItem("theme");
      else localStorage.setItem("theme", value);
    } catch {
      /* Storage unavailable. */
    }
  }

  var stored = read();
  if (stored === "light" || stored === "dark") root.dataset.theme = stored;

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    button.hidden = false;

    /**
     * Point the button's label at whichever theme a click would switch to.
     * Set on both aria-label and title — the first for screen readers, the
     * second so a sighted user gets the same answer on hover.
     * @returns {void}
     */
    function label() {
      var active = root.dataset.theme || osTheme();
      var text = "Switch to " + (active === "dark" ? "light" : "dark") + " theme";
      button.setAttribute("aria-label", text);
      button.setAttribute("title", text);
    }

    /**
     * Flip the theme. Landing back on what the OS says drops the override
     * entirely, so the page resumes following the system from then on.
     * @returns {void}
     */
    function toggle() {
      var os = osTheme();
      var next = (root.dataset.theme || os) === "dark" ? "light" : "dark";

      if (next === os) {
        delete root.dataset.theme;
        write(null);
      } else {
        root.dataset.theme = next;
        write(next);
      }

      label();
    }

    button.addEventListener("click", toggle);
    // Keep the label honest when the OS flips and no override is set.
    matchMedia(OS_DARK).addEventListener("change", label);
    label();
  });
})();
