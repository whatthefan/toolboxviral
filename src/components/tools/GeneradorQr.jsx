import { useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import Button from './Button.jsx'

const TIPOS = [['url', 'Enlace'], ['texto', 'Texto'], ['wifi', 'WiFi'], ['email', 'Email'], ['tel', 'Teléfono']]
const esc = (s) => s.replace(/([\;,:"])/g, '\\$1')

/** El texto que va dentro del QR según el tipo. */
function contenido(tipo, v) {
  if (tipo === 'wifi') return v.ssid ? `WIFI:T:${v.cifrado};S:${esc(v.ssid)};P:${esc(v.clave)};;` : ''
  if (tipo === 'email') return v.email ? `mailto:${v.email}` : ''
  if (tipo === 'tel') return v.tel ? `tel:${v.tel.replace(/\s/g, '')}` : ''
  if (tipo === 'url') return v.url ? (/^[a-z]+:\/\//i.test(v.url) ? v.url : `https://${v.url}`) : ''
  return v.texto
}

export default function GeneradorQr() {
  const [tipo, setTipo] = useState('url')
  const [v, setV] = useState({ url: '', texto: '', ssid: '', clave: '', cifrado: 'WPA', email: '', tel: '' })
  const [color, setColor] = useState('#111111')
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  const texto = contenido(tipo, v)

  const qr = useMemo(() => {
    if (!texto) return null
    try {
      const q = qrcode(0, 'M')
      q.addData(unescape(encodeURIComponent(texto))) // UTF-8 para tildes y eñes
      q.make()
      return q
    } catch {
      return null
    }
  }, [texto])

  const svg = useMemo(() => {
    if (!qr) return ''
    const n = qr.getModuleCount()
    const m = 4 // margen de 4 módulos, el que pide el estándar
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`
  }, [qr, color])

  const descargar = async (formato) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.download = `codigo-qr.${formato}`
    if (formato === 'svg') a.href = URL.createObjectURL(blob)
    else {
      const img = new Image()
      img.src = URL.createObjectURL(blob)
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1024
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, 1024, 1024)
      a.href = canvas.toDataURL('image/png')
    }
    a.click()
  }

  const campo = 'h-12 w-full rounded-2xl border border-stone-900/15 bg-stone-50/60 px-4 dark:border-white/15 dark:bg-white/5'
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Tipo de QR" className="flex flex-wrap gap-1 rounded-2xl bg-stone-900/5 p-1 dark:bg-white/5">
          {TIPOS.map(([id, t]) => (
            <button key={id} type="button" role="radio" aria-checked={tipo === id} onClick={() => setTipo(id)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${tipo === id ? 'bg-brand-600 text-white shadow' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'}`}>{t}</button>
          ))}
        </div>
        {tipo === 'url' && <label className="block"><span className="mb-1.5 block text-sm font-medium">Enlace</span><input className={campo} value={v.url} onChange={set('url')} placeholder="tuweb.com o instagram.com/tuperfil" inputMode="url" /></label>}
        {tipo === 'texto' && <label className="block"><span className="mb-1.5 block text-sm font-medium">Texto</span><textarea className={`${campo} h-28 py-3`} value={v.texto} onChange={set('texto')} placeholder="Escribe lo que quieras" /></label>}
        {tipo === 'wifi' && (
          <>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre de la red (SSID)</span><input className={campo} value={v.ssid} onChange={set('ssid')} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Contraseña</span><input className={campo} value={v.clave} onChange={set('clave')} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Seguridad</span><select className={campo} value={v.cifrado} onChange={set('cifrado')}><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">Sin contraseña</option></select></label>
          </>
        )}
        {tipo === 'email' && <label className="block"><span className="mb-1.5 block text-sm font-medium">Email</span><input className={campo} value={v.email} onChange={set('email')} inputMode="email" /></label>}
        {tipo === 'tel' && <label className="block"><span className="mb-1.5 block text-sm font-medium">Teléfono</span><input className={campo} value={v.tel} onChange={set('tel')} placeholder="+34 600 000 000" inputMode="tel" /></label>}
        <label className="flex items-center gap-3 text-sm font-medium">Color <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
        <p className="text-xs text-stone-500 dark:text-stone-400">El QR es estático: funciona para siempre, no caduca y no pasa por ningún servidor. Usa un color oscuro para que lo lean bien todos los móviles.</p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="grid aspect-square w-full max-w-72 place-items-center rounded-3xl bg-white p-3 ring-1 ring-stone-900/10">
          {svg ? <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="p-6 text-center text-sm text-stone-400">Escribe algo y aparecerá tu código QR</p>}
        </div>
        <div className="flex gap-2">
          <Button disabled={!svg} onClick={() => descargar('png')}>Descargar PNG</Button>
          <Button variant="ghost" disabled={!svg} onClick={() => descargar('svg')}>SVG</Button>
        </div>
      </div>
    </div>
  )
}
