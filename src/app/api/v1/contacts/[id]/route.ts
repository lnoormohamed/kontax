import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/server/db";
import { emitEvent } from "~/lib/activity";
import { corsHeaders } from "~/lib/api-cors";
import { API_CONTACT_SELECT, formatContactForApi, mapUpdateInputToDb } from "../../_lib/contact-mapper";
import { ContactUpdateSchema } from "../../_lib/schemas";
import { requireWriteScope, withApiAuth } from "../../_lib/auth";

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return withApiAuth(req, async (userId) => {
    const { id } = await params;

    const contact = await db.contact.findFirst({
      where: { id, userId },
      select: API_CONTACT_SELECT,
    });

    if (!contact) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Contact not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(formatContactForApi(contact));
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiAuth(req, async (userId, scope) => {
    const denied = requireWriteScope(scope);
    if (denied) return denied;

    const { id } = await params;

    const existing = await db.contact.findFirst({
      where: { id, userId, archivedAt: null },
      select: { id: true, fullName: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Contact not found." },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const parsed = ContactUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Request body is invalid.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const patch = mapUpdateInputToDb(parsed.data);
    const updatedFields = Object.keys(parsed.data);

    const updated = await db.$transaction(async (tx) => {
      const contact = await tx.contact.update({
        where: { id },
        data: patch,
        select: API_CONTACT_SELECT,
      });
      await emitEvent(tx, {
        userId,
        contactId: id,
        eventType: "CONTACT_UPDATED",
        actor: "API",
        payload: {
          diffs: updatedFields.map((field) => ({ field, before: undefined, after: undefined })),
        },
      });
      return contact;
    });

    return NextResponse.json(formatContactForApi(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withApiAuth(req, async (userId, scope) => {
    const denied = requireWriteScope(scope);
    if (denied) return denied;

    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get("permanent") === "true";

    const contact = await db.contact.findFirst({
      where: { id, userId },
      select: { id: true, fullName: true, email: true, phone: true },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Contact not found." },
        { status: 404 },
      );
    }

    if (permanent) {
      await db.$transaction(async (tx) => {
        await tx.contact.delete({ where: { id } });
        await emitEvent(tx, {
          userId,
          contactId: null,
          eventType: "CONTACT_DELETED",
          actor: "API",
          payload: {
            fullName: contact.fullName,
            email: contact.email ?? undefined,
            phone: contact.phone ?? undefined,
          },
        });
      });
      return new NextResponse(null, { status: 204 });
    }

    // Soft delete — archive
    await db.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id },
        data: { archivedAt: new Date(), lastMutatedBy: "API" },
      });
      await emitEvent(tx, {
        userId,
        contactId: id,
        eventType: "CONTACT_ARCHIVED",
        actor: "API",
        payload: {},
      });
    });

    return new NextResponse(null, { status: 204 });
  });
}
