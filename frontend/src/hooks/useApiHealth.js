import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useApiHealth(intervalMs = 30000) {
  const [apiOnline, setApiOnline] = useState(true)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`${API}/healthz`, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (!cancelled) setApiOnline(res.ok)
      } catch {
        if (!cancelled) setApiOnline(false)
      }
    }

    check()
    const id = setInterval(check, intervalMs)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return apiOnline
}
