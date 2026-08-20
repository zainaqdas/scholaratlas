import { NextResponse } from "next/server";

/**
 * ads.txt — authorizes ad networks to sell inventory on this domain.
 *
 * Placeholders below. When your AdSense account is approved, replace the
 * first line with the real values from your AdSense "ads.txt" page:
 *   google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
 *
 * Other networks you use get their own lines. ads.txt must be reachable at
 * the root of the domain (https://yourdomain.com/ads.txt) — this route
 * serves exactly that.
 */
export function GET() {
  const body = [
    "# scholaratlas ads.txt",
    "# Replace with your real publisher ID when AdSense is approved:",
    "# google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0",
    "",
  ].join("\n");
  return new NextResponse(body, {
    headers: { "content-type": "text/plain" },
  });
}
