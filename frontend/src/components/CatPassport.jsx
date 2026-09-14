import { useState, useEffect, useRef } from 'react'
import { Camera, Plus, ListChecks, Scale, Stethoscope, Wallet, ImagePlus, Calendar, Pencil, BookOpen, Laugh, Smile, Meh, Frown } from 'lucide-react'
import { api, apiForm } from '../api'
import Modal from './Modal'
import WeightChart from './WeightChart'

// ===== helpers =====
// ใช้ toLocaleDateString('sv') เพื่อให้ได้ YYYY-MM-DD ตาม timezone ของ device (ไม่ใช่ UTC)
function today() { return new Date().toLocaleDateString('sv') }

function fmtDate(dateStr) {
  if (!dateStr) return ''
  // slice 10 ตัวแรก (YYYY-MM-DD) แล้วต่อ T00:00:00 ให้ JS ตีความเป็น local midnight ไม่ใช่ UTC midnight
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isDueSoon(dateStr) {
  if (!dateStr) return false
  // เปรียบเทียบ YYYY-MM-DD string ตรง ๆ ไม่ผ่าน Date object เพื่อกัน timezone shift
  const target = String(dateStr).slice(0, 10)
  const todayStr = new Date().toLocaleDateString('sv')
  const limitStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sv')
  return target >= todayStr && target <= limitStr
}

// ===== Diary config =====
const MOODS = [
  { id: 'great', Icon: Laugh,  label: 'สุดยอด', color: '#16a34a' },
  { id: 'good',  Icon: Smile,  label: 'ดี',     color: '#65a30d' },
  { id: 'okay',  Icon: Meh,    label: 'ปกติ',   color: '#d97706' },
  { id: 'bad',   Icon: Frown,  label: 'ไม่ดี',  color: '#dc2626' },
]

// ===== กิจวัตร panel =====
function RoutinesPanel({ catId, version, onAdd }) {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ok = true
    setLoading(true)
    api(`/api/cats/${catId}/routines`)
      .then(d => { if (ok) { setRoutines(d); setError(null) } })
      .catch(e => { if (ok) setError(e.message) })
      .finally(() => { if (ok) setLoading(false) })
    return () => { ok = false }
  }, [catId, version])

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
            <span style={{ fontSize: 12, color: 'var(--rhino-dim)', whiteSpace: 'nowrap' }}>
              ทุก {r.frequency_days} วัน
            </span>
          </div>
        ))
      }
    </>
  )
}

// ===== น้ำหนัก panel =====
function WeightPanel({ catId, version, onAdd }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ok = true
    setLoading(true)
    api(`/api/cats/${catId}/weight`)
      .then(d => { if (ok) { setLogs(d); setError(null) } })
      .catch(e => { if (ok) setError(e.message) })
      .finally(() => { if (ok) setLoading(false) })
    return () => { ok = false }
  }, [catId, version])

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
            <tr><th>วันที่</th><th>น้ำหนัก (kg)</th></tr>
          </thead>
          <tbody>
            {[...logs].reverse().map(l => (
              <tr key={l.id}>
                <td>{fmtDate(l.recorded_at)}</td>
                <td style={{ fontWeight: 600 }}>{parseFloat(l.weight_kg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

  useEffect(() => {
    let ok = true
    setLoading(true)
    api(`/api/cats/${catId}/medical-events`)
      .then(d => { if (ok) { setEvents(d); setError(null) } })
      .catch(e => { if (ok) setError(e.message) })
      .finally(() => { if (ok) setLoading(false) })
    return () => { ok = false }
  }, [catId, version])

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
          </div>
        ))
      }
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
  const month = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    let ok = true
    setLoading(true)
    api(`/api/cats/${catId}/expenses?month=${month}`)
      .then(d => { if (ok) { setExpenses(d); setError(null) } })
      .catch(e => { if (ok) setError(e.message) })
      .finally(() => { if (ok) setLoading(false) })
    return () => { ok = false }
  }, [catId, version, month])

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
          </div>
        ))
      }
    </>
  )
}

// ===== Diary panel =====
function DiaryPanel({ catId, version, onAdd }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ok = true
    setLoading(true)
    api(`/api/cats/${catId}/diary`)
      .then(d => { if (ok) { setEntries(d); setError(null) } })
      .catch(e => { if (ok) setError(e.message) })
      .finally(() => { if (ok) setLoading(false) })
    return () => { ok = false }
  }, [catId, version])

  if (loading) return <div className="sub">กำลังโหลด...</div>
  if (error) return <div className="error-msg">{error}</div>

  return (
    <>
      <div className="section-header">
        <span className="section-header-title">ไดอารี่</span>
        <button className="section-add-btn" onClick={onAdd}><Plus size={12} /> เพิ่ม</button>
      </div>
      {entries.length === 0
        ? <div className="empty">ยังไม่มีบันทึกไดอารี่</div>
        : entries.map(entry => {
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
            </div>
          )
        })
      }
    </>
  )
}

// ===== Modals =====
function AddRoutineModal({ catId, onDone, onClose }) {
  const [title, setTitle] = useState('')
  const [freq, setFreq] = useState('1')
  const [lastDone, setLastDone] = useState('')
  const [error, setError] = useState(null)

  async function submit() {
    if (!title.trim()) return
    try {
      await api(`/api/cats/${catId}/routines`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          frequency_days: parseInt(freq, 10),
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
      <select value={freq} onChange={e => setFreq(e.target.value)}>
        <option value="1">ทุกวัน</option>
        <option value="7">ทุกสัปดาห์</option>
        <option value="30">ทุกเดือน</option>
      </select>
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

function AddDiaryModal({ catId, onDone, onClose }) {
  const [mood, setMood] = useState('good')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(null)
  const [entryDate, setEntryDate] = useState(today())
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

function EditCatModal({ cat, onDone, onClose }) {
  const [name, setName] = useState(cat.name)
  const [breed, setBreed] = useState(cat.breed || '')
  const [birthday, setBirthday] = useState(cat.birthday ? cat.birthday.split('T')[0] : '')
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
      <input value={breed} onChange={e => setBreed(e.target.value)} placeholder="เช่น เปอร์เซีย, อเมริกันชอร์ตแฮร์" />
      <label className="form-label">วันเกิด</label>
      <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit} disabled={saving}>
        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </Modal>
  )
}

// ===== Sub-tab config =====
const SUBTABS = [
  { id: 'routines', Icon: ListChecks, label: 'กิจวัตร' },
  { id: 'weight',   Icon: Scale,      label: 'น้ำหนัก' },
  { id: 'health',   Icon: Stethoscope, label: 'สุขภาพ' },
  { id: 'expenses', Icon: Wallet,     label: 'ค่าใช้จ่าย' },
  { id: 'diary',    Icon: BookOpen,   label: 'ไดอารี่' },
]

// ===== Main CatPassport =====
export default function CatPassport({ cat: initialCat }) {
  const [cat, setCat] = useState(initialCat)
  const [activeTab, setActiveTab] = useState('routines')
  const [modal, setModal] = useState(null)
  const [versions, setVersions] = useState({ routines: 0, weight: 0, health: 0, expenses: 0, diary: 0 })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef(null)

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
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="passport-card">
      {/* Passport header */}
      <div className="passport-header">
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
      </div>
      {uploadError && (
        <div className="error-msg" style={{ margin: '8px 16px 0', fontSize: 12 }}>{uploadError}</div>
      )}
      {uploading && (
        <div style={{ fontSize: 12, color: 'var(--rhino-dim)', padding: '6px 16px' }}>กำลังอัปโหลด...</div>
      )}

      {/* Sub-tabs */}
      <div className="passport-tabs">
        {SUBTABS.map(({ id, Icon, label }) => (
          <button
            key={id}
            className={`passport-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} strokeWidth={activeTab === id ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="passport-content">
        {activeTab === 'routines' && (
          <RoutinesPanel catId={cat.id} version={versions.routines} onAdd={() => setModal('routine')} />
        )}
        {activeTab === 'weight' && (
          <WeightPanel catId={cat.id} version={versions.weight} onAdd={() => setModal('weight')} />
        )}
        {activeTab === 'health' && (
          <HealthPanel catId={cat.id} version={versions.health} onAdd={() => setModal('medical')} />
        )}
        {activeTab === 'expenses' && (
          <ExpensesPanel catId={cat.id} version={versions.expenses} onAdd={() => setModal('expense')} />
        )}
        {activeTab === 'diary' && (
          <DiaryPanel catId={cat.id} version={versions.diary} onAdd={() => setModal('diary')} />
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
        <AddDiaryModal catId={cat.id} onDone={() => { setModal(null); bump('diary') }} onClose={() => setModal(null)} />
      )}
      {modal === 'edit' && (
        <EditCatModal
          cat={cat}
          onDone={(updated) => { setModal(null); setCat(updated) }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
