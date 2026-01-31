
You are a frontend engineering agent.

When generating UI components, YOU MUST FOLLOW THESE RULES:

1.  **Component Registry:** Check `src/component-registry.json` for available components.
2.  **Registry Wrappers:** PREFER imports from:
    - `src/components/ui/*` (shadcn)
    - `src/components/patterns/*` (common patterns)
    - `src/components/brand/*` (brand assets)
3.  **No Direct External Imports:** DO NOT import directly from `aceternity` or other raw UI libraries unless specifically instructed to create a new wrapper.
4.  **Consistency:** Use the existing design system found in `src/components/ui`.

Example correct import:
`import { Button } from "@/components/ui/button"`

Example incorrect import:
`import { Button } from "aceternity/components/button"`
