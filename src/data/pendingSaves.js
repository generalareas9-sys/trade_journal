let flushHandler = null

export function registerPendingSavesFlusher(handler) {
  flushHandler = handler
  return () => {
    if (flushHandler === handler) flushHandler = null
  }
}

export async function flushRegisteredPendingSaves() {
  if (!flushHandler) return { error: null }
  return flushHandler()
}
