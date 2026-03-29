# Clipboard Manager — Desktop App Prompt

## Project overview

Build a **desktop Clipboard Manager** application for **Windows and macOS** using **Electron + React + TypeScript**. The app runs silently in the background, monitors the system clipboard, stores the last 20 copied items, and displays a floating popup when the user triggers a global keyboard shortcut — similar to Windows' built-in `Win + Shift + V` experience.

---

## How to use this prompt

This document is a **technical specification prompt** — paste it directly into an AI coding assistant (Claude, Cursor, GitHub Copilot Chat, etc.) to scaffold the full project. Recommended workflow:

### Step 1 — Scaffold the project

Paste this entire prompt and ask:

> "Read this spec and generate the complete project scaffold with all files listed in the project structure."

### Step 2 — Implement file by file

After scaffolding, ask for each file in order:

> "Implement `electron/main.ts` based on the spec above."
> "Implement `electron/preload.ts` based on the spec above."
> "Implement `src/components/ClipboardPopup.tsx` based on the spec above."

### Step 3 — Run and iterate

```bash
npm install
npm run dev        # start in development mode
```

Then describe bugs or missing features conversationally:

> "The popup doesn't close when I click outside. Fix it."
> "Add a timestamp like '2 minutes ago' under each item."

### Tips for best results

- Always keep this prompt open in context when asking follow-up questions
- If the AI drifts from the spec, paste the relevant section again and say "follow the spec"
- Ask one file at a time for complex files like `main.ts`
- If you get TypeScript errors, paste the full error message and ask to fix it

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Desktop shell | Electron | Cross-platform, easy clipboard + globalShortcut API |
| UI | React + Vite | Component-based, fast dev experience |
| Language | **TypeScript** | Type safety across both main and renderer process |
| State | `useState` / `useEffect` | Simple enough, no Redux needed |
| Storage | In-memory array in main process | Only 20 items, no DB needed |
| Auto-paste | `@nut-tree/nut-js` | Simulate Ctrl+V, easier to install than robotjs |
| Tray | Electron `Tray` API | Native system tray icon |

---

## Project structure

```
clipboard-manager/
├── electron/
│   ├── main.ts            # Electron main process
│   ├── tray.ts            # Tray icon setup
│   └── preload.ts         # Context bridge (IPC)
├── src/
│   ├── App.tsx            # Root component
│   ├── types/
│   │   └── index.ts       # Shared TypeScript types
│   ├── components/
│   │   ├── ClipboardPopup.tsx   # Main popup UI
│   │   ├── ClipboardItem.tsx    # Single item row
│   │   └── SearchBar.tsx        # Search input
│   ├── hooks/
│   │   └── useKeyboard.ts       # Arrow key + Enter navigation
│   └── main.tsx           # React entry point
├── tsconfig.json          # TypeScript config for renderer
├── tsconfig.electron.json # TypeScript config for main process
├── package.json
└── vite.config.ts
```

---

## Shared types (`src/types/index.ts`)

Define all shared types here. Both the main process and renderer import from this file.

```ts
export type ClipboardItemType = 'text' | 'url' | 'code' | 'email'

export interface ClipboardItem {
  id: number
  text: string
  time: Date
  type: ClipboardItemType
}

// Shape of the API exposed to the renderer via contextBridge
export interface ElectronAPI {
  onClipboardUpdate: (callback: (history: ClipboardItem[]) => void) => void
  selectItem: (text: string) => void
  hidePopup: () => void
}

// Extend the Window interface so TypeScript knows about window.electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
```

---

## Electron main process (`electron/main.ts`)

```ts
import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen } from 'electron'
import path from 'path'
import { ClipboardItem } from '../src/types'

let win: BrowserWindow | null = null
let lastClipboard = ''
const history: ClipboardItem[] = []
const MAX_ITEMS = 20

function addToHistory(text: string): void {
  const item: ClipboardItem = {
    id: Date.now(),
    text,
    time: new Date(),
    type: detectType(text),
  }
  history.unshift(item)
  if (history.length > MAX_ITEMS) history.pop()
}

function detectType(text: string): ClipboardItem['type'] {
  if (/^https?:\/\//.test(text)) return 'url'
  if (/^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(text)) return 'email'
  if (/[{}();=>]/.test(text)) return 'code'
  return 'text'
}

function showPopupAtCursor(): void {
  if (!win) return
  const { x, y } = screen.getCursorScreenPoint()
  win.setPosition(x, y)
  win.show()
  win.focus()
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 340,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('blur', () => win?.hide())

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  // Poll clipboard every 500ms
  setInterval(() => {
    const text = clipboard.readText()
    if (text && text !== lastClipboard) {
      lastClipboard = text
      addToHistory(text)
      win?.webContents.send('clipboard-update', history)
    }
  }, 500)

  // Register global shortcut
  globalShortcut.register('CommandOrControl+Shift+V', showPopupAtCursor)
})

// IPC: item selected → paste
ipcMain.on('item-selected', async (_event, text: string) => {
  clipboard.writeText(text)
  win?.hide()
  // Delay so the target app regains focus before paste fires
  setTimeout(async () => {
    const { keyboard, Key } = await import('@nut-tree/nut-js')
    await keyboard.pressKey(Key.LeftControl, Key.V)
    await keyboard.releaseKey(Key.LeftControl, Key.V)
  }, 150)
})

// IPC: hide popup (Esc key)
ipcMain.on('hide-popup', () => win?.hide())

app.on('will-quit', () => globalShortcut.unregisterAll())
```

---

## IPC bridge (`electron/preload.ts`)

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { ClipboardItem, ElectronAPI } from '../src/types'

const api: ElectronAPI = {
  onClipboardUpdate: (callback: (history: ClipboardItem[]) => void) => {
    ipcRenderer.on('clipboard-update', (_event, data: ClipboardItem[]) => callback(data))
  },
  selectItem: (text: string) => {
    ipcRenderer.send('item-selected', text)
  },
  hidePopup: () => {
    ipcRenderer.send('hide-popup')
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

---

## React popup UI (`src/components/ClipboardPopup.tsx`)

```tsx
import { useEffect, useState, KeyboardEvent } from 'react'
import { ClipboardItem } from '../types'
import SearchBar from './SearchBar'
import ClipboardItemRow from './ClipboardItem'

export default function ClipboardPopup() {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [query, setQuery] = useState<string>('')
  const [activeIdx, setActiveIdx] = useState<number>(0)

  useEffect(() => {
    window.electronAPI.onClipboardUpdate((history: ClipboardItem[]) => {
      setItems(history)
      setActiveIdx(0)
    })
  }, [])

  const filtered = items.filter(item =>
    item.text.toLowerCase().includes(query.toLowerCase())
  )

  const selectItem = (item: ClipboardItem): void => {
    window.electronAPI.selectItem(item.text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && filtered[activeIdx]) {
      selectItem(filtered[activeIdx])
    }
    if (e.key === 'Escape') {
      window.electronAPI.hidePopup()
    }
  }

  return (
    <div className="popup" onKeyDown={handleKeyDown} tabIndex={-1}>
      <SearchBar value={query} onChange={setQuery} shortcut="⌘⇧V" />
      <div className="list">
        {filtered.map((item, i) => (
          <ClipboardItemRow
            key={item.id}
            item={item}
            active={i === activeIdx}
            onClick={() => selectItem(item)}
            onHover={() => setActiveIdx(i)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="empty">No results for "{query}"</p>
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
```

---

## TypeScript configs

### `tsconfig.json` (renderer — React)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### `tsconfig.electron.json` (main process)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist-electron",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["electron"]
}
```

> Two separate tsconfig files are required because the main process uses CommonJS (`require`) while the renderer uses ESModules. Mixing them in one config causes build errors.

---

## `package.json` (key scripts)

```json
{
  "name": "clipboard-manager",
  "version": "0.1.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"tsc -p tsconfig.electron.json -w\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "tsc -p tsconfig.electron.json && vite build",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.electron.json --noEmit"
  },
  "dependencies": {
    "@nut-tree/nut-js": "^4.0.0",
    "electron": "^28.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "concurrently": "^8.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vite-plugin-electron": "^0.28.0",
    "wait-on": "^7.0.0"
  }
}
```

---

## Data model

```ts
// ClipboardItem shape (defined in src/types/index.ts)
interface ClipboardItem {
  id: number          // Date.now() — unique per item
  text: string        // the copied content
  time: Date          // when it was copied
  type: 'text' | 'url' | 'code' | 'email'   // auto-detected
}

// History rules:
// - Max 20 items, newest at index 0
// - When the 21st item arrives, pop() the last one
// - Stored in main process memory only (not localStorage)
```

---

## MVP feature checklist

- [ ] App runs in system tray on startup
- [ ] Clipboard polling every 500ms
- [ ] Max 20 items stored, newest first
- [ ] Global shortcut `Cmd/Ctrl + Shift + V` opens popup
- [ ] Popup appears near cursor position
- [ ] Search/filter items in real-time
- [ ] Keyboard navigation (↑↓ arrows)
- [ ] Enter to paste, Esc to close
- [ ] Popup auto-closes when it loses focus
- [ ] Selected item pasted into previously active app
- [ ] TypeScript strict mode passes with zero errors (`npm run typecheck`)

---

## Phase 2 ideas (after MVP)

- Pin important items so they don't get pushed out
- Show different icon per type (URL, code, email, plain text)
- `Cmd+1..9` to instantly select item by position
- Clear history option in tray right-click menu
- Launch on system startup via `app.setLoginItemSettings`
- Dark / light mode following system theme

---

## Notes

- **Do not use `localStorage`** — keep history in-memory in the main process. localStorage lives in the renderer and adds unnecessary IPC complexity.
- On **macOS**, the app needs Accessibility permission to simulate keystrokes. Check with `systemPreferences.isTrustedAccessibilityClient(true)` on first launch and prompt the user if not granted.
- On **Windows**, no special permissions needed.
- **`@nut-tree/nut-js`** is preferred over `robotjs` — it ships with pre-built binaries and doesn't require `node-gyp` compilation.
- Run `npm run typecheck` frequently during development to catch type errors early before they compound.