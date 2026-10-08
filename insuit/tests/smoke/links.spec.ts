import { expect, test } from "@playwright/test";
import { rules } from "./redirects";

// The file can be right while the domain is not: when link.insuit.cz was never
// attached, every printed QR code was a 404 and every other test still passed.
// So each code is asked of the live domain. Right after a deploy the edge can
// still answer with the previous file, and a domain being verified answers
// 522, hence the poll.
for (const { from, to, status } of rules) {
  test(`${from} → ${to}`, async ({ request }) => {
    await expect
      .poll(
        async () => {
          const response = await request.get(from, { maxRedirects: 0 });
          const location = response.headers().location;
          // Pages writes a bare domain with its slash: https://a.cz becomes https://a.cz/.
          return `${response.status()} ${location ? new URL(location).href : ""}`;
        },
        { timeout: 15_000 },
      )
      .toBe(`${status} ${new URL(to).href}`);
  });
}
