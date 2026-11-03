// Recorte de fondo en el navegador con U²-Net pequeño (u2netp, licencia Apache 2.0, 4,6 MB, alojado en /models).
// El modelo y el motor (onnxruntime-web, MIT) se cargan en segundo plano al abrir la página, así que al subir
// una foto el recorte tarda menos de un segundo.
const SIZE = 320
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

let ready = null
const listeners = new Set()
const loaded = { model: 0, wasm: 0 }
const SIZES = { model: 4574861, wasm: 11210254 } // tamaño ya descomprimido, para la barra de progreso

/** Avisa del progreso de la preparación (0 a 100). Devuelve la función para dejar de escuchar. */
export function onProgress(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Descarga un archivo contando los bytes que llegan. */
async function download(url, key) {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`)
  const reader = res.body.getReader()
  const parts = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    loaded[key] += value.length
    const pct = Math.min(99, Math.round(((loaded.model + loaded.wasm) / (SIZES.model + SIZES.wasm)) * 100))
    listeners.forEach((fn) => fn(pct))
  }
  return new Blob(parts).arrayBuffer()
}

/** Prepara el motor y el modelo (solo una vez). Los dos archivos se descargan a la vez. */
export function prepare() {
  if (!ready) {
    ready = (async () => {
      const [ort, wasm, model] = await Promise.all([
        import('onnxruntime-web/wasm'),
        download('/ort/ort-wasm-simd-threaded.wasm', 'wasm'),
        download('/models/u2netp.onnx', 'model'),
      ])
      ort.env.wasm.wasmPaths = '/ort/'
      ort.env.wasm.wasmBinary = wasm
      ort.env.wasm.numThreads = 1
      const session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
      listeners.forEach((fn) => fn(100))
      return { ort, session }
    })()
    ready.catch(() => { ready = null; loaded.model = loaded.wasm = 0 })
  }
  return ready
}

const canvasOf = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const MASK_SIDE = 1600 // la máscara editable no necesita más; se amplía al descargar

/**
 * Recorta la foto automáticamente. Devuelve la foto (a tamaño original) y una máscara editable:
 * lo opaco de la máscara se conserva y lo transparente se borra.
 */
export async function cutout(file) {
  const [{ ort, session }, bitmap] = await Promise.all([prepare(), createImageBitmap(file)])

  // Entrada: 320×320, normalizada como en el entrenamiento del modelo
  const small = canvasOf(SIZE, SIZE).getContext('2d', { willReadFrequently: true })
  small.drawImage(bitmap, 0, 0, SIZE, SIZE)
  const px = small.getImageData(0, 0, SIZE, SIZE).data
  const n = SIZE * SIZE
  const input = new Float32Array(3 * n)
  let max = 0
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2])
  max = max || 255
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    input[j] = (px[i] / max - MEAN[0]) / STD[0]
    input[n + j] = (px[i + 1] / max - MEAN[1]) / STD[1]
    input[2 * n + j] = (px[i + 2] / max - MEAN[2]) / STD[2]
  }
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) })
  const pred = out[session.outputNames[0]].data

  // Máscara: se normaliza y se suaviza un poco el borde
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < n; i++) { lo = Math.min(lo, pred[i]); hi = Math.max(hi, pred[i]) }
  const raw = small.createImageData(SIZE, SIZE)
  for (let i = 0; i < n; i++) {
    const v = (pred[i] - lo) / (hi - lo || 1)
    raw.data[i * 4] = raw.data[i * 4 + 1] = raw.data[i * 4 + 2] = 255
    raw.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (v - 0.08) / 0.84)) * 255)
  }
  const rawCanvas = canvasOf(SIZE, SIZE)
  rawCanvas.getContext('2d').putImageData(raw, 0, 0)

  const k = Math.min(1, MASK_SIDE / Math.max(bitmap.width, bitmap.height))
  const mask = canvasOf(Math.round(bitmap.width * k), Math.round(bitmap.height * k))
  const mctx = mask.getContext('2d', { willReadFrequently: true })
  mctx.imageSmoothingQuality = 'high'
  mctx.drawImage(rawCanvas, 0, 0, mask.width, mask.height)
  return { bitmap, mask }
}

/** Junta la foto y la máscara a tamaño original. Con `bg` se pone ese color de fondo. */
export function compose(bitmap, mask, bg) {
  const cut = canvasOf(bitmap.width, bitmap.height)
  const ctx = cut.getContext('2d')
  ctx.drawImage(bitmap, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mask, 0, 0, bitmap.width, bitmap.height)
  if (!bg) return cut
  const out = canvasOf(bitmap.width, bitmap.height)
  const octx = out.getContext('2d')
  octx.fillStyle = bg
  octx.fillRect(0, 0, out.width, out.height)
  octx.drawImage(cut, 0, 0)
  return out
}
