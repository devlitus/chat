import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  // CSP: connect-src incluye las APIs externas usadas por los widgets MCP
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.tailwindcss.com fonts.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com cdn.tailwindcss.com; font-src 'self' fonts.gstatic.com fonts.googleapis.com; frame-src 'self'; connect-src 'self' https://api.open-meteo.com https://api.bigdatacloud.net https://api.coingecko.com; img-src 'self' data:"
  );
  return response;
});
