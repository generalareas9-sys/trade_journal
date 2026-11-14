import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import { accounts as demoAccounts, mockTrades } from '../data/mockData'
import { calculateStats, calculateTradePnl, filterTrades, normalizeTrade, setCurrencyDisplay, symbolPointValues } from '../utils/trading'
import { useAuth } from './AuthContext'
import * as repo from '../data/repo'
import { registerPendingSavesFlusher } from '../data/pendingSaves'
import { deleteScreenshot, deleteTradeScreenshots } from '../data/storage'
import { SkeletonCard, SkeletonRows } from '../components/UiElements'

const DATA_SCHEMA_VERSION = 5
const pendingBackupKey = (userId) => `trade-journal-pending-backup:${userId}`
const LEGACY_KEYS = {
  trades: 'trade-journal-trades',
  range: 'trade-journal-range',
  customStart: 'trade-journal-custom-start',
  customEnd: 'trade-journal-custom-end',
  account: 'trade-journal-account',
  dark: 'trade-journal-dark',
  profile: 'trade-journal-profile',
  settings: 'trade-journal-settings',
  schema: 'trade-journal-schema',
  playbooks: 'trade-journal-playbooks',
  journal: 'trade-journal-daily-notes',
  notes: 'trade-journal-notes',
  playbookChecklists: 'trade-journal-playbook-checklists',
}
const SETTINGS_DEFAULTS = {
  dailyLossLimit: 500,
  maxTradesPerDay: 8,
  monthlyPnlGoal: 3000,
  winRateGoal: 55,
  themePreference: 'dark',
  themeChosen: false,
  theme: true,
}
const IMPORT_SETTINGS_DEFAULTS = {
  dateFormat: 'auto',
  timezone: 'local',
  sideFormat: 'buy-sell',
  targetAccount: 'main',
  pointValues: { ...symbolPointValues, ES: 50 },
}
const mockTradesById = new Map(mockTrades.map((trade) => [trade.id, trade]))
let tradeSequence = 0

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored === null ? fallback : JSON.parse(stored)
  } catch {
    return fallback
  }
}

function getInitialDark() {
  if (readJson('trade-journal-theme-chosen', false) !== true) return true
  const preference = readJson('trade-journal-theme-preference', '')
  if (preference === 'dark') return true
  if (preference === 'light') return false
  if (preference === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches
  return readJson('trade-journal-dark', true) === true
}

function hydrateTrades(savedTrades, regenerateSeededTrades = false) {
  if (!Array.isArray(savedTrades)) return []
  return savedTrades.map((trade) => {
    const mockDefaults = mockTradesById.get(trade.id)
    return normalizeTrade({
      ...trade,
      ...(regenerateSeededTrades && mockDefaults ? {
        date: mockDefaults.date,
        openedAt: mockDefaults.openedAt,
        closedAt: mockDefaults.closedAt,
        symbol: mockDefaults.symbol,
        side: mockDefaults.side,
        entry: mockDefaults.entry,
        exit: mockDefaults.exit,
        size: mockDefaults.size,
        quantity: mockDefaults.quantity,
        fees: mockDefaults.fees,
        riskAmount: mockDefaults.riskAmount,
        strategy: mockDefaults.strategy,
      } : {}),
      session: trade.session || mockDefaults?.session || '',
      preAnalysis: trade.preAnalysis || mockDefaults?.preAnalysis || '',
      followedRules: trade.followedRules || mockDefaults?.followedRules || '',
      entryConditionMet: trade.entryConditionMet || mockDefaults?.entryConditionMet || '',
      management: trade.management || mockDefaults?.management || '',
      screenshotBefore: trade.screenshotBefore || '',
      screenshotAfter: trade.screenshotAfter || '',
      psychBefore: trade.psychBefore || '',
      psychAfter: trade.psychAfter || '',
      riskManagement: trade.riskManagement || '',
      stopLossSystem: trade.stopLossSystem || '',
      takeProfitSystem: trade.takeProfitSystem || '',
      exitCondition: trade.exitCondition || mockDefaults?.exitCondition || '',
      rrr: trade.rrr ?? mockDefaults?.rrr ?? null,
      mistakes: trade.mistakes ?? mockDefaults?.mistakes ?? [],
      account: trade.account || mockDefaults?.account || 'main',
      isDemo: trade.isDemo ?? Boolean(mockDefaults),
    })
  })
}

function seededJournal() {
  return {}
}

function defaultData() {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    trades: [],
    journal: {},
    notes: [],
    playbooks: [],
    accounts: [],
    playbookChecklists: {},
    settings: SETTINGS_DEFAULTS,
    importSettings: IMPORT_SETTINGS_DEFAULTS,
    profile: { name: '' },
    dark: getInitialDark(),
    account: 'all',
    range: 'All',
    customStart: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    customEnd: format(new Date(), 'yyyy-MM-dd'),
  }
}

async function cleanupTradeScreenshots(ownerId, trades) {
  const results = await Promise.all(trades.map((trade) => deleteTradeScreenshots(ownerId, trade.id)))
  for (const result of results) {
    if (result.error) console.warn(`Could not delete trade screenshots: ${result.error.message || result.error}`)
  }
}

function migrateData(data, fromVersion = 1) {
  let migrated = { ...data }
  for (let version = fromVersion; version < DATA_SCHEMA_VERSION; version += 1) {
    if (version === 1) {
      migrated.journal ??= seededJournal()
      migrated.notes ??= []
      migrated.playbookChecklists ??= {}
    }
    if (version === 2) {
      migrated.settings = { ...SETTINGS_DEFAULTS, ...(migrated.settings || {}) }
      migrated.profile ??= { name: 'Osman' }
      migrated.playbooks ??= []
    }
    if (version === 3) {
      migrated.trades = hydrateTrades(migrated.trades, false)
      migrated.range ??= 'All'
      migrated.account ??= 'main'
      migrated.dark ??= false
    }
    if (version === 4) {
      migrated.importSettings = { ...IMPORT_SETTINGS_DEFAULTS, ...(migrated.importSettings || {}) }
      migrated.trades = hydrateTrades(migrated.trades, false)
    }
    migrated.schemaVersion = version + 1
  }
  return {
    ...defaultData(),
    ...migrated,
    schemaVersion: DATA_SCHEMA_VERSION,
    trades: hydrateTrades(migrated.trades, false),
    journal: migrated.journal && typeof migrated.journal === 'object' ? migrated.journal : seededJournal(),
    notes: Array.isArray(migrated.notes) ? migrated.notes : [],
    playbooks: Array.isArray(migrated.playbooks) ? migrated.playbooks : [],
    playbookChecklists: migrated.playbookChecklists && typeof migrated.playbookChecklists === 'object' ? migrated.playbookChecklists : {},
    settings: { ...SETTINGS_DEFAULTS, ...(migrated.settings || {}) },
    importSettings: {
      ...IMPORT_SETTINGS_DEFAULTS,
      ...(migrated.importSettings || {}),
      pointValues: { ...IMPORT_SETTINGS_DEFAULTS.pointValues, ...(migrated.importSettings?.pointValues || {}) },
    },
    profile: migrated.profile && typeof migrated.profile.name === 'string' ? migrated.profile : { name: 'Osman' },
  }
}

export function migrateBackup(backup) {
  if (!backup || !Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 1 || backup.schemaVersion > DATA_SCHEMA_VERSION) {
    throw new Error(`Backup schemaVersion must be between 1 and ${DATA_SCHEMA_VERSION}.`)
  }
  if (!Array.isArray(backup.trades) || !backup.profile || typeof backup.profile.name !== 'string' || !backup.settings || typeof backup.settings !== 'object' || Array.isArray(backup.settings)) {
    throw new Error('Backup is missing valid trades, profile, or settings data.')
  }
  if (backup.notes !== undefined && !Array.isArray(backup.notes)) throw new Error('Backup notes must be an array.')
  if (backup.playbooks !== undefined && !Array.isArray(backup.playbooks)) throw new Error('Backup playbooks must be an array.')
  if (backup.journal !== undefined && (!backup.journal || typeof backup.journal !== 'object' || Array.isArray(backup.journal))) throw new Error('Backup journal data is invalid.')
  if (backup.playbookChecklists !== undefined && (!backup.playbookChecklists || typeof backup.playbookChecklists !== 'object' || Array.isArray(backup.playbookChecklists))) throw new Error('Backup playbook checklist data is invalid.')
  if (backup.trades.some((trade) => !trade || typeof trade !== 'object' || typeof trade.date !== 'string' || typeof trade.symbol !== 'string' || !['Long', 'Short'].includes(trade.side) || !Number.isFinite(Number(trade.entry)) || !Number.isFinite(Number(trade.exit)) || !Number.isFinite(Number(trade.size ?? trade.quantity)))) {
    throw new Error('Backup contains a trade with invalid date, symbol, side, entry, exit, or size.')
  }
  if (backup.notes?.some((note) => !note || typeof note !== 'object' || typeof note.title !== 'string' || typeof note.body !== 'string')) throw new Error('Backup contains an invalid notebook note.')
  if (backup.playbooks?.some((book) => !book || typeof book !== 'object' || typeof book.name !== 'string' || !Array.isArray(book.entry) || !Array.isArray(book.exit))) throw new Error('Backup contains an invalid playbook.')
  if (Object.values(backup.journal || {}).some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) throw new Error('Backup contains an invalid journal entry.')
  return migrateData(backup, backup.schemaVersion)
}

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user, refreshProfile } = useAuth()
  const [toast, setToast] = useState('')
  const [storageUsage] = useState(0)
  const [data, setData] = useState(defaultData)
  const [dataLoading, setDataLoading] = useState(Boolean(user))
  const [dataError, setDataError] = useState('')
  const [dataUserId, setDataUserId] = useState('')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [saveErrorMessage, setSaveErrorMessage] = useState('')
  const [localBackup, setLocalBackup] = useState(null)
  const [journalSaveStatus, setJournalSaveStatus] = useState('saved')
  const [retryCount, setRetryCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [addTradeOpen, setAddTradeOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null)
  const dataRef = useRef(data)
  const userRef = useRef(user)
  const dataUserIdRef = useRef('')
  const saveStatusRef = useRef(saveStatus)
  const loadRequestRef = useRef(0)
  const lastBackgroundRefreshRef = useRef(0)
  const loadDemoDataRef = useRef(null)
  const profileWriteQueue = useRef(Promise.resolve())
  const journalSaveRef = useRef({ timer: null, ownerId: null, before: null, after: null })
  const pendingSaveTasksRef = useRef(new Map())
  const saveTaskQueuesRef = useRef(new Map())
  const backupWriteStatusRef = useRef(new Map())
  const restoreInProgressRef = useRef(false)
  const toastTimer = useRef(null)
  userRef.current = user

  const notify = useCallback((message) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3500)
  }, [])

  const updateSaveStatus = useCallback((status) => {
    saveStatusRef.current = status
    setSaveStatus(status)
  }, [])

  const updateTrackedSaveStatus = useCallback(() => {
    const ownerId = userRef.current?.id
    const pending = ownerId
      ? [...pendingSaveTasksRef.current.values()].filter((task) => task.ownerId === ownerId)
      : []
    const failed = pending.find((task) => task.failed)
    if (failed) {
      setSaveErrorMessage(failed.message)
      updateSaveStatus('error')
    } else if (pending.length) {
      setSaveErrorMessage('')
      updateSaveStatus('saving')
    } else {
      setSaveErrorMessage('')
      updateSaveStatus('saved')
    }
  }, [updateSaveStatus])

  const saveLocalBackup = useCallback((ownerId, additionalSaves = []) => {
    const pendingSaves = [...pendingSaveTasksRef.current.values()]
      .filter((task) => task.ownerId === ownerId && task.backupKind && task.backupValue !== undefined)
      .map((task) => ({ key: task.key, kind: task.backupKind, value: task.backupValue }))
    const scheduledJournal = journalSaveRef.current.ownerId === ownerId ? journalSaveRef.current : null
    if (scheduledJournal) {
      for (const date of new Set([...Object.keys(scheduledJournal.before || {}), ...Object.keys(scheduledJournal.after || {})])) {
        if (!(date in (scheduledJournal.after || {}))
          || JSON.stringify(scheduledJournal.before?.[date]) === JSON.stringify(scheduledJournal.after?.[date])) continue
        pendingSaves.push({ key: `journal:${date}`, kind: 'journal', value: { date, ...scheduledJournal.after[date] } })
      }
    }
    pendingSaves.push(...additionalSaves)
    const deduplicated = [...new Map(pendingSaves.map((item) => [item.key, item])).values()]
    const hasFailure = [...pendingSaveTasksRef.current.values()].some((task) => task.ownerId === ownerId && task.failed)
    const available = hasFailure || Boolean(scheduledJournal) || additionalSaves.length > 0
    const backup = {
      userId: ownerId,
      savedAt: new Date().toISOString(),
      schemaVersion: DATA_SCHEMA_VERSION,
      pendingSaves: deduplicated,
    }
    try {
      window.localStorage.setItem(pendingBackupKey(ownerId), JSON.stringify(backup))
      backupWriteStatusRef.current.set(ownerId, true)
      setLocalBackup({ ...backup, ownerId, available })
    } catch (error) {
      backupWriteStatusRef.current.set(ownerId, false)
      console.error('Could not write the pending data backup:', error)
      setLocalBackup({ ...backup, ownerId, available: true, backupError: error?.message || 'Local storage is unavailable.' })
    }
    return backup
  }, [])

  const executeSaveTask = useCallback(async (task) => {
    task.failed = false
    updateTrackedSaveStatus()
    try {
      const result = await task.run()
      if (result?.error) throw result.error
      if (pendingSaveTasksRef.current.get(task.key) === task) {
        await task.onSuccess?.(result)
        pendingSaveTasksRef.current.delete(task.key)
        const ownerHasPending = [...pendingSaveTasksRef.current.values()].some((pendingTask) => pendingTask.ownerId === task.ownerId)
          || journalSaveRef.current.ownerId === task.ownerId
        if (!ownerHasPending && !restoreInProgressRef.current) {
          try {
            window.localStorage.removeItem(pendingBackupKey(task.ownerId))
            setLocalBackup((current) => current?.ownerId === task.ownerId ? null : current)
          } catch (error) {
            console.error('Could not clear the pending data backup:', error)
          }
        } else {
          saveLocalBackup(task.ownerId)
        }
      }
      updateTrackedSaveStatus()
      if (task.backupKind === 'journal') {
        const hasPendingJournal = [...pendingSaveTasksRef.current.values()].some((pendingTask) => pendingTask.ownerId === task.ownerId && pendingTask.backupKind === 'journal')
          || journalSaveRef.current.ownerId === task.ownerId
        setJournalSaveStatus(hasPendingJournal ? 'saving' : 'saved')
      }
      return result
    } catch (error) {
      console.error(`Could not save ${task.label}:`, error)
      if (pendingSaveTasksRef.current.get(task.key) === task) {
        task.failed = true
        task.message = error?.message || `Could not save ${task.label}.`
        saveLocalBackup(task.ownerId)
        setSaveErrorMessage(task.message)
        updateSaveStatus('error')
        if (task.backupKind === 'journal') setJournalSaveStatus('error')
      }
      return { data: null, error }
    }
  }, [saveLocalBackup, updateSaveStatus, updateTrackedSaveStatus])

  const enqueueSaveTask = useCallback((key, ownerId, label, run, onSuccess, backupKind, backupValue) => {
    const task = {
      key,
      ownerId,
      label,
      run,
      onSuccess,
      backupKind,
      backupValue,
      failed: false,
      message: '',
      promise: null,
    }
    pendingSaveTasksRef.current.set(key, task)
    saveLocalBackup(ownerId)
    updateTrackedSaveStatus()
    if (backupKind === 'journal') setJournalSaveStatus('saving')
    const previous = saveTaskQueuesRef.current.get(key) || Promise.resolve()
    task.promise = previous.catch(() => undefined).then(() => {
      if (pendingSaveTasksRef.current.get(key) !== task) return { data: null, error: null }
      return executeSaveTask(task)
    })
    saveTaskQueuesRef.current.set(key, task.promise)
    void task.promise.then(() => {
      if (saveTaskQueuesRef.current.get(key) === task.promise) saveTaskQueuesRef.current.delete(key)
    }, () => {
      if (saveTaskQueuesRef.current.get(key) === task.promise) saveTaskQueuesRef.current.delete(key)
    })
    return task.promise
  }, [executeSaveTask, saveLocalBackup, updateTrackedSaveStatus])

  const retryPendingSaves = useCallback(async () => {
    const ownerId = userRef.current?.id
    if (!ownerId) return { error: new Error('Sign in before retrying saves.') }
    const tasks = [...pendingSaveTasksRef.current.values()].filter((task) => task.ownerId === ownerId)
    if (!tasks.length) {
      if (localBackup?.ownerId === ownerId) return { error: new Error('Restore the local backup to retry these changes.') }
      return { error: null }
    }
    const results = await Promise.all(tasks.map((task) => task.failed
      ? executeSaveTask(task)
      : task.promise || Promise.resolve({ error: null })))
    return { error: results.find((result) => result?.error)?.error || null }
  }, [executeSaveTask, localBackup])

  const applyData = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(dataRef.current) : updater
    dataRef.current = next
    setCurrencyDisplay(next.settings.currencyDisplay || 'USD')
    setData(next)
    return next
  }, [])

  const retryLoad = useCallback(() => {
    setRetryCount((count) => count + 1)
  }, [])

  const loadAccountData = useCallback(async (currentUser, { quiet = false, isActive = () => true } = {}) => {
    const request = ++loadRequestRef.current
    const isCurrent = () => isActive()
      && request === loadRequestRef.current
      && userRef.current?.id === currentUser.id

    try {
      await refreshProfile()
      const results = await Promise.all([
        repo.listAccounts(currentUser.id),
        repo.listTrades(currentUser.id),
        repo.listJournalEntries(currentUser.id),
        repo.listNotes(currentUser.id),
        repo.listPlaybooks(currentUser.id),
        repo.getProfileSettings(currentUser.id),
      ])
      if (!isCurrent()) return
      const failed = results.find((result) => result.error)
      if (failed) {
        const message = failed.error?.message || 'Could not load your TradeJournal data.'
        if (quiet) notify(`Could not refresh your data: ${message}`)
        else setDataError(message)
        if (!quiet) setDataLoading(false)
        return
      }

      const [accountsResult, tradesResult, journalResult, notesResult, playbooksResult, profileSettingsResult] = results
      const storedSettings = profileSettingsResult.data || {}
      const journal = Object.fromEntries((journalResult.data || []).map((entry) => [entry.date, entry]))
      const appSettings = storedSettings.appSettings || {}
      const themeChosen = appSettings.themeChosen === true
      const themePreference = themeChosen && ['light', 'dark', 'system'].includes(appSettings.themePreference)
        ? appSettings.themePreference
        : 'dark'
      const shouldLoadDemoData = appSettings.demoDataInitialized === false
        && !(accountsResult.data || []).length
        && !(tradesResult.data || []).length
        && !(journalResult.data || []).length
        && !(notesResult.data || []).length
        && !(playbooksResult.data || []).length
      const next = {
        ...dataRef.current,
        accounts: accountsResult.data || [],
        trades: (tradesResult.data || []).map((trade) => normalizeTrade(trade)),
        journal,
        notes: notesResult.data || [],
        playbooks: playbooksResult.data || [],
        settings: {
          ...SETTINGS_DEFAULTS,
          ...appSettings,
          themePreference,
          themeChosen,
          theme: themePreference === 'dark' || (themePreference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
          ...(shouldLoadDemoData ? { demoDataInitialized: true } : {}),
        },
        importSettings: {
          ...IMPORT_SETTINGS_DEFAULTS,
          ...(storedSettings.importSettings || {}),
          pointValues: { ...IMPORT_SETTINGS_DEFAULTS.pointValues, ...(storedSettings.importSettings?.pointValues || {}) },
        },
        playbookChecklists: storedSettings.playbookChecklists || {},
        profile: {
          name: storedSettings.profile?.name || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || '',
          country: storedSettings.profile?.country || '',
        },
        account: dataUserIdRef.current === currentUser.id
          ? dataRef.current.account
          : storedSettings.defaultAccount || 'all',
        dark: themeChosen
          ? themePreference === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
            : themePreference === 'dark'
          : true,
      }
      if (quiet && ['saving', 'error'].includes(saveStatusRef.current)) return
      if (shouldLoadDemoData) {
        const markerResult = await repo.updateProfileSettings(currentUser.id, {
          ...storedSettings,
          appSettings: { ...appSettings, demoDataInitialized: true },
        })
        if (!isCurrent()) return
        if (markerResult.error) {
          const message = `Could not prepare demo data: ${markerResult.error.message || 'Unknown error'}`
          if (quiet) notify(`Could not refresh your data: ${message}`)
          else setDataError(message)
          if (!quiet) setDataLoading(false)
          return
        }
      }
      if (!isCurrent()) return
      dataRef.current = next
      setCurrencyDisplay(next.settings.currencyDisplay || 'USD')
      setData(next)
      dataUserIdRef.current = currentUser.id
      setDataUserId(currentUser.id)
      setDataError('')
      lastBackgroundRefreshRef.current = Date.now()
      try {
        const storedBackup = window.localStorage.getItem(pendingBackupKey(currentUser.id))
        if (storedBackup) {
          const parsedBackup = JSON.parse(storedBackup)
          if (parsedBackup?.userId === currentUser.id && Array.isArray(parsedBackup.pendingSaves)) {
            backupWriteStatusRef.current.set(currentUser.id, true)
            setLocalBackup({ ...parsedBackup, ownerId: currentUser.id, available: true, loadedFromDisk: true })
          }
        } else {
          setLocalBackup((current) => current?.ownerId === currentUser.id ? null : current)
        }
      } catch (error) {
        backupWriteStatusRef.current.set(currentUser.id, false)
        console.error('Could not read the pending data backup:', error)
        setLocalBackup({ ownerId: currentUser.id, available: true, backupError: error?.message || 'The local backup could not be read.' })
      }
      if (shouldLoadDemoData) {
        const loadDemoData = loadDemoDataRef.current
        if (!loadDemoData) {
          setDataError('Could not initialize demo data because the demo loader is unavailable.')
          if (!quiet) setDataLoading(false)
          return
        }
        await loadDemoData()
      }
      if (!quiet) setDataLoading(false)
    } catch (error) {
      console.error('Failed to load account data:', error)
      if (!isCurrent()) return
      const message = error?.message || 'Could not load your TradeJournal data.'
      if (quiet) notify(`Could not refresh your data: ${message}`)
      else setDataError(message)
      if (!quiet) setDataLoading(false)
    }
  }, [notify, refreshProfile])

  useEffect(() => {
    let active = true
    const currentUser = user
    if (!currentUser) {
      loadRequestRef.current += 1
      if (dataUserIdRef.current) {
        if (journalSaveRef.current.ownerId) saveLocalBackup(journalSaveRef.current.ownerId)
        window.clearTimeout(journalSaveRef.current.timer)
        journalSaveRef.current = { timer: null, ownerId: null, before: null, after: null }
        dataRef.current = defaultData()
        setCurrencyDisplay('USD')
        setData(dataRef.current)
      }
      dataUserIdRef.current = ''
      setDataLoading(false)
      setDataError('')
      setDataUserId('')
      updateSaveStatus('saved')
      return () => { active = false }
    }

    const isNewUser = dataUserIdRef.current !== currentUser.id
    if (isNewUser) {
      loadRequestRef.current += 1
      if (journalSaveRef.current.ownerId && journalSaveRef.current.ownerId !== currentUser.id) {
        saveLocalBackup(journalSaveRef.current.ownerId)
      }
      window.clearTimeout(journalSaveRef.current.timer)
      journalSaveRef.current = { timer: null, ownerId: null, before: null, after: null }
      dataRef.current = defaultData()
      setCurrencyDisplay('USD')
      setData(dataRef.current)
      dataUserIdRef.current = ''
      setDataLoading(true)
      setDataError('')
      setDataUserId('')
      updateSaveStatus('saved')
    }
    void loadAccountData(currentUser, { quiet: !isNewUser, isActive: () => active })

    return () => { active = false }
  }, [user?.id, retryCount, loadAccountData, saveLocalBackup])

  useEffect(() => {
    const currentUserId = user?.id
    if (!currentUserId) return undefined

    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible'
        || dataUserIdRef.current !== currentUserId
        || saveStatusRef.current === 'saving'
        || Date.now() - lastBackgroundRefreshRef.current < 60_000) return

      lastBackgroundRefreshRef.current = Date.now()
      const currentUser = userRef.current
      if (currentUser?.id === currentUserId) void loadAccountData(currentUser, { quiet: true })
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible)
  }, [user?.id, loadAccountData])

  useEffect(() => {
    try {
      window.localStorage.setItem('trade-journal-dark', JSON.stringify(data.dark))
    } catch (error) {
      console.error('Could not save theme preference:', error)
    }
  }, [data.dark])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const profileSettingsSnapshot = useCallback((current) => ({
    appSettings: current.settings,
    importSettings: current.importSettings,
    playbookChecklists: current.playbookChecklists,
    profile: current.profile,
  }), [])

  const persistProfileSettings = useCallback((snapshot) => {
    const userId = userRef.current?.id
    if (!userId) return Promise.resolve({ error: new Error('Sign in before saving settings.') })
    return enqueueSaveTask('profile-settings', userId, 'save settings', () => {
      const write = profileWriteQueue.current.catch(() => undefined).then(() => {
        if (userRef.current?.id !== userId) return { error: new Error('User changed before settings were saved.') }
        return repo.updateProfileSettings(userId, snapshot)
      })
      profileWriteQueue.current = write.then(() => undefined)
      return write
    }, null, 'settings', snapshot)
  }, [enqueueSaveTask])

  const updateSettingsSlot = useCallback((key, value) => {
    const current = dataRef.current
    const previous = current[key]
    const nextValue = typeof value === 'function' ? value(previous) : value
    const next = applyData((state) => ({ ...state, [key]: nextValue }))
    const snapshot = profileSettingsSnapshot(next)
    void persistProfileSettings(snapshot)
    return nextValue
  }, [applyData, persistProfileSettings, profileSettingsSnapshot])

  const rangedTrades = useMemo(() => filterTrades(data.trades, data.range, new Date(), data.customStart, data.customEnd), [data.trades, data.range, data.customStart, data.customEnd])
  const accountTrades = useMemo(() => data.trades.filter((trade) => !data.account || data.account === 'all' || trade.account === data.account), [data.trades, data.account])
  const filteredTrades = useMemo(() => rangedTrades.filter((trade) => !data.account || data.account === 'all' || trade.account === data.account), [rangedTrades, data.account])
  const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades])
  const tempId = useCallback(() => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID()
    const seed = `${Date.now()}-${tradeSequence++}`
    return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (character, index) => {
      const random = (seed.charCodeAt(index % seed.length) + Math.floor(Math.random() * 16)) % 16
      return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16)
    })
  }, [])

  const addTrade = useCallback(async (trade) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return { data: null, error: new Error('Sign in before saving a trade.') }
    const id = tempId('trade')
    const prepared = normalizeTrade({ ...trade, account: trade.account || (dataRef.current.account === 'all' ? null : dataRef.current.account), id, status: 'Closed', pnlOverride: undefined })
    prepared.pnl = calculateTradePnl(prepared)
    prepared.result = prepared.resultOverride || (prepared.pnl > 0 ? 'Win' : prepared.pnl < 0 ? 'Loss' : 'Breakeven')
    prepared.outcome = prepared.result
    prepared.rrr = prepared.rrr ?? prepared.rMultiple
    applyData((current) => ({ ...current, trades: [prepared, ...current.trades] }))
    return enqueueSaveTask(`trade:${id}`, ownerId, 'save trade', () => repo.upsertTrade(ownerId, prepared), (result) => {
      if (userRef.current?.id !== ownerId) return
      applyData((current) => ({ ...current, trades: current.trades.map((item) => item.id === id ? normalizeTrade(result.data) : item) }))
      notify('Trade saved.')
    }, 'trade', prepared)
  }, [applyData, enqueueSaveTask, notify, tempId])

  const updateTrade = useCallback(async (id, updates) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return { data: null, error: new Error('Sign in before updating a trade.') }
    const before = dataRef.current.trades.find((trade) => trade.id === id)
    if (!before) return { data: null, error: new Error('Trade not found.') }
    const screenshotOnly = Object.keys(updates).length > 0 && Object.keys(updates).every((key) => key === 'screenshotBefore' || key === 'screenshotAfter')
    const prepared = screenshotOnly
      ? { ...before, ...updates }
      : normalizeTrade({ ...before, ...updates, pnlOverride: undefined })
    if (!screenshotOnly) {
      prepared.pnl = calculateTradePnl(prepared)
      prepared.result = prepared.resultOverride || (prepared.pnl > 0 ? 'Win' : prepared.pnl < 0 ? 'Loss' : 'Breakeven')
      prepared.outcome = prepared.result
      prepared.rrr = prepared.rrr ?? prepared.rMultiple
    }
    applyData((current) => ({ ...current, trades: current.trades.map((trade) => trade.id === id ? prepared : trade) }))
    return enqueueSaveTask(`trade:${id}`, ownerId, 'update trade', () => repo.upsertTrade(ownerId, prepared), async (result) => {
      if (userRef.current?.id !== ownerId) return
      applyData((current) => ({ ...current, trades: current.trades.map((trade) => trade.id === id ? normalizeTrade(result.data) : trade) }))
      for (const kind of ['Before', 'After']) {
        const field = `screenshot${kind}`
        if (before[field] && before[field] !== prepared[field]) {
          const removal = await deleteScreenshot(before[field])
          if (removal.error) console.warn(`Could not delete replaced trade screenshot: ${removal.error.message || removal.error}`)
        }
      }
      notify('Trade updated.')
    }, 'trade', prepared)
  }, [applyData, enqueueSaveTask, notify])

  const deleteTrade = useCallback((id) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current.trades.find((trade) => trade.id === id)
    if (!before) return
    applyData((current) => ({ ...current, trades: current.trades.filter((trade) => trade.id !== id) }))
    updateSaveStatus('saving')
    void repo.deleteTrade(id).then(async (result) => {
      if (userRef.current?.id !== ownerId) return
      if (result.error) {
        applyData((current) => ({ ...current, trades: current.trades.some((trade) => trade.id === id) ? current.trades : [before, ...current.trades] }))
        updateSaveStatus('error')
        notify(`Could not delete trade: ${result.error.message || 'Unknown error'}`)
      } else {
        updateSaveStatus('saved')
        await cleanupTradeScreenshots(ownerId, [before])
      }
    })
    notify('Trade deleted.')
  }, [applyData, notify])

  const importTrades = useCallback((trades, importBatchId) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return 0
    const imported = trades.map((trade, index) => {
      const prepared = normalizeTrade({ ...trade, id: tempId('import'), importBatchId, status: 'Closed', isDemo: false, pnlOverride: undefined })
      prepared.pnl = calculateTradePnl(prepared)
      prepared.result = prepared.resultOverride || (prepared.pnl > 0 ? 'Win' : prepared.pnl < 0 ? 'Loss' : 'Breakeven')
      prepared.outcome = prepared.result
      prepared.rrr = prepared.rrr ?? prepared.rMultiple
      prepared._importIndex = index
      return prepared
    })
    applyData((current) => ({ ...current, trades: [...imported, ...current.trades] }))
    void enqueueSaveTask(`trade-import:${importBatchId}`, ownerId, 'import trades', () => repo.upsertTradesBulk(ownerId, imported), (result) => {
      if (userRef.current?.id !== ownerId) return
      const byId = new Map((result.data?.insertedTrades || []).map(({ trade }) => [trade.id, trade]))
      applyData((current) => ({
        ...current,
        trades: current.trades.map((trade) => {
          const stored = byId.get(trade.id)
          return stored ? normalizeTrade({ ...trade, ...stored }) : trade
        }),
      }))
      notify(`${result.data?.insertedCount || imported.length} trades imported.`)
    }, 'trades', imported)
    return imported.length
  }, [applyData, enqueueSaveTask, notify, tempId])

  const undoImport = useCallback((importBatchId) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const removed = dataRef.current.trades.filter((trade) => trade.importBatchId === importBatchId)
    applyData((current) => ({ ...current, trades: current.trades.filter((trade) => trade.importBatchId !== importBatchId) }))
    void repo.deleteTradesByBatch(importBatchId).then(async (result) => {
      if (userRef.current?.id !== ownerId) return
      if (result.error) {
        applyData((current) => ({ ...current, trades: [...removed.filter((trade) => !current.trades.some((item) => item.id === trade.id)), ...current.trades] }))
        notify(`Could not undo import: ${result.error.message || 'Unknown error'}`)
      } else await cleanupTradeScreenshots(ownerId, removed)
    })
    notify('Imported batch removed.')
  }, [applyData, notify])

  const removeDemoTrades = useCallback(() => {
    const ownerId = userRef.current?.id
    if (!ownerId) return 0
    const removed = dataRef.current.trades.filter((trade) => trade.isDemo)
    applyData((current) => ({ ...current, trades: current.trades.filter((trade) => !trade.isDemo) }))
    void repo.deleteDemoTrades().then(async (result) => {
      if (userRef.current?.id !== ownerId) return
      if (result.error) {
        applyData((current) => ({ ...current, trades: [...removed.filter((trade) => !current.trades.some((item) => item.id === trade.id)), ...current.trades] }))
        notify(`Could not remove demo trades: ${result.error.message || 'Unknown error'}`)
      } else await cleanupTradeScreenshots(ownerId, removed)
    })
    notify(`${removed.length} demo trades removed.`)
    return removed.length
  }, [applyData, notify])

  const loadDemoData = useCallback(async () => {
    const ownerId = userRef.current?.id
    if (!ownerId) return { inserted: 0, failed: 0 }
    const temporaryAccount = { ...demoAccounts[0], id: tempId('demo-account') }
    applyData((current) => ({ ...current, accounts: [temporaryAccount, ...current.accounts] }))
    updateSaveStatus('saving')
    const accountResult = await repo.createAccount(temporaryAccount)
    if (userRef.current?.id !== ownerId) return { inserted: 0, failed: 0 }
    if (accountResult.error) {
      applyData((current) => ({ ...current, accounts: current.accounts.filter((account) => account.id !== temporaryAccount.id) }))
      updateSaveStatus('error')
      notify(`Could not load demo data: ${accountResult.error.message || 'Account creation failed'}`)
      return { inserted: 0, failed: mockTrades.length }
    }
    applyData((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === temporaryAccount.id ? accountResult.data : account) }))
    const demo = mockTrades.map((trade) => {
      const prepared = normalizeTrade({ ...trade, account: accountResult.data.id, id: tempId('demo'), isDemo: true, pnlOverride: undefined })
      prepared.pnl = calculateTradePnl(prepared)
      prepared.result = prepared.resultOverride || (prepared.pnl > 0 ? 'Win' : prepared.pnl < 0 ? 'Loss' : 'Breakeven')
      prepared.outcome = prepared.result
      prepared.rrr = prepared.rrr ?? prepared.rMultiple
      return prepared
    })
    applyData((current) => ({ ...current, trades: [...demo, ...current.trades] }))
    const result = await repo.insertTradesBulk(demo)
    if (userRef.current?.id !== ownerId) return { inserted: 0, failed: 0 }
    if (result.error) {
      const failedIndexes = new Set()
      for (const failed of result.data?.failedChunks || []) {
        for (let index = failed.startIndex; index < failed.startIndex + failed.count; index += 1) failedIndexes.add(index)
      }
      const inserted = new Map((result.data?.insertedTrades || []).map(({ index, trade }) => [index, trade]))
      applyData((current) => ({
        ...current,
        trades: current.trades.flatMap((trade) => {
          const index = demo.findIndex((item) => item.id === trade.id)
          if (index < 0) return [trade]
          if (failedIndexes.has(index)) return []
          const row = inserted.get(index)
          return row ? [normalizeTrade({ ...trade, ...row })] : [trade]
        }),
      }))
      notify(`${result.data?.insertedCount || 0} demo trades loaded; ${failedIndexes.size} failed.`)
      return { inserted: result.data?.insertedCount || 0, failed: failedIndexes.size }
    }
    const stored = new Map((result.data?.insertedTrades || []).map(({ index, trade }) => [index, trade]))
    applyData((current) => ({
      ...current,
      trades: current.trades.map((trade) => {
        const index = demo.findIndex((item) => item.id === trade.id)
        return index >= 0 && stored.has(index) ? normalizeTrade({ ...trade, ...stored.get(index) }) : trade
      }),
    }))
    notify(`${result.data?.insertedCount || 0} demo trades loaded.`)
    return { inserted: result.data?.insertedCount || 0, failed: 0 }
  }, [applyData, notify, tempId])
  loadDemoDataRef.current = loadDemoData

  const replaceArray = useCallback((key, value, type) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current[key] || []
    const after = typeof value === 'function' ? value(before) : value
    if (!Array.isArray(after)) return before
    const idFor = (item) => item.id || (type === 'notes' ? `title:${item.title}` : type === 'playbooks' ? `name:${item.name}` : '')
    const beforeById = new Map(before.map((item) => [idFor(item), item]))
    const normalizedAfter = after.map((item) => item.id ? item : { ...item, id: tempId(type) })
    const afterById = new Map(normalizedAfter.map((item) => [idFor(item), item]))
    applyData((current) => ({ ...current, [key]: normalizedAfter }))
    if (JSON.stringify(before) !== JSON.stringify(normalizedAfter)) updateSaveStatus('saving')
    let pendingWrites = 0
    const completeWrite = () => {
      pendingWrites -= 1
      if (pendingWrites <= 0) updateSaveStatus('saved')
    }
    for (const oldItem of before) {
      const id = idFor(oldItem)
      if (afterById.has(id)) continue
      const remove = type === 'notes' ? repo.deleteNote : type === 'playbooks' ? repo.deletePlaybook : repo.deleteAccount
      pendingWrites += 1
      void remove(oldItem.id).then((result) => {
        if (userRef.current?.id !== ownerId) return
        if (result.error) {
          applyData((current) => ({ ...current, [key]: current[key].some((item) => item.id === oldItem.id) ? current[key] : [oldItem, ...current[key]] }))
          updateSaveStatus('error')
          notify(`Could not delete ${type.slice(0, -1)}: ${result.error.message || 'Unknown error'}`)
        } else completeWrite()
      })
    }
    for (const item of normalizedAfter) {
      const id = idFor(item)
      const oldItem = beforeById.get(id)
      const isNew = !oldItem
      if (isNew) {
        const save = type === 'notes' ? repo.upsertNote : type === 'playbooks' ? repo.upsertPlaybook : repo.upsertAccount
        void enqueueSaveTask(`${type}:${item.id}`, ownerId, `save ${type.slice(0, -1)}`, () => save(ownerId, item), (result) => {
          if (userRef.current?.id === ownerId) {
            applyData((current) => ({ ...current, [key]: current[key].map((candidate) => candidate.id === item.id ? result.data : candidate) }))
          }
        }, type.slice(0, -1), item)
      } else if (JSON.stringify(oldItem) !== JSON.stringify(item)) {
        const save = type === 'notes' ? repo.upsertNote : type === 'playbooks' ? repo.upsertPlaybook : repo.upsertAccount
        void enqueueSaveTask(`${type}:${item.id}`, ownerId, `save ${type.slice(0, -1)}`, () => save(ownerId, item), (result) => {
          if (userRef.current?.id === ownerId) {
            applyData((current) => ({ ...current, [key]: current[key].map((candidate) => candidate.id === item.id ? result.data : candidate) }))
          }
        }, type.slice(0, -1), item)
      }
    }
    if (pendingWrites === 0 && JSON.stringify(before) !== JSON.stringify(normalizedAfter)) updateTrackedSaveStatus()
  }, [applyData, enqueueSaveTask, notify, tempId, updateTrackedSaveStatus, updateSaveStatus])

  const setNotes = useCallback((next) => { replaceArray('notes', next, 'notes') }, [replaceArray])
  const setPlaybooks = useCallback((next) => { replaceArray('playbooks', next, 'playbooks') }, [replaceArray])
  const setAccounts = useCallback((next) => { replaceArray('accounts', next, 'accounts') }, [replaceArray])

  const persistJournalScheduled = useCallback(async (scheduled) => {
    if (userRef.current?.id !== scheduled.ownerId) {
      saveLocalBackup(scheduled.ownerId)
      return { error: new Error('The active account changed before the journal entry was saved.') }
    }
    scheduled.inFlight = true
    const dates = new Set([...Object.keys(scheduled.before || {}), ...Object.keys(scheduled.after || {})])
    const writes = [...dates].filter((date) => JSON.stringify(scheduled.before?.[date]) !== JSON.stringify(scheduled.after?.[date]))
    const results = await Promise.all(writes.map(async (date) => {
      if (date in scheduled.after) {
        const entry = { ...scheduled.after[date], date, userId: scheduled.ownerId }
        return {
          date,
          isDelete: false,
          result: await enqueueSaveTask(`journal:${date}`, scheduled.ownerId, 'save journal entry', () => repo.upsertJournalEntry(entry), null, 'journal', entry),
        }
      }
      return { date, isDelete: true, result: await repo.deleteJournalEntry(date) }
    }))
    if (userRef.current?.id !== scheduled.ownerId) return { error: new Error('The active account changed during the journal save.') }
    const failures = results.filter(({ result }) => result.error)
    const deleteFailures = failures.filter(({ isDelete }) => isDelete)
    if (deleteFailures.length) {
      applyData((current) => {
        const journal = { ...current.journal }
        for (const { date } of deleteFailures) {
          if (JSON.stringify(journal[date]) !== JSON.stringify(scheduled.after[date])) continue
          if (date in scheduled.before) journal[date] = scheduled.before[date]
          else delete journal[date]
        }
        return { ...current, journal }
      })
      notify(`Could not delete journal entry: ${deleteFailures[0].result.error.message || 'Unknown error'}`)
    }
    if (journalSaveRef.current === scheduled) {
      journalSaveRef.current = { timer: null, ownerId: null, before: null, after: null }
    }
    const hasPendingJournal = [...pendingSaveTasksRef.current.values()].some((task) => task.ownerId === scheduled.ownerId && task.backupKind === 'journal')
    const hasPendingOwnerTasks = [...pendingSaveTasksRef.current.values()].some((task) => task.ownerId === scheduled.ownerId)
    if (!hasPendingOwnerTasks) {
      try {
        window.localStorage.removeItem(pendingBackupKey(scheduled.ownerId))
        setLocalBackup((current) => current?.ownerId === scheduled.ownerId ? null : current)
      } catch (error) {
        console.error('Could not clear the pending journal backup:', error)
      }
    } else {
      saveLocalBackup(scheduled.ownerId)
    }
    setJournalSaveStatus(failures.length ? 'error' : hasPendingJournal ? 'saving' : 'saved')
    updateTrackedSaveStatus()
    return { error: failures[0]?.result.error || null }
  }, [applyData, enqueueSaveTask, notify, saveLocalBackup, updateTrackedSaveStatus])

  const setJournal = useCallback((value) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current.journal || {}
    const after = typeof value === 'function' ? value(before) : value
    if (!after || typeof after !== 'object' || Array.isArray(after)) return before
    applyData((current) => ({ ...current, journal: after }))
    const pending = journalSaveRef.current.ownerId === ownerId ? journalSaveRef.current : null
    const original = pending?.inFlight ? pending.after : pending?.before || before
    const dates = new Set([...Object.keys(original), ...Object.keys(after)])
    const writes = [...dates].filter((date) => JSON.stringify(original[date]) !== JSON.stringify(after[date]))
    window.clearTimeout(journalSaveRef.current.timer)
    if (!writes.length) {
      if (pending?.inFlight) return after
      journalSaveRef.current = { timer: null, ownerId, before: null, after: null }
      updateTrackedSaveStatus()
      setJournalSaveStatus('saved')
      return after
    }

    updateSaveStatus('saving')
    setJournalSaveStatus('saving')
    const scheduled = { timer: null, ownerId, before: original, after, inFlight: false, promise: null }
    scheduled.timer = window.setTimeout(() => {
      scheduled.promise = persistJournalScheduled(scheduled)
    }, 500)
    journalSaveRef.current = scheduled
    saveLocalBackup(ownerId)
    return after
  }, [applyData, persistJournalScheduled, saveLocalBackup, updateSaveStatus, updateTrackedSaveStatus])

  useEffect(() => () => {
    const scheduled = journalSaveRef.current
    if (scheduled?.ownerId) saveLocalBackup(scheduled.ownerId)
    window.clearTimeout(scheduled?.timer)
  }, [saveLocalBackup])

  const flushPendingSaves = useCallback(async () => {
    const ownerId = userRef.current?.id
    if (!ownerId) return { error: null }
    const scheduled = journalSaveRef.current.ownerId === ownerId ? journalSaveRef.current : null
    if (scheduled) {
      window.clearTimeout(scheduled.timer)
      scheduled.timer = null
      if (!scheduled.promise) scheduled.promise = persistJournalScheduled(scheduled)
      const journalResult = await scheduled.promise
      if (journalResult?.error && !backupWriteStatusRef.current.get(ownerId)) {
        return { error: journalResult.error, backupSaved: false }
      }
    }
    await profileWriteQueue.current
    const tasks = [...pendingSaveTasksRef.current.values()].filter((task) => task.ownerId === ownerId)
    const results = await Promise.all(tasks.map((task) => task.failed
      ? executeSaveTask(task)
      : task.promise || Promise.resolve({ error: null })))
    const failure = results.find((result) => result?.error)?.error
    if (failure) return { error: failure, backupSaved: backupWriteStatusRef.current.get(ownerId) === true }
    if ([...pendingSaveTasksRef.current.values()].some((task) => task.ownerId === ownerId && task.failed)) {
      return {
        error: new Error('Some changes could not be saved. Retry before signing out.'),
        backupSaved: backupWriteStatusRef.current.get(ownerId) === true,
      }
    }
    return { error: null }
  }, [executeSaveTask, persistJournalScheduled])

  useEffect(() => registerPendingSavesFlusher(flushPendingSaves), [flushPendingSaves])

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void flushPendingSaves()
    }
    const flushOnPageHide = () => { void flushPendingSaves() }
    document.addEventListener('visibilitychange', flushWhenHidden)
    window.addEventListener('pagehide', flushOnPageHide)
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden)
      window.removeEventListener('pagehide', flushOnPageHide)
    }
  }, [flushPendingSaves])

  const restoreLocalBackup = useCallback(async () => {
    const ownerId = userRef.current?.id
    if (!ownerId || localBackup?.ownerId !== ownerId) return { error: new Error('No backup is available for this account.') }
    if (localBackup.backupError) return { error: new Error(localBackup.backupError) }
    if (!Array.isArray(localBackup.pendingSaves)) return { error: new Error('The local backup format is not valid.') }
    const supportedKinds = new Set(['trade', 'trades', 'journal', 'note', 'playbook', 'account', 'settings', 'profile'])
    if (localBackup.pendingSaves.some((saved) => !supportedKinds.has(saved?.kind) || !saved.key || !saved.value)) {
      return { error: new Error('The local backup contains an unsupported or incomplete change.') }
    }
    restoreInProgressRef.current = true
    const restoredTasks = []
    const orderedSaves = [...localBackup.pendingSaves].sort((a, b) => Number(b.kind === 'account') - Number(a.kind === 'account'))
    for (const saved of orderedSaves) {
      const { kind, value } = saved
      if (!kind || !value) continue
      let run
      let apply
      if (kind === 'trades' && Array.isArray(value)) {
        run = () => repo.upsertTradesBulk(ownerId, value)
        apply = (current, result) => {
          const stored = new Map((result.data?.insertedTrades || []).map(({ trade }) => [trade.id, trade]))
          return {
            ...current,
            trades: [...value.map((trade) => normalizeTrade({ ...trade, ...stored.get(trade.id) })), ...current.trades.filter((trade) => !value.some((savedTrade) => savedTrade.id === trade.id))],
          }
        }
      } else if (kind === 'trade') {
        run = () => repo.upsertTrade(ownerId, value)
        apply = (current, result) => ({ ...current, trades: [result.data, ...current.trades.filter((item) => item.id !== value.id)] })
      } else if (kind === 'journal') {
        const entry = { ...value, userId: ownerId }
        run = () => repo.upsertJournalEntry(entry)
        apply = (current) => ({ ...current, journal: { ...current.journal, [entry.date]: entry } })
      } else if (kind === 'note' || kind === 'playbook' || kind === 'account') {
        const save = kind === 'note' ? repo.upsertNote : kind === 'playbook' ? repo.upsertPlaybook : repo.upsertAccount
        const collection = kind === 'note' ? 'notes' : kind === 'playbook' ? 'playbooks' : 'accounts'
        run = () => save(ownerId, value)
        apply = (current, result) => ({ ...current, [collection]: [result.data, ...current[collection].filter((item) => item.id !== value.id)] })
      } else if (kind === 'settings') {
        run = () => repo.updateProfileSettings(ownerId, value)
        apply = (current) => ({
          ...current,
          settings: { ...current.settings, ...(value.appSettings || {}) },
          importSettings: { ...current.importSettings, ...(value.importSettings || {}) },
          playbookChecklists: value.playbookChecklists || current.playbookChecklists,
          profile: value.profile || current.profile,
        })
      } else if (kind === 'profile') {
        run = () => repo.updateProfileDisplayName(ownerId, value.name || '')
        apply = (current) => ({ ...current, profile: value })
      }
      if (!run) continue
      const optimisticResult = kind === 'trades' ? { data: { insertedTrades: [] } } : { data: value }
      applyData((current) => apply(current, optimisticResult))
      const task = enqueueSaveTask(saved.key, ownerId, `restore ${kind}`, run, (result) => {
        applyData((current) => apply(current, result))
      }, kind, value)
      if (kind === 'account') {
        const accountResult = await task
        if (accountResult?.error) {
          restoreInProgressRef.current = false
          return accountResult
        }
      } else restoredTasks.push(task)
    }
    const results = await Promise.all(restoredTasks)
    restoreInProgressRef.current = false
    const error = results.find((result) => result?.error)?.error || null
    const remaining = [...pendingSaveTasksRef.current.values()].some((task) => task.ownerId === ownerId)
    if (!error && !remaining) {
      try {
        window.localStorage.removeItem(pendingBackupKey(ownerId))
        setLocalBackup(null)
      } catch (storageError) {
        console.error('Could not clear the restored data backup:', storageError)
        return { error: storageError }
      }
    }
    return { error }
  }, [applyData, enqueueSaveTask, localBackup])

  const setTrades = useCallback((value) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current.trades
    const proposed = typeof value === 'function' ? value(before) : value
    if (!Array.isArray(proposed)) return before
    const normalized = proposed.map((trade) => trade.id ? normalizeTrade(trade) : normalizeTrade({ ...trade, id: tempId('trade') }))
    applyData((current) => ({ ...current, trades: normalized }))
    const afterIds = new Set(normalized.map((trade) => trade.id))
    for (const oldTrade of before) {
      if (afterIds.has(oldTrade.id)) continue
      void repo.deleteTrade(oldTrade.id).then((result) => {
        if (userRef.current?.id !== ownerId) return
        if (result.error) {
          applyData((current) => ({ ...current, trades: current.trades.some((trade) => trade.id === oldTrade.id) ? current.trades : [oldTrade, ...current.trades] }))
          notify(`Could not delete trade: ${result.error.message || 'Unknown error'}`)
        }
      })
    }
    for (const trade of normalized) {
      const oldTrade = before.find((item) => item.id === trade.id)
      if (!oldTrade) {
        void enqueueSaveTask(`trade:${trade.id}`, ownerId, 'save trade', () => repo.upsertTrade(ownerId, trade), (result) => {
          if (userRef.current?.id === ownerId) {
            applyData((current) => ({ ...current, trades: current.trades.map((item) => item.id === trade.id ? normalizeTrade(result.data) : item) }))
          }
        }, 'trade', trade)
      } else if (JSON.stringify(oldTrade) !== JSON.stringify(trade)) {
        void enqueueSaveTask(`trade:${trade.id}`, ownerId, 'update trade', () => repo.upsertTrade(ownerId, trade), (result) => {
          if (userRef.current?.id === ownerId) {
            applyData((current) => ({ ...current, trades: current.trades.map((item) => item.id === trade.id ? normalizeTrade(result.data) : item) }))
          }
        }, 'trade', trade)
      }
    }
  }, [applyData, enqueueSaveTask, notify, tempId])

  const clearAllTrades = useCallback(async () => {
    const ownerId = userRef.current?.id
    if (!ownerId) return { data: null, error: new Error('Sign in before deleting trades.') }
    const previous = dataRef.current.trades
    applyData((current) => ({ ...current, trades: [] }))
    const result = await repo.deleteAllTrades(ownerId)
    if (userRef.current?.id !== ownerId) return { data: null, error: new Error('The active account changed during deletion.') }
    if (result.error) {
      applyData((current) => ({ ...current, trades: previous }))
      notify(`Could not delete trades: ${result.error.message || 'Unknown error'}`)
      return result
    }
    await cleanupTradeScreenshots(ownerId, previous)
    return result
  }, [applyData, notify])

  const addAccount = useCallback((account) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const id = tempId('account')
    const optimistic = { ...account, id }
    applyData((current) => ({ ...current, accounts: [optimistic, ...current.accounts] }))
    void enqueueSaveTask(`account:${id}`, ownerId, 'save account', () => repo.upsertAccount(ownerId, optimistic), (result) => {
      if (userRef.current?.id === ownerId) {
        applyData((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? result.data : item) }))
      }
    }, 'account', optimistic)
    return optimistic
  }, [applyData, enqueueSaveTask, tempId])

  const updateAccount = useCallback((id, patch) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current.accounts.find((item) => item.id === id)
    if (!before) return null
    const optimistic = { ...before, ...patch }
    applyData((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? optimistic : item) }))
    void enqueueSaveTask(`account:${id}`, ownerId, 'update account', () => repo.upsertAccount(ownerId, optimistic), (result) => {
      if (userRef.current?.id === ownerId) {
        applyData((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? result.data : item) }))
      }
    }, 'account', optimistic)
    return optimistic
  }, [applyData, enqueueSaveTask])

  const deleteAccount = useCallback((id) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current.accounts.find((item) => item.id === id)
    if (!before) return 0
    applyData((current) => ({ ...current, accounts: current.accounts.filter((item) => item.id !== id) }))
    void repo.deleteAccount(id).then((result) => {
      if (userRef.current?.id !== ownerId) return
      if (result.error) {
        applyData((current) => ({ ...current, accounts: current.accounts.some((item) => item.id === id) ? current.accounts : [before, ...current.accounts] }))
        notify(`Could not delete account: ${result.error.message || 'Unknown error'}`)
      }
    })
    return 1
  }, [applyData, notify])

  const setProfile = useCallback((value) => {
    const ownerId = userRef.current?.id
    const nextValue = typeof value === 'function' ? value(dataRef.current.profile) : value
    applyData((current) => ({ ...current, profile: nextValue }))
    if (ownerId) {
      void enqueueSaveTask('profile-display-name', ownerId, 'save profile', () => repo.updateProfileDisplayName(ownerId, nextValue.name || ''), async () => {
        if (userRef.current?.id === ownerId) await refreshProfile()
      }, 'profile', nextValue)
    }
  }, [applyData, enqueueSaveTask, refreshProfile])

  const replaceData = useCallback((nextData) => {
    const migrated = migrateData(nextData, nextData.schemaVersion || 1)
    setTrades(migrated.trades)
    setJournal(migrated.journal)
    setNotes(migrated.notes)
    setPlaybooks(migrated.playbooks)
    setAccounts(migrated.accounts || [])
    updateSettingsSlot('settings', migrated.settings)
    updateSettingsSlot('importSettings', migrated.importSettings)
    updateSettingsSlot('playbookChecklists', migrated.playbookChecklists)
    setProfile(migrated.profile)
    applyData((current) => ({ ...current, range: migrated.range, customStart: migrated.customStart, customEnd: migrated.customEnd, account: migrated.account, dark: migrated.dark }))
  }, [applyData, setAccounts, setJournal, setNotes, setPlaybooks, setProfile, setTrades, updateSettingsSlot])

  const resetAllData = useCallback(() => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current
    applyData((current) => ({ ...defaultData(), dark: current.dark }))
    void Promise.all([
      ...before.trades.map((trade) => repo.deleteTrade(trade.id)),
      ...before.notes.map((note) => repo.deleteNote(note.id)),
      ...before.playbooks.map((playbook) => repo.deletePlaybook(playbook.id)),
      ...before.accounts.map((account) => repo.deleteAccount(account.id)),
      ...Object.keys(before.journal).map((date) => repo.deleteJournalEntry(date)),
      repo.updateProfileSettings(ownerId, { appSettings: SETTINGS_DEFAULTS, importSettings: IMPORT_SETTINGS_DEFAULTS, playbookChecklists: {}, profile: { name: '' } }),
    ]).then(async (results) => {
      if (userRef.current?.id !== ownerId) return
      const failure = results.find((result) => result.error)
      if (failure) {
        applyData(before)
        notify(`Could not reset cloud data: ${failure.error.message || 'Unknown error'}`)
      } else {
        await cleanupTradeScreenshots(ownerId, before.trades)
        notify('Cloud data reset.')
      }
    })
  }, [applyData, notify])

  const exportBackup = useCallback(() => ({ ...data, schemaVersion: DATA_SCHEMA_VERSION, exportedAt: new Date().toISOString() }), [data])

  const setLocalValue = useCallback((key, value) => {
    const current = dataRef.current[key]
    const nextValue = typeof value === 'function' ? value(current) : value
    applyData((state) => ({ ...state, [key]: nextValue }))
  }, [applyData])

  const setThemeChoice = useCallback((preference) => {
    if (!['light', 'dark', 'system'].includes(preference)) {
      notify(`Unsupported theme preference: ${preference}`)
      return
    }
    const nextDark = preference === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : preference === 'dark'
    try {
      window.localStorage.setItem('trade-journal-theme-chosen', 'true')
      window.localStorage.setItem('trade-journal-theme-preference', preference)
      window.localStorage.setItem('trade-journal-dark', JSON.stringify(nextDark))
    } catch (error) {
      console.error('Could not save the chosen theme on this device:', error)
      notify(`Could not save the chosen theme on this device: ${error?.message || 'Storage is unavailable.'}`)
    }
    setLocalValue('dark', nextDark)
    updateSettingsSlot('settings', (current) => ({
      ...current,
      themePreference: preference,
      themeChosen: true,
      theme: nextDark,
    }))
  }, [notify, setLocalValue, updateSettingsSlot])

  const value = useMemo(() => ({
    ...data,
    trades: data.trades,
    setTrades,
    clearAllTrades,
    setRange: (next) => { setLocalValue('range', next) },
    setCustomStart: (next) => { setLocalValue('customStart', next) },
    setCustomEnd: (next) => { setLocalValue('customEnd', next) },
    setDark: (next) => { setLocalValue('dark', next) },
    setThemeChoice,
    setAccount: (next) => { setLocalValue('account', next) },
    setProfile,
    setSettings: (next) => { updateSettingsSlot('settings', next) },
    setImportSettings: (next) => { updateSettingsSlot('importSettings', next) },
    setPlaybooks,
    setJournal,
    setNotes,
    setAccounts,
    setPlaybookChecklists: (next) => { updateSettingsSlot('playbookChecklists', next) },
    accountTrades,
    filteredTrades,
    stats,
    storageUsage,
    storageLimit: 5 * 1024 * 1024,
    saveStatus,
    saveErrorMessage,
    localBackup,
    retryPendingSaves,
    restoreLocalBackup,
    flushPendingSaves,
    journalSaveStatus,
    dataLoading,
    dataError,
    retryLoad,
    sidebarOpen,
    setSidebarOpen,
    addTradeOpen,
    setAddTradeOpen,
    editingTrade,
    setEditingTrade,
    toast,
    notify,
    addTrade,
    updateTrade,
    deleteTrade,
    importTrades,
    undoImport,
    removeDemoTrades,
    loadDemoData,
    addAccount,
    updateAccount,
    deleteAccount,
    demoTradeCount: data.trades.filter((trade) => trade.isDemo).length,
    exportBackup,
    replaceData,
    resetAllData,
  }), [data, setTrades, clearAllTrades, setLocalValue, setThemeChoice, setProfile, updateSettingsSlot, setPlaybooks, setJournal, setNotes, setAccounts, accountTrades, filteredTrades, stats, storageUsage, saveStatus, saveErrorMessage, localBackup, retryPendingSaves, restoreLocalBackup, flushPendingSaves, journalSaveStatus, dataLoading, dataError, retryLoad, sidebarOpen, addTradeOpen, editingTrade, toast, notify, addTrade, updateTrade, deleteTrade, importTrades, undoImport, removeDemoTrades, loadDemoData, addAccount, updateAccount, deleteAccount, exportBackup, replaceData, resetAllData])

  const pendingBackupForUser = user && localBackup?.ownerId === user.id && localBackup.loadedFromDisk
  const saveNotice = <>
    {user && saveErrorMessage && <section className="pending-save-banner" role="alert">
      <div><strong>Not saved. Check your connection. Retry</strong><span>{saveErrorMessage}</span></div>
      <button type="button" className="button-secondary" disabled={saveStatus === 'saving'} onClick={async () => {
        const result = await retryPendingSaves()
        if (result.error) setSaveErrorMessage(result.error.message || 'Some changes could not be saved.')
      }}>Retry</button>
    </section>}
    {pendingBackupForUser && <section className="pending-save-banner pending-save-restore" role="status">
      <div><strong>A local backup has unsaved changes for this account.</strong><span>Restore it to merge those changes and send them to Supabase.</span></div>
      <button type="button" className="button-primary" disabled={saveStatus === 'saving'} onClick={async () => {
        const result = await restoreLocalBackup()
        if (result.error) setSaveErrorMessage(result.error.message || 'The backup could not be restored.')
      }}>Restore backup</button>
    </section>}
  </>

  if (user && dataError && dataUserId !== user.id) {
    return <DataContext.Provider value={value}>{saveNotice}<main className="page-error-state" role="alert"><strong>Could not load your account data</strong><span>{dataError}</span><button type="button" className="button-primary" onClick={retryLoad}>Retry</button></main></DataContext.Provider>
  }
  if (user && (dataLoading || dataUserId !== user.id)) {
    return <DataContext.Provider value={value}>{saveNotice}<main className="data-loading-shell" role="status" aria-label="Loading your account data"><div className="page-content page-loading"><div className="page-loading-stats"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div><div className="page-loading-chart"><SkeletonCard /><SkeletonRows rows={6} /></div></div></main></DataContext.Provider>
  }

  return <DataContext.Provider value={value}>{saveNotice}{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used within DataProvider')
  return context
}

export { DATA_SCHEMA_VERSION }
