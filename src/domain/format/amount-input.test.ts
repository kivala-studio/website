import { describe, expect, it } from "vitest";

import { editAmount, formatAmountForInput, formatCompletedAmount, parseAmount } from "./amount-input";

const NBSP = " ";

// Ports iOS AmountInputFormattingTests.
describe("completed amounts", () => {
  it("formats Angolan amounts without changing the value", () => {
    for (const input of ["1000,5", "1000000,00", "0,12345678", "1.234,56", "250,25"]) {
      const formatted = formatCompletedAmount(input);
      expect(parseAmount(formatted)?.toString()).toBe(parseAmount(input)?.toString());
      expect(formatted).toContain(",");
    }
    expect(formatCompletedAmount("1000,5")).toBe(`1${NBSP}000,50`);
  });

  it("leaves empty, incomplete and invalid input untouched", () => {
    for (const input of ["", " ", "1,", "12.34", "1,2,3", "abc"]) expect(formatCompletedAmount(input)).toBe(input);
  });

  it("shows stored amounts with 2 to 8 decimals", () => {
    expect(formatAmountForInput("1250")).toBe(`1${NBSP}250,00`);
    expect(formatAmountForInput("0.123456789")).toBe("0,12345679");
  });
});

// Ports iOS LiveAmountEditingTests.
describe("live editing", () => {
  it("groups thousands while typing and keeps the decimal comma", () => {
    let text = "";
    for (const character of "1234567,50") {
      const edit = editAmount(text, text.length, text.length, character);
      expect(edit).not.toBeNull();
      text = edit!.text;
      expect(edit!.caret).toBe(text.length);
      if (character === ",") expect(text.endsWith(",")).toBe(true);
    }
    expect(text).toBe(`1${NBSP}234${NBSP}567,50`);
  });

  it("turns a typed dot into a comma", () => {
    expect(editAmount("12", 2, 2, ".")).toEqual({ text: "12,", caret: 3 });
  });

  it("keeps the caret on middle edits and backspaces across grouping", () => {
    expect(editAmount(`12${NBSP}345,67`, 4, 4, "9")).toEqual({ text: `123${NBSP}945,67`, caret: 5 });
    expect(editAmount(`12${NBSP}345,67`, 2, 3, "")).toEqual({ text: `1${NBSP}345,67`, caret: 2 });
  });

  it("accepts Angolan grouping on paste and rejects ambiguous amounts", () => {
    expect(editAmount("", 0, 0, "1.234,56")?.text).toBe(`1${NBSP}234,56`);
    expect(editAmount("", 0, 0, "12.34")).toBeNull();
    expect(editAmount("", 0, 0, "1,2,3")).toBeNull();
    expect(editAmount("", 0, 0, "abc")).toBeNull();
  });
});
