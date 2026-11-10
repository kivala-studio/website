import { notFound } from "next/navigation";

// Unknown paths render the translated 404 inside the site chrome.
export default function UnknownPage() {
  notFound();
}
