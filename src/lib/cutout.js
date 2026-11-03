// Recorte de fondo en el navegador con ISNet (DIS, licencia Apache 2.0), con los pesos guardados en 8 bits.
// El modelo y el motor (onnxruntime-web, MIT) se descargan en segundo plano al abrir la página y quedan
// guardados en el navegador. Con la tarjeta gráfica (WebGPU) el recorte tarda menos de medio segundo.
const SIZE = 1024 // el modelo trabaja siempre a 1024×1024
const MEAN = 0.5

// Archivos comprimidos con gzip (Cloudflare no comprime estos tipos) y troceados (máximo 25 MB por archivo)
const FILES = {
  wasm: ['/ort/ort-1.30.0-wasm.bin'],
  model: ['/models/isnet-v1-a.bin', '/models/isnet-v1-b.bin'],
}
const TOTAL = 6576816 + 20000000 + 18930716 // bytes comprimidos, para la barra de progreso

let ready = null
let received = 0
const listeners = new Set()

/** Avisa del progreso de la preparación (0 a 100). Devuelve la función para dejar de escuchar. */
export function onProgress(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Descarga las partes de un archivo contando los bytes y lo descomprime. */
async function download(urls) {
  const parts = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url)
      if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`)
      const reader = res.body.getReader()
      const chunks = []
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        const pct = Math.min(99, Math.round((received / TOTAL) * 100))
        listeners.forEach((fn) => fn(pct))
      }
      return new Blob(chunks)
    }),
  )
  return new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

/** La tarjeta gráfica, si el navegador la ofrece, con sus límites reales. */
async function gpuDevice() {
  try {
    const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter) return null
    const keys = ['maxStorageBuffersPerShaderStage', 'maxBufferSize', 'maxStorageBufferBindingSize', 'maxComputeWorkgroupStorageSize', 'maxComputeInvocationsPerWorkgroup', 'maxComputeWorkgroupSizeX']
    const requiredLimits = Object.fromEntries(keys.map((k) => [k, adapter.limits[k]]))
    const requiredFeatures = ['shader-f16'].filter((f) => adapter.features.has(f))
    return await adapter.requestDevice({ requiredLimits, requiredFeatures })
  } catch {
    return null
  }
}

/** Prepara el motor y el modelo (solo una vez). Todo se descarga a la vez. */
export function prepare() {
  if (!ready) {
    ready = (async () => {
      const [ort, wasm, model, device] = await Promise.all([import('onnxruntime-web/webgpu'), download(FILES.wasm), download(FILES.model), gpuDevice()])
      ort.env.wasm.wasmPaths = '/ort/'
      ort.env.wasm.wasmBinary = wasm
      ort.env.wasm.numThreads = 1
      let session = null
      if (device) {
        try {
          ort.env.webgpu.device = device
          session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' })
        } catch (err) {
          console.warn('WebGPU no disponible, se usa el procesador', err)
        }
      }
      // Sin tarjeta gráfica se usa el procesador (tarda unos segundos)
      session ??= await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
      listeners.forEach((fn) => fn(100))
      return { ort, session }
    })()
    ready.catch(() => { ready = null; received = 0 })
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

  // Entrada cuadrada, normalizada como en el entrenamiento del modelo
  const small = canvasOf(SIZE, SIZE).getContext('2d', { willReadFrequently: true })
  small.drawImage(bitmap, 0, 0, SIZE, SIZE)
  const px = small.getImageData(0, 0, SIZE, SIZE).data
  const n = SIZE * SIZE
  const input = new Float32Array(3 * n)
  let max = 0
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2])
  max = max || 255
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    input[j] = px[i] / max - MEAN
    input[n + j] = px[i + 1] / max - MEAN
    input[2 * n + j] = px[i + 2] / max - MEAN
  }
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) })
  const pred = out[session.outputNames[0]].data

  // Máscara: se normaliza y se limpia el ruido casi transparente
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < n; i++) { lo = Math.min(lo, pred[i]); hi = Math.max(hi, pred[i]) }
  const raw = small.createImageData(SIZE, SIZE)
  for (let i = 0; i < n; i++) {
    const v = (pred[i] - lo) / (hi - lo || 1)
    raw.data[i * 4] = raw.data[i * 4 + 1] = raw.data[i * 4 + 2] = 255
    raw.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (v - 0.04) / 0.92)) * 255)
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
