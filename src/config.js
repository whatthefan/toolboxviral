import { GUIAS } from './lib/guias.js'

// Datos del sitio.
export const SITE = {
  name: 'ToolBoxViral',
  domain: 'toolboxviral.com',
  email: 'juanfersem@gmail.com',
  owner: 'Juan Antonio Fernández Selma',
  ownerId: '49891813Y',
  address: 'Calle Poeta Alonso de Bonilla, 14012 Córdoba (España)',
  updated: '3 de noviembre de 2026',
  tagline: 'Herramientas gratis para fotos y textos de redes: quitar fondos, convertir, redimensionar y analizar. Todo en tu navegador.',
}

export const ADSENSE = {
  client: import.meta.env.PUBLIC_ADSENSE_CLIENT || 'ca-pub-6537533170373373',
  slots: {
    top: import.meta.env.PUBLIC_AD_SLOT_TOP || '',
    content: import.meta.env.PUBLIC_AD_SLOT_CONTENT || '',
    sidebar: import.meta.env.PUBLIC_AD_SLOT_SIDEBAR || '',
  },
}

export const CATEGORIAS = ['Imágenes', 'Textos y utilidades', 'Vídeo y audio']

// nav: true = aparece en el menú superior
export const TOOLS = [
  { cat: 0, nav: true, path: '/quitar-fondo', label: 'Quitar fondo', title: 'Quitar el fondo de una imagen', icon: 'scissors', blurb: 'Elimina el fondo de cualquier foto en un segundo y descárgala en PNG transparente.' },
  { cat: 0, nav: true, path: '/convertir-imagen', label: 'Convertir imagen', title: 'Convertir y comprimir imágenes', icon: 'repeat', blurb: 'Pasa de HEIC, PNG o WebP a JPG (y al revés) y reduce el peso, varias a la vez.' },
  { cat: 0, nav: true, path: '/redimensionar-imagen', label: 'Tamaños para redes', title: 'Redimensionar para redes sociales', icon: 'crop', blurb: 'Adapta tus fotos a Reels, TikTok, Stories, Instagram y miniaturas de YouTube.' },
  { cat: 0, path: '/unir-pdf', label: 'Unir PDF', title: 'Unir PDF', icon: 'files', blurb: 'Junta varios PDF en uno, ordénalos y descárgalo. Sin subir tus documentos.' },
  { cat: 0, path: '/imagen-a-pdf', label: 'Imagen a PDF', title: 'Convertir imagen a PDF', icon: 'file-image', blurb: 'Une una o varias fotos en un PDF, ordénalas y descárgalo al momento.' },
  { cat: 2, nav: true, path: '/subtitulos-automaticos', label: 'Subtítulos', title: 'Subtítulos automáticos con sonidos', icon: 'captions', blurb: 'Subtítulos de cualquier vídeo en minutos, con los sonidos marcados: [risas], [aplausos], [música]. SRT y VTT.' },
  { cat: 1, nav: true, path: '/detector-de-ia', label: 'Detector de IA', title: 'Detector de textos hechos con IA', icon: 'scan-text', blurb: 'Qué probabilidad hay de que un texto esté escrito con IA, y por qué. Con contador de palabras.' },
  { cat: 1, path: '/generador-qr', label: 'Generador QR', title: 'Generador de códigos QR', icon: 'qr-code', blurb: 'QR para tu web, tu WiFi o tu teléfono. Sin caducidad y en alta calidad.' },
  { cat: 1, path: '/generador-de-contrasenas', label: 'Contraseñas', title: 'Generador de contraseñas seguras', icon: 'key-round', blurb: 'Contraseñas aleatorias y seguras en un clic, creadas en tu dispositivo.' },
]

/** Foto de cada página (public/img, fotos de Unsplash: ver CREDITOS-FOTOS.md). */
export const photo = (path) => {
  if (path === '/unir-pdf') return '/img/imagen-a-pdf.webp'
  if (path.startsWith('/guias')) return `/img/${GUIAS.find((g) => path.endsWith(g.slug))?.img ?? 'hero'}.webp`
  return `/img/${path === '/' ? 'hero' : path.slice(1)}.webp`
}
