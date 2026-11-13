import { useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import DropMedia from './DropMedia.jsx'
import { aSegundos, reloj, verMB, pesoMp3 } from '../../lib/video.js'
import { aMp3, descargar, leerInfo, puedeAudio } from '../../lib/medios.js'

const CALIDADES = [
  { kbps: 128, label: 'Normal', nota: 'voz, podcasts' },
  { kbps: 192, label: 'Alta', nota: 'música, recomendada' },
  { kbps: 320, label: 'Máxima', nota: 'la mejor del MP3' },
]

export default function VideoAMp3() {
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [info, setInfo] = useState(null)
  const [kbps, setKbps] = useState(192)
  const [recortar, setRecortar] = useState(false)
  const [desde, setDesde] = useState('0:00')
  const [hasta, setHasta] = useState('')
  const [fase, setFase] = useState('idle') // idle | leyendo | listo | trabajando | hecho | error
  const [pct, setPct] = useState(0)
  const [error, setError] = useState('')
  const [res, setRes] = useState(null)
  const [soporte, setSoporte] = useState(true)
  const player = useRef(null)
  const tarea = useRef(null)

  useEffect(() => setSoporte(puedeAudio()), [])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  useEffect(() => () => res?.url && URL.revokeObjectURL(res.url), [res])

  const elegir = async (f) => {
    setFile(f)
    setUrl(URL.createObjectURL(f))
    setRes(null)
    setError('')
    setFase('leyendo')
    try {
      const i = await leerInfo(f)
      if (!i.hayAudio) throw new Error('Este vídeo no tiene sonido, así que no hay nada que pasar a MP3.')
      setInfo(i)
      setHasta(reloj(i.duracion))
      setFase('listo')
    } catch (err) {
      setError(err.message?.startsWith('Este') ? err.message : 'No se ha podido leer este archivo. Prueba con MP4, MOV, WebM, M4A o WAV.')
      setFase('error')
    }
  }

  const ini = recortar ? aSegundos(desde) : 0
  const fin = recortar ? aSegundos(hasta) : info?.duracion
  const tramoMal = recortar && (ini == null || fin == null || fin <= ini || (info && ini >= info.duracion))
  const dur = info ? Math.max(0, Math.min(fin ?? info.duracion, info.duracion) - (ini ?? 0)) : 0

  const convertir = async () => {
    setFase('trabajando')
    setPct(0)
    setError('')
    setRes(null)
    try {
      const t = await aMp3(file, { kbps, desde: recortar ? ini : null, hasta: recortar ? Math.min(fin, info.duracion) : null, onProgress: setPct })
      tarea.current = t
      const blob = await t.promesa
      setRes({ blob, url: URL.createObjectURL(blob) })
      setFase('hecho')
    } catch (err) {
      if (err.message === 'cancelado') return setFase('listo')
      setError(err.message || 'No se ha podido convertir el archivo.')
      setFase('error')
    } finally {
      tarea.current = null
    }
  }
  const ahora = () => reloj(player.current?.currentTime ?? 0)
  const otroArchivo = () => { tarea.current?.cancelar(); setFile(null); setInfo(null); setRes(null); setFase('idle'); setError(''); setRecortar(false) }
  const nombre = (file?.name ?? 'audio').replace(/\.[^.]+$/, '')

  if (!soporte) {
    return <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Tu navegador no puede convertir audio. Abre esta página con Chrome, Edge, Firefox o Safari actualizados.</p>
  }
  if (!file) return <DropMedia onFile={elegir} hint="MP4, MOV, WebM, MKV, M4A, WAV…" />

  const esVideo = file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-black">
        {esVideo ? <video ref={player} src={url} controls playsInline className="mx-auto max-h-[45vh] w-full" /> : <div className="p-4"><audio ref={player} src={url} controls className="w-full" /></div>}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-300"><span className="font-semibold">{file.name}</span>{info && <> · {reloj(info.duracion)} · {verMB(file.size)}</>}</p>
      {fase === 'leyendo' && <p className="text-sm text-zinc-500">Leyendo el archivo…</p>}

      {(fase === 'listo' || fase === 'hecho' || (fase === 'error' && info)) && (
        <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <fieldset>
            <legend className="text-sm font-medium">Calidad del MP3</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {CALIDADES.map((c) => (
                <button key={c.kbps} type="button" onClick={() => setKbps(c.kbps)} className={`min-w-0 rounded-xl border p-2.5 text-left text-sm transition ${kbps === c.kbps ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'border-zinc-200 dark:border-zinc-800'}`}>
                  <span className="block font-semibold">{c.label}</span>
                  <span className="block text-xs text-zinc-500">{c.kbps} kbps · {c.nota}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recortar} onChange={(e) => setRecortar(e.target.checked)} className="h-4 w-4 accent-violet-600" /> Quedarme solo con un trozo (por ejemplo, para un tono de llamada)</label>
            {recortar && (
              <div className="mt-2 grid grid-cols-2 gap-3 sm:max-w-md">
                {[['Desde', desde, setDesde], ['Hasta', hasta, setHasta]].map(([l, v, set]) => (
                  <div key={l} className="min-w-0 text-sm">
                    <label className="font-medium">{l}
                      <input value={v} onChange={(e) => set(e.target.value)} inputMode="decimal" placeholder="m:ss" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono dark:border-zinc-700 dark:bg-zinc-900" />
                    </label>
                    <button type="button" onClick={() => set(ahora())} className="mt-1 text-xs text-violet-700 underline dark:text-violet-300">Usar el momento actual</button>
                  </div>
                ))}
              </div>
            )}
            {tramoMal && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Escribe los tiempos como 1:05 (minuto y segundos). «Hasta» tiene que ser mayor que «Desde».</p>}
          </div>
          {!tramoMal && <p className="text-sm">El MP3 durará {reloj(dur)} y pesará unos {verMB(pesoMp3(dur, kbps))}.</p>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={convertir} disabled={tramoMal}>{fase === 'hecho' ? 'Convertir otra vez' : 'Convertir a MP3'}</Button>
            <Button variant="ghost" onClick={otroArchivo}>Otro archivo</Button>
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
          <div className="flex items-center justify-between text-sm"><span>Convirtiendo en tu dispositivo…</span><span className="tabular-nums text-zinc-500">{pct}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} /></div>
          <button type="button" onClick={() => tarea.current?.cancelar()} className="mt-3 text-sm text-zinc-500 underline">Cancelar</button>
        </div>
      )}

      {fase === 'hecho' && res && (
        <div className="space-y-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
          <audio src={res.url} controls className="w-full" />
          <Button onClick={() => descargar(res.blob, `${nombre}.mp3`)}>Descargar MP3 ({verMB(res.blob.size)})</Button>
        </div>
      )}
    </div>
  )
}
