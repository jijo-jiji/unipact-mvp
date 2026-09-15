import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Public pages search engines may list. Signed-in areas are kept out via robots.txt.
const PUBLIC_PATHS = ['/', '/register', '/register/company', '/register/student', '/login', '/privacy', '/terms']
const PRIVATE_PATHS = ['/company/', '/campaign/', '/manage-campaign/', '/student/dashboard', '/quest', '/admin', '/settings', '/reset-password']

// Link previews (WhatsApp, LinkedIn, Facebook) need absolute URLs, so the public site address is
// injected at build time from VITE_SITE_URL, and robots.txt + sitemap.xml are generated to match.
const seo = (siteUrl) => ({
  name: 'unipact-seo',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
  generateBundle() {
    const robots = [
      'User-agent: *',
      ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`),
      'Allow: /',
      siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml` : '',
    ].filter(Boolean).join('\n')
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots}\n` })

    if (siteUrl) {
      const urls = PUBLIC_PATHS.map((p) => `  <url><loc>${siteUrl}${p === '/' ? '/' : p}</loc></url>`).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
    }
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
