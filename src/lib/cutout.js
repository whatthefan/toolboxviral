// Recorte de fondo en el navegador con U²-Net pequeño (u2netp, licencia Apache 2.0, 4,6 MB, alojado en /models).
// El modelo y el motor (onnxruntime-web, MIT) se cargan en segundo plano al abrir la página, así que al subir
// una foto el recorte tarda menos de un segundo.
const SIZE = 320
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

let ready = null

/** Prepara el motor y el modelo (solo una vez). */
export function prepare() {
  if (!ready) {
    ready = (async () => {
      const ort = await import('onnxruntime-web/wasm')
      ort.env.wasm.wasmPaths = '/ort/'
      ort.env.wasm.numThreads = 1
      const session = await ort.InferenceSession.create('/models/u2netp.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
      return { ort, session }
    })()
    ready.catch(() => { ready = null })
  }
  return ready
}

const canvasOf = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Devuelve un PNG (Blob) con el fondo transparente. */
export async function removeBackground(file) {
  const [{ ort, session }, bmp] = await Promise.all([prepare(), createImageBitmap(file)])

  // Entrada: 320×320, normalizada como en el entrenamiento del modelo
  const small = canvasOf(SIZE, SIZE).getContext('2d', { willReadFrequently: true })
  small.drawImage(bmp, 0, 0, SIZE, SIZE)
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
  const mask = small.createImageData(SIZE, SIZE)
  for (let i = 0; i < n; i++) {
    const v = (pred[i] - lo) / (hi - lo || 1)
    mask.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (v - 0.08) / 0.84)) * 255)
  }
  const maskCanvas = canvasOf(SIZE, SIZE)
  maskCanvas.getContext('2d').putImageData(mask, 0, 0)

  // Resultado a tamaño original: la foto, recortada con la máscara ampliada
  const outCanvas = canvasOf(bmp.width, bmp.height)
  const ctx = outCanvas.getContext('2d')
  ctx.drawImage(bmp, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(maskCanvas, 0, 0, bmp.width, bmp.height)
  bmp.close?.()
  return new Promise((resolve, reject) => outCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'))
}
