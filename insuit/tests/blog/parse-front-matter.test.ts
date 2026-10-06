import { expect, test } from "vitest";
import { parseFrontMatter } from "../../vite/blog.ts";

const post = (front: string) => `---\n${front}\n---\n\nBody with **bold**.\n`;

test("front matter becomes the post's meta", () => {
  // Only the first colon splits, so a title may hold one.
  expect(
    parseFrontMatter("hello", post("title: Hello: again\ndate: 2026-10-06\ndescription: First.")),
  ).toEqual({ slug: "hello", title: "Hello: again", date: "2026-10-06", description: "First." });
});

test("a post missing a field, a date or its front matter stops the build", () => {
  expect(() => parseFrontMatter("a", post("title: A\ndate: 2026-10-06"))).toThrow("no description");
  expect(() => parseFrontMatter("a", post("title: A\ndate: 6. 10. 2026\ndescription: D"))).toThrow(
    "not YYYY-MM-DD",
  );
  expect(() => parseFrontMatter("a", "Just text.")).toThrow("no front matter");
});
