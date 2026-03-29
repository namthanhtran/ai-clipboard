import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen, systemPreferences, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { ClipboardItem } from '../src/types'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let lastClipboard = ''
const history: ClipboardItem[] = []
const MAX_ITEMS = 20

function detectType(text: string): ClipboardItem['type'] {
  if (/^https?:\/\//.test(text.trim())) return 'url'
  if (/^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(text.trim())) return 'email'
  if (/[{}();=>]/.test(text) || text.includes('\n')) return 'code'
  return 'text'
}

function addToHistory(text: string): void {
  // Move to top if duplicate
  const existingIdx = history.findIndex((item) => item.text === text)
  if (existingIdx !== -1) history.splice(existingIdx, 1)

  const item: ClipboardItem = {
    id: Date.now(),
    text,
    time: new Date(),
    type: detectType(text),
  }
  history.unshift(item)
  if (history.length > MAX_ITEMS) history.pop()
}

let isShowing = false

function showPopupAtCursor(): void {
  if (!win) return
  const { x, y } = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint({ x, y })
  const { bounds } = display

  const winW = 340
  const winH = 380
  const clampedX = Math.min(x, bounds.x + bounds.width - winW)
  const clampedY = Math.min(y, bounds.y + bounds.height - winH)

  win.setPosition(Math.max(bounds.x, clampedX), Math.max(bounds.y, clampedY))

  isShowing = true
  win.show()
  win.focus()
  // Focus the web content so keyboard works immediately without clicking first
  win.webContents.focus()
  win.webContents.send('popup-shown')
  setTimeout(() => { isShowing = false }, 300)
}

function createWindow(): void {
  const iconPath = path.join(__dirname, '../assets/logo.png')
  const appIcon = nativeImage.createFromPath(iconPath)

  win = new BrowserWindow({
    width: 340,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('blur', () => {
    if (!isShowing) win?.hide()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setAlwaysOnTop(true, 'floating')
  }
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../assets/trayIconTemplate.png')
  let icon = nativeImage.createFromPath(iconPath)
  if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('Clipboard Manager')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Clipboard History',
      accelerator: 'CommandOrControl+Shift+V',
      click: () => showPopupAtCursor(),
    },
    { type: 'separator' },
    {
      label: 'Clear History',
      click: () => {
        history.length = 0
        lastClipboard = ''
        win?.webContents.send('clipboard-update', history)
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.exit(0) },
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => tray?.popUpContextMenu())
}

function checkAccessibility(): void {
  if (process.platform !== 'darwin') return
  const trusted = systemPreferences.isTrustedAccessibilityClient(false)
  if (!trusted) systemPreferences.isTrustedAccessibilityClient(true)
}

// IPC: item selected → write to clipboard → hide → paste
ipcMain.on('item-selected', async (_event, text: string) => {
  clipboard.writeText(text)
  lastClipboard = text  // prevent polling from re-adding this item
  win?.hide()
  // On macOS: hide the app so macOS naturally returns focus to the previous app+input
  if (process.platform === 'darwin') {
    app.hide()
  }
  // Wait for focus to return to the previous app
  await new Promise<void>((resolve) => setTimeout(resolve, 50))
  try {
    const { keyboard, Key } = await import('@nut-tree-fork/nut-js')
    if (process.platform === 'darwin') {
      await keyboard.pressKey(Key.LeftSuper, Key.V)
      await keyboard.releaseKey(Key.LeftSuper, Key.V)
    } else {
      await keyboard.pressKey(Key.LeftControl, Key.V)
      await keyboard.releaseKey(Key.LeftControl, Key.V)
    }
  } catch (err) {
    // Auto-paste failed — text is already in clipboard, user can paste manually
    console.error('Auto-paste failed:', (err as Error).message)
  }
})

// IPC: hide popup (Esc key)
ipcMain.on('hide-popup', () => win?.hide())

app.whenReady().then(() => {
  checkAccessibility()
  createWindow()
  createTray()

  if (app.dock) {
    const iconPath = path.join(__dirname, '../assets/logo.png')
    const dockIcon = nativeImage.createFromPath(iconPath)
    if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon)
    app.dock.hide()
  }

  // Poll clipboard every 500ms
  setInterval(() => {
    try {
      const text = clipboard.readText()
      if (text && text !== lastClipboard) {
        lastClipboard = text
        addToHistory(text)
        win?.webContents.send('clipboard-update', history)
      }
    } catch {
      // Clipboard temporarily unavailable — ignore
    }
  }, 500)

  globalShortcut.register('CommandOrControl+Shift+V', showPopupAtCursor)
})

app.on('window-all-closed', () => { /* keep running in tray */ })

app.on('will-quit', () => globalShortcut.unregisterAll())
