import { expect, test } from "vitest";
import { videoIds } from "../../vite/youtube.ts";

test("the build fetches a thumbnail for each video without a poster of its own", () => {
  const post = `
<YouTube id="DLzxrzFCyOs" title="One" />
<YouTube title="Two" id="dQw4w9WgXcQ" poster="/assets/two.jpg" />
<YouTube
  title="Three"
  id="abcdefghijk"
/>`;
  expect(videoIds(post)).toEqual(["DLzxrzFCyOs", "abcdefghijk"]);
});
