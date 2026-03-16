// =====================================================
// src/creatures.js — Soulmon Módulo de Criaturas
// Fase 2 / Semana 5
//
// Contém a lógica PURA de criaturas:
// criação, XP, level up, evolução, captura.
// Não depende de DOM — só de G, TPLS, EVO_TABLE.
//
// As funções aqui SUBSTITUEM as do bundle (index.html).
// Após adicionar este arquivo, comente as versões
// originais no index.html (instruções no final).
// =====================================================

// ─────────────────────────────────────────────────
// Constantes de progressão
// ─────────────────────────────────────────────────
var EVO_LEVEL = 10; // nível mínimo para evoluir

// ─────────────────────────────────────────────────
// xpForLevel — XP necessário para o próximo nível
// ─────────────────────────────────────────────────
function xpForLevel(lvl) {
  return Math.floor(40 * Math.pow(lvl, 1.4));
}

// ─────────────────────────────────────────────────
// hpCol — cor da barra de HP por percentual
// ─────────────────────────────────────────────────
function hpCol(p) {
  if (p > 0.5)  return '#27ae60';
  if (p > 0.25) return '#f39c12';
  if (p > 0.1)  return '#e74c3c';
  return '#8b0000';
}

// ─────────────────────────────────────────────────
// ac — criatura ativa do jogador
// ─────────────────────────────────────────────────
function ac() {
  return G.team[G.activeIdx];
}

// ─────────────────────────────────────────────────
// mkC — cria uma instância de criatura a partir
//       de um template e nível
// ─────────────────────────────────────────────────
function mkC(tpl, lvl) {
  var sc = 1 + (lvl - 1) * 0.15;
  var mhp = Math.floor((20 + lvl * 8) * (1 + (tpl.def - 10) * 0.03));

  // Pré-popula cartas aprendidas para criaturas criadas em níveis altos
  var learned = [];
  if (tpl.learns) {
    tpl.learns.forEach(function (l) {
      if (lvl >= l.lvl) learned.push(l.card);
    });
  }

  return {
    id:          Math.random().toString(36).slice(2, 9),
    name:        tpl.name,
    tplName:     tpl.name,
    el:          tpl.el,
    level:       lvl,
    shape:       tpl.shape,
    body:        tpl.body || null,
    maxHp:       mhp,
    hp:          mhp,
    atk:         Math.floor(tpl.atk * sc),
    def:         Math.floor(tpl.def * sc),
    dead:        false,
    evolved:     false,
    xp:          0,
    xpNext:      xpForLevel(lvl),
    ultCD:       0,
    learnedCards: learned
  };
}

// ─────────────────────────────────────────────────
// mkEnemy — cria um inimigo aleatório para uma área
// ─────────────────────────────────────────────────
function mkEnemy(area) {
  var lvl = area.minL + Math.floor(Math.random() * (area.maxL - area.minL + 1));
  var el  = area.elems[Math.floor(Math.random() * area.elems.length)];
  var pool = TPLS.filter(function (t) { return t.el === el; });
  return mkC(pool[Math.floor(Math.random() * pool.length)], lvl);
}

// ─────────────────────────────────────────────────
// checkLearnedCards — verifica novas cartas no level up
// ─────────────────────────────────────────────────
function checkLearnedCards(creature, tpl) {
  if (!tpl || !tpl.learns) return;
  if (!creature.learnedCards) creature.learnedCards = [];

  tpl.learns.forEach(function (learn) {
    if (creature.level >= learn.lvl &&
        creature.learnedCards.indexOf(learn.card) < 0) {
      creature.learnedCards.push(learn.card);

      // Log e animação (funções de UI que ainda vivem no bundle)
      var msg = '✦ ' + (creature.tplName || creature.name) +
                ' aprendeu ' + learn.name + '!';
      if (typeof addLog === 'function') addLog(msg, 'evt');
      if (typeof showLearnCardAnim === 'function') showLearnCardAnim(creature, learn);

      // Emite evento para quem quiser escutar
      if (window.EventBus) {
        EventBus.emit('creature:learnCard', { creature, learn });
      }
    }
  });
}

// ─────────────────────────────────────────────────
// levelUp — sobe um nível e recalcula stats
// ─────────────────────────────────────────────────
function levelUp(creature) {
  var oldAtk = creature.atk;
  var oldDef = creature.def;
  var oldHp  = creature.maxHp;

  creature.level++;

  var tpl = TPLS.find(function (t) {
    return t.name === (creature.tplName || creature.name);
  }) || TPLS[0];

  var sc = 1 + (creature.level - 1) * 0.15;
  creature.atk = Math.floor(tpl.atk * sc);
  creature.def = Math.floor(tpl.def * sc);

  var newMhp = Math.floor((20 + creature.level * 8) * (1 + (tpl.def - 10) * 0.03));
  var hpGain = newMhp - oldHp;
  creature.maxHp = newMhp;
  creature.hp    = Math.min(creature.maxHp, creature.hp + hpGain);
  creature.xpNext = xpForLevel(creature.level);

  // SFX e animação (funções de UI que ainda vivem no bundle)
  if (typeof sfx === 'function') sfx('level_up');
  if (typeof showLevelUpAnim === 'function') {
    showLevelUpAnim(creature, {
      atk: creature.atk - oldAtk,
      def: creature.def - oldDef,
      hp:  hpGain
    });
  }

  checkLearnedCards(creature, tpl);

  // Evento
  if (window.EventBus) {
    EventBus.emit('creature:levelup', { creature, newLevel: creature.level });
  }
}

// ─────────────────────────────────────────────────
// grantXP — concede XP e processa level ups
// ─────────────────────────────────────────────────
function grantXP(creature, amount) {
  if (creature.dead) return false;

  creature.xp += amount;
  var leveled = false;

  while (creature.xp >= creature.xpNext) {
    creature.xp -= creature.xpNext;
    levelUp(creature);
    leveled = true;
  }

  if (leveled) {
    // Verifica evolução após a batalha (com delay para UI)
    setTimeout(function () {
      try { checkEvolution(creature); } catch (e) { }
    }, 1200);
  }

  return leveled;
}

// ─────────────────────────────────────────────────
// checkEvolution — verifica se criatura pode evoluir
// ─────────────────────────────────────────────────
function checkEvolution(creature) {
  if (!creature || creature.dead) return;
  if (creature.evolved) return;
  if (!EVO_TABLE || !EVO_TABLE[creature.tplName]) return;
  if (creature.level < EVO_LEVEL) return;
  if (creature._evoPending) return;

  creature._evoPending = true;

  // showEvoPrompt ainda vive no bundle (UI)
  if (typeof showEvoPrompt === 'function') showEvoPrompt(creature);

  if (window.EventBus) {
    EventBus.emit('creature:evoReady', { creature });
  }
}

// ─────────────────────────────────────────────────
// killCreature — marca criatura como morta
// ─────────────────────────────────────────────────
function killCreature(c) {
  // Relíquia first_revive: uma vez por batalha, sobrevive com 20% HP
  var _revRelic = typeof getEquippedRelic === 'function'
    ? getEquippedRelic()
    : null;

  if (_revRelic && _revRelic.effect === 'first_revive' &&
      G.battle && !G.battle._relicReviveUsed) {
    G.battle._relicReviveUsed = true;
    c.hp = Math.max(1, Math.floor(c.maxHp * 0.20));
    if (typeof addLog === 'function') {
      addLog(c.name + ' [◈ Pedra do Vazio] ressurgiu com ' + c.hp + ' HP!', 'evt');
    }
    if (typeof renderBattle === 'function') renderBattle();
    return;
  }

  c.hp   = 0;
  c.dead = true;

  if (typeof addLog === 'function') {
    addLog(c.name + ' morreu permanentemente...', 'evt');
  }
  if (typeof renderBattle === 'function') renderBattle();

  if (window.EventBus) {
    EventBus.emit('creature:dead', { creature: c });
  }
}

// ─────────────────────────────────────────────────
// getFusionElement — retorna elemento de fusão
// ─────────────────────────────────────────────────
function getFusionElement(elA, elB) {
  var key = [elA, elB].sort().join('+');
  return (typeof FUSION_COMBOS !== 'undefined' && FUSION_COMBOS[key]) || null;
}
