import assert from "node:assert/strict";
import { CookieClient, type HttpResponse } from "../support/http.ts";
import { getBaseUrl } from "./runtime.ts";

const createClient = () => new CookieClient(getBaseUrl());

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

export { createClient, assertErrorResponse };
