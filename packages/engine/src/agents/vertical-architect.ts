import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { generateJSON } from "../llm.js";
import { recordUsage } from "../usage.js";
import type { AgentResult } from "./types.js";

interface VerticalBlueprint {
  taxonomy: { area: string; topics: string[] }[];
  sourceMap: { name: string; url: string; type: string }[];
  searchQueries: string[];
  courseCatalog: { title: string; audience: string; rationale: string }[];
  briefingTemplate: string;
  glossary: { en: string; ar: string }[];
}

/**
 * Self-builds a vertical from its name + description: taxonomy, key-source map,
 * scout search queries, an initial course catalog (persisted as NEW_TOPIC proposals),
 * a briefing template, and an EN/AR glossary. This is the platform's "self-building" step.
 */
export async function runVerticalArchitect(payload: AgentJobPayload): Promise<AgentResult> {
  const verticalId = payload.verticalId;
  if (!verticalId) return { ok: false, summary: "vertical-architect: no verticalId" };
  const v = await prisma.vertical.findUnique({ where: { id: verticalId } });
  if (!v) return { ok: false, summary: "vertical-architect: vertical not found" };

  const fallback = deterministicBlueprint(v.nameEn, v.description);
  const { data, usedLLM, inputTokens, outputTokens } = await generateJSON<VerticalBlueprint>(
    {
      system:
        "You are the Vertical Architect for an education-intelligence platform. Given a training field, " +
        "design its knowledge structure. Be concrete and domain-accurate.",
      prompt: buildPrompt(v.nameEn, v.description),
      maxTokens: 4000,
    },
    fallback
  );

  await prisma.vertical.update({
    where: { id: verticalId },
    data: {
      taxonomy: data.taxonomy as object,
      sourceMap: data.sourceMap as object,
      glossary: data.glossary as object,
      status: "ACTIVE",
    },
  });

  // Seed the course catalog as review-queue proposals (owner approves before drafting).
  for (const c of data.courseCatalog.slice(0, 8)) {
    await prisma.proposal.create({
      data: {
        verticalId,
        kind: "NEW_TOPIC",
        title: c.title,
        summary: `${c.audience} — ${c.rationale}`,
        significance: 0.6,
        diff: { searchQueries: data.searchQueries, briefingTemplate: data.briefingTemplate } as object,
      },
    });
  }

  await recordUsage(verticalId, "vertical-architect", inputTokens, outputTokens);
  await prisma.event.create({
    data: {
      type: "agent.vertical-architect.built",
      payload: { verticalId, usedLLM, topics: data.taxonomy.length, catalog: data.courseCatalog.length },
    },
  });

  return {
    ok: true,
    summary: `vertical-architect: built ${v.nameEn} (${data.taxonomy.length} areas, ${data.courseCatalog.length} courses)${usedLLM ? "" : " [fallback — set ANTHROPIC_API_KEY for full build]"}`,
  };
}

function buildPrompt(name: string, description: string): string {
  return `Field: ${name}\nDescription: ${description || "(none)"}\n\nProduce JSON with this exact shape:
{
  "taxonomy": [{"area": "string", "topics": ["string", ...]}],
  "sourceMap": [{"name": "string", "url": "string", "type": "site|youtube|feed|report"}],
  "searchQueries": ["string", ...],
  "courseCatalog": [{"title": "string", "audience": "string", "rationale": "string"}],
  "briefingTemplate": "a short markdown skeleton for a weekly briefing in this field",
  "glossary": [{"en": "term", "ar": "Arabic translation"}]
}
Aim for 4-6 taxonomy areas, 6-10 key sources, 8 search queries, 6-8 courses, 12 glossary terms.`;
}

function deterministicBlueprint(name: string, description: string): VerticalBlueprint {
  return {
    taxonomy: [
      { area: `${name} — foundations`, topics: ["Core concepts", "Key terminology", "Landscape overview"] },
      { area: `${name} — practice`, topics: ["Applied techniques", "Case studies", "Common pitfalls"] },
      { area: `${name} — frontier`, topics: ["Recent developments", "Emerging tools", "Open questions"] },
    ],
    sourceMap: [],
    searchQueries: [`${name} latest developments`, `${name} best practices`, `${name} trends this week`],
    courseCatalog: [
      { title: `Introduction to ${name}`, audience: "Beginners", rationale: "Establishes shared vocabulary and mental models." },
      { title: `${name} in practice`, audience: "Practitioners", rationale: "Hands-on application to real scenarios." },
    ],
    briefingTemplate: `## ${name} — weekly briefing\n\n### What moved\n\n### Why it matters\n\n### What to learn next\n`,
    glossary: [],
    ...(description ? {} : {}),
  };
}
