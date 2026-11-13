// Conversión de vídeo y audio en el navegador con Mediabunny (licencia MPL-2.0) y WebCodecs.
// Nada se sube: el archivo se lee del disco del usuario y el resultado se crea en memoria.
// Mediabunny se carga solo cuando hace falta, para no hacer más lenta la página.
let mp3Listo = false

const cargar = () => import('mediabunny')

/** ¿Puede este navegador codificar vídeo? (WebCodecs) */
export const puedeVideo = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoDecoder' in window
export const puedeAudio = () => typeof window !== 'undefined' && 'AudioEncoder' in window && 'AudioDecoder' in window

async function abrir(file) {
  const mb = await cargar()
  return { mb, input: new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS }) }
}

/** Duración, medidas y pistas de un vídeo o audio. */
export async function leerInfo(file) {
  const { input } = await abrir(file)
  try {
    const [duracion, v, a] = await Promise.all([input.computeDuration(), input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()])
    return { duracion, ancho: v?.displayWidth ?? 0, alto: v?.displayHeight ?? 0, hayVideo: !!v, hayAudio: !!a }
  } finally {
    input.dispose?.()
  }
}

/** Lanza una conversión y devuelve { promesa, cancelar }. */
function lanzar(input, output, opciones, onProgress, tipo) {
  let conv = null
  let cancelado = false
  const promesa = (async () => {
    const mb = await cargar()
    conv = await mb.Conversion.init({ input, output, ...opciones })
    if (!conv.isValid) {
      const motivo = conv.discardedTracks.map((d) => d.reason).join(', ')
      throw new Error(/codec|encod/i.test(motivo) ? 'Tu navegador no puede crear este formato. Prueba con Chrome, Edge o Safari actualizados.' : 'No se ha podido leer este archivo.')
    }
    if (cancelado) { await conv.cancel(); throw new Error('cancelado') }
    conv.onProgress = (p) => onProgress?.(Math.round(p * 100))
    await conv.execute()
    return new Blob([output.target.buffer], { type: tipo })
  })()
  const cancelar = async () => { cancelado = true; await conv?.cancel().catch(() => {}) }
  return { promesa, cancelar }
}

/**
 * Comprime un vídeo según el plan de `planCompresion`. Usa MP4 (H.264 + AAC) si el navegador
 * puede crearlo; si no (por ejemplo, Firefox sin AAC), WebM (VP9 + Opus).
 */
export async function comprimir(file, plan, { sinSonido = false, onProgress } = {}) {
  const { mb, input } = await abrir(file)
  const medidas = { width: plan.ancho, height: plan.alto, bitrate: plan.video }
  const mp4 = (await mb.canEncodeVideo('avc', medidas)) && (sinSonido || (await mb.canEncodeAudio('aac', { bitrate: plan.audio })))
  const codecVideo = mp4 ? 'avc' : (await mb.canEncodeVideo('vp9', medidas)) ? 'vp9' : 'vp8'
  const output = new mb.Output({ format: mp4 ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(), target: new mb.BufferTarget() })
  const opciones = {
    video: { width: plan.ancho, height: plan.alto, fit: 'fill', bitrate: plan.video, codec: codecVideo, forceTranscode: true },
    audio: sinSonido ? { discard: true } : { bitrate: plan.audio, codec: mp4 ? 'aac' : 'opus', forceTranscode: true },
  }
  const r = lanzar(input, output, opciones, onProgress, mp4 ? 'video/mp4' : 'video/webm')
  return { ...r, ext: mp4 ? 'mp4' : 'webm' }
}

/** Extrae el sonido de un vídeo (o convierte un audio) a MP3, con recorte opcional. */
export async function aMp3(file, { kbps = 192, desde = null, hasta = null, onProgress } = {}) {
  const { mb, input } = await abrir(file)
  if (!mp3Listo && !(await mb.canEncodeAudio('mp3'))) {
    const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder')
    registerMp3Encoder()
  }
  mp3Listo = true
  const output = new mb.Output({ format: new mb.Mp3OutputFormat(), target: new mb.BufferTarget() })
  const opciones = { video: { discard: true }, audio: { codec: 'mp3', bitrate: kbps * 1000, forceTranscode: true } }
  if (desde != null || hasta != null) opciones.trim = { ...(desde != null && { start: desde }), ...(hasta != null && { end: hasta }) }
  return lanzar(input, output, opciones, onProgress, 'audio/mpeg')
}

/** Descarga un Blob con un nombre. */
export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
