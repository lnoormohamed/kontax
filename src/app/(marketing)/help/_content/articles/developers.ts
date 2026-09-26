import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const API_PLANS = ["Pro", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const DEVELOPERS: HelpCategoryContent = {
  id: "developers",
  title: "Developers & API",
  description: "Create API tokens and understand rate limits. The full API reference is on the developer page.",
  articles: [
    {
      slug: "generate-an-api-token",
      title: "Create an API token",
      category: "developers",
      audience: "Developers on Pro or Teams",
      plans: API_PLANS,
      summary:
        "In **Settings → Developer**, name a token, choose **Read only** or **Read / Write**, choose **Create token** and copy it — it's shown once.",
      keywords: ["api", "token", "developer", "rest", "integration", "automation"],
      steps: [
        { text: "Open **Settings → Developer**." },
        { text: "Under **Create a new token**, give it a name you'll recognise (for example “My automation script”)." },
        { text: "Choose **Read only** or **Read / Write**, then **Create token**." },
        { text: "Copy the token straight away — Kontax won't show it again — and store it somewhere safe." },
      ],
      whatToExpect: [
        "Send the token as a bearer token to `https://api.getkontax.com/v1`. The [developer page](/developers) documents every endpoint.",
        "Tokens don't expire. Choose **Revoke token** when you no longer need one; revoking takes effect immediately.",
        "The API is part of Pro and Teams. It isn't included in Free or Family.",
      ],
      ifItDoesntWork: [
        "“API access is not included in your current plan” means the account isn't on Pro or Teams.",
        "Lost the token? Revoke it and create a new one.",
      ],
      related: ["developers/api-rate-limits", "import-export/kontax-export-format", "billing/free-vs-pro-plan"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "api-rate-limits",
      title: "API rate limits",
      category: "developers",
      audience: "Developers using the Kontax API",
      plans: API_PLANS,
      summary: `Each token can make ${FACTS.apiReadPerHour} requests an hour if it's read-only, or ${FACTS.apiWritePerHour} an hour if it's read/write.`,
      keywords: ["rate limit", "429", "quota", "throttle", "api"],
      steps: [],
      sections: [
        {
          heading: "Limits and headers",
          table: {
            head: ["Token scope", "Requests per hour"],
            rows: [
              ["Read only", FACTS.apiReadPerHour],
              ["Read / Write", FACTS.apiWritePerHour],
            ],
          },
          paragraphs: [
            "Every response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`. Over the limit, the API returns HTTP 429 with a `Retry-After` header.",
          ],
        },
      ],
      whatToExpect: [
        "Limits are counted per token, not per account.",
      ],
      ifItDoesntWork: [
        "Getting 429s? Wait for the time in `Retry-After`, spread requests out, or use a read-only token for reads.",
      ],
      related: ["developers/generate-an-api-token", "import-export/export-your-contacts", "import-export/kontax-export-format"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [],
};
