import { expect, test } from "vitest";
import { swipeStep } from "@/app/hooks/use-swipe";

const at = (x: number, y = 300) => ({ x, y });

test("a swipe left steps to the next, a swipe right to the previous", () => {
  expect(swipeStep(at(400), at(200))).toBe(1);
  expect(swipeStep(at(200), at(400))).toBe(-1);
});

test("a tap or a short move does not step", () => {
  expect(swipeStep(at(400), at(400))).toBe(0);
  expect(swipeStep(at(400), at(350))).toBe(0);
});

test("a mostly vertical drag does not step, however far it goes sideways", () => {
  expect(swipeStep(at(400, 100), at(300, 400))).toBe(0);
});
