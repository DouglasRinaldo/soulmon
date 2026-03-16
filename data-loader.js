// =====================================================
// data-loader.js — Soulmon Fase 1
// Carrega todos os dados estáticos do jogo de arquivos
// JSON externos e disponibiliza como variáveis globais.
//
// ATENÇÃO: Esta função se chama loadStaticData() —
// NÃO loadGameData() — para não conflitar com a
// função loadGameData(pname) do bundle, que é
// responsável por carregar o save do jogador.
// =====================================================

async function loadStaticData() {
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

    window.TPLS  = await creaturesRes.json();
    window.AREAS = await areasRes.json();

    const cardsData      = await cardsRes.json();
    window.CARDS         = cardsData.CARDS;
    window.CARD_POOLS    = cardsData.CARD_POOLS;

    window.EVO_TABLE     = await evolutionsRes.json();

    const itemsData      = await itemsRes.json();
    window.VENDOR_STOCK  = itemsData.VENDOR_STOCK;
    window.HERO_ITEMS    = itemsData.HERO_ITEMS;
    window.BATTLE_ITEMS  = itemsData.BATTLE_ITEMS;

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

window.loadStaticData = loadStaticData;
