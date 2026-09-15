import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { api } from '../api'
import CatPassport from '../components/CatPassport'

export default function PassportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cat, setCat] = useState(null)

  useEffect(() => {
    api('/api/cats').then(cats => {
      const found = cats.find(c => c.id === parseInt(id))
      if (found) setCat(found)
    }).catch(() => {})
  }, [id])

  if (!cat) return <div className="sub" style={{ padding: 16 }}>กำลังโหลด...</div>

  return (
    <div>
      <button className="cat-menu-back" onClick={() => navigate('/cats')} style={{ padding: 16 }}>
        <ChevronLeft size={16} /> กลับ
      </button>
      <div style={{ padding: '0 16px 16px' }}>
        <CatPassport
          cat={cat}
          showHeader={true}
          onCatUpdate={updated => setCat(updated)}
        />
      </div>
    </div>
  )
}
