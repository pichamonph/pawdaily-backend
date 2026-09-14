import CatAvatar from './CatAvatar'

export default function CatAvatarStrip({ cats, selectedCatId, onSelect }) {
  return (
    <div className="avatar-sel-strip">
      {cats.map(cat => (
        <div
          key={cat.id}
          className={`avatar-sel-item${cat.id === selectedCatId ? ' active' : ''}`}
          onClick={() => onSelect(cat.id)}
        >
          <div className="avatar-sel-ring">
            <CatAvatar name={cat.name} size={44} photoUrl={cat.photo_url || undefined} />
          </div>
          <span>{cat.name}</span>
        </div>
      ))}
    </div>
  )
}
