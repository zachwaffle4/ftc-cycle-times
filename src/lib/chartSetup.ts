import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import type { Plugin } from 'chart.js'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
)

interface BreakAnnotation {
  idx: number
  label: string
}

interface VerticalBreaksOptions {
  indices?: number[]
  replayGaps?: BreakAnnotation[]
}

interface AnnotatedChart extends Chart {
  _annotations?: { px: number; label: string }[]
  _breakYTop?: number
  _breakYBot?: number
}

/** Draws dashed vertical lines marking schedule breaks / replay gaps on a line chart,
 *  with a hover tooltip. Ported from the reference tool's Chart.js plugin — operates
 *  purely on chart pixel geometry, so it's reused unchanged for any Line chart that
 *  sets `options.plugins.verticalBreaks`. */
const verticalBreaksPlugin: Plugin = {
  id: 'verticalBreaks',
  afterDraw(chart: Chart) {
    const opts = (chart.options.plugins as { verticalBreaks?: VerticalBreaksOptions } | undefined)
      ?.verticalBreaks
    if (!opts) return
    const c = chart as AnnotatedChart
    const { ctx, scales } = chart
    const x = scales.x
    const y = scales.y
    c._annotations = []
    c._breakYTop = y.top
    c._breakYBot = y.bottom

    function drawLines(items: BreakAnnotation[], nullBetween: boolean, color: string, dash: number[]) {
      if (!items?.length) return
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.setLineDash(dash)
      for (const { idx, label } of items) {
        const px = nullBetween
          ? (x.getPixelForValue(idx - 1) + x.getPixelForValue(idx + 1)) / 2
          : (x.getPixelForValue(idx - 1) + x.getPixelForValue(idx)) / 2
        c._annotations!.push({ px, label })
        ctx.beginPath()
        ctx.moveTo(px, y.top)
        ctx.lineTo(px, y.bottom)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.restore()
    }

    drawLines(
      (opts.indices ?? []).map((idx) => ({ idx, label: '— break —' })),
      true,
      'rgba(136,136,136,0.55)',
      [5, 4],
    )
    drawLines(opts.replayGaps ?? [], false, 'rgba(245,158,11,0.65)', [3, 3])
  },
  afterEvent(chart: Chart, args: { event: { type: string; x: number | null; y: number | null } }) {
    const c = chart as AnnotatedChart
    const e = args.event
    const anns = c._annotations
    if (!anns?.length || e.x == null || e.y == null) return
    const ex = e.x
    const ey = e.y
    let tip = document.getElementById('_break-tip')
    if (!tip) {
      tip = document.createElement('div')
      tip.id = '_break-tip'
      tip.style.cssText =
        'position:fixed;background:rgba(17,17,17,0.82);color:#fff;padding:3px 9px;border-radius:4px;' +
        'font-size:0.78rem;pointer-events:none;z-index:9999;white-space:nowrap;display:none;'
      document.body.appendChild(tip)
    }
    if (e.type === 'mousemove') {
      const inArea = ey >= (c._breakYTop ?? 0) && ey <= (c._breakYBot ?? 0)
      const hit = inArea ? anns.find((a) => Math.abs(ex - a.px) <= 8) : null
      if (hit) {
        const rect = chart.canvas.getBoundingClientRect()
        tip.textContent = hit.label
        tip.style.left = rect.left + ex + 14 + 'px'
        tip.style.top = rect.top + ey - 14 + 'px'
        tip.style.display = 'block'
      } else {
        tip.style.display = 'none'
      }
    } else if (e.type === 'mouseout') {
      tip.style.display = 'none'
    }
  },
}

Chart.register(verticalBreaksPlugin)

export { Chart }
