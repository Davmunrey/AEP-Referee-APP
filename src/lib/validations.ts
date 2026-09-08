import { z } from "zod";
import { duplicateRoleKeys } from "@/lib/roster-template";

export const assignRefereeSchema = z.object({
  competitionId: z.string().min(1),
  slotKey: z.string().min(1),
  refereeId: z.string().min(1),
  /**
   * Juez que el cliente creía tener en el hueco (null = vacío). Control de
   * concurrencia optimista: si la realidad no coincide, otro usuario tocó ese
   * hueco entretanto y la asignación se rechaza en vez de pisarla en silencio.
   * Ausente = sin comprobación, para no romper clientes que no lo envían.
   */
  expectedRefereeId: z.string().min(1).nullable().optional(),
  flags: z
    .object({
      compartido: z.boolean().optional(),
      intercambio: z.boolean().optional(),
    })
    .optional(),
  crossZoneReason: z.string().max(500).optional(),
});

export const clearSlotSchema = z.object({
  competitionId: z.string().min(1),
  slotKey: z.string().min(1),
  /** Mismo control optimista que en la asignación (ver `assignRefereeSchema`). */
  expectedRefereeId: z.string().min(1).nullable().optional(),
});

const rosterRoleSchema = z.object({
  rol: z.string().min(1),
  slots: z.number().int().min(1).max(8),
  key: z.enum([
    "central",
    "lateral",
    "ordenador",
    "speaker",
    "control",
    "jurado",
    "pesaje",
    "equipamiento",
    "material",
    "mesa",
    "liftingcast",
  ]),
});

const rosterCategoriaSchema = z.object({
  genero: z.enum(["Hombres", "Mujeres"]),
  pesos: z.string().min(1),
});

const rosterGrupoSchema = z.object({
  nombre: z.string().min(1),
  categorias: z.array(rosterCategoriaSchema).min(1),
  levantadores: z.number().int().min(0).optional(),
});

/**
 * Dentro de una sesión cada rol va en UNA fila con su número de plazas.
 *
 * La clave de cada hueco es `${sesion}_${rol}_${indice}`, así que dos filas
 * «Juez Central» en la misma sesión —o un rol repetido entre el bloque de
 * competición y el de pesaje— generan claves idénticas: la segunda fila no
 * añade huecos asignables, pero sí sumaba plazas requeridas. Con la tarima
 * entera cubierta quedaba un hueco libre imposible de ocupar y el campeonato
 * no llegaba nunca a «Completo».
 */
export const rosterSessionSchema = z
  .object({
    sesion: z.string().min(1),
    nombre: z.string().min(1),
    dia: z.string().min(1),
    categorias: z.array(rosterCategoriaSchema),
    horarioCompeticion: z.string(),
    horarioPesaje: z.string(),
    roles: z.array(rosterRoleSchema).min(1),
    pesajeRoles: z.array(rosterRoleSchema),
    grupos: z.array(rosterGrupoSchema).optional(),
  })
  .refine(
    (session) => duplicateRoleKeys(session).length === 0,
    {
      message:
        "Una sesión repite un rol; usa una sola fila por rol con el número de plazas.",
    },
  );

/**
 * Los códigos de sesión tienen que ser únicos: la clave de cada hueco es
 * `${sesion}_${rol}_${indice}`, así que dos sesiones con el mismo código
 * generan claves idénticas. El juez asignado a una aparecía también en la otra
 * y la cobertura contaba los huecos dos veces pero las asignaciones una, de
 * modo que la tarima no llegaba nunca al 100 %.
 */
export const rosterTemplateSchema = z
  .array(rosterSessionSchema)
  .min(1)
  .refine(
    (sessions) => {
      const codes = sessions.map((s) => s.sesion.trim().toLowerCase());
      return new Set(codes).size === codes.length;
    },
    { message: "Hay dos sesiones con el mismo código; cada sesión necesita uno distinto." },
  );

export type AssignRefereeInput = z.infer<typeof assignRefereeSchema>;
export type ClearSlotInput = z.infer<typeof clearSlotSchema>;
