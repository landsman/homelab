import { useRef } from "react";
import type { CvImage } from "@/features/cv/cv.types";
import { Modal } from "@/features/cv/modal";
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
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = zoom?.photos[zoom.index];
  // One photo has nowhere to step to, so the arrows stay out of the way.
  const single = (zoom?.photos.length ?? 0) < 2;

  return (
    <Modal
      ref={dialog}
      open={zoom !== null}
      onClose={onClose}
      className="photo-dialog"
      aria-label={m.cv_photo_label()}
      onKeyDown={(event) => {
        if (single) return;
        if (event.key === "ArrowLeft") onStep(-1);
        else if (event.key === "ArrowRight") onStep(1);
      }}
    >
      <button
        className="photo-step photo-step-previous"
        type="button"
        aria-label={m.cv_photo_previous()}
        hidden={single}
        onClick={() => onStep(-1)}
      >
        ‹
      </button>
      <button
        className="photo-step photo-step-next"
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
          <img src={photo.src} alt={photo.alt} onClick={() => dialog.current?.close()} />
          {/* A markdown title (`![alt](src "caption")`) wins; otherwise the alt text. */}
          <figcaption>{photo.title || photo.alt}</figcaption>
        </figure>
      )}
    </Modal>
  );
}
