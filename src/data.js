const UPSTREAM_API = 'https://lottery-official-data.cxu96175.workers.dev'
const isLocalPreview = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
export const API = isLocalPreview ? UPSTREAM_API : '/api'

export const games = {
  fc3d: { code: 'fcsd', name: '福彩3D', red: 3, blue: 0, time: '21:15', single: true, icon: '3D' },
  ssq: { code: 'ssq', name: '双色球', red: 6, blue: 1, time: '21:15', icon: '双' },
  dlt: { code: 'dlt', name: '大乐透', red: 5, blue: 2, time: '21:25', icon: '乐' },
  pl3: { code: 'pls', name: '排列3', red: 3, blue: 0, time: '21:25', single: true, icon: '排3' },
  pl5: { code: 'plw', name: '排列5', red: 5, blue: 0, time: '21:25', single: true, icon: '排5' },
  qxc: { code: 'qxc', name: '7星彩', red: 6, blue: 1, time: '21:25', single: true, icon: '7星' },
  qlc: { code: 'qlc', name: '七乐彩', red: 7, blue: 1, time: '21:15', icon: '七' },
  kl8: { code: 'klb', name: '快乐8', red: 20, blue: 0, time: '21:15', icon: '快8' }
}

export const gameOrder = ['fc3d', 'ssq', 'dlt', 'pl3', 'pl5', 'qxc', 'qlc', 'kl8']

export const rules = [
  { key: 'ssq', name: '双色球', hint: '6 个 01—33 红球 + 1 个 01—16 蓝球', groups: [{ min: 1, max: 33, count: 6 }, { min: 1, max: 16, count: 1, accent: true }] },
  { key: 'dlt', name: '大乐透', hint: '5 个 01—35 前区 + 2 个 01—12 后区', groups: [{ min: 1, max: 35, count: 5 }, { min: 1, max: 12, count: 2, accent: true }] },
  { key: 'fc3d', name: '福彩3D', hint: '3 位 0—9 数字', grouped: true, groups: [{ min: 0, max: 9, count: 3, repeatable: true }] },
  { key: 'kl8', name: '快乐8', hint: '10 个 01—80 数字', groups: [{ min: 1, max: 80, count: 10 }] },
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

export async function fetchRecords(limit = 50) {
  const results = await Promise.allSettled(gameOrder.map(async game => {
    const meta = games[game]
    const res = await fetchWithTimeout(`${API}/lottery?game=${meta.code}&limit=${limit}&v=18`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return (json.records || []).map(x => {
      const balls = (Array.isArray(x.numbers) ? x.numbers : String(x.numbers || '').split(/[\s,，+|]+/)).filter(Boolean).map(v => meta.single ? String(+v) : String(v).padStart(2, '0'))
      const first = x.firstPrize || (x.prizeRows || []).find(p => p.level === '一等奖')
      return { ...x, id: `${game}-${x.issue}`, game, name: meta.name, icon: meta.icon, drawTime: meta.time, redBalls: balls.slice(0, meta.red), blueBalls: balls.slice(meta.red, meta.red + meta.blue), firstPrizeText: first?.amount ? `单注${money(first.amount)}` : '--', saleAmountText: money(x.saleAmount), poolAmountText: x.poolApplicable === false ? '不适用' : money(x.poolAmount) }
    })
  }))
  const all = results.flatMap(x => x.status === 'fulfilled' ? x.value : [])
  if (!all.length) throw new Error('开奖数据暂时不可用')
  return all
}
