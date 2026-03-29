import { contextBridge, ipcRenderer } from 'electron'
import { ClipboardItem, ElectronAPI } from '../src/types'

const api: ElectronAPI = {
  onClipboardUpdate: (callback: (history: ClipboardItem[]) => void) => {
    ipcRenderer.removeAllListeners('clipboard-update')
    ipcRenderer.on('clipboard-update', (_event, data: ClipboardItem[]) => callback(data))
  },
  onPopupShown: (callback: () => void) => {
    ipcRenderer.removeAllListeners('popup-shown')
    ipcRenderer.on('popup-shown', () => callback())
  },
  selectItem: (text: string) => {
    ipcRenderer.send('item-selected', text)
  },
  hidePopup: () => {
    ipcRenderer.send('hide-popup')
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
