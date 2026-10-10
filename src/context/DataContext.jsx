import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import { accounts as demoAccounts, mockTrades } from '../data/mockData'
import { calculateStats, calculateTradePnl, filterTrades, normalizeTrade, setCurrencyDisplay, symbolPointValues } from '../utils/trading'
import { useAuth } from './AuthContext'
import * as repo from '../data/repo'
import { deleteScreenshot, deleteTradeScreenshots } from '../data/storage'
import { SkeletonCard, SkeletonRows } from '../components/UiElements'

const DATA_SCHEMA_VERSION = 5
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
  const [retryCount, setRetryCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [addTradeOpen, setAddTradeOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null)
  const dataRef = useRef(data)
  const userRef = useRef(user)
  const profileWriteQueue = useRef(Promise.resolve())
  const journalSaveRef = useRef({ timer: null, ownerId: null, before: null, after: null })
  const toastTimer = useRef(null)
  userRef.current = user

  const notify = useCallback((message) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3500)
  }, [])

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

  useEffect(() => {
    let active = true
    const currentUser = user
    window.clearTimeout(journalSaveRef.current.timer)
    journalSaveRef.current = { timer: null, ownerId: null, before: null, after: null }
    if (!currentUser) {
      dataRef.current = defaultData()
      setCurrencyDisplay('USD')
      setData(dataRef.current)
      setDataLoading(false)
      setDataError('')
      setDataUserId('')
      setSaveStatus('saved')
      return () => { active = false }
    }

    dataRef.current = defaultData()
    setCurrencyDisplay('USD')
    setData(dataRef.current)
    setDataLoading(true)
    setDataError('')
    setDataUserId('')
    setSaveStatus('saved')

    Promise.all([
      repo.listAccounts(currentUser.id),
      repo.listTrades(currentUser.id),
      repo.listJournalEntries(currentUser.id),
      repo.listNotes(currentUser.id),
      repo.listPlaybooks(currentUser.id),
      repo.getProfileSettings(currentUser.id),
    ]).then((results) => {
      if (!active) return
      const failed = results.find((result) => result.error)
      if (failed) {
        setDataError(failed.error?.message || 'Could not load your TradeJournal data.')
        setDataLoading(false)
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
      const next = {
        ...defaultData(),
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
        account: storedSettings.defaultAccount || 'all',
        dark: themeChosen
          ? themePreference === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
            : themePreference === 'dark'
          : true,
      }
      dataRef.current = next
      setCurrencyDisplay(next.settings.currencyDisplay || 'USD')
      setData(next)
      setDataLoading(false)
      setDataUserId(currentUser.id)
    }).catch((error) => {
      console.error('Failed to load account data:', error)
      if (!active) return
      setDataError(error?.message || 'Could not load your TradeJournal data.')
      setDataLoading(false)
    })

    return () => { active = false }
  }, [user?.id, retryCount])

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

  const persistProfileSettings = useCallback((snapshot, rollback) => {
    const userId = userRef.current?.id
    if (!userId) return
    setSaveStatus('saving')
    profileWriteQueue.current = profileWriteQueue.current.then(async () => {
      if (userRef.current?.id !== userId) return
      const result = await repo.updateProfileSettings(userId, snapshot)
      if (userRef.current?.id !== userId) return
      if (result.error) {
        rollback?.()
        setSaveStatus('error')
        notify(`Could not save settings: ${result.error.message || 'Unknown error'}`)
      } else {
        setSaveStatus('saved')
      }
    }).catch((error) => {
      console.error('Unexpected profile settings save failure:', error)
      rollback?.()
      setSaveStatus('error')
      notify(`Could not save settings: ${error?.message || 'Unknown error'}`)
    })
  }, [notify])

  const updateSettingsSlot = useCallback((key, value) => {
    const current = dataRef.current
    const previous = current[key]
    const nextValue = typeof value === 'function' ? value(previous) : value
    const next = applyData((state) => ({ ...state, [key]: nextValue }))
    const snapshot = profileSettingsSnapshot(next)
    persistProfileSettings(snapshot, () => {
      applyData((state) => state[key] === nextValue ? { ...state, [key]: previous } : state)
    })
    return nextValue
  }, [applyData, persistProfileSettings, profileSettingsSnapshot])

  const rangedTrades = useMemo(() => filterTrades(data.trades, data.range, new Date(), data.customStart, data.customEnd), [data.trades, data.range, data.customStart, data.customEnd])
  const accountTrades = useMemo(() => data.trades.filter((trade) => !data.account || data.account === 'all' || trade.account === data.account), [data.trades, data.account])
  const filteredTrades = useMemo(() => rangedTrades.filter((trade) => !data.account || data.account === 'all' || trade.account === data.account), [rangedTrades, data.account])
  const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades])
  const tempId = useCallback((prefix) => `${prefix}-pending-${Date.now()}-${tradeSequence++}`, [])

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
    setSaveStatus('saving')
    const result = await repo.createTrade(prepared)
    if (userRef.current?.id !== ownerId) return { data: null, error: new Error('User changed before the trade was saved.') }
    if (result.error) {
      applyData((current) => ({ ...current, trades: current.trades.filter((item) => item.id !== id) }))
      setSaveStatus('error')
      notify(`Could not save trade: ${result.error.message || 'Unknown error'}`)
      return result
    }
    applyData((current) => ({ ...current, trades: current.trades.map((item) => item.id === id ? normalizeTrade(result.data) : item) }))
    setSaveStatus('saved')
    notify('Trade saved.')
    return result
  }, [applyData, notify, tempId])

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
    setSaveStatus('saving')
    const result = await repo.updateTrade(id, prepared)
    if (userRef.current?.id !== ownerId) return { data: null, error: new Error('User changed before the trade was updated.') }
    if (result.error) {
      applyData((current) => ({ ...current, trades: current.trades.map((trade) => trade.id === id && trade === prepared ? before : trade) }))
      setSaveStatus('error')
      notify(`Could not update trade: ${result.error.message || 'Unknown error'}`)
      return result
    }
    applyData((current) => ({ ...current, trades: current.trades.map((trade) => trade.id === id && trade === prepared ? normalizeTrade(result.data) : trade) }))
    for (const kind of ['Before', 'After']) {
      const field = `screenshot${kind}`
      if (before[field] && before[field] !== prepared[field]) {
        const removal = await deleteScreenshot(before[field])
        if (removal.error) console.warn(`Could not delete replaced trade screenshot: ${removal.error.message || removal.error}`)
      }
    }
    setSaveStatus('saved')
    notify('Trade updated.')
    return result
  }, [applyData, notify])

  const deleteTrade = useCallback((id) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current.trades.find((trade) => trade.id === id)
    if (!before) return
    applyData((current) => ({ ...current, trades: current.trades.filter((trade) => trade.id !== id) }))
    setSaveStatus('saving')
    void repo.deleteTrade(id).then(async (result) => {
      if (userRef.current?.id !== ownerId) return
      if (result.error) {
        applyData((current) => ({ ...current, trades: current.trades.some((trade) => trade.id === id) ? current.trades : [before, ...current.trades] }))
        setSaveStatus('error')
        notify(`Could not delete trade: ${result.error.message || 'Unknown error'}`)
      } else {
        setSaveStatus('saved')
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
    setSaveStatus('saving')
    void repo.insertTradesBulk(imported).then((result) => {
      if (userRef.current?.id !== ownerId) return
      const failedIndexes = new Set()
      for (const failed of result.data?.failedChunks || []) {
        for (let index = failed.startIndex; index < failed.startIndex + failed.count; index += 1) failedIndexes.add(index)
      }
      const idsByIndex = new Map((result.data?.insertedTrades || []).map(({ index, trade }) => [index, trade]))
      applyData((current) => ({
        ...current,
        trades: current.trades.flatMap((trade) => {
          const index = imported.findIndex((item) => item.id === trade.id)
          if (index < 0) return [trade]
          if (failedIndexes.has(index)) return []
          const stored = idsByIndex.get(index)
          if (!stored) return [trade]
          const { _importIndex, ...clean } = stored
          return [normalizeTrade({ ...trade, ...clean, id: stored.id })]
        }),
      }))
      const failures = failedIndexes.size
      if (failures) {
        setSaveStatus('error')
        notify(`${(result.data?.insertedCount || 0)} trades imported; ${failures} failed. ${result.error?.message || ''}`.trim())
      } else {
        setSaveStatus('saved')
        notify(`${result.data?.insertedCount || 0} trades imported.`)
      }
    })
    return imported.length
  }, [applyData, notify, tempId])

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
    setSaveStatus('saving')
    const accountResult = await repo.createAccount(temporaryAccount)
    if (userRef.current?.id !== ownerId) return { inserted: 0, failed: 0 }
    if (accountResult.error) {
      applyData((current) => ({ ...current, accounts: current.accounts.filter((account) => account.id !== temporaryAccount.id) }))
      setSaveStatus('error')
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
    if (JSON.stringify(before) !== JSON.stringify(normalizedAfter)) setSaveStatus('saving')
    let pendingWrites = 0
    const completeWrite = () => {
      pendingWrites -= 1
      if (pendingWrites <= 0) setSaveStatus('saved')
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
          setSaveStatus('error')
          notify(`Could not delete ${type.slice(0, -1)}: ${result.error.message || 'Unknown error'}`)
        } else completeWrite()
      })
    }
    for (const item of normalizedAfter) {
      const id = idFor(item)
      const oldItem = beforeById.get(id)
      const isNew = !oldItem
      const isTemp = String(item.id).includes('-pending-')
      const create = type === 'notes' ? repo.createNote : type === 'playbooks' ? repo.createPlaybook : repo.createAccount
      const update = type === 'notes' ? repo.updateNote : type === 'playbooks' ? repo.updatePlaybook : repo.updateAccount
      if (isNew || isTemp) {
        pendingWrites += 1
        void create(item).then((result) => {
          if (userRef.current?.id !== ownerId) return
          if (result.error) {
            applyData((current) => ({ ...current, [key]: current[key].filter((candidate) => candidate.id !== item.id) }))
            setSaveStatus('error')
            notify(`Could not create ${type.slice(0, -1)}: ${result.error.message || 'Unknown error'}`)
            return
          }
          applyData((current) => ({ ...current, [key]: current[key].map((candidate) => candidate.id === item.id ? result.data : candidate) }))
          completeWrite()
        })
      } else if (JSON.stringify(oldItem) !== JSON.stringify(item)) {
        pendingWrites += 1
        void update(oldItem.id, item).then((result) => {
          if (userRef.current?.id !== ownerId) return
          if (result.error) {
            applyData((current) => ({ ...current, [key]: current[key].map((candidate) => candidate.id === item.id && candidate === item ? oldItem : candidate) }))
            setSaveStatus('error')
            notify(`Could not update ${type.slice(0, -1)}: ${result.error.message || 'Unknown error'}`)
          } else {
            applyData((current) => ({ ...current, [key]: current[key].map((candidate) => candidate.id === item.id ? result.data : candidate) }))
            completeWrite()
          }
        })
      }
    }
    if (pendingWrites === 0 && JSON.stringify(before) !== JSON.stringify(normalizedAfter)) setSaveStatus('saved')
  }, [applyData, notify, tempId])

  const setNotes = useCallback((next) => { replaceArray('notes', next, 'notes') }, [replaceArray])
  const setPlaybooks = useCallback((next) => { replaceArray('playbooks', next, 'playbooks') }, [replaceArray])
  const setAccounts = useCallback((next) => { replaceArray('accounts', next, 'accounts') }, [replaceArray])

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
      setSaveStatus('saved')
      return after
    }

    setSaveStatus('saving')
    const scheduled = { timer: null, ownerId, before: original, after, inFlight: false }
    scheduled.timer = window.setTimeout(async () => {
      if (userRef.current?.id !== ownerId) return
      scheduled.inFlight = true
      const results = await Promise.all(writes.map(async (date) => ({
        date,
        result: date in after
          ? await repo.upsertJournalEntry({ date, ...after[date] })
          : await repo.deleteJournalEntry(date),
      })))
      if (userRef.current?.id !== ownerId) return
      const failures = results.filter(({ result }) => result.error)
      if (failures.length) {
        applyData((current) => {
          const journal = { ...current.journal }
          for (const { date } of failures) {
            if (JSON.stringify(journal[date]) !== JSON.stringify(after[date])) continue
            if (date in original) journal[date] = original[date]
            else delete journal[date]
          }
          return { ...current, journal }
        })
        setSaveStatus('error')
        notify(`Could not save journal entry: ${failures[0].result.error.message || 'Unknown error'}`)
      } else if (journalSaveRef.current === scheduled) {
        setSaveStatus('saved')
      }
      if (journalSaveRef.current === scheduled) {
        journalSaveRef.current = { timer: null, ownerId: null, before: null, after: null }
      }
    }, 500)
    journalSaveRef.current = scheduled
    return after
  }, [applyData, notify])

  useEffect(() => () => window.clearTimeout(journalSaveRef.current.timer), [])

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
        void repo.createTrade(trade).then((result) => {
          if (userRef.current?.id !== ownerId) return
          if (result.error) {
            applyData((current) => ({ ...current, trades: current.trades.filter((item) => item.id !== trade.id) }))
            notify(`Could not save trade: ${result.error.message || 'Unknown error'}`)
          } else {
            applyData((current) => ({ ...current, trades: current.trades.map((item) => item.id === trade.id ? normalizeTrade(result.data) : item) }))
          }
        })
      } else if (JSON.stringify(oldTrade) !== JSON.stringify(trade)) {
        void repo.updateTrade(oldTrade.id, trade).then((result) => {
          if (userRef.current?.id !== ownerId) return
          if (result.error) {
            applyData((current) => ({ ...current, trades: current.trades.map((item) => item.id === trade.id && item === trade ? oldTrade : item) }))
            notify(`Could not update trade: ${result.error.message || 'Unknown error'}`)
          } else applyData((current) => ({ ...current, trades: current.trades.map((item) => item.id === trade.id ? normalizeTrade(result.data) : item) }))
        })
      }
    }
  }, [applyData, notify, tempId])

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
    void repo.createAccount(optimistic).then((result) => {
      if (userRef.current?.id !== ownerId) return
      if (result.error) {
        applyData((current) => ({ ...current, accounts: current.accounts.filter((item) => item.id !== id) }))
        notify(`Could not create account: ${result.error.message || 'Unknown error'}`)
      } else applyData((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? result.data : item) }))
    })
    return optimistic
  }, [applyData, notify, tempId])

  const updateAccount = useCallback((id, patch) => {
    const ownerId = userRef.current?.id
    if (!ownerId) return
    const before = dataRef.current.accounts.find((item) => item.id === id)
    if (!before) return null
    const optimistic = { ...before, ...patch }
    applyData((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? optimistic : item) }))
    void repo.updateAccount(id, patch).then((result) => {
      if (userRef.current?.id !== ownerId) return
      if (result.error) {
        applyData((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id && item === optimistic ? before : item) }))
        notify(`Could not update account: ${result.error.message || 'Unknown error'}`)
      } else applyData((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? result.data : item) }))
    })
    return optimistic
  }, [applyData, notify])

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
    const before = dataRef.current.profile
    const nextValue = typeof value === 'function' ? value(before) : value
    applyData((current) => ({ ...current, profile: nextValue }))
    if (ownerId) void repo.updateProfileDisplayName(ownerId, nextValue.name || '').then(async (result) => {
      if (userRef.current?.id !== ownerId) return
      if (result.error) {
        applyData((current) => ({ ...current, profile: current.profile === nextValue ? before : current.profile }))
        notify(`Could not update profile: ${result.error.message || 'Unknown error'}`)
      } else await refreshProfile()
    })
  }, [applyData, notify, refreshProfile])

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
  }), [data, setTrades, clearAllTrades, setLocalValue, setThemeChoice, setProfile, updateSettingsSlot, setPlaybooks, setJournal, setNotes, setAccounts, accountTrades, filteredTrades, stats, storageUsage, saveStatus, dataLoading, dataError, retryLoad, sidebarOpen, addTradeOpen, editingTrade, toast, notify, addTrade, updateTrade, deleteTrade, importTrades, undoImport, removeDemoTrades, loadDemoData, addAccount, updateAccount, deleteAccount, exportBackup, replaceData, resetAllData])

  if (user && dataError && dataUserId !== user.id) {
    return <DataContext.Provider value={value}><main className="page-error-state" role="alert"><strong>Could not load your account data</strong><span>{dataError}</span><button type="button" className="button-primary" onClick={retryLoad}>Retry</button></main></DataContext.Provider>
  }
  if (user && (dataLoading || dataUserId !== user.id)) {
    return <DataContext.Provider value={value}><main className="data-loading-shell" role="status" aria-label="Loading your account data"><div className="page-content page-loading"><div className="page-loading-stats"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div><div className="page-loading-chart"><SkeletonCard /><SkeletonRows rows={6} /></div></div></main></DataContext.Provider>
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used within DataProvider')
  return context
}

export { DATA_SCHEMA_VERSION }
