import { useState } from "react";
import { youtubeThumbnail } from "@/app/assets";
import { m } from "@/paraglide/messages.js";

type Props = {
  /** The video's id, the `v=` of its watch address. */
  id: string;
  /** What the video is; it names the play button and the player. */
  title: string;
  /** A picture under the play button, in place of the video's thumbnail. */
  poster?: string;
};

/**
 * A YouTube video in a post: `<YouTube id="…" title="…" />`. It waits as a play
 * button over the video's thumbnail, which the build fetches and the site
 * serves itself (vite/youtube.ts), so nothing loads from YouTube until it is
 * pressed, and
 * youtube-nocookie sets no cookies until playback — the CV's videos do the
 * same (features/cv/project-dialog.tsx).
 */
export function YouTube({ id, title, poster }: Props) {
  const [playing, setPlaying] = useState(false);
  const label = m.common_video_play({ title });

  if (playing)
    return (
      <iframe
        className="blog-video"
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
        title={label}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );

  return (
    <button
      type="button"
      className="blog-video"
      aria-label={label}
      onClick={() => setPlaying(true)}
    >
      <img src={poster ?? youtubeThumbnail(id)} alt="" />
      <span className="video-badge" aria-hidden="true">
        <span className="icon-play" />
      </span>
    </button>
  );
}
