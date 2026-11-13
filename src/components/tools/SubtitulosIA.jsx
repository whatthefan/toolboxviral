import { useEffect, useMemo, useRef, useState } from 'react'
import Button from './Button.jsx'
import VozWorker from '../../lib/voz.worker.js?worker'
import SonidosWorker from '../../lib/sonidos.worker.js?worker'
import { aSubtitulos, conVoz, combinar, detectarSonidos, textoCue, aSRT, aVTT, aTXT, cortesSilencio, vozEntre } from '../../lib/sdh.js'

const SR = 16000
const IDIOMAS = [['auto', 'Detectar solo'], ['es', 'Español'], ['en', 'Inglés'], ['ca', 'Catalán'], ['gl', 'Gallego'], ['eu', 'Euskera'], ['pt', 'Portugués'], ['fr', 'Francés'], ['de', 'Alemán'], ['it', 'Italiano']]
const CALIDADES = [
  { id: 'tiny', label: 'Rápida', mb: 'unos 40 MB', nota: 'para móviles y pruebas' },
  { id: 'base', label: 'Equilibrada', mb: 'unos 80 MB', nota: 'recomendada' },
  { id: 'small', label: 'Precisa', mb: 'unos 250 MB', nota: 'mejor con tarjeta gráfica' },
]
const PASOS = [['audio', 'Leer el audio'], ['sonidos', 'Escuchar los sonidos'], ['modelo', 'Preparar el reconocimiento de voz'], ['voz', 'Transcribir']]
const TIPOS = 'video/*,audio/*,.mkv,.m4a,.opus,.flac'

/** Decodifica cualquier audio o vídeo que entienda el navegador a 16 kHz en mono. */
async function leerAudio(file) {
  const buf = await file.arrayBuffer()
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()
  try {
    const dec = await ctx.decodeAudioData(buf)
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(dec.duration * SR)), SR)
    const src = off.createBufferSource()
    src.buffer = dec
    src.connect(off.destination)
    src.start()
    return (await off.startRendering()).getChannelData(0)
  } finally {
    ctx.close?.()
  }
}

const reloj = (s) => {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
const bajar = (texto, nombre, tipo) => {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function SubtitulosIA() {
  const [file, setFile] = useState(null)
  const [media, setMedia] = useState(null) // { url, video }
  const [idioma, setIdioma] = useState('auto')
  const [calidad, setCalidad] = useState('base')
  const [traducir, setTraducir] = useState(false)
  const [fase, setFase] = useState('idle') // idle | listo | trabajando | hecho | error
  const [paso, setPaso] = useState({ id: '', pct: 0, mb: 0 })
  const [error, setError] = useState('')
  const [motor, setMotor] = useState('')
  const [ventanas, setVentanas] = useState([])
  const [crudos, setCrudos] = useState([]) // fragmentos de Whisper según llegan
  const [cues, setCues] = useState([]) // subtítulos de voz, editables
  const [conSonidos, setConSonidos] = useState(true)
  const [sensibilidad, setSensibilidad] = useState('media')
  const [ocultos, setOcultos] = useState(new Set())
  const [ahora, setAhora] = useState(0)
  const [over, setOver] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const input = useRef(null)
  const player = useRef(null)
  const track = useRef(null)
  const workers = useRef({})
  const audio = useRef(null)
  const turno = useRef(0)

  const idiomaTags = traducir || idioma === 'en' ? 'en' : 'es'
  const worker = (nombre) => {
    workers.current[nombre] ??= nombre === 'voz' ? new VozWorker() : new SonidosWorker()
    return workers.current[nombre]
  }
  useEffect(() => () => { Object.values(workers.current).forEach((w) => w.terminate()) }, [])
  useEffect(() => () => media && URL.revokeObjectURL(media.url), [media])

  const elegir = (f) => {
    if (!f) return
    if (!/^(audio|video)\//.test(f.type) && !/\.(mkv|m4a|opus|flac|mp3|wav|mp4|mov|webm|ogg|aac)$/i.test(f.name)) {
      setError('Ese archivo no es un vídeo ni un audio.')
      setFase('error')
      return
    }
    turno.current++
    setFile(f)
    setMedia({ url: URL.createObjectURL(f), video: f.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(f.name) })
    setFase('listo')
    setError('')
    setCues([])
    setCrudos([])
    setVentanas([])
    setOcultos(new Set())
  }

  const generar = async () => {
    const yo = ++turno.current
    const sigo = () => yo === turno.current
    setFase('trabajando')
    setError('')
    setCues([])
    setCrudos([])
    setVentanas([])
    // El modelo de voz empieza a descargarse ya, mientras se lee el audio y se escuchan los sonidos
    worker('voz').postMessage({ type: 'cargar', calidad })
    try {
      setPaso({ id: 'audio', pct: 0 })
      let a
      try {
        a = await leerAudio(file)
      } catch {
        throw new Error('No se ha podido leer el audio de este archivo. Prueba con MP4, MOV, WebM, MP3, M4A o WAV.')
      }
      if (!sigo()) return
      audio.current = a
      if (a.length / SR > 3 * 3600) throw new Error('El archivo dura más de 3 horas. Córtalo en partes más cortas.')

      // 1) Sonidos (rápido): también dice dónde hay voz, para no inventar texto en los silencios
      setPaso({ id: 'sonidos', pct: 0 })
      let vent = []
      try {
        vent = await new Promise((resolve, reject) => {
          const w = worker('sonidos')
          w.onmessage = ({ data }) => {
            if (data.type === 'progreso') setPaso({ id: 'sonidos', pct: data.pct })
            else if (data.type === 'fin') resolve(data.ventanas)
            else if (data.type === 'error') reject(new Error(data.msg))
          }
          w.postMessage({ type: 'run', audio: a })
        })
      } catch (err) {
        console.warn('Detector de sonidos no disponible', err)
      }
      if (!sigo()) return
      setVentanas(vent)

      // 2) Voz, por tramos cortados en los silencios; se saltan los tramos sin nadie hablando
      const tramos = cortesSilencio(a, SR)
      const saltar = tramos.map(([x, y]) => vozEntre(vent, x / SR, y / SR) < 0.15)
      setPaso({ id: 'modelo', pct: 0, mb: 0 })
      const trozos = []
      await new Promise((resolve, reject) => {
        const w = worker('voz')
        w.onmessage = ({ data }) => {
          if (!sigo()) return
          if (data.type === 'descarga') setPaso({ id: 'modelo', pct: data.pct, mb: data.mb })
          else if (data.type === 'listo') { setMotor(data.motor); setPaso({ id: 'voz', pct: 0 }) }
          else if (data.type === 'parcial') {
            trozos.push(...data.chunks)
            setCrudos(trozos.slice())
            setPaso({ id: 'voz', pct: data.pct })
          } else if (data.type === 'fin') resolve()
          else if (data.type === 'error') reject(new Error(data.msg))
        }
        w.postMessage({ type: 'run', audio: a, tramos, saltar, idioma, tarea: traducir ? 'translate' : 'transcribe', calidad })
      })
      if (!sigo()) return
      setCues(aSubtitulos(conVoz(trozos, vent), vent))
      setFase('hecho')
    } catch (err) {
      if (!sigo()) return
      setError(/memory|allocation|out of memory/i.test(err.message) ? 'Tu dispositivo se ha quedado sin memoria. Prueba con la calidad Rápida o con un archivo más corto.' : err.message)
      setFase('error')
    }
  }

  // Mientras transcribe, los subtítulos van apareciendo
  const vozCues = useMemo(() => (fase === 'hecho' ? cues : aSubtitulos(conVoz(crudos, ventanas), ventanas)), [fase, cues, crudos, ventanas])
  const sonidos = useMemo(() => detectarSonidos(ventanas, { sensibilidad, idioma: idiomaTags }), [ventanas, sensibilidad, idiomaTags])
  const visibles = useMemo(() => sonidos.filter((s) => !ocultos.has(s.tag)), [sonidos, ocultos])
  const final = useMemo(() => combinar(vozCues, conSonidos ? visibles : []), [vozCues, visibles, conSonidos])
  const resumen = useMemo(() => {
    const m = new Map()
    for (const s of sonidos) m.set(s.tag, [...(m.get(s.tag) ?? []), s.start])
    return [...m].sort((x, y) => y[1].length - x[1].length)
  }, [sonidos])

  // Vista previa: los subtítulos se ven sobre el vídeo al momento
  const vtt = useMemo(() => URL.createObjectURL(new Blob([aVTT(final, conSonidos)], { type: 'text/vtt' })), [final, conSonidos])
  useEffect(() => () => URL.revokeObjectURL(vtt), [vtt])
  useEffect(() => {
    const t = track.current?.track
    if (t) t.mode = 'showing'
  }, [vtt])

  const actual = final.find((c) => ahora >= c.start && ahora < c.end)
  const ir = (t) => {
    if (!player.current) return
    player.current.currentTime = t
    player.current.play?.().catch(() => {})
  }
  const editar = (cue, texto) => setCues((cs) => cs.map((c) => (c.start === cue.start && c.end === cue.end ? { ...c, text: texto } : c)))
  const nombre = (file?.name ?? 'subtitulos').replace(/\.[^.]+$/, '')
  const trabajando = fase === 'trabajando'
  const pasoIdx = PASOS.findIndex(([id]) => id === paso.id)

  if (!file) {
    return (
      <div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); elegir(e.dataTransfer.files[0]) }}
          className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition ${over ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-zinc-300 hover:border-violet-400 dark:border-zinc-700'}`}
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M7 15h4M13 15h4M7 11h2M11 11h6" /></svg>
          </div>
          <p className="text-lg font-semibold">Arrastra tu vídeo o audio aquí</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">o haz clic para elegirlo · no se sube a ningún servidor</p>
          <p className="text-xs text-zinc-400">MP4, MOV, WebM, MP3, M4A, WAV…</p>
          <input ref={input} type="file" accept={TIPOS} hidden onChange={(e) => elegir(e.target.files[0])} />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-black">
        {media.video ? (
          <video ref={player} src={media.url} controls playsInline onTimeUpdate={(e) => setAhora(e.currentTarget.currentTime)} className="mx-auto max-h-[60vh] w-full">
            {final.length > 0 && <track key={vtt} ref={track} kind="captions" srcLang={idiomaTags} label="Subtítulos" src={vtt} default />}
          </video>
        ) : (
          <div className="p-4">
            <p className="grid min-h-24 place-items-center text-balance text-center text-lg font-semibold text-white">{actual ? textoCue(actual, conSonidos).replace(/\n/g, ' ') : <span className="text-sm font-normal text-zinc-400">{fase === 'hecho' ? 'Dale al play para ver los subtítulos' : file.name}</span>}</p>
            <audio ref={player} src={media.url} controls onTimeUpdate={(e) => setAhora(e.currentTarget.currentTime)} className="w-full" />
          </div>
        )}
      </div>

      {(fase === 'listo' || fase === 'error') && (
        <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-medium">Idioma del vídeo
              <select value={idioma} onChange={(e) => setIdioma(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                {IDIOMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 self-end rounded-xl px-1 py-2.5 text-sm">
              <input type="checkbox" checked={traducir} onChange={(e) => setTraducir(e.target.checked)} className="h-4 w-4 accent-violet-600" />
              Traducir los subtítulos al inglés
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Calidad</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {CALIDADES.map((c) => (
                <button key={c.id} type="button" onClick={() => setCalidad(c.id)} className={`min-w-0 rounded-xl border p-2.5 text-left text-sm transition ${calidad === c.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'border-zinc-200 dark:border-zinc-800'}`}>
                  <span className="block font-semibold">{c.label}</span>
                  <span className="block text-xs text-zinc-500">{c.nota}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">La primera vez se descarga el reconocimiento de voz ({CALIDADES.find((c) => c.id === calidad).mb}) y el detector de sonidos (20 MB). Después queda guardado en tu navegador.</p>
          </fieldset>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={generar}>Crear subtítulos</Button>
            <Button variant="ghost" onClick={() => { turno.current++; setFile(null); setMedia(null); setFase('idle'); setError('') }}>Otro archivo</Button>
          </div>
        </div>
      )}

      {trabajando && (
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800" aria-live="polite">
          <ol className="space-y-2">
            {PASOS.map(([id, label], i) => (
              <li key={id} className={`flex items-center gap-3 text-sm ${i > pasoIdx ? 'text-zinc-400' : ''}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${i < pasoIdx ? 'bg-violet-600 text-white' : i === pasoIdx ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200' : 'bg-zinc-100 dark:bg-zinc-800'}`}>{i < pasoIdx ? '✓' : i + 1}</span>
                <span className="min-w-0 flex-1">{label}{i === pasoIdx && id === 'modelo' && paso.mb > 0 && <span className="text-zinc-500"> · {paso.mb} MB, solo la primera vez</span>}</span>
                {i === pasoIdx && <span className="tabular-nums text-zinc-500">{paso.pct}%</span>}
              </li>
            ))}
          </ol>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${((Math.max(0, pasoIdx) + paso.pct / 100) / PASOS.length) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-zinc-500">Todo se hace en tu dispositivo. Puedes ir viendo el resultado abajo mientras termina.</p>
        </div>
      )}

      {(trabajando || fase === 'hecho') && (resumen.length > 0 || final.length > 0) && (
        <div className="space-y-3">
          {resumen.length > 0 && (
            <div>
              <p className="text-sm font-medium">Sonidos detectados <span className="font-normal text-zinc-500">(toca uno para quitarlo o ponerlo)</span></p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {resumen.map(([tag, ts]) => (
                  <button key={tag} type="button" onClick={() => setOcultos((o) => { const n = new Set(o); n.has(tag) ? n.delete(tag) : n.add(tag); return n })} className={`rounded-full px-3 py-1 text-sm transition ${ocultos.has(tag) ? 'bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'}`}>
                    [{tag}] ×{ts.length}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={conSonidos} onChange={(e) => setConSonidos(e.target.checked)} className="h-4 w-4 accent-violet-600" /> Incluir los sonidos (subtítulos para personas sordas)</label>
            <label className="flex items-center gap-2">Sensibilidad
              <select value={sensibilidad} onChange={(e) => setSensibilidad(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">
                <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option>
              </select>
            </label>
          </div>
          <ul className="max-h-[28rem] divide-y divide-zinc-100 overflow-y-auto rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {final.map((c) => {
              const on = actual === c
              return (
                <li key={`${c.start}-${c.soloSonido ? 's' : 'v'}`} className={`flex gap-3 p-2.5 ${on ? 'bg-violet-50 dark:bg-violet-950/40' : ''}`}>
                  <button type="button" onClick={() => ir(c.start)} className="h-fit shrink-0 rounded-lg px-1.5 py-1 font-mono text-xs text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/40" aria-label={`Ir a ${reloj(c.start)}`}>{reloj(c.start)}</button>
                  <div className="min-w-0 flex-1">
                    {c.sonidos?.length > 0 && conSonidos && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{c.sonidos.map((t) => `[${t}]`).join(' ')}</p>}
                    {c.soloSonido ? null : fase === 'hecho' ? (
                      <textarea value={c.text.replace(/\n/g, ' ')} onChange={(e) => editar(c, e.target.value)} rows={Math.max(1, Math.ceil(c.text.length / 34))} className="w-full resize-none [field-sizing:content] rounded-lg bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-violet-400 dark:focus:bg-zinc-900" aria-label={`Subtítulo en ${reloj(c.start)}`} />
                    ) : (
                      <p className="text-sm">{c.text.replace(/\n/g, ' ')}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {fase === 'hecho' && (
        <div className="space-y-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
          {final.length === 0 ? (
            <p className="text-sm">No se ha oído a nadie hablar ni ningún sonido reconocible en este archivo.</p>
          ) : (
            <>
              <p className="text-sm font-medium">Descargar subtítulos {conSonidos ? 'con sonidos' : 'solo con la voz'}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button onClick={() => bajar(aSRT(final, conSonidos), `${nombre}.srt`, 'application/x-subrip')}>SRT</Button>
                <Button variant="ghost" onClick={() => bajar(aVTT(final, conSonidos), `${nombre}.vtt`, 'text/vtt')}>VTT</Button>
                <Button variant="ghost" onClick={() => bajar(aTXT(final, conSonidos), `${nombre}.txt`, 'text/plain')}>Texto</Button>
                <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(aTXT(final, conSonidos)).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) })}>{copiado ? 'Copiado' : 'Copiar texto'}</Button>
              </div>
              <p className="text-xs text-zinc-500">SRT sirve para YouTube, Premiere, DaVinci, CapCut y casi todo. VTT, para webs. {motor === 'webgpu' ? 'Hecho con la tarjeta gráfica de tu dispositivo.' : motor ? 'Hecho con el procesador de tu dispositivo.' : ''}</p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setFase('listo')}>Cambiar opciones y repetir</Button>
            <Button variant="ghost" onClick={() => { turno.current++; setFile(null); setMedia(null); setFase('idle') }}>Otro archivo</Button>
          </div>
        </div>
      )}
    </div>
  )
}
