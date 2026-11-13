// Transcripción en segundo plano con Whisper (OpenAI, licencia MIT) mediante transformers.js.
// Usa la tarjeta gráfica (WebGPU) si el navegador la ofrece; si no, el procesador (WASM).
// Los modelos se descargan de Hugging Face la primera vez y quedan guardados en el navegador.
import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false
const SR = 16000

let cargando = null
let clave = ''
const avisar = (m) => self.postMessage(m)

async function tarjeta() {
  try {
    const a = await navigator.gpu?.requestAdapter()
    return a ? { ok: true, f16: a.features.has('shader-f16') } : { ok: false }
  } catch {
    return { ok: false }
  }
}

/** Prepara Whisper una sola vez por calidad. Devuelve { asr, motor }. */
function cargar(calidad) {
  if (cargando && clave === calidad) return cargando
  clave = calidad
  cargando = (async () => {
    const id = `onnx-community/whisper-${calidad}`
    const archivos = new Map()
    let maximo = 0
    const progress_callback = (p) => {
      if (p.status !== 'progress' || !p.total) return
      archivos.set(p.file, [p.loaded, p.total])
      let l = 0
      let t = 0
      for (const [x, y] of archivos.values()) { l += x; t += y }
      maximo = Math.max(maximo, Math.min(99, Math.round((l / t) * 100)))
      avisar({ type: 'descarga', pct: maximo, mb: Math.round(t / 1e6) })
    }
    const g = await tarjeta()
    // En la tarjeta gráfica el codificador va sin comprimir (más preciso) y el decodificador en 4 bits
    if (g.ok && (calidad !== 'small' || g.f16)) {
      try {
        const dtype = { encoder_model: calidad === 'small' ? 'fp16' : 'fp32', decoder_model_merged: 'q4' }
        return { asr: await pipeline('automatic-speech-recognition', id, { device: 'webgpu', dtype, progress_callback }), motor: 'webgpu' }
      } catch (err) {
        console.warn('WebGPU no disponible para Whisper, se usa el procesador', err)
      }
    }
    return { asr: await pipeline('automatic-speech-recognition', id, { device: 'wasm', dtype: 'q8', progress_callback }), motor: 'wasm' }
  })()
  cargando.catch(() => { cargando = null; clave = '' })
  return cargando
}

self.onmessage = async ({ data }) => {
  if (data.type === 'cargar') return cargar(data.calidad).catch(() => {})
  if (data.type !== 'run') return
  try {
    const { asr, motor } = await cargar(data.calidad)
    avisar({ type: 'listo', motor })
    const { audio, tramos, saltar = [], idioma, tarea } = data
    const opciones = { return_timestamps: true, task: tarea || 'transcribe' }
    if (idioma && idioma !== 'auto') opciones.language = idioma
    for (let i = 0; i < tramos.length; i++) {
      const [a, b] = tramos[i]
      const off = a / SR
      const dur = (b - a) / SR
      let chunks = []
      if (!saltar[i]) {
        const out = await asr(audio.subarray(a, b), opciones)
        chunks = (out.chunks ?? [{ text: out.text, timestamp: [0, dur] }]).map((c) => ({
          text: c.text,
          start: off + Math.min(c.timestamp?.[0] ?? 0, dur),
          end: off + Math.min(c.timestamp?.[1] ?? dur, dur),
        }))
      }
      avisar({ type: 'parcial', chunks, pct: Math.round(((i + 1) / tramos.length) * 100) })
    }
    avisar({ type: 'fin' })
  } catch (err) {
    avisar({ type: 'error', msg: String(err?.message || err) })
  }
}
