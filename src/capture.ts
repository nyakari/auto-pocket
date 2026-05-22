import { Window, Monitor } from 'node-screenshots'
import type { WindowInfo, CaptureResult } from './types'

export function listWindows(): WindowInfo[] {
  return Window.all()
    .filter(w => w.title().length > 0)
    .map(w => ({
      id: w.id(),
      title: w.title(),
      appName: w.appName(),
      pid: w.pid(),
      x: w.x(),
      y: w.y(),
      width: w.width(),
      height: w.height(),
    }))
}

export async function captureWindow(handle: number): Promise<CaptureResult> {
  const windows = Window.all()
  const win = windows.find(w => w.id() === handle)
  if (!win) throw new Error(`No window found with handle ${handle}`)
  const image = await win.captureImage()
  const png = await image.toPng()
  return {
    image: png,
    window: {
      id: win.id(),
      title: win.title(),
      appName: win.appName(),
      pid: win.pid(),
      x: win.x(),
      y: win.y(),
      width: win.width(),
      height: win.height(),
    },
  }
}

export async function captureScreen(display?: number): Promise<Buffer> {
  const monitors = Monitor.all()
  const mon = display !== undefined ? monitors[display] : monitors.find(m => m.isPrimary()) ?? monitors[0]
  if (!mon) throw new Error('No display found')
  const image = await mon.captureImage()
  return image.toPng()
}

export function findWindowsByTitle(match: string | RegExp): WindowInfo[] {
  return Window.all()
    .filter(w => {
      const title = w.title()
      if (typeof match === 'string') return title.includes(match)
      return match.test(title)
    })
    .map(w => ({
      id: w.id(),
      title: w.title(),
      appName: w.appName(),
      pid: w.pid(),
      x: w.x(),
      y: w.y(),
      width: w.width(),
      height: w.height(),
    }))
}
