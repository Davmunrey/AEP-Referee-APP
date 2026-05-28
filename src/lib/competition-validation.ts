export interface FieldErrors {
  nombre?: string;
  fecha?: string;
  fechaFin?: string;
  sede?: string;
  sesiones?: string;
  requeridos?: string;
}

export function validateField(field: string, value: string, fechaStart?: string): string | undefined {
  switch (field) {
    case "nombre":
      return value.trim() === "" ? "El nombre es obligatorio" : undefined;
    case "sede":
      return value.trim() === "" ? "La sede es obligatoria" : undefined;
    case "fecha":
      return value === "" ? "La fecha de inicio es obligatoria" : undefined;
    case "fechaFin":
      if (value && fechaStart && value < fechaStart)
        return "La fecha fin no puede ser anterior al inicio";
      return undefined;
    case "sesiones": {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || n < 1 || n > 6) return "Entre 1 y 6 sesiones";
      return undefined;
    }
    case "requeridos": {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || n < 1) return "Mínimo 1 plaza requerida";
      return undefined;
    }
  }
}
