// =====================================================
// data-loader.js — Soulmon Fase 1
// Carrega todos os dados do jogo de arquivos JSON
// externos e disponibiliza como variáveis globais,
// mantendo compatibilidade total com o código atual.
// =====================================================

async function loadGameData() {
  try {
    const [creaturesRes, areasRes, cardsRes, evolutionsRes, itemsRes, weaponsRes] = await Promise.all([
      fetch('./data/creatures.json'),
      fetch('./data/areas.json'),
      fetch('./data/cards.json'),
      fetch('./data/evolutions.json'),
      fetch('./data/items.json'),
      fetch('./data/weapons.json')
    ]);

    if (!creaturesRes.ok)   throw new Error('Falha ao carregar creatures.json');
    if (!areasRes.ok)       throw new Error('Falha ao carregar areas.json');
    if (!cardsRes.ok)       throw new Error('Falha ao carregar cards.json');
    if (!evolutionsRes.ok)  throw new Error('Falha ao carregar evolutions.json');
    if (!itemsRes.ok)       throw new Error('Falha ao carregar items.json');
    if (!weaponsRes.ok)     throw new Error('Falha ao carregar weapons.json');

    // Criaturas e áreas
    window.TPLS  = await creaturesRes.json();
    window.AREAS = await areasRes.json();

    // Cards e pools de batalha
    const cardsData      = await cardsRes.json();
    window.CARDS         = cardsData.CARDS;
    window.CARD_POOLS    = cardsData.CARD_POOLS;

    // Evoluções
    window.EVO_TABLE     = await evolutionsRes.json();

    // Itens (loja, herói, batalha)
    const itemsData      = await itemsRes.json();
    window.VENDOR_STOCK  = itemsData.VENDOR_STOCK;
    window.HERO_ITEMS    = itemsData.HERO_ITEMS;
    window.BATTLE_ITEMS  = itemsData.BATTLE_ITEMS;

    // Armas
    window.WEAPONS       = await weaponsRes.json();

    console.log(
      '[Soulmon] Dados carregados — ' +
      window.TPLS.length        + ' criaturas, ' +
      window.AREAS.length       + ' áreas, ' +
      Object.keys(window.CARDS).length + ' elementos de card, ' +
      Object.keys(window.EVO_TABLE).length + ' evoluções, ' +
      window.VENDOR_STOCK.length + ' itens de loja, ' +
      Object.keys(window.WEAPONS).length + ' armas.'
    );

    return true;
  } catch (err) {
    console.error('[Soulmon] Erro ao carregar dados:', err);
    return false;
  }
}

// Expõe para uso global (compatibilidade com o bundle atual)
window.loadGameData = loadGameData;
