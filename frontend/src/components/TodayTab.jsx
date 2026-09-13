import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

export default function TodayTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api('/api/today')
      setItems(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function complete(id) {
    try {
      await api(`/api/routines/${id}/complete`, { method: 'POST' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="sub">กำลังโหลด...</div>

  return (
    <>
      <h1>วันนี้ต้องทำ</h1>
      {error && <div className="error-msg">โหลดไม่ได้: {error}</div>}
      {!error && items.length === 0 && (
        <div className="empty">วันนี้ไม่มีอะไรต้องทำแล้ว 🎉</div>
      )}
      {items.length > 0 && (
        <>
          <div className="sub">{items.length} รายการ</div>
          <div className="card">
            {items.map((it) => (
              <div className="routine-row" key={it.id}>
                <span>
                  <span className="cat-name">{it.cat_name}</span> — {it.title}
                </span>
                <button className="done" onClick={() => complete(it.id)}>
                  ทำแล้ว
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
