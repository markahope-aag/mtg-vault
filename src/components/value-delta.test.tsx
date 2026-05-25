/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ValueDelta } from "./value-delta";

afterEach(() => cleanup());

describe("ValueDelta", () => {
  it("renders neutral zero state", () => {
    const { container } = render(<ValueDelta value={0} />);
    expect(container.textContent).toBe("$0.00");
  });

  it("renders positive deltas in green styling", () => {
    const { container } = render(<ValueDelta value={12.5} />);
    expect(container.textContent).toBe("+$12.50");
    expect(container.querySelector(".text-\\[var\\(--color-value-positive\\)\\]"))
      .toBeTruthy();
  });

  it("renders negative deltas in red styling", () => {
    const { container } = render(<ValueDelta value={-3.25} />);
    expect(container.textContent).toBe("−$3.25");
    expect(container.querySelector(".text-\\[var\\(--color-value-negative\\)\\]"))
      .toBeTruthy();
  });
});
