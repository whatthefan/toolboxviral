import { useCallback, useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'

const FORMATS = [
  ['jpg', 'JPG', 'image/jpeg'],
  ['webp', 'WebP', 'image/webp'],
  ['png', 'PNG', 'image/png'],
]
const SIZES = [['0', 'Tamaño original'], ['2560', '2560 px'], ['1920', '1920 px (Full HD)'], ['1280', '1280 px'], ['1080', '1080 px (redes)'], ['720', '720 px']]

const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const isHeic = (f) => /\.(heic|heif)$/i.test(f.name) || /hei[cf]/.test(f.type)

/** Decodifica cualquier imagen; las HEIC del iPhone se pasan antes a PNG (solo se carga el conversor si hace falta). */
async function decode(file) {
  try {
    return await createImageBitmap(file)
  } catch (e) {
    if (!isHeic(file)) throw e
    const { default: heic2any } = await import('heic2any')
    const png = await heic2any({ blob: file, toType: 'image/png' })
    return createImageBitmap(Array.isArray(png) ? png[0] : png)
  }
}

async function convert(file, { format, quality, maxSide }) {
  const bmp = await decode(file)
  const scale = maxSide ? Math.min(1, maxSide / Math.max(bmp.width, bmp.height)) : 1
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  // El JPG no tiene transparencia: se pone fondo blanco para que no salga negro
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const mime = FORMATS.find(([id]) => id === format)[2]
  const blob = await new Promise((res) => canvas.toBlob(res, mime, format === 'png' ? undefined : quality / 100))
  if (!blob) throw new Error('El navegador no ha podido crear la imagen')
  return { blob, w, h, url: URL.createObjectURL(blob), name: `${file.name.replace(/\.[^.]+$/, '')}.${format}` }
}

export default function ImageConverter() {
  const [files, setFiles] = useState([])
  const [format, setFormat] = useState('jpg')
  const [quality, setQuality] = useState(82)
  const [maxSide, setMaxSide] = useState('0')
  const [items, setItems] = useState([])
  const [over, setOver] = useState(false)
  const input = useRef(null)
  const run = useRef(0)
  const urls = useRef([])

  const add = useCallback((list) => {
    const imgs = [...list].filter((f) => f.type.startsWith('image/') || isHeic(f))
    if (imgs.length) setFiles((prev) => [...prev, ...imgs].slice(0, 30))
  }, [])

  useEffect(() => {
    const onPaste = (e) => add(e.clipboardData?.files || [])
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [add])

  // Convierte de nuevo cada vez que cambian los archivos o las opciones
  useEffect(() => {
    const id = ++run.current
    // Libera las imágenes de la conversión anterior
    urls.current.forEach((u) => URL.revokeObjectURL(u))
    urls.current = []
    setItems(files.map((f) => ({ file: f, status: 'working' })))
    const opts = { format, quality, maxSide: +maxSide }
    const t = setTimeout(async () => {
      for (let i = 0; i < files.length; i++) {
        if (id !== run.current) return
        try {
          const out = await convert(files[i], opts)
          if (id !== run.current) return URL.revokeObjectURL(out.url)
          urls.current.push(out.url)
          setItems((prev) => prev.map((it, j) => (j === i ? { file: files[i], status: 'done', out } : it)))
        } catch {
          setItems((prev) => prev.map((it, j) => (j === i ? { file: files[i], status: 'error' } : it)))
        }
      }
    }, 200)
    return () => clearTimeout(t)
  }, [files, format, quality, maxSide])

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const download = (it) => {
    const a = document.createElement('a')
    a.href = it.out.url
    a.download = it.out.name
    a.click()
  }
  const done = items.filter((it) => it.status === 'done')
  const before = done.reduce((s, it) => s + it.file.size, 0)
  const after = done.reduce((s, it) => s + it.out.blob.size, 0)

  return (
    <div className="space-y-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition ${files.length ? 'min-h-32' : 'min-h-56'} ${over ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-stone-300 hover:border-brand-400 dark:border-stone-700'}`}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
        </div>
        <p className="text-lg font-semibold">{files.length ? 'Añadir más imágenes' : 'Arrastra tus imágenes aquí'}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">o haz clic para elegirlas · también puedes pegarlas con Ctrl+V · hasta 30 a la vez</p>
        <p className="text-xs text-stone-400">HEIC (iPhone), JPG, PNG, WebP, AVIF o GIF</p>
        <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="mb-1.5 text-sm font-medium">Convertir a</p>
          <div role="radiogroup" aria-label="Formato de salida" className="flex rounded-2xl bg-stone-900/5 p-1 dark:bg-white/5">
            {FORMATS.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={format === id} onClick={() => setFormat(id)} className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold transition ${format === id ? 'bg-brand-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'}`}>{label}</button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 flex justify-between text-sm font-medium"><span>Calidad</span><span className="tabular-nums text-stone-500">{format === 'png' ? 'sin pérdida' : `${quality} %`}</span></span>
          <input type="range" min="40" max="100" value={quality} disabled={format === 'png'} onChange={(e) => setQuality(+e.target.value)} className="mt-3 w-full accent-brand-600 disabled:opacity-40" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Lado más largo</span>
          <select value={maxSide} onChange={(e) => setMaxSide(e.target.value)} className="h-12 w-full rounded-2xl border border-stone-900/15 bg-stone-50/60 px-4 dark:border-white/15 dark:bg-white/5">
            {SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl ring-1 ring-stone-900/10 dark:ring-white/10">
          <ul className="divide-y divide-stone-900/5 dark:divide-white/10">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 bg-white p-3 dark:bg-white/5">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-stone-100 dark:bg-white/10">
                  {it.out ? <img src={it.out.url} alt="" className="h-full w-full object-cover" /> : <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{it.out?.name ?? it.file.name}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {it.status === 'error' ? 'No se ha podido leer esta imagen' : it.out ? (
                      <>{kb(it.file.size)} → <strong className="text-stone-800 dark:text-stone-100">{kb(it.out.blob.size)}</strong> · {it.out.w}×{it.out.h}
                        {it.out.blob.size < it.file.size && <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">−{Math.round((1 - it.out.blob.size / it.file.size) * 100)} %</span>}
                      </>
                    ) : 'Convirtiendo…'}
                  </p>
                </div>
                {it.out && <Button variant="ghost" className="px-3 py-2 text-sm" onClick={() => download(it)}>Descargar</Button>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 p-4 dark:bg-white/[0.03]">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {done.length} de {items.length} listas{before > 0 && <> · {kb(before)} → <strong>{kb(after)}</strong></>}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="px-4 py-2.5 text-sm" onClick={() => setFiles([])}>Vaciar</Button>
              <Button className="px-4 py-2.5 text-sm" disabled={!done.length} onClick={() => done.forEach((it, i) => setTimeout(() => download(it), i * 250))}>Descargar todas</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
