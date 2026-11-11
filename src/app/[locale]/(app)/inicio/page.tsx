import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("common.home");

export default function Page() {
  return <SignedInPage titleKey="common.home" />;
}
