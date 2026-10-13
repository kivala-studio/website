import "server-only";
import qr from "qrcode-generator";
export function appDistribution(): {
  url: string | null;
  beta: boolean;
  qr: string | null;
} {
  // Verified through Apple lookup for Angola: bundle ao.invest.iosapp, seller URL invest.ao.
  const value =
    process.env.IOS_DISTRIBUTION_URL ??
    "https://apps.apple.com/ao/app/invest-ao/id6812907673";
  if (!value) return { url: null, beta: false, qr: null };
  try {
    const url = new URL(value);
    const beta = url.hostname === "testflight.apple.com";
    const valid =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      ((beta && /^\/join\/[a-zA-Z0-9]+$/.test(url.pathname)) ||
        (url.hostname === "apps.apple.com" && /\/id\d+$/.test(url.pathname)));
    if (!valid) return { url: null, beta: false, qr: null };
    const code = qr(0, "M");
    code.addData(url.toString());
    code.make();
    return {
      url: url.toString(),
      beta,
      qr: `data:image/svg+xml,${encodeURIComponent(code.createSvgTag({ cellSize: 4, margin: 16, scalable: true }))}`,
    };
  } catch {
    return { url: null, beta: false, qr: null };
  }
}
