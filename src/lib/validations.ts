import { z } from "zod";

export const assignRefereeSchema = z.object({
  eventId: z.string().min(1),
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
  eventId: z.string().min(1),
  slotKey: z.string().min(1),
});

export type AssignRefereeInput = z.infer<typeof assignRefereeSchema>;
export type ClearSlotInput = z.infer<typeof clearSlotSchema>;
