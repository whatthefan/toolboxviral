# ToolBoxViral

Herramientas gratis para fotos y textos de redes sociales, monetizadas con Google AdSense.
Astro 5 + React 19 (solo en las herramientas) + Tailwind CSS 4. Todo se procesa en el navegador: no hay servidor ni base de datos.

| Herramienta | Ruta | Cómo funciona |
|---|---|---|
| Quitar fondo | `/quitar-fondo` | Modelo ISNet con pesos de 8 bits (`public/models/isnet-v1-*.bin`, gzip troceado) con onnxruntime-web 1.30 (WebGPU o procesador), en el navegador |
| Convertir y comprimir | `/convertir-imagen` | Canvas: HEIC (con `heic2any`), JPG, PNG, WebP; varias a la vez |
| Tamaños para redes | `/redimensionar-imagen` | Canvas: Reels, TikTok, Instagram, YouTube, X, LinkedIn |
| Detector de IA | `/detector-de-ia` | Recuento, legibilidad Fernández-Huerta, clichés y ritmo |

## Uso en local

```bash
npm install
npm run dev
```

## Publicar

Igual que las otras webs: Cloudflare Pages conectado al repositorio, comando `npm run build`, carpeta `dist`.
`public/_headers` evita que se indexe la dirección *.pages.dev.

## Licencias

El recortador usa el modelo ISNet de DIS (Apache 2.0) y onnxruntime-web (MIT), alojados en `public/models` y `public/ort`.
Ninguna obliga a que el repositorio sea público.

## AdSense

Variables de entorno: `PUBLIC_ADSENSE_CLIENT` (y opcionalmente `PUBLIC_AD_SLOT_TOP`, `PUBLIC_AD_SLOT_CONTENT`, `PUBLIC_AD_SLOT_SIDEBAR`).
Con el ID puesto, se generan solos el script, la etiqueta de verificación y `/ads.txt`.
