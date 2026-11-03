// Crea un PDF con una imagen JPG por página, directamente en el navegador (sin librerías ni servidores).
const A4 = [595.28, 841.89] // puntos (1/72 de pulgada)
const f = (n) => (Math.round(n * 100) / 100).toString()

/** Tamaño de la página y posición de la imagen. pagina: 'a4' (vertical u horizontal según la foto) o 'imagen'. */
function encaje({ w, h }, pagina, margen) {
  if (pagina === 'imagen') {
    const pw = w * 0.75 // 96 ppp en pantalla = 72 puntos
    const ph = h * 0.75
    return { pw, ph, x: 0, y: 0, dw: pw, dh: ph }
  }
  const [pw, ph] = w > h ? [A4[1], A4[0]] : A4
  const k = Math.min((pw - 2 * margen) / w, (ph - 2 * margen) / h)
  const dw = w * k
  const dh = h * k
  return { pw, ph, x: (pw - dw) / 2, y: (ph - dh) / 2, dw, dh }
}

/** imagenes: [{ jpeg: Uint8Array, w, h }]. Devuelve un Blob con el PDF. */
export function imagenesAPdf(imagenes, { pagina = 'a4', margen = 28 } = {}) {
  const enc = new TextEncoder()
  const partes = []
  const offsets = []
  let largo = 0
  const add = (x) => {
    const b = typeof x === 'string' ? enc.encode(x) : x
    partes.push(b)
    largo += b.length
  }
  const obj = (id, ...cuerpo) => {
    offsets[id] = largo
    add(`${id} 0 obj\n`)
    cuerpo.forEach(add)
    add('\nendobj\n')
  }

  add('%PDF-1.4\n')
  add(new Uint8Array([37, 226, 227, 207, 211, 10])) // marca de archivo binario
  const n = imagenes.length
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, `<< /Type /Pages /Kids [${imagenes.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`)
  imagenes.forEach((im, i) => {
    const p = 3 + 3 * i
    const { pw, ph, x, y, dw, dh } = encaje(im, pagina, margen)
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pw)} ${f(ph)}] /Resources << /XObject << /Im${i} ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`)
    const dibujo = `q ${f(dw)} 0 0 ${f(dh)} ${f(x)} ${f(y)} cm /Im${i} Do Q`
    obj(p + 1, `<< /Length ${dibujo.length} >>\nstream\n${dibujo}\nendstream`)
    obj(p + 2, `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`, im.jpeg, '\nendstream')
  })
  const xref = largo
  const total = 3 + 3 * n
  add(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let id = 1; id < total; id++) add(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(partes, { type: 'application/pdf' })
}
