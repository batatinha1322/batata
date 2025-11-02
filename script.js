(() => {
  let contagem = 0;
  let valorClique = 1;
  let upgrades = {
    upgrade: { preco: 50, ativo: false },
    autoClick: { preco: 140, ativo: false, intervalId: null },
    superAutoClick: { preco: 200, ativo: false, intervalId: null },
    goldClick: { preco: 600, ativo: false }
  };
  const KEY = 'clickerGame_v1';

  const botao = document.getElementById('botao');
  const contador = document.getElementById('contador');
  const mensagem = document.getElementById('mensagem');
  const btnUpgrade = document.getElementById('upgrade');
  const btnAuto = document.getElementById('autoClick');
  const btnSuper = document.getElementById('superAutoClick');
  const btnGold = document.getElementById('goldClick');
  const btnReset = document.getElementById('reset');

  function salvarProgresso() {
    const state = {
      contagem,
      valorClique,
      upgrades: {
        upgrade: upgrades.upgrade.ativo,
        autoClick: upgrades.autoClick.ativo,
        superAutoClick: upgrades.superAutoClick.ativo,
        goldClick: upgrades.goldClick.ativo
      }
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
      upgrades.upgrade.ativo = !!data.upgrades.upgrade;
      upgrades.autoClick.ativo = !!data.upgrades.autoClick;
      upgrades.superAutoClick.ativo = !!data.upgrades.superAutoClick;
      upgrades.goldClick.ativo = !!data.upgrades.goldClick;
    } catch (e) {
      console.error('Erro ao carregar progresso', e);
    }
  }

  function atualizarContador() {
    contador.textContent = `Cliques: ${contagem}`;
    salvarProgresso();
    verificarUpgrades();
  }

  function verificarUpgrades() {
    btnUpgrade.disabled = upgrades.upgrade.ativo || contagem < upgrades.upgrade.preco;
    btnAuto.disabled = upgrades.autoClick.ativo || contagem < upgrades.autoClick.preco;
    btnSuper.disabled = upgrades.superAutoClick.ativo || contagem < upgrades.superAutoClick.preco;
    btnGold.disabled = upgrades.goldClick.ativo || contagem < upgrades.goldClick.preco;
  }

  function mostrarEfeito(x, y, texto) {
    const ft = document.createElement('div');
    ft.className = 'float-text';
    ft.textContent = `+${texto}`;
    const px = Math.max(6, Math.min(window.innerWidth - 60, x));
    const py = Math.max(6, Math.min(window.innerHeight - 40, y));
    ft.style.left = px + 'px';
    ft.style.top = py + 'px';
    document.body.appendChild(ft);
    setTimeout(() => ft.remove(), 900);

    if (valorClique >= 15) {
      for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.background = ['gold', '#ffd966', '#ffdd88'][Math.floor(Math.random() * 3)];
        const ox = px + (Math.random() * 80 - 40);
        const oy = py + (Math.random() * 40 - 20);
        p.style.left = ox + 'px';
        p.style.top = oy + 'px';
        document.body.appendChild(p);
        requestAnimationFrame(() => {
          p.style.transition = 'transform 900ms cubic-bezier(.2,.7,.2,1), opacity 900ms linear';
          p.style.transform = `translateY(${120 + Math.random() * 80}px) translateX(${(Math.random() * 80 - 40)}px) rotate(${Math.random() * 360}deg)`;
          p.style.opacity = '0';
        });
        setTimeout(() => p.remove(), 950);
      }
    }
  }

  botao.addEventListener('click', (e) => {
    contagem += valorClique;
    atualizarContador();
    mostrarEfeito(e.clientX, e.clientY, valorClique);
  });

  btnUpgrade.addEventListener('click', () => {
    if (contagem >= upgrades.upgrade.preco && !upgrades.upgrade.ativo) {
      contagem -= upgrades.upgrade.preco;
      upgrades.upgrade.ativo = true;
      valorClique = Math.max(valorClique, 2);
      btnUpgrade.textContent = 'Upgrade comprado ✅';
      btnUpgrade.disabled = true;
      mensagem.textContent = 'Agora cada clique vale 2!';
      atualizarContador();
    }
  });

  btnAuto.addEventListener('click', () => {
    if (contagem >= upgrades.autoClick.preco && !upgrades.autoClick.ativo) {
      contagem -= upgrades.autoClick.preco;
      upgrades.autoClick.ativo = true;
      btnAuto.textContent = 'AutoClick ativado ✅';
      btnAuto.disabled = true;
      mensagem.textContent = 'Agora você ganha +1 clique por segundo!';
      iniciarAutoClick();
      atualizarContador();
    }
  });

  btnSuper.addEventListener('click', () => {
    if (contagem >= upgrades.superAutoClick.preco && !upgrades.superAutoClick.ativo) {
      contagem -= upgrades.superAutoClick.preco;
      upgrades.superAutoClick.ativo = true;
      btnSuper.textContent = 'Super AutoClick ativado ✅';
      btnSuper.disabled = true;
      mensagem.textContent = 'Agora você ganha +10 cliques por segundo!';
      iniciarSuperAutoClick();
      atualizarContador();
    }
  });

  btnGold.addEventListener('click', () => {
    if (contagem >= upgrades.goldClick.preco && !upgrades.goldClick.ativo) {
      contagem -= upgrades.goldClick.preco;
      upgrades.goldClick.ativo = true;
      valorClique = 15;
      btnGold.textContent = 'Clique de Ouro ativado ✅';
      btnGold.disabled = true;
      mensagem.textContent = 'Agora cada clique vale 15!';
      atualizarContador();
    }
  });

  function iniciarAutoClick() {
    if (upgrades.autoClick.intervalId) return;
    upgrades.autoClick.intervalId = setInterval(() => {
      contagem += 1;
      atualizarContador();
    }, 1000);
  }

  function iniciarSuperAutoClick() {
    if (upgrades.superAutoClick.intervalId) return;
    upgrades.superAutoClick.intervalId = setInterval(() => {
      contagem += 10;
      atualizarContador();
    }, 1000);
  }

  function pararAutoClicks() {
    if (upgrades.autoClick.intervalId) { clearInterval(upgrades.autoClick.intervalId); upgrades.autoClick.intervalId = null; }
    if (upgrades.superAutoClick.intervalId) { clearInterval(upgrades.superAutoClick.intervalId); upgrades.superAutoClick.intervalId = null; }
  }

  btnReset.addEventListener('click', () => {
    if (!confirm('Tem certeza que quer resetar todo o progresso?')) return;
    pararAutoClicks();
    contagem = 0;
    valorClique = 1;
    Object.keys(upgrades).forEach(k => upgrades[k].ativo = false);
    localStorage.removeItem(KEY);
    btnUpgrade.textContent = `x2 Cliques (${upgrades.upgrade.preco})`;
    btnAuto.textContent = `AutoClick (+1/s) (${upgrades.autoClick.preco})`;
    btnSuper.textContent = `Super AutoClick (+10/s) (${upgrades.superAutoClick.preco})`;
    btnGold.textContent = `Clique de Ouro (${upgrades.goldClick.preco})`;
    [btnUpgrade, btnAuto, btnSuper, btnGold].forEach(b => b.disabled = true);
    mensagem.textContent = 'Progresso resetado!';
    atualizarContador();
  });

  carregarProgresso();
  if (upgrades.autoClick.ativo) iniciarAutoClick();
  if (upgrades.superAutoClick.ativo) iniciarSuperAutoClick();
  verificarUpgrades();
  atualizarContador();
})();
