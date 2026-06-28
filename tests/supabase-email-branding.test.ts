import { describe, expect, it } from "vitest";
import {
  buildSupabaseAuthEmailTemplates,
  wrapAepTarimaEmail,
} from "@/lib/auth/supabase-email-branding";

describe("supabase-email-branding", () => {
  it("envuelve el cuerpo con cabecera AEP Tarima", () => {
    const html = wrapAepTarimaEmail("<p>Hola</p>");
    expect(html).toContain("AEP Tarima");
    expect(html).toContain("#c8362a");
    expect(html).toContain("powerhispania@gmail.com");
  });

  it("incluye plantillas de recuperación e invitación en español", () => {
    const templates = buildSupabaseAuthEmailTemplates();
    expect(templates.mailer_subjects_recovery).toContain("AEP Tarima");
    expect(templates.mailer_templates_recovery_content).toContain("{{ .ConfirmationURL }}");
    expect(templates.mailer_templates_recovery_content).toContain("Restablecer contraseña");
    expect(templates.mailer_subjects_invite).toContain("AEP Tarima");
    expect(templates.mailer_templates_invite_content).toContain("Activar mi cuenta");
  });

  it("habilita notificaciones de seguridad", () => {
    const templates = buildSupabaseAuthEmailTemplates();
    expect(templates.mailer_notifications_password_changed_enabled).toBe(true);
    expect(templates.mailer_templates_password_changed_notification_content).toContain(
      "contraseña",
    );
  });
});
