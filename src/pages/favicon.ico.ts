import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const GET: APIRoute = () => {
  const favicon = readFileSync(path.join(process.cwd(), 'public', 'assets', 'favicon.png'));

  return new Response(favicon, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
