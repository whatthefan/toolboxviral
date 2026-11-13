// Detector de sonidos en segundo plano: YAMNet (Google, Apache 2.0) con onnxruntime-web.
// Recibe el audio a 16 kHz y devuelve, cada 0,48 s, qué sonidos hay y cuánta voz se oye.
// El modelo (14 MB) y el motor se guardan en el navegador tras la primera vez.
import CLASES from './yamnet-clases.js'
import { VOZ } from './sdh.js'

const SR = 16000
const HOP = 7680 // 0,48 s
const POR_TROZO = 125 // ventanas por cada llamada al modelo (60 s)
const ES_VOZ = CLASES.map((c) => VOZ.test(c))
const ARCHIVOS = { wasm: '/ort/ort-1.30.0-wasm.bin', modelo: '/models/yamnet-v1.bin' }
const TOTAL = 6576816 + 14204239

let listo = null
let recibido = 0
const avisar = (m) => self.postMessage(m)

async function bajar(url) {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`)
  const lector = res.body.getReader()
  const trozos = []
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    trozos.push(value)
    recibido += value.length
    avisar({ type: 'descarga', pct: Math.min(99, Math.round((recibido / TOTAL) * 100)) })
  }
  return new Response(new Blob(trozos).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

function preparar() {
  listo ??= (async () => {
    const [ort, wasm, modelo] = await Promise.all([import('onnxruntime-web/webgpu'), bajar(ARCHIVOS.wasm), bajar(ARCHIVOS.modelo)])
    ort.env.wasm.wasmPaths = '/ort/'
    ort.env.wasm.wasmBinary = wasm
    ort.env.wasm.numThreads = 1
    const sesion = await ort.InferenceSession.create(new Uint8Array(modelo), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
    return { ort, sesion }
  })()
  listo.catch(() => { listo = null; recibido = 0 })
  return listo
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'run') return
  try {
    const { ort, sesion } = await preparar()
    avisar({ type: 'descarga', pct: 100 })
    const audio = data.audio
    const dur = audio.length / SR
    const paso = POR_TROZO * HOP
    const ventanas = []
    for (let s = 0; s < audio.length; s += paso) {
      const trozo = audio.slice(s, Math.min(audio.length, s + paso + HOP))
      const out = await sesion.run({ [sesion.inputNames[0]]: new ort.Tensor('float32', trozo, [trozo.length]) })
      const sc = out[sesion.outputNames[0]]
      const [frames, n] = sc.dims
      for (let f = 0; f < Math.min(frames, POR_TROZO); f++) {
        const start = (s + f * HOP) / SR
        if (start >= dur) break
        const fila = sc.data.subarray(f * n, f * n + n)
        const preds = []
        let voz = 0
        for (let i = 0; i < n; i++) {
          if (ES_VOZ[i] && fila[i] > voz) voz = fila[i]
          if (fila[i] >= 0.06) preds.push({ label: CLASES[i], score: Math.round(fila[i] * 1000) / 1000 })
        }
        ventanas.push({ start, end: Math.min(start + 0.96, dur), voz: Math.round(voz * 1000) / 1000, preds })
      }
      for (const k of Object.keys(out)) out[k].dispose?.()
      avisar({ type: 'progreso', pct: Math.min(100, Math.round(((s + paso) / audio.length) * 100)) })
    }
    avisar({ type: 'fin', ventanas })
  } catch (err) {
    avisar({ type: 'error', msg: String(err?.message || err) })
  }
}
