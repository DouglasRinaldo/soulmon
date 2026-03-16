// =====================================================
// src/events.js — Soulmon EventBus
// Fase 1 / Semana 4: Sistema de eventos pub/sub leve.
// Permite que módulos se comuniquem sem referências
// diretas entre si.
//
// Uso:
//   EventBus.on('battle:start', (data) => { ... });
//   EventBus.emit('battle:start', { enemy: ... });
//   EventBus.off('battle:start', handler);
// =====================================================

const EventBus = (() => {
  const _listeners = {};

  return {
    // -------------------------------------------------
    // Registrar listener
    // -------------------------------------------------
    on(event, handler) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(handler);
      return handler; // retorna para poder remover depois
    },

    // -------------------------------------------------
    // Registrar listener que dispara só uma vez
    // -------------------------------------------------
    once(event, handler) {
      const wrapper = (data) => {
        handler(data);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    },

    // -------------------------------------------------
    // Remover listener
    // -------------------------------------------------
    off(event, handler) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(h => h !== handler);
    },

    // -------------------------------------------------
    // Emitir evento
    // -------------------------------------------------
    emit(event, data) {
      if (!_listeners[event]) return;
      _listeners[event].forEach(h => {
        try {
          h(data);
        } catch (e) {
          console.error(`[EventBus] Erro no handler de "${event}":`, e);
        }
      });
    },

    // -------------------------------------------------
    // Listar eventos registrados (debug)
    // -------------------------------------------------
    debug() {
      console.group('[EventBus] Eventos registrados');
      Object.keys(_listeners).forEach(ev => {
        console.log(`  ${ev}: ${_listeners[ev].length} listener(s)`);
      });
      console.groupEnd();
    },

    // -------------------------------------------------
    // Remover todos os listeners de um evento
    // -------------------------------------------------
    clear(event) {
      if (event) {
        delete _listeners[event];
      } else {
        Object.keys(_listeners).forEach(k => delete _listeners[k]);
      }
    }
  };
})();

window.EventBus = EventBus;

// -------------------------------------------------
// Eventos padrão do Soulmon — documentação
// (serão emitidos pelos módulos na Fase 2)
// -------------------------------------------------
//
// BATALHA
//   'battle:start'       { enemy, area }
//   'battle:end'         { result: 'win'|'lose'|'flee', enemy }
//   'battle:turn'        { attacker, defender, damage, card }
//   'battle:capture'     { creature }
//
// CRIATURAS
//   'creature:levelup'   { creature, newLevel }
//   'creature:evolve'    { creature, newForm }
//   'creature:dead'      { creature }
//
// MUNDO
//   'world:areaChange'   { areaIdx }
//   'world:bossDefeated' { areaIdx, boss }
//
// HERÓI
//   'hero:levelup'       { hero, newLevel }
//   'hero:itemUsed'      { item }
//
// ESTADO
//   'state:change'       { key, oldVal, newVal, source }
//   'state:save'         { slot }
//   'state:load'         { slot }
