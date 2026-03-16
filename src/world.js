// =====================================================
// src/world.js — Soulmon Lógica de Mundo
// Fase 2 / Semana 7
//
// Contém lógica PURA do mundo:
// geração de terreno, biomas, áreas, portais,
// ecossistema, reputação, cicatrizes.
// Sem tocar DOM — só lógica de estado.
//
// Dependências globais:
//   G, OW, AREAS, PLANES, AREA_CENTERS,
//   REP_TIERS, AREA_NAMES, PREDATOR_PREY,
//   WW (world width/height)
//   notify, addLog (DOM — via typeof guard)
// =====================================================

// ─────────────────────────────────────────────────
// GERAÇÃO DE TERRENO
// ─────────────────────────────────────────────────

function owNoise(x, z, scale, seed) {
  var s = seed || 1;
  return (Math.sin(x * scale * 0.7 + s) * 0.4
    + Math.sin(z * scale * 0.5 + s * 1.3) * 0.3
    + Math.cos((x + z) * scale * 0.3 + s) * 0.2
    + Math.sin(x * scale * 1.1 - z * 0.4) * 0.1) * 0.5 + 0.5;
}

function owHeight(x, z) {
  var _ps = PLANES[G && G.plane || 0] ? PLANES[G.plane || 0].heightSeed : 3.7;
  var n1 = owNoise(x, z, 0.18, _ps);
  var n2 = owNoise(x, z, 0.42, _ps * 1.92);
  var n3 = owNoise(x, z, 0.09, _ps * 0.35);
  var h = n1 * 0.55 + n2 * 0.25 + n3 * 0.20;

  // Elevação central
  var dx = x - 80, dz = z - 65;
  var ridge = Math.max(0, 1 - Math.sqrt(dx * dx * 0.006 + dz * dz * 0.008));
  h = h + ridge * 0.55;

  // Depressão
  var dx3 = x - 75, dz3 = z - 130;
  var pit = Math.max(0, 1 - Math.sqrt(dx3 * dx3 * 0.008 + dz3 * dz3 * 0.007));
  h = h - pit * 0.25;

  // Queda nas bordas (costa irregular)
  var ex = Math.min(x, WW.W - 1 - x) / (WW.W * 0.18);
  var ez = Math.min(z, WW.H - 1 - z) / (WW.H * 0.18);
  var edgeDist = Math.min(1.0, Math.min(ex, ez));
  var coastNoise = owNoise(x, z, 0.28, _ps * 2.7) * 0.55
    + owNoise(x, z, 0.55, _ps * 5.1) * 0.30
    + owNoise(x, z, 1.1, _ps * 9.3) * 0.15;
  var edgeFalloff = Math.pow(edgeDist, 1.4) * (0.55 + coastNoise * 0.45);
  h = h * edgeFalloff + (1 - edgeFalloff) * 0.08;

  return Math.max(0.05, Math.min(1.0, h));
}

function owBiome(x, z) {
  var best = 0, bestD = 9999;
  for (var i = 0; i < AREA_CENTERS.length; i++) {
    var dx = x - AREA_CENTERS[i].x, dz = z - AREA_CENTERS[i].z;
    var d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  // Remap de biomas por plano
  var planeId = (G && G.plane) || 0;
  if (planeId === 1) {
    var _remap1 = [2, 2, 2, 5, 5, 5];
    return _remap1[best] !== undefined ? _remap1[best] : best;
  } else if (planeId === 2) {
    var _remap2 = [3, 3, 5, 3, 4, 3];
    return _remap2[best] !== undefined ? _remap2[best] : best;
  }
  return best;
}

function owEncDensity(x, z) {
  var blob  = owNoise(x, z, 0.08, 13.7);
  var patch = owNoise(x, z, 0.22, 5.3);
  return blob * 0.65 + patch * 0.35;
}

// ─────────────────────────────────────────────────
// ÁREAS — desbloqueio e progresso
// ─────────────────────────────────────────────────

function syncAreaUnlocks() {
  AREAS.forEach(function (a, i) {
    if (a.winsNeeded === 0) { a.unlocked = true; return; }
    var src = (typeof a.unlockedBy === 'number') ? a.unlockedBy : -1;
    if (src >= 0 && G.areaWins[src] >= a.winsNeeded) a.unlocked = true;
  });
}

function getAreaUnlocked(idx) {
  if (!G.areaWins) G.areaWins = [0, 0, 0, 0, 0, 0];
  return AREAS[idx] && AREAS[idx].unlocked;
}

function recordWin(aIdx) {
  if (!G.areaWins)  G.areaWins  = [0, 0, 0, 0, 0, 0];
  if (!G.areaKills) G.areaKills = [0, 0, 0, 0, 0, 0];
  if (aIdx >= 0 && aIdx < G.areaWins.length) {
    G.areaWins[aIdx]++;
    G.areaKills[aIdx]++;
    if (typeof checkRepTierUp === 'function') checkRepTierUp(aIdx);
    syncAreaUnlocks();
  }
}

// ─────────────────────────────────────────────────
// PORTAIS — verificação de acesso entre planos
// ─────────────────────────────────────────────────

function isPortalLocked(toPlane) {
  if (toPlane < 0 || toPlane >= PLANES.length) return true;
  var plane = PLANES[toPlane];
  if (!plane.unlockReq && plane.unlockReq !== 0) return false;
  var srcPlane = PLANES[toPlane - 1];
  if (!srcPlane || !srcPlane.bossIdxRequired) return false;
  var bd = G.bossDefeated || [];
  return !srcPlane.bossIdxRequired.every(function (idx) { return bd[idx]; });
}

// ─────────────────────────────────────────────────
// ECOSSISTEMA — equilíbrio predador/presa por área
// ─────────────────────────────────────────────────

function getCurrentPlayerArea() {
  if (!OW || !OW.player || !OW.grid) return -1;
  var cell = OW.grid[OW.player.x + ',' + OW.player.z];
  return cell ? (cell.aIdx || 0) : 0;
}

function ecoTick() {
  if (!G || !G._areaNeglect) return;
  var playerArea = getCurrentPlayerArea();

  for (var aIdx = 0; aIdx < 6; aIdx++) {
    if (aIdx !== playerArea) {
      G._areaNeglect[aIdx] = (G._areaNeglect[aIdx] || 0) + 1;
    } else {
      G._areaNeglect[aIdx] = 0;
    }

    var neglect = G._areaNeglect[aIdx];
    var balance = G._ecoBalance[aIdx] || 1.0;

    if (neglect >= 3 && neglect < 8) {
      G._ecoBalance[aIdx] = Math.min(2.5, balance + 0.15);
      if (neglect === 3) {
        var pp = PREDATOR_PREY[aIdx];
        if (pp && typeof addLog === 'function')
          addLog('⚠ Área ' + (aIdx + 1) + ': ' + pp.predator + ' está dominando!', 'sys');
      }
    } else if (neglect >= 8) {
      G._ecoBalance[aIdx] = Math.max(0.3, balance - 0.2);
      if (neglect === 8) {
        var pp2 = PREDATOR_PREY[aIdx];
        if (pp2 && typeof addLog === 'function')
          addLog('⚠ Área ' + (aIdx + 1) + ': ' + pp2.prey + ' se proliferou! Drops mudados.', 'sys');
      }
    }
  }

  if (typeof renderEcoHUD === 'function') renderEcoHUD();
}

function onKillUpdateEco(mob) {
  var aIdx = mob ? (mob._aIdx || 0) : getCurrentPlayerArea();
  if (!G._areaNeglect) G._areaNeglect = [0, 0, 0, 0, 0, 0];
  if (!G._ecoBalance)  G._ecoBalance  = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
  G._areaNeglect[aIdx] = 0;
  G._ecoBalance[aIdx] = (G._ecoBalance[aIdx] || 1.0) * 0.92 + 1.0 * 0.08;
}

function getEcoMobStatMult(mob) {
  var aIdx = mob ? (mob._aIdx || 0) : 0;
  var balance = (G._ecoBalance && G._ecoBalance[aIdx]) || 1.0;
  var pp = PREDATOR_PREY[aIdx];
  if (!pp || !mob) return 1.0;
  if (mob.def && mob.def.name === pp.predator) return Math.min(1.5, balance);
  if (mob.def && mob.def.name === pp.prey)     return Math.max(0.7, 2.0 - balance);
  return 1.0;
}

// ─────────────────────────────────────────────────
// TERRITÓRIO — expansão quando área é negligenciada
// ─────────────────────────────────────────────────

var _territoryWarnings = {};

function checkTerritoryExpansion() {
  if (!G || !G._areaNeglect) return;

  for (var aIdx = 0; aIdx < 6; aIdx++) {
    var neglect = G._areaNeglect[aIdx] || 0;

    if (neglect >= 5 && !_territoryWarnings[aIdx]) {
      _territoryWarnings[aIdx] = Date.now();
      var pp = PREDATOR_PREY[aIdx];
      var mobName = pp ? pp.predator : 'mobs';
      if (typeof notify === 'function')
        notify('🗺 Área ' + (aIdx + 1) + ': ' + mobName + ' expandiu território! Mobs mais fortes.');
      if (OW && OW.mobs) {
        OW.mobs.forEach(function (mob) {
          if (mob._alive && mob._aIdx === aIdx) {
            mob._aggroBoost = Math.min(3, neglect - 3);
          }
        });
      }
    }

    if (neglect === 0 && _territoryWarnings[aIdx]) {
      delete _territoryWarnings[aIdx];
      if (OW && OW.mobs) {
        OW.mobs.forEach(function (mob) {
          if (mob._alive && mob._aIdx === aIdx) mob._aggroBoost = 0;
        });
      }
    }
  }
}

// ─────────────────────────────────────────────────
// REPUTAÇÃO — progresso por área
// ─────────────────────────────────────────────────

function getRepTier(aIdx) {
  var kills = (G.areaKills && G.areaKills[aIdx]) || 0;
  var tier = REP_TIERS[0];
  for (var i = REP_TIERS.length - 1; i >= 0; i--) {
    if (kills >= REP_TIERS[i].kills) { tier = REP_TIERS[i]; break; }
  }
  return tier;
}

function getRepKills(aIdx) {
  return (G.areaKills && G.areaKills[aIdx]) || 0;
}

function getRepNextTier(aIdx) {
  var kills = getRepKills(aIdx);
  for (var i = 0; i < REP_TIERS.length; i++) {
    if (REP_TIERS[i].kills > kills) return REP_TIERS[i];
  }
  return null;
}

function checkRepTierUp(aIdx) {
  var kills = getRepKills(aIdx);
  var prev  = kills - 1;
  for (var i = 1; i < REP_TIERS.length; i++) {
    if (prev < REP_TIERS[i].kills && kills >= REP_TIERS[i].kills) {
      var t = REP_TIERS[i];
      var aName = AREA_NAMES[aIdx] || 'área';
      if (typeof notify === 'function')
        notify(t.icon + ' Reputação em <b>' + aName + '</b>: <b style="color:' + t.color + '">' + t.name + '</b>! ' + (t.bonus ? t.bonus.desc : ''));
      if (t.bonus && t.bonus.souls) {
        var bonus = Math.floor(50 * (i + 1));
        G.souls = (G.souls || 0) + bonus;
        if (typeof notify === 'function')
          notify('✦ Bônus: +' + bonus + ' almas pela nova reputação!');
      }
    }
  }
}

function getRepSoulsBonus(aIdx) {
  var tier = getRepTier(aIdx);
  return tier.bonus ? (1 + tier.bonus.souls) : 1;
}

// ─────────────────────────────────────────────────
// CICATRIZES — criaturas que sobrevivem no limite
// ─────────────────────────────────────────────────

function checkAndApplyScar(creature) {
  if (!creature || creature.dead) return;
  if (creature.hp / creature.maxHp < 0.10) {
    if (!creature._scars) creature._scars = [];
    var scarTypes = ['slash', 'burn', 'claw', 'bite', 'void'];
    var newScar = {
      type: scarTypes[Math.floor(Math.random() * scarTypes.length)],
      battle: (G._runCaptures || 0) +
              (G.areaWins ? G.areaWins.reduce(function (s, v) { return s + v; }, 0) : 0)
    };
    creature._scars.push(newScar);
    if (creature._scars.length > 3) creature._scars.shift();
    if (typeof addLog === 'function')
      addLog('⚔ ' + creature.name + ' sobreviveu ao limite — ganhou uma cicatriz de ' + newScar.type + '!', 'evt');
    if (typeof notify === 'function')
      notify('⚔ ' + creature.name + ' ganhou uma cicatriz!');
  }
}

function applyBattleScars() {
  if (!G.team) return;
  G.team.forEach(function (c) {
    if (c && !c.dead) checkAndApplyScar(c);
  });
}
