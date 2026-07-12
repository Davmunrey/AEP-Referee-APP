import { operationalQuarterLabel } from "@/lib/season";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageMeta {
  title: string;
  subtitle?: string;
  crumbs: BreadcrumbItem[];
}

export function getPageMeta(pathname: string): PageMeta {
  if (pathname === "/") {
    return {
      title: "Dashboard Nacional",
      subtitle: operationalQuarterLabel(),
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Dashboard" }],
    };
  }
  if (pathname === "/referees") {
    return {
      title: "Directorio de Jueces",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Directorio" }],
    };
  }
  if (pathname === "/competitions") {
    return {
      title: "Campeonatos",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Campeonatos" }],
    };
  }
  if (pathname === "/compensation") {
    return {
      title: "Compensación de jueces",
      subtitle: "Panel central de facturación y recibos",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Compensación" }],
    };
  }
  if (pathname === "/docs") {
    return {
      title: "Documentación",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Documentación" }],
    };
  }
  if (pathname.startsWith("/competitions/") && pathname.endsWith("/compensation")) {
    const id = pathname.split("/")[2];
    return {
      title: "Compensación del campeonato",
      crumbs: [
        { label: "AEP Tarima", href: "/" },
        { label: "Compensación", href: "/compensation" },
        { label: id ?? "Campeonato" },
      ],
    };
  }
  if (pathname.startsWith("/competitions/") && pathname !== "/competitions/new") {
    const id = pathname.split("/")[2];
    return {
      title: "Constructor de Tarima",
      crumbs: [
        { label: "AEP Tarima", href: "/" },
        { label: "Campeonatos", href: "/competitions" },
        { label: id ?? "Campeonato" },
      ],
    };
  }
  if (pathname === "/approvals") {
    return {
      title: "Aprobaciones",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Aprobaciones" }],
    };
  }
  if (pathname === "/promotions") {
    return {
      title: "Ascensos",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Ascensos" }],
    };
  }
  if (pathname === "/analytics") {
    return {
      title: "Estadísticas",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Estadísticas" }],
    };
  }
  if (pathname === "/exams") {
    return {
      title: "Exámenes de jueces",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Exámenes" }],
    };
  }
  if (pathname === "/reports") {
    return {
      title: "Informes",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Informes" }],
    };
  }
  if (pathname === "/regulations") {
    return {
      title: "Normativa",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Normativa" }],
    };
  }
  if (pathname === "/competitions/new") {
    return {
      title: "Nuevo campeonato",
      crumbs: [
        { label: "AEP Tarima", href: "/" },
        { label: "Campeonatos", href: "/competitions" },
        { label: "Nuevo" },
      ],
    };
  }
  if (pathname.startsWith("/referees/") && pathname !== "/referees") {
    return {
      title: "Ficha de juez",
      crumbs: [
        { label: "AEP Tarima", href: "/" },
        { label: "Directorio", href: "/referees" },
        { label: "Ficha" },
      ],
    };
  }
  if (pathname === "/admin/users") {
    return {
      title: "Usuarios",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Usuarios" }],
    };
  }
  return {
    title: "AEP Tarima",
    crumbs: [{ label: "AEP Tarima", href: "/" }],
  };
}
