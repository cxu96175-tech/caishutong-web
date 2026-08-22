import React from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function StatusStep({ x, y, width, height, payload }) {
  const color = payload.hit ? '#ff5964' : '#20b895'
  const barWidth = Math.max(3, Math.min(10, width * .62))
  return <rect x={x + (width - barWidth) / 2} y={y} width={barWidth} height={Math.max(2,height)} rx="1.5" fill={color}/>
}

function KlineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return <div className="kline-tooltip"><b>第 {row.issue} 期</b><span>开奖号：{row.numbers}</span><span>当期状态：{row.actual}</span><span>{row.hit ? '目标状态已出现' : `当前遗漏 ${row.omission} 期`}</span><span>当期变化：{row.change > 0 ? '+' : ''}{row.change}</span><span>趋势值：{row.close}</span></div>
}

function OmissionDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null
  const fill = payload.current ? '#55c9b0' : '#f3df55'
  return <g><circle cx={cx} cy={cy} r="9" fill={fill}/><text x={cx} y={cy + 3} textAnchor="middle" fill="#353535" fontSize="8" fontWeight="700">{payload.value}</text></g>
}

export default function KlineChart({ data, movingAverages, colors, metricLabel, target, averageOmission, maximumOmission, issueOptions, startIssue, endIssue, onStartIssueChange, onEndIssueChange }) {
  const latest = data.at(-1) || {}
  const omissionData = data.filter(row => row.hit).map(row => ({ issue:row.issue, value:row.hitOmission, numbers:row.numbers, actual:row.actual, hit:true, omission:row.hitOmission, close:row.close, change:row.change, current:false }))
  if (latest.issue && !latest.hit) omissionData.push({ issue:latest.issue, value:latest.omission, numbers:latest.numbers, actual:latest.actual, hit:false, omission:latest.omission, close:latest.close, change:latest.change, current:true })
  return <div className="status-trend-panel">
    <div className="status-trend-head"><b>{metricLabel}[{target}]的趋势</b><span>期号：<strong>{latest.issue || '--'}</strong></span><span>开奖号：<strong>{latest.numbers || '--'}</strong></span><span>指数：<em>{latest.close ?? '--'}</em></span></div>
    <section className="omission-trend-block"><h4>遗漏走势 <small>黄色：目标出现前的遗漏值</small></h4><div><ResponsiveContainer width="100%" height="100%"><ComposedChart data={omissionData} margin={{top:16,right:24,bottom:20,left:0}}><CartesianGrid stroke="#525252" vertical={false}/><XAxis dataKey="issue" hide/><YAxis tick={{fontSize:9,fill:'#bbb'}} width={36} domain={[0, value => Math.max(1,value + 2)]}/><Tooltip content={<KlineTooltip/>}/><ReferenceLine y={averageOmission} stroke="#3478f6" strokeWidth={1.2}/><ReferenceLine y={maximumOmission} stroke="#ff5964" strokeWidth={1.2}/><Line dataKey="value" type="linear" stroke="#f3df55" strokeWidth={2} dot={<OmissionDot/>} activeDot={false} isAnimationActive={false}/></ComposedChart></ResponsiveContainer></div></section>
    <div className="status-trend-subhead"><h4>趋势</h4><div className="status-trend-legend"><span><i className="hit"/>红色：当期出现（+3）</span></div></div>
    <div className="status-trend-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} barCategoryGap="0%" margin={{top:18,right:22,bottom:18,left:0}}><CartesianGrid stroke="#525252" vertical={false}/><XAxis dataKey="issue" hide/><YAxis tick={{fontSize:9,fill:'#bbb'}} width={36} domain={[value => value - 1, value => value + 1]}/><Tooltip content={<KlineTooltip/>}/><ReferenceLine y={latest.close ?? 0} stroke="#d7c94b" strokeWidth={1} label={{value:`指数 ${latest.close ?? 0}`,position:'insideTopLeft',fill:'#d7c94b',fontSize:9}}/><Bar dataKey="range" shape={<StatusStep/>} isAnimationActive={false}/>{movingAverages.ma5 && <Line dataKey="ma5" type="monotone" stroke={colors.ma5} dot={false} strokeWidth={1.35} connectNulls/>}{movingAverages.ma10 && <Line dataKey="ma10" type="monotone" stroke={colors.ma10} dot={false} strokeWidth={1.35} connectNulls/>}{movingAverages.ma20 && <Line dataKey="ma20" type="monotone" stroke={colors.ma20} dot={false} strokeWidth={1.35} connectNulls/>}</ComposedChart></ResponsiveContainer></div>
    <div className="status-trend-selectors"><label><span>起始期次</span><select value={startIssue} onChange={event => onStartIssueChange(event.target.value)}>{issueOptions.map(issue => <option value={issue} key={issue}>{issue}期</option>)}</select></label><label><span>截止期次</span><select value={endIssue} onChange={event => onEndIssueChange(event.target.value)}>{issueOptions.map(issue => <option value={issue} key={issue}>{issue}期</option>)}</select></label></div>
  </div>
}
