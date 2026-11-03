const STOPWORDS = new Set(`de la que el en y a los del se las por un para con no una su al lo como más mas pero sus le ya o este esta
sí si porque entre cuando muy sin sobre también me hasta hay donde quien desde todo toda todos todas nos durante uno les ni contra
otros otro otra otras ese eso esa esos esas ante ellos ellas esto estos estas mí mi mis antes algunos algunas qué unos unas yo él
tanto mucho muchos muchas nada poco algo nosotros tú te ti tu tus es son fue ser era han ha he está están estaba tiene tienen
hacer hace puede pueden cada así solo sólo bien vez veces aquí allí luego después entonces mientras tan cómo cual cuál cuyo
the and to of in is it that for you with this are`.split(/\s+/))

// Expresiones muy frecuentes en textos generados por IA (y en redacciones de relleno).
const CLICHES = [
  'en conclusión', 'en resumen', 'en definitiva', 'en última instancia', 'es importante destacar', 'es importante tener en cuenta',
  'es importante señalar', 'cabe destacar', 'cabe mencionar', 'cabe señalar', 'vale la pena mencionar', 'en el mundo actual',
  'en la era digital', 'en el panorama actual', 'en un mundo cada vez más', 'juega un papel crucial', 'juega un papel fundamental',
  'desempeña un papel crucial', 'desempeña un papel fundamental', 'sin lugar a dudas', 'un sinfín de', 'una amplia gama de',
  'una gran variedad de', 'adentrarnos en', 'sumergirnos en', 'profundizar en', 'navegar por', 'el vasto mundo', 'rico tapiz',
  'en constante evolución', 'a lo largo de la historia', 'no solo', 'es fundamental', 'es esencial', 'es crucial',
  'por otro lado', 'asimismo', 'en este sentido', 'dicho esto', 'en pocas palabras', 'sin más preámbulos', 'te invito a',
]

const STRONG = new Set('aeoáéóíú') // í/ú acentuadas rompen el diptongo
const WEAK = new Set('iuü')

/** Sílabas aproximadas de una palabra en español (núcleos vocálicos). */
export function syllables(word) {
  const w = word.toLowerCase()
    .replace(/[^a-záéíóúüñy]/g, '')
    .replace(/qu/g, 'q')
    .replace(/gu(?=[eiéí])/g, 'g')
    .replace(/y(?![aeiouáéíóú])/g, 'i')
  let count = 0
  let prev = null
  for (const ch of w) {
    const type = STRONG.has(ch) ? 'S' : WEAK.has(ch) ? 'W' : null
    if (!type) { prev = null; continue }
    if (prev === null || (type === 'S' && prev === 'S')) count++
    prev = type
  }
  return Math.max(1, count)
}

export function readabilityLabel(score) {
  if (score >= 90) return 'Muy fácil'
  if (score >= 80) return 'Fácil'
  if (score >= 70) return 'Bastante fácil'
  if (score >= 60) return 'Normal'
  if (score >= 50) return 'Algo difícil'
  if (score >= 30) return 'Difícil'
  return 'Muy difícil'
}

export function analyze(text) {
  const words = text.match(/[\p{L}\p{N}]+(?:['’-]\p{L}+)*/gu) || []
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s))
  const paragraphs = text.split(/\n\s*\n/).filter((p) => /\p{L}/u.test(p))
  const sentenceLengths = sentences.map((s) => (s.match(/[\p{L}\p{N}]+/gu) || []).length)

  const nWords = words.length
  const nSentences = Math.max(1, sentences.length)
  const totalSyllables = words.reduce((acc, w) => acc + syllables(w), 0)

  // Índice Fernández-Huerta (Flesch adaptado al español)
  const readability = nWords
    ? Math.max(0, Math.min(100, 206.84 - 0.6 * (100 * totalSyllables / nWords) - 1.02 * (100 * nSentences / nWords)))
    : null

  const mean = sentenceLengths.reduce((a, b) => a + b, 0) / (sentenceLengths.length || 1)
  const sd = Math.sqrt(sentenceLengths.reduce((a, b) => a + (b - mean) ** 2, 0) / (sentenceLengths.length || 1))
  const variation = mean ? sd / mean : 0

  const freq = new Map()
  for (const w of words) {
    const k = w.toLowerCase()
    if (k.length < 4 || STOPWORDS.has(k) || /^\d+$/.test(k)) continue
    freq.set(k, (freq.get(k) || 0) + 1)
  }
  const repeated = [...freq].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const lower = text.toLowerCase()
  const cliches = CLICHES
    .map((c) => [c, lower.split(c).length - 1])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])

  return {
    words: nWords,
    chars: text.length,
    charsNoSpaces: text.replace(/\s/g, '').length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    readingSec: Math.round((nWords / 200) * 60),
    speakingSec: Math.round((nWords / 150) * 60),
    readability,
    avgSentence: mean,
    variation,
    sentenceLengths,
    repeated,
    cliches,
    clichesPer100: nWords ? (cliches.reduce((a, [, n]) => a + n, 0) / nWords) * 100 : 0,
  }
}

// ---------- Probabilidad de que un texto sea de IA ----------
// Estimación por estilo: combina señales que separan bien los textos generados de los escritos a mano
// (ritmo uniforme, muletillas, conectores al inicio de frase, falta de rasgos personales, párrafos iguales).
// No es una prueba: con textos cortos o muy editados se equivoca más.

const AI_PHRASES = [
  ...CLICHES,
  'además', 'por último', 'en primer lugar', 'en segundo lugar', 'finalmente', 'sin embargo', 'por lo tanto', 'de esta manera',
  'de este modo', 'es decir', 'en términos de', 'a medida que', 'ofrece una', 'permite a', 'garantizar', 'optimizar', 'potenciar',
  'fomentar', 'enriquecedor', 'invaluable', 'clave para', 'aspecto clave', 'experiencia única', 'transformar', 'revolucionar',
  "in today's", 'it is important to', "it's important to", 'delve', 'tapestry', 'landscape', 'moreover', 'furthermore',
  'additionally', 'in conclusion', 'overall,', 'plays a crucial role', 'a testament to', 'navigate the', 'embark on', 'seamless',
]
const CONNECTORS = /^(además|asimismo|por otro lado|por otra parte|en primer lugar|en segundo lugar|por último|finalmente|sin embargo|no obstante|por lo tanto|en conclusión|en resumen|en definitiva|de esta manera|de este modo|también|moreover|furthermore|additionally|however|in conclusion|overall|first|second|finally)\b/i
const PERSONAL = /\b(yo|me|mi|mis|conmigo|mío|mía|nosotros|nos|i|my|me|we|our)\b/gi
const INFORMAL = /\b(vale|jaja|jeje|pues|bueno|o sea|tío|tía|guay|flipa|ojalá|uf|eh|ok|lol|btw)\b|[!¡?¿]{2,}|\.\.\.|[\u{1F300}-\u{1FAFF}]/giu

const clamp01 = (x) => Math.max(0, Math.min(1, x))

export function aiLikelihood(text) {
  const words = text.match(/[\p{L}\p{N}]+(?:['’-]\p{L}+)*/gu) || []
  const n = words.length
  if (n < 40) return null
  const sentences = text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s))
  const lens = sentences.map((s) => (s.match(/[\p{L}\p{N}]+/gu) || []).length)
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1)
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1))
  const cv = mean ? sd / mean : 0
  const lower = text.toLowerCase()
  const phrases = AI_PHRASES.reduce((a, p) => a + (lower.split(p).length - 1), 0)
  const starts = sentences.filter((s) => CONNECTORS.test(s)).length / (sentences.length || 1)
  const personal = ((text.match(PERSONAL) || []).length + (text.match(INFORMAL) || []).length * 2) / n
  const digits = (text.match(/\d/g) || []).length / n
  const paras = text.split(/\n\s*\n/).map((p) => (p.match(/[\p{L}\p{N}]+/gu) || []).length).filter(Boolean)
  const pMean = paras.reduce((a, b) => a + b, 0) / (paras.length || 1)
  const pCv = paras.length > 2 && pMean ? Math.sqrt(paras.reduce((a, b) => a + (b - pMean) ** 2, 0) / paras.length) / pMean : 0.5
  const listy = (text.match(/^\s*(?:[-•*]|\d+\.)\s|\*\*[^*]+\*\*|^#+\s/gm) || []).length / Math.max(1, sentences.length)
  const questions = (text.match(/[?¿]/g) || []).length / Math.max(1, sentences.length)

  // Cada señal va de 0 (humano) a 1 (IA); el peso indica cuánto pesa en el resultado
  const signals = [
    ['Ritmo de las frases muy uniforme', clamp01((0.62 - cv) / 0.4), 2.2],
    ['Muletillas y expresiones típicas de IA', clamp01((phrases / n) * 100 / 2.2), 2.6],
    ['Frases que empiezan con conectores', clamp01(starts / 0.3), 1.4],
    ['Pocos rasgos personales (yo, opiniones, tono coloquial)', clamp01(1 - personal / 0.03), 1.6],
    ['Longitud media de frase típica de IA (16–26 palabras)', mean >= 14 && mean <= 28 ? 1 - Math.abs(mean - 21) / 9 : 0, 0.8],
    ['Párrafos de tamaño muy parecido', clamp01((0.45 - pCv) / 0.35), 0.9],
    ['Formato de lista o con negritas', clamp01(listy / 0.4), 0.7],
    ['Sin datos concretos ni preguntas', clamp01(1 - (digits * 40 + questions * 3)), 0.6],
  ].map(([label, value, weight]) => ({ label, value, weight }))

  const total = signals.reduce((a, s) => a + s.weight, 0)
  const raw = signals.reduce((a, s) => a + s.value * s.weight, 0) / total
  // Curva en S centrada en 0,45 para separar los casos claros de los dudosos
  const pct = Math.round(100 / (1 + Math.exp(-9 * (raw - 0.45))))
  return {
    pct,
    verdict: pct >= 70 ? 'Probablemente escrito con IA' : pct >= 40 ? 'Mezcla o texto muy editado' : 'Probablemente escrito por una persona',
    confidence: n >= 300 ? 'alta' : n >= 120 ? 'media' : 'baja',
    signals: signals.sort((a, b) => b.value * b.weight - a.value * a.weight),
  }
}
