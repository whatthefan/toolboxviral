import { useCallback, useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import { imagenesAPdf } from '../../lib/pdf.js'

const MAX_LADO = 3000 // suficiente para imprimir en A4 y mantiene el PDF ligero
const isHeic = (f) => /\.(heic|heif)$/i.test(f.name) || /hei[cf]/.test(f.type)
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** Decodifica la imagen (las HEIC del iPhone se pasan antes a PNG) y la deja en JPG para el PDF. */
async function prepararImagen(file) {
  let bmp
  try {
    bmp = await createImageBitmap(file)
  } catch (e) {
    if (!isHeic(file)) throw e
    const { default: heic2any } = await import('heic2any')
    const png = await heic2any({ blob: file, toType: 'image/png' })
    bmp = await createImageBitmap(Array.isArray(png) ? png[0] : png)
  }
  const k = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * k)
  const h = Math.round(bmp.height * k)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // el PDF no lleva transparencia: fondo blanco
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), w, h, url: URL.createObjectURL(blob) }
}

export default function ImagenAPdf() {
  const [items, setItems] = useState([]) // { id, name, status, img }
  const [pagina, setPagina] = useState('a4')
  const [margen, setMargen] = useState('28')
  const [pdf, setPdf] = useState(null)
  const [over, setOver] = useState(false)
  const input = useRef(null)
  const next = useRef(0)

  const add = useCallback((list) => {
    const files = [...list].filter((f) => f.type.startsWith('image/') || isHeic(f)).slice(0, 50)
    files.forEach((file) => {
      const id = ++next.current
      setItems((prev) => [...prev, { id, name: file.name, status: 'working' }])
      prepararImagen(file)
        .then((img) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'done', img } : it))))
        .catch(() => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'error' } : it))))
    })
  }, [])

  useEffect(() => {
    const onPaste = (e) => add(e.clipboardData?.files || [])
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [add])

  // Cualquier cambio invalida el PDF anterior
  useEffect(() => setPdf((p) => { if (p) URL.revokeObjectURL(p.url); return null }), [items, pagina, margen])

  const move = (i, d) => setItems((prev) => { const a = [...prev]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a })
  const remove = (i) => setItems((prev) => { prev[i].img && URL.revokeObjectURL(prev[i].img.url); return prev.filter((_, j) => j !== i) })
  const listas = items.filter((it) => it.status === 'done')
  const crear = () => {
    const blob = imagenesAPdf(listas.map((it) => it.img), { pagina, margen: +margen })
    const url = URL.createObjectURL(blob)
    setPdf({ url, size: blob.size })
    const a = document.createElement('a')
    a.href = url
    a.download = listas.length === 1 ? listas[0].name.replace(/\.[^.]+$/, '') + '.pdf' : 'imagenes.pdf'
    a.click()
  }

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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition ${items.length ? 'min-h-32' : 'min-h-56'} ${over ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-stone-300 hover:border-brand-400 dark:border-stone-700'}`}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
        </div>
        <p className="text-lg font-semibold">{items.length ? 'Añadir más imágenes' : 'Arrastra tus imágenes aquí'}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">o haz clic para elegirlas · también puedes pegarlas con Ctrl+V · cada imagen será una página</p>
        <p className="text-xs text-stone-400">JPG, PNG, WebP, HEIC (iPhone)…</p>
        <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>

      {items.length > 0 && (
        <>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((it, i) => (
              <li key={it.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/10 dark:bg-white/5 dark:ring-white/10">
                <div className="relative grid aspect-[3/4] place-items-center bg-stone-100 dark:bg-white/10">
                  {it.img ? <img src={it.img.url} alt="" className="h-full w-full object-contain" /> : it.status === 'error' ? <span className="p-2 text-center text-xs text-red-600">No se ha podido leer</span> : <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />}
                  <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">{i + 1}</span>
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <button type="button" aria-label="Mover antes" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-white/10"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg></button>
                  <button type="button" aria-label="Quitar" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                  <button type="button" aria-label="Mover después" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-white/10"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg></button>
                </div>
              </li>
            ))}
          </ol>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Tamaño de página</span>
              <select value={pagina} onChange={(e) => setPagina(e.target.value)} className="h-12 w-full rounded-2xl border border-stone-900/15 bg-stone-50/60 px-4 dark:border-white/15 dark:bg-white/5">
                <option value="a4">A4 (para imprimir)</option>
                <option value="imagen">Igual que cada imagen</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Márgenes</span>
              <select value={margen} onChange={(e) => setMargen(e.target.value)} disabled={pagina === 'imagen'} className="h-12 w-full rounded-2xl border border-stone-900/15 bg-stone-50/60 px-4 disabled:opacity-50 dark:border-white/15 dark:bg-white/5">
                <option value="0">Sin márgenes</option>
                <option value="14">Pequeños</option>
                <option value="28">Normales</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button disabled={!listas.length || listas.length < items.filter((it) => it.status !== 'error').length} onClick={crear}>
              Crear y descargar el PDF ({listas.length} {listas.length === 1 ? 'página' : 'páginas'})
            </Button>
            <Button variant="ghost" onClick={() => { items.forEach((it) => it.img && URL.revokeObjectURL(it.img.url)); setItems([]) }}>Empezar de nuevo</Button>
          </div>
          {pdf && <p className="text-center text-sm text-stone-600 dark:text-stone-300">PDF listo: {kb(pdf.size)}. <a href={pdf.url} target="_blank" rel="noopener" className="font-semibold text-brand-700 underline dark:text-brand-300">Abrirlo</a></p>}
        </>
      )}
    </div>
  )
}
