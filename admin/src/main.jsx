import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Activity, Clock3, Eye, LayoutDashboard, LogOut, MousePointerClick, RefreshCw, ShieldCheck, Smartphone, Users } from 'lucide-react'
import './styles.css'

const adminDeviceKey = 'caishutong-admin-device'
const adminSessionKey = 'caishutong-admin-session'

const adminAnonymousId = (storage, key) => {
  try {
    let value = storage.getItem(key)
    if (!value) { value = crypto.randomUUID(); storage.setItem(key, value) }
    return value
  } catch { return crypto.randomUUID() }
}

const adminRequestHeaders = (extra = {}) => ({
  ...extra,
  'X-Admin-Device': adminAnonymousId(localStorage, adminDeviceKey),
  'X-Admin-Session': adminAnonymousId(sessionStorage, adminSessionKey)
})

const adminLabels = {
  nav_click: '底部导航', open_detail: '打开详情', open_trend: '打开走势图', open_history: '打开历史开奖', open_rules: '打开玩法规则',
  random_generate: '随机生成', save_plan: '保存方案', member_login: '用户登录', export_chart: '导出走势图',
  admin_login: '管理员登录', admin_logout: '管理员退出', view_stats: '查看运营统计', view_feedback: '查看用户反馈', update_feedback: '更新反馈', view_activity: '查看管理员数据',
  fc3d: '福彩3D', ssq: '双色球', dlt: '大乐透', pl3: '排列三', pl5: '排列五', qxc: '七星彩', qlc: '七乐彩', klb: '快乐8', mobile: '手机端', desktop: '电脑端'
}

const adminName = value => adminLabels[value] || value || '其他'
const adminNumber = value => Number(value || 0).toLocaleString('zh-CN')
const jsonHeaders = () => adminRequestHeaders()
const readJson = async response => {
  const text = await response.text()
  try { return text ? JSON.parse(text) : {} } catch { return { error: response.ok ? '服务器返回格式错误' : `服务暂时不可用（${response.status}）` } }
}

function AdminNav({ active }) {
  const navigate = (event, path) => {
    event.preventDefault()
    window.location.assign(path)
  }
  return <nav className="admin-surface-nav" aria-label="管理员后台导航">
    <a className={active === 'overview' ? 'active' : ''} aria-current={active === 'overview' ? 'page' : undefined} href="/admin/" onClick={event => navigate(event, '/admin/')}><LayoutDashboard size={15}/>运营概览</a>
    <a className={active === 'activity' ? 'active' : ''} aria-current={active === 'activity' ? 'page' : undefined} href="/admin/activity/" onClick={event => navigate(event, '/admin/activity/')}><Activity size={15}/>管理员数据</a>
  </nav>
}

function AdminList({ title, rows, empty = '暂无数据' }) {
  const max = Math.max(1, ...rows.map(row => Number(row.value || 0)))
  return <section className="admin-panel"><h2>{title}</h2>{rows.length ? <div className="admin-ranking">{rows.map((row, index) => <div key={`${row.name}-${index}`}><span>{adminName(row.name)}</span><i><em style={{ width: `${Number(row.value || 0) / max * 100}%` }}/></i><b>{adminNumber(row.value)}</b></div>)}</div> : <p className="admin-empty">{empty}</p>}</section>
}

const feedbackStatusLabels = { pending: '待处理', processing: '处理中', resolved: '已解决' }

function AdminFeedback({ rows, filter, setFilter, onSave, saving }) {
  const [notes, setNotes] = useState({})
  useEffect(() => { setNotes(Object.fromEntries(rows.map(row => [row.id, row.admin_note || '']))) }, [rows])
  return <section className="admin-panel admin-feedback"><header><div><h2>用户反馈</h2><p>反馈内容、处理状态与内部回复备注</p></div><div className="admin-feedback-filters">{[['all', '全部'], ...Object.entries(feedbackStatusLabels)].map(([value, label]) => <button className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div></header>{rows.length ? <div className="admin-feedback-list">{rows.map(row => <article key={row.id}><div className="admin-feedback-meta"><span>{row.category}</span><time>{new Date(`${row.created_at}Z`).toLocaleString('zh-CN')}</time></div><p>{row.message}</p>{row.contact && <small>联系方式：{row.contact}</small>}<div className="admin-feedback-actions"><select value={row.status} onChange={event => onSave(row.id, event.target.value, notes[row.id] || '')} disabled={saving === row.id}>{Object.entries(feedbackStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input maxLength="1000" placeholder="填写回复备注（仅管理员可见）" value={notes[row.id] || ''} onChange={event => setNotes(current => ({ ...current, [row.id]: event.target.value }))}/><button onClick={() => onSave(row.id, row.status, notes[row.id] || '')} disabled={saving === row.id}>{saving === row.id ? '保存中…' : '保存备注'}</button></div></article>)}</div> : <p className="admin-empty">当前筛选下暂无反馈</p>}</section>
}

function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async event => {
    event.preventDefault(); setSubmitting(true); setError('')
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: adminRequestHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ email, password }) })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body.error || '登录失败')
      await onSuccess()
    } catch (reason) { setError(reason.message) } finally { setSubmitting(false) }
  }
  return <main className="admin-login-page"><section className="admin-login-card"><div className="admin-login-logo"><ShieldCheck size={28}/></div><span>彩研通数据中心</span><h1>管理员登录</h1><p>仅限授权管理员访问运营数据</p><form onSubmit={submit}><label><span>管理员邮箱</span><input type="email" autoComplete="username" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="请输入管理员邮箱" required/></label><label><span>密码</span><input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="请输入密码" required/></label>{error && <div className="admin-login-error">{error}</div>}<button type="submit" disabled={submitting}>{submitting ? '正在验证…' : '登录'}</button></form><small>登录状态将在 12 小时后自动失效</small></section></main>
}

function useAdminFetch(path, days) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [needsLogin, setNeedsLogin] = useState(false)
  const load = async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`${path}?days=${days}`, { credentials: 'include', headers: jsonHeaders() })
      const body = await readJson(response)
      if (response.status === 401) { setNeedsLogin(true); setData(null); return }
      if (!response.ok) throw new Error(body.error || '管理员数据加载失败')
      setNeedsLogin(false); setData(body)
    } catch (reason) { setError(reason.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [days, path])
  return { data, loading, error, needsLogin, setNeedsLogin, load, setError }
}

function AdminActivityPage() {
  const [days, setDays] = useState(30)
  const { data, loading, error, needsLogin, load } = useAdminFetch('/api/admin/activity', days)
  const series = data?.series || [], maxViews = Math.max(1, ...series.map(row => Number(row.views || 0)))
  const summary = [['累计管理员访问', data?.totals?.views, Eye, 'blue'], ['今日管理员访问', data?.today?.views, Activity, 'purple'], ['累计管理员操作', data?.totals?.operations, MousePointerClick, 'orange'], ['今日管理员操作', data?.today?.operations, MousePointerClick, 'red'], ['访问设备', data?.totals?.devices, Smartphone, 'green'], ['访问会话', data?.totals?.sessions, Clock3, 'cyan']]
  if (needsLogin) return <AdminLogin onSuccess={load}/>
  return <main className="admin-page"><header className="admin-header"><div><span><ShieldCheck size={20}/>管理员数据</span><h1>管理员访问与操作</h1><p>独立记录后台访问、统计查看和反馈处理；当前管理员电脑的访问也会计入</p></div><div className="admin-header-actions"><button onClick={load} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={17}/>刷新</button></div></header><AdminNav active="activity"/><div className="admin-period">{[7, 30, 90].map(value => <button className={days === value ? 'active' : ''} onClick={() => setDays(value)} key={value}>近 {value} 天</button>)}</div>{error ? <section className="admin-auth-state"><ShieldCheck size={34}/><h2>数据加载失败</h2><p>{error}</p><button onClick={load}>重新加载</button></section> : <><div className="admin-summary admin-summary-activity">{summary.map(([label, value, Icon, color]) => <article className={color} key={label}><i><Icon size={19}/></i><span>{label}</span><b>{loading && !data ? '--' : adminNumber(value)}</b></article>)}</div><section className="admin-panel admin-trend"><header><div><h2>管理员访问趋势</h2><p>按天汇总后台页面访问</p></div><span>近 {days} 天</span></header><div className="admin-bars">{series.map(row => <div title={`${row.day}：访问 ${row.views || 0} 次，操作 ${row.operations || 0} 次`} key={row.day}><i style={{ height: `${Math.max(4, Number(row.views || 0) / maxViews * 100)}%` }}/><small>{row.day.slice(5)}</small></div>)}</div></section><div className="admin-grid"><AdminList title="管理员行为排行" rows={data?.events || []}/><section className="admin-panel admin-activity-log"><h2>最近管理员记录</h2>{data?.recent?.length ? <div className="admin-activity-list">{data.recent.map(row => <article key={row.id || `${row.created_at}-${row.event_name}`}><div><strong>{adminName(row.event_name)}</strong><time>{new Date(`${row.created_at}Z`).toLocaleString('zh-CN')}</time></div><p>{adminName(row.page_name)}{row.target_name ? ` · ${row.target_name}` : ''}</p><small>{row.admin_email} · {adminName(row.device_type)}</small></article>)}</div> : <p className="admin-empty">暂无管理员记录</p>}</section></div><p className="admin-updated">数据生成于 {data?.generatedAt ? new Date(data.generatedAt).toLocaleString('zh-CN') : '--'}</p></>}</main>
}

function AdminDashboard() {
  const [days, setDays] = useState(30), [feedback, setFeedback] = useState([]), [feedbackFilter, setFeedbackFilter] = useState('all'), [feedbackSaving, setFeedbackSaving] = useState(null)
  const { data, loading, error, needsLogin, setNeedsLogin, load, setError } = useAdminFetch('/api/admin/stats', days)
  const loadFeedback = async () => {
    try { const response = await fetch(`/api/admin/feedback?status=${feedbackFilter}`, { credentials: 'include', headers: jsonHeaders() }); const body = await readJson(response); if (response.status === 401) return setNeedsLogin(true); if (!response.ok) throw new Error(body.error || '反馈加载失败'); setFeedback(body.feedback || []) } catch (reason) { setError(reason.message) }
  }
  useEffect(() => { if (!needsLogin) loadFeedback() }, [feedbackFilter, needsLogin])
  const saveFeedback = async (id, status, adminNote) => {
    setFeedbackSaving(id)
    try { const response = await fetch('/api/admin/feedback', { method: 'PATCH', credentials: 'include', headers: adminRequestHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id, status, adminNote }) }); const body = await readJson(response); if (!response.ok) throw new Error(body.error || '反馈保存失败'); await loadFeedback() } catch (reason) { setError(reason.message) } finally { setFeedbackSaving(null) }
  }
  const logoutAdmin = async () => { await fetch('/api/admin/logout', { method: 'POST', credentials: 'include', headers: jsonHeaders() }); setNeedsLogin(true) }
  const series = data?.series || [], maxViews = Math.max(1, ...series.map(row => Number(row.views || 0)))
  const summary = [['累计浏览量', data?.totals?.views, Eye, 'blue'], ['今日浏览量', data?.today?.views, Activity, 'purple'], ['累计设备用户', data?.totals?.visitors, Smartphone, 'green'], ['累计登录用户', data?.totals?.loggedInUsers, Users, 'cyan'], ['今日设备用户', data?.today?.visitors, Smartphone, 'teal'], ['今日登录用户', data?.today?.loggedInUsers, Users, 'indigo'], ['累计点击量', data?.totals?.clicks, MousePointerClick, 'orange'], ['今日点击量', data?.today?.clicks, MousePointerClick, 'red']]
  if (needsLogin) return <AdminLogin onSuccess={load}/>
  return <main className="admin-page"><header className="admin-header"><div><span><LayoutDashboard size={20}/>彩研通数据中心</span><h1>运营概览</h1><p>设备用户按匿名浏览器 ID 去重；登录用户按注册邮箱账户 ID 去重</p></div><div className="admin-header-actions"><button onClick={() => { load(); loadFeedback() }} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={17}/>刷新数据</button><button onClick={logoutAdmin}><LogOut size={17}/>退出</button></div></header><AdminNav active="overview"/><div className="admin-period">{[7, 30, 90].map(value => <button className={days === value ? 'active' : ''} onClick={() => setDays(value)} key={value}>近 {value} 天</button>)}</div>{error ? <section className="admin-auth-state"><ShieldCheck size={34}/><h2>数据加载失败</h2><p>{error}</p><button onClick={load}>重新加载</button></section> : <><div className="admin-summary">{summary.map(([label, value, Icon, color]) => <article className={color} key={label}><i><Icon size={19}/></i><span>{label}</span><b>{loading && !data ? '--' : adminNumber(value)}</b></article>)}</div><section className="admin-panel admin-trend"><header><div><h2>访问趋势</h2><p>每日页面浏览量</p></div><span>近 {days} 天</span></header><div className="admin-bars">{series.map(row => <div title={`${row.day}：${row.views || 0}次`} key={row.day}><i style={{ height: `${Math.max(4, Number(row.views || 0) / maxViews * 100)}%` }}/><small>{row.day.slice(5)}</small></div>)}</div></section><div className="admin-grid"><AdminList title="功能点击排行" rows={data?.events || []}/><AdminList title="页面浏览排行" rows={data?.pages || []}/><AdminList title="彩种使用排行" rows={data?.games || []}/><AdminList title="访问设备" rows={data?.devices || []}/></div><AdminFeedback rows={feedback} filter={feedbackFilter} setFilter={setFeedbackFilter} onSave={saveFeedback} saving={feedbackSaving}/><p className="admin-updated">数据生成于 {data?.generatedAt ? new Date(data.generatedAt).toLocaleString('zh-CN') : '--'}</p></>}</main>
}

createRoot(document.getElementById('root')).render(location.pathname.startsWith('/admin/activity') ? <AdminActivityPage/> : <AdminDashboard/>)
