import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("common.portfolio");

export default function Page() {
  return <SignedInPage titleKey="common.portfolio" />;
}
