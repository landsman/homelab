export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  // 1. If not secure or no clipboard API, try fallback immediately (sync) to preserve user gesture
  if (!navigator.clipboard || !window.isSecureContext) {
    return fallbackCopy(text)
  }

  // 2. Try modern API (requires secure context)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('navigator.clipboard.writeText failed, falling back', err)
    return fallbackCopy(text)
  }
}

function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.focus({ preventScroll: true })
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch (err) {
    console.error('Failed to copy to clipboard', err)
    return false
  }
}
