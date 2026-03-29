import { ClipboardItem } from '../types'

interface Props {
  item: ClipboardItem
  active: boolean
  onClick: () => void
  onHover: () => void
}

function formatTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return new Date(date).toLocaleDateString()
}

export default function ClipboardItemRow({ item, active, onClick, onHover }: Props) {
  return (
    <div
      className={`item ${active ? 'active' : ''} type-${item.type}`}
      onClick={onClick}
      onMouseEnter={onHover}
      role="option"
      aria-selected={active}
    >
      <span className="item-text">{item.text}</span>
      <div className="item-meta">
        <span className="item-type">{item.type}</span>
        <span className="item-time">{formatTime(item.time)}</span>
      </div>
    </div>
  )
}
