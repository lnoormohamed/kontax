import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const contactRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          search: z.string().trim().min(1).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search;

      return ctx.db.contact.findMany({
        where: search
          ? {
              OR: [
                {
                  fullName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  company: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  email: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : undefined,
        orderBy: {
          fullName: "asc",
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        fullName: z.string().trim().min(1, "Full name is required"),
        email: z.string().trim().email().optional().or(z.literal("")),
        phone: z.string().trim().min(1).optional(),
        company: z.string().trim().optional(),
        notes: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contact.create({
        data: {
          fullName: input.fullName,
          email: input.email === "" ? null : input.email,
          phone: input.phone,
          company: input.company,
          notes: input.notes,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        fullName: z.string().trim().min(1).optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        phone: z.string().trim().optional(),
        company: z.string().trim().optional(),
        notes: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...contact } = input;

      return ctx.db.contact.update({
        where: { id },
        data: {
          ...contact,
          email: input.email === "" ? null : input.email,
        },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contact.delete({
        where: {
          id: input.id,
        },
      });
    }),
});
