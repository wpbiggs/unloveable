import { describe, expect, it } from "vitest";
import { extractClarificationSpec } from "@/lib/question-extract";

describe("extractClarificationSpec", () => {
  it("parses fenced JSON questions", () => {
    const input = [
      "Some text",
      "```json",
      JSON.stringify(
        {
          questions: [
            { id: "db", question: "Use sqlite?", type: "boolean", required: true },
            { id: "ui", question: "Pick layout?", type: "select", options: ["A", "B"] },
          ],
        },
        null,
        2,
      ),
      "```",
    ].join("\n");

    const res = extractClarificationSpec(input);
    expect(res.items.length).toBe(2);
    expect(res.source).toBe("json");
    expect(res.items[0].id).toBe("db");
    expect(res.items[1].type).toBe("select");
  });

  it("rejects invalid ids", () => {
    const input = [
      "```json",
      JSON.stringify(
        {
          questions: [
            { id: "Bad ID", question: "Use sqlite?", type: "boolean", required: true },
            { id: "good_id", question: "Use sqlite?", type: "boolean", required: true },
          ],
        },
        null,
        2,
      ),
      "```",
    ].join("\n");

    const res = extractClarificationSpec(input);
    expect(res.items.length).toBe(1);
    expect(res.source).toBe("json");
    expect(res.items[0].id).toBe("good_id");
  });

  it("falls back to heading extraction", () => {
    const input = [
      "## Questions for Clarification",
      "1. Should we use sqlite?",
      "2. Should we enable uploads?",
    ].join("\n");
    const res = extractClarificationSpec(input);
    expect(res.items.length).toBe(2);
    expect(res.source).toBe("heuristic");
    expect(res.items[0].type).toBe("text");
  });
});
