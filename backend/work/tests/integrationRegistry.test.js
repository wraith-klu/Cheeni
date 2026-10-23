import { describe, expect, it } from "vitest";
import {
  getIntegrationCatalog,
  getIntegrationCatalogForUser,
} from "../services/integrationRegistry.service.js";

describe("integration registry (Phase 7)", () => {
  it("exposes the expanded integration catalog contract without secrets", () => {
    const catalog = getIntegrationCatalog();
    expect(catalog.length).toBe(3);

    const [calendar, gmail, github] = catalog;

    expect(calendar).toMatchObject({
      id: "google_calendar",
      status: "disconnected",
      connectable: true,
      authorization: "Google OAuth 2.0 PKCE — Delegated",
    });
    expect(calendar.operations[0]).toMatchObject({
      id: "list_events",
      access: "read",
      confirmationRequired: false,
      aiCallable: true,
    });

    expect(gmail).toMatchObject({
      id: "gmail_draft",
      status: "planned",
      connectable: false,
    });
    expect(gmail.operations[0]).toMatchObject({
      id: "create_draft",
      access: "write-draft",
      confirmationRequired: true,
    });

    expect(github).toMatchObject({
      id: "github_status",
      status: "planned",
      connectable: false,
    });

    const serialized = JSON.stringify(catalog);
    expect(serialized).not.toContain("client_secret");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("refresh_token");
    expect(serialized).not.toContain("ciphertext");
  });

  it("returns deep copies so callers cannot mutate the shared registry", () => {
    const [first] = getIntegrationCatalog();
    first.operations[0].scopes.push("unexpected");

    expect(getIntegrationCatalog()[0].operations[0].scopes).not.toContain("unexpected");
  });

  it("resolves dynamic user catalog status safely without DB or tokens", async () => {
    const userCatalog = await getIntegrationCatalogForUser(null);
    expect(userCatalog[0].id).toBe("google_calendar");
    expect(userCatalog[0].status).toBe("disconnected");
  });
});
