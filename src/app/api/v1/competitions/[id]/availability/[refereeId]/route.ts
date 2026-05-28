import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; refereeId: string }> },
) {
  const user = await getSession();
  if (!user || user.role === "solo_ver") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, refereeId } = await params;
  try {
    await dataService.removeCompetitionAvailability(id, refereeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
