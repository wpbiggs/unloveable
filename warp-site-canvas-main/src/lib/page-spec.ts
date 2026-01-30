export type PageSpecLayout = "SplitView" | "TableWithFilters" | "Kanban" | "Landing";

export type PageSpecSectionPattern = "ChatPanel" | "FileTree" | "CodeEditor" | "Preview" | "Console";

export type PageSpec = {
  route: string;
  surface: "app" | "marketing";
  layout: PageSpecLayout;
  title: string;
  primaryAction: {
    label: string;
    type: "button" | "modal" | "submit";
    target: string;
  };
  sections: Array<{
    id: string;
    pattern: PageSpecSectionPattern;
    props: Record<string, unknown>;
    dataBindings: Record<string, unknown>;
  }>;
  states: {
    loading: string[];
    empty: string[];
    error: string[];
  };
};

function firstJsonCodeBlock(text: string) {
  const m = /```json\s*([\s\S]*?)```/i.exec(text);
  return m?.[1]?.trim() || "";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function extractPageSpec(text: string):
  | { ok: true; raw: string; value: PageSpec }
  | { ok: false; error: string } {
  const raw = firstJsonCodeBlock(text) || (text || "").trim();
  if (!raw) return { ok: false, error: "No JSON found for PageSpec" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "PageSpec JSON parse failed" };
  }

  if (!isRecord(parsed)) return { ok: false, error: "PageSpec must be a JSON object" };

  const route = typeof parsed.route === "string" ? parsed.route : "";
  const surface = parsed.surface === "app" || parsed.surface === "marketing" ? parsed.surface : null;
  const layout =
    parsed.layout === "SplitView" || parsed.layout === "TableWithFilters" || parsed.layout === "Kanban" || parsed.layout === "Landing"
      ? parsed.layout
      : null;
  const title = typeof parsed.title === "string" ? parsed.title : "";

  const primaryAction = isRecord(parsed.primaryAction) ? parsed.primaryAction : null;
  const paLabel = primaryAction && typeof primaryAction.label === "string" ? primaryAction.label : "";
  const paType =
    primaryAction && (primaryAction.type === "button" || primaryAction.type === "modal" || primaryAction.type === "submit")
      ? (primaryAction.type as PageSpec["primaryAction"]["type"])
      : null;
  const paTarget = primaryAction && typeof primaryAction.target === "string" ? primaryAction.target : "";

  const sectionsRaw = Array.isArray(parsed.sections) ? parsed.sections : null;
  const statesRaw = isRecord(parsed.states) ? parsed.states : null;

  if (!route || !surface || !layout || !title) {
    return { ok: false, error: "PageSpec missing required fields: route/surface/layout/title" };
  }
  if (!primaryAction || !paLabel || !paType || !paTarget) {
    return { ok: false, error: "PageSpec.primaryAction is invalid" };
  }
  if (!sectionsRaw) return { ok: false, error: "PageSpec.sections must be an array" };
  if (!statesRaw) return { ok: false, error: "PageSpec.states must be an object" };

  const states = {
    loading: Array.isArray(statesRaw.loading) ? statesRaw.loading.filter((x) => typeof x === "string") : [],
    empty: Array.isArray(statesRaw.empty) ? statesRaw.empty.filter((x) => typeof x === "string") : [],
    error: Array.isArray(statesRaw.error) ? statesRaw.error.filter((x) => typeof x === "string") : [],
  };

  const sections = sectionsRaw
    .map((s) => (isRecord(s) ? s : null))
    .filter(Boolean)
    .map((s) => {
      const id = typeof s.id === "string" ? s.id : "";
      const pattern =
        s.pattern === "ChatPanel" || s.pattern === "FileTree" || s.pattern === "CodeEditor" || s.pattern === "Preview" || s.pattern === "Console"
          ? (s.pattern as PageSpecSectionPattern)
          : null;
      const props = isRecord(s.props) ? (s.props as Record<string, unknown>) : {};
      const dataBindings = isRecord(s.dataBindings) ? (s.dataBindings as Record<string, unknown>) : {};
      return { id, pattern: pattern ?? "Preview", props, dataBindings };
    });

  const value: PageSpec = {
    route,
    surface,
    layout,
    title,
    primaryAction: { label: paLabel, type: paType, target: paTarget },
    sections,
    states,
  };

  return { ok: true, raw, value };
}

export function stringifyPageSpec(spec: PageSpec) {
  return JSON.stringify(spec, null, 2);
}
