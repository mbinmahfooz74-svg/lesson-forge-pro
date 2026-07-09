/**
 * Diagram specifications — the contract between the LLM Diagram Designer and the
 * deterministic renderers (SVG/PNG for DOCX, native shapes for PPTX, vectors for PDF).
 * Keeping specs semantic (not visual) means one design decision renders consistently
 * across every output format and stays on-brand automatically.
 */
export type DiagramType = "flow" | "cycle" | "pyramid" | "matrix" | "timeline" | "barchart" | "waterfall";

export interface DiagramItem {
  label: string;
  sublabel?: string;
  /** barchart/waterfall: numeric value. waterfall: positive/negative deltas; last item = total. */
  value?: number;
}

export interface DiagramSpec {
  type: DiagramType;
  title: string;
  items: DiagramItem[];
  /** matrix only: axis labels [xLow, xHigh, yLow, yHigh] */
  axes?: [string, string, string, string];
  note?: string;
}

export const MAX_ITEMS: Record<DiagramType, number> = {
  flow: 6, cycle: 6, pyramid: 5, matrix: 4, timeline: 6, barchart: 8, waterfall: 8,
};

/** Clamp/repair an LLM-produced spec so renderers never receive garbage. */
export function sanitizeSpec(raw: unknown): DiagramSpec | null {
  const s = raw as Partial<DiagramSpec>;
  if (!s || typeof s.title !== "string" || !Array.isArray(s.items)) return null;
  const type: DiagramType = (["flow", "cycle", "pyramid", "matrix", "timeline", "barchart", "waterfall"] as const).includes(
    s.type as DiagramType
  )
    ? (s.type as DiagramType)
    : "flow";
  const items = s.items
    .filter((i): i is DiagramItem => Boolean(i && typeof (i as DiagramItem).label === "string"))
    .slice(0, MAX_ITEMS[type])
    .map((i) => ({
      label: String(i.label).slice(0, 48),
      sublabel: i.sublabel ? String(i.sublabel).slice(0, 64) : undefined,
      value: typeof i.value === "number" && Number.isFinite(i.value) ? i.value : undefined,
    }));
  if (items.length < 2) return null;
  if ((type === "barchart" || type === "waterfall") && !items.every((i) => typeof i.value === "number")) return null;
  return {
    type,
    title: s.title.slice(0, 80),
    items,
    axes: Array.isArray(s.axes) && s.axes.length === 4 ? (s.axes.map((a) => String(a).slice(0, 30)) as DiagramSpec["axes"]) : undefined,
    note: s.note ? String(s.note).slice(0, 140) : undefined,
  };
}
