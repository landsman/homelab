import type { MouseEvent } from "react";

/**
 * onClick for a <dialog>. `closedby="any"` closes it on a click outside; where
 * the browser does not know the attribute yet, the click is handled here — a
 * click on the backdrop lands on the dialog element itself.
 */
export function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const lightDismiss = "closedBy" in HTMLDialogElement.prototype;
  if (!lightDismiss && event.target === event.currentTarget) event.currentTarget.close();
}
