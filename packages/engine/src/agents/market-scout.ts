import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { generateJSON } from "../llm.js";
import { recordUsage } from "../usage.js";
import { webSearch, hasSearch, type SearchHit } from "../search.js";
import type { AgentResult } from "./types.js";

interface Classified {
  findings: { title: string; kind: "NEW_TOPIC" | "CONTENT_UPDATE" | "NOISE"; significance: number; why: string; url?: string }[];
}

/**
 * Scans a vertical's field: runs the vertical's search queries, then classifies each hit
 * as a new topic, an update to existing material, or noise (with a significance score).
 * Significant findings become PENDING proposals in the review queue. Runs weekly per vertical.
 */
export async function runMarketScout(payload: AgentJobPayload): Promise<AgentResult> {
  const verticalId = payload.verticalId;
  if (!verticalId) return { ok: false, summary: "market-scout: no verticalId" };
  const v = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!v) return { ok: false, summary: "market-scout: vertical not found" };

  const searchQueries =
    (v.taxonomy as unknown as { searchQueries?: string[] } | null)?.searchQueries ??
    [`${v.nameEn} latest developments`, `${v.nameEn} news this week`, `${v.nameEn} new tools`];

  const hits: SearchHit[] = [];
  for (const q of searchQueries.slice(0, 4)) {
    hits.push(...(await webSearch(q, 5)));
  }

  if (hits.length === 0) {
    await prisma.event.create({ data: { type: "agent.market-scout.ran", payload: { verticalId, hits: 0, note: hasSearch() ? "no results" : "no search key configured" } } });
    return { ok: true, summary: `market-scout: no findings for ${v.nameEn}${hasSearch() ? "" : " [set TAVILY_API_KEY/BRAVE_API_KEY to scan the field]"}` };
  }

  const fallback: Classified = { findings: hits.map((h) => ({ title: h.title, kind: "NEW_TOPIC", significance: 0.5, why: h.snippet.slice(0, 120), url: h.url })) };
  const { data, usedLLM, inputTokens, outputTokens } = await generateJSON<Classified>(
    {
      system:
        "You are the Market Intelligence Scout. Classify each search hit for this field as NEW_TOPIC (worth a new lesson), " +
        "CONTENT_UPDATE (updates existing material), or NOISE. Give a significance score 0-1. Be selective.",
      prompt: `Field: ${v.nameEn}\n\nHits:\n${hits.map((h, i) => `${i + 1}. ${h.title} — ${h.snippet.slice(0, 200)} (${h.url})`).join("\n")}\n\nReturn JSON: {"findings":[{"title":"...","kind":"NEW_TOPIC","significance":0.7,"why":"...","url":"..."}]}`,
      maxTokens: 2000,
    },
    fallback
  );

  let created = 0;
  for (const f of data.findings) {
    if (f.kind === "NOISE" || f.significance < 0.4) continue;
    await prisma.proposal.create({
      data: {
        verticalId,
        kind: f.kind === "CONTENT_UPDATE" ? "CONTENT_UPDATE" : "NEW_TOPIC",
        title: f.title,
        summary: f.why,
        significance: f.significance,
        diff: f.url ? ({ url: f.url } as object) : undefined,
      },
    });
    created++;
  }

  await recordUsage(verticalId, "market-scout", inputTokens, outputTokens);
  await prisma.event.create({ data: { type: "agent.market-scout.ran", payload: { verticalId, hits: hits.length, proposals: created, usedLLM } } });
  return { ok: true, summary: `market-scout: ${v.nameEn} — ${hits.length} hits, ${created} proposals${usedLLM ? "" : " [fallback]"}` };
}
