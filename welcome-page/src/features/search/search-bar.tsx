import { forwardRef } from 'react'
import { HotKey } from '../common/hotkey/hot-key.tsx'
import { Image } from '../../app/components/image'

interface SearchBarProps {
  query: string
  onChange: (value: string) => void
  placeholder?: string
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { query, onChange, placeholder = 'Search…' },
  ref
) {
  return (
    <div className="flex justify-end w-full">
      <div className="relative w-full">
        <Image
          src="/icons/ui/search.svg"
          alt=""
          className="absolute left-3 top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-[var(--text-muted)] pointer-events-none opacity-50 invert"
        />
        <input
          ref={ref}
          type="search"
          value={query}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') e.currentTarget.blur()
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-16 py-3 text-sm bg-[#060a0f] border border-[var(--dim)] rounded-lg text-slate-100 placeholder-[var(--text-muted)] focus:outline-none focus:border-slate-400 focus:bg-[#080d15] transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
        />
        <HotKey className="hidden md:block pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] border border-(--border) rounded px-1.5 py-0.5">
          Space
        </HotKey>
      </div>
    </div>
  )
})
