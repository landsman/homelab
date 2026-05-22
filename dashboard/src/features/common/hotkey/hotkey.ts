/**
 * Unique hotkeys. All keyboard shortcuts require holding Shift to fire,
 * so that single-letter keys never collide with regular typing.
 */
export enum Hotkey {
  SPACE = 'Space',
  SHIFT_ONE = 'Shift+1',
  SHIFT_TWO = 'Shift+2',
  SHIFT_THREE = 'Shift+3',
  SHIFT_FOUR = 'Shift+4',
  SHIFT_FIVE = 'Shift+5',
  SHIFT_SIX = 'Shift+6',
  SHIFT_SEVEN = 'Shift+7',
  SHIFT_A = 'Shift+A',
  SHIFT_B = 'Shift+B',
  SHIFT_C = 'Shift+C',
  SHIFT_D = 'Shift+D',
  SHIFT_E = 'Shift+E',
  SHIFT_F = 'Shift+F',
  SHIFT_G = 'Shift+G',
  SHIFT_H = 'Shift+H',
  SHIFT_I = 'Shift+I',
  SHIFT_J = 'Shift+J',
  SHIFT_K = 'Shift+K',
  SHIFT_L = 'Shift+L',
  SHIFT_M = 'Shift+M',
  SHIFT_N = 'Shift+N',
  SHIFT_O = 'Shift+O',
  SHIFT_P = 'Shift+P',
  SHIFT_Q = 'Shift+Q',
  SHIFT_R = 'Shift+R',
  SHIFT_S = 'Shift+S',
  SHIFT_T = 'Shift+T',
  SHIFT_U = 'Shift+U',
  SHIFT_V = 'Shift+V',
  SHIFT_W = 'Shift+W',
  SHIFT_X = 'Shift+X',
  SHIFT_Y = 'Shift+Y',
  SHIFT_Z = 'Shift+Z',
}

/** Strip the `Shift+` prefix so the kbd label only shows the letter/digit. */
export function formatHotkeyLabel(key: string): string {
  return key.replace(/^Shift\+/, '')
}
