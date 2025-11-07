// ------------------- CONFIGURAÇÃO SUPABASE -------------------
const SUPABASE_URL = 'https://ttvhrkxnpcvrxcoozrmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0dmhya3hucGN2cnhjb296cm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODkzMzksImV4cCI6MjA3Nzg2NTMzOX0.CzR8JMO3QvYL3YmGNs05iprapHG6ZVfYckz6YrxrGEU';
const supabase = window.supabase && window.supabase.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ------------------- ESTADO DO JOGO -------------------
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

// constantes
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

// usuário supabase
let currentUser = null;

// ------------------- ELEMENTOS DO DOM (serão populados no DOMContentLoaded) -------------------
const el = {}; // container para elementos

function queryEls() {
  // elementos de auth/menu/jogo - nomes esperados no seu HTML
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

  el.gatinhoContainer = document.getElementById('gatinhoContainer');
  el.creditos = document.getElementById('creditos');

  // botão full screen no jogo (canto superior direito). Se quiser um id diferente, adapte.
  el.btnTelaCheiaJogo = document.getElementById('btnTelaCheiaJogo');
}
// ------------------- UTILITÁRIOS -------------------
function precoGatinho() {
  return PRECO_GATINHO_BASE + (gatosComprados * 100);
}

// salvar/carregar local (fallback)
function salvarLocal() {
  try {
    const state = {
      contagem, valorClique, gatosComprados,
      upgradeComprado, autoClickComprado, superAutoClickComprado, goldClickComprado,
      ganhoPorSegundoAuto
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
    ganhoPorSegundoAuto = Number(data.ganhoPorSegundoAuto) || 0;
    return true;
  } catch (e) {
    console.warn('carregarLocal falhou', e);
    return false;
  }
}

// ------------------- SUPABASE: DB (CRUD do progresso) -------------------
async function carregarProgressoDB(userId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('progressos')
      .select('dados')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
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
      },
      atualizado_em: new Date().toISOString()
    };
    const { data, error } = await supabase.from('progressos').insert(row).select().single();
    if (error) { console.error('Erro criar progresso DB:', error); return null; }
    return data;
  } catch (e) {
    console.error('criarProgressoDB exception', e);
    return null;
  }
}

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

// ------------------- UI / ATUALIZAÇÕES -------------------
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

// recalcular ganho por segundo
function recalcularGanhoPorSegundo() {
  let ganho = 0;
  if (autoClickComprado) ganho += 1;
  if (superAutoClickComprado) ganho += 10;
  ganho += gatosComprados * GATO_POWER;
  ganhoPorSegundoAuto = ganho;
}

// tick
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
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
}

// ------------------- VISUAIS: GATINHOS / NUMERO FLUTUANTE / PARTICULAS -------------------
function criarGato() {
  if (!el.gatinhoContainer) return;
  const gato = document.createElement('div');
  gato.className = 'gato';
  gato.textContent = '🐱';
  el.gatinhoContainer.appendChild(gato);
}

function mostrarNumeroFlutuante(x, y, texto) {
  const numero = document.createElement('span');
  numero.textContent = `+${texto}`;
  numero.className = 'numero-flutuante';
  document.body.appendChild(numero);
  // posiciona dentro da viewport (ajusta se o número sair)
  const px = Math.max(6, Math.min(window.innerWidth - 40, x));
  const py = Math.max(6, Math.min(window.innerHeight - 40, y - 20));
  numero.style.left = px + 'px';
  numero.style.top = py + 'px';
  // animação (CSS keyframes definidas no style.css)
  setTimeout(() => {
    numero.style.transform = 'translateY(-50px)';
    numero.style.opacity = '0';
  }, 10);
  setTimeout(() => numero.remove(), 800);
}

function explosaoDourada(x, y) {
  const numParticulas = 18;
  for (let i = 0; i < numParticulas; i++) {
    const particula = document.createElement('div');
    particula.classList.add('particula-dourada');
    particula.textContent = '✨';
    document.body.appendChild(particula);
    // posicionamento seguro
    const px = Math.max(6, Math.min(window.innerWidth - 40, x));
    const py = Math.max(6, Math.min(window.innerHeight - 40, y));
    particula.style.left = px + 'px';
    particula.style.top = py + 'px';

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

// ------------------- EVENTOS DO JOGO (attach) -------------------
function attachGameEvents() {
  if (!el.botao) return;

  el.botao.addEventListener('click', (e) => {
    contagem += valorClique;
    atualizarContador();
    atualizarBotoes();
    mostrarNumeroFlutuante(e.clientX, e.clientY, valorClique);
    if (goldClickComprado) {
      explosaoDourada(e.clientX, e.clientY);
    }
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

// ------------------- MENU / FULLSCREEN / AUTH UI -------------------
function attachMenuEvents() {
  // Começar
  if (el.btnComecar) {
    el.btnComecar.addEventListener('click', () => {
      if (el.menuInicial) el.menuInicial.style.display = 'none';
      if (el.areaJogo) el.areaJogo.style.display = 'block';
      // Garantir título no topo (se seu HTML mostrou sumido)
      const h1 = document.querySelector('#areaJogo > h1');
      if (h1) h1.textContent = '💥 Jogo Cliquer COMPLETAMENTE NORMAL 💥';
    });
  }

  // Tela cheia no menu
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

  // Tela cheia no jogo (canto superior direito)
  if (el.btnTelaCheiaJogo) {
    el.btnTelaCheiaJogo.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (err) {
        console.error('Erro fullscreen jogo:', err);
      }
    });
  }

  // Evento para manter texto sincronizado
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      if (el.btnTelaCheia) el.btnTelaCheia.textContent = '🖥️ Tela Cheia';
      if (el.btnTelaCheiaJogo) el.btnTelaCheiaJogo.title = 'Tela cheia';
    } else {
      if (el.btnTelaCheia) el.btnTelaCheia.textContent = '❌ Sair da Tela Cheia';
      if (el.btnTelaCheiaJogo) el.btnTelaCheiaJogo.title = 'Sair da tela cheia';
    }
  });

  // Logout (se existir)
  if (el.btnSair) {
    el.btnSair.addEventListener('click', async () => {
      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (e) { console.error('Erro signOut', e); }
      }
      // limpa estado local e recarrega
      localStorage.removeItem(KEY);
      location.reload();
    });
  }
}

// ------------------- AUTH HANDLERS -------------------
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
        if (el.authMensagem) el.authMensagem.textContent = '';
        // onAuthStateChange trata o restante
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
  if (el.authContainer) el.authContainer.style.display = 'none';
  if (el.menuInicial) el.menuInicial.style.display = 'flex';
  if (el.areaJogo) el.areaJogo.style.display = 'none';

  startAutosaveDB();

  if (supabase && currentUser) {
    const saved = await carregarProgressoDB(currentUser.id);
    if (saved) {
      // carrega dados do DB (suporta formatos)
      contagem = Number(saved.contagem ?? saved.contador) || 0;
      valorClique = Number(saved.valorClique ?? saved.valor_clique) || Number(saved.valorClique) || 1;
      gatosComprados = Number(saved.gatosComprados ?? saved.gatos_comprados) || 0;
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
      // se não existe no DB, tenta local (offline) e cria no DB
      const hadLocal = carregarLocal();
      await criarProgressoDB(currentUser.id, {
        contagem, valorClique, gatosComprados,
        upgradeComprado, autoClickComprado, superAutoClickComprado, goldClickComprado
      });
    }
  } else {
    carregarLocal();
  }

  recalcularGanhoPorSegundo();
  atualizarContador();
  atualizarBotoes();
  if (ganhoPorSegundoAuto > 0) startTick();
}

// onAuthStateChange supabase (observador)
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    const user = session && session.user ? session.user : null;
    if (user) {
      onUserLogged(user);
    } else {
      // não logado
      currentUser = null;
      stopAutosaveDB();
      if (el.authContainer) el.authContainer.style.display = 'flex';
      if (el.menuInicial) el.menuInicial.style.display = 'none';
      if (el.areaJogo) el.areaJogo.style.display = 'none';
    }
  });
}

// ------------------- INICIALIZAÇÃO GERAL -------------------
document.addEventListener('DOMContentLoaded', async () => {
  // pegar elementos do DOM
  queryEls();

  // trabalhar título (garantir que o título "Jogo Cliquer COMPLETAMENTE NORMAL" está presente)
  // Se seu HTML tiver um h1 principal no menu/áreaJogo, ele será preservado; mas garantimos:
  const mainTitle = document.querySelector('title');
  if (mainTitle && mainTitle.textContent.indexOf('Cliquer') === -1) {
    mainTitle.textContent = 'Jogo Cliquer COMPLETAMENTE NORMAL';
  }
  // também garante que o h1 dentro da área do jogo seja o título pedido
  const areaH1 = document.querySelector('#areaJogo > h1');
  if (areaH1) areaH1.textContent = '💥 Jogo Cliquer COMPLETAMENTE NORMAL 💥';

  // vincular eventos
  attachAuthEvents();
  attachMenuEvents();
  attachGameEvents();

  // inicializa estado (tenta sessão supabase -> se houver, onUserLogged será chamado)
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data && data.session && data.session.user) {
        // chamamos onUserLogged para sincronizar UI
        onUserLogged(data.session.user);
      } else {
        // sem sessão: tenta carregar local e mostrar auth
        carregarLocal();
        recalcularGanhoPorSegundo();
        atualizarContador();
        atualizarBotoes();
        if (ganhoPorSegundoAuto > 0) startTick();
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
    // sem supabase: usa somente local
    console.warn('Supabase não está disponível — usando somente localStorage');
    carregarLocal();
    recalcularGanhoPorSegundo();
    atualizarContador();
    atualizarBotoes();
    if (ganhoPorSegundoAuto > 0) startTick();
    if (el.authContainer) el.authContainer.style.display = 'none';
    if (el.menuInicial) el.menuInicial.style.display = 'flex';
  }

  // criar visual dos gatos salvos (se houver)
  for (let i = 0; i < gatosComprados; i++) criarGato();

  // se area do jogo estiver visível, centraliza layout (ajuste para CSS reduzido)
  if (el.areaJogo) {
    // garante que areaJogo usa flex column e está centralizada verticalmente quando visível
    el.areaJogo.style.display = el.areaJogo.style.display || 'flex';
  }
});

// salvar antes de sair
window.addEventListener('beforeunload', () => {
  salvarLocal();
  if (currentUser) salvarProgressoDB();
});

// botao tela cheia global (apenas compatibilidade se você tiver um id alternativo)
(function registerGlobalFullscreenButton() {
  const candidate = document.getElementById("btnTelaCheia");
  if (!candidate) return;
  candidate.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Erro fullscreen global:', err);
    }
  });
})();

// fim do script.js
