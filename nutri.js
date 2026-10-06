/* =====================================================================
   nutri.js — Nutrição (vinda da Vida OS): diário com scanner, plano
   semanal, base de alimentos, refeições guardadas, metas e peso.
   Dados no namespace "nut" (mesma estrutura da Vida OS → migração direta).
   ===================================================================== */
(function (global) {
  const { el, clear, num, toast, undo, sheet, field, uid, todayISO, guardClick } = UI;
  const { ico, btnI, pageHead, panel, linkBtn, kpi, dayPill, shiftDay, barChart } = C;
  const NS = "nut";
  const S = () => Store.get(NS);

  /* ----------------------------- Domínio ----------------------------- */
  const ACTIVITY = {
    sedentario: { f: 1.2, label: "Sedentário (pouco exercício)" },
    leve: { f: 1.375, label: "Leve (1-3 treinos/semana)" },
    moderado: { f: 1.55, label: "Moderado (3-5 treinos/semana)" },
    muito: { f: 1.725, label: "Muito ativo (6-7 treinos/semana)" },
  };
  const EXTRA_MICROS = [
    { id: "vitD", label: "Vitamina D", unit: "µg", ref: 5 }, { id: "vitE", label: "Vitamina E", unit: "mg", ref: 12 },
    { id: "vitC", label: "Vitamina C", unit: "mg", ref: 80 }, { id: "magnesio", label: "Magnésio", unit: "mg", ref: 375 },
    { id: "ferro", label: "Ferro", unit: "mg", ref: 14 }, { id: "calcio", label: "Cálcio", unit: "mg", ref: 800 },
    { id: "potassio", label: "Potássio", unit: "mg", ref: 2000 }, { id: "zinco", label: "Zinco", unit: "mg", ref: 10 },
  ];
  const MICRO_REF = { fib: 30, sug: 50, sat: 22, sod: 2300 };
  const mifflin = ({ sex, weight, height, age }) => { const b = 10 * weight + 6.25 * height - 5 * age; return sex === "f" ? b - 161 : b + 5; };
  function nutritionTargets(p) {
    if (!p || !p.weight || !p.height || !p.age) return null;
    const tmb = mifflin(p), getd = tmb * (ACTIVITY[p.activity] || ACTIVITY.moderado).f;
    let kcal = getd + (p.goal === "lose" ? -400 : p.goal === "gain" ? 400 : 0);
    const protein = Math.round(p.weight * 2), fat = Math.round((kcal * 0.25) / 9);
    return { tmb: Math.round(tmb), getd: Math.round(getd), kcal: Math.round(kcal), protein, carbs: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)), fat };
  }
  function baseTargets(nut) {
    const c = nut && nut.customTargets;
    if (c && c.kcal) return { kcal: +c.kcal || 0, protein: +c.protein || 0, carbs: +c.carbs || 0, fat: +c.fat || 0, manual: true };
    return nutritionTargets(nut && nut.profile);
  }
  /** Dia de treino: marcado aqui, ou com sessão registada no Treino. */
  const trainedOn = (iso) => !!((S().workoutDays || {})[iso]) || !!(global.Treino && Treino.trainedOn(iso));
  /** Ciclo de hidratos: +12% kcal (em hidratos) nos dias de treino. */
  function targetsFor(iso) {
    const b = baseTargets(S()); if (!b) return null;
    if (!trainedOn(iso)) return { ...b, boosted: false };
    const kcal = Math.round(b.kcal * 1.12);
    return { ...b, kcal, carbs: b.carbs + Math.round((kcal - b.kcal) / 4), boosted: true };
  }
  function dayIntake(iso) {
    const base = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, sat: 0, sod: 0 };
    EXTRA_MICROS.forEach((m) => { base[m.id] = 0; });
    return ((S().diary || {})[iso] || []).reduce((a, it) => { for (const k in a) a[k] += +it[k] || 0; return a; }, base);
  }
  function entryFromFood(food, grams) {
    const k = grams / 100, r1 = (x) => +((x || 0) * k).toFixed(1);
    const e = { foodId: food.id, nome: food.nome, grams, kcal: Math.round((food.calorias || 0) * k), p: r1(food.proteina), c: r1(food.hidratos), f: r1(food.gordura), fib: r1(food.fibra), sug: r1(food.acucar), sat: r1(food.saturadas), sod: Math.round((food.sodio || 0) * k) };
    EXTRA_MICROS.forEach((m) => { if (food[m.id]) e[m.id] = +((food[m.id] || 0) * k).toFixed(2); });
    return e;
  }

  const SEED_FOODS = [
    ["f_frango", "Peito de frango grelhado", "Proteína", 165, 31, 0, 3.6, 0, 0, 1, 74], ["f_arroz", "Arroz cozido", "Hidratos", 130, 2.7, 28, 0.3, 0.4, 0.1, 0.1, 1],
    ["f_ovo", "Ovo", "Proteína", 155, 13, 1.1, 11, 0, 1.1, 3.3, 124], ["f_atum", "Atum em água", "Proteína", 116, 26, 0, 1, 0, 0, 0.3, 247],
    ["f_aveia", "Flocos de aveia", "Hidratos", 389, 17, 66, 7, 10, 1, 1.2, 2], ["f_batata", "Batata doce cozida", "Hidratos", 90, 2, 21, 0.1, 3, 6, 0, 36],
    ["f_banana", "Banana", "Fruta", 89, 1.1, 23, 0.3, 2.6, 12, 0.1, 1], ["f_iogurte", "Iogurte grego natural", "Laticínios", 97, 9, 4, 5, 0, 4, 3.2, 36],
    ["f_whey", "Proteína whey (pó)", "Suplemento", 380, 80, 7, 5, 1, 6, 1.5, 300], ["f_azeite", "Azeite", "Gordura", 884, 0, 0, 100, 0, 0, 14, 2],
    ["f_brocolos", "Brócolos", "Legumes", 34, 2.8, 7, 0.4, 2.6, 1.7, 0.1, 33], ["f_amendoa", "Amêndoas", "Gordura", 579, 21, 22, 50, 12.5, 4.4, 3.7, 1],
    ["f_massa", "Massa cozida", "Hidratos", 131, 5, 25, 1.1, 1.8, 0.6, 0.2, 1], ["f_maca", "Maçã", "Fruta", 52, 0.3, 13.8, 0.2, 2.4, 10.4, 0, 1],
    ["f_salmao", "Salmão grelhado", "Proteína", 206, 22, 0, 13, 0, 0, 3.1, 61], ["f_leite", "Leite meio-gordo", "Laticínios", 46, 3.4, 4.8, 1.6, 0, 4.8, 1, 44],
    ["f_pao", "Pão de mistura", "Padaria", 250, 8.5, 48, 2.5, 4, 3, 0.5, 450], ["f_queijo_fresco", "Queijo fresco", "Laticínios", 140, 11, 3, 9, 0, 3, 6, 300],
    ["f_feijao", "Feijão cozido", "Legumes", 127, 8.7, 22.8, 0.5, 6.4, 0.3, 0.1, 2], ["f_manteiga_amendoim", "Manteiga de amendoim", "Gordura", 588, 25, 20, 50, 6, 9, 10, 17],
  ].map(([id, nome, categoria, calorias, proteina, hidratos, gordura, fibra, acucar, saturadas, sodio]) => ({ id, nome, categoria, calorias, proteina, hidratos, gordura, fibra, acucar, saturadas, sodio }));

  const PLAN_DAYS = [
    { id: "seg", label: "Segunda", g: 1 }, { id: "ter", label: "Terça", g: 2 }, { id: "qua", label: "Quarta", g: 3 }, { id: "qui", label: "Quinta", g: 4 },
    { id: "sex", label: "Sexta", g: 5 }, { id: "sab", label: "Sábado", g: 6 }, { id: "dom", label: "Domingo", g: 0 },
  ];
  const SLOTS = [
    { id: "pa", label: "Pequeno-almoço" }, { id: "lm", label: "Lanche da manhã" }, { id: "al", label: "Almoço" },
    { id: "lt1", label: "Lanche da tarde" }, { id: "lt2", label: "Lanche 2" }, { id: "ja", label: "Jantar" },
  ];
  const slotLabel = (id) => (SLOTS.find((s) => s.id === id) || { label: "Outros" }).label;
  function guessSlot() { const h = new Date().getHours(); return h < 10 ? "pa" : h < 12 ? "lm" : h < 15 ? "al" : h < 17 ? "lt1" : h < 19 ? "lt2" : "ja"; }
  const planDayOf = (iso) => PLAN_DAYS.find((d) => d.g === new Date(iso + "T00:00:00").getDay()).id;

  function init() {
    Store.ensure(NS, { profile: null, customTargets: null, foods: SEED_FOODS, diary: {}, meals: [], workoutDays: {}, weightLog: {}, mealPlan: {} });
    // alimentos de base que ainda não tenhas (por id) — sem tocar nos teus
    const have = new Set((S().foods || []).map((f) => f.id));
    const add = SEED_FOODS.filter((f) => !have.has(f.id));
    if (add.length && !S()._seedV2) Store.update(NS, (st) => { st.foods = (st.foods || []).concat(add); st._seedV2 = true; }, { silent: true, keepTime: true });
    const s = S();
    if (!s._slotsV2) Store.update(NS, (st) => {   // formato antigo da Vida OS: slot único "la"
      Object.values(st.mealPlan || {}).forEach((d) => { if (d && d.la) { d.lt1 = (d.lt1 || []).concat(d.la); delete d.la; } });
      Object.values(st.diary || {}).forEach((items) => (items || []).forEach((it) => { if (it.slot === "la") it.slot = "lt1"; }));
      st._slotsV2 = true;
    }, { silent: true, keepTime: true });
  }

  /* ----------------------------- Vista principal ----------------------------- */
  let sub = "diario", viewDate = todayISO();
  const SUBS = [["diario", "Diário"], ["plano", "Plano semanal"], ["alimentos", "Alimentos"], ["refeicoes", "Refeições"], ["metas", "Metas e peso"]];
  function render(view) {
    const bar = el("div", { class: "subtabs" }, SUBS.map(([id, label]) => el("button", { class: sub === id ? "active" : "", text: label, onclick: () => { sub = id; Tabs.render(Tabs.current); } })));
    ({ diario: renderDiario, plano: renderPlano, alimentos: renderAlimentos, refeicoes: renderRefeicoes, metas: renderMetas }[sub] || renderDiario)(view, bar);
  }

  /* ----------------------------- DIÁRIO ----------------------------- */
  function caloriesPanel(iso, { compact = false } = {}) {
    const t = targetsFor(iso), got = dayIntake(iso);
    if (!t) {
      return panel({ title: "Calorias", sub: "Define as tuas metas para veres quanto falta." }, [
        el("div", { class: "row wrap", style: "gap:10px" }, [
          el("button", { class: "btn btn-primary", text: "Calcular metas", onclick: () => { sub = "metas"; Tabs.render("nutricao"); } }),
          el("span", { class: "muted", text: `Hoje: ${num(got.kcal)} kcal · ${num(got.p)} g proteína` }),
        ]),
      ]);
    }
    const left = Math.round(t.kcal - got.kcal);
    const pct = t.kcal ? (got.kcal / t.kcal) * 100 : 0;
    const ring = UI.ring(Math.min(100, pct), { size: compact ? 132 : 168, stroke: compact ? 12 : 14, label: num(Math.abs(left)), sub: left >= 0 ? "kcal restam" : "kcal a mais", color: left < -100 ? "var(--bad)" : "var(--accent)" });
    const macro = (label, v, tg, color) => {
      const p = tg ? Math.min(100, (v / tg) * 100) : 0;
      const b = UI.bar(p); b.firstChild.style.background = color;
      return el("div", { class: "macro" }, [
        el("div", { class: "macro-top" }, [el("span", { text: label }), el("span", { class: "num muted", html: `<b>${num(v)}</b> / ${num(tg)} g` })]), b,
      ]);
    };
    return panel({ title: "Calorias", sub: `${num(got.kcal)} de ${num(t.kcal)} kcal` + (t.boosted ? " · dia de treino (+12%)" : ""), cls: "cal-panel" }, [
      el("div", { class: "cal-body" }, [
        el("div", { class: "ringwrap" }, [ring]),
        el("div", { class: "macros" }, [
          macro("Proteína", got.p, t.protein, "var(--c-prot)"), macro("Hidratos", got.c, t.carbs, "var(--c-carb)"), macro("Gordura", got.f, t.fat, "var(--c-fat)"),
        ]),
      ]),
    ]);
  }

  function renderDiario(view, bar) {
    const nut = S(), iso = viewDate;
    view.appendChild(pageHead({ eyebrow: "Nutrição", icon: "apple", title: "Diário", sub: "O que comeste, macros e micronutrientes.", actions: [dayPill(iso, (d) => { viewDate = d; Tabs.render(Tabs.current); })] }));
    view.appendChild(bar);
    const actions = el("div", { class: "quick-actions" }, [
      btnI("btn-primary btn-lg", "scan", "Ler código de barras", () => scanFlow()),
      btnI("btn-lg", "plus", "Adicionar alimento", () => addFoodSheet()),
      btnI("btn-lg", "zap", "Fechar macros", () => macroSolver(iso)),
    ]);
    const stack = el("div", { class: "stack" }, [actions, caloriesPanel(iso)]);

    // refeições do dia
    const items = (nut.diary || {})[iso] || [];
    const groups = SLOTS.map((sl) => ({ ...sl, entries: items.filter((it) => it.slot === sl.id) }));
    const other = items.filter((it) => !SLOTS.some((s) => s.id === it.slot));
    if (other.length) groups.push({ id: "outros", label: "Outros", entries: other });
    const list = el("div", { class: "meal-groups" });
    groups.forEach((g) => {
      if (!g.entries.length && !["pa", "al", "ja"].includes(g.id)) return;
      const tot = g.entries.reduce((a, it) => a + (it.kcal || 0), 0);
      list.appendChild(el("div", { class: "meal-group" }, [
        el("div", { class: "mg-head" }, [
          el("div", {}, [el("div", { class: "mg-title", text: g.label }), el("div", { class: "tiny muted", text: g.entries.length ? `${num(tot)} kcal` : "vazio" })]),
          g.id !== "outros" ? el("button", { class: "btn btn-soft btn-icon btn-sm", "aria-label": "Adicionar a " + g.label, title: "Adicionar", html: UI.icon("plus", 18), onclick: () => addFoodSheet(null, g.id) }) : null,
        ]),
        ...g.entries.map((it) => el("div", { class: "food-line" }, [
          el("div", { class: "grow" }, [el("div", { class: "t", text: it.nome }), el("div", { class: "s", text: `${num(it.grams)} g · ${num(it.p)} P · ${num(it.c)} H · ${num(it.f)} G` })]),
          el("div", { class: "amt num", text: num(it.kcal) }),
          el("button", { class: "btn btn-ghost btn-icon btn-sm", "aria-label": "Remover", title: "Remover", html: UI.icon("x", 16), onclick: () => removeDiary(iso, it.id) }),
        ])),
      ]));
    });
    stack.appendChild(panel({ title: "Refeições", sub: items.length ? `${items.length} registos` : "Ainda não registaste nada hoje.", action: linkBtn("Plano", () => { sub = "plano"; Tabs.render(Tabs.current); }) }, [list]));

    if (nut.meals && nut.meals.length) {
      stack.appendChild(panel({ title: "Refeições rápidas", sub: "Um toque e entra tudo no diário." }, [
        el("div", { class: "row wrap", style: "gap:8px" }, nut.meals.map((m) => el("button", { class: "pill on pill-btn", text: "+ " + m.nome, onclick: guardClick(() => logMeal(m, iso)) }))),
      ]));
    }

    const got = dayIntake(iso);
    const microRow = (label, v, tg, unit, limit) => {
      const p = tg ? (v / tg) * 100 : 0; const over = limit && v > tg;
      const b = UI.bar(Math.min(100, p), over ? "bad" : limit ? "" : p >= 100 ? "good" : "");
      return el("div", { class: "micro" }, [el("div", { class: "macro-top" }, [el("span", { text: label }), el("span", { class: "num muted tiny", text: `${num(v, 1)} / ${num(tg)} ${unit}${limit ? " máx." : ""}` })]), b]);
    };
    const micros = [microRow("Fibra", got.fib, MICRO_REF.fib, "g"), microRow("Açúcar", got.sug, MICRO_REF.sug, "g", true), microRow("Gordura saturada", got.sat, MICRO_REF.sat, "g", true), microRow("Sódio", got.sod, MICRO_REF.sod, "mg", true),
      ...EXTRA_MICROS.filter((m) => got[m.id] > 0).map((m) => microRow(m.label, got[m.id], m.ref, m.unit))];
    const trained = trainedOn(iso);
    const week = []; for (let i = 6; i >= 0; i--) { const d = shiftDay(iso, -i); week.push({ label: UI.DAYS[new Date(d + "T00:00:00").getDay()], value: dayIntake(d).kcal, cur: d === iso, title: `${UI.prettyDate(d)}: ${num(dayIntake(d).kcal)} kcal` }); }
    stack.appendChild(el("div", { class: "grid-2" }, [
      panel({ title: "Micronutrientes", sub: "Referências diárias de um adulto." }, [el("div", { class: "micros" }, micros)]),
      panel({ title: "Últimos 7 dias", sub: targetsFor(iso) ? `Meta ${num(targetsFor(iso).kcal)} kcal` : "kcal por dia", action: el("button", { class: "btn btn-sm " + (trained ? "btn-soft" : ""), html: (trained ? UI.icon("check", 16) : UI.icon("dumbbell", 16)) + "<span>Dia de treino</span>", title: "Dias de treino têm +12% de calorias", onclick: () => toggleWorkoutDay(iso) }) }, [barChart(week)]),
    ]));
    view.appendChild(stack);
  }

  function toggleWorkoutDay(iso) {
    if (global.Treino && Treino.trainedOn(iso) && !(S().workoutDays || {})[iso]) return toast("Já tens um treino registado neste dia.");
    Store.update(NS, (s) => { s.workoutDays = s.workoutDays || {}; s.workoutDays[iso] = !s.workoutDays[iso]; });
  }

  function removeDiary(iso, id) {
    let snap = null, idx = -1;
    Store.update(NS, (s) => {
      const arr = (s.diary || {})[iso] || []; idx = arr.findIndex((x) => x.id === id);
      if (idx >= 0) { snap = arr[idx]; arr.splice(idx, 1); s._tomb = s._tomb || {}; s._tomb.diaryItems = s._tomb.diaryItems || {}; s._tomb.diaryItems[id] = Date.now(); }
    });
    if (snap) undo("Removido do diário", () => Store.update(NS, (s) => {
      s.diary[iso] = s.diary[iso] || []; s.diary[iso].splice(Math.min(idx, s.diary[iso].length), 0, snap);
      if (s._tomb && s._tomb.diaryItems) delete s._tomb.diaryItems[snap.id];
    }));
  }
  function pushDiary(iso, entries) {
    Store.update(NS, (s) => { s.diary = s.diary || {}; s.diary[iso] = s.diary[iso] || []; entries.forEach((e) => s.diary[iso].push({ id: uid(), ...e })); });
  }
  function logMeal(m, iso = viewDate) { const slot = guessSlot(); pushDiary(iso, m.items.map(({ id, ...it }) => ({ ...it, slot }))); toast(m.nome + " no diário ✓"); }

  /* --------------------- Adicionar alimento --------------------- */
  function slotPicker(cur, onPick) {
    const wrap = el("div", { class: "subtabs slot-pick" });
    SLOTS.forEach((sl) => wrap.appendChild(el("button", { type: "button", class: sl.id === cur ? "active" : "", text: sl.label, onclick: (e) => { [...wrap.children].forEach((c) => c.classList.toggle("active", c === e.currentTarget)); onPick(sl.id); } })));
    return wrap;
  }

  /** Folha de adicionar: preset = alimento já escolhido (ex: vindo do scanner). */
  function addFoodSheet(preset, slot0, iso0) {
    const iso = iso0 || viewDate;
    let selected = preset || null, slot = slot0 || guessSlot();
    const search = field("Procurar alimento", { placeholder: "ex: frango, aveia, iogurte…", autocomplete: "off" });
    const results = el("div", { class: "list pick-list" });
    const grams = field("Quantidade (g)", { type: "number", value: 100, inputmode: "decimal", min: "0" });
    const chips = el("div", { class: "row wrap", style: "gap:6px" });
    const card = el("div", { class: "food-card hide" });
    const preview = el("div", { class: "preview" });

    function calc() {
      if (!selected) { preview.textContent = ""; return; }
      const e = entryFromFood(selected, parseFloat(grams.input.value) || 0);
      clear(preview).append(...[["kcal", e.kcal], ["P", e.p], ["H", e.c], ["G", e.f]].map(([k, v]) => el("div", {}, [el("b", { class: "num", text: num(v, k === "kcal" ? 0 : 1) }), el("span", { text: k === "kcal" ? "kcal" : k === "P" ? "proteína" : k === "H" ? "hidratos" : "gordura" })])));
    }
    function pick(food) {
      selected = food; clear(results); search.classList.add("hide");
      card.classList.remove("hide");
      clear(card).append(
        food.img ? el("img", { src: food.img, alt: "", class: "food-img", referrerpolicy: "no-referrer" }) : el("span", { class: "item-ico", html: UI.icon("apple", 20) }),
        el("div", { class: "grow" }, [
          el("div", { class: "t", text: food.nome }),
          el("div", { class: "s", text: `${num(food.calorias)} kcal · ${num(food.proteina, 1)} P · ${num(food.hidratos, 1)} H · ${num(food.gordura, 1)} G por 100 g` + (food.source ? " · " + food.source : "") }),
          food.incomplete ? el("div", { class: "s", style: "color:var(--warn)", text: "Este produto não tem valores nutricionais na Open Food Facts — edita-o para os preencher." }) : null,
        ]),
        el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Trocar", onclick: () => { selected = null; card.classList.add("hide"); search.classList.remove("hide"); search.input.value = ""; draw(); calc(); search.input.focus(); } }),
      );
      clear(chips);
      const opts = [[100, "100 g"]];
      if (food.servingGrams) opts.unshift([food.servingGrams, `1 porção (${num(food.servingGrams)} g)`]);
      if (food.packageGrams && food.packageGrams !== food.servingGrams) opts.push([food.packageGrams, `Embalagem (${num(food.packageGrams)} g)`]);
      const last = lastGramsFor(food.id); if (last && !opts.some((o) => o[0] === last)) opts.push([last, `Última vez (${num(last)} g)`]);
      opts.forEach(([g, label]) => chips.appendChild(el("button", { class: "pill pill-btn", type: "button", text: label, onclick: () => { grams.input.value = g; calc(); } })));
      grams.input.value = food.servingGrams || last || 100;
      calc();
    }
    function draw() {
      const q = norm(search.input.value);
      clear(results);
      const foods = S().foods || [];
      const recent = recentFoodIds();
      const list = q ? foods.filter((f) => norm(f.nome).includes(q)) : recent.map((id) => foods.find((f) => f.id === id)).filter(Boolean).concat(foods.filter((f) => !recent.includes(f.id)));
      if (!list.length) results.appendChild(el("div", { class: "empty tiny" }, [el("div", { text: "Não tenho esse alimento." }), el("button", { class: "btn btn-sm", style: "margin-top:8px", type: "button", text: "+ Criar “" + search.input.value.trim() + "”", onclick: () => { s.close(); editFood({ nome: search.input.value.trim() }, { thenAdd: { slot, iso } }); } })]));
      list.slice(0, 40).forEach((f) => results.appendChild(el("button", { class: "item pick", type: "button", onclick: () => pick(f) }, [
        el("div", { class: "grow" }, [el("div", { class: "t", text: f.nome }), el("div", { class: "s", text: `${num(f.calorias)} kcal · ${num(f.proteina, 1)} g proteína /100 g` })]),
        el("span", { class: "muted", html: UI.icon("plus", 18) }),
      ])));
    }
    search.input.addEventListener("input", draw);
    grams.input.addEventListener("input", calc);

    const s = sheet("Adicionar ao diário", [
      el("label", { class: "field" }, [el("span", { text: "Refeição" }), slotPicker(slot, (v) => { slot = v; })]),
      el("button", { class: "btn btn-block", type: "button", html: UI.icon("scan", 18) + "<span>Ler código de barras</span>", onclick: () => { s.close(); scanFlow(slot, iso); } }),
      search, card, results, grams, chips, preview,
      el("button", { class: "btn btn-primary btn-block btn-lg", type: "button", text: "Adicionar", onclick: guardClick(() => {
        if (!selected) return toast("Escolhe um alimento.");
        const g = parseFloat(grams.input.value) || 0; if (g <= 0) return toast("Quantidade inválida.");
        ensureFoodSaved(selected);
        pushDiary(iso, [{ slot, ...entryFromFood(selected, g) }]);
        s.close(); toast("Adicionado a " + slotLabel(slot) + " ✓");
      }) }),
    ]);
    draw();
    if (preset) pick(preset);
    return s;
  }
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  function recentFoodIds() {
    const d = S().diary || {}, out = [];
    Object.keys(d).sort().reverse().slice(0, 21).forEach((iso) => (d[iso] || []).slice().reverse().forEach((e) => { if (e.foodId && !out.includes(e.foodId)) out.push(e.foodId); }));
    return out.slice(0, 12);
  }
  function lastGramsFor(foodId) {
    const d = S().diary || {};
    for (const iso of Object.keys(d).sort().reverse()) { const e = (d[iso] || []).slice().reverse().find((x) => x.foodId === foodId); if (e) return e.grams; }
    return null;
  }
  /** Produto vindo da Open Food Facts fica guardado na base (com o código) para a próxima vez ser instantâneo. */
  function ensureFoodSaved(food) {
    if ((S().foods || []).some((f) => f.id === food.id)) return;
    const f = { ...food }; delete f.incomplete;
    Store.update(NS, (s) => { s.foods = s.foods || []; s.foods.unshift(f); }, { silent: true });
  }

  /* --------------------- Scanner --------------------- */
  function scanFlow(slot, iso) {
    Scanner.open(async (code) => {
      toast("A procurar " + code + "…", 1600);
      try {
        const { food } = await Scanner.lookup(code, S().foods || []);
        if (food) {
          if (food.incomplete) { toast("Encontrei o produto, mas sem valores nutricionais — completa-os.", 3500); editFood({ ...food, incomplete: undefined }, { thenAdd: { slot, iso } }); }
          else addFoodSheet(food, slot, iso);
        } else notFound(code, slot, iso, false);
      } catch (e) { notFound(code, slot, iso, true, e.message); }
    });
  }
  function notFound(code, slot, iso, offline, msg) {
    const s = sheet(offline ? "Sem ligação" : "Produto não encontrado", [
      el("p", { class: "muted", text: offline ? `${msg}. Podes criar o alimento à mão com este código (${code}) — fica guardado e da próxima vez é lido sem internet.` : `O código ${code} não está na Open Food Facts. Cria o alimento com os valores do rótulo — fica guardado com este código para a próxima vez.` }),
      el("button", { class: "btn btn-primary btn-block", text: "Criar alimento com este código", onclick: () => { s.close(); editFood({ barcode: code, nome: "" }, { thenAdd: { slot, iso } }); } }),
      el("button", { class: "btn btn-block", text: "Ler outro código", onclick: () => { s.close(); scanFlow(slot, iso); } }),
    ]);
  }

  /* --------------------- Fecho de macros --------------------- */
  function macroSolver(iso) {
    const t = targetsFor(iso);
    if (!t) { toast("Define primeiro as metas."); sub = "metas"; return Tabs.render("nutricao"); }
    const got = dayIntake(iso);
    const need = { p: t.protein - got.p, c: t.carbs - got.c, f: t.fat - got.f, kcal: t.kcal - got.kcal };
    const pen = (x) => (x < 0 ? Math.abs(x) * 2.2 : Math.abs(x));
    const cands = (S().foods || []).map((food) => {
      let g;
      if (need.p > 3 && food.proteina > 1) g = (need.p / food.proteina) * 100;
      else if (need.c > 5 && food.hidratos > 1) g = (need.c / food.hidratos) * 100;
      else if (need.kcal > 50) g = (need.kcal / Math.max(1, food.calorias)) * 100;
      else return null;
      g = Math.max(10, Math.min(400, Math.round(g / 5) * 5));
      const k = g / 100, add = { p: food.proteina * k, c: food.hidratos * k, f: food.gordura * k, kcal: food.calorias * k };
      return { food, g, add, err: pen(need.p - add.p) * 1.4 + pen(need.c - add.c) + pen(need.f - add.f) * 1.2 + pen((need.kcal - add.kcal) / 25) };
    }).filter(Boolean).sort((a, b) => a.err - b.err).slice(0, 4);
    const body = [el("p", { class: "muted", text: `Faltam ${num(Math.max(0, need.p))} g de proteína, ${num(Math.max(0, need.c))} g de hidratos, ${num(Math.max(0, need.f))} g de gordura e ${num(Math.max(0, need.kcal))} kcal.` })];
    if (!cands.length || (need.p < 3 && need.c < 5 && need.kcal < 50)) body.push(el("div", { class: "empty", text: "Estás praticamente nas metas de hoje. Bom trabalho!" }));
    else cands.forEach((c) => body.push(el("div", { class: "item" }, [
      el("div", { class: "grow" }, [el("div", { class: "t", text: `${c.food.nome} · ${num(c.g)} g` }), el("div", { class: "s", text: `+${num(c.add.p)} P · +${num(c.add.c)} H · +${num(c.add.f)} G · ${num(c.add.kcal)} kcal` })]),
      el("button", { class: "btn btn-soft btn-sm", text: "Adicionar", onclick: guardClick(() => { pushDiary(iso, [{ slot: guessSlot(), ...entryFromFood(c.food, c.g) }]); toast("Adicionado ✓"); sh.close(); }) }),
    ])));
    const sh = sheet("Fechar macros", body);
  }

  /* ----------------------------- PLANO SEMANAL ----------------------------- */
  let planDay = planDayOf(todayISO());
  function renderPlano(view, bar) {
    const nut = S(), plan = nut.mealPlan || {};
    view.appendChild(pageHead({ eyebrow: "Nutrição", icon: "calendar", title: "Plano semanal", sub: "Um modelo da tua semana. O dia de hoje entra sozinho no diário.", actions: [btnI("", "download", "Exportar PDF", () => printWeekPlan())] }));
    view.appendChild(bar);
    const strip = el("div", { class: "weekstrip" }, PLAN_DAYS.map((d) => {
      const count = Object.values(plan[d.id] || {}).reduce((a, arr) => a + (arr ? arr.length : 0), 0);
      return el("div", { class: "d" + (d.id === planDay ? " sel" : "") + (d.id === planDayOf(todayISO()) ? " today" : ""), onclick: () => { planDay = d.id; Tabs.render(Tabs.current); } }, [
        el("div", { class: "wn", text: d.label.slice(0, 3) }), el("div", { class: "dn", text: d.label.slice(0, 1) }), count ? el("div", { class: "pt" }) : el("div", { style: "height:5px;margin-top:4px" }),
      ]);
    }));
    const dayPlan = plan[planDay] || {};
    const tot = { kcal: 0, p: 0, c: 0, f: 0 };
    SLOTS.forEach((sl) => (dayPlan[sl.id] || []).forEach((e) => { tot.kcal += e.kcal || 0; tot.p += e.p || 0; tot.c += e.c || 0; tot.f += e.f || 0; }));
    const t = baseTargets(nut);
    const isToday = planDay === planDayOf(todayISO());
    const kp = el("div", { class: "kpis" }, [
      kpi({ label: PLAN_DAYS.find((d) => d.id === planDay).label, value: num(tot.kcal) + " kcal", sub: t ? `Meta ${num(t.kcal)} kcal` : "Plano do dia", icon: "flame", variant: "accent" }),
      kpi({ label: "Proteína", value: num(tot.p) + " g", sub: t ? `Meta ${num(t.protein)} g` : "", icon: "dumbbell" }),
      kpi({ label: "Hidratos · Gordura", value: `${num(tot.c)} · ${num(tot.f)} g`, sub: t ? `Metas ${num(t.carbs)} · ${num(t.fat)} g` : "", icon: "apple" }),
    ]);
    const slots = el("div", { class: "slot-grid" }, SLOTS.map((sl) => {
      const entries = dayPlan[sl.id] || [];
      return el("div", { class: "card slot-card" }, [
        el("div", { class: "mg-head" }, [el("div", { class: "mg-title", text: sl.label }), el("button", { class: "btn btn-soft btn-icon btn-sm", "aria-label": "Adicionar", html: UI.icon("plus", 18), onclick: () => addPlanEntry(planDay, sl.id) })]),
        entries.length ? el("div", {}, entries.map((e, i) => el("div", { class: "food-line" }, [
          el("div", { class: "grow" }, [el("div", { class: "t", text: e.nome }), el("div", { class: "s", text: e.kcal ? `${num(e.kcal)} kcal · ${num(e.p)} P ${num(e.c)} H ${num(e.f)} G` : "nota" })]),
          el("button", { class: "btn btn-ghost btn-icon btn-sm", "aria-label": "Remover", html: UI.icon("x", 16), onclick: () => removePlanEntry(planDay, sl.id, i) }),
        ]))) : el("div", { class: "tiny muted", style: "padding:6px 0", text: "—" }),
      ]);
    }));
    view.appendChild(el("div", { class: "stack" }, [strip, kp, slots,
      isToday ? el("p", { class: "tiny center", style: "color:var(--good);font-weight:650", text: "Hoje: o que acrescentares aqui também entra no diário." })
        : el("button", { class: "btn btn-primary btn-block", text: "Copiar este dia para o diário de hoje", onclick: guardClick(() => {
          const entries = []; SLOTS.forEach((sl) => (dayPlan[sl.id] || []).forEach((e) => { if (e.kcal) entries.push({ slot: sl.id, foodId: e.foodId, nome: e.nome, grams: e.grams || 0, kcal: e.kcal, p: e.p || 0, c: e.c || 0, f: e.f || 0, fib: e.fib || 0, sug: e.sug || 0, sat: e.sat || 0, sod: e.sod || 0 }); }));
          if (!entries.length) return toast("Nada com macros para copiar.");
          pushDiary(todayISO(), entries); toast(entries.length + " itens no diário de hoje ✓");
        }) }),
      weekTable(plan),
    ]));
  }
  function weekTable(plan) {
    const t = el("table", { class: "plan-table" }, [
      el("thead", {}, [el("tr", {}, [el("th"), ...PLAN_DAYS.map((d) => el("th", { class: d.id === planDay ? "on" : "", text: d.label.slice(0, 3) }))])]),
      el("tbody", {}, SLOTS.map((sl) => el("tr", {}, [el("th", { text: sl.label }), ...PLAN_DAYS.map((d) => {
        const es = (plan[d.id] && plan[d.id][sl.id]) || [];
        return el("td", { class: d.id === planDay ? "on" : "", onclick: () => { planDay = d.id; Tabs.render(Tabs.current); } }, es.length ? es.slice(0, 3).map((e) => el("div", { text: e.nome })) : [el("span", { class: "muted", text: "—" })]);
      })]))),
    ]);
    return panel({ title: "Semana completa", sub: "Toca num dia para o editar." }, [el("div", { class: "table-scroll" }, [t])]);
  }
  function removePlanEntry(dayId, slotId, i) {
    Store.update(NS, (s) => {
      const arr = ((s.mealPlan || {})[dayId] || {})[slotId] || []; const removed = arr.splice(i, 1)[0];
      if (dayId === planDayOf(todayISO()) && removed && removed.id) {
        const iso = todayISO(); const gone = (s.diary[iso] || []).filter((d) => d.planRef === removed.id);
        s.diary[iso] = (s.diary[iso] || []).filter((d) => d.planRef !== removed.id);
        if (gone.length) { s._tomb = s._tomb || {}; s._tomb.diaryItems = s._tomb.diaryItems || {}; gone.forEach((g) => { s._tomb.diaryItems[g.id] = Date.now(); }); }
      }
    });
  }
  function addPlanEntry(dayId, slotId) {
    let mode = "food";
    const seg = el("div", { class: "subtabs" }, [["food", "Alimento"], ["meal", "Refeição"], ["text", "Nota"]].map(([m, l]) => el("button", { class: m === mode ? "active" : "", text: l, onclick: (e) => { mode = m; [...seg.children].forEach((c) => c.classList.toggle("active", c === e.currentTarget)); draw(); } })));
    const body = el("div", { class: "form-grid", style: "display:flex;flex-direction:column;gap:12px" });
    function push(entry) {
      entry.id = uid();
      Store.update(NS, (s) => {
        s.mealPlan = s.mealPlan || {}; s.mealPlan[dayId] = s.mealPlan[dayId] || {}; s.mealPlan[dayId][slotId] = s.mealPlan[dayId][slotId] || [];
        s.mealPlan[dayId][slotId].push(entry);
        if (dayId === planDayOf(todayISO()) && entry.kcal) { const iso = todayISO(); s.diary[iso] = s.diary[iso] || []; s.diary[iso].push({ id: uid(), slot: slotId, planRef: entry.id, foodId: entry.foodId, nome: entry.nome, grams: entry.grams || 0, kcal: entry.kcal, p: entry.p || 0, c: entry.c || 0, f: entry.f || 0, fib: entry.fib || 0, sug: entry.sug || 0, sat: entry.sat || 0, sod: entry.sod || 0 }); }
      });
      sh.close(); toast("Adicionado ao plano ✓");
    }
    function draw() {
      clear(body);
      if (mode === "meal") {
        const meals = S().meals || [];
        if (!meals.length) return body.appendChild(el("div", { class: "empty tiny", text: "Ainda não tens refeições guardadas (separador Refeições)." }));
        meals.forEach((m) => { const t = m.items.reduce((a, it) => ({ kcal: a.kcal + it.kcal, p: a.p + it.p, c: a.c + it.c, f: a.f + it.f }), { kcal: 0, p: 0, c: 0, f: 0 });
          body.appendChild(el("button", { class: "item pick", onclick: guardClick(() => push({ kind: "meal", nome: m.nome, kcal: Math.round(t.kcal), p: +t.p.toFixed(1), c: +t.c.toFixed(1), f: +t.f.toFixed(1) })) }, [el("div", { class: "grow" }, [el("div", { class: "t", text: m.nome }), el("div", { class: "s", text: num(t.kcal) + " kcal" })]), el("span", { html: UI.icon("plus", 18) })])); });
      } else if (mode === "food") {
        const q = field("Alimento", { placeholder: "Procurar…" }), g = field("Gramas", { type: "number", value: 100, inputmode: "decimal" }), res = el("div", { class: "list pick-list" });
        const drawR = () => { clear(res); const t = norm(q.input.value); (S().foods || []).filter((f) => norm(f.nome).includes(t)).slice(0, 25).forEach((f) => res.appendChild(el("button", { class: "item pick", onclick: guardClick(() => { const grams = parseFloat(g.input.value) || 100; push({ kind: "food", ...entryFromFood(f, grams), nome: `${f.nome} (${num(grams)} g)` }); }) }, [el("div", { class: "grow t", text: f.nome }), el("span", { html: UI.icon("plus", 18) })]))); };
        q.input.addEventListener("input", drawR); drawR(); body.append(g, q, res);
      } else {
        const t = field("Nota", { placeholder: "ex: Sopa + fruta" });
        body.append(t, el("button", { class: "btn btn-primary btn-block", text: "Adicionar nota", onclick: guardClick(() => { if (t.input.value.trim()) push({ kind: "text", nome: t.input.value.trim() }); }) }));
      }
    }
    draw();
    const sh = sheet(`${PLAN_DAYS.find((d) => d.id === dayId).label} · ${slotLabel(slotId)}`, [seg, body]);
  }
  function printWeekPlan() {
    const plan = S().mealPlan || {}; const esc = (s) => String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    document.getElementById("print-area") && document.getElementById("print-area").remove();
    const rows = SLOTS.map((sl) => `<tr><th>${esc(sl.label)}</th>${PLAN_DAYS.map((d) => `<td>${((plan[d.id] || {})[sl.id] || []).map((e) => esc(e.nome) + (e.kcal ? ` <small>(${num(e.kcal)} kcal)</small>` : "")).join("<br>") || "—"}</td>`).join("")}</tr>`).join("");
    const area = el("div", { id: "print-area", html: `<h1>Plano de alimentação semanal</h1><p>Gerado em ${new Date().toLocaleDateString("pt-PT")}</p><table><thead><tr><th></th>${PLAN_DAYS.map((d) => `<th>${d.label}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>` });
    document.body.appendChild(area); window.print(); setTimeout(() => area.remove(), 800);
  }

  /* ----------------------------- ALIMENTOS ----------------------------- */
  let foodQuery = "";
  function renderAlimentos(view, bar) {
    const foods = S().foods || [];
    view.appendChild(pageHead({ eyebrow: "Nutrição", icon: "list", title: "Alimentos", sub: `${foods.length} alimentos na tua base (valores por 100 g).`, actions: [btnI("btn-primary", "scan", "Ler código", () => Scanner.open(async (code) => {
      try { const { food, from } = await Scanner.lookup(code, S().foods || []); if (food && from === "local") editFood(food); else editFood(food ? { ...food, incomplete: undefined } : { barcode: code, nome: "" }, { isNew: true }); }
      catch (e) { editFood({ barcode: code, nome: "" }, { isNew: true }); toast(e.message); }
    })), btnI("", "plus", "Novo", () => editFood(null))] }));
    view.appendChild(bar);
    const q = el("input", { type: "search", placeholder: "Procurar alimento…", value: foodQuery, class: "search-input", "aria-label": "Procurar alimento" });
    const list = el("div", { class: "list" });
    const draw = () => {
      foodQuery = q.value; clear(list); const t = norm(q.value);
      const fs = foods.filter((f) => norm(f.nome).includes(t) || (f.barcode && f.barcode.includes(t)));
      if (!fs.length) list.appendChild(el("div", { class: "empty", text: "Sem resultados." }));
      fs.forEach((f) => list.appendChild(el("button", { class: "item pick", onclick: () => editFood(f) }, [
        el("div", { class: "grow" }, [el("div", { class: "t", text: f.nome }), el("div", { class: "s", text: `${f.categoria || "Outros"} · ${num(f.calorias)} kcal · ${num(f.proteina, 1)} P ${num(f.hidratos, 1)} H ${num(f.gordura, 1)} G` + (f.barcode ? " · " + f.barcode : "") })]),
        el("span", { class: "muted", html: UI.icon("pencil", 16) }),
      ])));
    };
    q.addEventListener("input", draw); draw();
    view.appendChild(panel({}, [q, list]));
  }

  function editFood(food, { isNew, thenAdd } = {}) {
    const f = food || { nome: "", categoria: "Outros" };
    const exists = f.id && (S().foods || []).some((x) => x.id === f.id);
    const nf = (label, key, v) => field(label, { type: "number", value: v != null ? v : f[key] != null && f[key] !== "" ? f[key] : "", inputmode: "decimal", step: "any" });
    const fn = field("Nome", { value: f.nome || "", placeholder: "ex: Iogurte proteico" });
    const fc = field("Categoria", { value: f.categoria || "Outros" });
    const fb = field("Código de barras", { value: f.barcode || "", inputmode: "numeric" });
    const fk = nf("Calorias (kcal)", "calorias"), fp = nf("Proteína (g)", "proteina"), fh = nf("Hidratos (g)", "hidratos"), fg = nf("Gordura (g)", "gordura");
    const fFib = nf("Fibra (g)", "fibra"), fSug = nf("Açúcar (g)", "acucar"), fSat = nf("Saturada (g)", "saturadas"), fSod = nf("Sódio (mg)", "sodio");
    const fServ = nf("Porção (g)", "servingGrams");
    const extra = EXTRA_MICROS.map((m) => nf(`${m.label} (${m.unit})`, m.id));
    const pairs = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 2) out.push(el("div", { class: "input-row" }, arr.slice(i, i + 2))); return out; };
    const s = sheet(exists ? "Editar alimento" : "Novo alimento", [
      el("p", { class: "tiny muted", text: "Valores por 100 g, tal como no rótulo." }),
      fn, el("div", { class: "input-row" }, [fc, fb]), el("div", { class: "input-row" }, [fk, fp]), el("div", { class: "input-row" }, [fh, fg]), fServ,
      el("details", {}, [el("summary", { class: "tiny muted", style: "cursor:pointer;padding:6px 0", text: "Micronutrientes (opcional)" }), el("div", { style: "display:flex;flex-direction:column;gap:12px;margin-top:10px" }, [...pairs([fFib, fSug, fSat, fSod]), ...pairs(extra)])]),
      el("div", { class: "row", style: "gap:10px" }, [
        exists ? el("button", { class: "btn btn-danger btn-block", text: "Apagar", onclick: () => {
          const snap = JSON.parse(JSON.stringify(f));
          Store.update(NS, (st) => { st.foods = st.foods.filter((x) => x.id !== f.id); }); s.close();
          undo("Alimento apagado", () => Store.update(NS, (st) => { st.foods.unshift(snap); }));
        } }) : null,
        el("button", { class: "btn btn-primary btn-block", text: thenAdd ? "Guardar e adicionar" : "Guardar", onclick: guardClick(() => {
          const name = fn.input.value.trim(); if (!name) return toast("Dá um nome ao alimento.");
          const data = { ...f, id: f.id || uid(), nome: name, categoria: fc.input.value.trim() || "Outros", calorias: +fk.input.value || 0, proteina: +fp.input.value || 0, hidratos: +fh.input.value || 0, gordura: +fg.input.value || 0, fibra: +fFib.input.value || 0, acucar: +fSug.input.value || 0, saturadas: +fSat.input.value || 0, sodio: +fSod.input.value || 0 };
          const bc = fb.input.value.replace(/\D/g, ""); if (bc) data.barcode = Scanner.normalize(bc); else delete data.barcode;
          const sv = +fServ.input.value; if (sv > 0) data.servingGrams = sv; else delete data.servingGrams;
          EXTRA_MICROS.forEach((m, i) => { const v = +extra[i].input.value; if (v) data[m.id] = v; else delete data[m.id]; });
          delete data.incomplete;
          Store.update(NS, (st) => { st.foods = st.foods || []; const i = st.foods.findIndex((x) => x.id === data.id); if (i >= 0) st.foods[i] = data; else st.foods.unshift(data); });
          s.close(); toast("Guardado ✓");
          if (thenAdd) addFoodSheet(data, thenAdd.slot, thenAdd.iso);
        }) }),
      ]),
    ]);
    if (!f.nome) setTimeout(() => fn.input.focus(), 50);
  }

  /* ----------------------------- REFEIÇÕES ----------------------------- */
  function renderRefeicoes(view, bar) {
    const meals = S().meals || [];
    view.appendChild(pageHead({ eyebrow: "Nutrição", icon: "copy", title: "Refeições", sub: "Combinações que repetes — entram no diário com um toque.", actions: [btnI("btn-primary", "plus", "Nova refeição", () => editMeal(null))] }));
    view.appendChild(bar);
    if (!meals.length) return view.appendChild(panel({}, [el("div", { class: "empty", text: "Cria refeições (ex: “Pequeno-almoço habitual”) para as registares de uma vez." })]));
    view.appendChild(el("div", { class: "slot-grid" }, meals.map((m) => {
      const t = m.items.reduce((a, it) => ({ kcal: a.kcal + it.kcal, p: a.p + it.p }), { kcal: 0, p: 0 });
      return el("div", { class: "card" }, [
        el("div", { class: "mg-head" }, [el("div", {}, [el("div", { class: "mg-title", text: m.nome }), el("div", { class: "tiny muted", text: `${m.items.length} alimentos · ${num(t.kcal)} kcal · ${num(t.p)} g proteína` })])]),
        el("div", { class: "tiny muted", style: "margin:8px 0 14px", text: m.items.map((i) => i.nome).join(", ") }),
        el("div", { class: "row", style: "gap:8px" }, [el("button", { class: "btn btn-soft btn-sm", text: "+ Diário de hoje", onclick: guardClick(() => logMeal(m, todayISO())) }), el("button", { class: "btn btn-ghost btn-sm", text: "Editar", onclick: () => editMeal(m) })]),
      ]);
    })));
  }
  function editMeal(meal) {
    const m = meal ? JSON.parse(JSON.stringify(meal)) : { id: uid(), nome: "", items: [] };
    const fn = field("Nome", { value: m.nome, placeholder: "ex: Pequeno-almoço habitual" });
    const box = el("div", { class: "list" });
    const draw = () => { clear(box); if (!m.items.length) box.appendChild(el("div", { class: "empty tiny", text: "Sem alimentos ainda." }));
      m.items.forEach((it, i) => box.appendChild(el("div", { class: "item" }, [el("div", { class: "grow" }, [el("div", { class: "t", text: it.nome }), el("div", { class: "s", text: `${num(it.grams)} g · ${num(it.kcal)} kcal` })]), el("button", { class: "btn btn-ghost btn-icon btn-sm", "aria-label": "Remover", html: UI.icon("x", 16), onclick: () => { m.items.splice(i, 1); draw(); } })]))); };
    draw();
    const s = sheet(meal ? "Editar refeição" : "Nova refeição", [fn, el("div", { class: "section-title", text: "Alimentos" }), box,
      el("button", { class: "btn btn-block", text: "+ Adicionar alimento", onclick: () => {
        const q = field("Alimento", { placeholder: "Procurar…" }), g = field("Gramas", { type: "number", value: 100, inputmode: "decimal" }), res = el("div", { class: "list pick-list" });
        const drawR = () => { clear(res); const t = norm(q.input.value); (S().foods || []).filter((f) => norm(f.nome).includes(t)).slice(0, 25).forEach((f) => res.appendChild(el("button", { class: "item pick", onclick: () => { m.items.push(entryFromFood(f, parseFloat(g.input.value) || 100)); s2.close(); draw(); } }, [el("div", { class: "grow t", text: f.nome }), el("span", { html: UI.icon("plus", 18) })]))); };
        q.input.addEventListener("input", drawR); drawR();
        const s2 = sheet("Adicionar à refeição", [g, q, res]);
      } }),
      el("div", { class: "row", style: "gap:10px" }, [
        meal ? el("button", { class: "btn btn-danger btn-block", text: "Apagar", onclick: () => { Store.update(NS, (st) => { st.meals = st.meals.filter((x) => x.id !== m.id); }); s.close(); } }) : null,
        el("button", { class: "btn btn-primary btn-block", text: "Guardar", onclick: () => { m.nome = fn.input.value.trim() || "Refeição"; Store.update(NS, (st) => { st.meals = st.meals || []; const i = st.meals.findIndex((x) => x.id === m.id); if (i >= 0) st.meals[i] = m; else st.meals.push(m); }); s.close(); toast("Guardado ✓"); } }),
      ]),
    ]);
  }

  /* ----------------------------- METAS E PESO ----------------------------- */
  function renderMetas(view, bar) {
    const nut = S(), p = nut.profile || { sex: "m", activity: "moderado", goal: "maintain" };
    view.appendChild(pageHead({ eyebrow: "Nutrição", icon: "target", title: "Metas e peso", sub: "Calculadora Mifflin-St Jeor ou metas definidas por ti." }));
    view.appendChild(bar);
    const t = baseTargets(nut);
    const cur = el("div", { class: "kpis" }, t ? [
      kpi({ label: "Calorias / dia", value: num(t.kcal) + " kcal", sub: t.manual ? "Metas manuais" : "Calculadas pelo perfil", icon: "flame", variant: "accent" }),
      kpi({ label: "Proteína", value: num(t.protein) + " g", sub: nut.profile && nut.profile.weight ? num(t.protein / nut.profile.weight, 1) + " g/kg" : "", icon: "dumbbell" }),
      kpi({ label: "Hidratos · Gordura", value: `${num(t.carbs)} · ${num(t.fat)} g`, sub: "Dias de treino: +12% em hidratos", icon: "apple" }),
    ] : [kpi({ label: "Metas", value: "Por definir", sub: "Preenche o perfil abaixo", icon: "target", variant: "accent" })]);

    const fAge = field("Idade", { type: "number", value: p.age || "", inputmode: "numeric" });
    const fSex = field("Sexo", { type: "select", value: p.sex, options: [{ value: "m", label: "Masculino" }, { value: "f", label: "Feminino" }] });
    const fW = field("Peso (kg)", { type: "number", value: p.weight || "", inputmode: "decimal", step: "0.1" });
    const fH = field("Altura (cm)", { type: "number", value: p.height || "", inputmode: "numeric" });
    const fAct = field("Atividade", { type: "select", value: p.activity, options: Object.keys(ACTIVITY).map((k) => ({ value: k, label: ACTIVITY[k].label })) });
    const fGoal = field("Objetivo", { type: "select", value: p.goal, options: [{ value: "lose", label: "Perder gordura (−400 kcal)" }, { value: "maintain", label: "Manter" }, { value: "gain", label: "Ganhar massa (+400 kcal)" }] });
    const out = el("div", { class: "calc-out" });
    const prof = () => ({ age: +fAge.input.value, sex: fSex.input.value, weight: +fW.input.value, height: +fH.input.value, activity: fAct.input.value, goal: fGoal.input.value });
    const recompute = () => { const r = nutritionTargets(prof()); clear(out); if (!r) return out.appendChild(el("div", { class: "tiny muted", text: "Preenche idade, peso e altura." }));
      out.append(...[["Metabolismo basal", r.tmb + " kcal"], ["Gasto diário", r.getd + " kcal"], ["Meta", r.kcal + " kcal"], ["Proteína", r.protein + " g"], ["Hidratos", r.carbs + " g"], ["Gordura", r.fat + " g"]].map(([k, v]) => el("div", {}, [el("span", { class: "muted tiny", text: k }), el("b", { class: "num", text: v })]))); };
    [fAge, fSex, fW, fH, fAct, fGoal].forEach((f) => f.input.addEventListener("input", recompute)); recompute();

    const manual = nut.customTargets && nut.customTargets.kcal;
    view.appendChild(el("div", { class: "stack" }, [cur,
      el("div", { class: "grid-2" }, [
        weightPanel(),
        panel({ title: "Calculadora", sub: manual ? "Tens metas manuais ativas — guardar aqui substitui-as." : "Com base no teu perfil." }, [
          el("div", { style: "display:flex;flex-direction:column;gap:12px" }, [el("div", { class: "input-row" }, [fAge, fSex]), el("div", { class: "input-row" }, [fW, fH]), fAct, fGoal, out,
            el("div", { class: "row", style: "gap:10px" }, [
              el("button", { class: "btn btn-primary btn-block", text: "Guardar metas", onclick: () => { const pr = prof(); const r = nutritionTargets(pr); if (!r) return toast("Preenche idade, peso e altura."); Store.update(NS, (s) => { s.profile = pr; s.targets = r; s.customTargets = null; }); toast("Metas guardadas ✓"); } }),
              el("button", { class: "btn btn-block", text: manual ? "Editar manuais" : "Definir à mão", onclick: setManualTargets }),
            ])]),
        ]),
      ]),
    ]));
  }
  function setManualTargets() {
    const c = S().customTargets || {}, t = baseTargets(S()) || {};
    const f = (l, k) => field(l, { type: "number", value: c[k] || t[k] || "", inputmode: "numeric" });
    const fk = f("Calorias (kcal)", "kcal"), fp = f("Proteína (g)", "protein"), fc = f("Hidratos (g)", "carbs"), fg = f("Gordura (g)", "fat");
    const sh = sheet("Metas manuais", [el("p", { class: "tiny muted", text: "Têm prioridade sobre a calculadora." }), fk, el("div", { class: "input-row" }, [fp, fc]), fg,
      el("div", { class: "row", style: "gap:10px" }, [
        c.kcal ? el("button", { class: "btn btn-block", text: "Usar calculadora", onclick: () => { Store.update(NS, (s) => { s.customTargets = null; }); sh.close(); } }) : null,
        el("button", { class: "btn btn-primary btn-block", text: "Guardar", onclick: () => { const kcal = +fk.input.value; if (!kcal) return toast("Indica as calorias."); Store.update(NS, (s) => { s.customTargets = { kcal, protein: +fp.input.value || 0, carbs: +fc.input.value || 0, fat: +fg.input.value || 0 }; }); sh.close(); toast("Metas guardadas ✓"); } }),
      ])]);
  }
  function weightEntries() { return Object.entries(S().weightLog || {}).filter(([, v]) => v).sort((a, b) => a[0].localeCompare(b[0])); }
  function weightPanel() {
    const es = weightEntries(), last = es.length ? es[es.length - 1] : null, first = es[0];
    const d30 = es.filter(([d]) => d >= shiftDay(todayISO(), -30));
    const delta = last && first ? last[1] - first[1] : 0;
    return panel({ title: "Peso", sub: last ? `Último registo: ${UI.prettyDate(last[0])}` : "Regista para acompanhares a evolução.", action: el("button", { class: "btn btn-soft btn-sm", text: "+ Registar", onclick: logWeight }) }, [
      el("div", { class: "big-num" }, [el("span", { class: "num", text: last ? num(last[1], 1) : "—" }), el("small", { text: " kg" })]),
      es.length > 1 ? el("div", { class: "tiny", style: "color:var(--text-soft);margin:4px 0 12px", text: `${delta > 0 ? "+" : ""}${num(delta, 1)} kg desde ${UI.prettyDate(first[0])}` + (d30.length > 1 ? ` · ${d30[d30.length - 1][1] - d30[0][1] > 0 ? "+" : ""}${num(d30[d30.length - 1][1] - d30[0][1], 1)} kg em 30 dias` : "") }) : null,
      es.length > 1 ? UI.lineChart(es.slice(-40).map((e) => e[1]), { height: 90, labels: [UI.prettyDate(es.slice(-40)[0][0]), UI.prettyDate(last[0])] }) : null,
    ]);
  }
  function logWeight() {
    const last = weightEntries().pop();
    const f = field("Peso (kg)", { type: "number", value: last ? last[1] : (S().profile && S().profile.weight) || "", inputmode: "decimal", step: "0.1" });
    const fd = field("Data", { type: "date", value: todayISO() });
    const sh = sheet("Registar peso", [f, fd, el("button", { class: "btn btn-primary btn-block", text: "Guardar", onclick: () => {
      const kg = parseFloat(String(f.input.value).replace(",", ".")); if (!kg) return toast("Indica o peso.");
      Store.update(NS, (s) => {
        s.weightLog = s.weightLog || {}; s.weightLog[fd.input.value] = kg;
        const dates = Object.keys(s.weightLog).sort();
        if (dates[dates.length - 1] === fd.input.value) { s.profile = s.profile || { sex: "m", activity: "moderado", goal: "maintain" }; s.profile.weight = kg; if (s.profile.height && s.profile.age) s.targets = nutritionTargets(s.profile); }
      });
      sh.close(); toast("Peso registado ✓");
    } })]);
  }

  global.Nutri = { init, render, caloriesPanel, targetsFor, dayIntake, addFoodSheet, scanFlow, logWeight, weightEntries, weightPanel, trainedOn, macroSolver,
    go(subId) { sub = subId; Tabs.render("nutricao"); }, setDate(iso) { viewDate = iso; } };
})(window);
