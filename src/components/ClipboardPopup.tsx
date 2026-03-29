import { useEffect, useState, useRef, KeyboardEvent, useCallback, useMemo } from 'react'
import { ClipboardItem } from '../types'
import SearchBar from './SearchBar'
import ClipboardItemRow from './ClipboardItem'

export default function ClipboardPopup() {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [query, setQuery] = useState<string>('')
  const [activeIdx, setActiveIdx] = useState<number>(0)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const usingKeyboard = useRef(false)
  const filteredRef = useRef<ClipboardItem[]>([])
  const activeIdxRef = useRef(0)

  useEffect(() => {
    window.electronAPI.onClipboardUpdate((history: ClipboardItem[]) => {
      setItems(history)
      setActiveIdx(0)
    })
  }, [])

  // Focus search input every time popup is shown
  useEffect(() => {
    window.electronAPI.onPopupShown(() => {
      searchRef.current?.focus()
    })
  }, [])

  // Reset active index when query changes
  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.children[activeIdx] as HTMLElement | undefined
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const filtered = useMemo(() =>
    items.filter((item) => item.text.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  )
  filteredRef.current = filtered
  activeIdxRef.current = activeIdx

  const selectItem = (item: ClipboardItem): void => {
    window.electronAPI.selectItem(item.text)
  }

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      usingKeyboard.current = true
      setActiveIdx((i) => Math.min(i + 1, filteredRef.current.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      usingKeyboard.current = true
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const item = filteredRef.current[activeIdxRef.current]
      if (item) window.electronAPI.selectItem(item.text)
    } else if (e.key === 'Escape') {
      window.electronAPI.hidePopup()
    }
  }, [])

  const shortcut = navigator.platform.includes('Mac') ? '⌘⇧V' : 'Ctrl+Shift+V'

  return (
    <div className="popup" tabIndex={-1}>
      <SearchBar
        ref={searchRef}
        value={query}
        onChange={setQuery}
        shortcut={shortcut}
        onKeyDown={handleKeyDown}
      />
      <div className="list" ref={listRef} role="listbox" onMouseMove={() => { usingKeyboard.current = false }}>
        {filtered.map((item, i) => (
          <ClipboardItemRow
            key={item.id}
            item={item}
            active={i === activeIdx}
            onClick={() => selectItem(item)}
            onHover={() => {
              if (!usingKeyboard.current) setActiveIdx(i)
            }}
          />
        ))}
        {filtered.length === 0 && (
          <p className="empty">
            {items.length === 0 ? 'No clipboard history yet' : `No results for "${query}"`}
          </p>
        )}
      </div>
      <div className="footer">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> paste</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>
  )
}
