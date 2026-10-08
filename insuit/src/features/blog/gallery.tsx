import { useState } from "react";
import { PhotoDialog, type Photo } from "@/app/components/photo-dialog";
import { getLocale } from "@/paraglide/runtime.js";

type Props = {
  /** The pictures in order: `src` and `alt` each, `title` for a caption. */
  images: Photo[];
};

/**
 * Pictures in a row of frames in a post: `<Gallery images={[{ src, alt }, …]} />`.
 * A click opens one full size, where the arrow keys or a swipe step through the rest
 * (app/components/photo-dialog.tsx, styled by media.css).
 */
export function Gallery({ images }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const step = (by: number) =>
    setIndex((at) => (at === null ? null : (at + by + images.length) % images.length));

  return (
    <>
      <div className="gallery blog-gallery">
        {images.map((image, at) => (
          <button key={image.src} type="button" className="photo-zoom" onClick={() => setIndex(at)}>
            <img src={image.src} alt={image.alt} title={image.title} />
          </button>
        ))}
      </div>
      {/* The viewer's own words (Photo, Previous, Close) are the site's,
          whatever language the post is in. */}
      <div lang={getLocale()}>
        <PhotoDialog
          zoom={index === null ? null : { photos: images, index }}
          onStep={step}
          onClose={() => setIndex(null)}
        />
      </div>
    </>
  );
}
