import { describe, expect, it } from "vitest";
import {
  payoutPerPlacing,
  payoutPoolCents,
  totalPaidCents,
  type PayoutScheduleRow,
} from "./payouts";

const S6040: PayoutScheduleRow[] = [
  { placing: 1, percent: 60 },
  { placing: 2, percent: 40 },
];
const S503020: PayoutScheduleRow[] = [
  { placing: 1, percent: 50 },
  { placing: 2, percent: 30 },
  { placing: 3, percent: 20 },
];

describe("payoutPoolCents", () => {
  it("applies retainage and rounds to a cent", () => {
    // 15th-session live case: class 2, 2×$75 entries, 5% retainage.
    expect(payoutPoolCents(15000, 0, 5, false)).toBe(14250);
  });

  it("forces retainage to 0 for youth classes", () => {
    // Live case: youth class 4, 2×$40 entries.
    expect(payoutPoolCents(8000, 0, 5, true)).toBe(8000);
  });

  it("includes added money before retainage", () => {
    expect(payoutPoolCents(20000, 10000, 5, false)).toBe(28500);
  });
});

describe("payoutPerPlacing — no ties", () => {
  it("pays each placing its own percentage", () => {
    // Live case: class 1, $190 pool, 60/40 → $114 / $76.
    const per = payoutPerPlacing(19000, S6040, [1, 2]);
    expect(per.get(1)).toBe(11400);
    expect(per.get(2)).toBe(7600);
    expect(totalPaidCents(per, [1, 2])).toBe(19000);
  });

  it("pays a placing beyond the schedule nothing", () => {
    const per = payoutPerPlacing(19000, S6040, [1, 2, 3]);
    expect(per.get(3)).toBe(0);
    expect(totalPaidCents(per, [1, 2, 3])).toBe(19000);
  });
});

describe("payoutPerPlacing — ties (the 00051 bug class)", () => {
  it("2-way tie for 1st splits placings 1+2 evenly and balances the pool", () => {
    // THE live bug: $80 youth pool, 60/40, both at 70.0. The pre-00051
    // formula paid $48+$48 ($96 on an $80 pool). Correct: $40 each.
    const per = payoutPerPlacing(8000, S6040, [1, 1]);
    expect(per.get(1)).toBe(4000);
    expect(totalPaidCents(per, [1, 1])).toBe(8000);
  });

  it("3-way tie for 1st consumes placings 1-3", () => {
    const per = payoutPerPlacing(30000, S503020, [1, 1, 1]);
    // (50+30+20)/3 = 33.33…% each → round(30000 × 100 / 100 / 3)
    expect(per.get(1)).toBe(10000);
    expect(totalPaidCents(per, [1, 1, 1])).toBe(30000);
  });

  it("tie for 2nd leaves 1st untouched", () => {
    const per = payoutPerPlacing(30000, S503020, [1, 2, 2]);
    expect(per.get(1)).toBe(15000); // 50%
    expect(per.get(2)).toBe(7500); // (30+20)/2 = 25% each
    expect(totalPaidCents(per, [1, 2, 2])).toBe(30000);
  });

  it("tie at the last paid placing splits only what the schedule has", () => {
    // 2-way tie at placing 2 on a 60/40 schedule: only row 2 exists in
    // the range 2..3, so the pair splits 40% — 20% each.
    const per = payoutPerPlacing(10000, S6040, [1, 2, 2]);
    expect(per.get(1)).toBe(6000);
    expect(per.get(2)).toBe(2000);
    expect(totalPaidCents(per, [1, 2, 2])).toBe(10000);
  });

  it("tie entirely beyond the schedule pays nothing", () => {
    const per = payoutPerPlacing(10000, S6040, [1, 2, 3, 3]);
    expect(per.get(3)).toBe(0);
  });

  it("never over-pays the pool for any tie shape", () => {
    const shapes = [[1, 1], [1, 1, 1], [1, 2, 2], [1, 1, 3], [1, 2, 3], [1, 1, 3, 3]];
    for (const placings of shapes) {
      const per = payoutPerPlacing(12345, S503020, placings);
      expect(totalPaidCents(per, placings)).toBeLessThanOrEqual(12345 + placings.length);
    }
  });

  it("rounds per entry to whole cents", () => {
    // $100.01 pool, 2-way tie for 1st on 60/40: 50.005 dollars each.
    const per = payoutPerPlacing(10001, S6040, [1, 1]);
    expect(per.get(1)).toBe(5001); // round(10001 × 100/100 / 2) = round(5000.5)
  });
});
