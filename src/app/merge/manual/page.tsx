import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import {
  MergeReview,
  type MergeReviewContact,
  type MergeReviewUnions,
} from "~/app/_components/merge-review";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";
import { buildMergedContactPreview, type MergePreview } from "~/server/contact-merge";

type ManualMergePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const toUnions = (preview: MergePreview): MergeReviewUnions => {
  const m = preview.mergedContact;
  return {
    emails: m.emailAddresses ?? [],
    phones: m.phoneNumbers ?? [],
    addresses: (m.postalAddresses ?? []).map((e) => e.formatted),
    websites: (m.websiteEntries ?? []).map((e) => e.value),
    labels: m.labels ?? [],
    dates: (m.significantDates ?? []).map((e) => `${e.label}: ${e.date}`),
    related: (m.relatedPeople ?? []).map((e) => `${e.relationship}: ${e.name}`),
    custom: (m.customFields ?? []).map((e) => `${e.label}: ${e.value}`),
  };
};

const toReviewContact = (c: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  nickname: string | null;
  website: string | null;
  birthday: string | null;
  notes: string | null;
}): MergeReviewContact => ({
  id: c.id,
  fullName: c.fullName,
  email: c.email,
  phone: c.phone,
  company: c.company,
  jobTitle: c.jobTitle,
  nickname: c.nickname,
  website: c.website,
  birthday: c.birthday,
  notes: c.notes,
});

export default async function ManualMergePage({ searchParams }: ManualMergePageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = searchParams ? await searchParams : undefined;
  const leftId = getSingleValue(params?.left)?.trim() ?? "";
  const rightId = getSingleValue(params?.right)?.trim() ?? "";

  const [contacts, planSummary, contactCounts, openDuplicates] = await Promise.all([
    db.contact.findMany({
      where: { userId: session.user.id, archivedAt: null },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
        jobTitle: true,
        nickname: true,
        website: true,
        birthday: true,
        notes: true,
        archivedAt: true,
        updatedAt: true,
      },
    }),
    getUserPlanSummary(session.user.id),
    db.contact.groupBy({
      by: ["archivedAt"],
      where: { userId: session.user.id },
      _count: { id: true },
    }),
    db.mergeSuggestion.count({
      where: { userId: session.user.id, status: "OPEN" },
    }),
  ]);

  const leftContact = contacts.find((c) => c.id === leftId) ?? null;
  const rightContact = contacts.find((c) => c.id === rightId) ?? null;
  const validPair = leftContact != null && rightContact != null && leftContact.id !== rightContact.id;

  const previewAB = validPair ? buildMergedContactPreview(leftContact, rightContact) : null;
  const previewBA = validPair ? buildMergedContactPreview(rightContact, leftContact) : null;

  const people = contactCounts.find((r) => r.archivedAt === null)?._count.id ?? 0;
  const archived = contactCounts.find((r) => r.archivedAt !== null)?._count.id ?? 0;

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  const C = {
    ink: "#1d2823",
    ink2: "#5c655e",
    mute: "#8b938c",
    line: "#d8ddd6",
    line2: "#e9ece7",
    wash: "#f2f4f0",
    green: "#17352e",
    blue: "#4158f4",
  };

  return (
    <AppShell
      account={{
        name: userLabel,
        email: session.user.email ?? "",
        plan: planSummary.planLabel,
      }}
      counts={{
        people,
        favorites: 0,
        archived,
        duplicates: openDuplicates,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "28px 24px 80px",
          display: "grid",
          gap: 18,
        }}
      >
        {/* Secondary header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/settings"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              fontWeight: 600,
              color: C.blue,
              textDecoration: "none",
            }}
          >
            <svg fill="none" height="15" stroke={C.blue} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="15">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Settings
          </a>
          <span style={{ width: 1, height: 16, background: C.line }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>
            {validPair ? "Choose what to keep" : "Manual merge"}
          </span>
        </div>

        {/* Step 1 — picker */}
        <section
          style={{
            background: "#fff",
            border: `1px solid ${C.line}`,
            borderRadius: "1.4rem",
            boxShadow: "0 1px 2px rgba(20,30,25,0.03)",
            padding: "20px 22px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: validPair ? 16 : 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: C.ink,
            }}
          >
            {validPair ? "Contacts selected" : "Merge two contacts"}
          </h1>
          {!validPair && (
            <p style={{ margin: "7px 0 0", fontSize: 14, lineHeight: 1.55, color: C.ink2 }}>
              Choose the two records to combine. You&apos;ll decide what to keep, field by field, before anything changes.
            </p>
          )}
          <form
            method="get"
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 16,
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>Contact A</span>
              <select
                defaultValue={leftId}
                name="left"
                style={{
                  height: 44,
                  padding: "0 12px",
                  borderRadius: 11,
                  border: `1px solid ${C.line}`,
                  background: "#fff",
                  fontSize: 13.5,
                  color: C.ink,
                  outline: "none",
                }}
              >
                <option value="">Search contacts…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </label>

            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: C.wash,
                display: "grid",
                placeItems: "center",
                marginBottom: 6,
                flexShrink: 0,
              }}
            >
              <svg fill="none" height="16" stroke={C.mute} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
                <path d="M7 4v6a5 5 0 005 5h5" />
                <path d="M17 4v6" />
                <path d="M14 12l3 3-3 3" />
                <path d="M7 4l-2 2" />
                <path d="M7 4l2 2" />
              </svg>
            </span>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>Contact B</span>
              <select
                defaultValue={rightId}
                name="right"
                style={{
                  height: 44,
                  padding: "0 12px",
                  borderRadius: 11,
                  border: `1px solid ${C.line}`,
                  background: "#fff",
                  fontSize: 13.5,
                  color: C.ink,
                  outline: "none",
                }}
              >
                <option value="">Search contacts…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </label>

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 4,
              }}
            >
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 44,
                  padding: "0 20px",
                  borderRadius: 11,
                  border: "none",
                  background: C.blue,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                type="submit"
              >
                <svg fill="none" height="16" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect height="4" rx="1" width="6" x="9" y="3" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
                Load merge preview
              </button>
              {!validPair && (
                <span style={{ fontSize: 12.5, color: C.ink2 }}>
                  No system suggestion needed — pick any two active contacts.
                </span>
              )}
            </div>
          </form>

          {leftId && rightId && !validPair && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ecdcb6",
                background: "rgba(191,133,38,0.08)",
                fontSize: 13,
                color: "#7a5512",
              }}
            >
              Choose two different active contacts to review a merge.
            </div>
          )}
        </section>

        {/* Step 2 — field review */}
        {validPair && previewAB && previewBA && (
          <MergeReview
            contactA={toReviewContact(leftContact)}
            contactB={toReviewContact(rightContact)}
            mergeSource="manual-pair"
            unionsA={toUnions(previewAB)}
            unionsB={toUnions(previewBA)}
          />
        )}
      </div>
    </AppShell>
  );
}
