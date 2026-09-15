import { useState, useEffect, useRef } from 'react'
import {
  Camera, Plus, ListChecks, Scale, Stethoscope, Wallet, ImagePlus,
  Calendar, Pencil, BookOpen, Laugh, Smile, Meh, Frown, ChevronLeft, Trash2,
} from 'lucide-react'
import { api, apiForm } from '../api'
import Modal from './Modal'
import WeightChart from './WeightChart'

// ===== helpers =====
function today() { return new Date().toLocaleDateString('sv') }

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isDueSoon(dateStr) {
  if (!dateStr) return false
  const target = String(dateStr).slice(0, 10)
  const todayStr = new Date().toLocaleDateString('sv')
  const limitStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sv')
  return target >= todayStr && target <= limitStr
}

// ===== Breed config =====
const BREEDS = [
  'ไทย / วิเชียรมาศ', 'เปอร์เซีย', 'สก็อตติชโฟลด์', 'อเมริกันชอร์ตแฮร์',
  'เมนคูน', 'บริติชชอร์ตแฮร์', 'รัสเชียนบลู', 'สยาม', 'สายพันธุ์ผสม / ไม่ทราบ', 'อื่นๆ',
]

function BreedSelect({ value, onChange }) {
  const knownBreed = BREEDS.includes(value)
  const selectVal = knownBreed ? value : (value ? 'อื่นๆ' : '')
  const [customVal, setCustomVal] = useState(!knownBreed ? value : '')
  const showCustom = selectVal === 'อื่นๆ'

  function handleSelect(e) {
    const v = e.target.value
    if (v === 'อื่นๆ') {
      onChange('อื่นๆ')
    } else {
      onChange(v)
    }
  }

  function handleCustom(e) {
    setCustomVal(e.target.value)
    onChange(e.target.value)
  }

  return (
    <>
      <select value={selectVal} onChange={handleSelect}>
        <option value="">-- เลือกสายพันธุ์ --</option>
        {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      {showCustom && (
        <input value={customVal} onChange={handleCustom} placeholder="ระบุสายพันธุ์" />
      )}
    </>
  )
}

// ===== Diary config =====
const MOODS = [
  { id: 'great', Icon: Laugh,  label: 'สุดยอด', color: '#16a34a' },
  { id: 'good',  Icon: Smile,  label: 'ดี',     color: '#65a30d' },
  { id: 'okay',  Icon: Meh,    label: 'ปกติ',   color: '#d97706' },
  { id: 'bad',   Icon: Frown,  label: 'ไม่ดี',  color: '#dc2626' },
]

const MOOD_COLORS = { great: '#16a34a', good: '#65a30d', okay: '#d97706', bad: '#dc2626' }

// ===== Frequency helpers =====
function formatFreq(days) {
  if (days === 1) return 'ทุกวัน'
  if (days % 30 === 0) return days === 30 ? 'ทุกเดือน' : `ทุก ${days / 30} เดือน`
  if (days % 7 === 0) return days === 7 ? 'ทุกสัปดาห์' : `ทุก ${days / 7} สัปดาห์`
  return `ทุก ${days} วัน`
}

function FrequencyInput({ value, onChange }) {
  const toUnit = (d) => d % 30 === 0 && d >= 30 ? 'month' : d % 7 === 0 && d >= 7 ? 'week' : 'day'
  const toNum = (d, u) => u === 'month' ? d / 30 : u === 'week' ? d / 7 : d
  const [unit, setUnit] = useState(() => toUnit(value || 1))
  const [num, setNum] = useState(() => toNum(value || 1, toUnit(value || 1)))

  const toDays = (n, u) => Math.max(1, u === 'month' ? n * 30 : u === 'week' ? n * 7 : n)

  function changeNum(e) {
    const n = Math.max(1, parseInt(e.target.value) || 1)
    setNum(n)
    onChange(toDays(n, unit))
  }
  function changeUnit(e) {
    const u = e.target.value
    setUnit(u)
    onChange(toDays(num, u))
  }

  const preview = `ทุก ${num === 1 && unit === 'day' ? '' : num + ' '}${unit === 'day' ? 'วัน' : unit === 'week' ? 'สัปดาห์' : 'เดือน'}`

  return (
    <div>
      <div className="freq-input-row">
        <input type="number" value={num} onChange={changeNum} min={1} style={{ width: 64 }} />
        <select value={unit} onChange={changeUnit} style={{ flex: 1 }}>
          <option value="day">วัน</option>
          <option value="week">สัปดาห์</option>
          <option value="month">เดือน</option>
        </select>
      </div>
      <div style={{ fontSize: 12, color: 'var(--rhino-dim)', marginTop: 4 }}>{preview}</div>
    </div>
  )
}

// ===== กิจวัตร panel =====
function RoutinesPanel({ catId, version, onAdd }) {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  function load() {
    setLoading(true)
    api(`/api/cats/${catId}/routines`)
      .then(d => { setRoutines(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [catId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete(id) {
    if (!window.confirm('ต้องการลบรายการนี้?')) return
    try {
      await api(`/api/routines/${id}`, { method: 'DELETE' })
      load()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="sub">กำลังโหลด...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <>
      <div className="section-header">
        <span className="section-header-title">กิจวัตร</span>
        <button className="section-add-btn" onClick={onAdd}><Plus size={12} /> เพิ่ม</button>
      </div>
      {routines.length === 0
        ? <div className="empty">ยังไม่มีกิจวัตร</div>
        : routines.map(r => (
          <div className="routine-row" key={r.id}>
            <span style={{ fontSize: 14 }}>{r.title}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--rhino-dim)', whiteSpace: 'nowrap' }}>
                {formatFreq(r.frequency_days)}
              </span>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => setEditing(r)}><Pencil size={13} /></button>
                <button className="icon-btn del" onClick={() => confirmDelete(r.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))
      }
      {editing && (
        <EditRoutineModal
          routine={editing}
          onDone={() => { setEditing(null); load() }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ===== น้ำหนัก panel =====
function WeightPanel({ catId, version, onAdd }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  function load() {
    setLoading(true)
    api(`/api/cats/${catId}/weight`)
      .then(d => { setLogs(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [catId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete(id) {
    if (!window.confirm('ต้องการลบรายการนี้?')) return
    try {
      await api(`/api/weight/${id}`, { method: 'DELETE' })
      load()
    } catch (e) { setError(e.message) }
  }

  const latest = logs.length > 0 ? logs[logs.length - 1] : null

  if (loading) return <div className="sub">กำลังโหลด...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <>
      <div className="section-header">
        <span className="section-header-title">น้ำหนัก</span>
        <button className="section-add-btn" onClick={onAdd}><Plus size={12} /> บันทึก</button>
      </div>
      {latest && (
        <div style={{ fontSize: 13, color: 'var(--rhino-dim)', marginBottom: 8 }}>
          ล่าสุด: <strong style={{ color: 'var(--rhino)' }}>{parseFloat(latest.weight_kg)} kg</strong>
          <span style={{ marginLeft: 6 }}>{fmtDate(latest.recorded_at)}</span>
        </div>
      )}
      <WeightChart logs={logs} />
      {logs.length === 0 && <div className="empty">ยังไม่มีบันทึกน้ำหนัก</div>}
      {logs.length > 0 && (
        <table className="weight-table">
          <thead>
            <tr><th>วันที่</th><th>น้ำหนัก (kg)</th><th></th></tr>
          </thead>
          <tbody>
            {[...logs].reverse().map(l => (
              <tr key={l.id}>
                <td>{fmtDate(l.recorded_at)}</td>
                <td style={{ fontWeight: 600 }}>{parseFloat(l.weight_kg)}</td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => setEditing(l)}><Pencil size={13} /></button>
                    <button className="icon-btn del" onClick={() => confirmDelete(l.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <EditWeightModal
          log={editing}
          onDone={() => { setEditing(null); load() }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ===== สุขภาพ panel =====
const MEDICAL_LABEL = { vaccine: 'วัคซีน', medication: 'ยา', checkup: 'ตรวจ' }
const MEDICAL_COLOR = { vaccine: '#4A5D80', medication: '#DD8C96', checkup: '#2E4060' }

function HealthPanel({ catId, version, onAdd }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  function load() {
    setLoading(true)
    api(`/api/cats/${catId}/medical-events`)
      .then(d => { setEvents(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [catId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete(id) {
    if (!window.confirm('ต้องการลบรายการนี้?')) return
    try {
      await api(`/api/medical-events/${id}`, { method: 'DELETE' })
      load()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="sub">กำลังโหลด...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <>
      <div className="section-header">
        <span className="section-header-title">สุขภาพ</span>
        <button className="section-add-btn" onClick={onAdd}><Plus size={12} /> เพิ่ม</button>
      </div>
      {events.length === 0
        ? <div className="empty">ยังไม่มีบันทึกสุขภาพ</div>
        : events.map(ev => (
          <div className="medical-row" key={ev.id}>
            <span
              className="medical-badge"
              style={{ background: MEDICAL_COLOR[ev.type] || '#4A5D80' }}
            >
              {MEDICAL_LABEL[ev.type] || ev.type}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{ev.name}</div>
              <div style={{ fontSize: 12, color: 'var(--rhino-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} />
                {fmtDate(ev.event_date)}
              </div>
              {ev.next_due_date && (
                <div style={{
                  fontSize: 12,
                  color: isDueSoon(ev.next_due_date) ? '#b91c1c' : 'var(--rhino-dim)',
                  fontWeight: isDueSoon(ev.next_due_date) ? 600 : 400,
                }}>
                  นัดถัดไป: {fmtDate(ev.next_due_date)}
                  {isDueSoon(ev.next_due_date) && ' — ใกล้ถึงแล้ว!'}
                </div>
              )}
              {ev.note && <div style={{ fontSize: 12, color: 'var(--rhino-dim)' }}>{ev.note}</div>}
            </div>
            <div className="row-actions">
              <button className="icon-btn" onClick={() => setEditing(ev)}><Pencil size={13} /></button>
              <button className="icon-btn del" onClick={() => confirmDelete(ev.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))
      }
      {editing && (
        <EditMedicalModal
          event={editing}
          onDone={() => { setEditing(null); load() }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ===== ค่าใช้จ่าย panel =====
const EXPENSE_COLORS = {
  'อาหาร': '#E3982E', 'ทราย': '#6B7280', 'หมอ': '#DD8C96',
  'ยา': '#4A5D80', 'วัคซีน': '#2E4060', 'ขนม': '#C86E7A',
  'ของเล่น': '#9CA3AF', 'อื่นๆ': '#9CA3AF',
}

function ExpensesPanel({ catId, version, onAdd }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const month = new Date().toISOString().slice(0, 7)

  function load() {
    setLoading(true)
    api(`/api/cats/${catId}/expenses?month=${month}`)
      .then(d => { setExpenses(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [catId, version, month]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete(id) {
    if (!window.confirm('ต้องการลบรายการนี้?')) return
    try {
      await api(`/api/expenses/${id}`, { method: 'DELETE' })
      load()
    } catch (e) { setError(e.message) }
  }

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0)

  if (loading) return <div className="sub">กำลังโหลด...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <>
      <div className="section-header">
        <span className="section-header-title">ค่าใช้จ่ายเดือนนี้</span>
        <button className="section-add-btn" onClick={onAdd}><Plus size={12} /> เพิ่ม</button>
      </div>
      {expenses.length > 0 && (
        <div className="expense-total">
          รวม: <strong>{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</strong>
        </div>
      )}
      {expenses.length === 0
        ? <div className="empty">ยังไม่มีบันทึกค่าใช้จ่าย</div>
        : expenses.map(e => (
          <div className="expense-row" key={e.id}>
            <span
              className="expense-badge"
              style={{ background: EXPENSE_COLORS[e.category] || '#9CA3AF' }}
            >
              {e.category}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {e.note && <div style={{ fontSize: 13 }}>{e.note}</div>}
              <div style={{ fontSize: 12, color: 'var(--rhino-dim)' }}>{fmtDate(e.expense_date)}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {parseFloat(e.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
            </div>
            <div className="row-actions">
              <button className="icon-btn" onClick={() => setEditing(e)}><Pencil size={13} /></button>
              <button className="icon-btn del" onClick={() => confirmDelete(e.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))
      }
      {editing && (
        <EditExpenseModal
          expense={editing}
          onDone={() => { setEditing(null); load() }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ===== Spiral Mood Calendar =====
function SpiralMoodCalendar({ displayMonth, moodMap, todayStr, selectedDate, onDayClick }) {
  const [year, mon] = displayMonth.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()

  const W = 320, H = 260
  const cx = W / 2, cy = H / 2 - 5
  const baseR = 38, rStep = 2.7
  const aStep = 28 * (Math.PI / 180)
  const startAngle = -Math.PI / 2

  const dots = Array.from({ length: daysInMonth }, (_, i) => {
    const r = baseR + i * rStep
    const angle = startAngle + i * aStep
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      day: i + 1,
      dateStr: `${displayMonth}-${String(i + 1).padStart(2, '0')}`,
      angle,
    }
  })

  const pathD = dots.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={pathD} fill="none" stroke="#EFCFC7" strokeWidth={1.2} opacity={0.5} />
      {dots.map(({ x, y, day, dateStr, angle }) => {
        const entry = moodMap[dateStr]
        const moodCfg = entry ? MOODS.find(m => m.id === entry.mood) : null
        const isToday = dateStr === todayStr
        const isSelected = dateStr === selectedDate
        const dotR = entry ? 9 : 7
        const MoodIcon = moodCfg?.Icon
        const numX = x + (dotR + 6) * Math.cos(angle)
        const numY = y + (dotR + 6) * Math.sin(angle)
        return (
          <g key={dateStr} onClick={() => onDayClick(dateStr, entry)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r={dotR + 7} fill="transparent" />
            <circle
              cx={x} cy={y} r={dotR}
              fill={entry ? MOOD_COLORS[entry.mood] : '#EDE9E7'}
              stroke={isToday ? '#DD8C96' : isSelected ? '#2E4060' : 'none'}
              strokeWidth={isToday || isSelected ? 2.5 : 0}
            />
            {MoodIcon ? (
              <foreignObject x={x - 7} y={y - 7} width={14} height={14} style={{ pointerEvents: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                  <MoodIcon size={12} color="#fff" strokeWidth={2.2} />
                </div>
              </foreignObject>
            ) : (
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill="#9CA3AF" fontFamily="Kanit,sans-serif">
                {day}
              </text>
            )}
            {entry && (
              <text x={numX} y={numY} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill="var(--rhino-dim)" fontFamily="Kanit,sans-serif" fontWeight="600">
                {day}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ===== Diary panel (with spiral calendar) =====
function DiaryPanel({ catId, version, onAdd }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [displayMonth, setDisplayMonth] = useState(() => new Date().toLocaleDateString('sv').slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(null)

  function load() {
    setLoading(true)
    api(`/api/cats/${catId}/diary`)
      .then(d => { setEntries(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [catId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete(id) {
    if (!window.confirm('ต้องการลบรายการนี้?')) return
    try {
      await api(`/api/diary/${id}`, { method: 'DELETE' })
      load()
    } catch (e) { setError(e.message) }
  }

  const moodMap = {}
  entries.forEach(e => {
    const d = String(e.entry_date).slice(0, 10)
    if (!moodMap[d]) moodMap[d] = e
  })

  const [year, mon] = displayMonth.split('-').map(Number)
  const todayStr = new Date().toLocaleDateString('sv')
  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  function prevMonth() {
    const d = new Date(year, mon - 2, 1)
    setDisplayMonth(d.toLocaleDateString('sv').slice(0, 7))
  }
  function nextMonth() {
    const d = new Date(year, mon, 1)
    setDisplayMonth(d.toLocaleDateString('sv').slice(0, 7))
  }

  // Mood summary for this month
  const moodCounts = {}
  MOODS.forEach(m => { moodCounts[m.id] = 0 })
  Object.entries(moodMap).forEach(([dateStr, entry]) => {
    if (dateStr.slice(0, 7) === displayMonth && entry.mood) {
      moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1
    }
  })

  // Entries for selected date or most recent
  const dateEntries = selectedDate
    ? entries.filter(e => String(e.entry_date).slice(0, 10) === selectedDate)
    : entries.slice(0, 5)

  if (loading) return <div className="sub">กำลังโหลด...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <>
      <div className="section-header">
        <span className="section-header-title">ไดอารี่</span>
        <button className="section-add-btn" onClick={() => onAdd(selectedDate || today())}><Plus size={12} /> เพิ่ม</button>
      </div>

      {/* Spiral mood calendar */}
      <div style={{ marginBottom: 12 }}>
        <div className="cal-nav" style={{ marginBottom: 4 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', padding: '2px 6px', cursor: 'pointer', color: 'var(--rhino-dim)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--rhino)' }}>{monthLabel}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', padding: '2px 6px', cursor: 'pointer', color: 'var(--rhino-dim)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={15} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
        <SpiralMoodCalendar
          displayMonth={displayMonth}
          moodMap={moodMap}
          todayStr={todayStr}
          selectedDate={selectedDate}
          onDayClick={(dateStr, entry) => {
            setSelectedDate(selectedDate === dateStr ? null : dateStr)
            if (!entry) onAdd(dateStr)
          }}
        />
        {/* Mood summary */}
        <div className="mood-summary">
          {MOODS.map(m => moodCounts[m.id] > 0 && (
            <span key={m.id}>
              <m.Icon size={11} color={m.color} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              {m.label}: <strong>{moodCounts[m.id]}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Entry list */}
      {selectedDate && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rhino-dim)', marginBottom: 6 }}>
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}
        </div>
      )}
      {dateEntries.length === 0
        ? <div className="empty">{selectedDate ? 'ไม่มีบันทึกวันนี้' : 'ยังไม่มีบันทึกไดอารี่'}</div>
        : dateEntries.map(entry => {
          const moodCfg = MOODS.find(m => m.id === entry.mood) || MOODS[2]
          const { Icon } = moodCfg
          return (
            <div className="diary-entry" key={entry.id}>
              <Icon size={24} color={moodCfg.color} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--rhino-dim)', marginBottom: 2 }}>{fmtDate(entry.entry_date)}</div>
                {entry.note && <div style={{ fontSize: 13 }}>{entry.note}</div>}
              </div>
              {entry.photo_url && (
                <img src={entry.photo_url} alt="diary" className="diary-thumb" />
              )}
              <div className="row-actions">
                <button className="icon-btn" onClick={() => setEditing(entry)}><Pencil size={13} /></button>
                <button className="icon-btn del" onClick={() => confirmDelete(entry.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          )
        })
      }
      {editing && (
        <EditDiaryModal
          entry={editing}
          onDone={() => { setEditing(null); load() }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ===== Add Modals =====
function AddRoutineModal({ catId, onDone, onClose }) {
  const [title, setTitle] = useState('')
  const [freq, setFreq] = useState(1)
  const [lastDone, setLastDone] = useState('')
  const [error, setError] = useState(null)

  async function submit() {
    if (!title.trim()) return
    try {
      await api(`/api/cats/${catId}/routines`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          frequency_days: freq,
          last_done_at: lastDone || undefined,
        }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="เพิ่มกิจวัตร" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">ชื่อกิจวัตร</label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น เช็ดตา, ล้างกระบะ" autoFocus />
      <label className="form-label">ความถี่</label>
      <FrequencyInput value={freq} onChange={setFreq} />
      <label className="form-label">ทำล่าสุดเมื่อ (ถ้ามี)</label>
      <input type="date" value={lastDone} onChange={e => setLastDone(e.target.value)} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

function AddWeightModal({ catId, onDone, onClose }) {
  const [weight, setWeight] = useState('')
  const [error, setError] = useState(null)

  async function submit() {
    const val = parseFloat(weight)
    if (!weight || isNaN(val) || val <= 0) return
    try {
      await api(`/api/cats/${catId}/weight`, {
        method: 'POST',
        body: JSON.stringify({ weight_kg: val }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="บันทึกน้ำหนัก" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">น้ำหนัก (kg)</label>
      <input
        type="number" value={weight} onChange={e => setWeight(e.target.value)}
        placeholder="เช่น 4.5" step="0.1" min="0" autoFocus
      />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

const MEDICAL_TYPES = [
  { value: 'vaccine', label: 'วัคซีน' },
  { value: 'medication', label: 'ยา' },
  { value: 'checkup', label: 'ตรวจสุขภาพ' },
]

function AddMedicalModal({ catId, onDone, onClose }) {
  const [type, setType] = useState('vaccine')
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState(today())
  const [nextDue, setNextDue] = useState('')
  const [nextDueTime, setNextDueTime] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  async function submit() {
    if (!name.trim() || !eventDate) return
    try {
      await api(`/api/cats/${catId}/medical-events`, {
        method: 'POST',
        body: JSON.stringify({
          type, name: name.trim(), event_date: eventDate,
          next_due_date: nextDue || undefined,
          next_due_time: nextDueTime || undefined,
          note: note || undefined,
        }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="บันทึกสุขภาพ" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">ประเภท</label>
      <select value={type} onChange={e => setType(e.target.value)}>
        {MEDICAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <label className="form-label">ชื่อ / รายละเอียด</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น วัคซีนพิษสุนัขบ้า" autoFocus />
      <label className="form-label">วันที่ทำ</label>
      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
      <label className="form-label">นัดครั้งถัดไป (ถ้ามี)</label>
      <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} />
      <label className="form-label">เวลานัด (ถ้าต้องการให้เตือนตรงเวลา)</label>
      <input type="time" value={nextDueTime} onChange={e => setNextDueTime(e.target.value)} disabled={!nextDue} />
      <label className="form-label">หมายเหตุ</label>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

const EXPENSE_CATEGORIES = ['อาหาร', 'ทราย', 'หมอ', 'ยา', 'วัคซีน', 'ขนม', 'ของเล่น', 'อื่นๆ']

function AddExpenseModal({ catId, onDone, onClose }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('อาหาร')
  const [note, setNote] = useState('')
  const [expenseDate, setExpenseDate] = useState(today())
  const [error, setError] = useState(null)

  async function submit() {
    const val = parseFloat(amount)
    if (!amount || isNaN(val) || val <= 0) return
    try {
      await api(`/api/cats/${catId}/expenses`, {
        method: 'POST',
        body: JSON.stringify({ amount: val, category, note: note || undefined, expense_date: expenseDate }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="บันทึกค่าใช้จ่าย" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">จำนวนเงิน (บาท)</label>
      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" autoFocus />
      <label className="form-label">หมวดหมู่</label>
      <select value={category} onChange={e => setCategory(e.target.value)}>
        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label className="form-label">หมายเหตุ</label>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" />
      <label className="form-label">วันที่</label>
      <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

function AddDiaryModal({ catId, initialDate, onDone, onClose }) {
  const [mood, setMood] = useState('good')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(null)
  const [entryDate, setEntryDate] = useState(initialDate || today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('mood', mood)
      if (note) form.append('note', note)
      form.append('entry_date', entryDate)
      if (photo) form.append('photo', photo)
      await apiForm(`/api/cats/${catId}/diary`, form)
      onDone()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="บันทึกไดอารี่" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">อารมณ์วันนี้</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {MOODS.map(({ id, Icon, label, color }) => (
          <button
            key={id}
            className={`mood-btn${mood === id ? ' selected' : ''}`}
            style={{ color: mood === id ? color : undefined }}
            onClick={() => setMood(id)}
            type="button"
          >
            <Icon size={22} color={color} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>
      <label className="form-label">บันทึก (ถ้ามี)</label>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="เขียนบันทึกวันนี้..."
        rows={3}
        style={{
          width: '100%', padding: '9px 10px', border: '1px solid rgba(74,93,128,0.3)',
          borderRadius: 6, fontSize: 14, fontFamily: 'Kanit, sans-serif',
          color: 'var(--rhino)', marginBottom: 8, resize: 'vertical', outline: 'none',
        }}
      />
      <label className="form-label">รูปภาพ (ถ้ามี)</label>
      <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0] || null)} />
      <label className="form-label">วันที่</label>
      <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit} disabled={saving}>
        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </Modal>
  )
}

// ===== Edit Modals =====
function EditRoutineModal({ routine, onDone, onClose }) {
  const [title, setTitle] = useState(routine.title)
  const [freq, setFreq] = useState(routine.frequency_days)
  const [error, setError] = useState(null)

  async function submit() {
    if (!title.trim()) return
    try {
      await api(`/api/routines/${routine.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: title.trim(), frequency_days: freq }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="แก้ไขกิจวัตร" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">ชื่อกิจวัตร</label>
      <input value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <label className="form-label">ความถี่</label>
      <FrequencyInput value={freq} onChange={setFreq} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

function EditWeightModal({ log, onDone, onClose }) {
  const [weight, setWeight] = useState(String(parseFloat(log.weight_kg)))
  const [error, setError] = useState(null)

  async function submit() {
    const val = parseFloat(weight)
    if (!weight || isNaN(val) || val <= 0) return
    try {
      await api(`/api/weight/${log.id}`, {
        method: 'PUT',
        body: JSON.stringify({ weight_kg: val }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="แก้ไขน้ำหนัก" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">น้ำหนัก (kg)</label>
      <input type="number" value={weight} onChange={e => setWeight(e.target.value)} step="0.1" min="0" autoFocus />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

function EditMedicalModal({ event: ev, onDone, onClose }) {
  const [type, setType] = useState(ev.type)
  const [name, setName] = useState(ev.name)
  const [eventDate, setEventDate] = useState(String(ev.event_date).slice(0, 10))
  const [nextDue, setNextDue] = useState(ev.next_due_date ? String(ev.next_due_date).slice(0, 10) : '')
  const [nextDueTime, setNextDueTime] = useState(ev.next_due_time || '')
  const [note, setNote] = useState(ev.note || '')
  const [error, setError] = useState(null)

  async function submit() {
    if (!name.trim() || !eventDate) return
    try {
      await api(`/api/medical-events/${ev.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          type, name: name.trim(), event_date: eventDate,
          next_due_date: nextDue || null,
          next_due_time: nextDueTime || null,
          note: note || null,
        }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="แก้ไขบันทึกสุขภาพ" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">ประเภท</label>
      <select value={type} onChange={e => setType(e.target.value)}>
        {MEDICAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <label className="form-label">ชื่อ / รายละเอียด</label>
      <input value={name} onChange={e => setName(e.target.value)} autoFocus />
      <label className="form-label">วันที่ทำ</label>
      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
      <label className="form-label">นัดครั้งถัดไป (ถ้ามี)</label>
      <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} />
      <label className="form-label">เวลานัด</label>
      <input type="time" value={nextDueTime} onChange={e => setNextDueTime(e.target.value)} disabled={!nextDue} />
      <label className="form-label">หมายเหตุ</label>
      <input value={note} onChange={e => setNote(e.target.value)} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

function EditExpenseModal({ expense, onDone, onClose }) {
  const [amount, setAmount] = useState(String(parseFloat(expense.amount)))
  const [category, setCategory] = useState(expense.category)
  const [note, setNote] = useState(expense.note || '')
  const [expenseDate, setExpenseDate] = useState(String(expense.expense_date).slice(0, 10))
  const [error, setError] = useState(null)

  async function submit() {
    const val = parseFloat(amount)
    if (!amount || isNaN(val) || val <= 0) return
    try {
      await api(`/api/expenses/${expense.id}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: val, category, note: note || null, expense_date: expenseDate }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="แก้ไขค่าใช้จ่าย" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">จำนวนเงิน (บาท)</label>
      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" min="0" autoFocus />
      <label className="form-label">หมวดหมู่</label>
      <select value={category} onChange={e => setCategory(e.target.value)}>
        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label className="form-label">หมายเหตุ</label>
      <input value={note} onChange={e => setNote(e.target.value)} />
      <label className="form-label">วันที่</label>
      <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

function EditDiaryModal({ entry, onDone, onClose }) {
  const [mood, setMood] = useState(entry.mood)
  const [note, setNote] = useState(entry.note || '')
  const [error, setError] = useState(null)

  async function submit() {
    try {
      await api(`/api/diary/${entry.id}`, {
        method: 'PUT',
        body: JSON.stringify({ mood, note: note || null }),
      })
      onDone()
    } catch (e) { setError(e.message) }
  }

  return (
    <Modal title="แก้ไขไดอารี่" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">อารมณ์</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {MOODS.map(({ id, Icon, label, color }) => (
          <button
            key={id}
            className={`mood-btn${mood === id ? ' selected' : ''}`}
            style={{ color: mood === id ? color : undefined }}
            onClick={() => setMood(id)}
            type="button"
          >
            <Icon size={22} color={color} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>
      <label className="form-label">บันทึก</label>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        style={{
          width: '100%', padding: '9px 10px', border: '1px solid rgba(74,93,128,0.3)',
          borderRadius: 6, fontSize: 14, fontFamily: 'Kanit, sans-serif',
          color: 'var(--rhino)', marginBottom: 8, resize: 'vertical', outline: 'none',
        }}
      />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit}>บันทึก</button>
    </Modal>
  )
}

function EditCatModal({ cat, onDone, onClose }) {
  const [name, setName] = useState(cat.name)
  const [breed, setBreed] = useState(cat.breed || '')
  const [birthday, setBirthday] = useState(cat.birthday ? String(cat.birthday).slice(0, 10) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api(`/api/cats/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), breed: breed || null, birthday: birthday || null }),
      })
      onDone(updated)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="แก้ไขข้อมูลแมว" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">ชื่อแมว *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อแมว" autoFocus />
      <label className="form-label">สายพันธุ์</label>
      <BreedSelect value={breed} onChange={setBreed} />
      <label className="form-label">วันเกิด</label>
      <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit} disabled={saving}>
        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </Modal>
  )
}

// ===== Grid menu config =====
const MENU_ITEMS = [
  { id: 'routines', Icon: ListChecks,  label: 'กิจวัตร',     color: '#2E4060' },
  { id: 'weight',   Icon: Scale,       label: 'น้ำหนัก',     color: '#4A5D80' },
  { id: 'health',   Icon: Stethoscope, label: 'สุขภาพ',      color: '#DD8C96' },
  { id: 'expenses', Icon: Wallet,      label: 'ค่าใช้จ่าย',  color: '#E3982E' },
  { id: 'diary',    Icon: BookOpen,    label: 'ไดอารี่',      color: '#65a30d' },
]

// ===== Main CatPassport =====
export default function CatPassport({
  cat: initialCat, onCatUpdate,
  showHeader = true,
  activeSection: controlledSection, onSectionChange,
}) {
  const [cat, setCat] = useState(initialCat)
  const [localSection, setLocalSection] = useState(null)
  const activeSection = controlledSection !== undefined ? controlledSection : localSection
  function setActiveSection(s) {
    if (onSectionChange) onSectionChange(s)
    else setLocalSection(s)
  }
  const [modal, setModal] = useState(null)
  const [diaryInitialDate, setDiaryInitialDate] = useState(null)
  const [versions, setVersions] = useState({ routines: 0, weight: 0, health: 0, expenses: 0, diary: 0 })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef(null)

  // Keep cat in sync if parent updates it
  useEffect(() => { setCat(initialCat) }, [initialCat])

  const passportId = `PD-${String(cat.id).padStart(4, '0')}`

  function bump(key) { setVersions(v => ({ ...v, [key]: v[key] + 1 })) }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('photo', file)
      const updated = await apiForm(`/api/cats/${cat.id}/photo`, form)
      setCat(updated)
      if (onCatUpdate) onCatUpdate(updated)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function openDiaryAdd(dateStr) {
    setDiaryInitialDate(dateStr || today())
    setModal('diary')
  }

  return (
    <div className={`passport-card${showHeader ? '' : ' no-header'}`}>
      {/* Passport header */}
      {showHeader && <div className="passport-header">
        <div
          className="passport-photo-wrap"
          onClick={() => !uploading && fileRef.current.click()}
          title="กดเพื่อเปลี่ยนรูป"
        >
          {cat.photo_url
            ? <img src={cat.photo_url} alt={cat.name} className="passport-photo" />
            : <div className="passport-photo-placeholder"><ImagePlus size={28} /></div>
          }
          <div className="passport-photo-overlay">
            <Camera size={14} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </div>
        <div className="passport-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div className="passport-id" style={{ marginBottom: 0 }}>{passportId}</div>
            <button
              onClick={() => setModal('edit')}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 6,
                padding: '3px 5px',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                lineHeight: 1,
              }}
              title="แก้ไขข้อมูลแมว"
            >
              <Pencil size={11} />
            </button>
          </div>
          <div className="passport-name">{cat.name}</div>
          {cat.breed && <div className="passport-detail">{cat.breed}</div>}
          {cat.birthday && (
            <div className="passport-detail">
              <Calendar size={11} />
              {fmtDate(cat.birthday)}
            </div>
          )}
        </div>
      </div>}
      {showHeader && uploadError && (
        <div className="error-msg" style={{ margin: '8px 16px 0', fontSize: 12 }}>{uploadError}</div>
      )}
      {showHeader && uploading && (
        <div style={{ fontSize: 12, color: 'var(--rhino-dim)', padding: '6px 16px' }}>กำลังอัปโหลด...</div>
      )}

      {/* Content area */}
      <div className="passport-content">
        {activeSection === null && (
          <div className="cat-menu-grid">
            {MENU_ITEMS.map(({ id, Icon, label, color }) => (
              <div
                key={id}
                className="cat-menu-item"
                onClick={() => setActiveSection(id)}
              >
                <Icon size={28} color={color} strokeWidth={1.8} />
                <span className="cat-menu-item-label">{label}</span>
              </div>
            ))}
          </div>
        )}

        {activeSection !== null && (
          <>
            <button className="cat-menu-back" onClick={() => setActiveSection(null)}>
              <ChevronLeft size={16} />
              กลับ
            </button>

            {activeSection === 'routines' && (
              <RoutinesPanel catId={cat.id} version={versions.routines} onAdd={() => setModal('routine')} />
            )}
            {activeSection === 'weight' && (
              <WeightPanel catId={cat.id} version={versions.weight} onAdd={() => setModal('weight')} />
            )}
            {activeSection === 'health' && (
              <HealthPanel catId={cat.id} version={versions.health} onAdd={() => setModal('medical')} />
            )}
            {activeSection === 'expenses' && (
              <ExpensesPanel catId={cat.id} version={versions.expenses} onAdd={() => setModal('expense')} />
            )}
            {activeSection === 'diary' && (
              <DiaryPanel catId={cat.id} version={versions.diary} onAdd={openDiaryAdd} />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal === 'routine' && (
        <AddRoutineModal catId={cat.id} onDone={() => { setModal(null); bump('routines') }} onClose={() => setModal(null)} />
      )}
      {modal === 'weight' && (
        <AddWeightModal catId={cat.id} onDone={() => { setModal(null); bump('weight') }} onClose={() => setModal(null)} />
      )}
      {modal === 'medical' && (
        <AddMedicalModal catId={cat.id} onDone={() => { setModal(null); bump('health') }} onClose={() => setModal(null)} />
      )}
      {modal === 'expense' && (
        <AddExpenseModal catId={cat.id} onDone={() => { setModal(null); bump('expenses') }} onClose={() => setModal(null)} />
      )}
      {modal === 'diary' && (
        <AddDiaryModal catId={cat.id} initialDate={diaryInitialDate} onDone={() => { setModal(null); bump('diary') }} onClose={() => setModal(null)} />
      )}
      {modal === 'edit' && (
        <EditCatModal
          cat={cat}
          onDone={(updated) => { setModal(null); setCat(updated); if (onCatUpdate) onCatUpdate(updated) }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
