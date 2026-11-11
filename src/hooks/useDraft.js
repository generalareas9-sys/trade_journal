import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const DRAFT_PREFIX = 'tradejournal:draft:'
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000
let cleanupComplete = false

export function cleanExpiredDrafts() {
  if (cleanupComplete || typeof window === 'undefined') return
  cleanupComplete = true
  try {
    const storage = window.localStorage
    const now = Date.now()
    const expiredKeys = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      try {
        const draft = JSON.parse(storage.getItem(key) || '')
        if (!Number.isFinite(draft.savedAt) || now - draft.savedAt > DRAFT_MAX_AGE) expiredKeys.push(key)
      } catch {
        expiredKeys.push(key)
      }
    }
    expiredKeys.forEach((key) => storage.removeItem(key))
  } catch (error) {
    console.warn('Could not clean up expired drafts:', error)
  }
}

function sanitizeDraft(value, field = '') {
  if (/(password|token|secret|api.?key|screenshot|image|file|blob)/i.test(field)) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((item) => sanitizeDraft(item)).filter((item) => item !== undefined)
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return undefined
  return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, sanitizeDraft(item, key)])
    .filter(([, item]) => item !== undefined))
}

function includesScreenshot(value) {
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, item]) => {
    if (/(screenshot|image|file)/i.test(key)) return Array.isArray(item) ? item.length > 0 : Boolean(item)
    return includesScreenshot(item)
  })
}

function writeDraft(storageKey, value, hadScreenshots = false) {
  try {
    const savedAt = Date.now()
    const draft = {
      value: sanitizeDraft(value),
      savedAt,
      hadScreenshots: hadScreenshots || value?.hadScreenshots === true || includesScreenshot(value),
    }
    window.localStorage.setItem(storageKey, JSON.stringify(draft))
    return draft
  } catch (error) {
    console.warn('Could not save the form draft:', error)
    return null
  }
}

function formatDraftTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function clearUserDrafts(userId) {
  if (!userId || typeof window === 'undefined') return
  try {
    const storage = window.localStorage
    const prefix = `${DRAFT_PREFIX}${userId}:`
    const keys = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    keys.forEach((key) => storage.removeItem(key))
  } catch (error) {
    console.warn('Could not clear account drafts:', error)
  }
}

export function useDraft(key, initialValue) {
  cleanExpiredDrafts()
  const { user } = useAuth()
  const storageKey = user?.id ? `${DRAFT_PREFIX}${user.id}:${key}` : ''
  const baselineRef = useRef({ key: '', value: initialValue })
  const stateRef = useRef(null)
  const storageKeyRef = useRef('')
  const [state, setState] = useState({
    key: '',
    value: initialValue,
    hasDraft: false,
    wasRestored: false,
    savedAt: null,
    hadScreenshots: false,
    pending: false,
  })
  stateRef.current = state
  storageKeyRef.current = storageKey

  useEffect(() => {
    if (!storageKey) return
    let restored = null
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.value !== undefined && Number.isFinite(parsed.savedAt)) restored = parsed
      }
    } catch (error) {
      console.warn('Could not restore a saved draft:', error)
    }
    const nextValue = restored ? { ...initialValue, ...restored.value } : initialValue
    baselineRef.current = { key: storageKey, value: nextValue }
    setState({
      key: storageKey,
      value: nextValue,
      hasDraft: Boolean(restored),
      wasRestored: Boolean(restored),
      savedAt: restored?.savedAt ?? null,
      hadScreenshots: Boolean(restored?.hadScreenshots),
      pending: false,
    })
  }, [storageKey])

  const setValue = useCallback((nextValue) => {
    setState((current) => {
      const value = typeof nextValue === 'function' ? nextValue(current.value) : nextValue
      return { ...current, value, pending: true }
    })
  }, [])

  const clearDraft = useCallback((nextValue) => {
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey)
      } catch (error) {
        console.warn('Could not clear the saved draft:', error)
      }
    }
    setState((current) => {
      const value = nextValue === undefined ? current.value : nextValue
      baselineRef.current = { key: storageKey, value }
      return { ...current, key: storageKey, value, hasDraft: false, wasRestored: false, savedAt: null, hadScreenshots: false, pending: false }
    })
  }, [storageKey])

  const currentValue = state.key === storageKey ? state.value : initialValue
  const isPending = state.key === storageKey && state.pending

  useEffect(() => {
    if (!storageKey || state.key !== storageKey || !state.pending) return undefined
    const timeout = window.setTimeout(() => {
      const saved = writeDraft(storageKey, state.value, state.hadScreenshots)
      if (saved) {
        baselineRef.current = { key: storageKey, value: state.value }
        setState((current) => current.key === storageKey
          ? { ...current, hasDraft: true, savedAt: saved.savedAt, hadScreenshots: saved.hadScreenshots, pending: false }
          : current)
      }
    }, 400)
    return () => {
      window.clearTimeout(timeout)
      if (state.pending
        && stateRef.current === state
        && (storageKeyRef.current !== storageKey || stateRef.current.pending)) {
        writeDraft(storageKey, state.value, state.hadScreenshots)
      }
    }
  }, [storageKey, state.key, state.value, state.pending, state.hadScreenshots])

  useEffect(() => {
    if (!isPending) return undefined
    const warnBeforeUnload = (event) => {
      const saved = storageKey ? writeDraft(storageKey, currentValue, state.hadScreenshots) : null
      if (!saved) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [currentValue, isPending, state.hadScreenshots, storageKey])

  const hasUnsavedChanges = useMemo(() => {
    if (baselineRef.current.key !== storageKey || !storageKey) return false
    try {
      return JSON.stringify(currentValue) !== JSON.stringify(baselineRef.current.value)
    } catch {
      return isPending
    }
  }, [currentValue, isPending, storageKey])

  return {
    value: currentValue,
    setValue,
    clearDraft,
    hasDraft: state.key === storageKey && state.hasDraft,
    wasRestored: state.key === storageKey && state.wasRestored,
    savedAt: state.key === storageKey ? state.savedAt : null,
    hadScreenshots: state.key === storageKey && state.hadScreenshots,
    isPending: isPending || hasUnsavedChanges,
    formatDraftTime,
  }
}
