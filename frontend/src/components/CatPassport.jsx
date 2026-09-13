import { useState, useEffect, useRef } from 'react'
import { Camera, Plus, ListChecks, Scale, Stethoscope, Wallet, ImagePlus, Calendar } from 'lucide-react'
import { api, apiForm } from '../api'
import Modal from './Modal'
import WeightChart from './WeightChart'

// ===== helpers =====
function today() { return new Date().toISOString().split('T')[0] }

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isDueSoon(dateStr) {
  if (!dateStr) return false
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
  return diff <= 7
}

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

// ===== Modals =====
function AddRoutineModal({ catId, onDone, onClose }) {
  const [title, setTitle] = useState('')
  const [freq, setFreq] = useState('1')
  const [error, setError] = useState(null)

  async function submit() {
    if (!title.trim()) return
    try {
      await api(`/api/cats/${catId}/routines`, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), frequency_days: parseInt(freq, 10) }),
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
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  async function submit() {
    if (!name.trim() || !eventDate) return
    try {
      await api(`/api/cats/${catId}/medical-events`, {
        method: 'POST',
        body: JSON.stringify({
          type, name: name.trim(), event_date: eventDate,
          next_due_date: nextDue || undefined, note: note || undefined,
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

// ===== Sub-tab config =====
const SUBTABS = [
  { id: 'routines', Icon: ListChecks, label: 'กิจวัตร' },
  { id: 'weight',   Icon: Scale,      label: 'น้ำหนัก' },
  { id: 'health',   Icon: Stethoscope, label: 'สุขภาพ' },
  { id: 'expenses', Icon: Wallet,     label: 'ค่าใช้จ่าย' },
]

// ===== Main CatPassport =====
export default function CatPassport({ cat: initialCat }) {
  const [cat, setCat] = useState(initialCat)
  const [activeTab, setActiveTab] = useState('routines')
  const [modal, setModal] = useState(null)
  const [versions, setVersions] = useState({ routines: 0, weight: 0, health: 0, expenses: 0 })
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
          <div className="passport-id">{passportId}</div>
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
    </div>
  )
}
