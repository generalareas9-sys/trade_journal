import { supabase } from '../lib/supabase'

const BUCKET = 'screenshots'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000
const signedUrlCache = new Map()

async function compressImage(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPG, or WebP image.')
  }
  if (file.size > MAX_FILE_SIZE) throw new Error('Images must be 10 MB or smaller.')

  const imageUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const imageElement = new Image()
      imageElement.onload = () => resolve(imageElement)
      imageElement.onerror = () => reject(new Error('Unable to load this image. Try another file.'))
      imageElement.src = imageUrl
    })
    const ratio = Math.min(1, 1200 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * ratio))
    canvas.height = Math.max(1, Math.round(image.height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is not available in this browser.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to compress this image.')), 'image/jpeg', 0.8)
    })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

async function uploadImage(path, file) {
  try {
    const blob = await compressImage(file)
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (error) return { path: null, error }
    signedUrlCache.delete(path)
    return { path, error: null }
  } catch (error) {
    return { path: null, error }
  }
}

export async function uploadScreenshot(userId, tradeId, kind, file) {
  if (!userId || !tradeId || !['before', 'after'].includes(kind)) {
    return { path: null, error: new Error('A user, trade, and screenshot type are required.') }
  }
  return uploadImage(`${userId}/${tradeId}/${kind}.jpg`, file)
}

export async function uploadJournalImage(userId, date, index, file) {
  if (!userId || !date || !Number.isInteger(index) || index < 1) {
    return { path: null, error: new Error('A user, journal date, and image number are required.') }
  }
  return uploadImage(`${userId}/journal/${date}/${index}.jpg`, file)
}

export async function getSignedUrl(path) {
  try {
    if (!path || typeof path !== 'string' || path.startsWith('data:')) return { url: path || null, error: null }
    const cached = signedUrlCache.get(path)
    if (cached && Date.now() - cached.createdAt < SIGNED_URL_CACHE_MS) {
      return { url: cached.url, error: null }
    }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (error) return { url: null, error }
    signedUrlCache.set(path, { url: data.signedUrl, createdAt: Date.now() })
    return { url: data.signedUrl, error: null }
  } catch (error) {
    return { url: null, error }
  }
}

export async function deleteScreenshot(path) {
  if (!path || path.startsWith('data:')) return { error: null }
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (!error) signedUrlCache.delete(path)
    return { error }
  } catch (error) {
    return { error }
  }
}

export async function deleteTradeScreenshots(userId, tradeId) {
  if (!userId || !tradeId) return { error: new Error('A user and trade are required.') }
  try {
    const paths = [`${userId}/${tradeId}/before.jpg`, `${userId}/${tradeId}/after.jpg`]
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (!error) paths.forEach((path) => signedUrlCache.delete(path))
    return { error }
  } catch (error) {
    return { error }
  }
}

export async function deleteUserScreenshots(userId) {
  if (!userId) return { error: new Error('A user is required.') }
  try {
    const files = []
    const folders = [userId]
    while (folders.length) {
      const folder = folders.pop()
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000, offset })
        if (error) return { error }
        for (const item of data || []) {
          const path = `${folder}/${item.name}`
          if (item.id === null) folders.push(path)
          else files.push(path)
        }
        if (!data || data.length < 1000) break
      }
    }
    for (let offset = 0; offset < files.length; offset += 100) {
      const batch = files.slice(offset, offset + 100)
      const { error } = await supabase.storage.from(BUCKET).remove(batch)
      if (error) return { error }
      batch.forEach((path) => signedUrlCache.delete(path))
    }
    return { error: null }
  } catch (error) {
    return { error }
  }
}
