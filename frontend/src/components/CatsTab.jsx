import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import CatAvatar from './CatAvatar'

function WeightChart({ logs }) {
  if (logs.length < 2) return null
  const W = 300, H = 84, pad = 12
  const weights = logs.map(l => parseFloat(l.weight_kg))
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 0.1
  const pts = weights.map((w, i) => [
    pad + (i / (weights.length - 1)) * (W - pad * 2),
    H - pad - ((w - minW) / range) * (H - pad * 2 - 18),
  ])
  const points = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: H, display: 'block', marginBottom: 10 }}
    >
      <polyline
        points={points}
        style={{ fill: 'none', stroke: '#DD8C96', strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }}
      />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x} cy={y}
          r={i === pts.length - 1 ? 5 : 3.5}
          style={{ fill: i === pts.length - 1 ? '#C86E7A' : '#DD8C96' }}
        />
      ))}
      <text
        x={lx} y={ly - 10}
        style={{ fontSize: 11, fill: '#2E4060', fontFamily: 'Kanit,sans-serif', fontWeight: 600 }}
        textAnchor="middle"
      >
        {weights[weights.length - 1]} kg
      </text>
    </svg>
  )
}

function WeightSection({ catId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [newWeight, setNewWeight] = useState('')
  const [error, setError] = useState(null)

  const loadWeights = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api(`/api/cats/${catId}/weight`)
      setLogs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [catId])

  useEffect(() => { loadWeights() }, [loadWeights])

  async function saveWeight() {
    const val = parseFloat(newWeight)
    if (!newWeight || isNaN(val) || val <= 0) return
    try {
      await api(`/api/cats/${catId}/weight`, {
        method: 'POST',
        body: JSON.stringify({ weight_kg: val }),
      })
      setNewWeight('')
      loadWeights()
    } catch (err) {
      setError(err.message)
    }
  }

  const latest = logs.length > 0 ? logs[logs.length - 1] : null

  return (
    <>
      <div className="section-label">น้ำหนัก</div>
      {error && (
        <div className="error-msg" style={{ fontSize: 12, padding: '8px 12px' }}>{error}</div>
      )}
      {!loading && latest && (
        <div style={{ fontSize: 13, color: 'var(--rhino-dim)', marginBottom: 8 }}>
          ล่าสุด:{' '}
          <strong style={{ color: 'var(--rhino)' }}>
            {parseFloat(latest.weight_kg)} kg
          </strong>
        </div>
      )}
      <WeightChart logs={logs} />
      <div className="weight-form-row">
        <input
          type="number"
          value={newWeight}
          onChange={e => setNewWeight(e.target.value)}
          placeholder="น้ำหนัก (kg)"
          step="0.1"
          min="0"
        />
        <button className="accent" onClick={saveWeight}>บันทึก</button>
      </div>
    </>
  )
}

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
      {/* Avatar + name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <CatAvatar name={cat.name} size={42} />
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--rhino)' }}>{cat.name}</div>
      </div>

      {/* Routines */}
      {loading ? (
        <div className="sub">กำลังโหลด...</div>
      ) : error ? (
        <div className="error-msg">{error}</div>
      ) : routines.length === 0 ? (
        <div className="empty">ยังไม่มีกิจวัตร</div>
      ) : (
        routines.map(r => (
          <div className="routine-row" key={r.id}>
            <span style={{ fontSize: 14 }}>{r.title}</span>
            <span style={{ fontSize: 12, color: 'var(--rhino-dim)', whiteSpace: 'nowrap' }}>
              ทุก {r.frequency_days} วัน
            </span>
          </div>
        ))
      )}

      {/* Add routine form */}
      <div style={{ marginTop: 10 }}>
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="ชื่อกิจวัตร เช่น เช็ดตา"
        />
        <select value={newFreq} onChange={e => setNewFreq(e.target.value)}>
          <option value="1">ทุกวัน</option>
          <option value="7">ทุกสัปดาห์</option>
          <option value="30">ทุกเดือน</option>
        </select>
        <button className="ghost" onClick={addRoutine}>เพิ่มกิจวัตร</button>
      </div>

      {/* Weight section */}
      <WeightSection catId={cat.id} />
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
        <div className="empty-state">
          <div className="empty-icon">🐱</div>
          <div className="empty-title">ยังไม่มีแมว</div>
          <div className="empty-sub">เพิ่มแมวตัวแรกกันเลย!</div>
        </div>
      )}
      {cats.map(cat => <CatCard key={cat.id} cat={cat} />)}
      <div className="card">
        <h2>เพิ่มแมวตัวใหม่</h2>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="ชื่อแมว"
        />
        <button className="primary" onClick={addCat}>เพิ่มแมว</button>
      </div>
    </>
  )
}
