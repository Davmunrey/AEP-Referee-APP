import { TARIMA_GUIDE_META } from "@/lib/guides/tarima-user-guide-content";
import { PDF_THEME } from "@/lib/guides/tarima-user-guide-pdf-theme";

/** URL pública de la app (enlaces en correos y Site URL de Supabase Auth). */
export const AEP_TARIMA_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://tarima.powerliftingspain.es";

export const AEP_TARIMA_EMAIL_FROM_NAME = "AEP Tarima";

const THEME = {
  red: PDF_THEME.red,
  redLight: PDF_THEME.redLight,
  text: PDF_THEME.text,
  muted: PDF_THEME.muted,
  border: PDF_THEME.border,
  surface: PDF_THEME.surface,
  white: PDF_THEME.white,
} as const;

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
  <tr>
    <td style="border-radius:10px;background:${THEME.red};">
      <a href="${href}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${THEME.text};">${text}</p>`;
}

/** Envoltorio HTML común para todos los correos transaccionales de Supabase Auth. */
export function wrapAepTarimaEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>AEP Tarima</title>
</head>
<body style="margin:0;padding:0;background:${THEME.surface};font-family:Helvetica,Arial,sans-serif;color:${THEME.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${THEME.surface};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${THEME.white};border:1px solid ${THEME.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:${THEME.red};padding:24px 28px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">AEP Tarima</p>
              <p style="margin:8px 0 0;color:${THEME.redLight};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Gestión de jueces · ${TARIMA_GUIDE_META.association}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">${bodyHtml}</td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;color:${THEME.muted};font-size:12px;line-height:1.55;">
              Mensaje automático de la plataforma interna de arbitraje AEP. Si no esperabas este correo, puedes ignorarlo.
              <br /><br />
              <a href="${AEP_TARIMA_SITE_URL}" style="color:${THEME.red};text-decoration:none;">${AEP_TARIMA_SITE_URL.replace(/^https?:\/\//, "")}</a>
              · Comité de Jueces · <a href="mailto:${TARIMA_GUIDE_META.contactEmail}" style="color:${THEME.red};text-decoration:none;">${TARIMA_GUIDE_META.contactEmail}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface SupabaseAuthEmailTemplates {
  mailer_subjects_confirmation: string;
  mailer_templates_confirmation_content: string;
  mailer_subjects_invite: string;
  mailer_templates_invite_content: string;
  mailer_subjects_magic_link: string;
  mailer_templates_magic_link_content: string;
  mailer_subjects_recovery: string;
  mailer_templates_recovery_content: string;
  mailer_subjects_email_change: string;
  mailer_templates_email_change_content: string;
  mailer_subjects_reauthentication: string;
  mailer_templates_reauthentication_content: string;
  mailer_notifications_password_changed_enabled: boolean;
  mailer_subjects_password_changed_notification: string;
  mailer_templates_password_changed_notification_content: string;
  mailer_notifications_email_changed_enabled: boolean;
  mailer_subjects_email_changed_notification: string;
  mailer_templates_email_changed_notification_content: string;
  mailer_notifications_phone_changed_enabled: boolean;
  mailer_subjects_phone_changed_notification: string;
  mailer_templates_phone_changed_notification_content: string;
  mailer_notifications_mfa_factor_enrolled_enabled: boolean;
  mailer_subjects_mfa_factor_enrolled_notification: string;
  mailer_templates_mfa_factor_enrolled_notification_content: string;
  mailer_notifications_mfa_factor_unenrolled_enabled: boolean;
  mailer_subjects_mfa_factor_unenrolled_notification: string;
  mailer_templates_mfa_factor_unenrolled_notification_content: string;
  mailer_notifications_identity_linked_enabled: boolean;
  mailer_subjects_identity_linked_notification: string;
  mailer_templates_identity_linked_notification_content: string;
  mailer_notifications_identity_unlinked_enabled: boolean;
  mailer_subjects_identity_unlinked_notification: string;
  mailer_templates_identity_unlinked_notification_content: string;
}

/** Plantillas y asuntos con branding AEP Tarima para Supabase Auth (Management API). */
export function buildSupabaseAuthEmailTemplates(): SupabaseAuthEmailTemplates {
  const recoveryBody = [
    paragraph("Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>AEP Tarima</strong>."),
    paragraph("Pulsa el botón para elegir una nueva contraseña. El enlace caduca en breve y solo puede usarse una vez."),
    button("{{ .ConfirmationURL }}", "Restablecer contraseña"),
    paragraph(`Si no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá siendo válida.`),
  ].join("");

  const confirmationBody = [
    paragraph("Gracias por registrarte en <strong>AEP Tarima</strong>, la plataforma de gestión de jueces de la AEP."),
    paragraph("Confirma tu correo para activar el acceso a la plataforma."),
    button("{{ .ConfirmationURL }}", "Confirmar correo"),
  ].join("");

  const inviteBody = [
    paragraph("El Comité de Jueces de la AEP te ha dado acceso a <strong>AEP Tarima</strong>."),
    paragraph("Sigue el enlace para activar tu cuenta y establecer tu contraseña."),
    button("{{ .ConfirmationURL }}", "Activar mi cuenta"),
  ].join("");

  const magicLinkBody = [
    paragraph("Usa este enlace seguro para acceder a <strong>AEP Tarima</strong>."),
    paragraph("Caduca en breve y solo puede usarse una vez."),
    button("{{ .ConfirmationURL }}", "Acceder a AEP Tarima"),
  ].join("");

  const emailChangeBody = [
    paragraph("Has solicitado cambiar el correo de tu cuenta en <strong>AEP Tarima</strong>."),
    paragraph("Confirma la nueva dirección (<strong>{{ .NewEmail }}</strong>) con el botón siguiente."),
    button("{{ .ConfirmationURL }}", "Confirmar nuevo correo"),
    paragraph("Si no fuiste tú, ignora este mensaje."),
  ].join("");

  const reauthBody = [
    paragraph("Para continuar con una acción sensible en <strong>AEP Tarima</strong>, introduce este código de verificación:"),
    `<p style="margin:18px 0;font-size:28px;font-weight:700;letter-spacing:0.2em;color:${THEME.red};">{{ .Token }}</p>`,
    paragraph("El código caduca en breve. Si no lo solicitaste, contacta con el Comité de Jueces."),
  ].join("");

  const passwordChangedBody = [
    paragraph("La contraseña de tu cuenta en <strong>AEP Tarima</strong> se ha cambiado recientemente."),
    paragraph("Si no fuiste tú, restablece tu contraseña de inmediato y avisa al Comité de Jueces."),
    button(`${AEP_TARIMA_SITE_URL}/sign-in`, "Ir al acceso"),
  ].join("");

  const emailChangedBody = [
    paragraph("El correo de tu cuenta en <strong>AEP Tarima</strong> ha cambiado."),
    paragraph("Dirección anterior: <strong>{{ .OldEmail }}</strong><br />Nueva dirección: <strong>{{ .Email }}</strong>"),
    paragraph("Si no reconoces este cambio, contacta con el Comité de Jueces de inmediato."),
  ].join("");

  const phoneChangedBody = [
    paragraph("El número de teléfono asociado a tu cuenta en <strong>AEP Tarima</strong> ha cambiado."),
    paragraph("Anterior: <strong>{{ .OldPhone }}</strong><br />Nuevo: <strong>{{ .Phone }}</strong>"),
    paragraph("Si no fuiste tú, contacta con el Comité de Jueces."),
  ].join("");

  const mfaEnrolledBody = [
    paragraph("Se ha añadido un nuevo método de verificación a tu cuenta de <strong>AEP Tarima</strong>."),
    paragraph("Método: <strong>{{ .FactorType }}</strong>"),
    paragraph("Si no lo autorizaste, contacta con el Comité de Jueces."),
  ].join("");

  const mfaUnenrolledBody = [
    paragraph("Se ha eliminado un método de verificación de tu cuenta de <strong>AEP Tarima</strong>."),
    paragraph("Método: <strong>{{ .FactorType }}</strong>"),
    paragraph("Si no fuiste tú, contacta con el Comité de Jueces."),
  ].join("");

  const identityLinkedBody = [
    paragraph("Se ha vinculado un nuevo método de acceso a tu cuenta de <strong>AEP Tarima</strong>."),
    paragraph("Proveedor: <strong>{{ .Provider }}</strong> · Cuenta: <strong>{{ .Email }}</strong>"),
    paragraph("Si no lo reconoces, contacta con el Comité de Jueces."),
  ].join("");

  const identityUnlinkedBody = [
    paragraph("Se ha eliminado un método de acceso de tu cuenta de <strong>AEP Tarima</strong>."),
    paragraph("Proveedor: <strong>{{ .Provider }}</strong> · Cuenta: <strong>{{ .Email }}</strong>"),
    paragraph("Si no fuiste tú, contacta con el Comité de Jueces."),
  ].join("");

  return {
    mailer_subjects_confirmation: "Confirma tu cuenta · AEP Tarima",
    mailer_templates_confirmation_content: wrapAepTarimaEmail(confirmationBody),

    mailer_subjects_invite: "Acceso a AEP Tarima",
    mailer_templates_invite_content: wrapAepTarimaEmail(inviteBody),

    mailer_subjects_magic_link: "Enlace de acceso · AEP Tarima",
    mailer_templates_magic_link_content: wrapAepTarimaEmail(magicLinkBody),

    mailer_subjects_recovery: "Restablece tu contraseña · AEP Tarima",
    mailer_templates_recovery_content: wrapAepTarimaEmail(recoveryBody),

    mailer_subjects_email_change: "Confirma tu nuevo correo · AEP Tarima",
    mailer_templates_email_change_content: wrapAepTarimaEmail(emailChangeBody),

    mailer_subjects_reauthentication: "{{ .Token }} · código AEP Tarima",
    mailer_templates_reauthentication_content: wrapAepTarimaEmail(reauthBody),

    mailer_notifications_password_changed_enabled: true,
    mailer_subjects_password_changed_notification: "Tu contraseña de AEP Tarima ha cambiado",
    mailer_templates_password_changed_notification_content: wrapAepTarimaEmail(passwordChangedBody),

    mailer_notifications_email_changed_enabled: true,
    mailer_subjects_email_changed_notification: "Tu correo de AEP Tarima ha cambiado",
    mailer_templates_email_changed_notification_content: wrapAepTarimaEmail(emailChangedBody),

    mailer_notifications_phone_changed_enabled: true,
    mailer_subjects_phone_changed_notification: "Tu teléfono de AEP Tarima ha cambiado",
    mailer_templates_phone_changed_notification_content: wrapAepTarimaEmail(phoneChangedBody),

    mailer_notifications_mfa_factor_enrolled_enabled: true,
    mailer_subjects_mfa_factor_enrolled_notification: "Nuevo método de verificación en AEP Tarima",
    mailer_templates_mfa_factor_enrolled_notification_content: wrapAepTarimaEmail(mfaEnrolledBody),

    mailer_notifications_mfa_factor_unenrolled_enabled: true,
    mailer_subjects_mfa_factor_unenrolled_notification: "Método de verificación eliminado · AEP Tarima",
    mailer_templates_mfa_factor_unenrolled_notification_content: wrapAepTarimaEmail(mfaUnenrolledBody),

    mailer_notifications_identity_linked_enabled: true,
    mailer_subjects_identity_linked_notification: "Nuevo método de acceso vinculado · AEP Tarima",
    mailer_templates_identity_linked_notification_content: wrapAepTarimaEmail(identityLinkedBody),

    mailer_notifications_identity_unlinked_enabled: true,
    mailer_subjects_identity_unlinked_notification: "Método de acceso eliminado · AEP Tarima",
    mailer_templates_identity_unlinked_notification_content: wrapAepTarimaEmail(identityUnlinkedBody),
  };
}

/** Ajustes de URL que acompañan a las plantillas (Management API). */
export function buildSupabaseAuthBrandingConfig() {
  const config: {
    site_url: string;
    mailer_autoconfirm: boolean;
    smtp_sender_name?: string;
  } = {
    site_url: AEP_TARIMA_SITE_URL,
    mailer_autoconfirm: false,
  };

  // smtp_sender_name solo es aceptado si el proyecto tiene SMTP custom configurado.
  const hasCustomSmtp =
    Boolean(process.env.SMTP_HOST) &&
    Boolean(process.env.SMTP_USER) &&
    Boolean(process.env.SMTP_PASS);
  if (hasCustomSmtp) {
    config.smtp_sender_name = AEP_TARIMA_EMAIL_FROM_NAME;
  }

  return config;
}
