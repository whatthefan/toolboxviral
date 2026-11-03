import { useCallback, useEffect, useRef, useState } from 'react'
import Dropzone from './Dropzone.jsx'
import Button from './Button.jsx'
import { onProgress, prepare, removeBackground } from '../../lib/cutout.js'

const BACKGROUNDS = [
  { id: 'transparent', label: 'Transparente' },
  { id: '#ffffff', label: 'Blanco' },
  { id: '#000000', label: 'Negro' },
]

export default function BackgroundRemover() {
  const [file, setFile] = useState(null)
  const [original, setOriginal] = useState(null)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('idle') // idle | working | done | error
  const [progress, setProgress] = useState({ label: '', pct: null })
  const [bg, setBg] = useState('transparent')
  const [split, setSplit] = useState(50)
  const run = useRef(0)

  // El recortador se prepara en cuanto se abre la página, para que el recorte sea inmediato
  useEffect(() => {
    prepare().catch(() => {})
  }, [])
  // Si se sube la foto antes de que esté listo, se enseña cuánto falta
  useEffect(() => onProgress((pct) => setProgress((p) => (p.label.startsWith('Preparando') ? { label: `Preparando… ${pct} %`, pct } : p))), [])

  // Libera la memoria de las imágenes anteriores
  useEffect(() => () => original && URL.revokeObjectURL(original), [original])
  useEffect(() => () => result && URL.revokeObjectURL(result), [result])

  const process = useCallback(async (f) => {
    const id = ++run.current
    setFile(f)
    setOriginal(URL.createObjectURL(f))
    setResult(null)
    setSplit(50)
    setStatus('working')
    let listo = false
    prepare().then(() => { listo = true; if (id === run.current) setProgress({ label: 'Quitando el fondo…', pct: null }) }).catch(() => {})
    await Promise.resolve()
    setProgress(listo ? { label: 'Quitando el fondo…', pct: null } : { label: 'Preparando…', pct: null })
    try {
      const blob = await removeBackground(f)
      if (id !== run.current) return
      setResult(URL.createObjectURL(blob))
      setStatus('done')
    } catch (err) {
      console.error(err)
      if (id === run.current) setStatus('error')
    }
  }, [])

  const download = async () => {
    const name = (file?.name.replace(/\.[^.]+$/, '') || 'imagen') + '-sin-fondo.png'
    let href = result
    if (bg !== 'transparent') {
      const img = await loadImage(result)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      href = canvas.toDataURL('image/png')
    }
    const a = document.createElement('a')
    a.href = href
    a.download = name
    a.click()
  }

  const reset = () => {
    run.current++
    setFile(null)
    setOriginal(null)
    setResult(null)
    setStatus('idle')
  }

  if (status === 'idle') return <Dropzone onFile={process} hint="Funciona mejor con personas, animales y productos" />

  const bgStyle = bg === 'transparent' ? undefined : { backgroundColor: bg }

  return (
    <div className="space-y-6">
      <div className={`relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl ${bg === 'transparent' ? 'checkerboard' : ''}`} style={bgStyle}>
        {/* Resultado debajo, original encima recortado según el deslizador */}
        {result ? (
          <img src={result} alt="Imagen sin fondo" className="block max-h-[60vh] max-w-full" />
        ) : (
          <img src={original} alt="" className="block max-h-[60vh] max-w-full opacity-0" />
        )}
        <img
          src={original}
          alt="Imagen original"
          className="absolute inset-0 h-full w-full"
          style={{ clipPath: result ? `inset(0 ${100 - split}% 0 0)` : undefined }}
        />
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
        {result && (
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
            <span className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">Antes</span>
            <span className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">Después</span>
          </>
        )}
      </div>

      {status === 'error' && (
        <p className="rounded-xl bg-red-50 p-4 text-center text-red-700 dark:bg-red-950/40 dark:text-red-300">
          No hemos podido procesar esta imagen. Prueba con otra o con un navegador actualizado (Chrome, Edge, Firefox o Safari).
        </p>
      )}

      {status === 'done' && (
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
        {status === 'done' && <Button onClick={download}>Descargar PNG</Button>}
        <Button variant="ghost" onClick={reset}>Probar con otra imagen</Button>
      </div>
    </div>
  )
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
