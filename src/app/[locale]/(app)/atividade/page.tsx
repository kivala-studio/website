import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("common.activity");

export default function Page() {
  return <SignedInPage titleKey="common.activity" />;
}
