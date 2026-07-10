import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login'];
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.includes(pathname) || pathname === '/') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/form') || pathname.startsWith('/my-data') || pathname.startsWith('/admin')) {
    const accessToken = request.cookies.get('access_token')?.value;

    if (!accessToken) {
      const refreshToken = request.cookies.get('refresh_token')?.value;
      if (!refreshToken) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    if (accessToken) {
      try {
        const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
        const expiry = payload.exp * 1000;
        if (Date.now() >= expiry) {
          return NextResponse.redirect(new URL('/login', request.url));
        }
      } catch {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/form', '/my-data', '/admin'],
};
