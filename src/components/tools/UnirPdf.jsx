import { useRef, useState } from 'react'
import Button from './Button.jsx'

const MAX = 40
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/** Une varios PDF en uno, en el navegador, con pdf-lib (los archivos no salen del dispositivo). */
export default function UnirPdf() {
  const [files, setFiles] = useState([]) // { id, file, pages, error }
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const input = useRef(null)
  const nextId = useRef(1)

  const add = async (list) => {
    const pdfs = [...list].filter(isPdf).slice(0, MAX - files.length)
    if (!pdfs.length) { setMsg('Elige archivos PDF.'); return }
    setMsg('')
    const { PDFDocument } = await import('pdf-lib')
    const items = await Promise.all(pdfs.map(async (file) => {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
        return { id: nextId.current++, file, pages: doc.getPageCount() }
      } catch {
        return { id: nextId.current++, file, pages: 0, error: 'No se puede leer (¿protegido con contraseña?)' }
      }
    }))
    setFiles((f) => [...f, ...items])
  }
  const move = (i, d) => setFiles((f) => { const n = [...f]; const j = i + d; if (j < 0 || j >= n.length) return f; [n[i], n[j]] = [n[j], n[i]]; return n })
  const remove = (id) => setFiles((f) => f.filter((x) => x.id !== id))
  const valid = files.filter((f) => !f.error)
  const totalPages = valid.reduce((a, f) => a + f.pages, 0)

  const merge = async () => {
    setBusy(true)
    setMsg('')
    try {
      const { PDFDocument } = await import('pdf-lib')
      const out = await PDFDocument.create()
      for (const f of valid) {
        const src = await PDFDocument.load(await f.file.arrayBuffer(), { ignoreEncryption: true })
        const pages = await out.copyPages(src, src.getPageIndices())
        pages.forEach((p) => out.addPage(p))
      }
      const bytes = await out.save()
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'unido.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      setMsg(`Listo: ${totalPages} páginas, ${kb(blob.size)}.`)
    } catch {
      setMsg('No se ha podido unir alguno de los PDF. Prueba a quitarlo de la lista.')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${over ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-zinc-300 hover:border-violet-400 dark:border-zinc-700'}`}
      >
        <p className="text-lg font-semibold">{files.length ? 'Añadir más PDF' : 'Arrastra tus PDF aquí'}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">o toca para elegirlos · hasta {MAX} archivos</p>
        <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>

      {files.length > 0 && (
        <ol className="space-y-2">
          {files.map((f, i) => (
            <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-900/10 dark:bg-white/5 dark:ring-white/10">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.file.name}</p>
                <p className={`text-xs ${f.error ? 'text-red-600' : 'text-zinc-500'}`}>{f.error ?? `${f.pages} ${f.pages === 1 ? 'página' : 'páginas'} · ${kb(f.file.size)}`}</p>
              </div>
              <button type="button" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-900/5 disabled:opacity-30 dark:bg-white/10">↑</button>
              <button type="button" aria-label="Bajar" onClick={() => move(i, 1)} disabled={i === files.length - 1} className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-900/5 disabled:opacity-30 dark:bg-white/10">↓</button>
              <button type="button" aria-label="Quitar" onClick={() => remove(f.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-900/5 dark:bg-white/10">✕</button>
            </li>
          ))}
        </ol>
      )}

      {valid.length >= 2 && <Button onClick={merge} disabled={busy} className="w-full">{busy ? 'Uniendo…' : `Unir ${valid.length} PDF (${totalPages} páginas) y descargar`}</Button>}
      {valid.length === 1 && <p className="text-sm text-zinc-500">Añade al menos otro PDF para unirlos.</p>}
      {msg && <p className="text-sm font-medium" aria-live="polite">{msg}</p>}
      <p className="text-xs text-zinc-500">Los PDF se unen en tu propio navegador: no se suben a ningún servidor.</p>
    </div>
  )
}
