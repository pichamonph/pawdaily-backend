import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import CatAvatar from './CatAvatar'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api('/api/today')
      setItems(data)
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

  if (loading) return <div className="sub">กำลังโหลด...</div>

  // Group by cat_id
  const grouped = {}
  items.forEach(it => {
    if (!grouped[it.cat_id]) grouped[it.cat_id] = { name: it.cat_name, items: [] }
    grouped[it.cat_id].items.push(it)
  })

  return (
    <>
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
        <div key={catId} style={{ marginBottom: 16 }}>
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
  )
}
