"use client";

import { useMemo, useState } from "react";

import { api } from "~/trpc/react";

type ContactInput = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
};

export function ContactManager() {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ContactInput>({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
  });

  const [list] = api.contact.list.useSuspenseQuery(
    useMemo(() => ({ search: query.trim() || undefined }), [query]),
  );
  const utils = api.useUtils();

  const createContact = api.contact.create.useMutation({
    onSuccess: async () => {
      await utils.contact.invalidate();
      setForm({
        fullName: "",
        email: "",
        phone: "",
        company: "",
        notes: "",
      });
    },
  });

  const deleteContact = api.contact.delete.useMutation({
    onSuccess: async () => {
      await utils.contact.invalidate();
    },
  });

  return (
    <section className="grid gap-6">
      <form
        className="grid gap-3 rounded-xl border border-white/20 bg-white/10 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          createContact.mutate(form);
        }}
      >
        <h2 className="text-xl font-semibold">Add a contact</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-md border border-white/20 bg-white/10 p-2 text-white placeholder:text-white/70"
            placeholder="Full name *"
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({ ...current, fullName: event.target.value }))
            }
          />
          <input
            className="rounded-md border border-white/20 bg-white/10 p-2 text-white placeholder:text-white/70"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
          />
          <input
            className="rounded-md border border-white/20 bg-white/10 p-2 text-white placeholder:text-white/70"
            placeholder="Phone"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
          />
          <input
            className="rounded-md border border-white/20 bg-white/10 p-2 text-white placeholder:text-white/70"
            placeholder="Company"
            value={form.company}
            onChange={(event) =>
              setForm((current) => ({ ...current, company: event.target.value }))
            }
          />
          <textarea
            className="col-span-full rounded-md border border-white/20 bg-white/10 p-2 text-white placeholder:text-white/70"
            rows={3}
            placeholder="Notes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={createContact.isPending || !form.fullName.trim()}
        >
          {createContact.isPending ? "Saving..." : "Save contact"}
        </button>
      </form>

      <section className="rounded-xl border border-white/20 bg-white/10 p-5">
        <h2 className="mb-3 text-xl font-semibold">Your contacts</h2>
        <input
          className="mb-4 w-full rounded-md border border-white/20 bg-white/10 p-2 text-white placeholder:text-white/70"
          placeholder="Search by name, email, or company"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <ul className="grid gap-3">
          {list.length === 0 ? (
            <li className="rounded-md border border-dashed border-white/30 p-4 text-white/80">
              No contacts yet.
            </li>
          ) : (
            list.map((contact) => (
              <li
                key={contact.id}
                className="flex items-start justify-between gap-4 rounded-md border border-white/20 bg-white/5 p-4"
              >
                <div>
                  <p className="font-semibold">
                    {contact.fullName}
                  </p>
                  <p className="text-sm text-white/80">
                    {contact.email ?? "No email"}
                  </p>
                  <p className="text-sm text-white/80">
                    {contact.phone ?? "No phone"}
                  </p>
                  <p className="text-sm text-white/80">
                    {contact.company ?? "No company"}
                  </p>
                </div>
                <button
                  className="rounded-md border border-red-300/50 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/20"
                  onClick={() => {
                    deleteContact.mutate({ id: contact.id });
                  }}
                  disabled={deleteContact.isPending}
                >
                  Delete
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </section>
  );
}
