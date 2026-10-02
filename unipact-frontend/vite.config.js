import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Search marketing lives on unipact.my; this app is the product and stays out of the index.
// That is enforced by an `X-Robots-Tag: noindex, follow` header (see vercel.json), not by a
// blanket robots.txt Disallow: a Disallow stops crawlers fetching the page at all, so Google
// would never read the noindex and could still list these URLs from the links on unipact.my.
// Crawling therefore stays allowed, `follow` lets link equity pass, and no sitemap is published.
const PRIVATE_PATHS = ['/company/', '/campaign/', '/manage-campaign/', '/student/dashboard', '/quest', '/admin', '/settings', '/reset-password', '/join-club', '/verify-email', '/payment/return']

// Link previews (WhatsApp, LinkedIn, Facebook) need absolute URLs, so the public site address is
// injected at build time from VITE_SITE_URL.
const seo = (siteUrl) => ({
  name: 'unipact-seo',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
  generateBundle() {
    const robots = [
      'User-agent: *',
      ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`),
      'Allow: /',
    ].join('\n')
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots}\n` })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL || '').replace(/\/$/, '')
  if (mode === 'production' && !siteUrl) {
    console.warn('\n[unipact] VITE_SITE_URL is not set: link previews and sitemap.xml will use relative URLs.\n')
  }
  return {
    plugins: [react(), seo(siteUrl)],
  }
})
