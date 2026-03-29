import { useCallback, KeyboardEvent } from 'react'

interface Options {
  itemCount: number
  activeIdx: number
  setActiveIdx: React.Dispatch<React.SetStateAction<number>>
  onEnter: () => void
  onEscape: () => void
}

export default function useKeyboard({ itemCount, setActiveIdx, onEnter, onEscape }: Options) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIdx((i) => Math.min(i + 1, itemCount - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIdx((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          onEnter()
          break
        case 'Escape':
          e.preventDefault()
          onEscape()
          break
      }
    },
    [itemCount, onEnter, onEscape, setActiveIdx]
  )

  return { handleKeyDown }
}
