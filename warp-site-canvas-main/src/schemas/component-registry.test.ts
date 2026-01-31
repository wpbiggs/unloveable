import { describe, it, expect } from "vitest";
import { componentRegistrySchema } from "./component-registry";
import registry from "../component-registry.json";

describe("Component Registry", () => {
  it("should validate the registry file against the schema", () => {
    const result = componentRegistrySchema.safeParse(registry);
    if (!result.success) {
      console.error(result.error);
    }
    expect(result.success).toBe(true);
  });

  it("should have a valid version", () => {
    expect(registry.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
