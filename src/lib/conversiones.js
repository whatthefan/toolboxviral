// Páginas de cada conversión. Todas usan el conversor de imágenes con el formato de salida ya elegido.
export const CONVERSIONES = [
  {
    slug: 'heic-a-jpg', de: 'HEIC', a: 'JPG', formato: 'jpg',
    porque: 'El iPhone guarda las fotos en HEIC, un formato que pesa poco pero que muchas webs, programas y móviles Android no abren. JPG lo abre todo el mundo.',
    faq: [
      ['¿Por qué mis fotos del iPhone son HEIC?', 'Desde iOS 11, la cámara del iPhone guarda en HEIC (o HEIF) porque ocupa casi la mitad que un JPG con la misma calidad. Puedes cambiarlo en Ajustes → Cámara → Formatos → Más compatible.'],
      ['¿Pierdo calidad al pasar de HEIC a JPG?', 'Con una calidad del 85 % o más, la diferencia no se nota. El JPG pesará algo más que el HEIC original.'],
    ],
  },
  {
    slug: 'heic-a-png', de: 'HEIC', a: 'PNG', formato: 'png',
    porque: 'PNG guarda la imagen sin pérdida de calidad, así que es útil si vas a editar la foto del iPhone varias veces.',
    faq: [['¿Por qué el PNG pesa tanto?', 'Porque PNG no comprime con pérdida. Para enviar o publicar la foto, JPG o WebP pesan mucho menos.']],
  },
  {
    slug: 'webp-a-jpg', de: 'WebP', a: 'JPG', formato: 'jpg',
    porque: 'Muchas webs sirven sus imágenes en WebP. Al guardarlas, algunos programas, editores y redes no las aceptan; en JPG funcionan en todas partes.',
    faq: [
      ['¿Se puede pasar de WebP a JPG sin perder calidad?', 'Ponle una calidad del 90 % o más y no notarás diferencia. El archivo pesará algo más que el WebP.'],
      ['¿Qué pasa con la transparencia?', 'JPG no tiene transparencia: las zonas transparentes se rellenan de blanco. Si quieres conservarla, convierte a PNG.'],
    ],
  },
  {
    slug: 'webp-a-png', de: 'WebP', a: 'PNG', formato: 'png',
    porque: 'Si el WebP tiene fondo transparente (logos, pegatinas, recortes), PNG es el formato que conserva esa transparencia y que abre cualquier editor.',
    faq: [['¿Se mantiene el fondo transparente?', 'Sí. PNG conserva la transparencia del WebP.']],
  },
  {
    slug: 'png-a-jpg', de: 'PNG', a: 'JPG', formato: 'jpg',
    porque: 'Las capturas de pantalla y muchas imágenes descargadas vienen en PNG, que pesa mucho. En JPG ocupan bastante menos y se envían y suben más rápido.',
    faq: [
      ['¿Por qué sale el fondo blanco?', 'JPG no admite transparencia, así que las zonas transparentes del PNG se rellenan de blanco.'],
      ['¿Cuál es mejor, PNG o JPG?', 'Para fotos, JPG: pesa mucho menos. Para logos, capturas con texto o imágenes con transparencia, PNG.'],
    ],
  },
  {
    slug: 'jpg-a-png', de: 'JPG', a: 'PNG', formato: 'png',
    porque: 'PNG guarda la imagen sin volver a comprimirla, útil si la vas a editar o si una web te pide PNG.',
    faq: [['¿El PNG tendrá fondo transparente?', 'No: un JPG no tiene transparencia, así que el PNG conserva el fondo. Para quitarlo usa nuestra herramienta de quitar el fondo.']],
  },
  {
    slug: 'jpg-a-webp', de: 'JPG', a: 'WebP', formato: 'webp',
    porque: 'WebP pesa entre un 25 % y un 35 % menos que JPG con la misma calidad, así que tu web o tu tienda online cargan más rápido.',
    faq: [['¿Todos los navegadores abren WebP?', 'Sí, todos los navegadores actuales (Chrome, Safari, Firefox y Edge) lo muestran.']],
  },
  {
    slug: 'png-a-webp', de: 'PNG', a: 'WebP', formato: 'webp',
    porque: 'WebP conserva la transparencia del PNG y pesa mucho menos, ideal para logos e imágenes de una web.',
    faq: [['¿Se mantiene la transparencia?', 'Sí. WebP admite transparencia igual que PNG.']],
  },
]
