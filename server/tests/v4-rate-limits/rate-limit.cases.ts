import assert from "node:assert/strict";
import { test } from "node:test";
import { redisClient } from "../../src/config/redis.connect.ts";
import { createDirectUser } from "../support/database.ts";
import { assertErrorResponse, createClient, loginAsUser } from "./helpers.ts";

const exhaustGlobalLimit = async (
  clientIp: string,
  path = "/api/users",
  expectedStatus = 401,
) => {
  const client = createClient();
  const headers = { "x-forwarded-for": clientIp };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await client.get(path, { headers });
    assert.equal(
      response.status,
      expectedStatus,
      `Expected pre-limit request to ${path} to return ${expectedStatus}, received ${response.status}`,
    );
  }

  return { client, headers };
};

test("global rate limiting blocks repeated requests on non-exempt API routes", async () => {
  const { client, headers } = await exhaustGlobalLimit("10.0.0.1");

  const blockedResponse = await client.get("/api/users", { headers });
  assertErrorResponse(
    blockedResponse,
    429,
    /too many requests\. please try again later\./i,
  );
  assert.match(
    String(blockedResponse.headers.get("retry-after")),
    /^\d+$/,
    "Expected global limiter to return Retry-After",
  );
});

test("login is exempt from the global limiter and still follows login-specific limiting", async () => {
  await exhaustGlobalLimit("10.0.0.2");

  const loginClient = createClient();
  const response = await loginClient.post("/api/auth/login", {
    headers: { "x-forwarded-for": "10.0.0.2" },
    body: {
      email: "missing-global-exempt@example.com",
      password: "secret123",
    },
  });

  assertErrorResponse(response, 401, /invalid email or password/i);
});

test("refresh is exempt from the global limiter and still follows refresh-specific limiting", async () => {
  const user = await createDirectUser({
    fullname: "Refresh Exempt User",
    email: "refresh-exempt@example.com",
    password: "secret123",
    roles: ["user"],
  });

  await exhaustGlobalLimit("10.0.0.3");

  const client = await loginAsUser(user, "secret123", {
    "x-forwarded-for": "10.0.0.3",
  });
  const refreshResponse = await client.get("/api/auth/refresh", {
    headers: { "x-forwarded-for": "10.0.0.3" },
  });

  assert.equal(
    refreshResponse.status,
    200,
    `Expected refresh to bypass the global limiter, received ${refreshResponse.status} with body ${JSON.stringify(refreshResponse.body)}`,
  );
});

test("different IPs get different global limiter buckets", async () => {
  const first = await exhaustGlobalLimit("10.0.0.4");
  const blockedResponse = await first.client.get("/api/users", {
    headers: first.headers,
  });
  assertErrorResponse(
    blockedResponse,
    429,
    /too many requests\. please try again later\./i,
  );

  const secondClient = createClient();
  const allowedOtherIp = await secondClient.get("/api/users", {
    headers: { "x-forwarded-for": "10.0.0.5" },
  });
  assert.equal(
    allowedOtherIp.status,
    401,
    `Expected a different IP bucket to remain unaffected, received ${allowedOtherIp.status}`,
  );
});

test("global limiter fails open when the Redis check degrades", async () => {
  const originalEval = redisClient.eval.bind(redisClient);

  redisClient.eval = (async () => {
    throw new Error("forced global limiter degradation");
  }) as typeof redisClient.eval;

  try {
    const client = createClient();
    const response = await client.get("/api/users", {
      headers: { "x-forwarded-for": "10.0.0.6" },
    });

    assert.equal(
      response.status,
      401,
      `Expected the request to bypass the global limiter during Redis degradation, received ${response.status}`,
    );
  } finally {
    redisClient.eval = originalEval as typeof redisClient.eval;
  }
});
