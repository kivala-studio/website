/** Referral codes are 8 characters from an alphabet without 0, 1, I and O. */
const INVITE_CODE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Returns the code in upper case (people type links by hand), or null when it cannot be a referral code. */
export function parseInviteCode(value: string): string | null {
  const code = value.toUpperCase();
  return INVITE_CODE.test(code) ? code : null;
}

/** sessionStorage key read after sign-in (W6) to redeem the code. */
export const INVITE_STORAGE_KEY = "investao.inviteCode";
