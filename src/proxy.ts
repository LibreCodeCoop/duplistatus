import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configuration for IP whitelisting
const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST?.split(',').map(ip => ip.trim()) || [];
const ENABLE_IP_WHITELIST = process.env.ENABLE_ADMIN_IP_WHITELIST === 'true';

// Public paths that don't require IP whitelisting
const PUBLIC_PATHS = [
  '/api/upload',           // Backup upload endpoint (for Duplicati servers)
  '/api/health',           // Health check endpoint
  '/_next',                // Next.js static assets
  '/favicon.ico',          // Favicon
];

function getClientIp(request: NextRequest): string {
  // Check various headers for real IP (in order of preference)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback to localhost (development)
  return '127.0.0.1';
}

function isIpWhitelisted(ip: string): boolean {
  // Always allow localhost/loopback
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }
  
  // Check whitelist
  return ADMIN_IP_WHITELIST.some(whitelistedIp => {
    // Exact match
    if (whitelistedIp === ip) {
      return true;
    }
    
    // CIDR notation support (simple /24, /16, /8)
    if (whitelistedIp.includes('/')) {
      const [network, cidr] = whitelistedIp.split('/');
      const cidrNum = parseInt(cidr, 10);
      
      // Only support /8, /16, /24 for simplicity
      if (cidrNum === 24) {
        const networkPrefix = network.split('.').slice(0, 3).join('.');
        const ipPrefix = ip.split('.').slice(0, 3).join('.');
        return networkPrefix === ipPrefix;
      } else if (cidrNum === 16) {
        const networkPrefix = network.split('.').slice(0, 2).join('.');
        const ipPrefix = ip.split('.').slice(0, 2).join('.');
        return networkPrefix === ipPrefix;
      } else if (cidrNum === 8) {
        const networkPrefix = network.split('.')[0];
        const ipPrefix = ip.split('.')[0];
        return networkPrefix === ipPrefix;
      }
    }
    
    return false;
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip IP check if whitelist is disabled
  if (!ENABLE_IP_WHITELIST) {
    return NextResponse.next();
  }
  
  // Allow public paths without IP check
  const isPublicPath = PUBLIC_PATHS.some(publicPath => 
    pathname.startsWith(publicPath)
  );
  
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  // Check IP whitelist for admin/dashboard access
  const clientIp = getClientIp(request);
  
  if (!isIpWhitelisted(clientIp)) {
    console.log(`[Security] Blocked access from ${clientIp} to ${pathname}`);
    
    return new NextResponse(
      JSON.stringify({
        error: 'Access Denied',
        message: 'Your IP address is not authorized to access this resource.',
        ip: clientIp
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  // IP is whitelisted, allow access
  return NextResponse.next();
}

// Configure which routes to run proxy on
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
