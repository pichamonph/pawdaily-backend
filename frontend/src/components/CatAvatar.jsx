const PALETTE = ['#DD8C96', '#C86E7A', '#4A5D80', '#2E4060']

function pickColor(name) {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return PALETTE[sum % PALETTE.length]
}

export default function CatAvatar({ name, size = 36 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: pickColor(name),
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(size * 0.44),
      fontWeight: 700,
      flexShrink: 0,
      fontFamily: 'Kanit, sans-serif',
    }}>
      {name.charAt(0)}
    </div>
  )
}
