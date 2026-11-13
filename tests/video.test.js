import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planCompresion, objetivoMB, aSegundos, reloj, verMB } from '../src/lib/video.js'

test('un vídeo de 1 minuto en 1080p para Discord baja a 720p y cabe en 10 MB', () => {
  const p = planCompresion({ duracion: 60, ancho: 1920, alto: 1080, objetivoMB: 10 })
  assert.ok(p.posible)
  assert.equal(p.alto, 480) // ~1,2 Mbps de vídeo: 480p
  assert.equal(p.ancho % 2, 0)
  const bytes = ((p.video + p.audio) * 60) / 8
  assert.ok(bytes <= 10 * 1024 * 1024, `${bytes}`)
})

test('en vertical respeta la orientación y nunca agranda', () => {
  const p = planCompresion({ duracion: 60, ancho: 1080, alto: 1920, objetivoMB: 10 })
  assert.equal(p.ancho, 480)
  assert.equal(p.alto, 854)
  const q = planCompresion({ duracion: 10, ancho: 640, alto: 360, objetivoMB: 100 })
  assert.equal(q.ancho, 640)
  assert.equal(q.alto, 360)
})

test('sin sonido, todo el tamaño es para la imagen; si es imposible, dice el mínimo', () => {
  const a = planCompresion({ duracion: 60, ancho: 1280, alto: 720, objetivoMB: 10, sinSonido: true })
  assert.equal(a.audio, 0)
  const b = planCompresion({ duracion: 3600, ancho: 1920, alto: 1080, objetivoMB: 10 })
  assert.equal(b.posible, false)
  assert.ok(b.minimoMB > 10)
})

test('objetivos, tiempos y tamaños', () => {
  assert.equal(objetivoMB('mitad', 80), 40)
  assert.equal(objetivoMB('discord', 80), 10)
  assert.equal(objetivoMB('otro', 80, 33), 33)
  assert.equal(aSegundos('1:05'), 65)
  assert.equal(aSegundos('1:02:03'), 3723)
  assert.equal(aSegundos('12,5'), 12.5)
  assert.equal(aSegundos('abc'), null)
  assert.equal(aSegundos(''), null)
  assert.equal(reloj(3723), '1:02:03')
  assert.equal(reloj(65), '1:05')
  assert.equal(verMB(5 * 1024 * 1024), '5,00 MB')
})
