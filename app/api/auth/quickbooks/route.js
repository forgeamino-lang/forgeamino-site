import { NextResponse } from 'next/server'
import { getAuthUrl } from '../../../../lib/quickbooks'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  if (key !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = getAuthUrl()
  return NextResponse.redirect(url)
}
