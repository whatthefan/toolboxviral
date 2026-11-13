// Cálculos del compresor de vídeo y del extractor de audio (lógica pura, se puede probar).

export const OBJETIVOS = [
  { id: 'discord', label: 'Discord', mb: 10, nota: 'menos de 10 MB' },
  { id: 'correo', label: 'Correo', mb: 25, nota: 'menos de 25 MB' },
  { id: 'whatsapp', label: 'WhatsApp', mb: 64, nota: 'se envía como vídeo, no como documento' },
  { id: 'mitad', label: 'La mitad', mitad: true, nota: 'pesa la mitad que el original' },
  { id: 'otro', label: 'Otro tamaño', nota: 'elige los MB' },
]

// Altura máxima que tiene sentido para cada bitrate de vídeo (bits por segundo)
const ESCALONES = [
  [4_000_000, 1080],
  [1_800_000, 720],
  [800_000, 480],
  [350_000, 360],
  [0, 240],
]

const par = (n) => Math.max(2, Math.round(n / 2) * 2) // los codificadores piden medidas pares

/**
 * Plan para que el vídeo quepa en `objetivoMB`.
 * Reparte el tamaño entre vídeo y audio, deja un margen para el contenedor y elige la resolución
 * máxima con la que ese bitrate se ve bien. Nunca agranda el vídeo.
 */
export function planCompresion({ duracion, ancho, alto, objetivoMB, sinSonido = false, margen = 0.92 }) {
  if (!(duracion > 0)) throw new Error('No se sabe cuánto dura el vídeo')
  const total = (objetivoMB * 1024 * 1024 * 8 * margen) / duracion // bits por segundo disponibles
  let audio = sinSonido ? 0 : total > 1_500_000 ? 128_000 : total > 600_000 ? 96_000 : 64_000
  let video = total - audio
  if (video < 120_000 && !sinSonido) { audio = 48_000; video = total - audio }
  if (video < 60_000) return { posible: false, minimoMB: Math.ceil(((60_000 + audio) * duracion) / (8 * 1024 * 1024 * margen)) }
  const altura = ESCALONES.find(([b]) => video >= b)[1]
  const corto = Math.min(ancho, alto) // en vertical, la "altura" de 720p es el ancho
  const escala = Math.min(1, altura / corto)
  return { posible: true, ancho: par(ancho * escala), alto: par(alto * escala), video: Math.round(video), audio, altura: Math.min(altura, corto) }
}

/** Tamaño objetivo en MB según la opción elegida. */
export function objetivoMB(id, pesoOriginalMB, otroMB) {
  const o = OBJETIVOS.find((x) => x.id === id)
  if (!o) return null
  if (o.mitad) return pesoOriginalMB / 2
  if (o.id === 'otro') return otroMB
  return o.mb
}

export const megas = (bytes) => bytes / (1024 * 1024)
export const verMB = (bytes) => {
  const mb = megas(bytes)
  const txt = mb >= 100 ? `${Math.round(mb)}` : mb >= 10 ? mb.toFixed(1) : mb >= 1 ? mb.toFixed(2) : null
  return txt ? `${txt.replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** "1:05" o "1:02:03" a segundos. Acepta también "65" o "65,5". Devuelve null si no se entiende. */
export function aSegundos(texto) {
  const t = String(texto ?? '').trim().replace(',', '.')
  if (!t) return null
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return null
  return t.split(':').reduce((acc, p) => acc * 60 + Number(p), 0)
}

export const reloj = (s) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}` : `${m}:${String(seg).padStart(2, '0')}`
}

/** Peso aproximado de un MP3. */
export const pesoMp3 = (duracion, kbps) => (duracion * kbps * 1000) / 8
