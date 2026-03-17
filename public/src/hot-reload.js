// =====================================================
// src/hot-reload.js — Soulmon Hot Reload de Conteúdo
// Fase 4 / Semanas 15-16
//
// Permite recarregar dados do jogo (criaturas, áreas,
// cards, etc.) sem precisar reiniciar o servidor ou
// fazer rebuild. Útil para balanceamento e playtesting.
//
// Uso no console do navegador:
//   HotReload.reload()           → recarrega tudo
//   HotReload.reload('creatures') → recarrega só criaturas
//   HotReload.watch(3000)        → auto-reload a cada 3s
//   HotReload.stopWatch()        → para o auto-reload
// =====================================================

const HotReload = (() => {
  let _watchInterval = null;
  let _lastHash = {};

  // ─────────────────────────────────────────────────
  // Mapa de arquivos → variáveis globais
  // ─────────────────────────────────────────────────
  const DATA_MAP = {
    creatures:  { file: './data/creatures.json',  apply: (d) => { window.TPLS = d; } },
    areas:      { file: './data/areas.json',       apply: (d) => { window.AREAS = d; } },
    cards:      { file: './data/cards.json',       apply: (d) => { window.CARDS = d.CARDS; window.CARD_POOLS = d.CARD_POOLS; } },
    evolutions: { file: './data/evolutions.json',  apply: (d) => { window.EVO_TABLE = d; } },
    items:      { file: './data/items.json',       apply: (d) => { window.VENDOR_STOCK = d.VENDOR_STOCK; window.HERO_ITEMS = d.HERO_ITEMS; window.BATTLE_ITEMS = d.BATTLE_ITEMS; } },
    weapons:    { file: './data/weapons.json',     apply: (d) => { window.WEAPONS = d; } },
  };

  // ─────────────────────────────────────────────────
  // Recarrega um ou todos os arquivos de dados
  // ─────────────────────────────────────────────────
  async function reload(key) {
    const targets = key ? { [key]: DATA_MAP[key] } : DATA_MAP;

    if (key && !DATA_MAP[key]) {
      console.warn(`[HotReload] Chave desconhecida: "${key}". Use: ${Object.keys(DATA_MAP).join(', ')}`);
      return false;
    }

    const results = await Promise.allSettled(
      Object.entries(targets).map(async ([name, cfg]) => {
        // Cache-bust para forçar fetch novo
        const res = await fetch(cfg.file + '?_=' + Date.now());
        if (!res.ok) throw new Error(`Falha ao carregar ${cfg.file}`);
        const data = await res.json();
        cfg.apply(data);
        return name;
      })
    );

    const loaded = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected');

    if (loaded.length) {
      console.log(`[HotReload] ✅ Recarregado: ${loaded.join(', ')}`);

      // Emite evento para módulos que queiram reagir
      if (window.EventBus) {
        EventBus.emit('data:reloaded', { keys: loaded });
      }

      // Atualiza a UI se o jogo estiver rodando
      _refreshUI();
    }

    if (failed.length) {
      failed.forEach(r => console.error('[HotReload] ❌', r.reason));
    }

    return failed.length === 0;
  }

  // ─────────────────────────────────────────────────
  // Atualiza UI após reload (sem reiniciar o jogo)
  // ─────────────────────────────────────────────────
  function _refreshUI() {
    try {
      // Re-renderiza telas abertas
      if (typeof renderExplore === 'function') renderExplore();
      if (typeof renderTeam === 'function') renderTeam();
      if (typeof renderHall === 'function') {
        var hallOv = document.getElementById('hall-ov');
        if (hallOv && hallOv.style.display !== 'none') renderHall();
      }
      if (typeof renderBattle === 'function' && window.G && G.battle && !G.battle.over) {
        renderBattle();
      }
    } catch (e) {
      // Silencioso — UI pode não estar pronta
    }
  }

  // ─────────────────────────────────────────────────
  // Watch — auto-reload em intervalo
  // ─────────────────────────────────────────────────
  function watch(intervalMs) {
    intervalMs = intervalMs || 3000;
    if (_watchInterval) {
      console.warn('[HotReload] Watch já está ativo. Use stopWatch() primeiro.');
      return;
    }
    console.log(`[HotReload] 👁 Watching — verificando a cada ${intervalMs}ms`);
    _watchInterval = setInterval(async () => {
      await reload();
    }, intervalMs);
  }

  function stopWatch() {
    if (_watchInterval) {
      clearInterval(_watchInterval);
      _watchInterval = null;
      console.log('[HotReload] Watch parado.');
    }
  }

  // ─────────────────────────────────────────────────
  // Info — mostra estado atual dos dados
  // ─────────────────────────────────────────────────
  function info() {
    console.group('[HotReload] Estado dos dados');
    console.log('Criaturas (TPLS):', window.TPLS ? window.TPLS.length : '—');
    console.log('Áreas:', window.AREAS ? window.AREAS.length : '—');
    console.log('Cards:', window.CARDS ? Object.keys(window.CARDS).length + ' elementos' : '—');
    console.log('Evoluções:', window.EVO_TABLE ? Object.keys(window.EVO_TABLE).length : '—');
    console.log('Armas:', window.WEAPONS ? Object.keys(window.WEAPONS).length : '—');
    console.log('Watch ativo:', _watchInterval !== null);
    console.groupEnd();
  }

  return { reload, watch, stopWatch, info, DATA_MAP };
})();

window.HotReload = HotReload;
console.log('[HotReload] Disponível — use HotReload.reload() no console para recarregar dados.');
