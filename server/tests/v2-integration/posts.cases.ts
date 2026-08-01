import assert from "node:assert/strict";
import { test } from "node:test";
import { createDirectUser, getAuditLogEntries } from "../support/database.ts";
import {
  assertErrorResponse,
  getResponseData,
  loginAsUser,
} from "./helpers.ts";

test("post create, read, list, update, and privileged delete flows work end to end", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Post Super Admin",
    email: "post-super-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const author = await createDirectUser({
    fullname: "Post Author",
    email: "post-author@example.com",
    password: "secret123",
    roles: ["user"],
  });

  const authorClient = await loginAsUser(author);

  const createPostResponse = await authorClient.post("/api/posts", {
    body: { title: "My First Post", content: "Post content" },
  });
  assert.equal(createPostResponse.status, 201);
  const createdPostId = getResponseData<{ post: { id: number } }>(
    createPostResponse,
  ).post.id;

  const readPostResponse = await authorClient.get(`/api/posts/${createdPostId}`);
  assert.equal(readPostResponse.status, 200);

  const listPostsResponse = await authorClient.get("/api/posts");
  assert.equal(listPostsResponse.status, 200);
  const listedPosts = getResponseData<{ posts: Array<{ id: number }> }>(
    listPostsResponse,
  ).posts;
  assert.ok(
    listedPosts.some((post) => post.id === createdPostId),
    "Expected the created post to appear in the list response",
  );

  const updatePostResponse = await authorClient.put(`/api/posts/${createdPostId}`, {
    body: { title: "My Updated Post", content: "Updated content" },
  });
  assert.equal(updatePostResponse.status, 200);

  const updateEntries = await getAuditLogEntries("update", "post", createdPostId);
  assert.equal(updateEntries.length, 1);
  assert.equal(updateEntries[0]?.old_values?.["title"], "My First Post");
  assert.equal(updateEntries[0]?.new_values?.["title"], "My Updated Post");

  const superAdminClient = await loginAsUser(superAdmin);
  const deletePostResponse = await superAdminClient.delete(`/api/posts/${createdPostId}`);
  assert.equal(deletePostResponse.status, 200);

  const deleteEntries = await getAuditLogEntries("delete", "post", createdPostId);
  assert.equal(deleteEntries.length, 1);
  assert.equal(deleteEntries[0]?.old_values?.["id"], createdPostId);
});

test("super-admin can create posts on behalf of another user and self-behalf is blocked", async () => {
  const superAdmin = await createDirectUser({
    fullname: "On Behalf Super Admin",
    email: "on-behalf-super-admin@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const targetUser = await createDirectUser({
    fullname: "Target User",
    email: "on-behalf-target@example.com",
    password: "secret123",
    roles: ["user"],
  });
  const client = await loginAsUser(superAdmin);

  const createOnBehalfResponse = await client.post(
    `/api/posts/on-behalf/${targetUser.id}`,
    {
      body: { title: "Behalf Post", content: "Created on behalf" },
    },
  );
  assert.equal(createOnBehalfResponse.status, 201);
  const onBehalfPost = getResponseData<{
    post: { id: number; owner_id: number; behalf_of: number | null };
  }>(createOnBehalfResponse).post;
  assert.equal(onBehalfPost.owner_id, targetUser.id);
  assert.equal(onBehalfPost.behalf_of, superAdmin.id);

  const auditEntries = await getAuditLogEntries(
    "createOnBehalf",
    "post",
    onBehalfPost.id,
  );
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0]?.new_values?.["owner_id"], targetUser.id);
  assert.equal(auditEntries[0]?.new_values?.["behalf_of"], superAdmin.id);

  const selfBehalfResponse = await client.post(
    `/api/posts/on-behalf/${superAdmin.id}`,
    {
      body: { title: "Wrong Path", content: "Should fail" },
    },
  );
  assertErrorResponse(
    selfBehalfResponse,
    400,
    /use the regular create post endpoint/i,
  );
});

test("admin cannot delete a post owned by a super-admin", async () => {
  const superAdmin = await createDirectUser({
    fullname: "Protected Post Owner",
    email: "protected-post-owner@example.com",
    password: "secret123",
    roles: ["super-admin", "user"],
  });
  const admin = await createDirectUser({
    fullname: "Deleting Admin",
    email: "deleting-admin@example.com",
    password: "secret123",
    roles: ["admin", "user"],
  });

  const superAdminClient = await loginAsUser(superAdmin);
  const createPostResponse = await superAdminClient.post("/api/posts", {
    body: { title: "Protected Post", content: "Owned by super-admin" },
  });
  assert.equal(createPostResponse.status, 201);
  const protectedPostId = getResponseData<{ post: { id: number } }>(
    createPostResponse,
  ).post.id;

  const adminClient = await loginAsUser(admin);
  const deleteResponse = await adminClient.delete(`/api/posts/${protectedPostId}`);
  assertErrorResponse(
    deleteResponse,
    403,
    /admin cannot delete a post owned by a super-admin/i,
  );
});
