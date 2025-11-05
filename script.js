// ---------------------------
// script.js (integração Supabase + jogo)
// ---------------------------

// 🔌 Configuração Supabase (já que você forneceu os valores)
const SUPABASE_URL = 'https://ttvhrkxnpcvrxcoozrmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0dmhya3hucGN2cnhjb296cm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODkzMzksImV4cCI6MjA3Nzg2NTMzOX0.CzR8JMO3QvYL3YmGNs05iprapHG6ZVfYckz6YrxrGEU';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- ESTADO DO JOGO ----------
let contagem = 0;
let valorClique = 1;
let gatosComprados = 0;

let upgradeComprado = false;
let autoClickComprado = false;
let superAutoClickComprado = false;
let goldClickComprado = false;

let ganhoPorSegundoAuto = 0;

// ---------- ELEMENTOS DO DOM ----------
const authContainer = document.getElementById('authContainer');
const emailInput = document.getElementById('email');
const senhaInput = document.getElementById('senha');
const btnLogin = document.getElementById('btnLogin');
const btnCadastro = document.getElementById('btnCadastro');
const authMensagem = document.getElementById('authMensagem');

const menuInicial = document.getElementById('menuInicial');
const btnComecar = document.getElementById('btnComecar');
const btnTelaCheia = document.getElementById('btnTelaCheia');
const btnSair = document.getElementById('btnSair');

const areaJogo = document.getElementById('areaJogo');
const botao = document.getElementById('botao');
const contador = document.getElementById('contador');
const upgrade = document.getElementById('upgrade');
const autoClick = document.getElementById('autoClick');
const superAutoClick = document.getElementById('superAutoClick');
const goldClick = document.getElementById('goldClick');
const gatinhos = document.getElementById('gatinhos');
const reset = document.getElementById('reset');
const gatoContainer = document.getElementById('gatinhoContainer');

const KEY = 'clickerSave_v2';
let tickIntervalId = null;

// salva info do usuário atual (user.id) em memória
let currentUser = null;

// debounce/autosave
let saveTimeout = null;
let autosaveInterval = null;

// preços / constantes
const PRECO_UPGRADE = 50;
const PRECO_AUTO = 140;
const PRECO_SUPER = 200;
const PRECO_GOLD = 600;
const PRECO_GATINHO_BASE = 600;
const MAX_GATOS = 10;
const GATO_POWER = 5; // +5/s por gatinho

function precoGatinho() {
  return PRECO_GATINHO_BASE + (gatosComprados * 100);
}

// ---------- Funções de persistência local (fallback) ----------
function salvarLocal() {
  const state = {
    contagem, valorClique, gatosComprados,
    upgradeComprado, autoClickComprado, superAutoClickComprado, goldClickComprado
  };
  localStorage.setItem(KEY, JSON.stringify(state));
}
function carregarLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    contagem = Number(data.contagem) || 0;
    valorClique = Number(data.valorClique) || 1;
    gatosComprados = Number(data.gatosComprados) || 0;
    upgradeComprado = !!data.upgradeComprado;
    autoClickComprado = !!data.autoClickComprado;
    superAutoClickComprado = !!data.superAutoClickComprado;
    goldClickComprado = !!data.goldClickComprado;
    return true;
  } catch (e) {
    console.error('carregarLocal erro', e);
    return false;
  }
}

// ---------- Funções DB (Supabase) ----------
async function carregarProgressoDB(userId) {
  // tenta buscar linha com user_id
  const { data, error } = await supabase
    .from('progressos')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') { // ignore not found
    console.error('Erro ao buscar progresso:', error);
    return null;
  }
  return data || null;
}

async function criarProgressoDB(userId, initialState = {}) {
  const row = {
    user_id: userId,
    contagem: initialState.contagem ?? 0,
    valorClique: initialState.valorClique ?? 1,
    gatosComprados: initialState.gatosComprados ?? 0,
    upgradeComprado: initialState.upgradeComprado ?? false,
    autoClickComprado: initialState.autoClickComprado ?? false,
    superAutoClickComprado: initialState.superAutoClickComprado ?? false,
    goldClickComprado: initialState.goldClickComprado ?? false
  };
  const { data, error } = await supabase
    .from('progressos')
    .insert(row)
    .select()
    .single();
  if (error) {
    console.error('Erro ao criar progresso:', error);
    return null;
  }
  return data;
}

async function salvarProgressoDBDebounced() {
  if (!currentUser) return; // só salva no DB se estiver logado
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => salvarProgressoDB(), 900);
}

async function salvarProgressoDB() {
  if (!currentUser) return;
  // upsert usando user_id como onConflict (assume que a tabela tem unique user_id)
  const row = {
    user_id: currentUser.id,
    contagem: contagem,
    valorClique: valorClique,
    gatosComprados: gatosComprados,
    upgradeComprado: upgradeComprado,
    autoClickComprado: autoClickComprado,
    superAutoClickComprado: superAutoClickComprado,
    goldClickComprado: goldClickComprado,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from('progressos')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) {
    console.error('Erro ao salvar progresso no DB:', error);
  } else {
    // opcional: console.log('Progresso salvo no DB', data);
  }
}

// cria interval de autosave no DB quando estiver logado
function startAutosaveDB() {
  if (autosaveInterval) return;
  autosaveInterval = setInterval(() => {
    if (currentUser) salvarProgressoDB();
  }, 10000); // salva a cada 10s
}
function stopAutosaveDB() {
  if (autosaveInterval) {
    clearInterval(autosaveInterval);
    autosaveInterval = null;
  }
}

// ---------- Funções UI / Game ----------
function atualizarContador() {
  contador.textContent = `Cliques: ${Math.floor(contagem)}`;
  // sempre salva local para fallback
  salvarLocal();
  // se logado, faz debounce para salvar no DB
  if (currentUser) salvarProgressoDBDebounced();
}
function atualizarBotoes() {
  upgrade.disabled = (contagem < PRECO_UPGRADE) || upgradeComprado;
  autoClick.disabled = (contagem < PRECO_AUTO) || autoClickComprado;
  superAutoClick.disabled = (contagem < PRECO_SUPER) || superAutoClickComprado;
  goldClick.disabled = (contagem < PRECO_GOLD) || goldClickComprado;
  gatinhos.disabled = (contagem < precoGatinho()) || (gatosComprados >= MAX_GATOS);

  if (gatosComprados >= MAX_GATOS) {
    gatinhos.textContent = '🐱 Gatinhos Máx ✅';
  } else {
    gatinhos.textContent = `🐱 Gatinhos! (+${GATO_POWER}/s cada) (${precoGatinho()} cliques)`;
  }

  if (upgradeComprado) upgrade.textContent = 'Upgrade comprado ✅';
  else upgrade.textContent = `x2 cliques! (${PRECO_UPGRADE} cliques)`;

  if (autoClickComprado) autoClick.textContent = 'AutoClick ativado ✅';
  else autoClick.textContent = `QUEM TA CLICANDO? (${PRECO_AUTO} cliques)`;

  if (superAutoClickComprado) superAutoClick.textContent = 'Super AutoClick ativado ✅';
  else superAutoClick.textContent = `DE ONDE TA VINDO ESSES CLIQUES? (${PRECO_SUPER} cliques)`;

  if (goldClickComprado) goldClick.textContent = 'Clique de Ouro ativado ✅';
  else goldClick.textContent = `CLIQUE DE OURO! (${PRECO_GOLD} cliques)`;
}

function recalcularGanhoPorSegundo() {
  let ganho = 0;
  if (autoClickComprado) ganho += 1;
  if (superAutoClickComprado) ganho += 10;
  ganho += gatosComprados * GATO_POWER;
  ganhoPorSegundoAuto = ganho;
}

function startTick() {
  if (tickIntervalId) return;
  tickIntervalId = setInterval(() => {
    if (ganhoPorSegundoAuto > 0) {
      contagem += ganhoPorSegundoAuto;
      atualizarContador();
      atualizarBotoes();
    }
  }, 1000);
}
function stopTick() {
  if (tickIntervalId) { clearInterval(tickIntervalId); tickIntervalId = null; }
}

function criarGato() {
  const gato = document.createElement('div');
  gato.className = 'gato';
  gato.textContent = '🐱';
  gatoContainer.appendChild(gato);
}

// explosão dourada (já presente)
function explosaoDourada(x, y) {
  const numParticulas = 20;
  for (let i = 0; i < numParticulas; i++) {
    const particula = document.createElement("div");
    particula.classList.add("particula-dourada");
    particula.textContent = "✨";
    document.body.appendChild(particula);
    particula.style.left = x + "px";
    particula.style.top = y + "px";
    const angulo = Math.random() * 2 * Math.PI;
    const distancia = 100 + Math.random() * 50;
    const destinoX = Math.cos(angulo) * distancia;
    const destinoY = Math.sin(angulo) * distancia;
    particula.animate([
      { transform: `translate(0, 0) scale(1)`, opacity: 1 },
      { transform: `translate(${destinoX}px, ${destinoY}px) scale(0)`, opacity: 0 }
    ], {
      duration: 700 + Math.random() * 400,
      easing: "ease-out",
      fill: "forwards"
    });
    setTimeout(() => particula.remove(), 1000);
  }
}

// ---------- Eventos de jogo ----------
botao.addEventListener('click', (e) => {
  contagem += valorClique;
  atualizarContador();
  atualizarBotoes();

  // número flutuante
  const numero = document.createElement('span');
  numero.textContent = `+${valorClique}`;
  numero.className = 'numero-flutuante';
  document.body.appendChild(numero);
  numero.style.left = e.clientX + 'px';
  numero.style.top = e.clientY - 20 + 'px';
  setTimeout(() => {
    numero.style.transform = 'translateY(-50px)';
    numero.style.opacity = '0';
  }, 10);
  setTimeout(() => numero.remove(), 600);

  if (goldClickComprado) explosaoDourada(e.clientX, e.clientY);
});

// upgrades
upgrade.addEventListener('click', () => {
  if (contagem >= PRECO_UPGRADE && !upgradeComprado) {
    contagem -= PRECO_UPGRADE;
    valorClique = 2;
    upgradeComprado = true;
    atualizarContador();
    atualizarBotoes();
  }
});
autoClick.addEventListener('click', () => {
  if (contagem >= PRECO_AUTO && !autoClickComprado) {
    contagem -= PRECO_AUTO;
    autoClickComprado = true;
    recalcularGanhoPorSegundo();
    startTick();
    atualizarContador();
    atualizarBotoes();
  }
});
superAutoClick.addEventListener('click', () => {
  if (contagem >= PRECO_SUPER && !superAutoClickComprado) {
    contagem -= PRECO_SUPER;
    superAutoClickComprado = true;
    recalcularGanhoPorSegundo();
    startTick();
    atualizarContador();
    atualizarBotoes();
  }
});
goldClick.addEventListener('click', () => {
  if (contagem >= PRECO_GOLD && !goldClickComprado) {
    contagem -= PRECO_GOLD;
    goldClickComprado = true;
    valorClique = 15;
    atualizarContador();
    atualizarBotoes();
  }
});
gatinhos.addEventListener('click', () => {
  const preco = precoGatinho();
  if (contagem >= preco && gatosComprados < MAX_GATOS) {
    contagem -= preco;
    gatosComprados++;
    criarGato();
    recalcularGanhoPorSegundo();
    startTick();
    atualizarContador();
    atualizarBotoes();
  }
});

// reset
reset.addEventListener('click', () => {
  if (!confirm('Tem certeza que quer resetar tudo?')) return;
  stopTick();
  localStorage.removeItem(KEY);
  document.querySelectorAll('.gato').forEach(g => g.remove());
  contagem = 0;
  valorClique = 1;
  gatosComprados = 0;
  upgradeComprado = autoClickComprado = superAutoClickComprado = goldClickComprado = false;
  ganhoPorSegundoAuto = 0;
  atualizarContador();
  atualizarBotoes();
  if (currentUser) salvarProgressoDBDebounced();
});

// ---------- MENU / FULLSCREEN / LOGIN (fluxo) ----------
async function handleSignUp(email, senha) {
  const { data, error } = await supabase.auth.signUp({ email, password: senha });
  if (error) {
    authMensagem.textContent = 'Erro cadastro: ' + error.message;
    return false;
  }
  authMensagem.textContent = 'Cadastro feito! Verifique seu email (se tiver). Faça login.';
  return true;
}
async function handleSignIn(email, senha) {
  const res = await supabase.auth.signInWithPassword({ email, password: senha });
  if (res.error) {
    authMensagem.textContent = 'Erro login: ' + res.error.message;
    return false;
  }
  // sucesso -> session criada; onAuthStateChange tratará o resto
  authMensagem.textContent = '';
  return true;
}
async function handleSignOut() {
  await supabase.auth.signOut();
  currentUser = null;
  // mostra tela de login
  authContainer.style.display = 'flex';
  menuInicial.style.display = 'none';
  areaJogo.style.display = 'none';
  stopAutosaveDB();
}

// inicializa menu (vai amarrar botões que existem no HTML)
function inicializarMenu() {
  // botões do menu
  if (btnComecar) {
    btnComecar.addEventListener('click', () => {
      menuInicial.style.display = 'none';
      areaJogo.style.display = 'block';
    });
  }
  if (btnTelaCheia) {
    btnTelaCheia.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          btnTelaCheia.textContent = '❌ Sair da Tela Cheia';
        } else {
          await document.exitFullscreen();
          btnTelaCheia.textContent = '🖥️ Tela Cheia';
        }
      } catch (err) {
        console.error('Erro fullscreen', err);
      }
    });
  }
  if (btnSair) {
    btnSair.addEventListener('click', handleSignOut);
  }

  // auth
  if (btnCadastro) {
    btnCadastro.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const senha = senhaInput.value;
      if (!email || !senha) { authMensagem.textContent = 'Preencha email e senha'; return; }
      await handleSignUp(email, senha);
    });
  }
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const senha = senhaInput.value;
      if (!email || !senha) { authMensagem.textContent = 'Preencha email e senha'; return; }
      await handleSignIn(email, senha);
    });
  }
}

// quando usuário faz login, sincroniza DB <-> game
async function onUserLogged(user) {
  currentUser = user;
  // esconde login, mostra menu
  authContainer.style.display = 'none';
  menuInicial.style.display = 'flex';
  areaJogo.style.display = 'none';

  startAutosaveDB();

  // tenta carregar progresso do DB
  const dbRow = await carregarProgressoDB(user.id);
  if (dbRow) {
    // aplica estado vindo do DB
    contagem = Number(dbRow.contagem) || 0;
    valorClique = Number(dbRow.valorclique ?? dbRow.valorClique) || Number(dbRow.valorClique) || 1;
    gatosComprados = Number(dbRow.gatoscomprados ?? dbRow.gatosComprados) || Number(dbRow.gatosComprados) || 0;
    upgradeComprado = !!(dbRow.upgradecomprado ?? dbRow.upgradeComprado);
    autoClickComprado = !!(dbRow.autoclickcomprado ?? dbRow.autoClickComprado);
    superAutoClickComprado = !!(dbRow.superautoclickcomprado ?? dbRow.superAutoClickComprado);
    goldClickComprado = !!(dbRow.goldclickcomprado ?? dbRow.goldClickComprado);
    // recria gatos visuais
    document.querySelectorAll('.gato').forEach(g => g.remove());
    for (let i = 0; i < gatosComprados; i++) criarGato();
  } else {
    // se não houver linha no DB, tenta usar localStorage (offline) e depois cria no DB
    const hadLocal = carregarLocal();
    // criar linha no DB com o estado atual (local ou defaults)
    await criarProgressoDB(user.id, {
      contagem, valorClique, gatosComprados,
      upgradeComprado, autoClickComprado, superAutoClickComprado, goldClickComprado
    });
  }

  recalcularGanhoPorSegundo();
  atualizarContador();
  atualizarBotoes();
  if (ganhoPorSegundoAuto > 0) startTick();
}

// ouvinte de mudança auth
supabase.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    onUserLogged(session.user);
  } else {
    // não logado
    currentUser = null;
    stopAutosaveDB();
    // mostra tela de login
    authContainer.style.display = 'flex';
    menuInicial.style.display = 'none';
    areaJogo.style.display = 'none';
  }
});

// ---------- Inicialização da aplicação ----------
document.addEventListener('DOMContentLoaded', async () => {
  inicializarMenu();

  // se já existir sessão ativa, onAuthStateChange será chamado, mas pegar sessão inicial
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    onUserLogged(session.user);
  } else {
    // tenta carregar local e mostra tela de login
    carregarLocal();
    atualizarContador();
    atualizarBotoes();
    authContainer.style.display = 'flex';
    menuInicial.style.display = 'none';
    areaJogo.style.display = 'none';
  }

  // startTick se houver ganho automático após carregar estado local
  recalcularGanhoPorSegundo();
  if (ganhoPorSegundoAuto > 0) startTick();
});

// salva também antes de fechar a página (local + DB se logado)
window.addEventListener('beforeunload', (e) => {
  salvarLocal();
  if (currentUser) {
    // salva síncrono via beacon (fallback) — Supabase não tem beacon built-in, então chamamos salvarProgressoDB sem aguardar
    salvarProgressoDB();
  }
});
