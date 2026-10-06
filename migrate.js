/* =====================================================================
   migrate.js — traz os dados das apps antigas deste browser (mesma origem):
   - gymos (localStorage "treino_state"): planos (com trocas e planos
     importados), semana, histórico, últimas cargas, recordes, alongamentos
     feitos e dados de saúde (sono/FC/passos);
   - Nutrição da Vida OS ("vidaos:nut"): tudo, tal e qual.
   Junta sem apagar nada (merge por id), por isso pode correr mais de uma vez.
   ===================================================================== */
(function (global) {
  const legacyMap = () => { const m = {}; (global.EXERCISES || []).forEach((e) => (e.legacy || []).forEach((l) => { m[l] = e.id; })); return m; };

  function fromNut(force) {
    const v = Store.readRaw("vidaos:nut");
    if (!v || !Object.keys(v).length) return 0;
    if (!force && Store.get("nut")._fromVidaOS) return 0;
    App.mergeInto("nut", v);
    Store.update("nut", (s) => { s._fromVidaOS = true; }, { silent: true, keepTime: true });
    return 1;
  }

  /** st = estado do gymos (treino_state). Devolve nº de blocos importados. */
  function fromGymos(st, force) {
    if (!st || typeof st !== "object") return 0;
    const has = (o) => o && Object.keys(o).length;
    if (!has(st.log) && !has(st.customPlans) && !has(st.lastLoads) && !has(st.schedule) && !has(st.records)) return 0;
    if (!force && Store.get("gym")._gymosImported) return 0;
    const T = global.Treino, D = global.GYM_DEFAULTS || { plans: [] };
    const lm = legacyMap();
    const exId = (oldId, exObj) => lm[oldId] || (exObj && T.Ex.ensure({ name: exObj.n || exObj.name, muscles: exObj.m, cue: exObj.cue })) || null;
    const parseRange = (r) => { const m = String(r || "").match(/^(\d+)\s*[×x]\s*(.+)$/); return m ? { sets: +m[1], reps: m[2].trim() } : { sets: 3, reps: String(r || "8-12") }; };
    const hidden = st.hiddenPlans || {};
    const planKeyToId = (k) => (k === "rest" || k === "run" ? k : k && k.startsWith("custom_") ? "gymos_c_" + k.slice(7) : k ? "gymos_" + k : null);

    const plans = [];
    D.plans.forEach((p) => {
      const key = p.id.replace(/^gymos_/, "");
      if (hidden[key]) return;
      const swaps = (st.swaps || {})[key] || {};
      const items = p.items.map((it, i) => { const sw = swaps[i]; return { id: "gi_" + key + "_" + i, ...it, ex: sw ? exId(sw.id, sw) || it.ex : it.ex }; });
      plans.push({ ...p, items });
    });
    Object.values(st.customPlans || {}).forEach((cp) => {
      if (!cp || !cp.id) return;
      plans.push({ id: "gymos_c_" + cp.id, name: cp.name || "Plano", color: /^#/.test(cp.color || "") ? cp.color : "#c38be8", source: "gymos",
        items: (cp.exercises || []).map((x, i) => { const r = x.sets ? { sets: +x.sets, reps: parseRange(x.range).reps } : parseRange(x.range); return { id: "gi_" + cp.id + "_" + i, ex: exId(x.id, x), sets: r.sets || 3, reps: r.reps || "8-12", rest: +x.rest || 90, note: "" }; }).filter((x) => x.ex) });
    });

    const schedule = {};
    Object.entries(st.schedule || {}).forEach(([g, k]) => { const id = planKeyToId(k); if (id) schedule[g] = id; });

    const sessions = [];
    Object.entries(st.log || {}).forEach(([date, arr]) => (arr || []).forEach((s, i) => {
      sessions.push({ id: "gymos_" + date + "_" + (s.when || i), date, name: s.name || "Treino", planId: planKeyToId(s.plan), volume: +s.volume || 0, setsDone: +s.sets || 0, end: s.when || null, items: [], legacy: true });
    }));

    const lastLoads = {}, records = {};
    Object.entries(st.lastLoads || {}).forEach(([k, v]) => { const id = lm[k] || null; if (id && v) lastLoads[id] = { sets: (v.sets || []).map((x) => ({ w: x.w, r: x.r })), when: v.when }; });
    Object.entries(st.records || {}).forEach(([k, v]) => { const id = lm[k] || null; if (id && v) records[id] = { w: +v.w || 0, r: +v.r || 0, when: v.when }; });

    const stretchLog = {};
    Object.entries(st.stretchLog || {}).forEach(([iso, items]) => {
      const out = {}; Object.entries(items || {}).forEach(([k, on]) => { const id = lm["stretch:" + k]; if (id && on) out[id] = true; });
      if (Object.keys(out).length) stretchLog[iso] = out;
    });

    App.mergeInto("gym", { plans, schedule, sessions, lastLoads, records, stretchLog, _updatedAt: 1 });
    Store.update("gym", (s) => {
      s._gymosImported = true; s._seeded = true;
      // a semana do gymos vale mais do que a semana por defeito
      if (Object.keys(schedule).length) s.schedule = { ...s.schedule, ...schedule };
      if (!s.weeklyGoal || s.weeklyGoal === 4) s.weeklyGoal = 5;
    }, { silent: true });

    const checkins = {};
    Object.entries(st.health || {}).forEach(([iso, h]) => {
      if (!h) return; const c = {};
      if (+h.sleepHours) c.sleep = +h.sleepHours; if (+h.restingHR) c.hr = +h.restingHR; if (+h.steps) c.steps = +h.steps;
      if (Object.keys(c).length) checkins[iso] = c;
    });
    if (Object.keys(checkins).length) App.mergeInto("body", { checkins, _updatedAt: 1 });
    return 1 + (Object.keys(checkins).length ? 1 : 0);
  }

  function all(force) {
    let n = fromNut(force);
    const tr = Store.readRaw("treino_state");
    if (tr) n += fromGymos(tr, force);
    return n;
  }

  global.FisicoMigrate = { all, fromNut, fromGymos };
})(window);
