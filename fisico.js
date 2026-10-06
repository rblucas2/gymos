/* =====================================================================
   Físico — treino, nutrição e recuperação numa só app.
   Separadores: Hoje · Treino · Exercícios · Nutrição · Recuperação · Progresso
   ===================================================================== */
(function () {
  const { el, clear, num, toast, sheet, field, todayISO } = UI;
  const { ico, btnI, pageHead, panel, linkBtn, kpi, shiftDay, mondayOf, barChart, heatmap } = C;

  function init() {
    App.boot();
    Nutri.init(); Treino.init(); Recup.init();
    App.onboard("fisico", "Bem-vindo ao Físico", [
      "🏋️ <b>Treino</b>: os teus planos do gymos, registo de séries com cronómetro de descanso e recordes.",
      "🎬 <b>Exercícios</b>: 128 exercícios com animação própria a mostrar como se fazem — sem YouTube.",
      "🥗 <b>Nutrição</b>: diário, plano semanal e scanner de código de barras que funciona no iPhone.",
      "🌙 <b>Recuperação</b>: check-in diário, prontidão para treinar e mobilidade guiada.",
      "📥 Planos feitos no Claude a partir da tua pasta do TikTok entram em Treino → Importar.",
    ]);
    Tabs.init({
      ns: "gym",
      builtins: [
        { id: "hoje", type: "hoje", name: "Hoje" },
        { id: "treino", type: "treino", name: "Treino" },
        { id: "exercicios", type: "exercicios", name: "Exercícios" },
        { id: "nutricao", type: "nutricao", name: "Nutrição" },
        { id: "recuperacao", type: "recuperacao", name: "Recuperação" },
        { id: "progresso", type: "progresso", name: "Progresso" },
      ],
      renderers: { hoje: renderHoje, treino: (v) => Treino.render(v), exercicios: renderExercicios, nutricao: (v) => Nutri.render(v), recuperacao: (v) => Recup.render(v), progresso: renderProgresso },
    });
    let pending = false;
    const rerender = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; if (!document.querySelector(".scrim")) Tabs.render(Tabs.current); else dirty = true; }); };
    let dirty = false;
    ["gym", "nut", "body"].forEach((ns) => Store.subscribe(ns, rerender));
    // com uma folha aberta não se redesenha por baixo (perdia-se o scroll); redesenha ao fechar
    new MutationObserver(() => { if (dirty && !document.querySelector(".scrim")) { dirty = false; Tabs.render(Tabs.current); } }).observe(document.body, { childList: true });
    // treino a decorrer: abre logo no registo
    if (Store.get("gym").current && Tabs.current === "hoje") Tabs.render("treino");
  }
  const go = (id) => Tabs.render(id);

  /* ----------------------------- HOJE ----------------------------- */
  function renderHoje(view) {
    const iso = todayISO(), d = new Date(), h = d.getHours();
    const r = Recup.readiness(iso), lab = Recup.readinessLabel(r);
    const t = Nutri.targetsFor(iso), got = Nutri.dayIntake(iso);
    const sch = Treino.scheduledFor(iso), plan = sch && Treino.planById(sch), cur = Store.get("gym").current;
    const trained = Treino.trainedOn(iso);
    const greet = h < 6 ? "Boa noite" : h < 13 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
    const subParts = [cur ? "Tens um treino a decorrer." : trained ? "Treino de hoje feito ✓" : plan ? `Hoje: ${plan.name}.` : sch === "rest" ? "Hoje é dia de descanso." : sch === "run" ? "Hoje: corrida / futebol." : "Sem treino marcado para hoje."];
    view.appendChild(pageHead({ eyebrow: C.cap(d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })), icon: "sun", title: greet, sub: subParts.join(" "),
      actions: [btnI("btn-primary btn-lg", "scan", "Ler código", () => Nutri.scanFlow()), btnI("btn-lg", "heart", Recup.checkin(iso) ? "Check-in ✓" : "Check-in", () => Recup.checkinSheet(iso))] }));
    const wc = Treino.weekCount(), goal = Store.get("gym").weeklyGoal || 4;
    view.appendChild(el("div", { class: "kpis" }, [
      kpi({ label: "Prontidão", value: r != null ? `${r} / 100` : "Check-in", sub: lab.t, icon: "zap", variant: "accent", onClick: () => (r == null ? Recup.checkinSheet(iso) : go("recuperacao")) }),
      kpi({ label: "Calorias", value: t ? `${num(Math.max(0, t.kcal - got.kcal))} kcal` : `${num(got.kcal)} kcal`, sub: t ? `restam · ${num(got.p)}/${num(t.protein)} g proteína` : "consumidas hoje", icon: "flame", onClick: () => { Nutri.setDate(iso); go("nutricao"); } }),
      kpi({ label: "Treinos na semana", value: `${wc} / ${goal}`, sub: wc >= goal ? "Meta cumprida 🎉" : `faltam ${goal - wc}`, icon: "dumbbell", onClick: () => go("treino") }),
    ]));

    // treino de hoje
    let trainPanel;
    if (cur) {
      const done = cur.items.reduce((a, it) => a + it.sets.filter((x) => x.done).length, 0), all = cur.items.reduce((a, it) => a + it.sets.length, 0);
      trainPanel = panel({ title: cur.name, sub: `Treino a decorrer · ${done} de ${all} séries` }, [UI.bar(all ? (done / all) * 100 : 0), el("button", { class: "btn btn-primary btn-block", style: "margin-top:16px", html: UI.icon("play", 18) + "<span>Continuar treino</span>", onclick: () => go("treino") })]);
    } else if (plan && !trained) {
      trainPanel = panel({ title: plan.name, sub: `${plan.items.length} exercícios · treino de hoje`, action: linkBtn("Planos", () => Treino.go("planos")) }, [
        el("div", { class: "thumb-strip" }, plan.items.slice(0, 6).map((it) => el("div", { class: "ts-item", onclick: () => Treino.demo(it.ex) }, [Treino.thumb(it.ex, { size: "sm" }), el("span", { text: Treino.Ex.name(it.ex) })]))),
        r != null && r < 40 ? el("p", { class: "tiny", style: "color:var(--warn)", text: "A tua prontidão está baixa — considera reduzir o volume hoje." }) : null,
        el("div", { class: "row wrap", style: "gap:10px" }, [
          (plan.warmup || []).length ? el("button", { class: "btn", html: UI.icon("play", 16) + "<span>Aquecimento</span>", onclick: () => Recup.routine(plan.warmup, "Aquecimento · " + plan.name) }) : null,
          el("button", { class: "btn btn-primary grow", html: UI.icon("play", 18) + "<span>Começar treino</span>", onclick: () => { Treino.startSession(plan.id); } }),
        ]),
      ]);
    } else {
      const last = Treino.sessions()[0];
      trainPanel = panel({ title: trained ? "Treino feito" : sch === "rest" ? "Descanso" : "Treino", sub: trained ? "Bom trabalho hoje." : last ? `Último: ${last.name}, ${UI.prettyDate(last.date)}` : "Ainda sem treinos registados." }, [
        el("div", { class: "row wrap", style: "gap:10px" }, [
          el("button", { class: "btn btn-primary", text: trained ? "Ver histórico" : "Escolher plano", onclick: () => Treino.go(trained ? "historico" : "hoje") }),
          el("button", { class: "btn", text: "Treino livre", onclick: () => Treino.startSession(null) }),
        ]),
      ]);
    }
    view.appendChild(el("div", { class: "stack", style: "margin-top:var(--gap)" }, [
      el("div", { class: "grid-2" }, [trainPanel, Nutri.caloriesPanel(iso, { compact: true })]),
      Recup.mobilityPanel(iso, { compact: true }),
      weekStrip(iso),
    ]));
  }
  function weekStrip(iso) {
    const m = mondayOf(iso), sch = Store.get("gym").schedule || {};
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = shiftDay(m, i), g = new Date(d + "T00:00:00").getDay(), k = sch[g], p = k && Treino.planById(k);
      const did = (Store.get("gym").sessions || []).some((s) => s.date === d);
      days.push(el("div", { class: "wk-day" + (d === iso ? " today" : "") + (did ? " did" : "") }, [
        el("div", { class: "wn", text: UI.DAYS[g] }), el("div", { class: "wd", text: did ? "✓" : p ? p.name : k === "rest" ? "Descanso" : k === "run" ? "Corrida" : "—" }),
        el("div", { class: "tiny muted", text: Nutri.dayIntake(d).kcal ? num(Nutri.dayIntake(d).kcal) + " kcal" : "" }),
      ]));
    }
    return panel({ title: "A tua semana", sub: "Plano de treino e calorias por dia.", action: linkBtn("Editar", () => Treino.go("semana")) }, [el("div", { class: "wk-strip" }, days)]);
  }

  /* ----------------------------- EXERCÍCIOS ----------------------------- */
  let exQ = "", exCat = "", exMus = "";
  function renderExercicios(view) {
    const all = Treino.Ex.all();
    view.appendChild(pageHead({ eyebrow: "Biblioteca", icon: "body", title: "Exercícios", sub: `${all.length} exercícios com animação a mostrar a execução. Toca num para veres os passos.`, actions: [btnI("btn-primary", "plus", "Criar exercício", () => Treino.editExercise({}))] }));
    const q = el("input", { type: "search", class: "search-input", placeholder: "Procurar: supino, remada, glúteos…", value: exQ, "aria-label": "Procurar exercício" });
    const cats = el("div", { class: "chip-row" }), mus = el("div", { class: "chip-row" });
    const grid = el("div", { class: "ex-grid" });
    const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    function chipsDraw() {
      clear(cats).append(...Object.entries(Treino.CATS).map(([k, l]) => el("button", { class: "pill pill-btn" + (exCat === k ? " on" : ""), text: `${l} · ${all.filter((e) => e.cat === k).length}`, onclick: () => { exCat = exCat === k ? "" : k; chipsDraw(); draw(); } })));
      clear(mus).append(...Object.entries(Treino.MUSCLES).map(([k, l]) => el("button", { class: "pill pill-btn" + (exMus === k ? " on" : ""), text: l, onclick: () => { exMus = exMus === k ? "" : k; chipsDraw(); draw(); } })));
    }
    function draw() {
      exQ = q.value; const t = norm(q.value); clear(grid);
      const list = all.filter((e) => (!exCat || e.cat === exCat) && (!exMus || (e.m || []).includes(exMus)) && (!t || norm([e.n, e.pt, ...(e.aka || []), ...(e.m || []).map((m) => Treino.MUSCLES[m])].join(" ")).includes(t)));
      if (!list.length) grid.appendChild(el("div", { class: "empty", text: "Nenhum exercício com estes filtros." }));
      list.forEach((e) => grid.appendChild(el("button", { class: "ex-card", onclick: () => Treino.demo(e.id) }, [
        Treino.thumb(e.id, { size: "lg" }),
        el("div", { class: "ex-info" }, [
          el("div", { class: "t", text: e.pt || e.n }),
          el("div", { class: "s", text: (e.m || []).slice(0, 2).map((m) => Treino.MUSCLES[m]).join(" · ") + (e.eq ? " · " + e.eq : "") }),
        ]),
        e.tier ? el("span", { class: "tier tier-" + e.tier, text: e.tier }) : e.custom ? el("span", { class: "tier", text: "teu" }) : null,
      ])));
    }
    q.addEventListener("input", draw);
    chipsDraw(); draw();
    view.appendChild(el("div", { class: "stack" }, [panel({}, [q, el("div", { style: "height:12px" }), cats, el("div", { style: "height:6px" }), mus]), grid]));
  }

  /* ----------------------------- PROGRESSO ----------------------------- */
  function renderProgresso(view) {
    const iso = todayISO(), gym = Store.get("gym");
    view.appendChild(pageHead({ eyebrow: "Evolução", icon: "chart", title: "Progresso", sub: "Treino, corpo e alimentação ao longo do tempo.", actions: [btnI("", "scale", "Registar peso", () => Nutri.logWeight()), btnI("", "body", "Medidas", () => measuresSheet())] }));
    const ss = gym.sessions || [];
    const last30 = ss.filter((s) => s.date >= shiftDay(iso, -29)).length;
    const ws = Nutri.weightEntries(), lastW = ws[ws.length - 1];
    const w30 = ws.filter(([d]) => d >= shiftDay(iso, -30));
    view.appendChild(el("div", { class: "kpis" }, [
      kpi({ label: "Treinos (30 dias)", value: String(last30), sub: `${num(last30 / 4.3, 1)} por semana`, icon: "dumbbell", variant: "accent" }),
      kpi({ label: "Volume esta semana", value: num(Treino.weekVolume(iso) / 1000, 1) + " t", sub: "kg × repetições", icon: "activity" }),
      kpi({ label: "Peso", value: lastW ? num(lastW[1], 1) + " kg" : "—", sub: w30.length > 1 ? `${w30[w30.length - 1][1] - w30[0][1] > 0 ? "+" : ""}${num(w30[w30.length - 1][1] - w30[0][1], 1)} kg em 30 dias` : "Regista o peso", icon: "scale", onClick: () => Nutri.logWeight() }),
    ]));
    // volume por semana
    const weeks = []; const m0 = mondayOf(iso);
    for (let i = 7; i >= 0; i--) { const m = shiftDay(m0, -7 * i), e = shiftDay(m, 6); const v = ss.filter((s) => s.date >= m && s.date <= e).reduce((a, s) => a + (s.volume || 0), 0); weeks.push({ label: UI.prettyDate(m).split(" ")[0] + "/" + (new Date(m + "T00:00:00").getMonth() + 1), value: Math.round(v / 100) / 10, cur: i === 0, title: `Semana de ${UI.prettyDate(m)}: ${num(v)} kg` }); }
    // séries por músculo (regra do arquivo: 9 por semana)
    const sbm = Treino.setsByMuscle(m0, shiftDay(m0, 6), { weighted: true });
    const ALIAS = { rear_delts: "shoulders", traps: "back", forearms: "biceps", adductors: "quads", hip_flexors: "quads" };
    const tot = {}; Object.entries(sbm).forEach(([m, v]) => { const g = ALIAS[m] || m; tot[g] = (tot[g] || 0) + v; });
    const groups = Recup.GROUPS.map((g) => ({ g, v: Math.round(tot[g] || 0) }));
    const rows = el("div", { class: "muscle-grid" }, groups.map(({ g, v }) => el("div", { class: "mg-cell" }, [el("div", { class: "macro-top" }, [el("span", { text: Treino.MUSCLES[g] }), el("span", { class: "num muted tiny", html: `<b>${v}</b> / 9` })]), UI.bar(Math.min(100, (v / 9) * 100), v >= 9 ? "good" : "")])));
    // recordes
    const exIds = new Set(); ss.forEach((s) => (s.items || []).forEach((it) => exIds.add(it.ex))); Object.keys(gym.records || {}).forEach((k) => exIds.add(k));
    const prs = [...exIds].map((id) => ({ id, b: Treino.bestOf(id) })).filter((x) => x.b && x.b.w > 0).sort((a, b) => String(b.b.date || "").localeCompare(String(a.b.date || ""))).slice(0, 10);
    const heat = {}; ss.forEach((s) => { heat[s.date] = 1; });
    // nutrição 7 dias
    let kc = 0, pr = 0, n = 0; for (let i = 0; i < 7; i++) { const d = shiftDay(iso, -i), x = Nutri.dayIntake(d); if (x.kcal) { kc += x.kcal; pr += x.p; n++; } }
    const t = Nutri.targetsFor(iso);
    view.appendChild(el("div", { class: "stack", style: "margin-top:var(--gap)" }, [
      el("div", { class: "grid-2" }, [
        panel({ title: "Volume por semana", sub: "Toneladas (kg × reps)" }, [barChart(weeks)]),
        panel({ title: "Séries por músculo · esta semana", sub: "Regra do teu arquivo: 9 séries por grupo muscular por semana (secundários contam ½)." }, [rows]),
      ]),
      el("div", { class: "grid-2" }, [
        panel({ title: "Recordes", sub: "Melhor série por exercício (1RM estimado)." }, prs.length ? prs.map((x) => el("button", { class: "item pick", onclick: () => Treino.demo(x.id) }, [
          Treino.thumb(x.id, { size: "sm" }),
          el("div", { class: "grow" }, [el("div", { class: "t", text: Treino.Ex.name(x.id) }), el("div", { class: "s", text: (x.b.date ? UI.prettyDate(x.b.date) : "") + ` · 1RM ≈ ${num(x.b.v)} kg` })]),
          el("div", { class: "amt num", text: `${num(x.b.w, 1)}×${x.b.r}` }),
        ])) : [el("div", { class: "empty", text: "Os teus recordes aparecem aqui depois dos primeiros treinos." })]),
        el("div", { class: "stack" }, [
          panel({ title: "Consistência", sub: "Dias com treino (16 semanas)." }, [heatmap(heat, { weeks: 16 })]),
          panel({ title: "Alimentação · 7 dias", sub: n ? `Média de ${n} dias com registos` : "Sem registos esta semana." }, n ? [el("div", { class: "row wrap", style: "gap:24px" }, [
            el("div", {}, [el("div", { class: "big-num num", text: num(kc / n) }), el("div", { class: "tiny muted", text: "kcal/dia" + (t ? ` (meta ${num(t.kcal)})` : "") })]),
            el("div", {}, [el("div", { class: "big-num num", text: num(pr / n) + " g" }), el("div", { class: "tiny muted", text: "proteína/dia" + (t ? ` (meta ${num(t.protein)} g)` : "") })]),
          ])] : []),
        ]),
      ]),
      el("div", { class: "grid-2" }, [Nutri.weightPanel(), measuresPanel()]),
    ]));
  }

  const MEASURES = [["waist", "Cintura", "cm"], ["chest", "Peito", "cm"], ["arm", "Braço", "cm"], ["thigh", "Coxa", "cm"], ["bf", "Gordura corporal", "%"]];
  function measuresPanel() {
    const ms = Store.get("body").measures || {}; const dates = Object.keys(ms).sort();
    const last = dates.length ? ms[dates[dates.length - 1]] : null, first = dates.length > 1 ? ms[dates[0]] : null;
    return panel({ title: "Medidas", sub: dates.length ? `Último registo: ${UI.prettyDate(dates[dates.length - 1])}` : "Cintura, peito, braço, coxa e % de gordura.", action: el("button", { class: "btn btn-soft btn-sm", text: "+ Registar", onclick: measuresSheet }) },
      last ? [el("div", { class: "list" }, MEASURES.filter(([k]) => last[k]).map(([k, l, u]) => el("div", { class: "item" }, [el("div", { class: "grow t", text: l }), first && first[k] ? el("span", { class: "tiny muted", text: `${last[k] - first[k] > 0 ? "+" : ""}${num(last[k] - first[k], 1)} ${u}` }) : null, el("div", { class: "amt num", text: `${num(last[k], 1)} ${u}` })])))] : [el("div", { class: "empty", text: "Sem medidas registadas." })]);
  }
  function measuresSheet() {
    const iso = todayISO(), cur = (Store.get("body").measures || {})[iso] || {};
    const fs = MEASURES.map(([k, l, u]) => field(`${l} (${u})`, { type: "number", value: cur[k] || "", inputmode: "decimal", step: "0.1" }));
    const sh = sheet("Medidas de hoje", [el("div", { class: "input-row" }, fs.slice(0, 2)), el("div", { class: "input-row" }, fs.slice(2, 4)), fs[4],
      el("button", { class: "btn btn-primary btn-block", text: "Guardar", onclick: () => {
        const d = {}; MEASURES.forEach(([k], i) => { const v = parseFloat(String(fs[i].input.value).replace(",", ".")); if (v) d[k] = v; });
        if (!Object.keys(d).length) return toast("Preenche pelo menos uma medida.");
        Store.update("body", (s) => { s.measures = s.measures || {}; s.measures[iso] = d; }); sh.close(); toast("Medidas guardadas ✓");
      } })]);
  }

  /* ----------------------------- Definições extra ----------------------------- */
  window.FisicoSettings = function () {
    return [
      el("div", { class: "section-title", text: "Treino" }),
      el("a", { class: "btn btn-block", href: "./classic.html", text: "Abrir o gymos antigo" }),
      el("p", { class: "tiny muted", text: "O gymos antigo continua disponível (só leitura recomendada) — os dados dele foram copiados para aqui." }),
    ];
  };

  window.FisicoApp = { go };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
