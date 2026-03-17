// tests/battle.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('eMult', () => {
  it('fire forte contra nature → 1.5',  () => expect(eMult('fire', 'nature')).toBe(1.5));
  it('fire fraco contra water → 0.65',  () => expect(eMult('fire', 'water')).toBe(0.65));
  it('fire neutro contra earth → 1.0',  () => expect(eMult('fire', 'earth')).toBe(1.0));
  it('water forte contra fire → 1.5',   () => expect(eMult('water', 'fire')).toBe(1.5));
});

describe('calcDanger', () => {
  it('inimigo muito mais fraco → dominant', () => {
    expect(calcDanger({ level: 15, el: 'fire' }, { level: 5, el: 'water' })).toBe('dominant');
  });
  it('inimigo mesmo nível → fair', () => {
    expect(calcDanger({ level: 5, el: 'fire' }, { level: 5, el: 'earth' })).toBe('fair');
  });
  it('inimigo muito mais forte → lethal', () => {
    expect(calcDanger({ level: 1, el: 'water' }, { level: 10, el: 'electric' })).toBe('lethal');
  });
  it('vantagem elemental melhora avaliação', () => {
    const en    = { level: 6, el: 'nature' };
    const order = ['dominant', 'favorable', 'fair', 'hard', 'brutal', 'lethal'];
    const dAdv  = calcDanger({ level: 5, el: 'fire' }, en);   // fire forte vs nature
    const dNeu  = calcDanger({ level: 5, el: 'earth' }, en);  // earth neutro vs nature
    expect(order.indexOf(dAdv)).toBeLessThanOrEqual(order.indexOf(dNeu));
  });
});

describe('calcDmgWithShield', () => {
  it('sem escudo → dano total', () => {
    expect(calcDmgWithShield(50, { shield: 0 }, {})).toBe(50);
  });
  it('escudo absorve dano parcialmente', () => {
    const defSt = { shield: 20 };
    expect(calcDmgWithShield(50, defSt, {})).toBe(30);
    expect(defSt.shield).toBe(0);
  });
  it('escudo absorve dano total se suficiente', () => {
    const defSt = { shield: 100 };
    expect(calcDmgWithShield(50, defSt, {})).toBe(0);
    expect(defSt.shield).toBe(50);
  });
  it('shield pierce ignora escudo', () => {
    const defSt = { shield: 100 };
    const attSt = { piercingNext: true };
    expect(calcDmgWithShield(50, defSt, attSt)).toBe(50);
    expect(defSt.shield).toBe(100);
    expect(attSt.piercingNext).toBe(false);
  });
});

describe('applyStatusDmg', () => {
  const mkSt = (overrides = {}) => ({
    poison: 0, burn: 0, blind: 0, weaken: 0,
    weakenDef: 0, antiheal: 0, reflect: 0, _magDmg: 0,
    ...overrides
  });

  it('veneno causa dano e reduz stacks', () => {
    const target = { hp: 100, maxHp: 100 };
    const st = mkSt({ poison: 3 });
    const dmg = applyStatusDmg(target, st, 'Inimigo');
    expect(dmg).toBeGreaterThan(0);
    expect(target.hp).toBeLessThan(100);
    expect(st.poison).toBe(2);
  });
  it('queimadura causa dano e reduz', () => {
    const target = { hp: 100, maxHp: 100 };
    const st = mkSt({ burn: 10 });
    applyStatusDmg(target, st, 'Inimigo');
    expect(st.burn).toBe(9);
  });
  it('HP não vai abaixo de 0', () => {
    const target = { hp: 1, maxHp: 100 };
    applyStatusDmg(target, mkSt({ poison: 9 }), 'Inimigo');
    expect(target.hp).toBeGreaterThanOrEqual(0);
  });
  it('sem status → dano zero', () => {
    const target = { hp: 100, maxHp: 100 };
    expect(applyStatusDmg(target, mkSt(), 'Inimigo')).toBe(0);
    expect(target.hp).toBe(100);
  });
  it('debuffs temporizados são decrementados', () => {
    const target = { hp: 100, maxHp: 100 };
    const st = mkSt({ blind: 2, weaken: 1 });
    applyStatusDmg(target, st, 'Inimigo');
    expect(st.blind).toBe(1);
    expect(st.weaken).toBe(0);
  });
});

describe('getWeatherMult', () => {
  beforeEach(() => {
    global.G  = makeG({ plane: 0 });
    global.OW = {};
  });

  it('elemento com boost → > 1.0 como atacante', () => {
    expect(getWeatherMult('fire', true)).toBeGreaterThan(1.0);
  });
  it('elemento com penalidade → < 1.0 como atacante', () => {
    expect(getWeatherMult('water', true)).toBeLessThan(1.0);
  });
  it('elemento neutro → 1.0', () => {
    expect(getWeatherMult('dark', true)).toBe(1.0);
  });
});
