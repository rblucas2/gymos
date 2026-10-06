/* =====================================================================
   treino.js — Treino: base de exercícios com animações próprias, planos,
   semana, registo de sessão (séries, cargas, descanso), histórico,
   recordes e importação de planos (feitos no Claude a partir da pasta
   "Físico" do TikTok).
   Dados no namespace "gym".
   ===================================================================== */
(function (global) {
  const { el, clear, num, toast, undo, sheet, field, uid, todayISO, guardClick } = UI;
  const { ico, btnI, pageHead, panel, linkBtn, kpi, shiftDay, mondayOf, barChart } = C;
  const NS = "gym";
  const S = () => Store.get(NS);
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

  const MUSCLES = { chest: "Peito", back: "Costas", shoulders: "Ombros", rear_delts: "Ombro posterior", traps: "Trapézio", biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebraços", quads: "Quadríceps", hamstrings: "Posteriores", glutes: "Glúteos", calves: "Gémeos", core: "Core", adductors: "Adutores", hip_flexors: "Flexores da anca" };
  const CATS = { forca: "Força", core: "Core", pliometria: "Pliometria", mobilidade: "Mobilidade", corretivo: "Corretivo", alongamento: "Alongamento" };
  const DAYS = [{ g: 1, id: "seg", label: "Segunda" }, { g: 2, id: "ter", label: "Terça" }, { g: 3, id: "qua", label: "Quarta" }, { g: 4, id: "qui", label: "Quinta" }, { g: 5, id: "sex", label: "Sexta" }, { g: 6, id: "sab", label: "Sábado" }, { g: 0, id: "dom", label: "Domingo" }];
  const PLAN_COLORS = ["#f2894b", "#5aa9e6", "#7bc47f", "#c38be8", "#e8c547", "#e86a6a", "#4fc1b8"];

  /* ----------------------------- Exercícios ----------------------------- */
  const Ex = {
    all() { return (global.EXERCISES || []).concat((S().exercises || []).map((e) => ({ ...e, custom: true }))); },
    get(id) { return Ex.all().find((e) => e.id === id) || null; },
    name(id) { const e = Ex.get(id); return e ? e.pt || e.n : "Exercício"; },
    /** Procura por nome (inglês, português ou alternativo), tolerante a maiúsculas/acentos. */
    find(name) {
      const q = norm(name); if (!q) return null;
      const all = Ex.all();
      const names = (e) => [e.n, e.pt, ...(e.aka || [])].map(norm);
      let hit = all.find((e) => names(e).includes(q)); if (hit) return hit;
      hit = all.find((e) => (e.legacy || []).includes(name)); if (hit) return hit;
      const qt = q.split(" ").filter((w) => w.length > 1);
      let best = null, bestScore = 0;
      all.forEach((e) => names(e).forEach((n) => {
        const nt = n.split(" ").filter((w) => w.length > 1);
        const inter = qt.filter((w) => nt.includes(w)).length;
        const score = inter / Math.max(qt.length, nt.length);
        if (score > bestScore) { bestScore = score; best = e; }
      }));
      return bestScore >= 0.75 ? best : null;
    },
    guessAnim(name, muscles = []) {
      const n = norm(name);
      const rules = [[/incline|inclinad/, "inclinePress"], [/bench|supino/, "benchPress"], [/fly|crossover|peck|pec deck|abertura/, "fly"], [/lateral raise|elevacao lateral|lateral/, "lateralRaise"],
        [/upright/, "uprightRow"], [/face pull/, "facePull"], [/overhead press|military|militar|shoulder press|press de ombro/, "ohp"], [/pulldown|puxada/, "latPulldown"], [/pull ?up|chin|elevacoes|elevacao na barra/, "pullUp"],
        [/pullover/, "pullover"], [/row|remada/, "seatedRow"], [/preacher|scott/, "preacherCurl"], [/curl/, "curl"], [/pushdown/, "pushdown"], [/skull/, "skullcrusher"], [/kickback|coice/, "kickback"],
        [/extension|extensao/, "overheadExt"], [/dip|fundos/, "dips"], [/push ?up|flex/, "pushUp"], [/leg press|prensa/, "legPress"], [/leg curl/, "legCurl"], [/leg extension/, "legExtension"],
        [/bulgar|split/, "splitSquat"], [/lunge|afundo/, "lunge"], [/squat|agach/, "squat"], [/rdl|romanian|romeno|good morning/, "hinge"], [/deadlift|peso morto/, "deadlift"], [/hip thrust/, "hipThrust"],
        [/bridge|ponte/, "gluteBridge"], [/calf|gemeo/, "calfRaise"], [/side plank|prancha lateral/, "sidePlank"], [/plank|prancha/, "plank"], [/crunch|abdominal|sit ?up/, "crunch"], [/leg raise|elevacao de pernas/, "hangingLegRaise"],
        [/box jump|caixa/, "boxJump"], [/broad|comprimento/, "broadJump"], [/jump|salto/, "squatJump"], [/sprint|corrida/, "sprint"], [/stretch|along/, "hamBand"]];
      for (const [re, a] of rules) if (re.test(n)) return a;
      const byM = { chest: "pushUp", back: "seatedRow", shoulders: "lateralRaise", biceps: "curl", triceps: "pushdown", quads: "squat", hamstrings: "hinge", glutes: "hipThrust", calves: "calfRaise", core: "plank" };
      return byM[muscles[0]] || "squat";
    },
    /** Garante que existe (cria exercício próprio se não houver na base). Devolve o id. */
    ensure({ name, pt, muscles, equipment, anim, cue, steps, cat }) {
      const found = Ex.find(name) || (pt && Ex.find(pt)); if (found) return found.id;
      const m = (muscles || []).filter((x) => MUSCLES[x]);
      const ex = { id: "c_" + uid(), n: name, pt: pt || name, cat: cat && CATS[cat] ? cat : "forca", m: m.length ? m : ["core"], eq: equipment || "", anim: anim && global.MOTIONS && MOTIONS[anim] ? anim : Ex.guessAnim(name, m), cue: cue || "", steps: Array.isArray(steps) ? steps.slice(0, 8) : undefined, sets: 3, reps: "8-12", rest: 90 };
      Store.update(NS, (s) => { s.exercises = s.exercises || []; s.exercises.push(ex); }, { silent: true });
      return ex.id;
    },
    stepsOf(e) { if (e.steps && e.steps.length) return e.steps; return (e.cue || "").split(/(?<=[.!])\s+/).map((x) => x.trim()).filter((x) => x.length > 3); },
  };

  /* ----------------------------- Init / seed ----------------------------- */
  function init() {
    Store.ensure(NS, { plans: [], schedule: {}, sessions: [], exercises: [], lastLoads: {}, records: {}, stretchLog: {}, tabs: [], weeklyGoal: 4, current: null });
    if (!S().plans.length && !S()._seeded) seedPlans();
  }
  function seedPlans() {
    const D = global.GYM_DEFAULTS; if (!D) return;
    Store.update(NS, (s) => {
      s.plans = D.plans.map((p) => ({ ...p, items: p.items.map((it) => ({ id: uid(), ...it })) }));
      s.schedule = { ...D.schedule }; s._seeded = true;
    }, { silent: true, keepTime: true });
  }

  /* ----------------------------- Consultas ----------------------------- */
  const plans = () => S().plans || [];
  const planById = (id) => plans().find((p) => p.id === id) || null;
  const sessions = () => (S().sessions || []).slice().sort((a, b) => (b.date + (b.end || "")).localeCompare(a.date + (a.end || "")));
  const trainedOn = (iso) => (S().sessions || []).some((s) => s.date === iso);
  const scheduledFor = (iso) => { const v = (S().schedule || {})[new Date(iso + "T00:00:00").getDay()]; return v || null; };
  function weekCount(iso = todayISO()) { const m = mondayOf(iso), e = shiftDay(m, 6); return new Set((S().sessions || []).filter((s) => s.date >= m && s.date <= e).map((s) => s.date + (s.id || ""))).size; }
  const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + Math.min(r, 15) / 30) : 0);
  /** Melhor série (e1RM) de um exercício, com data. Inclui recordes antigos do gymos. */
  function bestOf(exId) {
    let best = null;
    (S().sessions || []).forEach((s) => (s.items || []).forEach((it) => { if (it.ex !== exId) return; (it.sets || []).forEach((st) => { const w = +st.w || 0, r = +st.r || 0; if (st.done === false) return; const v = e1rm(w, r); if (v && (!best || v > best.v)) best = { w, r, v, date: s.date }; }); }));
    const old = (S().records || {})[exId];
    if (old && e1rm(+old.w, +old.r) > (best ? best.v : 0)) best = { w: +old.w, r: +old.r, v: e1rm(+old.w, +old.r), date: old.when ? UI.isoDate(new Date(old.when)) : null, legacy: true };
    return best;
  }
  function historyOf(exId) {
    const out = [];
    sessions().forEach((s) => (s.items || []).forEach((it) => { if (it.ex !== exId) return; const sets = (it.sets || []).filter((x) => x.done !== false && (+x.w || +x.r)); if (sets.length) out.push({ date: s.date, sets, best: Math.max(...sets.map((x) => e1rm(+x.w, +x.r))) }); }));
    return out;
  }
  /** Séries feitas por músculo numa janela (para regras do Notion e recuperação). */
  function setsByMuscle(fromIso, toIso, { weighted = false } = {}) {
    const out = {};
    (S().sessions || []).forEach((s) => {
      if (s.date < fromIso || s.date > toIso) return;
      (s.items || []).forEach((it) => {
        const e = Ex.get(it.ex); if (!e) return;
        const n = (it.sets || []).filter((x) => x.done !== false).length; if (!n) return;
        (e.m || []).forEach((m, i) => { out[m] = (out[m] || 0) + (i === 0 || !weighted ? n : n * 0.5); });
      });
    });
    return out;
  }

  /* ----------------------------- Miniaturas / demo ----------------------------- */
  function thumb(exId, { size = "md", live = false } = {}) {
    const e = Ex.get(exId); const m = e && global.MOTIONS && MOTIONS[e.anim];
    const box = el("div", { class: "ex-thumb " + size });
    if (!m) { box.appendChild(el("span", { html: UI.icon("dumbbell", 22) })); return box; }
    const p = Anim.player(m, { paused: !live, static: !live, u: m.thumbU != null ? m.thumbU : 0.4, label: e.pt || e.n });
    box.appendChild(p.el);
    if (!live) { box.addEventListener("mouseenter", () => p.play()); box.addEventListener("mouseleave", () => p.pause()); }
    box._player = p;
    return box;
  }
  function chips(list, map) { return el("div", { class: "row wrap", style: "gap:6px" }, (list || []).map((m) => el("span", { class: "pill", text: map[m] || m }))); }

  /** Folha de demonstração: animação grande, passos, dicas, histórico. */
  function demo(exId, { onAdd } = {}) {
    const e = Ex.get(exId); if (!e) return;
    const m = global.MOTIONS && MOTIONS[e.anim];
    const p = m ? Anim.player(m, { label: e.pt || e.n }) : null;
    let speed = 1;
    const ctrl = p ? el("div", { class: "anim-ctrl" }, [
      el("button", { class: "btn btn-sm", html: UI.icon("pause", 16) + "<span>Pausa</span>", onclick: (ev) => { const on = p.toggle(); ev.currentTarget.innerHTML = UI.icon(on ? "pause" : "play", 16) + `<span>${on ? "Pausa" : "Continuar"}</span>`; } }),
      el("button", { class: "btn btn-sm", text: "Lento ½×", onclick: (ev) => { speed = speed === 1 ? 0.5 : 1; p.setSpeed(speed); ev.currentTarget.textContent = speed === 1 ? "Lento ½×" : "Normal 1×"; } }),
    ]) : null;
    const steps = Ex.stepsOf(e);
    const best = bestOf(exId), hist = historyOf(exId);
    const sh = sheet(e.pt || e.n, [
      el("div", { class: "tiny muted", text: [e.n !== e.pt ? e.n : null, CATS[e.cat], e.eq, e.tier ? "nível " + e.tier + " (arquivo)" : null].filter(Boolean).join(" · ") }),
      p ? el("div", { class: "demo-stage" }, [p.el]) : el("div", { class: "empty", text: "Sem animação." }),
      ctrl,
      chips(e.m, MUSCLES),
      steps.length ? el("div", {}, [el("div", { class: "section-title", text: "Como fazer" }), el("ol", { class: "steps" }, steps.map((s) => el("li", { text: s })))]) : null,
      e.cue && e.steps ? el("div", { class: "cue" }, [el("b", { text: "Dica: " }), document.createTextNode(e.cue)]) : null,
      e.dose ? el("div", { class: "tiny muted", text: "Dose habitual: " + e.dose }) : e.sets ? el("div", { class: "tiny muted", text: `Por defeito: ${e.sets} × ${e.reps} · descanso ${e.rest}s` }) : null,
      best || hist.length ? el("div", {}, [
        el("div", { class: "section-title", text: "O teu histórico" }),
        best ? el("div", { class: "pr-line" }, [ico("trophy", 18), el("span", { html: `Recorde: <b>${num(best.w, 1)} kg × ${best.r}</b>` + (best.date ? ` · ${UI.prettyDate(best.date)}` : "") + ` · 1RM estimado ${num(best.v)} kg` })]) : null,
        hist.length > 1 ? UI.lineChart(hist.slice(0, 20).reverse().map((h) => Math.round(h.best)), { height: 70, labels: [UI.prettyDate(hist[Math.min(19, hist.length - 1)].date), UI.prettyDate(hist[0].date)] }) : null,
        ...hist.slice(0, 4).map((h) => el("div", { class: "tiny muted", text: `${UI.prettyDate(h.date)}: ` + h.sets.map((x) => `${num(+x.w, 1)}×${x.r}`).join(", ") })),
      ]) : null,
      el("div", { class: "row", style: "gap:10px" }, [
        e.custom ? el("button", { class: "btn btn-block", text: "Editar", onclick: () => { sh.close(); editExercise(e); } }) : null,
        el("button", { class: "btn btn-primary btn-block", text: onAdd ? "Adicionar" : "Adicionar a um plano", onclick: () => { sh.close(); if (onAdd) onAdd(e); else addToPlanSheet(e); } }),
      ]),
    ], { onClose: () => p && p.destroy() });
  }

  function addToPlanSheet(e) {
    if (!plans().length) return toast("Cria primeiro um plano.");
    const sh = sheet("Adicionar a que plano?", plans().map((p) => el("button", { class: "item pick", onclick: () => {
      Store.update(NS, (s) => { const pl = s.plans.find((x) => x.id === p.id); pl.items.push({ id: uid(), ex: e.id, sets: e.sets || 3, reps: e.reps || "8-12", rest: e.rest || 90 }); });
      sh.close(); toast(`${e.pt || e.n} → ${p.name} ✓`);
    } }, [el("span", { class: "plan-dot", style: "background:" + (p.color || "var(--accent)") }), el("div", { class: "grow" }, [el("div", { class: "t", text: p.name }), el("div", { class: "s", text: p.items.length + " exercícios" })])])));
  }

  /** Escolher exercício (pesquisa + filtros). */
  function pickExercise(onPick, { title = "Escolher exercício" } = {}) {
    let cat = "", mus = "";
    const q = el("input", { type: "search", placeholder: "Procurar (português ou inglês)…", class: "search-input", "aria-label": "Procurar exercício" });
    const catRow = el("div", { class: "chip-row" }), musRow = el("div", { class: "chip-row" });
    const list = el("div", { class: "list pick-list tall" });
    const chip = (row, val, label, get, set) => el("button", { class: "pill pill-btn" + (get() === val ? " on" : ""), text: label, onclick: () => { set(get() === val ? "" : val); drawChips(); draw(); } });
    function drawChips() {
      clear(catRow).append(...Object.entries(CATS).map(([k, l]) => chip(catRow, k, l, () => cat, (v) => { cat = v; })));
      clear(musRow).append(...Object.entries(MUSCLES).map(([k, l]) => chip(musRow, k, l, () => mus, (v) => { mus = v; })));
    }
    function draw() {
      const t = norm(q.value); clear(list);
      const arr = Ex.all().filter((e) => (!cat || e.cat === cat) && (!mus || (e.m || []).includes(mus)) && (!t || norm(e.n + " " + e.pt + " " + (e.aka || []).join(" ")).includes(t)));
      if (!arr.length) list.appendChild(el("div", { class: "empty tiny" }, [el("div", { text: "Nenhum exercício." }), q.value.trim() ? el("button", { class: "btn btn-sm", style: "margin-top:8px", text: `+ Criar “${q.value.trim()}”`, onclick: () => { sh.close(); editExercise({ n: q.value.trim() }, (ex) => onPick(ex)); } }) : null]));
      arr.slice(0, 60).forEach((e) => list.appendChild(el("div", { class: "item ex-item" }, [
        thumb(e.id, { size: "sm" }),
        el("div", { class: "grow", style: "cursor:pointer", onclick: () => { sh.close(); onPick(e); } }, [el("div", { class: "t", text: e.pt || e.n }), el("div", { class: "s", text: (e.m || []).map((m) => MUSCLES[m]).join(", ") + (e.eq ? " · " + e.eq : "") })]),
        el("button", { class: "btn btn-ghost btn-icon btn-sm", title: "Ver como se faz", "aria-label": "Ver como se faz", html: UI.icon("play", 16), onclick: () => demo(e.id, { onAdd: (x) => onPick(x) }) }),
      ])));
    }
    q.addEventListener("input", draw);
    drawChips(); draw();
    const sh = sheet(title, [q, catRow, musRow, list]);
    setTimeout(() => q.focus(), 60);
  }

  function editExercise(e0, after) {
    const e = { cat: "forca", m: [], eq: "", anim: "", ...e0 };
    const fn = field("Nome", { value: e.pt || e.n || "", placeholder: "ex: Remada Pendlay" });
    const fcat = field("Tipo", { type: "select", value: e.cat, options: Object.entries(CATS).map(([v, l]) => ({ value: v, label: l })) });
    const feq = field("Material", { value: e.eq, placeholder: "ex: barra, halteres, cabo…" });
    const mset = new Set(e.m || []);
    const mrow = el("div", { class: "chip-row" }, Object.entries(MUSCLES).map(([k, l]) => { const b = el("button", { class: "pill pill-btn" + (mset.has(k) ? " on" : ""), type: "button", text: l, onclick: () => { mset.has(k) ? mset.delete(k) : mset.add(k); b.classList.toggle("on"); } }); return b; }));
    const motions = Object.keys(global.MOTIONS || {});
    let anim = e.anim || Ex.guessAnim(e.n || "", [...mset]);
    const prev = el("div", { class: "demo-stage small" });
    const showPrev = () => { clear(prev); const m = MOTIONS[anim]; if (m) prev.appendChild(Anim.player(m).el); };
    const fanim = field("Animação", { type: "select", value: anim, options: motions.map((k) => ({ value: k, label: animLabel(k) })) });
    fanim.input.addEventListener("change", () => { anim = fanim.input.value; showPrev(); });
    const fcue = field("Dica / como fazer", { type: "textarea", value: e.cue || (e.steps || []).join("\n"), placeholder: "Um passo por linha" });
    showPrev();
    const sh = sheet(e.id ? "Editar exercício" : "Novo exercício", [fn, el("div", { class: "input-row" }, [fcat, feq]), el("label", { class: "field" }, [el("span", { text: "Músculos" }), mrow]), fanim, prev, fcue,
      el("div", { class: "row", style: "gap:10px" }, [
        e.id ? el("button", { class: "btn btn-danger btn-block", text: "Apagar", onclick: async () => { if (!(await UI.confirm("Apagar este exercício? O histórico mantém-se."))) return; Store.update(NS, (s) => { s.exercises = (s.exercises || []).filter((x) => x.id !== e.id); }); sh.close(); } }) : null,
        el("button", { class: "btn btn-primary btn-block", text: "Guardar", onclick: () => {
          const name = fn.input.value.trim(); if (!name) return toast("Dá um nome.");
          const lines = fcue.input.value.split("\n").map((x) => x.trim()).filter(Boolean);
          const data = { id: e.id || "c_" + uid(), n: e.n && e.id ? e.n : name, pt: name, cat: fcat.input.value, m: mset.size ? [...mset] : ["core"], eq: feq.input.value.trim(), anim, cue: lines.length === 1 ? lines[0] : "", steps: lines.length > 1 ? lines : undefined, sets: e.sets || 3, reps: e.reps || "8-12", rest: e.rest || 90 };
          Store.update(NS, (s) => { s.exercises = s.exercises || []; const i = s.exercises.findIndex((x) => x.id === data.id); if (i >= 0) s.exercises[i] = data; else s.exercises.push(data); });
          sh.close(); toast("Guardado ✓"); if (after) after(data);
        } }),
      ])]);
  }
  function animLabel(k) { const e = (global.EXERCISES || []).find((x) => x.anim === k); return (e ? e.pt : k) + " · " + k; }

  /* ----------------------------- Vista Treino ----------------------------- */
  let sub = "hoje";
  const SUBS = [["hoje", "Hoje"], ["planos", "Planos"], ["semana", "Semana"], ["historico", "Histórico"], ["importar", "Importar"]];
  function render(view) {
    if (S().current && sub === "hoje") return renderSession(view);
    const bar = el("div", { class: "subtabs" }, SUBS.map(([id, label]) => el("button", { class: sub === id ? "active" : "", text: label, onclick: () => { sub = id; Tabs.render(Tabs.current); } })));
    ({ hoje: renderHoje, planos: renderPlanos, semana: renderSemana, historico: renderHistorico, importar: renderImportar }[sub] || renderHoje)(view, bar);
  }
  const go = (s) => { sub = s; Tabs.render("treino"); };

  function planCard(p, { cta = true, big = false } = {}) {
    return el("div", { class: "card plan-card" + (big ? " big" : ""), style: `--pc:${p.color || "var(--accent)"}` }, [
      el("div", { class: "mg-head" }, [
        el("div", {}, [el("div", { class: "mg-title", text: p.name }), el("div", { class: "tiny muted", text: `${p.items.length} exercícios · ~${planMinutes(p)} min` + (p.source ? " · " + p.source : "") })]),
        el("button", { class: "btn btn-ghost btn-sm", text: "Editar", onclick: () => editPlan(p) }),
      ]),
      el("div", { class: "thumb-strip" }, p.items.slice(0, big ? 8 : 5).map((it) => el("div", { class: "ts-item", title: Ex.name(it.ex), onclick: () => demo(it.ex) }, [thumb(it.ex, { size: "sm" }), el("span", { text: Ex.name(it.ex) })]))),
      (p.warmup || p.corrective || p.cooldown) && global.Recup ? el("div", { class: "row wrap", style: "gap:8px;margin-bottom:12px" }, [
        ["warmup", "Aquecimento"], ["corrective", "Corretivos"], ["cooldown", "Alongar no fim"],
      ].filter(([k]) => (p[k] || []).length).map(([k, l]) => el("button", { class: "pill pill-btn", html: UI.icon("play", 14) + `<span>${l} · ${p[k].length}</span>`, onclick: () => Recup.routine(p[k], `${l} · ${p.name}`) }))) : null,
      cta ? el("button", { class: "btn btn-primary btn-block", html: UI.icon("play", 18) + "<span>Começar treino</span>", onclick: () => startSession(p.id) }) : null,
    ]);
  }
  const planMinutes = (p) => Math.round(p.items.reduce((a, it) => a + (it.sets || 3) * (45 + (it.rest || 90)), 0) / 60);

  function renderHoje(view, bar) {
    const iso = todayISO(), sch = scheduledFor(iso), plan = sch && planById(sch);
    const done = (S().sessions || []).filter((s) => s.date === iso);
    view.appendChild(pageHead({ eyebrow: "Treino", icon: "dumbbell", title: plan ? plan.name : sch === "rest" ? "Descanso" : sch === "run" ? "Corrida" : "Treino livre", sub: done.length ? `Já treinaste hoje (${done.map((s) => s.name).join(", ")}).` : plan ? "É o treino de hoje no teu plano semanal." : sch === "rest" ? "Hoje é para recuperar — faz a mobilidade do dia." : "Escolhe um plano ou começa um treino livre.", actions: [btnI("", "plus", "Treino livre", () => startSession(null))] }));
    view.appendChild(bar);
    const goal = S().weeklyGoal || 4, wc = weekCount();
    const stack = el("div", { class: "stack" }, [
      el("div", { class: "kpis" }, [
        kpi({ label: "Esta semana", value: `${wc} / ${goal}`, sub: wc >= goal ? "Meta semanal cumprida" : `Faltam ${goal - wc} treinos`, icon: "flame", variant: "accent", onClick: () => go("semana") }),
        kpi({ label: "Último treino", value: sessions()[0] ? UI.prettyDate(sessions()[0].date) : "—", sub: sessions()[0] ? sessions()[0].name : "Ainda sem registos", icon: "clock", onClick: () => go("historico") }),
        kpi({ label: "Volume da semana", value: num(weekVolume(iso) / 1000, 1) + " t", sub: "kg × reps", icon: "activity" }),
      ]),
    ]);
    if (plan) stack.appendChild(planCard(plan, { big: true }));
    const others = plans().filter((p) => p !== plan);
    if (others.length) stack.appendChild(el("div", {}, [el("div", { class: "section-title", text: plan ? "Outros planos" : "Os teus planos" }), el("div", { class: "slot-grid" }, others.map((p) => planCard(p)))]));
    if (!plans().length) stack.appendChild(panel({ title: "Ainda não tens planos" }, [el("p", { class: "muted", text: "Cria um plano ou importa os que fizeres no Claude." }), el("div", { class: "row wrap", style: "gap:10px" }, [btnI("btn-primary", "plus", "Novo plano", () => editPlan(null)), btnI("", "upload", "Importar", () => go("importar"))])]));
    view.appendChild(stack);
  }
  function weekVolume(iso) { const m = mondayOf(iso), e = shiftDay(m, 6); return (S().sessions || []).filter((s) => s.date >= m && s.date <= e).reduce((a, s) => a + (s.volume || 0), 0); }

  /* ----------------------------- Sessão em curso ----------------------------- */
  function startSession(planId) {
    if (S().current) { sub = "hoje"; return Tabs.render("treino"); }
    const p = planId ? planById(planId) : null;
    const ll = S().lastLoads || {};
    const cur = { id: uid(), planId: p ? p.id : null, name: p ? p.name : "Treino livre", date: todayISO(), start: Date.now(),
      items: (p ? p.items : []).map((it) => ({ ex: it.ex, target: `${it.sets} × ${it.reps}`, rest: it.rest || 90, note: it.note || "", sets: Array.from({ length: it.sets || 3 }, (_, i) => { const last = (ll[it.ex] && ll[it.ex].sets || [])[i]; return { w: last ? last.w : "", r: "", done: false }; }) })) };
    Store.update(NS, (s) => { s.current = cur; });
    sub = "hoje"; Tabs.render("treino"); window.scrollTo(0, 0);
  }
  function updCur(fn, opts) { Store.update(NS, (s) => { if (s.current) fn(s.current); }, opts); }

  function renderSession(view) {
    const cur = S().current, ll = S().lastLoads || {};
    const doneSets = cur.items.reduce((a, it) => a + it.sets.filter((x) => x.done).length, 0), allSets = cur.items.reduce((a, it) => a + it.sets.length, 0);
    view.appendChild(pageHead({ eyebrow: "Treino em curso", icon: "timer", title: cur.name, sub: `${doneSets} de ${allSets} séries feitas`, actions: [
      el("div", { class: "elapsed num", "data-start": cur.start, text: elapsed(cur.start) }),
      el("button", { class: "btn btn-primary btn-lg", html: UI.icon("check", 18) + "<span>Terminar</span>", onclick: finishSession }),
    ] }));
    const b = UI.bar(allSets ? (doneSets / allSets) * 100 : 0); b.style.marginBottom = "18px";
    view.appendChild(b);
    const list = el("div", { class: "stack" });
    cur.items.forEach((it, idx) => {
      const e = Ex.get(it.ex) || { pt: "Exercício", m: [] };
      const last = ll[it.ex];
      const rows = it.sets.map((st, si) => {
        const w = el("input", { type: "number", inputmode: "decimal", step: "0.5", value: st.w, placeholder: "kg", "aria-label": "Peso da série " + (si + 1) });
        const r = el("input", { type: "number", inputmode: "numeric", value: st.r, placeholder: (last && last.sets[si] && last.sets[si].r) || "reps", "aria-label": "Repetições da série " + (si + 1) });
        const save = () => updCur((c) => { c.items[idx].sets[si].w = w.value; c.items[idx].sets[si].r = r.value; }, { silent: true });
        w.addEventListener("input", save); r.addEventListener("input", save);
        return el("div", { class: "set-row" + (st.done ? " done" : "") }, [
          el("span", { class: "set-n", text: si + 1 }), w, el("span", { class: "muted", text: "×" }), r,
          C.checkBtn(st.done, () => {
            const willDone = !st.done;
            updCur((c) => { const x = c.items[idx].sets[si]; x.w = w.value; x.r = r.value || (last && last.sets[si] && last.sets[si].r) || ""; x.done = willDone; });
            if (willDone) Rest.start(it.rest || 90, Ex.name(it.ex));
          }, "Série feita"),
        ]);
      });
      list.appendChild(el("div", { class: "card session-ex" }, [
        el("div", { class: "se-head" }, [
          el("div", { class: "se-thumb", onclick: () => demo(it.ex) }, [thumb(it.ex, { size: "md" })]),
          el("div", { class: "grow" }, [
            el("div", { class: "t", text: e.pt || e.n }),
            el("div", { class: "s", text: `${it.target || it.sets.length + " séries"} · descanso ${it.rest}s` }),
            last ? el("div", { class: "s", text: "Última vez: " + last.sets.map((x) => `${x.w || 0}×${x.r || 0}`).join(", ") }) : null,
            it.note ? el("div", { class: "s", style: "color:var(--accent-ink)", text: it.note }) : null,
          ]),
          el("button", { class: "btn btn-ghost btn-icon btn-sm", "aria-label": "Mais opções", html: UI.icon("sliders", 16), onclick: (ev) => UI.popover(ev.currentTarget, [
            { label: "Ver como se faz", icon: "play", onClick: () => demo(it.ex) },
            { label: "Trocar exercício", icon: "swap", onClick: () => pickExercise((nx) => updCur((c) => { c.items[idx].ex = nx.id; }), { title: "Trocar por…" }) },
            { label: "Subir", icon: "up", onClick: () => updCur((c) => { if (idx > 0) [c.items[idx - 1], c.items[idx]] = [c.items[idx], c.items[idx - 1]]; }) },
            { label: "Remover", icon: "trash", onClick: () => updCur((c) => { c.items.splice(idx, 1); }) },
          ]) }),
        ]),
        el("div", { class: "sets" }, rows),
        el("div", { class: "row", style: "gap:8px;margin-top:10px" }, [
          el("button", { class: "btn btn-sm btn-soft", text: "+ Série", onclick: () => updCur((c) => { const ls = c.items[idx].sets; const p = ls[ls.length - 1]; ls.push({ w: p ? p.w : "", r: "", done: false }); }) }),
          it.sets.length > 1 ? el("button", { class: "btn btn-sm btn-ghost", text: "− Série", onclick: () => updCur((c) => { c.items[idx].sets.pop(); }) }) : null,
        ]),
      ]));
    });
    list.appendChild(el("div", { class: "row wrap", style: "gap:10px" }, [
      btnI("", "plus", "Adicionar exercício", () => pickExercise((e) => updCur((c) => { const last = (S().lastLoads || {})[e.id]; c.items.push({ ex: e.id, target: `${e.sets || 3} × ${e.reps || "8-12"}`, rest: e.rest || 90, sets: Array.from({ length: e.sets || 3 }, (_, i) => ({ w: last && last.sets[i] ? last.sets[i].w : "", r: "", done: false })) }); }))),
      el("button", { class: "btn btn-ghost", text: "Cancelar treino", onclick: async () => { if (!(await UI.confirm("Cancelar este treino? As séries registadas perdem-se.", { ok: "Cancelar treino", danger: true }))) return; Rest.stop(); Store.update(NS, (s) => { s.current = null; }); } }),
    ]));
    view.appendChild(list);
  }
  function elapsed(start) { const s = Math.max(0, Math.floor((Date.now() - start) / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0"); }
  setInterval(() => document.querySelectorAll(".elapsed[data-start]").forEach((n) => { n.textContent = elapsed(+n.dataset.start); }), 1000);

  function finishSession() {
    const cur = JSON.parse(JSON.stringify(S().current)); if (!cur) return;
    // séries com dados mas sem ✓ também contam (esquecer-se de marcar é comum)
    cur.items.forEach((it) => it.sets.forEach((s) => { if (!s.done && (+s.w || 0) > 0 && (+s.r || 0) > 0) s.done = true; }));
    cur.items = cur.items.map((it) => ({ ex: it.ex, sets: it.sets.filter((s) => s.done).map((s) => ({ w: +s.w || 0, r: +s.r || 0 })) })).filter((it) => it.sets.length);
    if (!cur.items.length) { UI.confirm("Não registaste nenhuma série. Descartar o treino?", { ok: "Descartar", danger: true }).then((ok) => { if (ok) { Rest.stop(); Store.update(NS, (s) => { s.current = null; }); } }); return; }
    const prs = [];
    cur.items.forEach((it) => { const before = bestOf(it.ex); const top = it.sets.reduce((b, s) => (e1rm(s.w, s.r) > e1rm(b.w, b.r) ? s : b), it.sets[0]); if (e1rm(top.w, top.r) > 0 && (!before || e1rm(top.w, top.r) > before.v + 0.01)) prs.push({ ex: it.ex, w: top.w, r: top.r }); });
    const session = { id: cur.id, date: cur.date, planId: cur.planId, name: cur.name, start: cur.start, end: Date.now(), items: cur.items,
      volume: Math.round(cur.items.reduce((a, it) => a + it.sets.reduce((b, s) => b + s.w * s.r, 0), 0)), setsDone: cur.items.reduce((a, it) => a + it.sets.length, 0), prs };
    Rest.stop();
    Store.update(NS, (s) => {
      s.sessions = s.sessions || []; s.sessions.push(session); s.current = null;
      s.lastLoads = s.lastLoads || {}; cur.items.forEach((it) => { s.lastLoads[it.ex] = { sets: it.sets.map((x) => ({ w: x.w, r: x.r })), when: Date.now() }; });
    });
    sheet("Treino registado", [
      el("div", { class: "done-hero" }, [ico("trophy", 34), el("div", { class: "big-num num", text: `${session.setsDone} séries` }), el("div", { class: "muted", text: `${num(session.volume)} kg de volume · ${Math.round((session.end - session.start) / 60000)} min` })]),
      prs.length ? el("div", {}, [el("div", { class: "section-title", text: "Novos recordes" }), ...prs.map((p) => el("div", { class: "pr-line" }, [ico("star", 16), el("span", { html: `${Ex.name(p.ex)}: <b>${num(p.w, 1)} kg × ${p.r}</b>` })]))]) : null,
      el("p", { class: "tiny muted", text: "Contou como dia de treino na Nutrição (+12% de hidratos hoje)." }),
    ]);
  }

  /* ----------------------------- Descanso (cronómetro) ----------------------------- */
  const Rest = (function () {
    let end = 0, total = 0, t = null, node = null, label = "";
    function draw() {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (!node) {
        node = el("div", { class: "rest-fab", role: "timer" }, [
          el("div", { class: "rf-ring" }), el("div", { class: "rf-text" }, [el("b", { class: "num" }), el("span")]),
          el("button", { class: "btn btn-sm", text: "−15", onclick: () => { end -= 15000; draw(); } }),
          el("button", { class: "btn btn-sm", text: "+15", onclick: () => { end += 15000; total += 15; draw(); } }),
          el("button", { class: "btn btn-sm btn-primary", text: "Saltar", onclick: stop }),
        ]);
        document.body.appendChild(node);
      }
      node.querySelector("b").textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
      node.querySelector(".rf-text span").textContent = left ? "descanso · " + label : "Bora, próxima série!";
      node.querySelector(".rf-ring").style.setProperty("--p", total ? (1 - left / total) * 100 : 100);
      node.classList.toggle("go", !left);
      if (!left && t) { clearInterval(t); t = null; beep(); setTimeout(() => { if (node && Date.now() >= end) stop(); }, 6000); }
    }
    function start(sec, lbl) { end = Date.now() + sec * 1000; total = sec; label = lbl || ""; clearInterval(t); t = setInterval(draw, 250); draw(); }
    function stop() { clearInterval(t); t = null; if (node) node.remove(); node = null; }
    function beep() {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25].forEach((d) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.2, ac.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d + 0.2); o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.22); }); } catch (e) { /* sem som */ }
    }
    return { start, stop };
  })();

  /* ----------------------------- Planos ----------------------------- */
  function renderPlanos(view, bar) {
    view.appendChild(pageHead({ eyebrow: "Treino", icon: "list", title: "Planos", sub: "Os teus treinos. Toca num exercício para veres como se faz.", actions: [btnI("btn-primary", "plus", "Novo plano", () => editPlan(null)), btnI("", "upload", "Importar", () => go("importar"))] }));
    view.appendChild(bar);
    view.appendChild(plans().length ? el("div", { class: "slot-grid" }, plans().map((p) => planCard(p))) : panel({}, [el("div", { class: "empty", text: "Sem planos. Cria um ou importa do Claude." })]));
  }
  function editPlan(p0) {
    const p = p0 ? JSON.parse(JSON.stringify(p0)) : { id: "p_" + uid(), name: "", color: PLAN_COLORS[plans().length % PLAN_COLORS.length], items: [] };
    const fn = field("Nome", { value: p.name, placeholder: "ex: Push A, Pernas, Full body" });
    const colors = el("div", { class: "row", style: "gap:8px" }, PLAN_COLORS.map((c) => el("button", { type: "button", class: "color-dot" + (p.color === c ? " on" : ""), style: "background:" + c, "aria-label": "Cor", onclick: (e) => { p.color = c; [...colors.children].forEach((x) => x.classList.toggle("on", x === e.currentTarget)); } })));
    const box = el("div", { class: "list" });
    const draw = () => {
      clear(box);
      if (!p.items.length) box.appendChild(el("div", { class: "empty tiny", text: "Ainda sem exercícios." }));
      p.items.forEach((it, i) => {
        const sets = el("input", { type: "number", inputmode: "numeric", value: it.sets, "aria-label": "Séries", class: "mini" });
        const reps = el("input", { type: "text", value: it.reps, "aria-label": "Repetições", class: "mini wide" });
        const rest = el("input", { type: "number", inputmode: "numeric", value: it.rest, "aria-label": "Descanso (s)", class: "mini" });
        sets.addEventListener("input", () => { it.sets = Math.max(1, +sets.value || 1); }); reps.addEventListener("input", () => { it.reps = reps.value; }); rest.addEventListener("input", () => { it.rest = +rest.value || 0; });
        box.appendChild(el("div", { class: "item plan-item" }, [
          el("div", { onclick: () => demo(it.ex), style: "cursor:pointer" }, [thumb(it.ex, { size: "sm" })]),
          el("div", { class: "grow" }, [el("div", { class: "t", text: Ex.name(it.ex) }), el("div", { class: "pi-fields" }, [sets, el("span", { class: "muted tiny", text: "séries ×" }), reps, el("span", { class: "muted tiny", text: "reps ·" }), rest, el("span", { class: "muted tiny", text: "s" })])]),
          el("div", { class: "pi-acts" }, [
            el("button", { class: "btn btn-ghost btn-icon btn-sm", "aria-label": "Subir", text: "↑", disabled: i === 0, onclick: () => { [p.items[i - 1], p.items[i]] = [p.items[i], p.items[i - 1]]; draw(); } }),
            el("button", { class: "btn btn-ghost btn-icon btn-sm", "aria-label": "Remover", html: UI.icon("x", 16), onclick: () => { p.items.splice(i, 1); draw(); } }),
          ]),
        ]));
      });
    };
    draw();
    const sh = sheet(p0 ? "Editar plano" : "Novo plano", [fn, colors, el("div", { class: "section-title", text: "Exercícios" }), box,
      el("button", { class: "btn btn-block", html: UI.icon("plus", 18) + "<span>Adicionar exercício</span>", onclick: () => pickExercise((e) => { p.items.push({ id: uid(), ex: e.id, sets: e.sets || 3, reps: e.reps || "8-12", rest: e.rest || 90 }); draw(); }) }),
      el("div", { class: "row", style: "gap:10px" }, [
        p0 ? el("button", { class: "btn btn-danger btn-block", text: "Apagar", onclick: async () => {
          if (!(await UI.confirm(`Apagar o plano "${p.name}"? O histórico mantém-se.`, { ok: "Apagar", danger: true }))) return;
          Store.update(NS, (s) => { s.plans = s.plans.filter((x) => x.id !== p.id); for (const d in s.schedule) if (s.schedule[d] === p.id) delete s.schedule[d]; }); sh.close();
        } }) : null,
        p0 ? el("button", { class: "btn btn-block", text: "Duplicar", onclick: () => { const c = { ...JSON.parse(JSON.stringify(p)), id: "p_" + uid(), name: p.name + " (cópia)" }; Store.update(NS, (s) => { s.plans.push(c); }); sh.close(); toast("Duplicado ✓"); } }) : null,
        el("button", { class: "btn btn-primary btn-block", text: "Guardar", onclick: () => {
          p.name = fn.input.value.trim(); if (!p.name) return toast("Dá um nome ao plano.");
          Store.update(NS, (s) => { const i = s.plans.findIndex((x) => x.id === p.id); if (i >= 0) s.plans[i] = p; else s.plans.push(p); }); sh.close(); toast("Plano guardado ✓");
        } }),
      ]),
    ]);
  }

  /* ----------------------------- Semana ----------------------------- */
  function renderSemana(view, bar) {
    const sch = S().schedule || {}, today = new Date().getDay();
    view.appendChild(pageHead({ eyebrow: "Treino", icon: "calendar", title: "Semana", sub: "O que treinas em cada dia. Aparece no Hoje e conta para a meta semanal." }));
    view.appendChild(bar);
    const opts = [{ value: "", label: "— Livre —" }, ...plans().map((p) => ({ value: p.id, label: p.name })), { value: "run", label: "Corrida / futebol" }, { value: "rest", label: "Descanso" }];
    const m = mondayOf(todayISO());
    const rows = DAYS.map((d, i) => {
      const f = field("", { type: "select", value: sch[d.g] || "", options: opts, "aria-label": d.label });
      f.input.addEventListener("change", () => Store.update(NS, (s) => { s.schedule = s.schedule || {}; if (f.input.value) s.schedule[d.g] = f.input.value; else delete s.schedule[d.g]; }));
      const iso = shiftDay(m, i), did = (S().sessions || []).filter((s) => s.date === iso);
      return el("div", { class: "week-row" + (d.g === today ? " today" : "") }, [
        el("div", { class: "wr-day" }, [el("b", { text: d.label }), el("span", { class: "tiny muted", text: UI.prettyDate(iso) })]),
        el("div", { class: "wr-sel" }, [f]),
        el("div", { class: "wr-done tiny", text: did.length ? "✓ " + did.map((x) => x.name).join(", ") : "" }),
      ]);
    });
    const goal = field("Meta de treinos por semana", { type: "number", value: S().weeklyGoal || 4, inputmode: "numeric", min: 1, max: 14 });
    goal.input.addEventListener("change", () => Store.update(NS, (s) => { s.weeklyGoal = Math.max(1, Math.min(14, +goal.input.value || 4)); }));
    view.appendChild(el("div", { class: "stack" }, [panel({ title: "Plano semanal", sub: `Semana de ${UI.prettyDate(m)}` }, rows), panel({ title: "Meta" }, [goal])]));
  }

  /* ----------------------------- Histórico ----------------------------- */
  function renderHistorico(view, bar) {
    const ss = sessions();
    view.appendChild(pageHead({ eyebrow: "Treino", icon: "clock", title: "Histórico", sub: `${ss.length} treinos registados.` }));
    view.appendChild(bar);
    if (!ss.length) return view.appendChild(panel({}, [el("div", { class: "empty", text: "Os treinos que terminares aparecem aqui." })]));
    const byWeek = {}; ss.forEach((s) => { const w = mondayOf(s.date); (byWeek[w] = byWeek[w] || []).push(s); });
    view.appendChild(el("div", { class: "stack" }, Object.keys(byWeek).sort().reverse().slice(0, 26).map((w) => panel({ title: "Semana de " + UI.prettyDate(w), sub: `${byWeek[w].length} treinos · ${num(byWeek[w].reduce((a, s) => a + (s.volume || 0), 0))} kg` }, byWeek[w].map((s) => el("button", { class: "item pick", onclick: () => sessionSheet(s) }, [
      el("span", { class: "item-ico", html: UI.icon("dumbbell", 20) }),
      el("div", { class: "grow" }, [el("div", { class: "t", text: s.name }), el("div", { class: "s", text: `${UI.prettyDate(s.date)} · ${s.setsDone || 0} séries` + (s.end && s.start ? ` · ${Math.round((s.end - s.start) / 60000)} min` : "") + (s.prs && s.prs.length ? ` · ${s.prs.length} recorde${s.prs.length > 1 ? "s" : ""}` : "") + (s.legacy ? " · gymos" : "") })]),
      el("div", { class: "amt num", text: s.volume ? num(s.volume) + " kg" : "" }),
    ]))))));
  }
  function sessionSheet(s) {
    const sh = sheet(s.name, [
      el("div", { class: "tiny muted", text: `${UI.prettyDate(s.date)} · ${s.setsDone || 0} séries · ${num(s.volume || 0)} kg` }),
      ...(s.items || []).map((it) => el("div", { class: "item" }, [thumb(it.ex, { size: "sm" }), el("div", { class: "grow" }, [el("div", { class: "t", text: Ex.name(it.ex) }), el("div", { class: "s", text: it.sets.map((x) => `${num(x.w, 1)}×${x.r}`).join(" · ") })])])),
      s.legacy && !(s.items || []).length ? el("p", { class: "tiny muted", text: "Registo importado do gymos antigo (só tinha o resumo da sessão)." }) : null,
      el("button", { class: "btn btn-danger btn-block", text: "Apagar treino", onclick: async () => {
        if (!(await UI.confirm("Apagar este treino do histórico?", { ok: "Apagar", danger: true }))) return;
        const snap = JSON.parse(JSON.stringify(s));
        Store.update(NS, (st) => { st.sessions = st.sessions.filter((x) => x.id !== s.id); }); sh.close();
        undo("Treino apagado", () => Store.update(NS, (st) => { st.sessions.push(snap); }));
      } }),
    ]);
  }

  /* ----------------------------- Importar (Claude / TikTok) ----------------------------- */
  const DAY_IDS = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
  function claudePrompt() {
    const names = (global.EXERCISES || []).filter((e) => ["forca", "core"].includes(e.cat)).map((e) => e.n).join("; ");
    return `Vou dar-te o conteúdo da minha pasta "Físico" do TikTok (descrições, legendas ou transcrições dos vídeos guardados). Quero que transformes isso em planos de treino para a minha app.

Responde APENAS com JSON válido neste formato:
{
  "plans": [
    {
      "name": "Push A",
      "days": ["seg"],
      "notes": "de onde veio (ex: vídeo de @criador)",
      "exercises": [
        { "name": "Barbell Bench Press", "sets": 3, "reps": "6-10", "rest": 120, "note": "dica curta do vídeo" }
      ]
    }
  ],
  "exercises": [
    { "name": "Nome em inglês", "pt": "Nome em português", "muscles": ["chest"], "equipment": "cabo", "anim": "fly", "cue": "como fazer", "steps": ["passo 1", "passo 2", "passo 3"] }
  ]
}

Regras:
- "days" é opcional: seg, ter, qua, qui, sex, sab, dom.
- Usa, sempre que existir, o nome exato de um destes exercícios (já tenho animação para eles): ${names}.
- Só cria entradas em "exercises" para exercícios que NÃO estão nessa lista.
- muscles possíveis: ${Object.keys(MUSCLES).join(", ")}.
- anim possíveis (a animação mais parecida): ${Object.keys(global.MOTIONS || {}).join(", ")}.
- reps em texto ("8-12", "10", "30 seg"); rest em segundos.
- Respeita as minhas regras: 9 séries por grupo muscular por semana, mínimo 2 treinos por semana por músculo, tríceps com 1 exercício acima da cabeça + 1 com o cotovelo atrás do tronco.`;
  }
  function renderImportar(view, bar) {
    view.appendChild(pageHead({ eyebrow: "Treino", icon: "upload", title: "Importar planos", sub: "Cria os planos no Claude a partir da tua pasta do TikTok e cola aqui o resultado." }));
    view.appendChild(bar);
    const ta = el("textarea", { class: "code-area", placeholder: '{ "plans": [ … ] }', spellcheck: "false", "aria-label": "JSON dos planos" });
    const out = el("div", {});
    view.appendChild(el("div", { class: "grid-2" }, [
      panel({ title: "1. Pede ao Claude", sub: "Copia o pedido, cola no Claude junto com os vídeos/legendas da pasta “Físico”." }, [
        el("ol", { class: "steps" }, [el("li", { text: "No TikTok, abre a pasta Físico e copia as legendas ou transcrições (ou partilha os links)." }), el("li", { text: "Cola no Claude este pedido + esse conteúdo." }), el("li", { text: "Copia o JSON que ele devolver e cola ao lado." })]),
        el("button", { class: "btn btn-primary btn-block", html: UI.icon("copy", 18) + "<span>Copiar pedido para o Claude</span>", onclick: async () => { try { await navigator.clipboard.writeText(claudePrompt()); toast("Pedido copiado ✓"); } catch (e) { sheet("Pedido para o Claude", [el("textarea", { class: "code-area", text: claudePrompt() })]); } } }),
        el("details", { style: "margin-top:12px" }, [el("summary", { class: "tiny muted", style: "cursor:pointer", text: "Ver o pedido" }), el("pre", { class: "code-pre", text: claudePrompt() })]),
      ]),
      panel({ title: "2. Cola o resultado", sub: "Também aceita o formato antigo do gymos." }, [ta,
        el("div", { class: "row", style: "gap:10px;margin-top:12px" }, [
          el("button", { class: "btn btn-block", text: "Pré-visualizar", onclick: () => preview(false) }),
          el("button", { class: "btn btn-primary btn-block", text: "Importar", onclick: () => preview(true) }),
        ]), out]),
    ]));
    function preview(apply) {
      let data; clear(out);
      try { data = parseImport(ta.value); } catch (e) { out.appendChild(el("p", { style: "color:var(--bad)", text: "JSON inválido: " + e.message })); return; }
      if (!data.plans.length) { out.appendChild(el("p", { style: "color:var(--bad)", text: "Não encontrei planos nesse texto." })); return; }
      if (apply) {
        const r = importPlans(data);
        toast(`${r.plans} plano${r.plans > 1 ? "s" : ""} importado${r.plans > 1 ? "s" : ""} ✓`, 3000);
        ta.value = ""; go("planos"); return;
      }
      out.appendChild(el("div", { class: "list", style: "margin-top:12px" }, data.plans.map((p) => el("div", { class: "item" }, [el("div", { class: "grow" }, [
        el("div", { class: "t", text: p.name + (p.days.length ? " · " + p.days.map((g) => DAYS.find((d) => d.g === g).label.slice(0, 3)).join(", ") : "") }),
        el("div", { class: "s", html: p.exercises.map((x) => { const f = Ex.find(x.name); return f ? `✓ ${f.pt}` : `<span style="color:var(--warn)">＋ ${x.name} (novo)</span>`; }).join(" · ") }),
      ])]))));
    }
  }
  function parseImport(text) {
    let raw = text.trim(); const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) raw = m[1];
    let j = JSON.parse(raw);
    let planArr = Array.isArray(j) ? j : j.plans ? j.plans : j.name ? [j] : [];
    const extra = (!Array.isArray(j) && j.exercises && j.plans) ? j.exercises : [];
    const plans = planArr.map((p) => ({
      name: String(p.name || p.nome || "Plano importado"), notes: p.notes || p.sub || "",
      days: [].concat(p.days || p.day || p.dias || []).map((d) => (typeof d === "number" ? d : DAY_IDS[norm(d).slice(0, 7)] != null ? DAY_IDS[norm(d).slice(0, 7)] : DAY_IDS[norm(d).slice(0, 3)])).filter((x) => x != null),
      exercises: (p.exercises || p.items || p.exercicios || []).map((x) => {
        const sets = +x.sets || (String(x.t || x.range || "").match(/^(\d+)\s*[×x]/) || [])[1] || 3;
        const reps = x.reps || (String(x.range || x.t || "").replace(/^\d+\s*[×x]\s*/, "")) || "8-12";
        return { name: String(x.name || x.n || x.nome || "").trim(), sets: +sets, reps: String(reps), rest: +x.rest || +x.descanso || 90, note: x.note || x.cue || "" };
      }).filter((x) => x.name),
    }));
    return { plans, exercises: extra };
  }
  function importPlans({ plans: arr, exercises: extra }, { source = "Claude" } = {}) {
    (extra || []).forEach((x) => Ex.ensure({ name: x.name || x.n, pt: x.pt, muscles: x.muscles || x.m, equipment: x.equipment || x.eq, anim: x.anim, cue: x.cue, steps: x.steps, cat: x.cat }));
    let n = 0;
    arr.forEach((p, k) => {
      const plan = { id: "p_" + uid(), name: p.name, color: PLAN_COLORS[(plans().length + k) % PLAN_COLORS.length], source, notes: p.notes,
        items: p.exercises.map((x) => ({ id: uid(), ex: Ex.ensure({ name: x.name }), sets: x.sets || 3, reps: x.reps || "8-12", rest: x.rest || 90, note: x.note || "" })) };
      Store.update(NS, (s) => { s.plans.push(plan); (p.days || []).forEach((g) => { s.schedule[g] = plan.id; }); });
      n++;
    });
    return { plans: n };
  }

  global.Treino = { init, render, go, trainedOn, scheduledFor, planById, plans, sessions, weekCount, weekVolume, bestOf, historyOf, setsByMuscle, startSession, demo, thumb, pickExercise, editExercise, Ex, MUSCLES, CATS, DAYS, e1rm, parseImport, importPlans, Rest };
})(window);
