import type { ImgHTMLAttributes } from 'react'
import { resolveAsset } from '../config/routing/base-path'

// Drop-in <img> wrapper that resolves bare or root-absolute `src` values
// against the runtime base path (window.__BASE_PATH__). Lets the rest of the
// app keep writing `<Img src="/icons/ui/refresh.svg" />` while still working
// when the app is mounted at a subpath like /dashboard/.
//
// Pass-through for absolute URLs (http://, https://, //, data:, blob:).
export function Image({ src, alt = '', ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={typeof src === 'string' && src.length > 0 ? resolveAsset(src) : src}
      alt={alt}
      {...rest}
    />
  )
}
