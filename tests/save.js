// =====================================================
// src/save.js — Soulmon Persistência e Inventário
// Fase 2 / Semana 8
//
// Contém lógica de save/load (localStorage + Supabase),
// inventário de itens, e regen de criaturas.
//
// loadGameData() toca DOM e permanece no bundle.
// Aqui ficam as partes puras: serialização,
// lista de saves, inventário.
//
// Dependências globais:
//   G, SB, SAVE_KEY_PREFIX, SAVE_LIST_KEY,
//   REGEN_MS, REGEN_TEAM, REGEN_HALL,
//   sbSaveGame (Supabase — via typeof guard)
//   notify, renderHall, renderExpC (DOM — via typeof guard)
// =====================================================

// ─────────────────────────────────────────────────
// LISTA DE SAVES — localStorage
// ─────────────────────────────────────────────────

function getSaveList() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_LIST_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function updateSaveList(pname, dataSummary) {
  var list = getSaveList();
  var idx  = list.findIndex(function (s) { return s.name === pname; });
  var entry = {
    name:  pname,
    souls: dataSummary.souls,
    alive: dataSummary.alive,
    time:  Date.now()
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  list.sort(function (a, b) { return b.time - a.time; });
  localStorage.setItem(SAVE_LIST_KEY, JSON.stringify(list));
}

function hasSave() {
  return getSaveList().length > 0;
}

// ─────────────────────────────────────────────────
// SERIALIZAÇÃO — monta o objeto de dados para salvar
// ─────────────────────────────────────────────────

function buildSaveData() {
  // Remove slots nulos antes de salvar
  G.team = G.team.filter(function (x) { return x !== null; });

  return {
    playerName:         G.playerName,
    souls:              G.souls,
    team:               G.team,
    hall:               G.hall,
    dead:               G.dead,
    items:              G.items,
    activeIdx:          G.activeIdx,
    areaWins:           G.areaWins,
    bestiary:           G.bestiary           || {},
    discoveredSpecials: G.discoveredSpecials  || {},
    relicInventory:     G.relicInventory      || [],
    equippedRelic:      G.equippedRelic       || null,
    viveiro:            G.viveiro             || [],
    quests:             G.quests              || {},
    buffs:              G.buffs               || {},
    bossDefeated:       G.bossDefeated        || [false, false, false, false, false, false],
    areaKills:          G.areaKills           || [0, 0, 0, 0, 0, 0],
    areaItems:          G.areaItems           || [0, 0, 0, 0, 0, 0],
    hero:               G.hero               || null,
    plane:              G.plane              || 0,
    planePos:           G.planePos           || {},
    planeBossDefeated:  G.planeBossDefeated  || [false, false, false]
  };
}

// ─────────────────────────────────────────────────
// SAVE — salva local + cloud (fire and forget)
// ─────────────────────────────────────────────────

function saveGame() {
  try {
    if (!G.playerName) return;

    var data  = buildSaveData();
    var alive = G.team.filter(function (c) { return !c.dead; }).length;

    // Save local
    localStorage.setItem(SAVE_KEY_PREFIX + G.playerName, JSON.stringify(data));
    updateSaveList(G.playerName, { souls: G.souls, alive: alive });

    // Cloud save (Supabase) — só se logado
    if (typeof sbSaveGame === 'function' && typeof SB !== 'undefined' && SB.token) {
      sbSaveGame(G.playerName, data).catch(function () { });
    }

    // Evento
    if (window.EventBus) {
      EventBus.emit('state:save', { playerName: G.playerName });
    }
  } catch (e) { }
}

function manualSave() {
  saveGame();
  if (typeof notify === 'function') notify('Jogo Salvo: ' + G.playerName);
}

// ─────────────────────────────────────────────────
// INVENTÁRIO — itens do jogador
// ─────────────────────────────────────────────────

function addItem(id) {
  var ex = G.items.find(function (i) { return i.id === id; });
  if (ex) ex.qty++;
  else G.items.push({ id: id, qty: 1 });
}

function removeItem(id, qty) {
  qty = qty || 1;
  var ex = G.items.find(function (i) { return i.id === id; });
  if (!ex) return false;
  ex.qty -= qty;
  if (ex.qty <= 0) G.items = G.items.filter(function (i) { return i.id !== id; });
  return true;
}

function hasItem(id) {
  var ex = G.items.find(function (i) { return i.id === id; });
  return !!(ex && ex.qty > 0);
}

function totalItems() {
  return G.items.reduce(function (s, i) { return s + i.qty; }, 0);
}

function totalUniqueItems() {
  var count = 0;
  ['fire', 'water', 'earth', 'dark', 'light'].forEach(function (el) {
    if (G.items.some(function (i) { return i.id === el && i.qty > 0; })) count++;
  });
  return count;
}

// ─────────────────────────────────────────────────
// REGEN — recuperação passiva de HP fora de batalha
// ─────────────────────────────────────────────────

function startRegen() {
  if (G.regenInt) clearInterval(G.regenInt);

  G.regenInt = setInterval(function () {
    // Hall: regen mais rápida
    G.hall.forEach(function (c) {
      if (!c.dead && c.hp < c.maxHp)
        c.hp = Math.min(c.maxHp, c.hp + Math.max(1, Math.floor(c.maxHp * REGEN_HALL)));
    });
    // Time: regen mais lenta
    G.team.forEach(function (c) {
      if (!c.dead && c.hp < c.maxHp)
        c.hp = Math.min(c.maxHp, c.hp + Math.max(1, Math.floor(c.maxHp * REGEN_TEAM)));
    });

    // Atualiza UI se aberta
    if (typeof renderHall === 'function') {
      var hallOv = document.getElementById('hall-ov');
      if (hallOv && hallOv.style.display !== 'none') renderHall();
    }
    if (typeof renderExpC === 'function') {
      var exploreEl = document.getElementById('explore');
      if (exploreEl && exploreEl.style.display !== 'none') renderExpC();
    }
  }, REGEN_MS);
}
