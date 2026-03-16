// =====================================================
// src/state.js — Soulmon StateManager
// Fase 1 / Semana 4: Wrapper seguro em torno do G
// global. Não substitui G — convive com ele.
// Na Fase 2, as funções passarão a usar StateManager
// diretamente em vez de mutar G diretamente.
// =====================================================

const StateManager = (() => {
  // Histórico de mudanças para debug (últimas 50)
  const _history = [];
  const MAX_HISTORY = 50;

  function _record(key, oldVal, newVal, source) {
    _history.push({ key, oldVal, newVal, source, ts: Date.now() });
    if (_history.length > MAX_HISTORY) _history.shift();
  }

  return {
    // -------------------------------------------------
    // Leitura — lê direto do G global
    // -------------------------------------------------
    get(key) {
      if (!window.G) return undefined;
      return key ? window.G[key] : window.G;
    },

    // -------------------------------------------------
    // Escrita — muta o G e registra no histórico
    // -------------------------------------------------
    set(key, value, source = 'unknown') {
      if (!window.G) {
        console.warn('[StateManager] G ainda não existe.');
        return;
      }
      const old = window.G[key];
      window.G[key] = value;
      _record(key, old, value, source);

      // Emite evento para quem quiser escutar
      if (window.EventBus) {
        EventBus.emit('state:change', { key, oldVal: old, newVal: value, source });
      }
    },

    // -------------------------------------------------
    // Merge parcial — útil para resetar sub-objetos
    // -------------------------------------------------
    merge(partial, source = 'unknown') {
      if (!window.G) return;
      Object.keys(partial).forEach(key => {
        this.set(key, partial[key], source);
      });
    },

    // -------------------------------------------------
    // Snapshot — retorna cópia profunda do estado atual
    // Útil para save/debug
    // -------------------------------------------------
    snapshot() {
      try {
        return JSON.parse(JSON.stringify(window.G));
      } catch (e) {
        console.warn('[StateManager] snapshot falhou (referências circulares?)');
        return null;
      }
    },

    // -------------------------------------------------
    // Histórico — para debug
    // -------------------------------------------------
    history() {
      return [..._history];
    },

    // -------------------------------------------------
    // Debug — imprime estado atual no console
    // -------------------------------------------------
    debug() {
      console.group('[StateManager] Estado atual do G');
      if (window.G) {
        Object.keys(window.G).forEach(k => {
          const v = window.G[k];
          const display = Array.isArray(v) ? `Array(${v.length})` :
                          typeof v === 'object' && v !== null ? `{${Object.keys(v).join(', ')}}` :
                          v;
          console.log(`  ${k}:`, display);
        });
      } else {
        console.log('  G ainda não inicializado.');
      }
      console.groupEnd();
    }
  };
})();

window.StateManager = StateManager;
