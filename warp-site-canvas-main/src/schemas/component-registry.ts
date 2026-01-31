import { z } from "zod";

export const componentRegistrySchema = z.object({
  version: z.string(),
  components: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      category: z.enum(["ui", "layout", "form", "feedback", "overlay", "navigation", "data-display", "typography", "other"]),
      path: z.string(), // relative path to import
      dependencies: z.array(z.string()).optional(),
    })
  )
});

export type ComponentRegistry = z.infer<typeof componentRegistrySchema>;
