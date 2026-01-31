import { Message, GeneratedCode } from "@/lib/ai-config";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-website`;

interface StreamChatParams {
  messages: { role: "user" | "assistant"; content: string }[];
  provider: string;
  model: string;
  onDelta: (text: string) => void;
  onDone: (fullResponse: string) => void;
  onError: (error: string) => void;
}

export async function streamChat({
  messages,
  provider,
  model,
  onDelta,
  onDone,
  onError,
}: StreamChatParams) {
  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, provider, model }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        onError("Rate limit exceeded. Please wait a moment and try again.");
        return;
      }
      if (response.status === 402) {
        onError("Payment required. Please add credits to continue.");
        return;
      }
      onError(errorData.error || "Failed to generate website");
      return;
    }

    if (!response.body) {
      onError("No response body");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let fullResponse = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            onDelta(content);
            fullResponse += content;
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            onDelta(content);
            fullResponse += content;
          }
        } catch {
          /* ignore partial leftovers */
        }
      }
    }

    onDone(fullResponse);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Stream error:", error);
    }
    onError(error instanceof Error ? error.message : "Unknown error");
  }
}

export function extractHtmlFromResponse(response: string): GeneratedCode {
  // Try to extract HTML from code blocks
  const htmlMatch = response.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (htmlMatch) {
    return { html: htmlMatch[1].trim(), css: "", js: "" };
  }

  // Check if the response starts with <!DOCTYPE or <html
  if (response.trim().startsWith("<!DOCTYPE") || response.trim().startsWith("<html")) {
    return { html: response.trim(), css: "", js: "" };
  }

  // Return the raw response as HTML
  return { html: response, css: "", js: "" };
}
