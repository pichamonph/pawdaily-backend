import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, PawPrint, Scale, Calendar, Wallet, ListChecks, Camera, ImagePlus, TrendingUp, TrendingDown, Minus, BookOpen, Stethoscope } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { api, apiForm } from '../api'
import Modal from './Modal'
import CatSwitcher from './CatSwitcher'

const BREEDS = [
  'ไทย / วิเชียรมาศ', 'เปอร์เซีย', 'สก็อตติชโฟลด์', 'อเมริกันชอร์ตแฮร์',
  'เมนคูน', 'บริติชชอร์ตแฮร์', 'รัสเชียนบลู', 'สยาม', 'สายพันธุ์ผสม / ไม่ทราบ', 'อื่นๆ',
]

const MENU_ITEMS = [
  { id: 'routines', Icon: ListChecks,  label: 'กิจวัตร',     color: '#2E4060' },
  { id: 'health',   Icon: Stethoscope, label: 'สุขภาพ',      color: '#DD8C96' },
  { id: 'expenses', Icon: Wallet,      label: 'ค่าใช้จ่าย',  color: '#E3982E' },
  { id: 'diary',    Icon: BookOpen,    label: 'ไดอารี่',      color: '#65a30d' },
]

function BreedSelect({ value, onChange }) {
  const isOther = value === 'อื่นๆ'
  const selectVal = BREEDS.includes(value) ? value : (value ? 'อื่นๆ' : '')
  const [customVal, setCustomVal] = useState(isOther || !BREEDS.includes(value) ? value : '')

  function handleSelect(e) {
    const v = e.target.value
    if (v === 'อื่นๆ') { onChange('อื่นๆ') } else { onChange(v) }
  }
  function handleCustom(e) { setCustomVal(e.target.value); onChange(e.target.value) }
  const showCustom = selectVal === 'อื่นๆ'

  return (
    <>
      <select value={selectVal} onChange={handleSelect}>
        <option value="">-- เลือกสายพันธุ์ --</option>
        {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      {showCustom && <input value={customVal} onChange={handleCustom} placeholder="ระบุสายพันธุ์" />}
    </>
  )
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ===== Dashboard helpers =====
const EXPENSE_COLORS = ['#DD8C96','#E3982E','#65a30d','#2E4060','#a78bfa','#0ea5e9']

function MiniWeightChart({ history }) {
  if (!history || history.length < 2) return null
  const vals = history.map(h => h.weight_kg)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const W = 80, H = 36, PAD = 3
  const points = vals.map((v, i) => {
    const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke="var(--dull-pink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points.split(' ').at(-1).split(',')[0]} cy={points.split(' ').at(-1).split(',')[1]} r={3} fill="var(--dull-pink)" />
    </svg>
  )
}

function ProgressRing({ done, total, size = 56 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  const dash = pct * circ
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--almond)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--dull-pink)" strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill="var(--rhino)">
        {done}/{total}
      </text>
    </svg>
  )
}

// ===== Dashboard =====
function CatDashboard({ catId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    api(`/api/cats/${catId}/dashboard`).then(setData).catch(() => {})
  }, [catId])

  if (!data) return null

  const { latestWeight, weightHistory, nextAppointment, monthExpenseTotal, expenseByCategory, routines } = data
  const TrendIcon = latestWeight?.trend === 'up' ? TrendingUp : latestWeight?.trend === 'down' ? TrendingDown : Minus
  const trendColor = latestWeight?.trend === 'up' ? '#dc2626' : latestWeight?.trend === 'down' ? '#16a34a' : 'var(--rhino-dim)'

  const pieData = (expenseByCategory || []).filter(e => e.total > 0)

  return (
    <div className="dash-grid">
      {/* Weight card */}
      <div className="dash-card">
        <div className="dash-card-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Scale size={11} /> น้ำหนัก
        </div>
        {latestWeight ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="dash-card-main">{latestWeight.weight_kg}</span>
              <span className="dash-card-sub">kg</span>
              {latestWeight.trend && <TrendIcon size={13} color={trendColor} />}
            </div>
            <div className="dash-card-chart">
              <MiniWeightChart history={weightHistory} />
            </div>
          </>
        ) : (
          <div className="dash-card-sub" style={{ marginTop: 8 }}>ยังไม่มีข้อมูล</div>
        )}
      </div>

      {/* Appointment card */}
      <div className="dash-card">
        <div className="dash-card-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={11} /> นัดถัดไป
        </div>
        {nextAppointment ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span className="dash-card-main">{nextAppointment.daysUntil}</span>
              <span className="dash-card-sub">วัน</span>
            </div>
            <div className="dash-card-sub" style={{ marginTop: 2, lineHeight: 1.3 }}>{nextAppointment.name}</div>
          </>
        ) : (
          <div className="dash-card-sub" style={{ marginTop: 8 }}>ไม่มีนัด</div>
        )}
      </div>

      {/* Expenses card */}
      <div className="dash-card">
        <div className="dash-card-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Wallet size={11} /> ค่าใช้จ่าย
        </div>
        {monthExpenseTotal > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span className="dash-card-main" style={{ fontSize: 16 }}>
                  {monthExpenseTotal.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                </span>
                <span className="dash-card-sub">฿</span>
              </div>
              <div className="dash-card-sub">เดือนนี้</div>
            </div>
            {pieData.length > 0 && (
              <div style={{ width: 52, height: 52, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="total" cx="50%" cy="50%" outerRadius={22} innerRadius={10} strokeWidth={0}>
                      {pieData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="dash-card-sub" style={{ marginTop: 8 }}>ยังไม่มีค่าใช้จ่าย</div>
        )}
      </div>

      {/* Routines card */}
      <div className="dash-card" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="dash-card-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ListChecks size={11} /> กิจวัตรวันนี้
        </div>
        {routines.total > 0 ? (
          <div style={{ marginTop: 4 }}>
            <ProgressRing done={routines.doneToday} total={routines.total} size={60} />
          </div>
        ) : (
          <div className="dash-card-sub" style={{ marginTop: 8 }}>ไม่มีกิจวัตร</div>
        )}
      </div>
    </div>
  )
}

// ===== Cat header (photo + name + passport link) =====
function CatHeader({ cat, onCatUpdate, onPassport }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('photo', file)
      const updated = await apiForm(`/api/cats/${cat.id}/photo`, form)
      onCatUpdate(updated)
    } catch (_) { /* ignore */ } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const passportId = `PD-${String(cat.id).padStart(4, '0')}`

  return (
    <div className="cat-header-row">
      <div className="cat-header-photo-wrap" onClick={() => !uploading && fileRef.current?.click()}>
        {cat.photo_url
          ? <img src={cat.photo_url} alt={cat.name} className="cat-header-photo" />
          : <div className="cat-header-photo-placeholder"><ImagePlus size={20} /></div>}
        <div className="cat-header-camera"><Camera size={12} /></div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--rhino)' }}>{cat.name}</div>
        <div style={{ fontSize: 11, color: 'var(--rhino-dim)' }}>{passportId}{cat.breed ? ` · ${cat.breed}` : ''}</div>
      </div>
      <button className="passport-link-btn" onClick={onPassport}>ดูพาสปอร์ต</button>
    </div>
  )
}

// ===== Edit cat modal =====
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
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <Modal title="แก้ไขข้อมูลแมว" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">ชื่อแมว *</label>
      <input value={name} onChange={e => setName(e.target.value)} autoFocus />
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

// ===== Add cat modal =====
function AddCatModal({ onDone, onClose }) {
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [birthday, setBirthday] = useState('')
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const newCat = await api('/api/cats', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), breed: breed || undefined, birthday: birthday || undefined }),
      })
      if (photo) {
        const form = new FormData()
        form.append('photo', photo)
        await apiForm(`/api/cats/${newCat.id}/photo`, form)
      }
      onDone()
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <Modal title="เพิ่มแมวตัวใหม่" onClose={onClose}>
      {error && <div className="error-msg">{error}</div>}
      <label className="form-label">ชื่อแมว *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อแมว" autoFocus />
      <label className="form-label">สายพันธุ์</label>
      <BreedSelect value={breed} onChange={setBreed} />
      <label className="form-label">วันเกิด</label>
      <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
      <label className="form-label">รูปภาพ (ถ้ามี)</label>
      <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0] || null)} />
      <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={submit} disabled={saving}>
        {saving ? 'กำลังบันทึก...' : 'เพิ่มแมว'}
      </button>
    </Modal>
  )
}

// ===== Main CatsTab =====
export default function CatsTab({ selectedCatId, onSelectCat }) {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const navigate = useNavigate()

  const loadCats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api('/api/cats')
      setCats(data)
      if (data.length > 0 && !data.find(c => c.id === selectedCatId)) {
        onSelectCat(data[0].id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCats() }, [loadCats])

  if (loading) return <div className="sub">กำลังโหลด...</div>

  const selectedCat = cats.find(c => c.id === selectedCatId) || null

  function handleCatUpdate(updated) {
    setCats(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  return (
    <>
      {/* Cat switcher (shows even when 0 cats so user can still tap to add) */}
      {cats.length > 0 && (
        <CatSwitcher
          cats={cats}
          selectedCatId={selectedCatId}
          onSelect={onSelectCat}
          showAdd
          onAdd={() => setShowAdd(true)}
        />
      )}

      {error && <div className="error-msg">{error}</div>}

      {!error && cats.length === 0 && (
        <div className="empty-state">
          <PawPrint size={56} strokeWidth={1.2} color="var(--dull-pink)" />
          <div className="empty-title">ยังไม่มีแมว</div>
          <button className="primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>
            <Plus size={16} style={{ marginRight: 6 }} />เพิ่มแมวตัวแรก
          </button>
        </div>
      )}

      {selectedCat && (
        <>
          {/* Cat header row */}
          <CatHeader
            cat={selectedCat}
            onCatUpdate={handleCatUpdate}
            onPassport={() => navigate(`/cats/${selectedCat.id}/passport`)}
          />

          {/* Section menu grid */}
          <div className="cat-menu-grid">
            {MENU_ITEMS.map(({ id, Icon, label, color }) => (
              <div
                key={id}
                className="cat-menu-item"
                onClick={() => navigate(`/cats/${selectedCat.id}/${id}`)}
              >
                <Icon size={22} color={color} strokeWidth={1.8} />
                <span className="cat-menu-item-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Dashboard */}
          <CatDashboard catId={selectedCat.id} />
        </>
      )}

      {/* Edit cat modal */}
      {showEdit && selectedCat && (
        <EditCatModal
          cat={selectedCat}
          onDone={(updated) => { setShowEdit(false); handleCatUpdate(updated) }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Add cat modal */}
      {showAdd && (
        <AddCatModal
          onDone={() => { setShowAdd(false); loadCats() }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  )
}
