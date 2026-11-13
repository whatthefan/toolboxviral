import { useRef, useState } from 'react'

const EXT = /\.(mp4|mov|m4v|webm|mkv|avi|3gp|mp3|m4a|wav|ogg|oga|opus|flac|aac)$/i
export const esMedia = (f, soloVideo = false) => (soloVideo ? f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(f.name) : /^(audio|video)\//.test(f.type) || EXT.test(f.name))

/** Zona para arrastrar o elegir un vídeo (o un audio). */
export default function DropMedia({ onFile, soloVideo = false, titulo, hint }) {
  const [over, setOver] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)
  const pick = (files) => {
    const f = [...(files || [])][0]
    if (!f) return
    if (!esMedia(f, soloVideo)) return setError(soloVideo ? 'Ese archivo no es un vídeo.' : 'Ese archivo no es un vídeo ni un audio.')
    setError('')
    onFile(f)
  }
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files) }}
        className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition ${over ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-zinc-300 hover:border-violet-400 dark:border-zinc-700'}`}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
        </div>
        <p className="text-lg font-semibold">{titulo ?? (soloVideo ? 'Arrastra tu vídeo aquí' : 'Arrastra tu vídeo o audio aquí')}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">o haz clic para elegirlo · no se sube a ningún servidor</p>
        <p className="text-xs text-zinc-400">{hint ?? 'MP4, MOV, WebM, MKV…'}</p>
        <input ref={input} type="file" accept={soloVideo ? 'video/*,.mkv,.mov' : 'video/*,audio/*,.mkv,.m4a,.opus,.flac'} hidden onChange={(e) => pick(e.target.files)} />
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
