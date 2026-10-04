import { notFound } from "next/navigation";
import { getJudgeSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";

/**
 * Juez de la sesión y sus datos de portal, para las páginas de `/portal`. El
 * layout ya garantiza la sesión; esto la vuelve a pedir (está en caché por
 * petición) para no fiarse de que el layout se ejecute antes que la página.
 */
export async function loadPortal() {
  const judge = await getJudgeSession();
  if (!judge?.refereeId) notFound();
  const data = await dataService.getJudgePortal(judge.refereeId);
  if (!data) notFound();
  return { judge, data };
}
