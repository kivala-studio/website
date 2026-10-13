import { ImageResponse } from "next/og";

export const alt =
  "Invest.ao — Mercado de capitais em Angola. Descobre aqui. Acompanha no iPhone..";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#090b0f",
          color: "#f5f7fa",
          padding: "64px 76px",
          fontFamily: "sans-serif",
          borderBottom: "12px solid #5a9bff",
        }}
      >
        <div style={{ display: "flex", fontSize: 42, letterSpacing: -2 }}>
          invest<span style={{ color: "#5a9bff" }}>.</span>ao
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 76,
            lineHeight: 1.1,
            letterSpacing: -3,
          }}
        >
          <span>Mercado de capitais</span>
          <span style={{ color: "#5a9bff" }}>em Angola.</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#a6afbd",
            fontSize: 26,
          }}
        >
          <span>Descobre aqui. Acompanha no iPhone.</span>
          <span>invest.ao</span>
        </div>
      </div>
    ),
    size,
  );
}
