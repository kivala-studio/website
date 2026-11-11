import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("common.simulateInvestment");

export default function Page() {
  return <SignedInPage titleKey="common.simulateInvestment" />;
}
