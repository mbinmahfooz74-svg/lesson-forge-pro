import { prisma } from "@lessonforge/db";
import { getDictionary } from "@/dictionaries";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getDictionary(locale);
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
      <h2 className="mt-6 text-lg font-medium">{t.settings.flags}</h2>
      <div className="mt-3 rounded-xl border border-stone-200 bg-white">
        <ul className="divide-y divide-stone-100">
          {flags.map((f) => (
            <li key={f.key} className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="font-mono">{f.key}</div>
                <div className="text-xs text-stone-500">{f.description}</div>
              </div>
              <span
                className={
                  "rounded-full px-3 py-1 text-xs font-medium " +
                  (f.enabled ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-500")
                }
              >
                {f.enabled ? t.settings.on : t.settings.off}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
