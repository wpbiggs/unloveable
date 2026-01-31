export type QuestionSpec = {
  id: string;
  question: string;
  type: "text" | "select" | "boolean";
  required?: boolean;
  options?: string[];
};

export type ClarificationResult = {
  items: QuestionSpec[];
  source: "tag" | "json" | "heuristic" | "none";
};

function normalize(text: string) {
  return (text || "").replace(/\r\n/g, "\n");
}

function parseQuestionObject(obj: unknown) {
  if (!obj || typeof obj !== "object") return [] as QuestionSpec[];
  const root = obj as Record<string, unknown>;
  const raw =
    (Array.isArray(root.questions) && root.questions) ||
    (Array.isArray(root["clarifications"]) && root["clarifications"]) ||
    (Array.isArray(root["unloveable_questions"]) && root["unloveable_questions"]);

  if (!Array.isArray(raw)) return [];

  const items: QuestionSpec[] = [];
  for (let i = 0; i < raw.length; i++) {
    const q = raw[i];
    if (!q || typeof q !== "object") continue;
    const qobj = q as Record<string, unknown>;

    const idRaw = typeof qobj.id === "string" ? qobj.id.trim() : "";
    const id = idRaw || `q${i + 1}`;
    const question = typeof qobj.question === "string" ? qobj.question.trim() : "";
    const type = ((): QuestionSpec["type"] => {
      const t = typeof qobj.type === "string" ? qobj.type : "text";
      if (t === "select" || t === "boolean" || t === "text") return t;
      return "text";
    })();
    const options = Array.isArray(qobj.options) ? qobj.options.filter((x: unknown) => typeof x === "string") : undefined;
    const required = typeof qobj.required === "boolean" ? qobj.required : true;
    if (!question || !question.endsWith("?")) continue;

    // Prefer stable snake_case ids; ignore invalid ids from model.
    if (idRaw && !/^[a-z][a-z0-9_]*$/.test(idRaw)) continue;

    if (type === "select" && (!options || options.length === 0)) continue;
    if (type !== "select" && options && options.length) continue;
    items.push({ id, question, type, options, required });
  }
  return items;
}

export function extractClarificationSpec(text: string) {
  const src = normalize(text);

  // 1) Prefer an explicit JSON block
  const tag = /<(questions|clarifications)>([\s\S]*?)<\/(questions|clarifications)>/i.exec(src);
  if (tag?.[2]) {
    try {
      const parsed = JSON.parse(tag[2]);
      const items = parseQuestionObject(parsed);
      if (items.length) return { items, source: "tag" } satisfies ClarificationResult;
    } catch {
      // ignore
    }
  }

  const fences = src.match(/```json[\s\S]*?```/gi) ?? [];
  for (const block of fences) {
    const body = block.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    try {
      const parsed = JSON.parse(body);
      const items = parseQuestionObject(parsed);
      if (items.length) return { items, source: "json" } satisfies ClarificationResult;
    } catch {
      // ignore
    }
  }

  // 2) Fallback: heuristic extraction from headings
  const qs = extractClarificationQuestions(src);
  if (!qs.questions.length) return { items: [] as QuestionSpec[], source: "none" } satisfies ClarificationResult;
  return {
    items: qs.questions.map((q, i) => ({ id: `q${i + 1}`, question: q, type: "text" as const, required: true })),
    source: "heuristic",
  } satisfies ClarificationResult;
}

export function extractClarificationQuestions(text: string) {
  const src = normalize(text);
  const lines = src.split("\n");

  const findHeading = () => {
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim().toLowerCase();
      if (t === "## questions for clarification" || t === "questions for clarification") return i;
      if (t.includes("questions for clarification")) return i;
      if (t === "before i proceed, i have a few questions:" || t === "before i proceed, i have a few questions") return i;
    }
    return -1;
  };

  const start = findHeading();
  if (start === -1) return { questions: [] as string[] };

  let inCode = false;
  const out: string[] = [];

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (!trimmed) continue;

    // stop at next heading
    if (/^#{1,6}\s+/.test(trimmed)) break;

    const bullet = trimmed.replace(/^[-*]\s+/, "");
    const numbered = bullet.replace(/^\d+\.?\s+/, "");
    const q = numbered.trim();

    if (q.length < 3) continue;
    if (!q.endsWith("?")) continue;
    out.push(q);
    if (out.length >= 8) break;
  }

  return { questions: out };
}
