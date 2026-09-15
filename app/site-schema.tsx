import { siteDescription, siteName, siteUrl } from "../lib/seo";

const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
      logo: `${siteUrl}/investao-logo.svg`,
      email: "info@invest.ao",
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: siteName,
      alternateName: "Invest AO",
      url: siteUrl,
      description: siteDescription,
      inLanguage: "pt-AO",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export function SiteSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(siteSchema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
