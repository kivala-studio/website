import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("home.contextCard.availableSummaries");

export default function Page() {
  return <SignedInPage titleKey="home.contextCard.availableSummaries" />;
}
