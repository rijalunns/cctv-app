import { NextResponse } from 'next/server';

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // 1. HARD BLOCK sensitive go2rtc endpoints regardless of authentication
  const blockedPrefixes = [
    '/stream/api/config',
    '/stream/api/streams',
    '/stream/api/restart',
    '/stream/api/add',
    '/stream/api/del',
    '/stream/api/backup',
  ];

  for (const prefix of blockedPrefixes) {
    if (pathname.startsWith(prefix)) {
      return new NextResponse('Access Denied: Endpoint is restricted.', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  // 2. HTTP Basic Auth for all protected routes
  const authUser = process.env.CCTV_USER || 'admin';
  const authPass = process.env.CCTV_PASS || 'CctvBojong@2026!';

  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    try {
      const authValue = basicAuth.split(' ')[1];
      if (authValue) {
        const decoded = atob(authValue);
        const [user, pwd] = decoded.split(':');

        if (user === authUser && pwd === authPass) {
          return NextResponse.next();
        }
      }
    } catch (e) {
      // Invalid base64 or format
    }
  }

  return new NextResponse('Authentication Required: Sentinel CCTV Dashboard', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Sentinel CCTV Dashboard"',
      'Content-Type': 'text/plain',
    },
  });
}

// Protect all routes except static build files and favicon
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
