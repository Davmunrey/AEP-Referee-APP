/**
 * Aplica plantillas de correo y branding de AEP Tarima en Supabase Auth (proyecto remoto).
 *
 * Requiere un Personal Access Token de Supabase:
 *   https://supabase.com/dashboard/account/tokens
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_... npx tsx scripts/apply-supabase-auth-branding.ts
 *
 * Variables opcionales:
 *   SUPABASE_PROJECT_REF (default: foaemadggmpbcrhtpems)
 *   NEXT_PUBLIC_APP_URL (Site URL en plantillas y auth)
 */
import {
  AEP_TARIMA_SITE_URL,
  buildSupabaseAuthBrandingConfig,
  buildSupabaseAuthEmailTemplates,
} from "../src/lib/auth/supabase-email-branding";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "foaemadggmpbcrhtpems";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function main() {
  if (!ACCESS_TOKEN) {
    console.error("Falta SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)");
    process.exit(1);
  }

  const payload = {
    ...buildSupabaseAuthBrandingConfig(),
    ...buildSupabaseAuthEmailTemplates(),
  };

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Error ${res.status} al actualizar Auth config:\n${text}`);
    process.exit(1);
  }

  console.log(`Branding de correos aplicado en ${PROJECT_REF}`);
  console.log(`Site URL: ${AEP_TARIMA_SITE_URL}`);
  console.log("Plantillas: confirmación, invitación, magic link, recuperación, cambio de correo, reauth y avisos de seguridad.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
