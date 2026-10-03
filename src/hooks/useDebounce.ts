import { useEffect, useState } from 'react'
export function useDebounce<T>(value: T, delay: number) {
  const [result, setResult] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return result
}
