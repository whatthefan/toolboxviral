// Parallax de la cabecera y barra de progreso. Solo decoración: si no se ejecuta, la web funciona igual.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const hero = document.querySelector('.hero')
const bar = document.createElement('div')
bar.className = 'scroll-progress'
bar.setAttribute('aria-hidden', 'true')
document.body.append(bar)

let ticking = false
const onScroll = () => {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    const y = scrollY
    if (hero && !reduce) hero.style.setProperty('--hp', Math.min(1, y / Math.max(1, hero.offsetHeight)).toFixed(3))
    const max = document.documentElement.scrollHeight - innerHeight
    const sp = max > 0 ? (y / max).toFixed(4) : 0
    bar.style.setProperty('--sp', sp)
    document.documentElement.style.setProperty('--sp', sp)
    ticking = false
  })
}
addEventListener('scroll', onScroll, { passive: true })
onScroll()

// Tarjeta de resultado de la cabecera: se inclina con el ratón y sus cifras suben una vez.
const tilt = document.querySelector('[data-tilt]')
if (tilt && !reduce) {
  addEventListener('pointermove', (e) => {
    tilt.style.setProperty('--ry', `${((e.clientX / innerWidth) - 0.5) * 10}deg`)
    tilt.style.setProperty('--rx', `${((e.clientY / innerHeight) - 0.5) * -8}deg`)
  }, { passive: true })
}
const locale = document.documentElement.lang === 'es' ? 'es-ES' : 'en-US'
document.querySelectorAll('[data-count]').forEach((el) => {
  const to = +el.dataset.count
  const dec = +(el.dataset.dec || 0)
  const fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' })
  if (reduce) return
  const t0 = performance.now() + 500
  const step = (t) => {
    const k = Math.min(1, Math.max(0, (t - t0) / 1400))
    el.textContent = fmt.format(to * (1 - (1 - k) ** 4))
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
})

// Viaje animado por la página (logo y enlaces internos)
let travelling = 0
const travel = (to) => {
  const from = scrollY
  const d = to - from
  if (Math.abs(d) < 2) return
  if (reduce) return scrollTo(0, to)
  const dur = Math.min(2800, 900 + Math.abs(d) * 0.35)
  const t0 = performance.now()
  const id = ++travelling
  const k5 = (k) => (k < 0.5 ? 16 * k ** 5 : 1 - (-2 * k + 2) ** 5 / 2)
  document.documentElement.classList.add('travel')
  const step = (t) => {
    if (id !== travelling) return
    const k = Math.min(1, (t - t0) / dur)
    scrollTo(0, from + d * k5(k))
    if (k < 1) requestAnimationFrame(step)
    else document.documentElement.classList.remove('travel')
  }
  requestAnimationFrame(step)
}
const stop = () => { if (document.documentElement.classList.contains('travel')) { travelling++; document.documentElement.classList.remove('travel') } }
addEventListener('wheel', stop, { passive: true })
addEventListener('touchstart', stop, { passive: true })

// El logo te sube recorriendo toda la página; en las demás páginas, si ya estás arriba, lleva al inicio como siempre.
const home = location.pathname.replace(/(index)?\.html$/, '') === '/'
document.querySelectorAll('header a[href="/"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.button !== 0) return
    if (home || scrollY > innerHeight * 0.5) {
      e.preventDefault()
      travel(0)
    }
  })
})

// Vídeo de la cabecera: empieza cuando la página ya ha cargado, encima de la foto, y solo si la conexión lo permite.
const video = document.querySelector('video.hero-video[data-src]')
const slow = navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ''))
if (video && !reduce && !slow) {
  const play = () => {
    video.src = video.dataset.src
    video.addEventListener('playing', () => video.classList.add('ready'), { once: true })
    video.play().catch(() => {})
  }
  if (document.readyState === 'complete') setTimeout(play, 300)
  else addEventListener('load', () => setTimeout(play, 300), { once: true })
  new IntersectionObserver(([e]) => { if (video.src) e.isIntersecting ? video.play().catch(() => {}) : video.pause() }).observe(video)
}

document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href*="#"]')
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
  const url = new URL(a.href, location.href)
  if (url.pathname.replace(/(index)?\.html$/, '') !== location.pathname.replace(/(index)?\.html$/, '') || !url.hash) return
  const el = document.getElementById(decodeURIComponent(url.hash.slice(1)))
  if (!el) return
  e.preventDefault()
  history.pushState(null, '', url.hash)
  travel(Math.max(0, el.getBoundingClientRect().top + scrollY - 90))
})

// Menú: fondo oscurecido, enlaces numerados para su animación de entrada y una copia 3D del logo girando arriba.
const menu = document.querySelector('header details')
const panel = menu?.querySelector(':scope > div')
if (menu && panel) {
  const scrim = document.createElement('div')
  scrim.className = 'menu-scrim'
  scrim.setAttribute('aria-hidden', 'true')
  document.body.append(scrim)
  panel.querySelectorAll('a').forEach((a, i) => a.style.setProperty('--i', Math.min(i, 24)))
  const logo = document.querySelector('header a svg')
  if (logo) {
    const model = document.createElement('div')
    model.className = 'menu-model'
    model.setAttribute('aria-hidden', 'true')
    const body = document.createElement('div')
    body.className = 'menu-model-body'
    const depth = 9
    for (let k = 0; k < depth; k++) {
      const s = logo.cloneNode(true)
      s.removeAttribute('width')
      s.removeAttribute('height')
      s.style.transform = `translateZ(${(k - (depth - 1) / 2) * 1.2}px)`
      if (k > 0 && k < depth - 1) s.style.filter = 'brightness(0.55)'
      body.append(s)
    }
    const glow = document.createElement('span')
    glow.className = 'menu-model-glow'
    model.append(body, glow)
    panel.prepend(model)
    const accent = getComputedStyle(menu.querySelector('summary')).backgroundColor
    panel.style.setProperty('--menu-accent', accent)
  }
  // La página de debajo se queda donde estaba; el menú siempre se abre por arriba
  menu.addEventListener('toggle', () => { if (menu.open) panel.scrollTop = 0 })
}

// Buscador arriba de los menús largos: filtra los enlaces mientras escribes, sin importar tildes ni mayúsculas.
if (menu && panel && panel.querySelectorAll('a').length > 12) {
  const es = document.documentElement.lang.startsWith('es')
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const box = document.createElement('div')
  box.className = 'menu-search'
  const input = document.createElement('input')
  input.type = 'search'
  input.placeholder = es ? 'Busca en el menú…' : 'Search the menu…'
  input.setAttribute('aria-label', input.placeholder)
  input.autocomplete = 'off'
  const empty = document.createElement('p')
  empty.className = 'menu-search-empty'
  empty.textContent = es ? 'Nada con ese nombre. Prueba con otra palabra.' : 'Nothing by that name. Try another word.'
  empty.hidden = true
  box.append(input)
  const links = [...panel.querySelectorAll('a')]
  const groups = [...new Set(links.map((a) => a.parentElement))]
  ;(panel.querySelector('.menu-model') || panel.firstChild).after(box)
  panel.append(empty)
  input.addEventListener('input', () => {
    const q = fold(input.value)
    let shown = 0
    links.forEach((a) => { const on = !q || fold(a.textContent).includes(q); a.hidden = !on; if (on) shown++ })
    groups.forEach((g) => {
      const any = [...g.querySelectorAll('a')].some((a) => !a.hidden)
      g.hidden = !any
      const label = g.previousElementSibling
      if (label && label.tagName === 'P') label.hidden = !any
    })
    empty.hidden = shown > 0
  })
  menu.addEventListener('toggle', () => { if (!menu.open && input.value) { input.value = ''; input.dispatchEvent(new Event('input')) } })
}
