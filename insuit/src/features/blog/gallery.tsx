import { useState } from "react";
import { PhotoDialog } from "@/features/cv/photo-dialog";
import type { CvImage } from "@/features/cv/cv.types";

type Props = {
  /** The pictures in order: `src` and `alt` each, `title` for a caption. */
  images: CvImage[];
};

/**
 * Pictures in a row of frames in a post: `<Gallery images={[{ src, alt }, …]} />`.
 * A click opens one full size, where the arrow keys step through the rest — the
 * CV's photo viewer (features/cv/photo-dialog.tsx), styled by cv.css.
 */
export function Gallery({ images }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const step = (by: number) =>
    setIndex((at) => (at === null ? null : (at + by + images.length) % images.length));

  return (
    <>
      <div className="project-gallery blog-gallery">
        {images.map((image, at) => (
          <button key={image.src} type="button" className="photo-zoom" onClick={() => setIndex(at)}>
            <img src={image.src} alt={image.alt} title={image.title} />
          </button>
        ))}
      </div>
      <PhotoDialog
        zoom={index === null ? null : { photos: images, index }}
        onStep={step}
        onClose={() => setIndex(null)}
      />
    </>
  );
}
