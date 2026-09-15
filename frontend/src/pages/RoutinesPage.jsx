import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { RoutinesPanel, AddRoutineModal } from '../components/CatPassport'

export default function RoutinesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const catId = parseInt(id)
  const [modal, setModal] = useState(null)
  const [version, setVersion] = useState(0)

  return (
    <div>
      <button className="cat-menu-back" onClick={() => navigate('/cats')}>
        <ChevronLeft size={16} /> กลับ
      </button>
      <RoutinesPanel catId={catId} version={version} onAdd={() => setModal('add')} />
      {modal && (
        <AddRoutineModal
          catId={catId}
          onDone={() => { setModal(null); setVersion(v => v + 1) }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
