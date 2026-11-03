export default function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 shadow-sm shadow-violet-600/30',
    ghost: 'border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
