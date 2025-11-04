// === 🔐 LOGIN E CADASTRO COM SUPABASE ===

// ⚙️ Inicializa o Supabase
const SUPABASE_URL = "https://ttvhrkxnpcvrxcoozrmf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0dmhya3hucGN2cnhjb296cm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODkzMzksImV4cCI6MjA3Nzg2NTMzOX0.CzR8JMO3QvYL3YmGNs05iprapHG6ZVfYckz6YrxrGEU";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 🎯 Seleciona elementos do HTML
const authContainer = document.getElementById("authContainer");
const menuInicial = document.getElementById("menuInicial");
const areaJogo = document.getElementById("areaJogo");

const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const btnLogin = document.getElementById("btnLogin");
const btnCadastro = document.getElementById("btnCadastro");
const btnSair = document.getElementById("btnSair");
const authMensagem = document.getElementById("authMensagem");

// 🧩 Função para mostrar/esconder telas
function mostrarTela(tela) {
  authContainer.style.display = "none";
  menuInicial.style.display = "none";
  areaJogo.style.display = "none";
  tela.style.display = "flex";
}

// 🚪 Verifica se há sessão ativa
async function verificarSessao() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    mostrarTela(menuInicial);
  } else {
    mostrarTela(authContainer);
  }
}
verificarSessao();

// 👤 Criar conta
btnCadastro.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const senha = senhaInput.value.trim();
  const { error } = await supabase.auth.signUp({ email, password: senha });
  authMensagem.textContent = error ? error.message : "Conta criada! Verifique seu email.";
});

// 🔑 Login
btnLogin.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const senha = senhaInput.value.trim();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    authMensagem.textContent = error.message;
  } else {
    mostrarTela(menuInicial);
  }
});

// 🚪 Logout
btnSair.addEventListener("click", async () => {
  await supabase.auth.signOut();
  mostrarTela(authContainer);
});

// estado
let contagem = 0;
let valorClique = 1;
let gatosComprados = 0;

// flags
let upgradeComprado = false;
let autoClickComprado = false;
let superAutoClickComprado = false;
let goldClickComprado = false;

// ganho por segundo base (auto + super + gatos*5)
let ganhoPorSegundoAuto = 0;

// elementos
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

// preços
const PRECO_UPGRADE = 50;
const PRECO_AUTO = 140;
const PRECO_SUPER = 200;
const PRECO_GOLD = 600;
const PRECO_GATINHO_BASE = 600;
const MAX_GATOS = 10;
const GATO_POWER = 5; // +5/s por gatinho

// preço atual do gatinho
function precoGatinho() {
  return PRECO_GATINHO_BASE + (gatosComprados * 100);
}

// salvar e carregar progresso
function salvarProgresso() {
  const state = {
    contagem, valorClique, gatosComprados,
    upgradeComprado, autoClickComprado, superAutoClickComprado, goldClickComprado
  };
  localStorage.setItem(KEY, JSON.stringify(state));
}
function carregarProgresso() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    contagem = Number(data.contagem) || 0;
    valorClique = Number(data.valorClique) || 1;
    gatosComprados = Number(data.gatosComprados) || 0;
    upgradeComprado = !!data.upgradeComprado;
    autoClickComprado = !!data.autoClickComprado;
    superAutoClickComprado = !!data.superAutoClickComprado;
    goldClickComprado = !!data.goldClickComprado;
  } catch (e) {
    console.error('erro load', e);
  }
}

// atualizar UI
function atualizarContador() {
  contador.textContent = `Cliques: ${Math.floor(contagem)}`;
  salvarProgresso();
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

// cálculo do ganho por segundo
function recalcularGanhoPorSegundo() {
  let ganho = 0;
  if (autoClickComprado) ganho += 1;
  if (superAutoClickComprado) ganho += 10;
  ganho += gatosComprados * GATO_POWER;
  ganhoPorSegundoAuto = ganho;
}

// iniciar tick
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

// criar gatinho visual
function criarGato() {
  const gato = document.createElement('div');
  gato.className = 'gato';
  gato.textContent = '🐱';
  const y = gatosComprados * 62;
  gato.style.bottom = `${12 + y}px`;
  gatoContainer.appendChild(gato);
}

// 💥 Efeito de explosão dourada (mini explosão de partículas)
function explosaoDourada(x, y) {
  const numParticulas = 20;
  for (let i = 0; i < numParticulas; i++) {
    const particula = document.createElement("div");
    particula.classList.add("particula-dourada");
    particula.textContent = "✨"; // partícula dourada
    document.body.appendChild(particula);

    // posição inicial
    particula.style.left = x + "px";
    particula.style.top = y + "px";

    // movimento aleatório
    const angulo = Math.random() * 2 * Math.PI;
    const distancia = 100 + Math.random() * 50;
    const destinoX = Math.cos(angulo) * distancia;
    const destinoY = Math.sin(angulo) * distancia;

    // animação
    particula.animate([
      { transform: `translate(0, 0) scale(1)`, opacity: 1 },
      { transform: `translate(${destinoX}px, ${destinoY}px) scale(0)`, opacity: 0 }
    ], {
      duration: 700 + Math.random() * 400,
      easing: "ease-out",
      fill: "forwards"
    });

    // remove depois
    setTimeout(() => particula.remove(), 1000);
  }
}

// 🖱️ Clique principal
botao.addEventListener('click', (e) => {
  contagem += valorClique;
  atualizarContador();
  atualizarBotoes();

  // ✨ número flutuante
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

  // 💥 explosão dourada se o clique de ouro estiver ativo
  if (goldClickComprado) {
    explosaoDourada(e.clientX, e.clientY);
  }
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

// reset total
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
});

// inicialização
carregarProgresso();
recalcularGanhoPorSegundo();
for (let i = 0; i < gatosComprados; i++) criarGato();
atualizarContador();
atualizarBotoes();
if (ganhoPorSegundoAuto > 0) startTick();
// === Inicialização do menu + fullscreen (colocar NO FINAL do script.js) ===
document.addEventListener('DOMContentLoaded', () => {
  // procura pelos IDs que existem no seu HTML
  const menu = document.getElementById('menuInicial'); // seu HTML usa menuInicial
  const areaJogo = document.getElementById('areaJogo'); // seu HTML usa areaJogo
  const btnComecar = document.getElementById('btnComecar'); // seu HTML usa btnComecar
  const btnTelaCheia = document.getElementById('btnTelaCheia'); // seu HTML usa btnTelaCheia

  // checagens úteis (se faltar algo, loga no console e não quebra)
  if (!menu) console.error('menuInicial não encontrado');
  if (!areaJogo) console.error('areaJogo não encontrada');
  if (!btnComecar) console.error('btnComecar não encontrado');
  if (!btnTelaCheia) console.error('btnTelaCheia não encontrado');

  if (!menu || !areaJogo || !btnComecar || !btnTelaCheia) {
    // não prosseguir se o HTML estiver inconsistente
    return;
  }

  // função para abrir o jogo (fade / transição)
  function abrirJogo() {
    menu.style.transition = 'opacity 0.5s ease';
    menu.style.opacity = '0';
    setTimeout(() => {
      menu.style.display = 'none';
      areaJogo.style.display = 'flex';
      areaJogo.style.opacity = '0';
      areaJogo.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      areaJogo.style.transform = 'scale(0.98)';
      requestAnimationFrame(() => {
        areaJogo.style.opacity = '1';
        areaJogo.style.transform = 'scale(1)';
      });
    }, 500);
  }

  // handler do botão Começar
  btnComecar.addEventListener('click', () => {
    abrirJogo();
  });

  // handler do botão Tela Cheia (no menu)
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
      console.error('Erro ao alternar fullscreen:', err);
    }
  });

  // manter texto do botão sincronizado caso o usuário saia com ESC
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      btnTelaCheia.textContent = '🖥️ Tela Cheia';
    } else {
      btnTelaCheia.textContent = '❌ Sair da Tela Cheia';
    }
  });

  console.log('Menu configurado corretamente.');
});
const btnTelaCheia = document.getElementById('btnTelaCheiaJogo');
if (btnTelaCheia) {
  btnTelaCheia.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });
}
