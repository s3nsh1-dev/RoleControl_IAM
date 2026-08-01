import assert from "node:assert/strict";
import { CookieClient, type HttpResponse } from "../support/http.ts";
import { getBaseUrl } from "./runtime.ts";

type LoginIdentity = {
  email: string;
};

const createClient = () => new CookieClient(getBaseUrl());

const getResponseData = <T>(response: HttpResponse) => {
  return response.body?.["data"] as T;
};

const assertErrorResponse = (
  response: HttpResponse,
  expectedStatus: number,
  messagePattern: RegExp,
) => {
  assert.equal(
    response.status,
    expectedStatus,
    `Expected status ${expectedStatus}, received ${response.status} with body ${JSON.stringify(response.body)}`,
  );
  assert.match(
    String(response.body?.["message"]),
    messagePattern,
    `Expected response message to match ${String(messagePattern)}, received ${String(response.body?.["message"])}`,
  );
};

const loginAsUser = async (
  user: LoginIdentity,
  password = "secret123",
) => {
  const client = createClient();
  const response = await client.post("/api/auth/login", {
    body: { email: user.email, password },
  });

  assert.equal(
    response.status,
    200,
    `Expected login for ${user.email} to succeed, received ${response.status} with body ${JSON.stringify(response.body)}`,
  );
  assert.ok(client.hasCookie("access"), "Expected access cookie after login");
  assert.ok(client.hasCookie("refresh"), "Expected refresh cookie after login");

  return client;
};

export { createClient, getResponseData, assertErrorResponse, loginAsUser };
