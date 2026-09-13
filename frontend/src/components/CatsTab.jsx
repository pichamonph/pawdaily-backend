import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

function CatCard({ cat }) {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [newFreq, setNewFreq] = useState('1')

  const loadRoutines = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api(`/api/cats/${cat.id}/routines`)
      setRoutines(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [cat.id])

  useEffect(() => { loadRoutines() }, [loadRoutines])

  async function addRoutine() {
    if (!newTitle.trim()) return
    try {
      await api(`/api/cats/${cat.id}/routines`, {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), frequency_days: parseInt(newFreq, 10) }),
      })
      setNewTitle('')
      loadRoutines()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card">
      <h2>{cat.name}</h2>
      {loading ? (
        <div className="sub">กำลังโหลดกิจวัตร...</div>
      ) : error ? (
        <div className="error-msg">{error}</div>
      ) : routines.length === 0 ? (
        <div className="sub">ยังไม่มีกิจวัตร</div>
      ) : (
        routines.map((r) => (
          <div className="routine-row" key={r.id}>
            <span>{r.title}</span>
            <span className="sub">ทุก {r.frequency_days} วัน</span>
          </div>
        ))
      )}
      <div style={{ marginTop: 10 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="ชื่อกิจวัตร เช่น เช็ดตา"
        />
        <select value={newFreq} onChange={(e) => setNewFreq(e.target.value)}>
          <option value="1">ทุกวัน</option>
          <option value="7">ทุกสัปดาห์</option>
          <option value="30">ทุกเดือน</option>
        </select>
        <button className="ghost" onClick={addRoutine}>
          เพิ่มกิจวัตร
        </button>
      </div>
    </div>
  )
}

export default function CatsTab() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')

  const loadCats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api('/api/cats')
      setCats(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCats() }, [loadCats])

  async function addCat() {
    if (!newName.trim()) return
    try {
      await api('/api/cats', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      })
      setNewName('')
      loadCats()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="sub">กำลังโหลด...</div>

  return (
    <>
      <h1>แมวของฉัน</h1>
      {error && <div className="error-msg">{error}</div>}
      {!error && cats.length === 0 && (
        <div className="empty">ยังไม่มีแมว เพิ่มตัวแรกกันเลย</div>
      )}
      {cats.map((cat) => (
        <CatCard key={cat.id} cat={cat} />
      ))}
      <div className="card">
        <h2>เพิ่มแมวตัวใหม่</h2>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ชื่อแมว"
        />
        <button className="primary" onClick={addCat}>
          เพิ่มแมว
        </button>
      </div>
    </>
  )
}
