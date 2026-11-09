import { parseOfficialWelfareNoticeHtml } from './ssqNotice.js'

const PROXY_ENDPOINT = 'https://lottery-official-data.cxu96175.workers.dev/lottery'
const SWLC_PAGES = Object.freeze({ fc3d: '3d', ssq: 'ssq', qlc: 'qlc', kl8: 'kl8' })
const KJH_ENDPOINT = 'https://www.00038.cn/kjh'
const KJH_BASE = 'https://www.00038.cn'
const KJH_PATHS = Object.freeze({ fc3d: '3d', ssq: 'ssq', dlt: 'dlt', pl3: 'p3', pl5: 'p5', qxc: 'qxc', qlc: 'qlc', kl8: 'kl8' })
const KJH_NAMES = Object.freeze({
  fc3d: '福彩3D', ssq: '双色球', dlt: '大乐透', pl3: '排列3', pl5: '排列5',
  qxc: '7星彩', qlc: '七乐彩', kl8: '快乐8'
})
const HUINIAO_TYPES = Object.freeze({ fc3d: 'fcsd', ssq: 'ssq', dlt: 'dlt', pl3: 'pls', pl5: 'plw' })
const WELFARE_ENDPOINT = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
const SPORTS_HISTORY_ENDPOINT = 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry'
const SPORTS_DIGITAL_ENDPOINT = 'https://webapi.sporttery.cn/gateway/lottery/getDigitalDrawInfoV1.qry'
const NUMBER_FIELDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']

export const LOTTERY_SOURCES = Object.freeze({
  fc3d: { name: '福彩3D', upstreamGame: 'fcsd', expected: 3, ranges: [[0, 9], [0, 9], [0, 9]], poolApplicable: false, provider: 'welfare', official: { endpoint: WELFARE_ENDPOINT, query: { name: '3d' }, authority: '中国福利彩票', site: 'https://www.cwl.gov.cn/' } },
  ssq: { name: '双色球', upstreamGame: 'ssq', expected: 7, ranges: [[1, 33], [1, 33], [1, 33], [1, 33], [1, 33], [1, 33], [1, 16]], provider: 'welfare', official: { endpoint: WELFARE_ENDPOINT, query: { name: 'ssq' }, authority: '中国福利彩票', site: 'https://www.cwl.gov.cn/' } },
  qlc: { name: '七乐彩', upstreamGame: 'qlc', expected: 8, ranges: [[1, 30], [1, 30], [1, 30], [1, 30], [1, 30], [1, 30], [1, 30], [1, 30]], provider: 'welfare', official: { endpoint: WELFARE_ENDPOINT, query: { name: 'qlc' }, authority: '中国福利彩票', site: 'https://www.cwl.gov.cn/' } },
  kl8: { name: '快乐8', upstreamGame: 'klb', expected: 20, ranges: Array.from({ length: 20 }, () => [1, 80]), poolApplicable: false, provider: 'welfare', official: { endpoint: WELFARE_ENDPOINT, query: { name: 'kl8' }, authority: '中国福利彩票', site: 'https://www.cwl.gov.cn/' } },
  dlt: { name: '大乐透', upstreamGame: 'dlt', expected: 7, ranges: [[1, 35], [1, 35], [1, 35], [1, 35], [1, 35], [1, 12], [1, 12]], provider: 'sports', official: { endpoint: SPORTS_HISTORY_ENDPOINT, query: { gameNo: '85', provinceId: '0', isVerify: '1' }, authority: '中国体育彩票', site: 'https://www.lottery.gov.cn/' }, regionalOfficial: { endpoint: 'https://api.js-lottery.com/wfzq/dlt/data', authority: '江苏省体育彩票管理中心' } },
  pl3: { name: '排列3', upstreamGame: 'pls', expected: 3, ranges: [[0, 9], [0, 9], [0, 9]], poolApplicable: false, provider: 'sports', official: { endpoint: SPORTS_HISTORY_ENDPOINT, query: { gameNo: '35', provinceId: '0', isVerify: '1' }, authority: '中国体育彩票', site: 'https://www.lottery.gov.cn/' }, regionalOfficial: { endpoint: 'https://api.js-lottery.com/wfzq/p3p5/p3data', authority: '江苏省体育彩票管理中心' } },
  pl5: { name: '排列5', upstreamGame: 'plw', expected: 5, ranges: [[0, 9], [0, 9], [0, 9], [0, 9], [0, 9]], poolApplicable: false, provider: 'sports', official: { endpoint: SPORTS_HISTORY_ENDPOINT, query: { gameNo: '350133', provinceId: '0', isVerify: '1' }, authority: '中国体育彩票', site: 'https://www.lottery.gov.cn/' }, regionalOfficial: { endpoint: 'https://api.js-lottery.com/wfzq/p3p5/p5data', authority: '江苏省体育彩票管理中心' } },
  qxc: { name: '7星彩', upstreamGame: 'qxc', expected: 7, ranges: [[0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 14]], provider: 'sports', official: { endpoint: SPORTS_DIGITAL_ENDPOINT, query: { param: '04,0', isVerify: '1' }, authority: '中国体育彩票', site: 'https://www.lottery.gov.cn/' }, regionalOfficial: { endpoint: 'https://www.gstc.org.cn/wanfa/qxc_history', authority: '甘肃省体育彩票管理中心' } }
})

const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
const isObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value))

function firstValue(row, keys) {
  if (!isObject(row)) return ''
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && ((Array.isArray(value) && value.length) || text(value))) return value
  }
  return ''
}

function numericValue(value) {
  const normalized = text(value).replace(/[\s,，￥¥]/g, '')
  if (!normalized || normalized === '--' || normalized === '-') return undefined
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined
  const number = Number(match[0])
  return Number.isFinite(number) ? number : undefined
}

function prizeLevel(value) {
  const normalized = text(value)
  if (!normalized) return ''
  const numeric = Number(normalized)
  const chineseLevels = ['', '一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖', '九等奖', '十等奖']
  if (Number.isInteger(numeric) && numeric >= 1 && numeric < chineseLevels.length) return chineseLevels[numeric]
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 20) return `第${numeric}级`
  return normalized.replace(/^第?\s*(一等奖|二等奖|三等奖|四等奖|五等奖|六等奖|七等奖|八等奖|九等奖|十等奖)\s*$/, '$1')
}

function prizeRowsFrom(row) {
  const list = firstValue(row, ['prizeRows', 'prizegrades', 'prizeGradeList', 'prizeLevelList', 'prizelevels'])
  if (!Array.isArray(list)) return []
  return list.map(entry => {
    const level = prizeLevel(firstValue(entry, ['level', 'prizeLevel', 'prizeLevelName', 'name', 'type']))
    const amount = numericValue(firstValue(entry, ['amount', 'singlePrizeAmount', 'typemoney', 'prizeAmount', 'prizeMoney', 'money']))
    const count = numericValue(firstValue(entry, ['count', 'totalPrizeCount', 'typenum', 'prizeCount', 'number']))
    const provinces = provinceText(firstValue(entry, ['provinces', 'province', 'winningProvince', 'winningProvinces', 'areaList', 'provinceList']))
    return { ...(level ? { level } : {}), ...(amount !== undefined ? { amount } : {}), ...(count !== undefined ? { count } : {}), ...(provinces ? { provinces } : {}) }
  }).filter(entry => entry.level || entry.amount !== undefined || entry.count !== undefined)
}

function provinceText(value) {
  const provinces = Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : firstValue(item, ['name', 'provinceName', 'areaName'])).filter(Boolean).join('、') : text(value)
  const normalized = provinces.replace(/^[\s:：,，。；;]+|[\s,，。；;]+$/g, '').slice(0,