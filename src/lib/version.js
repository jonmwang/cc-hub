import { useEffect, useState } from 'react'

// Injected by vite.config.js at build time.
export const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

/**
 * Watches for a newer deploy.
 *
 * GitHub Pages serves index.html with `cache-control: max-age=600`, so a
 * browser can sit on a stale copy pointing at an old JS bundle. The asset
 * filenames are content-hashed, so the stale HTML loads a perfectly valid but
 * out-of-date app — no error, nothing obviously wrong, just old. The only cure
 * is a hard refresh, which is not something you can ask a non-technical person
 * to know about.
 *
 * So the app checks for itself: fetch version.json (bypassing cache), compare
 * to the id compiled into this bundle, and if they differ, say so.
 *
 * Checks on mount, whenever the tab regains focus, and every 15 minutes.
 */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (BUILD_ID === 'dev') return // nothing to check against in `npm run dev`
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const { buildId } = await res.json()
        if (!cancelled && buildId && buildId !== BUILD_ID) setAvailable(true)
      } catch {
        // Offline, or the file isn't there on a non-Pages host. Either way the
        // app keeps working; this is a nicety, not a dependency.
      }
    }

    check()
    const onFocus = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onFocus)
    const timer = setInterval(check, 15 * 60 * 1000)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onFocus)
      clearInterval(timer)
    }
  }, [])

  return available
}

// A plain reload can still be served the cached HTML, so bust it explicitly.
export function reloadToLatest() {
  const url = new URL(window.location.href)
  url.searchParams.set('v', Date.now().toString(36))
  window.location.replace(url.toString())
}
