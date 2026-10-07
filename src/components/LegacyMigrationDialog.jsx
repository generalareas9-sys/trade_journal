import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useJournal } from '../hooks/useJournal'
import {
  clearMigrationDeferral,
  deferLocalMigration,
  discardLegacyLocalData,
  downloadLegacyBackup,
  getLocalMigrationFlag,
  migrateLocalData,
  scanLegacyLocalData,
  setLocalMigrationFlag,
  wasMigrationDeferred,
} from '../data/migrateLocal'

const migrationTypes = [
  ['trades', 'Trades'],
  ['journal', 'Journal entries'],
  ['notes', 'Notes'],
  ['playbooks', 'Playbooks'],
  ['goals', 'Goals'],
  ['settings', 'Settings'],
]

function summarize(counts) {
  return migrationTypes.filter(([type]) => counts[type] > 0).map(([type, label]) => `${counts[type]} ${label.toLowerCase()}`).join(' · ')
}

export default function LegacyMigrationDialog() {
  const { user } = useAuth()
  const { trades, dataLoading } = useJournal()
  const mountedUserId = useRef('')
  const [snapshot, setSnapshot] = useState(null)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0, message: '' })
  const [summary, setSummary] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user?.id) {
      setSnapshot(null)
      setVisible(false)
      setSummary(null)
      return
    }
    if (mountedUserId.current !== user.id) {
      clearMigrationDeferral(user.id)
      mountedUserId.current = user.id
      setSummary(null)
      setSnapshot(null)
    }
    if (dataLoading) return
    if (getLocalMigrationFlag(user.id) || trades.length > 0 || wasMigrationDeferred(user.id)) {
      setVisible(false)
      return
    }
    const local = scanLegacyLocalData()
    if (!local.hasData || local.allTradesAreDemo) {
      setVisible(false)
      return
    }
    setSnapshot(local)
    setVisible(true)
  }, [user?.id, dataLoading, trades.length])

  if (!visible || !snapshot || !user?.id) return null

  const discard = () => {
    if (!window.confirm('Discard all detected legacy data from this browser? This cannot be undone after you download a backup.')) return
    const backup = downloadLegacyBackup(snapshot)
    if (backup.error) {
      setMessage(`Could not download a backup: ${backup.error.message || 'Unknown error'}`)
      return
    }
    const cleared = discardLegacyLocalData(snapshot)
    if (cleared.error) {
      setMessage(`Some local data could not be cleared: ${cleared.error.message || 'Unknown error'}`)
      return
    }
    const flag = setLocalMigrationFlag(user.id, 'discarded')
    if (flag.error) setMessage(`Local data was discarded, but this decision could not be saved: ${flag.error.message || 'Unknown error'}`)
    setVisible(false)
  }

  const upload = async () => {
    if (busy) return
    const backup = downloadLegacyBackup(snapshot)
    if (backup.error) {
      setMessage(`Could not download a backup, so migration was not started: ${backup.error.message || 'Unknown error'}`)
      return
    }
    setBusy(true)
    setMessage('')
    setProgress({ completed: 0, total: 0, message: 'Preparing your local data…' })
    const result = await migrateLocalData(snapshot, user.id, setProgress)
    setSummary(result)
    if (result.failed === 0) {
      const flag = setLocalMigrationFlag(user.id, 'migrated')
      if (flag.error) {
        setMessage(`Migration finished, but the per-account decision could not be saved: ${flag.error.message || 'Unknown error'}`)
      }
    }
    setBusy(false)
  }

  const notNow = () => {
    deferLocalMigration(user.id)
    setVisible(false)
  }

  const ratio = progress.total > 0 ? Math.min(100, Math.round(progress.completed / progress.total * 100)) : 0

  return <div className="shortcuts-overlay legacy-migration-overlay" role="presentation">
    <section className="shortcuts-dialog legacy-migration-dialog" role="dialog" aria-modal="true" aria-labelledby="legacy-migration-title">
      {!summary ? <>
        <div><h2 id="legacy-migration-title">Upload your local data to your account</h2></div>
        <p className="legacy-migration-counts">{summarize(snapshot.counts)}</p>
        <div className="legacy-migration-preview">
          <strong>Preview</strong>
          {snapshot.data.trades.slice(0, 3).map((trade, index) => <span key={`trade-${index}`}>{trade.date || trade.entryTime || 'Trade'} · {trade.symbol || 'Unknown symbol'} · {trade.result || trade.outcome || 'Trade'}</span>)}
          {snapshot.data.notes.slice(0, 2).map((note, index) => <span key={`note-${index}`}>Note · {note.title || 'Untitled'}</span>)}
          {snapshot.data.playbooks.slice(0, 1).map((playbook, index) => <span key={`playbook-${index}`}>Playbook · {playbook.name || 'Untitled'}</span>)}
          {snapshot.data.journal && Object.keys(snapshot.data.journal).length > 0 && <span>{Object.keys(snapshot.data.journal).slice(0, 2).join(', ')} · Journal entries</span>}
          {snapshot.counts.goals > 0 && <span>Goals · {snapshot.counts.goals} target(s)</span>}
          {snapshot.counts.settings > 0 && <span>Account and import settings</span>}
          {snapshot.errors.length > 0 && <span role="alert">{snapshot.errors.length} local item(s) could not be read.</span>}
        </div>
        {message && <p className="legacy-migration-message" role="alert">{message}</p>}
        {busy && <div className="legacy-migration-progress" role="status"><span>{progress.message}</span><div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={ratio}><i style={{ width: `${ratio}%` }} /></div></div>}
        <div className="legacy-migration-actions">
          <button type="button" className="button-primary" disabled={busy} onClick={() => void upload()}>Upload</button>
          <button type="button" className="button-secondary" disabled={busy} onClick={notNow}>Not now</button>
          <button type="button" className="legacy-migration-discard" disabled={busy} onClick={discard}>Discard local data</button>
        </div>
      </> : <>
        <div><h2 id="legacy-migration-title">Migration complete</h2></div>
        <p className="legacy-migration-counts">Uploaded {summary.uploaded.trades} trades, {summary.uploaded.journal} journal entries, {summary.uploaded.notes} notes, and {summary.uploaded.playbooks} playbooks.</p>
        <p>{summary.failed ? `${summary.failed} item(s) failed and remain in the local backup.` : 'All detected data was uploaded successfully.'}</p>
        {summary.failures.length > 0 && <details className="legacy-migration-failures"><summary>View failed items</summary>{summary.failures.map((failure, index) => <p key={index}>{failure}</p>)}</details>}
        {message && <p className="legacy-migration-message" role="alert">{message}</p>}
        <div className="legacy-migration-actions"><button type="button" className="button-primary" onClick={() => window.location.reload()}>Done</button><button type="button" className="button-secondary" onClick={() => { downloadLegacyBackup(snapshot); setVisible(false) }}>Download backup</button></div>
      </>}
    </section>
  </div>
}
