import type { NextRequest } from 'next/server';

// The browser talks only to this origin; this handler forwards to the Python
// service. A plain `rewrites()` entry cannot set headers on the outgoing
// request, and the upstream sits behind a CDN that answers non-browser user
// agents with a 403 challenge page. The browser Origin is passed through
// unchanged, so the `local_privacy` guard in backend/main.py still applies —
// name this deployment in ARUS_ALLOWED_ORIGINS there.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const UPSTREAM = process.env.ARUS_API_URL || 'http://127.0.0.1:8000';
// Server-side only: this never reaches the browser, which is what lets the
// upstream stay closed to everyone who has not been given the token.
const API_TOKEN = process.env.ARUS_API_TOKEN;
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const FORWARD_REQUEST_HEADERS = ['content-type', 'accept', 'origin'];
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'cache-control',
];

async function proxy(request: NextRequest, path: string[]) {
  const target = new URL(
    `${UPSTREAM.replace(/\/$/, '')}/api/${path.join('/')}`,
  );
  target.search = request.nextUrl.search;

  const headers = new Headers({ 'user-agent': BROWSER_UA });
  if (API_TOKEN) headers.set('authorization', `Bearer ${API_TOKEN}`);
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method;
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, body, cache: 'no-store' });
  } catch {
    return Response.json(
      { detail: 'The assessment service did not respond.' },
      { status: 502 },
    );
  }

  // A challenge page from the CDN is an HTML or text 403 that the client would
  // otherwise report as a dead backend.
  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.ok && !contentType.includes('json')) {
    return Response.json(
      {
        detail: `The assessment service was blocked upstream (${upstream.status}).`,
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set('cache-control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export {
  handler as GET,
  handler as HEAD,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
