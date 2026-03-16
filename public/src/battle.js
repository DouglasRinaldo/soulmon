// =====================================================
// src/battle.js — Soulmon Lógica Pura de Batalha
// Fase 2 / Semana 6
//
// Contém APENAS lógica de cálculo — sem tocar DOM.
// Funções que dependem de DOM (floatDmg, renderPassivePips,
// getWeatherDesc) permanecem no bundle por enquanto.
//
// Dependências globais usadas aqui:
//   G, EL, TPLS, WEATHER_BUFFS, HYBRID_PASSIVES, OW
//   addLog (DOM — chamada via typeof guard)
//   floatDmg (DOM — chamada via typeof guard)
// =====================================================

// ─────────────────────────────────────────────────
// eMult — multiplicador de vantagem elemental
// ─────────────────────────────────────────────────
function eMult(a, b) {
  if (EL[a].strong === b) return 1.5;
  if (EL[a].weak   === b) return 0.65;
  return 1.0;
}

// ─────────────────────────────────────────────────
// calcDanger — avalia risco da batalha atual
// Retorna: 'dominant' | 'favorable' | 'fair' |
//          'hard' | 'brutal' | 'lethal'
// ─────────────────────────────────────────────────
function calcDanger(my, en) {
  var d = en.level - my.level;
  var elAdv = 0;
  if (EL[my.el] && EL[my.el].strong === en.el) elAdv = +1;
  if (EL[my.el] && EL[my.el].weak   === en.el) elAdv = -1;

  var score = d - elAdv;
  if (score <= -4) return 'dominant';
  if (score <= -2) return 'favorable';
  if (score <=  1) return 'fair';
  if (score <=  3) return 'hard';
  if (score <=  5) return 'brutal';
  return 'lethal';
}

// ─────────────────────────────────────────────────
// getWeatherMult — multiplicador de clima por elemento
// ─────────────────────────────────────────────────
function getWeatherMult(el, isAttacker) {
  // Bônus noturno: criaturas dark +20% ATK / light -10%
  if (typeof OW !== 'undefined' && OW._nightBuff) {
    if (isAttacker && el === 'dark')  return 1.20;
    if (isAttacker && el === 'light') return 0.90;
  }
  // Evento de clima ao vivo sobrescreve clima estático do plano
  if (typeof OW !== 'undefined' && OW._liveWeatherBoosts) {
    var lb = OW._liveWeatherBoosts  || {};
    var lp = OW._liveWeatherPenalty || {};
    if (lb[el] !== undefined) return isAttacker ? lb[el] : 1.0;
    if (lp[el] !== undefined) return isAttacker ? lp[el] : 1.0;
  }
  var plane = (G && G.plane) || 0;
  var wb = WEATHER_BUFFS[plane];
  if (!wb) return 1.0;
  var bm = wb.boostMult   || 1.20;
  var pm = wb.penaltyMult || 0.82;
  if (wb.boost.indexOf(el)   >= 0) return isAttacker ? bm : (2 - bm);
  if (wb.penalty.indexOf(el) >= 0) return isAttacker ? pm : (2 - pm);
  return 1.0;
}

// ─────────────────────────────────────────────────
// applyStatusDmg — aplica dano de status no início
//                  do turno (veneno, queimadura, etc.)
// ─────────────────────────────────────────────────
function applyStatusDmg(target, st, targetName) {
  var dmg = 0;

  if (st.poison > 0) {
    var pdmg = st.poison * 2;
    target.hp = Math.max(0, target.hp - pdmg);
    if (typeof addLog === 'function')
      addLog(targetName + ' sofreu ' + pdmg + ' de veneno! (' + st.poison + ' stacks)', 'poison-log');
    st.poison--;
    dmg += pdmg;
  }

  if (st.burn > 0) {
    var burnDmg = st.burnHeavy ? Math.floor(st.burn * 1.5) : st.burn;
    target.hp = Math.max(0, target.hp - burnDmg);
    if (typeof addLog === 'function')
      addLog(targetName + ' queimou por ' + burnDmg + ' de dano!', 'burn-log');
    st.burn = Math.max(0, st.burn - 1);
    if (st.burn === 0) st.burnHeavy = false;
    dmg += burnDmg;
  }

  // Tick debuffs temporizados
  if (st.blind     > 0) { st.blind--;     if (st.blind     === 0 && typeof addLog === 'function') addLog(targetName + ' recuperou a visão.', 'evt'); }
  if (st.weaken    > 0) { st.weaken--;    if (st.weaken    === 0 && typeof addLog === 'function') addLog(targetName + ' recuperou o ATK.', 'evt'); }
  if (st.weakenDef > 0) { st.weakenDef--; if (st.weakenDef === 0 && typeof addLog === 'function') addLog(targetName + ' DEF restaurada.', 'evt'); }
  if (st.antiheal  > 0) { st.antiheal--; }
  if (st.reflect   > 0) { st.reflect--;   if (st.reflect   === 0 && typeof addLog === 'function') addLog(targetName + ' Espinhos antigos cessaram.', 'evt'); }

  // Dano magnético acumulado
  if (st._magDmg > 0) {
    target.hp = Math.max(0, target.hp - st._magDmg);
    dmg += st._magDmg;
    st._magDmg = 0;
  }

  return dmg;
}

// ─────────────────────────────────────────────────
// applyCardStatus — aplica efeito de status de carta
// Retorna true se o efeito é de cura/escudo (não
// causa dano)
// ─────────────────────────────────────────────────
function applyCardStatus(cardDef, attacker, defender, defSt, attSt) {
  if (!cardDef.status) return false;

  switch (cardDef.status) {
    case 'poison':
      defSt.poison = Math.min(defSt.poison + 3, 9);
      if (typeof addLog === 'function')
        addLog(defender.name + ' foi envenenado! (' + defSt.poison + ' stacks)', 'poison-log');
      break;

    case 'burn':
      var bval = Math.max(3, Math.floor(attacker.atk * 0.15));
      defSt.burn = Math.min(defSt.burn + bval, 30);
      if (typeof addLog === 'function')
        addLog(defender.name + ' esta em chamas! (' + defSt.burn + ' de burn)', 'burn-log');
      break;

    case 'shield':
      var sval = Math.max(4, Math.floor(attacker.def * 1.2));
      attSt.shield += sval;
      if (typeof addLog === 'function')
        addLog(attacker.name + ' criou um escudo de ' + attSt.shield + ' HP!', 'shield-log');
      return true;

    case 'paralyze':
      defSt.paralyze = 2;
      if (typeof addLog === 'function')
        addLog(defender.name + ' foi paralisado por 2 turnos!', 'para-log');
      break;

    // ── HÍBRIDOS ──
    case 'burn_heavy':
      var bhval = Math.max(4, Math.floor(attacker.atk * 0.22));
      defSt.burn = Math.min(defSt.burn + bhval, 40);
      defSt.burnHeavy = true;
      if (typeof addLog === 'function')
        addLog(defender.name + ' está consumido pelas brasas! (' + defSt.burn + ' burn)', 'burn-log');
      break;

    case 'antiheal':
      defSt.antiheal = 3;
      if (typeof addLog === 'function')
        addLog(defender.name + ' está no campo de cinzas — cura reduzida!', 'burn-log');
      break;

    case 'blind':
      defSt.blind = 2;
      if (typeof addLog === 'function')
        addLog(defender.name + ' está cego! (-30% precisão por 2t)', 'para-log');
      break;

    case 'weaken':
      defSt.weaken = 2;
      if (typeof addLog === 'function')
        addLog(defender.name + ' está enfraquecido! (-35% ATK por 2t)', 'para-log');
      break;

    case 'weaken_def':
      defSt.weakenDef = 2;
      if (typeof addLog === 'function')
        addLog(defender.name + ' DEF reduzida em 40% por 2t!', 'para-log');
      break;

    case 'def_to_dmg':
      var d2d = Math.floor(defender.def * 0.6);
      if (typeof addLog === 'function')
        addLog(defender.name + ' campo magnético colapsou! DEF virou ' + d2d + ' de dano extra!', 'burn-log');
      defSt._magDmg = (defSt._magDmg || 0) + d2d;
      break;

    case 'steal_buff':
      var stolenBuff = null;
      if (defSt.shield > 0) {
        attSt.shield += defSt.shield;
        stolenBuff = 'Escudo';
        defSt.shield = 0;
      } else if (defSt.poison <= 0 && defSt.weaken <= 0) {
        attSt.shield += Math.floor(attacker.def * 0.5);
        stolenBuff = 'Vitalidade';
      }
      if (stolenBuff && typeof addLog === 'function')
        addLog(attacker.name + ' roubou ' + stolenBuff + ' do inimigo!', 'drain-log');
      break;

    case 'purge':
      defSt.shield = 0; defSt.weaken = 0; defSt.weakenDef = 0;
      if (typeof addLog === 'function')
        addLog(defender.name + ' teve todos os buffs anulados pelo Eclipse!', 'burn-log');
      break;

    case 'reflect':
      attSt.reflect = 3;
      if (typeof addLog === 'function')
        addLog(attacker.name + ' ativou Espinhos Antigos — reflete 40% do dano por 3t!', 'shield-log');
      return true;

    case 'heal_shield':
      var hsHeal = Math.max(1, Math.floor(attacker.maxHp * 0.25));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + hsHeal);
      var hsShield = Math.max(4, Math.floor(attacker.def * 1.5));
      attSt.shield += hsShield;
      if (typeof addLog === 'function')
        addLog(attacker.name + ' Abraço da Floresta: curou ' + hsHeal + ' HP + escudo ' + hsShield + '!', 'drain-log');
      return true;

    case 'shield_pierce':
      attSt.piercingNext = true;
      if (typeof addLog === 'function')
        addLog(attacker.name + ' [Lança do Vazio] próximo golpe perfura escudos!', 'evt');
      break;

    case 'multi_dot':
      defSt.paralyze = 1;
      defSt.poison = Math.min(defSt.poison + 3, 9);
      if (typeof addLog === 'function')
        addLog(defender.name + ' paralisado E envenenado pela Corrente Negra!', 'para-log');
      break;

    case 'true_dmg':
      if (typeof addLog === 'function')
        addLog(attacker.name + ' [Pulsar] dano verdadeiro ativado!', 'burn-log');
      break;

    case 'cleanse_heal':
      var cHeal = Math.max(1, Math.floor(attacker.maxHp * 0.30));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + cHeal);
      var aSt = attacker === ac() ? G.battle.mySt : G.battle.enSt;
      if (aSt.poison > 0)        { aSt.poison = 0;   if (typeof addLog === 'function') addLog(attacker.name + ' curou veneno!', 'drain-log'); }
      else if (aSt.burn > 0)     { aSt.burn = 0;     if (typeof addLog === 'function') addLog(attacker.name + ' apagou queimadura!', 'drain-log'); }
      else if (aSt.paralyze > 0) { aSt.paralyze = 0; if (typeof addLog === 'function') addLog(attacker.name + ' curou paralisia!', 'drain-log'); }
      if (typeof addLog === 'function')
        addLog(attacker.name + ' Aurora curou ' + cHeal + ' HP!', 'drain-log');
      return true;
  }

  return false;
}

// ─────────────────────────────────────────────────
// calcDmgWithShield — aplica absorção de escudo
// ─────────────────────────────────────────────────
function calcDmgWithShield(rawDmg, defenderSt, attackerSt) {
  if (attackerSt && attackerSt.piercingNext) {
    attackerSt.piercingNext = false;
    if (typeof addLog === 'function') addLog('[Perfuração] ignorou o escudo!', 'evt');
    return rawDmg;
  }
  if (defenderSt.shield > 0) {
    if (defenderSt.shield >= rawDmg) {
      defenderSt.shield -= rawDmg;
      return 0;
    } else {
      var rem = rawDmg - defenderSt.shield;
      defenderSt.shield = 0;
      if (typeof addLog === 'function') addLog('Escudo absorveu parte do dano!', 'shield-log');
      return rem;
    }
  }
  return rawDmg;
}

// ─────────────────────────────────────────────────
// PASSIVAS
// ─────────────────────────────────────────────────

function getActivePassives(creature) {
  var result = [];
  // 1. Passivas do template (base/evoluída)
  var tpl = TPLS.find(function (t) {
    return t.name === creature.name || t.name === creature.tplName;
  });
  if (tpl && tpl.passives) {
    tpl.passives
      .filter(function (p) { return creature.level >= p.lvl; })
      .forEach(function (p) { result.push(p); });
  }
  // 2. Passivas herdadas de fusão (_passives)
  if (creature._passives && creature._passives.length) {
    creature._passives.forEach(function (p) {
      if (!result.some(function (r) { return r.id === p.id; })) result.push(p);
    });
  }
  // 3. Passivas de elemento híbrido (HYBRID_PASSIVES)
  if (EL[creature.el] && EL[creature.el].hybrid &&
      typeof HYBRID_PASSIVES !== 'undefined') {
    var hp = HYBRID_PASSIVES[creature.el];
    if (hp) {
      hp.filter(function (p) { return creature.level >= p.lvl; })
        .forEach(function (p) {
          if (!result.some(function (r) { return r.id === p.id; })) result.push(p);
        });
    }
  }
  return result;
}

function hasPassive(creature, id) {
  return getActivePassives(creature).some(function (p) { return p.id === id; });
}

function applyPassivesOnDamageDealt(attacker, target, dmg) {
  // lifesteal: cura 15% do dano causado
  if (hasPassive(attacker, 'lifesteal')) {
    var heal = Math.max(1, Math.floor(dmg * 0.15));
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    if (typeof floatDmg === 'function') floatDmg('my', heal, true);
    if (typeof addLog === 'function')
      addLog(attacker.name + ' [Passiva] drenou ' + heal + ' HP!', 'drain-log');
  }
  // aurora_mend: cura 8% do dano como HP
  if (hasPassive(attacker, 'aurora_mend')) {
    var aHeal = Math.max(1, Math.floor(dmg * 0.08));
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + aHeal);
    if (typeof floatDmg === 'function')
      floatDmg(attacker === ac() ? 'my' : 'en', aHeal, true);
  }
  // vapor_blind: 15% chance de cegar
  if (hasPassive(attacker, 'vapor_blind') && Math.random() < 0.15) {
    if (target === G.battle.enemy) {
      G.battle.enSt.blind = (G.battle.enSt.blind || 0) + 1;
    } else {
      G.battle.mySt.blind = (G.battle.mySt.blind || 0) + 1;
    }
    if (typeof addLog === 'function')
      addLog(attacker.name + ' [Névoa] cegou o inimigo!', 'evt');
  }
  return dmg;
}

function applyPassivesOnDamageReceived(defender, dmg) {
  // thorns: reflete 20% de volta
  if (hasPassive(defender, 'thorns')) {
    var reflect = Math.max(1, Math.floor(dmg * 0.20));
    if (typeof addLog === 'function')
      addLog(defender.name + ' [Passiva] refletiu ' + reflect + ' de dano!', 'evt');
    return reflect;
  }
  // ancient_ward: limita dano a 25% do maxHp por hit
  if (hasPassive(defender, 'ancient_ward')) {
    var cap = Math.floor(defender.maxHp * 0.25);
    if (dmg > cap && typeof addLog === 'function')
      addLog(defender.name + ' [Guardião] absorbeu dano excessivo!', 'evt');
  }
  return 0;
}

function capDamageForAncientWard(defender, dmg) {
  if (hasPassive(defender, 'ancient_ward')) {
    return Math.min(dmg, Math.floor(defender.maxHp * 0.25));
  }
  return dmg;
}

function applyPassivesEndOfTurn(creature) {
  // regen_turn: recupera 5% maxHp
  if (hasPassive(creature, 'regen_turn')) {
    var regen = Math.max(1, Math.floor(creature.maxHp * 0.05));
    creature.hp = Math.min(creature.maxHp, creature.hp + regen);
    if (typeof addLog === 'function')
      addLog(creature.name + ' [Passiva] regenerou ' + regen + ' HP!', 'drain-log');
  }
  // ancient_roots: regenera 8% HP
  if (hasPassive(creature, 'ancient_roots')) {
    var regen2 = Math.max(1, Math.floor(creature.maxHp * 0.08));
    creature.hp = Math.min(creature.maxHp, creature.hp + regen2);
    if (typeof addLog === 'function')
      addLog(creature.name + ' [Raízes] regenerou ' + regen2 + ' HP!', 'drain-log');
  }
  // storm_surge: acumula bônus de ATK a cada turno sem levar dano
  if (hasPassive(creature, 'storm_surge')) {
    if (!creature._surgeStacks) creature._surgeStacks = 0;
    if (creature._lastHpEot === creature.hp && creature._surgeStacks < 3) {
      creature._surgeStacks++;
      if (typeof addLog === 'function')
        addLog(creature.name + ' [Maré Crescente] ATK +8%! (' + creature._surgeStacks + '/3)', 'evt');
    }
    creature._lastHpEot = creature.hp;
  }
  // shield_turn: ganha escudo = DEF * 0.4
  if (hasPassive(creature, 'shield_turn')) {
    var shield = Math.max(1, Math.floor(creature.def * 0.4));
    if (creature === ac()) {
      G.battle.mySt.shield = (G.battle.mySt.shield || 0) + shield;
      if (typeof addLog === 'function')
        addLog(creature.name + ' [Passiva] ganhou escudo +' + shield + '!', 'evt');
    } else {
      G.battle.enSt.shield = (G.battle.enSt.shield || 0) + shield;
    }
  }
}

function getPassiveCritBonus(creature) {
  return hasPassive(creature, 'crit_boost') ? 0.20 : 0;
}

function getPassiveElResist(creature, attackerEl) {
  if (hasPassive(creature, 'el_resist') && attackerEl === 'fire') return 0.75;
  return 1.0;
}
