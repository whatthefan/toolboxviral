import { useEffect, useMemo, useRef, useState } from 'react'
import Button from './Button.jsx'
import DropMedia from './DropMedia.jsx'
import { OBJETIVOS, planCompresion, objetivoMB, megas, verMB, reloj } from '../../lib/video.js'
import { comprimir, descargar, leerInfo, puedeVideo } from '../../lib/medios.js'

export default function ComprimirVideo() {
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [info, setInfo] = useState(null)
  const [objetivo, setObjetivo] = useState('mitad')
  const [otro, setOtro] = useState(20)
  const [sinSonido, setSinSonido] = useState(false)
  const [margen, setMargen] = useState(0.92)
  const [fase, setFase] = useState('idle') // idle | leyendo | listo | trabajando | hecho | error
  const [pct, setPct] = useState(0)
  const [error, setError] = useState('')
  const [res, setRes] = useState(null) // { blob, url, ext, objetivo }
  const [soporte, setSoporte] = useState(true)
  const tarea = useRef(null)

  useEffect(() => setSoporte(puedeVideo()), [])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  useEffect(() => () => res?.url && URL.revokeObjectURL(res.url), [res])

  const elegir = async (f) => {
    setFile(f)
    setUrl(URL.createObjectURL(f))
    setRes(null)
    setError('')
    setMargen(0.92)
    setFase('leyendo')
    try {
      const i = await leerInfo(f)
      if (!i.hayVideo) throw new Error('Este archivo no tiene imagen. Para audios, usa el conversor de vídeo a MP3.')
      if (!(i.duracion > 0)) throw new Error('No se ha podido saber cuánto dura este vídeo.')
      setInfo(i)
      setFase('listo')
    } catch (err) {
      setError(err.message?.startsWith('Este') || err.message?.startsWith('No se') ? err.message : 'No se ha podido leer este vídeo. Prueba con MP4, MOV o WebM.')
      setFase('error')
    }
  }

  const peso = file ? megas(file.size) : 0
  const meta = objetivoMB(objetivo, peso, Number(otro) || 0)
  const plan = useMemo(() => {
    if (!info || !(meta > 0)) return null
    return planCompresion({ duracion: info.duracion, ancho: info.ancho, alto: info.alto, objetivoMB: meta, sinSonido: sinSonido || !info.hayAudio, margen })
  }, [info, meta, sinSonido, margen])
  const yaCabe = meta >= peso && !sinSonido

  const empezar = async (m = margen) => {
    const p = planCompresion({ duracion: info.duracion, ancho: info.ancho, alto: info.alto, objetivoMB: meta, sinSonido: sinSonido || !info.hayAudio, margen: m })
    if (!p.posible) return
    setFase('trabajando')
    setPct(0)
    setError('')
    setRes(null)
    try {
      const t = await comprimir(file, p, { sinSonido: sinSonido || !info.hayAudio, onProgress: setPct })
      tarea.current = t
      const blob = await t.promesa
      setRes({ blob, url: URL.createObjectURL(blob), ext: t.ext, objetivo: meta, plan: p })
      setFase('hecho')
    } catch (err) {
      if (err.message === 'cancelado') return setFase('listo')
      setError(/memory|allocation/i.test(err.message) ? 'Tu dispositivo se ha quedado sin memoria. Prueba con un tamaño más pequeño o en el ordenador.' : err.message || 'No se ha podido comprimir el vídeo.')
      setFase('error')
    } finally {
      tarea.current = null
    }
  }
  const cancelar = () => tarea.current?.cancelar()
  const reducirMas = () => { const m = margen * 0.82; setMargen(m); empezar(m) }
  const otroArchivo = () => { cancelar(); setFile(null); setInfo(null); setRes(null); setFase('idle'); setError('') }
  const nombre = (file?.name ?? 'video').replace(/\.[^.]+$/, '')

  if (!soporte) {
    return <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Tu navegador no puede comprimir vídeo. Abre esta página con Chrome, Edge o Safari actualizados (en el móvil también funcionan).</p>
  }
  if (!file) return <DropMedia soloVideo onFile={elegir} />

  const reduccion = res ? Math.round((1 - res.blob.size / file.size) * 100) : 0
  const pasado = res && megas(res.blob.size) > res.objetivo * 1.02

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-black">
        <video src={res?.url ?? url} controls playsInline className="mx-auto max-h-[55vh] w-full" />
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        <span className="font-semibold">{file.name}</span>
        {info && <> · {reloj(info.duracion)} · {info.ancho}×{info.alto} · {verMB(file.size)}</>}
        {res && <> → <span className="font-semibold text-violet-700 dark:text-violet-300">{verMB(res.blob.size)}</span> ({reduccion > 0 ? `${reduccion} % menos` : 'sin reducir'})</>}
      </p>

      {fase === 'leyendo' && <p className="text-sm text-zinc-500">Leyendo el vídeo…</p>}

      {(fase === 'listo' || fase === 'error' || fase === 'hecho') && info && (
        <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <fieldset>
            <legend className="text-sm font-medium">¿Para qué lo quieres?</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {OBJETIVOS.map((o) => (
                <button key={o.id} type="button" onClick={() => { setObjetivo(o.id); setMargen(0.92) }} className={`min-w-0 rounded-xl border p-2.5 text-left text-sm transition ${objetivo === o.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'border-zinc-200 dark:border-zinc-800'}`}>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="block text-xs text-zinc-500">{o.mitad ? `unos ${verMB(file.size / 2)}` : o.nota}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
            {objetivo === 'otro' && (
              <label className="flex items-center gap-2">Tamaño máximo
                <input type="number" min="1" max="4000" value={otro} onChange={(e) => { setOtro(e.target.value); setMargen(0.92) }} className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900" /> MB
              </label>
            )}
            {info.hayAudio && <label className="flex items-center gap-2"><input type="checkbox" checked={sinSonido} onChange={(e) => setSinSonido(e.target.checked)} className="h-4 w-4 accent-violet-600" /> Quitar el sonido</label>}
          </div>
          {plan && (plan.posible ? (
            <p className="text-sm">
              {yaCabe ? <>Tu vídeo ya pesa menos de {Math.round(meta)} MB, así que no hace falta comprimirlo. Si lo haces igualmente, quedará </> : <>Quedará en <strong>menos de {meta >= 10 ? Math.round(meta) : meta.toFixed(1).replace('.', ',')} MB</strong>, </>}
              a {plan.ancho}×{plan.alto} {plan.audio ? `con sonido a ${Math.round(plan.audio / 1000)} kbps` : 'sin sonido'}.
            </p>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-300">Para que se vea bien, este vídeo necesita al menos {plan.minimoMB} MB. Elige un tamaño mayor o recórtalo antes.</p>
          ))}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => empezar()} disabled={!plan?.posible}>{fase === 'hecho' ? 'Comprimir otra vez' : 'Comprimir vídeo'}</Button>
            <Button variant="ghost" onClick={otroArchivo}>Otro vídeo</Button>
          </div>
        </div>
      )}

      {fase === 'error' && !info && (
        <div className="space-y-3">
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
          <Button variant="ghost" onClick={otroArchivo}>Elegir otro archivo</Button>
        </div>
      )}

      {fase === 'trabajando' && (
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800" aria-live="polite">
          <div className="flex items-center justify-between text-sm"><span>Comprimiendo en tu dispositivo…</span><span className="tabular-nums text-zinc-500">{pct}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} /></div>
          <button type="button" onClick={cancelar} className="mt-3 text-sm text-zinc-500 underline">Cancelar</button>
        </div>
      )}

      {fase === 'hecho' && res && (
        <div className="space-y-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
          {pasado && <p className="text-sm text-amber-700 dark:text-amber-300">Ha quedado un poco por encima de {Math.round(res.objetivo)} MB. Pulsa «Reducir un poco más» y bajará.</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => descargar(res.blob, `${nombre}-comprimido.${res.ext}`)}>Descargar ({verMB(res.blob.size)})</Button>
            {pasado && <Button variant="ghost" onClick={reducirMas}>Reducir un poco más</Button>}
          </div>
          <p className="text-xs text-zinc-500">{res.ext === 'mp4' ? 'Formato MP4 (H.264), el que aceptan WhatsApp, Instagram, TikTok, Discord y el correo.' : 'Tu navegador no puede crear MP4, así que se ha guardado en WebM: funciona en Discord, Telegram, YouTube y en el navegador.'}</p>
        </div>
      )}
    </div>
  )
}
