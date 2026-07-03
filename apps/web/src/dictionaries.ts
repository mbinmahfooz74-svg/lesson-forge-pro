export type Locale = "en" | "ar";

const en = {
  appName: "Lesson Forge Pro",
  tagline: "Autonomous education intelligence",
  nav: {
    briefing: "Command briefing",
    verticals: "Verticals",
    sources: "Source pipeline",
    review: "Review queue",
    settings: "Settings",
    signOut: "Sign out",
  },
  login: {
    title: "Sign in to the Ops Studio",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    error: "Invalid email or password.",
  },
  home: {
    welcome: "Welcome back",
    stage: "Stage A — owner mode (subscriber and B2B flags off)",
    verticals: "Verticals",
    pendingProposals: "Pending proposals",
    recentEvents: "Recent engine events",
    noEvents: "No engine events yet — the worker writes here once jobs run.",
  },
  verticals: {
    title: "Verticals",
    premium: "Premium",
    autonomy: { REVIEW_FIRST: "Review first", FULL_AUTO: "Full auto" },
    status: { DRAFT: "Draft", ACTIVE: "Active", PAUSED: "Paused" },
  },
  sources: {
    title: "Source pipeline",
    empty: "No sources yet. Ingestion arrives in Sprint 1 — you will drop any URL here.",
  },
  review: {
    title: "Review queue",
    empty: "No proposals yet. The Market Scout starts filing proposals in Sprint 5.",
  },
  settings: {
    title: "Settings",
    flags: "Feature flags",
    on: "On",
    off: "Off",
  },
} as const;

const ar: typeof en = {
  appName: "ليسون فورج برو",
  tagline: "ذكاء تعليمي مستقل",
  nav: {
    briefing: "الملخص الرئيسي",
    verticals: "المجالات",
    sources: "خط المصادر",
    review: "قائمة المراجعة",
    settings: "الإعدادات",
    signOut: "تسجيل الخروج",
  },
  login: {
    title: "تسجيل الدخول إلى استوديو العمليات",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submit: "تسجيل الدخول",
    error: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  },
  home: {
    welcome: "مرحباً بعودتك",
    stage: "المرحلة أ — وضع المالك (ميزات المشتركين والشركات معطّلة)",
    verticals: "المجالات",
    pendingProposals: "مقترحات قيد الانتظار",
    recentEvents: "أحدث أحداث المحرك",
    noEvents: "لا توجد أحداث بعد — يكتب المشغّل هنا عند تنفيذ المهام.",
  },
  verticals: {
    title: "المجالات",
    premium: "مميز",
    autonomy: { REVIEW_FIRST: "مراجعة أولاً", FULL_AUTO: "تلقائي كامل" },
    status: { DRAFT: "مسودة", ACTIVE: "نشط", PAUSED: "متوقف" },
  },
  sources: {
    title: "خط المصادر",
    empty: "لا توجد مصادر بعد. يصل الاستيعاب في السبرنت الأول — ستضع أي رابط هنا.",
  },
  review: {
    title: "قائمة المراجعة",
    empty: "لا توجد مقترحات بعد. يبدأ كشّاف السوق بتقديم المقترحات في السبرنت الخامس.",
  },
  settings: {
    title: "الإعدادات",
    flags: "مفاتيح الميزات",
    on: "مفعّل",
    off: "معطّل",
  },
};

const dictionaries = { en, ar };

export function getDictionary(locale: string) {
  return dictionaries[(locale === "ar" ? "ar" : "en") as Locale];
}
