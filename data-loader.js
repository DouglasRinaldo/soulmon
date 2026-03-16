// =====================================================
// data-loader.js — Soulmon Fase 1
// Carrega todos os dados do jogo de arquivos JSON
// externos e disponibiliza como variáveis globais,
// mantendo compatibilidade total com o código atual.
// =====================================================

async function loadGameData() {
  try {
    const [creaturesRes, areasRes] = await Promise.all([
      fetch('./data/creatures.json'),
      fetch('./data/areas.json')
    ]);

    if (!creaturesRes.ok) throw new Error('Falha ao carregar creatures.json');
    if (!areasRes.ok)    throw new Error('Falha ao carregar areas.json');

    window.TPLS  = await creaturesRes.json();
    window.AREAS = await areasRes.json();

    console.log('[Soulmon] Dados carregados — ' +
      window.TPLS.length  + ' criaturas, ' +
      window.AREAS.length + ' áreas.');

    return true;
  } catch (err) {
    console.error('[Soulmon] Erro ao carregar dados:', err);
    return false;
  }
}

// Expõe para uso global (compatibilidade com o bundle atual)
window.loadGameData = loadGameData;
