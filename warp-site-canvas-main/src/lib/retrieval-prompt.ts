
import { COMPONENT_REGISTRY } from "./component-registry";

export function getRetrievalPrompt() {
  const components = COMPONENT_REGISTRY.map(c => 
    `- ${c.name} (${c.id}): ${c.description} [${c.category}]`
  ).join("\n");

  return `
You have access to a curated component registry. 
When building UI, prefer using these existing components over creating new ones.
Imports should use the path alias "@/components/...".

Available components:
${components}

Rules:
1. Do not use Aceternity components directly unless they are in the registry.
2. Use "lucide-react" for icons.
3. Use "sonner" for toasts.
`;
}
