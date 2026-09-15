import { useState } from 'react'
import { ChevronDown, Check, Plus } from 'lucide-react'
import CatAvatar from './CatAvatar'

export default function CatSwitcher({ cats, selectedCatId, onSelect, showAdd = false, onAdd }) {
  const [open, setOpen] = useState(false)
  const selectedCat = cats.find(c => c.id === selectedCatId) || cats[0]

  if (!selectedCat) return null

  function handleSelect(catId) {
    onSelect(catId)
    setOpen(false)
  }

  function handleAdd() {
    setOpen(false)
    onAdd?.()
  }

  return (
    <>
      <button className="cat-switcher-btn" onClick={() => setOpen(true)}>
        <CatAvatar name={selectedCat.name} size={34} photoUrl={selectedCat.photo_url || undefined} />
        <span className="cat-switcher-name">{selectedCat.name}</span>
        <ChevronDown size={15} color="var(--rhino-dim)" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div className="sheet-overlay" onClick={() => setOpen(false)}>
          <div className="sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">เลือกแมว</div>

            {cats.map(cat => {
              const active = cat.id === selectedCatId
              return (
                <div
                  key={cat.id}
                  className={`sheet-cat-row${active ? ' selected' : ''}`}
                  onClick={() => handleSelect(cat.id)}
                >
                  <CatAvatar name={cat.name} size={42} photoUrl={cat.photo_url || undefined} />
                  <span className="sheet-cat-name" style={{ fontWeight: active ? 700 : 400 }}>
                    {cat.name}
                  </span>
                  {active && <Check size={18} color="var(--dull-pink)" style={{ flexShrink: 0 }} />}
                </div>
              )
            })}

            {showAdd && (
              <>
                <div className="sheet-divider" />
                <div className="sheet-add-row" onClick={handleAdd}>
                  <div className="sheet-add-icon">
                    <Plus size={20} color="var(--rhino-dim)" />
                  </div>
                  <span style={{ fontSize: 15, color: 'var(--rhino-dim)' }}>เพิ่มแมวใหม่</span>
                </div>
              </>
            )}

            <div style={{ height: 20 }} />
          </div>
        </div>
      )}
    </>
  )
}
