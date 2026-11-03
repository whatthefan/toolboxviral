import { useCallback, useEffect, useState } from 'react'
import Button from './Button.jsx'

const GRUPOS = {
  minusculas: 'abcdefghijkmnopqrstuvwxyz',
  mayusculas: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  numeros: '23456789',
  simbolos: '!#$%&*+-=?@_',
}

/** Número aleatorio seguro entre 0 y n-1 (crypto, sin sesgo). */
function azar(n) {
  const max = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= max)
  return buf[0] % n
}

function generar(largo, opciones) {
  const grupos = Object.entries(GRUPOS).filter(([k]) => opciones[k]).map(([, v]) => v)
  if (!grupos.length) return ''
  const todos = grupos.join('')
  // Al menos un carácter de cada tipo elegido, el resto al azar, y luego se mezcla
  const c = grupos.map((g) => g[azar(g.length)])
  while (c.length < largo) c.push(todos[azar(todos.length)])
  for (let i = c.length - 1; i > 0; i--) { const j = azar(i + 1); [c[i], c[j]] = [c[j], c[i]] }
  return c.slice(0, largo).join('')
}

/** Bits de entropía aproximados y cómo de segura es. */
function fuerza(largo, opciones) {
  const n = Object.entries(GRUPOS).filter(([k]) => opciones[k]).reduce((a, [, v]) => a + v.length, 0)
  const bits = n ? largo * Math.log2(n) : 0
  return { bits, nivel: bits >= 100 ? ['Muy segura', 'bg-emerald-500', 100] : bits >= 75 ? ['Segura', 'bg-emerald-400', 75] : bits >= 55 ? ['Aceptable', 'bg-amber-400', 50] : ['Débil', 'bg-red-500', 25] }
}

export default function Contrasenas() {
  const [largo, setLargo] = useState(16)
  const [op, setOp] = useState({ minusculas: true, mayusculas: true, numeros: true, simbolos: true })
  const [clave, setClave] = useState('')
  const [copiada, setCopiada] = useState(false)
  const nueva = useCallback(() => { setClave(generar(largo, op)); setCopiada(false) }, [largo, op])
  useEffect(nueva, [nueva])
  const f = fuerza(largo, op)
  const copiar = async () => { try { await navigator.clipboard.writeText(clave); setCopiada(true) } catch {} }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-stone-900 p-5 text-center dark:bg-black/40">
        <p className="font-mono text-2xl break-all text-white select-all sm:text-3xl" aria-live="polite">{clave || 'Elige al menos un tipo de carácter'}</p>
        <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-white/15"><div className={`h-full ${f.nivel[1]}`} style={{ width: `${f.nivel[2]}%` }} /></div>
        <p className="mt-2 text-sm text-stone-300">{f.nivel[0]} · unos {Math.round(f.bits)} bits de seguridad</p>
      </div>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={copiar} disabled={!clave}>{copiada ? 'Copiada' : 'Copiar contraseña'}</Button>
        <Button variant="ghost" onClick={nueva}>Generar otra</Button>
      </div>
      <label className="block">
        <span className="mb-1.5 flex justify-between text-sm font-medium"><span>Longitud</span><span className="tabular-nums text-stone-500">{largo} caracteres</span></span>
        <input type="range" min="8" max="64" value={largo} onChange={(e) => setLargo(+e.target.value)} className="w-full accent-brand-600" />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['minusculas', 'Minúsculas'], ['mayusculas', 'Mayúsculas'], ['numeros', 'Números'], ['simbolos', 'Símbolos']].map(([k, t]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-900/10 p-3 text-sm dark:border-white/10">
            <input type="checkbox" checked={op[k]} onChange={(e) => setOp({ ...op, [k]: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            {t}
          </label>
        ))}
      </div>
      <p className="text-center text-xs text-stone-500 dark:text-stone-400">Se generan en tu dispositivo con el generador aleatorio seguro del navegador. No se guardan ni se envían a ningún sitio. Se evitan caracteres que se confunden (l, 1, I, O, 0).</p>
    </div>
  )
}
