import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { tokens } from "../_tokens";

const appUrl = process.env.APP_URL ?? "https://kontax.app";

interface EmailLayoutProps {
  /** Inbox preview text shown before the email is opened. */
  preview: string;
  /**
   * Security emails (suspicious activity) can't be unsubscribed from, so they
   * hide the footer unsubscribe link. Defaults to true.
   */
  unsubscribe?: boolean;
  /** Where the footer unsubscribe link points. */
  unsubscribeUrl?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for every Kontax transactional email (P20-03). Renders the
 * page-grey background, the 600px white card, the wordmark header, a hairline
 * rule, the body, and the footer. All styling is inline — email clients strip
 * external CSS — and pulled from the {@link tokens} palette.
 */
export function EmailLayout({
  preview,
  unsubscribe = true,
  unsubscribeUrl = `${appUrl}/settings/notifications`,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Geist"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/geist/v1/gyByhwUxId8gMEwSGFWNOITddY4.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            {/* Inline CSS wordmark — no hosted asset, renders in every client.
                Table layout keeps the tile + text aligned in Outlook. */}
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              style={{ borderCollapse: "collapse" }}
            >
              <tbody>
                <tr>
                  <td style={tileStyle}>K</td>
                  <td style={wordmarkStyle}>Kontax</td>
                </tr>
              </tbody>
            </table>
          </Section>
          <Hr style={dividerStyle} />

          <Section style={contentStyle}>{children}</Section>

          <Hr style={dividerStyle} />

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Kontax · You&rsquo;re receiving this because you have an account
              at kontax.app
            </Text>
            {unsubscribe && (
              <Text style={footerTextStyle}>
                <Link href={unsubscribeUrl} style={footerLinkStyle}>
                  Unsubscribe from non-security emails
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: tokens.bgPage,
  margin: 0,
  padding: "32px 0 40px",
  fontFamily: tokens.fontFamily,
};
const containerStyle: React.CSSProperties = {
  backgroundColor: tokens.bgCard,
  maxWidth: "600px",
  margin: "0 auto",
  borderRadius: "8px",
  border: `1px solid ${tokens.border}`,
  overflow: "hidden",
};
const headerStyle: React.CSSProperties = { padding: "24px 32px" };
const tileStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "7px",
  backgroundColor: tokens.brand,
  color: tokens.brandTile,
  fontSize: "16px",
  fontWeight: 700,
  textAlign: "center",
  verticalAlign: "middle",
  fontFamily: tokens.fontFamily,
};
const wordmarkStyle: React.CSSProperties = {
  paddingLeft: "9px",
  fontSize: "18px",
  fontWeight: 600,
  letterSpacing: "-0.018em",
  color: tokens.brand,
  verticalAlign: "middle",
  fontFamily: tokens.fontFamily,
};
const contentStyle: React.CSSProperties = { padding: "24px 32px" };
const footerStyle: React.CSSProperties = { padding: "16px 32px 24px" };
const dividerStyle: React.CSSProperties = {
  borderColor: tokens.hairline,
  margin: 0,
};
const footerTextStyle: React.CSSProperties = {
  color: tokens.footer,
  fontSize: "12px",
  lineHeight: "20px",
  margin: "4px 0 0",
};
const footerLinkStyle: React.CSSProperties = {
  color: tokens.footer,
  textDecoration: "underline",
};
