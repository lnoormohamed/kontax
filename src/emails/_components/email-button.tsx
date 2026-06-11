import { Button } from "@react-email/components";
import * as React from "react";

import { tokens } from "../_tokens";

interface EmailButtonProps {
  href: string;
  /** "red" for destructive / security actions; defaults to the blue CTA. */
  tone?: "blue" | "red";
  children: React.ReactNode;
}

/**
 * Block-level CTA button (P20-03). Rendered full-width and centred for the
 * widest email-client compatibility, per the P20-DB03 design.
 */
export function EmailButton({
  href,
  tone = "blue",
  children,
}: EmailButtonProps) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: tone === "red" ? tokens.red : tokens.blue,
        borderRadius: "6px",
        color: "#ffffff",
        display: "block",
        fontSize: "14px",
        fontWeight: 600,
        lineHeight: "20px",
        padding: "12px 24px",
        textAlign: "center",
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}
