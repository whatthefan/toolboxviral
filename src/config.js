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
  client: import.meta.env.PUBLIC_ADSENSE_CLIENT || '',
  slots: {
    top: import.meta.env.PUBLIC_AD_SLOT_TOP || '',
    content: import.meta.env.PUBLIC_AD_SLOT_CONTENT || '',
    sidebar: import.meta.env.PUBLIC_AD_SLOT_SIDEBAR || '',
  },
}

export const CATEGORIAS = ['Imágenes', 'Textos']

// nav: true = aparece en el menú superior
export const TOOLS = [
  { cat: 0, nav: true, path: '/quitar-fondo', label: 'Quitar fondo', title: 'Quitar el fondo de una imagen', icon: 'scissors', blurb: 'Elimina el fondo de cualquier foto con IA y descárgala en PNG transparente.' },
  { cat: 0, nav: true, path: '/convertir-imagen', label: 'Convertir imagen', title: 'Convertir y comprimir imágenes', icon: 'repeat', blurb: 'Pasa de HEIC, PNG o WebP a JPG (y al revés) y reduce el peso, varias a la vez.' },
  { cat: 0, nav: true, path: '/redimensionar-imagen', label: 'Tamaños para redes', title: 'Redimensionar para redes sociales', icon: 'crop', blurb: 'Adapta tus fotos a Reels, TikTok, Stories, Instagram y miniaturas de YouTube.' },
  { cat: 1, nav: true, path: '/analizador-de-texto', label: 'Analizar texto', title: 'Contador de palabras y analizador', icon: 'type', blurb: 'Palabras, caracteres, tiempo de lectura, legibilidad y frases cliché.' },
]

/** Foto de cada página (public/img, fotos de Unsplash: ver CREDITOS-FOTOS.md). */
export const photo = (path) => `/img/${path === '/' ? 'hero' : path.slice(1)}.webp`
