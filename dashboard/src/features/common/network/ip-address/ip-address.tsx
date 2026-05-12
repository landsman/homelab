import { useState, useRef, useEffect } from 'react'
import { useIpAddress } from './use-ip-address.ts'
import { copyToClipboard } from '../../../../utils/copy-to-clipboard.ts'
import { Tooltip } from '../../../../app/components/tooltip.tsx'

export function IpAddress() {
  const { ipv4, ipv6, loadingV4, loadingV6, isOnline } = useIpAddress()
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  if (!isOnline) {
    return <span className="text-[10px] text-red-400 tracking-wide">offline</span>
  }

  const hasAny = loadingV4 || loadingV6 || ipv4 != null || ipv6 != null
  const copyValue = [ipv4, ipv6].filter(Boolean).join(' · ')

  async function handleCopy() {
    if (!copyValue) return
    const ok = await copyToClipboard(copyValue)
    if (ok) {
      if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current)
      setCopied(true)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <Tooltip content={copied ? 'Copied!' : 'Click to copy your IP'} placement="bottom">
      <button
        type="button"
        onClick={handleCopy}
        title="Click to copy IP"
        className="flex flex-row items-center gap-1 max-w-full overflow-hidden text-[10px] text-(--text-muted) tracking-wide tabular-nums cursor-pointer hover:text-slate-300 active:opacity-60 transition-colors select-none touch-manipulation"
      >
        <>
          {!hasAny && <span className="opacity-50 shrink-0">local</span>}
          {(loadingV4 || ipv4 != null) && (
            <span className="shrink-0">{loadingV4 && ipv4 == null ? '…' : ipv4}</span>
          )}
          {(loadingV6 || ipv6 != null) && (
            <>
              {/* Desktop: full IPv6 with separator */}
              <span className="opacity-30 shrink-0 hidden sm:inline">·</span>
              <span
                className="hidden sm:inline truncate max-w-40 lg:max-w-[16rem]"
                title={ipv6 ?? undefined}
              >
                {loadingV6 && ipv6 == null ? '…' : ipv6}
              </span>
              {/* Mobile: compact "(+ipv6)" badge when both are available */}
              {!loadingV6 && ipv4 != null && ipv6 != null && (
                <span className="sm:hidden opacity-60 shrink-0">(+ipv6)</span>
              )}
            </>
          )}
          {/* Mobile: red "(no ipv6)" when IPv4 is present but IPv6 is not */}
          {!loadingV6 && ipv4 != null && ipv6 == null && (
            <span className="sm:hidden text-red-400 shrink-0">(no ipv6)</span>
          )}
        </>
      </button>
    </Tooltip>
  )
}
