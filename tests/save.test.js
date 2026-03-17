// tests/save.test.js
import { describe, it, expect, beforeEach } from 'vitest';

describe('inventário', () => {
  beforeEach(() => { global.G = makeG(); });

  it('addItem adiciona item novo', () => {
    addItem('fire');
    expect(G.items).toHaveLength(1);
    expect(G.items[0]).toEqual({ id: 'fire', qty: 1 });
  });
  it('addItem empilha item existente', () => {
    addItem('fire'); addItem('fire');
    expect(G.items).toHaveLength(1);
    expect(G.items[0].qty).toBe(2);
  });
  it('addItem trata itens diferentes separadamente', () => {
    addItem('fire'); addItem('water');
    expect(G.items).toHaveLength(2);
  });
  it('removeItem reduz qty', () => {
    addItem('fire'); addItem('fire');
    removeItem('fire');
    expect(G.items[0].qty).toBe(1);
  });
  it('removeItem remove item quando qty chega a 0', () => {
    addItem('fire');
    removeItem('fire');
    expect(G.items).toHaveLength(0);
  });
  it('removeItem retorna false se item não existe', () => {
    expect(removeItem('dark')).toBe(false);
  });
  it('hasItem retorna true se item existe', () => {
    addItem('earth');
    expect(hasItem('earth')).toBe(true);
  });
  it('hasItem retorna false se item não existe', () => {
    expect(hasItem('earth')).toBe(false);
  });
  it('totalItems soma todas as qtys', () => {
    addItem('fire'); addItem('fire'); addItem('water');
    expect(totalItems()).toBe(3);
  });
});

describe('lista de saves', () => {
  beforeEach(() => { localStorage.clear(); });

  it('getSaveList retorna array vazio se não há saves', () => {
    expect(getSaveList()).toEqual([]);
  });
  it('updateSaveList adiciona novo save', () => {
    updateSaveList('Herói', { souls: 100, alive: 2 });
    const list = getSaveList();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Herói');
    expect(list[0].souls).toBe(100);
  });
  it('updateSaveList atualiza save existente', () => {
    updateSaveList('Herói', { souls: 100, alive: 2 });
    updateSaveList('Herói', { souls: 500, alive: 3 });
    const list = getSaveList();
    expect(list).toHaveLength(1);
    expect(list[0].souls).toBe(500);
  });
  it('hasSave retorna false sem saves', () => {
    expect(hasSave()).toBe(false);
  });
  it('hasSave retorna true com pelo menos um save', () => {
    updateSaveList('Herói', { souls: 0, alive: 1 });
    expect(hasSave()).toBe(true);
  });
  it('lista ordenada por tempo (mais recente primeiro)', () => {
    // Força timestamps diferentes mockando Date.now
    let t = 1000;
    const orig = Date.now;
    Date.now = () => t++;
    updateSaveList('Antigo',  { souls: 10, alive: 1 });
    updateSaveList('Recente', { souls: 20, alive: 2 });
    Date.now = orig;
    expect(getSaveList()[0].name).toBe('Recente');
  });
});

describe('buildSaveData', () => {
  beforeEach(() => {
    global.G = makeG({ playerName: 'Guerreiro', souls: 250,
      team: [{ id: 'abc', name: 'Ignar', dead: false }] });
  });

  it('inclui campos obrigatórios', () => {
    const data = buildSaveData();
    expect(data).toHaveProperty('playerName', 'Guerreiro');
    expect(data).toHaveProperty('souls', 250);
    expect(data).toHaveProperty('team');
    expect(data).toHaveProperty('bossDefeated');
    expect(data).toHaveProperty('areaWins');
  });
  it('remove slots nulos do time antes de salvar', () => {
    G.team = [null, { id: 'abc', name: 'Ignar', dead: false }, null];
    const data = buildSaveData();
    expect(data.team.every(c => c !== null)).toBe(true);
    expect(data.team).toHaveLength(1);
  });
});
