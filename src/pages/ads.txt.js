// ads.txt is generated from the AdSense publisher ID in config.js (PUBLIC_ADSENSE_CLIENT overrides it).
// With a missing or malformed ID the file stays empty, so no wrong publisher ID is ever published.
import { ADSENSE } from '../config.js'

export function GET() {
  const client = ADSENSE.client
  const pub = client.replace(/^ca-/, '')
  const body = /^pub-\d{10,}$/.test(pub) ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : ''
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
