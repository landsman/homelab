import type { MouseEvent } from "react";

// `closedby="any"` closes a dialog on a click outside it. Where the browser
// does not know the attribute yet, the click is handled here.
const lightDismiss = "closedBy" in HTMLDialogElement.prototype;

/** onClick for a <dialog>: a click on the backdrop lands on the dialog itself. */
export function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (!lightDismiss && event.target === event.currentTarget) event.currentTarget.close();
}
