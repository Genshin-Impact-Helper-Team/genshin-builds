import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import { webcore } from 'webcoreui/integration';

const isVercel = process.env.VERCEL === '1';

export default defineConfig({
  site:
    isVercel && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://akhalaplo.github.io',
  base: isVercel ? '/' : '/genshin-builds',
  integrations: [webcore(), pagefind()],
});
