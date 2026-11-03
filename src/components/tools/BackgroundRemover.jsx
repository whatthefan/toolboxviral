import { useCallback, useEffect, useRef, useState } from 'react'
import Dropzone from './Dropzone.jsx'
import Button from './Button.jsx'
import { compose, cutout, onProgress, prepare } from '../../lib/cutout.js'

const BACKGROUNDS = [
  { id: 'transparent', label: 'Transparente' },
  { id: '#ffffff', label: 'Blanco' },
  { id: '#000000', label: 'Negro' },
]
const TOOLS = [
  { id: 'compare', label: 'Comparar', icon: 'M12 3v18M8 7l-4 5 4 5M16 7l4 5-4 5' },
  { id: 'keep', label: 'Conservar', icon: 'M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z' },
  { id: 'erase', label: 'Borrar', icon: 'M7 21h10M5.5 13.5 13 6l5 5-7.5 7.5a2 2 0 0 1-2.8 0l-2.2-2.2a2 2 0 0 1 0-2.8z' },
]
const UNDO_STEPS = 10

const copyOf = (canvas) => {
  const c = document.createElement('canvas')
  c.width = canvas.width
  c.height = canvas.height
  c.getContext('2d').drawImage(canvas, 0, 0)
  return c
}

/** Una pincelada de borde suave sobre la máscara: blanco para conservar, se recorta para borrar. */
function dab(ctx, x, y, r, keep) {
  const g = ctx.createRadialGradient(x, y, r * 0.55, x, y, r)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = keep ? 'source-over' : 'destination-out'
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export default function BackgroundRemover() {
  const [file, setFile] = useState(null)
  const [original, setOriginal] = useState(null)
  const [status, setStatus] = useState('idle') // idle | working | done | error
  const [progress, setProgress] = useState({ label: '', pct: null })
  const [bg, setBg] = useState('transparent')
  const [split, setSplit] = useState(50)
  const [tool, setTool] = useState('compare')
  const [brush, setBrush] = useState(36)
  const [undoCount, setUndoCount] = useState(0)
  const [edited, setEdited] = useState(false)
  const [cursor, setCursor] = useState(null)
  const run = useRef(0)
  const cut = useRef(null) // { bitmap, mask, photo, auto }
  const view = useRef(null)
  const undo = useRef([])
  const stroke = useRef(null)
  const frame = useRef(0)

  // El recortador se prepara en cuanto se abre la página, para que el recorte sea inmediato
  // (salvo con el ahorro de datos activado: entonces se descarga al elegir la foto)
  useEffect(() => {
    if (!navigator.connection?.saveData) prepare().catch(() => {})
  }, [])
  // Si se sube la foto antes de que esté listo, se enseña cuánto falta
  useEffect(() => onProgress((pct) => setProgress((p) => (p.label.startsWith('Preparando') ? { label: `Preparando… ${pct} %`, pct } : p))), [])

  // Libera la memoria de las imágenes anteriores
  useEffect(() => () => original && URL.revokeObjectURL(original), [original])
  useEffect(() => () => cut.current?.bitmap.close?.(), [])

  /** Pinta en pantalla la foto recortada con la máscara actual. */
  const draw = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const c = cut.current
      const canvas = view.current
      if (!c || !canvas) return
      if (canvas.width !== c.mask.width) {
        canvas.width = c.mask.width
        canvas.height = c.mask.height
      }
      const ctx = canvas.getContext('2d')
      ctx.globalCompositeOperation = 'copy'
      ctx.drawImage(c.photo, 0, 0)
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(c.mask, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
    })
  }, [])

  const process = useCallback(async (f) => {
    const id = ++run.current
    setFile(f)
    setOriginal(URL.createObjectURL(f))
    setSplit(50)
    setTool('compare')
    setEdited(false)
    undo.current = []
    setUndoCount(0)
    cut.current?.bitmap.close?.()
    cut.current = null
    setStatus('working')
    let listo = false
    prepare().then(() => { listo = true; if (id === run.current) setProgress({ label: 'Quitando el fondo…', pct: null }) }).catch(() => {})
    await Promise.resolve()
    setProgress(listo ? { label: 'Quitando el fondo…', pct: null } : { label: 'Preparando…', pct: null })
    try {
      const { bitmap, mask } = await cutout(f)
      if (id !== run.current) return bitmap.close?.()
      // Copia de la foto al tamaño de la máscara, para que pintar vaya fluido
      const photo = document.createElement('canvas')
      photo.width = mask.width
      photo.height = mask.height
      const pctx = photo.getContext('2d')
      pctx.imageSmoothingQuality = 'high'
      pctx.drawImage(bitmap, 0, 0, mask.width, mask.height)
      cut.current = { bitmap, mask, photo, auto: copyOf(mask) }
      setStatus('done')
    } catch (err) {
      console.error(err)
      if (id === run.current) setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (status === 'done') draw()
  }, [status, draw])

  // Pincel: convierte la posición del dedo o del ratón a píxeles de la máscara
  const point = (e) => {
    const rect = view.current.getBoundingClientRect()
    const k = view.current.width / rect.width
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k, r: (brush / 2) * k, sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }
  const paint = (from, to) => {
    const ctx = cut.current.mask.getContext('2d')
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(dist / (to.r / 4)))
    for (let i = 1; i <= steps; i++) dab(ctx, from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, to.r, tool === 'keep')
    ctx.globalCompositeOperation = 'source-over'
    draw()
  }
  const onDown = (e) => {
    if (tool === 'compare' || !cut.current) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    undo.current.push(copyOf(cut.current.mask))
    if (undo.current.length > UNDO_STEPS) undo.current.shift()
    setUndoCount(undo.current.length)
    setEdited(true)
    const p = point(e)
    stroke.current = p
    paint(p, p)
    setCursor(p)
  }
  const onMove = (e) => {
    if (tool === 'compare' || !cut.current) return
    const p = point(e)
    setCursor(p)
    if (!stroke.current) return
    paint(stroke.current, p)
    stroke.current = p
  }
  const onUp = () => { stroke.current = null }

  const replaceMask = (canvas) => {
    const ctx = cut.current.mask.getContext('2d')
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(canvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    draw()
  }
  const undoLast = () => {
    const prev = undo.current.pop()
    if (prev) replaceMask(prev)
    setUndoCount(undo.current.length)
  }
  const restore = () => {
    undo.current.push(copyOf(cut.current.mask))
    if (undo.current.length > UNDO_STEPS) undo.current.shift()
    setUndoCount(undo.current.length)
    replaceMask(cut.current.auto)
    setEdited(false)
  }

  const download = () => {
    const { bitmap, mask } = cut.current
    const canvas = compose(bitmap, mask, bg === 'transparent' ? null : bg)
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = (file?.name.replace(/\.[^.]+$/, '') || 'imagen') + '-sin-fondo.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    }, 'image/png')
  }

  const reset = () => {
    run.current++
    cut.current?.bitmap.close?.()
    cut.current = null
    setFile(null)
    setOriginal(null)
    setStatus('idle')
  }

  if (status === 'idle') return <Dropzone onFile={process} hint="Funciona mejor con personas, animales y productos" />

  const done = status === 'done'
  const painting = done && tool !== 'compare'
  const bgStyle = bg === 'transparent' ? undefined : { backgroundColor: bg }

  return (
    <div className="space-y-5">
      <div className={`relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl select-none ${bg === 'transparent' ? 'checkerboard' : ''}`} style={bgStyle}>
        {/* Mientras se pinta, la foto original se ve tenue debajo para saber qué se puede recuperar */}
        {done && <img src={original} alt="" aria-hidden="true" draggable="false" className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity ${tool === 'keep' ? 'opacity-35' : 'opacity-0'}`} />}
        {done ? (
          <canvas
            ref={view}
            aria-label="Imagen sin fondo"
            role="img"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => { if (!stroke.current) setCursor(null) }}
            className={`relative block max-h-[60vh] max-w-full ${painting ? 'cursor-none touch-none' : ''}`}
          />
        ) : (
          <img src={original} alt="" className="block max-h-[60vh] max-w-full opacity-0" />
        )}
        {tool === 'compare' && (
          <img
            src={original}
            alt="Imagen original"
            draggable="false"
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ clipPath: done ? `inset(0 ${100 - split}% 0 0)` : undefined }}
          />
        )}
        {painting && cursor && (
          <span
            className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.45)]"
            style={{ width: brush, height: brush, left: cursor.sx - brush / 2, top: cursor.sy - brush / 2, background: tool === 'keep' ? 'rgba(124,58,237,.25)' : 'rgba(239,68,68,.22)' }}
          />
        )}
        {status === 'working' && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-950/60 p-6 text-center text-white backdrop-blur-sm">
            <div className="w-full max-w-xs">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              <p className="font-semibold">{progress.label}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className={`h-full rounded-full bg-violet-400 transition-all ${progress.pct === null ? 'w-1/3 animate-pulse' : ''}`}
                  style={progress.pct === null ? undefined : { width: `${progress.pct}%` }}
                />
              </div>
            </div>
          </div>
        )}
        {done && tool === 'compare' && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.2)]" style={{ left: `${split}%` }}>
              <span className="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-xs font-bold text-zinc-700 shadow-lg">⇆</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={split}
              onChange={(e) => setSplit(+e.target.value)}
              aria-label="Comparar antes y después"
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
            <span className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">Antes</span>
            <span className="pointer-events-none absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">Después</span>
          </>
        )}
      </div>

      {status === 'error' && (
        <p className="rounded-xl bg-red-50 p-4 text-center text-red-700 dark:bg-red-950/40 dark:text-red-300">
          No hemos podido procesar esta imagen. Prueba con otra o con un navegador actualizado (Chrome, Edge, Firefox o Safari).
        </p>
      )}

      {done && (
        <div className="mx-auto max-w-xl space-y-3 rounded-2xl bg-zinc-900/[0.04] p-3 dark:bg-white/5">
          <div role="radiogroup" aria-label="Herramienta" className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tool === t.id}
                onClick={() => { setTool(t.id); setCursor(null) }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition ${tool === t.id ? (t.id === 'erase' ? 'bg-red-600 text-white' : 'bg-violet-600 text-white') : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
                {t.label}
              </button>
            ))}
          </div>
          {tool === 'compare' ? (
            <p className="px-1 text-center text-sm text-zinc-600 dark:text-zinc-300">
              ¿Se ha llevado algo que querías o ha dejado algo de más? Elige <strong>Conservar</strong> o <strong>Borrar</strong> y pinta encima con el dedo o el ratón.
            </p>
          ) : (
            <>
              <p className="px-1 text-center text-sm text-zinc-600 dark:text-zinc-300">
                {tool === 'keep' ? 'Pinta sobre lo que quieres recuperar, por ejemplo una mano o un papel.' : 'Pinta sobre lo que quieres quitar, por ejemplo una cara o un objeto.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 px-1">
                <label className="flex min-w-40 flex-1 items-center gap-3 text-sm">
                  <span className="shrink-0 text-zinc-500">Pincel</span>
                  <input type="range" min="8" max="120" value={brush} onChange={(e) => setBrush(+e.target.value)} aria-label="Tamaño del pincel" className="w-full accent-violet-600" />
                </label>
                <div className="flex gap-2">
                  <Button variant="ghost" className="whitespace-nowrap px-3 py-2 text-sm" disabled={!undoCount} onClick={undoLast}>Deshacer</Button>
                  <Button variant="ghost" className="whitespace-nowrap px-3 py-2 text-sm" disabled={!edited} onClick={restore}>Deshacer todo</Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {done && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-zinc-500">Fondo:</span>
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBg(b.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${bg === b.id ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' : 'border-zinc-300 dark:border-zinc-700'}`}
            >
              {b.label}
            </button>
          ))}
          <label className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
            Color
            <input type="color" value={bg.startsWith('#') ? bg : '#7c3aed'} onChange={(e) => setBg(e.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
          </label>
        </div>
      )}

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {done && <Button onClick={download}>Descargar PNG</Button>}
        <Button variant="ghost" onClick={reset}>Probar con otra imagen</Button>
      </div>
    </div>
  )
}
