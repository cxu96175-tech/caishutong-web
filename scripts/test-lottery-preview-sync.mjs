import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { enrichLatestSnapshot, readLatestSnapshot, saveLatestSnapshot } from '../functions/_lib/lotterySnapshot.js'
import { LOTTERY_SOURCES, mergeMissingDrawMetadata, parseKjhDetail, parseOfficialSportsHistoryHtml, parseShanghaiFc3dHistoryHtml, fetchOfficial } from '../functions/_lib/lotterySources.js'
import { parseOfficialSsqNoticeHtml, parseOfficialWelfareNoticeHtml } from '../functions/_lib/ssqNotice.js'
import { onRequestGet as getLottery } from '../functions/api/lottery.js'
import lotterySyncWorker, { isExpectedGithubSubject, synchronize } from '../worker-lottery-sync/index.js'

assert.equal(isExpectedGithubSubject('repo:cxu96175-tech/caishutong-web:ref:refs/heads/main'), true)
assert.equal(isExpectedGithubSubject('repo:cxu96175-tech@310116318/caishutong-web@1324034095:ref:refs/heads/main'), true)
assert.equal(isExpectedGithubSubject('repo:another-account/caishutong-web:ref:refs/heads/main'), false)
assert.equal(isExpectedGithubSubject('repo:cxu96175-tech@310116318/other-repo@1324034095:ref:refs/heads/main'), false)
assert.deepEqual(parseOfficialSsqNoticeHtml('<table><tr><td>2026127</td><td>2026-11-05(四)</td><td><span>13</span>14 19 25 29 32</td><td>12</td></tr></table>'), {
  issue: '2026127', drawDate: '2026-11-05', numbers: [13, 14, 19, 25, 29, 32, 12]
})
assert.equal(parseOfficialSsqNoticeHtml('<tr><td>2026127</td><td>2026-11-05</td><td>131419252932</td><td>99</td></tr>'), null)
assert.deepEqual(parseOfficialWelfareNoticeHtml('<table><tr><td>2026297</td><td>2026-11-07(六)</td><td><span><i>1</i><i>2</i><i>3</i></span></td><td>1,937,630.00</td><td>887</td></tr></table>', 'fc3d'), [],
  '3D must not accept a regional HTML sales field; use the nationwide CWL API')
assert.deepEqual(parseShanghaiFc3dHistoryHtml('<table><tr><td>2026298</td><td>2026-11-08(日)</td><td><span><i>0</i><i>8</i><i>5</i></span></td><td>1,923,580.00</td><td>400</td></tr></table>'), [
  { issue: '2026298', drawDate: '2026-11-08', numbers: [0, 8, 5] }
], 'regional official 3D fallback confirms only issue, date and nationwide draw digits, never Shanghai sales')
assert.deepEqual(parseShanghaiFc3dHistoryHtml('<tr><td>2026298</td><td>2026-11-08</td><td>123</td></tr>'), [],
  'reject malformed regional rows instead of guessing draw digits')
assert.deepEqual(parseOfficialWelfareNoticeHtml('<tr><td>2026297</td><td>2026-11-07(六)</td><td><span><i>02</i><i>05</i><i>11</i><i>13</i><i>17</i><i>23</i><i>25</i><i>36</i><i>41</i><i>42</i><i>43</i><i>45</i><i>48</i><i>49</i><i>50</i><i>58</i><i>66</i><i>72</i><i>76</i><i>79</i></span></td><td>110,153,248.00</td></tr>', 'kl8')[0], {
  issue: '2026297', drawDate: '2026-11-07', numbers: [2, 5, 11, 13, 17, 23, 25, 36, 41, 42, 43, 45, 48, 49, 50, 58, 66, 72, 76, 79], saleAmount: 110153248, poolApplicable: false
})
assert.deepEqual(parseOfficialWelfareNoticeHtml('<tr><td>2026128</td><td>2026-11-06(五)</td><td><span><i>04</i><i>09</i><i>10</i><i>23</i><i>26</i><i>29</i><i>30</i></span></td><td><span><i>21</i></span></td><td>3,469,812.00</td><td>1</td><td>787,859.00</td><td>5</td><td>22,510.00</td><td>157</td><td>1,433.00</td><td>0.00</td></tr>', 'qlc')[0], {
  issue: '2026128', drawDate: '2026-11-06', numbers: [4, 9, 10, 23, 26, 29, 30, 21], saleAmount: 3469812,
  poolApplicable: true, poolAmount: 0, firstPrize: { level: '一等奖', count: 1, amount: 787859 }
})
assert.deepEqual(parseKjhDetail('<div>一等奖中奖情况：天津1注，河北1注，共2注。</div><table><tr><td>一等奖</td><td>10000000元</td><td>2</td></tr></table>', 'ssq'), {
  firstPrize: { level: '一等奖', amount: 10000000, count: 2, provinces: '天津1注，河北1注' },
  prizeRows: [{ level: '一等奖', amount: 10000000, count: 2, provinces: '天津1注，河北1注' }]
})
assert.deepEqual(mergeMissingDrawMetadata({ firstPrize: { level: '一等奖', amount: 5 } }, {
  firstPrize: { count: 3, provinces: '上海3注' }
}).firstPrize, { level: '一等奖', amount: 5, count: 3, provinces: '上海3注' })

const officialSportsFixtures = {
  dlt: '<table><tr><th>日期</th><th>期号</th><th>开奖号码</th></tr><tr><td>2026-11-07</td><td>26127</td><td>05 06 17 18 27 03 12</td><td><a>详细</a></td></tr></table>',
  pl3: '<table><tr><td>2026-11-07</td><td>26297</td><td>7 7 7</td><td>详细</td></tr></table>',
  pl5: '<table><tr><td>2026-11-07</td><td>26297</td><td>7 7 7 8 7</td><td>详细</td></tr></table>',
  qxc: '<table><tr><td>2026-11-06</td><td>26127</td><td>5 1 3 7 4 8 8</td></tr></table>'
}
assert.deepEqual(parseOfficialSportsHistoryHtml(officialSportsFixtures.dlt, 'dlt')[0], {
  issue: '26127', drawDate: '2026-11-07', numbers: [5, 6, 17, 18, 27, 3, 12]
})
assert.deepEqual(parseOfficialSportsHistoryHtml(officialSportsFixtures.pl3, 'pl3')[0].numbers, [7, 7, 7])
assert.deepEqual(parseOfficialSportsHistoryHtml(officialSportsFixtures.pl5, 'pl5')[0].numbers, [7, 7, 7, 8, 7])
assert.deepEqual(parseOfficialSportsHistoryHtml(officialSportsFixtures.qxc, 'qxc')[0].numbers, [5, 1, 3, 7, 4, 8, 8])
assert.equal(parseOfficialSportsHistoryHtml('<tr><td>2026-11-07</td><td>26297</td><td>36 06 17</td></tr>', 'pl3').length, 0)

const originalOfficialFetch = globalThis.fetch
try {
  const requested = []
  globalThis.fetch = async url => {
    requested.push(String(url))
    return new Response(JSON.stringify({ state: 0, '结果': [{
      '名称': '3D', '代码': '2026297', 'date': '2026-11-07(六)', 'red': '1,2,3', 'sales': '96507570'
    }] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const nationalFc3d = await fetchOfficial('fc3d', 1)
  assert.equal(nationalFc3d.records[0].issue, '2026297')
  assert.equal(nationalFc3d.records[0].saleAmount, 96507570, '福彩3D销量 must use national sales, not Shanghai regional sales')
  assert.equal(requested.length, 1, '福彩3D should use the national welfare API directly')

  for (const game of ['dlt', 'pl3', 'pl5', 'qxc']) {
    const requested = []
    globalThis.fetch = async url => {
      requested.push(String(url))
      if (String(url).includes('sporttery.cn')) throw new Error('primary source unavailable')
      return new Response(officialSportsFixtures[game], { status: 200, headers: { 'content-type': 'text/html' } })
    }
    const upstream = await fetchOfficial(game, 1)
    assert.equal(upstream.verified, true, `${game} regional fallback remains an official source`)
    assert.equal(upstream.sourceType, 'official')
    assert.equal(upstream.fallback, true)
    assert.equal(upstream.records[0].issue, game === 'dlt' || game === 'qxc' ? '26127' : '26297')
    assert.equal(requested.length, 2, `${game} first tries the national API, then official regional HTML`)
  }
} finally {
  globalThis.fetch = originalOfficialFetch
}

const date = new Date('2026-10-30T13:00:00.000Z')
const sqlite = new DatabaseSync(':memory:')
sqlite.exec(readFileSync(new URL('../migrations/0005_lottery_latest.sql', import