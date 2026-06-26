"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin, AdminForbiddenError } from "~/server/admin/guard";
import { ADMIN_ACTIONS, emitAdminEvent } from "~/server/admin/audit";
import { setImpersonation, clearImpersonation, readImpersonation } from "~/server/admin/impersonation";
import { db } from "~/server/db";
import { sendAccountSuspendedEmail } from "~/server/billing-emails";
import { coerceCardDavCapabilityProfileOverrideId } from "~/server/sync-provider-capabilities";
import {
  listAdminBroadcasts,
  processScheduledAdminBroadcasts,
  resolveBroadcastAudience,
  retractAdminBroadcast,
  saveAdminBroadcastDraft,
  sendAdminBroadcast,
  type BroadcastAudienceFilters,
} from "~/server/admin/broadcasts";
import type {
  AccountLifecycleState,
  AdminBroadcastStatus,
  AdminSupportCaseSeverity,
  AdminSupportCaseStatus,
  SubscriptionPlan,
  SyncProvider,
} from "../../../generated/prisma";

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
  reasonCategory?: string;
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
    details: { to: plan, reason, reasonCategory: input.reasonCategory?.trim() || null },
  });

  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

// ─── P21-05: Suspend / unsuspend / schedule deletion ──────────────────────────

export async function suspendAccount(input: { userId: string; reason: string; reasonCategory?: string }): Promise<Result> {
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
    details: { reason, reasonCategory: input.reasonCategory?.trim() || null },
  });

  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

export async function unsuspendAccount(input: { userId: string; reason?: string; reasonCategory?: string }): Promise<Result> {
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
    details: {
      reason: input.reason?.trim() ? input.reason.trim() : null,
      reasonCategory: input.reasonCategory?.trim() || null,
    },
  });

  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

export async function adminDeleteAccount(input: { userId: string; reason: string; reasonCategory?: string }): Promise<Result> {
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
    details: {
      reason,
      purgeAt: scheduledDeleteAt.toISOString(),
      reasonCategory: input.reasonCategory?.trim() || null,
    },
  });

  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

export async function addAdminSupportNote(input: {
  subjectType: string;
  subjectId: string;
  targetUserId?: string | null;
  body: string;
}): Promise<Result> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const body = input.body.trim();
  if (!body) return { error: "REASON_REQUIRED" };

  await db.adminSupportNote.create({
    data: {
      adminUserId: admin.adminId,
      subjectType: input.subjectType.trim().toUpperCase(),
      subjectId: input.subjectId,
      targetUserId: input.targetUserId ?? null,
      body: body.slice(0, 4000),
    },
  });

  revalidatePath("/admin");
  if (input.targetUserId) revalidatePath(`/admin/users/${input.targetUserId}`);
  if (input.subjectType.trim().toUpperCase() === "SYNC_ACCOUNT") {
    revalidatePath(`/admin/sync/${input.subjectId}`);
  }
  return { success: true };
}

export async function createAdminSupportCase(input: {
  subjectType: string;
  subjectId: string;
  targetUserId?: string | null;
  title: string;
  summary?: string;
  severity?: string;
  status?: string;
  nextFollowUpAt?: string | null;
  assignToSelf?: boolean;
}): Promise<Result & { supportCaseId?: string }> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const title = input.title.trim();
  if (!title) return { error: "REASON_REQUIRED" };

  const severity = ((input.severity?.trim().toUpperCase() as AdminSupportCaseSeverity | undefined) ?? "NORMAL");
  const status = ((input.status?.trim().toUpperCase() as AdminSupportCaseStatus | undefined) ?? "OPEN");
  const nextFollowUpAt = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;

  const supportCase = await db.adminSupportCase.create({
    data: {
      subjectType: input.subjectType.trim().toUpperCase(),
      subjectId: input.subjectId,
      targetUserId: input.targetUserId ?? null,
      creatorAdminUserId: admin.adminId,
      assigneeAdminUserId: input.assignToSelf ? admin.adminId : null,
      title,
      summary: input.summary?.trim() ? input.summary.trim().slice(0, 4000) : null,
      severity,
      status,
      nextFollowUpAt: nextFollowUpAt && !Number.isNaN(nextFollowUpAt.getTime()) ? nextFollowUpAt : null,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
      archivedAt: status === "ARCHIVED" ? new Date() : null,
    },
    select: { id: true },
  });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.SUPPORT_CASE_CREATED,
    targetUserId: input.targetUserId ?? null,
    details: {
      supportCaseId: supportCase.id,
      subjectType: input.subjectType.trim().toUpperCase(),
      subjectId: input.subjectId,
      title,
      severity,
      status,
    },
  });

  revalidatePath("/admin");
  if (input.targetUserId) revalidatePath(`/admin/users/${input.targetUserId}`);
  if (input.subjectType.trim().toUpperCase() === "SYNC_ACCOUNT") {
    revalidatePath(`/admin/sync/${input.subjectId}`);
  }

  return { success: true, supportCaseId: supportCase.id };
}

export async function updateAdminSupportCase(input: {
  supportCaseId: string;
  summary?: string;
  severity?: string;
  status?: string;
  nextFollowUpAt?: string | null;
  assignToSelf?: boolean;
  clearAssignment?: boolean;
}): Promise<Result> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const existing = await db.adminSupportCase.findUnique({
    where: { id: input.supportCaseId },
    select: {
      id: true,
      subjectType: true,
      subjectId: true,
      targetUserId: true,
      summary: true,
      severity: true,
      status: true,
    },
  });
  if (!existing) return { error: "USER_NOT_FOUND" };

  const severity = input.severity
    ? (input.severity.trim().toUpperCase() as AdminSupportCaseSeverity)
    : existing.severity;
  const status = input.status
    ? (input.status.trim().toUpperCase() as AdminSupportCaseStatus)
    : existing.status;
  const nextFollowUpAt = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;

  await db.adminSupportCase.update({
    where: { id: existing.id },
    data: {
      summary:
        typeof input.summary === "string"
          ? input.summary.trim()
            ? input.summary.trim().slice(0, 4000)
            : null
          : undefined,
      severity,
      status,
      nextFollowUpAt:
        input.nextFollowUpAt === undefined
          ? undefined
          : nextFollowUpAt && !Number.isNaN(nextFollowUpAt.getTime())
            ? nextFollowUpAt
            : null,
      assigneeAdminUserId: input.assignToSelf
        ? admin.adminId
        : input.clearAssignment
          ? null
          : undefined,
      resolvedAt: status === "RESOLVED" ? new Date() : status === "ARCHIVED" ? null : undefined,
      archivedAt: status === "ARCHIVED" ? new Date() : status === "RESOLVED" ? null : undefined,
    },
  });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.SUPPORT_CASE_UPDATED,
    targetUserId: existing.targetUserId ?? null,
    details: {
      supportCaseId: existing.id,
      subjectType: existing.subjectType,
      subjectId: existing.subjectId,
      severity,
      status,
      assignedToSelf: !!input.assignToSelf,
      clearedAssignment: !!input.clearAssignment,
    },
  });

  revalidatePath("/admin");
  if (existing.targetUserId) revalidatePath(`/admin/users/${existing.targetUserId}`);
  if (existing.subjectType === "SYNC_ACCOUNT") revalidatePath(`/admin/sync/${existing.subjectId}`);

  return { success: true };
}

export async function updateSyncCapabilityOverride(input: {
  syncAccountId: string;
  capabilityProfileOverride: string | null;
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

  const normalizedOverride = coerceCardDavCapabilityProfileOverrideId(input.capabilityProfileOverride);
  if (input.capabilityProfileOverride && !normalizedOverride) {
    return { error: "INVALID_PROFILE" };
  }

  const target = await db.syncAccount.findUnique({
    where: { id: input.syncAccountId },
    select: {
      id: true,
      userId: true,
      label: true,
      provider: true,
      connectionId: true,
      user: { select: { email: true } },
      settings: { select: { capabilityProfileOverride: true } },
    },
  });
  if (!target) return { error: "SYNC_ACCOUNT_NOT_FOUND" };
  if (target.provider !== "CARDDAV") return { error: "UNSUPPORTED_PROVIDER" };

  await db.syncAccountSettings.upsert({
    where: { syncAccountId: target.id },
    update: { capabilityProfileOverride: normalizedOverride },
    create: {
      syncAccountId: target.id,
      capabilityProfileOverride: normalizedOverride,
    },
  });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.SYNC_CAPABILITY_OVERRIDE_UPDATED,
    targetUserId: target.userId,
    targetEmail: target.user.email,
    details: {
      syncAccountId: target.id,
      label: target.label,
      provider: target.provider,
      connectionId: target.connectionId,
      previousOverride: target.settings?.capabilityProfileOverride ?? null,
      nextOverride: normalizedOverride,
      reason,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/sync");
  revalidatePath(`/admin/sync/${target.id}`);
  revalidatePath(`/admin/users/${target.userId}`);
  return { success: true };
}

// ─── P21-07: Impersonation ────────────────────────────────────────────────────

export async function startImpersonation(input: { userId: string; reason: string; reasonCategory?: string }): Promise<Result> {
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
    details: {
      reason,
      readOnly: true,
      reasonCategory: input.reasonCategory?.trim() || null,
      expiresInMinutes: 30,
    },
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

function normalizeAudienceFilters(input: {
  plans?: string[];
  lifecycleStates?: string[];
  providers?: string[];
  featureFlagKeys?: string[];
}): Partial<BroadcastAudienceFilters> {
  return {
    plans: (input.plans ?? []).map((value) => value.trim().toUpperCase() as SubscriptionPlan),
    lifecycleStates: (input.lifecycleStates ?? []).map(
      (value) => value.trim().toUpperCase() as AccountLifecycleState,
    ),
    providers: (input.providers ?? []).map((value) => value.trim().toUpperCase() as SyncProvider),
    featureFlagKeys: (input.featureFlagKeys ?? []).map((value) => value.trim()).filter(Boolean),
  };
}

export async function previewProductBroadcastAudience(input: {
  plans?: string[];
  lifecycleStates?: string[];
  providers?: string[];
  featureFlagKeys?: string[];
}): Promise<Result & { recipients?: number; sample?: string[] }> {
  try {
    await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const audience = await resolveBroadcastAudience(normalizeAudienceFilters(input));
  return { success: true, recipients: audience.count, sample: audience.sample };
}

export async function saveProductBroadcast(input: {
  broadcastId?: string | null;
  title: string;
  body: string;
  actionUrl?: string;
  plans?: string[];
  lifecycleStates?: string[];
  providers?: string[];
  featureFlagKeys?: string[];
  status: "DRAFT" | "SCHEDULED" | "SEND_NOW";
  scheduledFor?: string | null;
}): Promise<Result & { recipients?: number; broadcastId?: string }> {
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

  const status: Extract<AdminBroadcastStatus, "DRAFT" | "SCHEDULED"> =
    input.status === "SCHEDULED" ? "SCHEDULED" : "DRAFT";
  const scheduledFor = input.scheduledFor?.trim() ? new Date(input.scheduledFor) : null;
  const saved = await saveAdminBroadcastDraft({
    adminId: admin.adminId,
    broadcastId: input.broadcastId ?? null,
    title,
    body,
    actionUrl,
    filters: normalizeAudienceFilters(input),
    status,
    scheduledFor: scheduledFor && !Number.isNaN(scheduledFor.getTime()) ? scheduledFor : null,
  });

  let recipients = saved.previewRecipientCount;
  if (input.status === "SEND_NOW") {
    const sent = await sendAdminBroadcast({ adminId: admin.adminId, broadcastId: saved.id });
    recipients = sent?.deliveredRecipientCount ?? recipients;
  }

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.PRODUCT_BROADCAST,
    details: {
      broadcastId: saved.id,
      title,
      status: input.status,
      recipients,
      scheduledFor: scheduledFor?.toISOString() ?? null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/broadcast");
  return { success: true, recipients, broadcastId: saved.id };
}

export async function retractProductBroadcast(input: {
  broadcastId: string;
}): Promise<Result> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const retracted = await retractAdminBroadcast({
    adminId: admin.adminId,
    broadcastId: input.broadcastId,
  });
  if (!retracted) return { error: "USER_NOT_FOUND" };

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.PRODUCT_BROADCAST_RETRACTED,
    details: { broadcastId: input.broadcastId, title: retracted.title },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/broadcast");
  return { success: true };
}

export async function sendSavedProductBroadcast(input: {
  broadcastId: string;
}): Promise<Result & { recipients?: number }> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const sent = await sendAdminBroadcast({ adminId: admin.adminId, broadcastId: input.broadcastId });
  if (!sent) return { error: "USER_NOT_FOUND" };

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.PRODUCT_BROADCAST,
    details: { broadcastId: sent.id, title: sent.title, status: "SEND_NOW", recipients: sent.deliveredRecipientCount },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/broadcast");
  return { success: true, recipients: sent.deliveredRecipientCount };
}

// Backwards-compatible wrapper while the richer admin broadcast surface is
// being wired in. Existing callers can still "send now" to the default active
// audience without learning the new draft/schedule model first.
export async function broadcastProductUpdate(input: {
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<Result & { recipients?: number; broadcastId?: string }> {
  return saveProductBroadcast({
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl,
    status: "SEND_NOW",
  });
}

export async function loadAdminBroadcastPanel() {
  try {
    await assertAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return null;
    throw e;
  }

  await processScheduledAdminBroadcasts();

  const [broadcasts, flags] = await Promise.all([
    listAdminBroadcasts(),
    db.featureFlag.findMany({
      orderBy: { key: "asc" },
      select: { key: true, name: true },
    }),
  ]);

  return {
    broadcasts,
    flags: flags.map((flag) => ({
      key: flag.key,
      label: flag.name?.trim() || flag.key,
    })),
  };
}
