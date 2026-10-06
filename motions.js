/* =====================================================================
   motions.js — biblioteca de movimentos animados (poses-chave).
   Cada movimento: { frames:[pose…], loop:"pingpong"|"cycle"|"seq"|"hold", dur, labels, hl, props, vb }
   Pose: { hip:[x,y], torso:graus, curve, neck, twist, handN/handF, footN/footF,
           elbowN/F e kneeN/F (sentido ±1 ou posição [x,y]), footAng, view:"front" }
   Chão em y=184; tornozelo com o pé assente ≈ y 178. Figura virada para a direita.
   ===================================================================== */
(function (global) {
  const G = 178;                                   // altura do tornozelo com o pé no chão
  const TALL = [-14, -30, 268, 224];               // enquadramento para braços acima da cabeça
  const stand = (x = 120, extra = {}) => ({ hip: [x, 93], torso: 2, footN: [x + 3, G], footF: [x - 1, G], ...extra });
  const front = (extra = {}) => ({ view: "front", hip: [120, 93], torso: 0, footN: [130, G], footF: [110, G], ...extra });
  const seated = (x = 100, extra = {}) => ({ hip: [x, 136], torso: 0, footN: [x + 46, G], footF: [x + 42, G], ...extra });
  const seatBench = (x = 100) => ({ type: "bench", x: x - 4, y: 145, w: 46 });
  const supine = (extra = {}) => ({ hip: [132, 121], torso: -90, neck: 0, footN: [172, G], footF: [168, G], ...extra });
  const lyingBench = { type: "bench", x: 112, y: 132, w: 100 };
  // gatas: anca e ombros à mesma altura, mãos debaixo dos ombros, joelhos debaixo da anca
  const quad = (extra = {}) => ({ hip: [100, 126], torso: 90, neck: 0, handN: [152, 181], handF: [150, 181], footN: [58, 176], footF: [56, 176], footAng: 180, ...extra });
  const rel = (dx, dy, r = "sh") => ({ rel: r, d: [dx, dy] });
  const hands = (dx, dy, r = "sh") => ({ handN: rel(dx, dy, r), handF: rel(dx - 2, dy, r) });

  const M = {};

  /* =============================== PERNAS =============================== */
  M.squat = { dur: 3.2, labels: ["Descer controlado", "Subir a empurrar o chão"], hl: ["thigh", "glutes"],
    props: [{ type: "barbell", at: "shoulder", off: [-7, 3], r: 14, layer: "front" }],
    frames: [
      stand(116, { torso: 6, handN: rel(-2, 0), elbowN: -1, footN: [122, G], footF: [118, G] }),
      { hip: [94, 136], torso: 42, handN: rel(-2, 0), elbowN: -1, footN: [122, G], footF: [118, G] },
    ] };
  M.gobletSquat = { ...M.squat, props: [{ type: "kettlebell", at: "hands", layer: "front" }],
    frames: M.squat.frames.map((f, i) => ({ ...f, torso: i ? 30 : 3, handN: rel(14, 14), handF: rel(12, 14), elbowN: 1 })) };
  M.lunge = { dur: 3.4, labels: ["Descer o joelho de trás", "Subir pela perna da frente"], hl: ["thigh", "glutes"],
    props: [{ type: "dumbbell", at: "handN", vertical: true, layer: "front" }, { type: "dumbbell", at: "handF", vertical: true }],
    frames: [
      { hip: [118, 96], torso: 3, footN: [146, G], footF: [92, G], footAngF: 20, ...hands(3, 56) },
      { hip: [116, 128], torso: 4, footN: [146, G], footF: [86, 174], footAngF: 30, ...hands(3, 56) },
    ] };
  M.walkingLungeRot = { dur: 3.6, labels: ["Passada e descer", "Rodar o tronco para a perna da frente"], hl: ["thigh", "torso"],
    frames: [
      { hip: [118, 96], torso: 3, footN: [146, G], footF: [92, G], footAngF: 20, handN: rel(26, 14), handF: rel(22, 14) },
      { hip: [116, 128], torso: 4, footN: [146, G], footF: [86, 174], footAngF: 30, handN: rel(30, 16), handF: rel(-30, 14) },
    ] };
  M.splitSquat = { dur: 3.4, labels: ["Descer na vertical", "Subir pela perna da frente"], hl: ["thigh", "glutes"],
    props: [{ type: "bench", x: 64, y: 140, w: 46 }, { type: "barbell", at: "shoulder", off: [-7, 3], r: 14, layer: "front" }],
    frames: [
      { hip: [118, 98], torso: 6, footN: [148, G], footF: [70, 134], kneeF: -1, footAngF: 0, handN: rel(-2, 0), elbowN: -1 },
      { hip: [114, 128], torso: 14, footN: [148, G], footF: [70, 134], kneeF: -1, footAngF: 0, handN: rel(-2, 0), elbowN: -1 },
    ] };
  M.hinge = { dur: 3.4, labels: ["Anca para trás, costas direitas", "Apertar glúteos e voltar a subir"], hl: ["glutes", "thigh"],
    props: [{ type: "barbell", at: "hands", layer: "front" }],
    frames: [
      stand(116, { torso: 2, ...hands(6, 54) }),
      { hip: [100, 102], torso: 74, ...hands(4, 54), footN: [120, G], footF: [116, G], kneeN: -1 },
    ] };
  M.deadlift = { ...M.hinge, labels: ["Barra junto às pernas", "Empurrar o chão e estender a anca"], thumbU: 0.05,
    frames: [
      { hip: [100, 120], torso: 58, ...hands(6, 55), footN: [124, G], footF: [120, G] },
      stand(116, { torso: 2, ...hands(6, 54), footN: [124, G], footF: [120, G] }),
    ] };
  M.hipThrust = { dur: 3, labels: ["Empurrar a anca para cima", "Descer controlado"], hl: ["glutes"],
    props: [{ type: "bench", x: 70, y: 138, w: 60 }, { type: "barbell", at: "hip", off: [0, -12], layer: "front" }],
    frames: [
      { hip: [118, 168], torso: -62, neck: 30, footN: [168, G], footF: [164, G], handN: [118, 156], handF: [116, 156], elbowN: -1 },
      { hip: [124, 132], torso: -88, neck: 50, footN: [168, G], footF: [164, G], handN: [124, 120], handF: [122, 120], elbowN: -1 },
    ] };
  M.gluteBridge = { dur: 2.6, labels: ["Subir a anca", "Descer devagar"], hl: ["glutes"], props: [{ type: "mat", x1: 30, x2: 200 }],
    frames: [
      { hip: [118, 172], torso: -90, footN: [160, G], footF: [156, G], handN: [86, 180], handF: [84, 180], elbowN: -1 },
      { hip: [124, 146], torso: -66, footN: [160, G], footF: [156, G], handN: [86, 180], handF: [84, 180], elbowN: -1 },
    ] };
  M.gluteBridgeBand = { ...M.gluteBridge, props: [{ type: "mat", x1: 30, x2: 200 }, { type: "band", from: "kneeF", to: "kneeN", layer: "front" }] };
  M.calfRaise = { dur: 2.2, labels: ["Subir na ponta dos pés", "Descer até alongar"], hl: ["shin"],
    props: [{ type: "dumbbell", at: "handN", vertical: true, layer: "front" }],
    frames: [stand(120, hands(4, 56)), stand(120, { hip: [120, 81], footN: [123, 166], footF: [119, 166], footAng: 58, ...hands(4, 56) })] };
  M.legSwing = { dur: 1.6, labels: ["Balançar à frente", "Balançar atrás"], hl: ["thigh"],
    frames: [
      stand(116, { torso: -4, handN: rel(6, 46), handF: rel(2, 46), footF: [116, G], footN: [190, 140], kneeN: -1, footAngN: -40 }),
      stand(116, { torso: 6, handN: rel(6, 46), handF: rel(2, 46), footF: [116, G], footN: [74, 167], kneeN: -1, footAngN: 40 }),
    ], hold: 0.02 };
  M.ankleMob = { dur: 2.4, labels: ["Joelho à frente sobre os dedos", "Voltar sem levantar o calcanhar"], hl: ["shin"],
    props: [{ type: "band", from: [80, 176], to: "footN" }, { type: "mat", x1: 40, x2: 200 }],
    frames: [
      { hip: [112, 128], torso: 0, footN: [150, G], kneeN: [150, 134], footF: [72, 176], kneeF: [104, 172], footAngF: 180, handN: [152, 128], handF: [150, 130] },
      { hip: [118, 130], torso: 6, footN: [150, G], kneeN: [170, 140], footF: [72, 176], kneeF: [108, 172], footAngF: 180, handN: [170, 132], handF: [168, 134] },
    ] };
  M.balance = { dur: 3, loop: "hold", labels: ["Equilíbrio numa perna, anca nivelada"], hl: ["foot", "glutes"],
    frames: [stand(120, { torso: 0, footF: [120, G], footN: [160, 138], kneeN: [163, 98], footAngN: 20, handN: rel(14, 40), handF: rel(-10, 42) })] };
  M.shortFoot = { dur: 3, loop: "pingpong", labels: ["Encurtar o pé (arco para cima)", "Relaxar"], hl: ["foot"],
    frames: [stand(120, hands(4, 56)), stand(120, { ...hands(4, 56), footAng: 6, hip: [120, 92] })] };

  /* =============================== PEITO =============================== */
  M.benchPress = { dur: 3, labels: ["Descer a barra ao peito", "Empurrar para cima"], hl: ["torso"], thumbU: 0.55,
    props: [lyingBench, { type: "barbell", at: "hands", layer: "front" }],
    frames: [supine({ handN: [84, 66], handF: [82, 66] }), supine({ handN: [88, 104], handF: [86, 104] })] };
  M.dbPress = { ...M.benchPress, props: [lyingBench, { type: "dumbbell", at: "handN", layer: "front" }, { type: "dumbbell", at: "handF" }] };
  M.inclinePress = { dur: 3, labels: ["Descer ao peito alto", "Empurrar para cima"], hl: ["torso"],
    props: [{ type: "incline", x: 132, y: 136, ang: 40, len: 74 }, { type: "barbell", at: "hands", layer: "front" }],
    frames: [
      { hip: [138, 126], torso: -50, footN: [178, G], footF: [174, G], handN: rel(10, -56), handF: rel(8, -56) },
      { hip: [138, 126], torso: -50, footN: [178, G], footF: [174, G], handN: rel(18, -16), handF: rel(16, -16) },
    ] };
  M.chestPress = { dur: 3, labels: ["Empurrar à frente", "Voltar devagar ao peito"], hl: ["torso"],
    props: [seatBench(96), { type: "seg", a: [86, 140], b: [80, 60], w: 8 }, { type: "seg", a: "handN", b: [150, 96], w: 3, color: "steel" }],
    frames: [seated(96, { torso: -6, ...hands(56, 6) }), seated(96, { torso: -6, ...hands(18, 8) })] };
  M.pushUp = { dur: 2.6, labels: ["Descer o peito ao chão", "Empurrar o chão"], hl: ["torso", "upper"], props: [{ type: "mat", x1: 20, x2: 200 }],
    frames: [
      { hip: [110, 144], torso: 68, footN: [30, 176], footF: [30, 176], footAng: 35, handN: [158, 181], handF: [156, 181] },
      { hip: [115, 166], torso: 83, footN: [30, 176], footF: [30, 176], footAng: 35, handN: [160, 181], handF: [158, 181] },
    ] };
  M.scapPushUp = { dur: 2, labels: ["Deixar o peito descer entre os ombros", "Afastar as omoplatas"], hl: ["upper"], props: [{ type: "mat", x1: 20, x2: 200 }],
    frames: [M.pushUp.frames[0], { ...M.pushUp.frames[0], hip: [111, 148], torso: 70 }] };
  M.dips = { dur: 2.8, labels: ["Descer até 90° nos cotovelos", "Empurrar para cima"], hl: ["upper", "torso"], thumbU: 0.55,
    props: [{ type: "bar", x1: 108, x2: 150, y: 104, posts: true }],
    frames: [
      { hip: [121, 98], torso: 8, handN: [128, 104], handF: [126, 104], footN: [100, 150], footF: [98, 152], footAng: 70 },
      { hip: [119, 109], torso: 25, handN: [128, 104], handF: [126, 104], footN: [96, 160], footF: [94, 162], footAng: 70 },
    ] };
  // de frente: abrir/fechar os braços (cabos, peck deck, crossover)
  M.fly = { dur: 3, labels: ["Abrir os braços com controlo", "Juntar à frente do peito"], hl: ["torso"],
    props: [{ type: "cable", from: [218, 44], to: "handN" }, { type: "cable", from: [22, 44], to: "handF" }],
    frames: [
      front({ handN: [184, 62], handF: [56, 62], elbowN: -1, elbowF: 1 }),
      front({ handN: [127, 86], handF: [113, 86], elbowN: -1, elbowF: 1 }),
    ] };

  /* =============================== OMBROS =============================== */
  M.ohp = { dur: 3, labels: ["Empurrar acima da cabeça", "Descer aos ombros"], hl: ["upper"], vb: TALL,
    props: [{ type: "barbell", at: "hands", r: 13, layer: "front" }],
    frames: [stand(120, { torso: 0, ...hands(10, 2), elbowN: -1 }), stand(120, { torso: -2, ...hands(3, -56), elbowN: -1 })] };
  M.dbOhp = { ...M.ohp, props: [{ type: "dumbbell", at: "handN", layer: "front" }, { type: "dumbbell", at: "handF" }] };
  M.seatedPress = { dur: 3, labels: ["Empurrar acima da cabeça", "Descer aos ombros"], hl: ["upper"], vb: TALL,
    props: [seatBench(100), { type: "seg", a: [92, 140], b: [88, 70], w: 8 }, { type: "barbell", at: "hands", r: 13, layer: "front" }],
    frames: [seated(100, { ...hands(10, 2), elbowN: -1 }), seated(100, { ...hands(3, -56), elbowN: -1 })] };
  M.machinePress = { ...M.seatedPress, props: [seatBench(100), { type: "seg", a: [92, 140], b: [88, 70], w: 8 }, { type: "seg", a: "handN", b: "handF", w: 5, color: "steel" }] };
  M.lateralRaise = { dur: 2.8, labels: ["Elevar até à linha dos ombros", "Descer devagar"], hl: ["upper"],
    props: [{ type: "dumbbell", at: "handN", vertical: true }, { type: "dumbbell", at: "handF", vertical: true }],
    frames: [
      front({ handN: [142, 98], handF: [98, 98], elbowN: -1, elbowF: 1 }),
      front({ handN: [190, 50], handF: [50, 50], elbowN: -1, elbowF: 1 }),
    ] };
  M.cableLateral = { dur: 2.8, labels: ["Elevar o braço pelo lado", "Descer contra o cabo"], hl: ["upper"],
    props: [{ type: "cable", from: [84, 182], to: "handN" }],
    frames: [
      front({ handN: [128, 100], handF: [104, 92], elbowN: -1, elbowF: 1 }),
      front({ handN: [190, 50], handF: [104, 92], elbowN: -1, elbowF: 1 }),
    ] };
  M.uprightRow = { dur: 2.8, labels: ["Puxar até ao peito, cotovelos altos", "Descer controlado"], hl: ["upper"],
    props: [{ type: "barbell", at: "hands", front: true, layer: "front" }],
    frames: [
      front({ handN: [128, 98], handF: [112, 98], elbowN: 1, elbowF: -1 }),
      front({ handN: [128, 54], handF: [112, 54], elbowN: [164, 38], elbowF: [76, 38] }),
    ] };
  M.yRaise = { dur: 3, labels: ["Elevar os braços em Y", "Descer devagar"], hl: ["upper"], vb: TALL,
    frames: [
      front({ handN: [134, 98], handF: [106, 98], elbowN: -1, elbowF: 1 }),
      front({ handN: [166, -8], handF: [74, -8], elbowN: -1, elbowF: 1 }),
    ] };
  M.fullCan = { dur: 3, labels: ["Polegar para cima, subir na diagonal", "Descer devagar"], hl: ["upper"],
    frames: [
      front({ handN: [140, 98], handF: [100, 98], elbowN: -1, elbowF: 1 }),
      front({ handN: [178, 10], handF: [62, 10], elbowN: -1, elbowF: 1 }),
    ] };
  M.armCircles = { dur: 2.4, loop: "cycle", linear: false, labels: [], hl: ["upper"], vb: TALL,
    frames: [
      front({ handN: [146, 96], handF: [94, 96] }),
      front({ handN: [192, 46], handF: [48, 46] }),
      front({ handN: [150, -10], handF: [90, -10] }),
      front({ handN: [192, 40], handF: [48, 40] }),
    ] };
  M.armSwings = { dur: 1.8, labels: ["Abrir os braços", "Cruzar à frente"], hl: ["upper", "torso"],
    frames: [front({ handN: [192, 50], handF: [48, 50] }), front({ handN: [100, 60], handF: [140, 56], elbowN: 1, elbowF: -1 })] };
  M.facePull = { dur: 2.6, labels: ["Puxar para a cara, cotovelos altos", "Esticar à frente"], hl: ["upper"],
    props: [{ type: "cable", from: [222, 40], to: "handN" }],
    frames: [stand(110, { torso: -4, ...hands(54, -4) }), stand(110, { torso: -6, ...hands(14, -16), elbowN: [96, 34] })] };

  /* =============================== COSTAS =============================== */
  M.pullUp = { dur: 3.2, labels: ["Puxar o peito à barra", "Descer até esticar"], hl: ["upper", "torso"],
    props: [{ type: "bar", x1: 70, x2: 190, y: 22 }],
    frames: [
      { hip: [124, 132], torso: -4, handN: [130, 22], handF: [128, 22], footN: [108, 168], footF: [106, 170], kneeN: 1, kneeF: 1, footAng: 60 },
      { hip: [120, 86], torso: -10, neck: 8, handN: [130, 22], handF: [128, 22], footN: [104, 122], footF: [102, 124], kneeN: 1, kneeF: 1, footAng: 60, elbowN: -1 },
    ] };
  M.scapHang = { dur: 2.2, labels: ["Baixar e juntar as omoplatas", "Relaxar"], hl: ["upper"],
    props: [{ type: "bar", x1: 70, x2: 190, y: 22 }],
    frames: [M.pullUp.frames[0], { ...M.pullUp.frames[0], hip: [124, 126], torso: -8 }] };
  M.latPulldown = { dur: 3, labels: ["Puxar a barra ao peito", "Subir devagar até esticar"], hl: ["upper", "torso"], vb: TALL,
    props: [seatBench(100), { type: "pad", x: 128, y: 120, w: 26, h: 8 }, { type: "cable", from: [114, -28], to: "hands", handle: false }, { type: "bar", x1: 96, x2: 134, y: 0 }],
    frames: [seated(100, { torso: -8, ...hands(10, -55) }), seated(100, { torso: -18, ...hands(12, 4) })] };
  M.seatedRow = { dur: 3, labels: ["Puxar à barriga, peito alto", "Esticar os braços à frente"], hl: ["upper", "torso"],
    props: [seatBench(92), { type: "pad", x: 150, y: 138, w: 6, h: 40 }, { type: "cable", from: [226, 112], to: "hands" }],
    frames: [seated(92, { torso: 14, footN: [150, 164], footF: [148, 166], footAng: -70, ...hands(54, 12) }),
             seated(92, { torso: -6, footN: [150, 164], footF: [148, 166], footAng: -70, ...hands(16, 38) })] };
  M.highRow = { dur: 3, labels: ["Puxar para baixo e para trás", "Esticar para cima"], hl: ["upper"],
    props: [seatBench(96), { type: "cable", from: [226, 10], to: "handN" }],
    frames: [seated(96, { torso: 8, handN: rel(44, -36), handF: rel(10, 50) }), seated(96, { torso: -6, handN: rel(14, 6), handF: rel(10, 50) })] };
  M.barbellRow = { dur: 2.8, labels: ["Puxar a barra à barriga", "Descer até esticar"], hl: ["upper", "torso"],
    props: [{ type: "barbell", at: "hands", layer: "front" }],
    frames: [
      { hip: [100, 104], torso: 70, footN: [122, G], footF: [118, G], handN: [152, 141], handF: [150, 141] },
      { hip: [100, 104], torso: 70, footN: [122, G], footF: [118, G], handN: [132, 108], handF: [130, 108] },
    ] };
  M.dbRow = { ...M.barbellRow, props: [{ type: "dumbbell", at: "handN", layer: "front" }] };
  M.chestRow = { dur: 2.8, labels: ["Puxar, apertar as omoplatas", "Esticar os braços"], hl: ["upper", "torso"],
    props: [{ type: "seg", a: [108, 140], b: [168, 84], w: 8 }, { type: "seg", a: [126, 128], b: [126, 184], w: 4 }, { type: "dumbbell", at: "handN", layer: "front" }, { type: "dumbbell", at: "handF" }],
    frames: [
      { hip: [104, 120], torso: 48, footN: [96, G], footF: [92, G], kneeN: -1, handN: [168, 140], handF: [166, 140] },
      { hip: [104, 120], torso: 48, footN: [96, G], footF: [92, G], kneeN: -1, handN: [134, 116], handF: [132, 116] },
    ] };
  M.pullover = { dur: 3, labels: ["Braços esticados até às coxas", "Voltar acima"], hl: ["upper"],
    props: [{ type: "cable", from: [228, 6], to: "hands" }],
    frames: [stand(104, { hip: [104, 97], torso: 34, footN: [112, G], footF: [108, G], handN: rel(46, -32), handF: rel(44, -32) }),
             stand(104, { hip: [104, 97], torso: 34, footN: [112, G], footF: [108, G], handN: rel(-6, 56), handF: rel(-8, 56) })] };
  M.bandPullApart = { dur: 2.4, labels: ["Abrir a banda até ao peito", "Voltar devagar"], hl: ["upper"],
    props: [{ type: "band", from: "handF", to: "handN", layer: "front" }],
    frames: [front({ handN: [128, 58], handF: [112, 58], elbowN: 1, elbowF: -1 }), front({ handN: [186, 46], handF: [54, 46], elbowN: -1, elbowF: 1 })] };
  M.wallSlide = { dur: 3, labels: ["Deslizar os braços para cima", "Descer em W"], hl: ["upper"], vb: TALL,
    frames: [front({ handN: [160, 18], handF: [80, 18], elbowN: [164, 50], elbowF: [76, 50] }), front({ handN: [150, -10], handF: [90, -10], elbowN: -1, elbowF: 1 })] };
  M.bandER = { dur: 2.4, labels: ["Rodar os antebraços para fora", "Voltar devagar"], hl: ["upper"],
    props: [{ type: "band", from: "handF", to: "handN", layer: "front" }],
    frames: [front({ elbowN: [140, 72], elbowF: [100, 72], handN: [132, 80], handF: [108, 80] }), front({ elbowN: [140, 72], elbowF: [100, 72], handN: [166, 72], handF: [74, 72] })] };

  /* =============================== BRAÇOS =============================== */
  M.curl = { dur: 2.6, labels: ["Subir sem mexer o cotovelo", "Descer devagar"], hl: ["fore", "upper"],
    props: [{ type: "dumbbell", at: "handN", layer: "front" }, { type: "dumbbell", at: "handF" }],
    frames: [stand(118, hands(5, 56)), stand(118, hands(14, 6))] };
  M.barbellCurl = { ...M.curl, props: [{ type: "barbell", at: "hands", r: 13, layer: "front" }] };
  M.cableCurl = { ...M.curl, props: [{ type: "cable", from: [176, 182], to: "hands" }] };
  M.bayesianCurl = { dur: 2.6, labels: ["Cotovelo atrás, subir a mão", "Descer até esticar"], hl: ["fore", "upper"],
    props: [{ type: "cable", from: [20, 70], to: "handN" }],
    frames: [stand(124, { footN: [140, G], footF: [104, G], handN: rel(-20, 52), handF: rel(4, 56) }),
             stand(124, { footN: [140, G], footF: [104, G], handN: rel(4, 4), elbowN: [110, 68], handF: rel(4, 56) })] };
  M.preacherCurl = { dur: 2.6, labels: ["Subir com o braço apoiado", "Descer até quase esticar"], hl: ["fore", "upper"],
    props: [seatBench(100), { type: "seg", a: [112, 98], b: [136, 122], w: 7 }, { type: "seg", a: [128, 118], b: [128, 184], w: 4 }, { type: "dumbbell", at: "handN", layer: "front" }],
    frames: [seated(100, { torso: 15, handN: [160, 119], handF: [158, 121], elbowN: 1 }), seated(100, { torso: 15, handN: [144, 83], handF: [142, 85], elbowN: 1 })] };
  M.inclineCurl = { dur: 2.8, labels: ["Braço na vertical, subir", "Descer até esticar"], hl: ["fore", "upper"],
    props: [{ type: "incline", x: 124, y: 138, ang: 60, len: 76 }, { type: "dumbbell", at: "handN", layer: "front" }, { type: "dumbbell", at: "handF" }],
    frames: [
      { hip: [124, 130], torso: -30, footN: [172, G], footF: [168, G], handN: [100, 145], handF: [98, 145] },
      { hip: [124, 130], torso: -30, footN: [172, G], footF: [168, G], handN: [120, 100], handF: [118, 100], elbowN: 1 },
    ] };
  M.pushdown = { dur: 2.4, labels: ["Esticar os braços até baixo", "Subir só os antebraços"], hl: ["upper"],
    props: [{ type: "cable", from: [160, -4], to: "hands" }], vb: TALL,
    frames: [stand(118, { torso: 10, ...hands(22, 16) }), stand(118, { torso: 10, ...hands(10, 57) })] };
  M.overheadExt = { dur: 2.6, labels: ["Esticar acima da cabeça", "Descer atrás da cabeça"], hl: ["upper"], vb: TALL,
    props: [{ type: "dumbbell", at: "handN", layer: "front" }],
    frames: [stand(120, { torso: 4, ...hands(-12, -8), elbowN: 1 }), stand(120, { torso: 4, ...hands(8, -57) })] };
  M.cableOverheadExt = { ...M.overheadExt, props: [{ type: "cable", from: [24, 150], to: "handN" }],
    frames: M.overheadExt.frames.map((f) => ({ ...f, torso: 22, hip: [126, 95], footN: [150, G], footF: [100, G] })) };
  M.skullcrusher = { dur: 2.6, labels: ["Dobrar só os cotovelos até à testa", "Esticar os braços"], hl: ["upper"],
    props: [lyingBench, { type: "barbell", at: "hands", r: 13, layer: "front" }],
    frames: [supine({ handN: [82, 64], handF: [80, 64] }), supine({ handN: [60, 104], handF: [58, 104], elbowN: 1 })] };
  M.kickback = { dur: 2.4, labels: ["Esticar o braço para trás", "Voltar a 90°"], hl: ["upper"],
    props: [{ type: "cable", from: [228, 176], to: "handN" }],
    frames: [
      { hip: [104, 100], torso: 60, footN: [128, G], footF: [100, G], handN: [121, 117], elbowN: [121, 89], handF: [158, 130] },
      { hip: [104, 100], torso: 60, footN: [128, G], footF: [100, G], handN: [95, 99], elbowN: [121, 89], handF: [158, 130] },
    ] };

  /* =============================== CORE =============================== */
  M.plank = { dur: 3, loop: "hold", labels: ["Corpo em linha, glúteos e abdómen contraídos"], hl: ["torso", "glutes"], props: [{ type: "mat", x1: 20, x2: 210 }],
    frames: [{ hip: [115, 161], torso: 80, footN: [30, 176], footF: [30, 176], footAng: 35, handN: [192, 181], handF: [190, 181], elbowN: [164, 181], elbowF: [162, 181] }] };
  M.birdDog = { dur: 3.2, labels: ["Esticar braço e perna opostos", "Voltar sem rodar a anca"], hl: ["torso", "glutes"], props: [{ type: "mat", x1: 30, x2: 200 }],
    frames: [quad(), quad({ handN: rel(56, -6), footF: [16, 116], kneeF: -1, footAngF: 180 })] };
  M.catCamel = { dur: 3.6, labels: ["Arredondar as costas", "Abrir o peito e arquear"], hl: ["torso"], props: [{ type: "mat", x1: 30, x2: 200 }],
    frames: [quad({ curve: 9, neck: 40, hip: [100, 124] }), quad({ curve: -8, neck: -30, hip: [100, 128] })] };
  M.pallof = { dur: 2.6, labels: ["Empurrar à frente sem rodar", "Trazer ao peito"], hl: ["torso"],
    props: [{ type: "cable", from: [228, 70], to: "hands" }],
    frames: [stand(110, { torso: 0, footN: [124, G], footF: [100, G], ...hands(14, 24) }), stand(110, { torso: 0, footN: [124, G], footF: [100, G], ...hands(54, 20) })] };
  M.copenhagen = { dur: 3, labels: ["Subir a anca, corpo em linha", "Descer devagar"], hl: ["thigh"],
    props: [{ type: "bench", x: 196, y: 138, w: 52 }],
    frames: [
      { view: "front", hip: [130, 160], torso: -100, handF: [104, 182], elbowF: [80, 180], handN: [126, 146], footN: [214, 134], kneeN: [174, 132], footF: [158, 178], kneeF: [150, 150] },
      { view: "front", hip: [130, 146], torso: -95, handF: [104, 182], elbowF: [80, 180], handN: [126, 132], footN: [214, 134], kneeN: [174, 132], footF: [160, 168], kneeF: [150, 140] },
    ] };

  /* ======================= ROTAÇÃO / MOBILIDADE ======================= */
  M.thoracicRot = { dur: 3.4, labels: ["Rodar para um lado", "Rodar para o outro"], hl: ["torso"],
    frames: [front({ twist: -70, handN: rel(-12, 14), handF: rel(12, 14), elbowN: 1, elbowF: -1, neck: -6 }), front({ twist: 0, handN: rel(-18, 14), handF: rel(18, 14), elbowN: 1, elbowF: -1 }), front({ twist: 70, handN: rel(-12, 14), handF: rel(12, 14), elbowN: 1, elbowF: -1, neck: 6 })] };
  M.openBook = { dur: 3.6, labels: ["Abrir o braço de cima e seguir com o olhar", "Fechar devagar"], hl: ["torso", "upper"], props: [{ type: "mat", x1: 20, x2: 220 }],
    frames: [
      { hip: [140, 166], torso: -90, neck: 0, footN: [154, G], kneeN: [176, 170], footF: [152, 178], kneeF: [178, 174], handF: [40, 178], handN: [44, 176] },
      { hip: [140, 166], torso: -90, neck: -20, footN: [154, G], kneeN: [176, 170], footF: [152, 178], kneeF: [178, 174], handF: [40, 178], handN: [90, 110] },
      { hip: [140, 166], torso: -90, neck: -40, footN: [154, G], kneeN: [176, 170], footF: [152, 178], kneeF: [178, 174], handF: [40, 178], handN: [140, 150] },
    ] };
  M.foamThoracic = { dur: 3, labels: ["Estender por cima do rolo", "Voltar ao centro"], hl: ["torso"],
    props: [{ type: "roller", x: 98, y: 172, r: 11 }, { type: "mat", x1: 20, x2: 220 }],
    frames: [
      { hip: [140, 170], torso: -66, neck: 20, footN: [176, G], footF: [172, G], handN: rel(4, -6, "head"), handF: rel(2, -6, "head"), elbowN: [104, 128] },
      { hip: [140, 172], torso: -82, neck: -10, footN: [176, G], footF: [172, G], handN: rel(4, -6, "head"), handF: rel(2, -6, "head"), elbowN: [84, 140] },
    ] };
  M.hip9090 = { dur: 3.6, labels: ["Joelhos para um lado", "Trocar para o outro lado"], hl: ["thigh"],
    frames: [
      { view: "front", hip: [120, 162], torso: 0, handN: [150, 178], handF: [90, 178], kneeN: [86, 172], footN: [60, 178], kneeF: [70, 160], footF: [44, 176] },
      { view: "front", hip: [120, 162], torso: 0, handN: [150, 178], handF: [90, 178], kneeN: [148, 124], footN: [158, 178], kneeF: [92, 124], footF: [82, 178] },
      { view: "front", hip: [120, 162], torso: 0, handN: [150, 178], handF: [90, 178], kneeN: [170, 160], footN: [196, 176], kneeF: [154, 172], footF: [180, 178] },
    ] };
  M.clamshell = { dur: 2.6, labels: ["Abrir o joelho de cima", "Fechar devagar"], hl: ["glutes"],
    props: [{ type: "mat", x1: 20, x2: 220 }, { type: "band", from: "kneeF", to: "kneeN", layer: "front" }],
    frames: [
      { view: "front", hip: [128, 164], torso: -90, neck: -10, handF: [56, 160], elbowF: [74, 178], handN: [120, 150], kneeN: [164, 166], footN: [182, 176], kneeF: [164, 174], footF: [182, 178] },
      { view: "front", hip: [128, 164], torso: -90, neck: -10, handF: [56, 160], elbowF: [74, 178], handN: [120, 150], kneeN: [156, 132], footN: [182, 176], kneeF: [164, 174], footF: [182, 178] },
    ] };
  M.sideLyingER = { dur: 2.6, labels: ["Rodar o antebraço para cima", "Descer devagar"], hl: ["upper"],
    props: [{ type: "mat", x1: 20, x2: 220 }, { type: "dumbbell", at: "handN", vertical: true, layer: "front" }],
    frames: [
      { view: "front", hip: [128, 164], torso: -90, neck: -10, handF: [56, 160], elbowF: [74, 178], elbowN: [102, 150], handN: [104, 170], kneeN: [164, 166], footN: [182, 176], kneeF: [164, 174], footF: [182, 178] },
      { view: "front", hip: [128, 164], torso: -90, neck: -10, handF: [56, 160], elbowF: [74, 178], elbowN: [102, 150], handN: [102, 122], kneeN: [164, 166], footN: [182, 176], kneeF: [164, 174], footF: [182, 178] },
    ] };
  M.sideLyingIR = { dur: 2.6, labels: ["Levantar o pé de cima", "Descer devagar"], hl: ["glutes", "thigh"],
    props: [{ type: "mat", x1: 20, x2: 220 }],
    frames: [M.clamshell.frames[0], { ...M.clamshell.frames[0], footN: [190, 140] }] };
  M.worldsGreatest = { dur: 4, labels: ["Cotovelo ao pé da frente", "Rodar e abrir o braço ao teto"], hl: ["thigh", "torso"], vb: TALL,
    frames: [
      { hip: [104, 140], torso: 72, neck: 10, footN: [150, G], footF: [36, 174], footAngF: 20, handN: [146, 176], handF: [148, 180], elbowN: [150, 150] },
      { hip: [104, 140], torso: 50, neck: -30, footN: [150, G], footF: [36, 174], footAngF: 20, handN: rel(6, -56), handF: [148, 180] },
    ] };

  /* =============================== ALONGAMENTOS =============================== */
  const hold = (frame, label, hl, props, extra = {}) => ({ dur: 4, loop: "hold", breathe: 1.6, labels: [label], hl, props, frames: [frame], ...extra });
  M.chestStretch = hold(stand(126, { torso: 6, footN: [140, G], footF: [112, G], handN: [90, 40], elbowN: [100, 48], handF: rel(6, 54) }), "Antebraço no batente, rodar o tronco para fora", ["torso"], [{ type: "post", x: 90, y: 20 }]);
  M.couchStretch = hold({ hip: [112, 130], torso: -6, footN: [152, G], kneeN: [152, 136], footF: [60, 132], kneeF: [86, 172], footAngF: -90, handN: [150, 132], handF: [148, 134] }, "Contrair o glúteo e empurrar a anca à frente", ["thigh"], [{ type: "wall", x: 44 }, { type: "mat", x1: 50, x2: 200 }]);
  M.crossShoulder = hold(front({ handN: [92, 56], elbowN: [118, 66], handF: [122, 70], elbowF: [96, 86] }), "Braço cruzado junto ao peito", ["upper"]);
  M.tricepStretch = { ...hold(stand(120, { torso: 2, handN: rel(-12, -8), elbowN: 1, handF: rel(6, -30), elbowF: -1 }), "Mão atrás da cabeça, puxar o cotovelo", ["upper"]), vb: TALL };
  M.neckStretch = hold(front({ neck: -24, handN: [136, 92], handF: rel(-2, -8, "head"), elbowF: [80, 30] }), "Inclinar a cabeça, ombro oposto em baixo", ["torso"]);
  M.figure4 = hold({ hip: [130, 168], torso: -90, neck: 10, footF: [164, 136], kneeF: [150, 120], footN: [150, 122], kneeN: [174, 146], handN: [160, 126], handF: [158, 130] }, "Tornozelo sobre o joelho, puxar a perna ao peito", ["glutes"], [{ type: "mat", x1: 20, x2: 220 }]);
  M.latStretch = hold({ hip: [96, 156], torso: 82, neck: 6, handN: [196, 180], handF: [194, 180], footN: [92, 178], footF: [90, 178], footAng: 180, kneeN: [136, 176], kneeF: [134, 176] }, "Sentar nos calcanhares e esticar os braços", ["upper", "torso"], [{ type: "mat", x1: 40, x2: 220 }]);
  M.hamBand = hold({ hip: [110, 170], torso: -90, neck: 10, footN: [120, 86], kneeN: 1, footAngN: -60, footF: [196, 176], kneeF: 1, handN: [92, 120], handF: [90, 122] }, "Perna esticada, puxar com a banda", ["thigh"], [{ type: "band", from: "hands", to: "footN" }, { type: "mat", x1: 20, x2: 220 }]);
  M.quadStretch = hold(stand(122, { torso: 2, footF: [122, G], footN: [100, 126], kneeN: -1, footAngN: -100, handN: [102, 124], handF: rel(4, 54) }), "Puxar o calcanhar ao glúteo, joelhos juntos", ["thigh"]);
  M.calfWall = hold({ hip: [120, 102], torso: 26, footN: [152, G], footF: [86, G], handN: [174, 66], handF: [172, 68] }, "Calcanhar de trás no chão, inclinar à frente", ["shin"], [{ type: "wall", x: 178 }]);
  M.butterfly = hold({ view: "front", hip: [120, 166], torso: 4, kneeN: [166, 164], footN: [126, 176], kneeF: [74, 164], footF: [114, 176], footAngN: 180, footAngF: 0, handN: [126, 168], handF: [114, 168] }, "Plantas dos pés juntas, joelhos para baixo", ["thigh"], [{ type: "mat", x1: 40, x2: 200 }]);

  /* =============================== PLIOMETRIA =============================== */
  const air = (x, y, extra = {}) => ({ hip: [x, y], torso: 6, footN: [x + 6, y + 76], footF: [x - 2, y + 78], kneeN: -1, footAng: 50, handN: rel(16, -40), handF: rel(10, -42), ...extra });
  const crouch = (x, extra = {}) => ({ hip: [x - 22, 134], torso: 40, footN: [x + 3, G], footF: [x - 1, G], handN: rel(-26, 46), handF: rel(-28, 46), ...extra });
  M.pogo = { vb: TALL, dur: 0.7, labels: [], hl: ["shin"],
    frames: [stand(120, { footAng: 20, hip: [120, 95], ...hands(6, 54) }), { hip: [120, 76], torso: 2, footN: [124, 162], footF: [120, 162], footAng: 60, ...hands(6, 54) }], hold: 0.05 };
  M.squatJump = { vb: TALL, dur: 2, loop: "cycle", labels: ["Agachar", "Saltar ao máximo", "Aterrar suave"], hl: ["thigh", "glutes"],
    frames: [stand(120, hands(4, 56)), crouch(122), air(120, 62), crouch(122, { handN: rel(30, 30), handF: rel(28, 30) })] };
  M.boxJump = { vb: TALL, dur: 2.6, loop: "seq", labels: ["Agachar e balançar os braços", "Saltar para a caixa", "Aterrar suave", "Estender em cima"], hl: ["thigh", "glutes"],
    props: [{ type: "box", x: 150, y: 132, w: 64 }],
    frames: [stand(96, hands(4, 56)), crouch(98), air(136, 40, { footN: [150, 108], footF: [142, 110], kneeN: [168, 86] }), crouch(184, { hip: [162, 90], footN: [187, 126], footF: [183, 126], handN: rel(30, 30), handF: rel(28, 30) }), stand(180, { hip: [180, 47], footN: [183, 126], footF: [179, 126], ...hands(4, 56) })] };
  M.broadJump = { vb: TALL, dur: 2.6, loop: "seq", labels: ["Braços atrás", "Saltar em comprimento", "Aterrar e fixar"], hl: ["thigh", "glutes"],
    frames: [stand(50, hands(4, 56)), crouch(52), air(118, 70, { torso: 30, footN: [96, 136], footF: [90, 140], handN: rel(40, -10), handF: rel(38, -10) }), crouch(186, { handN: rel(30, 30), handF: rel(28, 30) })] };
  M.sprint = { dur: 0.9, loop: "cycle", labels: [], hl: ["thigh"],
    frames: [
      { hip: [120, 96], torso: 14, footN: [150, 168], footF: [86, 160], kneeF: -1, footAngF: 50, handN: rel(-22, 40), handF: rel(26, 26) },
      { hip: [120, 92], torso: 14, footN: [122, G], footF: [104, 148], footAngF: 70, handN: rel(0, 46), handF: rel(4, 46) },
      { hip: [120, 96], torso: 14, footF: [150, 168], footN: [86, 160], footAngN: 50, handF: rel(-22, 40), handN: rel(26, 26) },
      { hip: [120, 92], torso: 14, footF: [122, G], footN: [104, 148], footAngN: 70, handN: rel(4, 46), handF: rel(0, 46) },
    ] };
  M.bounds = { ...M.sprint, vb: TALL, dur: 1.4, labels: [], frames: M.sprint.frames.map((f, i) => ({ ...f, hip: [120, i % 2 ? 84 : 90], torso: 10, footN: i === 0 ? [158, 160] : f.footN, footF: i === 2 ? [158, 160] : f.footF })) };
  M.skater = { vb: TALL, dur: 1.8, labels: ["Saltar para o lado", "Aterrar numa perna e fixar"], hl: ["thigh", "glutes"],
    frames: [
      { view: "front", hip: [160, 112], torso: 14, footN: [170, G], footF: [130, 170], kneeF: [146, 150], handN: [120, 120], handF: [110, 100] },
      { view: "front", hip: [120, 80], torso: 0, footN: [136, 150], footF: [104, 150], footAng: 60, handN: [150, 90], handF: [90, 90] },
      { view: "front", hip: [80, 112], torso: -14, footF: [70, G], footN: [110, 170], kneeN: [94, 150], handN: [130, 100], handF: [120, 120] },
    ] };
  M.hurdleHops = { vb: TALL, dur: 1.4, labels: ["Saltar por cima", "Aterrar e repetir"], hl: ["shin", "thigh"],
    props: [{ type: "hurdle", x: 120, y: 156 }],
    frames: [
      { view: "front", hip: [74, 100], torso: 0, footN: [82, G], footF: [66, G], handN: [94, 128], handF: [54, 128] },
      { view: "front", hip: [120, 60], torso: 0, footN: [128, 130], footF: [112, 130], kneeN: [136, 104], kneeF: [104, 104], handN: [148, 70], handF: [92, 70] },
      { view: "front", hip: [166, 100], torso: 0, footN: [174, G], footF: [158, G], handN: [186, 128], handF: [146, 128] },
    ] };
  M.depthDrop = { vb: TALL, dur: 2.4, loop: "seq", labels: ["Sair da caixa", "Aterrar e fixar sem ressalto"], hl: ["thigh", "glutes"],
    props: [{ type: "box", x: 20, y: 130, w: 64 }],
    frames: [stand(64, { hip: [64, 46], footN: [67, 124], footF: [63, 124], ...hands(4, 56) }), air(104, 64, { footN: [120, 132], footF: [100, 140], handN: rel(20, -10), handF: rel(18, -10) }), crouch(142, { handN: rel(30, 30), handF: rel(28, 30) })] };
  M.agility = { dur: 2, labels: ["Deslocar lateralmente baixo", "Tocar no cone e mudar de direção"], hl: ["thigh"],
    props: [{ type: "cone", x: 30 }, { type: "cone", x: 210 }],
    frames: [
      { view: "front", hip: [70, 112], torso: -16, footN: [92, G], footF: [42, G], kneeN: [92, 140], kneeF: [52, 140], handN: [100, 116], handF: [36, 170] },
      { view: "front", hip: [170, 112], torso: 16, footN: [198, G], footF: [148, G], kneeN: [188, 140], kneeF: [148, 140], handN: [204, 170], handF: [140, 116] },
    ] };
  M.cut = { dur: 1.6, loop: "seq", labels: ["Acelerar", "Travar e mudar de direção"], hl: ["thigh"],
    props: [{ type: "cone", x: 150 }],
    frames: [M.sprint.frames[0], M.sprint.frames[2], { hip: [128, 112], torso: -14, footN: [160, G], footF: [112, G], kneeN: [150, 140], handN: rel(-26, 34), handF: rel(20, 30) }] };

  /* =============================== MÁQUINAS / EXTRA =============================== */
  M.legExtension = { dur: 2.6, labels: ["Esticar as pernas", "Descer devagar"], hl: ["thigh"],
    props: [seatBench(100), { type: "seg", a: [90, 140], b: [86, 72], w: 8 }],
    frames: [seated(100, { kneeN: [144, 136], kneeF: [142, 137], footN: [146, 178], footF: [144, 178], handN: [104, 142], handF: [102, 142] }),
             seated(100, { kneeN: [144, 136], kneeF: [142, 137], footN: [186, 126], footF: [184, 128], footAng: -60, handN: [104, 142], handF: [102, 142] })] };
  M.legCurl = { dur: 2.6, labels: ["Puxar os calcanhares para baixo", "Voltar devagar"], hl: ["thigh"],
    props: [seatBench(100), { type: "seg", a: [90, 140], b: [86, 72], w: 8 }, { type: "pad", x: 118, y: 118, w: 30, h: 8 }],
    frames: [seated(100, { kneeN: [144, 136], kneeF: [142, 137], footN: [186, 130], footF: [184, 132], footAng: -60, handN: [104, 142], handF: [102, 142] }),
             seated(100, { kneeN: [144, 136], kneeF: [142, 137], footN: [128, 168], footF: [126, 168], footAng: 30, handN: [104, 142], handF: [102, 142] })] };
  M.legPress = { dur: 3, labels: ["Empurrar a plataforma", "Descer até 90° nos joelhos"], hl: ["thigh", "glutes"],
    props: [{ type: "seg", a: [70, 160], b: [36, 108], w: 9 }, { type: "seg", a: [70, 160], b: [118, 160], w: 9 }, { type: "seg", a: [96, 166], b: [96, 184], w: 5 }, { type: "plate", at: "footN", ang: -55, len: 20 }],
    frames: [{ hip: [96, 152], torso: -56, neck: 30, footN: [168, 95], footF: [166, 97], footAng: -55, handN: [102, 160], handF: [100, 160], elbowN: -1 },
             { hip: [96, 152], torso: -56, neck: 30, footN: [134, 112], footF: [132, 114], footAng: -55, handN: [102, 160], handF: [100, 160], elbowN: -1 }] };
  M.hangingLegRaise = { dur: 3, labels: ["Subir as pernas sem balançar", "Descer controlado"], hl: ["torso", "thigh"],
    props: [{ type: "bar", x1: 70, x2: 190, y: 22 }],
    frames: [{ hip: [124, 132], torso: -4, handN: [130, 22], handF: [128, 22], footN: [110, 170], footF: [108, 172], footAng: 60 },
             { hip: [122, 130], torso: -14, curve: 3, handN: [130, 22], handF: [128, 22], footN: [206, 116], footF: [204, 118], kneeN: -1, footAng: -20 }] };
  M.crunch = { dur: 2.4, labels: ["Enrolar o tronco para cima", "Descer devagar"], hl: ["torso"], props: [{ type: "mat", x1: 20, x2: 220 }],
    frames: [{ hip: [130, 170], torso: -90, neck: 0, footN: [168, G], footF: [164, G], kneeN: -1, handN: rel(6, -6, "head"), handF: rel(4, -6, "head"), elbowN: [76, 152] },
             { hip: [130, 170], torso: -62, curve: 6, neck: 20, footN: [168, G], footF: [164, G], kneeN: -1, handN: rel(6, -6, "head"), handF: rel(4, -6, "head"), elbowN: [96, 132] }] };
  M.sidePlank = { dur: 3, loop: "hold", labels: ["Anca alta, corpo em linha"], hl: ["torso"], props: [{ type: "mat", x1: 20, x2: 220 }],
    frames: [{ view: "front", hip: [120, 150], torso: -78, handF: [80, 182], elbowF: [66, 180], handN: [118, 136], footN: [196, 176], footF: [194, 180], kneeN: [158, 162], kneeF: [156, 166] }] };

  global.MOTIONS = M;
})(window);
