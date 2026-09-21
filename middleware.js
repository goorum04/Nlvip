import { NextResponse } from 'next/server'

// Root domain (no "app." subdomain) shows the marketing landing page instead of the app.
const MARKETING_HOSTS = ['nlvipnutrition.com', 'www.nlvipnutrition.com']

export function middleware(request) {
  const host = request.headers.get('host') || ''
  if (MARKETING_HOSTS.includes(host) && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/landing.html', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/',
}
