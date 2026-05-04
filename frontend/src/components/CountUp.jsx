import { useState, useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'
export default function CountUp({ value, duration = 1200 }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once:true, margin:'-60px' })
  const [num, setNum] = useState(0)
  const raw    = String(value).replace(/,/g, '')
  const isNum  = !isNaN(parseFloat(raw))
  const suffix = String(value).replace(/[\d.,]/g, '')
  useEffect(() => {
    if (!isNum || !inView) return
    const end = parseFloat(raw); let start = 0
    const step = end / (duration / 16)
    const timer = setInterval(() => { start += step; if (start >= end) { setNum(end); clearInterval(timer) } else setNum(Math.floor(start)) }, 16)
    return () => clearInterval(timer)
  }, [value, inView])
  if (!isNum) return <span ref={ref}>{value}</span>
  return <span ref={ref}>{num.toLocaleString()}{suffix}</span>
}
