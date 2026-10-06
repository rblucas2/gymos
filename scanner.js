/* =====================================================================
   scanner.js — leitor de códigos de barras de alimentos.
   Porque é que o scanner antigo falhava no iPhone: o Safari não tem a API
   BarcodeDetector e a alternativa (html5-qrcode carregada do unpkg) muitas
   vezes não carregava ou lia mal EAN-13. Aqui:
   1) BarcodeDetector nativo quando existe (Android/Chrome);
   2) senão, o mesmo motor ZXing compilado para WebAssembly, servido pela
      própria app (vendor/), sem depender de nenhum CDN;
   3) vídeo em alta resolução com foco contínuo, leitura da faixa central
      e da imagem inteira, validação do dígito de controlo e 2 leituras iguais
      antes de aceitar; lanterna quando o telemóvel deixa;
   4) alternativa por fotografia (câmara nativa do iOS, foca melhor) e
      introdução manual do número.
   Procura primeiro na base local (alimentos já guardados com esse código)
   e depois na Open Food Facts.
   ===================================================================== */
(function (global) {
  const { el, clear, toast, sheet } = UI;
  const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
  let detectorP = null;

  /** Devolve um detetor (nativo ou ZXing/WASM local). */
  function getDetector() {
    if (detectorP) return detectorP;
    detectorP = (async () => {
      if ("BarcodeDetector" in global) {
        try {
          const sup = await global.BarcodeDetector.getSupportedFormats();
          const fm = FORMATS.filter((f) => sup.includes(f));
          if (fm.includes("ean_13")) return { det: new global.BarcodeDetector({ formats: fm }), kind: "nativo" };
        } catch (e) { /* cai para o ZXing */ }
      }
      const api = global.BarcodeDetectionAPI;
      if (!api) throw new Error("Leitor indisponível");
      const wasm = new URL("./vendor/zxing_reader.wasm", document.baseURI).href;
      api.prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasm : prefix + path) }, fireImmediately: true });
      return { det: new api.BarcodeDetector({ formats: FORMATS }), kind: "zxing" };
    })();
    detectorP.catch(() => { detectorP = null; });
    return detectorP;
  }

  /** Dígito de controlo GS1 (EAN-8/12/13/14). Códigos de outro tamanho passam. */
  function validCode(code) {
    if (!/^\d+$/.test(code)) return code.length >= 4;
    if (![8, 12, 13, 14].includes(code.length)) return code.length >= 6;
    const digits = code.split("").map(Number), check = digits.pop();
    const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === check;
  }
  // UPC-A (12) é o mesmo produto que o EAN-13 com 0 à frente — a Open Food Facts guarda em 13
  const normalize = (code) => (code && /^\d{12}$/.test(code) ? "0" + code : code);

  async function detectIn(det, source) {
    try { const r = await det.detect(source); return (r || []).map((b) => (b.rawValue || "").trim()).filter(Boolean); }
    catch (e) { return []; }
  }

  /** Lê um código numa fotografia: imagem inteira, versão reduzida e faixa central (algumas rodadas). */
  async function decodeImage(file) {
    const { det } = await getDetector();
    const bmp = await createImageBitmap(file);
    const tries = [];
    const draw = (w, h, sx, sy, sw, sh, rot) => {
      const c = document.createElement("canvas");
      c.width = rot ? h : w; c.height = rot ? w : h;
      const g = c.getContext("2d");
      if (rot) { g.translate(c.width / 2, c.height / 2); g.rotate(Math.PI / 2); g.translate(-w / 2, -h / 2); }
      g.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
      return c;
    };
    const W = bmp.width, H = bmp.height, k = Math.min(1, 1600 / Math.max(W, H));
    tries.push(() => bmp);
    tries.push(() => draw(Math.round(W * k), Math.round(H * k), 0, 0, W, H));
    tries.push(() => draw(Math.round(W * 0.9 * k * 1.4), Math.round(H * 0.45 * k * 1.4), W * 0.05, H * 0.275, W * 0.9, H * 0.45));
    tries.push(() => draw(Math.round(W * k), Math.round(H * k), 0, 0, W, H, true));
    for (const t of tries) {
      const codes = (await detectIn(det, t())).filter(validCode);
      if (codes.length) return normalize(codes[0]);
    }
    return null;
  }

  /* ----------------------------- Open Food Facts ----------------------------- */
  const OFF_FIELDS = "code,product_name,product_name_pt,generic_name,brands,quantity,serving_quantity,serving_size,nutriments,categories_tags,image_front_small_url";

  /** Converte texto de quantidade ("280 g", "1 L", "6 x 25 g") em gramas. */
  function parseQuantityGrams(qty) {
    if (!qty) return null;
    const s = String(qty).toLowerCase().replace(",", ".");
    const multi = s.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\b/);
    const toG = (v, u) => (u === "kg" || u === "l" ? v * 1000 : u === "cl" ? v * 10 : v);
    if (multi) { const t = Math.round(parseFloat(multi[1]) * toG(parseFloat(multi[2]), multi[3])); return t > 0 ? t : null; }
    const single = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\b/);
    if (single) { const t = Math.round(toG(parseFloat(single[1]), single[2])); return t > 0 ? t : null; }
    return null;
  }

  function categoryFrom(tags) {
    const t = (tags || []).join(" ");
    if (/dairies|yogurt|cheese|milk/.test(t)) return "Laticínios";
    if (/meat|fish|seafood|egg|poultr/.test(t)) return "Proteína";
    if (/fruit/.test(t)) return "Fruta";
    if (/vegetable|legume/.test(t)) return "Legumes";
    if (/bread|biscuit|pastr|cake|bakery/.test(t)) return "Padaria";
    if (/cereal|pasta|rice|potato/.test(t)) return "Hidratos";
    if (/beverage|drink|juice|water/.test(t)) return "Bebidas";
    if (/snack|sweet|chocolate|candy|confectioner/.test(t)) return "Snacks";
    if (/protein|supplement/.test(t)) return "Suplemento";
    return "Outros";
  }

  /** Produto da Open Food Facts → alimento da app (valores por 100 g). */
  function foodFromOFF(p, code) {
    const n = p.nutriments || {};
    const v = (k) => { const x = parseFloat(n[k + "_100g"]); return isFinite(x) ? x : null; };
    let kcal = v("energy-kcal");
    if (kcal == null && v("energy") != null) kcal = v("energy") / 4.184;   // kJ → kcal
    const r1 = (x) => (x == null ? 0 : Math.round(x * 10) / 10);
    let sodium = v("sodium"); if (sodium == null && v("salt") != null) sodium = v("salt") / 2.5;
    const food = {
      id: "off_" + code, barcode: code,
      nome: [p.product_name_pt || p.product_name || p.generic_name || "Produto " + code, p.brands ? "· " + String(p.brands).split(",")[0].trim() : ""].join(" ").trim(),
      categoria: categoryFrom(p.categories_tags),
      calorias: Math.round(kcal || 0), proteina: r1(v("proteins")), hidratos: r1(v("carbohydrates")), gordura: r1(v("fat")),
      fibra: r1(v("fiber")), acucar: r1(v("sugars")), saturadas: r1(v("saturated-fat")), sodio: Math.round((sodium || 0) * 1000),
      source: "Open Food Facts",
    };
    // micronutrientes: a OFF guarda tudo em gramas
    const micro = { vitD: ["vitamin-d", 1e6], vitE: ["vitamin-e", 1e3], vitC: ["vitamin-c", 1e3], magnesio: ["magnesium", 1e3], ferro: ["iron", 1e3], calcio: ["calcium", 1e3], potassio: ["potassium", 1e3], zinco: ["zinc", 1e3] };
    for (const id in micro) { const x = v(micro[id][0]); if (x) food[id] = Math.round(x * micro[id][1] * 100) / 100; }
    const serving = parseFloat(p.serving_quantity) || parseQuantityGrams(p.serving_size);
    if (serving > 0 && serving < 2000) food.servingGrams = Math.round(serving);
    const pack = parseQuantityGrams(p.quantity);
    if (pack) food.packageGrams = pack;
    if (p.image_front_small_url) food.img = p.image_front_small_url;
    food.incomplete = !kcal && !food.proteina && !food.hidratos && !food.gordura;
    return food;
  }

  /** Procura o código: base local → Open Food Facts. Devolve { food, from } ou { food:null }. */
  async function lookup(code, localFoods = []) {
    code = normalize(code);
    const local = localFoods.find((f) => f.barcode && normalize(f.barcode) === code);
    if (local) return { food: local, from: "local" };
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, { signal: ctrl.signal });
      if (r.status === 404) return { food: null, from: "off" };
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (!j || j.status !== 1 || !j.product) return { food: null, from: "off" };
      return { food: foodFromOFF(j.product, code), from: "off" };
    } catch (e) {
      const err = new Error(e.name === "AbortError" ? "A Open Food Facts não respondeu" : "Sem ligação à Open Food Facts");
      err.offline = true; throw err;
    } finally { clearTimeout(t); }
  }

  /* ----------------------------- Interface ----------------------------- */
  /** Abre o leitor. onCode(code) é chamado uma vez com o código lido (o leitor fecha-se sozinho). */
  function open(onCode, { title = "Ler código de barras" } = {}) {
    let stream = null, timer = null, closed = false, lastCode = null, lastAt = 0, track = null, torch = false;
    const video = el("video", { playsinline: true, muted: true, autoplay: true, "aria-label": "Câmara" });
    video.muted = true; video.setAttribute("webkit-playsinline", "");
    const status = el("div", { class: "scan-status", text: "A iniciar a câmara…" });
    const torchBtn = el("button", { class: "btn btn-sm scan-torch hide", type: "button", text: "Lanterna", onclick: async () => {
      if (!track) return; torch = !torch;
      try { await track.applyConstraints({ advanced: [{ torch }] }); torchBtn.classList.toggle("btn-primary", torch); } catch (e) { toast("Lanterna indisponível"); }
    } });
    const box = el("div", { class: "scan-box" }, [video, el("div", { class: "scan-frame" }, [el("i", { class: "scan-laser" })]), torchBtn]);
    const photoIn = el("input", { type: "file", accept: "image/*", capture: "environment", class: "hide" });
    const manual = el("input", { type: "text", inputmode: "numeric", pattern: "[0-9]*", placeholder: "ou escreve o número (ex: 5601234567890)", "aria-label": "Número do código de barras" });

    function done(code) {
      if (closed) return; closed = true;
      stop(); sh.close();
      if (navigator.vibrate) navigator.vibrate(40);
      onCode(normalize(code));
    }
    function stop() { clearTimeout(timer); timer = null; if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; }

    photoIn.addEventListener("change", async () => {
      const f = photoIn.files && photoIn.files[0]; if (!f) return;
      status.textContent = "A ler a fotografia…";
      try {
        const code = await decodeImage(f);
        if (code) done(code);
        else status.textContent = "Não encontrei um código nesta foto. Tenta mais perto, com boa luz e o código direito.";
      } catch (e) { status.textContent = "Não consegui ler a foto (" + e.message + ")."; }
      photoIn.value = "";
    });

    const sh = sheet(title, [
      box, status,
      el("div", { class: "row", style: "gap:10px" }, [
        el("button", { class: "btn btn-block", type: "button", html: UI.icon("camera", 18) + "<span>Tirar foto</span>", onclick: () => photoIn.click() }),
      ]),
      photoIn,
      el("form", { class: "row", style: "gap:10px", onsubmit: (e) => {
        e.preventDefault(); const c = manual.value.replace(/\D/g, "");
        if (c.length < 6) return toast("Número demasiado curto."); done(c);
      } }, [manual, el("button", { class: "btn btn-primary", type: "submit", text: "OK" })]),
      el("p", { class: "tiny muted", text: "Aponta para o código com boa luz, a 10-20 cm. Se o telemóvel não focar, usa “Tirar foto”." }),
    ], { onClose: () => { closed = true; stop(); } });

    (async () => {
      let det;
      try { det = (await getDetector()).det; }
      catch (e) { status.textContent = "Não foi possível carregar o leitor. Usa “Tirar foto” ou escreve o número."; return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { status.textContent = "Este browser não dá acesso à câmara aqui. Usa “Tirar foto” ou escreve o número."; box.classList.add("off"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      } catch (e) {
        status.textContent = e.name === "NotAllowedError" ? "Sem permissão para a câmara. Autoriza nas definições do browser, ou usa “Tirar foto”." : "Não consegui abrir a câmara. Usa “Tirar foto” ou escreve o número.";
        box.classList.add("off"); return;
      }
      if (closed) return stop();
      track = stream.getVideoTracks()[0];
      try {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        const adv = [];
        if (caps.focusMode && caps.focusMode.includes("continuous")) adv.push({ focusMode: "continuous" });
        if (caps.zoom && caps.zoom.max >= 1.6) adv.push({ zoom: Math.min(2, caps.zoom.max) });   // aproxima um pouco: códigos pequenos leem-se melhor
        if (adv.length) await track.applyConstraints({ advanced: adv });
        if (caps.torch) torchBtn.classList.remove("hide");
      } catch (e) { /* opcional */ }
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* autoplay */ }
      status.textContent = "A procurar código…";
      const canvas = document.createElement("canvas"), g = canvas.getContext("2d", { willReadFrequently: true });
      let n = 0;
      const loop = async () => {
        if (closed) return;
        if (video.readyState >= 2 && video.videoWidth) {
          const W = video.videoWidth, H = video.videoHeight;
          let src = video;
          if (n++ % 2 === 0) {   // alterna: faixa central (mais resolução útil) e imagem inteira
            const sw = Math.round(W * 0.84), shh = Math.round(H * 0.42);
            canvas.width = sw; canvas.height = shh;
            g.drawImage(video, (W - sw) / 2, (H - shh) / 2, sw, shh, 0, 0, sw, shh);
            src = canvas;
          }
          const codes = (await detectIn(det, src)).filter(validCode);
          if (codes.length) {
            const c = codes[0], now = Date.now();
            if (c === lastCode && now - lastAt < 2500) return done(c);   // 2 leituras iguais = certo
            lastCode = c; lastAt = now; status.textContent = "A confirmar " + c + "…";
          }
        }
        timer = setTimeout(loop, 90);
      };
      loop();
    })();
    return sh;
  }

  global.Scanner = { open, lookup, decodeImage, validCode, parseQuantityGrams, foodFromOFF, normalize };
})(window);
