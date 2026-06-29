import { defineConfig } from 'astro/config';

const isVercel = process.env.VERCEL === '1';

export default defineConfig({
  site:
    isVercel && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://akhalaplo.github.io',
  base: isVercel ? '/' : '/genshin-builds',
  image: {
    domains: ['wiki.hoyolab.com', 'upload-static.hoyoverse.com'],
  },
});
