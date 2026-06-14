import { z } from "zod";

const EmailEntrySchema = z.object({
  value: z.string().email().max(254),
  label: z.string().max(50).optional(),
});

const PhoneEntrySchema = z.object({
  value: z.string().min(1).max(50),
  label: z.string().max(50).optional(),
});

export const ContactCreateSchema = z.object({
  firstName: z.string().trim().max(80).nullish(),
  lastName: z.string().trim().max(80).nullish(),
  fullName: z.string().trim().max(200).nullish(),
  company: z.string().trim().max(120).nullish(),
  jobTitle: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(10_000).nullish(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$|^--\d{2}-\d{2}$/, "Birthday must be YYYY-MM-DD or --MM-DD")
    .nullish(),
  emails: z.array(EmailEntrySchema).max(10).optional(),
  phones: z.array(PhoneEntrySchema).max(10).optional(),
  bookId: z.string().cuid().nullish(),
});

export const ContactUpdateSchema = ContactCreateSchema.partial();

export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;
