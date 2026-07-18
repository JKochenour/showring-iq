import { describe, expect, it } from "vitest";
import { weekendShowLabels } from "./show-labels";

describe("weekendShowLabels", () => {
  it("shortens the real Fire Cracker slates to Classic I / Classic 2", () => {
    expect(
      weekendShowLabels([
        "EPRHA Fire Cracker Classic I",
        "EPRHA Fire Cracker Classic 2",
      ])
    ).toEqual(["Classic I", "Classic 2"]);
  });

  it("keeps the last shared word for context", () => {
    expect(
      weekendShowLabels(["Spring Warm Up Slate 1", "Spring Warm Up Slate 2"])
    ).toEqual(["Slate 1", "Slate 2"]);
  });

  it("handles more than two slates", () => {
    expect(
      weekendShowLabels(["Big Event Go 1", "Big Event Go 2", "Big Event Go 3"])
    ).toEqual(["Go 1", "Go 2", "Go 3"]);
  });

  it("leaves a weekend of one alone", () => {
    expect(weekendShowLabels(["EPRHA Fire Cracker Classic I"])).toEqual([
      "EPRHA Fire Cracker Classic I",
    ]);
  });

  it("leaves names with no shared prefix alone", () => {
    expect(weekendShowLabels(["Autumn Classic", "Winter Futurity"])).toEqual([
      "Autumn Classic",
      "Winter Futurity",
    ]);
  });

  it("leaves names alone when one is a pure prefix of another", () => {
    // "Fall Show" would shorten to nothing, so neither is shortened.
    expect(weekendShowLabels(["Fall Show", "Fall Show Extra"])).toEqual([
      "Fall Show",
      "Fall Show Extra",
    ]);
  });

  it("does not shorten when only the first word differs", () => {
    expect(weekendShowLabels(["Red Reining Classic", "Blue Reining Classic"]))
      .toEqual(["Red Reining Classic", "Blue Reining Classic"]);
  });

  it("tolerates extra whitespace", () => {
    expect(
      weekendShowLabels(["EPRHA  Fire Cracker Classic I", "EPRHA Fire Cracker Classic 2"])
    ).toEqual(["Classic I", "Classic 2"]);
  });

  it("returns an empty list unchanged", () => {
    expect(weekendShowLabels([])).toEqual([]);
  });
});
