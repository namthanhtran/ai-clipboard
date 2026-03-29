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
  onPopupShown: (callback: () => void) => void
  selectItem: (text: string) => void
  hidePopup: () => void
}

// Extend the Window interface so TypeScript knows about window.electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
