import { prisma } from "@lessonforge/db";
import type { AgentJobPayload } from "@lessonforge/shared";
import { INVESTMENT_DISCLAIMER_AR } from "@lessonforge/shared";
import { generateText, hasLLM } from "../llm.js";
import { recordUsage } from "../usage.js";
import { renderDocx } from "../materials/render.js";
import { savePack } from "../materials/store.js";
import type { AgentResult } from "./types.js";

/**
 * Produces the Arabic edition of a session's handout: culturally adapted translation
 * (not literal), rendered as an RTL DOCX. Without an API key it emits an RTL document
 * that clearly marks the Arabic edition as pending, rather than mislabeling English text.
 */
export async function runLocalizer(payload: AgentJobPayload): Promise<AgentResult> {
  const sessionId = payload.input?.sessionId as string | undefined;
  if (!sessionId) return { ok: false, summary: "localizer: no sessionId" };
  const session = await prisma.courseSession.findUnique({ where: { id: sessionId }, include: { course: { include: { vertical: true } } } });
  if (!session) return { ok: false, summary: "localizer: session not found" };
  const vertical = session.course.vertical;
  const disclaimer = vertical.slug === "investment" ? INVESTMENT_DISCLAIMER_AR : undefined;
  const source = session.guideMd || session.planMd;

  let arabic: string;
  let inputTokens = 0;
  let outputTokens = 0;
  let titleAr = session.titleAr;

  if (hasLLM()) {
    const res = await generateText(
      {
        system:
          "You are the Localizer. Translate and culturally adapt training material into fluent Modern Standard Arabic. " +
          "Adapt examples and analogies to an Arabic-speaking audience; do not translate literally. Return Arabic Markdown.",
        prompt: `Translate and adapt this session handout into Arabic.\n\nTitle: ${session.titleEn}\n\n${source.slice(0, 6000)}`,
        maxTokens: 4000,
      },
      source
    );
    arabic = res.data;
    inputTokens = res.inputTokens;
    outputTokens = res.outputTokens;
    if (!titleAr) titleAr = `${session.titleEn} (نسخة عربية)`;
    await prisma.courseSession.update({ where: { id: sessionId }, data: { titleAr } });
  } else {
    arabic = "النسخة العربية قيد الإعداد — يتطلب ضبط مفتاح ANTHROPIC_API_KEY لإنتاج ترجمة كاملة ومتكيّفة ثقافياً.";
  }

  const doc = await renderDocx(
    titleAr || `${session.titleEn} — عربي`,
    [{ heading: "الدليل", body: arabic }],
    true,
    disclaimer
  );
  const packId = await savePack({ sessionId, kind: "DOCX", lang: "ar-handout", ext: "docx", data: doc });

  await recordUsage(vertical.id, "localizer", inputTokens, outputTokens);
  await prisma.event.create({ data: { type: "agent.localizer.built", payload: { sessionId, packId, usedLLM: hasLLM() } } });

  return { ok: true, summary: `localizer: Arabic handout for "${session.titleEn}"${hasLLM() ? "" : " [pending — set ANTHROPIC_API_KEY]"}` };
}
