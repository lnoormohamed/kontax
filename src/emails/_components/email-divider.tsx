import { Hr } from "@react-email/components";
import * as React from "react";

import { tokens } from "../_tokens";

/** Hairline horizontal rule used between email sections (P20-03). */
export function EmailDivider() {
  return <Hr style={{ borderColor: tokens.hairline, margin: 0 }} />;
}
