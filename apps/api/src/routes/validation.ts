import { z } from "zod";

// Validation lives at the API boundary (not just TS types, which vanish at
// runtime) — a client is untrusted input no matter what packages/shared
// says its shape should be.

const isoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());

// A safe, narrow color format: hex or a design-token CSS variable
// reference. Rejects anything that could carry a CSS/HTML injection payload
// if a future screen ever interpolates it unescaped into a style attribute.
const cssColor = z
  .string()
  .regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|var\(--[a-zA-Z0-9-]+\))$/, "must be a hex color or var(--token)");

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: cssColor,
});
export const updateListSchema = createListSchema.partial();

export const createEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  start: isoDateTime,
  end: isoDateTime.nullable().optional(),
  allDay: z.boolean().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  recurrenceRule: z.string().trim().max(200).nullable().optional(),
});
export const updateEventSchema = createEventSchema.partial();

const reminderInputSchema = z
  .object({
    kind: z.enum(["before_due", "absolute"]),
    minutesBefore: z.number().int().min(0).max(60 * 24 * 90).nullable().optional(),
    at: isoDateTime.nullable().optional(),
  })
  .refine((r) => (r.kind === "before_due" ? r.minutesBefore != null : r.at != null), {
    message: "before_due reminders need minutesBefore; absolute reminders need at",
  });

export const createTaskSchema = z.object({
  eventId: z.string().uuid().nullable().optional(),
  listId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(300),
  priority: z.enum(["low", "normal", "high"]).optional(),
  dueAt: isoDateTime.nullable().optional(),
  order: z.number().int().optional(),
  recurrenceRule: z.string().trim().max(200).nullable().optional(),
  reminders: z.array(reminderInputSchema).max(20).optional(),
});
export const updateTaskSchema = createTaskSchema
  .omit({ reminders: true })
  .partial()
  .extend({
    done: z.boolean().optional(),
    reminders: z.array(reminderInputSchema).max(20).optional(),
  });
