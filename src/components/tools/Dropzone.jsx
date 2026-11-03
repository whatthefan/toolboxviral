import { useEffect, useRef, useState } from 'react'

/** Zona para arrastrar, pegar (Ctrl+V) o elegir una imagen. */
export default function Dropzone({ onFile, hint = 'PNG, JPG o WebP' }) {
  const [over, setOver] = useState(false)
  const input = useRef(null)

  useEffect(() => {
    const onPaste = (e) => {
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'))
      if (file) onFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [onFile])

  const pick = (files) => {
    const file = [...files].find((f) => f.type.startsWith('image/'))
    if (file) onFile(file)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files) }}
      className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition
        ${over ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-zinc-300 hover:border-violet-400 dark:border-zinc-700'}`}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
      </div>
      <p className="text-lg font-semibold">Arrastra tu imagen aquí</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">o haz clic para elegirla · también puedes pegarla con Ctrl+V</p>
      <p className="text-xs text-zinc-400">{hint}</p>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files)} />
    </div>
  )
}
