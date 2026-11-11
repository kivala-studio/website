import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("unusualActivity.title");

export default function Page() {
  return <SignedInPage titleKey="unusualActivity.title" />;
}
