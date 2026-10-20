import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const artwork = await readFile(join(process.cwd(), "public/palanca.png"));
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#f5f1e8" }}>
      {/* The native template is black on transparent; use a solid icon background. */}
      <img src={`data:image/png;base64,${artwork.toString("base64")}`} width={180} height={180} alt="" />
    </div>,
    size,
  );
}
