import type { CSSProperties, ReactNode } from "react";

/**
 * P24B-04 — "Stack table → cards / horizontal-scroll" helper (spec §C, §F).
 *
 * Two modes for dense, multi-column data on mobile:
 *  1. **Stacked cards** — pass `renderCard`: desktop shows a real table, mobile
 *     stacks each row into a card. (teams roster, audit, family rosters.)
 *  2. **Sticky-column scroll** — omit `renderCard`: one table in an
 *     `overflow-x` region with the first N columns pinned. (import preview's
 *     Name/Email, pricing comparison.)
 *
 * Presentational and server-compatible.
 */

export type MobileTableColumn = {
  key: string;
  label: ReactNode;
  /** px width — required on sticky columns so the next sticky column's offset is known. */
  width?: number;
  /** Pin this column while the rest scrolls horizontally (scroll mode). */
  sticky?: boolean;
  align?: "left" | "right" | "center";
};

export type MobileTableRow = Record<string, ReactNode>;

const HEAD_STYLE: CSSProperties = {
  textAlign: "left",
  padding: "9px 12px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#8b938c",
  background: "#f2f4f0",
  borderBottom: "1px solid #d8ddd6",
  whiteSpace: "nowrap",
};

const CELL_STYLE: CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#1d2823",
  borderBottom: "1px solid #e9ece7",
  whiteSpace: "nowrap",
  background: "#fff",
};

// Cumulative left offset for the i-th column among the sticky lead columns.
function stickyLeft(columns: MobileTableColumn[], index: number): number {
  let left = 0;
  for (let i = 0; i < index; i++) {
    if (columns[i]?.sticky) left += columns[i]?.width ?? 120;
  }
  return left;
}

function Table({ columns, rows, scroll }: { columns: MobileTableColumn[]; rows: MobileTableRow[]; scroll: boolean }) {
  // index of the last sticky column → it carries the right-edge shadow
  const lastSticky = columns.reduce((acc, c, i) => (c.sticky ? i : acc), -1);

  return (
    <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: scroll ? "auto" : undefined }}>
      <thead>
        <tr>
          {columns.map((c, i) => {
            const pinned = scroll && c.sticky;
            return (
              <th
                key={c.key}
                style={{
                  ...HEAD_STYLE,
                  textAlign: c.align ?? "left",
                  minWidth: c.width,
                  ...(pinned
                    ? {
                        position: "sticky",
                        left: stickyLeft(columns, i),
                        zIndex: 2,
                        boxShadow: i === lastSticky ? "2px 0 0 #d8ddd6" : undefined,
                      }
                    : {}),
                }}
              >
                {c.label}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {columns.map((c, i) => {
              const pinned = scroll && c.sticky;
              return (
                <td
                  key={c.key}
                  style={{
                    ...CELL_STYLE,
                    textAlign: c.align ?? "left",
                    fontWeight: i === 0 ? 600 : 400,
                    ...(pinned
                      ? {
                          position: "sticky",
                          left: stickyLeft(columns, i),
                          zIndex: 1,
                          boxShadow: i === lastSticky ? "2px 0 0 #e9ece7" : undefined,
                        }
                      : {}),
                  }}
                >
                  {row[c.key]}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MobileTable({
  columns,
  rows,
  renderCard,
  minWidth = 560,
}: {
  columns: MobileTableColumn[];
  rows: MobileTableRow[];
  /** When provided, mobile renders stacked cards instead of an h-scroll table. */
  renderCard?: (row: MobileTableRow, index: number) => ReactNode;
  /** Min table width before horizontal scroll kicks in (scroll mode). */
  minWidth?: number;
}) {
  if (renderCard) {
    // Stacked-cards mode: cards on mobile, real table on desktop.
    return (
      <>
        <div className="flex flex-col gap-3 md:hidden">{rows.map((row, i) => renderCard(row, i))}</div>
        <div className="hidden overflow-hidden rounded-xl border border-[#d8ddd6] md:block">
          <Table columns={columns} rows={rows} scroll={false} />
        </div>
      </>
    );
  }

  // Sticky-column scroll mode: one table that scrolls horizontally when narrow.
  return (
    <div className="overflow-hidden rounded-xl border border-[#d8ddd6]">
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <Table columns={columns} rows={rows} scroll />
        </div>
      </div>
    </div>
  );
}
