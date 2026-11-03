// ads.txt is generated from PUBLIC_ADSENSE_CLIENT (e.g. ca-pub-1234567890123456).
// Until AdSense approves the site the file stays empty, so no wrong publisher ID is ever published.
export function GET() {
  const client = import.meta.env.PUBLIC_ADSENSE_CLIENT || ''
  const pub = client.replace(/^ca-/, '')
  const body = /^pub-\d{10,}$/.test(pub) ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : ''
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
