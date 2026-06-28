/**
 * Escribe plantillas HTML en supabase/templates/ para revisión o copia manual al dashboard.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSupabaseAuthEmailTemplates } from "../src/lib/auth/supabase-email-branding";

const outDir = join(process.cwd(), "supabase", "templates");
mkdirSync(outDir, { recursive: true });

const templates = buildSupabaseAuthEmailTemplates();
const entries: Array<[string, string, string]> = [
  ["confirmation", templates.mailer_subjects_confirmation, templates.mailer_templates_confirmation_content],
  ["invite", templates.mailer_subjects_invite, templates.mailer_templates_invite_content],
  ["magic_link", templates.mailer_subjects_magic_link, templates.mailer_templates_magic_link_content],
  ["recovery", templates.mailer_subjects_recovery, templates.mailer_templates_recovery_content],
  ["email_change", templates.mailer_subjects_email_change, templates.mailer_templates_email_change_content],
  ["reauthentication", templates.mailer_subjects_reauthentication, templates.mailer_templates_reauthentication_content],
  [
    "password_changed_notification",
    templates.mailer_subjects_password_changed_notification,
    templates.mailer_templates_password_changed_notification_content,
  ],
  [
    "email_changed_notification",
    templates.mailer_subjects_email_changed_notification,
    templates.mailer_templates_email_changed_notification_content,
  ],
];

for (const [name, subject, html] of entries) {
  writeFileSync(join(outDir, `${name}.subject.txt`), `${subject}\n`, "utf8");
  writeFileSync(join(outDir, `${name}.html`), html, "utf8");
}

console.log(`Exportadas ${entries.length} plantillas en ${outDir}`);
