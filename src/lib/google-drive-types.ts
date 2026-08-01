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
  /** True when this item was resolved from a Drive shortcut. */
  resolvedFromShortcut?: boolean
}

/** Browse/list payload with empty-state diagnostics. */
export type DriveFolderListing = {
  items: DriveListItem[]
  folderId: string
  /** Total non-trashed children considered (folders + files + shortcuts). */
  totalChildCount: number
  /** Non-folder children that are not supported images (after shortcut resolve). */
  unsupportedFileCount: number
  /** Image count found in this folder only (not recursive). */
  imageCount: number
  /** Folder count among direct children. */
  folderCount: number
}
