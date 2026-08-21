import { describe, expect, it } from "vitest";
import { calculateFinance } from "./finance";

describe("calculateFinance", () => {
  it("mengembalikan hasil untung jika pendapatan melebihi modal dan pengeluaran", () => {
    expect(calculateFinance(1_000_000, 300_000, 150_000)).toMatchObject({ net: 550_000, status: "untung" });
  });

  it("mengembalikan status rugi jika total biaya melebihi pendapatan", () => {
    expect(calculateFinance(200_000, 300_000, 50_000)).toMatchObject({ net: -150_000, status: "rugi" });
  });
});
