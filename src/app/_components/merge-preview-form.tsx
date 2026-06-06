import { mergeContacts } from "~/app/actions/contacts";
import type { MergePreview } from "~/server/contact-merge";

type MergePreviewFormProps = {
  title: string;
  description: string;
  preview: MergePreview;
  primaryContactId: string;
  secondaryContactId: string;
  primaryLabel: string;
  secondaryLabel: string;
  mergeSource: string;
  redirectTo: string;
  suggestionId?: string;
};

const valueLabel = (label: string, value: string | null | undefined) =>
  `${label}: ${value?.trim() ? value : "Not provided"}`;

export function MergePreviewForm({
  title,
  description,
  preview,
  primaryContactId,
  secondaryContactId,
  primaryLabel,
  secondaryLabel,
  mergeSource,
  redirectTo,
  suggestionId,
}: MergePreviewFormProps) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">{title}</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{preview.mergedContact.fullName}</h2>
      <p className="mt-3 text-sm text-slate-300">{description}</p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">Protected default rules</p>
        <p className="mt-2">
          Manual values win over imported values when both sides conflict. Otherwise the primary
          contact keeps priority until you override a field below.
        </p>
      </div>

      {preview.edgeCaseWarnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Review-first edge cases detected</p>
          <div className="mt-2 grid gap-2">
            {preview.edgeCaseWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      ) : null}

      <form action={mergeContacts} className="mt-5 grid gap-4">
        <input name="primaryContactId" type="hidden" value={primaryContactId} />
        <input name="secondaryContactId" type="hidden" value={secondaryContactId} />
        <input name="mergeSource" type="hidden" value={mergeSource} />
        <input name="redirectTo" type="hidden" value={redirectTo} />
        {suggestionId ? <input name="suggestionId" type="hidden" value={suggestionId} /> : null}

        <label className="grid gap-2 text-sm text-slate-200">
          <span>Full name</span>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            defaultValue={preview.defaultChoices.fullName}
            name="fullNameChoice"
          >
            <option className="bg-slate-950 text-white" value="primary">
              {valueLabel(primaryLabel, preview.primaryContact.fullName)}
            </option>
            <option className="bg-slate-950 text-white" value="secondary">
              {valueLabel(secondaryLabel, preview.secondaryContact.fullName)}
            </option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-slate-200">
          <span>Email</span>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            defaultValue={preview.defaultChoices.email}
            name="emailChoice"
          >
            <option className="bg-slate-950 text-white" value="primary">
              {valueLabel(primaryLabel, preview.primaryContact.email)}
            </option>
            <option className="bg-slate-950 text-white" value="secondary">
              {valueLabel(secondaryLabel, preview.secondaryContact.email)}
            </option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-slate-200">
          <span>Phone</span>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            defaultValue={preview.defaultChoices.phone}
            name="phoneChoice"
          >
            <option className="bg-slate-950 text-white" value="primary">
              {valueLabel(primaryLabel, preview.primaryContact.phone)}
            </option>
            <option className="bg-slate-950 text-white" value="secondary">
              {valueLabel(secondaryLabel, preview.secondaryContact.phone)}
            </option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-slate-200">
          <span>Company</span>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            defaultValue={preview.defaultChoices.company}
            name="companyChoice"
          >
            <option className="bg-slate-950 text-white" value="primary">
              {valueLabel(primaryLabel, preview.primaryContact.company)}
            </option>
            <option className="bg-slate-950 text-white" value="secondary">
              {valueLabel(secondaryLabel, preview.secondaryContact.company)}
            </option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-slate-200">
          <span>Notes</span>
          <select
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            defaultValue={preview.defaultChoices.notes}
            name="notesChoice"
          >
            <option className="bg-slate-950 text-white" value="combine">
              Combine both notes
            </option>
            <option className="bg-slate-950 text-white" value="primary">
              {valueLabel(primaryLabel, preview.primaryContact.notes)}
            </option>
            <option className="bg-slate-950 text-white" value="secondary">
              {valueLabel(secondaryLabel, preview.secondaryContact.notes)}
            </option>
          </select>
        </label>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="font-semibold text-white">Default preview result</p>
          <div className="mt-3 grid gap-2">
            <p>Email: {preview.mergedContact.email ?? "Not provided"}</p>
            <p>Phone: {preview.mergedContact.phone ?? "Not provided"}</p>
            <p>Company: {preview.mergedContact.company ?? "Not provided"}</p>
            <p className="whitespace-pre-wrap">Notes: {preview.mergedContact.notes ?? "No notes"}</p>
          </div>
          <p className="mt-3 text-slate-400">
            Your field choices above will be applied when you confirm the merge.
          </p>
        </div>

        <div className="grid gap-2 text-sm text-slate-400">
          {preview.mergeNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>

        <button
          className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          type="submit"
        >
          Confirm merge
        </button>
      </form>
    </article>
  );
}
