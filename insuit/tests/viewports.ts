// The screens a page is laid out on in a test, shared by Playwright and
// Cucumber, so "a phone" is the same phone in both.

/** The default: roomy, so a watched run shows a whole page. */
export const DESKTOP = { width: 1600, height: 1000 };
/** A laptop, where a page is still centred and the header's room kept. */
export const WIDE = { width: 1280, height: 800 };
/** A common phone, under the 600 px the layout switches at (styles/tokens.css). */
export const PHONE = { width: 360, height: 740 };
/** The narrowest phone still sold, where a long word has to wrap. */
export const NARROW_PHONE = { width: 320, height: 700 };
