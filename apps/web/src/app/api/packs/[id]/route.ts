import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@lessonforge/db";
import { auth } from "@/auth";

const MIME: Record<string, string> = {
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const pack = await prisma.materialPack.findUnique({ where: { id } });
  if (!pack) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const data = await fs.readFile(pack.storagePath);
    const ext = path.extname(pack.storagePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(pack.storagePath)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "file missing on disk" }, { status: 410 });
  }
}
