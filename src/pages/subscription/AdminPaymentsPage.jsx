import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, ExternalLink, RefreshCw, ArrowLeft, ShieldAlert, Eye, Image } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import './subscription.css'

export default function AdminPaymentsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [previewProof, setPreviewProof] = useState(null) // { url, title }

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setError('')

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) throw new Error('You must be signed in to access this page.')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-payment-action`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load payment requests.')
      }

      setRequests(data.requests || [])
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Could not fetch requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleAction = async (requestId, action) => {
    let rejectionReason = ''
    if (action === 'reject') {
      const reason = window.prompt('Enter reason for rejection (optional):', 'Transaction reference could not be verified')
      if (reason === null) return // user cancelled
      rejectionReason = reason
    } else {
      if (!window.confirm('Approve this payment and activate the user subscription?')) return
    }

    try {
      setActionLoading(requestId)
      setError('')
      setSuccessMsg('')

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-payment-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId,
          action,
          notes: rejectionReason || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Could not ${action} request.`)
      }

      setSuccessMsg(data.message || `Request ${action}d successfully.`)
      await fetchRequests()
    } catch (err) {
      console.error('Action error:', err)
      setError(err instanceof Error ? err.message : `Error during ${action}.`)
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  const getMethodBadgeClass = (method) => {
    switch (method) {
      case 'telebirr':
        return 'telebirr-pill'
      case 'cbe_birr':
        return 'cbe-birr-pill'
      case 'cbe_bank':
        return 'cbe-bank-pill'
      default:
        return 'crypto-pill'
    }
  }

  return (
    <div className="sub-page-shell">
      <div className="sub-container" style={{ maxWidth: '1240px' }}>
        <header className="sub-header">
          <Link to="/" className="sub-brand">
            <ArrowLeft size={18} />
            <span>Back to Dashboard</span>
          </Link>
          <button
            type="button"
            className="sub-currency-btn"
            style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            onClick={fetchRequests}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh List
          </button>
        </header>

        <div className="admin-page-header">
          <div>
            <h1>Payment Verification Queue</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: '14px' }}>
              Admin Account: <code>{user?.email}</code> (User ID: <code>{user?.id}</code>)
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--loss)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(22, 163, 74, 0.12)',
              border: '1px solid rgba(22, 163, 74, 0.3)',
              color: 'var(--profit)',
              marginBottom: '20px',
            }}
          >
            ✓ {successMsg}
          </div>
        )}

        {/* Stats Row */}
        <div className="admin-stats-row">
          <div className="admin-stat-card">
            <span>Pending Verification</span>
            <strong style={{ color: '#d97706' }}>{pendingCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Approved Subscriptions</span>
            <strong style={{ color: '#16a34a' }}>{approvedCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Rejected Submissions</span>
            <strong style={{ color: 'var(--text-3)' }}>{rejectedCount}</strong>
          </div>
        </div>

        {/* Requests Table */}
        <div className="admin-table-card">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
              Loading manual payment requests…
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
              No manual payment submissions found in queue.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User ID</th>
                    <th>Plan & Cycle</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>TX Reference / Slip</th>
                    <th>Payment Proof</th>
                    <th>Notes / Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const proofUrl = req.signed_proof_url || req.screenshot_url
                    return (
                      <tr key={req.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                          {new Date(req.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }} title={req.user_id}>
                          {req.user_id?.slice(0, 8)}…
                        </td>
                        <td>
                          <strong>{req.plan?.toUpperCase()}</strong>{' '}
                          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>({req.period})</span>
                        </td>
                        <td>
                          <strong>
                            {req.amount} {req.currency}
                          </strong>
                        </td>
                        <td>
                          <span
                            style={{
                              textTransform: 'uppercase',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'var(--purple-soft)',
                              color: 'var(--purple)',
                            }}
                          >
                            {req.method?.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all', maxWidth: '200px' }}>
                          <strong>{req.tx_reference}</strong>
                        </td>
                        <td>
                          {proofUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewProof({
                                  url: proofUrl,
                                  title: `Proof from user ${req.user_id?.slice(0, 8)} (${req.method})`,
                                })
                              }
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--line)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                color: 'var(--purple)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              <Eye size={13} /> View Proof
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>No file</span>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-2)', maxWidth: '160px' }}>
                          {req.notes || '—'}
                        </td>
                        <td>
                          <span className={`admin-status-pill ${req.status}`}>{req.status}</span>
                        </td>
                        <td>
                          {req.status === 'pending' ? (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="admin-action-btn approve"
                                onClick={() => handleAction(req.id, 'approve')}
                                disabled={actionLoading === req.id}
                              >
                                <Check size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                Approve
                              </button>
                              <button
                                type="button"
                                className="admin-action-btn reject"
                                onClick={() => handleAction(req.id, 'reject')}
                                disabled={actionLoading === req.id}
                              >
                                <X size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Resolved</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Private Proof Image Modal */}
        {previewProof && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 9999,
              padding: '20px',
            }}
            onClick={() => setPreviewProof(null)}
          >
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                padding: '20px',
                maxWidth: '680px',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-strong)' }}>
                  {previewProof.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewProof(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ textAlign: 'center' }}>
                <img
                  src={previewProof.url}
                  alt="Payment receipt proof"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    borderRadius: '8px',
                    objectFit: 'contain',
                    border: '1px solid var(--line)',
                  }}
                />
              </div>

              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <a
                  href={previewProof.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '13px',
                    color: 'var(--purple)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                  }}
                >
                  Open in New Tab <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
