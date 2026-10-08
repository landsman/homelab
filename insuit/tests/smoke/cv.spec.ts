import { expect, test } from "@playwright/test";
import { ROUTES } from "@/app/routes";

// The CV's pictures, thumbnails and printed QR codes are files the build writes
// (vite/cv.ts) and git does not hold, so a build that silently stopped writing
// one ships a CV with holes in it and nothing else notices.

test(`${ROUTES.cv} stays out of search engines`, async ({ request }) => {
  const html = await (await request.get(ROUTES.cv)).text();
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
});

test("every file the CV names is there", async ({ request }) => {
  const html = await (await request.get(ROUTES.cv)).text();
  const paths = new Set(
    [...html.matchAll(/(?:src|href|poster)="(\/[^"/][^"]*)"/g)].map(
      ([, path]) => path.split("#")[0],
    ),
  );
  expect(paths.size, "the CV names no files of its own").toBeGreaterThan(10);
  // A gallery's full-size pictures are named only in the CV's own script, and
  // asked for when it opens.
  for (const script of [...paths].filter((path) => /^\/_build\/cv-[\w-]+\.js$/.test(path))) {
    const code = await (await request.get(script)).text();
    for (const [picture] of code.matchAll(/\/assets\/cv\/[\w.-]+/g)) paths.add(picture);
  }
  const missing: string[] = [];
  await Promise.all(
    [...paths].map(async (path) => {
      const response = await request.get(path);
      if (response.status() !== 200) missing.push(`${path} ${response.status()}`);
    }),
  );
  expect(missing).toEqual([]);
});

// The page shows each QR code as a view of one sprite, cv-qr.svg#qN; a view
// the sprite does not have prints as an empty square.
test("every QR code the CV prints is in the sprite", async ({ request }) => {
  const html = await (await request.get(ROUTES.cv)).text();
  const views = [...new Set([...html.matchAll(/cv-qr\.svg#(q\d+)/g)].map(([, id]) => id))];
  expect(views.length, "the CV prints no QR codes").toBeGreaterThan(0);
  const sprite = await (await request.get("/assets/cv-qr.svg")).text();
  expect(views.filter((id) => !sprite.includes(`<view id="${id}"`))).toEqual([]);
});
