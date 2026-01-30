import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Builder from "@/pages/Builder";

describe("Builder", () => {
  it("renders without crashing", () => {
    const g = globalThis as unknown as { crypto?: Crypto };
    const existing = g.crypto;
    if (!existing?.randomUUID) {
      g.crypto = {
        ...(existing ?? {}),
        randomUUID: () => "00000000-0000-0000-0000-000000000000",
      } as Crypto;
    }

    expect(() => {
      render(
        <MemoryRouter>
          <Builder />
        </MemoryRouter>,
      );
    }).not.toThrow();
  });
});
