import { expect, test } from "vitest";
import type { Cv, CvProject } from "@/features/cv/cv.types";
import { buildCv, type SizeOf } from "../../vite/cv.ts";

const md = `![Me](/assets/cv/me.webp)

# Name

Tagline.

## Experience

### Company

Engineer · freelance · May 2024 – present

What the job was.

#### First: a project

[example.com](https://example.com/) ·
[the talk](https://www.youtube.com/watch?v=abc-123)

![Logo](/logo.png)

What it was.

#### Second

![One](/one.png "A caption")
![Two](/two.png)
![Three](/three.png)

More text.

### Another company

Developer · 2010 – 2012
`;

const redirects = `# comment
/ex https://example.com/ 302
/talk https://www.youtube.com/watch?v=abc-123 302
`;

const wide: SizeOf = () => ({ width: 1200, height: 630 });
const projectsOf = (block: Cv[number]): CvProject[] => {
  if (block.kind !== "projects") throw new Error(`a ${block.kind} block, not projects`);
  return block.projects;
};
const proseOf = (block: Cv[number]): string => {
  if (block.kind !== "prose") throw new Error(`a ${block.kind} block, not prose`);
  return block.html;
};

test("a job's projects become one block between the prose around them", () => {
  const { cv } = buildCv(md, redirects, wide);

  expect(cv.map((block) => block.kind)).toEqual(["prose", "projects", "prose"]);
  const intro = { html: proseOf(cv[0]) };
  const rest = { html: proseOf(cv[2]) };
  expect(projectsOf(cv[1])).toHaveLength(2);
  // The stylesheet finds these by name, not by where they sit in the markdown.
  expect(intro.html).toMatch(
    /^<p class="portrait"><img src="\/assets\/cv\/me\.webp" alt="Me"><\/p>/,
  );
  // The job's own block is wrapped, with its dates kept in one piece for print.
  expect(intro.html).toContain('<div class="job-intro">');
  expect(intro.html).toContain('<span class="job-dates">May 2024 – present</span>');
  // The contact line is added once, before the first section.
  expect(intro.html.match(/print-contact/g)).toHaveLength(1);
  expect(rest.html).toContain("Another company");
});

test("a project carries its pictures, its video and its text for the dialog", () => {
  // A phone screenshot, a picture whose size cannot be read, and a wide one.
  const { cv } = buildCv(md, redirects, (href) =>
    href === "/one.png"
      ? { width: 1200, height: 630 }
      : href === "/logo.png"
        ? undefined
        : { width: 390, height: 844 },
  );
  const [first, second] = projectsOf(cv[1]);

  expect(first).toMatchObject({
    slug: "first-a-project",
    title: "First: a project",
    // No size could be read, so none is claimed.
    images: [{ src: "/logo.png", alt: "Logo" }],
    video: "abc-123",
  });
  expect(first.images[0]).not.toHaveProperty("width");
  expect(first.html).toContain('href="https://example.com/" target="_blank" rel="noopener"');
  // A line that opens with a bold label is a list of technologies.
  const labelled = buildCv("#### P\n\n**Technologies:** Go, Bun\n\nNot **this** one.\n", "", wide);
  const [{ html }] = projectsOf(labelled.cv[0]);
  expect(html).toContain('<p class="technologies"><strong>Technologies:</strong> Go, Bun</p>');
  expect(html).toContain("<p>Not <strong>this</strong> one.</p>");

  expect(second.images).toEqual([
    { src: "/one.png", alt: "One", title: "A caption", width: 1200, height: 630 },
    { src: "/two.png", alt: "Two", width: 390, height: 844 },
    { src: "/three.png", alt: "Three", width: 390, height: 844 },
  ]);
  // Two of the three pictures are tall.
  expect(second.tallGallery).toBe(true);
  expect(second.video).toBeUndefined();
});

test("print gets a project's links as QR codes of their short links, not as text", () => {
  const { cv, qrs } = buildCv(md, redirects, wide);
  const [first, second] = projectsOf(cv[1]);

  expect(first.printHtml).not.toContain("example.com");
  expect(first.printHtml).toContain("What it was.");
  expect(first.qrs).toEqual([
    { src: "/assets/cv-qr/1.svg", labels: [], domain: "example.com" },
    { src: "/assets/cv-qr/2.svg", labels: [], domain: "youtube.com" },
  ]);
  expect(second.qrs).toEqual([]);
  expect([...qrs.keys()]).toEqual(["1.svg", "2.svg"]);
  expect(qrs.get("1.svg")).toMatch(/^<svg .*<path d="M/);

  // The code holds the short link, not the project's address: the same address
  // behind another short code draws another picture.
  const renamed = buildCv(md, redirects.replace("/ex ", "/another "), wide);
  expect(renamed.qrs.get("1.svg")).not.toEqual(qrs.get("1.svg"));
  expect(renamed.qrs.get("2.svg")).toEqual(qrs.get("2.svg"));
});

test("a link with no short link stops the build and names the rule to add", () => {
  expect(() => buildCv(md, "/ex https://example.com/ 302\n", wide)).toThrow(
    /no short link for https:\/\/www\.youtube\.com\/watch\?v=abc-123 — add to links\/_redirects:\n\/[0-9a-f]{6} https:\/\/www\.youtube\.com\/watch\?v=abc-123 302/,
  );
});
