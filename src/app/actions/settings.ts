"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "~/server/auth/require-session";
import { db } from "~/server/db";

export const updatePhoneticSettings = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const autoFillPhoneticNames = formData.get("autoFillPhoneticNames") === "true";

  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      autoFillPhoneticNames,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/contacts");
};
