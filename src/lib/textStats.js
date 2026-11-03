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
