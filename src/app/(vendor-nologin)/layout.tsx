// src/app/(vendor-nologin)/layout.tsx
// Minimal layout for the vendor no-login route group.
// No auth check, no navigation bar — standalone pages only.
// Note: the root layout (src/app/layout.tsx) wraps this; no <html>/<body> tags here.

export default function VendorNologinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
