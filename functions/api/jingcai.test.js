import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOfficialSp } from './jingcai.js'

const footballHtml = `<!doctype html><html><head><title>竞彩足球 - 大象比分</title></head><body>
  <nav><span>竞彩官方 SP 数据</span></nav>
  <table><tr class="football-preview-start football-preview-row"><td>周三001</td><td class="football-preview-sp"><button aria-label="周三001 主胜 1.50"><strong>1.50</strong></button></td><td class="football-preview-sp"><button aria-label="周三001 平 4.10"><strong>4.10</strong></button></td><td class="football-preview-sp"><button aria-label="周三001 客胜 4.60"><strong>4.60</strong></button></td></tr>
  <tr class="football-preview-row"><td>周三001</td><td class="football-preview-sp"><button aria-label="周三001 主胜 2.50"><strong>2.50</strong></button></td></tr></table>
</body></html>`

test('竞彩足球只解析标注行的胜平负 SP，不取让球行数值', () => {
  assert.deepEqual([...parseOfficialSp(footballHtml, 'football')], [[
    '周三001', { market: '胜平负', homeWin: '1.50', draw: '4.10', awayWin: '4.60' }
  ]])
})

test('竞彩篮球只解析胜负市场并按客队、主队映射', () => {
  const cells = Array.from({ length: 7 }, (_, index) => index === 5
    ? '<td class="football-preview-sp"><button aria-label="周三301 客胜 1.47"><strong>1.47</strong></button></td>'
    : index === 1
      ? '<td>周三301</td>'
      : index === 6
      ? '<td class="football-preview-sp"><button aria-label="周三301 主胜 2.01"><strong>2.01</strong></button></td>'
      : '<td>--</td>').join('')
  const html = `<html><body><span>竞彩官方 SP 数据</span><table><tr class="basketball-mixed-row">${cells}</tr></table></body></html>`
  assert.deepEqual([...parseOfficialSp(html, 'basketball')], [[
    '周三301', { market: '胜负', awayWin: '1.47', homeWin: '2.01' }
  ]])
})

test('页面没有明确标注官方 SP 时拒绝解析', () => {
  assert.throws(() => parseOfficialSp(footballHtml.replace('竞彩官方 SP 数据', '机构指数'), 'football'), /未明确标注/)
})
