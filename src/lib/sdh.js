// Subtítulos para personas sordas (SDH): une lo que se dice (Whisper) con los sonidos detectados
// (AST, clasificador de AudioSet con 527 tipos de sonido) y lo deja en SRT, VTT o texto.
// Todo es lógica pura, sin navegador, para poder probarla.

export const MAX_LINEA = 42 // caracteres por línea, como en la tele
export const MAX_CUE = 7 // segundos máximos de un subtítulo

// Etiquetas de AudioSet → texto entre corchetes. La primera regla que encaja gana.
// Las reglas sin texto (voz, silencio) se ignoran a propósito.
export const SONIDOS = [
  { re: /^(Speech|Male speech|Female speech|Child speech|Conversation|Narration|Speech synthesizer|Babbling|Silence|Inside, small room|Inside, large room|Outside, urban|Outside, rural|Echo|Reverberation|Noise|Static|Hum|Mains hum|White noise|Pink noise|Environmental noise|Sound effect|Wind noise|Chirp tone)/, es: null, en: null },
  { re: /Laughter|Giggle|Chuckle|Snicker|Belly laugh|Baby laughter/, es: 'risas', en: 'laughter' },
  { re: /Applause|Clapping/, es: 'aplausos', en: 'applause' },
  { re: /Cheering/, es: 'vítores', en: 'cheering' },
  { re: /^(Crowd|Hubbub)/, es: 'murmullo de gente', en: 'crowd murmuring' },
  { re: /Screaming|Shout|Yell|Battle cry|Bellow/, es: 'gritos', en: 'screaming' },
  { re: /Crying|sobbing|Baby cry|^Whimper$/, es: 'llanto', en: 'crying' },
  { re: /Gasp/, es: 'jadeo', en: 'gasps' },
  { re: /Sigh/, es: 'suspiro', en: 'sighs' },
  { re: /Cough|Throat clearing/, es: 'tos', en: 'coughing' },
  { re: /Sneeze/, es: 'estornudo', en: 'sneezes' },
  { re: /Snoring/, es: 'ronquidos', en: 'snoring' },
  { re: /Whistling/, es: 'silbido', en: 'whistling' },
  { re: /^(Singing|Choir|Chant|Yodeling|Rapping|Humming)$/, es: 'canto', en: 'singing' },
  { re: /^(Dog|Bark|Bow-wow|Yip|Howl|Growling|Whimper \(dog\))/, es: 'perro ladrando', en: 'dog barking' },
  { re: /^(Cat|Meow|Purr|Caterwaul)$/, es: 'gato maullando', en: 'cat meowing' },
  { re: /^(Bird|Chirp|tweet|Bird vocalization|Crow|Caw|Owl|Rooster|Pigeon)/, es: 'pájaros', en: 'birds chirping' },
  { re: /Doorbell|Ding-dong/, es: 'timbre', en: 'doorbell' },
  { re: /Knock/, es: 'golpes en la puerta', en: 'knocking' },
  { re: /^(Door|Slam|Sliding door|Cupboard open or close)/, es: 'puerta', en: 'door' },
  { re: /Telephone|Ringtone|Telephone bell ringing|Telephone dialing/, es: 'teléfono sonando', en: 'phone ringing' },
  { re: /Alarm clock/, es: 'despertador', en: 'alarm clock' },
  { re: /Siren|Police car|Ambulance|Fire engine|Civil defense siren/, es: 'sirena', en: 'siren' },
  { re: /Smoke detector|Fire alarm|Alarm|Buzzer/, es: 'alarma', en: 'alarm' },
  { re: /Vehicle horn|car horn|^Honk$|Air horn|^Toot$/, es: 'claxon', en: 'car horn' },
  { re: /Gunshot|gunfire|Machine gun|Fusillade|Artillery fire|Cap gun/, es: 'disparos', en: 'gunshots' },
  { re: /Explosion|Boom|Eruption/, es: 'explosión', en: 'explosion' },
  { re: /Fireworks|Firecracker/, es: 'fuegos artificiales', en: 'fireworks' },
  { re: /Thunder/, es: 'truenos', en: 'thunder' },
  { re: /Rain|Raindrop/, es: 'lluvia', en: 'rain' },
  { re: /^(Wind|Rustling leaves)$/, es: 'viento', en: 'wind' },
  { re: /Shatter|Breaking/, es: 'cristales rotos', en: 'glass breaking' },
  { re: /^(Glass|Chink, clink)$/, es: 'tintineo de copas', en: 'glasses clinking' },
  { re: /Walk, footsteps|Footsteps/, es: 'pasos', en: 'footsteps' },
  { re: /Typing|Computer keyboard|Typewriter/, es: 'tecleo', en: 'typing' },
  { re: /Helicopter/, es: 'helicóptero', en: 'helicopter' },
  { re: /Aircraft|Airplane|Jet engine/, es: 'avión', en: 'airplane' },
  { re: /^(Train|Railroad car|Train horn|Train whistle)/, es: 'tren', en: 'train' },
  { re: /Engine starting|Revving|Accelerating|Motorcycle|Car passing by|Race car/, es: 'motor', en: 'engine revving' },
  { re: /^(Bell|Church bell|Jingle bell|Chime|Wind chime|Bicycle bell)$/, es: 'campanas', en: 'bells' },
  { re: /Music|Song|Wind instrument|Singing bowl|Harpsichord|Piano|Guitar|Drum|Orchestra|Violin|fiddle|Synthesizer|Saxophone|Trumpet|Flute|Cello|Keyboard \(musical\)|Organ|Harp|Ukulele|Banjo|Strum|Accordion|Harmonica|Brass instrument|Plucked string|Bass guitar|Percussion|Cymbal|Hi-hat|Tabla|Mandolin|Sitar|Clarinet|Bagpipes|Marimba|Vibraphone|Glockenspiel|Electronic dance|Techno|Dubstep|House music|Jazz|Reggae|Salsa|Flamenco|Funk|Disco|Lullaby|Orchestra/i, es: 'música', en: 'music', musica: true },
]

// Umbral de confianza según la sensibilidad elegida
export const SENSIBILIDAD = { baja: 0.4, media: 0.25, alta: 0.15 }
const MIN_MUSICA = 4 // segundos seguidos de música para mencionarla

// Si suenan a la vez, el primero ya explica el segundo (se usa el nombre en inglés como clave)
const ABSORBE = {
  knocking: ['door'], doorbell: ['bells', 'alarm'], 'phone ringing': ['bells', 'alarm'], siren: ['alarm'], 'alarm clock': ['alarm', 'bells'],
  applause: ['crowd murmuring'], cheering: ['crowd murmuring'], laughter: ['crowd murmuring'], 'glass breaking': ['glasses clinking'],
  explosion: ['gunshots', 'thunder'], thunder: ['rain'], fireworks: ['explosion', 'gunshots'],
}

// Etiquetas que son voz humana (hablar o cantar): sirven para saber dónde puede haber texto
export const VOZ = /^(Speech|Child speech|Conversation|Narration|Babbling|Speech synthesizer|Shout|Yell|Whispering|Singing|Choir|Rapping|Chant|Male singing|Female singing|Child singing|Synthetic singing|Male speech|Female speech|Children shouting|Humming)/

const reglaDe = (label) => SONIDOS.find((r) => r.re.test(label))

/** Texto de la etiqueta de AudioSet en el idioma pedido, o null si no se debe mostrar. */
export function etiqueta(label, idioma = 'es') {
  const regla = reglaDe(label)
  return regla ? regla[idioma] ?? null : null
}

/**
 * Convierte las predicciones de cada ventana de audio en sonidos con principio y fin.
 * ventanas: [{ start, end, preds: [{ label, score }] }] en segundos, ordenadas (pueden solaparse).
 * Varias etiquetas del mismo sonido (risa, carcajada, risita) suman confianza.
 * Devuelve [{ tag, id, start, end, score }].
 */
export function detectarSonidos(ventanas, { sensibilidad = 'media', idioma = 'es' } = {}) {
  const umbral = SENSIBILIDAD[sensibilidad] ?? SENSIBILIDAD.media
  const abiertos = new Map() // id → evento en curso
  const eventos = []
  for (const v of ventanas) {
    const suma = new Map() // id → [máximo, suma, regla]
    for (const p of v.preds) {
      const regla = reglaDe(p.label)
      if (!regla?.en) continue
      const [mx = 0, sm = 0] = suma.get(regla.en) ?? []
      suma.set(regla.en, [Math.max(mx, p.score), sm + p.score, regla])
    }
    const vistos = new Map()
    for (const [id, [mx, sm, regla]] of suma) {
      const score = Math.min(1, mx + 0.5 * (sm - mx))
      const minimo = regla.musica ? Math.max(umbral, 0.35) : umbral
      if (score >= minimo) vistos.set(id, { score, regla })
    }
    for (const [id, ev] of abiertos) {
      if (!vistos.has(id) && v.start - ev.end > 0.05) { eventos.push(ev); abiertos.delete(id) }
    }
    for (const [id, { score, regla }] of vistos) {
      const ev = abiertos.get(id)
      if (ev && v.start - ev.end <= 0.05) { ev.end = Math.max(ev.end, v.end); ev.score = Math.max(ev.score, score) }
      else { if (ev) eventos.push(ev); abiertos.set(id, { tag: regla[idioma] ?? regla.en, id, start: v.start, end: v.end, score, musica: !!regla.musica }) }
    }
  }
  eventos.push(...abiertos.values())
  const largos = eventos.filter((e) => !e.musica || e.end - e.start >= MIN_MUSICA)
  return largos
    .filter((e) => !largos.some((o) => ABSORBE[o.id]?.includes(e.id) && o.start < e.end && e.start < o.end))
    .map(({ musica, ...e }) => e)
    .sort((a, b) => a.start - b.start || a.end - b.end)
}

/** Máxima probabilidad de voz entre dos instantes (1 si no hay datos de sonido). */
export function vozEntre(ventanas, desde, hasta) {
  if (!ventanas?.length) return 1
  let m = 0
  for (const v of ventanas) if (v.start < hasta && v.end > desde) m = Math.max(m, v.voz ?? 0)
  return m
}

/** Quita los fragmentos de Whisper donde no se oye ninguna voz (allí se los ha inventado). */
export function conVoz(chunks, ventanas, minimo = 0.1) {
  return chunks.filter((c) => vozEntre(ventanas, c.start, c.end) >= minimo)
}

// Frases que Whisper se inventa en los silencios
const ALUCINACIONES = [
  /amara\.org/i, /subt[ií]tulos (realizados |hechos )?por/i, /subtitles by/i, /suscr[ií]bete/i,
  /thanks? (you )?for watching/i, /gracias por ver/i, /^\W*$/,
]

/** Quita alucinaciones y espacios sobrantes de los fragmentos de Whisper. */
export function limpiar(chunks) {
  return chunks
    .map((c) => ({ text: c.text.replace(/\s+/g, ' ').trim(), start: c.start, end: c.end }))
    .filter((c) => c.text && !ALUCINACIONES.some((re) => re.test(c.text)) && c.end > c.start)
}

/** Parte un texto en como mucho 2 líneas equilibradas de MAX_LINEA caracteres. */
export function partirLineas(text, max = MAX_LINEA) {
  if (text.length <= max) return text
  const mitad = text.length / 2
  let mejor = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ') continue
    if (i <= max && text.length - i - 1 <= max && (mejor < 0 || Math.abs(i - mitad) < Math.abs(mejor - mitad))) mejor = i
  }
  if (mejor < 0) {
    // No cabe en dos líneas: se corta lo más cerca posible del máximo
    mejor = text.lastIndexOf(' ', max)
    if (mejor < 0) return text
  }
  return `${text.slice(0, mejor)}\n${text.slice(mejor + 1)}`
}

/**
 * Tramos donde se oye voz entre dos instantes, según el detector de sonidos.
 * Se usa el centro de cada ventana (YAMNet mira 0,96 s y avanza 0,48 s) para no alargar los bordes.
 * Sin datos de voz, devuelve el intervalo entero.
 */
export function tramosVoz(ventanas, desde, hasta, minimo = 0.3) {
  const out = []
  for (const v of ventanas ?? []) {
    if ((v.voz ?? 0) < minimo) continue
    const a = Math.max(desde, v.start + 0.24)
    const b = Math.min(hasta, v.end - 0.24)
    if (b <= a) continue
    const ultimo = out.at(-1)
    if (ultimo && a <= ultimo[1] + 0.05) ultimo[1] = Math.max(ultimo[1], b)
    else out.push([a, b])
  }
  if (!out.length) return [[desde, hasta]]
  // Margen pequeño para no cortar la primera y la última sílaba
  out[0][0] = Math.max(desde, out[0][0] - 0.2)
  out.at(-1)[1] = Math.min(hasta, out.at(-1)[1] + 0.2)
  return out
}

/** Pasa una fracción (0 a 1) del tiempo hablado al instante real, saltando los huecos sin voz. */
function instante(tramos, f) {
  const total = tramos.reduce((x, [a, b]) => x + b - a, 0)
  let resto = f * total
  for (const [a, b] of tramos) {
    if (resto <= b - a + 1e-9) return a + resto
    resto -= b - a
  }
  return tramos.at(-1)[1]
}

/**
 * Convierte fragmentos de Whisper [{ text, start, end }] en subtítulos legibles:
 * como mucho 2 líneas de 42 caracteres y 7 segundos. Los fragmentos largos se reparten
 * en trozos, cortando mejor tras un signo de puntuación, con el tiempo proporcional al texto.
 * Con `ventanas` (detector de sonidos), los tiempos se ajustan a cuando de verdad se oye voz.
 */
export function aSubtitulos(chunks, ventanas = []) {
  const out = []
  for (const c of limpiar(chunks)) {
    const tramos = tramosVoz(ventanas, c.start, c.end)
    const ini = tramos[0][0]
    const fin = tramos.at(-1)[1]
    const hablado = tramos.reduce((x, [a, b]) => x + b - a, 0)
    const piezas = Math.max(Math.ceil(c.text.length / (MAX_LINEA * 2)), Math.ceil(hablado / MAX_CUE), tramos.length > 1 ? 2 : 1)
    if (piezas <= 1) { out.push({ start: ini, end: fin, text: partirLineas(c.text) }); continue }
    const palabras = c.text.split(' ')
    const objetivo = c.text.length / piezas
    const trozos = []
    let actual = []
    const pausa = (w) => /[.,;:?!]$/.test(w)
    for (let i = 0; i < palabras.length; i++) {
      const w = palabras[i]
      if (actual.length) {
        const len = actual.join(' ').length
        let cortar = len + 1 + w.length > MAX_LINEA * 2 || (pausa(actual.at(-1)) && len >= objetivo * 0.6)
        if (!cortar && len >= objetivo) {
          // Si hay una coma o un punto en las 3 palabras siguientes y cabe, mejor esperar a ella
          cortar = true
          for (let k = i, l = len; k < Math.min(i + 3, palabras.length); k++) {
            l += 1 + palabras[k].length
            if (l > MAX_LINEA * 2) break
            if (pausa(palabras[k])) { cortar = false; break }
          }
        }
        if (cortar) { trozos.push(actual.join(' ')); actual = [] }
      }
      actual.push(w)
    }
    if (actual.length) trozos.push(actual.join(' '))
    const total = trozos.reduce((x, t) => x + t.length, 0)
    let hecho = 0
    for (const tr of trozos) {
      const a = instante(tramos, hecho / total)
      hecho += tr.length
      let b = instante(tramos, hecho / total)
      // Si el trozo cruza un hueco sin voz, termina donde acaba la voz
      const tramo = tramos.find(([x, y]) => a >= x - 1e-9 && a <= y + 1e-9)
      if (tramo && b > tramo[1] + 0.5) b = tramo[1]
      out.push({ start: a, end: Math.max(b, a + 0.5), text: partirLineas(tr) })
    }
  }
  return out
}

/**
 * Añade los sonidos a los subtítulos de voz.
 * Si un sonido coincide con alguien hablando, va delante de esa frase: "[risas] Qué bueno".
 * Si no, sale como subtítulo propio, sin pisar la frase siguiente.
 */
export function combinar(cues, sonidos) {
  const out = cues.map((c) => ({ ...c, sonidos: [] }))
  const solos = []
  for (const s of sonidos) {
    const encima = out.find((c) => c.start <= s.start + 0.5 && c.end > s.start)
    if (encima) { if (!encima.sonidos.includes(s.tag)) encima.sonidos.push(s.tag); continue }
    const siguiente = out.find((c) => c.start >= s.start)
    let fin = Math.min(s.start + Math.max(1.5, Math.min(s.end - s.start, 6)), siguiente?.start ?? Infinity)
    if (fin - s.start < 0.8) {
      if (siguiente) { if (!siguiente.sonidos.includes(s.tag)) siguiente.sonidos.unshift(s.tag); continue }
      fin = s.start + 1.5
    }
    // Dos sonidos a la vez sin nadie hablando: un solo subtítulo con los dos
    const junto = solos.find((x) => Math.abs(x.start - s.start) < 0.5)
    if (junto) { if (!junto.sonidos.includes(s.tag)) junto.sonidos.push(s.tag); junto.end = Math.max(junto.end, fin); continue }
    solos.push({ start: s.start, end: fin, text: '', sonidos: [s.tag], soloSonido: true })
  }
  return [...out, ...solos].sort((a, b) => a.start - b.start)
}

/** Texto final de un subtítulo, con o sin sonidos. */
export function textoCue(c, conSonidos = true) {
  const tags = conSonidos && c.sonidos?.length ? c.sonidos.map((t) => `[${t}]`).join(' ') : ''
  const t = (c.text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return tags
  return partirLineas(tags ? `${tags} ${t}` : t)
}

function hora(seg, sep) {
  const ms = Math.max(0, Math.round(seg * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const p = (n, k = 2) => String(n).padStart(k, '0')
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(ms % 1000, 3)}`
}
export const horaSRT = (s) => hora(s, ',')
export const horaVTT = (s) => hora(s, '.')

const visibles = (cues, conSonidos) => cues.map((c) => ({ ...c, t: textoCue(c, conSonidos) })).filter((c) => c.t)

export function aSRT(cues, conSonidos = true) {
  return visibles(cues, conSonidos).map((c, i) => `${i + 1}\n${horaSRT(c.start)} --> ${horaSRT(c.end)}\n${c.t}\n`).join('\n')
}
export function aVTT(cues, conSonidos = true) {
  return `WEBVTT\n\n${visibles(cues, conSonidos).map((c) => `${horaVTT(c.start)} --> ${horaVTT(c.end)}\n${c.t}\n`).join('\n')}`
}
export function aTXT(cues, conSonidos = true) {
  return visibles(cues, conSonidos).map((c) => c.t.replace(/\n/g, ' ')).join('\n')
}

/**
 * Corta el audio en tramos de como mucho `max` segundos para Whisper, buscando el momento
 * más silencioso entre `min` y `max` para no partir palabras. Devuelve [[inicio, fin], ...] en muestras.
 */
export function cortesSilencio(audio, sr = 16000, { min = 20, max = 29 } = {}) {
  const tramos = []
  const marco = Math.round(sr * 0.05)
  let pos = 0
  while (audio.length - pos > max * sr) {
    let mejor = pos + max * sr
    let menor = Infinity
    for (let i = pos + min * sr; i + marco <= pos + max * sr; i += marco) {
      let e = 0
      for (let k = i; k < i + marco; k++) e += audio[k] * audio[k]
      if (e < menor) { menor = e; mejor = i + Math.floor(marco / 2) }
    }
    tramos.push([pos, mejor])
    pos = mejor
  }
  if (audio.length > pos) tramos.push([pos, audio.length])
  return tramos
}

/** Volumen medio (RMS) de un trozo de audio. */
export function volumen(audio, desde = 0, hasta = audio.length) {
  let e = 0
  for (let i = desde; i < hasta; i++) e += audio[i] * audio[i]
  return Math.sqrt(e / Math.max(1, hasta - desde))
}
