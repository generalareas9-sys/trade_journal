import { useEffect, useRef, useState } from 'react'

const KEY_PREFIX = 'tradejournal:v1:'

export function persistentStorageKey(key) {
  return `${KEY_PREFIX}${key}`
}

export default function usePersistentState(key, initialValue, { onError, onWrite, migrate, debounceMs = 500 } = {}) {
  const storageKey = persistentStorageKey(key)
  const callbacks = useRef({ onError, onWrite })
  const statusTimeout = useRef(null)
  const [value, setValue] = useState(() => {
    const fallback = typeof initialValue === 'function' ? initialValue() : initialValue
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved === null) return fallback
      const parsed = JSON.parse(saved)
      return migrate ? migrate(parsed) : parsed
    } catch {
      return fallback
    }
  })
  const [saveStatus, setSaveStatus] = useState('')

  callbacks.current = { onError, onWrite }

  useEffect(() => {
    setSaveStatus('saving')
    window.clearTimeout(statusTimeout.current)
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value))
        setSaveStatus('saved')
        callbacks.current.onWrite?.(window.localStorage)
        statusTimeout.current = window.setTimeout(() => setSaveStatus(''), 1800)
      } catch (error) {
        setSaveStatus('error')
        callbacks.current.onError?.(error)
      }
    }, debounceMs)
    return () => {
      window.clearTimeout(timeout)
      window.clearTimeout(statusTimeout.current)
    }
  }, [debounceMs, storageKey, value])

  return [value, setValue, saveStatus]
}
