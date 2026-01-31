import { describe, it, expect } from "vitest";
import { BrandLogo } from "./brand/BrandLogo";
import { CardGrid } from "./patterns/CardGrid";

describe("Component Wrappers", () => {
  it("BrandLogo should be defined", () => {
    expect(BrandLogo).toBeDefined();
  });

  it("CardGrid should be defined", () => {
    expect(CardGrid).toBeDefined();
  });
});
