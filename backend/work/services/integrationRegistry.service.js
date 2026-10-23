import User from "../model/user.model.js";

export const INTEGRATION_CATALOG_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "google_calendar",
    name: "Google Calendar",
    icon: "calendar",
    description: "Read upcoming events, check your schedule, and answer questions about your meetings.",
    status: "disconnected",
    connectable: true,
    authorization: "Google OAuth 2.0 PKCE — Delegated",
    operations: Object.freeze([
      Object.freeze({
        id: "list_events",
        label: "Read upcoming events",
        access: "read",
        scopes: Object.freeze(["https://www.googleapis.com/auth/calendar.events.readonly"]),
        dataSent: Object.freeze(["OAuth authorization code (one-time)", "Date range query parameter"]),
        dataReceived: Object.freeze(["Event titles, start/end times, location, organizer name, attendee count"]),
        confirmationRequired: false,
        aiCallable: true,
      }),
    ]),
    credentialStorage: "AES-256-GCM encrypted in MongoDB user document; never exposed to frontend or logs.",
    revokeEndpoint: "https://oauth2.googleapis.com/revoke",
  }),
  Object.freeze({
    id: "gmail_draft",
    name: "Gmail — Draft Only",
    icon: "mail",
    description: "Let Cheeni compose an email draft for you to review and send manually. Cheeni never sends email automatically.",
    status: "planned",
    connectable: false,
    authorization: "Google OAuth 2.0 PKCE — Delegated (not implemented)",
    operations: Object.freeze([
      Object.freeze({
        id: "create_draft",
        label: "Create email draft",
        access: "write-draft",
        scopes: Object.freeze(["https://www.googleapis.com/auth/gmail.compose"]),
        dataSent: Object.freeze(["Draft subject, body, recipient (user-reviewed before draft is saved)"]),
        dataReceived: Object.freeze(["Draft ID, thread ID"]),
        confirmationRequired: true,
        aiCallable: false,
      }),
    ]),
    credentialStorage: "Not configured; no credentials collected.",
    revokeEndpoint: "https://oauth2.googleapis.com/revoke",
  }),
  Object.freeze({
    id: "github_status",
    name: "GitHub — Read Status",
    icon: "github",
    description: "Check the status of repositories, open issues, and pull requests on your GitHub account.",
    status: "planned",
    connectable: false,
    authorization: "GitHub OAuth 2.0 PKCE — Delegated (not implemented)",
    operations: Object.freeze([
      Object.freeze({
        id: "read_repo_status",
        label: "Read repository and PR status",
        access: "read",
        scopes: Object.freeze(["repo:status", "read:user"]),
        dataSent: Object.freeze(["Repository name or owner/repo path"]),
        dataReceived: Object.freeze(["Repo name, open issues count, PR count, default branch, last push timestamp"]),
        confirmationRequired: false,
        aiCallable: false,
      }),
    ]),
    credentialStorage: "Not configured; no credentials collected.",
    revokeEndpoint: "https://github.com/settings/applications",
  }),
]);

/**
 * Returns a static, sanitized deep copy of the integration catalog (defaulting to disconnected/planned)
 */
export function getIntegrationCatalog() {
  return INTEGRATION_CATALOG_DEFINITIONS.map((integration) => ({
    ...integration,
    operations: integration.operations.map((operation) => ({
      ...operation,
      scopes: [...operation.scopes],
      dataSent: [...operation.dataSent],
      dataReceived: operation.dataReceived ? [...operation.dataReceived] : [],
    })),
  }));
}

/**
 * Returns the integration catalog personalized for a specific user,
 * resolving dynamic status ("connected" | "disconnected" | "planned").
 */
export async function getIntegrationCatalogForUser(userId) {
  let connectedMap = new Set();

  if (userId) {
    try {
      const user = await User.findById(userId).select("integrationTokens").lean();
      if (user?.integrationTokens) {
        // Map or plain object depending on lean / query
        const tokenEntries = user.integrationTokens instanceof Map
          ? Array.from(user.integrationTokens.keys())
          : Object.keys(user.integrationTokens);
        for (const id of tokenEntries) {
          const entry = user.integrationTokens[id] || (user.integrationTokens instanceof Map ? user.integrationTokens.get(id) : null);
          if (entry && entry.ciphertext) {
            connectedMap.add(id);
          }
        }
      }
    } catch {
      // In case of DB disconnection or test harness without user record, default to disconnected
    }
  }

  return INTEGRATION_CATALOG_DEFINITIONS.map((integration) => {
    let status = integration.status;
    if (integration.connectable) {
      status = connectedMap.has(integration.id) ? "connected" : "disconnected";
    }
    return {
      ...integration,
      status,
      operations: integration.operations.map((operation) => ({
        ...operation,
        scopes: [...operation.scopes],
        dataSent: [...operation.dataSent],
        dataReceived: operation.dataReceived ? [...operation.dataReceived] : [],
      })),
    };
  });
}
