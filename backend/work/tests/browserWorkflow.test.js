import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import browserRouter from "../routes/browser.routes.js";
import { genAccessToken } from "../config/token.js";
import {
  isPrivateIp,
  validateWorkflowUrl,
  BROWSER_WORKFLOW_REGISTRY,
} from "../services/browserWorkflow.service.js";

const app = express();
app.use(express.json());
app.use("/api/browser", browserRouter);

const authorization = `Bearer ${genAccessToken("phase-5-test-user")}`;

describe("Browser Workflow Service & API Policy (Phase 5)", () => {
  it("rejects unauthorized calls to browser endpoints", async () => {
    const res = await request(app).get("/api/browser/workflows");
    expect(res.status).toBe(401);
  });

  it("lists all registered, enabled workflows", async () => {
    const res = await request(app)
      .get("/api/browser/workflows")
      .set("Authorization", authorization);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.workflows.length).toBe(3);
    const ids = res.body.workflows.map((w) => w.id);
    expect(ids).toContain("public_article_reader");
    expect(ids).toContain("public_documentation_reader");
    expect(ids).toContain("public_product_spec_reader");
  });

  it("identifies private and reserved IP addresses accurately (SSRF guard)", () => {
    // Loopback
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.0.0.99")).toBe(true);
    // Private ranges (RFC 1918)
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    // Link local
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    // Carrier NAT
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    // IPv6 loopback
    expect(isPrivateIp("::1")).toBe(true);
    // Public IPs should pass
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("151.101.65.140")).toBe(false);
  });

  it("validates workflow URLs and strictly enforces the allowlist", () => {
    const articleWf = BROWSER_WORKFLOW_REGISTRY["public_article_reader"];

    // Valid domain
    const valid = validateWorkflowUrl("https://en.wikipedia.org/wiki/Artificial_intelligence", articleWf);
    expect(valid.valid).toBe(true);
    expect(valid.hostname).toBe("en.wikipedia.org");

    // Invalid scheme (e.g. file, javascript, data)
    expect(validateWorkflowUrl("file:///C:/Windows/System32", articleWf).valid).toBe(false);
    expect(validateWorkflowUrl("javascript:alert(1)", articleWf).valid).toBe(false);

    // Embedded credentials
    expect(validateWorkflowUrl("https://admin:password@en.wikipedia.org/wiki", articleWf).valid).toBe(false);

    // Non-standard port
    expect(validateWorkflowUrl("https://en.wikipedia.org:8443/wiki", articleWf).valid).toBe(false);

    // Unapproved domain
    const disallowed = validateWorkflowUrl("https://malicious-site.example.org/", articleWf);
    expect(disallowed.valid).toBe(false);
    expect(disallowed.error).toContain("allowlist");
  });

  it("creates a safe preview without launching any browser", async () => {
    const res = await request(app)
      .post("/api/browser/workflows/preview")
      .set("Authorization", authorization)
      .send({
        workflowId: "public_article_reader",
        url: "https://en.wikipedia.org/wiki/Cheeni",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preview).toBeDefined();
    expect(res.body.preview.targetDomain).toBe("en.wikipedia.org");
    expect(res.body.preview.disclosure).toBeDefined();
    expect(res.body.preview.limits.maxDurationSeconds).toBe(30);
    expect(res.body.preview.estimatedSteps.length).toBeGreaterThan(0);
  });

  it("rejects preview with an unknown workflow ID", async () => {
    const res = await request(app)
      .post("/api/browser/workflows/preview")
      .set("Authorization", authorization)
      .send({
        workflowId: "unapproved_hacker_workflow",
        url: "https://en.wikipedia.org/wiki",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Unknown or disabled workflow");
  });

  it("starts a workflow and allows polling status and stopping it", async () => {
    const startRes = await request(app)
      .post("/api/browser/workflows/start")
      .set("Authorization", authorization)
      .send({
        workflowId: "public_documentation_reader",
        url: "https://docs.python.org/3/",
      });

    expect(startRes.status).toBe(202);
    expect(startRes.body.success).toBe(true);
    const { runId } = startRes.body.run;
    expect(runId).toBeDefined();

    // Query status
    const statusRes = await request(app)
      .get(`/api/browser/runs/${runId}`)
      .set("Authorization", authorization);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.run.runId).toBe(runId);
    expect(statusRes.body.run.targetDomain).toBe("docs.python.org");

    // Stop the active run
    const stopRes = await request(app)
      .post(`/api/browser/runs/${runId}/stop`)
      .set("Authorization", authorization);
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.run.state).toBe("cancelled");
  });
});
