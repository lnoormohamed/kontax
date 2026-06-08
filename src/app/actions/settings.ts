"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

const getRequiredUserId = async () => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("You must be signed in to update settings.");
  }

  return userId;
};

export const updatePhoneticSettings = async (formData: FormData) => {
  const userId = await getRequiredUserId();
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
  revalidatePath("/");
};
