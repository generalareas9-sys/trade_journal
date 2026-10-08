import { supabase } from '../lib/supabase'
import { calculateTradePnl } from '../utils/trading'

/*
 * Exported row mappers: tradeFromRow, tradeToRow, journalFromRow,
 * journalToRow, noteFromRow, noteToRow, playbookFromRow, playbookToRow,
 * accountFromRow, accountToRow.
 * Exported data access: listTrades, createTrade, updateTrade, deleteTrade,
 * insertTradesBulk, deleteTradesByBatch, deleteDemoTrades, listJournalEntries,
 * upsertJournalEntry, deleteJournalEntry, listNotes, createNote, updateNote, deleteNote,
 * listPlaybooks, createPlaybook, updatePlaybook, deletePlaybook, listAccounts,
 * createAccount, updateAccount, deleteAccount, getProfileSettings,
 * updateProfileSettings, updateProfileDisplayName.
 * Account cleanup: deleteAllUserRows, deleteAllTrades.
 */

const PAGE_SIZE = 1000
const BULK_SIZE = 500
const SCHEMA_ERROR_MESSAGE = 'Your database is missing a column. Run the latest supabase/schema.sql in the Supabase SQL Editor.'

function normalizeSupabaseError(error) {
  const message = typeof error?.message === 'string' ? error.message : ''
  if (/schema cache|column/i.test(message)) {
    console.warn(error)
    return new Error(SCHEMA_ERROR_MESSAGE)
  }
  return error
}

const tradeFields = [
  ['id', 'id'],
  ['openedAt', 'entry_time'],
  ['closedAt', 'exit_time'],
  ['symbol', 'symbol'],
  ['side', 'side'],
  ['entry', 'entry_price', 'number'],
  ['exit', 'exit_price', 'number'],
  ['size', 'size', 'number'],
  ['pnl', 'pnl', 'number'],
  ['fees', 'fees', 'number'],
  ['riskAmount', 'risk_amount', 'number'],
  ['rrr', 'rrr', 'number'],
  ['strategy', 'strategy'],
  ['result', 'result'],
  ['isDemo', 'is_demo', 'boolean'],
  ['session', 'session'],
  ['preAnalysis', 'pre_analysis'],
  ['followedRules', 'followed_rules'],
  ['entryConditionMet', 'entry_condition_met'],
  ['management', 'management'],
  ['screenshotBefore', 'screenshot_before'],
  ['screenshotAfter', 'screenshot_after'],
  ['psychBefore', 'psych_before'],
  ['psychAfter', 'psych_after'],
  ['riskManagement', 'risk_management'],
  ['stopLossSystem', 'stop_loss_system'],
  ['takeProfitSystem', 'take_profit_system'],
  ['exitCondition', 'exit_condition'],
  ['notes', 'notes'],
  ['account', 'account_id'],
  ['importBatchId', 'import_batch_id'],
]

const noteFields = [
  ['id', 'id'],
  ['title', 'title'],
  ['folder', 'folder'],
  ['body', 'body'],
  ['updatedAt', 'updated_at'],
]

const accountFields = [
  ['id', 'id'],
  ['name', 'name'],
  ['broker', 'broker'],
  ['currency', 'currency'],
]

const numericFields = {
  trades: new Set(['entry', 'exit', 'size', 'pnl', 'fees', 'riskAmount', 'rrr']),
  notes: new Set(),
  accounts: new Set(),
}
const arrayFields = {
  trades: new Set(['mistakes']),
  notes: new Set(),
  accounts: new Set(),
}

const tradeExtraFields = [
  'date',
  'mistakes',
  'outcome',
  'pointValue',
  'pnlOverride',
  'resultOverride',
  'status',
  'rMultiple',
  'tag',
  'quantity',
]
const tradeExtraNumericFields = new Set(['pointValue', 'pnlOverride', 'rMultiple', 'quantity'])
const legacyTradeTagPrefixes = {
  'mistake:': ['mistakes', 'array'],
  'outcome:': ['outcome'],
  'point-value:': ['pointValue', 'number'],
  'pnl-override:': ['pnlOverride', 'number'],
  'result-override:': ['resultOverride'],
  'status:': ['status'],
  'r-multiple:': ['rMultiple', 'number'],
  'quantity:': ['quantity', 'number'],
  'tag:': ['tag'],
  'trade-date:': ['date'],
  'pointValue:': ['pointValue', 'number'],
  'pnlOverride:': ['pnlOverride', 'number'],
  'resultOverride:': ['resultOverride'],
  'rMultiple:': ['rMultiple', 'number'],
}

function legacyTradeMetadata(tags) {
  const metadata = { mistakes: [] }
  const userTags = []
  for (const tag of Array.isArray(tags) ? tags : []) {
    if (typeof tag !== 'string') continue
    const prefix = Object.keys(legacyTradeTagPrefixes).find((candidate) => tag.startsWith(candidate))
    if (!prefix) {
      userTags.push(tag)
      continue
    }
    const [field, type] = legacyTradeTagPrefixes[prefix]
    const value = tag.slice(prefix.length)
    if (type === 'array') metadata[field].push(value)
    else if (type === 'number') {
      const numeric = Number(value)
      if (Number.isFinite(numeric)) metadata[field] = numeric
    } else metadata[field] = value
  }
  return { metadata, userTags }
}

function fromRow(row, fields, collection) {
  if (!row || typeof row !== 'object') return null
  const result = {}
  for (const [camel, snake] of fields) {
    if (!Object.prototype.hasOwnProperty.call(row, snake)) continue
    const value = row[snake]
    if (value === null || value === undefined) {
      result[camel] = value
    } else if (numericFields[collection].has(camel)) {
      const numeric = Number(value)
      result[camel] = Number.isNaN(numeric) ? value : numeric
    } else if (arrayFields[collection]?.has(camel)) {
      result[camel] = Array.isArray(value) ? value : []
    } else {
      result[camel] = value
    }
  }
  return result
}

function toRow(value, fields, collection) {
  if (!value || typeof value !== 'object') return {}
  const result = {}
  for (const [camel, snake] of fields) {
    let fieldValue = value[camel]
    if (fieldValue === undefined) continue
    if (numericFields[collection].has(camel) && fieldValue !== null && fieldValue !== '') {
      const numeric = Number(fieldValue)
      if (!Number.isNaN(numeric)) fieldValue = numeric
    } else if (arrayFields[collection]?.has(camel) && !Array.isArray(fieldValue)) {
      fieldValue = []
    }
    result[snake] = fieldValue
  }
  return result
}

export function tradeFromRow(row) {
  const trade = fromRow(row, tradeFields, 'trades')
  if (!trade) return null
  const extra = row.extra && typeof row.extra === 'object' && !Array.isArray(row.extra) ? row.extra : {}
  const legacy = legacyTradeMetadata(row.tags)
  for (const field of tradeExtraFields) {
    if (Object.prototype.hasOwnProperty.call(extra, field)) {
      let value = extra[field]
      if (tradeExtraNumericFields.has(field) && value !== null && value !== '') {
        const numeric = Number(value)
        if (!Number.isNaN(numeric)) value = numeric
      } else if (field === 'mistakes' && !Array.isArray(value)) value = []
      trade[field] = value
    } else if (Object.prototype.hasOwnProperty.call(legacy.metadata, field)) {
      trade[field] = legacy.metadata[field]
    }
  }
  trade.tags = legacy.userTags
  if (!trade.tag) trade.tag = trade.tags[0] || ''
  if (!trade.mistakes) trade.mistakes = []
  trade.date = trade.date || (trade.openedAt ? String(trade.openedAt).slice(0, 10) : '')
  trade.entryTime = trade.openedAt
  trade.exitTime = trade.closedAt
  trade.entryPrice = trade.entry
  trade.exitPrice = trade.exit
  trade.outcome = trade.outcome ?? trade.result
  const calculatedPnl = calculateTradePnl(trade)
  const calculatedResult = calculatedPnl > 0 ? 'Win' : calculatedPnl < 0 ? 'Loss' : 'Breakeven'
  if (trade.resultOverride === undefined && trade.result && trade.result !== calculatedResult) trade.resultOverride = trade.result
  trade.status = trade.status || 'Closed'
  return trade
}

export function tradeToRow(trade) {
  const normalized = { ...trade }
  if (normalized.openedAt === undefined && normalized.entryTime !== undefined) normalized.openedAt = normalized.entryTime
  if (normalized.closedAt === undefined && normalized.exitTime !== undefined) normalized.closedAt = normalized.exitTime
  if (normalized.entry === undefined && normalized.entryPrice !== undefined) normalized.entry = normalized.entryPrice
  if (normalized.exit === undefined && normalized.exitPrice !== undefined) normalized.exit = normalized.exitPrice
  const row = toRow(normalized, tradeFields, 'trades')
  row.tags = Array.isArray(normalized.tags) ? normalized.tags.filter((tag) => typeof tag === 'string') : []
  row.result = normalized.result ?? normalized.outcome
  row.extra = {}
  for (const field of tradeExtraFields) {
    if (normalized[field] === undefined) continue
    let value = normalized[field]
    if (tradeExtraNumericFields.has(field) && value !== null && value !== '') {
      const numeric = Number(value)
      if (!Number.isNaN(numeric)) value = numeric
    } else if (field === 'mistakes' && !Array.isArray(value)) value = []
    row.extra[field] = value
  }
  if (['all', 'main', 'funded', ''].includes(row.account_id)) delete row.account_id
  delete row.id
  return row
}

export function journalFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const metadata = row.rules && typeof row.rules === 'object' && !Array.isArray(row.rules) ? row.rules : {}
  const rules = Array.isArray(row.rules) ? row.rules : Array.isArray(metadata.rules) ? metadata.rules : []
  return {
    ...metadata,
    date: row.entry_date,
    mood: row.mood,
    plan: row.pre_market ?? metadata.plan ?? '',
    review: row.post_trade ?? metadata.review ?? '',
    rules,
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    bias: metadata.bias || '',
    levels: metadata.levels || '',
    news: metadata.news || '',
    maxRisk: metadata.maxRisk ?? '',
    maxTrades: metadata.maxTrades ?? '',
    lesson: metadata.lesson || '',
    rating: Number(metadata.rating) || 0,
    energy: Number(metadata.energy) || 3,
    sleep: metadata.sleep ?? '',
    followedPlan: Boolean(metadata.followedPlan),
    mistakes: Array.isArray(metadata.mistakes) ? metadata.mistakes : [],
    images: Array.isArray(metadata.images) ? metadata.images : [],
  }
}

export function journalToRow(entry) {
  const { date, entry_date: ignoredEntryDate, mood, plan, preMarket, review, ...extra } = entry || {}
  void ignoredEntryDate
  const rules = {
    ...extra,
    rules: Array.isArray(entry?.rules) ? entry.rules : [],
    tags: Array.isArray(entry?.tags) ? entry.tags : [],
    bias: entry?.bias || '',
    levels: entry?.levels || '',
    news: entry?.news || '',
    maxRisk: entry?.maxRisk ?? '',
    maxTrades: entry?.maxTrades ?? '',
    lesson: entry?.lesson || '',
    rating: Number(entry?.rating) || 0,
    energy: Number(entry?.energy) || 3,
    sleep: entry?.sleep ?? '',
    followedPlan: Boolean(entry?.followedPlan),
    mistakes: Array.isArray(entry?.mistakes) ? entry.mistakes : [],
    images: Array.isArray(entry?.images) ? entry.images : [],
  }
  return { entry_date: date, mood: mood || '', pre_market: preMarket ?? plan ?? '', post_trade: review || '', rules }
}

export function noteFromRow(row) {
  const note = fromRow(row, noteFields, 'notes')
  if (note) note.date = note.updatedAt || ''
  return note
}

export function noteToRow(note) {
  const row = toRow(note, noteFields, 'notes')
  delete row.id
  if (!row.updated_at) row.updated_at = new Date().toISOString()
  return row
}

export function playbookFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const checklist = row.checklist && typeof row.checklist === 'object' && !Array.isArray(row.checklist) ? row.checklist : {}
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    entry: Array.isArray(row.entry_rules) ? row.entry_rules : [],
    exit: Array.isArray(row.exit_rules) ? row.exit_rules : [],
    short: checklist.short || '',
    color: checklist.color || 'purple',
    trades: Number(checklist.trades) || 0,
    winRate: Number(checklist.winRate) || 0,
    profitFactor: Number(checklist.profitFactor) || 0,
    checklist,
  }
}

export function playbookToRow(playbook) {
  const { id: ignoredId, name, description, entry, exit, ...metadata } = playbook || {}
  void ignoredId
  const { checklist = {}, ...extras } = metadata
  return {
    name,
    description: description || '',
    entry_rules: Array.isArray(entry) ? entry : [],
    exit_rules: Array.isArray(exit) ? exit : [],
    checklist: { ...checklist, ...extras },
  }
}

export function accountFromRow(row) {
  const account = fromRow(row, accountFields, 'accounts')
  return account ? { ...account, balance: 0 } : null
}

export function accountToRow(account) {
  const row = toRow(account, accountFields, 'accounts')
  if (!row.currency) row.currency = 'USD'
  delete row.id
  return row
}

async function runQuery(buildQuery, mapData = (data) => data) {
  try {
    const { data, error } = await buildQuery()
    if (error) return { data: null, error: normalizeSupabaseError(error) }
    return { data: mapData(data), error: null }
  } catch (error) {
    return { data: null, error: normalizeSupabaseError(error) }
  }
}

async function insertOne(table, value, toRow, fromRowMapper) {
  return runQuery(() => supabase.from(table).insert(toRow(value)).select('*').single(), fromRowMapper)
}

async function deleteOne(table, id) {
  return runQuery(() => supabase.from(table).delete().eq('id', id).select('id'), (rows) => ({ count: rows?.length || 0 }))
}

export async function listTrades() {
  try {
    const trades = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('entry_time', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) return { data: null, error: normalizeSupabaseError(error) }
      trades.push(...(data || []).map(tradeFromRow))
      if (!data || data.length < PAGE_SIZE) break
    }
    return { data: trades, error: null }
  } catch (error) {
    return { data: null, error: normalizeSupabaseError(error) }
  }
}

export async function createTrade(trade) {
  return insertOne('trades', trade, tradeToRow, tradeFromRow)
}

export async function updateTrade(id, patch) {
  const row = tradeToRow(patch)
  delete row.id
  return runQuery(() => supabase.from('trades').update(row).eq('id', id).select('*').single(), tradeFromRow)
}

export async function deleteTrade(id) {
  return deleteOne('trades', id)
}

export async function insertTradesBulk(trades) {
  const failedChunks = []
  let insertedCount = 0
  const insertedTrades = []
  const items = Array.isArray(trades) ? trades : []
  for (let offset = 0; offset < items.length; offset += BULK_SIZE) {
    const chunk = items.slice(offset, offset + BULK_SIZE)
    try {
      const { data, error } = await supabase.from('trades').insert(chunk.map(tradeToRow)).select('*')
      if (error) failedChunks.push({ chunk: Math.floor(offset / BULK_SIZE), startIndex: offset, count: chunk.length, error: normalizeSupabaseError(error) })
      else {
        insertedCount += data?.length ?? chunk.length
        ;(data || []).forEach((row, index) => insertedTrades.push({ index: offset + index, trade: tradeFromRow(row) }))
      }
    } catch (error) {
      failedChunks.push({ chunk: Math.floor(offset / BULK_SIZE), startIndex: offset, count: chunk.length, error: normalizeSupabaseError(error) })
    }
  }
  return { data: { insertedCount, failedChunks, insertedTrades }, error: failedChunks.length ? failedChunks[0].error : null }
}

export async function deleteTradesByBatch(importBatchId) {
  return runQuery(() => supabase.from('trades').delete().eq('import_batch_id', importBatchId).select('id'), (rows) => ({ count: rows?.length || 0 }))
}

export async function deleteDemoTrades() {
  return runQuery(() => supabase.from('trades').delete().eq('is_demo', true).select('id'), (rows) => ({ count: rows?.length || 0 }))
}

export async function deleteAllTrades() {
  return runQuery(() => supabase.from('trades').delete().not('id', 'is', null).select('id'), (rows) => ({ count: rows?.length || 0 }))
}

export async function deleteAllUserRows(userId) {
  if (!userId) return { data: null, error: new Error('A signed-in user is required.') }
  const tables = ['trades', 'journal_entries', 'notes', 'playbooks', 'accounts', 'profiles']
  const deleted = {}
  for (const table of tables) {
    const result = await runQuery(
      () => supabase.from(table).delete().eq('user_id', userId).select('user_id'),
      (rows) => rows?.length || 0,
    )
    if (result.error) return { data: { deleted, failedTable: table }, error: result.error }
    deleted[table] = result.data
  }
  return { data: { deleted }, error: null }
}

export async function listJournalEntries() {
  return runQuery(() => supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }), (rows) => (rows || []).map(journalFromRow))
}

export async function upsertJournalEntry(entry) {
  const row = journalToRow(entry)
  return runQuery(() => supabase.from('journal_entries').upsert(row, { onConflict: 'user_id,entry_date' }).select('*').single(), journalFromRow)
}

export async function deleteJournalEntry(entryDate) {
  return runQuery(() => supabase.from('journal_entries').delete().eq('entry_date', entryDate).select('entry_date'), (rows) => ({ count: rows?.length || 0 }))
}

export async function listNotes() {
  return runQuery(() => supabase.from('notes').select('*').order('updated_at', { ascending: false }), (rows) => (rows || []).map(noteFromRow))
}

export async function createNote(note) {
  return insertOne('notes', note, noteToRow, noteFromRow)
}

export async function updateNote(id, patch) {
  const row = noteToRow(patch)
  delete row.id
  return runQuery(() => supabase.from('notes').update(row).eq('id', id).select('*').single(), noteFromRow)
}

export async function deleteNote(id) {
  return deleteOne('notes', id)
}

export async function listPlaybooks() {
  return runQuery(() => supabase.from('playbooks').select('*').order('name', { ascending: true }), (rows) => (rows || []).map(playbookFromRow))
}

export async function createPlaybook(playbook) {
  return insertOne('playbooks', playbook, playbookToRow, playbookFromRow)
}

export async function updatePlaybook(id, patch) {
  const row = playbookToRow(patch)
  delete row.id
  return runQuery(() => supabase.from('playbooks').update(row).eq('id', id).select('*').single(), playbookFromRow)
}

export async function deletePlaybook(id) {
  return deleteOne('playbooks', id)
}

export async function listAccounts() {
  return runQuery(() => supabase.from('accounts').select('*').order('created_at', { ascending: false }), (rows) => (rows || []).map(accountFromRow))
}

export async function createAccount(account) {
  return insertOne('accounts', account, accountToRow, accountFromRow)
}

export async function updateAccount(id, patch) {
  const row = accountToRow(patch)
  delete row.id
  return runQuery(() => supabase.from('accounts').update(row).eq('id', id).select('*').single(), accountFromRow)
}

export async function deleteAccount(id) {
  return deleteOne('accounts', id)
}

export async function getProfileSettings(userId) {
  if (!userId) return { data: null, error: new Error('A user id is required to load settings.') }
  return runQuery(() => supabase.from('profiles').select('settings,display_name').eq('user_id', userId).maybeSingle(), (profile) => ({
    ...(profile?.settings || {}),
    profile: { ...(profile?.settings?.profile || {}), name: profile?.display_name || profile?.settings?.profile?.name || '' },
  }))
}

export async function updateProfileSettings(userId, settings) {
  if (!userId) return { data: null, error: new Error('A user id is required to save settings.') }
  return runQuery(() => supabase.from('profiles').update({ settings }).eq('user_id', userId).select('settings').single(), (profile) => profile?.settings || {})
}

export async function updateProfileDisplayName(userId, displayName) {
  if (!userId) return { data: null, error: new Error('A user id is required to update the profile.') }
  return runQuery(() => supabase.from('profiles').update({ display_name: displayName }).eq('user_id', userId).select('display_name').single(), (profile) => ({ name: profile?.display_name || '' }))
}
