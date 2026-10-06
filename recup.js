/* =====================================================================
   recup.js — Recuperação: check-in diário (sono, energia, dores, stress,
   FC em repouso), prontidão para treinar, recuperação por músculo a
   partir das séries feitas, mobilidade do dia e rotinas guiadas com
   animação e temporizador.
   Dados: "body" (check-ins, medidas) e "gym".stretchLog (rotinas feitas).
   ===================================================================== */
(function (global) {
  const { el, clear, num, toast, sheet, field, todayISO, guardClick } = UI;
  const { ico, btnI, pageHead, panel, linkBtn, kpi, shiftDay, barChart, checkBtn } = C;
  const NS = "body";
  const S = () => Store.get(NS);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  function init() { Store.ensure(NS, { checkins: {}, measures: {} }); }
  const checkin = (iso) => (S().checkins || {})[iso] || null;

  /* ----------------------------- Prontidão ----------------------------- */
  function hrBaseline(iso) {
    const v = []; for (let i = 1; i <= 21; i++) { const c = checkin(shiftDay(iso, -i)); if (c && +c.hr) v.push(+c.hr); }
    return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  /** 0-100 a partir do check-in; null sem check-in. */
  function readiness(iso = todayISO()) {
    const c = checkin(iso); if (!c) return null;
    const parts = [];
    if (+c.sleep) parts.push([clamp((+c.sleep - 4.5) / 3.5), 0.25]);
    if (c.sleepQ) parts.push([(c.sleepQ - 1) / 4, 0.15]);
    if (c.energy) parts.push([(c.energy - 1) / 4, 0.2]);
    if (c.sore) parts.push([1 - (c.sore - 1) / 4, 0.2]);
    if (c.stress) parts.push([1 - (c.stress - 1) / 4, 0.1]);
    const base = hrBaseline(iso);
    if (+c.hr && base) parts.push([1 - clamp((+c.hr - base) / 8), 0.1]);
    if (!parts.length) return null;
    let score = parts.reduce((a, [v, w]) => a + v * w, 0) / parts.reduce((a, [, w]) => a + w, 0);
    // carga dos últimos 2 dias: muitas séries seguidas pesam
    if (global.Treino) { const load = Object.values(Treino.setsByMuscle(shiftDay(iso, -2), shiftDay(iso, -1))).reduce((a, b) => a + b, 0); score -= clamp((load - 30) / 200, 0, 0.15); }
    return Math.round(clamp(score) * 100);
  }
  function readinessLabel(s) {
    if (s == null) return { t: "Sem check-in", d: "Faz o check-in para saberes como estás.", tone: "" };
    if (s >= 75) return { t: "Pronto para treinar forte", d: "Bom dia para cargas pesadas ou recordes.", tone: "good" };
    if (s >= 55) return { t: "Treino normal", d: "Treina como planeado e ouve o corpo.", tone: "" };
    if (s >= 40) return { t: "Vai com calma", d: "Reduz o volume (menos 1 série por exercício) ou a intensidade.", tone: "warn" };
    return { t: "Dia de recuperação", d: "Mobilidade, caminhada e dormir bem valem mais hoje do que treinar pesado.", tone: "bad" };
  }

  /* ----------------------------- Recuperação muscular ----------------------------- */
  const GROUPS = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core"];
  const ALIAS = { rear_delts: "shoulders", traps: "back", forearms: "biceps", adductors: "quads", hip_flexors: "quads" };
  /** % recuperado por grupo: cada série conta 1 (músculo principal) ou ½ (secundário) e desaparece ao longo de 72 h. */
  function muscleRecovery(now = Date.now()) {
    const fat = {}; GROUPS.forEach((g) => { fat[g] = 0; });
    if (global.Treino) {
      (Store.get("gym").sessions || []).forEach((s) => {
        const t = s.end || new Date(s.date + "T19:00:00").getTime(); const h = (now - t) / 3600000;
        if (h < 0 || h > 72) return;
        const decay = 1 - h / 72;
        (s.items || []).forEach((it) => {
          const e = Treino.Ex.get(it.ex); if (!e) return; const n = (it.sets || []).length;
          (e.m || []).forEach((m, i) => { const g = ALIAS[m] || m; if (g in fat) fat[g] += n * (i === 0 ? 1 : 0.5) * decay; });
        });
      });
    }
    const c = checkin(todayISO());
    ((c && c.soreAreas) || []).forEach((g) => { if (g in fat) fat[g] += 4; });
    const out = {}; GROUPS.forEach((g) => { out[g] = Math.round(clamp(1 - fat[g] / 10) * 100); });
    return out;
  }

  /* ----------------------------- Check-in ----------------------------- */
  const FACES = ["😫", "😕", "😐", "🙂", "😄"];
  function scaleRow(label, val, onPick, { faces = FACES, low, high } = {}) {
    const row = el("div", { class: "scale" });
    faces.forEach((f, i) => row.appendChild(el("button", { type: "button", class: val === i + 1 ? "on" : "", text: f, "aria-label": `${label}: ${i + 1} de 5`, onclick: (e) => { [...row.children].forEach((b) => b.classList.toggle("on", b === e.currentTarget)); onPick(i + 1); } })));
    return el("label", { class: "field" }, [el("span", { text: label + (low ? ` (1 = ${low}, 5 = ${high})` : "") }), row]);
  }
  function checkinSheet(iso = todayISO()) {
    const c = { ...(checkin(iso) || {}) };
    const yest = checkin(shiftDay(iso, -1)) || {};
    const fSleep = field("Horas de sono", { type: "number", value: c.sleep || "", inputmode: "decimal", step: "0.25", placeholder: yest.sleep ? `ontem: ${yest.sleep}` : "ex: 7.5" });
    const fHr = field("FC em repouso (bpm)", { type: "number", value: c.hr || "", inputmode: "numeric", placeholder: "opcional" });
    const fSteps = field("Passos (ontem)", { type: "number", value: c.steps || "", inputmode: "numeric", placeholder: "opcional" });
    const fNotes = field("Notas", { type: "textarea", value: c.notes || "", placeholder: "Dores, como dormiste, lesões…" });
    const sore = new Set(c.soreAreas || []);
    const soreRow = el("div", { class: "chip-row" }, GROUPS.map((g) => { const b = el("button", { type: "button", class: "pill pill-btn" + (sore.has(g) ? " on" : ""), text: Treino.MUSCLES[g], onclick: () => { sore.has(g) ? sore.delete(g) : sore.add(g); b.classList.toggle("on"); } }); return b; }));
    const sh = sheet("Check-in · " + (iso === todayISO() ? "hoje" : UI.prettyDate(iso)), [
      el("div", { class: "input-row" }, [fSleep, fHr]),
      scaleRow("Qualidade do sono", c.sleepQ, (v) => { c.sleepQ = v; }),
      scaleRow("Energia", c.energy, (v) => { c.energy = v; }),
      scaleRow("Dores musculares", c.sore, (v) => { c.sore = v; }, { faces: ["1", "2", "3", "4", "5"], low: "nada", high: "muitas" }),
      scaleRow("Stress", c.stress, (v) => { c.stress = v; }, { faces: ["1", "2", "3", "4", "5"], low: "calmo", high: "muito" }),
      el("label", { class: "field" }, [el("span", { text: "Onde te dói? (opcional)" }), soreRow]),
      fSteps, fNotes,
      el("button", { class: "btn btn-primary btn-block btn-lg", text: "Guardar check-in", onclick: guardClick(() => {
        const data = { ...c, sleep: +String(fSleep.input.value).replace(",", ".") || null, hr: +fHr.input.value || null, steps: +fSteps.input.value || null, notes: fNotes.input.value.trim(), soreAreas: [...sore], at: Date.now() };
        Object.keys(data).forEach((k) => (data[k] == null || data[k] === "") && delete data[k]);
        Store.update(NS, (s) => { s.checkins = s.checkins || {}; s.checkins[iso] = data; });
        sh.close();
        const r = readiness(iso); toast(r != null ? `Prontidão ${r}/100 — ${readinessLabel(r).t}` : "Check-in guardado ✓", 3200);
      }) }),
    ]);
  }

  /* ----------------------------- Rotinas guiadas ----------------------------- */
  /** Converte "30 seg/lado", "2 × 10", "3 × 30-45 seg" em { secs, sides, rounds, reps }. */
  function parseDose(d) {
    const s = String(d || "").toLowerCase();
    const rounds = +((s.match(/^(\d+)\s*[×x]/) || [])[1] || 1);
    const sec = s.match(/(\d+)(?:\s*-\s*(\d+))?\s*(seg|s\b)/);
    const sides = /lado|perna|pé|braço/.test(s) ? 2 : 1;
    const reps = !sec ? +((s.match(/[×x]\s*(\d+)/) || s.match(/^(\d+)\s*(por|cada|$)/) || [])[1] || 0) : 0;
    return { secs: sec ? +(sec[2] || sec[1]) : 0, sides, rounds, reps };
  }
  /** Rotina passo a passo: items = [{ex, dose}]. */
  function routine(items, title, { onFinish, logIso } = {}) {
    let i = 0, timer = null, left = 0, side = 1, player = null, paused = false;
    const stage = el("div", { class: "demo-stage" }), name = el("div", { class: "rt-name" }), meta = el("div", { class: "tiny muted" });
    const steps = el("ol", { class: "steps compact" }), clock = el("div", { class: "rt-clock num" }), sideL = el("div", { class: "tiny muted center" });
    const dots = el("div", { class: "rt-dots" });
    const prevB = el("button", { class: "btn btn-icon", "aria-label": "Anterior", title: "Anterior", html: UI.icon("left", 20), onclick: () => go(i - 1) });
    const mainB = el("button", { class: "btn btn-primary btn-lg grow", onclick: () => main() });
    const nextB = el("button", { class: "btn btn-icon", "aria-label": "Saltar", title: "Saltar", html: UI.icon("right", 20), onclick: () => next() });
    function go(k) {
      clearInterval(timer); timer = null; if (player) player.destroy();
      i = Math.max(0, Math.min(items.length - 1, k)); side = 1; paused = false;
      const it = items[i], e = Treino.Ex.get(it.ex) || { pt: "Exercício" }, d = parseDose(it.dose);
      left = d.secs;
      clear(stage); const m = global.MOTIONS && MOTIONS[e.anim];
      if (m) { player = Anim.player(m, { label: e.pt }); stage.appendChild(player.el); } else player = null;
      name.textContent = e.pt || e.n; meta.textContent = [it.dose, (e.m || []).map((x) => Treino.MUSCLES[x]).join(", ")].filter(Boolean).join(" · ");
      clear(steps).append(...Treino.Ex.stepsOf(e).slice(0, 4).map((s) => el("li", { text: s })));
      clear(dots).append(...items.map((_, k2) => el("i", { class: k2 < i ? "done" : k2 === i ? "cur" : "" })));
      prevB.disabled = i === 0;
      draw();
    }
    function draw() {
      const d = parseDose(items[i].dose);
      if (d.secs) {
        clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        sideL.textContent = d.sides > 1 ? `Lado ${side} de 2` : d.rounds > 1 ? `${d.rounds} rondas` : "";
        mainB.textContent = timer ? "Pausa" : left === d.secs && side === 1 ? "Começar" : left === 0 ? "Feito ✓" : "Continuar";
      } else {
        clock.textContent = d.reps ? `${d.rounds > 1 ? d.rounds + " × " : ""}${d.reps}` : "—";
        sideL.textContent = d.reps ? "repetições" + (d.sides > 1 ? " por lado" : "") : "";
        mainB.textContent = "Feito ✓";
      }
    }
    function main() {
      const d = parseDose(items[i].dose);
      if (!d.secs || left === 0) return next(true);
      if (timer) { clearInterval(timer); timer = null; return draw(); }
      timer = setInterval(() => {
        left--; if (left <= 0) {
          left = 0; clearInterval(timer); timer = null; if (navigator.vibrate) navigator.vibrate(150);
          if (side < d.sides) { side++; left = d.secs; toast("Troca de lado"); timer = null; draw(); return main(); }
        }
        draw();
      }, 1000);
      draw();
    }
    function next(done) {
      if (done && logIso) Store.update("gym", (s) => { s.stretchLog = s.stretchLog || {}; s.stretchLog[logIso] = { ...(s.stretchLog[logIso] || {}), [items[i].ex]: true }; }, { silent: true });
      if (i >= items.length - 1) { clearInterval(timer); sh.close(); toast("Rotina concluída ✓"); if (onFinish) onFinish(); if (logIso) Store.emit("gym"); return; }
      go(i + 1);
    }
    const sh = sheet(title, [dots, stage, name, meta, el("div", { class: "rt-timer" }, [clock, sideL]), steps, el("div", { class: "row", style: "gap:8px" }, [prevB, mainB, nextB])], { onClose: () => { clearInterval(timer); if (player) player.destroy(); if (logIso) Store.emit("gym"); } });
    sh.el.classList.add("routine-sheet");
    go(0);
    return sh;
  }
  const dailyRoutine = (iso = todayISO()) => { const D = global.GYM_DEFAULTS; return D && D.stretchPlan[new Date(iso + "T00:00:00").getDay()]; };
  const stretchDone = (iso, exId) => !!(((Store.get("gym").stretchLog || {})[iso] || {})[exId]);
  function toggleStretch(iso, exId) { Store.update("gym", (s) => { s.stretchLog = s.stretchLog || {}; const d = { ...(s.stretchLog[iso] || {}) }; d[exId] = !d[exId]; s.stretchLog[iso] = d; }); }

  function mobilityPanel(iso = todayISO(), { compact = false } = {}) {
    const r = dailyRoutine(iso); if (!r) return null;
    const done = r.items.filter((it) => stretchDone(iso, it.ex)).length;
    return panel({ title: "Mobilidade · " + r.title, sub: compact ? `${done} de ${r.items.length} feitos` : r.sub, action: el("button", { class: "btn btn-primary btn-sm", html: UI.icon("play", 16) + "<span>Guiada</span>", onclick: () => routine(r.items, r.title, { logIso: iso }) }) }, [
      el("div", { class: compact ? "mini-grid" : "list" }, r.items.map((it) => {
        const e = Treino.Ex.get(it.ex) || {}; const on = stretchDone(iso, it.ex);
        return compact
          ? el("div", { class: "mini-item" + (on ? " on" : ""), onclick: () => Treino.demo(it.ex) }, [Treino.thumb(it.ex, { size: "sm" }), el("span", { text: e.pt })])
          : el("div", { class: "item" }, [
            el("div", { onclick: () => Treino.demo(it.ex), style: "cursor:pointer" }, [Treino.thumb(it.ex, { size: "sm" })]),
            el("div", { class: "grow", style: "cursor:pointer", onclick: () => Treino.demo(it.ex) }, [el("div", { class: "t" + (on ? " done-text" : ""), text: e.pt }), el("div", { class: "s", text: it.dose })]),
            checkBtn(on, () => toggleStretch(iso, it.ex), "Feito"),
          ]);
      })),
    ]);
  }

  /* ----------------------------- Vista ----------------------------- */
  function render(view) {
    const iso = todayISO(), c = checkin(iso), r = readiness(iso), lab = readinessLabel(r);
    view.appendChild(pageHead({ eyebrow: "Recuperação", icon: "moon", title: "Recuperação", sub: "Sono, energia, dores e mobilidade — para saberes quanto puxar hoje.", actions: [btnI("btn-primary btn-lg", "heart", c ? "Editar check-in" : "Fazer check-in", () => checkinSheet(iso))] }));
    const last7 = []; for (let i = 6; i >= 0; i--) last7.push(checkin(shiftDay(iso, -i)));
    const sl = last7.filter((x) => x && +x.sleep).map((x) => +x.sleep);
    const avgSleep = sl.length ? sl.reduce((a, b) => a + b, 0) / sl.length : null;
    const base = hrBaseline(iso);
    view.appendChild(el("div", { class: "kpis" }, [
      kpi({ label: "Prontidão", value: r != null ? r + " / 100" : "—", sub: lab.t, icon: "zap", variant: r == null ? "accent" : r < 40 ? "bad" : "accent", onClick: () => checkinSheet(iso) }),
      kpi({ label: "Sono (média 7 dias)", value: avgSleep ? num(avgSleep, 1) + " h" : "—", sub: c && c.sleep ? `Esta noite: ${num(c.sleep, 1)} h` : "Regista no check-in", icon: "moon" }),
      kpi({ label: "FC em repouso", value: c && c.hr ? c.hr + " bpm" : "—", sub: base ? `Normal para ti: ${Math.round(base)} bpm` : "Precisa de alguns dias de registos", icon: "heart" }),
    ]));
    const rec = muscleRecovery();
    const grid = el("div", { class: "muscle-grid" }, GROUPS.map((g) => {
      const p = rec[g]; const tone = p >= 80 ? "good" : p >= 50 ? "warn" : "bad";
      return el("div", { class: "mg-cell" }, [el("div", { class: "macro-top" }, [el("span", { text: Treino.MUSCLES[g] }), el("b", { class: "num tone-" + tone, text: p + "%" })]), UI.bar(p, tone)]);
    }));
    const hist = []; for (let i = 13; i >= 0; i--) { const d = shiftDay(iso, -i), x = checkin(d); hist.push({ label: String(new Date(d + "T00:00:00").getDate()), value: x && +x.sleep ? +x.sleep : 0, cur: d === iso, title: x && x.sleep ? `${UI.prettyDate(d)}: ${x.sleep} h · prontidão ${readiness(d) ?? "—"}` : UI.prettyDate(d), tone: x && +x.sleep && +x.sleep < 6.5 ? "neg" : "" }); }
    view.appendChild(el("div", { class: "stack", style: "margin-top:var(--gap)" }, [
      r != null ? el("div", { class: "card advice tone-" + (lab.tone || "none") }, [ico("zap", 20), el("div", {}, [el("b", { text: lab.t }), el("div", { class: "muted", text: lab.d })])]) : null,
      el("div", { class: "grid-2" }, [
        panel({ title: "Recuperação muscular", sub: "Pelas séries das últimas 72 h (e pelas dores do check-in)." }, [grid]),
        mobilityPanel(iso),
      ]),
      panel({ title: "Sono · 14 dias", sub: "Horas por noite (abaixo de 6,5 h a vermelho)." }, [barChart(hist, { max: 10 })]),
      routinesPanel(),
    ]));
  }
  function routinesPanel() {
    const D = global.GYM_DEFAULTS; if (!D) return null;
    const seen = new Set(), cards = [];
    [1, 2, 3, 4, 5, 6, 0].forEach((g) => { const r = D.stretchPlan[g]; if (!r || seen.has(r.title + r.items.length)) return; seen.add(r.title + r.items.length);
      cards.push(el("button", { class: "card routine-card", onclick: () => routine(r.items, r.title) }, [el("div", { class: "t", text: r.title }), el("div", { class: "tiny muted", text: `${r.items.length} exercícios · ${Treino.DAYS.find((d) => d.g === g).label}` })])); });
    (Treino.plans() || []).forEach((p) => { if ((p.warmup || []).length) cards.push(el("button", { class: "card routine-card", onclick: () => routine(p.warmup, "Aquecimento · " + p.name) }, [el("div", { class: "t", text: "Aquecimento " + p.name }), el("div", { class: "tiny muted", text: `${p.warmup.length} exercícios` })])); });
    return panel({ title: "Rotinas", sub: "Mobilidade e aquecimentos guiados, com animação e temporizador." }, [el("div", { class: "routine-grid" }, cards)]);
  }

  global.Recup = { init, render, readiness, readinessLabel, checkin, checkinSheet, muscleRecovery, routine, mobilityPanel, dailyRoutine, parseDose, GROUPS };
})(window);
