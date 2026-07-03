import "../globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lesson Forge Pro",
  description: "Autonomous education-intelligence platform",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ar" }];
}
