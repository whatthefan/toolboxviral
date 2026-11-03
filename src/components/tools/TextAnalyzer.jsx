import { useDeferredValue, useMemo, useState } from 'react'
import { analyze, readabilityLabel } from '../../lib/textStats.js'

const EXAMPLE = `En la era digital, las redes sociales juegan un papel fundamental en nuestra vida. Es importante destacar que no solo sirven para entretenernos, sino también para aprender. Además, ofrecen una amplia gama de oportunidades para los creadores de contenido.

Ayer subí mi primer vídeo. Tres visitas. Una era mi madre, claro. Pero no me rindo: el próximo lo grabaré con mejor luz y un guion más corto, porque he visto que la gente se va antes del segundo diez.

En conclusión, es fundamental ser constante y adaptarse a un panorama en constante evolución.`

const fmtTime = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ''}`)

export default function TextAnalyzer() {
  const [text, setText] = useState('')
  const deferred = useDeferredValue(text)
  const s = useMemo(() => analyze(deferred), [deferred])
  const hasText = s.words > 0

  return (
    <div className="space-y-6">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega aquí tu redacción, artículo o guion…"
          className="min-h-56 w-full resize-y rounded-2xl border border-zinc-300 bg-zinc-50 p-4 leading-relaxed outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="mt-2 flex gap-3 text-sm">
          <button onClick={() => setText(EXAMPLE)} className="text-violet-600 hover:underline dark:text-violet-400">Probar con un ejemplo</button>
          {text && <button onClick={() => setText('')} className="text-zinc-500 hover:underline">Borrar</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Palabras" value={s.words.toLocaleString('es')} />
        <Stat label="Caracteres" value={s.chars.toLocaleString('es')} sub={`${s.charsNoSpaces.toLocaleString('es')} sin espacios`} />
        <Stat label="Tiempo de lectura" value={fmtTime(s.readingSec)} sub={`${fmtTime(s.speakingSec)} hablando`} />
        <Stat label="Frases / párrafos" value={`${s.sentences} / ${s.paragraphs}`} sub={hasText ? `${s.avgSentence.toFixed(1)} palabras por frase` : ''} />
      </div>

      {hasText && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Legibilidad (Fernández-Huerta)">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{Math.round(s.readability)}</span>
              <span className="text-sm text-zinc-500">/ 100 · {readabilityLabel(s.readability)}</span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400">
              <div className="relative h-full" style={{ width: `${s.readability}%` }}>
                <span className="absolute -top-1 right-0 h-4.5 w-1.5 translate-x-1/2 rounded-full bg-zinc-900 ring-2 ring-white dark:bg-white dark:ring-zinc-900" />
              </div>
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-zinc-400"><span>Difícil</span><span>Fácil</span></div>
          </Card>

          <Card title="Ritmo de las frases">
            <div className="flex h-16 items-end gap-0.5" aria-label="Longitud de cada frase">
              {s.sentenceLengths.slice(0, 60).map((n, i) => (
                <div
                  key={i}
                  title={`Frase ${i + 1}: ${n} palabras`}
                  className="min-w-1 flex-1 rounded-t bg-violet-500/80"
                  style={{ height: `${Math.min(100, (n / Math.max(...s.sentenceLengths)) * 100)}%` }}
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {s.sentences < 5
                ? 'Escribe al menos 5 frases para valorar el ritmo.'
                : s.variation < 0.35
                  ? 'Muy uniforme: todas las frases miden parecido. Es típico de textos generados y se lee monótono. Mezcla frases cortas y largas.'
                  : s.variation < 0.7
                    ? 'Variado: alternas frases cortas y largas, lo que hace el texto más natural.'
                    : 'Muy variado: revisa que las frases más largas no sean difíciles de seguir.'}
            </p>
          </Card>

          <Card title="Frases cliché y muletillas">
            {s.cliches.length ? (
              <>
                <ul className="flex flex-wrap gap-2">
                  {s.cliches.map(([c, n]) => (
                    <li key={c} className="rounded-lg bg-amber-100 px-2 py-1 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                      {c}{n > 1 && <b> ×{n}</b>}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {s.clichesPer100 >= 2
                    ? 'Densidad alta. Estas expresiones abundan en textos generados por IA y en redacciones de relleno: sustitúyelas por ideas concretas.'
                    : 'Densidad baja: ninguna de estas expresiones es un problema por sí sola.'}
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No hemos encontrado frases cliché. ¡Bien!</p>
            )}
          </Card>

          <Card title="Palabras más repetidas">
            {s.repeated.length ? (
              <ul className="space-y-1.5">
                {s.repeated.map(([w, n]) => (
                  <li key={w} className="flex items-center gap-2 text-sm">
                    <span className="w-28 truncate">{w}</span>
                    <span className="h-2 rounded-full bg-violet-500/70" style={{ width: `${(n / s.repeated[0][1]) * 60}%` }} />
                    <span className="text-zinc-500 tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Ninguna palabra importante se repite 3 veces o más.</p>
            )}
          </Card>
        </div>
      )}

      {hasText && (
        <p className="rounded-xl bg-zinc-100 p-4 text-xs text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
          Ninguna herramienta puede asegurar si un texto lo ha escrito una persona o una IA. Estas señales sirven para mejorar tu redacción,
          no como prueba para acusar a nadie.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}
