import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import CatAvatar from './CatAvatar'

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

  return (
    <>
      <h1>วันนี้ต้องทำ</h1>
      {error && <div className="error-msg">โหลดไม่ได้: {error}</div>}

      {!error && items.length === 0 && (
        <div className="empty-state">
          <CheckCircle2 size={64} strokeWidth={1.2} color="var(--dull-pink)" />
          <div className="empty-title">เยี่ยมมาก!</div>
          <div className="empty-sub">วันนี้ไม่มีอะไรต้องทำแล้ว</div>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="sub">{items.length} รายการ</div>
          <div className="card">
            {items.map((it) => (
              <div
                key={it.id}
                className={`routine-row${completing.has(it.id) ? ' completing' : ''}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <CatAvatar name={it.cat_name} size={30} />
                  <span style={{ minWidth: 0 }}>
                    <span className="cat-name">{it.cat_name}</span>
                    <span style={{ color: 'var(--rhino-dim)', fontSize: 13 }}> — {it.title}</span>
                  </span>
                </span>
                <button className="done" onClick={() => complete(it.id)}>ทำแล้ว</button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
