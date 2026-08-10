import { NextRequest, NextResponse } from 'next/server'
import { getMacroKPI, generateMacroCommentary } from '@/lib/macro-kpi'
import { SECTOR_KPI } from '@/components/SectorWatchPanel'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get('sector') || 'macro'
  const withAI  = req.nextUrl.searchParams.get('ai') === '1'

  const indicators = await getMacroKPI(sector)

  let commentary = ''
  if (withAI && indicators.length) {
    const sectorLabel = SECTOR_KPI[sector]?.label || sector
    commentary = await generateMacroCommentary(sectorLabel, indicators)
  }

  return NextResponse.json({ sector, indicators, commentary, updatedAt: new Date().toISOString() })
}
