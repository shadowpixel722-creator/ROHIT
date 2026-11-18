import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/login", "/register"];

/** Fast cookie-presence gate. Real session validation happens server-side in requireUser(). */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("ep_session")?.value);
  if (!hasSession && !PUBLIC.includes(pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    // Behind the HTTPS proxy on the server, req.nextUrl carries the app's internal address
    // (localhost:3000). Build the redirect from the address the visitor actually used instead.
    const host = req.headers.get("host") ?? req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || req.nextUrl.protocol.replace(":", "");
    return NextResponse.redirect(new URL("/login", `${proto}://${host}`));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
