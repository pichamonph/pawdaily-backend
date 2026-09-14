import CatAvatar from './CatAvatar'

export default function CatAvatarStrip({ cats, onSelect }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      overflowX: 'auto',
      padding: '4px 0 8px',
      marginBottom: 8,
      scrollbarWidth: 'none',
    }}>
      {cats.map(cat => (
        <div
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}
        >
          <CatAvatar name={cat.name} size={44} photoUrl={cat.photo_url || undefined} />
          <span style={{
            fontSize: 11,
            color: 'var(--rhino)',
            maxWidth: 52,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
            {cat.name}
          </span>
        </div>
      ))}
    </div>
  )
}
