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
  const [all, setAll] = useState(() => cached?.records || []), [loading, setLoading] = useState(() => !cached?.records?.length), [error, setError] = useState(''), [refreshMessage, setRefreshMessage] = useState(''), [stamp, setStamp] = useState(() => cached?.savedAt ? new Date(cached.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '')
  const allRef = useRef(all)
  const refreshInFlight = useRef(false)
  const lastRefreshAt = useRef(0)
  const [batchJob, setBatchJob] = useState(null), [batchExporting, setBatchExporting] = useState(false), [batchProgress, setBatchProgress] = useState({ current:0, total:0 })
  // 首页只展示每个彩种的最新一期；历史与走势图按需加载，避免首屏携带 120 期数据。
  // 部分彩种临时失败时，保留已有记录，避免一次请求把整张首页列表替换成不完整结果。
  const load = async (fresh = false) => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    lastRefreshAt.current = Date.now()
    setLoading(true)
    setError('')
    if (fresh) setRefreshMessage('')
    const refreshResults = new Map()
    const mergeLatest = rows => setAll(current => {
      const byGame = new Map()
      for (const record of [...rows, ...current]) {
        if (!record?.game) continue
        const previous = byGame.get(record.game)
        if (!previous || Number(record.issue) > Number(previous.issue)) byGame.set(record.game, record)
      }
      const merged = gameOrder.map(game => byGame.get(game)).filter(Boolean)
      allRef.current = merged
      writeRecordsCache(merged)
      return merged
    })
    try {
      // 每个彩种一返回就显示，不让最慢或失败的接口阻塞整张首页。
      const rows = await fetchRecords(1, mergeLatest, { fresh, onRefreshStatus: resul