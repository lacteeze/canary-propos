/** Copy bytes into a real ArrayBuffer. TS 5.7+ types Uint8Array as ArrayBufferLike, which is not BodyInit. */
export function binaryResponseBody(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(out).set(bytes)
  return out
}
