// =================== script.js completo ===================
// 1) Supabase config (use sua URL e anon key)
const SUPABASE_URL = 'https://ttvhrkxnpcvrxcoozrmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0dmhya3hucGN2cnhjb296cm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODkzMzksImV4cCI6MjA3Nzg2NTMzOX0.CzR8JMO3QvYL3YmGNs05iprapHG6ZVfYckz6YrxrGEU';
const supabase = window.supabase && window.supabase.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// =================== Estado do jogo ===================
let contagem = 0;
let valorClique = 1;
let gatosComprados = 0;

// flags
let upgradeComprado = false;
let autoClickComprado = false;
let superAutoClickComprado = false;
let goldClickComprado = false;

// ganho por segundo (auto + super + gatos*5)
let ganhoPorSegundoAuto = 0;

// IDs/constantes/intervals
const KEY = 'clickerSave_v2';
let tickIntervalId = null;
let saveTimeout = null;
let autosaveInterval = null;

// preços / limites
const PRECO_UPGRADE = 50;
const PRECO_AUTO = 140;
const PRECO_SUPER = 200;
const PRECO_GOLD = 600;
const PRECO_GATINHO_BASE = 600;
const MAX_GATOS = 10;
const GATO_POWER = 5; // +5/s por gatinho

// Usuário logado (supabase)
let currentUser = null;

// =================== Elementos do DOM (pegar depois no DOMContentLoaded) ===================
let el = {};
function queryEls() {
  // elementos que o HTML fornece
  el.authContainer = document.getElementById('authContainer');
  el.emailInput = document.getElementById('email');
  el.senhaInput = document.getElementById('senha');
  el.btnLogin = document.getElementById('btnLogin');
  el.btnCadastro = document.getElementById('btnCadastro');
  el.authMensagem = document.getElementById('authMensagem');

  el.menuInicial = document.getElementById('menuInicial');
  el.btnComecar = document.getElementById('btnComecar');
  el.btnTelaCheia = document.getElementById('btnTelaCheia');
  el.btnSair = document.getElementById('btnSair');

  el.areaJogo = document.getElementById('areaJogo');
  el.botao = document.getElementById('botao');
  el.contador = document.getElementById('contador');
  el.upgrade = document.getElementById('upgrade');
  el.autoClick = document.getElementById('autoClick');
  el.superAutoClick = document.getElementById('superAutoClick');
  el.goldClick = document.getElementById('goldClick');
  el.gatinhos = document.getElementById('gatinhos');
  el.reset = document.getElementById('reset');
  el.mensagem = document.getElementById('mensagem');

  el.gatinhoContainer = document.getElementById('gatinhoContainer'); // seu container para gatos
  // elementos opcionais
  el.creditos = document.getElementById('creditos');
}

// =================== Utilitários ===================
function precoGatinho() {
  return PRECO_GATINHO_BASE + (gatosComprados * 100);
}

// salvar/carregar local (fallback)
function salvarLocal() {
  try {
    const state = {
      contagem, valorClique, gatosComprados,
      upgradeComprado, autoClickComprado, superAutoClickComprado, goldClickComprado
    };
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('salvarLocal falhou', e);
  }
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
    console.warn('carregarLocal falhou', e);
    return false;
  }
}

// =================== Salvar/Carregar no Supabase (JSON em campo `dados`) ===================
async function carregarProgressoDB(userId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('progressos')
      .select('dados')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Erro ao buscar progresso no DB:', error);
      return null;
    }
    return data && data.dados ? data.dados : null;
  } catch (e) {
    console.error('carregarProgressoDB exception', e);
    return null;
  }
}

async function criarProgressoDB(userId, initialState = {}) {
  if (!supabase) return null;
  try {
    const row = {
      user_id: userId,
      dados: {
        contagem: initialState.contagem ?? 0,
        valorClique: initialState.valorClique ?? 1,
        gatosComprados: initialState.gatosComprados ?? 0,
        upgrades: {
          normal: initialState.upgradeComprado ?? false,
          auto: initialState.autoClickComprado ?? false,
          super: initialState.superAutoClickComprado ?? false,
          gold: initialState.goldClickComprado ?? false
        }
      }
    };
    const { data, error } = await supabase.from('progressos').insert(row).select().single();
    if (error) { console.error('Erro criar progresso DB:', error); return null; }
    return data;
  } catch (e) {
    console.error('criarProgressoDB exception', e);
    return null;
  }
}

// debounce + upsert
async function salvarProgressoDBDebounced() {
  if (!currentUser) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => salvarProgressoDB(), 800);
}

async function salvarProgressoDB() {
  if (!supabase || !currentUser) return;
  try {
    const dados = {
      contagem,
      valorClique,
      gatosComprados,
      upgrades: {
        normal: upgradeComprado,
        auto: autoClickComprado,
        super: superAutoClickComprado,
        gold: goldClickComprado
      },
      ganhoPorSegundoAuto
    };
    const row = {
      user_id: currentUser.id,
      dados,
      atualizado_em: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('progressos')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) {
      console.error('Erro ao salvar progresso no DB:', error);
    } else {
      // sucesso
      // console.log('Progresso salvo no DB');
    }
  } catch (e) {
    console.error('salvarProgressoDB exception', e);
  }
}

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

// =================== UI / Game update ===================
function atualizarContador() {
  if (el.contador) el.contador.textContent = `Cliques: ${Math.floor(contagem)}`;
  salvarLocal();
  if (currentUser) salvarProgressoDBDebounced();
}
function atualizarBotoes() {
  if (!el.upgrade) return;
  el.upgrade.disabled = (contagem < PRECO_UPGRADE) || upgradeComprado;
  el.autoClick.disabled = (contagem < PRECO_AUTO) || autoClickComprado;
  el.superAutoClick.disabled = (contagem < PRECO_SUPER) || superAutoClickComprado;
  el.goldClick.disabled = (contagem < PRECO_GOLD) || goldClickComprado;
  el.gatinhos.disabled = (contagem < precoGatinho()) || (gatosComprados >= MAX_GATOS);

  if (gatosComprados >= MAX_GATOS) {
    el.gatinhos.textContent = '🐱 Gatinhos Máx ✅';
  } else {
    el.gatinhos.textContent = `🐱 Gatinhos! (+${GATO_POWER}/s cada) (${precoGatinho()} cliques)`;
  }

  if (upgradeComprado) el.upgrade.textContent = 'Upgrade comprado ✅';
  else el.upgrade.textContent = `x2 cliques! (${PRECO_UPGRADE} cliques)`;

  if (autoClickComprado) el.autoClick.textContent = 'AutoClick ativado ✅';
  else el.autoClick.textContent = `QUEM TA CLICANDO? (${PRECO_AUTO} cliques)`;

  if (superAutoClickComprado) el.superAutoClick.textContent = 'Super AutoClick ativado ✅';
  else el.superAutoClick.textContent = `DE ONDE TA VINDO ESSES CLIQUES? (${PRECO_SUPER} cliques)`;

  if (goldClickComprado) el.goldClick.textContent = 'Clique de Ouro ativado ✅';
  else el.goldClick.textContent = `CLIQUE DE OURO! (${PRECO_GOLD} cliques)`;
}

// recompute ganho por segundo
function recalcularGanhoPorSegundo() {
  let ganho = 0;
  if (autoClickComprado) ganho += 1;
  if (superAutoClickComprado) ganho += 10;
  ganho += gatosComprados * GATO_POWER;
  ganhoPorSegundoAuto = ganho;
}

// tick (1s)
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

// visual dos gatinhos
function criarGato() {
  if (!el.gatinhoContainer) return;
  const gato = document.createElement('div');
  gato.className = 'gato';
  gato.textContent = '🐱';
  el.gatinhoContainer.appendChild(gato);
}

// número flutuante (ao clicar)
function mostrarNumeroFlutuante(x, y, texto) {
  const numero = document.createElement('span');
  numero.textContent = `+${texto}`;
  numero.className = 'numero-flutuante';
  document.body.appendChild(numero);
  numero.style.left = x + 'px';
  numero.style.top = (y - 20) + 'px';
  // animação via CSS keyframes (classe já existe no CSS)
  setTimeout(() => {
    numero.style.transform = 'translateY(-50px)';
    numero.style.opacity = '0';
  }, 10);
  setTimeout(() => numero.remove(), 700);
}

// explosão dourada
function explosaoDourada(x, y) {
  const numParticulas = 18;
  for (let i = 0; i < numParticulas; i++) {
    const particula = document.createElement('div');
    particula.classList.add('particula-dourada');
    particula.textContent = '✨';
    document.body.appendChild(particula);
    particula.style.left = x + 'px';
    particula.style.top = y + 'px';

    const angulo = Math.random() * Math.PI * 2;
    const distancia = 60 + Math.random() * 80;
    const destinoX = Math.cos(angulo) * distancia;
    const destinoY = Math.sin(angulo) * distancia;

    particula.animate([
      { transform: `translate(0,0) scale(1)`, opacity: 1 },
      { transform: `translate(${destinoX}px, ${destinoY}px) scale(0)`, opacity: 0 }
    ], {
      duration: 600 + Math.random() * 400,
      easing: 'ease-out',
      fill: 'forwards'
    });

    setTimeout(() => particula.remove(), 1100);
  }
}

// =================== Eventos principais do jogo ===================
function attachGameEvents() {
  if (!el.botao) return;

  el.botao.addEventListener('click', (e) => {
    contagem += valorClique;
    atualizarContador();
    atualizarBotoes();
    mostrarNumeroFlutuante(e.clientX, e.clientY, valorClique);
    if (goldClickComprado) explosaoDourada(e.clientX, e.clientY);
  });

  if (el.upgrade) {
    el.upgrade.addEventListener('click', () => {
      if (contagem >= PRECO_UPGRADE && !upgradeComprado) {
        contagem -= PRECO_UPGRADE;
        valorClique = 2;
        upgradeComprado = true;
        atualizarContador();
        atualizarBotoes();
      }
    });
  }

  if (el.autoClick) {
    el.autoClick.addEventListener('click', () => {
      if (contagem >= PRECO_AUTO && !autoClickComprado) {
        contagem -= PRECO_AUTO;
        autoClickComprado = true;
        recalcularGanhoPorSegundo();
        startTick();
        atualizarContador();
        atualizarBotoes();
      }
    });
  }

  if (el.superAutoClick) {
    el.superAutoClick.addEventListener('click', () => {
      if (contagem >= PRECO_SUPER && !superAutoClickComprado) {
        contagem -= PRECO_SUPER;
        superAutoClickComprado = true;
        recalcularGanhoPorSegundo();
        startTick();
        atualizarContador();
        atualizarBotoes();
      }
    });
  }

  if (el.goldClick) {
    el.goldClick.addEventListener('click', () => {
      if (contagem >= PRECO_GOLD && !goldClickComprado) {
        contagem -= PRECO_GOLD;
        goldClickComprado = true;
        valorClique = 15;
        atualizarContador();
        atualizarBotoes();
      }
    });
  }

  if (el.gatinhos) {
    el.gatinhos.addEventListener('click', () => {
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
  }

  if (el.reset) {
    el.reset.addEventListener('click', () => {
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
  }
}

// =================== Menu / fullscreen / auth UI ===================
function attachMenuEvents() {
  // menu começar
  if (el.btnComecar) {
    el.btnComecar.addEventListener('click', () => {
      if (el.menuInicial) el.menuInicial.style.display = 'none';
      if (el.areaJogo) el.areaJogo.style.display = 'block';
    });
  }
  // fullscreen
  if (el.btnTelaCheia) {
    el.btnTelaCheia.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          el.btnTelaCheia.textContent = '❌ Sair da Tela Cheia';
        } else {
          await document.exitFullscreen();
          el.btnTelaCheia.textContent = '🖥️ Tela Cheia';
        }
      } catch (err) {
        console.error('Erro ao alternar fullscreen:', err);
      }
    });
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      if (el.btnTelaCheia) el.btnTelaCheia.textContent = '🖥️ Tela Cheia';
    } else {
      if (el.btnTelaCheia) el.btnTelaCheia.textContent = '❌ Sair da Tela Cheia';
    }
  });

  // logout button handler (se existir)
  if (el.btnSair) {
    el.btnSair.addEventListener('click', async () => {
      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (e) { console.error('Erro signOut', e); }
      }
      // recarrega pagina pra garantir estado limpo
      location.reload();
    });
  }
}

// =================== Auth: signup / signin handlers ===================
function attachAuthEvents() {
  if (el.btnCadastro) {
    el.btnCadastro.addEventListener('click', async () => {
      const email = el.emailInput ? el.emailInput.value.trim() : '';
      const senha = el.senhaInput ? el.senhaInput.value : '';
      if (!email || !senha) {
        if (el.authMensagem) el.authMensagem.textContent = 'Preencha email e senha';
        return;
      }
      try {
        const { data, error } = await supabase.auth.signUp({ email, password: senha });
        if (error) {
          if (el.authMensagem) el.authMensagem.textContent = 'Erro cadastro: ' + error.message;
          return;
        }
        if (el.authMensagem) el.authMensagem.textContent = 'Cadastro solicitado — verifique seu email.';
      } catch (e) {
        console.error('Erro signup', e);
        if (el.authMensagem) el.authMensagem.textContent = 'Erro ao criar conta';
      }
    });
  }

  if (el.btnLogin) {
    el.btnLogin.addEventListener('click', async () => {
      const email = el.emailInput ? el.emailInput.value.trim() : '';
      const senha = el.senhaInput ? el.senhaInput.value : '';
      if (!email || !senha) {
        if (el.authMensagem) el.authMensagem.textContent = 'Preencha email e senha';
        return;
      }
      try {
        const res = await supabase.auth.signInWithPassword({ email, password: senha });
        if (res.error) {
          if (el.authMensagem) el.authMensagem.textContent = 'Erro login: ' + res.error.message;
          return;
        }
        // sucesso -> onAuthStateChange será chamado
        if (el.authMensagem) el.authMensagem.textContent = '';
      } catch (e) {
        console.error('Erro signin', e);
        if (el.authMensagem) el.authMensagem.textContent = 'Erro ao logar';
      }
    });
  }
}

// quando usuário loga: sincroniza DB -> jogo
async function onUserLogged(sessionUser) {
  currentUser = sessionUser;
  // esconder auth, mostrar menu
  if (el.authContainer) el.authContainer.style.display = 'none';
  if (el.menuInicial) el.menuInicial.style.display = 'flex';
  if (el.areaJogo) el.areaJogo.style.display = 'none';

  // garantir autosave no DB
  startAutosaveDB();

  // tenta carregar do DB
  if (supabase && currentUser) {
    const saved = await carregarProgressoDB(currentUser.id);
    if (saved) {
      // suporta formato antigo e novo
      contagem = Number(saved.contagem ?? saved.contador) || 0;
      valorClique = Number(saved.valorClique ?? saved.valor_clique) || Number(saved.valorClique) || 1;
      gatosComprados = Number(saved.gatosComprados ?? saved.gatos_comprados) || 0;
      // upgrades: saved.upgrades (obj) ou booleans diretas
      if (saved.upgrades) {
        upgradeComprado = !!saved.upgrades.normal;
        autoClickComprado = !!saved.upgrades.auto;
        superAutoClickComprado = !!saved.upgrades.super;
        goldClickComprado = !!saved.upgrades.gold;
      } else {
        upgradeComprado = !!(saved.upgradeComprado ?? saved.upgrade_comprado);
        autoClickComprado = !!(saved.autoClickComprado ?? saved.auto_click_comprado);
        superAutoClickComprado = !!(saved.superAutoClickComprado ?? saved.super_auto_click_comprado);
        goldClickComprado = !!(saved.goldClickComprado ?? saved.gold_click_comprado);
      }
      // recria gatos visuais
      document.querySelectorAll('.gato').forEach(g => g.remove());
      for (let i = 0; i < gatosComprados; i++) criarGato();
    } else {
      // se não existe no DB, tenta carregar local (offline) e cria no DB
      const hadLocal = carregarLocal();
      await criarProgressoDB(currentUser.id, {
        contagem, valorClique, gatosComprados,
        upgradeComprado, autoClickComprado, superAutoClickComprado, goldClickComprado
      });
    }
  } else {
    // sem supabase: tenta local
    carregarLocal();
  }

  recalcularGanhoPorSegundo();
  atualizarContador();
  atualizarBotoes();
  if (ganhoPorSegundoAuto > 0) startTick();
}

// onAuthStateChange supabase
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    const user = session && session.user ? session.user : null;
    if (user) {
      onUserLogged(user);
    } else {
      // não logado
      currentUser = null;
      stopAutosaveDB();
      // mostra tela de login
      if (el.authContainer) el.authContainer.style.display = 'flex';
      if (el.menuInicial) el.menuInicial.style.display = 'none';
      if (el.areaJogo) el.areaJogo.style.display = 'none';
    }
  });
}

// =================== Inicialização geral ===================
document.addEventListener('DOMContentLoaded', async () => {
  // pegar elementos
  queryEls();

  // vincular eventos
  attachAuthEvents();
  attachMenuEvents();
  attachGameEvents();

  // iniciar: se já existir sessão supabase -> handler será chamado via onAuthStateChange
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data && data.session && data.session.user) {
        // haverá chamada a onAuthStateChange, mas chamamos também por garantia
        onUserLogged(data.session.user);
      } else {
        // sem sessão: tentar carregar local e mostrar auth
        carregarLocal();
        recalcularGanhoPorSegundo();
        atualizarContador();
        atualizarBotoes();
        if (ganhoPorSegundoAuto > 0) startTick();
        // mostrar auth
        if (el.authContainer) el.authContainer.style.display = 'flex';
        if (el.menuInicial) el.menuInicial.style.display = 'none';
        if (el.areaJogo) el.areaJogo.style.display = 'none';
      }
    } catch (e) {
      console.error('Erro getSession', e);
      // fallback local
      carregarLocal();
      recalcularGanhoPorSegundo();
      atualizarContador();
      atualizarBotoes();
      if (ganhoPorSegundoAuto > 0) startTick();
    }
  } else {
    // sem supabase disponível (debug)
    console.warn('Supabase não está disponível — usando somente localStorage');
    carregarLocal();
    recalcularGanhoPorSegundo();
    atualizarContador();
    atualizarBotoes();
    if (ganhoPorSegundoAuto > 0) startTick();
    if (el.authContainer) el.authContainer.style.display = 'none';
    if (el.menuInicial) el.menuInicial.style.display = 'flex';
  }
});

// salvar antes de sair
window.addEventListener('beforeunload', () => {
  salvarLocal();
  if (currentUser) salvarProgressoDB();
});
// 🖥️ Botão de Tela Cheia
const btnTelaCheia = document.getElementById("btnTelaCheia");

if (btnTelaCheia) {
  btnTelaCheia.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Erro ao ativar tela cheia:", err);
      });
    } else {
      document.exitFullscreen();
    }
  });
}
