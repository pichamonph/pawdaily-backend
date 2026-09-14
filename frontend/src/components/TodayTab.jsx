import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, List, CalendarDays } from 'lucide-react'
import { api } from '../api'
import CatAvatar from './CatAvatar'
import CatAvatarStrip from './CatAvatarStrip'
import CalendarView from './CalendarView'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'สวัสดีตอนเช้า'
  if (h < 17) return 'สวัสดีตอนบ่าย'
  return 'สวัสดีตอนเย็น'
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity
  const last = new Date(dateStr)
  return Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
}

function isOverdue(item) {
  return item.last_done_at && daysSince(item.last_done_at) > item.frequency_days * 2
}

export default function TodayTab() {
  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(new Set())
  const [view, setView] = useState('list')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [todayData, catsData] = await Promise.all([
        api('/api/today'),
        api('/api/cats'),
      ])
      setItems(todayData)
      setCats(catsData)
      setCompleting(new Set())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function complete(id) {
    setCompleting(prev => new Set([...prev, id]))
    setTimeout(async () => {
      try {
        await api(`/api/routines/${id}/complete`, { method: 'POST' })
        load()
      } catch (err) {
        setError(err.message)
        setCompleting(prev => { const s = new Set(prev); s.delete(id); return s })
      }
    }, 350)
  }

  function scrollToCat(catId) {
    document.getElementById(`cat-group-${catId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) return <div className="sub">กำลังโหลด...</div>

  // Group by cat_id
  const grouped = {}
  items.forEach(it => {
    if (!grouped[it.cat_id]) grouped[it.cat_id] = { name: it.cat_name, items: [] }
    grouped[it.cat_id].items.push(it)
  })

  return (
    <>
      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          className={`view-toggle${view === 'list' ? ' active' : ''}`}
          onClick={() => setView('list')}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <List size={14} /> รายการ
        </button>
        <button
          className={`view-toggle${view === 'calendar' ? ' active' : ''}`}
          onClick={() => setView('calendar')}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <CalendarDays size={14} /> ปฏิทิน
        </button>
      </div>

      {view === 'calendar' ? (
        <div className="card">
          <CalendarView />
        </div>
      ) : (
        <>
          {/* Avatar strip (only when > 1 cat) */}
          {cats.length > 1 && (
            <CatAvatarStrip cats={cats} onSelect={scrollToCat} />
          )}

          <div className="greeting-card">
            <div className="greeting-text">{greeting()}</div>
            <div className="greeting-sub">
              {items.length > 0
                ? `มี ${items.length} รายการที่ต้องดูแลวันนี้`
                : 'วันนี้ดูแลครบแล้ว!'}
            </div>
          </div>

          {error && <div className="error-msg">โหลดไม่ได้: {error}</div>}

          {!error && items.length === 0 && (
            <div className="empty-state">
              <CheckCircle2 size={64} strokeWidth={1.2} color="var(--dull-pink)" />
              <div className="empty-title">เยี่ยมมาก!</div>
              <div className="empty-sub">วันนี้ไม่มีอะไรต้องทำแล้ว</div>
            </div>
          )}

          {Object.entries(grouped).map(([catId, group]) => (
            <div key={catId} id={`cat-group-${catId}`} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CatAvatar name={group.name} size={24} />
                <span className="cat-name">{group.name}</span>
              </div>
              <div className="card" style={{ padding: 0 }}>
                {group.items.map(it => (
                  <div
                    key={it.id}
                    className={`routine-row${completing.has(it.id) ? ' completing' : ''}`}
                    style={{ padding: '10px 16px' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                      {isOverdue(it) && <span className="overdue-badge">เลยกำหนด</span>}
                      <span style={{ fontSize: 14 }}>{it.title}</span>
                    </span>
                    <button className="done" onClick={() => complete(it.id)}>ทำแล้ว</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  )
}
