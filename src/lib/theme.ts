/**
 * Tema claro / oscuro.
 *
 * La preferencia («sistema», «claro» u «oscuro») se guarda en el navegador y se
 * resuelve a `data-theme="light" | "dark"` en <html>. El script de arranque lo
 * hace antes del primer pintado (sin destello de tema equivocado) y sigue los
 * cambios del sistema mientras la preferencia sea «sistema».
 */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "aep-tarima:theme";

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return systemDark ? "dark" : "light";
}

/** Se inyecta tal cual en <head>: nada de imports, solo el navegador. */
export const themeBootScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var d=document.documentElement;var m=window.matchMedia("(prefers-color-scheme: dark)");var apply=function(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var t=p==="light"||p==="dark"?p:(m.matches?"dark":"light");d.setAttribute("data-theme",t)};apply();if(m.addEventListener){m.addEventListener("change",apply)}window.__aepApplyTheme=apply}catch(e){}})();`;

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Sin almacenamiento (modo privado estricto): se aplica solo en esta visita.
  }
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", resolveTheme(pref, systemDark));
}
