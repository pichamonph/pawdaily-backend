import { useState, useEffect, useCallback } from 'react'
import { Plus, PawPrint } from 'lucide-react'
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

  const showCustom = selectVal === 'อื่นๆ'

  return (
    <>
      <select value={selectVal} onChange={handleSelect}>
        <option value="">-- เลือกสายพันธุ์ --</option>
        {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      {showCustom && (
        <input
          value={customVal}
          onChange={handleCustom}
          placeholder="ระบุสายพันธุ์"
        />
      )}
    </>
  )
}

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
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
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

export default function CatsTab({ selectedCatId, onSelectCat }) {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const loadCats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api('/api/cats')
      setCats(data)
      // If selectedCatId is no longer valid, select first
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>แมวของฉัน</h1>
        <button className="section-add-btn" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> เพิ่มแมว
        </button>
      </div>

      {/* Avatar strip (only when > 1 cat) */}
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

      {!error && cats.length > 0 && !selectedCat && (
        <div className="empty-state">
          <PawPrint size={56} strokeWidth={1.2} color="var(--dull-pink)" />
          <div className="empty-sub">เลือกแมวเพื่อดูข้อมูล</div>
        </div>
      )}

      {selectedCat && (
        <CatPassport key={selectedCat.id} cat={selectedCat} onCatUpdate={(updated) => {
          setCats(prev => prev.map(c => c.id === updated.id ? updated : c))
        }} />
      )}

      {showAdd && (
        <AddCatModal
          onDone={() => { setShowAdd(false); loadCats() }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  )
}
