import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Home, Dices, Bookmark, RefreshCw, ChevronRight, ChevronDown, Trash2, ArrowLeft, UserRound, Smartphone, Crown, Download, Settings, ShieldCheck, HelpCircle, Info, LogOut, Send, FileText, Database, Mail, Eye, MousePointerClick, Users, Activity, LayoutDashboard, Radio } from 'lucide-react'
import { drawSyncInterval, fetchHistory, fetchRecords, gameOrder, generate, games, mergeRecords, readRecordsCache, rules, writeRecordsCache } from './data'
import { playRules } from './playRules'
import packageMetadata from '../package.json'
import './styles.css'

const storageKey = 'caishutong-plans'
const navigationStorageKey = 'caishutong-navigation-state'
const readNavigationState = () => {
  try {
    if (new URLSearchParams(location.search).get('nav') !== '1') return null
    return JSON.parse(sessionStorage.getItem(navigationStorageKey) || 'null')
  } catch { return null }
}
const analyticsVisitorKey = 'caishutong-anonymous-visitor'
const analyticsSessionKey = 'caishutong-anonymous-session'
const anonymousId = (storage,key) => {
  try { let value = storage.getItem(key); if (!value) { value = crypto.randomUUID(); storage.setItem(key,value) } return value } catch { return crypto.randomUUID() }
}
function trackAnalytics(event, details = {}) {
  if (location.pathname.startsWith('/admin')) return
  const body = JSON.stringify({ event, page:details.page || '', game:details.game || '', visitorId:anonymousId(localStorage,analyticsVisitorKey), sessionId:anonymousId(sessionStorage,analyticsSessionKey) })
  fetch('/api/analytics',{ method:'POST', headers:{'Content-Type':'application/json'}, body, keepalive:true }).catch(() => {})
}
const Balls = ({ groups, small = false }) => {
  const visible = groups.filter(group => group.values?.length)
  return <div className={`balls ${small ? 'small' : ''}`}>{visible.map((g, i) => <React.Fragment key={i}>{i > 0 && <span className="plus">+</span>}{g.values.map((n, j) => <span className={`ball ${g.accent ? 'blue' : 'red'}`} key={j}>{n}</span>)}</React.Fragment>)}</div>
}

const PlanEntryLabel = ({ text, fallback }) => {
  if (!text) return <em>{fallback}</em>
  const [kind, ...details] = text.split(' · ')
  const visibleDetails = kind === '模拟' ? [] : details
  return <em className={visibleDetails.length ? 'stacked-label' : ''}><span>{kind}</span>{visibleDetails.length > 0 && <span>{visibleDetails.join(' · ')}</span>}</em>
}

const waitForPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

function BatchExportWorkspace({ job }) {
  if (!job) return null
  const renderJob = () => {
    if (job.kind === 'trend') return <TraditionalTrendTable key={job.exportId} game={job.game} history={job.history} save={() => {}} initialExpanded initialShowMisses={job.showMisses} exportId={job.exportId} autoExport exportFilename={job.filename} exportTitle={job.title} exportParams={job.params} onExportComplete={job.onComplete}/>
    if (job.kind === 'heat') {
      const HeatComponent = job.game === 'dlt' ? DltHeatTrend : SsqHeatTrend
      return <HeatComponent key={job.exportId} history={job.history} exportId={job.exportId} autoExport exportFilename={job.filename} exportTitle={job.title} exportParams={job.params} onExportComplete={job.onComplete}/>
    }
    if (job.kind === 'kl8') return <Kl8DataViews key={job.exportId} history={job.history} exportId={job.exportId} viewOverride={job.view} autoExport exportFilename={job.filename} exportTitle={job.title} exportParams={job.params} onExportComplete={job.onComplete}/>
    if (job.kind === 'qxc-history') return <QxcHistoryStrip key={job.exportId} history={job.history} exportId={job.exportId} autoExport exportFilename={job.filename} exportTitle={job.title} exportParams={job.params} onExportComplete={job.onComplete}/>
    if (job.kind === 'comprehensive') return <ComprehensiveData key={job.exportId} game={job.game} history={job.history} initialPeriod={job.period} exportId={job.exportId} autoExport exportFilename={job.filename} exportTitle={job.title} exportParams={job.params} onExportComplete={job.onComplete}/>
    return <Detail key={job.exportId} item={job.item} all={job.all} back={() => {}} onSwitchGame={() => {}} onOpen={() => {}} exportId={job.exportId} autoExport exportFilename={job.filename} exportTitle={job.title} exportParams={job.params} onExportComplete={job.onComplete}/>
  }
  const pageTransition = document.querySelector('.page-transition')
  if (!pageTransition) return null
  const node = renderJob()
  if (job.kind === 'detail') return createPortal(React.cloneElement(node, { className: 'batch-export-node' }), pageTransition)
  const pageClass = ['qxc-history','comprehensive'].includes(job.kind) ? 'detail-page' : 'trend-page'
  return createPortal(<main className={`${pageClass} batch-export-node`} aria-hidden="true">{node}</main>, pageTransition)
}

function HomePage({ open, openTrend, openHistory, openRules, canExport = false }) {
  const cached = useMemo(() => readRecordsCache(), [])
  const [all, setAll] = useState(() => cached?.records || []), [loading, setLoading] = useState(() => !cached?.records?.length), [error, setError] = useState(''), [stamp, setStamp] = useState(() => cached?.savedAt ? new Date(cached.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '')
  const allRef = useRef(all)
  const [batchJob, setBatchJob] = useState(null), [batchExporting, setBatchExporting] = useState(false), [batchProgress, setBatchProgress] = useState({ current:0, total:0 })
  // 首页只展示每个彩种的最新一期；历史与走势图按需加载，避免首屏携带 120 期数据。
  // 部分彩种临时失败时，保留已有记录，避免一次请求把整张首页列表替换成不完整结果。
  const load = async () => { setLoading(true); setError(''); try { const rows = await fetchRecords(1); setAll(current => { const byGame = new Map(); for (const record of [...rows, ...current]) { if (!record?.game) continue; const previous = byGame.get(record.game); if (!previous || Number(record.issue) > Number(previous.issue)) byGame.set(record.game, record) } const merged = gameOrder.map(game => byGame.get(game)).filter(Boolean); allRef.current = merged; writeRecordsCache(merged); return merged }); setStamp(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })) } catch (e) { if (!allRef.current.length) setError(e.message) } finally { setLoading(false) } }
  useEffect(() => {
    let timer
    let active = true
    const refresh = () => { if (active && !document.hidden) load() }
    // 有缓存也立即向统一 API 校准一次，缓存只做首屏占位，不作为最终开奖结果。
    refresh()
    const schedule = () => {
      timer = setTimeout(() => { refresh(); schedule() }, drawSyncInterval())
    }
    schedule()
    const onFocus = () => refresh()
    const onVisibility = () => { if (!document.hidden) refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { active = false; clearTimeout(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  const latest = gameOrder.map(g => all.find(r => r.game === g)).filter(Boolean)
  const displayRows = gameOrder.map(game => ({ game, record: all.find(record => record.game === game) }))
  const exportBatch = async () => {
    if (!canExport || batchExporting || !latest.length) return
    const exportItems = gameOrder.map(game => ({ game, item:all.find(record => record.game === game) })).filter(entry => entry.item)
    // 首页批量导出复用内页导出规则：基础走势图（显示/隐藏遗漏各一张）、完整详情图，
    // 再加上该彩种内页实际提供的冷热图 / 快乐8图表 / 七星彩历史长图。
    const total = exportItems.reduce((count, { game }) => count + 3 + (['dlt','ssq'].includes(game) ? 1 : 0) + (game === 'kl8' ? 2 : 0) + (game === 'qxc' ? 1 : 0), 0)
    setBatchExporting(true); setBatchProgress({ current:0, total })
    try {
      const histories = Object.fromEntries(await Promise.all(exportItems.map(async ({ game }) => {
        try { return [game, await fetchHistory(game)] } catch { return [game, all.filter(record => record.game === game)] }
      })))
      let current = 0
      const runJob = job => new Promise(resolve => {
        current += 1
        setBatchProgress({ current, total })
        setBatchJob({ ...job, onComplete:resolve })
      })
      for (const { game, item } of exportItems) {
        const trendPeriod = Math.min(histories[game]?.length || 0, 50)
        const patternParams = ['ssq','dlt'].includes(game) ? ' · 连号标记：显示' : ''
        await runJob({ kind:'trend', game, history:histories[game], showMisses:true, exportId:`batch-trend-${game}`, filename:`${item.name}-基本走势-${trendPeriod}期.png`, title:`${item.name}基本走势`, params:`期数：${trendPeriod}期 · 遗漏值：显示${patternParams}` })
        setBatchJob(null); await waitForPaint()
        await runJob({ kind:'trend', game, history:histories[game], showMisses:false, exportId:`batch-trend-nomiss-${game}`, filename:`${item.name}-基本走势-无遗漏-${trendPeriod}期.png`, title:`${item.name}基本走势（无遗漏）`, params:`期数：${trendPeriod}期 · 遗漏值：隐藏${patternParams}` })
        setBatchJob(null); await waitForPaint()
        await runJob({ kind:'detail', game, item, all, exportId:`batch-detail-${game}`, filename:`${item.name}-详情-${item.issue}.png`, title:`${item.name}详情`, params:`第 ${item.issue} 期 · ${item.drawDate}` })
        setBatchJob(null); await waitForPaint()
        if (game === 'qxc') {
          await runJob({ kind:'qxc-history', game, history:histories[game], exportId:'batch-qxc-history', filename:'七星彩历史开奖长条图-近100期.png', title:'七星彩历史开奖长条图', params:'近100期 · 日期、和值与7个位置奖号' })
          setBatchJob(null); await waitForPaint()
        }
        if (['dlt','ssq'].includes(game)) {
          await runJob({ kind:'heat', game, history:histories[game], exportId:`batch-heat-${game}`, filename:`${item.name}-冷热图-10期分析-30期.png`, title:`${item.name}冷热图`, params:'分析：10期 · 显示：30期' })
          setBatchJob(null); await waitForPaint()
        }
        if (game === 'kl8') {
          await runJob({ kind:'kl8', game, history:histories[game], view:'matrix', exportId:'batch-kl8-matrix', filename:'快乐8基础矩阵图-20期.png', title:'快乐8基础矩阵图', params:'显示：20期' })
          setBatchJob(null); await waitForPaint()
          await runJob({ kind:'kl8', game, history:histories[game], view:'analytics', exportId:'batch-kl8-analytics', filename:'快乐8综合数据查阅表-20期.png', title:'快乐8综合数据查阅表', params:'显示：20期' })
          setBatchJob(null); await waitForPaint()
        }
      }
      trackAnalytics('export_batch',{ page:'home', count:exportItems.length })
    } finally { setBatchJob(null); setBatchExporting(false); setBatchProgress({ current:0, total:0 }) }
  }
  return <main><div className="section-head home-section-head"><div className="home-refresh">{canExport && <button type="button" className="home-batch-export-button" onClick={exportBatch} disabled={batchExporting || !latest.length}><Download size={14}/>{batchExporting ? `导出中 ${batchProgress.current}/${batchProgress.total}` : '一键导出图片'}</button>}{stamp && <span>更新于 {stamp}</span>}<button className="icon-btn" onClick={load} aria-label="刷新"><RefreshCw size={14} className={loading ? 'spin' : ''}/></button></div></div>
    {loading && !latest.length ? <div className="cards">{[1,2,3].map(i => <div className="card skeleton" key={i}/>)}</div> : error ? <div className="state"><b>加载失败</b><p>{error}</p><button onClick={load}>重新加载</button></div> : <div className="cards">{displayRows.map(({ game, record:r },index) => r ? <article className="card result-card list-entry" style={{ '--list-index': index }} key={r.id}>
      <header><div className="game"><span className={`game-icon ${r.game}`}>{r.icon}</span><div><h2>{r.name}</h2><p>第 {r.issue} 期</p></div></div><div className="date">{r.drawDate}<small>{r.drawTime} 开奖</small></div></header>
      <Balls groups={[{ values: r.redBalls }, { values: r.blueBalls, accent: true }]}/>
      <div className="home-card-actions" aria-label={`${r.name}快捷入口`}>
        <button onClick={() => openRules(r, all)}><span>玩法规则</span></button>
        <button onClick={() => openHistory(r, all)}><span>历史开奖</span></button>
        <button onClick={() => openTrend(r, all)}><span>走势图</span></button>
        <button onClick={() => open(r, all)}><span>详情</span></button>
      </div>
    </article> : <article className="card result-card-pending list-entry" style={{ '--list-index': index }} key={`pending-${game}`}>
      <header><div className="game"><span className={`game-icon ${game}`}>{games[game].icon}</span><div><h2>{games[game].name}</h2><p>最新期号同步中</p></div></div><div className="date">{games[game].time}<small>等待开奖数据</small></div></header>
      <div className="home-sync-placeholder">正在同步最新开奖，稍后自动重试</div>
    </article>)}</div>}<p className="notice">数据仅供参考 · 请以官方开奖结果为准</p><BatchExportWorkspace job={batchJob}/></main>
}

const positionNames = ['百位','十位','个位','第四位','第五位','第六位','特别号']
const sevenStarPositionNames = ['第一位','第二位','第三位','第四位','第五位','第六位','第七位']
function getTrendGroups(game) {
  const rule = rules.find(item => item.key === game) || rules[0]
  const groups = rule.groups.flatMap((group, groupIndex) => {
    const values = Array.from({ length: group.max - group.min + 1 }, (_, index) => group.min === 0 ? String(index) : String(group.min + index).padStart(2,'0'))
    if (group.repeatable && group.count > 1 && group.max === 9) {
      return Array.from({ length: group.count }, (_, position) => ({
        key: `${groupIndex}-${position}`, title: game === 'qxc' ? sevenStarPositionNames[position] : (positionNames[position] || `第${position + 1}位`), values, count: 1,
        accent: position % 2 === 1, pick: record => [String((groupIndex ? record.blueBalls : record.redBalls)[position] ?? '')]
      }))
    }
    return [{ key: String(groupIndex), title: rule.groups.length > 1 ? (group.accent ? '蓝球 / 后区' : '红球 / 前区') : '号码走势', values, count: group.count, accent: Boolean(group.accent), pick: record => groupIndex ? record.blueBalls : record.redBalls }]
  })
  if (['fc3d', 'pl3', 'pl5'].includes(game)) groups.unshift({ key:'distribution', title:'号码分布', values:Array.from({ length:10 }, (_, index) => String(index)), count:game === 'pl5' ? 5 : 3, distribution:true, pick:record => record.redBalls })
  return groups
}

function formatTrendDrawNumber(record) {
  const red = (record?.redBalls || []).map(value => String(value)).join(' ')
  const blue = (record?.blueBalls || []).map(value => String(value)).join(' ')
  return blue ? `${red} + ${blue}` : red || '--'
}

const trendStatColumns = {}

const trendViewModes = [
  ['basic', '基本走势'],
  ['bigSmall', '大小走势'],
  ['oddEven', '奇偶走势'],
  ['span', '跨度走势'],
  ['sum', '和值走势']
]
const trendPeriodOptions = [30, 50, 100, 300, 500]

function TrendPeriodPicker({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuWidth = 132
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top:rect.bottom + 6, left:Math.max(8,Math.min(rect.right - menuWidth,window.innerWidth - menuWidth - 8)), width:menuWidth, maxHeight:Math.max(96,Math.min(320,window.innerHeight - rect.bottom - 14)) })
  }, [])
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = event => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = event => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    updatePosition()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])
  const menu = open && position ? createPortal(<div className="trend-period-menu" role="listbox" aria-label="选择走势图期数" ref={menuRef} style={position}>{options.map(option => <button type="button" role="option" aria-selected={option === value} className={option === value ? 'active' : ''} key={option} onClick={() => { onChange(option); setOpen(false) }}>近 {option} 期</button>)}</div>, document.body) : null
  return <div className="trend-period-picker">
    <button type="button" className="trend-period-trigger" aria-label={`显示期数：近 ${value} 期`} aria-haspopup="listbox" aria-expanded={open} ref={triggerRef} onClick={() => { if (!open) updatePosition(); setOpen(current => !current) }}><span>近 {value} 期</span><ChevronDown size={14}/></button>
    {menu}
  </div>
}

function trendCategory(value, mode, group) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '--'
  if (mode === 'oddEven') return number % 2 ? '奇' : '偶'
  const values = (group?.values || []).map(Number).filter(Number.isFinite)
  const midpoint = values.length ? Math.ceil((Math.min(...values) + Math.max(...values)) / 2) : 5
  return number >= midpoint ? '大' : '小'
}

const dltSpanValues = Array.from({ length:34 }, (_, index) => index + 1)
const dltSumIntervals = [[15,50],[51,60],[61,70],[71,80],[81,90],[91,100],[101,110],[111,120],[121,130],[131,140],[141,150],[151,165]]
const dltSumIntervalLabel = ([min,max]) => `${min}\\n${max}`
const dltWeekday = record => {
  const day = new Date(record.drawDate || '').getDay()
  return Number.isFinite(day) && day > 0 ? day : day === 0 ? 7 : '--'
}
const dltFront = record => (record.redBalls || []).map(Number).filter(Number.isFinite).slice(0,5)
const dltBack = record => (record.blueBalls || []).map(Number).filter(Number.isFinite).slice(0,2)
const dltSummary = (record, previous) => {
  const front = dltFront(record)
  const sum = front.reduce((total, value) => total + value, 0)
  const min = front.length ? Math.min(...front) : 0
  const max = front.length ? Math.max(...front) : 0
  const small = front.filter(value => value <= 17).length
  const odd = front.filter(value => value % 2 === 1).length
  return { front, sum, span: front.length ? max - min : '--', small, big: front.length - small, odd, even: front.length - odd, tail: sum % 10, amplitude: previous ? Math.abs(sum - dltSummary(previous).sum) : '--' }
}

function DltDrawCells({ record }) {
  return <div className="dlt-derived-draw"><span className="dlt-derived-num-list">{dltFront(record).map(value => <b key={`front-${value}`}>{String(value).padStart(2,'0')}</b>)}</span><i>+</i><span className="dlt-derived-num-list dlt-derived-blue-list">{dltBack(record).map(value => <b key={`back-${value}`}>{String(value).padStart(2,'0')}</b>)}</span></div>
}

function DltPartitionTable({ rows, mode }) {
  const oddEven = mode === 'oddEven'
  const buckets = oddEven ? [
    ['奇号区', [['小奇', value => value <= 17 && value % 2 === 1], ['大奇', value => value >= 18 && value % 2 === 1]]],
    ['偶号区', [['小偶', value => value <= 17 && value % 2 === 0], ['大偶', value => value >= 18 && value % 2 === 0]]]
  ] : [
    ['小号区', [['小奇', value => value <= 17 && value % 2 === 1], ['小偶', value => value <= 17 && value % 2 === 0]]],
    ['大号区', [['大偶', value => value >= 18 && value % 2 === 0], ['大奇', value => value >= 18 && value % 2 === 1]]]
  ]
  return <div className="dlt-derived-scroll"><table className={`dlt-derived-table dlt-partition-table ${oddEven ? 'odd-even' : 'big-small'}`}><thead><tr><th rowSpan="2">期号</th><th rowSpan="2">星期</th><th rowSpan="2" className="dlt-draw-head">开奖号码</th>{buckets.map(([title, columns]) => <th colSpan={columns.length} key={title}>{title}</th>)}<th rowSpan="2">大小比</th><th rowSpan="2">奇偶比</th><th rowSpan="2">和值</th><th rowSpan="2">跨度</th></tr><tr>{buckets.flatMap(([,columns]) => columns.map(([title]) => <th key={title}>{title}</th>))}</tr></thead><tbody>{rows.map((record,index) => { const summary = dltSummary(record, rows[index - 1]); return <tr key={record.id}><th>{record.issue}</th><td>{dltWeekday(record)}</td><td className="dlt-draw-cell"><DltDrawCells record={record}/></td>{buckets.flatMap(([,columns]) => columns.map(([title, predicate]) => { const values = summary.front.filter(predicate); return <td className={`dlt-partition-cell ${title.includes('大') ? 'large' : 'small'} ${title.includes('奇') ? 'odd' : 'even'}`} key={`${record.id}-${title}`}>{values.length ? values.map(value => <span key={value}>{String(value).padStart(2,'0')}</span>) : <em>--</em>}</td> }))}<td className="dlt-stat-cell">{summary.big}:{summary.small}</td><td className="dlt-stat-cell">{summary.odd}:{summary.even}</td><td className="dlt-stat-cell strong">{summary.sum}</td><td className="dlt-stat-cell strong">{summary.span}</td></tr> })}</tbody></table></div>
}

function DltSpanTable({ rows }) {
  const rowHeight = 34, headerHeight = 64, issueWidth = 78, weekdayWidth = 46, drawWidth = 230, cellWidth = 30
  const gridWidth = issueWidth + weekdayWidth + drawWidth + dltSpanValues.length * cellWidth
  const points = rows.map((record, index) => ({ x: (dltSummary(record).span - 1) * cellWidth + cellWidth / 2, y: index * rowHeight + rowHeight / 2 })).filter(point => Number.isFinite(point.x) && point.x >= 0)
  return <div className="dlt-derived-scroll"><div className="dlt-span-grid" style={{ width: gridWidth }}><div className="dlt-span-grid-row dlt-span-grid-head" style={{ '--dlt-span-columns': ` ${issueWidth}px ${weekdayWidth}px ${drawWidth}px repeat(${dltSpanValues.length}, ${cellWidth}px)` }}><div style={{ gridRow: 'span 2' }}>期号</div><div style={{ gridRow: 'span 2' }}>星期</div><div style={{ gridRow: 'span 2' }}>开奖号码</div><strong style={{ gridColumn: `4 / span ${dltSpanValues.length}` }}>跨度走势分布</strong>{dltSpanValues.map(value => <span key={value}>{String(value).padStart(2,'0')}</span>)}</div>{rows.map((record, index) => { const summary = dltSummary(record); return <div className="dlt-span-grid-row" style={{ '--dlt-span-columns': ` ${issueWidth}px ${weekdayWidth}px ${drawWidth}px repeat(${dltSpanValues.length}, ${cellWidth}px)` }} key={record.id}><b>{record.issue}</b><span>{dltWeekday(record)}</span><div className="dlt-draw-cell"><DltDrawCells record={record}/></div>{dltSpanValues.map(value => <span className={`dlt-span-cell ${summary.span === value ? 'active' : ''}`} key={`${record.id}-${value}`}>{summary.span === value ? value : ''}</span>)}</div> })}<svg className="dlt-span-lines" aria-hidden="true" width={dltSpanValues.length * cellWidth} height={rows.length * rowHeight} viewBox={`0 0 ${dltSpanValues.length * cellWidth} ${rows.length * rowHeight}`} style={{ left: issueWidth + weekdayWidth + drawWidth, top: headerHeight }}>{points.slice(1).map((point, index) => { const previous = points[index]; return <line key={index} x1={previous.x} y1={previous.y} x2={point.x} y2={point.y}/> })}</svg></div></div>
}

function DltPartitionMatrixTable({ rows, mode }) {
  const oddEven = mode === 'oddEven'
  const buckets = oddEven ? [
    ['奇号区', [['小奇', value => value <= 17 && value % 2 === 1], ['大奇', value => value >= 18 && value % 2 === 1]]],
    ['偶号区', [['小偶', value => value <= 17 && value % 2 === 0], ['大偶', value => value >= 18 && value % 2 === 0]]]
  ] : [
    ['小号区', [['小奇', value => value <= 17 && value % 2 === 1], ['小偶', value => value <= 17 && value % 2 === 0]]],
    ['大号区', [['大偶', value => value >= 18 && value % 2 === 0], ['大奇', value => value >= 18 && value % 2 === 1]]]
  ]
  const categories = buckets.flatMap(([, columns]) => columns.map(([label, predicate]) => ({ key: label, label, predicate, numbers: Array.from({ length:35 }, (_, index) => index + 1).filter(predicate), tone: (label.includes('大') ? 'large' : 'small') + ' ' + (label.includes('奇') ? 'odd' : 'even') })))
  const misses = Object.fromEntries(categories.map(category => [category.key, Object.fromEntries(category.numbers.map(value => [value, 0]))]))
  const matrixRows = rows.map((record, index) => {
    const front = dltFront(record)
    const cells = categories.map(category => category.numbers.map(value => {
      if (front.includes(value)) { misses[category.key][value] = 0; return { value, hit: true, miss: 0 } }
      misses[category.key][value] += 1
      return { value, hit: false, miss: misses[category.key][value] }
    }))
    return { record, summary: dltSummary(record, rows[index - 1]), cells }
  })
  return <div className="dlt-derived-scroll"><table className="dlt-derived-table dlt-partition-matrix"><thead><tr><th rowSpan="3">期号</th><th rowSpan="3">星期</th><th rowSpan="3" className="dlt-draw-head">开奖号码</th>{buckets.map(([title, columns]) => <th colSpan={columns.reduce((sum, [, predicate]) => sum + Array.from({ length:35 }, (_, index) => index + 1).filter(predicate).length, 0)} key={title}>{title}</th>)}<th rowSpan="3">大小比</th><th rowSpan="3">奇偶比</th><th rowSpan="3">和值</th><th rowSpan="3">跨度</th></tr><tr>{buckets.flatMap(([, columns]) => columns.map(([label, predicate]) => <th colSpan={Array.from({ length:35 }, (_, index) => index + 1).filter(predicate).length} key={label}>{label}</th>))}</tr><tr>{categories.flatMap(category => category.numbers.map(value => <th className={category.tone} key={category.key + value}>{String(value).padStart(2,'0')}</th>))}</tr></thead><tbody>{matrixRows.map(({ record, summary, cells }) => <tr key={record.id}><th>{record.issue}</th><td>{dltWeekday(record)}</td><td className="dlt-draw-cell"><DltDrawCells record={record}/></td>{cells.flatMap((categoryCells, categoryIndex) => categoryCells.map(cell => <td className={'dlt-partition-number ' + categories[categoryIndex].tone + (cell.hit ? ' active' : '')} key={record.id + '-' + categories[categoryIndex].key + '-' + cell.value}>{cell.hit ? <b>{String(cell.value).padStart(2,'0')}</b> : <span>{cell.miss}</span>}</td>))}<td className="dlt-stat-cell">{summary.big}:{summary.small}</td><td className="dlt-stat-cell">{summary.odd}:{summary.even}</td><td className="dlt-stat-cell strong">{summary.sum}</td><td className="dlt-stat-cell strong">{summary.span}</td></tr>)}</tbody></table></div>
}

function DltSumTable({ rows }) {
  const previousSums = rows.map((record, index) => dltSummary(record, rows[index - 1]))
  return <div className="dlt-derived-scroll"><table className="dlt-derived-table dlt-sum-table"><thead><tr><th rowSpan="2">期号</th><th rowSpan="2">星期</th><th rowSpan="2" className="dlt-draw-head">开奖号码</th><th colSpan={dltSumIntervals.length}>前区和值区间分布</th><th colSpan="3">和值形态</th><th colSpan="10">前区和尾分布</th></tr><tr>{dltSumIntervals.map(interval => <th className="dlt-multiline" key={interval[0]}>{dltSumIntervalLabel(interval).split('\\n').map(part => <span key={part}>{part}</span>)}</th>)}<th>奇</th><th>偶</th><th>振幅</th>{Array.from({ length:10 }, (_, value) => <th key={value}>{value}</th>)}</tr></thead><tbody>{rows.map((record, index) => { const summary = previousSums[index]; const intervalIndex = dltSumIntervals.findIndex(([min,max]) => summary.sum >= min && summary.sum <= max); return <tr key={record.id}><th>{record.issue}</th><td>{dltWeekday(record)}</td><td className="dlt-draw-cell"><DltDrawCells record={record}/></td>{dltSumIntervals.map((interval, intervalCellIndex) => <td className={`dlt-sum-cell ${intervalCellIndex === intervalIndex ? 'active' : ''}`} key={interval[0]}>{intervalCellIndex === intervalIndex ? summary.sum : ''}</td>)}<td className={`dlt-shape-cell ${summary.sum % 2 ? 'active' : ''}`}>{summary.sum % 2 ? '奇' : ''}</td><td className={`dlt-shape-cell ${summary.sum % 2 === 0 ? 'active' : ''}`}>{summary.sum % 2 === 0 ? '偶' : ''}</td><td className="dlt-stat-cell">{summary.amplitude}</td>{Array.from({ length:10 }, (_, value) => <td className={`dlt-tail-cell ${summary.tail === value ? 'active' : ''}`} key={value}>{summary.tail === value ? summary.tail : ''}</td>)}</tr> })}</tbody></table></div>
}

function DltTrendModeTable({ rows, mode }) {
  if (mode === 'bigSmall' || mode === 'oddEven') return <DltPartitionMatrixTable rows={rows} mode={mode}/>
  if (mode === 'span') return <DltSpanTable rows={rows}/>
  return <DltSumTable rows={rows}/>
}

const fc3dDigits = record => (record.redBalls || []).map(Number).filter(Number.isFinite).slice(0, 3)
const fc3dPrimeValues = new Set([2, 3, 5, 7])
function fc3dSummary(record, previous) {
  const digits = fc3dDigits(record)
  const sum = digits.reduce((total, value) => total + value, 0)
  const span = digits.length ? Math.max(...digits) - Math.min(...digits) : '--'
  const big = digits.filter(value => value >= 5).length
  const odd = digits.filter(value => value % 2 === 1).length
  const shapeFor = values => values.map(value => value ? '奇' : '偶').join('')
  const bigSmallShape = digits.map(value => value >= 5 ? '大' : '小').join('')
  const oddEvenShape = shapeFor(digits.map(value => value % 2))
  const previousSummary = previous ? fc3dSummary(previous) : null
  return {
    digits,
    sum,
    tail: sum % 10,
    span,
    big,
    small: digits.length - big,
    odd,
    even: digits.length - odd,
    bigSmallShape,
    oddEvenShape,
    spanParity: span === '--' ? '--' : span % 2 ? '奇' : '偶',
    spanSize: span === '--' ? '--' : span >= 5 ? '大' : '小',
    spanPrime: span === '--' ? '--' : fc3dPrimeValues.has(span) ? '质' : '合',
    sumParity: sum % 2 ? '奇' : '偶',
    sumAmplitude: previousSummary ? Math.abs(sum - previousSummary.sum) : '--',
    spanAmplitude: previousSummary && span !== '--' && previousSummary.span !== '--' ? Math.abs(span - previousSummary.span) : '--',
    tailParity: sum % 10 % 2 ? '奇' : '偶',
    tailRoute: sum % 10 % 3
  }
}

function Fc3dDrawCells({ record }) {
  return <div className="fc3d-derived-draw"><b>{fc3dDigits(record).join('')}</b></div>
}

const fc3dRange = Array.from({ length: 10 }, (_, value) => value)
const fc3dSumRange = Array.from({ length: 28 }, (_, value) => value)
const fc3dRatioRange = ['0:3', '1:2', '2:1', '3:0']

function Fc3dSpanTable({ rows }) {
  return <div className="fc3d-derived-scroll"><table className="fc3d-derived-table fc3d-span-table"><thead><tr><th rowSpan="2">期号</th><th rowSpan="2">星期</th><th rowSpan="2" className="fc3d-draw-head">开奖号</th><th rowSpan="2">和尾</th><th rowSpan="2">跨度</th><th colSpan="10">总跨度走势</th><th colSpan="3">跨度形态分析</th><th colSpan="10">跨度振幅走势</th></tr><tr>{fc3dRange.map(value => <th key={`span-${value}`}>{value}</th>)}<th>奇偶</th><th>大小</th><th>质合</th>{fc3dRange.map(value => <th key={`amplitude-${value}`}>{value}</th>)}</tr></thead><tbody>{rows.map((record, index) => { const summary = fc3dSummary(record, rows[index - 1]); return <tr key={record.id}><th>{record.issue}</th><td>{dltWeekday(record)}</td><td className="fc3d-draw-slot"><Fc3dDrawCells record={record}/></td><td className="fc3d-stat-cell">{summary.tail}</td><td className="fc3d-stat-cell strong">{summary.span}</td>{fc3dRange.map(value => <td className={`fc3d-grid-cell ${summary.span === value ? 'active red' : ''}`} key={`${record.id}-span-${value}`}>{summary.span === value ? value : ''}</td>)}<td className={`fc3d-grid-cell ${summary.spanParity !== '--' ? 'active teal' : ''}`}>{summary.spanParity}</td><td className={`fc3d-grid-cell ${summary.spanSize !== '--' ? 'active gold' : ''}`}>{summary.spanSize}</td><td className={`fc3d-grid-cell ${summary.spanPrime !== '--' ? 'active purple' : ''}`}>{summary.spanPrime}</td>{fc3dRange.map(value => <td className={`fc3d-grid-cell ${summary.spanAmplitude === value ? 'active red' : ''}`} key={`${record.id}-amplitude-${value}`}>{summary.spanAmplitude === value ? value : ''}</td>)}</tr>})}</tbody></table></div>
}

function Fc3dSumTable({ rows }) {
  return <div className="fc3d-derived-scroll"><table className="fc3d-derived-table fc3d-sum-table"><thead><tr><th rowSpan="2">期号</th><th rowSpan="2">星期</th><th rowSpan="2" className="fc3d-draw-head">开奖号</th><th rowSpan="2">和值</th><th colSpan={fc3dSumRange.length}>和值走势</th><th colSpan="3">和值形态</th><th colSpan="10">和值尾走势</th><th colSpan="3">和值尾形态</th></tr><tr>{fc3dSumRange.map(value => <th key={`sum-${value}`}>{value}</th>)}<th>奇偶</th><th>振幅</th><th>012路</th>{fc3dRange.map(value => <th key={`tail-${value}`}>{value}</th>)}<th>奇偶</th><th>012路</th><th>大小</th></tr></thead><tbody>{rows.map((record, index) => { const summary = fc3dSummary(record, rows[index - 1]); return <tr key={record.id}><th>{record.issue}</th><td>{dltWeekday(record)}</td><td className="fc3d-draw-slot"><Fc3dDrawCells record={record}/></td><td className="fc3d-stat-cell strong">{summary.sum}</td>{fc3dSumRange.map(value => <td className={`fc3d-grid-cell ${summary.sum === value ? 'active red' : ''}`} key={`${record.id}-sum-${value}`}>{summary.sum === value ? value : ''}</td>)}<td className="fc3d-grid-cell active teal">{summary.sumParity}</td><td className={`fc3d-grid-cell ${summary.sumAmplitude !== '--' ? 'active red' : ''}`}>{summary.sumAmplitude}</td><td className="fc3d-grid-cell active teal">{summary.sum % 3}</td>{fc3dRange.map(value => <td className={`fc3d-grid-cell ${summary.tail === value ? 'active gold' : ''}`} key={`${record.id}-tail-${value}`}>{summary.tail === value ? value : ''}</td>)}<td className="fc3d-grid-cell active teal">{summary.tailParity}</td><td className="fc3d-grid-cell active teal">{summary.tailRoute}</td><td className={`fc3d-grid-cell active ${summary.tail >= 5 ? 'gold' : 'purple'}`}>{summary.tail >= 5 ? '大' : '小'}</td></tr>})}</tbody></table></div>
}

function Fc3dShapeTable({ rows, mode }) {
  const oddEven = mode === 'oddEven'
  const positionLabels = ['百位', '十位', '个位']
  const categories = oddEven ? ['奇', '偶'] : ['大', '小']
  const shapeOptions = oddEven ? ['全奇', '两奇一偶', '两偶一奇', '全偶'] : ['全大', '两大一小', '两小一大', '全小']
  return <div className="fc3d-derived-scroll"><table className="fc3d-derived-table fc3d-shape-table"><thead><tr><th rowSpan="2">期号</th><th rowSpan="2">星期</th><th rowSpan="2" className="fc3d-draw-head">开奖号</th><th rowSpan="2">和值</th>{positionLabels.map(label => <th colSpan="2" key={label}>{label}</th>)}<th rowSpan="2">跨度</th><th rowSpan="2">{oddEven ? '奇偶形态' : '大小形态'}</th><th colSpan="4">{oddEven ? '奇偶形态分布' : '大小形态分布'}</th><th rowSpan="2">{oddEven ? '奇偶比' : '大小比'}</th><th colSpan="4">{oddEven ? '奇偶比走势' : '大小比走势'}</th></tr><tr>{positionLabels.flatMap(label => categories.map(category => <th key={`${label}-${category}`}>{category}</th>))}{shapeOptions.map(value => <th key={value}>{value}</th>)}{fc3dRatioRange.map(value => <th key={`ratio-${value}`}>{value}</th>)}</tr></thead><tbody>{rows.map((record, index) => { const summary = fc3dSummary(record, rows[index - 1]); const primaryCount = oddEven ? summary.odd : summary.big; const secondaryCount = oddEven ? summary.even : summary.small; const shape = oddEven ? summary.oddEvenShape : summary.bigSmallShape; const activeShape = primaryCount === 3 ? 0 : primaryCount === 2 ? 1 : secondaryCount === 2 ? 2 : 3; const ratio = `${primaryCount}:${secondaryCount}`; return <tr key={record.id}><th>{record.issue}</th><td>{dltWeekday(record)}</td><td className="fc3d-draw-slot"><Fc3dDrawCells record={record}/></td><td className="fc3d-stat-cell strong">{summary.sum}</td>{summary.digits.map((value, position) => categories.map(category => { const selected = oddEven ? (value % 2 ? '奇' : '偶') : (value >= 5 ? '大' : '小'); return <td className={`fc3d-category-cell ${selected === category ? 'active ' + (oddEven ? 'teal' : 'gold') : ''}`} key={`${record.id}-${position}-${category}`}>{selected === category ? value : ''}</td> }))}<td className="fc3d-stat-cell strong">{summary.span}</td><td className="fc3d-shape-label">{shape}</td>{shapeOptions.map((value, shapeIndex) => <td className={`fc3d-grid-cell ${shapeIndex === activeShape ? 'active teal' : ''}`} key={`${record.id}-${value}`}>{shapeIndex === activeShape ? value : ''}</td>)}<td className="fc3d-stat-cell">{ratio}</td>{fc3dRatioRange.map(value => <td className={`fc3d-grid-cell ${value === ratio ? 'active teal' : ''}`} key={`${record.id}-ratio-${value}`}>{value === ratio ? value : ''}</td>)}</tr>})}</tbody></table></div>
}

function Fc3dTrendModeTable({ rows, mode }) {
  if (mode === 'bigSmall' || mode === 'oddEven') return <Fc3dShapeTable rows={rows} mode={mode}/>
  if (mode === 'span') return <Fc3dSpanTable rows={rows}/>
  return <Fc3dSumTable rows={rows}/>
}

function DerivedDrawCells({ record }) {
  const renderValues = (values, accent) => <span className={accent ? 'derived-blue-list' : 'derived-red-list'}>{values.map((value, index) => <b key={String(value) + index}>{value}</b>)}</span>
  return <div className="derived-draw-cell">{renderValues(record.redBalls || [], false)}{record.blueBalls?.length > 0 && <><i>+</i>{renderValues(record.blueBalls, true)}</>}</div>
}

function GenericTrendModeTable({ game, rows, mode }) {
  const groups = useMemo(() => getTrendGroups(game).filter(group => !group.distribution), [game])
  const positionMode = mode === 'bigSmall' || mode === 'oddEven'
  const categories = mode === 'oddEven' ? ['奇', '偶'] : ['大', '小']
  const stats = rows.map((record, index) => ({ record, values: groups.map(group => group.pick(record).filter(value => value !== '' && value !== null && value !== undefined)), stats: getTrendStats(game, record), previous: rows[index - 1] }))
  if (positionMode) {
  return <div className="derived-trend-scroll"><table className="derived-trend-table derived-position-table"><thead><tr><th rowSpan="2">期号</th><th rowSpan="2">星期</th><th rowSpan="2" className="derived-draw-head">开奖号码</th>{groups.map(group => <th className="derived-group-head" colSpan="2" key={group.key}>{group.title}</th>)}<th rowSpan="2">和值</th><th rowSpan="2">跨度</th></tr><tr>{groups.flatMap(group => categories.map(category => <th key={group.key + category}>{category}</th>))}</tr></thead><tbody>{stats.map(row => <tr key={row.record.id}><th>{row.record.issue}</th><td>{dltWeekday(row.record)}</td><td className="derived-draw-slot"><DerivedDrawCells record={row.record}/></td>{row.values.flatMap((values, groupIndex) => categories.map(category => { const hits = values.filter(value => trendCategory(value, mode, groups[groupIndex]) === category); return <td className={'derived-category-cell derived-group-cell ' + (category === categories[0] ? 'derived-group-start ' : '') + (hits.length ? 'active ' : '') + (groups[groupIndex].accent ? 'blue' : '')} key={row.record.id + '-' + groupIndex + '-' + category}>{hits.length ? hits.map((value, index) => <span key={String(value) + index}>{value}</span>) : <em>--</em>}</td> }))}<td className="derived-stat-cell strong">{row.stats.sum}</td><td className="derived-stat-cell strong">{row.stats.span}</td></tr>)}</tbody></table></div>
  }
  const valueLabel = mode === 'sum' ? '和值' : '跨度'
  const secondaryLabel = mode === 'sum' ? '和值尾' : '和值'
  return <div className="derived-trend-scroll"><table className="derived-trend-table derived-metric-table"><thead><tr><th>期号</th><th>星期</th><th className="derived-draw-head">开奖号码</th><th>{valueLabel}</th><th>{secondaryLabel}</th></tr></thead><tbody>{stats.map(row => { const value = row.stats[mode]; const secondary = value === '--' ? '--' : mode === 'sum' ? Number(value) % 10 : row.stats.sum; return <tr key={row.record.id}><th>{row.record.issue}</th><td>{dltWeekday(row.record)}</td><td className="derived-draw-slot"><DerivedDrawCells record={row.record}/></td><td className="derived-value">{value}</td><td className="derived-value-secondary">{secondary}</td></tr> })}</tbody></table></div>
}

function TrendModeTable({ game, rows, mode }) {
  if (game === 'dlt') return <div className="trend-derived-view" data-game={game}><DltTrendModeTable rows={rows} mode={mode}/></div>
  if (['fc3d', 'pl3'].includes(game)) return <div className="trend-derived-view" data-game={game}><Fc3dTrendModeTable rows={rows} mode={mode}/></div>
  return <div className="trend-derived-view" data-game={game}><GenericTrendModeTable game={game} rows={rows} mode={mode}/></div>
  /*
  const groups = useMemo(() => getTrendGroups(game).filter(group => !group.distribution), [game])
  const positionMode = mode === 'bigSmall' || mode === 'oddEven'
  const categories = mode === 'oddEven' ? ['奇', '偶'] : ['大', '小']
  const stats = rows.map(record => ({ record, values: groups.map(group => group.pick(record).filter(value => value !== '' && value !== null && value !== undefined)), stats: getTrendStats(game, record) }))
  if (positionMode) {
    return <table className="derived-trend-table derived-position-table"><thead><tr><th rowSpan="2">期号</th>{groups.map(group => <th colSpan="2" key={group.key}>{group.title}</th>)}</tr><tr>{groups.flatMap(group => categories.map(category => <th key={`${group.key}-${category}`}>{category}</th>))}</tr></thead><tbody>{stats.map(row => <tr key={row.record.id}><th>{row.record.issue}</th>{row.values.flatMap((values, groupIndex) => categories.map(category => { const hits = values.filter(value => trendCategory(value, mode, groups[groupIndex]) === category); return <td className={hits.length ? `derived-hit ${groups[groupIndex].accent ? 'derived-blue' : ''}` : ''} key={`${row.record.id}-${groupIndex}-${category}`}>{hits.join(' ')}</td> }))}</tr>)}</tbody></table>
  }
  const valueLabel = mode === 'sum' ? '和值' : '跨度'
  return <table className="derived-trend-table"><thead><tr><th>期号</th><th>{valueLabel}</th><th>{mode === 'sum' ? '和值尾' : '极差'}</th></tr></thead><tbody>{stats.map(row => { const value = row.stats[mode]; return <tr key={row.record.id}><th>{row.record.issue}</th><td className="derived-value">{value}</td><td>{value === '--' ? '--' : mode === 'sum' ? Number(value) % 10 : value}</td></tr> })}</tbody></table>
  */
}

function getDigitShape(game, digits) {
  const counts = [...new Map(digits.map(value => [value, digits.filter(item => item === value).length])).values()].sort((a,b) => b - a)
  if (game !== 'pl5') return counts[0] === 3 ? '豹子' : counts[0] === 2 ? '组三' : '组六'
  if (counts[0] === 5) return '五同'
  if (counts[0] === 4) return '四同'
  if (counts[0] === 3 && counts[1] === 2) return '葫芦'
  if (counts[0] === 3) return '三同'
  if (counts[0] === 2 && counts[1] === 2) return '两对'
  if (counts[0] === 2) return '一对'
  return '全异'
}

function getTrendStats(game, record) {
  const digits = record.redBalls.map(Number).filter(Number.isFinite)
  const countRatio = predicate => `${digits.filter(predicate).length}:${digits.filter(value => !predicate(value)).length}`
  const modCounts = [0,1,2].map(mod => digits.filter(value => value % 3 === mod).length).join(':')
  const distribution = [digits.filter(value => value <= 3).length, digits.filter(value => value >= 4 && value <= 6).length, digits.filter(value => value >= 7).length].join(':')
  return {
    draw: formatTrendDrawNumber(record),
    shape: getDigitShape(game, digits),
    sum: digits.reduce((total, value) => total + value, 0),
    span: digits.length ? Math.max(...digits) - Math.min(...digits) : '--',
    oddEven: countRatio(value => value % 2 === 1),
    bigSmall: countRatio(value => value >= 5),
    mod3: modCounts,
    distribution,
    primeComposite: countRatio(value => [1,2,3,5,7].includes(value))
  }
}

function getObservationValues(record) {
  return [...(record?.redBalls || []), ...(record?.blueBalls || [])]
    .map(Number)
    .filter(Number.isFinite)
}

function getObservationDomain(game) {
  const rule = rules.find(item => item.key === game)
  if (!rule) return []
  return [...new Set(rule.groups.flatMap(group => Array.from({ length: group.max - group.min + 1 }, (_, index) => group.min + index)))]
}

function getTodayObservation(game, history) {
  const rows = history.filter(Boolean)
  if (!rows.length) return { text: '近期开奖数据同步中，暂时没有可用的观察结果。', detail: '数据同步完成后，这里会根据近期已开奖记录补充观察。' }
  const shortRows = rows.slice(0, Math.min(10, rows.length))
  const candidates = []
  const sums = shortRows.map(record => getObservationValues(record).reduce((total, value) => total + value, 0))
  if (sums.length) {
    const min = Math.min(...sums)
    const max = Math.max(...sums)
    const baselineSums = rows.slice(0, Math.min(30, rows.length)).map(record => getObservationValues(record).reduce((total, value) => total + value, 0))
    const baselineMin = Math.min(...baselineSums)
    const baselineMax = Math.max(...baselineSums)
    const baselineRange = baselineMax - baselineMin
    const recentRange = max - min
    const concentration = baselineRange > 0 ? Math.max(0, 1 - recentRange / baselineRange) : 0
    if (shortRows.length >= 3 && concentration >= 0.25) candidates.push({ kind: 'sum', score: concentration, text: `最近${shortRows.length}期和值集中在 ${min}–${max} 区间。`, detail: `近${baselineSums.length}期整体范围为 ${baselineMin}–${baselineMax}，短期区间宽度收窄约 ${Math.round(concentration * 100)}%。` })
  }
  const recentValues = shortRows.flatMap(getObservationValues)
  if (recentValues.length) {
    const oddCount = recentValues.filter(value => value % 2 === 1).length
    const evenCount = recentValues.length - oddCount
    const oddDeviation = Math.abs(oddCount / recentValues.length - 0.5) * 2
    const delta = Math.abs(oddCount - evenCount)
    if (shortRows.length >= 3 && recentValues.length >= 8 && oddDeviation >= 0.15) candidates.push({ kind: 'odd-even', score: oddDeviation, text: `当前奇数出现次数：近${shortRows.length}期 ${oddCount} 次。`, detail: `共统计 ${recentValues.length} 个号码，奇偶为 ${oddCount}:${evenCount}，与均衡状态相差 ${delta} 个。` })

    const spanValues = shortRows.map(record => {
      const values = getObservationValues(record)
      return values.length ? Math.max(...values) - Math.min(...values) : 0
    })
    const baselineSpanValues = rows.slice(0, Math.min(30, rows.length)).map(record => {
      const values = getObservationValues(record)
      return values.length ? Math.max(...values) - Math.min(...values) : 0
    })
    const spanMin = Math.min(...spanValues)
    const spanMax = Math.max(...spanValues)
    const baselineSpanMin = Math.min(...baselineSpanValues)
    const baselineSpanMax = Math.max(...baselineSpanValues)
    const spanBaselineRange = baselineSpanMax - baselineSpanMin
    const spanConcentration = spanBaselineRange > 0 ? Math.max(0, 1 - (spanMax - spanMin) / spanBaselineRange) : 0
    if (shortRows.length >= 3 && spanConcentration >= 0.25) candidates.push({ kind: 'span', score: spanConcentration, text: `最近${shortRows.length}期跨度集中在 ${spanMin}–${spanMax} 区间。`, detail: `近${baselineSpanValues.length}期跨度整体范围为 ${baselineSpanMin}–${baselineSpanMax}，近期跨度波动收窄约 ${Math.round(spanConcentration * 100)}%。` })

    const repeatedDraws = shortRows.filter(record => {
      const values = getObservationValues(record)
      return values.length > new Set(values).size
    }).length
    if (shortRows.length >= 3 && repeatedDraws >= Math.max(2, Math.ceil(shortRows.length * 0.4))) candidates.push({ kind: 'repeat', score: repeatedDraws / shortRows.length, text: `近${shortRows.length}期有 ${repeatedDraws} 期出现同号。`, detail: '这里仅统计同期开奖中的重复号码，不延伸为下一期判断。' })
  }
  const omissionRows = rows.slice(0, Math.min(30, rows.length))
  const domain = getObservationDomain(game)
  const ranked = domain.map(value => {
    const latestIndex = omissionRows.findIndex(record => getObservationValues(record).includes(value))
    return { value, omission: latestIndex === -1 ? omissionRows.length : latestIndex }
  }).sort((a, b) => b.omission - a.omission || a.value - b.value)
  const top = ranked[0]
  if (top && omissionRows.length >= 8 && top.omission >= Math.max(8, Math.ceil(omissionRows.length * 0.55))) {
    const omissionDetail = top.omission >= omissionRows.length ? `数字 ${top.value} 在最近${omissionRows.length}期中尚未出现` : `数字 ${top.value} 已连续 ${top.omission} 期未出现`
    const runnerUp = ranked[1]
    const comparison = runnerUp ? `，次大遗漏为数字 ${runnerUp.value} 的 ${runnerUp.omission} 期` : ''
    const omissionRatio = top.omission / omissionRows.length
    candidates.push({ kind: 'omission', score: Math.min(0.55, Math.max(0, (omissionRatio - 0.5) / 0.5)), text: `最近${omissionRows.length}期最大遗漏数字：${top.value}。`, detail: `${omissionDetail}${comparison}。` })
  }
  const rankedCandidates = candidates.sort((a, b) => b.score - a.score)
  const strongestNonOmission = rankedCandidates.find(candidate => candidate.kind !== 'omission')
  const omissionCandidate = rankedCandidates.find(candidate => candidate.kind === 'omission')
  // 遗漏只有在明显强于其它指标时才成为主观察，避免所有彩种都落到同一种文案。
  const standout = omissionCandidate && strongestNonOmission && omissionCandidate.score < strongestNonOmission.score + 0.12
    ? strongestNonOmission
    : rankedCandidates[0]
  if (standout) {
    const supporting = rankedCandidates.find(candidate => candidate !== standout)
    const detail = supporting ? `${standout.detail} 另有${supporting.text.replace(/。$/, '')}。` : standout.detail
    return { ...standout, detail }
  }
  return { text: '近期数据波动较均衡，暂未发现明显偏离。', detail: `已检查近${Math.min(rows.length, 30)}期的和值、奇偶、跨度、同号与遗漏，当前没有单项明显脱离常态。` }
}

function TodayObservation({ game, history, loading = false }) {
  const observation = useMemo(() => getTodayObservation(game, history), [game, history])
  return <section className="card today-observation-card" aria-label="今日观察">
    <header><h3>今日观察</h3><span>{loading ? '同步中…' : '仅描述已开奖数据'}</span></header>
    <p className="today-observation-summary">{loading ? '正在同步近期数据…' : observation.text}</p>
    {!loading && observation.detail && <p className="today-observation-detail">{observation.detail}</p>}
  </section>
}

const comprehensiveShapeGames = new Set(['fc3d', 'pl3', 'pl5'])
const comprehensiveShapeClasses = Object.freeze({
  豹子:'shape-baozi', 五同:'shape-five-kind', 四同:'shape-four-kind', 葫芦:'shape-full-house',
  三同:'shape-three-kind', 组三:'shape-group3', 两对:'shape-two-pair', 一对:'shape-one-pair',
  组六:'shape-group6', 全异:'shape-all-different'
})

function comprehensiveShapeClass(shape) {
  return comprehensiveShapeClasses[shape] || 'shape-default'
}

function comprehensiveNumberLabel(record, game) {
  const red = (record?.redBalls || []).map(value => String(value))
  const blue = (record?.blueBalls || []).map(value => String(value))
  if (game === 'ssq' || game === 'dlt') return `${red.join(' ')}${blue.length ? `  +  ${blue.join(' ')}` : ''}`
  return red.join(' ')
}

function getComprehensiveColumns(game) {
  const columns = [{ key: 'issue', label: '期号', className: 'issue' }]
  if (game !== 'kl8') columns.push({ key: 'draw', label: '奖号', className: 'draw' })
  if (comprehensiveShapeGames.has(game)) columns.push({ key: 'shape', label: '形态', className: 'shape' })
  columns.push(
    { key: 'sum', label: game === 'dlt' || game === 'ssq' ? '前区和值' : '和值', className: 'sum' },
    { key: 'span', label: game === 'dlt' || game === 'ssq' ? '前区跨度' : '跨度', className: 'span' },
    { key: 'oddEven', label: game === 'dlt' || game === 'ssq' ? '前区奇偶比' : '奇偶比', className: 'odd-even' },
    { key: 'bigSmall', label: game === 'dlt' || game === 'ssq' ? '前区大小比' : '大小比', className: 'big-small' },
    { key: 'route', label: game === 'pl5' ? '质合比' : '012路比', className: 'route' }
  )
  return columns
}

function getComprehensiveRow(game, record) {
  const stats = getTrendStats(game, record)
  return {
    issue: record?.issue || '--',
    draw: comprehensiveNumberLabel(record, game),
    shape: comprehensiveShapeGames.has(game) ? stats.shape : null,
    sum: stats.sum,
    span: stats.span,
    oddEven: stats.oddEven,
    bigSmall: stats.bigSmall,
    route: game === 'pl5' ? stats.primeComposite : stats.mod3
  }
}

function ComprehensiveData({ game, history, loading = false, canExport = false, exportId = `detail-export-${game}-comprehensive`, autoExport = false, onExportComplete, exportFilename, exportTitle, exportParams, initialPeriod = 20 }) {
  const [period, setPeriod] = useState(initialPeriod)
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('')
  const rows = useMemo(() => history.slice(0, period).map(record => getComprehensiveRow(game, record)).reverse(), [game, history, period])
  const columns = useMemo(() => getComprehensiveColumns(game), [game])
  const periodOptions = useMemo(() => {
    const values = [10, 20, 30, 50, 100]
    if (history.length && !values.includes(history.length)) values.push(history.length)
    return values.filter(value => value <= Math.max(history.length, 20)).sort((a, b) => a - b)
  }, [history.length])
  const activePeriod = Math.min(period, Math.max(history.length, 20))
  const exportImage = useCallback(async () => {
    if (exporting || loading || !rows.length) return
    setExporting(true); setExportError('')
    try {
      await exportTrendElement(exportId, exportFilename || `${games[game]?.name || game}-综合数据-近${rows.length}期.png`, { title:exportTitle || `${games[game]?.name || game}综合数据`, params:exportParams || `近${rows.length}期` }, { fitWidth:true, hideInExport:['.comprehensive-export-actions','.comprehensive-data-export-error'] })
      trackAnalytics('export_chart', { page:'detail', game, chart:'comprehensive' })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败，请重试')
      throw error
    } finally { setExporting(false) }
  }, [exporting, loading, rows.length, exportId, exportFilename, exportTitle, exportParams, game])
  useEffect(() => {
    if (!autoExport || loading) return undefined
    let active = true
    exportImage().catch(() => {}).finally(() => { if (active) onExportComplete?.() })
    return () => { active = false }
  }, [autoExport, loading, rows.length])
  if (loading && !history.length) return <section className="card comprehensive-data-card comprehensive-data-loading" aria-label="综合数据"><header><div><h3>综合数据</h3></div><span>同步中…</span></header><div>正在加载近期数据</div></section>
  return <section className="card comprehensive-data-card" id={exportId} aria-label="综合数据">
    <header className="comprehensive-data-header"><div><h3>综合数据</h3></div><div className="comprehensive-export-actions"><label><select value={activePeriod} onChange={event => setPeriod(Number(event.target.value))} aria-label="综合数据期数">{periodOptions.map(value => <option value={value} key={value}>近{value}期</option>)}</select></label>{canExport && <button type="button" className="detail-export-button comprehensive-export-button" disabled={exporting || loading || !rows.length} onClick={() => { exportImage().catch(() => {}) }}><Download size={14}/>{exporting ? '生成中…' : '导出综合图'}</button>}</div></header>
    {exportError && <p className="comprehensive-data-export-error">综合数据导出失败，请重试</p>}
    {!rows.length ? <div className="comprehensive-data-empty">暂无可用的历史开奖数据</div> : <div className="comprehensive-data-scroll"><table className="comprehensive-data-table"><thead><tr>{columns.map(column => <th className={`comprehensive-col-${column.className}`} key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.issue}>{columns.map(column => <td className={`comprehensive-col-${column.className}`} key={column.key}><span className={column.key === 'draw' ? 'comprehensive-number' : column.key === 'shape' ? `comprehensive-shape ${comprehensiveShapeClass(row.shape)}` : ''}>{row[column.key] ?? '--'}</span></td>)}</tr>)}</tbody></table></div>}
  </section>
}

const detailMetricColors = ['#6557df','#9250e8','#ff754b','#ff9f2f','#f3df22','#7ee590']
function DrawMetrics({ game, record, previousRecord }) {
  if (!['fc3d','pl3','pl5','dlt'].includes(game)) return null
  if (game === 'dlt') {
    const front = record.redBalls.map(Number).sort((a,b) => a-b)
    const previous = new Set((previousRecord?.redBalls || []).map(Number))
    const tails = new Map()
    front.forEach(value => tails.set(value % 10,(tails.get(value % 10) || 0) + 1))
    let consecutiveGroups = 0
    front.forEach((value,index) => { if (index > 0 && value === front[index - 1] + 1 && (index === 1 || front[index - 1] !== front[index - 2] + 1)) consecutiveGroups += 1 })
    const dltStats = {
      oddEven:`${front.filter(value => value % 2).length}:${front.filter(value => value % 2 === 0).length}`,
      sum:front.reduce((total,value) => total + value,0),
      repeats:front.filter(value => previous.has(value)).length,
      consecutive:consecutiveGroups,
      sameTail:[...tails.values()].filter(count => count > 1).length,
      range:front.length ? Math.max(...front) - Math.min(...front) : '--'
    }
    const metrics = [['oddEven','前区奇偶比'],['sum','前区和值'],['repeats','与上期同号'],['consecutive','连号'],['sameTail','同尾'],['range','极距']]
    return <section className="card draw-metrics" aria-label="大乐透本期号码指标">{metrics.map(([key,label],index) => <div className="draw-metric" style={{'--metric-color':detailMetricColors[index]}} key={key}><i/><span><b>{dltStats[key]}</b><small>{label}</small></span></div>)}</section>
  }
  const stats = getTrendStats(game, record)
  const metrics = [
    ['shape','形态'], ['sum','和值'], ['span','跨度'], ['oddEven','奇偶比'], ['bigSmall','大小比'],
    [game === 'pl5' ? 'primeComposite' : 'mod3', game === 'pl5' ? '质合比' : '012路比']
  ]
  return <section className="card draw-metrics" aria-label="本期号码指标">{metrics.map(([key,label],index) => <div className="draw-metric" style={{'--metric-color':detailMetricColors[index]}} key={key}><i/><span><b>{stats[key]}</b><small>{label}</small></span></div>)}</section>
}

function TraditionalTrendTable({ game, history, save, initialExpanded = false, initialShowMisses = true, exportId, autoExport = false, onExportComplete, exportFilename, exportTitle, exportParams }) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [period, setPeriod] = useState(50)
  const [trendMode, setTrendMode] = useState('basic')
  const [simulation, setSimulation] = useState({})
  const [multiplier, setMultiplier] = useState(1)
  const [showPatterns, setShowPatterns] = useState(true)
  const [showMisses, setShowMisses] = useState(initialShowMisses)
  const [exporting, setExporting] = useState(false)
  const exportTargetId = exportId || `trend-export-${game}`
  const rows = useMemo(() => history.slice(0, period).reverse(), [history, period])
  const groups = useMemo(() => getTrendGroups(game), [game])
  const statColumns = trendStatColumns[game] || []
  const showLines = ['fc3d', 'pl3', 'pl5', 'ssq', 'qxc'].includes(game)
  const totalCells = groups.reduce((sum, group) => sum + group.values.length, 0)
  const statWidth = statColumns.reduce((sum, column) => sum + column[2], 0)
  const cell = 28
  const rowHeight = 34, serialWidth = 42, issueWidth = 78, headerHeight = 64
  const tableWidth = serialWidth + issueWidth + totalCells * cell + statWidth
  const groupStart = serialWidth + issueWidth
  const rowData = useMemo(() => {
    const misses = groups.map(group => Object.fromEntries(group.values.map(value => [value, 0])))
    return rows.map(record => ({ record, stats: getTrendStats(game, record), groups: groups.map((group, groupIndex) => {
      const hits = group.pick(record).filter(value => value !== '' && value !== null && value !== undefined).map(value => group.values[0]?.length === 2 ? String(value).padStart(2,'0') : String(Number(value)))
      const values = group.values.map(value => { const hitCount = hits.filter(hit => hit === value).length; if (hitCount) { misses[groupIndex][value] = 0; return { value, hit: true, hitCount, miss: 0 } } misses[groupIndex][value] += 1; return { value, hit: false, hitCount: 0, miss: misses[groupIndex][value] } })
      return { hits, values }
    }) }))
  }, [rows, groups, game])
  const patternHits = useMemo(() => {
    if (!['ssq','dlt'].includes(game)) return new Set()
    const marked = new Set()
    const directions = [[0,1],[1,0],[1,1],[1,-1]]
    groups.forEach((group,groupIndex) => {
      const isHit = (rowIndex,valueIndex) => Boolean(rowData[rowIndex]?.groups[groupIndex]?.values[valueIndex]?.hit)
      rowData.forEach((row,rowIndex) => group.values.forEach((value,valueIndex) => {
        if (!isHit(rowIndex,valueIndex)) return
        directions.forEach(([rowStep,valueStep]) => {
          if (isHit(rowIndex - rowStep,valueIndex - valueStep)) return
          const run = []
          let nextRow = rowIndex, nextValue = valueIndex
          while (isHit(nextRow,nextValue)) { run.push(`${groupIndex}:${nextRow}:${nextValue}`); nextRow += rowStep; nextValue += valueStep }
          if (run.length >= 3) run.forEach(key => marked.add(key))
        })
      }))
    })
    rowData.forEach((row,rowIndex) => row.groups.forEach((group,groupIndex) => group.values.forEach((cellData,valueIndex) => { cellData.patternHit = marked.has(`${groupIndex}:${rowIndex}:${valueIndex}`) })))
    return marked
  }, [game,groups,rowData])
  const lines = useMemo(() => {
    let offset = 0
    return groups.flatMap((group, groupIndex) => {
      const series = Array.from({ length: group.count }, (_, seriesIndex) => {
        const points = rowData.map((row, rowIndex) => {
          const hits = row.groups[groupIndex].hits.slice().sort((a,b) => +a - +b)
          const value = hits[seriesIndex]
          const valueIndex = group.values.indexOf(value)
          return valueIndex < 0 ? null : { x:offset + valueIndex * cell + cell / 2, y:rowIndex * rowHeight + rowHeight / 2 }
        })
        const segments = points.slice(0,-1).flatMap((point,index) => point && points[index + 1] ? [{ from:point, to:points[index + 1] }] : [])
        return { segments, color:'#A0A0A0', accent:Boolean(group.accent), distribution:Boolean(group.distribution) }
      })
      offset += group.values.length * cell
      return series
    })
  }, [groups, rowData])
  const summaryRows = useMemo(() => {
    const labels = [['current','当前遗漏'],['average','平均遗漏'],['maximum','最大遗漏'],['total','总次数'],['streak','最大连出']]
    return labels.map(([key,label]) => ({ key, label, groups: groups.map((group, groupIndex) => group.values.map((value, valueIndex) => {
      const cells = rowData.map(row => row.groups[groupIndex].values[valueIndex])
      const misses = cells.filter(cellData => !cellData.hit).map(cellData => cellData.miss)
      let streak = 0, maxStreak = 0
      cells.forEach(cellData => { streak = cellData.hit ? streak + 1 : 0; maxStreak = Math.max(maxStreak, streak) })
      const values = {
        current: cells.at(-1)?.hit ? 0 : (cells.at(-1)?.miss || 0),
        average: misses.length ? Math.round(misses.reduce((sum, miss) => sum + miss, 0) / misses.length) : 0,
        maximum: misses.length ? Math.max(...misses) : 0,
        total: cells.reduce((sum, cellData) => sum + (cellData.hitCount || 0), 0),
        streak: maxStreak
      }
      return values[key]
    })) }))
  }, [groups, rowData])
  const selectableGroups = groups.filter(group => !group.distribution)
  const chooseSimulation = (group, value) => setSimulation(current => {
    const values = current[group.key] || []
    return { ...current, [group.key]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] }
  })
  const combination = (n, k) => { if (n < k) return 0; let result = 1; for (let i = 1; i <= k; i += 1) result = result * (n - i + 1) / i; return Math.round(result) }
  const bets = selectableGroups.reduce((total, group) => total * combination((simulation[group.key] || []).length, group.count), 1)
  const selectedTotal = selectableGroups.reduce((total, group) => total + (simulation[group.key] || []).length, 0)
  const saveSimulation = () => {
    if (!bets) return
    const groups = selectableGroups.map(group => ({ values: simulation[group.key] || [], accent: group.accent }))
    save({ id:String(Date.now()), planName:`${games[game]?.name || game} · 走势模拟`, createdAt:new Date().toLocaleString('zh-CN'), entries:[{ id:`${Date.now()}-simulation`, sourceLabel:'模拟', groups }] })
  }
  const drawExportLines = (canvas,targetWidth,targetHeight) => {
    const context = canvas.getContext('2d')
    if (!context || !targetWidth || !targetHeight) return
    const scaleX = canvas.width / targetWidth, scaleY = canvas.height / targetHeight
    const scale = Math.min(scaleX,scaleY)
    const hitRadius = 12.6 * scale
    const hitCircles = []
    let groupOffset = 0
    groups.forEach((group,groupIndex) => {
      rowData.forEach((row,rowIndex) => row.groups[groupIndex].values.forEach((cellData,valueIndex) => {
        if (!cellData.hit) return
        hitCircles.push({
          x:(groupStart + groupOffset + valueIndex * cell + cell / 2) * scaleX,
          y:(headerHeight + rowIndex * rowHeight + rowHeight / 2) * scaleY
        })
      }))
      groupOffset += group.values.length * cell
    })
    const drawVisibleSegment = (from,to) => {
      const ax = (groupStart + from.x) * scaleX
      const ay = (headerHeight + from.y) * scaleY
      const bx = (groupStart + to.x) * scaleX
      const by = (headerHeight + to.y) * scaleY
      const dx = bx - ax, dy = by - ay, lengthSquared = dx * dx + dy * dy
      if (!lengthSquared) return
      const length = Math.sqrt(lengthSquared)
      const blocked = []
      hitCircles.forEach(circle => {
        const projection = ((circle.x - ax) * dx + (circle.y - ay) * dy) / lengthSquared
        const clampedProjection = Math.max(0,Math.min(1,projection))
        const closestX = ax + dx * clampedProjection
        const closestY = ay + dy * clampedProjection
        const distanceSquared = (circle.x - closestX) ** 2 + (circle.y - closestY) ** 2
        if (distanceSquared > hitRadius * hitRadius) return
        const offset = Math.sqrt(Math.max(0,hitRadius * hitRadius - distanceSquared)) / length
        blocked.push([Math.max(0,projection - offset),Math.min(1,projection + offset)])
      })
      blocked.sort((left,right) => left[0] - right[0])
      const merged = blocked.reduce((ranges,current) => {
        const previous = ranges.at(-1)
        if (previous && current[0] <= previous[1]) previous[1] = Math.max(previous[1],current[1])
        else ranges.push([...current])
        return ranges
      },[])
      let cursor = 0
      const drawRange = (start,end) => {
        if (end - start <= 0.002) return
        context.beginPath()
        context.moveTo(ax + dx * start,ay + dy * start)
        context.lineTo(ax + dx * end,ay + dy * end)
        context.stroke()
      }
      merged.forEach(([start,end]) => { drawRange(cursor,start); cursor = Math.max(cursor,end) })
      drawRange(cursor,1)
    }
    context.save()
    context.setTransform(1,0,0,1,0,0)
    context.lineWidth = 1.6 * scale
    context.lineCap = 'round'
    context.strokeStyle = '#A0A0A0'
    context.globalAlpha = .85
    lines.forEach(line => {
      if (line.distribution || (game === 'ssq' && !line.accent)) return
      line.segments.forEach(segment => drawVisibleSegment(segment.from,segment.to))
    })
    context.restore()
  }
  const exportHighResolution = async () => {
    const target = document.getElementById(exportTargetId)
    if (!target || exporting) return
    const scroller = target.closest('.trend-scroll')
    const previousScrollLeft = scroller?.scrollLeft || 0
    setExporting(true)
    try {
      if (scroller) scroller.scrollLeft = 0
      const modeLabel = trendViewModes.find(([key]) => key === trendMode)?.[1] || '基本走势'
      await exportTrendElement(exportTargetId, exportFilename || `${games[game]?.name || game}-${modeLabel}-${rows.length}期.png`, {
        title: exportTitle || `${games[game]?.name || game}${modeLabel}`,
        params: exportParams ?? `期数：${rows.length}期${trendMode === 'basic' ? ` · 遗漏值：${showMisses ? '显示' : '隐藏'}${['ssq','dlt'].includes(game) ? ` · 连号标记：${showPatterns ? '显示' : '隐藏'}` : ''}` : ''}`
      }, {
        fullWidth: true,
        redrawTrendLines: trendMode === 'basic' && !['dlt','kl8'].includes(game),
        drawOverlay: (canvas,width,height) => {
          if (trendMode === 'basic' && !['dlt','kl8'].includes(game)) drawExportLines(canvas,width,height)
        }
      })
      trackAnalytics('export_chart',{ page:'trend', game })
    } finally { if (scroller) scroller.scrollLeft = previousScrollLeft; setExporting(false) }
  }
  useEffect(() => {
    if (!autoExport) return undefined
    let active = true
    exportHighResolution().catch(() => {}).finally(() => { if (active) onExportComplete?.() })
    return () => { active = false }
  }, [autoExport])
  const summaryHeight = summaryRows.length * 30
  const simulatorHeight = 56
  const canvasHeight = headerHeight + rows.length * rowHeight + simulatorHeight + summaryHeight
  const derivedBaseHeight = ['fc3d', 'pl3'].includes(game)
    ? (trendMode === 'span' || trendMode === 'sum' ? 72 : 72)
    : (trendMode === 'span' ? 64 : (trendMode === 'sum' ? 70 : 104))
  const renderedCanvasHeight = trendMode === 'basic' ? canvasHeight : derivedBaseHeight + rows.length * 34
  const renderedCanvasWidth = trendMode === 'basic' ? tableWidth : '100%'
  let boundaryOffset = 0
  const groupBoundaries = groups.slice(0, -1).map(group => { boundaryOffset += group.values.length * cell; return serialWidth + issueWidth + boundaryOffset })
  return <section className={`card classic-trend trend-fold-card ${expanded ? 'expanded' : ''} ${showPatterns ? 'show-pattern-hits' : ''}`} style={{ '--trend-table-width':`${tableWidth}px` }}><button className="trend-collapse-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span><b>基础走势图</b><small>近 {rows.length} 期 · 号码走势与遗漏统计</small></span><ChevronDown size={20}/></button>
    {expanded && <><div className="trend-view-tabs" role="tablist" aria-label="走势类型">{trendViewModes.map(([key,label]) => <button type="button" role="tab" aria-selected={trendMode === key} className={trendMode === key ? 'active' : ''} onClick={() => setTrendMode(key)} key={key}>{label}</button>)}</div><div className="trend-fold-controls"><span>横向滑动查看更多号码</span><div className="trend-filter-actions">{trendMode === 'basic' && <><label className="pattern-filter"><input type="checkbox" checked={showMisses} onChange={event => setShowMisses(event.target.checked)}/><i/><span>遗漏值</span></label>{['ssq','dlt'].includes(game) && <label className="pattern-filter"><input type="checkbox" checked={showPatterns} onChange={event => setShowPatterns(event.target.checked)}/><i/><span>连号标记</span></label>}</>}<button className="trend-export-button" disabled={exporting} onClick={exportHighResolution}><Download size={15}/>{exporting ? '生成中…' : '导出高清图'}</button><TrendPeriodPicker value={period} options={trendPeriodOptions} onChange={setPeriod}/></div></div>
    <div className="trend-scroll"><div className="trend-canvas" id={exportTargetId} style={{ width: renderedCanvasWidth, height: renderedCanvasHeight, '--trend-cell-size':`${cell}px` }}>
      {trendMode === 'basic' ? <>
      <div className="trend-group-head" style={{ height: 32, width: tableWidth }}><div className="trend-serial-head" style={{ width: serialWidth, height: headerHeight }}>序号</div><div className="trend-issue-head" style={{ width: issueWidth, height: headerHeight }}>期号</div>{groups.map(group => <div style={{ width: group.values.length * cell }} key={group.key}>{group.title}</div>)}{statColumns.map(([key,label,width]) => <div className="trend-stat-head" style={{ width, height: headerHeight }} key={key}>{label}</div>)}</div>
      <div className="trend-number-head" style={{ left: groupStart, width: totalCells * cell, height: 32 }}>{groups.flatMap(group => group.values.map(value => <div style={{ width: cell }} key={`${group.key}-${value}`}>{value}</div>))}</div>
      {showLines && game !== 'kl8' && <svg className="trend-lines" data-line-renderer="segments-v3" preserveAspectRatio="none" style={{ left:groupStart, top:headerHeight, width:totalCells * cell, height:rows.length * rowHeight }} width={totalCells * cell} height={rows.length * rowHeight} viewBox={`0 0 ${totalCells * cell} ${rows.length * rowHeight}`} aria-hidden="true">{lines.flatMap((line,lineIndex) => !line.distribution && (game !== 'ssq' || line.accent) ? line.segments.map((segment,segmentIndex) => <line data-from-row={segmentIndex} data-to-row={segmentIndex + 1} key={`${lineIndex}-${segmentIndex}`} x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke={line.color} strokeWidth="1.6" strokeLinecap="round" opacity=".85"/>) : [])}</svg>}
      {groupBoundaries.map((left, index) => <span className="trend-group-divider" style={{ left, height:canvasHeight }} key={index}/>) }
      <div className="trend-body" style={{ top: headerHeight }}>{rowData.map(({ record, groups: rowGroups, stats }) => <div className="trend-table-row" style={{ height: rowHeight }} key={record.id}><div className="trend-issue" style={{ width: issueWidth }}>{record.issue}</div>{rowGroups.flatMap((group, groupIndex) => group.values.map(cellData => <div className={`trend-cell ${cellData.hit ? `hit ${groups[groupIndex].accent ? 'hit-blue' : ''} ${cellData.patternHit ? 'pattern-hit' : ''} ${groups[groupIndex].distribution ? `distribution-hit ${cellData.hitCount > 1 ? 'repeat-hit' : ''}` : ''}` : ''}`} style={{ width: cell, height: rowHeight }} key={`${record.id}-${groupIndex}-${cellData.value}`}>{cellData.hit ? <b>{cellData.value}{groups[groupIndex].distribution && cellData.hitCount > 1 && <i>{cellData.hitCount}</i>}</b> : <span>{showMisses ? cellData.miss : ''}</span>}</div>))}{statColumns.map(([key,,width]) => <div className={`trend-stat ${key === 'shape' ? `shape-${stats[key] === '豹子' ? 'baozi' : stats[key] === '组三' ? 'group3' : 'group6'}` : ''}`} style={{ width, height: rowHeight }} key={`${record.id}-${key}`}><span>{stats[key]}</span></div>)}</div>)}<div className="trend-simulator" style={{ width:tableWidth }}><div className="trend-simulator-label" style={{ width:issueWidth }}>模拟选号</div>{groups.flatMap(group => group.values.map(value => group.distribution ? <span className="sim-placeholder" style={{ width:cell }} key={`${group.key}-${value}`}/> : <button className={(simulation[group.key] || []).includes(value) ? 'selected' : ''} style={{ width:cell }} onClick={() => chooseSimulation(group,value)} key={`${group.key}-${value}`}>{value}</button>))}<span style={{ width:statWidth }}/></div>{summaryRows.map(summary => <div className="trend-summary-row" style={{ height:30 }} key={summary.key}><div className="trend-summary-label" style={{ width:issueWidth }}>{summary.label}</div>{summary.groups.flatMap((values, groupIndex) => values.map((value, valueIndex) => <div className="trend-summary-cell" style={{ width:cell }} key={`${summary.key}-${groupIndex}-${valueIndex}`}>{value}</div>))}<div className="trend-summary-spacer" style={{ width:statWidth }}/></div>)}</div>
      </> : <TrendModeTable game={game} rows={rows} mode={trendMode}/>}
    </div></div>
    {trendMode === 'basic' && <div className="simulation-footer"><span>已选 <b>{selectedTotal}</b> 个，共 <b>{bets}</b> 注</span><label><input type="number" min="1" max="99" value={multiplier} onChange={event => setMultiplier(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}/> 倍</label><strong>{bets * multiplier * 2} 元</strong><button onClick={() => setSimulation({})}>清空选号</button><button className="save-simulation" disabled={!bets} onClick={saveSimulation}>保存方案</button></div>}
    </>}
  </section>
}

function appendExportHeader(canvas, { title = '走势图', params = '' } = {}) {
  const headerHeight = Math.round(Math.max(110, Math.min(180, canvas.width * .045)))
  const output = document.createElement('canvas')
  output.width = canvas.width
  output.height = canvas.height + headerHeight
  const context = output.getContext('2d')
  const padding = Math.round(Math.max(28, Math.min(56, canvas.width * .018)))
  const titleSize = Math.round(Math.max(24, Math.min(42, canvas.width * .014)))
  const paramsSize = Math.round(Math.max(15, Math.min(24, canvas.width * .007)))
  context.fillStyle = '#fff'
  context.fillRect(0, 0, output.width, output.height)
  context.fillStyle = '#26282d'
  context.font = `800 ${titleSize}px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif`
  context.textBaseline = 'middle'
  context.fillText(title, padding, headerHeight * .38)
  context.fillStyle = '#737984'
  context.font = `600 ${paramsSize}px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif`
  context.fillText(params, padding, headerHeight * .72)
  context.fillStyle = '#e8eaf0'
  context.fillRect(0, headerHeight - 1, output.width, 1)
  context.drawImage(canvas, 0, headerHeight)
  return output
}

async function appendExportWatermark(canvas) {
  const image = new Image()
  image.src = '/export-watermark.png'
  await image.decode()
  const footerHeight = Math.round(Math.max(180,Math.min(300,canvas.width * .06)))
  const output = document.createElement('canvas')
  output.width = canvas.width
  output.height = canvas.height + footerHeight
  const context = output.getContext('2d')
  context.drawImage(canvas,0,0)
  context.fillStyle = '#fff'
  context.fillRect(0,canvas.height,output.width,footerHeight)
  const watermarkHeight = footerHeight * .72
  const watermarkWidth = watermarkHeight * image.naturalWidth / image.naturalHeight
  const tinted = document.createElement('canvas')
  tinted.width = image.naturalWidth
  tinted.height = image.naturalHeight
  const tintedContext = tinted.getContext('2d')
  tintedContext.drawImage(image,0,0)
  tintedContext.globalCompositeOperation = 'source-in'
  tintedContext.fillStyle = '#26282d'
  tintedContext.fillRect(0,0,tinted.width,tinted.height)
  context.drawImage(tinted,(output.width-watermarkWidth)/2,canvas.height+(footerHeight-watermarkHeight)/2,watermarkWidth,watermarkHeight)
  return output
}

async function exportTrendElement(id, filename, exportMeta, captureOptions = {}) {
  const target = document.getElementById(id)
  if (!target) throw new Error('找不到要导出的内容')
  await document.fonts?.ready
  const { default:html2canvas } = await import('html2canvas')
  const renderScale = 3
  const fitWidth = captureOptions.fitWidth === true
  const fullWidth = captureOptions.fullWidth === true
  const redrawTrendLines = captureOptions.redrawTrendLines === true
  const withHeader = captureOptions.withHeader !== false
  const addCardDividers = captureOptions.addCardDividers === true
  const matrixColumns = Number(captureOptions.matrixColumns) > 0 ? Number(captureOptions.matrixColumns) : 0
  const hideInExport = Array.isArray(captureOptions.hideInExport) ? captureOptions.hideInExport : []
  const matrixMinWidth = matrixColumns ? matrixColumns * 330 + (matrixColumns - 1) * 10 + 28 : 0
  const captureWidth = Math.max(1, Math.round(matrixColumns ? Math.max(target.scrollWidth, matrixMinWidth) : (fitWidth ? target.getBoundingClientRect().width : target.scrollWidth)))
  const captureHeight = Math.max(1, Math.round(Math.max(target.scrollHeight, target.getBoundingClientRect().height)))
  const renderHeight = captureHeight + (matrixColumns ? 1024 : (addCardDividers ? 512 : 0))
  let clonedContentHeight = captureHeight
  const viewportWidth = Math.max(1, Math.round(fullWidth ? captureWidth : window.innerWidth || document.documentElement.clientWidth || captureWidth))
  const viewportHeight = Math.max(1, Math.round(fullWidth ? renderHeight : window.innerHeight || document.documentElement.clientHeight || renderHeight))
  let captured = await html2canvas(target,{ backgroundColor:'#fff', scale:renderScale, useCORS:true, logging:false, width:captureWidth, height:renderHeight, windowWidth:viewportWidth, windowHeight:viewportHeight, scrollX:fullWidth ? 0 : window.scrollX, scrollY:fullWidth ? 0 : window.scrollY, onclone:clonedDocument => {
    const cloneTarget = clonedDocument.getElementById(id)
    if (!cloneTarget) return
    cloneTarget.closest('.batch-export-node')?.style.setProperty('opacity','1')
    hideInExport.forEach(selector => cloneTarget.querySelectorAll(selector).forEach(element => { element.style.display = 'none' }))
    if (fullWidth) {
      const cloneScroller = cloneTarget.closest('.trend-scroll')
      if (cloneScroller) {
        cloneScroller.scrollLeft = 0
        cloneScroller.style.overflow = 'visible'
      }
      cloneTarget.querySelectorAll('.trend-issue').forEach(element => { element.style.position = 'relative'; element.style.left = '0' })
      if (redrawTrendLines) cloneTarget.querySelectorAll('.trend-lines').forEach(element => { element.style.display = 'none' })
    }
    if (matrixColumns) {
      const matrixGrid = cloneTarget.querySelector('.kl8-matrix-grid')
      if (matrixGrid) {
        cloneTarget.style.width = `${captureWidth}px`
        cloneTarget.style.minWidth = `${captureWidth}px`
        matrixGrid.style.gridTemplateColumns = `repeat(${matrixColumns}, minmax(330px, 1fr))`
      }
    }
    // The detail page keeps its normal full-width layout, but the exported
    // cold/hot card needs a little breathing room from the image edges.
    if (addCardDividers) {
      const detailOverview = [...cloneTarget.children].find(element => element.classList.contains('detail-overview'))
      if (detailOverview) {
        detailOverview.style.background = 'transparent'
        detailOverview.style.border = '0'
        detailOverview.style.boxShadow = 'none'
        const detailHero = [...detailOverview.children].find(element => element.classList.contains('detail-hero'))
        if (detailHero) {
          detailHero.style.background = 'transparent'
          detailHero.style.border = '0'
          detailHero.style.boxShadow = 'none'
        }
        const detailCard = [...detailOverview.children].find(element => element.classList.contains('detail-card'))
        if (detailCard) {
          detailCard.style.marginLeft = '12px'
          detailCard.style.marginRight = '12px'
        }
      }
      const coldHotCard = [...cloneTarget.children].find(element => element.classList.contains('cold-hot-card'))
      if (coldHotCard) {
        coldHotCard.style.marginLeft = '12px'
        coldHotCard.style.marginRight = '12px'
      }
      const qxcHistoryCard = [...cloneTarget.children].find(element => element.classList.contains('qxc-history-card'))
      if (qxcHistoryCard) {
        qxcHistoryCard.style.marginLeft = '12px'
        qxcHistoryCard.style.marginRight = '12px'
      }
      cloneTarget.querySelectorAll('.cold-hot-row').forEach(element => {
        element.style.background = 'transparent'
        element.style.border = '0'
        element.style.boxShadow = 'none'
      })
    }
    if (addCardDividers) {
      const cards = [...cloneTarget.children].filter(element => element.classList.contains('card'))
      const detailOverview = [...cloneTarget.children].find(element => element.classList.contains('detail-overview'))
      const detailSupplementaryCards = cards.filter(element => element.classList.contains('cold-hot-card') || element.classList.contains('qxc-history-card'))
      const dividerTargets = cards.length > 1 ? cards.slice(1) : (detailOverview && detailSupplementaryCards.length ? detailSupplementaryCards : [])
      dividerTargets.forEach(card => {
        const divider = clonedDocument.createElement('div')
        divider.setAttribute('aria-hidden', 'true')
        divider.style.height = '1px'
        divider.style.margin = '0 10px'
        divider.style.background = '#dfe3eb'
        card.parentNode.insertBefore(divider, card)
      })
    }
    clonedContentHeight = Math.max(1, Math.ceil(Math.max(cloneTarget.scrollHeight, cloneTarget.getBoundingClientRect().height)))
  } })
  const cropHeight = Math.min(captured.height, Math.max(1, Math.ceil(clonedContentHeight * renderScale)))
  if (cropHeight < captured.height) {
    const cropped = document.createElement('canvas')
    cropped.width = captured.width
    cropped.height = cropHeight
    cropped.getContext('2d').drawImage(captured, 0, 0, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
    captured = cropped
  }
  if (typeof captureOptions.drawOverlay === 'function') captureOptions.drawOverlay(captured,captureWidth,clonedContentHeight)
  const content = withHeader ? appendExportHeader(captured, exportMeta) : captured
  const canvas = await appendExportWatermark(content)
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png',1)
  link.style.position = 'fixed'
  link.style.left = '-9999px'
  link.style.top = '0'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => link.remove(), 1000)
}

const nextLotteryIssue = issue => /^\d+$/.test(issue || '') ? String(Number(issue) + 1).padStart(issue.length,'0') : `${issue || '--'}后`
const heatAnalysisPeriods = Array.from({ length:49 },(_,index) => index + 2)

function DltHeatTrend({ history, exportId, autoExport = false, onExportComplete, exportFilename, exportTitle, exportParams }) {
  const [expanded,setExpanded] = useState(false), [analysis,setAnalysis] = useState(10), [period,setPeriod] = useState(30), [exporting,setExporting] = useState(false)
  const exportTargetId = exportId || 'dlt-heat-export'
  const rows = useMemo(() => {
    const chronological = [...history].reverse(), start = Math.max(0,chronological.length - period)
    const rank = (records,field,max,sizes) => {
      const counts = Array(max + 1).fill(0)
      records.forEach(record => (record[field] || []).forEach(value => { const number=Number(value); if (number >= 1 && number <= max) counts[number] += 1 }))
      const sorted = Array.from({length:max},(_,index)=>index+1).sort((a,b)=>counts[b]-counts[a] || b-a)
      let offset=0; return sizes.map(size => { const values=sorted.slice(offset,offset+size); offset += size; return values })
    }
    const actualRows = chronological.slice(start).map((record,visibleIndex) => {
      const index=start+visibleIndex, sample=chronological.slice(Math.max(0,index-analysis),index), front=rank(sample,'redBalls',35,[12,12,11]), back=rank(sample,'blueBalls',12,[6,6]), frontHits=new Set(record.redBalls.map(Number)), backHits=new Set(record.blueBalls.map(Number))
      return { record,front,back,frontHits,backHits,ratio:front.map(group=>group.filter(number=>frontHits.has(number)).length).join(':') }
    })
    const latest = chronological.at(-1)
    if (!latest) return actualRows
    const sample = chronological.slice(-analysis)
    return [...actualRows,{ record:{id:'dlt-next-period',issue:nextLotteryIssue(latest.issue)}, front:rank(sample,'redBalls',35,[12,12,11]), back:rank(sample,'blueBalls',12,[6,6]), frontHits:new Set(), backHits:new Set(), ratio:'--', forecast:true }]
  },[history,analysis,period])
  const download = async () => { setExporting(true); try { await exportTrendElement(exportTargetId,exportFilename || `大乐透-冷热图-${analysis}期分析-${period}期.png`,{ title:exportTitle || '大乐透冷热图', params:exportParams || `分析：${analysis}期 · 显示：${period}期` }); trackAnalytics('export_chart',{page:'trend',game:'dlt',chart:'heat'}) } finally { setExporting(false) } }
  useEffect(() => {
    if (!autoExport) return undefined
    if (!expanded) {
      setExpanded(true)
      return undefined
    }
    let active = true
    download().catch(() => {}).finally(() => { if (active) onExportComplete?.() })
    return () => { active = false }
  }, [autoExport, expanded])
  const cells=(numbers,type,hits,prefix)=>numbers.map(number=><td className={`heat-number ${hits.has(number)?`hit ${type}`:''}`} key={`${prefix}-${type}-${number}`}>{String(number).padStart(2,'0')}</td>)
  return <section className={`card trend-fold-card heat-trend-card ${expanded?'expanded':''}`}><button className="trend-collapse-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><span><b>冷热图</b><small>按频次降序 · 同频号码降序</small></span><ChevronDown size={20}/></button>{(expanded || autoExport)&&<><div className="trend-fold-controls heat-controls"><span>每行统计该期开奖前所选期数，再标注当期奖号</span><div className="trend-filter-actions"><label className="period-filter"><span>分析</span><select value={analysis} onChange={event=>setAnalysis(Number(event.target.value))}>{heatAnalysisPeriods.map(value=><option value={value} key={value}>{value}期</option>)}</select></label><label className="period-filter"><span>显示</span><select value={period} onChange={event=>setPeriod(Number(event.target.value))}>{[30,50,100].map(value=><option value={value} key={value}>{value}期</option>)}</select></label><button className="trend-export-button" disabled={exporting} onClick={download}><Download size={15}/>{exporting?'生成中…':'导出高清图'}</button></div></div><div className="heat-table-scroll"><table className="heat-table ranked-heat-table" id={exportTargetId}><thead><tr><th rowSpan="2">期号</th><th colSpan="35">前区</th><th rowSpan="2">三区比</th><th colSpan="12">后区</th></tr><tr><th className="hot-label" colSpan="12">热码(12)</th><th className="warm-label" colSpan="12">温码(12)</th><th className="cold-label" colSpan="11">冷码(11)</th><th className="hot-label" colSpan="6">热码(6)</th><th className="cold-label" colSpan="6">冷码(6)</th></tr></thead><tbody>{rows.map(row=><tr className={row.forecast?'forecast-row':''} key={row.record.id}><th>{row.record.issue}</th>{cells(row.front[0],'hot',row.frontHits,'front')}{cells(row.front[1],'warm',row.frontHits,'front')}{cells(row.front[2],'cold',row.frontHits,'front')}<td className="heat-ratio">{row.ratio}</td>{cells(row.back[0],'hot',row.backHits,'back')}{cells(row.back[1],'cold',row.backHits,'back')}</tr>)}{Array.from({length:2},(_,rowIndex)=><tr className="heat-blank-row" key={`dlt-blank-${rowIndex}`}><th>&nbsp;</th>{Array.from({length:35},(_,index)=><td className="heat-number" key={`front-${index}`}/>)}<td className="heat-ratio"/>{Array.from({length:12},(_,index)=><td className="heat-number" key={`back-${index}`}/>)}</tr>)}</tbody></table></div></>}</section>
}

function SsqHeatTrend({ history, exportId, autoExport = false, onExportComplete, exportFilename, exportTitle, exportParams }) {
  const [expanded,setExpanded] = useState(false), [analysis,setAnalysis] = useState(10), [period,setPeriod] = useState(30), [exporting,setExporting] = useState(false)
  const exportTargetId = 'ssq-heat-export'
  const rows = useMemo(() => {
    const chronological = [...history].reverse(), start = Math.max(0,chronological.length - period)
    const rank = (records,field,max,sizes) => {
      const counts = Array(max + 1).fill(0)
      records.forEach(record => (record[field] || []).forEach(value => { const number=Number(value); if (number >= 1 && number <= max) counts[number] += 1 }))
      const sorted = Array.from({length:max},(_,index)=>index+1).sort((a,b)=>counts[b]-counts[a] || b-a)
      let offset=0; return sizes.map(size => { const values=sorted.slice(offset,offset+size); offset += size; return values })
    }
    const actualRows = chronological.slice(start).map((record,visibleIndex) => {
      const index = start + visibleIndex
      const sample = chronological.slice(Math.max(0,index-analysis),index)
      const front = record.redBalls.map(Number)
      return { record, red:rank(sample,'redBalls',33,[11,11,11]), blue:rank(sample,'blueBalls',16,[8,8]), redHits:new Set(front), blueHits:new Set(record.blueBalls.map(Number)), zoneRatio:[front.filter(value=>value<=11).length,front.filter(value=>value>=12&&value<=22).length,front.filter(value=>value>=23).length].join(':'), sum:front.reduce((total,value) => total + value,0), extreme:front.length ? Math.max(...front) - Math.min(...front) : '--' }
    })
    const latest = chronological.at(-1)
    if (!latest) return actualRows
    const nextSample = chronological.slice(-analysis)
    return [...actualRows,{ record:{ id:'ssq-next-period',issue:nextLotteryIssue(latest.issue) }, red:rank(nextSample,'redBalls',33,[11,11,11]), blue:rank(nextSample,'blueBalls',16,[8,8]), redHits:new Set(), blueHits:new Set(), zoneRatio:'--', sum:'--', extreme:'--', forecast:true }]
  },[history,analysis,period])
  const cells=(numbers,type,hits,prefix)=>numbers.map(number=><td className={`heat-number ${hits.has(number)?`hit ${type}`:''}`} key={`${prefix}-${type}-${number}`}>{String(number).padStart(2,'0')}</td>)
  const download = async () => { setExporting(true); try { await exportTrendElement(exportTargetId,exportFilename || `双色球-冷热图-${analysis}期分析-${period}期.png`,{ title:exportTitle || '双色球冷热图', params:exportParams || `分析：${analysis}期 · 显示：${period}期` }); trackAnalytics('export_chart',{page:'trend',game:'ssq',chart:'heat'}) } finally { setExporting(false) } }
  useEffect(() => {
    if (!autoExport) return undefined
    if (!expanded) {
      setExpanded(true)
      return undefined
    }
    let active = true
    download().catch(() => {}).finally(() => { if (active) onExportComplete?.() })
    return () => { active = false }
  }, [autoExport, expanded])
  return <section className={`card trend-fold-card heat-trend-card ${expanded?'expanded':''}`}><button className="trend-collapse-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span><b>冷热图</b><small>按频次降序 · 同频号码降序</small></span><ChevronDown size={20}/></button>{expanded&&<><div className="trend-fold-controls heat-controls"><span>每行统计该期开奖前所选期数，再标注当期奖号</span><div className="trend-filter-actions"><label className="period-filter"><span>分析</span><select value={analysis} onChange={event=>setAnalysis(Number(event.target.value))}>{heatAnalysisPeriods.map(value=><option value={value} key={value}>{value}期</option>)}</select></label><label className="period-filter"><span>显示</span><select value={period} onChange={event => setPeriod(Number(event.target.value))}>{[30,50,100].map(value => <option value={value} key={value}>{value}期</option>)}</select></label><button className="trend-export-button" disabled={exporting} onClick={download}><Download size={15}/>{exporting?'生成中…':'导出高清图'}</button></div></div><div className="heat-table-scroll"><table className="heat-table ranked-heat-table ssq-ranked-heat" id="ssq-heat-export"><thead><tr><th rowSpan="2">期号</th><th colSpan="33">红球</th><th rowSpan="2">三区比</th><th rowSpan="2">和值</th><th rowSpan="2">极值</th><th colSpan="16">蓝球</th></tr><tr><th className="hot-label" colSpan="11">热码(11)</th><th className="warm-label" colSpan="11">温码(11)</th><th className="cold-label" colSpan="11">冷码(11)</th><th className="hot-label" colSpan="8">热码(8)</th><th className="cold-label" colSpan="8">冷码(8)</th></tr></thead><tbody>{rows.map(row => <tr className={row.forecast?'forecast-row':''} key={row.record.id}><th>{row.record.issue}</th>{cells(row.red[0],'hot',row.redHits,'red')}{cells(row.red[1],'warm',row.redHits,'red')}{cells(row.red[2],'cold',row.redHits,'red')}<td className="heat-ratio">{row.zoneRatio}</td><td className="heat-stat-value">{row.sum}</td><td className="heat-stat-value">{row.extreme}</td>{cells(row.blue[0],'hot',row.blueHits,'blue')}{cells(row.blue[1],'cold',row.blueHits,'blue')}</tr>)}{Array.from({length:2},(_,rowIndex)=><tr className="heat-blank-row" key={`ssq-blank-${rowIndex}`}><th>&nbsp;</th>{Array.from({length:33},(_,index)=><td className="heat-number" key={`red-${index}`}/>) }<td className="heat-ratio"/><td className="heat-stat-value"/><td className="heat-stat-value"/>{Array.from({length:16},(_,index)=><td className="heat-number" key={`blue-${index}`}/>)}</tr>)}</tbody></table></div></>}</section>
}

function Kl8DataViews({ history, viewOverride, autoExport = false, onExportComplete, exportFilename, exportTitle, exportParams }) {
  const [expanded,setExpanded]=useState(false),[view,setView]=useState(viewOverride || 'matrix'),[period,setPeriod]=useState(20),[exporting,setExporting]=useState(false)
  const rows=useMemo(()=>history.slice(0,period).reverse(),[history,period])
  const metrics=record=>{const numbers=record.redBalls.map(Number).sort((a,b)=>a-b),sum=numbers.reduce((a,b)=>a+b,0),min=numbers[0],max=numbers.at(-1),span=max-min;let runs=0;for(let i=1;i<numbers.length;i++)if(numbers[i]===numbers[i-1]+1&&(i===1||numbers[i-1]!==numbers[i-2]+1))runs++;return{sum,span,max,min,sumTail:sum%10,average:Math.round(sum/numbers.length),sumSpan:sum+span,diffSpan:sum-span,tailSum:numbers.reduce((total,n)=>total+n%10,0),runs,tailGroups:new Set(numbers.map(n=>n%10)).size}}
  const columns=[['sum','和值'],['span','跨度'],['max','最大值'],['min','最小值'],['sumTail','和值尾'],['average','均值'],['sumSpan','和跨和'],['diffSpan','和跨差'],['tailSum','尾数和值'],['runs','连号组数'],['tailGroups','尾数组数']]
  const download=async()=>{setExporting(true);try{const title=exportTitle || `快乐8${view==='matrix'?'基础矩阵图':'综合数据查阅表'}`;await exportTrendElement('kl8-data-export',exportFilename || `${title}-${period}期.png`,{ title, params:exportParams || `显示：${period}期` },{ matrixColumns:view==='matrix' ? 3 : 0 });trackAnalytics('export_chart',{page:'trend',game:'kl8',chart:view})}finally{setExporting(false)}}
  useEffect(() => {
    if (!autoExport) return undefined
    if (!expanded) {
      setExpanded(true)
      return undefined
    }
    let active = true
    download().catch(() => {}).finally(() => { if (active) onExportComplete?.() })
    return () => { active = false }
  }, [autoExport, expanded])
  return <section className={`card trend-fold-card kl8-data-card ${expanded?'expanded':''}`}><button className="trend-collapse-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><span><b>快乐8数据图表</b><small>基础矩阵与综合数据查阅</small></span><ChevronDown size={20}/></button>{expanded&&<><div className="trend-fold-controls kl8-data-controls"><div className="kl8-view-tabs"><button className={view==='matrix'?'active':''} onClick={()=>setView('matrix')}>基础矩阵图</button><button className={view==='analytics'?'active':''} onClick={()=>setView('analytics')}>综合数据查阅表</button></div><div className="trend-filter-actions"><label className="period-filter"><span>期数</span><select value={period} onChange={event=>setPeriod(Number(event.target.value))}>{[20,30,50,100].map(value=><option value={value} key={value}>近 {value} 期</option>)}</select></label><button className="trend-export-button" disabled={exporting} onClick={download}><Download size={15}/>{exporting?'生成中…':'下载图片'}</button></div></div><div className="kl8-data-scroll"><div id="kl8-data-export">{view==='matrix'?<div className="kl8-matrix-grid">{rows.map(record=>{const hits=new Set(record.redBalls.map(Number));return <article className="kl8-matrix-item" key={record.id}><h4>{record.issue}期</h4><div>{Array.from({length:80},(_,index)=>index+1).map(number=><span className={hits.has(number)?'hit':''} key={number}>{String(number).padStart(2,'0')}</span>)}</div></article>})}</div>:<table className="kl8-analytics-table"><thead><tr><th>期号</th>{columns.map(([,label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(record=>{const data=metrics(record);return <tr key={record.id}><th>{record.issue}</th>{columns.map(([key])=><td key={key}>{data[key]}</td>)}</tr>})}</tbody></table>}</div></div></>}</section>
}

function HistoryList({ history, defaultExpanded = false, alwaysExpanded = false, showAll = false, onOpen }) {
  const [expanded, setExpanded] = useState(defaultExpanded || alwaysExpanded)
  const [period, setPeriod] = useState(30)
  const [page, setPage] = useState(1)
  const filtered = showAll ? history : history.slice(0, period)
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10))
  const rows = showAll ? filtered : filtered.slice((page - 1) * 10, page * 10)
  const changePeriod = value => { setPeriod(value); setPage(1) }
  return <section className={`card trend-history trend-fold-card ${expanded ? 'expanded' : ''}`}>{alwaysExpanded ? <div className="trend-collapse-toggle history-static-title"><span><b>历史开奖号码</b><small>共 {history.length} 期</small></span></div> : <button className="trend-collapse-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span><b>历史开奖号码</b><small>近 {period} 期 · 每页10期</small></span><ChevronDown size={20}/></button>}
    {expanded && <div className="trend-history-content"><div className="history-head"><span>开奖明细</span>{!showAll && <label className="period-filter"><span>期数</span><select value={period} onChange={event => changePeriod(Number(event.target.value))}>{[10,20,30,50].map(value => <option value={value} key={value}>近 {value} 期</option>)}</select></label>}</div>
    <div className="history-list">{rows.map((record,index) => <button type="button" className="history history-link list-entry" style={{ '--list-index': index }} onClick={() => onOpen?.(record)} key={record.id}><span>第 {record.issue} 期</span><Balls small groups={[{ values: record.redBalls }, { values: record.blueBalls, accent: true }]}/></button>)}</div>
    {!showAll && <div className="history-pagination"><button disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>上一页</button><span>{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>下一页</button></div>}
    </div>}
  </section>
}

function HistoryPage({ item, all, back, onOpen }) {
  const initialHistory = useMemo(() => all.filter(record => record.game === item.game), [all, item.game])
  const [history, setHistory] = useState(initialHistory)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let timer
    let firstLoad = true
    setHistory(initialHistory)
    setLoading(true)
    setError('')
    const refresh = () => {
      if (!active || document.hidden) return
      fetchHistory(item.game).then(rows => {
        if (active) setHistory(loaded => mergeRecords(rows, loaded))
      }).catch(() => {
        if (active && firstLoad) setError('完整历史数据暂时不可用，当前显示已加载数据')
      }).finally(() => {
        if (active && firstLoad) { firstLoad = false; setLoading(false) }
      })
    }
    const schedule = () => { timer = setTimeout(() => { refresh(); schedule() }, drawSyncInterval()) }
    const onFocus = () => refresh()
    const onVisibility = () => { if (!document.hidden) refresh() }
    refresh(); schedule()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { active = false; clearTimeout(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility) }
  }, [initialHistory, item.game])
  return <main><button className="back" onClick={back}><ArrowLeft size={18}/> 返回</button>
    <div className="section-head page-title-compact"><div><h1>{item.name}历史开奖</h1><p>按期查看开奖号码</p></div><span className={`game-icon ${item.game}`}>{item.icon}</span></div>
    {(loading || error) && <p className={`history-load-status ${error ? 'error' : ''}`}>{loading ? '正在加载全部历史开奖…' : error}</p>}
    <HistoryList history={history} defaultExpanded alwaysExpanded showAll onOpen={record => onOpen?.(record, history)}/>
  </main>
}

function RulesPage({ item, back }) {
  const rule = rules.find(entry => entry.key === item.game)
  const detail = playRules[item.game]
  return <main><button className="back" onClick={back}><ArrowLeft size={18}/> 返回</button>
    <div className="section-head page-title-compact"><div><h1>{item.name}玩法规则</h1><p>选号方式与号码范围</p></div><span className={`game-icon ${item.game}`}>{item.icon}</span></div>
    <section className="card rules-card"><h2>{detail?.title || '基本规则'}</h2><p className="rules-summary">{detail?.intro}</p>
      <div className="rules-section"><h3>开奖时间</h3><p>{detail?.drawTime}</p></div>
      <div className="rules-section"><h3>玩法规则</h3>{detail?.paragraphs.map((paragraph,index) => <p key={index}>{paragraph}</p>)}</div>
      <div className="rules-groups">{rule?.groups.map((group,index) => <article key={index}><b>{rule.groups.length > 1 ? (group.accent ? '蓝球 / 后区' : '红球 / 前区') : '号码区'}</b><span>{rule.pickCountOptions ? `选择 ${rule.pickCountOptions[0]}—${rule.pickCountOptions.at(-1)} 个号码` : `选择 ${group.count} 个号码`}</span><small>范围 {group.min}—{group.max}{group.repeatable ? '，号码可重复' : '，号码不重复'}</small></article>)}</div>
      {detail?.prizes?.length > 0 && <div className="rules-section"><h3>奖项设置</h3><div className="rules-table-wrap"><table className="rules-table"><thead><tr><th>奖级 / 玩法</th><th>中奖说明</th><th>奖金</th></tr></thead><tbody>{detail.prizes.map((row,index) => <tr key={index}>{row.map((cell,cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div></div>}
    </section>
    <section className="card rules-notice"><h3><Info size={18}/>温馨提示</h3><p>本页仅作玩法说明与号码查询，不提供彩票销售或代购服务。规则若有调整，请以官方最新公告为准。</p></section>
  </main>
}

const statusMetrics = { oddEven:'奇偶比', bigSmall:'大小比', sumTail:'和尾', span:'跨度', shape:'组选形态', primeComposite:'质合比', danma:'胆码' }
const maColors = { ma5:'#ff9500', ma10:'#3478f6', ma20:'#af52de' }
const LazyKlineChart = React.lazy(() => import('./KlineChart.jsx'))

function getStatusOptions(game, metric) {
  const digits = game === 'pl5' ? 5 : 3
  if (metric === 'danma') return Array.from({ length:10 }, (_, index) => String(index))
  if (['oddEven','bigSmall','primeComposite'].includes(metric)) return Array.from({ length:digits + 1 }, (_, index) => `${digits - index}:${index}`)
  if (metric === 'shape') return ['豹子','组三','组六']
  return Array.from({ length:10 }, (_, index) => String(index))
}

function getStatusValue(game, metric, record) {
  const digits = record.redBalls.map(Number).filter(Number.isFinite)
  const ratio = predicate => `${digits.filter(predicate).length}:${digits.filter(value => !predicate(value)).length}`
  if (metric === 'oddEven') return ratio(value => value % 2 === 1)
  if (metric === 'bigSmall') return ratio(value => value >= 5)
  if (metric === 'primeComposite') return ratio(value => [1,2,3,5,7].includes(value))
  if (metric === 'sumTail') return String(digits.reduce((sum,value) => sum + value, 0) % 10)
  if (metric === 'span') return String(digits.length ? Math.max(...digits) - Math.min(...digits) : 0)
  if (metric === 'shape') return getDigitShape(game, digits)
  if (metric === 'danma') return digits.join(',')
  return '--'
}

function buildStatusTrendData(history, game, metric, target, period) {
  const chronological = history.slice(0, period).reverse()
  const prepared = chronological.map(record => { const actual = getStatusValue(game, metric, record); const hit = metric === 'danma' ? actual.split(',').includes(target) : actual === target; return { record, actual, hit } })
  let trend = 0, omission = 0, hitStreak = 0, missStreak = 0
  const rows = prepared.map(({ record, actual, hit }) => {
    const open = trend
    const hitOmission = hit ? omission : null
    if (hit) { hitStreak += 1; missStreak = 0 } else { missStreak += 1; hitStreak = 0 }
    const change = hit ? 3 : -1
    trend += change
    omission = hit ? 0 : omission + 1
    return { issue:record.issue, numbers:record.redBalls.join(' '), actual, target, hit, open, close:trend, change, range:[Math.min(open,trend),Math.max(open,trend)], omission, hitOmission }
  })
  return rows.map((row,index) => {
    const average = length => index + 1 < length ? null : Number((rows.slice(index - length + 1,index + 1).reduce((sum,item) => sum + item.close,0) / length).toFixed(2))
    return { ...row, ma5:average(5), ma10:average(10), ma20:average(20) }
  })
}

function StatusTrendAnalysis({ history, game }) {
  const [expanded, setExpanded] = useState(false)
  const metricKeys = game === 'pl5' ? ['oddEven','bigSmall','primeComposite','sumTail','span','danma'] : ['oddEven','bigSmall','shape','sumTail','span','danma']
  const [metric, setMetric] = useState('oddEven')
  const options = getStatusOptions(game, metric)
  const [target, setTarget] = useState(() => getStatusOptions(game,'oddEven')[1])
  const [period, setPeriod] = useState(30)
  const [movingAverages, setMovingAverages] = useState({ ma5:true, ma10:true, ma20:true })
  const [fitScreen, setFitScreen] = useState(false)
  const chooseMetric = key => { setMetric(key); setTarget(getStatusOptions(game,key)[0]) }
  const issueOptions = useMemo(() => history.slice(0,period).reverse().map(record => record.issue), [history, period])
  const rangeTouched = useRef(false)
  const [startIssue, setStartIssue] = useState(() => history.slice(0,30).at(-1)?.issue || '')
  const [endIssue, setEndIssue] = useState(() => history[0]?.issue || '')
  useEffect(() => { rangeTouched.current = false; setStartIssue(issueOptions[0] || ''); setEndIssue(issueOptions.at(-1) || '') }, [period, game])
  useEffect(() => {
    if (rangeTouched.current || issueOptions.length < 2 || startIssue !== endIssue) return
    setStartIssue(issueOptions[0]); setEndIssue(issueOptions.at(-1))
  }, [issueOptions, startIssue, endIssue])
  const rangeHistory = useMemo(() => {
    const chronological = history.slice(0,period).reverse()
    const startIndex = Math.max(0, chronological.findIndex(record => record.issue === startIssue))
    const matchedEnd = chronological.findIndex(record => record.issue === endIssue)
    const endIndex = matchedEnd < 0 ? chronological.length - 1 : matchedEnd
    return chronological.slice(Math.min(startIndex,endIndex), Math.max(startIndex,endIndex) + 1).reverse()
  }, [history, period, startIssue, endIssue])
  const data = useMemo(() => buildStatusTrendData(rangeHistory, game, metric, target, rangeHistory.length), [rangeHistory, game, metric, target])
  const hits = data.filter(row => row.hit).length
  const completedOmissions = data.filter(row => row.hit).map(row => row.hitOmission)
  const averageOmission = completedOmissions.length ? Number((completedOmissions.reduce((sum,value) => sum + value,0) / completedOmissions.length).toFixed(1)) : 0
  const maximumOmission = Math.max(0,...completedOmissions)
  return <section className={`card kline-card ${expanded ? 'expanded' : ''}`}><button className="kline-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span><b>指标状态趋势</b><small>{statusMetrics[metric]} {target} · 出现上涨 / 遗漏下降</small></span><ChevronDown size={20}/></button>
    {expanded && <div className="kline-content"><div className="kline-controls"><div className="kline-metrics">{metricKeys.map(key => <button className={metric === key ? 'active' : ''} onClick={() => chooseMetric(key)} key={key}>{statusMetrics[key]}</button>)}</div><label className="period-filter"><span>期数</span><select value={period} onChange={event => setPeriod(Number(event.target.value))}>{[20,30,50,100,120].map(value => <option value={value} key={value}>近 {value} 期</option>)}</select></label></div>
      <div className="status-target-row"><label><span>目标状态</span><select value={target} onChange={event => setTarget(event.target.value)}>{options.map(value => <option value={value} key={value}>{value}</option>)}</select></label><div><span>出现 <b>{hits}</b> 次</span><span>平均遗漏 <b>{averageOmission}</b></span><span>最大遗漏 <b>{maximumOmission}</b></span></div></div>
      <div className="ma-switches">{[['ma5','MA5'],['ma10','MA10'],['ma20','MA20']].map(([key,label]) => <label style={{ '--ma-color':maColors[key] }} key={key}><input type="checkbox" checked={movingAverages[key]} onChange={() => setMovingAverages(current => ({ ...current, [key]:!current[key] }))}/><i/>{label}</label>)}<button type="button" className={fitScreen ? 'active' : ''} aria-pressed={fitScreen} onClick={() => setFitScreen(value => !value)}>{fitScreen ? '已适应屏幕' : '适应屏幕'}</button></div>
      <div className={`kline-scroll ${fitScreen ? 'fit-screen' : ''}`}><div className="status-trend-canvas" style={{ '--trend-points':data.length }}><React.Suspense fallback={<div className="kline-loading">正在加载图表…</div>}><LazyKlineChart data={data} movingAverages={movingAverages} colors={maColors} metricLabel={statusMetrics[metric]} target={target} averageOmission={averageOmission} maximumOmission={maximumOmission} issueOptions={issueOptions} startIssue={startIssue} endIssue={endIssue} onStartIssueChange={next => { rangeTouched.current = true; setStartIssue(next); if (issueOptions.indexOf(next) > issueOptions.indexOf(endIssue)) setEndIssue(next) }} onEndIssueChange={next => { rangeTouched.current = true; setEndIssue(next); if (issueOptions.indexOf(next) < issueOptions.indexOf(startIssue)) setStartIssue(next) }}/></React.Suspense></div></div>
      <p className="kline-notice">红柱表示目标状态当期出现并向上 3 个单位，绿柱表示当期未出现并向下 1 个单位；每根柱从上一根柱的终点连续起始。历史统计仅供参考。</p></div>}
  </section>
}

function Trend({ item, all, back, save, onOpen }) {
  const [activeGame, setActiveGame] = useState(item.game)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerClosing, setPickerClosing] = useState(false)
  const pickerCloseTimer = useRef(null)
  const initialHistory = useMemo(() => all.filter(record => record.game === activeGame).slice(0, 120), [all, activeGame])
  const [history, setHistory] = useState(initialHistory)
  useEffect(() => {
    let cancelled = false
    let timer
    setHistory(initialHistory)
    const refresh = () => {
      if (cancelled || document.hidden) return
      fetchHistory(activeGame).then(records => { if (!cancelled) setHistory(loaded => mergeRecords(records, loaded)) }).catch(() => {})
    }
    const schedule = () => { timer = setTimeout(() => { refresh(); schedule() }, drawSyncInterval()) }
    const onFocus = () => refresh()
    const onVisibility = () => { if (!document.hidden) refresh() }
    refresh(); schedule()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility) }
  }, [activeGame])
  const activeItem = all.find(record => record.game === activeGame) || item
  const frequencyPeriod = ['fc3d', 'pl3'].includes(activeGame) ? 20 : activeGame === 'pl5' ? 10 : 30
  const frequencyHistory = history.slice(0, frequencyPeriod)
  const numbers = useMemo(() => {
    const domains = { fc3d:[0,9], pl3:[0,9], pl5:[0,9], ssq:[1,33], dlt:[1,35], qxc:[0,9], qlc:[1,30], kl8:[1,80] }
    const [min,max] = domains[activeGame] || [0,9]
    const counts = new Map(Array.from({ length:max - min + 1 }, (_,index) => [min + index,0]))
    frequencyHistory.forEach(record => record.redBalls.forEach(value => { const normalized = Number(value); if (counts.has(normalized)) counts.set(normalized,(counts.get(normalized) || 0) + 1) }))
    return [...counts].map(([value,count]) => ({ value:min === 0 ? String(value) : String(value).padStart(2,'0'), count })).sort((a,b) => b.count - a.count || Number(a.value) - Number(b.value))
  }, [frequencyHistory,activeGame])
  const maxFrequency = Math.max(1, ...numbers.map(number => number.count))
  useEffect(() => () => clearTimeout(pickerCloseTimer.current), [])
  useEffect(() => {
    if (!pickerOpen) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') closePicker() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pickerOpen, pickerClosing])
  const openPicker = () => { clearTimeout(pickerCloseTimer.current); setPickerClosing(false); setPickerOpen(true) }
  const closePicker = () => {
    if (!pickerOpen || pickerClosing) return
    setPickerClosing(true)
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 180
    pickerCloseTimer.current = setTimeout(() => { setPickerOpen(false); setPickerClosing(false) }, duration)
  }
  if (!history.length) return <main><button className="back" onClick={back}><ArrowLeft size={18}/> 返回</button><section className="card state"><h2>暂无走势图数据</h2><p>当前彩种暂未加载到开奖数据，请稍后重试。</p></section></main>
  const chooseGame = game => { setActiveGame(game); closePicker(); scrollTo(0,0) }
  return <main className="trend-page"><button className="back" onClick={back}><ArrowLeft size={18}/> 返回</button>
    <div className="section-head"><div><h1>{activeItem.name}走势图</h1><p>点击右侧图标切换彩种</p></div><button className="trend-game-switch" aria-label="切换彩种" aria-haspopup="dialog" aria-expanded={pickerOpen && !pickerClosing} onClick={openPicker}><span className={`game-icon ${activeGame}`}>{activeItem.icon}</span><ChevronDown size={15}/></button></div>
    <section className="card frequency"><h3>号码出现次数 <small>近 {frequencyHistory.length} 期</small></h3><div className={`frequency-bars ${['ssq','dlt','qxc','qlc','kl8'].includes(activeGame) ? 'frequency-bars-scroll' : ''}`}>{numbers.map(number => <div className="frequency-bar-item" key={number.value}><span>{number.value}</span><i><em style={{ width:`${number.count / maxFrequency * 100}%` }}/></i><b>{number.count} 次</b></div>)}</div></section>
    <TraditionalTrendTable key={activeGame} game={activeGame} history={history} save={save}/>
    {activeGame === 'dlt' && <DltHeatTrend history={history}/>}
    {activeGame === 'ssq' && <SsqHeatTrend history={history}/>}
    {activeGame === 'kl8' && <Kl8DataViews history={history}/>}
    {['fc3d','pl3','pl5'].includes(activeGame) && <StatusTrendAnalysis key={`status-${activeGame}`} history={history} game={activeGame}/>}
    {pickerOpen && <div className={`game-picker-backdrop ${pickerClosing ? 'is-closing' : ''}`} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closePicker() }}><section className={`game-picker ${pickerClosing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="game-picker-title"><header><div><h2 id="game-picker-title">选择彩种</h2><p>切换查看对应的走势数据</p></div><button aria-label="关闭" onClick={closePicker}>×</button></header><div className="game-picker-grid">{gameOrder.map(game => { const record = all.find(row => row.game === game); const meta = games[game]; return <button className={activeGame === game ? 'active' : ''} onClick={() => chooseGame(game)} key={game}><span className={`game-icon ${game}`}>{record?.icon || meta?.icon}</span><b>{record?.name || meta?.name}</b>{activeGame === game && <small>当前</small>}</button> })}</div></section></div>}
  </main>
}

function countColdHotNumbers(records, field, max, { pad = true, unique = false } = {}) {
  const start = max === 9 ? 0 : 1
  const values = Array.from({ length:max - start + 1 }, (_,index) => start + index)
  const counts = new Map(values.map(value => [value,0]))
  records.forEach(record => {
    const row = (record[field] || []).map(Number).filter(Number.isFinite)
    const numbers = unique ? [...new Set(row)] : row
    numbers.forEach(value => counts.set(value,(counts.get(value) || 0) + 1))
  })
  return values.map(value => ({ value:pad ? String(value).padStart(2,'0') : String(value), count:counts.get(value) || 0 }))
}

function thresholdGroups(entries, period, slots) {
  const numberCount = Math.max(entries.length, 1)
  const expected = Math.max(0, Number(period) * Number(slots || 1) / numberCount)
  // 用期数推导当前窗口的平均出现次数，并留出半次或 15% 的波动带：
  // 高于上沿为热码，落在波动带内为温码，低于下沿为冷码。
  const tolerance = Math.max(0.5, expected * 0.15)
  const hotMin = Math.max(1, Math.ceil(expected + tolerance))
  const warmMin = Math.max(1, Math.ceil(expected - tolerance))
  return [
    ['热码', entries.filter(row => row.count >= hotMin)],
    ['温码', entries.filter(row => row.count >= warmMin && row.count < hotMin)],
    ['冷码', entries.filter(row => row.count < warmMin)]
  ]
}

const COLD_HOT_DEFAULT_PERIODS = { fc3d:7, pl3:7, pl5:10, ssq:11, dlt:11 }

function buildColdHotData(game, history, selectedPeriod) {
  const settings = {
    fc3d:{ defaultPeriod:7, max:9, pad:false, unique:false, slots:3 },
    pl3:{ defaultPeriod:7, max:9, pad:false, unique:false, slots:3 },
    pl5:{ defaultPeriod:10, max:9, pad:false, unique:true, slots:5 },
    ssq:{ defaultPeriod:11, max:33, pad:true, unique:false, slots:6 },
    dlt:{ defaultPeriod:11, max:35, pad:true, unique:false, slots:5, backSlots:2 }
  }
  const config = settings[game]
  if (!config) return null
  const period = Math.max(1, Math.min(Number(selectedPeriod) || config.defaultPeriod, Math.max(history.length, 1)))
  const records = history.slice(0,period)
  const entries = countColdHotNumbers(records,'redBalls',config.max,{ pad:config.pad, unique:config.unique })
  if (game === 'dlt') {
    const backEntries = countColdHotNumbers(records,'blueBalls',12)
    return { period:records.length, note:'根据统计期数和平均出现次数动态分组', sections:[{ title:'前区', groups:thresholdGroups(entries,records.length,config.slots) },{ title:'后区', groups:thresholdGroups(backEntries,records.length,config.backSlots) }] }
  }
  const sections = [{ title:['ssq'].includes(game) ? '红球' : '', groups:thresholdGroups(entries,records.length,config.slots) }]
  if (game === 'ssq') sections.push({ title:'蓝球', groups:thresholdGroups(countColdHotNumbers(records,'blueBalls',16),records.length,1) })
  return { period:records.length, note:game === 'pl5' ? '每期相同数字只统计一次 · 按统计期数动态分组' : '按统计期数与平均出现次数动态分组', sections }
}

function ColdHotCard({ game, history, loading = false }) {
  const defaultPeriod = COLD_HOT_DEFAULT_PERIODS[game] || 7
  const [periodInput,setPeriodInput] = useState(String(defaultPeriod))
  const maxPeriod = Math.max(history.length, 1)
  const parsedPeriod = Number.parseInt(periodInput, 10)
  const period = Math.min(maxPeriod, Math.max(1, Number.isFinite(parsedPeriod) && parsedPeriod > 0 ? parsedPeriod : defaultPeriod))
  useEffect(() => { setPeriodInput(String(defaultPeriod)) }, [defaultPeriod])
  const result = useMemo(() => buildColdHotData(game,history,period), [game,history,period])
  if (!result) return null
  if (loading) return <section className="card cold-hot-card cold-hot-loading"><header><h3>胆码冷热宝</h3><small>同步中…</small></header><p>正在加载近期开奖数据</p></section>
  const commitPeriod = value => {
    const next = Number.parseInt(value, 10)
    const normalized = Number.isFinite(next) && next > 0 ? Math.min(maxPeriod, next) : Math.min(maxPeriod, defaultPeriod)
    setPeriodInput(String(Math.max(1, normalized)))
  }
  return <section className="card cold-hot-card"><header className="cold-hot-header"><h3>胆码冷热宝</h3><label className="cold-hot-period"><span>期数</span><div className="cold-hot-period-input"><input type="number" inputMode="numeric" min="1" max={maxPeriod} value={periodInput} aria-label="冷热宝期数" onChange={event => setPeriodInput(event.target.value)} onBlur={event => commitPeriod(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { commitPeriod(event.currentTarget.value); event.currentTarget.blur() } }}/><em>期</em></div></label></header>{result.sections.map(section => <div className="cold-hot-section" key={section.title || 'numbers'}>{section.title && <h4>{section.title}</h4>}<div className="cold-hot-groups">{section.groups.map(([label,rows],index) => <div className={`cold-hot-row level-${index}`} key={label}><b>{label}</b><div>{rows.map(row => <span title={`${row.value} 出现 ${row.count} 次`} key={row.value}><i className="cold-hot-number">{row.value}</i><small>{row.count}次</small></span>)}</div></div>)}</div></div>)}</section>
}

function formatQxcHistoryDate(value) {
  const match = String(value || '').match(/^(?:\d{4}-)?(\d{2})-(\d{2})/)
  return match ? `${match[1]}月${match[2]}日` : '--'
}

function QxcHistoryStrip({ history, loading = false, canExport = false, exportId = 'qxc-history-export', autoExport = false, onExportComplete, exportFilename, exportTitle, exportParams }) {
  const rows = history.slice(0, 100)
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('')
  const exportHistory = useCallback(async () => {
    if (exporting || loading || !rows.length) return
    setExporting(true)
    setExportError('')
    try {
      await exportTrendElement(exportId, exportFilename || '七星彩历史开奖长条图-近100期.png', { title: exportTitle || '七星彩历史开奖长条图', params: exportParams || `近${rows.length}期 · 日期、和值与7个位置奖号` }, { fitWidth: true, hideInExport: ['.qxc-history-export-button'] })
      trackAnalytics('export_chart', { page: 'detail', game: 'qxc', chart: 'history' })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败，请重试')
      throw error
    } finally { setExporting(false) }
  }, [exportId, exportFilename, exportParams, exportTitle, exporting, loading, rows.length])
  useEffect(() => {
    if (!autoExport || loading || !rows.length) return undefined
    let active = true
    exportHistory().catch(() => {}).finally(() => { if (active) onExportComplete?.() })
    return () => { active = false }
  }, [autoExport, loading, rows.length])
  return <section className="card qxc-history-card" id={exportId} aria-label="七星彩历史开奖长条图">
    <header className="qxc-history-header"><div><h3>历史开奖长条图</h3></div><div className="qxc-history-actions"><span className="qxc-history-badge">近100期</span>{canExport && <button type="button" className="qxc-history-export-button detail-export-button" disabled={exporting || loading || !rows.length} onClick={() => { exportHistory().catch(() => {}) }}>{exporting ? '生成中…' : '导出历史图'}</button>}</div></header>
    {exportError && <p className="qxc-history-export-error">导出失败，请重试</p>}
    {loading && rows.length < 2 ? <div className="qxc-history-loading">正在加载近 100 期历史开奖…</div> : <div className="qxc-history-scroll"><table className="qxc-history-table"><thead><tr><th>期号 / 日期</th><th>和值</th>{Array.from({ length: 7 }, (_, index) => <th key={index}>第{index + 1}位</th>)}</tr></thead><tbody>{rows.map(record => {
      const values = [...(record.redBalls || []), ...(record.blueBalls || [])].map(value => String(value))
      const sum = values.reduce((total, value) => total + (Number(value) || 0), 0)
      return <tr key={record.id}><th><b>{record.issue || '--'}</b><small>{formatQxcHistoryDate(record.drawDate)}</small></th><td className="qxc-history-sum">{sum}</td>{Array.from({ length: 7 }, (_, index) => <td key={`${record.id}-${index}`}><span className={index === 6 ? 'last-position' : ''}>{values[index] ?? '--'}</span></td>)}</tr>
    })}</tbody></table></div>}
  </section>
}

function Detail({ item, all, back, onSwitchGame, onOpen, canExport = false, exportId, autoExport = false, onExportComplete, exportFilename, exportTitle, exportParams }) {
  const liveMeta = games[item.game]
  const liveSource = liveMeta?.liveUrl ? { url: liveMeta.liveUrl, label: liveMeta.liveLabel || '开奖直播' } : null
  const gameHistory = all.filter(r => r.game === item.game)
  const historyLimit = item.game === 'qxc' ? 100 : 50
  const initialHistory = gameHistory.slice(0, historyLimit)
  const [history, setHistory] = useState(initialHistory)
  const [historyLoading, setHistoryLoading] = useState(initialHistory.length < 2)
  useEffect(() => {
    let active = true
    setHistory(initialHistory)
    setHistoryLoading(true)
    fetchHistory(item.game).then(records => {
      if (active) setHistory(mergeRecords(records, initialHistory).slice(0, historyLimit))
    }).catch(() => {}).finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [item.game, item.issue, historyLimit])
  const currentIndex = history.findIndex(record => record.id === item.id || record.issue === item.issue)
  const previousRecord = currentIndex >= 0 ? history[currentIndex + 1] : undefined
  const nextGame = gameOrder[(gameOrder.indexOf(item.game) + 1) % gameOrder.length]
  const nextRecord = all.find(record => record.game === nextGame)
  const [exporting, setExporting] = useState(false)
  const exportTargetId = exportId || `detail-export-${item.game}`
  const downloadDetail = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await exportTrendElement(exportTargetId, exportFilename || `${item.name}-详情-${item.issue}.png`, { title: exportTitle || `${item.name}详情`, params: exportParams || `第 ${item.issue} 期 · ${item.drawDate}` }, { fitWidth: true, withHeader: false, addCardDividers: true, hideInExport: ['.comprehensive-export-actions','.comprehensive-data-export-error'] })
      trackAnalytics('export_chart', { page: 'detail', game: item.game, chart: 'detail' })
    } finally { setExporting(false) }
  }
  useEffect(() => {
    if (!autoExport || historyLoading) return undefined
    let active = true
    downloadDetail().catch(() => {}).finally(() => { if (active) onExportComplete?.() })
    return () => { active = false }
  }, [autoExport, historyLoading])
  return <main><div className="detail-toolbar"><button className="back" onClick={back}><ArrowLeft size={18}/> 返回</button><div className="detail-toolbar-actions">{liveSource && <div className="detail-live-cluster"><div className="detail-live-schedule"><span>直播日期 <b>{item.drawDate || '--'}</b></span><span>直播时间 <b>{liveMeta.time || '--'}</b></span></div><a className="detail-live-button" href={liveSource.url} target="_blank" rel="noopener noreferrer" title={`打开${liveSource.label}`}><Radio size={15}/>{liveSource.label}</a></div>}{canExport && <button type="button" className="detail-export-button" disabled={exporting} onClick={downloadDetail}><Download size={15}/>{exporting ? '生成中…' : '导出图片'}</button>}</div></div><div className="detail-export-content" id={exportTargetId}><div className="detail-overview"><div className="detail-hero"><button type="button" className={`game-icon ${item.game} detail-game-switch`} title="点击切换彩种" aria-label="点击切换彩种" onClick={() => nextRecord && onSwitchGame?.(nextRecord, all)}>{item.icon}</button><p>第 {item.issue} 期 · {item.drawDate}</p><Balls groups={[{ values: item.redBalls }, { values: item.blueBalls, accent: true }]}/></div>
    <section className="card detail-card"><h3>本期数据</h3><div className="detail-grid"><span>本期销量<b>{item.saleAmountText}</b></span><span>奖池累计<b>{item.poolAmountText}</b></span><span>一等奖<b>{item.firstPrizeText}</b></span></div></section>
    <DrawMetrics game={item.game} record={item} previousRecord={previousRecord}/></div>
    <TodayObservation game={item.game} history={history} loading={historyLoading}/>
    {item.game !== 'qxc' && <ColdHotCard game={item.game} history={history} loading={historyLoading}/>}
    <ComprehensiveData game={item.game} history={history} loading={historyLoading} canExport={false} exportId={`${exportTargetId}-comprehensive`}/></div>
    {item.game === 'qxc' && <QxcHistoryStrip history={history} loading={historyLoading} canExport={canExport} exportId={`${exportTargetId}-history`}/>}
    </main>
}

function RandomPage({ save }) {
  const [rule, setRule] = useState(rules[0]), [mode, setMode] = useState('direct'), [count, setCount] = useState(1), [pickCount, setPickCount] = useState(rules[0].groups[0].count), [entries, setEntries] = useState([]), [custom, setCustom] = useState(() => rules[0].groups.map(() => [])), [rolling,setRolling] = useState(false)
  const rollingInterval = useRef(null)
  const activeGroups = useMemo(() => rule.groups.map(group => rule.pickCountOptions ? { ...group, count:pickCount } : group), [rule,pickCount])
  const activeRule = useMemo(() => ({ ...rule, groups:activeGroups }), [rule,activeGroups])
  const clearRolling = () => { clearInterval(rollingInterval.current); rollingInterval.current = null; setRolling(false) }
  useEffect(() => () => clearInterval(rollingInterval.current),[])
  const regenerate = (r = activeRule, m = mode, c = count) => { setEntries(Array.from({ length:c }, () => generate(r,m))); trackAnalytics('random_generate',{ page:'random', game:r.key }) }
  const startRolling = () => {
    if (rolling) return clearRolling()
    setRolling(true)
    setEntries(Array.from({ length:count }, () => generate(activeRule,mode)))
    trackAnalytics('random_generate',{ page:'random', game:activeRule.key })
    rollingInterval.current = setInterval(() => setEntries(Array.from({ length:count }, () => generate(activeRule,mode))), 82)
  }
  const chooseRule = r => { clearRolling(); setRule(r); setPickCount(r.pickCountOptions?.at(-1) || r.groups[0].count); setMode('direct'); setCustom(r.groups.map(() => [])); setEntries([]) }
  const chooseCustom = (groupIndex, value) => {
    const group = activeGroups[groupIndex]
    setCustom(current => current.map((values, index) => {
      if (index !== groupIndex) return values
      if (group.repeatable) return values.length >= group.count ? values : [...values, value]
      return values.includes(value) ? values.filter(item => item !== value) : [...values, value].sort((a,b) => +a - +b)
    }))
  }
  const customComplete = custom.every((values, index) => values.length >= activeGroups[index].count)
  const saveAll = () => {
    const savedEntries = entries.map((groups,i) => ({ id:`${Date.now()}-${i}`, groups, sourceLabel:'随机' }))
    if (customComplete) savedEntries.push({ id:`${Date.now()}-custom`, sourceLabel:'自选', groups: custom.map((values,index) => ({ values, accent: activeGroups[index].accent })) })
    save({ id: String(Date.now()), planName: rule.name + (rule.grouped ? ` · ${{direct:'直选',group3:'组选三',group6:'组选六'}[mode]}` : ''), createdAt: new Date().toLocaleString('zh-CN'), entries: savedEntries })
  }
  return <main className="random-page"><div className="tabs lottery-tabs">{rules.map(r => <button className={r.key === rule.key ? 'active' : ''} onClick={event => { const target = event.currentTarget; chooseRule(r); requestAnimationFrame(() => target.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' })) }} key={r.key}>{r.name}</button>)}</div>
    {rule.grouped && <div className="segmented">{[['direct','直选'],['group3','组选三'],['group6','组选六']].map(([k,v]) => <button title={k === 'direct' ? '定位玩法' : '不定位玩法'} className={mode === k ? 'active' : ''} onClick={() => { clearRolling(); setMode(k); setEntries([]) }} key={k}>{v}</button>)}</div>}
    <section className={`card generator random-generator random-${rule.key} ${rolling ? 'rolling' : ''}`}><div className="generator-head"><div><h2>随机选号</h2><p>{rule.hint}</p></div><div className="generator-head-selects">{rule.pickCountOptions && <select aria-label="每组选号个数" value={pickCount} onChange={event => { clearRolling(); setPickCount(Number(event.target.value)); setCustom(activeGroups.map(() => [])); setEntries([]) }}>{rule.pickCountOptions.map(n => <option key={n} value={n}>{n} 个</option>)}</select>}<select aria-label="生成组数" value={count} onChange={event => { clearRolling(); setCount(Number(event.target.value)); setEntries([]) }}>{[1,3,5,10].map(n => <option key={n} value={n}>{n} 组</option>)}</select></div></div>
      <div className="random-results">{entries.length ? entries.map((groups,i) => <div className="entry" key={i}><Balls groups={groups}/></div>) : <div className="random-placeholder">{activeGroups.map((group,index) => <React.Fragment key={index}>{index > 0 && <span>＋</span>}{Array.from({length:group.count},(_,i) => <i key={i}>--</i>)}</React.Fragment>)}</div>}</div>
      <button className={`random-action ${rolling ? 'pause' : ''}`} onClick={startRolling}>{rolling ? <><span>■</span> 暂停选号</> : entries.length ? <><RefreshCw size={17}/> 重新随机</> : <><RefreshCw size={17}/> 开始随机</>}</button>
    </section>
    <section className="card custom-picker"><div className="custom-head"><div><h2>自定义选号</h2><p>按当前彩种规则选择号码；已选号码可再次点击移除</p></div>{custom.some(values => values.length) && <button onClick={() => setCustom(activeGroups.map(() => []))}>清空</button>}</div>
      {activeGroups.map((group, groupIndex) => <div className="custom-group" key={groupIndex}><div className="custom-label"><b>{activeGroups.length > 1 ? (group.accent ? '蓝球 / 后区' : '红球 / 前区') : '号码区'}</b><span>已选 {custom[groupIndex].length} / 至少 {group.count}</span></div>
        {custom[groupIndex].length > 0 && <Balls small groups={[{ values: custom[groupIndex], accent: group.accent }]}/>}<div className="number-grid">{Array.from({ length: group.max - group.min + 1 }, (_, index) => group.min === 0 ? String(group.min + index) : String(group.min + index).padStart(2,'0')).map(value => <button className={custom[groupIndex].includes(value) ? (group.accent ? 'selected blue-choice' : 'selected') : ''} onClick={() => chooseCustom(groupIndex,value)} key={value}>{value}</button>)}</div>
      </div>)}
      <p className={`custom-status ${customComplete ? 'complete' : ''}`}>{customComplete ? '自选号码已符合规则，保存时会一并加入方案' : '请完成各号码区的最低选择数量'}</p>
    </section>
    <div className="sticky-action"><button className="primary" onClick={saveAll}>保存方案</button></div>
  </main>
}

function Plans({ plans, remove }) {
  const [filter, setFilter] = useState('all')
  const filteredPlans = useMemo(() => filter === 'all' ? plans : plans.filter(plan => plan.planName.startsWith(rules.find(rule => rule.key === filter)?.name || '')), [plans, filter])
  return <main>
    {plans.length > 0 && <div className="plan-filters" aria-label="按彩种筛选"><button className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={event => { const target = event.currentTarget; setFilter('all'); requestAnimationFrame(() => target.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' })) }}>全部 <span>{plans.length}</span></button>{rules.map(rule => { const count = plans.filter(plan => plan.planName.startsWith(rule.name)).length; return <button className={filter === rule.key ? 'active' : ''} aria-pressed={filter === rule.key} onClick={event => { const target = event.currentTarget; setFilter(rule.key); requestAnimationFrame(() => target.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' })) }} key={rule.key}>{rule.name} <span>{count}</span></button> })}</div>}
    {!plans.length ? <div className="state"><Bookmark size={38}/><b>还没有保存的方案</b><p>前往“选号工具”生成并保存</p></div> : !filteredPlans.length ? <div className="state filtered-empty"><Bookmark size={34}/><b>该彩种暂无方案</b><p>请选择其他彩种，或前往选号工具保存方案</p></div> : <div className="cards">{filteredPlans.map((p,index) => <article className="card plan list-entry" style={{ '--list-index': index }} key={p.id}><header><div><h2>{p.planName}</h2><p>{p.createdAt}</p></div><button className="icon-btn danger" aria-label={`删除${p.planName}方案`} onClick={() => remove(p.id)}><Trash2 size={18}/></button></header>{p.entries.map((e,i) => <div className="entry" key={e.id || i}><PlanEntryLabel text={e.sourceLabel} fallback={String(i+1).padStart(2,'0')}/><Balls groups={e.groups}/></div>)}</article>)}</div>}
  </main>
}

const memberStorageKey = 'caishutong-email-member'
const memberSessionDays = 30
const guestSessionDays = 30
const createGuestMember = () => ({
  email: 'guest@local.caishutong',
  nickname: '游客',
  isGuest: true,
  isAdmin: false,
  canExport: false,
  loggedAt: new Date().toISOString(),
  expiresAt: Date.now() + guestSessionDays * 24 * 60 * 60 * 1000
})
const readStoredMember = () => {
  try {
    const value = JSON.parse(localStorage.getItem(memberStorageKey))
    if (!value?.email || !value?.expiresAt || Date.now() >= Number(value.expiresAt)) { localStorage.removeItem(memberStorageKey); return null }
    return value
  } catch { return null }
}
const maskEmail = (email, isGuest = false) => isGuest ? '仅限首页与选号工具' : (() => { const [name,domain=''] = String(email || '').split('@'); return `${name.slice(0,2)}${name.length > 2 ? '***' : '*'}@${domain}` })()
const readApiJson = async response => {
  const raw = await response.text()
  try { return raw ? JSON.parse(raw) : {} } catch {
    return { error: response.status === 502 ? '邮件服务配置异常，请联系管理员' : response.ok ? '服务响应格式错误，请稍后重试' : '服务暂时不可用，请稍后重试' }
  }
}

function EmailLogin({ notify, onLogin }) {
  const [email,setEmail] = useState(''), [code,setCode] = useState(''), [seconds,setSeconds] = useState(0), [error,setError] = useState(''), [sending,setSending] = useState(false), [verifying,setVerifying] = useState(false), [codeSent,setCodeSent] = useState(false)
  useEffect(() => {
    if (!seconds) return
    const timer = setTimeout(() => setSeconds(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])
  const normalizedEmail = email.trim().toLowerCase()
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  const sendCode = async () => {
    if (!validEmail) return setError('请输入正确的邮箱地址')
    setSending(true); setError('')
    try {
      const response = await fetch('/api/auth/email/send-code',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify({ email:normalizedEmail }) })
      const body = await readApiJson(response)
      if (!response.ok) throw new Error(body.error || '验证码发送失败')
      setCodeSent(true); setSeconds(60); notify('验证码已发送，请检查邮箱')
    } catch (reason) { setError(reason.message) } finally { setSending(false) }
  }
  const submit = async event => {
    event.preventDefault()
    if (!validEmail) return setError('请输入正确的邮箱地址')
    if (!codeSent) return setError('请先获取验证码')
    if (!/^\d{6}$/.test(code)) return setError('请输入6位验证码')
    setVerifying(true); setError('')
    try {
      const response = await fetch('/api/auth/email/verify-code',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify({ email:normalizedEmail,code }) })
      const body = await readApiJson(response)
      if (!response.ok) throw new Error(body.error || '验证码验证失败')
      onLogin(body.member)
    } catch (reason) { setError(reason.message) } finally { setVerifying(false) }
  }
  return <section className="profile-login-card"><div className="login-mark"><Mail size={29}/></div><h2>邮箱验证码登录</h2><p>使用邮箱验证码登录，用于管理我的方案和会员权益</p><form onSubmit={submit}><label><span>邮箱地址</span><input type="email" inputMode="email" autoComplete="email" maxLength="120" placeholder="请输入邮箱地址" value={email} onChange={event => { setEmail(event.target.value); setCodeSent(false); setError('') }}/></label><label><span>验证码</span><div className="code-field"><input inputMode="numeric" autoComplete="one-time-code" maxLength="6" placeholder="请输入6位验证码" value={code} onChange={event => { setCode(event.target.value.replace(/\D/g,'').slice(0,6)); setError('') }}/><button type="button" disabled={seconds > 0 || sending} onClick={sendCode}>{sending ? '发送中…' : seconds > 0 ? `${seconds}秒后重发` : '获取验证码'}</button></div></label>{error && <p className="login-error">{error}</p>}<button className="login-submit" type="submit" disabled={verifying}>{verifying ? '正在验证…' : '验证并登录'}</button></form><small>验证码将发送至你的邮箱，10分钟内有效 · 登录即代表同意《用户协议》和《隐私政策》</small></section>
}

function GuestLoginButton({ onGuestLogin }) {
  return <button type="button" className="guest-login-button" onClick={onGuestLogin}><UserRound size={17}/>游客登录<span>仅使用首页和选号工具</span></button>
}

function LoginRequired({ notify, onLogin, onGuestLogin, guestBlocked = false }) {
  return <main className="auth-required-page"><div className="auth-required-intro"><h1>{guestBlocked ? '游客模式暂不支持此页面' : '登录后查看全部内容'}</h1><p>{guestBlocked ? '游客仅可使用首页和选号工具；使用邮箱登录后可查看完整内容。' : '登录后即可查看开奖数据、历史开奖、走势图、详情和选号工具。'}</p></div><EmailLogin notify={notify} onLogin={onLogin}/>{!guestBlocked && <GuestLoginButton onGuestLogin={onGuestLogin}/>}</main>
}

function HelpPage({ back, notify }) {
  const [openFaq,setOpenFaq] = useState(0), [category,setCategory] = useState('功能建议'), [message,setMessage] = useState(''), [contact,setContact] = useState(''), [submitting,setSubmitting] = useState(false)
  const faqs = [
    ['开奖数据多久更新？','开奖后系统会自动同步数据。网络或数据源延迟时，可在首页点击刷新按钮重新获取。'],
    ['保存的方案在哪里查看？','随机生成、自定义选号和走势模拟保存后，都会统一出现在底部“我的方案”中。'],
    ['走势图的数据代表预测结果吗？','不是。走势图仅整理历史开奖数据，不构成号码预测、投注建议或中奖承诺。'],
    ['如何保护我的账户信息？','微信授权仅用于识别账户。我们不会自动发布内容，也不会在未经允许时获取与功能无关的信息。']
  ]
  const submit = async event => {
    event.preventDefault()
    if (message.trim().length < 5) return notify('请至少填写5个字的反馈内容')
    setSubmitting(true)
    try {
      const response = await fetch('/api/feedback',{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify({ category,message:message.trim(),contact:contact.trim() }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '反馈提交失败')
      setMessage(''); setContact(''); trackAnalytics('submit_feedback',{page:'help'}); notify('感谢反馈，我们已收到')
    } catch (reason) { notify(reason.message) } finally { setSubmitting(false) }
  }
  return <main className="account-subpage"><button className="subpage-back" onClick={back}><ArrowLeft size={19}/> 返回</button><header className="subpage-title"><i className="help-color"><HelpCircle size={27}/></i><div><h1>帮助与反馈</h1><p>使用帮助与意见反馈</p></div></header><section className="account-section"><h2>常见问题</h2><div className="faq-list">{faqs.map(([question,answer],index) => <article className={openFaq === index ? 'open' : ''} key={question}><button aria-expanded={openFaq === index} onClick={() => setOpenFaq(current => current === index ? -1 : index)}><span>{question}</span><ChevronDown size={18}/></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></section><section className="account-section feedback-section"><h2>意见反馈</h2><p className="section-caption">你的建议会帮助我们持续改进产品体验</p><form onSubmit={submit}><div className="feedback-categories">{['功能建议','数据问题','使用问题','其他'].map(item => <button type="button" className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><label><span>反馈内容</span><textarea maxLength="500" placeholder="请描述遇到的问题或你的建议" value={message} onChange={event => setMessage(event.target.value)}/><small>{message.length}/500</small></label><label><span>联系方式（选填）</span><div className="feedback-contact"><Mail size={17}/><input maxLength="120" placeholder="微信号或邮箱" value={contact} onChange={event => setContact(event.target.value)}/></div></label><button className="feedback-submit" type="submit" disabled={submitting}><Send size={17}/>{submitting?'提交中…':'提交反馈'}</button></form></section></main>
}

function AboutPage({ back }) {
  useEffect(() => { const label=document.querySelector('.about-hero span'); if (label) label.textContent=`当前版本 ${packageMetadata.version}` }, [])
  return <main className="account-subpage"><button className="subpage-back" onClick={back}><ArrowLeft size={19}/> 返回</button><header className="about-hero"><img className="about-logo" src="/caiyan-logo.png" alt="彩研通"/><h1>彩研通</h1><p>数字生活助手</p><span>当前版本 1.0.0</span></header><section className="account-section about-copy"><h2>关于彩研通</h2><p>彩研通是一款开奖数据整理与历史统计工具，提供开奖查询、号码分布、走势图和个人方案管理等功能。</p><p>我们坚持清晰、克制的数据呈现，不提供彩票销售、代购服务，也不承诺或暗示提高中奖概率。</p></section><section className="account-section about-links"><details><summary><i className="blue"><Database size={18}/></i><span><b>数据来源与声明</b><small>开奖信息及使用边界</small></span><ChevronDown size={18}/></summary><div>开奖信息来自公开数据接口，仅供查询参考。数据可能因网络或数据源原因延迟，请以福利彩票、体育彩票官方公布结果为准。</div></details><details><summary><i className="purple"><FileText size={18}/></i><span><b>用户协议</b><small>服务规则与用户责任</small></span><ChevronDown size={18}/></summary><div>用户应合法、理性地使用本工具，不得利用服务开展售彩、代购、赌博或其他违法活动。历史统计结果不构成投注建议。</div></details><details><summary><i className="green"><ShieldCheck size={18}/></i><span><b>隐私政策</b><small>信息收集与安全说明</small></span><ChevronDown size={18}/></summary><div>我们遵循最小必要原则处理账户信息。微信授权仅用于账户识别和方案同步，不会自动发布内容；你可以退出登录并申请删除账户数据。</div></details></section><p className="about-footer">© 2026 彩研通 · 数据工具仅供参考，请理性使用</p></main>
}

function SecurityPage({ member, back, onLogout, onDeleteData, notify, planCount }) {
  const device = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? '移动设备' : '电脑浏览器'
  const loginTime = member?.loggedAt ? new Date(member.loggedAt).toLocaleString('zh-CN') : '本次登录'
  const expiresAt = member?.expiresAt ? new Date(Number(member.expiresAt)).toLocaleString('zh-CN') : '登录后30天'
  const changeEmail = () => notify('请先退出登录，再使用新邮箱验证码登录')
  const removeData = () => {
    if (window.confirm('确认删除本设备上的账户信息和已保存方案吗？此操作无法撤销。')) onDeleteData()
  }
  return <main className="account-subpage security-page"><button className="subpage-back" onClick={back}><ArrowLeft size={19}/> 返回</button><header className="subpage-title"><i className="security-color"><ShieldCheck size={27}/></i><div><h1>账户与安全</h1><p>邮箱、登录设备与隐私</p></div></header>
    <section className="account-section security-section"><h2>账户邮箱</h2><div className="security-row"><i className="security-icon green"><Mail size={19}/></i><span><b>{member?.email || '未绑定邮箱'}</b><small>已通过邮箱验证码验证</small></span><button onClick={changeEmail}>更换邮箱</button></div></section>
    <section className="account-section security-section"><h2>登录设备</h2><div className="security-row"><i className="security-icon blue"><Smartphone size={19}/></i><span><b>{device}</b><small>当前设备 · {loginTime}</small></span><em>在线</em></div><p className="security-caption">本设备将在 {expiresAt} 前保持登录，最长30天。主动退出、删除浏览器数据或到期后，需要重新获取邮箱验证码。</p><button className="security-outline" onClick={onLogout}><LogOut size={17}/> 退出当前设备</button></section>
    <section className="account-section security-section"><h2>隐私与本地数据</h2><div className="security-data"><div><span>已保存方案</span><b>{planCount} 条</b></div><div><span>账户资料</span><b>邮箱与登录状态</b></div><div><span>服务端数据</span><b>验证码记录与主动反馈</b></div></div><p className="security-caption">走势图与开奖查询无需读取通讯录、定位、相册或其他与功能无关的信息。</p></section>
    <section className="account-section security-section security-danger"><h2>删除本地账户数据</h2><p>清除当前设备上的登录信息、已保存方案和匿名访问标识。已提交的意见反馈不会自动删除，如需删除可通过“帮助与反馈”联系我们。</p><button onClick={removeData}><Trash2 size={17}/> 删除本设备数据</button></section>
    <p className="about-footer">账户安全操作不会发布任何公开内容</p>
  </main>
}

function ProfilePage({ member, onLogin, onLogout, notify, onGuestLogin, goPlans, openHelp, openAbout, openSecurity }) {
  if (!member) return <main className="profile-page"><EmailLogin notify={notify} onLogin={onLogin}/><GuestLoginButton onGuestLogin={onGuestLogin}/><section className="profile-menu public-profile-menu"><button onClick={openHelp}><i style={{backgroundColor:'#f3aa19'}}><HelpCircle size={19}/></i><span><b>帮助与反馈</b><small>使用帮助与意见反馈</small></span><ChevronRight size={19}/></button><button onClick={openAbout}><i style={{backgroundColor:'#49a9ee'}}><Info size={19}/></i><span><b>关于彩研通</b><small>版本信息与服务协议</small></span><ChevronRight size={19}/></button></section><p className="profile-disclaimer">邮箱仅用于账户验证和服务通知</p></main>
  if (member.isGuest) return <main className="profile-page"><section className="profile-user guest-profile-user"><div className="profile-avatar"><UserRound size={31}/></div><div><h2>游客模式</h2><p>{maskEmail(member.email, true)}</p></div><span>受限访问</span></section><section className="guest-access-card"><UserRound size={24}/><div><b>当前为游客登录</b><p>可使用首页开奖信息和选号工具，详情、走势、历史及方案保存需邮箱登录。</p></div></section><button className="logout-button" onClick={onLogout}><LogOut size={18}/> 退出游客模式</button><p className="profile-disclaimer">退出后可使用邮箱验证码登录完整功能</p></main>
  const items = [
    [Bookmark,'我的方案','查看已保存的选号方案','#4169f6',goPlans],
    [Download,'数据导出','会员可导出历史分析数据','#20b7d8'],
    [Settings,'数据设置','管理走势图与分析偏好','#7a6ff0'],
    [ShieldCheck,'账户与安全','邮箱、登录设备与隐私','#36c978',openSecurity],
    [HelpCircle,'帮助与反馈','使用帮助与意见反馈','#f3aa19',openHelp],
    [Info,'关于彩研通','版本信息与服务协议','#49a9ee',openAbout]
  ]
  return <main className="profile-page"><section className="profile-user"><div className="profile-avatar"><UserRound size={31}/></div><div><h2>{member.nickname || '彩友'}</h2><p>{maskEmail(member.email)}</p></div><span>已登录</span></section><section className="member-banner"><div><span><Crown size={18}/> 彩研通会员</span><h2>解锁更多数据分析工具</h2><p>高级走势图 · K线分析 · 数据导出</p></div><button onClick={() => notify('会员功能即将开放')}>了解会员</button></section><section className="profile-menu">{items.map(([Icon,title,desc,color,action]) => <button onClick={action || (() => notify('功能正在建设中'))} key={title}><i style={{backgroundColor:color}}><Icon size={19}/></i><span><b>{title}</b><small>{desc}</small></span><ChevronRight size={19}/></button>)}</section><button className="logout-button" onClick={onLogout}><LogOut size={18}/> 退出登录</button><p className="profile-disclaimer">数据工具仅供参考，请理性使用</p></main>
}

const adminLabels = {
  home:'首页', random:'选号工具', plans:'我的方案', profile:'我的', detail:'详情页', trend:'走势图', history:'历史开奖', rules:'玩法规则',
  nav_click:'底部导航', open_detail:'打开详情', open_trend:'打开走势图', open_history:'打开历史开奖', open_rules:'打开玩法规则', random_generate:'随机生成', save_plan:'保存方案', member_login:'用户登录', guest_login:'游客登录', export_chart:'导出走势图',
  fc3d:'福彩3D', ssq:'双色球', dlt:'大乐透', pl3:'排列三', pl5:'排列五', qxc:'七星彩', qlc:'七乐彩', klb:'快乐8', mobile:'手机端', desktop:'电脑端'
}
const adminName = value => adminLabels[value] || value || '其他'
const adminNumber = value => Number(value || 0).toLocaleString('zh-CN')

function AdminList({ title, rows, empty = '暂无数据' }) {
  const max = Math.max(1,...rows.map(row => Number(row.value || 0)))
  return <section className="admin-panel"><h2>{title}</h2>{rows.length ? <div className="admin-ranking">{rows.map((row,index) => <div key={`${row.name}-${index}`}><span>{adminName(row.name)}</span><i><em style={{width:`${Number(row.value || 0) / max * 100}%`}}/></i><b>{adminNumber(row.value)}</b></div>)}</div> : <p className="admin-empty">{empty}</p>}</section>
}

const feedbackStatusLabels = { pending:'待处理', processing:'处理中', resolved:'已解决' }

function AdminFeedback({ rows, filter, setFilter, onSave, saving }) {
  const [notes,setNotes] = useState({})
  useEffect(() => { setNotes(Object.fromEntries(rows.map(row => [row.id,row.admin_note || '']))) },[rows])
  return <section className="admin-panel admin-feedback"><header><div><h2>用户反馈</h2><p>反馈内容、处理状态与内部回复备注</p></div><div className="admin-feedback-filters">{[['all','全部'],...Object.entries(feedbackStatusLabels)].map(([value,label]) => <button className={filter===value?'active':''} onClick={()=>setFilter(value)} key={value}>{label}</button>)}</div></header>{rows.length ? <div className="admin-feedback-list">{rows.map(row => <article key={row.id}><div className="admin-feedback-meta"><span>{row.category}</span><time>{new Date(`${row.created_at}Z`).toLocaleString('zh-CN')}</time></div><p>{row.message}</p>{row.contact && <small>联系方式：{row.contact}</small>}<div className="admin-feedback-actions"><select value={row.status} onChange={event=>onSave(row.id,event.target.value,notes[row.id] || '')} disabled={saving===row.id}>{Object.entries(feedbackStatusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><input maxLength="1000" placeholder="填写回复备注（仅管理员可见）" value={notes[row.id] || ''} onChange={event=>setNotes(current=>({...current,[row.id]:event.target.value}))}/><button onClick={()=>onSave(row.id,row.status,notes[row.id] || '')} disabled={saving===row.id}>{saving===row.id?'保存中…':'保存备注'}</button></div></article>)}</div> : <p className="admin-empty">当前筛选下暂无反馈</p>}</section>
}

function AdminDashboard() {
  const [days,setDays] = useState(30), [data,setData] = useState(null), [loading,setLoading] = useState(true), [error,setError] = useState(''), [needsLogin,setNeedsLogin] = useState(false)
  const [feedback,setFeedback] = useState([]), [feedbackFilter,setFeedbackFilter] = useState('all'), [feedbackSaving,setFeedbackSaving] = useState(null)
  const load = async () => {
    setLoading(true); setError('')
    try { const response = await fetch(`/api/admin/stats?days=${days}`,{ credentials:'include' }); const body = await response.json(); if (response.status === 401) { setNeedsLogin(true); setData(null); return } if (!response.ok) throw new Error(body.error || '后台数据加载失败'); setNeedsLogin(false); setData(body) } catch (reason) { setError(reason.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() },[days])
  const loadFeedback = async () => {
    try { const response = await fetch(`/api/admin/feedback?status=${feedbackFilter}`,{ credentials:'include' }); const body = await response.json(); if (response.status===401) return setNeedsLogin(true); if (!response.ok) throw new Error(body.error || '反馈加载失败'); setFeedback(body.feedback || []) } catch (reason) { setError(reason.message) }
  }
  useEffect(() => { if (!needsLogin) loadFeedback() },[feedbackFilter,needsLogin])
  const saveFeedback = async (id,status,adminNote) => {
    setFeedbackSaving(id)
    try { const response = await fetch('/api/admin/feedback',{ method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status,adminNote}) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || '反馈保存失败'); await loadFeedback() } catch (reason) { setError(reason.message) } finally { setFeedbackSaving(null) }
  }
  const logoutAdmin = async () => { await fetch('/api/admin/logout',{ method:'POST',credentials:'include' }); setData(null); setNeedsLogin(true) }
  const series = data?.series || [], maxViews = Math.max(1,...series.map(row => Number(row.views || 0)))
  const summary = [
    ['累计浏览量',data?.totals?.views,Eye,'blue'], ['今日浏览量',data?.today?.views,Activity,'purple'], ['累计用户量',data?.totals?.visitors,Users,'green'], ['今日用户量',data?.today?.visitors,Users,'cyan'], ['累计点击量',data?.totals?.clicks,MousePointerClick,'orange'], ['今日点击量',data?.today?.clicks,MousePointerClick,'red']
  ]
  if (needsLogin) return <AdminLogin onSuccess={load}/>
  return <main className="admin-page"><header className="admin-header"><div><span><LayoutDashboard size={20}/> 彩研通数据中心</span><h1>运营概览</h1><p>匿名使用统计与用户主动提交的意见反馈</p></div><div className="admin-header-actions"><button onClick={()=>{load();loadFeedback()}} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={17}/>刷新数据</button><button onClick={logoutAdmin}><LogOut size={17}/>退出</button></div></header>
    <div className="admin-period">{[7,30,90].map(value => <button className={days === value ? 'active' : ''} onClick={() => setDays(value)} key={value}>近 {value} 天</button>)}</div>
    {error ? <section className="admin-auth-state"><ShieldCheck size={34}/><h2>数据加载失败</h2><p>{error}</p><button onClick={load}>重新加载</button></section> : <>{<div className="admin-summary">{summary.map(([label,value,Icon,color]) => <article className={color} key={label}><i><Icon size={19}/></i><span>{label}</span><b>{loading && !data ? '--' : adminNumber(value)}</b></article>)}</div>}
      <section className="admin-panel admin-trend"><header><div><h2>访问趋势</h2><p>每日页面浏览量</p></div><span>近 {days} 天</span></header><div className="admin-bars">{series.map(row => <div title={`${row.day}：${row.views || 0}次`} key={row.day}><i style={{height:`${Math.max(4,Number(row.views || 0) / maxViews * 100)}%`}}/><small>{row.day.slice(5)}</small></div>)}</div></section>
      <div className="admin-grid"><AdminList title="功能点击排行" rows={data?.events || []}/><AdminList title="页面浏览排行" rows={data?.pages || []}/><AdminList title="彩种使用排行" rows={data?.games || []}/><AdminList title="访问设备" rows={data?.devices || []}/></div>
      <AdminFeedback rows={feedback} filter={feedbackFilter} setFilter={setFeedbackFilter} onSave={saveFeedback} saving={feedbackSaving}/>
      <p className="admin-updated">数据生成于 {data?.generatedAt ? new Date(data.generatedAt).toLocaleString('zh-CN') : '--'}</p></>}
  </main>
}

function AdminLogin({ onSuccess }) {
  const [email,setEmail] = useState(''), [password,setPassword] = useState(''), [error,setError] = useState(''), [submitting,setSubmitting] = useState(false)
  const submit = async event => {
    event.preventDefault(); setSubmitting(true); setError('')
    try { const response = await fetch('/api/admin/login',{ method:'POST',credentials:'include',headers:{ 'Content-Type':'application/json' },body:JSON.stringify({ email,password }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || '登录失败'); await onSuccess() } catch (reason) { setError(reason.message) } finally { setSubmitting(false) }
  }
  return <main className="admin-login-page"><section className="admin-login-card"><div className="admin-login-logo"><ShieldCheck size={28}/></div><span>彩研通数据中心</span><h1>管理员登录</h1><p>仅限授权管理员访问运营数据</p><form onSubmit={submit}><label><span>管理员邮箱</span><input type="email" autoComplete="username" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="请输入管理员邮箱" required/></label><label><span>密码</span><input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="请输入密码" required/></label>{error && <div className="admin-login-error">{error}</div>}<button type="submit" disabled={submitting}>{submitting ? '正在验证…' : '登录'}</button></form><small>登录状态将在 12 小时后自动失效</small></section></main>
}

function App() {
  const [initialNavigation] = useState(() => readNavigationState())
  const [tab,setTab] = useState(initialNavigation?.tab || 'home'), [view,setView] = useState(initialNavigation?.view || null), [viewStack,setViewStack] = useState(initialNavigation?.viewStack || []), [plans,setPlans] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey)) || [] } catch { return [] } }), [toast,setToast] = useState(''), [member,setMember] = useState(readStoredMember)
  const persist = next => { setPlans(next); localStorage.setItem(storageKey, JSON.stringify(next)) }
  const notify = message => { setToast(message); setTimeout(() => setToast(''),2200) }
  const save = plan => {
    if (!member || member.isGuest) {
      if (!member) { setView(null); setViewStack([]); setTab('profile'); scrollTo(0,0) }
      notify(member?.isGuest ? '游客可以选号，但登录邮箱后才能保存方案' : '请先登录后保存方案')
      return false
    }
    persist([plan,...plans].slice(0,20)); trackAnalytics('save_plan',{page:tab,game:rules.find(rule => plan.planName.startsWith(rule.name))?.key}); notify('已保存在“我的方案”'); return true
  }
  const login = next => { const canExport = next?.email?.toLowerCase() === '1226779246@qq.com'; const loggedIn={...next,isGuest:false,canExport,isAdmin:canExport,loggedAt:new Date().toISOString(),expiresAt:Date.now()+memberSessionDays*24*60*60*1000}; setMember(loggedIn); localStorage.setItem(memberStorageKey, JSON.stringify(loggedIn)); trackAnalytics('member_login',{page:'profile'}); notify('登录成功，30天内免登录') }
  const guestLogin = () => { const loggedIn = createGuestMember(); setMember(loggedIn); localStorage.setItem(memberStorageKey, JSON.stringify(loggedIn)); trackAnalytics('guest_login',{page:'auth'}); notify('游客登录成功，可使用首页和选号工具') }
  const logout = () => { setMember(null); localStorage.removeItem(memberStorageKey); notify('已退出登录') }
  const deleteLocalAccountData = () => { setMember(null); setPlans([]); [memberStorageKey,storageKey,analyticsVisitorKey,'caishutong-feedback'].forEach(key=>localStorage.removeItem(key)); sessionStorage.removeItem(analyticsSessionKey); setView(null); setViewStack([]); setTab('profile'); notify('本设备账户数据已删除') }
  const guestLockedMessage = '游客仅可使用首页和选号工具，请使用邮箱登录后继续'
  const nav = k => {
    if (member?.isGuest && !['home','random','profile'].includes(k)) return notify(guestLockedMessage)
    trackAnalytics('nav_click',{page:k}); setTab(k); setView(null); setViewStack([]); scrollTo(0,0)
  }
  const showView = next => {
    if (member?.isGuest) return notify(guestLockedMessage)
    trackAnalytics(`open_${next.type}`,{page:next.type,game:next.item?.game}); setViewStack(stack => [...stack,{ tab, view }]); setView(next); scrollTo(0,0)
  }
  const replaceView = next => { trackAnalytics(`open_${next.type}`,{page:next.type,game:next.item?.game}); setView(next); scrollTo(0,0) }
  const goBack = () => { const previous = viewStack.at(-1); if (previous) { setTab(previous.tab); setView(previous.view); setViewStack(viewStack.slice(0,-1)) } else { setView(null); setViewStack([]) } scrollTo(0,0) }
  const navItems = [['home',Home,'首页'],['random',Dices,'选号工具'],['plans',Bookmark,'我的方案'],['profile',UserRound,'我的']]
  const activeNavIndex = Math.max(0, navItems.findIndex(([key]) => key === tab))
  const keepTabActive = !view || ['help','about','security'].includes(view.type)
  const pageTransitionKey = view ? `${view.type}:${view.item?.id || view.item?.issue || ''}` : `tab:${tab}`
  const requiresMember = (!member && (Boolean(view) || tab !== 'profile')) || (member?.isGuest && Boolean(view))
  useEffect(() => { trackAnalytics('page_view',{ page:view?.type || tab, game:view?.item?.game }) },[tab,view?.type,view?.item?.game])
  useEffect(() => {
    const active = Boolean(view || tab !== 'home' || viewStack.length)
    try {
      if (active) sessionStorage.setItem(navigationStorageKey, JSON.stringify({ tab, view, viewStack }))
      else sessionStorage.removeItem(navigationStorageKey)
      const url = new URL(location.href)
      if (active) url.searchParams.set('nav','1')
      else url.searchParams.delete('nav')
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    } catch {}
  }, [tab, view, viewStack])
  useEffect(() => {
    let startY = 0, pulling = false, distance = 0
    const indicator = document.createElement('div')
    indicator.className = 'pull-refresh-indicator'
    indicator.textContent = '下拉刷新'
    document.body.appendChild(indicator)
    const reset = () => { indicator.classList.remove('visible','ready'); indicator.style.transform = '' }
    const onStart = event => { if (window.scrollY <= 0 && event.touches.length === 1) { startY = event.touches[0].clientY; pulling = true } }
    const onMove = event => {
      if (!pulling) return
      distance = Math.max(0, event.touches[0].clientY - startY)
      if (!distance) return
      const offset = Math.min(72, distance * .42)
      indicator.style.transform = `translate(-50%,${offset - 58}px)`
      indicator.classList.add('visible')
      indicator.classList.toggle('ready', distance >= 96)
      indicator.textContent = distance >= 96 ? '松开即可刷新' : '下拉刷新'
    }
    const onEnd = () => {
      if (!pulling) return
      pulling = false
      if (distance >= 96) { indicator.textContent = '正在刷新…'; indicator.classList.add('visible'); setTimeout(() => location.reload(), 120) } else reset()
      distance = 0
    }
    window.addEventListener('touchstart',onStart,{ passive:true })
    window.addEventListener('touchmove',onMove,{ passive:true })
    window.addEventListener('touchend',onEnd,{ passive:true })
    window.addEventListener('touchcancel',onEnd,{ passive:true })
    return () => { window.removeEventListener('touchstart',onStart); window.removeEventListener('touchmove',onMove); window.removeEventListener('touchend',onEnd); window.removeEventListener('touchcancel',onEnd); indicator.remove() }
  },[])
  return <div className={"app-shell " + (member && member.canExport ? "export-enabled" : "")}><div className="brand"><img src="/caiyan-logo.png" alt="彩研通"/><b>彩研通</b><small>数字生活助手</small></div><div className="content"><div className="page-transition" key={pageTransitionKey}>{requiresMember ? <LoginRequired guestBlocked={Boolean(member?.isGuest)} notify={notify} onLogin={login} onGuestLogin={guestLogin}/> : view?.type === 'detail' ? <Detail {...view} canExport={Boolean(member?.canExport)} back={goBack} onSwitchGame={(item,all) => replaceView({type:"detail",item,all})} onOpen={record => showView({type:"detail",item:record,all:view.all})}/> : view?.type === 'trend' ? <Trend {...view} save={save} back={goBack} onOpen={record => showView({type:'detail',item:record,all:view.all})}/> : view?.type === 'history' ? <HistoryPage {...view} back={goBack} onOpen={(record,history) => showView({type:'detail',item:record,all:history})}/> : view?.type === 'rules' ? <RulesPage {...view} back={goBack}/> : view?.type === 'help' ? <HelpPage back={goBack} notify={notify}/> : view?.type === 'about' ? <AboutPage back={goBack}/> : view?.type === 'security' ? <SecurityPage member={member} planCount={plans.length} back={goBack} onLogout={()=>{logout();setView(null);setViewStack([])}} onDeleteData={deleteLocalAccountData} notify={notify}/> : tab === 'home' ? <HomePage canExport={Boolean(member?.canExport)} open={(item,all) => showView({type:'detail',item,all})} openTrend={(item,all) => showView({type:'trend',item,all})} openHistory={(item,all) => showView({type:'history',item,all})} openRules={(item,all) => showView({type:'rules',item,all})}/> : tab === 'random' ? <RandomPage save={save}/> : tab === 'plans' ? <Plans plans={plans} remove={id => persist(plans.filter(p => p.id !== id))}/> : <ProfilePage member={member} onLogin={login} onLogout={logout} notify={notify} onGuestLogin={guestLogin} goPlans={() => nav('plans')} openHelp={() => showView({type:'help'})} openAbout={() => showView({type:'about'})} openSecurity={() => showView({type:'security'})}/>}</div></div>
    <nav className="bottom-nav" aria-label="主导航" style={{'--nav-index':activeNavIndex}}><i className="nav-selection" aria-hidden="true"/>{navItems.map(([k,Icon,label]) => <button className={tab===k&&keepTabActive?'active':''} aria-current={tab===k&&keepTabActive?'page':undefined} onClick={() => nav(k)} key={k}><Icon/><span>{label}</span></button>)}</nav>{toast && <div className="toast">{toast}</div>}</div>
}
createRoot(document.getElementById('root')).render(location.pathname.startsWith('/admin') ? <AdminDashboard/> : <App/>)
