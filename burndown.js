// burndown.js — Single-file Epic Burndown dashboard
//
// Setup:
//   1. Edit the CONFIG block below
//   2. node burndown.js
//   3. Browse to http://localhost:3000
//
// Requires Node 18+ (uses built-in fetch).

import { createServer } from 'node:http';

// ============================================================
// CONFIG — edit these
// ============================================================

const JIRA_BASE  = 'https://gopuff.atlassian.net'
const JIRA_EMAIL = process.env.JIRA_EMAIL
// id.atlassian.com → Manage account → Security → API tokens
const JIRA_TOKEN = process.env.JIRA_API_TOKEN

const EPICS = [
  'COP-3269',
  'COP-3251',
  'COP-3012',
  'COP-2979',
  'COP-3192',
]

const SP_FIELD = "timeoriginalestimate"

// Service-parity matrix view — set PARITY_EPIC to the relevant epic key (must also be in EPICS)
const PARITY_EPIC = 'COP-3012'

// Jira component name → service row label (multiple components can share a row)
const PARITY_SVC_MAP = {
  'Coupons Core':    'gocoupons',
  'Gocart Core':     'gocart',
  'GoCash Core':     'gocash',
  'Invoice Core':    'checkout-invoice',
  'KYC/Fraud':             'fraud',
  'Order Ledger Core':     'order-ledger',
  'Order Submission Core': 'order-submission',
  'Validation Core':       'checkout-validation',
}

// Jira label → service row label (fallback for cross-project tickets that can't use components)
// Add one of these labels to FIN/other-project issues to place them in the matrix
const PARITY_SVC_LABEL_MAP = {
  'Payment_service': 'gopay',
  'Tax': 'gotax',
}

// Jira label → module column label; insertion order = column order
const PARITY_MOD_MAP = {
  'micronaut': 'Micronaut',
  'http':      'HTTP',
  'metrics':   'Telemetry',
  'GraphQL':   'GraphQL',
  'security':  'Security',
}

// service name → array of module label keys that are not applicable for that service
const PARITY_NA = {
  'order-ledger': ['micronaut'],
  'fraud': ['micronaut'],
  'gopay': ['micronaut'],
}

const PORT = 3000

// ============================================================

const auth = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");

const jget = async (path) => {
  const r = await fetch(`${JIRA_BASE}${path}`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  if (!r.ok) {
    const body = (await r.text()).slice(0, 300);
    throw new Error(`${r.status} ${path}: ${body}`);
  }
  return r.json();
};

const day = (s) => (s ? s.slice(0, 10) : null);

const fetchEpic = async (key) => {
  const [meta, kids] = await Promise.all([
    jget(`/rest/api/3/issue/${key}?fields=summary,status,created,duedate`),
    jget(
      `/rest/api/3/search/jql?` +
        new URLSearchParams({
          jql: `parent = ${key}`,
          fields: `summary,status,resolutiondate,${SP_FIELD},labels,components`,
          maxResults: "100",
        })
    ),
  ]);

  return {
    key,
    summary: meta.fields.summary,
    status: meta.fields.status.name,
    created: day(meta.fields.created),
    duedate: day(meta.fields.duedate),
    issues: (kids.issues || []).map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name,
      points: typeof i.fields[SP_FIELD] === "number" ? i.fields[SP_FIELD] / 3600 : null,
      resolutiondate: day(i.fields.resolutiondate),
      labels: i.fields.labels || [],
      components: (i.fields.components || []).map((c) => c.name),
    })),
  };
};

// ============================================================
// Embedded HTML — React + Recharts via CDN, JSX via Babel standalone
// ============================================================

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Epic Burndown</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500;600&family=Geist:wght@400;500;600&display=swap" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1",
      "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1",
      "recharts": "https://esm.sh/recharts@2.12.7?deps=react@18.3.1,react-dom@18.3.1"
    }
  }
  </script>
  <script src="https://unpkg.com/@babel/standalone@7.25.6/babel.min.js"></script>
  <style>
    body { background: #0c0c0d; margin: 0; color: #e8e8e8; font-family: "Geist", system-ui, sans-serif; }
    .truncate-fade { -webkit-mask-image: linear-gradient(to right, black 80%, transparent 100%); mask-image: linear-gradient(to right, black 80%, transparent 100%); }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel" data-type="module" data-presets="react">
    import React, { useState, useEffect } from "react";
    import { createRoot } from "react-dom/client";
    import {
      LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
    } from "recharts";

    // ---------- helpers ----------

    const fmtDate = (iso) => {
      if (!iso) return null;
      const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const fmt1 = (n) => Math.round(n * 10) / 10;

    const pointsOf = (i) => (typeof i.points === "number" ? i.points : 1);

    const HOURS_PER_WEEK = 30;

    const EPIC_COLORS = ["#fbbf24", "#22d3ee", "#a78bfa", "#34d399", "#fb7185"];

    const jiraUrl = (key) => "${JIRA_BASE}/browse/" + key;

    const PARITY_EPIC          = "${PARITY_EPIC}";
    const PARITY_SVC_MAP       = ${JSON.stringify(PARITY_SVC_MAP)};
    const PARITY_SVC_LABEL_MAP = ${JSON.stringify(PARITY_SVC_LABEL_MAP)};
    const PARITY_MOD_MAP       = ${JSON.stringify(PARITY_MOD_MAP)};
    const PARITY_NA            = ${JSON.stringify(PARITY_NA)};

    const remainingHours = (epic) =>
      (epic.issues || [])
        .filter((i) => !i.resolutiondate)
        .reduce((s, i) => s + (typeof i.points === "number" ? i.points : 1), 0);

    const computeBurndown = (epic) => {
      const issues = epic.issues || [];
      const totalPoints = issues.reduce((s, i) => s + pointsOf(i), 0);

      const created = new Date(epic.created + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const projEnd = epic.projectedEnd ? new Date(epic.projectedEnd + "T00:00:00") : null;
      const endDate = projEnd && projEnd > today ? projEnd : today;

      const resolved = issues
        .filter((i) => i.resolutiondate)
        .map((i) => ({ date: new Date(i.resolutiondate + "T00:00:00"), points: pointsOf(i) }))
        .sort((a, b) => a.date - b.date);

      const idealEndDate = projEnd || today;
      const totalIdealDays = Math.max(1, Math.round((idealEndDate - created) / 86400000));
      const days = Math.max(1, Math.round((endDate - created) / 86400000));
      const step = Math.max(1, Math.ceil(days / 120));
      const todayStr = today.toISOString().slice(0, 10);

      const series = [];
      let remaining = totalPoints;
      let ri = 0;
      for (let d = 0; d <= days; d += step) {
        const dt = new Date(created.getTime() + d * 86400000);
        while (ri < resolved.length && resolved[ri].date <= dt) {
          remaining -= resolved[ri].points;
          ri++;
        }
        const ideal = Math.max(0, totalPoints * (1 - d / totalIdealDays));
        const isPast = dt <= today;
        series.push({
          date: dt.toISOString().slice(0, 10),
          label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          actual: isPast ? Math.max(0, remaining) : null,
          ideal,
        });
      }

      if (!series.some((pt) => pt.date === todayStr)) {
        const resolvedByToday = issues
          .filter((i) => i.resolutiondate)
          .reduce((s, i) => {
            const d = new Date(i.resolutiondate + "T00:00:00");
            return d <= today ? s + pointsOf(i) : s;
          }, 0);
        const todayDays = Math.round((today - created) / 86400000);
        const todayPt = {
          date: todayStr,
          label: today.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          actual: Math.max(0, totalPoints - resolvedByToday),
          ideal: Math.max(0, totalPoints * (1 - todayDays / totalIdealDays)),
        };
        const insertIdx = series.findIndex((pt) => pt.date > todayStr);
        if (insertIdx === -1) series.push(todayPt);
        else series.splice(insertIdx, 0, todayPt);
      }

      const completedPoints = totalPoints - Math.max(0, remaining);
      const pctComplete = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

      return {
        series,
        totalPoints,
        remaining: Math.max(0, remaining),
        completedPoints,
        pctComplete,
        issueCount: issues.length,
        doneCount: issues.filter((i) => i.resolutiondate).length,
      };
    };

    const buildCombinedSeries = (pairs) => {
      const map = new Map();
      for (const { epic, bd } of pairs) {
        for (const pt of bd.series) {
          if (!map.has(pt.date)) map.set(pt.date, { date: pt.date, label: pt.label });
          if (pt.actual !== null) map.get(pt.date)[epic.key] = pt.actual;
        }
      }
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    };

    // ---------- subcomponents ----------

    const StatusPill = ({ status }) => {
      const s = (status || "").toLowerCase();
      let color = "bg-neutral-800 text-neutral-400 border-neutral-700";
      if (s.includes("progress") || s.includes("review"))
        color = "bg-amber-950/40 text-amber-300 border-amber-900/60";
      else if (s.includes("done") || s.includes("closed") || s.includes("resolved"))
        color = "bg-emerald-950/40 text-emerald-300 border-emerald-900/60";
      else if (s.includes("block"))
        color = "bg-rose-950/40 text-rose-300 border-rose-900/60";
      return (
        <span
          className={"shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-widest border " + color}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {status}
        </span>
      );
    };

    function CombinedChart({ pairs, activeEpic }) {
      const series = buildCombinedSeries(pairs);
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 10, right: 28, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#1f1f23" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" stroke="#52525b" fontSize={10}
              tick={{ fontFamily: "JetBrains Mono, monospace" }}
              interval="preserveStartEnd" minTickGap={60} />
            <YAxis stroke="#52525b" fontSize={10}
              tick={{ fontFamily: "JetBrains Mono, monospace" }}
              allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0c0c0d", border: "1px solid #2a2a2e",
                fontFamily: "JetBrains Mono, monospace", fontSize: "11px" }}
              labelStyle={{ color: "#a3a3a3" }}
              formatter={(v, name) => [
                v !== null && v !== undefined ? fmt1(v) + "h" : "—",
                name,
              ]}
            />
            {pairs.map(({ epic }, i) => {
              const color = EPIC_COLORS[i % EPIC_COLORS.length];
              const highlighted = activeEpic === null || activeEpic === epic.key;
              return (
                <Line key={epic.key} type="stepAfter" dataKey={epic.key}
                  stroke={color}
                  strokeWidth={activeEpic === epic.key ? 2.5 : 1.5}
                  strokeOpacity={highlighted ? 1 : 0.12}
                  dot={false} connectNulls={true} name={epic.key}
                  isAnimationActive={false} />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    function EpicStatsRow({ epic, bd, color, isActive, isAnyActive, onClick }) {
      const dimmed = isAnyActive && !isActive;
      return (
        <div
          onClick={onClick}
          className="relative px-6 py-4 border-b border-neutral-900 cursor-pointer select-none transition-all"
          style={{ opacity: dimmed ? 0.28 : 1, backgroundColor: isActive ? "rgba(255,255,255,0.03)" : "transparent" }}
        >
          <div className="absolute left-0 inset-y-0 w-0.5 transition-colors"
            style={{ backgroundColor: isActive ? color : "transparent" }} />

          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0 transition-colors"
              style={{ backgroundColor: isActive ? color : "#3f3f46" }} />
            <a href={jiraUrl(epic.key)} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
              className="text-xs text-neutral-400 hover:text-amber-400 shrink-0 w-[5.5rem] transition-colors">
              {epic.key}
            </a>
            <StatusPill status={epic.status} />
            <span style={{ fontFamily: '"Newsreader", serif' }}
              className="flex-1 text-sm text-neutral-200 truncate min-w-0 overflow-hidden whitespace-nowrap">
              {epic.summary}
            </span>
            <div className="flex items-center gap-5 shrink-0 text-xs"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              <span className="text-neutral-600 hidden sm:inline">
                <span className="text-neutral-300">{bd.doneCount}</span>
                {"/" + bd.issueCount + " issues"}
              </span>
              <span className="text-neutral-600 whitespace-nowrap">
                <span className="text-neutral-300">{Math.round(bd.completedPoints)}</span>
                {"/" + Math.round(bd.totalPoints) + "h"}
              </span>
              <span className="w-8 text-right tabular-nums" style={{ color: isActive ? color : "#a3a3a3" }}>
                {bd.pctComplete + "%"}
              </span>
              <span className="text-neutral-400 w-20 text-right tabular-nums whitespace-nowrap">
                {fmt1(bd.remaining) + "h left"}
              </span>
              <span className="text-neutral-600 w-20 text-right hidden md:inline">
                {epic.projectedEnd ? "proj " + fmtDate(epic.projectedEnd) : ""}
              </span>
            </div>
          </div>

          <div className="mt-2.5 ml-5 h-px bg-neutral-800">
            <div className="h-full transition-all duration-300"
              style={{ width: bd.pctComplete + "%", backgroundColor: color, opacity: isActive ? 0.7 : 0.35 }} />
          </div>
        </div>
      );
    }

    const buildParityMatrix = (epic) => {
      const cells = {};
      for (const issue of epic.issues || []) {
        const compName = (issue.components || []).find((c) => PARITY_SVC_MAP[c] !== undefined);
        const svc = compName !== undefined
          ? PARITY_SVC_MAP[compName]
          : (issue.labels || []).map((l) => PARITY_SVC_LABEL_MAP[l]).find((s) => s !== undefined);
        if (!svc) continue;
        const modLabel = (issue.labels || []).find((l) => PARITY_MOD_MAP[l] !== undefined);
        if (!modLabel) continue;
        if (!cells[svc]) cells[svc] = {};
        cells[svc][modLabel] = issue;
      }
      // Service row order: PARITY_SVC_MAP values first, then any new ones from PARITY_SVC_LABEL_MAP
      const seen = new Set();
      const services = [];
      for (const svc of [...Object.values(PARITY_SVC_MAP), ...Object.values(PARITY_SVC_LABEL_MAP)]) {
        if (!seen.has(svc)) { seen.add(svc); services.push(svc); }
      }
      return { services, modules: Object.keys(PARITY_MOD_MAP), cells };
    };

    function ParityMatrix({ epic }) {
      const { services, modules, cells } = buildParityMatrix(epic);

      if (services.length === 0) {
        return (
          <div className="px-6 py-6 text-center text-neutral-700 text-xs italic"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            no matrix data — assign issues to a mapped component and add a mapped label
          </div>
        );
      }

      const doneCount = services.reduce((s, svc) =>
        s + modules.filter((m) => !(PARITY_NA[svc] || []).includes(m) && cells[svc]?.[m]?.resolutiondate).length, 0);
      const total = services.reduce((s, svc) =>
        s + modules.filter((m) => !(PARITY_NA[svc] || []).includes(m)).length, 0);

      return (
        <div>
          <div className="px-6 py-3 border-b border-neutral-900 flex items-center justify-between">
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}
              className="text-[10px] uppercase tracking-[0.25em] text-neutral-600">
              service parity matrix
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}
              className="text-[11px] text-neutral-600">
              <span className="text-emerald-400">{doneCount}</span>
              {"/" + total + " done"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              <thead>
                <tr className="border-b border-neutral-900">
                  <th className="text-left px-6 py-2.5 text-[10px] uppercase tracking-widest text-neutral-600 font-normal">
                    service
                  </th>
                  {modules.map((m) => (
                    <th key={m} className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-neutral-600 font-normal text-center whitespace-nowrap">
                      {PARITY_MOD_MAP[m] || m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {services.map((svc, si) => {
                  const naSet = new Set(PARITY_NA[svc] || []);
                  const applicable = modules.filter((m) => !naSet.has(m));
                  const svcDone = applicable.filter((m) => cells[svc]?.[m]?.resolutiondate).length;
                  const svcTotal = applicable.length;
                  return (
                    <tr key={svc} className={"border-b border-neutral-900/50 transition-colors hover:bg-neutral-900/20 " + (si % 2 === 1 ? "bg-neutral-950/30" : "")}>
                      <td className="px-6 py-2 text-xs text-neutral-300 whitespace-nowrap">
                        <div>{svc}</div>
                        <div className="text-neutral-700 text-[10px] mt-0.5 tabular-nums">
                          {svcDone + "/" + svcTotal}
                        </div>
                      </td>
                      {modules.map((mod) => {
                        if (naSet.has(mod)) {
                          return (
                            <td key={mod} className="px-4 py-2 text-center text-neutral-800 text-[10px] uppercase tracking-wider">n/a</td>
                          );
                        }
                        const issue = cells[svc]?.[mod];
                        if (!issue) {
                          return (
                            <td key={mod} className="px-4 py-2 text-center text-neutral-800 text-xs">—</td>
                          );
                        }
                        if (issue.resolutiondate) {
                          return (
                            <td key={mod} className="px-4 py-2 text-center">
                              <span className="inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wider bg-emerald-950/50 text-emerald-400 border border-emerald-900/50">
                                done
                              </span>
                            </td>
                          );
                        }
                        const inProg = issue.status.toLowerCase().includes("progress") || issue.status.toLowerCase().includes("review");
                        return (
                          <td key={mod} className="px-4 py-2 text-center">
                            <a href={jiraUrl(issue.key)} target="_blank" rel="noopener noreferrer"
                              className={"text-[11px] transition-colors hover:underline " + (inProg ? "text-amber-400" : "text-neutral-500")}>
                              {issue.key}
                            </a>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    function TicketPanel({ pairs, activeTab, onTabChange }) {
      const pair = pairs.find((p) => p.epic.key === activeTab) || pairs[0];
      if (!pair) return null;
      const { epic } = pair;

      const issues = [...(epic.issues || [])].sort((a, b) => {
        const w = (i) => {
          if (i.resolutiondate) return 2;
          const s = i.status.toLowerCase();
          if (s.includes("progress") || s.includes("review")) return 0;
          return 1;
        };
        return w(a) - w(b);
      });

      return (
        <div className="border border-neutral-800">
          <div className="flex border-b border-neutral-800 overflow-x-auto">
            {pairs.map(({ epic: e }, i) => {
              const color = EPIC_COLORS[i % EPIC_COLORS.length];
              const isActive = e.key === activeTab;
              return (
                <button key={e.key} onClick={() => onTabChange(e.key)}
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  className={"px-4 py-3 text-xs tracking-wider whitespace-nowrap transition-colors border-r border-neutral-800 flex items-center gap-2 " + (isActive ? "bg-neutral-900/60 text-neutral-100" : "text-neutral-600 hover:text-neutral-400 hover:bg-neutral-900/20")}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                    style={{ backgroundColor: isActive ? color : "#3f3f46" }} />
                  {e.key}
                </button>
              );
            })}
            <div className="flex-1 border-b border-transparent" />
          </div>

          {PARITY_EPIC && epic.key === PARITY_EPIC && (
            <div className="border-b border-neutral-800">
              <ParityMatrix epic={epic} />
            </div>
          )}

          <div className="divide-y divide-neutral-900/60">
            {issues.length === 0 ? (
              <p className="px-6 py-8 text-center text-neutral-700 text-sm"
                style={{ fontFamily: '"JetBrains Mono", monospace', fontStyle: "italic" }}>
                no issues
              </p>
            ) : issues.map((issue) => {
              const done = !!issue.resolutiondate;
              return (
                <div key={issue.key}
                  className={"px-6 py-2.5 flex items-center gap-4 transition-colors " + (done ? "opacity-35" : "hover:bg-neutral-900/20")}>
                  <a href={jiraUrl(issue.key)} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    className="text-xs text-amber-400/60 hover:text-amber-400 shrink-0 w-[5.5rem] transition-colors">
                    {issue.key}
                  </a>
                  <StatusPill status={issue.status} />
                  <span style={{ fontFamily: '"Newsreader", serif' }}
                    className={"flex-1 text-sm truncate min-w-0 " + (done ? "line-through text-neutral-600" : "text-neutral-300")}>
                    {issue.summary}
                  </span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    className="text-xs text-neutral-600 shrink-0 w-10 text-right tabular-nums">
                    {issue.points !== null ? fmt1(issue.points) + "h" : "—"}
                  </span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    className="text-xs text-neutral-700 shrink-0 w-16 text-right">
                    {issue.resolutiondate ? fmtDate(issue.resolutiondate) : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-3 border-t border-neutral-900 flex items-center justify-between"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <span className="text-[11px] text-neutral-600">
              {pair.bd.doneCount + " of " + pair.bd.issueCount + " resolved"}
            </span>
            <span className="text-[11px] text-neutral-600">
              {fmt1(pair.bd.completedPoints) + " / " + fmt1(pair.bd.totalPoints) + "h complete"}
            </span>
          </div>
        </div>
      );
    }

    // ---------- main ----------

    function EpicBurndown() {
      const [data, setData] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [lastUpdated, setLastUpdated] = useState(null);
      const [activeEpic, setActiveEpic] = useState(null);
      const [activeTab, setActiveTab] = useState(null);

      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const r = await fetch("/api/burndown");
          if (!r.ok) {
            const t = await r.text();
            throw new Error("HTTP " + r.status + ": " + t.slice(0, 400));
          }
          const parsed = await r.json();
          if (!parsed.epics) throw new Error("Response missing 'epics'");
          let cursor = new Date();
          cursor.setHours(0, 0, 0, 0);
          for (const epic of parsed.epics) {
            const days = Math.ceil((remainingHours(epic) / HOURS_PER_WEEK) * 7);
            cursor = new Date(cursor.getTime() + days * 86400000);
            epic.projectedEnd = cursor.toISOString().slice(0, 10);
          }
          setData(parsed);
          setLastUpdated(new Date());
        } catch (e) {
          console.error(e);
          setError(e.message || String(e));
        } finally {
          setLoading(false);
        }
      };

      useEffect(() => { fetchData(); }, []);

      const pairs = data ? data.epics.map((epic) => ({ epic, bd: computeBurndown(epic) })) : [];

      useEffect(() => {
        if (data && data.epics.length > 0 && !activeTab) {
          setActiveTab(data.epics[0].key);
        }
      }, [data]);

      const totalRemaining = pairs.reduce((s, { bd }) => s + bd.remaining, 0);
      const totalPoints = pairs.reduce((s, { bd }) => s + bd.totalPoints, 0);
      const totalDone = pairs.reduce((s, { bd }) => s + bd.doneCount, 0);
      const totalIssues = pairs.reduce((s, { bd }) => s + bd.issueCount, 0);

      const handleRowClick = (key) => {
        const next = activeEpic === key ? null : key;
        setActiveEpic(next);
        if (next) setActiveTab(next);
      };

      const handleTabChange = (key) => {
        setActiveTab(key);
        setActiveEpic(key);
      };

      return (
        <div style={{ minHeight: "100vh" }}>
          <div className="max-w-6xl mx-auto px-6 py-12">
            <header className="mb-10 flex items-end justify-between gap-4 border-b border-neutral-800 pb-8">
              <div>
                <p style={{ fontFamily: '"JetBrains Mono", monospace' }}
                   className="text-[11px] text-neutral-500 tracking-[0.25em] uppercase mb-3">
                  COP · local
                </p>
                <h1 style={{ fontFamily: '"Newsreader", serif', fontWeight: 500, letterSpacing: "-0.02em" }}
                    className="text-5xl text-neutral-50">
                  Epic Burndown
                </h1>
                {data && pairs.length > 0 && (
                  <p className="mt-3 text-neutral-500"
                     style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "13px" }}>
                    {pairs.length + " epics · "}
                    <span className="text-amber-400">{fmt1(totalRemaining)}</span>
                    <span className="text-neutral-600">{"/" + Math.round(totalPoints) + "h remaining · "}</span>
                    <span className="text-neutral-300">{totalDone}</span>
                    <span className="text-neutral-600">{"/" + totalIssues + " issues resolved"}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {activeEpic && (
                  <button onClick={() => setActiveEpic(null)}
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    className="text-[11px] uppercase tracking-[0.2em] text-neutral-600 hover:text-neutral-300 transition-colors px-3 py-2 border border-neutral-800 hover:border-neutral-600">
                    clear ×
                  </button>
                )}
                <button onClick={fetchData} disabled={loading}
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 hover:text-amber-400 disabled:opacity-30 transition-colors px-3 py-2 border border-neutral-800 hover:border-amber-400/40">
                  {loading ? "fetching…" : "↻ refresh"}
                </button>
              </div>
            </header>

            {error && (
              <div className="border border-rose-900/60 bg-rose-950/20 text-rose-200 p-6 mb-8">
                <p className="font-medium mb-2" style={{ fontFamily: '"Newsreader", serif' }}>
                  Failed to load
                </p>
                <p className="text-xs whitespace-pre-wrap break-words"
                   style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  {error}
                </p>
              </div>
            )}

            {loading && !data && (
              <div className="flex flex-col items-center justify-center py-32 text-neutral-500">
                <div className="w-10 h-10 border border-neutral-800 border-t-amber-400 rounded-full animate-spin mb-6" />
                <p style={{ fontFamily: '"JetBrains Mono", monospace' }}
                   className="text-[11px] uppercase tracking-[0.25em]">
                  fetching from jira…
                </p>
              </div>
            )}

            {data && pairs.length === 0 && (
              <div className="text-center py-32">
                <p style={{ fontFamily: '"Newsreader", serif', fontStyle: "italic" }}
                   className="text-2xl text-neutral-500">
                  No epics configured.
                </p>
                <p style={{ fontFamily: '"JetBrains Mono", monospace' }}
                   className="text-xs text-neutral-700 mt-3 tracking-wider">
                  edit EPICS in burndown.js
                </p>
              </div>
            )}

            {data && pairs.length > 0 && (
              <div className="space-y-6">
                <div className="border border-neutral-800 bg-neutral-950/40">
                  <div className="px-6 pt-5 pb-1 flex items-center justify-between">
                    <span style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      className="text-[10px] uppercase tracking-[0.25em] text-neutral-600">
                      hours remaining
                    </span>
                    <div className="flex items-center gap-3">
                      {pairs.map(({ epic }, i) => (
                        <button key={epic.key} onClick={() => handleRowClick(epic.key)}
                          className="flex items-center gap-1.5 transition-opacity"
                          style={{ opacity: activeEpic && activeEpic !== epic.key ? 0.3 : 1 }}>
                          <span className="w-3 h-0.5" style={{ backgroundColor: EPIC_COLORS[i % EPIC_COLORS.length] }} />
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "10px", color: "#71717a" }}>
                            {epic.key}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-72 px-3 pt-1 pb-1">
                    <CombinedChart pairs={pairs} activeEpic={activeEpic} />
                  </div>
                  <div className="border-t border-neutral-900">
                    {pairs.map(({ epic, bd }, i) => (
                      <EpicStatsRow
                        key={epic.key}
                        epic={epic}
                        bd={bd}
                        color={EPIC_COLORS[i % EPIC_COLORS.length]}
                        isActive={activeEpic === epic.key}
                        isAnyActive={activeEpic !== null}
                        onClick={() => handleRowClick(epic.key)}
                      />
                    ))}
                  </div>
                </div>

                {activeTab && (
                  <TicketPanel
                    pairs={pairs}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />
                )}
              </div>
            )}

            {lastUpdated && (
              <p style={{ fontFamily: '"JetBrains Mono", monospace' }}
                 className="mt-12 text-[11px] text-neutral-700 text-center tracking-widest">
                updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      );
    }

    createRoot(document.getElementById("root")).render(<EpicBurndown />);
  </script>
</body>
</html>`;

// ============================================================
// Server
// ============================================================

const srv = createServer(async (req, res) => {
  if (req.url === '/api/burndown') {
    try {
      const epics = await Promise.all(EPICS.map(fetchEpic));
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ epics }))
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: e.message }))
  }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(HTML)
  }
})

srv.listen(3000, () => {
  console.log(`Server running: http://localhost:${PORT}`)
})
