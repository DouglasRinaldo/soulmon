// =====================================================
// src/plugin-system.js — Soulmon Sistema de Plugins
// Fase 4 / Semanas 17-18
//
// Permite adicionar novos elementos, criaturas,
// cartas e mecânicas sem tocar nos arquivos core.
//
// Uso:
//   PluginSystem.register(plugin)
//   PluginSystem.load('./plugins/meu-elemento.json')
//   PluginSystem.list()
//   PluginSystem.unregister('nome-do-plugin')
//
// Formato de um plugin JSON:
// {
//   "name": "crystal",
//   "version": "1.0.0",
//   "description": "Elemento cristal — reflete dano",
//   "element": {
//     "id": "crystal",
//     "name": "CRISTAL",
//     "hex": "#aaddff",
//     "col": 11394815,
//     "strong": "electric",
//     "weak": "earth"
//   },
//   "creatures": [...],  ← mesmo formato de creatures.json
//   "cards": { ... },    ← mesmo formato de cards.json
//   "evolutions": { ... }
// }
// =====================================================

const PluginSystem = (() => {
  const _plugins = {};

  // ─────────────────────────────────────────────────
  // register — registra um plugin a partir de objeto JS
  // ─────────────────────────────────────────────────
  function register(plugin) {
    if (!plugin || !plugin.name) {
      console.error('[PluginSystem] Plugin inválido — precisa ter campo "name".');
      return false;
    }
    if (_plugins[plugin.name]) {
      console.warn(`[PluginSystem] Plugin "${plugin.name}" já registrado. Use unregister() primeiro.`);
      return false;
    }

    try {
      _applyPlugin(plugin);
      _plugins[plugin.name] = plugin;
      console.log(`[PluginSystem] ✅ Plugin "${plugin.name}" v${plugin.version || '?'} registrado.`);

      if (window.EventBus) {
        EventBus.emit('plugin:registered', { name: plugin.name, plugin });
      }
      return true;
    } catch (e) {
      console.error(`[PluginSystem] Erro ao registrar "${plugin.name}":`, e);
      return false;
    }
  }

  // ─────────────────────────────────────────────────
  // load — carrega plugin de arquivo JSON externo
  // ─────────────────────────────────────────────────
  async function load(url) {
    try {
      const res = await fetch(url + '?_=' + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const plugin = await res.json();
      return register(plugin);
    } catch (e) {
      console.error(`[PluginSystem] Erro ao carregar plugin de "${url}":`, e);
      return false;
    }
  }

  // ─────────────────────────────────────────────────
  // _applyPlugin — aplica as mudanças do plugin
  // ─────────────────────────────────────────────────
  function _applyPlugin(plugin) {
    // 1. Novo elemento
    if (plugin.element) {
      var el = plugin.element;
      if (!window.EL[el.id]) {
        window.EL[el.id] = {
          name:   el.name,
          col:    el.col || 0xffffff,
          hex:    el.hex || '#ffffff',
          strong: el.strong || null,
          weak:   el.weak   || null,
        };
        console.log(`[PluginSystem] Elemento "${el.id}" adicionado ao EL.`);
      }
    }

    // 2. Novas criaturas
    if (plugin.creatures && Array.isArray(plugin.creatures)) {
      plugin.creatures.forEach(function(tpl) {
        // Não duplica se já existe
        if (!window.TPLS.find(function(t) { return t.name === tpl.name; })) {
          window.TPLS.push(tpl);
          console.log(`[PluginSystem] Criatura "${tpl.name}" adicionada.`);
        }
      });
    }

    // 3. Novas cartas
    if (plugin.cards) {
      Object.keys(plugin.cards).forEach(function(elKey) {
        if (!window.CARDS[elKey]) {
          window.CARDS[elKey] = plugin.cards[elKey];
          console.log(`[PluginSystem] Cards para elemento "${elKey}" adicionados.`);
        }
      });
    }

    // 4. Novas evoluções
    if (plugin.evolutions) {
      Object.keys(plugin.evolutions).forEach(function(creatureName) {
        if (!window.EVO_TABLE[creatureName]) {
          window.EVO_TABLE[creatureName] = plugin.evolutions[creatureName];
          console.log(`[PluginSystem] Evolução para "${creatureName}" adicionada.`);
        }
      });
    }

    // 5. Novos pools de cartas
    if (plugin.cardPools) {
      Object.keys(plugin.cardPools).forEach(function(elKey) {
        if (!window.CARD_POOLS[elKey]) {
          window.CARD_POOLS[elKey] = plugin.cardPools[elKey];
        }
      });
    }

    // 6. Hook customizado — para mecânicas especiais
    if (typeof plugin.onRegister === 'function') {
      plugin.onRegister({ EL: window.EL, TPLS: window.TPLS, CARDS: window.CARDS, G: window.G });
    }
  }

  // ─────────────────────────────────────────────────
  // unregister — remove um plugin (best-effort)
  // Criaturas adicionadas permanecem na sessão atual
  // ─────────────────────────────────────────────────
  function unregister(name) {
    if (!_plugins[name]) {
      console.warn(`[PluginSystem] Plugin "${name}" não encontrado.`);
      return false;
    }

    var plugin = _plugins[name];

    // Remove elemento
    if (plugin.element && window.EL[plugin.element.id]) {
      delete window.EL[plugin.element.id];
    }

    // Remove criaturas
    if (plugin.creatures) {
      var names = plugin.creatures.map(function(c) { return c.name; });
      window.TPLS = window.TPLS.filter(function(t) { return !names.includes(t.name); });
    }

    // Remove cards
    if (plugin.cards) {
      Object.keys(plugin.cards).forEach(function(k) { delete window.CARDS[k]; });
    }

    // Remove evoluções
    if (plugin.evolutions) {
      Object.keys(plugin.evolutions).forEach(function(k) { delete window.EVO_TABLE[k]; });
    }

    delete _plugins[name];
    console.log(`[PluginSystem] Plugin "${name}" removido.`);

    if (window.EventBus) {
      EventBus.emit('plugin:unregistered', { name });
    }
    return true;
  }

  // ─────────────────────────────────────────────────
  // list — lista plugins registrados
  // ─────────────────────────────────────────────────
  function list() {
    var names = Object.keys(_plugins);
    if (!names.length) {
      console.log('[PluginSystem] Nenhum plugin registrado.');
      return [];
    }
    console.group('[PluginSystem] Plugins registrados');
    names.forEach(function(n) {
      var p = _plugins[n];
      console.log(`  ${n} v${p.version || '?'} — ${p.description || 'sem descrição'}`);
    });
    console.groupEnd();
    return names;
  }

  return { register, load, unregister, list };
})();

window.PluginSystem = PluginSystem;
console.log('[PluginSystem] Disponível — use PluginSystem.load("./plugins/meu-plugin.json") para carregar plugins.');
