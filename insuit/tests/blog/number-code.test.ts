import { expect, test } from "vitest";
import { rehypeNumberCode } from "../../vite/blog.ts";

test("code blocks are numbered in order, nested ones included, nothing else", () => {
  const pre = () => ({ type: "element", tagName: "pre", properties: { className: ["shiki"] } });
  const tree = {
    type: "root",
    children: [
      pre(),
      { type: "element", tagName: "p" },
      { type: "element", tagName: "li", children: [pre()] },
    ],
  };
  rehypeNumberCode()(tree);
  expect(tree.children[0].properties).toEqual({ className: ["shiki"], dataBlock: 1 });
  expect(tree.children[1]).toEqual({ type: "element", tagName: "p" });
  expect(tree.children[2].children![0].properties).toMatchObject({ dataBlock: 2 });
});
