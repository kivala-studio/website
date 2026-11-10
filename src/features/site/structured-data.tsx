import { headers } from "next/headers";

import { serverEnv } from "@/config/server-env";

import { APP_STORE_URL, SUPPORT_EMAIL } from "./site";

/** schema.org Organization for the landing page. The script carries the request's CSP nonce. */
export async function OrganizationData() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const site = serverEnv.siteUrl;
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "invest.ao",
    url: `${site}/`,
    logo: `${site}/brand/palanca.png`,
    email: SUPPORT_EMAIL,
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL },
    sameAs: [APP_STORE_URL],
  };
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // Escapes `<` so the payload can never close the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
