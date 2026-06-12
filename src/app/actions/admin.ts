"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin, AdminForbiddenError } from "~/server/admin/guard";
import { ADMIN_ACTIONS, emitAdminEvent } from "~/server/admin/audit";
import { setImpersonation, clearImpersonation, readImpersonation } from "~/server/admin/impersonation";
import { db } from "~/server/db";
import { sendAccountSuspendedEmail } from "~/server/billing-emails";
import { broadcastProductUpdate as broadcastProductUpdateToUsers } from "~/server/notifications";
import type { SubscriptionPlan } from "../../../generated/prisma";

type Result = { success: true } | { error: string };

const PLANS: SubscriptionPlan[] = ["FREE", "PRO", "FAMILY", "TEAMS"];

async function loadTarget(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, lifecycleState: true, scheduledDeleteAt: true },
  });
}

// ─── P21-04: Plan override (local only, never touches Stripe) ──────────────────

export async function overridePlan(input: {
  userId: string;
  plan: string;
  reason: string;
}): Promise<Result> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const reason = input.reason.trim();
  if (!reason) return { error: "REASON_REQUIRED" };
  const plan = input.plan.toUpperCase() as SubscriptionPlan;
  if (!PLANS.includes(plan)) return { error: "INVALID_PLAN" };

  const target = await loadTarget(input.userId);
  if (!target) return { error: "USER_NOT_FOUND" };

  // Ensure a billing customer exists, then upsert a local override subscription.
  const customer = await db.subscriptionCustomer.upsert({
    where: { userId: target.id },
    update: {},
    create: {
      userId: target.id,
      provider: "STRIPE",
      providerCustomerId: `admin-override-${target.id}`,
    },
    select: { id: true },
  });

  const providerSubscriptionId = `admin-override-${target.id}`;
  await db.subscription.upsert({
    where: { provider_providerSubscriptionId: { provider: "STRIPE", providerSubscriptionId } },
    update: { plan, status: "ACTIVE" },
    create: {
      userId: target.id,
      subscriptionCustomerId: customer.id,
      provider: "STRIPE",
      providerSubscriptionId,
      plan,
      status: "ACTIVE",
    },
  });

  await db.user.update({
    where: { id: target.id },
    data: { planOverriddenAt: new Date(), planOverrideReason: reason },
  });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.USER_PLAN_OVERRIDE,
    targetUserId: target.id,
    targetEmail: target.email,
    details: { to: plan, reason },
  });

  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

// ─── P21-05: Suspend / unsuspend / schedule deletion ──────────────────────────

export async function suspendAccount(input: { userId: string; reason: string }): Promise<Result> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const reason = input.reason.trim();
  if (!reason) return { error: "REASON_REQUIRED" };

  const target = await loadTarget(input.userId);
  if (!target) return { error: "USER_NOT_FOUND" };
  if (target.role === "ADMIN") return { error: "CANNOT_SUSPEND_ADMIN" };

  // LOCKED + sessionVersion bump signs the user out everywhere immediately.
  await db.user.update({
    where: { id: target.id },
    data: { lifecycleState: "LOCKED", sessionVersion: { increment: 1 } },
  });

  void sendAccountSuspendedEmail({ userId: target.id, reason });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.USER_SUSPENDED,
    targetUserId: target.id,
    targetEmail: target.email,
    details: { reason },
  });

  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

export async function unsuspendAccount(input: { userId: string; reason?: string }): Promise<Result> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const target = await loadTarget(input.userId);
  if (!target) return { error: "USER_NOT_FOUND" };

  await db.user.update({
    where: { id: target.id },
    data: { lifecycleState: "ACTIVE", scheduledDeleteAt: null },
  });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.USER_UNSUSPENDED,
    targetUserId: target.id,
    targetEmail: target.email,
    details: { reason: input.reason?.trim() ? input.reason.trim() : null },
  });

  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

export async function adminDeleteAccount(input: { userId: string; reason: string }): Promise<Result> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const reason = input.reason.trim();
  if (!reason) return { error: "REASON_REQUIRED" };

  const target = await loadTarget(input.userId);
  if (!target) return { error: "USER_NOT_FOUND" };
  if (target.role === "ADMIN") return { error: "CANNOT_DELETE_ADMIN" };

  const scheduledDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  // LOCKED + 30-day schedule; the existing delete-accounts cron purges it.
  await db.user.update({
    where: { id: target.id },
    data: { lifecycleState: "LOCKED", scheduledDeleteAt, sessionVersion: { increment: 1 } },
  });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.USER_DELETION_SCHEDULED,
    targetUserId: target.id,
    targetEmail: target.email,
    details: { reason, purgeAt: scheduledDeleteAt.toISOString() },
  });

  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

// ─── P21-07: Impersonation ────────────────────────────────────────────────────

export async function startImpersonation(input: { userId: string; reason: string }): Promise<Result> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const reason = input.reason.trim();
  if (!reason) return { error: "REASON_REQUIRED" };

  const target = await loadTarget(input.userId);
  if (!target) return { error: "USER_NOT_FOUND" };
  if (target.role === "ADMIN") return { error: "CANNOT_IMPERSONATE_ADMIN" };

  await setImpersonation(admin.adminId, target.id);

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.IMPERSONATION_START,
    targetUserId: target.id,
    targetEmail: target.email,
    details: { reason, readOnly: true },
  });

  return { success: true };
}

export async function endImpersonation(): Promise<Result> {
  // No admin assert here: the session is currently the impersonated USER. Read
  // the cookie (which carries the real adminId) to log the end event, then clear
  // it — clearing restores the admin identity on the next request.
  const active = await readImpersonation();
  if (active) {
    const target = await db.user.findUnique({
      where: { id: active.targetId },
      select: { email: true },
    });
    await emitAdminEvent({
      adminId: active.adminId,
      action: ADMIN_ACTIONS.IMPERSONATION_END,
      targetUserId: active.targetId,
      targetEmail: target?.email ?? null,
      details: {},
    });
  }
  await clearImpersonation();
  return { success: true };
}

// P22-DB05: broadcast a PRODUCT_UPDATES notification to every active user.
// Honours each user's in-app product-update preference (handled in
// broadcastProductUpdate → createNotification).
export async function broadcastProductUpdate(input: {
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<Result & { recipients?: number }> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const title = input.title.trim();
  const body = input.body.trim();
  const trimmedUrl = input.actionUrl?.trim();
  const actionUrl = trimmedUrl && trimmedUrl.length > 0 ? trimmedUrl : undefined;
  if (!title) return { error: "TITLE_REQUIRED" };
  if (!body) return { error: "BODY_REQUIRED" };

  const recipients = await broadcastProductUpdateToUsers({ title, body, actionUrl });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.PRODUCT_BROADCAST,
    details: { title, recipients },
  });

  return { success: true, recipients };
}
