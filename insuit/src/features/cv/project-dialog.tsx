import { useEffect, useRef, useState } from "react";
import type { CvProject } from "@/features/cv/cv.types";
import { Modal } from "@/app/components/modal";
import { Prose } from "@/features/cv/prose";
import { m } from "@/paraglide/messages.js";

type Props = {
  /** The project to show; null keeps the dialog closed and empty. */
  project: CvProject | null;
  onClose: () => void;
  /** Open one of the project's photos full size. */
  onZoom: (index: number) => void;
};

/** A project's details, in the page's one modal dialog. */
export function ProjectDialog({ project, onClose, onZoom }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  // A click into the YouTube player moves focus into its frame, and a key
  // pressed there never reaches this page, so Esc stops closing the dialog.
  // Focus comes straight back to the dialog: the player's own buttons still
  // work with the mouse, only its keyboard shortcuts are given up.
  useEffect(() => {
    const refocus = () => {
      const element = dialog.current;
      if (!element?.open || !(document.activeElement instanceof HTMLIFrameElement)) return;
      setTimeout(() => element.focus());
    };
    window.addEventListener("blur", refocus);
    return () => window.removeEventListener("blur", refocus);
  }, []);

  return (
    <Modal
      ref={dialog}
      open={project !== null}
      // Closing a project empties it, so a playing video stops with it.
      onClose={onClose}
      className="project-dialog"
      aria-labelledby="project-dialog-title"
    >
      <div className="project-dialog-content">
        {project && <ProjectDetails key={project.slug} project={project} onZoom={onZoom} />}
      </div>
    </Modal>
  );
}

function ProjectDetails({ project, onZoom }: { project: CvProject; onZoom: Props["onZoom"] }) {
  const { title, images, video } = project;
  const [playing, setPlaying] = useState(false);

  // In the dialog every image is a button that opens it full size. Several
  // sit in a row of small frames, so they show their small copies; one alone is
  // wide enough to need the picture itself.
  const gallery = images.length > 1;
  const photos = images.map((image, index) => (
    <button key={image.src} type="button" className="photo-zoom" onClick={() => onZoom(index)}>
      <img
        src={(gallery && image.thumb) || image.src}
        alt={image.alt}
        title={image.title}
        width={image.width}
        height={image.height}
      />
    </button>
  ));

  return (
    <>
      <h4 id="project-dialog-title">{title}</h4>
      {video ? (
        // A video waits as the project's first picture with a play button over
        // it. Only on a click does anything load from YouTube, and
        // youtube-nocookie sets no cookies until playback.
        playing ? (
          <iframe
            className="project-video"
            src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1`}
            title={m.common_video_play({ title })}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="photo-zoom video-play"
            aria-label={m.common_video_play({ title })}
            onClick={(event) => {
              // The button is about to go; focus stays in the dialog.
              event.currentTarget.closest("dialog")?.focus();
              setPlaying(true);
            }}
          >
            {images[0] && <img src={images[0].src} alt={images[0].alt} title={images[0].title} />}
            <span className="video-badge" aria-hidden="true">
              <span className="icon-play" />
            </span>
          </button>
        )
      ) : gallery ? (
        <div className={`gallery${project.tallGallery ? " gallery-tall" : ""}`}>{photos}</div>
      ) : (
        photos
      )}
      <Prose html={project.html} />
    </>
  );
}
