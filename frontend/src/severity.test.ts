import { expect, test } from "vitest";

const severities = ["GREEN", "YELLOW", "RED"] as const;
const types = ["VITALS", "COMPOUND"] as const;

test("alert enums match contracts", () => {
  expect(severities).toEqual(["GREEN", "YELLOW", "RED"]);
  expect(types).toEqual(["VITALS", "COMPOUND"]);
});
