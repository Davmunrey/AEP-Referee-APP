import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const confirmedIds = await dataService.getCompetitionAvailability(id);
  return NextResponse.json({ confirmedIds });
}

const bodySchema = z.object({ refereeId: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role === "solo_ver") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  try {
    await dataService.addCompetitionAvailability(id, body.data.refereeId, user.nombre);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
