export interface ComponentItem {
  name: string;
  description: string;
  category: "ui" | "layout" | "form" | "feedback";
}

export const COMPONENT_LIST: ComponentItem[] = [
  { name: "Button", description: "Interactive button", category: "ui" },
  { name: "Card", description: "Container with header, content, footer", category: "layout" },
  { name: "Input", description: "Text input field", category: "form" },
  { name: "Dialog", description: "Modal dialog window", category: "feedback" },
  { name: "Sheet", description: "Side-panel drawer", category: "layout" },
  { name: "Badge", description: "Small status indicator", category: "ui" },
  { name: "Accordion", description: "Collapsible content sections", category: "layout" },
  { name: "Alert", description: "Callout for user attention", category: "feedback" },
  { name: "Avatar", description: "User profile image/fallback", category: "ui" },
  { name: "Checkbox", description: "Toggle selection", category: "form" },
];
