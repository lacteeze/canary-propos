// GET /api/drive/thumbnail/[fileId]
// Proxies a Google Drive thumbnail for the manager UI (thumbnailLink needs auth/cookies).
// Manager-only; uses the org's stored Drive OAuth tokens.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { binaryResponseBody } from '@/lib/http/binary-response-body'
import {
  fetchDriveThumbnail,
  refreshDriveTokenIfNeeded,
} from '@/lib/google-drive'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ fileId: string }> },
) {
  const { fileId: rawId } = await context.params
  const fileId = decodeURIComponent(rawId ?? '').trim()
  // Drive file ids are opaque alphanumeric tokens (may include _ - .)
  if (!fileId || fileId.length > 256 || !/^[A-Za-z0-9._-]+$/.test(fileId)) {
    return NextResponse.json({ error: 'Invalid file id.' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const roles = person.role as unknown as string[] | null
  if (!roles?.includes('manager') && !roles?.includes('admin')) {
    return NextResponse.json(
      { error: 'Only managers can view Drive thumbnails.' },
      { status: 403 },
    )
  }

  try {
    const accessToken = await refreshDriveTokenIfNeeded(person.org_id, supabase)
    const thumb = await fetchDriveThumbnail(accessToken, fileId)
    if (!thumb) {
      return new NextResponse(null, { status: 404 })
    }

    return new NextResponse(binaryResponseBody(new Uint8Array(thumb.buffer)), {
      status: 200,
      headers: {
        'Content-Type': thumb.contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[drive/thumbnail]', err)
    return NextResponse.json(
      { error: 'Failed to load Drive thumbnail.' },
      { status: 502 },
    )
  }
}
