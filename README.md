# Físico

App pessoal (PWA) que junta o **gymos** e a **Nutrição** da Vida OS: treino, alimentação e recuperação num só sítio. Privada, funciona offline e sincroniza entre telemóvel e PC.

Online em `https://rblucas2.github.io/gymos/` (o gymos antigo continua em `classic.html`).

## Separadores
- **Hoje** — prontidão, treino do dia (com aquecimento), calorias e macros, mobilidade do dia e a semana.
- **Treino** — planos (Push/Pull/Pernas/Pliometria do gymos + os teus), registo de séries com cargas da última vez, cronómetro de descanso, recordes (1RM estimado), semana, histórico e **Importar** planos feitos no Claude.
- **Exercícios** — 128 exercícios (gymos + arquivo do Notion) com **animação própria** de cada movimento, passos "como fazer", músculos e material. Filtros por tipo e músculo; podes criar os teus.
- **Nutrição** — diário por refeição, **scanner de código de barras**, fecho de macros, plano semanal (com PDF), base de alimentos, refeições guardadas, metas (Mifflin-St Jeor) e peso. Dias de treino têm +12% de hidratos.
- **Recuperação** — check-in diário (sono, energia, dores, stress, FC), prontidão 0-100, recuperação por músculo (séries das últimas 72 h) e rotinas de mobilidade guiadas com temporizador.
- **Progresso** — volume semanal, séries por músculo face à regra do arquivo (9/semana), recordes, consistência, alimentação média, peso e medidas.

## Scanner
O Safari do iPhone não tem `BarcodeDetector`, e a biblioteca antiga vinha de um CDN que falhava. Agora o leitor usa o detetor nativo quando existe e, senão, o motor **ZXing em WebAssembly servido pela própria app** (`vendor/`). Lê em vídeo (faixa central + imagem inteira, 2 leituras iguais, dígito de controlo validado, lanterna), por **fotografia** ou escrevendo o número. Procura primeiro nos teus alimentos e depois na Open Food Facts; se não existir, cria o alimento com esse código para a próxima vez.

## Animações
`anim.js` é um motor próprio: um boneco 2D com cinemática inversa (cotovelos e joelhos calculados), poses-chave interpoladas, material (barra, halteres, cabos, banco, caixa…) e os músculos trabalhados a laranja. `motions.js` tem ~100 movimentos; cada exercício em `data/exercises.js` aponta para um.

## Planos a partir do TikTok (via Claude)
Treino → Importar → **Copiar pedido para o Claude**. Cola esse pedido no Claude com o conteúdo da tua pasta "Físico" do TikTok; o Claude devolve JSON com os planos (e exercícios novos, já com a animação mais parecida). Cola o JSON na app → Pré-visualizar → Importar. Os dias indicados vão para a tua semana.

## Dados
- Na 1.ª abertura importa sozinha o gymos (`treino_state`: planos, trocas, semana, histórico, cargas, recordes, alongamentos, sono/FC) e a Nutrição da Vida OS (`vidaos:nut`) deste browser. Definições → "Importar dados…" repete (junta, não apaga) e também lê as sincronizações antigas.
- Sincronização: Definições → login Supabase (o mesmo das Finanças e da Vida), tabela `user_state` com Row Level Security.
