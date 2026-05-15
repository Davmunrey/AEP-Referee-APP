import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = start === end;
  if (sameDay) {
    return s.toLocaleDateString("es-ES", opts);
  }
  return `${s.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("es-ES", opts)}`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
