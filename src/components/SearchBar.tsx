import { forwardRef, KeyboardEvent } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  shortcut: string
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
}

const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, shortcut, onKeyDown },
  ref
) {
  return (
    <div className="search-bar">
      <svg
        className="search-icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={ref}
        type="text"
        className="search-input"
        placeholder="Search clipboard history..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
        spellCheck={false}
        autoComplete="off"
      />
      <kbd className="shortcut-badge">{shortcut}</kbd>
    </div>
  )
})

export default SearchBar
