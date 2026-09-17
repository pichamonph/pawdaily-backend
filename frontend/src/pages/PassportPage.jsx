import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { api } from '../api'
import CatPassport from '../components/CatPassport'

const MASCOT = '/image/cat-wink.png'

export default function PassportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cat, setCat] = useState(null)

  useEffect(() => {
    document.body.style.background = 'var(--almond)'
    return () => { document.body.style.background = '' }
  }, [])

  useEffect(() => {
    api('/api/cats').then(cats => {
      const found = cats.find(c => c.id === parseInt(id))
      if (found) setCat(found)
    }).catch(() => {})
  }, [id])

  if (!cat) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 12 }}>
      <img src={MASCOT} alt="" style={{ width: 72, opacity: 0.7, animation: 'mascot-bounce 1.4s ease-in-out infinite' }} />
    </div>
  )

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
