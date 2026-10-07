import * as repo from './repo'
import { uploadJournalImage, uploadScreenshot } from './storage'
import { normalizeTrade } from '../utils/trading'

const LEGACY_KEY_PREFIXES = ['trade-journal-', 'tradejournal:v1:']
const TYPE_ALIASES = {
  trades: ['trades', 'trade'],
  journal: ['journal', 'daily-notes', 'daily-journal', 'dailyjournal', 'journal-entries', 'journalentries'],
  notes: ['notes', 'notebook', 'daily-notes'],
  playbooks: ['playbooks', 'playbook'],
  settings: ['settings', 'goals', 'profile', 'import-settings', 'playbook-checklists'],
}
const AGGREGATE_KEYS = new Set(['data', 'state', 'backup', 'app-data', 'app_state'])
const MIGRATION_FLAG_PREFIX = 'tradejournal:migration:'
const DEFERRED_FLAG_PREFIX = 'tradejournal:migration-deferred:'

const emptyData = () => ({ trades: [], journal: {}, notes: [], playbooks: [], settings: {}, goals: {}, profile: {}, importSettings: {}, playbookChecklists: {} })

function parseValue(raw) {
  try {
    return { value: JSON.parse(raw), error: null }
  } catch (error) {
    return { value: null, error }
  }
}

function classifyKey(key) {
  const normalized = key.replace(/^trade-journal-/, '').replace(/^tradejournal:v1:/, '').toLowerCase()
  if (AGGREGATE_KEYS.has(normalized)) return 'aggregate'
  if (normalized.startsWith('additional-journal')) return 'journal'
  if (normalized.includes('goal')) return 'goals'
  for (const [type, aliases] of Object.entries(TYPE_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.endsWith(`-${alias}`))) return type
  }
  return null
}

function addSource(sources, type, key, property = null) {
  sources[type] ||= []
  sources[type].push({ key, property })
}

function mergeArray(current, additions) {
  const values = [...current]
  const seen = new Set(values.map((item) => item?.id ? `id:${item.id}` : `json:${JSON.stringify(item)}`))
  for (const item of Array.isArray(additions) ? additions : []) {
    const key = item?.id ? `id:${item.id}` : `json:${JSON.stringify(item)}`
    if (seen.has(key)) continue
    seen.add(key)
    values.push(item)
  }
  return values
}

function mergeJournal(target, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const entries = value.entries && typeof value.entries === 'object' && !Array.isArray(value.entries)
    ? value.entries
    : value
  for (const [date, entry] of Object.entries(entries)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    target[date] = { ...(target[date] || {}), ...entry }
  }
}

function mergeAggregate(data, sources, key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const fields = {
    trades: ['trades'],
    journal: ['journal', 'entries'],
    notes: ['notes'],
    playbooks: ['playbooks'],
    settings: ['settings'],
    goals: ['goals'],
    profile: ['profile'],
    importSettings: ['importSettings'],
    playbookChecklists: ['playbookChecklists'],
  }
  for (const [type, keys] of Object.entries(fields)) {
    for (const property of keys) {
      if (!Object.prototype.hasOwnProperty.call(value, property)) continue
      const item = value[property]
      const sourceType = ['profile', 'settings', 'importSettings', 'playbookChecklists'].includes(type) ? 'settings' : type
      addSource(sources, sourceType, key, property)
      if (type === 'journal') mergeJournal(data.journal, item)
      else if (type === 'settings' || type === 'goals' || type === 'profile' || type === 'importSettings' || type === 'playbookChecklists') {
        data[type] = { ...data[type], ...(item && typeof item === 'object' ? item : {}) }
      } else if (type === 'trades' || type === 'notes' || type === 'playbooks') {
        data[type] = mergeArray(data[type], item)
      }
    }
  }
}

function normalizeJournalData(data) {
  const normalized = {}
  mergeJournal(normalized, data)
  return normalized
}

function collectLocalData() {
  const data = emptyData()
  const sources = {}
  const raw = {}
  const errors = []
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key || !LEGACY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) continue
      const kind = classifyKey(key)
      if (!kind) continue
      const storedValue = window.localStorage.getItem(key)
      const valueResult = parseValue(storedValue)
      if (valueResult.error) {
        raw[key] = storedValue
        addSource(sources, 'unreadable', key)
        errors.push(`${key}: ${valueResult.error.message}`)
        continue
      }
      const value = valueResult.value
      raw[key] = value
      if (kind === 'aggregate') {
        mergeAggregate(data, sources, key, value)
      } else {
        const wrappedJournal = kind === 'journal' && value && typeof value === 'object' && !Array.isArray(value)
          && ['entries', 'goals', 'weekLessons'].some((property) => Object.prototype.hasOwnProperty.call(value, property))
        if (kind !== 'journal' || !wrappedJournal || value.entries || value.goals || value.weekLessons) {
          addSource(sources, kind, key, wrappedJournal ? 'entries' : null)
        }
        if (kind === 'trades' || kind === 'notes' || kind === 'playbooks') {
          data[kind] = mergeArray(data[kind], value)
        } else if (kind === 'journal') {
          mergeJournal(data.journal, value.entries || value)
          if (value.goals && typeof value.goals === 'object') {
            data.goals = { ...data.goals, ...value.goals }
            addSource(sources, 'goals', key, 'goals')
          }
          for (const [week, lesson] of Object.entries(value.weekLessons || {})) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(week)) data.journal[week] = { ...(data.journal[week] || {}), weeklyLesson: lesson }
          }
          if (wrappedJournal && value.weekLessons) addSource(sources, 'journal', key, 'weekLessons')
        }
        else if (kind === 'goals') data.goals = { ...data.goals, ...(value && typeof value === 'object' ? value : {}) }
        else if (kind === 'settings') {
          if (key.toLowerCase().includes('import')) data.importSettings = { ...data.importSettings, ...(value && typeof value === 'object' ? value : {}) }
          else if (key.toLowerCase().includes('profile')) data.profile = { ...data.profile, ...(value && typeof value === 'object' ? value : {}) }
          else if (key.toLowerCase().includes('checklist')) data.playbookChecklists = { ...data.playbookChecklists, ...(value && typeof value === 'object' ? value : {}) }
          else data.settings = { ...data.settings, ...(value && typeof value === 'object' ? value : {}) }
        }
      }
    }

  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Local storage could not be read.')
  }

  data.journal = normalizeJournalData(data.journal)
  data.trades = data.trades.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
  data.notes = data.notes.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
  data.playbooks = data.playbooks.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
  const counts = {
    trades: data.trades.length,
    journal: Object.keys(data.journal).length,
    notes: data.notes.length,
    playbooks: data.playbooks.length,
    goals: Object.keys(data.goals).length,
    settings: Object.keys(data.settings).length || Object.keys(data.importSettings).length || Object.keys(data.playbookChecklists).length || Object.keys(data.profile).length ? 1 : 0,
  }
  return {
    data,
    counts,
    sources,
    raw,
    errors,
    hasData: Object.values(counts).some((count) => count > 0) || errors.length > 0,
    allTradesAreDemo: data.trades.length > 0 && data.trades.every((trade) => trade.isDemo === true),
  }
}

export function getLocalMigrationFlag(userId) {
  try {
    return window.localStorage.getItem(`${MIGRATION_FLAG_PREFIX}${userId}`) || ''
  } catch {
    return ''
  }
}

export function wasMigrationDeferred(userId) {
  try {
    return window.sessionStorage.getItem(`${DEFERRED_FLAG_PREFIX}${userId}`) === '1'
  } catch {
    return false
  }
}

export function deferLocalMigration(userId) {
  try {
    window.sessionStorage.setItem(`${DEFERRED_FLAG_PREFIX}${userId}`, '1')
  } catch (error) {
    console.warn('Could not save the local migration reminder state.', error)
  }
}

export function clearMigrationDeferral(userId) {
  try {
    window.sessionStorage.removeItem(`${DEFERRED_FLAG_PREFIX}${userId}`)
  } catch (error) {
    console.warn('Could not clear the local migration reminder state.', error)
  }
}

export function setLocalMigrationFlag(userId, status) {
  try {
    window.localStorage.setItem(`${MIGRATION_FLAG_PREFIX}${userId}`, status)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export function scanLegacyLocalData() {
  try {
    return { ...collectLocalData(), error: null }
  } catch (error) {
    return { ...collectLocalDataFallback(), error }
  }
}

function collectLocalDataFallback() {
  return { data: emptyData(), counts: { trades: 0, journal: 0, notes: 0, playbooks: 0, goals: 0, settings: 0 }, sources: {}, raw: {}, errors: [] }
}

export function clearLegacyLocalData(snapshot, types) {
  const failures = []
  try {
    for (const type of types) {
      for (const source of snapshot?.sources?.[type] || []) {
        try {
          if (!source.property) {
            window.localStorage.removeItem(source.key)
            continue
          }
          const parsed = parseValue(window.localStorage.getItem(source.key))
          if (parsed.error || !parsed.value || typeof parsed.value !== 'object') {
            failures.push(`${source.key} could not be safely edited.`)
            continue
          }
          const remaining = { ...parsed.value }
          delete remaining[source.property]
          window.localStorage.setItem(source.key, JSON.stringify(remaining))
        } catch (error) {
          failures.push(`${source.key}: ${error instanceof Error ? error.message : 'Could not clear local data.'}`)
        }
      }
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'Could not clear local data.')
  }
  return { error: failures.length ? new Error(failures.join(' ')) : null }
}

export function discardLegacyLocalData(snapshot) {
  return clearLegacyLocalData(snapshot, Object.keys(snapshot?.sources || {}))
}

export function downloadLegacyBackup(snapshot) {
  try {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), legacyLocalData: snapshot.raw || {} }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tradejournal-local-backup.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

function dataUrlFile(value, name) {
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(value || '')
  if (!match) throw new Error('Legacy screenshot is not a supported PNG, JPG, or WebP image.')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
  return new File([bytes], name, { type: mime })
}

function normalizeLegacyTrade(trade) {
  const prepared = normalizeTrade({
    ...trade,
    openedAt: trade.openedAt || trade.entryTime || (trade.date ? `${trade.date}T09:30:00` : undefined),
    closedAt: trade.closedAt || trade.exitTime || (trade.date ? `${trade.date}T10:30:00` : undefined),
    entry: trade.entry ?? trade.entryPrice,
    exit: trade.exit ?? trade.exitPrice,
    size: trade.size ?? trade.quantity,
    isDemo: trade.isDemo === true,
    account: null,
  })
  return { ...prepared, isDemo: trade.isDemo === true }
}

function migrationProgress(onProgress, progress) {
  try {
    onProgress?.(progress)
  } catch (error) {
    console.warn('Could not update migration progress.', error)
  }
}

export async function migrateLocalData(snapshot, userId, onProgress) {
  const failures = []
  const succeededTypes = []
  const counts = snapshot?.counts || {}
  const data = snapshot?.data || emptyData()
  const summary = { uploaded: { trades: 0, journal: 0, notes: 0, playbooks: 0 }, failed: 0, failures, clearedTypes: [] }
  const total = counts.trades + counts.journal + counts.notes + counts.playbooks + counts.goals + counts.settings
  let completed = 0
  const advance = (message) => {
    completed += 1
    migrationProgress(onProgress, { completed, total, message })
  }
  const addFailure = (label, error) => {
    failures.push(`${label}: ${error?.message || error || 'Unknown error'}`)
    summary.failed += 1
  }

  for (const error of snapshot?.errors || []) addFailure('Unreadable local data', error)

  try {
    let tradesSucceeded = true
    const preparedTrades = data.trades.map((trade) => {
      const prepared = normalizeLegacyTrade(trade)
      prepared.screenshotBefore = ''
      prepared.screenshotAfter = ''
      return prepared
    })
    const tradeResult = await repo.insertTradesBulk(preparedTrades)
    const failedIndices = new Set()
    for (const chunk of tradeResult.data?.failedChunks || []) {
      for (let index = chunk.startIndex; index < chunk.startIndex + chunk.count; index += 1) failedIndices.add(index)
    }
    summary.uploaded.trades = tradeResult.data?.insertedCount || 0
    if (failedIndices.size) {
      tradesSucceeded = false
      for (const index of failedIndices) addFailure(`Trade ${index + 1}`, tradeResult.data?.failedChunks.find((chunk) => index >= chunk.startIndex && index < chunk.startIndex + chunk.count)?.error)
    }

    for (const { index, trade: inserted } of tradeResult.data?.insertedTrades || []) {
      const legacy = data.trades[index]
      let patch = {}
      for (const kind of ['before', 'after']) {
        const field = kind === 'before' ? 'screenshotBefore' : 'screenshotAfter'
        const value = legacy[field]
        if (typeof value !== 'string' || !value.startsWith('data:')) continue
        try {
          const file = dataUrlFile(value, `${kind}.jpg`)
          const result = await uploadScreenshot(userId, inserted.id, kind, file)
          if (result.error) throw result.error
          patch[field] = result.path
        } catch (error) {
          tradesSucceeded = false
          addFailure(`Trade ${index + 1} ${kind} screenshot`, error)
        }
      }
      if (Object.keys(patch).length) {
        const update = await repo.updateTrade(inserted.id, patch)
        if (update.error) {
          tradesSucceeded = false
          addFailure(`Trade ${index + 1} screenshot paths`, update.error)
        }
      }
      advance(`Uploaded trade ${index + 1}`)
    }
    for (let index = 0; index < failedIndices.size; index += 1) advance('Skipped failed trade')
    if (tradesSucceeded) succeededTypes.push('trades')

    let journalSucceeded = true
    for (const [date, entry] of Object.entries(data.journal)) {
      const convertedImages = []
      for (let index = 0; index < (entry.images || []).length; index += 1) {
        const image = entry.images[index]
        if (typeof image !== 'string' || !image.startsWith('data:')) {
          convertedImages.push(image)
          continue
        }
        try {
          const file = dataUrlFile(image, `journal-${index + 1}.jpg`)
          const uploaded = await uploadJournalImage(userId, date, index + 1, file)
          if (uploaded.error) throw uploaded.error
          convertedImages.push(uploaded.path)
        } catch (error) {
          journalSucceeded = false
          addFailure(`Journal ${date} image ${index + 1}`, error)
        }
      }
      const result = await repo.upsertJournalEntry({ ...entry, date, images: convertedImages })
      if (result.error) {
        journalSucceeded = false
        addFailure(`Journal ${date}`, result.error)
      } else summary.uploaded.journal += 1
      advance(`Uploaded journal entry ${date}`)
    }
    if (journalSucceeded) succeededTypes.push('journal')

    let notesSucceeded = true
    for (const [index, note] of data.notes.entries()) {
      const result = await repo.createNote(note)
      if (result.error) {
        notesSucceeded = false
        addFailure(`Note ${index + 1}`, result.error)
      } else summary.uploaded.notes += 1
      advance(`Uploaded note ${index + 1}`)
    }
    if (notesSucceeded) succeededTypes.push('notes')

    let playbooksSucceeded = true
    for (const [index, playbook] of data.playbooks.entries()) {
      const result = await repo.createPlaybook(playbook)
      if (result.error) {
        playbooksSucceeded = false
        addFailure(`Playbook ${index + 1}`, result.error)
      } else summary.uploaded.playbooks += 1
      advance(`Uploaded playbook ${index + 1}`)
    }
    if (playbooksSucceeded) succeededTypes.push('playbooks')

    let settingsSucceeded = true
    if (counts.goals || counts.settings) {
      const existing = await repo.getProfileSettings(userId)
      if (existing.error) {
        settingsSucceeded = false
        addFailure('Account settings', existing.error)
      } else {
        const appSettings = { ...(existing.data?.appSettings || {}), ...data.settings }
        if (data.goals.pnl !== undefined) appSettings.monthlyPnlGoal = Number(data.goals.pnl) || 0
        if (data.goals.winRate !== undefined) appSettings.winRateGoal = Number(data.goals.winRate) || 0
        const updated = await repo.updateProfileSettings(userId, {
          ...(existing.data || {}),
          appSettings,
          importSettings: { ...(existing.data?.importSettings || {}), ...data.importSettings },
          playbookChecklists: { ...(existing.data?.playbookChecklists || {}), ...data.playbookChecklists },
        })
        if (updated.error) {
          settingsSucceeded = false
          addFailure('Account settings', updated.error)
        }
        if (settingsSucceeded && data.profile.name) {
          const profile = await repo.updateProfileDisplayName(userId, data.profile.name)
          if (profile.error) {
            settingsSucceeded = false
            addFailure('Profile name', profile.error)
          }
        }
      }
    }
    if (settingsSucceeded) {
      if (counts.goals) succeededTypes.push('goals')
      if (counts.settings) succeededTypes.push('settings')
    }
    if (counts.settings) advance('Uploaded account settings')
    summary.clearedTypes = succeededTypes
    const cleared = clearLegacyLocalData(snapshot, succeededTypes)
    if (cleared.error) addFailure('Clear local data', cleared.error)
    return { ...summary, error: null }
  } catch (error) {
    addFailure('Migration', error)
    return { ...summary, error: null }
  }
}
