import { Fragment, useState } from "react";
import cv from "virtual:cv";
import type { CvImage, CvProject } from "@/features/cv/cv.types";
import { PhotoDialog } from "@/app/components/photo-dialog";
import { ProjectDialog } from "@/features/cv/project-dialog";
import { Prose } from "@/features/cv/prose";
import { m } from "@/paraglide/messages.js";

export function CvPage() {
  const [project, setProject] = useState<CvProject | null>(null);
  const [zoom, setZoom] = useState<{ photos: CvImage[]; index: number } | null>(null);

  return (
    <main className="wrapper cv">
      {cv.map((block, index) =>
        block.kind === "prose" ? (
          <Prose key={index} html={block.html} />
        ) : (
          <Projects key={index} projects={block.projects} onOpen={setProject} />
        ),
      )}

      <ProjectDialog
        project={project}
        onClose={() => setProject(null)}
        onZoom={(index) => project && setZoom({ photos: project.images, index })}
      />
      <PhotoDialog
        zoom={zoom}
        // Wraps around at either end.
        onStep={(by) =>
          setZoom((z) => z && { ...z, index: (z.index + by + z.photos.length) % z.photos.length })
        }
        onClose={() => setZoom(null)}
      />
    </main>
  );
}

// A job's projects: a row of cards on screen, each opening its details in the
// dialog. The dialog only exists on screen, so every project is also written
// out in full, hidden on screen and shown in print instead of the cards
// (cv.css).
function Projects({
  projects,
  onOpen,
}: {
  projects: CvProject[];
  onOpen: (project: CvProject) => void;
}) {
  return (
    <>
      {/* A small label names the row of cards, the way "Experience" names the jobs. */}
      <p className="projects-label">{m.cv_projects_label()}</p>
      <div className="projects">
        {projects.map((project) => {
          const [logo] = project.images;
          return (
            <h4 key={project.slug} className="project">
              <button type="button" onClick={() => onOpen(project)}>
                <span className="frame">
                  {logo ? (
                    // Below the first screen for all but a few: fetched as the
                    // reader gets near, not all 23 with the page. No alt: the
                    // project's name is right under it in the same button, and
                    // the picture's own description would be read before it as
                    // part of the name. The dialog has the description.
                    <img
                      src={logo.thumb ?? logo.src}
                      alt=""
                      width={logo.width}
                      height={logo.height}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    // A project without a logo still gets a tile the size of
                    // one, so the row stays even: the name before the colon,
                    // set as a wordmark. Decorative — the button's own text
                    // already names the project.
                    <span className="project-tile" aria-hidden="true">
                      {project.title.split(":")[0]}
                    </span>
                  )}
                </span>
                <span className="project-name">{project.title}</span>
              </button>
            </h4>
          );
        })}
      </div>
      <div className="projects-print">
        {projects.map((project) => (
          <section key={project.slug} className="project-print">
            <div className="print-text">
              <h4>{project.title}</h4>
              <Prose html={project.printHtml} />
            </div>
            {project.qrs.length > 0 && (
              <div className="print-qrs">
                {project.qrs.map((qr) => (
                  <figure key={qr.src} className="print-qr">
                    {/* Not lazy: a lazy image hidden on screen is never
                        fetched, so it would miss print. All the codes are
                        views of one file, so that is one request. */}
                    <img src={qr.src} alt="" fetchPriority="low" />
                    {/* A long host wraps after a dot, never inside its domain. */}
                    <figcaption>
                      {qr.labels.map((label, i) => {
                        const last = !qr.domain && i === qr.labels.length - 1;
                        return (
                          <Fragment key={i}>
                            {last ? label : `${label}.`}
                            {!last && <wbr />}
                          </Fragment>
                        );
                      })}
                      {qr.domain && <span className="print-domain">{qr.domain}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
