import { describe, expect, it } from "vitest";
import {
  createInventoryBodySchema,
  createInventoryRowSchema,
  disposeRowSchema,
  updateInventoryRowSchema,
} from "./schemas";

const PRINTING_ID = "11111111-1111-1111-1111-111111111111";

describe("createInventoryRowSchema", () => {
  it("accepts a valid row", () => {
    const parsed = createInventoryRowSchema.parse({
      printingId: PRINTING_ID,
      foil: true,
      condition: "LP",
    });
    expect(parsed.condition).toBe("LP");
    expect(parsed.foil).toBe(true);
  });

  it("normalizes null location to null", () => {
    const parsed = createInventoryRowSchema.parse({
      printingId: PRINTING_ID,
      location: null,
    });
    expect(parsed.location).toBeNull();
  });

  it("parses acquired price strings", () => {
    const parsed = createInventoryRowSchema.parse({
      printingId: PRINTING_ID,
      acquiredPrice: "$12.50",
    });
    expect(parsed.acquiredPrice).toBe("12.50");
  });
});

describe("createInventoryBodySchema", () => {
  it("requires at least one row", () => {
    expect(() => createInventoryBodySchema.parse({ rows: [] })).toThrow();
  });
});

describe("updateInventoryRowSchema", () => {
  it("allows partial updates", () => {
    const parsed = updateInventoryRowSchema.parse({ location: "Trade Binder" });
    expect(parsed.location).toBe("Trade Binder");
  });
});

describe("disposeRowSchema", () => {
  it("requires disposedTo", () => {
    expect(() => disposeRowSchema.parse({ disposedTo: "" })).toThrow();
    const parsed = disposeRowSchema.parse({ disposedTo: "Sold on eBay" });
    expect(parsed.disposedTo).toBe("Sold on eBay");
  });
});
