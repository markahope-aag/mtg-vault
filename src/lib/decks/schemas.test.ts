import { describe, expect, it } from "vitest";
import {
  createDeckSchema,
  updateDeckSchema,
  upsertDeckCardSchema,
} from "./schemas";

const PRINTING_ID = "11111111-1111-4111-8111-111111111111";

describe("createDeckSchema", () => {
  it("accepts a minimal deck", () => {
    const parsed = createDeckSchema.parse({ name: "My Deck" });
    expect(parsed.name).toBe("My Deck");
  });

  it("normalizes null archetype and notes", () => {
    const parsed = createDeckSchema.parse({
      name: "Deck",
      archetype: null,
      notes: null,
    });
    expect(parsed.archetype).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("validates target bracket range", () => {
    expect(() =>
      createDeckSchema.parse({ name: "X", targetBracket: 6 }),
    ).toThrow();
  });
});

describe("updateDeckSchema", () => {
  it("allows partial deck updates", () => {
    const parsed = updateDeckSchema.parse({ isPrimary: true });
    expect(parsed.isPrimary).toBe(true);
  });
});

describe("upsertDeckCardSchema", () => {
  it("requires delta or set", () => {
    expect(() =>
      upsertDeckCardSchema.parse({ printingId: PRINTING_ID }),
    ).toThrow(/delta or set/i);
  });

  it("accepts delta updates", () => {
    const parsed = upsertDeckCardSchema.parse({
      printingId: PRINTING_ID,
      delta: 1,
    });
    expect(parsed.delta).toBe(1);
  });
});
