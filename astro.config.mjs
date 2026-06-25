import { defineConfig } from 'astro/config';

const site = process.env.PUBLIC_SITE_ORIGIN ?? 'https://www.juleshaggard.com';
const base = process.env.PUBLIC_SITE_BASE;

export default defineConfig({
  output: 'static',
  site,
  ...(base ? { base } : {}),
});
