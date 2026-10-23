import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { genAccessToken } from "../config/token.js";
import taskRouter from "../routes/task.routes.js";

const app = express();
app.use(express.json());
app.use("/api/tasks", taskRouter);

const authorization = `Bearer ${genAccessToken("phase-15-test-user")}`;
const priorFlag = process.env.TASK_EXECUTION_ENABLED;

afterEach(() => {
  if (priorFlag === undefined) delete process.env.TASK_EXECUTION_ENABLED;
  else process.env.TASK_EXECUTION_ENABLED = priorFlag;
});

describe("task execution route safety", () => {
  it("requires authentication for task status and mutations", async () => {
    expect((await request(app).get("/api/tasks")).status).toBe(401);
    expect((await request(app).post("/api/tasks/507f1f77bcf86cd799439011/step")).status).toBe(401);
  });

  it("keeps approval and execution disabled unless explicitly enabled", async () => {
    delete process.env.TASK_EXECUTION_ENABLED;

    const response = await request(app)
      .post("/api/tasks/507f1f77bcf86cd799439011/approve")
      .set("Authorization", authorization)
      .send({ planDigest: "a".repeat(64) });

    expect(response.status).toBe(503);
    expect(response.body.message).toContain("disabled");
  });

  it("rejects malformed approval digests without database access", async () => {
    process.env.TASK_EXECUTION_ENABLED = "true";

    const response = await request(app)
      .post("/api/tasks/507f1f77bcf86cd799439011/approve")
      .set("Authorization", authorization)
      .send({ planDigest: "invalid" });

    expect(response.status).toBe(409);
  });
});
