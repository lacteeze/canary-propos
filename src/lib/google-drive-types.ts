// Shared Drive browse types — safe for client + server imports.

export type DriveListItem = {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  modifiedTime: string | null
  md5Checksum: string | null
  size: number | null
  thumbnailLink: string | null
}
