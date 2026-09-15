import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, PawPrint, Scale, Calendar, Wallet, ListChecks, Camera, ImagePlus, Pencil, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { api, apiForm } from '../api'
import Modal from './Modal'
import CatPassport from './CatPassport'
import CatAvatarStrip from './CatAvatarStrip'

const BREEDS = [
  'ไทย / วิเชียรมาศ', 'เปอร์เซีย', 'สก็อตติชโฟลด์', 'อเมริกันชอร์ตแฮร์',
  'เมนคูน', 'บริติชชอร์ตแฮร์', 'รัสเชียนบลู', 'สยาม', 'สายพันธุ์ผสม / ไม่ทราบ', 'อื่นๆ',
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

// ===== Dashboard =====
function CatDashboard({ catId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    api(`/api/cats/${catId}/dashboard`).then(setData).catch(() => {})
  }, [catId])

  if (!data) return null

  const { latestWeight, nextAppointment, monthExpenseTotal, routines } = data
  const TrendIcon = latestWeight?.trend === 'up' ? TrendingUp : latestWeight?.trend === 'down' ? TrendingDown : Minus

  return (
    <div className="dashboard-card">
      <div className="dashboard-grid">
        <div className="dash-item">
          <Scale size={15} color="var(--rhino-dim)" />
          <div className="dash-value">
            {latestWeight ? `${latestWeight.weight_kg} kg` : '—'}
          </div>
          {latestWeight?.trend && (
            <TrendIcon size={11} color={latestWeight.trend === 'up' ? '#dc2626' : '#16a34a'} />
          )}
          <div className="dash-label">น้ำหนัก</div>
        </div>
        <div className="dash-item">
          <Calendar size={15} color="var(--rhino-dim)" />
          <div className="dash-value" style={{ fontSize: 11 }}>
            {nextAppointment ? fmtDate(nextAppointment.next_due_date) : '—'}
          </div>
          {nextAppointment && (
            <div style={{ fontSize: 10, color: 'var(--rhino-dim)', textAlign: 'center', lineHeight: 1.2 }}>{nextAppointment.name}</div>
          )}
          <div className="dash-label">นัดถัดไป</div>
        </div>
        <div className="dash-item">
          <Wallet size={15} color="var(--rhino-dim)" />
          <div className="dash-value" style={{ fontSize: 12 }}>
            {monthExpenseTotal > 0
              ? `${monthExpenseTotal.toLocaleString('th-TH', { maximumFractionDigits: 0 })} ฿`
              : '—'}
          </div>
          <div className="dash-label">เดือนนี้</div>
        </div>
        <div className="dash-item">
          <ListChecks size={15} color="var(--rhino-dim)" />
          <div className="dash-value">{routines.doneToday}/{routines.total}</div>
          <div className="dash-label">วันนี้</div>
        </div>
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

// ===== Passport modal (read-only display) =====
function PassportModal({ cat, onClose, onEdit }) {
  const passportId = `PD-${String(cat.id).padStart(4, '0')}`
  return (
    <Modal title="" onClose={onClose}>
      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        {cat.photo_url
          ? <img src={cat.photo_url} alt={cat.name} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--almond-dim)', marginBottom: 12 }} />
          : <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--almond)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><PawPrint size={40} color="var(--dull-pink)" strokeWidth={1.5} /></div>
        }
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--rhino)', marginBottom: 4 }}>{cat.name}</div>
        <div style={{ fontSize: 12, color: 'var(--rhino-dim)', marginBottom: 12 }}>{passportId}</div>
        {(cat.breed || cat.birthday) && (
          <div style={{ background: 'var(--almond)', borderRadius: 10, padding: '10px 16px', textAlign: 'left', fontSize: 13, lineHeight: 1.8 }}>
            {cat.breed && <div><strong>สายพันธุ์:</strong> {cat.breed}</div>}
            {cat.birthday && <div><strong>วันเกิด:</strong> {fmtDate(cat.birthday)}</div>}
          </div>
        )}
        <button className="ghost" style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={onEdit}>
          <Pencil size={14} /> แก้ไขข้อมูล
        </button>
      </div>
    </Modal>
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
export default function CatsTab({ selectedCatId, onSelectCat, activeSection, onSectionChange }) {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showPassport, setShowPassport] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>แมวของฉัน</h1>
        <button className="section-add-btn" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> เพิ่มแมว
        </button>
      </div>

      {cats.length > 1 && (
        <CatAvatarStrip cats={cats} selectedCatId={selectedCatId} onSelect={onSelectCat} />
      )}

      {error && <div className="error-msg">{error}</div>}

      {!error && cats.length === 0 && (
        <div className="empty-state">
          <PawPrint size={56} strokeWidth={1.2} color="var(--dull-pink)" />
          <div className="empty-title">ยังไม่มีแมว</div>
          <div className="empty-sub">กดปุ่มเพิ่มแมวเพื่อเริ่มต้น</div>
        </div>
      )}

      {selectedCat && (
        <>
          {/* Cat header row */}
          <CatHeader
            cat={selectedCat}
            onCatUpdate={handleCatUpdate}
            onPassport={() => setShowPassport(true)}
          />

          {/* Dashboard */}
          <CatDashboard catId={selectedCat.id} />

          {/* Section panels via CatPassport (no header) */}
          <CatPassport
            key={selectedCat.id}
            cat={selectedCat}
            showHeader={false}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            onCatUpdate={handleCatUpdate}
          />
        </>
      )}

      {/* Passport modal */}
      {showPassport && selectedCat && (
        <PassportModal
          cat={selectedCat}
          onClose={() => setShowPassport(false)}
          onEdit={() => { setShowPassport(false); setShowEdit(true) }}
        />
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
