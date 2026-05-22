import { mouse, keyboard, Button, Key, straightTo, Point } from '@nut-tree-fork/nut-js'
import type { MouseButton } from './types'

export { Button, Key }

export async function clickAt(x: number, y: number, button: MouseButton = 'left'): Promise<void> {
  await mouse.move(straightTo(new Point(x, y)))
  const btn = button === 'left' ? Button.LEFT : button === 'right' ? Button.RIGHT : Button.MIDDLE
  await mouse.click(btn)
}

export async function doubleClickAt(x: number, y: number, button: MouseButton = 'left'): Promise<void> {
  await mouse.move(straightTo(new Point(x, y)))
  const btn = button === 'left' ? Button.LEFT : button === 'right' ? Button.RIGHT : Button.MIDDLE
  await mouse.doubleClick(btn)
}

export async function typeText(text: string): Promise<void> {
  await keyboard.type(text)
}

export async function pressKey(...keys: Key[]): Promise<void> {
  await keyboard.pressKey(...keys)
}

export async function releaseKey(...keys: Key[]): Promise<void> {
  await keyboard.releaseKey(...keys)
}

export async function moveMouse(x: number, y: number): Promise<void> {
  await mouse.move(straightTo(new Point(x, y)))
}

export async function getCursorPos(): Promise<{ x: number; y: number }> {
  const pos = await mouse.getPosition()
  return { x: pos.x, y: pos.y }
}
