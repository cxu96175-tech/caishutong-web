import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Home, Dices, Bookmark, RefreshCw, ChevronRight, ChevronDown, Trash2, ArrowLeft, TrendingUp, UserRound, Smartphone, Crown, Download, Settings, ShieldCheck, HelpCircle, Info, LogOut, TableProperties, Clock3, Send, FileText, Database, Mail } from 'lucide-react'
import { fetchRecords, gameOrder, generate, games, rules } from './data'
import './styles.css'

const storageKey = 'caishutong-plans'
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

function HomePage({ open, openTrend }) {
  const [all, setAll] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [stamp, setStamp] = useState('')
  const load = async () => { setLoading(true); setError(''); try { const rows = await fetchRecords(); setAll(rows); setStamp(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })) } catch (e) { setError(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const latest = gameOrder.map(g => all.find(r => r.game === g)).filter(Boolean)
  return <main><div className="section-head"><div><h1>最新开奖</h1><p>覆盖福彩与体彩常用数字游戏</p></div><button className="icon-btn" onClick={load} aria-label="刷新"><RefreshCw size={20} className={loading ? 'spin' : ''}/></button></div>
    {stamp && <div className="updated">更新于 {stamp}</div>}
    {loading && !latest.length ? <div className="cards">{[1,2,3].map(i => <div className="card skeleton" key={i}/>)}</div> : error ? <div className="state"><b>加载失败</b><p>{error}</p><button onClick={load}>重新加载</button></div> : <div className="cards">{latest.map(r => <article className="card result-card" onClick={() => open(r, all)} key={r.id}>
      <header><div className="game"><span className={`game-icon ${r.game}`}>{r.icon}</span><div><h2>{r.name}</h2><p>第 {r.issue} 期</p></div></div><div className="date">{r.drawDate}<small>{r.drawTime} 开奖</small></div></header>
      <Balls groups={[{ values: r.redBalls }, { values: r.blueBalls, accent: true }]}/>
      <div className="stats"><span>一等奖<b>{r.firstPrizeText}</b></span><span>本期销量<b>{r.saleAmountText}</b></span></div>
      <div className="pool"><span>奖池累计 {r.poolAmountText}</span><span className="card-links"><button onClick={event => { event.stopPropagation(); openTrend(r, all) }}><TrendingUp size={15}/> 走势图</button><span className="link">详情 <ChevronRight size={16}/></span></span></div>
    </article>)}</div>}<p className="notice">数据仅供参考 · 请以官方开奖结果为准</p></main>
}

const positionNames = ['百位','十位','个位','第四位','第五位','第六位','特别号']
function getTrendGroups(game) {
  const rule = rules.find(item => item.key === game) || rules[0]
  const groups = rule.groups.flatMap((group, groupIndex) => {
    const values = Array.from({ length: group.max - group.min + 1 }, (_, index) => group.min === 0 ? String(index) : String(group.min + index).padStart(2,'0'))
    if (group.repeatable && group.count > 1 && group.max === 9) {
      return Array.from({ length: group.count }, (_, position) => ({
        key: `${groupIndex}-${position}`, title: positionNames[position] || `第${position + 1}位`, values, count: 1,
        accent: position % 2 === 1, pick: record => [String((groupIndex ? record.blueBalls : record.redBalls)[position] ?? '')]
      }))
    }
    return [{ key: String(groupIndex), title: rule.groups.length > 1 ? (group.accent ? '蓝球 / 后区' : '红球 / 前区') : '号码走势', values, count: group.count, accent: Boolean(group.accent), pick: record => groupIndex ? record.blueBalls : record.redBalls }]
  })
  if (['fc3d', 'pl3'].includes(game)) groups.push({ key:'distribution', title:'号码分布', values:Array.from({ length:10 }, (_, index) => String(index)), count:3, distribution:true, pick:record => record.redBalls })
  return groups
}

const trendStatColumns = {
  fc3d: [['shape','组选形态',72],['sum','和值',52],['span','跨度',52],['oddEven','奇偶比',62],['bigSmall','大小比',62],['mod3','012路比',70]],
  pl3: [['shape','组选形态',72],['sum','和值',52],['span','跨度',52],['oddEven','奇偶比',62],['bigSmall','大小比',62],['mod3','012路比',70]],
  pl5: [['sum','和值',52],['oddEven','奇偶比',62],['bigSmall','大小比',62],['primeComposite','质合比',62]]
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

const detailMetricColors = ['#6557df','#9250e8','#ff754b','#ff9f2f','#f3df22','#7ee590']
function DrawMetrics({ game, record }) {
  if (!['fc3d','pl3','pl5'].includes(game)) return null
  const stats = getTrendStats(game, record)
  const metrics = [
    ['shape','形态'], ['sum','和值'], ['span','跨度'], ['oddEven','奇偶比'], ['bigSmall','大小比'],
    [game === 'pl5' ? 'primeComposite' : 'mod3', game === 'pl5' ? '质合比' : '012路比']
  ]
  return <section className="card draw-metrics" aria-label="本期号码指标">{metrics.map(([key,label],index) => <div className="draw-metric" style={{'--metric-color':detailMetricColors[index]}} key={key}><i/><span><b>{stats[key]}</b><small>{label}</small></span></div>)}</section>
}

function TraditionalTrendTable({ game, history, save }) {
  const [expanded, setExpanded] = useState(false)
  const [period, setPeriod] = useState(30)
  const [simulation, setSimulation] = useState({})
  const [multiplier, setMultiplier] = useState(1)
  const rows = useMemo(() => history.slice(0, period).reverse(), [history, period])
  const groups = useMemo(() => getTrendGroups(game), [game])
  const statColumns = trendStatColumns[game] || []
  const showLines = ['fc3d', 'pl3', 'pl5', 'ssq'].includes(game)
  const cell = 28, rowHeight = 34, issueWidth = 78, headerHeight = 64
  const totalCells = groups.reduce((sum, group) => sum + group.values.length, 0)
  const statWidth = statColumns.reduce((sum, column) => sum + column[2], 0)
  const tableWidth = issueWidth + totalCells * cell + statWidth
  const rowData = useMemo(() => {
    const misses = groups.map(group => Object.fromEntries(group.values.map(value => [value, 0])))
    return rows.map(record => ({ record, stats: getTrendStats(game, record), groups: groups.map((group, groupIndex) => {
      const hits = group.pick(record).filter(Boolean).map(value => group.values[0]?.length === 2 ? String(value).padStart(2,'0') : String(Number(value)))
      const values = group.values.map(value => { const hitCount = hits.filter(hit => hit === value).length; if (hitCount) { misses[groupIndex][value] = 0; return { value, hit: true, hitCount, miss: 0 } } misses[groupIndex][value] += 1; return { value, hit: false, hitCount: 0, miss: misses[groupIndex][value] } })
      return { hits, values }
    }) }))
  }, [rows, groups, game])
  const lines = useMemo(() => {
    let offset = 0
    return groups.flatMap((group, groupIndex) => {
      const series = Array.from({ length: group.count }, (_, seriesIndex) => {
        const points = rowData.map((row, rowIndex) => {
          const hits = row.groups[groupIndex].hits.slice().sort((a,b) => +a - +b)
          const value = hits[seriesIndex]
          const valueIndex = group.values.indexOf(value)
          return valueIndex < 0 ? null : `${offset + valueIndex * cell + cell / 2},${rowIndex * rowHeight + rowHeight / 2}`
        }).filter(Boolean)
        return { points: points.join(' '), color: '#A0A0A0', accent: Boolean(group.accent), distribution: Boolean(group.distribution) }
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
  const summaryHeight = summaryRows.length * 30
  const canvasHeight = headerHeight + rows.length * rowHeight + summaryHeight
  let boundaryOffset = 0
  const groupBoundaries = groups.slice(0, -1).map(group => { boundaryOffset += group.values.length * cell; return issueWidth + boundaryOffset })
  return <section className={`card classic-trend trend-fold-card ${expanded ? 'expanded' : ''}`}><button className="trend-collapse-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span><TableProperties size={18}/><b>基础走势图</b><small>近 {rows.length} 期 · 号码走势与遗漏统计</small></span><ChevronDown size={20}/></button>
    {expanded && <><div className="trend-fold-controls"><span>横向滑动查看更多号码</span><label className="period-filter"><span>期数</span><select value={period} onChange={event => setPeriod(Number(event.target.value))}>{[20,30,50].map(value => <option value={value} key={value}>近 {value} 期</option>)}</select></label></div>
    <div className="trend-scroll"><div className="trend-canvas" style={{ width: tableWidth, height: canvasHeight }}>
      <div className="trend-group-head" style={{ height: 32, width: tableWidth }}><div className="trend-issue-head" style={{ width: issueWidth, height: headerHeight }}>期号</div>{groups.map(group => <div style={{ width: group.values.length * cell }} key={group.key}>{group.title}</div>)}{statColumns.map(([key,label,width]) => <div className="trend-stat-head" style={{ width, height: headerHeight }} key={key}>{label}</div>)}</div>
      <div className="trend-number-head" style={{ left: issueWidth, width: totalCells * cell, height: 32 }}>{groups.flatMap(group => group.values.map(value => <div style={{ width: cell }} key={`${group.key}-${value}`}>{value}</div>))}</div>
      {showLines && <svg className="trend-lines" style={{ left: issueWidth, top: headerHeight }} width={totalCells * cell} height={rows.length * rowHeight} viewBox={`0 0 ${totalCells * cell} ${rows.length * rowHeight}`} aria-hidden="true">{lines.map((line,index) => line.points && !line.distribution && (game !== 'ssq' || line.accent) && <polyline key={index} points={line.points} fill="none" stroke={line.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity=".85"/>)}</svg>}
      {groupBoundaries.map((left, index) => <span className="trend-group-divider" style={{ left, height:canvasHeight }} key={index}/>) }
      <div className="trend-body" style={{ top: headerHeight }}>{rowData.map(({ record, groups: rowGroups, stats }) => <div className="trend-table-row" style={{ height: rowHeight }} key={record.id}><div className="trend-issue" style={{ width: issueWidth }}>{record.issue}</div>{rowGroups.flatMap((group, groupIndex) => group.values.map(cellData => <div className={`trend-cell ${cellData.hit ? `hit ${groups[groupIndex].accent ? 'hit-blue' : ''} ${groups[groupIndex].distribution ? `distribution-hit ${cellData.hitCount > 1 ? 'repeat-hit' : ''}` : ''}` : ''}`} style={{ width: cell, height: rowHeight }} key={`${record.id}-${groupIndex}-${cellData.value}`}>{cellData.hit ? <b>{cellData.value}{groups[groupIndex].distribution && cellData.hitCount > 1 && <i>{cellData.hitCount}</i>}</b> : <span>{cellData.miss}</span>}</div>))}{statColumns.map(([key,,width]) => <div className={`trend-stat ${key === 'shape' ? `shape-${stats[key] === '豹子' ? 'baozi' : stats[key] === '组三' ? 'group3' : 'group6'}` : ''}`} style={{ width, height: rowHeight }} key={`${record.id}-${key}`}><span>{stats[key]}</span></div>)}</div>)}{summaryRows.map(summary => <div className="trend-summary-row" style={{ height:30 }} key={summary.key}><div className="trend-summary-label" style={{ width:issueWidth }}>{summary.label}</div>{summary.groups.flatMap((values, groupIndex) => values.map((value, valueIndex) => <div className="trend-summary-cell" style={{ width:cell }} key={`${summary.key}-${groupIndex}-${valueIndex}`}>{value}</div>))}<div className="trend-summary-spacer" style={{ width:statWidth }}/></div>)}</div>
    </div><div className="trend-simulator" style={{ width:tableWidth }}><div className="trend-simulator-label" style={{ width:issueWidth }}>模拟选号</div>{groups.flatMap(group => group.values.map(value => group.distribution ? <span className="sim-placeholder" style={{ width:cell }} key={`${group.key}-${value}`}/> : <button className={(simulation[group.key] || []).includes(value) ? 'selected' : ''} style={{ width:cell }} onClick={() => chooseSimulation(group,value)} key={`${group.key}-${value}`}>{value}</button>))}<span style={{ width:statWidth }}/></div></div>
    <div className="simulation-footer"><span>已选 <b>{selectedTotal}</b> 个，共 <b>{bets}</b> 注</span><label><input type="number" min="1" max="99" value={multiplier} onChange={event => setMultiplier(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}/> 倍</label><strong>{bets * multiplier * 2} 元</strong><button onClick={() => setSimulation({})}>清空选号</button><button className="save-simulation" disabled={!bets} onClick={saveSimulation}>保存方案</button></div>
    </>}
  </section>
}

function HistoryList({ history }) {
  const [expanded, setExpanded] = useState(false)
  const [period, setPeriod] = useState(30)
  const [page, setPage] = useState(1)
  const filtered = history.slice(0, period)
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10))
  const rows = filtered.slice((page - 1) * 10, page * 10)
  const changePeriod = value => { setPeriod(value); setPage(1) }
  return <section className={`card trend-history trend-fold-card ${expanded ? 'expanded' : ''}`}><button className="trend-collapse-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span><Clock3 size={18}/><b>历史开奖号码</b><small>近 {period} 期 · 每页10期</small></span><ChevronDown size={20}/></button>
    {expanded && <div className="trend-history-content"><div className="history-head"><span>开奖明细</span><label className="period-filter"><span>期数</span><select value={period} onChange={event => changePeriod(Number(event.target.value))}>{[10,20,30,50].map(value => <option value={value} key={value}>近 {value} 期</option>)}</select></label></div>
    <div className="history-list">{rows.map(record => <div className="history" key={record.id}><span>第 {record.issue} 期</span><Balls small groups={[{ values: record.redBalls }, { values: record.blueBalls, accent: true }]}/></div>)}</div>
    <div className="history-pagination"><button disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>上一页</button><span>{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage(current => Math.min(totalPages, current + 1))}>下一页</button></div>
    </div>}
  </section>
}

const klineMetrics = { sum:'和值', span:'跨度', heat:'热度', omission:'遗漏' }
const maColors = { ma5:'#ff9500', ma10:'#3478f6', ma20:'#af52de' }
const LazyKlineChart = React.lazy(() => import('./KlineChart.jsx'))

function buildKlineData(history, metric, period) {
  const chronological = history.slice().reverse()
  const lastSeen = new Map()
  const metricRows = chronological.map((record, index) => {
    const values = [...record.redBalls, ...record.blueBalls].map(Number).filter(Number.isFinite)
    let value = 0
    if (metric === 'sum') value = values.reduce((total, number) => total + number, 0)
    if (metric === 'span') value = values.length ? Math.max(...values) - Math.min(...values) : 0
    if (metric === 'heat') {
      const window = chronological.slice(Math.max(0, index - 9), index + 1)
      const counts = new Map()
      window.forEach(item => [...item.redBalls, ...item.blueBalls].forEach(number => counts.set(String(Number(number)), (counts.get(String(Number(number))) || 0) + 1)))
      value = values.length ? values.reduce((total, number) => total + (counts.get(String(number)) || 0), 0) / values.length : 0
    }
    if (metric === 'omission') {
      const unique = [...new Set(values)]
      value = unique.length ? unique.reduce((total, number) => total + (lastSeen.has(number) ? index - lastSeen.get(number) - 1 : index + 1), 0) / unique.length : 0
    }
    ;[...new Set(values)].forEach(number => lastSeen.set(number, index))
    return { issue:record.issue, numbers:[...record.redBalls, ...record.blueBalls].join(' '), value:Number(value.toFixed(2)) }
  })
  const rows = metricRows.map((row, index) => {
    const open = index ? metricRows[index - 1].value : row.value
    const close = row.value
    const windowValues = metricRows.slice(Math.max(0, index - 3), index + 1).map(item => item.value)
    const high = Math.max(open, close, ...windowValues)
    const low = Math.min(open, close, ...windowValues)
    const average = length => index + 1 < length ? null : Number((metricRows.slice(index - length + 1, index + 1).reduce((total, item) => total + item.value, 0) / length).toFixed(2))
    return { ...row, open, close, high, low, range:[low,high], ma5:average(5), ma10:average(10), ma20:average(20) }
  })
  return rows.slice(-period)
}

function KlineAnalysis({ history }) {
  const [expanded, setExpanded] = useState(false)
  const [metric, setMetric] = useState('sum')
  const [period, setPeriod] = useState(30)
  const [movingAverages, setMovingAverages] = useState({ ma5:true, ma10:true, ma20:true })
  const data = useMemo(() => buildKlineData(history, metric, period), [history, metric, period])
  const chartWidth = Math.max(640, data.length * 28)
  return <section className={`card kline-card ${expanded ? 'expanded' : ''}`}><button className="kline-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span><TrendingUp size={18}/><b>K线均线分析</b><small>{klineMetrics[metric]} · K线 + MA</small></span><ChevronDown size={20}/></button>
    {expanded && <div className="kline-content"><div className="kline-controls"><div className="kline-metrics">{Object.entries(klineMetrics).map(([key,label]) => <button className={metric === key ? 'active' : ''} onClick={() => setMetric(key)} key={key}>{label}</button>)}</div><label className="period-filter"><span>期数</span><select value={period} onChange={event => setPeriod(Number(event.target.value))}>{[20,30,50].map(value => <option value={value} key={value}>近 {value} 期</option>)}</select></label></div>
      <div className="ma-switches">{[['ma5','MA5'],['ma10','MA10'],['ma20','MA20']].map(([key,label]) => <label style={{ '--ma-color':maColors[key] }} key={key}><input type="checkbox" checked={movingAverages[key]} onChange={() => setMovingAverages(current => ({ ...current, [key]:!current[key] }))}/><i/>{label}</label>)}</div>
      <div className="kline-scroll"><div style={{ width:chartWidth, height:300 }}><React.Suspense fallback={<div className="kline-loading">正在加载图表…</div>}><LazyKlineChart data={data} movingAverages={movingAverages} colors={maColors}/></React.Suspense></div></div>
      <p className="kline-notice">仅展示历史号码派生指标变化，不代表未来开奖结果。</p></div>}
  </section>
}

function Trend({ item, all, back, save }) {
  const history = all.filter(record => record.game === item.game).slice(0, 50)
  const frequencyPeriod = ['fc3d', 'pl3'].includes(item.game) ? 20 : item.game === 'pl5' ? 10 : 30
  const frequencyHistory = history.slice(0, frequencyPeriod)
  const numbers = useMemo(() => {
    const max = Math.max(9, ...frequencyHistory.flatMap(record => [...record.redBalls, ...record.blueBalls].map(Number)))
    const counts = new Map()
    frequencyHistory.forEach(record => [...record.redBalls, ...record.blueBalls].forEach(value => counts.set(value, (counts.get(value) || 0) + 1)))
    return Array.from({ length: max + (max >= 10 ? 1 : 0) }, (_, index) => max >= 10 ? String(index + 1).padStart(2, '0') : String(index)).map(value => ({ value, count: counts.get(value) || counts.get(String(Number(value))) || 0 }))
  }, [frequencyHistory])
  return <main><button className="back" onClick={back}><ArrowLeft size={18}/> 返回首页</button>
    <div className="section-head"><div><h1>{item.name}走势图</h1></div><span className={`game-icon ${item.game}`}>{item.icon}</span></div>
    <section className="card frequency"><h3><TrendingUp size={18}/> 号码出现次数 <small>近 {frequencyHistory.length} 期</small></h3><div className="frequency-grid">{numbers.map(number => <div className="frequency-item" key={number.value}><b>{number.count}</b><i style={{ height: `${Math.max(8, number.count * 8)}px` }}/><span>{number.value}</span></div>)}</div></section>
    <TraditionalTrendTable game={item.game} history={history} save={save}/>
    <KlineAnalysis history={history}/>
    <HistoryList history={history}/>
  </main>
}

function Detail({ item, all, back }) {
  const history = all.filter(r => r.game === item.game).slice(0, 50)
  return <main><button className="back" onClick={back}><ArrowLeft size={18}/> 返回</button><div className="detail-hero"><span className={`game-icon ${item.game}`}>{item.icon}</span><h1>{item.name}</h1><p>第 {item.issue} 期 · {item.drawDate}</p><Balls groups={[{ values: item.redBalls }, { values: item.blueBalls, accent: true }]}/></div>
    <section className="card detail-card"><h3>本期数据</h3><div className="detail-grid"><span>本期销量<b>{item.saleAmountText}</b></span><span>奖池累计<b>{item.poolAmountText}</b></span><span>一等奖<b>{item.firstPrizeText}</b></span></div></section>
    <DrawMetrics game={item.game} record={item}/>
    <HistoryList history={history}/></main>
}

function RandomPage({ save }) {
  const [rule, setRule] = useState(rules[0]), [mode, setMode] = useState('direct'), [count, setCount] = useState(1), [entries, setEntries] = useState(() => [generate(rules[0])]), [custom, setCustom] = useState(() => rules[0].groups.map(() => []))
  const regenerate = (r = rule, m = mode, c = count) => setEntries(Array.from({ length: c }, () => generate(r, m)))
  const chooseRule = r => { setRule(r); setMode('direct'); setCustom(r.groups.map(() => [])); regenerate(r, 'direct', count) }
  const chooseCustom = (groupIndex, value) => {
    const group = rule.groups[groupIndex]
    setCustom(current => current.map((values, index) => {
      if (index !== groupIndex) return values
      if (group.repeatable) return values.length >= group.count ? values : [...values, value]
      return values.includes(value) ? values.filter(item => item !== value) : [...values, value].sort((a,b) => +a - +b)
    }))
  }
  const customComplete = custom.every((values, index) => values.length >= rule.groups[index].count)
  const saveAll = () => {
    const savedEntries = entries.map((groups,i) => ({ id:`${Date.now()}-${i}`, groups, sourceLabel:'随机' }))
    if (customComplete) savedEntries.push({ id:`${Date.now()}-custom`, sourceLabel:'自选', groups: custom.map((values,index) => ({ values, accent: rule.groups[index].accent })) })
    save({ id: String(Date.now()), planName: rule.name + (rule.grouped ? ` · ${{direct:'直选',group3:'组三',group6:'组六'}[mode]}` : ''), createdAt: new Date().toLocaleString('zh-CN'), entries: savedEntries })
  }
  return <main><div className="section-head"><div><h1>选号工具</h1><p>选择彩种，随机生成或自定义号码</p></div></div>
    <div className="tabs">{rules.map(r => <button className={r.key === rule.key ? 'active' : ''} onClick={event => { const target = event.currentTarget; chooseRule(r); requestAnimationFrame(() => target.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' })) }} key={r.key}>{r.name}</button>)}</div>
    {rule.grouped && <div className="segmented">{[['direct','直选'],['group3','组三'],['group6','组六']].map(([k,v]) => <button className={mode === k ? 'active' : ''} onClick={() => { setMode(k); regenerate(rule,k,count) }} key={k}>{v}</button>)}</div>}
    <section className="card generator"><div className="generator-head"><div><h2>{rule.name}</h2><p>{rule.hint}</p></div><div><select value={count} onChange={e => { const c = +e.target.value; setCount(c); regenerate(rule,mode,c) }}>{[1,3,5,10].map(n => <option key={n} value={n}>{n} 组</option>)}</select><button className="generate-button" onClick={() => regenerate()}><RefreshCw size={17}/> 随机生成</button></div></div>
      <div className="generated">{entries.map((groups,i) => <div className="entry" key={i}><em>{String(i+1).padStart(2,'0')}</em><Balls groups={groups}/></div>)}</div>
    </section>
    <section className="card custom-picker"><div className="custom-head"><div><h2>自定义选号</h2><p>按当前彩种规则选择号码；已选号码可再次点击移除</p></div>{custom.some(values => values.length) && <button onClick={() => setCustom(rule.groups.map(() => []))}>清空</button>}</div>
      {rule.groups.map((group, groupIndex) => <div className="custom-group" key={groupIndex}><div className="custom-label"><b>{rule.groups.length > 1 ? (group.accent ? '蓝球 / 后区' : '红球 / 前区') : '号码区'}</b><span>已选 {custom[groupIndex].length} / 至少 {group.count}</span></div>
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
  return <main><div className="section-head"><div><h1>我的方案</h1><p>本机保存 · 共 {plans.length} 份</p></div></div>
    {plans.length > 0 && <div className="plan-filters" aria-label="按彩种筛选"><button className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={event => { const target = event.currentTarget; setFilter('all'); requestAnimationFrame(() => target.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' })) }}>全部 <span>{plans.length}</span></button>{rules.map(rule => { const count = plans.filter(plan => plan.planName.startsWith(rule.name)).length; return <button className={filter === rule.key ? 'active' : ''} aria-pressed={filter === rule.key} onClick={event => { const target = event.currentTarget; setFilter(rule.key); requestAnimationFrame(() => target.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' })) }} key={rule.key}>{rule.name} <span>{count}</span></button> })}</div>}
    {!plans.length ? <div className="state"><Bookmark size={38}/><b>还没有保存的方案</b><p>前往“选号工具”生成并保存</p></div> : !filteredPlans.length ? <div className="state filtered-empty"><Bookmark size={34}/><b>该彩种暂无方案</b><p>请选择其他彩种，或前往选号工具保存方案</p></div> : <div className="cards">{filteredPlans.map(p => <article className="card plan" key={p.id}><header><div><h2>{p.planName}</h2><p>{p.createdAt}</p></div><button className="icon-btn danger" aria-label={`删除${p.planName}方案`} onClick={() => remove(p.id)}><Trash2 size={18}/></button></header>{p.entries.map((e,i) => <div className="entry" key={e.id || i}><PlanEntryLabel text={e.sourceLabel} fallback={String(i+1).padStart(2,'0')}/><Balls groups={e.groups}/></div>)}</article>)}</div>}
  </main>
}

const memberStorageKey = 'caishutong-phone-member'
const maskPhone = phone => `${phone.slice(0,3)}****${phone.slice(-4)}`

function PhoneLogin({ notify, onLogin }) {
  const [phone,setPhone] = useState(''), [code,setCode] = useState(''), [sentCode,setSentCode] = useState(''), [seconds,setSeconds] = useState(0), [error,setError] = useState('')
  useEffect(() => {
    if (!seconds) return
    const timer = setTimeout(() => setSeconds(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])
  const validPhone = /^1[3-9]\d{9}$/.test(phone)
  const sendCode = () => {
    if (!validPhone) return setError('请输入正确的11位手机号')
    const nextCode = String(Math.floor(100000 + Math.random() * 900000))
    setSentCode(nextCode); setSeconds(60); setError(''); notify(`测试验证码：${nextCode}`)
  }
  const submit = event => {
    event.preventDefault()
    if (!validPhone) return setError('请输入正确的11位手机号')
    if (!sentCode) return setError('请先获取验证码')
    if (code !== sentCode) return setError('验证码不正确，请重新输入')
    onLogin({ phone, nickname:'彩友' })
  }
  return <section className="profile-login-card"><div className="login-mark"><Smartphone size={29}/></div><h2>手机号登录</h2><p>使用手机验证码登录，用于管理我的方案和会员权益</p><form onSubmit={submit}><label><span>手机号</span><input type="tel" inputMode="numeric" autoComplete="tel" maxLength="11" placeholder="请输入11位手机号" value={phone} onChange={event => { setPhone(event.target.value.replace(/\D/g,'').slice(0,11)); setError('') }}/></label><label><span>验证码</span><div className="code-field"><input inputMode="numeric" autoComplete="one-time-code" maxLength="6" placeholder="请输入6位验证码" value={code} onChange={event => { setCode(event.target.value.replace(/\D/g,'').slice(0,6)); setError('') }}/><button type="button" disabled={seconds > 0} onClick={sendCode}>{seconds > 0 ? `${seconds}秒后重发` : '获取验证码'}</button></div></label>{error && <p className="login-error">{error}</p>}<button className="login-submit" type="submit">验证并登录</button></form><small>当前为测试验证码 · 登录即代表同意《用户协议》和《隐私政策》</small></section>
}

function HelpPage({ back, notify }) {
  const [openFaq,setOpenFaq] = useState(0), [category,setCategory] = useState('功能建议'), [message,setMessage] = useState(''), [contact,setContact] = useState('')
  const faqs = [
    ['开奖数据多久更新？','开奖后系统会自动同步数据。网络或数据源延迟时，可在首页点击刷新按钮重新获取。'],
    ['保存的方案在哪里查看？','随机生成、自定义选号和走势模拟保存后，都会统一出现在底部“我的方案”中。'],
    ['走势图的数据代表预测结果吗？','不是。走势图仅整理历史开奖数据，不构成号码预测、投注建议或中奖承诺。'],
    ['如何保护我的账户信息？','微信授权仅用于识别账户。我们不会自动发布内容，也不会在未经允许时获取与功能无关的信息。']
  ]
  const submit = event => {
    event.preventDefault()
    if (message.trim().length < 5) return notify('请至少填写5个字的反馈内容')
    const feedback = { id:Date.now(), category, message:message.trim(), contact:contact.trim(), createdAt:new Date().toISOString() }
    let existing = []; try { existing = JSON.parse(localStorage.getItem('caishutong-feedback')) || [] } catch {}
    localStorage.setItem('caishutong-feedback', JSON.stringify([feedback,...existing].slice(0,10)))
    setMessage(''); setContact(''); notify('感谢反馈，内容已记录')
  }
  return <main className="account-subpage"><button className="subpage-back" onClick={back}><ArrowLeft size={19}/> 返回</button><header className="subpage-title"><i className="help-color"><HelpCircle size={27}/></i><div><h1>帮助与反馈</h1><p>使用帮助与意见反馈</p></div></header><section className="account-section"><h2>常见问题</h2><div className="faq-list">{faqs.map(([question,answer],index) => <article className={openFaq === index ? 'open' : ''} key={question}><button aria-expanded={openFaq === index} onClick={() => setOpenFaq(current => current === index ? -1 : index)}><span>{question}</span><ChevronDown size={18}/></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></section><section className="account-section feedback-section"><h2>意见反馈</h2><p className="section-caption">你的建议会帮助我们持续改进产品体验</p><form onSubmit={submit}><div className="feedback-categories">{['功能建议','数据问题','使用问题','其他'].map(item => <button type="button" className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><label><span>反馈内容</span><textarea maxLength="500" placeholder="请描述遇到的问题或你的建议" value={message} onChange={event => setMessage(event.target.value)}/><small>{message.length}/500</small></label><label><span>联系方式（选填）</span><div className="feedback-contact"><Mail size={17}/><input placeholder="微信号或邮箱" value={contact} onChange={event => setContact(event.target.value)}/></div></label><button className="feedback-submit" type="submit"><Send size={17}/> 提交反馈</button></form></section></main>
}

function AboutPage({ back }) {
  return <main className="account-subpage"><button className="subpage-back" onClick={back}><ArrowLeft size={19}/> 返回</button><header className="about-hero"><div className="about-logo">彩</div><h1>彩数通</h1><p>数字生活助手</p><span>当前版本 1.0.0</span></header><section className="account-section about-copy"><h2>关于彩数通</h2><p>彩数通是一款开奖数据整理与历史统计工具，提供开奖查询、号码分布、走势图和个人方案管理等功能。</p><p>我们坚持清晰、克制的数据呈现，不提供彩票销售、代购服务，也不承诺或暗示提高中奖概率。</p></section><section className="account-section about-links"><details><summary><i className="blue"><Database size={18}/></i><span><b>数据来源与声明</b><small>开奖信息及使用边界</small></span><ChevronDown size={18}/></summary><div>开奖信息来自公开数据接口，仅供查询参考。数据可能因网络或数据源原因延迟，请以福利彩票、体育彩票官方公布结果为准。</div></details><details><summary><i className="purple"><FileText size={18}/></i><span><b>用户协议</b><small>服务规则与用户责任</small></span><ChevronDown size={18}/></summary><div>用户应合法、理性地使用本工具，不得利用服务开展售彩、代购、赌博或其他违法活动。历史统计结果不构成投注建议。</div></details><details><summary><i className="green"><ShieldCheck size={18}/></i><span><b>隐私政策</b><small>信息收集与安全说明</small></span><ChevronDown size={18}/></summary><div>我们遵循最小必要原则处理账户信息。微信授权仅用于账户识别和方案同步，不会自动发布内容；你可以退出登录并申请删除账户数据。</div></details></section><p className="about-footer">© 2026 彩数通 · 数据工具仅供参考，请理性使用</p></main>
}

function ProfilePage({ member, onLogin, onLogout, notify, goPlans, openHelp, openAbout }) {
  if (!member) return <main className="profile-page"><div className="profile-title"><h1>我的</h1><p>登录后管理个人资料和服务</p></div><PhoneLogin notify={notify} onLogin={onLogin}/><section className="profile-menu public-profile-menu"><button onClick={openHelp}><i style={{backgroundColor:'#f3aa19'}}><HelpCircle size={19}/></i><span><b>帮助与反馈</b><small>使用帮助与意见反馈</small></span><ChevronRight size={19}/></button><button onClick={openAbout}><i style={{backgroundColor:'#49a9ee'}}><Info size={19}/></i><span><b>关于彩数通</b><small>版本信息与服务协议</small></span><ChevronRight size={19}/></button></section><p className="profile-disclaimer">手机号仅用于账户验证和服务通知</p></main>
  const items = [
    [Bookmark,'我的方案','查看已保存的选号方案','#4169f6',goPlans],
    [Download,'数据导出','会员可导出历史分析数据','#20b7d8'],
    [Settings,'数据设置','管理走势图与分析偏好','#7a6ff0'],
    [ShieldCheck,'账户与安全','手机号、登录设备与隐私','#36c978'],
    [HelpCircle,'帮助与反馈','使用帮助与意见反馈','#f3aa19',openHelp],
    [Info,'关于彩数通','版本信息与服务协议','#49a9ee',openAbout]
  ]
  return <main className="profile-page"><div className="profile-title"><h1>我的</h1></div><section className="profile-user"><div className="profile-avatar"><UserRound size={31}/></div><div><h2>{member.nickname || '彩友'}</h2><p>{maskPhone(member.phone)}</p></div><span>已登录</span></section><section className="member-banner"><div><span><Crown size={18}/> 彩数通会员</span><h2>解锁更多数据分析工具</h2><p>高级走势图 · K线分析 · 数据导出</p></div><button onClick={() => notify('会员功能即将开放')}>了解会员</button></section><section className="profile-menu">{items.map(([Icon,title,desc,color,action]) => <button onClick={action || (() => notify('功能正在建设中'))} key={title}><i style={{backgroundColor:color}}><Icon size={19}/></i><span><b>{title}</b><small>{desc}</small></span><ChevronRight size={19}/></button>)}</section><button className="logout-button" onClick={onLogout}><LogOut size={18}/> 退出登录</button><p className="profile-disclaimer">数据工具仅供参考，请理性使用</p></main>
}

function App() {
  const [tab,setTab] = useState('home'), [view,setView] = useState(null), [plans,setPlans] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey)) || [] } catch { return [] } }), [toast,setToast] = useState(''), [member,setMember] = useState(() => { try { return JSON.parse(localStorage.getItem(memberStorageKey)) } catch { return null } })
  const persist = next => { setPlans(next); localStorage.setItem(storageKey, JSON.stringify(next)) }
  const notify = message => { setToast(message); setTimeout(() => setToast(''),2200) }
  const save = plan => { persist([plan,...plans].slice(0,20)); notify('已保存在“我的方案”') }
  const login = next => { setMember(next); localStorage.setItem(memberStorageKey, JSON.stringify(next)); notify('登录成功') }
  const logout = () => { setMember(null); localStorage.removeItem(memberStorageKey); notify('已退出登录') }
  const nav = k => { setTab(k); setView(null); scrollTo(0,0) }
  const showView = next => { setView(next); scrollTo(0,0) }
  const navItems = [['home',Home,'首页'],['random',Dices,'选号工具'],['plans',Bookmark,'我的方案'],['profile',UserRound,'我的']]
  const activeNavIndex = Math.max(0, navItems.findIndex(([key]) => key === tab))
  const keepTabActive = !view || ['help','about'].includes(view.type)
  return <div className="app-shell"><div className="brand"><span>彩</span><b>彩数通</b><small>数字生活助手</small></div><div className="content">{view?.type === 'detail' ? <Detail {...view} back={() => setView(null)}/> : view?.type === 'trend' ? <Trend {...view} save={save} back={() => setView(null)}/> : view?.type === 'help' ? <HelpPage back={() => setView(null)} notify={notify}/> : view?.type === 'about' ? <AboutPage back={() => setView(null)}/> : tab === 'home' ? <HomePage open={(item,all) => showView({type:'detail',item,all})} openTrend={(item,all) => showView({type:'trend',item,all})}/> : tab === 'random' ? <RandomPage save={save}/> : tab === 'plans' ? <Plans plans={plans} remove={id => persist(plans.filter(p => p.id !== id))}/> : <ProfilePage member={member} onLogin={login} onLogout={logout} notify={notify} goPlans={() => nav('plans')} openHelp={() => showView({type:'help'})} openAbout={() => showView({type:'about'})}/>}</div>
    <nav className="bottom-nav" aria-label="主导航" style={{'--nav-index':activeNavIndex}}><i className="nav-selection" aria-hidden="true"/>{navItems.map(([k,Icon,label]) => <button className={tab===k&&keepTabActive?'active':''} aria-current={tab===k&&keepTabActive?'page':undefined} onClick={() => nav(k)} key={k}><Icon/><span>{label}</span></button>)}</nav>{toast && <div className="toast">{toast}</div>}</div>
}
createRoot(document.getElementById('root')).render(<App/>)
