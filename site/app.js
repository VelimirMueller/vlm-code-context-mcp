/*
 * Renders the benchmark page from static JSON. No dependencies, no network except same-origin data.
 *
 * Run schema (assumed; adjust normalize() if the harness differs):
 * {
 *   run_id, date: "YYYY-MM-DD", kind: "weekly"|"monthly", n: <pairs per task>,
 *   model, claude_code_version,
 *   prereg: { version, sha256 },
 *   hidden: { tests_sha256, answer_key_sha256 },
 *   valid: bool (prereg v2; absent = not asserted),  treatment_received_rate: 0..1 (share of cc sessions with >= 1 code-context call),
 *   notes: [string], fixture: { repo_url?, commit_sha?, ... },
 *   nv: {mean, lo, hi},  q: {mean, lo, hi},  c: {mean, lo, hi},
 *   criteria: [ { id: accuracy|code_quality|systems|stakeholder|control|time|tokens,
 *                 vanilla, cc, delta: {mean, lo, hi}, p_holm, n } ],
 *   s5: { tasks: [ { k, vanilla_tokens, cc_tokens } ]  // cumulative, cc includes indexing
 *         break_even_k: number|null }
 * }
 * The verdict is recomputed here from nv.lo / nv.hi (preregistration section 6);
 * a "verdict" field in the data is only compared, never trusted.
 */
(function () {
  "use strict";
  var CFG = window.BENCH_CONFIG || { INDEX: "data/index.json", LATEST: "data/latest.json" };
  var DEMO = /(^|[?&])demo(=|&|$)/.test(location.search);
  var NS = "http://www.w3.org/2000/svg";
  var COL = { mag: "#ee4fff", cy: "#00fff7", gr: "#05ffa1", ye: "#f0ff19", red: "#ff2a6d", dim: "#9db0d0", line: "#2a2352" };
  var CRIT = [
    ["accuracy", "Accuracy (T1 hidden tests)", "q", 0.30],
    ["code_quality", "Code quality (T1)", "q", 0.20],
    ["systems", "Systems knowledge (T2)", "q", 0.15],
    ["stakeholder", "Stakeholder communication (T3)", "q", 0.10],
    ["control", "Control / steerability (T4)", "q", 0.25],
    ["time", "Wall time (cost)", "c", 0.5],
    ["tokens", "Tokens (cost)", "c", 0.5]
  ];

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function sv(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function isNum(x) { return typeof x === "number" && isFinite(x); }
  function fmt(x, d) { return isNum(x) ? x.toFixed(d == null ? 3 : d) : "n/a"; }
  function sgn(x, d) { return isNum(x) ? (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(d == null ? 3 : d) : "n/a"; }
  function ci(o, d) { return o && isNum(o.mean) ? sgn(o.mean, d) + " [" + sgn(o.lo, d) + ", " + sgn(o.hi, d) + "]" : "n/a"; }
  function pct(x) { return isNum(x) ? (x * 100).toFixed(1) + " %" : "n/a"; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function verdict(nv) {
    if (!nv || !isNum(nv.lo) || !isNum(nv.hi)) return null;
    if (nv.lo > 0) return "KEEP";
    if (nv.hi < 0) return "DROP";
    return "INCONCLUSIVE";
  }
  var VCLS = { KEEP: "keep", DROP: "drop", INCONCLUSIVE: "inc" };

  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }

  function loadReal() {
    return getJSON(CFG.INDEX).then(function (idx) {
      var runs = (idx && idx.runs) || [];
      return runs;
    }, function () { return []; }).then(function (runs) {
      if (runs.length) return runs;
      return getJSON(CFG.LATEST).then(function (r) { return [r]; }, function () { return []; });
    }).then(function (runs) {
      return runs.filter(function (r) { return r && typeof r === "object" && typeof r.date === "string" && isFinite(Date.parse(r.date)); })
        .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    });
  }

  function demoRuns() {
    var runs = [], i, m = [0.02, -0.03, 0.05, 0.04, 0.09, 0.08, 0.11, 0.12];
    for (i = 0; i < m.length; i++) {
      var monthly = i === 3 || i === 7, h = monthly ? 0.05 : 0.14;
      var dt = new Date(Date.now() - (m.length - 1 - i) * 7 * 864e5).toISOString().slice(0, 10);
      var crit = CRIT.map(function (c, j) {
        var v = c[2] === "q" ? 0.6 + j * 0.05 : 100 + j * 40, dm = c[2] === "q" ? 0.05 + m[i] / 2 : 0.1 - m[i] / 2;
        return { id: c[0], vanilla: v, cc: v * (1 + dm), delta: { mean: dm, lo: dm - h, hi: dm + h }, p_holm: Math.min(1, 0.3 / (i + 1) + j * 0.05), n: monthly ? 10 : 3 };
      });
      var tasks = [], k, van = 0, cc = 90;
      for (k = 1; k <= 5; k++) { van += 100; cc += 70; tasks.push({ k: k, vanilla_tokens: van, cc_tokens: cc }); }
      runs.push({ run_id: "demo-" + i, date: dt, kind: monthly ? "monthly" : "weekly", n: monthly ? 10 : 3,
        model: "DEMO-model", claude_code_version: "0.0.0-demo", valid: true, treatment_received_rate: 0.95, prereg: { version: CFG.PREREG_CURRENT, sha256: "0".repeat(64) },
        hidden: { tests_sha256: "0".repeat(64), answer_key_sha256: "0".repeat(64) },
        nv: { mean: m[i], lo: m[i] - h, hi: m[i] + h }, q: { mean: m[i] + 0.04, lo: m[i] - h, hi: m[i] + h + 0.08 },
        c: { mean: 0.06, lo: -0.05, hi: 0.17 }, criteria: crit, s5: { tasks: tasks, break_even_k: 3 } });
    }
    return runs;
  }

  function ver(r) { return String((r.prereg && r.prereg.version) || "unknown"); }
  function trate(r) {
    var x = r.treatment_received_rate;
    if (!isNum(x) && r.treatment && isNum(r.treatment.rate)) x = r.treatment.rate;
    return isNum(x) ? x : null;
  }
  // INVALID: explicit valid:false, or a measured treatment rate below the preregistered minimum.
  function isInvalid(r) {
    if (r.valid === false) return true;
    var t = trate(r);
    return isNum(t) && t < (CFG.MIN_TREATMENT_RATE || 0.8) && r.valid !== true;
  }
  // Runs that may drive the headline, table, trend: current prereg version and valid.
  function usable(runs) {
    return runs.filter(function (r) { return ver(r) === CFG.PREREG_CURRENT && !isInvalid(r); });
  }
  function headlineRun(runs) {
    runs = usable(runs);
    if (!runs.length) return null;
    for (var i = runs.length - 1; i >= 0; i--) if (runs[i].kind === "monthly") return { run: runs[i], monthly: true };
    return { run: runs[runs.length - 1], monthly: false };
  }

  function pendingBox(text) {
    return el("div", { class: "pending" }, [el("b", null, ["First registered run pending. "]), text]);
  }

  function pendingV2() {
    return el("div", { class: "card" }, [
      el("div", { class: "verdict" }, [el("div", { class: "badge pend" }, ["PENDING"]),
        el("div", null, [el("div", { class: "big" }, ["First valid " + CFG.PREREG_CURRENT + " run pending"]),
          el("div", { class: "sub" }, ["No valid " + CFG.PREREG_CURRENT + " result exists yet. No number here is a placeholder. A run counts only if at least " + Math.round((CFG.MIN_TREATMENT_RATE || 0.8) * 100) + " % of its cc sessions actually used code-context."])])])]);
  }

  function metaList(r) {
    var meta = el("dl", { class: "meta" });
    function row(k, val) { meta.appendChild(el("dt", null, [k])); meta.appendChild(el("dd", null, [val])); }
    row("Model", String(r.model || "unknown"));
    row("Claude Code", String(r.claude_code_version || "unknown"));
    row("Date", String(r.date));
    row("Run", String(r.run_id || "") + " " + (r.kind || "unknown") + ", n = " + (r.n != null ? r.n : "?") + " per arm and task");
    var pr = r.prereg || {};
    row("Pre-registration", String(pr.version || "unknown") + ", SHA-256 " + String(pr.sha256 || "unknown"));
    var t = trate(r);
    row("Treatment received", (t != null ? pct(t) + " of cc sessions used code-context (valid needs at least " + Math.round((CFG.MIN_TREATMENT_RATE || 0.8) * 100) + " %)" : "not recorded") + (r.valid === true ? "; run VALID" : r.valid === false ? "; run INVALID" : ""));
    var fx = r.fixture || {};
    if (fx.repo_url || fx.commit_sha) row("Codebase", String(fx.repo_url || "") + " @ " + String(fx.commit_sha || ""));
    var hd = r.hidden || {};
    row("Hidden tests SHA-256", String(hd.tests_sha256 || "n/a"));
    row("Answer key SHA-256", String(hd.answer_key_sha256 || "n/a"));
    return meta;
  }

  function renderHeadline(runs) {
    var box = $("headline-body"); clear(box);
    if (!runs.length) {
      box.appendChild(el("div", { class: "card" }, [
        el("div", { class: "verdict" }, [el("div", { class: "badge pend" }, ["PENDING"]),
          el("div", null, [el("div", { class: "big" }, ["First registered run pending"]),
            el("div", { class: "sub" }, ["No result exists yet. No number on this page is a placeholder: the method below is already fixed, and results will appear here after the first registered run."])])])]));
      return;
    }
    var h = headlineRun(runs);
    if (!h) box.appendChild(pendingV2());
    else {
      var r = h.run, v = verdict(r.nv);
      var card = el("div", { class: "card" }, [
        el("div", { class: "verdict" }, [
          el("div", { class: "badge " + (VCLS[v] || "pend") }, [v || "N/A"]),
          el("div", null, [el("div", { class: "big" }, ["NV " + ci(r.nv)]),
            el("div", { class: "sub" }, ["net value, 95 % bootstrap CI, pre-registration " + ver(r) + ". KEEP needs the lower bound above 0."])])]),
        metaList(r)]);
      if (r.verdict && v && String(r.verdict).toUpperCase() !== v)
        card.appendChild(el("div", { class: "note" }, ["The data file states verdict " + String(r.verdict) + ", but the pre-registered rule applied to its CI gives " + v + ". The rule wins."]));
      if (!h.monthly)
        card.appendChild(el("div", { class: "note" }, ["No monthly run (n = 10) exists yet. This is a weekly run with n = " + (r.n != null ? r.n : 3) + "; read the interval, not the point."]));
      box.appendChild(card);
      renderNotes(r, box);
    }
    var others = runs.filter(function (r) { return usable(runs).indexOf(r) < 0; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (others.length) {
      box.appendChild(el("h3", null, ["Other registered runs (not in the headline or the trend)"]));
      others.forEach(function (r) {
        var v = verdict(r.nv), inv = isInvalid(r), old = ver(r) !== CFG.PREREG_CURRENT;
        var label = ver(r) + " \u2014 " + (inv ? "INVALID" : (v || "N/A"));
        if (old) label += ", treatment not received";
        else if (inv && trate(r) != null) label += ", treatment received in " + pct(trate(r)) + " of cc sessions";
        if (CFG.PREREG_VERSIONS.indexOf(ver(r)) < 0) label += " (unknown pre-registration version)";
        var c = el("div", { class: "card" }, [
          el("div", { class: "big " + (inv ? "drop" : VCLS[v] || "pend") }, [label]),
          el("div", { class: "sub" }, ["NV " + ci(r.nv) + (old ? ". Measured under an earlier method; not comparable with " + CFG.PREREG_CURRENT + " runs." : "")]),
          metaList(r)]);
        box.appendChild(c);
        renderNotes(r, box);
      });
    }
  }

  function rawfmt(x) {
    if (!isNum(x)) return "n/a";
    return Math.abs(x) >= 1000 ? Math.round(x).toLocaleString("en-US") : x.toFixed(3);
  }
  function renderNotes(r, box) {
    var notes = Array.isArray(r.notes) ? r.notes.filter(function (n) { return typeof n === "string" && n; }) : [];
    if (r.fake === true) notes.unshift("This run is flagged as fake (harness self-test). Its numbers are not results.");
    if (!notes.length) return;
    var ul = el("ul");
    notes.forEach(function (n) { ul.appendChild(el("li", null, [n])); });
    box.appendChild(el("div", { class: "note", id: "run-notes" }, [el("strong", null, ["Run notes (" + String(r.run_id || r.date) + ")"]), ul]));
  }

  function pcell(p) { return isNum(p) ? (p < 0.001 ? "<0.001" : p.toFixed(3)) : "n/a"; }
  function dcell(o, good) {
    var td = el("td", null, [ci(o)]);
    if (o && isNum(o.mean)) td.className = (good ? o.mean : -o.mean) > 0 ? "pos" : o.mean === 0 ? "" : "neg";
    return td;
  }

  function renderResults(runs) {
    var box = $("results-body"); clear(box);
    if (!runs.length) { box.appendChild(pendingBox("The table fills from the first registered run.")); return; }
    var h = headlineRun(runs);
    if (!h) { box.appendChild(pendingBox("The table fills from the first valid " + CFG.PREREG_CURRENT + " run.")); return; }
    var r = h.run, by = {};
    (r.criteria || []).forEach(function (c) { by[c.id] = c; });
    var tb = el("table"), hd = el("tr");
    ["Criterion", "Weight", "vanilla", "cc", "Δ (95 % CI)", "p (Holm)", "n"].forEach(function (t) { hd.appendChild(el("th", null, [t])); });
    tb.appendChild(hd);
    function summary(label, o) {
      var tr = el("tr", { class: "sum" }, [el("td", null, [label]), el("td"), el("td"), el("td"), el("td", null, [ci(o)]), el("td"), el("td")]);
      tb.appendChild(tr);
    }
    CRIT.forEach(function (c, i) {
      if (i === 5) summary("Q (quality gain)", r.q);
      var d = by[c[0]], isQ = d && d.direction ? d.direction !== "lower_better" : c[2] === "q";
      var lbl = [c[1]];
      if (d && d.raw_unit) lbl.push(el("div", { class: "sub" }, [String(d.raw_unit) + (isQ ? "" : "; Δ = cost increase of cc, positive is worse")]));
      var tr = el("tr", null, [el("td", null, lbl), el("td", null, [(d && isNum(d.weight) ? d.weight : c[3]).toFixed(2)]),
        el("td", null, [d ? rawfmt(d.vanilla) : "n/a"]), el("td", null, [d ? rawfmt(d.cc) : "n/a"])]);
      tr.appendChild(dcell(d && d.delta, isQ));
      tr.appendChild(el("td", null, [d ? pcell(d.p_holm) : "n/a"]));
      tr.appendChild(el("td", null, [d && d.n != null ? String(d.n) : "n/a"]));
      tb.appendChild(tr);
    });
    summary("C (cost increase, negative = cc cheaper)", r.c);
    summary("NV = Q − 0.5 · C", r.nv);
    box.appendChild(el("div", { class: "tablewrap" }, [tb]));
    box.appendChild(el("p", { class: "sub" }, ["Run " + String(r.date) + " (" + String(r.kind || "?") + "). Units of vanilla and cc values are those of each criterion (pass rate, score, seconds, tokens); only Δ is comparable across rows."]));
  }

  // ---- charts, drawn to scale ----
  function niceTicks(lo, hi) {
    var span = hi - lo || 1, raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), s = raw / p;
    var step = (s < 1.5 ? 1 : s < 3.5 ? 2 : s < 7.5 ? 5 : 10) * p, out = [];
    for (var t = Math.ceil(lo / step) * step; t <= hi + step * 1e-6; t += step) out.push(+t.toFixed(10));
    return out;
  }

  function renderTrend(runs) {
    var box = $("trend-body"); clear(box);
    var pts = usable(runs).filter(function (r) { return r.nv && isNum(r.nv.mean) && isNum(r.nv.lo) && isNum(r.nv.hi); });
    if (!pts.length) { box.appendChild(pendingBox("The trend shows valid runs of the current method only and needs at least one.")); return; }
    var W = 720, H = 320, L = 52, R = 16, T = 16, B = 40;
    var t = pts.map(function (r) { return Date.parse(r.date + "T00:00:00Z"); });
    var t0 = Math.min.apply(null, t), t1 = Math.max.apply(null, t);
    if (t1 === t0) { t0 -= 7 * 864e5; t1 += 7 * 864e5; } else { var pad = (t1 - t0) * 0.04; t0 -= pad; t1 += pad; }
    var lo = Math.min(0, Math.min.apply(null, pts.map(function (r) { return r.nv.lo; })));
    var hi = Math.max(0, Math.max.apply(null, pts.map(function (r) { return r.nv.hi; })));
    var m = (hi - lo) * 0.08 || 0.05; lo -= m; hi += m;
    function X(x) { return L + (x - t0) / (t1 - t0) * (W - L - R); }
    function Y(y) { return T + (hi - y) / (hi - lo) * (H - T - B); }
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Net value NV per run with 95 percent confidence band" });
    niceTicks(lo, hi).forEach(function (y) {
      svg.appendChild(sv("line", { x1: L, x2: W - R, y1: Y(y), y2: Y(y), stroke: y === 0 ? COL.ye : COL.line, "stroke-width": y === 0 ? 1.5 : 1, "stroke-dasharray": y === 0 ? "" : "3 3" }));
      svg.appendChild(sv("text", { x: L - 6, y: Y(y) + 4, "text-anchor": "end" }, sgn(y, 2).replace("+", "")));
    });
    // x ticks at run dates (thin out on dense data)
    var step = Math.ceil(pts.length / 6);
    pts.forEach(function (r, i) {
      if (i % step) return;
      svg.appendChild(sv("text", { x: X(t[i]), y: H - 18, "text-anchor": "middle" }, r.date.slice(5)));
    });
    svg.appendChild(sv("text", { x: (L + W - R) / 2, y: H - 3, "text-anchor": "middle" }, "run date (to scale), NV on the y axis, yellow line = 0"));
    // CI band between consecutive points
    var up = pts.map(function (r, i) { return X(t[i]) + "," + Y(r.nv.hi); });
    var dn = pts.map(function (r, i) { return X(t[i]) + "," + Y(r.nv.lo); }).reverse();
    if (pts.length > 1) svg.appendChild(sv("polygon", { points: up.concat(dn).join(" "), fill: COL.mag, "fill-opacity": "0.18", stroke: "none" }));
    svg.appendChild(sv("polyline", { points: pts.map(function (r, i) { return X(t[i]) + "," + Y(r.nv.mean); }).join(" "), fill: "none", stroke: COL.cy, "stroke-width": 2 }));
    pts.forEach(function (r, i) {
      var x = X(t[i]), mo = r.kind === "monthly";
      svg.appendChild(sv("line", { x1: x, x2: x, y1: Y(r.nv.lo), y2: Y(r.nv.hi), stroke: COL.mag, "stroke-width": mo ? 2.5 : 1.5 }));
      var c = sv(mo ? "rect" : "circle", mo ? { x: x - 5, y: Y(r.nv.mean) - 5, width: 10, height: 10 } : { cx: x, cy: Y(r.nv.mean), r: 4 }, null);
      c.setAttribute("fill", COL.cy); c.setAttribute("stroke", "#070514");
      c.appendChild(sv("title", {}, r.date + " " + (r.kind || "") + " n=" + r.n + " NV " + ci(r.nv)));
      svg.appendChild(c);
    });
    box.appendChild(svg);
    box.appendChild(el("div", { class: "legend" }, [
      el("span", null, ["Circle = weekly run (n = 3), square = monthly run (n = 10, the headline)"]),
      el("span", null, ["Line = NV, magenta band and bars = 95 % CI"])]));
    box.appendChild(el("p", { class: "sub" }, ["Bands are linearly joined between runs for readability; there is no data between runs. Weekly bands are wide by design. A run whose band includes 0 is INCONCLUSIVE."]));
    var vers = {}; pts.forEach(function (r) { vers[(r.model || "?") + " / Claude Code " + (r.claude_code_version || "?")] = 1; });
    if (Object.keys(vers).length > 1)
      box.appendChild(el("div", { class: "note" }, ["Several model / Claude Code versions are in this chart (" + Object.keys(vers).join("; ") + "). A step in the trend may come from a version change rather than from code-context."]));
  }

  function renderAmort(runs) {
    var box = $("amort-body"); clear(box);
    var mr = null;
    runs = usable(runs);
    for (var i = runs.length - 1; i >= 0; i--) if (runs[i].s5 && runs[i].s5.tasks && runs[i].s5.tasks.length) { mr = runs[i]; break; }
    if (!mr) { box.appendChild(pendingBox("S5 runs monthly. No S5 data exists yet.")); return; }
    var tk = mr.s5.tasks, be = mr.s5.break_even_k;
    var W = 720, H = 300, L = 64, R = 16, T = 16, B = 40;
    var maxY = Math.max.apply(null, tk.map(function (x) { return Math.max(x.vanilla_tokens, x.cc_tokens); })) * 1.08;
    var maxK = Math.max.apply(null, tk.map(function (x) { return x.k; }));
    function X(k) { return L + (k - 1) / Math.max(1, maxK - 1) * (W - L - R); }
    function Y(y) { return T + (1 - y / maxY) * (H - T - B); }
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Cumulative tokens per task for both arms" });
    niceTicks(0, maxY).forEach(function (y) {
      svg.appendChild(sv("line", { x1: L, x2: W - R, y1: Y(y), y2: Y(y), stroke: COL.line, "stroke-dasharray": "3 3" }));
      svg.appendChild(sv("text", { x: L - 6, y: Y(y) + 4, "text-anchor": "end" }, y >= 1e6 ? (y / 1e6).toFixed(1) + "M" : y >= 1e3 ? (y / 1e3).toFixed(0) + "k" : String(y)));
    });
    tk.forEach(function (x) { svg.appendChild(sv("text", { x: X(x.k), y: H - 18, "text-anchor": "middle" }, "k=" + x.k)); });
    svg.appendChild(sv("text", { x: (L + W - R) / 2, y: H - 3, "text-anchor": "middle" }, "cumulative tokens after task k (cc includes indexing)"));
    [["vanilla_tokens", COL.mag], ["cc_tokens", COL.cy]].forEach(function (s) {
      svg.appendChild(sv("polyline", { points: tk.map(function (x) { return X(x.k) + "," + Y(x[s[0]]); }).join(" "), fill: "none", stroke: s[1], "stroke-width": 2 }));
      tk.forEach(function (x) { svg.appendChild(sv("circle", { cx: X(x.k), cy: Y(x[s[0]]), r: 3.5, fill: s[1] })); });
    });
    if (isNum(be) && be >= 1 && be <= maxK)
      svg.appendChild(sv("line", { x1: X(be), x2: X(be), y1: T, y2: H - B, stroke: COL.gr, "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
    box.appendChild(svg);
    box.appendChild(el("div", { class: "legend" }, [
      el("span", { style: "color:" + COL.mag }, ["vanilla"]), el("span", { style: "color:" + COL.cy }, ["cc"]),
      el("span", { style: "color:" + COL.gr }, ["green dashed = break-even k*"])]));
    var msg = isNum(be) ? "Break-even k* = " + be + " (from the run of " + mr.date + "): from task " + be + " on, cumulative cc tokens including indexing are at or below vanilla."
      : "Break-even k* not reached within " + maxK + " tasks in the run of " + mr.date + ": cc used more cumulative tokens than vanilla throughout.";
    box.appendChild(el("p", { class: "big" }, [msg]));
  }

  function init() {
    if (CFG.REPO) { ["repo-link", "repo-link2"].forEach(function (id) { var a = $(id); if (a) a.href = CFG.REPO; }); }
    if (DEMO) $("demo-banner").hidden = false;
    var p = DEMO ? Promise.resolve(demoRuns()) : loadReal();
    p.then(function (runs) {
      renderHeadline(runs); renderResults(runs); renderTrend(runs); renderAmort(runs);
    }).catch(function () {
      renderHeadline([]); renderResults([]); renderTrend([]); renderAmort([]);
    });
  }
  init();
})();
