/* =====================================================================
   config.js — configuração da app Físico (carregado antes de tudo).
   Namespaces sincronizados:
   - "nut"  nutrição (perfil, metas, alimentos, diário, refeições, plano, peso)
   - "gym"  treino (planos, semana, sessões, exercícios próprios, separadores)
   - "body" recuperação (check-ins diários, medidas, alongamentos feitos)
   ===================================================================== */
window.APP = {
  id: "fisico",
  prefix: "fisico:",
  title: "Físico",
  namespaces: ["nut", "gym", "body"],
  themeColor: { dark: "#16110e", light: "#f8f4f0" },
  legacyLabel: "Importar dados do gymos e da Nutrição (Vida OS)",
  merge: {
    nut: { ids: ["foods", "meals"], keyed: ["weightLog", "workoutDays", "mealPlan"], deepKeyed: [], after(out, older) {
      // diário: junta as entradas de cada dia por id (dois dispositivos a registar no mesmo dia)
      const a = out.diary || {}, b = older.diary || {};
      const tomb = Object.assign({}, (older._tomb || {}).diaryItems, (out._tomb || {}).diaryItems);
      for (const iso in b) {
        if (!a[iso]) { a[iso] = b[iso]; continue; }
        const ids = new Set(a[iso].map((x) => x.id));
        b[iso].forEach((x) => { if (!ids.has(x.id)) a[iso].push(x); });
      }
      for (const iso in a) a[iso] = (a[iso] || []).filter((x) => !tomb[x.id]);
      out.diary = a;
    } },
    gym: { ids: ["plans", "sessions", "exercises", "tabs"], keyed: ["schedule", "stretchLog", "lastLoads", "records"] },
    body: { deepKeyed: ["checkins", "measures"] },
  },

  /** 1.ª abertura: traz o gymos (treino_state) e a Nutrição da Vida OS (vidaos:nut) deste browser. */
  migrate() {
    const n = (window.FisicoMigrate ? window.FisicoMigrate.all() : 0);
    if (n) setTimeout(() => UI.toast("Trouxe os teus dados do gymos e da Nutrição ✓", 3500), 600);
  },

  /** Botão nas Definições: volta a importar (junta, não apaga) + sincronizações antigas. */
  async importLegacy() {
    let n = window.FisicoMigrate ? window.FisicoMigrate.all(true) : 0;
    const vsys = Store.readRaw("vidaos:sys") || {};
    const old = vsys.sync;
    if (old && old.url && old.key && old.code) {
      try { const d = await Sync.pullLegacy(old, "nut"); if (d) { App.mergeInto("nut", d); n++; } } catch (e) { console.warn(e); }
    }
    const tr = Store.readRaw("treino_state") || {};
    if (tr.sync && tr.sync.url && tr.sync.key && tr.sync.code) {
      try { const d = await Sync.pullLegacy(tr.sync, "gymos"); if (d && window.FisicoMigrate) { n += window.FisicoMigrate.fromGymos(d, true); } } catch (e) { console.warn(e); }
    }
    return n;
  },

  /** Backups aceites no "Importar cópia": backup da Vida OS (com "nut") ou exportação do gymos. */
  importBackup(obj) {
    let ok = false;
    if (obj.nut) ok = App.mergeInto("nut", obj.nut) || ok;
    if (obj.gym) ok = App.mergeInto("gym", obj.gym) || ok;
    if (obj.body) ok = App.mergeInto("body", obj.body) || ok;
    if ((obj.log || obj.customPlans || obj.lastLoads) && window.FisicoMigrate) ok = window.FisicoMigrate.fromGymos(obj, true) > 0 || ok;
    return ok;
  },

  manageTabs() { Tabs.manage(); },
  settingsExtra(closeSettings) { return window.FisicoSettings ? window.FisicoSettings(closeSettings) : []; },
};
