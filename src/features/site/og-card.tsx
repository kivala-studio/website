import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

// Light tokens from src/ui/theme/tokens.css (the brand's default canvas for shared images).
const CANVAS = "#f2f3f5";
const PRIMARY_TEXT = "#182231";
const ACCENT = "#1854c5";
const CHART_GRID = "#cbd2dc";

const palanca = readFile(path.join(process.cwd(), "public/brand/palanca.png")).then(
  (data) => `data:image/png;base64,${data.toString("base64")}`,
);

/** The shared Open Graph card (1200 × 630): brand, a title and the accent line. Long titles get a smaller size. */
export async function ogCard({ appName, title }: { appName: string; title: string }): Promise<ImageResponse> {
  const size = title.length > 90 ? 52 : title.length > 50 ? 62 : 76;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: CANVAS,
          color: PRIMARY_TEXT,
          position: "relative",
        }}
      >
        <svg width="1200" height="260" viewBox="0 0 1200 260" style={{ position: "absolute", left: 0, bottom: 0 }}>
          <line x1="0" y1="80" x2="1200" y2="80" stroke={CHART_GRID} strokeWidth="1" />
          <line x1="0" y1="170" x2="1200" y2="170" stroke={CHART_GRID} strokeWidth="1" />
          <path
            d="M0 230 L120 222 L240 226 L360 204 L480 208 L600 182 L720 188 L840 150 L960 156 L1080 112 L1200 96"
            fill="none"
            stroke={ACCENT}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori into a PNG, not the DOM. */}
          <img src={await palanca} width={72} height={72} alt="" />
          <span style={{ fontSize: 40, letterSpacing: 1 }}>{appName}</span>
        </div>
        <div style={{ display: "flex", fontSize: size, lineHeight: 1.1, letterSpacing: -2, maxWidth: 1040, marginBottom: 170 }}>
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
