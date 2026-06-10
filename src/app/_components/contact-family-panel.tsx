import { WorkspaceIcon } from "~/app/_components/workspace-icons";

export type FamilyPanelMember = {
  name: string;
  access: "owner" | "edit" | "view";
  you: boolean;
};

// P15-03: "Shared with your family" panel on the contact detail page. Makes the
// shared state (and that edits propagate to everyone) clear BEFORE editing.
export function ContactFamilyPanel({
  groupName,
  members,
  viewerCanEdit,
  lastEditedBy,
  lastEditedAt,
}: {
  groupName: string;
  members: FamilyPanelMember[];
  viewerCanEdit: boolean;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
}) {
  const accessLabel = (a: FamilyPanelMember["access"]) =>
    a === "owner" ? "Owner" : a === "edit" ? "Can edit" : "View only";

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#cfe0d2] bg-[#f3f8f4]">
      <div className="flex items-start gap-3 px-5 pt-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[#e3efe7] text-[#1c6b48]">
          <WorkspaceIcon name="users" size={18} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#17352e]">Shared with the {groupName} book</p>
          <p className="mt-0.5 text-[12.5px] leading-[1.45] text-[#3f5a50]">
            {viewerCanEdit ? (
              <>
                Everyone in the book can see this contact. <strong className="font-semibold">Changes you
                make here update it for the whole family.</strong>
              </>
            ) : (
              <>You have <strong className="font-semibold">view-only</strong> access — only editors can change this contact.</>
            )}
          </p>
        </div>
      </div>

      <div className="mx-5 my-3 h-px bg-[#d3e3d6]" />

      <div className="grid gap-1.5 px-5 pb-4">
        {members.map((m, i) => (
          <div className="flex items-center justify-between gap-3 text-[13px]" key={i}>
            <span className="min-w-0 truncate text-[#1d2823]">
              {m.name}
              {m.you ? <span className="text-[#8b938c]"> · you</span> : null}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                m.access === "view" ? "bg-[#eef1ec] text-[#5c655e]" : "bg-[#e3efe7] text-[#1c6b48]"
              }`}
            >
              {accessLabel(m.access)}
            </span>
          </div>
        ))}
      </div>

      {lastEditedBy ? (
        <div className="border-t border-[#d3e3d6] px-5 py-2.5 text-[12px] text-[#3f5a50]">
          Last edited by <span className="font-semibold">{lastEditedBy}</span>
          {lastEditedAt ? ` · ${lastEditedAt}` : ""}
        </div>
      ) : null}
    </section>
  );
}
