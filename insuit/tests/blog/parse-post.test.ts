import { expect, test } from "vitest";
import { checkUnique, parsePost } from "../../vite/blog.ts";

const front = (lines: string) => `---\n${lines}\n---\n\nBody with **bold**.\n`;
const valid = "title: Hello: again\ndescription: First.\nlang: cs\npublished: 2026-10-06";

test("the path gives the slug, the front matter the rest", () => {
  // Only the first colon splits, so a title may hold one.
  expect(parsePost("2026/hello.mdx", front(valid))).toEqual({
    slug: "hello",
    title: "Hello: again",
    description: "First.",
    lang: "cs",
    published: "2026-10-06",
  });
  expect(parsePost("2026/hello.mdx", front(`${valid}\nupdated: 2026-11-01`)).updated).toBe(
    "2026-11-01",
  );
  expect(parsePost("2026/hello.mdx", front(`${valid}\nhidden: true`)).hidden).toBe(true);
});

test("a post that breaks a rule stops the build, saying which", () => {
  const fails = (file: string, lines: string, message: string) =>
    expect(() => parsePost(file, front(lines))).toThrow(message);

  fails("hello.mdx", valid, "content/blog/<year>/<slug>.mdx");
  fails("2026/Hello.mdx", valid, "lowercase letters");
  fails("2026/a.mdx", "title: A\nlang: en\npublished: 2026-10-06", "no description");
  fails("2026/a.mdx", valid.replace("2026-10-06", "6. 10. 2026"), "not YYYY-MM-DD");
  fails("2025/a.mdx", valid, "so it goes in 2026/");
  fails("2026/a.mdx", `${valid}\nupdated: 2026-10-01`, "not after it was published");
  fails("2026/a.mdx", valid.replace("lang: cs", "lang: de"), "not one of en, cs");
  fails("2026/a.mdx", `${valid}\nhidden: yes`, "leave it out, or say true");
  expect(() => parsePost("2026/a.mdx", "Just text.")).toThrow("no front matter");
});

test("two posts of one name, in any years, stop the build", () => {
  const hello = parsePost("2026/hello.mdx", front(valid));
  expect(() => checkUnique([hello, { ...hello, published: "2027-01-01" }])).toThrow(
    "two posts are named hello.mdx",
  );
});
