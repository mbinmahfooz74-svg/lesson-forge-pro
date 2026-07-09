import { generateJSON } from "../../llm.js";
import { sanitizeSpec, type DiagramSpec } from "./spec.js";

/**
 * The Diagram Designer: reads a lesson's content and decides which infographics
 * belong in it — process flows, cycles, pyramids, matrices, timelines, and data
 * charts built from the lesson's own numbers. Output is semantic specs; the
 * renderers guarantee brand-consistent visuals in every format.
 */
export async function designDiagrams(
  sessionTitle: string,
  content: string,
  count = 3
): Promise<{ specs: DiagramSpec[]; usedLLM: boolean; inputTokens: number; outputTokens: number }> {
  const fallback = { diagrams: fallbackSpecs(sessionTitle) };
  const res = await generateJSON<{ diagrams: unknown[] }>(
    {
      system:
        "You are an information designer for professional training material. Given lesson content, design the " +
        `${count} most instructive diagrams. Prefer PROCESS FLOWS for procedures, CYCLE for loops, PYRAMID for ` +
        "hierarchies of importance, MATRIX for 2x2 trade-offs, TIMELINE for sequences over time, BARCHART/WATERFALL " +
        "when the lesson contains real numbers worth visualizing (use the lesson's actual numbers). Labels must be " +
        "short (<=6 words); sublabels explain in <=10 words.",
      prompt: `Lesson: ${sessionTitle}\n\nContent:\n${content.slice(0, 7000)}\n\nReturn JSON:
{"diagrams":[{"type":"flow|cycle|pyramid|matrix|timeline|barchart|waterfall","title":"...","items":[{"label":"...","sublabel":"...","value":123}],"axes":["xLow","xHigh","yLow","yHigh"],"note":"one-line caption"}]}
Rules: ${count} diagrams, 3-6 items each, values REQUIRED for barchart/waterfall (numbers only), axes ONLY for matrix.`,
      maxTokens: 1800,
      temperature: 0.3,
    },
    fallback
  );
  const specs = (res.data.diagrams ?? [])
    .map(sanitizeSpec)
    .filter((s): s is DiagramSpec => s !== null)
    .slice(0, count + 1);
  return {
    specs: specs.length ? specs : fallbackSpecs(sessionTitle),
    usedLLM: res.usedLLM,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
  };
}

function fallbackSpecs(title: string): DiagramSpec[] {
  return [
    {
      type: "flow",
      title: `${title} — core workflow`,
      items: [
        { label: "Understand", sublabel: "concepts and vocabulary" },
        { label: "Observe", sublabel: "worked example" },
        { label: "Practice", sublabel: "guided exercise" },
        { label: "Apply", sublabel: "independent task" },
      ],
      note: "Learning path for this session.",
    },
  ];
}
