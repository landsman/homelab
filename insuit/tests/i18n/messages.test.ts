import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));

const { baseLocale, locales } = read("project.inlang/settings.json") as {
  baseLocale: string;
  locales: string[];
};
const keys = (locale: string) =>
  Object.keys(read(`messages/${locale}.json`))
    .filter((key) => key !== "$schema")
    .sort();

// A key missing from a catalogue falls back to the base language without a
// word, which reads as done. This fails until every locale has every key.
test.each(locales)("the %s catalogue has exactly the base catalogue's keys", (locale) => {
  expect(keys(locale)).toEqual(keys(baseLocale));
});

test("no message is left empty", () => {
  for (const locale of locales) {
    const catalogue = read(`messages/${locale}.json`) as Record<string, string>;
    const empty = Object.keys(catalogue).filter((key) => !catalogue[key].trim());
    expect(empty, locale).toEqual([]);
  }
});
