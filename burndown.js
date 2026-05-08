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
          fields: `summary,status,resolutiondate,${SP_FIELD}`,
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

    const pointsOf = (i) => (typeof i.points === "number" ? i.points : 1);

    const HOURS_PER_WEEK = 30;

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

      if (series.length && series[series.length - 1].date < todayStr) {
        while (ri < resolved.length && resolved[ri].date <= today) {
          remaining -= resolved[ri].points;
          ri++;
        }
        const todayDays = Math.round((today - created) / 86400000);
        series.push({
          date: todayStr,
          label: today.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          actual: Math.max(0, remaining),
          ideal: Math.max(0, totalPoints * (1 - todayDays / totalIdealDays)),
        });
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
          className={"px-2 py-0.5 text-[10px] uppercase tracking-widest border " + color}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {status}
        </span>
      );
    };

    function EpicCard({ epic }) {
      const b = computeBurndown(epic);

      return (
        <article className="border border-neutral-800 bg-neutral-950/40 hover:border-neutral-700 transition-colors">
          <header className="px-8 pt-7 pb-6 flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span style={{ fontFamily: '"JetBrains Mono", monospace' }} className="text-xs text-amber-400/90 tracking-wider">
                  {epic.key}
                </span>
                <StatusPill status={epic.status} />
                {epic.projectedEnd && (
                  <span style={{ fontFamily: '"JetBrains Mono", monospace' }} className="text-[11px] text-amber-400/70">
                    proj {fmtDate(epic.projectedEnd)}
                  </span>
                )}
                {epic.duedate && (
                  <span style={{ fontFamily: '"JetBrains Mono", monospace' }} className="text-[11px] text-neutral-500">
                    due {fmtDate(epic.duedate)}
                  </span>
                )}
                <span style={{ fontFamily: '"JetBrains Mono", monospace' }} className="text-[11px] text-neutral-600">
                  opened {fmtDate(epic.created)}
                </span>
              </div>
              <h2 style={{ fontFamily: '"Newsreader", serif', fontWeight: 500 }} className="text-2xl text-neutral-100 leading-snug">
                {epic.summary}
              </h2>
            </div>
            <div className="text-right shrink-0">
              <div style={{ fontFamily: '"Newsreader", serif', fontWeight: 500 }} className="text-5xl text-neutral-100 leading-none tabular-nums">
                {b.remaining}
              </div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace' }} className="text-[10px] text-neutral-500 tracking-widest uppercase mt-1">
                hours left
              </div>
            </div>
          </header>

          <div className="h-64 px-3 pb-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={b.series} margin={{ top: 10, right: 28, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#1f1f23" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" stroke="#52525b" fontSize={10}
                  tick={{ fontFamily: "JetBrains Mono, monospace" }}
                  interval="preserveStartEnd" minTickGap={48} />
                <YAxis stroke="#52525b" fontSize={10}
                  tick={{ fontFamily: "JetBrains Mono, monospace" }}
                  domain={[0, "dataMax"]} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0c0c0d", border: "1px solid #2a2a2e",
                    fontFamily: "JetBrains Mono, monospace", fontSize: "11px" }}
                  labelStyle={{ color: "#a3a3a3" }}
                  formatter={(value, name) => [
                    value === null || value === undefined
                      ? "—"
                      : typeof value === "number" ? Math.round(value * 10) / 10 : value,
                    name,
                  ]}
                />
                <Line type="monotone" dataKey="ideal" stroke="#3f3f46" strokeWidth={1}
                  strokeDasharray="4 4" dot={false} name="Ideal" isAnimationActive={false} />
                <Line type="stepAfter" dataKey="actual" stroke="#fbbf24" strokeWidth={2}
                  dot={false} connectNulls={false} name="Remaining" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <footer className="px-8 py-5 border-t border-neutral-900 flex items-center justify-between gap-4 text-xs"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <div className="flex items-center gap-6 text-neutral-500 flex-wrap">
              <span>
                <span className="text-neutral-200">{b.doneCount}</span>
                <span className="text-neutral-600">/{b.issueCount}</span>{" "}
                <span className="text-neutral-600">issues</span>
              </span>
              <span>
                <span className="text-neutral-200">{b.completedPoints}</span>
                <span className="text-neutral-600">/{b.totalPoints}</span>{" "}
                <span className="text-neutral-600">hours</span>
              </span>
              <span className="text-amber-400/90">{b.pctComplete}% complete</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-neutral-600 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-amber-400" />
                actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-px"
                  style={{
                    backgroundImage: "linear-gradient(to right, #525252 50%, transparent 50%)",
                    backgroundSize: "4px 1px"
                  }} />
                ideal
              </span>
            </div>
          </footer>
        </article>
      );
    }

    // ---------- main ----------

    function EpicBurndown() {
      const [data, setData] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [lastUpdated, setLastUpdated] = useState(null);

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

      const totalRemaining = data
        ? data.epics.reduce((s, e) => s + computeBurndown(e).remaining, 0) : 0;
      const totalPoints = data
        ? data.epics.reduce((s, e) => s + computeBurndown(e).totalPoints, 0) : 0;

      return (
        <div style={{ minHeight: "100vh" }}>
          <div className="max-w-6xl mx-auto px-6 py-12">
            <header className="mb-12 flex items-end justify-between gap-4 border-b border-neutral-800 pb-8">
              <div>
                <p style={{ fontFamily: '"JetBrains Mono", monospace' }}
                   className="text-[11px] text-neutral-500 tracking-[0.25em] uppercase mb-3">
                  COP · local
                </p>
                <h1 style={{ fontFamily: '"Newsreader", serif', fontWeight: 500, letterSpacing: "-0.02em" }}
                    className="text-5xl text-neutral-50">
                  Epic Burndown
                </h1>
                {data && data.epics.length > 0 && (
                  <p className="mt-3 text-neutral-400"
                     style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "13px" }}>
                    {data.epics.length} active {data.epics.length === 1 ? "epic" : "epics"} ·{" "}
                    <span className="text-amber-400">{totalRemaining}</span>
                    <span className="text-neutral-600">/{totalPoints}</span> hours remaining
                  </p>
                )}
              </div>
              <button onClick={fetchData} disabled={loading}
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
                className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 hover:text-amber-400 disabled:opacity-30 transition-colors px-3 py-2 border border-neutral-800 hover:border-amber-400/40">
                {loading ? "fetching…" : "↻ refresh"}
              </button>
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

            {data && data.epics.length === 0 && (
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

            <div className="space-y-6">
              {data?.epics.map((epic) => <EpicCard key={epic.key} epic={epic} />)}
            </div>

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
