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
      subtitle: "T2 2026",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Dashboard" }],
    };
  }
  if (pathname === "/referees") {
    return {
      title: "Directorio de Jueces",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Directorio" }],
    };
  }
  if (pathname === "/events") {
    return {
      title: "Campeonatos",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Campeonatos" }],
    };
  }
  if (pathname.startsWith("/events/")) {
    const id = pathname.split("/")[2];
    return {
      title: "Constructor de Tarima",
      crumbs: [
        { label: "AEP Tarima", href: "/" },
        { label: "Campeonatos", href: "/events" },
        { label: id ?? "Evento" },
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
      title: "Sandbox de informes",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Informes" }],
    };
  }
  if (pathname === "/regulations") {
    return {
      title: "Normativa IPF",
      crumbs: [{ label: "AEP Tarima", href: "/" }, { label: "Normativa IPF" }],
    };
  }
  return {
    title: "AEP Tarima",
    crumbs: [{ label: "AEP Tarima", href: "/" }],
  };
}
