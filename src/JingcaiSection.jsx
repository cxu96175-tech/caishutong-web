import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const sportOptions = [
  { key: 'football', label: '竞彩足球' },
  { key: 'basketball', label: '竞彩篮球' }
]

const cacheKey = (sport, date) => `caishutong-jingcai-${sport}-${date}`
const todayInChina = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const readCache = (sport, date) => {
  try { return JSON.parse(localStorage.getItem(cacheKey(sport, date)) || 'null') } catch { return null }
}
const writeCache = (sport, date, value) => {
  try { localStorage.setItem(cacheKey(sport, date), JSON.stringify(value)) } catch {}
}

const statusLabels = {
  scheduled: '未开始',
  live: '进行中',
  finished: '完赛',
  delayed: '延期',
  cancelled: '取消',
  unknown: '状态待更新'
}

const formatTime = value => {
  if (!value) return '--:--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--:--' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

const formatKickoff = value => {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  const today = todayInChina()
  const matchDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const time = formatTime(value)
  return matchDay === today ? time : `${matchDay.slice(5).replace('-', '/')} ${time}`
}

const formatUpdatedAt = value => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function MatchRow({ match }) {
  const scoreAvailable = match.homeScore != null && match.awayScore != null
  const status = statusLabels[match.status] || statusLabels.unknown
  const officialSp = match.officialSp
  const spValues = officialSp?.market === '胜平负'
    ? [['主胜', officialSp.homeWin], ['平', officialSp.draw], ['客胜', officialSp.awayWin]]
    : officialSp?.market === '胜负'
      ? [['客胜', officialSp.awayWin], ['主胜', officialSp.homeWin]]
      : []
  return <article className="jingcai-match">
    <div className="jingcai-match-meta"><span className={`jingcai-status is-${match.status || 'unknown'}`}>{status}</span><span>{match.league || '赛事'}</span>{match.matchNo && <span>{match.matchNo}</span>}</div>
    <div className="jingcai-match-main">
      <div className="jingcai-team home"><b>{match.homeTeam}</b><small>主</small></div>
      <div className={`jingcai-score ${scoreAvailable ? 'has-score' : ''}`} aria-label={scoreAvailable ? `比分 ${match.homeScore} 比 ${match.awayScore}` : '尚无比分'}>
        {scoreAvailable ? <><b>{match.homeScore}</b><i>:</i><b>{match.awayScore}</b></> : <span>VS</span>}
      </div>
      <div className="jingcai-team away"><small>客</small><b>{match.awayTeam}</b></div>
      <time className="jingcai-kickoff" dateTime={match.kickoffAt || undefined}>{formatKickoff(match.kickoffAt)}</time>
    </div>
    {spValues.length > 0 && <div className="jingcai-official-sp" aria-label={`竞彩 SP，${officialSp.market}`}>
      <span className="jingcai-official-sp-title">竞彩官方 SP</span>
      {spValues.map(([label, value]) => <span className="jingcai-sp-value" key={label}><small>{label}</small><b>{value || '--'}</b></span>)}
    </div>}
  </article>
}

export default function JingcaiSection() {
  const [sport, setSport] = useState('football')
  const date = todayInChina()
  const cached = useMemo(() => readCache('football', todayInChina()), [])
  const [matches, setMatches] = useState(() => cached?.matches || [])
  const [updatedAt, setUpdatedAt] = useState(() => cached?.updatedAt || '')
  const [source, setSource] = useState(() => cached?.source || '竞彩数据服务')
  const [stale, setStale] = useState(() => Boolean(cached?.stale))
  const [loading, setLoading] = useState(() => !cached?.matches?.length)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async (signal, silent = false) => {
    if (!silent && !readCache(sport, date)?.matches?.length) setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/jingcai?sport=${encodeURIComponent(sport)}&date=${encodeURIComponent(date)}`, { signal, headers: { Accept: 'application/json' } })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error || '竞彩信息暂时无法获取')
      setMatches(payload.matches || [])
      setUpdatedAt(payload.updatedAt || '')
      setSource(payload.source || '竞彩数据服务')
      setStale(Boolean(payload.stale))
      setError(payload.partial ? (payload.error || '赛程或赛果数据暂不可用，当前列表可能不完整') : '')
      writeCache(sport, date, payload)
    } catch (reason) {
      if (reason.name === 'AbortError') return
      const fallback = readCache(sport, date)
      if (fallback?.matches) {
        setMatches(fallback.matches)
        setUpdatedAt(fallback.updatedAt || '')
        setSource(fallback.source || '竞彩数据服务')
        setStale(true)
      } else setError(reason.message || '竞彩信息暂时无法获取')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [sport, date])

  useEffect(() => {
    const controller = new AbortController()
    const fallback = readCache(sport, date)
    setMatches(fallback?.matches || [])
    setUpdatedAt(fallback?.updatedAt || '')
    setSource(fallback?.source || '竞彩数据服务')
    setStale(Boolean(fallback?.stale))
    setLoading(!fallback?.matches?.length)
    load(controller.signal, Boolean(fallback?.matches?.length))
    const refresh = () => { if (!document.hidden) load(controller.signal, true) }
    const interval = window.setInterval(refresh, 120000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load, reloadKey])

  const retry = () => { setLoading(true); setReloadKey(value => value + 1) }
  const sportLabel = sportOptions.find(item => item.key === sport)?.label || '竞彩'

  return <section className="card jingcai-card" aria-labelledby="jingcai-title">
    <header className="jingcai-header">
      <div><h2 id="jingcai-title">竞彩赛事</h2><p>比赛赛程与赛果</p></div>
      <button className="jingcai-refresh" type="button" onClick={retry} aria-label="刷新竞彩赛事" disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/><span>{loading ? '更新中' : '刷新'}</span></button>
    </header>
    <div className="jingcai-controls">
      <div className="jingcai-tabs" role="group" aria-label="选择竞彩类型">{sportOptions.map(option => <button key={option.key} type="button" aria-pressed={sport === option.key} className={sport === option.key ? 'active' : ''} onClick={() => setSport(option.key)}>{option.label}</button>)}</div>
      <span className="jingcai-live-label">当前公开赛程</span>
    </div>
    {loading && !matches.length ? <div className="jingcai-state" role="status">正在加载{sportLabel}赛事…</div> : error && !matches.length ? <div className="jingcai-state is-error"><b>暂时无法获取赛事信息</b><span>{error}</span><button type="button" onClick={retry}>重试</button></div> : matches.length ? <div className="jingcai-list">{matches.map(match => <MatchRow key={`${match.matchId}-${match.kickoffAt}`} match={match}/>)}</div> : <div className="jingcai-state">当前暂无可展示的{sportLabel}赛事</div>}
    {error && matches.length > 0 && <div className="jingcai-inline-error">{error}</div>}
    <footer className="jingcai-footer"><span>数据来源：{source}</span><span>{stale ? '缓存数据' : '更新于'}{updatedAt ? ` ${formatUpdatedAt(updatedAt)}` : ''}</span></footer>
    <p className="jingcai-notice">赛事信息及结果仅供参考，请以官方公布为准。</p>
  </section>
}
