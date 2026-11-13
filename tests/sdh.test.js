import { test } from 'node:test'
import assert from 'node:assert/strict'
import { etiqueta, detectarSonidos, aSubtitulos, combinar, partirLineas, aSRT, aVTT, aTXT, horaSRT, cortesSilencio, limpiar } from '../src/lib/sdh.js'

const v = (start, preds) => ({ start, end: start + 3, preds: preds.map(([label, score]) => ({ label, score })) })

test('etiquetas en los dos idiomas y la voz se ignora', () => {
  assert.equal(etiqueta('Laughter'), 'risas')
  assert.equal(etiqueta('Laughter', 'en'), 'laughter')
  assert.equal(etiqueta('Dog'), 'perro ladrando')
  assert.equal(etiqueta('Speech'), null)
  assert.equal(etiqueta('Electric guitar'), 'música')
  assert.equal(etiqueta('Heartbeat'), null)
})

test('detecta sonidos, une ventanas seguidas y descarta música corta', () => {
  const ev = detectarSonidos([
    v(0, [['Speech', 0.9], ['Laughter', 0.6]]),
    v(3, [['Laughter', 0.5], ['Music', 0.5]]),
    v(6, [['Speech', 0.8]]),
    v(9, [['Applause', 0.3], ['Music', 0.6]]),
    v(12, [['Music', 0.7]]),
  ])
  assert.deepEqual(ev.map((e) => [e.tag, e.start, e.end]), [['risas', 0, 6], ['aplausos', 9, 12], ['música', 9, 15]])
  // Con sensibilidad baja, los aplausos al 30 % no pasan
  assert.ok(!detectarSonidos([v(0, [['Applause', 0.3]])], { sensibilidad: 'baja' }).length)
})

test('limpia las frases que Whisper se inventa', () => {
  const c = limpiar([{ text: ' Subtítulos realizados por la comunidad de Amara.org ', start: 0, end: 2 }, { text: ' Hola  a todos ', start: 2, end: 3 }])
  assert.deepEqual(c, [{ text: 'Hola a todos', start: 2, end: 3 }])
})

test('parte en dos líneas equilibradas de 42 caracteres', () => {
  const t = 'Esto es una frase bastante larga que no cabe en una sola línea'
  const p = partirLineas(t)
  const [a, b] = p.split('\n')
  assert.ok(a.length <= 42 && b.length <= 42)
  assert.ok(Math.abs(a.length - b.length) < 12)
  assert.equal(partirLineas('Corta'), 'Corta')
})

test('trocea los fragmentos largos sin pasar de 2 líneas ni 7 segundos', () => {
  const text = 'Hoy vamos a hablar de cómo funciona la factura de la luz, qué es el término de potencia y por qué cambia tanto el precio cada hora del día en España.'
  const cues = aSubtitulos([{ text, start: 10, end: 25 }])
  assert.ok(cues.length >= 3)
  assert.equal(cues[0].start, 10)
  assert.ok(Math.abs(cues.at(-1).end - 25) < 1e-9)
  for (const c of cues) {
    assert.ok(c.end - c.start <= 7.01, `dura ${c.end - c.start}`)
    assert.ok(c.text.split('\n').length <= 2 && c.text.split('\n').every((l) => l.length <= 42), c.text)
  }
  assert.equal(cues.map((c) => c.text.replace('\n', ' ')).join(' '), text)
})

test('el sonido va delante de la frase o como subtítulo propio', () => {
  const cues = [{ start: 2, end: 4, text: 'Qué bueno' }, { start: 10, end: 12, text: 'Gracias' }]
  const out = combinar(cues, [{ tag: 'risas', start: 2.5, end: 4 }, { tag: 'aplausos', start: 5, end: 9 }, { tag: 'perro ladrando', start: 9.6, end: 10 }])
  assert.deepEqual(out.map((c) => [c.start, c.end, c.text, c.sonidos]), [
    [2, 4, 'Qué bueno', ['risas']],
    [5, 9, '', ['aplausos']],
    [10, 12, 'Gracias', ['perro ladrando']],
  ])
  const srt = aSRT(out)
  assert.match(srt, /^1\n00:00:02,000 --> 00:00:04,000\n\[risas\] Qué bueno\n/)
  assert.match(srt, /\n2\n00:00:05,000 --> 00:00:09,000\n\[aplausos\]\n/)
  // Sin sonidos, el subtítulo de solo aplausos desaparece y se renumera
  assert.equal(aSRT(out, false).split('\n\n').length, 2)
  assert.match(aVTT(out), /^WEBVTT\n\n00:00:02\.000 --> 00:00:04\.000\n/)
  assert.equal(aTXT(out, false), 'Qué bueno\nGracias')
})

test('formato de hora', () => {
  assert.equal(horaSRT(3723.4567), '01:02:03,457')
  assert.equal(horaSRT(-1), '00:00:00,000')
})

test('corta el audio en el silencio y cubre todo sin huecos', () => {
  const sr = 1000
  const audio = new Float32Array(70 * sr).map((_, i) => Math.sin(i))
  audio.fill(0, 24 * sr, 24.2 * sr) // silencio a los 24 s
  const t = cortesSilencio(audio, sr)
  assert.ok(Math.abs(t[0][1] - 24.1 * sr) < 0.1 * sr, `corte en ${t[0][1]}`)
  for (let i = 1; i < t.length; i++) assert.equal(t[i][0], t[i - 1][1])
  assert.equal(t.at(-1)[1], audio.length)
  assert.ok(t.every(([a, b]) => b - a <= 29 * sr))
})

test('un sonido absorbe a otro que ya explica y las etiquetas parecidas suman', async () => {
  const { detectarSonidos, conVoz, vozEntre } = await import('../src/lib/sdh.js')
  const ev = detectarSonidos([v(0, [['Knock', 0.9], ['Door', 0.7]]), v(5, [['Laughter', 0.15], ['Snicker', 0.12], ['Chuckle, chortle', 0.1]])])
  assert.deepEqual(ev.map((e) => e.tag), ['golpes en la puerta', 'risas'])
  const vent = [{ start: 0, end: 1, voz: 0.9, preds: [] }, { start: 5, end: 6, voz: 0.01, preds: [] }]
  assert.equal(vozEntre(vent, 0.5, 2), 0.9)
  assert.equal(vozEntre([], 0, 1), 1)
  assert.deepEqual(conVoz([{ text: 'Hola', start: 0, end: 1 }, { text: 'Amén', start: 5, end: 6 }], vent).map((c) => c.text), ['Hola'])
})

test('los tiempos se ajustan a cuando de verdad se oye voz', async () => {
  const { aSubtitulos, tramosVoz } = await import('../src/lib/sdh.js')
  // Voz de 1 a 5 s, risas de 6 a 16 s (sin voz), voz de 17 a 20 s
  const vent = []
  for (let t = 0; t < 21; t += 0.48) {
    const voz = (t + 0.48 >= 1 && t + 0.48 <= 5) || (t + 0.48 >= 17 && t + 0.48 <= 20) ? 0.95 : 0.02
    vent.push({ start: t, end: t + 0.96, voz, preds: [] })
  }
  const tr = tramosVoz(vent, 0, 21)
  assert.equal(tr.length, 2)
  assert.ok(tr[0][0] < 1.2 && tr[0][1] > 4.8 && tr[0][1] < 6, JSON.stringify(tr))
  // Whisper dice que la frase dura de 0 a 17 s: se recorta a la voz real
  const cues = aSubtitulos([{ text: 'Hola a todos, bienvenidos al programa de esta noche.', start: 0, end: 17 }], vent)
  assert.equal(cues.length, 1)
  assert.ok(cues[0].start > 0.5 && cues[0].end < 6, JSON.stringify(cues))
})
