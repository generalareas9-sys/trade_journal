import { useMemo, useState } from 'react'
import { FileText, FolderClosed, Plus, Search } from 'lucide-react'
import { notebookFolders } from '../data/mockData'
import { useJournal } from '../hooks/useJournal'
import { EmptyState } from '../components/UiElements'

export default function Notebook() {
  const [folder, setFolder] = useState('All notes')
  const { notes, setNotes } = useJournal()
  const [selected, setSelected] = useState(() => notes[0]?.title || '')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => notes.filter((note) => (folder === 'All notes' || note.folder === folder) && note.title.toLowerCase().includes(query.toLowerCase())), [notes, folder, query])
  const active = notes.find((note) => note.title === selected) || visible[0]

  const updateBody = (body) => setNotes((items) => items.map((item) => item.title === selected ? { ...item, body } : item))

  const createNote = () => {
    const note = { title: `Untitled note ${notes.length + 1}`, folder: folder === 'All notes' ? 'Trade ideas' : folder, date: 'Just now', body: '' }
    setNotes((items) => [note, ...items])
    setFolder(note.folder)
    setSelected(note.title)
  }

  return <div className="page-content notebook-layout">
    <aside className="panel notebook-sidebar"><div className="notebook-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Notebook</h2></div><button className="small-primary" onClick={createNote}><Plus size={15} />New note</button></div>
      <label className="table-search notebook-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes..." /></label>
      <div className="folder-list">{notebookFolders.map((item) => <button key={item} className={folder === item ? 'folder-selected' : ''} onClick={() => setFolder(item)}><FolderClosed size={16} />{item}<span>{item === 'All notes' ? notes.length : notes.filter((note) => note.folder === item).length}</span></button>)}</div>
      <div className="note-list">{visible.map((note) => <button key={`${note.title}-${note.date}`} onClick={() => setSelected(note.title)} className={`note-list-item ${active?.title === note.title ? 'note-selected' : ''}`}><FileText size={15} /><span><strong>{note.title}</strong><small>{note.date} · {note.folder}</small></span></button>)}</div>
    </aside>
    <section className="panel note-editor">{active ? <><div className="note-editor-top"><span className="tag-chip">{active.folder}</span><span>Edited {active.date}</span><span>Saved</span></div><input className="note-title-input" value={active.title} onChange={(event) => { const title = event.target.value; setNotes((items) => items.map((note) => note.title === active.title ? { ...note, title } : note)); setSelected(title) }} aria-label="Note title" /><textarea className="note-body-input" value={active.body} onChange={(event) => updateBody(event.target.value)} placeholder="Start writing your thoughts..." /><div className="note-editor-footer">Notes are private to your workspace<span>{active.body.length} characters</span></div></> : <EmptyState icon={FileText} title={query ? 'No notes match your search' : 'Your notebook is ready'} description={query ? 'Try another search, or create a new note.' : 'Save trade ideas, reflections, and lessons in one private place.'} action={<button type="button" className="button-primary" onClick={createNote}>{query ? 'Create a note' : 'Create your first note'}</button>} />}</section>
  </div>
}
