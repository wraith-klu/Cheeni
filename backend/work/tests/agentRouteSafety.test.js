import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import agentRouter from "../routes/agent.routes.js";
import { genAccessToken } from "../config/token.js";

const app = express();
app.use(express.json());
app.use("/api/agent", agentRouter);

const authorization = `Bearer ${genAccessToken("phase-10-test-user")}`;

describe("legacy high-impact desktop routes", () => {
  it("still requires app authentication before reporting disabled routes", async () => {
    const response = await request(app).post("/api/agent/system/shutdown");
    expect(response.status).toBe(401);
  });

  it("keeps native hands-free listening deferred", async () => {
    const response = await request(app)
      .post("/api/agent/voice/start-listening")
      .set("Authorization", authorization);

    expect(response.status).toBe(410);
    expect(response.body.code).toBe("native_voice_deferred");
  });

  it.each([
    ["post", "/api/agent/command"],
    ["post", "/api/agent/command/classify"],
    ["post", "/api/agent/command/confirm"],
    ["get", "/api/agent/command/pending"],
    ["post", "/api/agent/apps/close"],
    ["post", "/api/agent/windows/close"],
    ["post", "/api/agent/system/lock"],
    ["post", "/api/agent/system/sleep"],
    ["post", "/api/agent/system/restart"],
    ["post", "/api/agent/system/shutdown"],
    ["post", "/api/agent/files/create_folder"],
    ["post", "/api/agent/files/rename"],
    ["post", "/api/agent/files/move"],
  ])("fails closed for %s %s", async (method, path) => {
    const response = await request(app)[method](path).set("Authorization", authorization);
    expect(response.status).toBe(410);
    expect(response.body.success).toBe(false);
  });

  it("requires authentication for filesystem preview", async () => {
    const response = await request(app)
      .post("/api/agent/files/operations/preview")
      .send({ type: "create_folder", parent: "C:/Users/test/Downloads", name: "planned" });
    expect(response.status).toBe(401);
  });

  it("rejects unknown top-level tool payload fields before proxying", async () => {
    const response = await request(app)
      .post("/api/agent/tool")
      .set("Authorization", authorization)
      .send({ name: "open_folder", arguments: { folder: "documents" }, confirmed: true });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("invalid_request");
  });

  it("requires both exact tool envelope fields", async () => {
    const response = await request(app)
      .post("/api/agent/tool")
      .set("Authorization", authorization)
      .send({ name: "open_folder" });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("invalid_request");
  });

  it("reports an unregistered tool as unsupported", async () => {
    const response = await request(app)
      .post("/api/agent/tool")
      .set("Authorization", authorization)
      .send({ name: "run_shell", arguments: { command: "whoami" } });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("unsupported");
  });

  it("rejects unknown fields before proxying a file preview", async () => {
    const response = await request(app)
      .post("/api/agent/files/operations/preview")
      .set("Authorization", authorization)
      .send({ type: "create_folder", parent: "C:/Users/test/Downloads", name: "planned", confirmed: true });
    expect(response.status).toBe(400);
  });

  it("validates question length and rejects extra keys for screen vision", async () => {
    // Unauthenticated
    const unauth = await request(app).post("/api/agent/vision").send({ question: "Look at screen" });
    expect(unauth.status).toBe(401);

    // Empty question
    const emptyQ = await request(app)
      .post("/api/agent/vision")
      .set("Authorization", authorization)
      .send({ question: "   " });
    expect(emptyQ.status).toBe(400);
    expect(emptyQ.body.message).toContain("1 to 500");

    // Extra keys rejected
    const extraKeys = await request(app)
      .post("/api/agent/vision/analyze-screen")
      .set("Authorization", authorization)
      .send({ question: "Valid question", executeAction: true });
    expect(extraKeys.status).toBe(400);
    expect(extraKeys.body.message).toContain("may only contain the 'question' property");
  });
});
