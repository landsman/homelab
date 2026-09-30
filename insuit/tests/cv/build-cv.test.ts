import { expect, test } from "vitest";
import type { CvProject } from "@/features/cv/cv.types";
import { buildCv } from "../../vite/cv.ts";

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

const wide = () => false;
const projectsOf = (block: unknown) => (block as { projects: CvProject[] }).projects;

test("a job's projects become one block between the prose around them", () => {
  const { cv } = buildCv(md, redirects, wide);

  expect(cv.map((block) => Object.keys(block)[0])).toEqual(["html", "projects", "html"]);
  const [intro, , rest] = cv as { html: string }[];
  expect(projectsOf(cv[1])).toHaveLength(2);
  // The job's own block is wrapped, with its dates kept in one piece for print.
  expect(intro.html).toContain('<div class="job-intro">');
  expect(intro.html).toContain('<span class="job-dates">May 2024 – present</span>');
  // The contact line is added once, before the first section.
  expect(intro.html.match(/print-contact/g)).toHaveLength(1);
  expect(rest.html).toContain("Another company");
});

test("a project carries its pictures, its video and its text for the dialog", () => {
  const { cv } = buildCv(md, redirects, (href) => href !== "/one.png");
  const [first, second] = projectsOf(cv[1]);

  expect(first).toMatchObject({
    slug: "first-a-project",
    title: "First: a project",
    images: [{ src: "/logo.png", alt: "Logo" }],
    video: "abc-123",
  });
  expect(first.html).toContain('href="https://example.com/" target="_blank" rel="noopener"');

  expect(second.images).toEqual([
    { src: "/one.png", alt: "One", title: "A caption" },
    { src: "/two.png", alt: "Two" },
    { src: "/three.png", alt: "Three" },
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
});

test("a link with no short link stops the build and names the rule to add", () => {
  expect(() => buildCv(md, "/ex https://example.com/ 302\n", wide)).toThrow(
    /no short link for https:\/\/www\.youtube\.com\/watch\?v=abc-123 — add to links\/_redirects:\n\/[0-9a-f]{6} https:\/\/www\.youtube\.com\/watch\?v=abc-123 302/,
  );
});
