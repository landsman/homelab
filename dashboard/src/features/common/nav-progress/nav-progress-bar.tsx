import { useNavProgress } from './nav-progress'

export function NavProgressBar() {
  const { active } = useNavProgress()
  if (!active) return null
  return (
    <div
      aria-hidden="true"
      role="progressbar"
      className="pointer-events-none fixed top-0 left-0 right-0 z-[200] h-[2px]"
    >
      <div className="nav-progress h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 shadow-[0_0_10px_rgba(56,189,248,0.7)] motion-reduce:animate-none" />
    </div>
  )
}
