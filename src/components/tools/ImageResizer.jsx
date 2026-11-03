import { useCallback, useEffect, useRef, useState } from 'react'
import Dropzone from './Dropzone.jsx'
import Button from './Button.jsx'

const PRESETS = [
  { id: 'reels', label: 'Reels / TikTok / Shorts', w: 1080, h: 1920 },
  { id: 'story', label: 'Story de Instagram', w: 1080, h: 1920 },
  { id: 'ig-portrait', label: 'Post Instagram vertical', w: 1080, h: 1350 },
  { id: 'ig-square', label: 'Post Instagram cuadrado', w: 1080, h: 1080 },
  { id: 'yt-thumb', label: 'Miniatura de YouTube', w: 1280, h: 720 },
  { id: 'yt-banner', label: 'Banner de YouTube', w: 2560, h: 1440 },
  { id: 'x-post', label: 'Post de X (Twitter)', w: 1600, h: 900 },
  { id: 'fb-cover', label: 'Portada de Facebook', w: 820, h: 312 },
  { id: 'li-banner', label: 'Banner de LinkedIn', w: 1584, h: 396 },
  { id: 'custom', label: 'Personalizado', w: 1200, h: 1200 },
]

const FORMATS = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export default function ImageResizer() {
  const [img, setImg] = useState(null)
  const [name, setName] = useState('imagen')
  const [presetId, setPresetId] = useState('reels')
  const [custom, setCustom] = useState({ w: 1200, h: 1200 })
  const [fit, setFit] = useState('contain')
  const [bg, setBg] = useState('blur')
  const [color, setColor] = useState('#000000')
  const [format, setFormat] = useState('jpg')
  const [quality, setQuality] = useState(90)
  const [size, setSize] = useState(null)
  const canvas = useRef(null)

  const preset = PRESETS.find((p) => p.id === presetId)
  const W = presetId === 'custom' ? clamp(custom.w) : preset.w
  const H = presetId === 'custom' ? clamp(custom.h) : preset.h

  const onFile = useCallback((file) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { setImg(image); URL.revokeObjectURL(url) }
    image.src = url
    setName(file.name.replace(/\.[^.]+$/, ''))
  }, [])

  // Redibuja el lienzo cada vez que cambia una opción
  useEffect(() => {
    if (!img || !canvas.current) return
    const c = canvas.current
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    const iw = img.naturalWidth
    const ih = img.naturalHeight

    if (fit === 'contain') {
      if (bg === 'blur') {
        // Desenfoque compatible con todos los navegadores: se pinta en pequeño y se amplía.
        const small = document.createElement('canvas')
        small.width = Math.max(1, Math.round(W / 24))
        small.height = Math.max(1, Math.round(H / 24))
        const sctx = small.getContext('2d')
        drawCover(sctx, img, small.width, small.height, iw, ih)
        ctx.drawImage(small, 0, 0, W, H)
        ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.fillRect(0, 0, W, H)
      } else {
        ctx.fillStyle = color
        ctx.fillRect(0, 0, W, H)
      }
      const s = Math.min(W / iw, H / ih)
      ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s)
    } else {
      drawCover(ctx, img, W, H, iw, ih)
    }

    const t = setTimeout(() => c.toBlob((b) => setSize(b?.size ?? null), FORMATS[format], quality / 100), 250)
    return () => clearTimeout(t)
  }, [img, W, H, fit, bg, color, format, quality])

  const download = () => {
    canvas.current.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}-${W}x${H}.${format}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, FORMATS[format], quality / 100)
  }

  if (!img) return <Dropzone onFile={onFile} hint="Tu imagen no sale de tu dispositivo" />

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex min-h-80 items-center justify-center rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-950">
        <canvas ref={canvas} className="max-h-[65vh] max-w-full rounded-lg shadow-lg" />
      </div>

      <div className="space-y-5 text-sm">
        <Field label="Formato">
          <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className={input}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}{p.id !== 'custom' ? ` · ${p.w}×${p.h}` : ''}</option>)}
          </select>
          {presetId === 'custom' && (
            <div className="mt-2 flex items-center gap-2">
              <input type="number" min="16" max="8000" value={custom.w} onChange={(e) => setCustom({ ...custom, w: +e.target.value })} className={input} aria-label="Ancho" />
              <span>×</span>
              <input type="number" min="16" max="8000" value={custom.h} onChange={(e) => setCustom({ ...custom, h: +e.target.value })} className={input} aria-label="Alto" />
            </div>
          )}
        </Field>

        <Field label="Encaje">
          <Segmented value={fit} onChange={setFit} options={[['contain', 'Ajustar'], ['cover', 'Rellenar']]} />
          <p className="mt-1 text-xs text-zinc-500">{fit === 'contain' ? 'Se ve la imagen entera, sin recortes.' : 'Ocupa todo el formato recortando los bordes.'}</p>
        </Field>

        {fit === 'contain' && (
          <Field label="Fondo">
            <Segmented value={bg} onChange={setBg} options={[['blur', 'Desenfocado'], ['color', 'Color']]} />
            {bg === 'color' && <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-2 h-9 w-full cursor-pointer rounded-lg" />}
          </Field>
        )}

        <Field label="Archivo">
          <Segmented value={format} onChange={setFormat} options={[['jpg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP']]} />
          {format !== 'png' && (
            <label className="mt-2 block text-xs text-zinc-500">
              Calidad: {quality}%
              <input type="range" min="40" max="100" value={quality} onChange={(e) => setQuality(+e.target.value)} className="mt-1 w-full accent-violet-600" />
            </label>
          )}
          {size && <p className="mt-1 text-xs text-zinc-500">Peso aproximado: {(size / 1024 / 1024).toFixed(2)} MB</p>}
        </Field>

        <Button onClick={download} className="w-full">Descargar {W}×{H}</Button>
        <Button variant="ghost" onClick={() => setImg(null)} className="w-full">Otra imagen</Button>
      </div>
    </div>
  )
}

const input = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950'
const clamp = (n) => Math.max(16, Math.min(8000, Math.round(n) || 16))

function drawCover(ctx, img, W, H, iw, ih) {
  const s = Math.max(W / iw, H / ih)
  ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s)
}

function Field({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 font-semibold">{label}</p>
      {children}
    </div>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-md px-2 py-1.5 font-medium ${value === v ? 'bg-white shadow-sm dark:bg-zinc-950' : 'text-zinc-500'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
