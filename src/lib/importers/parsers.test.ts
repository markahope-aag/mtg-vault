import { describe, expect, it } from "vitest";
import { parseArchidekt } from "./archidekt";
import { parseManabox } from "./manabox";
import { parseMoxfield } from "./moxfield";
import { parseTcgplayer } from "./tcgplayer";

describe("parseManabox", () => {
  it("normalizes a typical row", () => {
    const [row] = parseManabox([
      {
        Name: "Sol Ring",
        "Set code": "CMR",
        "Collector number": "472",
        Foil: "foil",
        Quantity: "2",
        Condition: "Near Mint",
        Language: "English",
        "Purchase price": "$1.25",
        "Scryfall ID": "abc-123",
      },
    ]);

    expect(row).toMatchObject({
      sourceRowIndex: 1,
      name: "Sol Ring",
      setCode: "cmr",
      collectorNumber: "472",
      quantity: 2,
      foil: true,
      etched: false,
      condition: "NM",
      language: "en",
      acquiredPrice: 1.25,
      scryfallId: "abc-123",
    });
  });

  it("prefers List Count over Quantity", () => {
    const [row] = parseManabox([
      {
        Name: "Forest",
        "Set code": "neo",
        "Collector number": "281",
        Foil: "normal",
        "List Count": "4",
        Quantity: "99",
      },
    ]);
    expect(row.quantity).toBe(4);
  });

  it("skips rows missing required fields", () => {
    expect(parseManabox([{ Name: "Incomplete" }])).toHaveLength(0);
  });
});

describe("parseMoxfield", () => {
  it("normalizes foil flag from 1/0", () => {
    const [row] = parseMoxfield([
      {
        Name: "Rhystic Study",
        Edition: "jmp",
        "Collector Number": "267",
        Foil: "1",
        Count: "1",
      },
    ]);

    expect(row).toMatchObject({
      setCode: "jmp",
      foil: true,
      quantity: 1,
    });
  });

  it("detects etched from foil column or tags", () => {
    const [fromFoil] = parseMoxfield([
      {
        Name: "X",
        Edition: "neo",
        "Collector Number": "1",
        Foil: "etched",
      },
    ]);
    const [fromTags] = parseMoxfield([
      {
        Name: "Y",
        Edition: "neo",
        "Collector Number": "2",
        Foil: "0",
        Tags: "etched",
      },
    ]);
    expect(fromFoil.etched).toBe(true);
    expect(fromTags.etched).toBe(true);
  });
});

describe("parseArchidekt", () => {
  it("normalizes finish and scryfall id", () => {
    const [row] = parseArchidekt([
      {
        Name: "Smothering Tithe",
        "Edition Code": "rna",
        CollectorNumber: "22",
        Finish: "foil",
        Quantity: "1",
        "Scryfall Id": "uuid-here",
      },
    ]);

    expect(row).toMatchObject({
      setCode: "rna",
      collectorNumber: "22",
      foil: true,
      scryfallId: "uuid-here",
    });
  });
});

describe("parseTcgplayer", () => {
  it("parses product name and printing", () => {
    const [row] = parseTcgplayer([
      {
        "Product Name": "Lightning Bolt",
        Number: "161",
        Printing: "Foil",
        Quantity: "3",
      },
    ]);

    expect(row).toMatchObject({
      name: "Lightning Bolt",
      collectorNumber: "161",
      quantity: 3,
      foil: true,
      setCode: "",
    });
  });

  it("skips rows without name or collector number", () => {
    expect(parseTcgplayer([{ "Product Name": "Solo" }])).toHaveLength(0);
  });
});
