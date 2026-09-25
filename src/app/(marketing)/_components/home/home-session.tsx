"use client";

import Link from "next/link";

import { useSessionUser } from "~/app/_components/use-session-user";

// P50A-02 · The homepage is static (ISR); these are its only session-aware
// parts. The static HTML is the signed-out page. After hydration the session
// resolves (one shared request with the nav, see useSessionUser) and, for a
// signed-in visitor, the eyebrow, the hero's primary button and the closing
// band swap in place. Every swap keeps its box: the eyebrow is one line that
// truncates, and the buttons and closing copy stack the signed-out text as an
// invisible "ghost" in the same grid cell, so nothing on the page moves.

function firstName(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] ?? null;
}

/** Signed-in text laid over an invisible copy of the signed-out text. */
function Swap({ shown, ghost }: { shown: React.ReactNode; ghost: React.ReactNode }) {
  return (
    <span className="hp-swap">
      <span>{shown}</span>
      <span className="hp-swap__ghost" aria-hidden="true">
        {ghost}
      </span>
    </span>
  );
}

export function HeroEyebrow() {
  const user = useSessionUser();
  if (!user) return <p className="hp-hero__e">Contact management, done right</p>;
  const first = firstName(user.name);
  return <p className="hp-hero__e">{first ? `Welcome back, ${first}` : "Welcome back"}</p>;
}

export function HeroPrimaryCta() {
  const user = useSessionUser();
  if (!user) {
    return (
      <Link className="mkt-btn mkt-btn--pri" href="/register">
        Get started free
      </Link>
    );
  }
  return (
    // P46: returning users land on the contact list, not Overview.
    <Link className="mkt-btn mkt-btn--pri" href="/contacts">
      <Swap shown="Open Kontax" ghost="Get started free" />
    </Link>
  );
}

const SIGNED_OUT_TITLE = "Start with the contacts you already have.";
const SIGNED_OUT_SUB = "Free for up to 500 contacts. No card needed.";

export function ClosingCta() {
  const user = useSessionUser();
  const signedIn = Boolean(user);
  return (
    <section className="mkt-cta-band">
      <div className="mkt-cta-band__inner">
        <h2 className="mkt-cta-band__title">
          {signedIn ? <Swap shown="Your contacts are waiting." ghost={SIGNED_OUT_TITLE} /> : SIGNED_OUT_TITLE}
        </h2>
        <p className="mkt-cta-band__sub">
          {signedIn ? <Swap shown="Pick up where you left off." ghost={SIGNED_OUT_SUB} /> : SIGNED_OUT_SUB}
        </p>
        <div className="mkt-cta-band__btns">
          {signedIn ? (
            <Link className="mkt-btn mkt-btn--pri" href="/contacts">
              <Swap shown="Open Kontax" ghost="Get started free" />
            </Link>
          ) : (
            <Link className="mkt-btn mkt-btn--pri" href="/register">
              Get started free
            </Link>
          )}
          <Link className="mkt-btn mkt-btn--sec" href="/pricing">
            Compare plans
          </Link>
        </div>
      </div>
    </section>
  );
}
