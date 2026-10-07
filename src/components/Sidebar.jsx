import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, BookOpen, CalendarDays, ChevronLeft, CircleHelp, LayoutDashboard, LogOut, NotebookPen, Settings, SlidersHorizontal, Sparkles, Swords, X } from 'lucide-react'
import { useJournal } from '../hooks/useJournal'
import { useAuth } from '../context/AuthContext'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/journal', label: 'Daily Journal', icon: CalendarDays },
  { to: '/trades', label: 'Trade Log', icon: Activity },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/notebook', label: 'Notebook', icon: NotebookPen },
  { to: '/playbooks', label: 'Playbooks', icon: BookOpen },
  { to: '/backtesting', label: 'Backtesting', icon: Swords },
]

export default function Sidebar({ collapsed, onCollapse }) {
  const { sidebarOpen, setSidebarOpen } = useJournal()
  const { signOut, profile, user } = useAuth()
  const navigate = useNavigate()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Trader'
  const initials = displayName.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  async function handleSignOut() {
    const { error } = await signOut()
    if (error) return
    setProfileMenuOpen(false)
    navigate('/welcome', { replace: true })
  }

  return (
    <>
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${sidebarOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="brand-row">
          <img className="brand-mark" src="/bear-logo.png" alt="TradeJournal" />
          {!collapsed && <span className="brand-name">Trade<span>Journal</span></span>}
          <button className="icon-button collapse-button" onClick={onCollapse} aria-label="Collapse sidebar"><ChevronLeft size={17} /></button>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        {!collapsed && <div className="workspace-label">WORKSPACE</div>}
        <nav className="side-nav">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!collapsed && <div className="sidebar-divider" />}
          <NavLink to="/settings" title={collapsed ? 'Settings' : undefined} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings size={18} /><span>Settings</span></NavLink>
          {!collapsed && <div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16} /></div><strong>Journal AI coming soon</strong><p>Personalized insights for your trading journal.</p><button>Coming soon</button></div>}
          {!collapsed && <button className="help-link"><CircleHelp size={15} /> Help center</button>}
          <div className="sidebar-profile-wrap">
            <button className="profile-button" type="button" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}>
              <div className="avatar">{initials || 'TJ'}</div>
              {!collapsed && <span className="profile-copy"><strong>{displayName}</strong><small>TradeJournal</small></span>}
              {!collapsed && <SlidersHorizontal className="profile-more" size={16} />}
            </button>
            {profileMenuOpen && (
              <div className="sidebar-profile-menu" role="menu">
                <button type="button" role="menuitem" onClick={handleSignOut}><LogOut size={15} /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
