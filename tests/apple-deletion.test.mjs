import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  signDeletionReceipt,
  verifyDeletionReceipt,
} from "../lib/apple-deletion-receipt.ts";
import { verifyBrowserReturn } from "../lib/apple-deletion-return.ts";
import { finishDeletedAccount } from "../lib/account-cleanup.ts";

const secret = "11".repeat(32); // Fictional fixture, never a deployment credential.
const now = 1792344000000;
const userID = "ac180000-0000-4000-8000-000000000001";
const payload = {
  version: 1,
  audience: "investao-web-account-deletion",
  userID,
  challenge: "22".repeat(32),
  outcome: "deleted",
  issuedAt: now / 1000,
  expiresAt: now / 1000 + 300,
};
const binding = JSON.stringify({ userID, challenge: payload.challenge });

test("signed return matches the HMAC contract and is bound to its initiating browser", async () => {
  const receipt = await signDeletionReceipt(secret, payload);
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`investao.apple-deletion.v1.${encoded}`)
    .digest("base64url");
  assert.equal(receipt, `${encoded}.${signature}`);
  assert.deepEqual(
    await verifyBrowserReturn(secret, receipt, binding, now),
    payload,
  );
  for (const wrong of [
    undefined,
    "{}",
    "null",
    "broken",
    JSON.stringify({ userID, challenge: "33".repeat(32) }),
    JSON.stringify({ userID: "another-account", challenge: payload.challenge }),
  ]) {
    assert.equal(await verifyBrowserReturn(secret, receipt, wrong, now), null);
  }
  // A consumed attempt cookie cannot authorize a second return.
  assert.equal(
    await verifyBrowserReturn(secret, receipt, undefined, now),
    null,
  );
});

test("tampering, wrong keys, expired or invalid claims never authorize cleanup", async () => {
  const receipt = await signDeletionReceipt(secret, payload);
  const changed = Buffer.from(
    JSON.stringify({ ...payload, outcome: "cancelled" }),
  ).toString("base64url");
  assert.equal(
    await verifyDeletionReceipt(
      secret,
      `${changed}.${receipt.split(".")[1]}`,
      now,
    ),
    null,
  );
  assert.equal(
    await verifyDeletionReceipt("44".repeat(32), receipt, now),
    null,
  );
  assert.equal(
    await verifyDeletionReceipt(secret, receipt, now + 300000),
    null,
  );
  assert.equal(await verifyDeletionReceipt("", receipt, now), null);
  for (const claims of [
    { audience: "other" },
    { userID: "not-a-user" },
    { outcome: "unknown" },
    { expiresAt: payload.expiresAt + 1 },
    { issuedAt: payload.issuedAt + 31, expiresAt: payload.expiresAt + 31 },
  ]) {
    assert.equal(
      await verifyDeletionReceipt(
        secret,
        await signDeletionReceipt(secret, { ...payload, ...claims }),
        now,
      ),
      null,
    );
  }
});

test("cancellation and failure keep their authenticated outcome", async () => {
  for (const outcome of ["cancelled", "failed"]) {
    const receipt = await signDeletionReceipt(secret, { ...payload, outcome });
    assert.equal(
      (await verifyBrowserReturn(secret, receipt, binding, now)).outcome,
      outcome,
    );
  }
});

test("cleanup signs out only a matching current account and clears only the deleted owner's data", async () => {
  for (const currentID of [userID, "different-account", null]) {
    const calls = [];
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: currentID ? { user: { id: currentID } } : null },
        }),
        signOut: async (options) => {
          calls.push(["signOut", options]);
          return { error: null };
        },
      },
    };
    await finishDeletedAccount(client, userID, async (id) => {
      calls.push(["clear", id]);
    });
    assert.deepEqual(calls, [
      ...(currentID === userID ? [["signOut", { scope: "local" }]] : []),
      ["clear", userID],
    ]);
  }
});

test("failed cleanup remains retryable instead of reporting completion", async () => {
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => {
        throw new Error("Must not sign out another account");
      },
    },
  };
  await assert.rejects(
    finishDeletedAccount(client, userID, async () => {
      throw new Error("Storage unavailable");
    }),
    /Storage unavailable/,
  );
});
