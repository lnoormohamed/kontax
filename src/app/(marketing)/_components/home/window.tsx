// P49-02 · Shared window frame for every homepage vignette (design P49-DB01
// §3 "Vignette specs"): 1px hairline border, 14px radius, optional 26px
// chrome bar, 16px body padding (12px under 768px). Vignettes are decorative
// product pictures, so the frame is aria-hidden and the adjacent copy carries
// the meaning.
export function MktWindow({
  bar,
  children,
}: {
  bar?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hp-win" aria-hidden="true">
      {bar ? (
        <div className="hp-win__bar">
          <i />
          <i />
          <i />
          <span>{bar}</span>
        </div>
      ) : null}
      <div className="hp-win__body">{children}</div>
    </div>
  );
}
