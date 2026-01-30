import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Provider configurations
const PROVIDERS = {
  lovable: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    getKey: () => Deno.env.get("LOVABLE_API_KEY"),
    models: [
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
      "openai/gpt-5",
      "openai/gpt-5-mini",
    ],
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    getKey: () => Deno.env.get("OPENROUTER_API_KEY"),
    models: [], // OpenRouter supports 100+ models
  },
};

const SYSTEM_PROMPT = `You are an expert web developer AI assistant for Surreal Sites, a website builder.
When the user describes a website they want to build, generate clean, modern HTML with embedded CSS.
Always use a dark theme with cyan (#00d9ff) and purple (#a855f7) accent colors.
Generate complete, self-contained HTML documents that can be rendered in an iframe.
Focus on creating beautiful, responsive designs with:
- Modern CSS (flexbox, grid, gradients)
- Smooth hover effects and transitions
- Clean typography and spacing
- Mobile-responsive layouts
Only output the HTML code, no explanations.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, provider = "lovable", model } = await req.json();

    // Determine which provider to use
    const providerConfig = PROVIDERS[provider as keyof typeof PROVIDERS] || PROVIDERS.lovable;
    const apiKey = providerConfig.getKey();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `${provider.toUpperCase()}_API_KEY is not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set default model based on provider
    const selectedModel = model || (provider === "lovable" ? "google/gemini-3-flash-preview" : "anthropic/claude-3.5-sonnet");

    const response = await fetch(providerConfig.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(provider === "openrouter" && {
          "HTTP-Referer": "https://surrealsites.com",
          "X-Title": "Surreal Sites Builder",
        }),
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI provider error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI provider error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-website error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
