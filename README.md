# ToolBoxViral

Herramientas gratis para fotos y textos de redes sociales, monetizadas con Google AdSense.
Astro 5 + React 19 (solo en las herramientas) + Tailwind CSS 4. Todo se procesa en el navegador: no hay servidor ni base de datos.

| Herramienta | Ruta | Cómo funciona |
|---|---|---|
| Quitar fondo | `/quitar-fondo` | IA en el navegador (`@imgly/background-removal`) |
| Convertir y comprimir | `/convertir-imagen` | Canvas: HEIC (con `heic2any`), JPG, PNG, WebP; varias a la vez |
| Tamaños para redes | `/redimensionar-imagen` | Canvas: Reels, TikTok, Instagram, YouTube, X, LinkedIn |
| Analizador de texto | `/analizador-de-texto` | Recuento, legibilidad Fernández-Huerta, clichés y ritmo |

## Uso en local

```bash
npm install
npm run dev
```

## Publicar

Igual que las otras webs: Cloudflare Pages conectado al repositorio, comando `npm run build`, carpeta `dist`.
`public/_headers` evita que se indexe la dirección *.pages.dev.

## Licencia de «Quitar fondo»

`@imgly/background-removal` tiene licencia **AGPL-3.0**: para usarla gratis en una web pública, el código de la web
debe ser público (repositorio público). Si no, hay que comprar la licencia comercial de IMG.LY o quitar esa herramienta.

## AdSense

Variables de entorno: `PUBLIC_ADSENSE_CLIENT` (y opcionalmente `PUBLIC_AD_SLOT_TOP`, `PUBLIC_AD_SLOT_CONTENT`, `PUBLIC_AD_SLOT_SIDEBAR`).
Con el ID puesto, se generan solos el script, la etiqueta de verificación y `/ads.txt`.
