import { NextRequest, NextResponse } from "next/server";

// CSP violation sink. Browsers POST a JSON body describing the blocked
// resource; we log it as structured JSON on stderr so Loki (B1.2) can
// aggregate and Grafana can alert on sudden spikes. No in-process
// counter to keep this route stateless across Next SSR workers.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const violation = body?.["csp-report"] ?? body;
    console.warn(
      JSON.stringify({
        kind: "csp_violation",
        ts: new Date().toISOString(),
        ua: req.headers.get("user-agent") ?? "",
        ip: req.headers.get("x-forwarded-for")
          ?? req.headers.get("x-real-ip")
          ?? "",
        violation,
      }),
    );
  } catch {
    // Malformed body — drop silently. Browser won't retry.
  }
  return new NextResponse(null, { status: 204 });
}
