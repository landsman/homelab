import { useEffect, useRef, type ComponentProps, type ReactNode, type RefObject } from "react";
import { m } from "@/paraglide/messages.js";

type Props = {
  open: boolean;
  /** Called when the dialog has closed, however it was closed. */
  onClose: () => void;
  className: string;
  children: ReactNode;
  /** For a caller that has to reach the <dialog> itself. */
  ref?: RefObject<HTMLDialogElement | null>;
} & Pick<ComponentProps<"dialog">, "aria-label" | "aria-labelledby" | "onKeyDown">;

/**
 * A modal <dialog> with its close button: what the project dialog and the
 * full-size photo share. It closes on Escape and the × on its own, and on a
 * click outside it.
 */
export function Modal({ open, onClose, className, children, ref, ...dialogProps }: Props) {
  const own = useRef<HTMLDialogElement>(null);
  const dialog = ref ?? own;

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element || element.open) return;
    element.showModal();
    // The dialog itself takes focus, not its close button: keys meant for the
    // content (the arrows that step through photos) would otherwise show the
    // button's ring.
    element.focus();
  }, [open, dialog]);

  return (
    <dialog
      {...dialogProps}
      ref={dialog}
      className={className}
      closedby="any"
      tabIndex={-1}
      onClose={onClose}
      onClick={(event) => {
        // `closedby="any"` closes on a click outside. Where the browser does
        // not know the attribute yet, that click is handled here: one on the
        // backdrop lands on the dialog element itself.
        const lightDismiss = "closedBy" in HTMLDialogElement.prototype;
        if (!lightDismiss && event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <button
        className="dialog-close"
        type="button"
        aria-label={m.cv_dialog_close()}
        title={m.cv_dialog_close()}
        onClick={() => dialog.current?.close()}
      >
        ×
      </button>
      {children}
    </dialog>
  );
}
