import type { ReactNode } from "react";

// The document (<html>, <body>) is rendered by src/app/[locale]/layout.tsx.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
