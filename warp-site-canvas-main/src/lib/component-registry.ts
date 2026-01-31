
import { z } from "zod";

export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["ui", "pattern", "brand"]),
  source: z.string(), // "shadcn", "aceternity", "21st", "custom"
  path: z.string(), // import path
  dependencies: z.array(z.string()).optional(),
});

export type ComponentDefinition = z.infer<typeof ComponentSchema>;

export const COMPONENT_REGISTRY: ComponentDefinition[] = [];
