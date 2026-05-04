import { useEffect, useState } from 'react'

const STORAGE_KEY = 'trendit:theme'

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return saved === 'dark'
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.body.classList.toggle('dark', darkMode)
    try {
      localStorage.setItem(STORAGE_KEY, darkMode ? 'dark' : 'light')
    } catch {
      // 저장소 접근 실패는 UI 동작에 영향 없음
    }
  }, [darkMode])

  return [darkMode, setDarkMode]
}
