import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, ChevronDown, Command, Menu, Moon, Plus, Search, Sun, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { accounts } from '../data/mockData'
import { useAuth } from '../context/AuthContext'
import { useJournal } from '../hooks/useJournal'
import DateRangePicker from './DateRangePicker'
import TradeDrawer from './TradeDrawer'
import { currency } from '../utils/trading'

const titles = { '/': ['', "Here's how your trading is looking today."], '/journal': ['Daily journal', 'Reflect on your sessions and build better habits.'], '/trades': ['Trade log', 'Review every trade, detail by detail.'], '/import': ['Import trades', 'Bring your broker history into your journal.'], '/reports': ['Reports', 'Understand your edge with a deeper performance breakdown.'], '/weekly-review': ['Weekly review', 'Review your performance, discipline, and lessons week by week.'], '/notebook': ['Notebook', 'Keep your trading ideas and learnings in one place.'], '/playbooks': ['Playbooks', 'Your best setups, documented and ready to repeat.'], '/backtesting': ['Backtesting', 'Test your strategies with historical setups.'], '/settings': ['Settings', 'Manage your workspace and preferences.'] }

export default function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [accountOpen, setAccountOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedTrade, setSelectedTrade] = useState(null)
  const searchInput = useRef(null)
  const { range, setRange, customStart, setCustomStart, customEnd, setCustomEnd, dark, setThemeChoice, account, setAccount, setSidebarOpen, setAddTradeOpen, setEditingTrade, saveStatus, trades, notes, playbooks, settings, accountTrades, deleteTrade, updateTrade, toast } = useJournal()
  const { profile, user } = useAuth()
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Trader'
  const title = titles[location.pathname] || titles['/']
  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening'
  const searchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    const pages = [
      ['Dashboard', '/', 'Overview and goals'],
      ['Daily Journal', '/journal', 'Daily reflections'],
      ['Trade Log', '/trades', 'Search and review trades'],
      ['Reports', '/reports', 'Performance reports'],
      ['Weekly review', '/weekly-review', 'Weekly performance and reflections'],
      ['Notebook', '/notebook', 'Notes and ideas'],
      ['Playbooks', '/playbooks', 'Trading playbooks'],
      ['Backtesting', '/backtesting', 'Backtesting workspace'],
      ['Settings', '/settings', 'Workspace settings'],
    ].map(([label, route, detail]) => ({ kind: 'Page', label, route, detail }))
    const tradeResults = trades.map((trade) => ({ kind: 'Trade', label: `${trade.symbol} · ${trade.side}`, detail: `${trade.date} · ${currency(trade.pnl)} · ${trade.notes || ''}`, trade }))
    const noteResults = (notes || []).map((note) => ({ kind: 'Note', label: note.title || 'Untitled note', detail: note.body || note.content || 'Notebook note', route: '/notebook' }))
    const playbookResults = (playbooks || []).map((book) => ({ kind: 'Playbook', label: book.name || book.title || 'Untitled playbook', detail: book.description || book.setup || 'Trading playbook', route: '/playbooks' }))
    return [...pages, ...tradeResults, ...noteResults, ...playbookResults]
      .filter((item) => !query || `${item.kind} ${item.label} ${item.detail}`.toLowerCase().includes(query))
      .slice(0, 12)
  }, [searchText, trades, notes, playbooks])
  const notifications = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todaysTrades = accountTrades.filter((trade) => trade.date === today)
    const todayPnl = todaysTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0)
    return [
      ...(todayPnl < -(settings?.dailyLossLimit || 0) ? [{ title: 'Daily loss limit reached', text: `Today’s net P&L is ${currency(todayPnl)}.`, route: '/' }] : []),
      ...(!todaysTrades.length ? [{ title: 'Journal reminder', text: 'Add today’s session notes when you are ready.', route: '/journal' }] : []),
      ...(saveStatus === 'error' ? [{ title: 'Local save issue', text: 'Your latest changes may not have been saved.', route: '/settings' }] : []),
      ...(toast && /import/i.test(toast) ? [{ title: 'Import update', text: toast, route: '/import' }] : []),
    ]
  }, [accountTrades, settings, saveStatus, toast])

  useEffect(() => {
    const openSearch = () => setSearchOpen(true)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setNotificationOpen(false)
      }
    }
    window.addEventListener('tradejournal:open-search', openSearch)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('tradejournal:open-search', openSearch)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (searchOpen) window.requestAnimationFrame(() => searchInput.current?.focus())
    else setSearchText('')
  }, [searchOpen])

  const chooseResult = (item) => {
    setSearchOpen(false)
    if (item.trade) setSelectedTrade(item.trade)
    else if (item.route) navigate(item.route)
  }
  return (
    <header className={`topbar${['/journal', '/notebook'].includes(location.pathname) ? ' page-title-scale' : ''}`}>
      <div className="topbar-heading">
        <button className="icon-button menu-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div><h1>{location.pathname === '/' ? `${greeting}, ${displayName}` : title[0]}</h1><p>{title[1]}</p></div>
      </div>
      <div className="topbar-actions">
        {saveStatus && <span className={`save-indicator save-indicator-${saveStatus}`} role="status">{saveStatus === 'saved' ? <><Check size={13} />Saved</> : saveStatus === 'saving' ? 'Saving…' : 'Not saved'}</span>}
        <DateRangePicker value={range} onChange={setRange} start={customStart} onStartChange={setCustomStart} end={customEnd} onEndChange={setCustomEnd} />
        <div className="account-wrap">
          <button className="account-select" onClick={() => setAccountOpen((open) => !open)}><span className="account-dot" /><span>{account === 'all' ? 'All accounts' : accounts.find((item) => item.id === account)?.name}</span><ChevronDown size={14} /></button>
          {accountOpen && <div className="account-menu"><button onClick={() => { setAccount('all'); setAccountOpen(false) }}><span className="account-dot" />All accounts<small>Combined</small></button>{accounts.map((item) => <button key={item.id} onClick={() => { setAccount(item.id); setAccountOpen(false) }}><span className="account-dot" />{item.name}<small>{item.broker}</small></button>)}</div>}
        </div>
        <div className="notification-wrap">
          <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationOpen} onClick={() => setNotificationOpen((open) => !open)}><Bell size={18} />{notifications.length > 0 && <i />}</button>
          {notificationOpen && <div className="notification-menu" role="menu" aria-label="Notifications">
            <div className="notification-menu-head"><strong>Notifications</strong><span>Local</span></div>
            {notifications.length ? notifications.map((notification, index) => <button key={index} role="menuitem" onClick={() => { setNotificationOpen(false); navigate(notification.route) }}><strong>{notification.title}</strong><small>{notification.text}</small></button>) : <p className="notification-empty">You’re all caught up.</p>}
          </div>}
        </div>
        <button className="icon-button search-button" aria-label="Search TradeJournal" title="Search (Ctrl+K)" onClick={() => setSearchOpen(true)}><Search size={18} /></button>
        <button className="icon-button theme-button" aria-label="Toggle theme" onClick={() => setThemeChoice(dark ? 'light' : 'dark')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button className="button-primary add-trade-button" onClick={() => { setEditingTrade(null); setAddTradeOpen(true) }}><Plus size={17} /><span>Add trade</span></button>
      </div>
      {searchOpen && <div className="command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false) }}>
        <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search TradeJournal">
          <div className="command-search-box"><Search size={18} /><input ref={searchInput} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search pages, trades, notes, playbooks…" aria-label="Search pages and journal data" /><kbd>ESC</kbd><button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={17} /></button></div>
          <div className="command-results">
            <p>{searchText ? 'Search results · local data' : 'Quick navigation'}</p>
            {searchResults.map((item, index) => <button type="button" className="command-result" key={`${item.kind}-${item.label}-${index}`} onClick={() => chooseResult(item)}><span className="command-result-icon">{item.kind === 'Page' ? <Command size={15} /> : <Search size={15} />}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><em>{item.kind}</em></button>)}
            {!searchResults.length && <div className="command-no-results">No local results found.</div>}
          </div>
          <footer>Searches this browser’s local journal data</footer>
        </section>
      </div>}
      <TradeDrawer trade={selectedTrade} onClose={() => setSelectedTrade(null)} onUpdate={updateTrade} onEdit={() => { setEditingTrade(selectedTrade); setSelectedTrade(null); setAddTradeOpen(true) }} onDelete={() => {
        if (window.confirm(`Delete the ${selectedTrade.symbol} trade from ${selectedTrade.date}? This cannot be undone.`)) {
          window.dispatchEvent(new CustomEvent('tradejournal:trade-deleted', { detail: { trade: selectedTrade } }))
          deleteTrade(selectedTrade.id)
          setSelectedTrade(null)
        }
      }} />
    </header>
  )
}
