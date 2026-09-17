import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { WeightPanel, AddWeightModal, HealthPanel, AddMedicalModal } from '../components/CatPassport'

export default function HealthPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const catId = parseInt(id)
  const [modal, setModal] = useState(null)
  const [weightVersion, setWeightVersion] = useState(0)
  const [healthVersion, setHealthVersion] = useState(0)

  return (
    <div>
      <button className="cat-menu-back" onClick={() => navigate('/cats')}>
        <ChevronLeft size={16} /> กลับ
      </button>

      <WeightPanel catId={catId} version={weightVersion} onAdd={() => setModal('addWeight')} />

      <div style={{ height: 8 }} />

      <HealthPanel catId={catId} version={healthVersion} onAdd={() => setModal('addMedical')} />

      {modal === 'addWeight' && (
        <AddWeightModal
          catId={catId}
          onDone={() => { setModal(null); setWeightVersion(v => v + 1) }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'addMedical' && (
        <AddMedicalModal
          catId={catId}
          onDone={() => { setModal(null); setHealthVersion(v => v + 1) }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
