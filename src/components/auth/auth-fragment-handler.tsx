"use client";

import { useEffect } from "react";

/**
 * Completa el acceso cuando se llega desde un enlace de correo de Supabase
 * enviado por el servidor (invitación de juez o enlace de acceso).
 *
 * Esos enlaces no pasan por `/auth/callback`: no los inició el navegador, así
 * que no hay `code` PKCE que canjear, y Supabase devuelve la sesión en el
 * fragmento de la URL (`#access_token=…&refresh_token=…`), que el servidor no
 * ve. Va en el layout raíz porque, si la dirección de vuelta no está en la
 * lista permitida del proyecto, Supabase cae a la raíz del sitio y el
 * middleware lo manda a `/sign-in`; el fragmento viaja con la redirección y
 * aquí se recoge en cualquiera de las dos.
 */
export function AuthFragmentHandler() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    if (params.get("error_code") || params.get("error")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      window.location.replace("/sign-in?error=enlace-invalido");
      return;
    }
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return;
    // Fuera de la barra de direcciones cuanto antes: es una credencial.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    // Solo los enlaces que envía la aplicación (invitación o acceso). Sin este
    // filtro, cualquiera podía mandar un enlace con los tokens de SU cuenta y
    // dejar a quien lo abriera trabajando, sin saberlo, dentro de ella.
    const tipo = params.get("type");
    if (tipo !== "invite" && tipo !== "magiclink") return;
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // Y nunca sustituye una sesión abierta: quien ya ha entrado sigue con
      // la suya.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.replace("/");
        return;
      }
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      // Navegación completa: el servidor tiene que ver ya la cookie de sesión.
      window.location.replace(error ? "/sign-in?error=sesion-fallida" : "/");
    })();
  }, []);
  return null;
}
