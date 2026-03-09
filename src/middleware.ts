import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;

  // If no site password configured, skip gate entirely
  if (!sitePassword) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Paths that should never be gated
  const excluded = [
    "/gate",
    "/api/gate",
    "/api/admin",
    "/admin/login",
    "/api/groupme",
    "/_next",
    "/favicon.ico",
  ];

  if (excluded.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for site access cookie
  const cookie = request.cookies.get("site_access");
  if (cookie?.value === "granted") {
    return NextResponse.next();
  }

  // Redirect to gate page
  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
