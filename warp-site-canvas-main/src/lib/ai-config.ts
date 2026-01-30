export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: Array<{ url: string; mime: string; filename?: string }>;
}

export interface GeneratedCode {
  html: string;
  css: string;
  js: string;
}

export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "lovable",
    name: "Lovable AI (Built-in)",
    models: [
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", provider: "lovable" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "lovable" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "lovable" },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "lovable" },
      { id: "openai/gpt-5", name: "GPT-5", provider: "lovable" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter (100+ models)",
    models: [
      { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "openrouter" },
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "openrouter" },
      { id: "openai/gpt-4o", name: "GPT-4o", provider: "openrouter" },
      { id: "openai/o1-preview", name: "O1 Preview", provider: "openrouter" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "openrouter" },
      { id: "mistralai/mistral-large-2411", name: "Mistral Large", provider: "openrouter" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "openrouter" },
    ],
  },
];

export const DEFAULT_PROVIDER = "lovable";
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
