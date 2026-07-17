import { describe, it, expect } from "vitest";
import { computeEntryRunFees, JUDGE_FEE_KEY } from "./billing";

// Fees in cents. Thursday Indoor example from the EPRHA entry form:
//   1100 Open      entry $100  judge $75
//   1200 Int Open  entry $75   judge $55   (concurrent with 1100)
//   1400 Non Pro   entry $75   judge $55   (a separate run)
// Per-run standard charges: Video $17, Photo $10.
const VIDEO = { label: "Video", amountCents: 1700 };
const PHOTO = { label: "Photo", amountCents: 1000 };
const perRun = [VIDEO, PHOTO];

const c = (concurrentGroupId: string | null, judgeFeeCents: number) => ({
  concurrentGroupId,
  judgeFeeCents,
});

function byKey(lines: { feeKey: string; effectiveCents: number }[]) {
  return Object.fromEntries(lines.map((l) => [l.feeKey, l.effectiveCents]));
}

describe("computeEntryRunFees", () => {
  it("charges judge (max per run) + video/photo once per run — the Thursday example", () => {
    // 1100 & 1200 concurrent (group "open"); 1400 its own run.
    const classes = [c("open", 7500), c("open", 5500), c(null, 5500)];
    const { lines, totalCents } = computeEntryRunFees(classes, perRun, new Map());

    // Two runs → judge = max(75,55) + 55 = 130; video 2×17 = 34; photo 2×10 = 20.
    expect(byKey(lines)).toEqual({ [JUDGE_FEE_KEY]: 13000, Video: 3400, Photo: 2000 });
    expect(lines.find((l) => l.feeKey === "Video")!.runCount).toBe(2);
    expect(totalCents).toBe(13000 + 3400 + 2000);
  });

  it("treats every ungrouped class as its own run", () => {
    const classes = [c(null, 7500), c(null, 5500), c(null, 5500)];
    const { lines } = computeEntryRunFees(classes, perRun, new Map());
    // Three runs → judge 75+55+55 = 185; video 3×17 = 51; photo 3×10 = 30.
    expect(byKey(lines)).toEqual({ [JUDGE_FEE_KEY]: 18500, Video: 5100, Photo: 3000 });
  });

  it("labels each run fee with its classes (concurrent joined by +, runs by ·)", () => {
    const classes = [
      { concurrentGroupId: "open", judgeFeeCents: 7500, className: "Open" },
      { concurrentGroupId: "open", judgeFeeCents: 5500, className: "Intermediate Open" },
      { concurrentGroupId: null, judgeFeeCents: 4500, className: "Novice Horse Level 2" },
    ];
    const { lines } = computeEntryRunFees(classes, [VIDEO], new Map());
    const judge = lines.find((l) => l.feeKey === JUDGE_FEE_KEY)!;
    expect(judge.detail).toBe("Open + Intermediate Open · Novice Horse Level 2");
    expect(judge.effectiveCents).toBe(12000); // max(75,55) + 45
    // The per-run charge carries the same run description.
    expect(lines.find((l) => l.feeKey === "Video")!.detail).toBe(
      "Open + Intermediate Open · Novice Horse Level 2"
    );
  });

  it("collapses a concurrent group to one run and takes the highest judge fee", () => {
    const classes = [c("g", 7500), c("g", 5500), c("g", 4500)];
    const { lines } = computeEntryRunFees(classes, perRun, new Map());
    expect(byKey(lines)).toEqual({ [JUDGE_FEE_KEY]: 7500, Video: 1700, Photo: 1000 });
  });

  it("applies an override as the total and keeps the line present (comp to $0)", () => {
    const classes = [c("open", 7500), c("open", 5500), c(null, 5500)];
    const overrides = new Map([["Video", 0]]);
    const { lines, totalCents } = computeEntryRunFees(classes, perRun, overrides);

    const video = lines.find((l) => l.feeKey === "Video")!;
    expect(video.computedCents).toBe(3400);
    expect(video.overrideCents).toBe(0);
    expect(video.effectiveCents).toBe(0);
    // Judge 130 + Video 0 + Photo 20.
    expect(totalCents).toBe(13000 + 0 + 2000);
  });

  it("supports a non-zero judge override", () => {
    const classes = [c(null, 7500)];
    const overrides = new Map([[JUDGE_FEE_KEY, 5000]]);
    const { lines } = computeEntryRunFees(classes, perRun, overrides);
    const judge = lines.find((l) => l.feeKey === JUDGE_FEE_KEY)!;
    expect(judge.computedCents).toBe(7500);
    expect(judge.effectiveCents).toBe(5000);
  });

  it("omits the judge line when every class's judge fee is 0 (e.g. youth)", () => {
    const classes = [c(null, 0), c(null, 0)];
    const { lines } = computeEntryRunFees(classes, perRun, new Map());
    expect(lines.find((l) => l.feeKey === JUDGE_FEE_KEY)).toBeUndefined();
    // Video/photo still apply per run (2 runs).
    expect(byKey(lines)).toEqual({ Video: 3400, Photo: 2000 });
  });

  it("still shows an overridden line even when its computed amount is 0", () => {
    const classes = [c(null, 0)];
    const overrides = new Map([[JUDGE_FEE_KEY, 0]]);
    const { lines } = computeEntryRunFees(classes, perRun, overrides);
    const judge = lines.find((l) => l.feeKey === JUDGE_FEE_KEY)!;
    expect(judge).toBeDefined();
    expect(judge.effectiveCents).toBe(0);
  });

  it("charges no run fees when there are no per-run charges and no judge fees", () => {
    const classes = [c(null, 0), c("g", 0)];
    const { lines, totalCents } = computeEntryRunFees(classes, [], new Map());
    expect(lines).toEqual([]);
    expect(totalCents).toBe(0);
  });

  it("charges one video/photo when a single horse runs one concurrent group", () => {
    // The QA verification shape: one class, one run.
    const classes = [c(null, 5000)];
    const { totalCents } = computeEntryRunFees(classes, perRun, new Map());
    // judge 50 + video 17 + photo 10 = 77.
    expect(totalCents).toBe(5000 + 1700 + 1000);
  });
});
