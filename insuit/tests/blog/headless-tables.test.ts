import { expect, test } from "vitest";
import { rehypeHeadlessTables } from "../../vite/blog.ts";

const cell = (value: string) => ({
  type: "element",
  tagName: "th",
  children: [{ type: "text", value }],
});
const table = (...head: string[]) => ({
  type: "element",
  tagName: "table",
  children: [
    {
      type: "element",
      tagName: "thead",
      children: [{ type: "element", tagName: "tr", children: head.map(cell) }],
    },
    { type: "element", tagName: "tbody", children: [] },
  ],
});

test("a header row of empty cells is dropped, one with any text is kept", () => {
  const tree = { type: "root", children: [table("", "  "), table("", "Where")] };
  rehypeHeadlessTables()(tree);
  expect(tree.children[0].children.map((c) => c.tagName)).toEqual(["tbody"]);
  expect(tree.children[1].children.map((c) => c.tagName)).toEqual(["thead", "tbody"]);
});
