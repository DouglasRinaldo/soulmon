// tests/creatures.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Os módulos já foram carregados como globals pelo setup.js

describe('xpForLevel', () => {
  it('nível 1 requer menos XP que nível 10', () => {
    expect(xpForLevel(1)).toBeLessThan(xpForLevel(10));
  });
  it('nível 1 retorna 40', () => {
    expect(xpForLevel(1)).toBe(40);
  });
  it('cresce de forma não-linear (exponencial)', () => {
    const diff1 = xpForLevel(2) - xpForLevel(1);
    const diff9 = xpForLevel(10) - xpForLevel(9);
    expect(diff9).toBeGreaterThan(diff1);
  });
});

describe('hpCol', () => {
  it('HP cheio → verde',        () => expect(hpCol(1.0)).toBe('#27ae60'));
  it('HP 51% → verde',          () => expect(hpCol(0.51)).toBe('#27ae60'));
  it('HP 50% → amarelo',        () => expect(hpCol(0.50)).toBe('#f39c12'));
  it('HP 25% → vermelho',       () => expect(hpCol(0.25)).toBe('#e74c3c'));
  it('HP 10% → vermelho escuro',() => expect(hpCol(0.10)).toBe('#8b0000'));
});

describe('mkC', () => {
  const tpl = TPLS[0]; // Ignar

  it('cria criatura com campos obrigatórios', () => {
    const c = mkC(tpl, 1);
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('name', 'Ignar');
    expect(c).toHaveProperty('el', 'fire');
    expect(c).toHaveProperty('level', 1);
    expect(c).toHaveProperty('dead', false);
    expect(c).toHaveProperty('evolved', false);
    expect(c).toHaveProperty('xp', 0);
    expect(c).toHaveProperty('learnedCards');
  });
  it('HP e maxHp são iguais ao criar', () => {
    const c = mkC(tpl, 5);
    expect(c.hp).toBe(c.maxHp);
  });
  it('criatura de nível maior tem mais HP', () => {
    expect(mkC(tpl, 10).maxHp).toBeGreaterThan(mkC(tpl, 1).maxHp);
  });
  it('criatura de nível maior tem mais ATK', () => {
    expect(mkC(tpl, 10).atk).toBeGreaterThan(mkC(tpl, 1).atk);
  });
  it('pré-popula learnedCards para criaturas criadas em nível alto', () => {
    expect(mkC(tpl, 5).learnedCards).toContain('m2');
  });
  it('IDs são únicos', () => {
    const ids = new Set(Array.from({ length: 100 }, () => mkC(tpl, 1).id));
    expect(ids.size).toBe(100);
  });
});

describe('grantXP', () => {
  beforeEach(() => { global.G = makeG(); vi.clearAllMocks(); });

  it('acumula XP sem level up se insuficiente', () => {
    const c = mkC(TPLS[0], 1);
    grantXP(c, 10);
    expect(c.xp).toBe(10);
    expect(c.level).toBe(1);
  });
  it('sobe de nível quando XP suficiente', () => {
    const c = mkC(TPLS[0], 1);
    grantXP(c, xpForLevel(1));
    expect(c.level).toBe(2);
  });
  it('pode subir múltiplos níveis de uma vez', () => {
    const c = mkC(TPLS[0], 1);
    grantXP(c, xpForLevel(1) + xpForLevel(2) + xpForLevel(3));
    expect(c.level).toBeGreaterThanOrEqual(4);
  });
  it('não concede XP para criatura morta', () => {
    const c = mkC(TPLS[0], 1);
    c.dead = true;
    grantXP(c, 999);
    expect(c.level).toBe(1);
  });
  it('level up aumenta maxHp', () => {
    const c = mkC(TPLS[0], 1);
    const oldHp = c.maxHp;
    grantXP(c, xpForLevel(1));
    expect(c.maxHp).toBeGreaterThan(oldHp);
  });
});

describe('killCreature', () => {
  beforeEach(() => {
    global.G = makeG();
    global.G.battle = { over: false, _relicReviveUsed: false };
    global.getEquippedRelic = vi.fn().mockReturnValue(null);
  });

  it('marca criatura como morta com HP 0', () => {
    const c = mkC(TPLS[0], 5);
    killCreature(c);
    expect(c.dead).toBe(true);
    expect(c.hp).toBe(0);
  });
  it('relíquia first_revive salva com 20% HP', () => {
    const c = mkC(TPLS[0], 5);
    global.getEquippedRelic = vi.fn().mockReturnValue({ effect: 'first_revive' });
    killCreature(c);
    expect(c.dead).toBe(false);
    expect(c.hp).toBeGreaterThan(0);
  });
  it('first_revive funciona só uma vez', () => {
    const c = mkC(TPLS[0], 5);
    global.getEquippedRelic = vi.fn().mockReturnValue({ effect: 'first_revive' });
    killCreature(c);
    c.hp = 0;
    killCreature(c);
    expect(c.dead).toBe(true);
  });
});

describe('getFusionElement', () => {
  it('fire + water = vapor',             () => expect(getFusionElement('fire', 'water')).toBe('vapor'));
  it('water + fire = vapor (invertido)', () => expect(getFusionElement('water', 'fire')).toBe('vapor'));
  it('combinação inválida → null',       () => expect(getFusionElement('fire', 'dark')).toBeNull());
});
