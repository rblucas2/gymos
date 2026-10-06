/* =====================================================================
   anim.js — motor de animação dos exercícios (feito para esta app).
   Boneco 2D com proporções humanas e cinemática inversa: cada exercício
   é descrito por poses-chave (anca, inclinação do tronco, alvos das mãos
   e dos pés) e o motor calcula cotovelos e joelhos, interpola as poses
   com suavidade e desenha o material (barra, halteres, banco, cabo…).
   Unidades: viewBox 0 0 240 200, chão em y=184, figura virada para a direita.
   ===================================================================== */
(function (global) {
  const NSVG = "http://www.w3.org/2000/svg";
  const L = { torso: 50, neck: 8, head: 10, upper: 30, fore: 28, thigh: 44, shin: 42, foot: 14 };
  const GROUND = 184;
  const W = { torsoLow: 20, torsoHigh: 24, upper: 10, fore: 8.5, thigh: 14, shin: 11, foot: 6, neck: 7 };

  const rad = (d) => (d * Math.PI) / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

  /** Cinemática inversa de 2 segmentos: devolve o ponto do meio (cotovelo/joelho) e o ponto final. */
  function ik(root, target, l1, l2, bend) {
    let dx = target[0] - root[0], dy = target[1] - root[1];
    let d = Math.hypot(dx, dy) || 0.001;
    const maxD = l1 + l2 - 0.01, minD = Math.abs(l1 - l2) + 0.01;
    const dc = Math.min(maxD, Math.max(minD, d));
    const th = Math.atan2(dy, dx);
    const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc))));
    const mid = [root[0] + l1 * Math.cos(th + bend * a), root[1] + l1 * Math.sin(th + bend * a)];
    const end = [root[0] + dc * Math.cos(th), root[1] + dc * Math.sin(th)];
    return { mid, end };
  }

  /** Interpola duas poses (objetos com números/arrays, recursivo). */
  function mix(a, b, t) {
    if (typeof a === "number" && typeof b === "number") return lerp(a, b, t);
    if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => mix(v, b[i] !== undefined ? b[i] : v, t));
    if (a && typeof a === "object" && b && typeof b === "object") {
      const out = {};
      for (const k in a) out[k] = k in b ? mix(a[k], b[k], t) : a[k];
      for (const k in b) if (!(k in out)) out[k] = b[k];
      return out;
    }
    return t < 0.5 ? a : b;
  }

  /** Esqueleto completo a partir de uma pose. */
  function solve(p) {
    const front = p.view === "front";
    const hip = p.hip;
    const a = rad(p.torso || 0);
    const dir = [Math.sin(a), -Math.cos(a)];
    const sh = [hip[0] + dir[0] * L.torso, hip[1] + dir[1] * L.torso];
    const curve = p.curve || 0;               // curvatura da coluna (+ = arredondar para a frente)
    const perp = [dir[1], -dir[0]];           // perpendicular "para a frente" do tronco
    const midT = [(hip[0] + sh[0]) / 2 + perp[0] * curve, (hip[1] + sh[1]) / 2 + perp[1] * curve];
    const na = a + rad(p.neck || 0);
    const neckTop = [sh[0] + Math.sin(na) * L.neck, sh[1] - Math.cos(na) * L.neck];
    const head = [neckTop[0] + Math.sin(na) * L.head, neckTop[1] - Math.cos(na) * L.head];
    // de frente: ombros/ancas afastados na perpendicular do tronco; "twist" roda os ombros (encurta a largura)
    const sw = front ? 15 * Math.cos(rad(p.twist || 0)) : 0, hw = front ? 9 * Math.cos(rad((p.twist || 0) * 0.3)) : 0;
    const side = [Math.cos(a), Math.sin(a)];
    // ombros/ancas: no perfil o lado "longe" fica ligeiramente atrás (profundidade)
    const shN = front ? [sh[0] + side[0] * sw, sh[1] + side[1] * sw] : [sh[0] + 1.5, sh[1]];
    const shF = front ? [sh[0] - side[0] * sw, sh[1] - side[1] * sw] : [sh[0] - 1.5, sh[1] - 1];
    const hipN = front ? [hip[0] + side[0] * hw, hip[1] + side[1] * hw] : [hip[0] + 1, hip[1]];
    const hipF = front ? [hip[0] - side[0] * hw, hip[1] - side[1] * hw] : [hip[0] - 1, hip[1] - 1];
    // alvos: [x,y] absolutos ou { rel: "sh"|"hip"|"head", d: [dx,dy] } relativos ao corpo
    const refs = { sh, hip, head, shN, shF, hipN, hipF };
    const tgt = (spec, dflt) => { if (!spec) return dflt; if (Array.isArray(spec)) return spec; const b = refs[spec.rel] || sh; return [b[0] + spec.d[0], b[1] + spec.d[1]]; };
    const handN = tgt(p.handN, [shN[0] + 4, shN[1] + 56]);
    const handF = tgt(p.handF || p.handN, [shF[0] + 4, shF[1] + 56]);
    // dobra: número = sentido da cinemática inversa; [x,y] = posição explícita do cotovelo/joelho
    const chain = (root, target, l1, l2, b, dflt) => {
      if (Array.isArray(b)) { const dx = target[0] - b[0], dy = target[1] - b[1], k = Math.min(1, l2 / (Math.hypot(dx, dy) || 1)); return { mid: b, end: [b[0] + dx * k, b[1] + dy * k] }; }
      return ik(root, target, l1, l2, b != null ? b : dflt);
    };
    const armN = chain(shN, handN, L.upper, L.fore, p.elbowN, 1);
    const armF = chain(shF, handF, L.upper, L.fore, p.elbowF !== undefined ? p.elbowF : (typeof p.elbowN === "number" ? p.elbowN : undefined), 1);
    const legN = chain(hipN, tgt(p.footN, [hip[0] + 4, GROUND - 6]), L.thigh, L.shin, p.kneeN, -1);
    const legF = chain(hipF, tgt(p.footF || p.footN, [hip[0] - 4, GROUND - 6]), L.thigh, L.shin, p.kneeF !== undefined ? p.kneeF : (typeof p.kneeN === "number" ? p.kneeN : undefined), -1);
    const toe = (ankle, ang, len = L.foot) => [ankle[0] + Math.cos(rad(ang)) * len, ankle[1] + Math.sin(rad(ang)) * len];
    const fa = p.footAng != null ? p.footAng : 0;
    // de frente o pé vê-se encurtado e virado ligeiramente para fora
    const footN = front ? toe(legN.end, p.footAngN != null ? p.footAngN : 30, 7) : toe(legN.end, p.footAngN != null ? p.footAngN : fa);
    const footF = front ? toe(legF.end, p.footAngF != null ? p.footAngF : 150, 7) : toe(legF.end, p.footAngF != null ? p.footAngF : fa);
    return { front, hip, sh, midT, neckTop, head, shN, shF, hipN, hipF, armN, armF, legN, legF, footN, footF };
  }

  /* ----------------------------- Desenho ----------------------------- */
  function node(tag, attrs) { const e = document.createElementNS(NSVG, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function line(p1, p2, w, color, extra) { return node("line", { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], "stroke-width": w, stroke: color, "stroke-linecap": "round", ...(extra || {}) }); }

  const COL = { near: "var(--fig, #ece6dd)", far: "var(--fig-far, #8f8a84)", hl: "var(--accent, #f2894b)", hlFar: "var(--accent-far, #b9693c)", steel: "var(--steel, #9aa3ad)", dark: "var(--steel-dark, #5d646d)", band: "var(--band, #e2b33c)" };

  function drawProps(g, props, sk, layer) {
    (props || []).forEach((pr) => {
      if ((pr.layer || "back") !== layer) return;
      const at0 = (ref) => (Array.isArray(ref) ? ref : ref === "handN" ? sk.armN.end : ref === "handF" ? sk.armF.end : ref === "hands" ? [(sk.armN.end[0] + sk.armF.end[0]) / 2, (sk.armN.end[1] + sk.armF.end[1]) / 2] : ref === "shoulder" ? sk.sh : ref === "hip" ? sk.hip : ref === "footN" ? sk.legN.end : ref === "footF" ? sk.legF.end : ref === "head" ? sk.head : ref === "kneeN" ? sk.legN.mid : ref === "kneeF" ? sk.legF.mid : ref === "elbowN" ? sk.armN.mid : ref === "elbowF" ? sk.armF.mid : ref);
      const at = (ref) => { const c = at0(ref); return pr.off && !Array.isArray(ref) ? [c[0] + pr.off[0], c[1] + pr.off[1]] : c; };
      switch (pr.type) {
        case "barbell": {          // perfil: disco + manga; frente: barra comprida
          const c = at(pr.at || "hands");
          if (pr.front) { g.appendChild(line([c[0] - 62, c[1]], [c[0] + 62, c[1]], 4, COL.steel)); [-1, 1].forEach((s) => g.appendChild(node("rect", { x: c[0] + s * 56 - 4, y: c[1] - 17, width: 8, height: 34, rx: 3, fill: COL.dark }))); }
          else { g.appendChild(node("circle", { cx: c[0], cy: c[1], r: pr.r || 17, fill: COL.dark, stroke: COL.steel, "stroke-width": 2 })); g.appendChild(node("circle", { cx: c[0], cy: c[1], r: 3.5, fill: COL.steel })); }
          break;
        }
        case "dumbbell": {
          const c = at(pr.at || "handN");
          if (pr.vertical) { g.appendChild(line([c[0], c[1] - 9], [c[0], c[1] + 9], 3, COL.steel)); [-1, 1].forEach((s) => g.appendChild(node("rect", { x: c[0] - 6, y: c[1] + s * 9 - 3, width: 12, height: 6, rx: 2, fill: COL.dark }))); }
          else { g.appendChild(line([c[0] - 9, c[1]], [c[0] + 9, c[1]], 3, COL.steel)); [-1, 1].forEach((s) => g.appendChild(node("rect", { x: c[0] + s * 9 - 3, y: c[1] - 6, width: 6, height: 12, rx: 2, fill: COL.dark }))); }
          break;
        }
        case "kettlebell": { const c = at(pr.at || "hands"); g.appendChild(node("circle", { cx: c[0], cy: c[1] + 9, r: 8, fill: COL.dark })); g.appendChild(node("path", { d: `M${c[0] - 5} ${c[1] + 3} Q${c[0]} ${c[1] - 6} ${c[0] + 5} ${c[1] + 3}`, stroke: COL.dark, "stroke-width": 3, fill: "none" })); break; }
        case "bench": {           // banco: x,y = topo do assento (centro), w, ang (inclinação do encosto)
          const { x, y, w = 70, ang = 0, back = 0 } = pr;
          g.appendChild(node("rect", { x: x - w / 2, y, width: w, height: 7, rx: 3, fill: COL.dark }));
          g.appendChild(line([x - w / 2 + 8, y + 7], [x - w / 2 + 8, GROUND], 4, COL.dark)); g.appendChild(line([x + w / 2 - 8, y + 7], [x + w / 2 - 8, GROUND], 4, COL.dark));
          if (back) { const bx = x - w / 2, a = rad(ang); g.appendChild(line([bx, y + 3], [bx - Math.cos(a) * back, y + 3 - Math.sin(a) * back], 7, COL.dark)); }
          break;
        }
        case "incline": {         // encosto inclinado com assento: x,y = canto (anca), ang, len
          const { x, y, ang = 45, len = 66 } = pr; const a = rad(ang);
          g.appendChild(line([x, y], [x - Math.cos(a) * len, y - Math.sin(a) * len], 8, COL.dark));
          g.appendChild(line([x - 2, y], [x + 30, y], 8, COL.dark));
          g.appendChild(line([x + 10, y + 4], [x + 10, GROUND], 4, COL.dark));
          break;
        }
        case "box": g.appendChild(node("rect", { x: pr.x, y: pr.y, width: pr.w, height: GROUND - pr.y, rx: 3, fill: COL.dark, opacity: 0.9 })); break;
        case "pad": g.appendChild(node("rect", { x: pr.x, y: pr.y, width: pr.w, height: pr.h, rx: 4, fill: COL.dark, transform: pr.ang ? `rotate(${pr.ang} ${pr.x + pr.w / 2} ${pr.y + pr.h / 2})` : "" })); break;
        case "post": g.appendChild(line([pr.x, pr.y || 20], [pr.x, GROUND], 6, COL.dark)); break;
        case "bar": g.appendChild(line([pr.x1, pr.y], [pr.x2, pr.y], 4, COL.steel)); if (pr.posts) { g.appendChild(line([pr.x1, pr.y], [pr.x1, GROUND], 4, COL.dark)); g.appendChild(line([pr.x2, pr.y], [pr.x2, GROUND], 4, COL.dark)); } break;
        case "cable": { const a = pr.from, b = at(pr.to || "handN"); g.appendChild(line(a, b, 1.6, COL.steel, { "stroke-dasharray": "0" })); g.appendChild(node("circle", { cx: a[0], cy: a[1], r: 4, fill: COL.dark })); if (pr.handle !== false) g.appendChild(node("circle", { cx: b[0], cy: b[1], r: 3, fill: COL.steel })); break; }
        case "band": { const a = at(pr.from), b = at(pr.to); g.appendChild(line(a, b, 3, COL.band)); break; }
        case "wall": g.appendChild(node("rect", { x: pr.x, y: 10, width: 8, height: GROUND - 10, fill: COL.dark, opacity: 0.7 })); break;
        case "roller": g.appendChild(node("circle", { cx: pr.x, cy: pr.y, r: pr.r || 9, fill: COL.dark })); break;
        case "hurdle": g.appendChild(line([pr.x - 10, pr.y], [pr.x + 10, pr.y], 3, COL.steel)); g.appendChild(line([pr.x - 10, pr.y], [pr.x - 10, GROUND], 2, COL.steel)); g.appendChild(line([pr.x + 10, pr.y], [pr.x + 10, GROUND], 2, COL.steel)); break;
        case "cone": g.appendChild(node("path", { d: `M${pr.x - 7} ${GROUND} L${pr.x} ${GROUND - 16} L${pr.x + 7} ${GROUND} Z`, fill: COL.band })); break;
        case "mat": g.appendChild(node("rect", { x: pr.x1, y: GROUND - 3, width: pr.x2 - pr.x1, height: 3, rx: 1.5, fill: COL.hl, opacity: 0.35 })); break;
        case "seg": g.appendChild(line(at(pr.a), at(pr.b), pr.w || 7, pr.color === "steel" ? COL.steel : COL.dark)); break;
        case "plate": { const c = at(pr.at || "footN"), a = rad(pr.ang || 0), h = pr.len || 16; g.appendChild(line([c[0] - Math.cos(a) * h, c[1] - Math.sin(a) * h], [c[0] + Math.cos(a) * h, c[1] + Math.sin(a) * h], 6, COL.dark)); break; }
        case "arrow": { const a = pr.from, b = pr.to; g.appendChild(line(a, b, 2, COL.hl, { opacity: 0.8 })); break; }
      }
    });
  }

  function drawFigure(g, sk, hl) {
    const H = new Set(hl || []);
    const colN = (k) => (H.has(k) ? COL.hl : COL.near), colF = (k) => (H.has(k) ? COL.hlFar : COL.far);
    // sombra
    g.appendChild(node("ellipse", { cx: (sk.legN.end[0] + sk.legF.end[0]) / 2, cy: GROUND + 1, rx: 34, ry: 3.5, fill: "rgba(0,0,0,.28)" }));
    const limb = (ch, kUp, kLow, col, wUp, wLow) => { g.appendChild(line(ch.root, ch.mid, wUp, col(kUp))); g.appendChild(line(ch.mid, ch.end, wLow, col(kLow))); };
    // lado longe (atrás)
    if (!sk.front) {
      g.appendChild(line(sk.hipF, sk.legF.mid, W.thigh, colF("thigh"))); g.appendChild(line(sk.legF.mid, sk.legF.end, W.shin, colF("shin")));
      g.appendChild(line(sk.legF.end, sk.footF, W.foot, colF("foot")));
      g.appendChild(line(sk.shF, sk.armF.mid, W.upper, colF("upper"))); g.appendChild(line(sk.armF.mid, sk.armF.end, W.fore, colF("fore")));
      g.appendChild(node("circle", { cx: sk.armF.end[0], cy: sk.armF.end[1], r: 4.2, fill: COL.far }));
    }
    // tronco
    if (sk.front) {
      const [sN, sF, hN, hF] = [sk.shN, sk.shF, sk.hipN, sk.hipF];
      g.appendChild(node("path", { d: `M${sF[0]} ${sF[1] - 2} L${sN[0]} ${sN[1] - 2} L${hN[0] + 2} ${hN[1]} L${hF[0] - 2} ${hF[1]} Z`, fill: H.has("torso") ? COL.hl : COL.near, stroke: H.has("torso") ? COL.hl : COL.near, "stroke-width": 9, "stroke-linejoin": "round" }));
      [["legF", sk.hipF], ["legN", sk.hipN]].forEach(([k, root]) => { const leg = sk[k]; g.appendChild(line(root, leg.mid, W.thigh, colN("thigh"))); g.appendChild(line(leg.mid, leg.end, W.shin, colN("shin"))); g.appendChild(line(leg.end, k === "legN" ? sk.footN : sk.footF, W.foot, colN("foot"))); });
    } else {
      const mid = sk.midT;
      g.appendChild(node("path", { d: `M${sk.hip[0]} ${sk.hip[1]} Q${mid[0]} ${mid[1]} ${sk.sh[0]} ${sk.sh[1]}`, stroke: H.has("torso") ? COL.hl : COL.near, "stroke-width": W.torsoHigh, "stroke-linecap": "round", fill: "none" }));
      g.appendChild(node("circle", { cx: sk.hip[0], cy: sk.hip[1], r: W.torsoLow / 2 + 1, fill: H.has("glutes") ? COL.hl : COL.near }));
    }
    g.appendChild(line(sk.sh, sk.neckTop, W.neck, COL.near));
    g.appendChild(node("circle", { cx: sk.head[0], cy: sk.head[1], r: L.head, fill: COL.near }));
    if (!sk.front) {
      // perna e braço do lado perto (à frente)
      g.appendChild(line(sk.hipN, sk.legN.mid, W.thigh, colN("thigh"))); g.appendChild(line(sk.legN.mid, sk.legN.end, W.shin, colN("shin")));
      g.appendChild(line(sk.legN.end, sk.footN, W.foot, colN("foot")));
      g.appendChild(line(sk.shN, sk.armN.mid, W.upper, colN("upper"))); g.appendChild(line(sk.armN.mid, sk.armN.end, W.fore, colN("fore")));
      g.appendChild(node("circle", { cx: sk.armN.end[0], cy: sk.armN.end[1], r: 4.4, fill: COL.near }));
    } else {
      [["armF", sk.shF], ["armN", sk.shN]].forEach(([k, root]) => { const arm = sk[k]; g.appendChild(line(root, arm.mid, W.upper, colN("upper"))); g.appendChild(line(arm.mid, arm.end, W.fore, colN("fore"))); g.appendChild(node("circle", { cx: arm.end[0], cy: arm.end[1], r: 4.4, fill: COL.near })); });
    }
  }

  /* ----------------------------- Linha temporal ----------------------------- */
  /** Pose no instante u ∈ [0,1) de uma animação. pingpong: pausa, ida, pausa, volta. cycle: percorre as poses e volta à 1.ª. */
  function poseAt(m, u) {
    const f = m.frames;
    if (m.loop === "hold" || f.length === 1) { const breathe = Math.sin(u * Math.PI * 2) * (m.breathe || 0.6); const p = JSON.parse(JSON.stringify(f[0])); p.hip = [p.hip[0], p.hip[1] + breathe * 0.4]; return { pose: p, phase: 0 }; }
    if (m.loop === "cycle") {
      const n = f.length, x = u * n, i = Math.floor(x) % n, t = x - Math.floor(x);
      return { pose: mix(f[i], f[(i + 1) % n], m.linear ? t : ease(t)), phase: i };
    }
    if (m.loop === "seq") {             // 0→1→…→n-1, pausa no fim e recomeça
      const n = f.length - 1, endHold = m.endHold != null ? m.endHold : 0.18, v = u / (1 - endHold);
      if (v >= 1) return { pose: f[n], phase: n - 1 };
      const x = v * n, i = Math.min(n - 1, Math.floor(x)), t = x - i;
      return { pose: mix(f[i], f[i + 1], ease(t)), phase: i };
    }
    // pingpong por segmentos (suporta mais de 2 poses: 0→1→…→n-1→…→0)
    const segs = []; for (let i = 0; i < f.length - 1; i++) segs.push([i, i + 1]); for (let i = f.length - 1; i > 0; i--) segs.push([i, i - 1]);
    const hold = m.hold != null ? m.hold : 0.12;
    const per = 1 / segs.length;
    const k = Math.min(segs.length - 1, Math.floor(u / per));
    let t = (u - k * per) / per;
    t = t < hold ? 0 : (t - hold) / (1 - hold);
    const [a, b] = segs[k];
    return { pose: mix(f[a], f[b], ease(Math.min(1, t))), phase: k };
  }

  /** Cria o leitor: devolve { el, play(), pause(), setSpeed(s), destroy() } */
  function player(motion, opts = {}) {
    const wrap = document.createElement("div"); wrap.className = "anim";
    const vb = motion.vb || [0, 0, 240, 200];
    const svg = node("svg", { viewBox: vb.join(" "), class: "anim-svg", role: "img", "aria-label": opts.label || "Demonstração do exercício" });
    const grid = node("g", { opacity: 0.5 });
    if (!motion.noGround) grid.appendChild(line([vb[0], GROUND + 0.5], [vb[0] + vb[2], GROUND + 0.5], 1.5, "var(--border-2, #444)"));
    svg.appendChild(grid);
    const gBack = node("g", {}), gFig = node("g", {}), gFront = node("g", {});
    svg.appendChild(gBack); svg.appendChild(gFig); svg.appendChild(gFront);
    wrap.appendChild(svg);
    const cap = document.createElement("div"); cap.className = "anim-cap"; wrap.appendChild(cap);
    let speed = 1, playing = !opts.paused, start = performance.now(), offset = opts.u || 0, raf = null;
    const dur = (motion.dur || 3) * 1000;
    function frame(u) {
      const { pose, phase } = poseAt(motion, u);
      const sk = solve(pose);
      [gBack, gFig, gFront].forEach((g) => { while (g.firstChild) g.removeChild(g.firstChild); });
      drawProps(gBack, (motion.props || []).concat(pose.props || []), sk, "back");
      drawFigure(gFig, sk, motion.hl);
      drawProps(gFront, (motion.props || []).concat(pose.props || []), sk, "front");
      const labels = motion.labels || [];
      if (labels.length) cap.textContent = labels[phase % labels.length] || "";
    }
    function tick(now) {
      if (!playing) return;
      const u = (offset + ((now - start) * speed) / dur) % 1;
      frame(u);
      raf = requestAnimationFrame(tick);
    }
    frame(offset);
    if (playing && !opts.static) raf = requestAnimationFrame(tick);
    return {
      el: wrap,
      play() { if (playing) return; playing = true; start = performance.now(); raf = requestAnimationFrame(tick); },
      pause() { if (!playing) return; playing = false; cancelAnimationFrame(raf); offset = (offset + ((performance.now() - start) * speed) / dur) % 1; },
      toggle() { playing ? this.pause() : this.play(); return playing; },
      setSpeed(s) { if (playing) { offset = (offset + ((performance.now() - start) * speed) / dur) % 1; start = performance.now(); } speed = s; },
      at(u) { frame(u); },
      destroy() { playing = false; cancelAnimationFrame(raf); },
      get playing() { return playing; },
    };
  }

  /** Miniatura estática (pose do meio da execução). */
  function thumb(motion) { return player(motion, { paused: true, static: true, u: motion.thumbU != null ? motion.thumbU : 0.4 }).el; }

  global.Anim = { player, thumb, solve, poseAt, GROUND, L };
})(window);
