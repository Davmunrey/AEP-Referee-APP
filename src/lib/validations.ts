import { z } from "zod";

export const assignRefereeSchema = z.object({
  competitionId: z.string().min(1),
  slotKey: z.string().min(1),
  refereeId: z.string().min(1),
  flags: z
    .object({
      compartido: z.boolean().optional(),
      intercambio: z.boolean().optional(),
    })
    .optional(),
});

export const clearSlotSchema = z.object({
  competitionId: z.string().min(1),
  slotKey: z.string().min(1),
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

export const rosterSessionSchema = z.object({
  sesion: z.string().min(1),
  nombre: z.string().min(1),
  dia: z.string().min(1),
  categorias: z.array(rosterCategoriaSchema),
  horarioCompeticion: z.string(),
  horarioPesaje: z.string(),
  roles: z.array(rosterRoleSchema).min(1),
  pesajeRoles: z.array(rosterRoleSchema),
  grupos: z.array(rosterGrupoSchema).optional(),
});

export const rosterTemplateSchema = z.array(rosterSessionSchema).min(1);

export type AssignRefereeInput = z.infer<typeof assignRefereeSchema>;
export type ClearSlotInput = z.infer<typeof clearSlotSchema>;
