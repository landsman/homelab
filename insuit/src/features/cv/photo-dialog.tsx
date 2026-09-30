import { useEffect, useRef } from "react";
import type { CvImage } from "@/features/cv/cv.types";
import { closeOnBackdrop } from "@/features/cv/dialog";
import { m } from "@/paraglide/messages.js";

type Props = {
  /** The open project's photos in gallery order, and which one is shown. */
  zoom: { photos: CvImage[]; index: number } | null;
  /** Move to the previous (-1) or next (+1) photo. */
  onStep: (by: number) => void;
  onClose: () => void;
};

/** A project's photo at full size, stacked on top of the project dialog. */
export function PhotoDialog({ zoom, onStep, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = zoom !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog || dialog.open) return;
    dialog.showModal();
    // The dialog itself takes focus, not its close button: the arrow keys
    // that step through the photos would otherwise show the button's ring.
    dialog.focus();
  }, [open]);

  const photo = zoom?.photos[zoom.index];
  // One photo has nowhere to step to, so the arrows stay out of the way.
  const single = (zoom?.photos.length ?? 0) < 2;

  return (
    <dialog
      ref={ref}
      id="photo-dialog"
      className="photo-dialog"
      closedby="any"
      aria-label={m.cv_photo_label()}
      tabIndex={-1}
      onClick={closeOnBackdrop}
      onClose={onClose}
      onKeyDown={(event) => {
        if (single) return;
        if (event.key === "ArrowLeft") onStep(-1);
        else if (event.key === "ArrowRight") onStep(1);
      }}
    >
      <button
        className="project-dialog-close"
        type="button"
        aria-label={m.cv_dialog_close()}
        title={m.cv_dialog_close()}
        onClick={() => ref.current?.close()}
      >
        ×
      </button>
      <button
        id="photo-previous"
        className="photo-step"
        type="button"
        aria-label={m.cv_photo_previous()}
        hidden={single}
        onClick={() => onStep(-1)}
      >
        ‹
      </button>
      <button
        id="photo-next"
        className="photo-step"
        type="button"
        aria-label={m.cv_photo_next()}
        hidden={single}
        onClick={() => onStep(1)}
      >
        ›
      </button>
      {photo && (
        <figure>
          {/* The full-size photo closes on a click anywhere on it, too. */}
          <img src={photo.src} alt={photo.alt} onClick={() => ref.current?.close()} />
          {/* A markdown title (`![alt](src "caption")`) wins; otherwise the alt text. */}
          <figcaption>{photo.title || photo.alt}</figcaption>
        </figure>
      )}
    </dialog>
  );
}
