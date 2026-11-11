import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("common.yourWatchlist");

export default function Page() {
  return <SignedInPage titleKey="common.yourWatchlist" />;
}
