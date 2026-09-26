const UPSTREAM_API = 'https://lottery-official-data.cxu96175.workers.dev'
const isLocalPreview = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
export const API = isLocalPreview ? UPSTREAM_API : '/api'
const recordsCacheKey = 'caiyan-records-cache-v1'
// 首页缓存只用于首屏占位，不能让旧开奖数据长期成为最终结果。
const recordsCacheLifetime = 60 * 1000
const historyCacheLifetime = 60 * 1000
const historyCache = new Map()

// 福彩/体彩常规开奖集中在 21:15—21:25。开奖窗口内缩短客户端轮询间隔，
// 其他时间保持低频检查，避免把“用户打开页面才请求”当成同步机制。
export function isDrawSyncWindow(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  return minutes >= (20 * 60 + 50) && minutes <= (22 * 60 + 30)
}

export function drawSyncInterval(date = new Date()) {
  return isDrawSyncWindow(date) ? 60 * 1000 : 5 * 60 * 1000
}

export function readRecordsCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(recordsCacheKey) || 'null')
    if (!cached?.records?.length || Date.now() - Number(cached.savedAt || 0) > recordsCacheLifetime) return null
    return cached
  } catch { return null }
}

export function writeRecordsCache(records) {
  try { localStorage.setItem(recordsCacheKey, JSON.stringify({ records, savedAt:Date.now() })) } catch {}
}

export function shouldRefreshRecords(cached) {
  if (!cached?.records?.length || !cached?.savedAt) return true
  return Date.now() - Number(cached.savedAt) >= recordsCacheLifetime
}

export const games = {
  fc3d: { code: 'fcsd', name: '福彩3D', red: 3, blue: 0, time: '21:15', single: true, icon: '3D', liveUrl: 'https://www.zhcw.com/spzb/kjzb/fczb/', liveLabel: '福彩开奖直播' },
  ssq: { code: 'ssq', name: '双色球', red: 6, blue: 1, time: '21:15', icon: '双', liveUrl: 'https://www.zhcw.com/spzb/kjzb/fczb/', liveLabel: '福彩开奖直播' },
  dlt: { code: 'dlt', name: '大乐透', red: 5, blue: 2, time: '21:25', icon: '乐', liveUrl: 'https://m.lottery.gov.cn/kjzb/', liveLabel: '体彩开奖直播' },
  pl3: { code: 'pls', name: '排列3', red: 3, blue: 0, time: '21:25', single: true, icon: '排3', liveUrl: 'https://m.lottery.gov.cn/kjzb/', liveLabel: '体彩开奖直播' },
  pl5: { code: 'plw', name: '排列5', red: 5, blue: 0, time: '21:25', single: true, icon: '排5', liveUrl: 'https://m.lottery.gov.cn/kjzb/', liveLabel: '体彩开奖直播' },
  qxc: { code: 'qxc', name: '7星彩', red: 6, blue: 1, time: '21:25', single: true, icon: '7星', liveUrl: 'https://m.lottery.gov.cn/kjzb/', liveLabel: '体彩开奖直播' },
  qlc: { code: 'qlc', name: '七乐彩', red: 7, blue: 1, time: '21:15', icon: '七', liveUrl: 'https://www.zhcw.com/spzb/kjzb/fczb/', liveLabel: '福彩开奖直播' },
  kl8: { code: 'klb', name: '快乐8', red: 20, blue: 0, time: '21:15', icon: '快8', liveUrl: 'https://www.zhcw.com/spzb/kjzb/fczb/', liveLabel: '福彩开奖直播' }
}

export const gameOrder = ['fc3d', 'ssq', 'dlt', 'pl3', 'pl5', 'qxc', 'qlc', 'kl8']

export const rules = [
  { key: 'ssq', name: '双色球', hint: '6 个 01—33 红球 + 1 个 01—16 蓝球', groups: [{ min: 1, max: 33, count: 6 }, { min: 1, max: 16, count: 1, accent: true }] },
  { key: 'dlt', name: '大乐透', hint: '5 个 01—35 前区 + 2 个 01—12 后区', groups: [{ min: 1, max: 35, count: 5 }, { min: 1, max: 12, count: 2, accent: true }] },
  { key: 'fc3d', name: '福彩3D', hint: '3 位 0—9 数字', grouped: true, groups: [{ min: 0, max: 9, count: 3, repeatable: true }] },
  { key: 'kl8', name: '快乐8', hint: '每注选择 1—10 个 01—80 数字', pickCountOptions: Array.from({ length:10 }, (_, index) => index + 1), groups: [{ min: 1, max: 80, count: 10 }] },
  { key: 'pl3', name: '排列3', hint: '3 位 0—9 数字', grouped: true, groups: [{ min: 0, max: 9, count: 3, repeatable: true }] },
  { key: 'pl5', name: '排列5', hint: '5 位 0—9 数字，可重复', groups: [{ min: 0, max: 9, count: 5, repeatable: true }] },
  { key: 'qlc', name: '七乐彩', hint: '7 个 01—30 数字', groups: [{ min: 1, max: 30, count: 7 }] },
  { key: 'qxc', name: '7星彩', hint: '前 6 位 0—9 + 1 个 0—14 数字', groups: [{ min: 0, max: 9, count: 6, repeatable: true }, { min: 0, max: 14, count: 1, accent: true }] }
]

export const money = value => value == null ? '--' : value >= 1e8 ? `${(value / 1e8).toFixed(2)}亿元` : value >= 1e4 ? `${(value / 1e4).toFixed(1)}万元` : `${Number(value).toLocaleString()}元`
const pad = (v, min) => min === 0 ? String(v) : String(v).padStart(2, '0')
export function generate(rule, mode = 'direct') {
  if (rule.grouped && mode !== 'direct') {
    const pool = [...Array(10).keys()]
    if (mode === 'group3') { const a = pool.splice(Math.floor(Math.random() * 10), 1)[0]; const b = pool[Math.floor(Math.random() * 9)]; return [{ values: [a, a, b].sort().map(String) }] }
    return [{ values: pool.sort(() => Math.random() - .5).slice(0, 3).sort().map(String) }]
  }
  return rule.groups.map(g => {
    const pool = Array.from({ length: g.max - g.min + 1 }, (_, i) => pad(g.min + i, g.min))
    const values = []
    while (values.length < g.count) { const i = Math.floor(Math.random() * pool.length); values.push(g.repeatable ? pool[i] : pool.splice(i, 1)[0]) }
    if (!g.repeatable) values.sort((a, b) => +a - +b)
    return { values, accent: g.accent }
  })
}

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timer
  try {
    return await Promise.race([
      fetch(url, controller ? { signal: controller.signal } : undefined),
      new Promise((_, reject) => { timer = setTimeout(() => { controller?.abort(); reject(new Error('请求超时')) }, timeout) })
    ])
  } finally {
    clearTimeout(timer)
  }
}

function normalizeRecord(game, x) {
  const meta = games[game]
  const balls = (Array.isArray(x.numbers) ? x.numbers : String(x.numbers || '').split(/[\s,，+|]+/))
    .filter(value => value !== '' && value !== null && value !== undefined)
    .map(v => meta.single ? String(+v) : String(v).padStart(2, '0'))
  const first = x.firstPrize || (x.prizeRows || []).find(p => p.level === '一等奖')
  return { ...x, id: `${game}-${x.issue}`, game, name: meta.name, icon: meta.icon, drawTime: meta.time, redBalls: balls.slice(0, meta.red), blueBalls: balls.slice(meta.red, meta.red + meta.blue), firstPrizeText: first?.amount ? `单注${money(first.amount)}` : '--', saleAmountText: money(x.saleAmount), poolAmountText: x.poolApplicable === false ? '不适用' : money(x.poolAmount) }
}

async function fetchGameRecords(game, limit, { fresh = false } = {}) {
  const meta = games[game]
  const freshness = fresh ? `&fresh=${Math.floor(Date.now() / 60000)}` : ''
  // /api/lottery 使用前端彩种 key（fc3d/pl3/pl5/kl8），不要传给上游的
  // fcsd/pls/plw/klb 代码，否则这四个彩种会被接口判定为不支持。
  const res = await fetchWithTimeout(`${API}/lottery?game=${encodeURIComponent(game)}&limit=${limit}&v=18${freshness}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return (json.records || []).map(x => normalizeRecord(game, x))
}

function sortRecords(records) {
  return [...records].sort((a, b) => Number(b.issue) - Number(a.issue))
}

export function mergeRecords(current, archive) {
  const byIssue = new Map()
  // 动态开奖接口优先，避免归档源的旧记录覆盖最新数据。
  for (const record of [...current, ...archive]) {
    if (record?.issue && !byIssue.has(String(record.issue))) byIssue.set(String(record.issue), record)
  }
  return sortRecords([...byIssue.values()])
}

export async function fetchRecords(limit = 50) {
  const results = await Promise.allSettled(gameOrder.map(async game => {
    return fetchGameRecords(game, limit)
  }))
  const all = results.flatMap(x => x.status === 'fulfilled' ? x.value : [])
  if (!all.length) throw new Error('开奖数据暂时不可用')
  writeRecordsCache(all)
  return all
}

export async function fetchHistory(game) {
  const cached = historyCache.get(game)
  if (cached && Date.now() - cached.savedAt < historyCacheLifetime) return cached.promise
  const request = (async () => {
    // 历史页、走势图和详情统一读取服务端合并后的标准数据；官方源优先，
    // 归档只补旧期，避免各页面分别竞争不同数据源造成期号不一致。
    const res = await fetchWithTimeout(`/api/history?game=${encodeURIComponent(game)}&v=2`, 30000)
    if (!res.ok) throw new Error(`历史接口 HTTP ${res.status}`)
    const json = await res.json()
    const records = (json.records || []).map(x => normalizeRecord(game, x))
    if (!records.length) throw new Error('历史开奖数据为空')
    return records
  })()
  historyCache.set(game, { promise: request, savedAt: Date.now() })
  try { return await request } catch (error) { historyCache.delete(game); throw error }
}
