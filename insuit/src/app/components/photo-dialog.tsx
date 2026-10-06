import { useRef } from "react";
import { Modal } from "@/app/components/modal";
import { m } from "@/paraglide/messages.js";

/** A picture the viewer can show: a markdown title, when it has one, is its caption. */
export type Photo = { src: string; alt: string; title?: string };

type Props = {
  /** The photos in gallery order, and which one is shown. */
  zoom: { photos: Photo[]; index: number } | null;
  /** Move to the previous (-1) or next (+1) photo. */
  onStep: (by: number) => void;
  onClose: () => void;
};

/**
 * A photo at full size, with arrows to the others: a CV project's (stacked on
 * its dialog) or a post's gallery's (features/blog/gallery.tsx).
 */
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
      aria-label={m.common_photo_label()}
      onKeyDown={(event) => {
        if (single) return;
        if (event.key === "ArrowLeft") onStep(-1);
        else if (event.key === "ArrowRight") onStep(1);
      }}
    >
      <button
        className="photo-step photo-step-previous"
        type="button"
        aria-label={m.common_photo_previous()}
        hidden={single}
        onClick={() => onStep(-1)}
      >
        ‹
      </button>
      <button
        className="photo-step photo-step-next"
        type="button"
        aria-label={m.common_photo_next()}
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
