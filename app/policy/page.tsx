import type { Metadata } from "next";
import Link from "next/link";
import "./policy.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Invest.ao",
  description: "How Invest.ao collects, uses, stores and deletes personal information.",
  openGraph: { title: "Privacy Policy | Invest.ao", description: "Privacy information for the Invest.ao app and website.", locale: "en_US", type: "website" },
};

export default function PrivacyPolicy() {
  return (
    <main className="policy-page" lang="en">
      <nav aria-label="Policy navigation"><Link href="/">invest.ao</Link><Link href="/">Back to home</Link></nav>
      <header><span>YOUR INFORMATION</span><h1>Privacy Policy</h1><p>Last updated: 15 September 2026</p></header>
      <p>This policy explains how Invest.ao handles personal information when you use our iPhone app and website. Invest.ao helps you follow Angola’s capital market, save favourites and organise a portfolio. It does not execute securities trades.</p>
      <section><h2>1. Information we collect</h2>
        <ul>
          <li><strong>Account information.</strong> When you sign in with Google or Apple, we receive an account identifier and the profile information the provider makes available, such as your name and email address. Apple may supply a private relay email address. We do not receive your Google or Apple password.</li>
          <li><strong>Information you save.</strong> This includes favourite titles, watchlist ordering, alert rules and preferences, and portfolio entries you choose to record, including the title, buy or sell designation, quantity, unit price and date. Recording an entry does not place a trade.</li>
          <li><strong>Notification information.</strong> If you enable notifications, we process a push notification token, an app installation identifier, app version and build information, notification preferences, and delivery or read status needed to operate alerts.</li>
          <li><strong>Technical information.</strong> Requests to our services expose information such as your IP address and request details to the hosting infrastructure. Operational records may include timestamps, authentication events, errors and notification delivery outcomes for security and troubleshooting.</li>
          <li><strong>Messages you send us.</strong> If you contact us, we process the contact details and information you provide to respond to your request. Please do not send passwords or unnecessary financial information.</li>
        </ul>
      </section>
      <section><h2>2. How we use information</h2><p>We use this information to authenticate your account, synchronise the information you save, display your portfolio, deliver alerts you configure, remember your settings, respond to requests and maintain the reliability and security of the service. We do not use your portfolio entries to execute transactions.</p></section>
      <section><h2>3. On-device storage and privacy controls</h2><p>The app stores session information, preferences and cached data on your device. Widgets may use data shared locally between the app and its widget extension. Privacy mode hides supported personal values on screen; it does not delete the underlying information or prevent the cloud service from storing information needed for your account.</p><p>You can change notification permissions in iOS Settings and manage available alert preferences in the app. Turning off notifications does not delete your account.</p></section>
      <section><h2>4. Service providers and sharing</h2><p>We use Supabase for account authentication, database storage and backend services. Google and Apple process sign-in according to your chosen login method, and Apple’s Push Notification service delivers enabled push notifications. Hosting and infrastructure providers process technical information needed to serve the app and website.</p><p>We share information with these providers as needed to operate the service. Information may also be disclosed when required by law or to investigate misuse and protect the security or rights of users and the service. Your saved portfolio and favourites are not published as part of the public market information.</p><p>Providers may process information outside your country. Their services are also subject to their own privacy notices: <a href="https://supabase.com/privacy">Supabase</a>, <a href="https://www.apple.com/legal/privacy/">Apple</a> and <a href="https://policies.google.com/privacy">Google</a>.</p></section>
      <section><h2>5. Advertising and tracking</h2><p>The current app does not include advertising or cross-app advertising tracking. We do not sell your personal information or use your saved portfolio and favourites for targeted advertising.</p></section>
      <section><h2>6. Retention and account deletion</h2><p>Account information and saved content are retained while needed to provide your account and the features you use. To delete your account, open the app’s settings, choose <strong>“Eliminar conta” (Delete account)</strong> and confirm. A successful deletion removes your authentication account and associated account records, including favourites, portfolio entries, alert rules and device notification records, from the active service. The app also clears associated local account data as part of its deletion flow.</p><p>Signing out, uninstalling the app or revoking a sign-in provider’s access does not by itself request deletion of your Invest.ao account. Copies in infrastructure backups or security logs may remain until their applicable retention cycle ends, or where retention is required by law. Such copies are not used to keep your account active.</p></section>
      <section><h2>7. Your choices and requests</h2><p>You can review and change the saved information supported by the app, manage notifications, sign out or delete your account. Depending on the laws that apply to you, you may also request access to, correction of, a copy of, or deletion of your personal information, or object to certain processing. We may need to verify your identity before acting on an account-related request.</p></section>
      <section><h2>8. Security</h2><p>We use authenticated access and account-specific database access controls to limit access to saved personal information. No online service or device storage can be guaranteed completely secure. Protect your device and your Google or Apple account, and avoid sharing access with people you do not trust.</p></section>
      <section><h2>9. Website and external links</h2><p>The landing page’s interactive preview stores its demonstration favourites only in page memory; they reset when the page reloads. It does not connect those selections to an app account. Screenshots show captured information, not live account data. The website does not currently include advertising trackers or an analytics SDK. Infrastructure providers may still process request and security logs.</p><p>If you follow a link to another website, that site’s privacy practices apply.</p></section>
      <section><h2>10. Children</h2><p>Invest.ao is not directed at children. If you believe a child has provided personal information to us, contact us so we can investigate and arrange deletion where appropriate.</p></section>
      <section><h2>11. Changes to this policy</h2><p>We will update this page when our information practices change and revise the date above. Where required, we will provide additional notice or request consent before a material change takes effect.</p></section>
      <section><h2>12. Contact</h2><p>For privacy questions and requests, contact <strong>Informações Invest.AO</strong> at <a href="mailto:info@invest.ao">info@invest.ao</a>. Account deletion is also available directly in the app as described above.</p></section>
      <footer><Link href="/">Back to Invest.ao</Link></footer>
    </main>
  );
}
