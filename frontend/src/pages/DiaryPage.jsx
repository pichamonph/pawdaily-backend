import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { DiaryPanel, AddDiaryModal } from '../components/CatPassport'

export default function DiaryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const catId = parseInt(id)
  const [modal, setModal] = useState(null)
  const [diaryInitialDate, setDiaryInitialDate] = useState(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    document.body.style.background = 'var(--almond)'
    return () => { document.body.style.background = '' }
  }, [])

  function openDiaryAdd(dateStr) {
    setDiaryInitialDate(dateStr)
    setModal('add')
  }

  return (
    <div>
      <button className="cat-menu-back" onClick={() => navigate('/cats')}>
        <ChevronLeft size={16} /> กลับ
      </button>
      <DiaryPanel catId={catId} version={version} onAdd={openDiaryAdd} />
      {modal && (
        <AddDiaryModal
          catId={catId}
          initialDate={diaryInitialDate}
          onDone={() => { setModal(null); setVersion(v => v + 1) }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
