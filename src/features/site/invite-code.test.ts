import { describe, expect, it } from "vitest";

import { parseInviteCode } from "./invite-code";

describe("parseInviteCode", () => {
  it("accepts 8 characters from the referral alphabet, in either case", () => {
    expect(parseInviteCode("ABCD2345")).toBe("ABCD2345");
    expect(parseInviteCode("abcd2345")).toBe("ABCD2345");
  });

  it.each(["ABCD234", "ABCD23456", "ABCDI234", "ABCDO234", "ABCD0123", "ABCD1234", "ABCD-234", ""])("rejects %j", (value) => {
    expect(parseInviteCode(value)).toBeNull();
  });
});
