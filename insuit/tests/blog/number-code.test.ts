import { expect, test } from "vitest";
import { rehypeNumberCode } from "../../vite/blog.ts";

type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

test("code blocks are numbered in order, nested ones included, nothing else", () => {
  const pre = (): Node => ({
    type: "element",
    tagName: "pre",
    properties: { className: ["shiki"] },
  });
  const tree: Node & { children: Node[] } = {
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
