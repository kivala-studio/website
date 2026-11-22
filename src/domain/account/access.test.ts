import { describe, expect, it } from "vitest";

import { decodeSubscriptionAccess } from "./access";
import { decodeAccessJSON } from "./watchlist";

const BASE = { is_plus: true, enforcement_enabled: true, active_watchlist_ids: [], comparison_pair: null };

describe("get_subscription_access() decoding", () => {
  it("reads plus_until and store_subscription", () => {
    const access = decodeSubscriptionAccess({ ...BASE, plus_until: "2027-01-01T00:00:00+00:00", store_subscription: false })!;
    expect(access).toMatchObject({ plusUntil: "2027-01-01T00:00:00+00:00", storeSubscription: false });
    expect(decodeAccessJSON(JSON.parse(JSON.stringify(access)))).toEqual(access);
  });

  it("leaves them null when an older document lacks the keys", () => {
    const access = decodeSubscriptionAccess(BASE)!;
    expect(access).toMatchObject({ isPlus: true, plusUntil: null, storeSubscription: null });
    expect(decodeAccessJSON(JSON.parse(JSON.stringify(access)))).toEqual(access);
  });
});
