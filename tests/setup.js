// tests/setup.js — Soulmon Test Setup
import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

// ─────────────────────────────────────────────────
// Globals do jogo
// ─────────────────────────────────────────────────
global.EL = {
  fire:     { name: 'FOGO',     strong: 'nature',   weak: 'water' },
  water:    { name: 'AGUA',     strong: 'fire',     weak: 'electric' },
  earth:    { name: 'TERRA',    strong: 'electric', weak: 'nature' },
  nature:   { name: 'FLORESTA', strong: 'earth',    weak: 'fire' },
  electric: { name: 'TROVAO',   strong: 'water',    weak: 'earth' },
  dark:     { name: 'SOMBRA',   strong: 'light',    weak: 'light' },
  light:    { name: 'LUZ',      strong: 'dark',     weak: 'dark' },
};

global.TPLS = [
  {
    name: 'Ignar', el: 'fire', atk: 14, def: 10, shape: 'quad',
    passives: [{ lvl: 5, id: 'blazing', name: 'Chamas', desc: 'Queima ao atacar' }],
    learns: [{ lvl: 3, card: 'm2', name: 'Chama Sônica' }]
  },
  { name: 'Aquilis', el: 'water', atk: 12, def: 12, shape: 'round', passives: [], learns: [] },
  {
    name: 'Torren', el: 'earth', atk: 10, def: 16, shape: 'heavy',
    passives: [{ lvl: 8, id: 'fortress', name: 'Fortaleza', desc: 'Reduz dano' }],
    learns: []
  },
];

global.EVO_TABLE     = { Ignar: { name: 'Pyralith', hpMult: 1.22, atkMult: 1.25, defMult: 1.15, passive: 'blazing', desc: 'Forma ancestral.' } };
global.EVO_LEVEL     = 10;
global.FUSION_COMBOS = { 'fire+water': 'vapor', 'fire+nature': 'ashes' };
global.WEATHER_BUFFS = [
  { boost: ['fire'], penalty: ['water'], boostMult: 1.20, penaltyMult: 0.82, icon: '☀', name: 'Seco', battleFx: '' },
  { boost: ['electric'], penalty: ['earth'], boostMult: 1.25, penaltyMult: 0.80, icon: '⚡', name: 'Tempestade', battleFx: '' },
];
global.SAVE_KEY_PREFIX = 'soulmon_save_v1_';
global.SAVE_LIST_KEY   = 'soulmon_savelist_v1';
global.REGEN_MS   = 8000;
global.REGEN_TEAM = 0.01;
global.REGEN_HALL = 0.06;

// ─────────────────────────────────────────────────
// Mocks de funções DOM
// ─────────────────────────────────────────────────
global.addLog            = vi.fn();
global.notify            = vi.fn();
global.renderBattle      = vi.fn();
global.renderHall        = vi.fn();
global.renderExpC        = vi.fn();
global.sfx               = vi.fn();
global.floatDmg          = vi.fn();
global.showLevelUpAnim   = vi.fn();
global.showLearnCardAnim = vi.fn();
global.showEvoPrompt     = vi.fn();
global.getEquippedRelic  = vi.fn().mockReturnValue(null);
global.document          = { getElementById: vi.fn().mockReturnValue(null) };

// No Node não existe window — apontamos para global
// para que window.EventBus e window.StateManager funcionem
global.window    = global;
global.EventBus  = { emit: vi.fn() };
global.SB        = { token: null, ready: false };

// ─────────────────────────────────────────────────
// localStorage mock
// ─────────────────────────────────────────────────
const _store = {};
global.localStorage = {
  getItem:    (k) => _store[k] ?? null,
  setItem:    (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
  clear:      () => { Object.keys(_store).forEach(k => delete _store[k]); },
};

// ─────────────────────────────────────────────────
// Carrega módulos usando vm.runInThisContext
// Executa no contexto do Node atual, então
// function declarations ficam no global
// ─────────────────────────────────────────────────
function loadGlobal(relativePath) {
  const code = readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
  vm.runInThisContext(code, { filename: relativePath });
}

loadGlobal('public/src/creatures.js');
loadGlobal('public/src/battle.js');
loadGlobal('public/src/save.js');

// ─────────────────────────────────────────────────
// Helper makeG
// ─────────────────────────────────────────────────
global.makeG = (overrides = {}) => ({
  playerName: 'Teste',
  souls: 0,
  team: [], hall: [], dead: [], items: [],
  battle: null, activeIdx: 0, regenInt: null,
  areaWins:  [0, 0, 0, 0, 0, 0],
  areaKills: [0, 0, 0, 0, 0, 0],
  areaItems: [0, 0, 0, 0, 0, 0],
  bestiary: {}, quests: {}, buffs: {},
  bossDefeated: [false, false, false, false, false, false],
  hero: null, plane: 0, planePos: {},
  planeBossDefeated: [false, false, false],
  ...overrides
});
