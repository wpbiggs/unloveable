import { describe, it, expect, vi } from "vitest";
import { noDirectAceternityImports } from "../../eslint-rules/no-direct-aceternity-imports";

describe("no-direct-aceternity-imports rule", () => {
  it("should be defined", () => {
    expect(noDirectAceternityImports).toBeDefined();
    expect(noDirectAceternityImports.meta.docs.description).toBe("Forbid direct imports from Aceternity");
  });

  it("should have a create function", () => {
    expect(typeof noDirectAceternityImports.create).toBe("function");
  });

  it("should report an error for aceternity imports", () => {
    const context = {
      report: vi.fn(),
    };
    
    const rule = noDirectAceternityImports.create(context);
    
    // Test valid import
    rule.ImportDeclaration({
      source: { value: "react" },
    } as unknown);
    expect(context.report).not.toHaveBeenCalled();

    // Test invalid aceternity import
    rule.ImportDeclaration({
      source: { value: "@aceternity/ui" },
    } as unknown);
    expect(context.report).toHaveBeenCalledWith({
      node: expect.anything(),
      message: "Direct imports from Aceternity are forbidden. Use the component registry wrappers instead.",
    });
  });
});
