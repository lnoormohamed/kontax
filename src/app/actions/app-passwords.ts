"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  canCreateAppPassword,
  createUserAppPassword,
  listUserAppPasswords,
  revokeUserAppPassword,
} from "~/server/app-passwords";
import { auth } from "~/server/auth";

const createAppPasswordSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(64, "Label must be 64 characters or fewer."),
});

const revokeAppPasswordSchema = z.object({
  appPasswordId: z.string().trim().min(1, "App password id is required."),
});

const getRequiredUserId = async () => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("You must be signed in to manage app passwords.");
  }

  // P21-07: impersonation sessions are read-only.
  if (session?.impersonatedBy) {
    throw new Error("This is a read-only impersonation session — changes are blocked.");
  }

  return userId;
};

export const createAppPassword = async (_previousState: unknown, formData: FormData) => {
  const userId = await getRequiredUserId();
  const parsed = createAppPasswordSchema.safeParse({
    label: formData.get("label"),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid app password label.",
    };
  }

  const allowance = await canCreateAppPassword(userId);

  if (!allowance.allowed) {
    return {
      ok: false as const,
      error:
        allowance.limit == null
          ? "You cannot create another app password right now."
          : `App password limit reached (${allowance.current}/${allowance.limit}).`,
    };
  }

  const created = await createUserAppPassword(userId, parsed.data.label);
  revalidatePath("/settings");

  return {
    ok: true as const,
    appPasswordId: created.id,
    token: created.token,
    formattedToken: created.formattedToken,
  };
};

export const getAppPasswords = async () => {
  const userId = await getRequiredUserId();
  return listUserAppPasswords(userId);
};

export const revokeAppPassword = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const parsed = revokeAppPasswordSchema.safeParse({
    appPasswordId: formData.get("appPasswordId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid app password id.");
  }

  const revoked = await revokeUserAppPassword(userId, parsed.data.appPasswordId);

  if (!revoked) {
    throw new Error("App password not found.");
  }

  revalidatePath("/settings");
};
