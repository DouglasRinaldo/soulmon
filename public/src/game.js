// =====================================================
// src/game.js — Soulmon Core (gerado automaticamente)
// Código principal do jogo extraído do bundle.
// =====================================================

// ===== SUPABASE CLOUD SAVE =====
    var SUPA_URL = 'https://bpdyutwtkcddeugwuick.supabase.co';
    var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZHl1dHd0a2NkZGV1Z3d1aWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODYwNDgsImV4cCI6MjA4ODY2MjA0OH0.m-ikgfX-FSEEZ2IwIdH8QUrcCuAeDuuXf6Z8cPEsJtk';

    var SB = {
      user: null,        // current logged-in user object
      token: null,       // access token
      ready: false       // true after init
    };

    // ---- Low-level fetch helpers ----

    function sbFetch(path, method, body, token) {
      var headers = {
        'Content-Type': 'application/json',
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + (token || SUPA_KEY)
      };
      return fetch(SUPA_URL + path, {
        method: method || 'GET',
        headers: headers,
        body: body ? JSON.stringify(body) : undefined
      }).then(function (r) { return r.json(); });
    }

    // ---- Auth ----

    function sbSignUp(email, password) {
      return sbFetch('/auth/v1/signup', 'POST', { email: email, password: password });
    }

    function sbSignIn(email, password) {
      return sbFetch('/auth/v1/token?grant_type=password', 'POST', { email: email, password: password });
    }

    function sbSignOut() {
      var token = SB.token;
      SB.user = null; SB.token = null;
      localStorage.removeItem('soulmon_sb_session');
      renderAuthUI();
      if (token) sbFetch('/auth/v1/logout', 'POST', {}, token).catch(function () { });
    }

    function sbRestoreSession() {
      try {
        var raw = localStorage.getItem('soulmon_sb_session');
        if (!raw) return Promise.resolve(null);
        var s = JSON.parse(raw);
        // Verify token still valid by fetching user
        return sbFetch('/auth/v1/user', 'GET', null, s.access_token)
          .then(function (u) {
            if (u && u.id) {
              SB.user = u; SB.token = s.access_token;
              return u;
            }
            localStorage.removeItem('soulmon_sb_session');
            return null;
          }).catch(function () { return null; });
      } catch (e) { return Promise.resolve(null); }
    }

    function sbPersistSession(data) {
      SB.user = data.user;
      SB.token = data.access_token;
      localStorage.setItem('soulmon_sb_session', JSON.stringify({
        access_token: data.access_token,
        user: data.user
      }));
    }

    // ---- Cloud saves ----

    function sbSaveGame(playerName, saveData) {
      if (!SB.token) return Promise.resolve(null);
      var body = {
        user_id: SB.user.id,
        player_name: playerName,
        save_data: saveData,
        updated_at: new Date().toISOString()
      };
      // Upsert — insert or update on conflict
      return fetch(SUPA_URL + '/rest/v1/saves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SB.token,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(body)
      }).then(function (r) { return r.ok ? r : null; })
        .catch(function () { return null; });
    }

    function sbLoadSaves() {
      if (!SB.token) return Promise.resolve([]);
      return fetch(SUPA_URL + '/rest/v1/saves?select=player_name,save_data,updated_at&order=updated_at.desc', {
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SB.token
        }
      }).then(function (r) { return r.json(); })
        .then(function (rows) { return Array.isArray(rows) ? rows : []; })
        .catch(function () { return []; });
    }

    function sbDeleteSave(playerName) {
      if (!SB.token) return Promise.resolve(null);
      return fetch(SUPA_URL + '/rest/v1/saves?player_name=eq.' + encodeURIComponent(playerName), {
        method: 'DELETE',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SB.token
        }
      }).catch(function () { });
    }

    // ---- Auth UI ----

    function showAuthModal(mode) {
      var m = document.getElementById('auth-modal');
      document.getElementById('auth-mode-title').textContent = mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA';
      document.getElementById('auth-submit-btn').textContent = mode === 'login' ? 'Entrar' : 'Criar Conta';
      document.getElementById('auth-toggle-link').textContent = mode === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar';
      document.getElementById('auth-toggle-link').setAttribute('data-mode', mode === 'login' ? 'register' : 'login');
      document.getElementById('auth-error').textContent = '';
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-password').value = '';
      m._mode = mode;
      m.style.display = 'flex';
    }

    function closeAuthModal() {
      document.getElementById('auth-modal').style.display = 'none';
    }

    function toggleAuthMode() {
      var link = document.getElementById('auth-toggle-link');
      showAuthModal(link.getAttribute('data-mode'));
    }

    function submitAuth() {
      var m = document.getElementById('auth-modal');
      var email = document.getElementById('auth-email').value.trim();
      var pass = document.getElementById('auth-password').value;
      var btn = document.getElementById('auth-submit-btn');
      var err = document.getElementById('auth-error');

      if (!email || !pass) { err.textContent = 'Preencha email e senha.'; return; }
      btn.disabled = true; btn.textContent = '...';

      var action = m._mode === 'login' ? sbSignIn(email, pass) : sbSignUp(email, pass);
      action.then(function (data) {
        btn.disabled = false;
        if (data.error || data.msg) {
          err.textContent = data.error_description || data.msg || 'Erro desconhecido.';
          btn.textContent = m._mode === 'login' ? 'Entrar' : 'Criar Conta';
          return;
        }
        if (m._mode === 'register' && !data.access_token) {
          // Email confirmation may be required
          err.style.color = '#6ab890';
          err.textContent = 'Conta criada! Verifique seu email para confirmar, depois faça login.';
          btn.textContent = 'Criar Conta';
          return;
        }
        sbPersistSession(data);
        closeAuthModal();
        renderAuthUI();
        notify('☁ Conectado como ' + (SB.user.email || 'usuário'));
        // Reload save list to show cloud saves
        showTitle();
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = m._mode === 'login' ? 'Entrar' : 'Criar Conta';
        err.textContent = 'Erro de conexão. Tente novamente.';
      });
    }

    function renderAuthUI() {
      var loggedIn = !!SB.token;
      var btnLogin = document.getElementById('btn-auth-login');
      var btnLogout = document.getElementById('btn-auth-logout');
      var userLabel = document.getElementById('auth-user-label');
      var cloudSaveIndicator = document.getElementById('cloud-save-indicator');

      if (btnLogin) btnLogin.style.display = loggedIn ? 'none' : 'inline-block';
      if (btnLogout) btnLogout.style.display = loggedIn ? 'inline-block' : 'none';
      if (userLabel) {
        userLabel.style.display = loggedIn ? 'block' : 'none';
        if (loggedIn && SB.user) userLabel.textContent = '☁ ' + SB.user.email;
      }
      if (cloudSaveIndicator) {
        cloudSaveIndicator.style.display = loggedIn ? 'inline-flex' : 'none';
      }
    }

    // Init — restore session on page load
    document.addEventListener('DOMContentLoaded', function () {
      loadStaticData().then(function (ok) {
        if (!ok) {
          alert('Erro ao carregar dados do jogo. Verifique o console.');
          return;
        }
        sbRestoreSession().then(function (u) {
          SB.ready = true;
          renderAuthUI();
        });
      });
    });
  

// ===== DATA =====
    var EL = {
      fire: { name: 'FOGO', col: 0xe84545, hex: '#e84545', strong: 'nature', weak: 'water' },
      water: { name: 'AGUA', col: 0x4a90d9, hex: '#4a90d9', strong: 'fire', weak: 'electric' },
      earth: { name: 'TERRA', col: 0xc9933a, hex: '#c9933a', strong: 'electric', weak: 'nature' },
      nature: { name: 'FLORESTA', col: 0x27ae60, hex: '#27ae60', strong: 'earth', weak: 'fire' },
      electric: { name: 'TROVAO', col: 0xf1c40f, hex: '#f1c40f', strong: 'water', weak: 'earth' },
      dark: { name: 'SOMBRA', col: 0xa855f7, hex: '#a855f7', strong: 'light', weak: 'light' },
      light: { name: 'LUZ', col: 0xd4a017, hex: '#d4a017', strong: 'dark', weak: 'dark' },
      // ── HYBRID ELEMENTS ──
      vapor: { name: 'VAPOR', col: 0x88ccdd, hex: '#88ccdd', strong: 'earth', weak: 'electric', hybrid: true },
      ashes: { name: 'CINZAS', col: 0xaa7755, hex: '#aa7755', strong: 'light', weak: 'water', hybrid: true },
      storm: { name: 'TEMPESTADE', col: 0x5599ff, hex: '#5599ff', strong: 'fire', weak: 'earth', hybrid: true },
      magnet: { name: 'MAGNETISMO', col: 0xdd9933, hex: '#dd9933', strong: 'water', weak: 'fire', hybrid: true },
      twilight: { name: 'CREPUSCULO', col: 0xcc66ff, hex: '#cc66ff', strong: 'dark', weak: null, hybrid: true },
      ancient: { name: 'RAIZES ANTIGAS', col: 0x558833, hex: '#558833', strong: 'water', weak: 'fire', hybrid: true },
      voidarc: { name: 'ABISMO ELETRICO', col: 0x8833cc, hex: '#8833cc', strong: 'water', weak: 'light', hybrid: true },
      aurora: { name: 'AURORA', col: 0x88ddff, hex: '#88ddff', strong: 'earth', weak: 'dark', hybrid: true }
    };

    // ══════════════════════════════════════════════════════════════════════════
    // CARD POOLS — Pool de habilidades sorteáveis por batalha
    // Cada criatura sorteia 2 normais do pool + 1 ultimate do pool de ults
    // pure_def:true = sem dano ao inimigo (escudo/cura) — max 1 por mão
    // stackable:true = deixa estado de campo que amplia próximo ataque
    // ══════════════════════════════════════════════════════════════════════════
    var CARD_POOLS = {
      fire: {
        normal: [
          { n: 'Chama Sonica', d: 'Onda de calor intensa', m: 1.8, p: 'M3 12Q6 7 9 12Q12 17 15 12Q18 7 21 12' },
          { n: 'Vulcao', d: 'Aplica QUEIMADURA(3)', m: 2.1, p: 'M3 20L8 10l4 5 4-7 5 12z', status: 'burn' },
          { n: 'Rastro de Brasa', d: 'Deixa BRASA no campo (+1 next)', m: 1.4, p: 'M17 12h-5l1-7-8 11h5l-1 7z', stackable: true },
          { n: 'Calor Explosivo', d: 'Dano duplo se BRASA ativa', m: 2.5, p: 'M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z', combo: 'brasa' },
          { n: 'Exalacao Ignea', d: 'Dano moderado, se cura 20%', m: 1.6, p: 'M12 22C12 22 4 18 4 12A8 8 0 0120 12C20 18 12 22 12 22Z', status: 'drain' },
          { n: 'Manto de Cinzas', d: 'Cria ESCUDO de calor (DEF*1.0)', m: 0, p: 'M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42', status: 'shield', pure_def: true }
        ],
        ult: [
          { n: 'Purgacao Solar', d: 'Fogo que purifica', m: 3.2, p: 'M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M12 8a4 4 0 100 8 4 4 0 000-8z' },
          { n: 'Nova Flamejante', d: 'Explosao que queima tudo', m: 3.8, p: 'M12 2L2 22H22L12 2Z', status: 'burn' },
          { n: 'Forno Eterno', d: 'BRASA permanente +50% fogo', m: 2.8, p: 'M17 12h-5l1-7-8 11h5l-1 7z', stackable: true },
          { n: 'Ascensao do Fogo', d: 'Cura e queima simultaneamente', m: 3.0, p: 'M12 22C12 22 4 18 4 12A8 8 0 0120 12C20 18 12 22 12 22Z', status: 'drain' }
        ]
      },
      water: {
        normal: [
          { n: 'Tsunami', d: 'Onda devastadora', m: 1.8, p: 'M2 12Q5 6 8 12Q11 18 14 12Q17 6 22 12' },
          { n: 'Vortice', d: 'Cria ESCUDO(DEF*1.2)', m: 0, p: 'M12 2a10 10 0 110 20A10 10 0 0112 2M12 7v5l3 3', status: 'shield', pure_def: true },
          { n: 'Gelo Profundo', d: 'Aplica GELO — próx. ataque ×1.4', m: 1.5, p: 'M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07', stackable: true },
          { n: 'Rajada Gelada', d: 'Dano dobrado se GELO ativo', m: 2.6, p: 'M12 2C6 2 2 6 2 12s4 10 10 10 10-4 10-10S18 2 12 2z', combo: 'gelo' },
          { n: 'Chuva Curativa', d: 'Restaura 30% HP proprio', m: 0, p: 'M8 19v3M12 19v3M16 19v3', pure_def: true, heal: 0.30 },
          { n: 'Corrente Veloz', d: 'Dano rapido, age antes do inimigo', m: 1.7, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', priority: true }
        ],
        ult: [
          { n: 'Diluvio Eterno', d: 'Inunda o campo', m: 3.2, p: 'M8 19v3M12 19v3M16 19v3M3 10h18M5 10C5 6 8 3 12 3s7 3 7 7' },
          { n: 'Abismo de Gelo', d: 'Paralisa e causa dano massivo', m: 3.5, p: 'M12 2v20M2 12h20', status: 'paralyze' },
          { n: 'Mar Sem Fim', d: 'GELO permanente no campo', m: 2.9, p: 'M12 2C6 2 2 6 2 12s4 10 10 10 10-4 10-10S18 2 12 2z', stackable: true },
          { n: 'Cura das Profundezas', d: 'Cura total da equipe', m: 0, p: 'M12 2v20M2 12h20M4.93 4.93l14.14 14.14', pure_def: true, heal: 0.60 }
        ]
      },
      earth: {
        normal: [
          { n: 'Terremoto', d: 'Abala o solo', m: 1.8, p: 'M2 20L9 6l5 8 3-4 5 10z' },
          { n: 'Espinhos', d: 'Aplica VENENO(3 stacks)', m: 2.1, p: 'M12 2C6 2 2 8 2 14l10-4-2 12c4-2 8-8 8-14-1-3-3-5-6-6z', status: 'poison' },
          { n: 'Rocha Protetora', d: 'ESCUDO de pedra (DEF*1.5)', m: 0, p: 'M4 20L8 12l4 4 4-8 4 12z', status: 'shield', pure_def: true },
          { n: 'Ruptura do Solo', d: 'Deixa RUPTURA — próx. +1.5×', m: 1.3, p: 'M12 22V12M12 2v5M4 12H2M22 12h-2', stackable: true },
          { n: 'Pedrada Pesada', d: 'Dano massivo se RUPTURA ativa', m: 2.7, p: 'M4 20L8 12l4 4 4-8 4 12z', combo: 'ruptura' },
          { n: 'Veneno da Terra', d: 'Envenena e restaura 15% HP', m: 1.5, p: 'M12 2C6 2 2 8 2 14l10-4-2 12c4-2 8-8 8-14-1-3-3-5-6-6z', status: 'poison', heal: 0.15 }
        ],
        ult: [
          { n: 'Cataclismo', d: 'A terra se parte', m: 3.2, p: 'M13 2L5 13h7l-1 9 8-12h-7z' },
          { n: 'Monolito', d: 'ESCUDO maximo + contra-ataque', m: 0, p: 'M4 20L8 12l4 4 4-8 4 12z', status: 'shield', pure_def: true },
          { n: 'Marremoto', d: 'RUPTURA permanente em campo', m: 2.9, p: 'M12 22V12M12 2v5', stackable: true },
          { n: 'Nucleo da Terra', d: 'Envenena e causa dano massivo', m: 3.4, p: 'M2 20L9 6l5 8 3-4 5 10z', status: 'poison' }
        ]
      },
      dark: {
        normal: [
          { n: 'Alma Negra', d: 'DRENO: rouba 35% do dano', m: 1.6, p: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7zM12 9a3 3 0 100 6 3 3 0 000-6z', status: 'drain' },
          { n: 'Maldicao', d: 'Corroi por dentro', m: 2.1, p: 'M12 2C8 2 5 5 5 9c0 2.5 1.5 4.5 3 6H8v3h8v-3h-.5c1.5-1.5 3-3.5 3-6 0-4-3-7-6.5-7z' },
          { n: 'Sombra Rastreadora', d: 'Deixa SOMBRA — próx. +1.4×', m: 1.2, p: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z', stackable: true },
          { n: 'Golpe das Trevas', d: 'Dano duplo se SOMBRA ativa', m: 2.5, p: 'M12 2C8 2 5 5 5 9c0 2.5 1.5 4.5 3 6H8v3h8v-3h', combo: 'sombra' },
          { n: 'Escudo Sombrio', d: 'Escudo que drena atacante', m: 0, p: 'M12 2L3 7v6c0 5 4 9 9 10 5-1 9-5 9-10V7z', status: 'shield', pure_def: true },
          { n: 'Sifao de Vida', d: 'DRENO massivo 50% do dano', m: 1.9, p: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z', status: 'drain' }
        ],
        ult: [
          { n: 'Vazio Absoluto', d: 'Apaga existencia', m: 3.2, p: 'M12 2a10 10 0 100 20 10 10 0 000-20zM8 12h8M12 8v8' },
          { n: 'Eclipse Total', d: 'SOMBRA permanente no campo', m: 2.8, p: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z', stackable: true },
          { n: 'Drenagem Eterna', d: 'DRENO total por 3 turnos', m: 2.5, p: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z', status: 'drain' },
          { n: 'Maldição Fatal', d: 'Dobra todos os debuffs ativos', m: 3.5, p: 'M12 2C8 2 5 5 5 9c0 2.5 1.5 4.5 3 6H8v3h8v-3h-.5' }
        ]
      },
      light: {
        normal: [
          { n: 'Julgamento', d: 'Raio divino', m: 1.8, p: 'M13 2L4 14h7l-1 8 9-12h-7z' },
          { n: 'Barreira', d: 'Reflete e contra-ataca', m: 2.1, p: 'M12 2L3 7v6c0 5 4 9 9 10 5-1 9-5 9-10V7z' },
          { n: 'Luz Sagrada', d: 'Cura 25% HP proprio', m: 0, p: 'M12 2v20M2 12h20', pure_def: true, heal: 0.25 },
          { n: 'Aura Divina', d: 'Deixa AURA — próx. sagrado ×1.5', m: 1.3, p: 'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', stackable: true },
          { n: 'Raio Purificador', d: 'Dano dobrado se AURA ativa', m: 2.6, p: 'M13 2L4 14h7l-1 8 9-12h-7z', combo: 'aura' },
          { n: 'Escudo Sagrado', d: 'ESCUDO maximo (DEF*1.8)', m: 0, p: 'M12 2L3 7v6c0 5 4 9 9 10 5-1 9-5 9-10V7z', status: 'shield', pure_def: true }
        ],
        ult: [
          { n: 'Apocalipse', d: 'Aplica PARALISIA(2t)', m: 3.2, p: 'M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12M12 8a4 4 0 100 8 4 4 0 000-8z', status: 'paralyze' },
          { n: 'Julgamento Final', d: 'AURA permanente + dano massivo', m: 3.6, p: 'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', stackable: true },
          { n: 'Ressurreicao', d: 'Cura total e aplica AURA', m: 0, p: 'M12 2v20M2 12h20', pure_def: true, heal: 1.0 },
          { n: 'Coroa de Luz', d: 'Paralisa e queima simultaneamente', m: 3.4, p: 'M12 2v3M12 19v3M4.22 4.22l2.12 2.12', status: 'paralyze' }
        ]
      },
      nature: {
        normal: [
          { n: 'Cipo Chicote', d: 'Dano de natureza moderado', m: 1.7, p: 'M2 12C2 12 5 2 12 2S22 12 22 12S19 22 12 22S2 12 2 12Z' },
          { n: 'Raizes Vampiricas', d: 'DRENO: rouba 40% do dano', m: 1.5, p: 'M12 22C12 22 20 18 20 12C20 6 12 2 12 2S4 6 4 12C4 18 12 22 12 22Z', status: 'drain' },
          { n: 'Espora Toxica', d: 'Envenena profundamente (5 stacks)', m: 1.6, p: 'M12 2L15.09 5.09L19 9L15.09 12.91L12 16L8.91 12.91L5 9L8.91 5.09L12 2Z', status: 'poison' },
          { n: 'Florescimento', d: 'Deixa FLORA — próx. ×1.5', m: 1.2, p: 'M12 22C12 22 4 18 4 12A8 8 0 0120 12C20 18 12 22 12 22Z', stackable: true },
          { n: 'Explosao Floral', d: 'Dano triplo se FLORA ativa', m: 2.4, p: 'M12 2L15.09 5.09L19 9L15.09 12.91L12 16', combo: 'flora' },
          { n: 'Regeneracao', d: 'Cura 35% HP proprio', m: 0, p: 'M12 22C12 22 20 18 20 12', pure_def: true, heal: 0.35 }
        ],
        ult: [
          { n: 'Ira de Gaia', d: 'Dano massivo e envenena', m: 3.4, p: 'M12 2L2 22H22L12 2Z', status: 'poison' },
          { n: 'Selva Eternal', d: 'FLORA permanente no campo', m: 2.7, p: 'M12 22C12 22 4 18 4 12A8 8 0 0120 12C20 18 12 22 12 22Z', stackable: true },
          { n: 'Dreno Total', d: 'DRENO 70% por 2 turnos', m: 2.6, p: 'M12 22C12 22 20 18 20 12C20 6 12 2 12 2S4 6 4 12C4 18 12 22 12 22Z', status: 'drain' },
          { n: 'Grande Cura', d: 'Cura 80% HP e remove debuffs', m: 0, p: 'M12 2L15.09 5.09L19 9L15.09 12.91L12 16', pure_def: true, heal: 0.80 }
        ]
      },
      electric: {
        normal: [
          { n: 'Relampago', d: 'Raio veloz e potente', m: 1.9, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z' },
          { n: 'Sobrecarga', d: 'Aplica PARALISIA(1t)', m: 2.2, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', status: 'paralyze' },
          { n: 'Carga Eletrica', d: 'Deixa CARGA — próx. ×1.6', m: 1.3, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', stackable: true },
          { n: 'Descarga Total', d: 'Dano massivo se CARGA ativa', m: 2.8, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', combo: 'carga' },
          { n: 'Campo Magnetico', d: 'ESCUDO eletrico (DEF*1.1)', m: 0, p: 'M12 2v20M2 12h20', status: 'shield', pure_def: true },
          { n: 'Arco Voltaico', d: 'Paralisa e causa dano moderado', m: 1.7, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', status: 'paralyze' }
        ],
        ult: [
          { n: 'Tempestade de Ions', d: 'Dano eletrico devastador', m: 3.5, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z' },
          { n: 'Pulsar Cosmico', d: 'CARGA permanente no campo', m: 2.9, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', stackable: true },
          { n: 'Apagao Total', d: 'Paralisa por 3 turnos', m: 2.5, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', status: 'paralyze' },
          { n: 'Grande Tempestade', d: 'Dano a todos + paralisia', m: 3.2, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', status: 'paralyze' }
        ]
      }
    };

    // ══════════════════════════════════════════════════════════════════════════
    // FUNÇÃO DE SORTEIO DE CARTAS POR BATALHA
    // Sorteia 2 normais + 1 ultimate do pool do elemento da criatura
    // Regra: máximo 1 pure_def (escudo/cura sem dano) por mão
    // Híbridas: ataque básico fixo + herdada fixa + 1 normal + 1 ult sorteados
    // ══════════════════════════════════════════════════════════════════════════
    function drawBattleHand(creature) {
      var el = creature.el || 'fire';
      var pool = CARD_POOLS[el];
      if (!pool) {
        // fallback para CARDS padrão se não tiver pool
        var def = CARDS[el] || CARDS.fire;
        return { m1: def.m1, m2: def.m2, u: def.u };
      }

      // Shuffle utilitário
      function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      }

      var normalPool = shuffle(pool.normal);
      var ultPool = shuffle(pool.ult);

      // Sortear 2 normais respeitando regra anti-duplo pure_def
      var picked = [];
      var hasPureDef = false;
      for (var i = 0; i < normalPool.length && picked.length < 2; i++) {
        var card = normalPool[i];
        if (card.pure_def) {
          if (!hasPureDef) { picked.push(card); hasPureDef = true; }
          // Se já tem uma pure_def, pular esta
        } else {
          picked.push(card);
        }
      }
      // Garantir 2 cartas (edge case: pool tem só pure_defs)
      while (picked.length < 2) picked.push(normalPool[picked.length] || pool.normal[0]);

      // Para híbridas: apenas 1 normal sorteada (a herdada ocupa slot)
      if (creature.isHybrid) {
        picked = [picked[0]];
      }

      return {
        m1: picked[0],
        m2: picked[1] || null,   // null para híbridas
        u: ultPool[0]
      };
    }


    //   // ═══════════════════════════════════════════════════
    //   // BESTIAIS — criaturas de tier especial
    //   // Aparecem apenas em áreas evoluídas (evolução 3+)
    //   // Captura: mecânica de "Domar" (requer 3 vitórias consecutivas contra a mesma criatura)
    //   // Stats: 40% maiores que criaturas normais, tier: 'bestial'
    //   // ═══════════════════════════════════════════════════

    //   {
    //     name: 'Embrasado', body: 'bestial', el: 'fire', body: 'beast', atk: 17, def: 11, shape: 'spiky',
    //     tier: 'bestial', color: 0xff4400, desc: 'Um predador de chamas primitivo. Seus rugidos derretem pedras.',
    //     passives: [
    //       { lvl: 5, id: 'savage_strike', name: 'Golpe Selvagem', desc: 'Ataques têm 30% de chance de causar sangramento (+5 dano/turno)' },
    //       { lvl: 12, id: 'feral_rage', name: 'Fúria Feral', desc: 'Abaixo de 30% HP, ATQ aumenta 50%' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Rugido Ardente' }, { lvl: 15, card: 'u', name: 'Chama Primordial' }]
    //   },

    //   {
    //     name: 'Gorakal', body: 'bestial', el: 'earth', body: 'beast', atk: 14, def: 16, shape: 'round',
    //     tier: 'bestial', color: 0x556b2f, desc: 'Colosso de rocha viva. Cada passo seu abre rachaduras no chão.',
    //     passives: [
    //       { lvl: 5, id: 'rock_armor', name: 'Armadura Bruta', desc: 'Reduz dano recebido em 15% quando com HP cheio' },
    //       { lvl: 12, id: 'tremor_step', name: 'Passo Sismico', desc: 'Ataques físicos têm 25% de chance de atordoar (inimigo perde 1 turno)' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Esmagamento' }, { lvl: 15, card: 'u', name: 'Terremoto' }]
    //   },

    //   {
    //     name: 'Leviatrix', body: 'bestial', el: 'water', body: 'beast', atk: 15, def: 13, shape: 'round',
    //     tier: 'bestial', color: 0x006994, desc: 'Serpente abissal. Emerge das profundezas para devorar a luz.',
    //     passives: [
    //       { lvl: 5, id: 'abyssal_pull', name: 'Tração Abissal', desc: 'Inimigos atacados têm -10% DEF por 3 turnos' },
    //       { lvl: 12, id: 'tidal_surge', name: 'Maré Furiosa', desc: 'A cada 4 turnos, próximo ataque causa dano duplo' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Ondas Abissais' }, { lvl: 15, card: 'u', name: 'Dilúvio Bestial' }]
    //   },

    //   {
    //     name: 'Vombrath', body: 'bestial', el: 'dark', body: 'beast', atk: 18, def: 9, shape: 'spiky',
    //     tier: 'bestial', color: 0x4b0082, desc: 'Predador das sombras que se alimenta do medo de suas presas.',
    //     passives: [
    //       { lvl: 5, id: 'fear_aura', name: 'Aura do Terror', desc: 'Inimigo começa a batalha com -15% ATQ' },
    //       { lvl: 12, id: 'shadow_step', name: 'Passo Sombrio', desc: '20% de chance de esquivar completamente de um ataque' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Grito Sombrio' }, { lvl: 15, card: 'u', name: 'Eclipsar' }]
    //   },

    //   {
    //     name: 'Fulgaris', body: 'bestial', el: 'electric', body: 'beast', atk: 16, def: 10, shape: 'spiky',
    //     tier: 'bestial', color: 0xffd700, desc: 'Fera elétrica que canaliza raios direto da atmosfera.',
    //     passives: [
    //       { lvl: 5, id: 'static_field', name: 'Campo Estático', desc: 'Inimigos que atacam recebem 8 de dano de retorno' },
    //       { lvl: 12, id: 'chain_bolt', name: 'Relâmpago Duplo', desc: 'Ataques elétricos têm 35% de chance de acertar duas vezes' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Carga Elétrica' }, { lvl: 15, card: 'u', name: 'Tempestade Bestial' }]
    //   },

    //   {
    //     name: 'Sylvara', body: 'bestial', el: 'nature', body: 'beast', atk: 13, def: 15, shape: 'round',
    //     tier: 'bestial', color: 0x228b22, desc: 'Espírito da floresta primordial. Sua presença faz as plantas crescerem selvagemente.',
    //     passives: [
    //       { lvl: 5, id: 'overgrowth', name: 'Crescimento Voraz', desc: 'Regenera 8% do HP máximo por turno' },
    //       { lvl: 12, id: 'thorns_mantle', name: 'Manto de Espinhos', desc: 'Reflete 25% do dano recebido ao atacante' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Espinhos Vivos' }, { lvl: 15, card: 'u', name: 'Floresta Selvagem' }]
    //   },

    //   // ═══════════════════════════════════════════════════
    //   // ANGELICAIS — criaturas de evento raro
    //   // Aparecem apenas em eventos especiais (tempestades de luz, eclipses)
    //   // Captura: requer entrar na batalha com HP <= 20% ("prova de devoção")
    //   // Stats: balanceados mas com passivos únicos de suporte; tier: 'angelic'
    //   // ═══════════════════════════════════════════════════

    //   {
    //     name: 'Luminael', body: 'angelic', el: 'light', body: 'angelic', atk: 11, def: 14, shape: 'round',
    //     tier: 'angelic', color: 0xfff0a0, desc: 'Mensageiro de luz etérea. Sua presença cura o que está partido.',
    //     passives: [
    //       { lvl: 5, id: 'divine_aura', name: 'Aura Divina', desc: 'Todas as criaturas aliadas regeneram +5 HP por turno' },
    //       { lvl: 12, id: 'holy_shield', name: 'Escudo Sagrado', desc: 'Uma vez por batalha, nega dano letal (sobrevive com 1 HP)' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Luz Curativa' }, { lvl: 15, card: 'u', name: 'Bênção Celeste' }]
    //   },

    //   {
    //     name: 'Seraphis', body: 'angelic', el: 'light', body: 'angelic', atk: 14, def: 12, shape: 'spiky',
    //     tier: 'angelic', color: 0xffe080, desc: 'Guerreiro celestial. Suas asas deixam rastros de estrelas.',
    //     passives: [
    //       { lvl: 5, id: 'star_blade', name: 'Lâmina Estelar', desc: 'Ataques têm +15% de dano contra criaturas de tipo Escuridão' },
    //       { lvl: 12, id: 'radiant_burst', name: 'Explosão Radiante', desc: 'A cada 5 turnos, cura 20% do HP e aumenta ATQ em 20% por 2 turnos' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Golpe Celestial' }, { lvl: 15, card: 'u', name: 'Juízo Divino' }]
    //   },

    //   {
    //     name: 'Caelith', body: 'angelic', el: 'electric', body: 'angelic', atk: 16, def: 10, shape: 'spiky',
    //     tier: 'angelic', color: 0xd0e8ff, desc: 'Arauto dos céus de cristal. Comanda raios sagrados com precisão cirúrgica.',
    //     passives: [
    //       { lvl: 5, id: 'sacred_bolt', name: 'Raio Sagrado', desc: 'Ataques elétricos curam 10% do dano causado' },
    //       { lvl: 12, id: 'ascendance', name: 'Ascensão', desc: 'Quando eliminado, restaura 30% do HP do próximo aliado' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Faísca Sagrada' }, { lvl: 15, card: 'u', name: 'Julgamento Elétrico' }]
    //   },

    //   {
    //     name: 'Elyara', body: 'angelic', el: 'water', body: 'angelic', atk: 10, def: 16, shape: 'round',
    //     tier: 'angelic', color: 0xa0e0ff, desc: 'Guardiã das águas santas. Suas lágrimas purificam qualquer veneno.',
    //     passives: [
    //       { lvl: 5, id: 'purify', name: 'Purificação', desc: 'Ao final de cada turno, remove 1 efeito negativo de criaturas aliadas' },
    //       { lvl: 12, id: 'tide_of_grace', name: 'Maré de Graça', desc: 'Cura equivale a 130% em vez de 100%' }
    //     ],
    //     learns: [{ lvl: 8, card: 'm2', name: 'Chuva Sagrada' }, { lvl: 15, card: 'u', name: 'Dilúvio Angelical' }]
    //   }
    // ];



    //   // ══════════════════════════════════════════════
    //   // HYBRID ELEMENT CARDS
    //   // ══════════════════════════════════════════════

    //   // VAPOR (Fogo + Água) — ofensivo, cegamento
    //   vapor: {
    //     b: { n: 'Jato de Vapor', d: 'Jato escaldante básico', m: 1.0, p: 'M3 8Q8 4 12 8Q16 12 21 8' },
    //     m1: { n: 'Névoa Cegante', d: 'Vapor denso: -30% precisão inimigo (2t)', m: 1.6, p: 'M2 12Q6 4 12 4Q18 4 22 12Q18 20 12 20Q6 20 2 12Z', status: 'blind' },
    //     m2: { n: 'Caldeirão', d: 'Aplica QUEIMADURA(2) + reduz DEF 20%', m: 2.0, p: 'M8 2v4H4v12h16V6h-4V2H8zM10 2h4v4h-4z', status: 'burn' },
    //     u: { n: 'Explosão de Vapor', d: 'Superaquece — dano massivo + QUEIMADURA(4)', m: 3.8, p: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', status: 'burn' }
    //   },

    //   // ASHES (Fogo + Natureza) — DOT pesado
    //   ashes: {
    //     b: { n: 'Cinzada', d: 'Golpe de brasas residuais', m: 1.0, p: 'M12 2C8 2 4 6 4 11c0 3 2 6 5 8v3h6v-3c3-2 5-5 5-8 0-5-4-9-8-9z' },
    //     m1: { n: 'Brasa Persistente', d: 'QUEIMADURA(5) — dano de DOT dobrado', m: 1.4, p: 'M3 20L8 10l4 5 4-7 5 12z', status: 'burn_heavy' },
    //     m2: { n: 'Campo de Cinzas', d: 'Terreno queimado: -25% cura inimiga (3t)', m: 1.9, p: 'M2 20h20M7 20V10l5-8 5 8v10', status: 'antiheal' },
    //     u: { n: 'Incêndio Florestal', d: 'Consume o campo — QUEIMADURA(6) + dano enorme', m: 3.6, p: 'M12 22C12 22 20 18 20 12C20 6 12 2 12 2S4 6 4 12C4 18 12 22 12 22Z', status: 'burn_heavy' }
    //   },

    //   // STORM (Água + Trovão) — controle + alto dano
    //   storm: {
    //     b: { n: 'Descarga Molhada', d: 'Água condutora — ataque básico', m: 1.0, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z' },
    //     m1: { n: 'Tempestade', d: 'Raio + Água: dano alto + PARALISIA(1t)', m: 2.1, p: 'M3 12Q6 4 12 4Q18 4 22 12', status: 'paralyze' },
    //     m2: { n: 'Maré Elétrica', d: 'Onda que reduz ATK inimigo -35% (2t)', m: 1.7, p: 'M2 12Q5 6 8 12Q11 18 14 12Q17 6 22 12', status: 'weaken' },
    //     u: { n: 'Olho da Tempestade', d: 'Furacão elétrico — dano devastador em cadeia', m: 4.0, p: 'M12 2a10 10 0 110 20A10 10 0 0112 2', status: 'paralyze' }
    //   },

    //   // MAGNET (Terra + Trovão) — controle de campo
    //   magnet: {
    //     b: { n: 'Pulso Magnético', d: 'Campo magnético básico', m: 1.0, p: 'M12 2v20M2 12h20' },
    //     m1: { n: 'Atração Forçada', d: 'Puxa defesas: reduz DEF inimiga -40% (2t)', m: 1.5, p: 'M3 12h18M12 3v18', status: 'weaken_def' },
    //     m2: { n: 'Impacto de Ferro', d: 'Golpe pesado amplificado pelo campo', m: 2.3, p: 'M2 20L9 6l5 8 3-4 5 10z' },
    //     u: { n: 'Colapso Magnético', d: 'Inverte campo — converte DEF inimiga em dano', m: 3.5, p: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5', status: 'def_to_dmg' }
    //   },

    //   // TWILIGHT (Sombra + Luz) — roubo de buffs, dano puro
    //   twilight: {
    //     b: { n: 'Pulso Crepuscular', d: 'Energia entre luz e sombra', m: 1.0, p: 'M12 2L15 9h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z' },
    //     m1: { n: 'Roubo de Essência', d: 'Rouba 1 buff ativo do inimigo + drena HP', m: 1.8, p: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z', status: 'steal_buff' },
    //     m2: { n: 'Dualidade', d: 'Ataca com luz E sombra: ignora resistência', m: 2.4, p: 'M12 2C6 2 2 7 2 12s4 10 10 10 10-5 10-10S18 2 12 2z' },
    //     u: { n: 'Eclipse Total', d: 'Apaga buffs inimigos + dano maciço', m: 3.9, p: 'M12 2a10 10 0 110 20A10 10 0 0112 2M12 7v10M7 12h10', status: 'purge' }
    //   },

    //   // ANCIENT (Terra + Natureza) — tank extremo, cura
    //   ancient: {
    //     b: { n: 'Golpe de Raiz', d: 'Raiz ancestral endurecida', m: 1.0, p: 'M12 22C12 22 20 18 20 12C20 6 12 2 12 2S4 6 4 12C4 18 12 22 12 22Z' },
    //     m1: { n: 'Abraço da Floresta', d: 'Cura 25% HP + cria ESCUDO(DEF*1.5)', m: 0, p: 'M12 2C8 2 5 5 5 9c0 2.5 1.5 4.5 3 6H8v3h8v-3h-.5c1.5-1.5 3-3.5 3-6 0-4-3-7-6.5-7z', status: 'heal_shield' },
    //     m2: { n: 'Espinhos Antigos', d: 'Reflete 40% dano recebido por 3t', m: 1.6, p: 'M12 2C6 2 2 8 2 14l10-4-2 12c4-2 8-8 8-14-1-3-3-5-6-6z', status: 'reflect' },
    //     u: { n: 'Raízes do Mundo', d: 'Imobiliza + drena vida por 3t', m: 2.8, p: 'M3 20L9 6l5 8 3-4 5 10z', status: 'drain' }
    //   },

    //   // VOIDARC (Sombra + Trovão) — assassino, ignora escudo
    //   voidarc: {
    //     b: { n: 'Arco do Vazio', d: 'Descarga de escuridão elétrica', m: 1.0, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z' },
    //     m1: { n: 'Ignição Sombria', d: 'Ignora 50% do escudo — dano direto', m: 2.0, p: 'M12 2L2 7l10 5 10-5-10-5z', status: 'shield_pierce' },
    //     m2: { n: 'Corrente Negra', d: 'PARALISIA(1t) + VENENO(3) simultâneos', m: 1.8, p: 'M13 2L3 14H12L11 22L21 10H12L13 2Z', status: 'multi_dot' },
    //     u: { n: 'Pulsar do Abismo', d: 'Crit garantido + ignora toda defesa', m: 4.2, p: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z', status: 'true_dmg' }
    //   },

    //   // AURORA (Luz + Água) — suporte + burst
    //   aurora: {
    //     b: { n: 'Toque Celestial', d: 'Luz purificada pela água', m: 1.0, p: 'M12 2L15 9h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z' },
    //     m1: { n: 'Cura de Aurora', d: 'Cura 30% HP + remove 1 status negativo', m: 0, p: 'M13 2L4 14h7l-1 8 9-12h-7z', status: 'cleanse_heal' },
    //     m2: { n: 'Raio Polar', d: 'Dano de luz amplificado pela água (+30%)', m: 2.2, p: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z' },
    //     u: { n: 'Borealis', d: 'Cura total + golpe devastador de luz', m: 3.7, p: 'M12 2L13.5 8h6l-5 3.5 2 6.5L12 14l-4.5 4 2-6.5L5 8h6z', status: 'cleanse_heal' }
    //   }
    // };

    var ITEM_DEFS = [
      { id: 'fire', name: 'Cinza Elemental', ico: '*', desc: 'Fragmento de fogo aprisionado', rar: 'especial', col: '#ff5555' },
      { id: 'water', name: 'Lagrima Sinuosa', ico: '~', desc: 'Gota de agua sagrada imortal', rar: 'especial', col: '#4a90d9' },
      { id: 'earth', name: 'Musgo Sangrenho', ico: '%', desc: 'Raiz viva nascida da rocha', rar: 'especial', col: '#c9933a' },
      { id: 'dark', name: 'Eco do Vazio', ico: '@', desc: 'Pulsar obscuro de sombra', rar: 'especial', col: '#a855f7' },
      { id: 'light', name: 'Centelha Divina', ico: '+', desc: 'Luz pura cristalizada', rar: 'especial', col: '#d4a017' },
      { id: 'nature', name: 'Essencia Vital', ico: '&', desc: 'Semente de vida eterna', rar: 'especial', col: '#27ae60' },
      { id: 'electric', name: 'Nucleo Instavel', ico: '⚡', desc: 'Corrente eletrica aprisionada', rar: 'especial', col: '#f1c40f' }
    ];



    // ══════════════════════════════════════════════════════════════
    // POST-BOSS VENDOR STOCK — exclusive items per area boss
    // Only available after that area's boss is defeated
    // ══════════════════════════════════════════════════════════════
    var POST_BOSS_STOCK = [
      // aIdx:0 — Planície Cinzenta (earth/fire/water/nature)
      [
        { id: 'pb_plains_seed', name: 'Semente da Planície', icon: '🌾', cost: 280, desc: 'Criatura ativa ganha +3 DEF permanente.', effect: 'perm_def_3' },
        { id: 'pb_plains_rune', name: 'Runa da Sobrevivência', icon: '◈', cost: 420, desc: '+15% HP máximo para todo o grupo ativo.', effect: 'team_maxhp_15' },
        { id: 'pb_plains_scroll', name: 'Pergaminho Primordial', icon: '📜', cost: 350, desc: 'Ressurreita a última criatura morta com 50% HP.', effect: 'rez_last' }
      ],
      // aIdx:1 — Floresta Sombria (nature/dark)
      [
        { id: 'pb_forest_thorn', name: 'Espinho Sombrio', icon: '🌿', cost: 380, desc: 'Criatura ativa causa +4 ATQ permanente.', effect: 'perm_atk_4' },
        { id: 'pb_forest_veil', name: 'Véu da Floresta', icon: '🌑', cost: 550, desc: 'Próxima captura tem +40% de chance de sucesso.', effect: 'capture_boost' },
        { id: 'pb_forest_egg', name: 'Œuf Sombrio', icon: '🥚', cost: 300, desc: 'Ovo raro com elemento dark/nature garantido.', effect: 'rare_egg_dark' }
      ],
      // aIdx:2 — Ruínas Ardentes (fire/light/dark)
      [
        { id: 'pb_ruins_coal', name: 'Carvão Eterno', icon: '🔥', cost: 480, desc: 'Todo o grupo ganha imunidade a QUEIMADURA.', effect: 'burn_immunity' },
        { id: 'pb_ruins_blade', name: 'Lâmina Ígnea', icon: '⚔', cost: 650, desc: '+5 ATQ para o herói permanente.', effect: 'hero_atk_5' },
        { id: 'pb_ruins_egg', name: 'Œuf das Cinzas', icon: '🥚', cost: 400, desc: 'Ovo raro com elemento fire/light garantido.', effect: 'rare_egg_fire' }
      ],
      // aIdx:3 — Abismo Eterno (dark/electric)
      [
        { id: 'pb_abyss_shard', name: 'Estilhaço do Vazio', icon: '💜', cost: 700, desc: 'Criatura ativa ganha passivo lifesteal permanente.', effect: 'perm_lifesteal' },
        { id: 'pb_abyss_seal', name: 'Selo Abissal', icon: '✦', cost: 900, desc: 'Dobra o drop de almas pela próxima hora de jogo.', effect: 'soul_double' },
        { id: 'pb_abyss_egg', name: 'Œuf do Abismo', icon: '🥚', cost: 600, desc: 'Ovo lendário — elemento sombrio puro.', effect: 'leg_egg_dark' }
      ],
      // aIdx:4 — Pântano Nebuloso (water/nature/dark)
      [
        { id: 'pb_swamp_balm', name: 'Bálsamo do Pântano', icon: '🌊', cost: 320, desc: 'Cura 100% HP de todo o grupo e herói.', effect: 'full_heal' },
        { id: 'pb_swamp_slime', name: 'Catalisador Viscoso', icon: '🧪', cost: 440, desc: '+50% velocidade de incubação dos Œufs.', effect: 'egg_hatch_fast' },
        { id: 'pb_swamp_egg', name: 'Œuf Nebuloso', icon: '🥚', cost: 280, desc: 'Ovo raro com elemento water/nature garantido.', effect: 'rare_egg_water' }
      ],
      // aIdx:5 — Pico dos Trovões (electric/fire/light)
      [
        { id: 'pb_peak_storm', name: 'Essência da Tempestade', icon: '⚡', cost: 580, desc: 'Grupo ganha +10% dano de relâmpago em batalhas.', effect: 'storm_boost' },
        { id: 'pb_peak_lens', name: 'Lente do Pico', icon: '🔭', cost: 750, desc: 'Revela todos os especiais no minimapa permanente.', effect: 'reveal_all' },
        { id: 'pb_peak_egg', name: 'Œuf Trovejante', icon: '🥚', cost: 500, desc: 'Ovo lendário — elemento elétrico puro.', effect: 'leg_egg_elec' }
      ]
    ];
    // ══════════════════════════════════════════════════
    // RELICS — passive items equipped on the hero
    // Dropped by area bosses (one per area, guaranteed)
    // Only 1 can be equipped at a time
    // ══════════════════════════════════════════════════
    var RELIC_DEFS = [
      {
        id: 'relic_verdant',
        name: 'Raiz Sangrenta',
        icon: '🌿',
        aIdx: 0,  // drops from Planície boss
        desc: 'Após cada batalha vencida, toda a equipe ativa regenera 12% do HP máximo.',
        flavor: 'Uma raiz que cresceu sobre um osso. Ela ainda pulsa.',
        effect: 'post_battle_regen'
      },
      {
        id: 'relic_ashen',
        name: 'Cinza Eterna',
        icon: '🔥',
        aIdx: 1,  // drops from Floresta boss
        desc: 'Suas criaturas causam +12% de dano em batalha.',
        flavor: 'Quente ao toque. Nunca esfria.',
        effect: 'dmg_boost'
      },
      {
        id: 'relic_voidstone',
        name: 'Pedra do Vazio',
        icon: '◈',
        aIdx: 2,  // drops from Vulcânico boss
        desc: 'A primeira criatura que morrer em cada batalha ressuscita com 20% de HP.',
        flavor: 'Absorve a luz ao redor. Sua superfície nunca esquece.',
        effect: 'first_revive'
      },
      {
        id: 'relic_spectral',
        name: 'Eco Espectral',
        icon: '👁',
        aIdx: 3,  // drops from Vazio boss
        desc: 'O herói regenera +3 HP por passo dado no mapa.',
        flavor: 'Sussurra nomes de caçadores mortos há muito.',
        effect: 'hero_regen_step'
      },
      {
        id: 'relic_marshbone',
        name: 'Osso do Pântano',
        icon: '🦴',
        aIdx: 4,  // drops from Pântano boss
        desc: 'Criaturas capturadas entram com +20% do HP máximo.',
        flavor: 'Escorregadio. Fede a sal e morte.',
        effect: 'capture_bonus_hp'
      },
      {
        id: 'relic_peakcrystal',
        name: 'Cristal do Pico',
        icon: '💎',
        aIdx: 5,  // drops from Pico boss
        desc: 'Almas ganhas em batalha aumentadas em +25%.',
        flavor: 'Formado sob pressão impossível. Irradia frio.',
        effect: 'soul_boost'
      }
    ];

    // ══════════════════════════════════════════════════
    // HYBRID PASSIVES — unique to each hybrid element
    // Each hybrid gets 2 exclusive passives (lvl 1 + lvl 8)
    // ══════════════════════════════════════════════════
    var HYBRID_PASSIVES = {
      vapor: [
        { lvl: 1, id: 'vapor_blind', name: 'Névoa Permanente', desc: '15% chance de cegar o inimigo a cada golpe (reduz precisão por 1t)' },
        { lvl: 8, id: 'vapor_scald', name: 'Escaldante', desc: 'Queimadura causada por vapor dura 1t extra' }
      ],
      ashes: [
        { lvl: 1, id: 'ashes_dot', name: 'Brasas Vivas', desc: 'Queimadura causa +50% de dano por stack' },
        { lvl: 8, id: 'ashes_phoenix', name: 'Fênix das Cinzas', desc: 'Uma vez por batalha, sobrevive com 1 HP se for morto' }
      ],
      storm: [
        { lvl: 1, id: 'storm_chain', name: 'Descarga em Cadeia', desc: 'Críticos têm 30% de chance de paralizar o inimigo' },
        { lvl: 8, id: 'storm_surge', name: 'Maré Crescente', desc: 'Cada turno sem tomar dano: +8% ATK acumulado (máx 3x)' }
      ],
      magnet: [
        { lvl: 1, id: 'magnet_pull', name: 'Campo Gravitacional', desc: 'Inimigo começa a batalha com -15% DEF' },
        { lvl: 8, id: 'magnet_iron', name: 'Armadura de Ferro', desc: 'Recebe 20% menos dano de ataques físicos básicos' }
      ],
      twilight: [
        { lvl: 1, id: 'twilight_echo', name: 'Eco do Crepúsculo', desc: 'Primeiros 2 ataques da batalha causam dano duplo' },
        { lvl: 8, id: 'twilight_invert', name: 'Inversão', desc: 'Quando HP < 40%: troca ATK e DEF temporariamente' }
      ],
      ancient: [
        { lvl: 1, id: 'ancient_roots', name: 'Raízes Profundas', desc: 'Regenera 8% HP no fim de cada turno' },
        { lvl: 8, id: 'ancient_ward', name: 'Guardião Ancestral', desc: 'Recebe no máximo 25% do HP máximo por golpe' }
      ],
      voidarc: [
        { lvl: 1, id: 'voidarc_pierce', name: 'Lança do Vazio', desc: 'Todo ataque ignora 30% da DEF inimiga' },
        { lvl: 8, id: 'voidarc_feast', name: 'Festim das Trevas', desc: 'Ao matar: recupera 30% HP e ganha +20% ATK pelo resto da batalha' }
      ],
      aurora: [
        { lvl: 1, id: 'aurora_mend', name: 'Toque Curativo', desc: 'Cada ataque cura 8% do dano causado como HP' },
        { lvl: 8, id: 'aurora_shield', name: 'Escudo de Aurora', desc: 'Começa a batalha com ESCUDO equivalente a 20% do HP máximo' }
      ]
    };

    // ══════════════════════════════════════════════════
    // FUSION COMBINATION TABLE
    // Maps 'elA+elB' (sorted alphabetically) → hybrid element
    // ══════════════════════════════════════════════════
    var FUSION_COMBOS = {
      'fire+water': 'vapor',
      'fire+nature': 'ashes',
      'electric+water': 'storm',
      'earth+electric': 'magnet',
      'dark+light': 'twilight',
      'earth+nature': 'ancient',
      'dark+electric': 'voidarc',
      'light+water': 'aurora'
    };


    var DROP_RATES = { low: 0.06, mid: 0.11, high: 0.16, extreme: 0.23 };

    // Regen settings
    var REGEN_MS = 8000;
    var REGEN_TEAM = 0.01;
    var REGEN_HALL = 0.06;


    // ===== QUESTS =====
    // type: 'defeat_any' | 'defeat_el' | 'capture_any' | 'capture_el' | 'win_area'
    // reward: { souls, item } — item is ITEM_DEFS id or null
    var QUESTS = [
      // Area 0 — Planicie Cinzenta
      { id: 'q0a', area: 0, title: 'Primeiros Passos', desc: 'Derrote 3 criaturas na Planicie', type: 'defeat_any', areaIdx: 0, goal: 3, reward: { souls: 40, item: 'earth' } },
      { id: 'q0b', area: 0, title: 'Vinculador Iniciante', desc: 'Vincule uma criatura de qualquer tipo', type: 'capture_any', areaIdx: 0, goal: 1, reward: { souls: 60, item: 'fire' } },
      { id: 'q0c', area: 0, title: 'Dominador da Planicie', desc: 'Derrote 8 criaturas na Planicie', type: 'defeat_any', areaIdx: 0, goal: 8, reward: { souls: 120, item: null } },

      // Area 1 — Floresta Sombria
      { id: 'q1a', area: 1, title: 'Nas Sombras da Floresta', desc: 'Derrote 3 criaturas de Floresta', type: 'defeat_el', el: 'nature', goal: 3, reward: { souls: 80, item: 'nature' } },
      { id: 'q1b', area: 1, title: 'Alma da Floresta', desc: 'Vincule uma criatura de Natureza', type: 'capture_el', el: 'nature', goal: 1, reward: { souls: 100, item: 'water' } },
      { id: 'q1c', area: 1, title: 'Conquistador Sombrio', desc: 'Venca 6 batalhas na Floresta Sombria', type: 'win_area', areaIdx: 1, goal: 6, reward: { souls: 200, item: 'dark' } },

      // Area 2 — Ruinas Ardentes
      { id: 'q2a', area: 2, title: 'Chama das Ruinas', desc: 'Derrote 4 criaturas de Fogo', type: 'defeat_el', el: 'fire', goal: 4, reward: { souls: 140, item: 'fire' } },
      { id: 'q2b', area: 2, title: 'Guardiao da Chama', desc: 'Vincule uma criatura de Fogo', type: 'capture_el', el: 'fire', goal: 1, reward: { souls: 160, item: 'light' } },
      { id: 'q2c', area: 2, title: 'Senhor das Cinzas', desc: 'Venca 8 batalhas nas Ruinas', type: 'win_area', areaIdx: 2, goal: 8, reward: { souls: 320, item: null } },

      // Area 3 — Abismo Eterno
      { id: 'q3a', area: 3, title: 'Mergulho no Abismo', desc: 'Derrote 3 criaturas de Sombra', type: 'defeat_el', el: 'dark', goal: 3, reward: { souls: 200, item: 'dark' } },
      { id: 'q3b', area: 3, title: 'Luz nas Trevas', desc: 'Derrote 3 criaturas de Luz no Abismo', type: 'defeat_el', el: 'light', goal: 3, reward: { souls: 220, item: 'light' } },
      { id: 'q3c', area: 3, title: 'Conquistador do Vazio', desc: 'Venca 10 batalhas no Abismo', type: 'win_area', areaIdx: 3, goal: 10, reward: { souls: 500, item: null } },

      // Area 4 — Pantano Nebuloso
      { id: 'q4a', area: 4, title: 'Caminhante do Pantano', desc: 'Derrote 3 criaturas de Agua', type: 'defeat_el', el: 'water', goal: 3, reward: { souls: 80, item: 'water' } },
      { id: 'q4b', area: 4, title: 'Espiritos das Aguas', desc: 'Vincule uma criatura de Agua', type: 'capture_el', el: 'water', goal: 1, reward: { souls: 100, item: 'earth' } },
      { id: 'q4c', area: 4, title: 'Senhor do Pantano', desc: 'Venca 6 batalhas no Pantano', type: 'win_area', areaIdx: 4, goal: 6, reward: { souls: 200, item: 'nature' } },

      // Area 5 — Pico dos Trovoes
      { id: 'q5a', area: 5, title: 'Tempestade Inicial', desc: 'Derrote 4 criaturas de Trovao', type: 'defeat_el', el: 'electric', goal: 4, reward: { souls: 180, item: 'electric' } },
      { id: 'q5b', area: 5, title: 'Vincular o Relampago', desc: 'Vincule uma criatura Eletrica', type: 'capture_el', el: 'electric', goal: 1, reward: { souls: 200, item: 'light' } },
      { id: 'q5c', area: 5, title: 'Rei do Pico', desc: 'Venca 8 batalhas no Pico dos Trovoes', type: 'win_area', areaIdx: 5, goal: 8, reward: { souls: 400, item: null } }
    ];

    // ===== BOSS LAIR REQUIREMENTS (per area) =====
    // kills: enemies to defeat in that area before boss unlocks
    // items: items to find/collect before boss unlocks
    var BOSS_REQS = [
      { kills: 5, items: 1 },  // 0 Planicie Cinzenta
      { kills: 8, items: 2 },  // 1 Floresta Sombria
      { kills: 10, items: 2 },  // 2 Ruinas Ardentes
      { kills: 15, items: 3 },  // 3 Abismo Eterno
      { kills: 7, items: 2 },  // 4 Pantano Nebuloso
      { kills: 12, items: 3 },  // 5 Pico dos Trovoes
    ];

    // ===== EVOLUTION DATA =====
    // Each entry: base creature name -> evolved form

    // Evolution level threshold
    var EVO_LEVEL = 15;


    // ══════════════════════════════════════════════════
    // MOB PLANE VARIANTS
    // Same shapes/bodies, different name+color+stat mult
    // Plane 1 (Charneca Ardente) — endurecidos, +25% stats
    // Plane 2 (Abismo Espectral) — corrompidos, +50% stats
    // ══════════════════════════════════════════════════
    var MOB_PLANE_VARIANTS = {
      1: [
        { base: 'Rastejador', name: 'Rastejador Calcinado', color: 0xcc6622, statMult: 1.25 },
        { base: 'Sombra Verde', name: 'Sombra Ardente', color: 0x882200, statMult: 1.25 },
        { base: 'Braseiro', name: 'Braseiro Ancião', color: 0xff2200, statMult: 1.25 },
        { base: 'Espectro', name: 'Espectro Flamejante', color: 0x661100, statMult: 1.25 },
        { base: 'Lama Viva', name: 'Lama Fervente', color: 0xaa3300, statMult: 1.25 },
        { base: 'Rocha Viva', name: 'Rocha Fundida', color: 0x993322, statMult: 1.25 }
      ],
      2: [
        { base: 'Rastejador', name: 'Rastejador Corrompido', color: 0x6622aa, statMult: 1.5 },
        { base: 'Sombra Verde', name: 'Sombra do Abismo', color: 0x330066, statMult: 1.5 },
        { base: 'Braseiro', name: 'Braseiro Espectral', color: 0x440088, statMult: 1.5 },
        { base: 'Espectro', name: 'Espectro Ancião', color: 0x110033, statMult: 1.5 },
        { base: 'Lama Viva', name: 'Lama Corrompida', color: 0x331166, statMult: 1.5 },
        { base: 'Rocha Viva', name: 'Rocha do Vazio', color: 0x442266, statMult: 1.5 }
      ]
    };
  


    // ===== THREE.JS UTILS — CHIBI VOXEL CHARACTERS =====
    var SCNS = {};


    // ===== CREATURE CHIBI BODIES =====
    // buildCreatureBody(col, bodyType, evolved)
    // bodyType: 'lizard'|'golem'|'serpent'|'phantom'|'angel'|'treant'|'fox'
    // evolved: bool — adds extra features at level 15+

    function buildCreatureBody(col, bodyType, evolved) {
      var g = new THREE.Group();
      var V = 0.13;
      var base = new THREE.Color(col);
      var dark = new THREE.Color(col).multiplyScalar(0.40);
      var light = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.40);
      var glow = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.25);
      var black = new THREE.Color(0x111111);
      var white = new THREE.Color(0xeeeeee);

      function vox(w, h, d, px, py, pz, c, emit, parent) {
        var mat = new THREE.MeshStandardMaterial({
          color: c, roughness: 0.55, metalness: 0.05,
          emissive: emit ? (c instanceof THREE.Color ? c : new THREE.Color(c)) : new THREE.Color(0x000000),
          emissiveIntensity: emit || 0
        });
        var m = new THREE.Mesh(new THREE.BoxGeometry(w * V * 0.92, h * V * 0.92, d * V * 0.92), mat);
        m.position.set(px * V, py * V, pz * V);
        m.castShadow = true;
        (parent || g).add(m); return m;
      }

      var headGroup = new THREE.Group();
      headGroup.name = 'HeadGroup';
      var lArm, rArm, lLeg, rLeg, orbGroup, tail;

      // ─────────── LIZARD (fire) ───────────
      if (bodyType === 'lizard') {
        // Head — wide reptile snout
        headGroup.position.set(0, 8 * V, 0);
        vox(6, 5, 5, 0, 0, 0, base, 0, headGroup);           // skull
        vox(4, 2, 4, 0, -2.5, 0.4, dark, 0, headGroup);        // snout
        vox(1, 1, 0.7, -1.5, 0.5, 2.8, black, 0, headGroup);     // eye L
        vox(1, 1, 0.7, 1.5, 0.5, 2.8, black, 0, headGroup);     // eye R
        vox(0.6, 0.6, 0.5, -1.1, 0.9, 3.1, white, 0, headGroup); // shine L
        vox(0.6, 0.6, 0.5, 1.9, 0.9, 3.1, white, 0, headGroup); // shine R
        // Crest spikes on top
        var spkCol = evolved ? light : dark;
        [-2, 0, 2].forEach(function (sx) {
          vox(0.8, evolved ? 3.5 : 2.5, 0.8, sx, 3, 0, spkCol, evolved ? 0.3 : 0, headGroup);
        });
        if (evolved) { // extra side spikes
          vox(0.7, 2, 0.7, -3.5, 2, 0, spkCol, 0.2, headGroup);
          vox(0.7, 2, 0.7, 3.5, 2, 0, spkCol, 0.2, headGroup);
        }
        g.add(headGroup);

        // Torso — stocky, wide
        vox(6, 5, 4, 0, 2, 0, base);
        vox(6, 1, 4, 0, -0.2, 0, dark);                        // belly stripe
        vox(4, 1, 4, 0, 3.5, 0, light);                        // back highlight
        if (evolved) vox(5, 1.5, 3.5, 0, 4.5, 0, light, 0.2);  // evolved glow stripe

        // Arms — short powerful forelegs
        lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-4 * V, 3.5 * V, 0);
        vox(2, 3.5, 2, 0, -1, 0, base, 0, lArm); vox(2, 1.5, 2.5, 0, -3.5, 0.3, dark, 0, lArm);
        // claws
        [-0.6, 0, 0.6].forEach(function (cx) { vox(0.5, 1, 0.5, cx, -4.8, 0.5, dark, 0, lArm); });
        g.add(lArm);

        rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(4 * V, 3.5 * V, 0);
        vox(2, 3.5, 2, 0, -1, 0, base, 0, rArm); vox(2, 1.5, 2.5, 0, -3.5, 0.3, dark, 0, rArm);
        [-0.6, 0, 0.6].forEach(function (cx) { vox(0.5, 1, 0.5, cx, -4.8, 0.5, dark, 0, rArm); });
        g.add(rArm);

        // Legs
        lLeg = new THREE.Group(); lLeg.name = 'LLeg'; lLeg.position.set(-1.8 * V, 0, 0);
        vox(2.5, 3.5, 2.5, 0, -1.5, 0, dark, 0, lLeg); vox(2.5, 2, 3, 0, -4.5, 0.4, base, 0, lLeg);
        g.add(lLeg);
        rLeg = new THREE.Group(); rLeg.name = 'RLeg'; rLeg.position.set(1.8 * V, 0, 0);
        vox(2.5, 3.5, 2.5, 0, -1.5, 0, dark, 0, rLeg); vox(2.5, 2, 3, 0, -4.5, 0.4, base, 0, rLeg);
        g.add(rLeg);

        // Tail — 4 linked blocks decreasing in size
        tail = new THREE.Group(); tail.name = 'Tail'; tail.position.set(0, 0.5 * V, -2.5 * V);
        [[2.5, 2.5, 3], [2, 2, 2.5], [1.5, 1.5, 2], [1, 1, 1.5]].forEach(function (sz, i) {
          vox(sz[0], sz[1], sz[2], 0, 0, -(i * 2.2) - 1, i % 2 === 0 ? base : dark, 0, tail);
        });
        if (evolved) vox(0.8, 0.8, 1, 0, 0, -10, light, 0.5, tail); // glowing tip
        g.add(tail);

        // ─────────── GOLEM (earth) ───────────
      } else if (bodyType === 'golem') {
        // Head — square boulder
        headGroup.position.set(0, 8.5 * V, 0);
        vox(7, 6, 6, 0, 0, 0, base, 0, headGroup);              // main block
        vox(7, 0.8, 6, 0, -3, 0, dark, 0, headGroup);           // jaw crack
        vox(1.5, 1.5, 0.8, -2, 0.5, 3.2, black, 0, headGroup);  // eye L — angular
        vox(1.5, 1.5, 0.8, 2, 0.5, 3.2, black, 0, headGroup);  // eye R
        vox(1, 1, 0.6, -1.5, 0.9, 3.6, light, evolved ? 0.8 : 0.3, headGroup); // glow L
        vox(1, 1, 0.6, 2.5, 0.9, 3.6, light, evolved ? 0.8 : 0.3, headGroup); // glow R
        // Crystal shards on top
        [[0, 0], [-2.5, 0.5], [2.5, 0.5]].forEach(function (xz, i) {
          vox(1.2, evolved ? 5 : 3.5, 1.2, xz[0], 3, xz[1], light, evolved ? 0.4 : 0.1, headGroup);
        });
        if (evolved) {
          vox(1.2, 6, 1.2, -1.2, 3.5, 0, glow, 0.6, headGroup);
          vox(1.2, 6, 1.2, 1.2, 3.5, 0, glow, 0.6, headGroup);
        }
        g.add(headGroup);

        // Torso — massive rectangular
        vox(8, 6, 5, 0, 2, 0, base);
        vox(8, 1, 5, 0, 4.5, 0, dark);                          // top ledge
        vox(6, 1, 4, 0, -0.5, 0, light, 0.1);                   // core glow seam
        if (evolved) {
          vox(4, 2, 1, 0, 2, 2.6, light, 0.5);                // evolved: glowing chest crystal
          vox(2, 3, 0.8, 0, 2, 3, glow, 0.8);
        }

        // Arms — thick stone slabs
        lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-5 * V, 3.5 * V, 0);
        vox(3, 5, 3, 0, -1.5, 0, dark, 0, lArm);
        vox(3.5, 2, 3.5, 0, -5, 0.3, base, 0, lArm);           // fist
        if (evolved) vox(1, 2, 1, 0, -6.5, 0.3, light, 0.3, lArm);
        g.add(lArm);

        rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(5 * V, 3.5 * V, 0);
        vox(3, 5, 3, 0, -1.5, 0, dark, 0, rArm);
        vox(3.5, 2, 3.5, 0, -5, 0.3, base, 0, rArm);
        if (evolved) vox(1, 2, 1, 0, -6.5, 0.3, light, 0.3, rArm);
        g.add(rArm);

        // Legs — pillars
        lLeg = new THREE.Group(); lLeg.name = 'LLeg'; lLeg.position.set(-2 * V, 0, 0);
        vox(3.5, 4, 3.5, 0, -2, 0, base, 0, lLeg); vox(4, 2, 4, 0, -5.5, 0.3, dark, 0, lLeg);
        g.add(lLeg);
        rLeg = new THREE.Group(); rLeg.name = 'RLeg'; rLeg.position.set(2 * V, 0, 0);
        vox(3.5, 4, 3.5, 0, -2, 0, base, 0, rLeg); vox(4, 2, 4, 0, -5.5, 0.3, dark, 0, rLeg);
        g.add(rLeg);

        // ─────────── SERPENT (water) ───────────
      } else if (bodyType === 'serpent') {
        // Head — elongated with crest fin
        headGroup.position.set(0, 8 * V, 0);
        vox(5, 5, 6, 0, 0, 0, base, 0, headGroup);              // head
        vox(3, 1.5, 4, 0, -2.8, 0.5, dark, 0, headGroup);      // snout lower
        vox(1, 1, 0.8, -1.5, 0.8, 3.2, black, 0, headGroup);    // eye L
        vox(1, 1, 0.8, 1.5, 0.8, 3.2, black, 0, headGroup);    // eye R
        vox(0.6, 0.6, 0.5, -1.1, 1.1, 3.55, white, 0, headGroup);
        vox(0.6, 0.6, 0.5, 1.9, 1.1, 3.55, white, 0, headGroup);
        // Dorsal fin on top
        [[-1.5, 1.5], [0, 2.5], [1.5, 1.5]].forEach(function (xh) {
          vox(0.8, xh[1], 0.5, xh[0], xh[1] / 2 + 1, 0, light, evolved ? 0.4 : 0.1, headGroup);
        });
        // Whiskers
        vox(3, 0.5, 0.5, -3.5, -1.5, 2.5, light, 0.2, headGroup);
        vox(3, 0.5, 0.5, 3.5, -1.5, 2.5, light, 0.2, headGroup);
        if (evolved) {
          vox(1, 4, 0.8, 0, 4, 0, glow, 0.7, headGroup);     // tall crest
          vox(0.8, 3, 0.8, -1, 3.5, 0, glow, 0.5, headGroup);
          vox(0.8, 3, 0.8, 1, 3.5, 0, glow, 0.5, headGroup);
        }
        g.add(headGroup);

        vox(5, 5, 4, 0, 2, 0, base);
        vox(5, 1, 4, 0, 4, 0, light, 0.1);
        vox(3, 1, 3, 0, -0.2, 0, dark);
        if (evolved) vox(4, 2, 1, 0, 3, 2.6, glow, 0.5);      // belly glow

        // Arms — fins
        lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-3.5 * V, 4 * V, 0);
        vox(1.5, 4, 3, 0, -1.5, 0, base, 0, lArm);             // fin
        vox(2.5, 1, 4, 0, -4, 0, light, evolved ? 0.3 : 0.1, lArm);
        g.add(lArm);

        rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(3.5 * V, 4 * V, 0);
        vox(1.5, 4, 3, 0, -1.5, 0, base, 0, rArm);
        vox(2.5, 1, 4, 0, -4, 0, light, evolved ? 0.3 : 0.1, rArm);
        g.add(rArm);

        lLeg = new THREE.Group(); lLeg.name = 'LLeg'; lLeg.position.set(-1.5 * V, 0, 0);
        vox(2.5, 3.5, 2.5, 0, -1.5, 0, dark, 0, lLeg); vox(3, 1.5, 4, 0, -4.5, 0.5, base, 0, lLeg);
        g.add(lLeg);
        rLeg = new THREE.Group(); rLeg.name = 'RLeg'; rLeg.position.set(1.5 * V, 0, 0);
        vox(2.5, 3.5, 2.5, 0, -1.5, 0, dark, 0, rLeg); vox(3, 1.5, 4, 0, -4.5, 0.5, base, 0, rLeg);
        g.add(rLeg);

        // ─────────── PHANTOM (dark) ───────────
      } else if (bodyType === 'phantom') {
        // Head — floating skull-like
        headGroup.position.set(0, 9 * V, 0);
        vox(5.5, 5.5, 5, 0, 0, 0, dark, 0, headGroup);
        // Hollow glowing eyes — large and eerie
        vox(1.8, 2, 0.8, -1.5, 0.5, 2.7, base, 0.9, headGroup);
        vox(1.8, 2, 0.8, 1.5, 0.5, 2.7, base, 0.9, headGroup);
        vox(1, 1.2, 0.5, -1.5, 0.5, 3.1, white, 1.2, headGroup);
        vox(1, 1.2, 0.5, 1.5, 0.5, 3.1, white, 1.2, headGroup);
        // Jagged "crown" on top
        [-2, -0.5, 1].forEach(function (sx, i) {
          vox(0.8, evolved ? 3.5 + i * 0.5 : 2 + i * 0.5, 0.8, sx, 3 + i * 0.2, 0, base, evolved ? 0.5 : 0.2, headGroup);
        });
        if (evolved) {
          // Aura halo of dark particles
          for (var i = 0; i < 6; i++) {
            var a = i / 6 * Math.PI * 2;
            vox(0.5, 0.5, 0.5, Math.cos(a) * 4, 4, Math.sin(a) * 4, glow, 0.8, headGroup);
          }
        }
        g.add(headGroup);

        // Body — wispy, tapers downward
        vox(5, 4, 3.5, 0, 3, 0, dark, 0.1);
        vox(4, 3, 3, 0, 0.5, 0, dark, 0.05);
        vox(3, 2, 2.5, 0, -1.5, 0, dark, 0.15);               // wispy bottom
        if (evolved) {
          vox(4, 1, 3, 0, 4.2, 0, base, 0.4);               // collar glow
          vox(3, 1, 2.5, 0, 2, 0, glow, 0.3);
        }

        // Arms — ghostly wisps
        lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-3.5 * V, 3 * V, 0);
        vox(1.5, 5, 1.5, 0, -1, 0, dark, 0.1, lArm);
        vox(2, 1.5, 2, 0, -4.5, 0, base, evolved ? 0.6 : 0.3, lArm); // glowing hand
        g.add(lArm);

        rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(3.5 * V, 3 * V, 0);
        vox(1.5, 5, 1.5, 0, -1, 0, dark, 0.1, rArm);
        vox(2, 1.5, 2, 0, -4.5, 0, base, evolved ? 0.6 : 0.3, rArm);
        g.add(rArm);

        // Legs — fade into mist (short, no feet)
        lLeg = new THREE.Group(); lLeg.name = 'LLeg'; lLeg.position.set(-1.2 * V, 0, 0);
        vox(2, 3, 2, 0, -1.5, 0, dark, 0.15, lLeg); vox(1.5, 2, 1.5, 0, -4, 0, dark, 0.25, lLeg);
        g.add(lLeg);
        rLeg = new THREE.Group(); rLeg.name = 'RLeg'; rLeg.position.set(1.2 * V, 0, 0);
        vox(2, 3, 2, 0, -1.5, 0, dark, 0.15, rLeg); vox(1.5, 2, 1.5, 0, -4, 0, dark, 0.25, rLeg);
        g.add(rLeg);

        // ─────────── ANGEL (light) ───────────
      } else if (bodyType === 'angel') {
        // Head — radiant, warm
        headGroup.position.set(0, 9 * V, 0);
        vox(5.5, 5.5, 5, 0, 0, 0, light, 0, headGroup);
        vox(5.5, 2, 5, 0, 2.8, 0, base, 0.1, headGroup);       // hair
        vox(1, 1.5, 4, -3.2, 1.5, 0, base, 0, headGroup);      // hair side
        vox(1, 1.5, 4, 3.2, 1.5, 0, base, 0, headGroup);
        vox(1, 1, 0.7, -1.3, 0.3, 2.9, black, 0, headGroup);    // eye L
        vox(1, 1, 0.7, 1.3, 0.3, 2.9, black, 0, headGroup);    // eye R
        vox(0.6, 0.6, 0.5, -0.9, 0.6, 3.2, white, 0, headGroup);
        vox(0.6, 0.6, 0.5, 1.7, 0.6, 3.2, white, 0, headGroup);
        // Halo
        var haloR = evolved ? 4.5 : 3.5;
        for (var i = 0; i < 8; i++) {
          var a = i / 8 * Math.PI * 2;
          vox(0.8, 0.4, 0.8, Math.cos(a) * haloR, 4.5, Math.sin(a) * haloR, base, evolved ? 1.0 : 0.7, headGroup);
        }
        g.add(headGroup);

        // Body — slim, divine
        vox(5, 5, 3.5, 0, 2, 0, light, 0.05);
        vox(3, 1, 3, 0, 4.3, 0, base, 0.2);                    // shoulder glow
        vox(4, 1, 3, 0, -0.3, 0, base, 0.1);
        if (evolved) vox(3, 3, 1, 0, 2.5, 2, glow, 0.6);       // divine mark

        // Arms
        lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-3.5 * V, 4 * V, 0);
        vox(2, 4, 2, 0, -1.5, 0, light, 0, lArm);
        vox(1.8, 1.8, 2, 0, -4.5, 0.3, base, 0.1, lArm);
        g.add(lArm);

        rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(3.5 * V, 4 * V, 0);
        vox(2, 4, 2, 0, -1.5, 0, light, 0, rArm);
        vox(1.8, 1.8, 2, 0, -4.5, 0.3, base, 0.1, rArm);
        g.add(rArm);

        // Wings — large feathered panels
        var wingCol = evolved ? glow : light;
        var wingEm = evolved ? 0.5 : 0.15;
        var wL = new THREE.Group(); wL.name = 'WingL'; wL.position.set(-4 * V, 3 * V, 0);
        [[3, 6, 0.8, 0, 0, 0], [2.5, 4, 0.7, -1, -2, 0.3], [1.5, 2.5, 0.6, -2, -4, 0.5]].forEach(function (b) {
          vox(b[0], b[1], b[2], b[3], b[4], b[5], wingCol, wingEm, wL);
        });
        g.add(wL);
        var wR = new THREE.Group(); wR.name = 'WingR'; wR.position.set(4 * V, 3 * V, 0);
        [[3, 6, 0.8, 0, 0, 0], [2.5, 4, 0.7, 1, -2, 0.3], [1.5, 2.5, 0.6, 2, -4, 0.5]].forEach(function (b) {
          vox(b[0], b[1], b[2], b[3], b[4], b[5], wingCol, wingEm, wR);
        });
        g.add(wR);

        lLeg = new THREE.Group(); lLeg.name = 'LLeg'; lLeg.position.set(-1.5 * V, 0, 0);
        vox(2.2, 3.5, 2.2, 0, -1.5, 0, light, 0, lLeg); vox(2, 1.5, 3, 0, -4.2, 0.4, base, 0, lLeg);
        g.add(lLeg);
        rLeg = new THREE.Group(); rLeg.name = 'RLeg'; rLeg.position.set(1.5 * V, 0, 0);
        vox(2.2, 3.5, 2.2, 0, -1.5, 0, light, 0, rLeg); vox(2, 1.5, 3, 0, -4.2, 0.4, base, 0, rLeg);
        g.add(rLeg);

        // ─────────── TREANT (nature) ───────────
      } else if (bodyType === 'treant') {
        // Head — round mossy face
        headGroup.position.set(0, 8.5 * V, 0);
        vox(6, 6, 5.5, 0, 0, 0, dark, 0, headGroup);            // bark head
        vox(3, 1, 4, 0, 3.5, 0, base, 0.1, headGroup);          // moss top
        vox(5, 1, 4, 0, -3, 0, base, 0.05, headGroup);          // chin moss
        vox(1.2, 1.2, 0.8, -1.5, 0.3, 3, black, 0, headGroup);
        vox(1.2, 1.2, 0.8, 1.5, 0.3, 3, black, 0, headGroup);
        vox(0.7, 0.7, 0.5, -1.1, 0.7, 3.4, base, 0.4, headGroup);
        vox(0.7, 0.7, 0.5, 1.9, 0.7, 3.4, base, 0.4, headGroup);
        // Branches on top
        var bCol = evolved ? light : base;
        [[-2.5, 3, 0], [-1, 4.5, 0], [1, 4.5, 0], [2.5, 3, 0]].forEach(function (b) {
          vox(0.8, evolved ? 4 : 2.5, 0.8, b[0], b[1], b[2], bCol, evolved ? 0.2 : 0, headGroup);
        });
        // Leaf clusters on branches
        if (evolved) {
          [[-3, 6, 0], [0, 7, 0], [3, 6, 0]].forEach(function (b) {
            vox(2, 2, 2, b[0], b[1], b[2], base, 0.3, headGroup);
          });
        }
        g.add(headGroup);

        vox(6, 5, 4.5, 0, 2, 0, dark);
        vox(6, 1, 4.5, 0, 4.2, 0, base, 0.1);                  // moss line
        vox(4, 1, 3.5, 0, -0.2, 0, base, 0.05);
        if (evolved) {
          vox(5, 1.5, 4, 0, 3.5, 0, light, 0.3);
          vox(3, 1, 3, 0, 2, 0, base, 0.2);
        }

        // Vine arms
        lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-3.8 * V, 3.5 * V, 0);
        vox(2, 4.5, 2, 0, -1.5, 0, dark, 0, lArm);
        vox(2.5, 1.5, 2.5, 0, -4.5, 0.3, base, 0.1, lArm);
        // Leaf on hand
        vox(1.5, 0.8, 2, 0, -5.5, 0.5, base, evolved ? 0.4 : 0.1, lArm);
        g.add(lArm);

        rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(3.8 * V, 3.5 * V, 0);
        vox(2, 4.5, 2, 0, -1.5, 0, dark, 0, rArm);
        vox(2.5, 1.5, 2.5, 0, -4.5, 0.3, base, 0.1, rArm);
        vox(1.5, 0.8, 2, 0, -5.5, 0.5, base, evolved ? 0.4 : 0.1, rArm);
        g.add(rArm);

        lLeg = new THREE.Group(); lLeg.name = 'LLeg'; lLeg.position.set(-1.8 * V, 0, 0);
        vox(3, 4, 3, 0, -2, 0, dark, 0, lLeg); vox(3.5, 1.5, 3.5, 0, -5, 0.4, dark, 0, lLeg);
        // Root claws
        [-1, 0, 1].forEach(function (cx) { vox(0.6, 1.5, 0.6, cx, -6.5, 0.5, dark, 0, lLeg); });
        g.add(lLeg);
        rLeg = new THREE.Group(); rLeg.name = 'RLeg'; rLeg.position.set(1.8 * V, 0, 0);
        vox(3, 4, 3, 0, -2, 0, dark, 0, rLeg); vox(3.5, 1.5, 3.5, 0, -5, 0.4, dark, 0, rLeg);
        [-1, 0, 1].forEach(function (cx) { vox(0.6, 1.5, 0.6, cx, -6.5, 0.5, dark, 0, rLeg); });
        g.add(rLeg);

        // ─────────── FOX (electric) ───────────
      } else { // fox
        // Head — pointed ears, sharp
        headGroup.position.set(0, 8.5 * V, 0);
        vox(5.5, 5, 5, 0, 0, 0, base, 0, headGroup);            // skull
        vox(3.5, 2, 5, 0, -2, 0.5, light, 0, headGroup);        // pointed muzzle
        // Pointed ears — tall triangular
        vox(1.5, evolved ? 5 : 3.5, 1, -2.5, 3.5, 0, dark, 0, headGroup);
        vox(1.5, evolved ? 5 : 3.5, 1, 2.5, 3.5, 0, dark, 0, headGroup);
        vox(0.8, evolved ? 3 : 2, 0.8, -2.5, 3.5, 0.2, base, evolved ? 0.4 : 0.1, headGroup); // inner ear
        vox(0.8, evolved ? 3 : 2, 0.8, 2.5, 3.5, 0.2, base, evolved ? 0.4 : 0.1, headGroup);
        vox(1, 1, 0.7, -1.5, 0.5, 2.9, black, 0, headGroup);     // eyes
        vox(1, 1, 0.7, 1.5, 0.5, 2.9, black, 0, headGroup);
        vox(0.6, 0.6, 0.5, -1.1, 0.8, 3.2, base, 0.6, headGroup);// electric glow eyes
        vox(0.6, 0.6, 0.5, 1.9, 0.8, 3.2, base, 0.6, headGroup);
        // Whiskers with electricity
        vox(3, 0.4, 0.4, -4, -1.5, 2.5, base, 0.5, headGroup);
        vox(3, 0.4, 0.4, 4, -1.5, 2.5, base, 0.5, headGroup);
        g.add(headGroup);

        vox(5.5, 4.5, 3.5, 0, 2, 0, base);
        vox(4, 1, 3, 0, 4, 0, dark);
        vox(3.5, 1, 3, 0, -0.3, 0, light, 0.1);
        if (evolved) {
          vox(4, 1.5, 3, 0, 3.5, 0, base, 0.4);
          vox(2, 2, 1, 0, 2.5, 2.2, base, 0.7);              // chest lightning mark
        }

        lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-3.5 * V, 3.5 * V, 0);
        vox(2, 3.5, 2, 0, -1.5, 0, base, 0, lArm);
        vox(2, 1.5, 2, 0, -4.2, 0.3, dark, 0, lArm);
        g.add(lArm);

        rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(3.5 * V, 3.5 * V, 0);
        vox(2, 3.5, 2, 0, -1.5, 0, base, 0, rArm);
        vox(2, 1.5, 2, 0, -4.2, 0.3, dark, 0, rArm);
        g.add(rArm);

        lLeg = new THREE.Group(); lLeg.name = 'LLeg'; lLeg.position.set(-1.5 * V, 0, 0);
        vox(2.5, 3.5, 2.5, 0, -1.5, 0, base, 0, lLeg); vox(2.5, 1.5, 3, 0, -4.2, 0.4, dark, 0, lLeg);
        g.add(lLeg);
        rLeg = new THREE.Group(); rLeg.name = 'RLeg'; rLeg.position.set(1.5 * V, 0, 0);
        vox(2.5, 3.5, 2.5, 0, -1.5, 0, base, 0, rLeg); vox(2.5, 1.5, 3, 0, -4.2, 0.4, dark, 0, rLeg);
        g.add(rLeg);

        // Bushy tail — multiple layered blocks
        tail = new THREE.Group(); tail.name = 'Tail'; tail.position.set(0, 1 * V, -2.5 * V);
        var tW = evolved ? 4.5 : 3.5;
        [[tW, tW, 3.5], [tW - 0.5, tW - 0.5, 3], [tW - 1, tW - 1, 2.5]].forEach(function (sz, i) {
          vox(sz[0], sz[1], sz[2], 0, i * 0.5, -(i * 2.2) - 1, i === 0 ? base : light, evolved ? 0.3 : 0, tail);
        });
        // Lightning bolt on tail
        if (evolved) vox(1.5, 3, 0.8, 0, 1, -5, base, 0.8, tail);
        g.add(tail);
      }

      // ─────────── CANINE (wolf/dog) ───────────
      if (bodyType === 'canine') {
        headGroup.position.set(0, 7.5 * V, 1.5 * V);
        vox(5, 4.5, 5.5, 0, 0, 0, base, 0, headGroup);
        vox(3, 2.5, 3.5, 0, -2, 2.5, dark, 0, headGroup);       // muzzle
        vox(1, 1.5, 0.5, -1.2, 1.8, 2.7, white, 0, headGroup);   // fang L
        vox(1, 1.5, 0.5, 1.2, 1.8, 2.7, white, 0, headGroup);   // fang R
        vox(1, 1, 0.7, -1.3, 0.8, 2.8, black, 0, headGroup);     // eye L
        vox(1, 1, 0.7, 1.3, 0.8, 2.8, black, 0, headGroup);     // eye R
        vox(0.6, 0.5, 0.4, -0.8, 1.1, 3.1, white, 0, headGroup);
        vox(0.6, 0.5, 0.4, 1.6, 1.1, 3.1, white, 0, headGroup);
        vox(2, 3, 1.5, -2.2, 3, 0, dark, 0, headGroup);           // ear L
        vox(2, 3, 1.5, 2.2, 3, 0, dark, 0, headGroup);           // ear R
        vox(1.5, 2, 1, -2.2, 5, 0, base, 0, headGroup);           // ear tip L
        vox(1.5, 2, 1, 2.2, 5, 0, base, 0, headGroup);
        // torso
        vox(5, 5.5, 4.5, 0, 4.5, 0, base);
        vox(4, 3, 4, 0, 1.5, 0, dark);
        // arms
        lArm = new THREE.Group(); lArm.position.set(-3.5 * V, 5 * V, 0);
        vox(2, 4, 2, 0, -2, 0, dark, 0, lArm); vox(2.5, 1.5, 2.5, 0, -4.5, 0, base, 0, lArm);
        rArm = new THREE.Group(); rArm.position.set(3.5 * V, 5 * V, 0);
        vox(2, 4, 2, 0, -2, 0, dark, 0, rArm); vox(2.5, 1.5, 2.5, 0, -4.5, 0, base, 0, rArm);
        // legs
        lLeg = new THREE.Group(); lLeg.position.set(-2 * V, 1.5 * V, 0);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, lLeg); vox(3, 1.5, 3, 0, -4.5, 0, base, 0, lLeg);
        rLeg = new THREE.Group(); rLeg.position.set(2 * V, 1.5 * V, 0);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, rLeg); vox(3, 1.5, 3, 0, -4.5, 0, base, 0, rLeg);
        // tail
        tail = new THREE.Group(); tail.position.set(0, 3 * V, -3 * V);
        vox(2, 5, 2, 0, 1.5, 0, base, 0, tail); vox(1.5, 3, 1.5, 0.5, 5.5, -0.5, light, 0, tail);
        g.add(lArm); g.add(rArm); g.add(lLeg); g.add(rLeg); g.add(tail);
      }

      // ─────────── AVIAN (bird) ───────────
      if (bodyType === 'avian') {
        headGroup.position.set(0, 9 * V, 0.5 * V);
        vox(4.5, 4.5, 4.5, 0, 0, 0, base, 0, headGroup);
        vox(2, 1.5, 2, 0, -1.5, 2.5, glow, 0, headGroup);     // beak top
        vox(1.8, 1, 1.8, 0, -2.2, 2.2, dark, 0, headGroup);     // beak bottom
        vox(1, 1, 0.7, -1.2, 0.5, 2.8, black, 0, headGroup);
        vox(1, 1, 0.7, 1.2, 0.5, 2.8, black, 0, headGroup);
        vox(0.5, 0.5, 0.3, -0.7, 0.8, 3.1, white, 0, headGroup);
        vox(0.5, 0.5, 0.3, 1.5, 0.8, 3.1, white, 0, headGroup);
        vox(1.5, 2.5, 1, -2.3, 2, -0.5, light, 0, headGroup);    // crest
        vox(1, 3, 0.8, -2.5, 4, -0.8, base, 0.15, headGroup);
        // torso
        vox(4.5, 5, 3.5, 0, 4.5, 0.3, base);
        vox(3.5, 3, 3, 0, 1, 0, dark);
        // wings
        lArm = new THREE.Group(); lArm.position.set(-3.5 * V, 5.5 * V, 0);
        vox(4, 1.5, 5, -1.5, 0, -0.5, base, 0, lArm);
        vox(3, 1, 4, -2, 0, -0.3, dark, 0, lArm);
        vox(2, 0.8, 3, -2.5, 0, -0.1, light, 0.05, lArm);
        rArm = new THREE.Group(); rArm.position.set(3.5 * V, 5.5 * V, 0);
        vox(4, 1.5, 5, 1.5, 0, -0.5, base, 0, rArm);
        vox(3, 1, 4, 2, 0, -0.3, dark, 0, rArm);
        vox(2, 0.8, 3, 2.5, 0, -0.1, light, 0.05, rArm);
        // legs
        lLeg = new THREE.Group(); lLeg.position.set(-1.8 * V, 1.5 * V, 0);
        vox(1.8, 4, 1.8, 0, -2, 0, dark, 0, lLeg); vox(1.5, 1, 2.5, 0, -4.2, 0.8, base, 0, lLeg);
        rLeg = new THREE.Group(); rLeg.position.set(1.8 * V, 1.5 * V, 0);
        vox(1.8, 4, 1.8, 0, -2, 0, dark, 0, rLeg); vox(1.5, 1, 2.5, 0, -4.2, 0.8, base, 0, rLeg);
        g.add(lArm); g.add(rArm); g.add(lLeg); g.add(rLeg);
      }

      // ─────────── BESTIAL (chifres + garras + marcas) ───────────
      if (bodyType === 'bestial') {
        var beastRed = new THREE.Color(0xcc2200);
        headGroup.position.set(0, 9 * V, 0);
        vox(6, 6, 5.5, 0, 0, 0, base, 0.05, headGroup);
        vox(4, 2.5, 4, 0, -1.5, 2.2, dark, 0, headGroup);       // jaw
        vox(1, 1, 0.7, -1.5, 0.5, 2.9, black, 0, headGroup);
        vox(1, 1, 0.7, 1.5, 0.5, 2.9, black, 0, headGroup);
        vox(0.7, 0.7, 0.4, -1.0, 0.8, 3.2, beastRed, 0.6, headGroup); // glow eyes
        vox(0.7, 0.7, 0.4, 1.8, 0.8, 3.2, beastRed, 0.6, headGroup);
        // chifres curvados
        var hornMat = new THREE.MeshStandardMaterial({ color: 0x1a0800, roughness: 0.3, metalness: 0.5 });
        var addHorn = function (px, py, pz, side) {
          var h = new THREE.Group();
          var hv = function (w, ht, d, x, y, z) {
            var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, ht * V, d * V), hornMat);
            m.position.set(x * V, y * V, z * V); h.add(m);
          };
          hv(2, 3, 1.5, 0, 0, 0); hv(1.5, 3, 1.2, 0, 2.5, -0.8); hv(1, 2.5, 1, 0, 4.8, -1.8);
          h.position.set(px * V, py * V, pz * V); h.rotation.set(-0.5, side * 0.2, side * 0.1);
          headGroup.add(h);
        };
        addHorn(-2.8, 3, 0, -1); addHorn(2.8, 3, 0, 1);
        // torso musculoso
        vox(7, 6.5, 5, 0, 4.5, 0, base, 0.06);
        vox(5, 3, 4, 0, 1.5, 0, dark);
        vox(0.5, 4, 0.3, -1, 5, -2.4, beastRed, 0.4);  // cicatrizes
        vox(0.5, 3, 0.3, 1, 5, -2.4, beastRed, 0.3);
        // braços grossos com garras
        lArm = new THREE.Group(); lArm.position.set(-4.5 * V, 6 * V, 0);
        vox(2.5, 5, 2.5, 0, -2.5, 0, base, 0, lArm);
        vox(3, 2, 3, 0, -5.5, 0, dark, 0, lArm);
        vox(1.2, 1.5, 0.5, -1, -7, 0.5, beastRed, 0.3, lArm);
        vox(1.2, 1.5, 0.5, 1, -7, 0.5, beastRed, 0.3, lArm);
        rArm = new THREE.Group(); rArm.position.set(4.5 * V, 6 * V, 0);
        vox(2.5, 5, 2.5, 0, -2.5, 0, base, 0, rArm);
        vox(3, 2, 3, 0, -5.5, 0, dark, 0, rArm);
        vox(1.2, 1.5, 0.5, -1, -7, 0.5, beastRed, 0.3, rArm);
        vox(1.2, 1.5, 0.5, 1, -7, 0.5, beastRed, 0.3, rArm);
        // pernas
        lLeg = new THREE.Group(); lLeg.position.set(-2.2 * V, 1.5 * V, 0);
        vox(3, 5, 3, 0, -2.5, 0, dark, 0, lLeg); vox(3, 2, 3, 0, -5.5, 0, base, 0, lLeg);
        rLeg = new THREE.Group(); rLeg.position.set(2.2 * V, 1.5 * V, 0);
        vox(3, 5, 3, 0, -2.5, 0, dark, 0, rLeg); vox(3, 2, 3, 0, -5.5, 0, base, 0, rLeg);
        // cauda grossa
        tail = new THREE.Group(); tail.position.set(0, 2.5 * V, -3 * V);
        vox(2, 4, 2, 0, 1, 0, dark, 0, tail); vox(1.5, 3, 1.5, 0.3, 4, -1, beastRed, 0.2, tail);
        g.add(lArm); g.add(rArm); g.add(lLeg); g.add(rLeg); g.add(tail);
      }

      // ─────────── ANGELIC (auréola + asas) ───────────
      if (bodyType === 'angelic') {
        var angelGold = new THREE.Color(0xffd060);
        var angelWhite = new THREE.Color(0xffffff);
        var angelGlow2 = new THREE.Color(col).lerp(angelWhite, 0.65);
        headGroup.position.set(0, 9.5 * V, 0);
        vox(5.5, 5.5, 5, 0, 0, 0, angelGlow2, 0.08, headGroup);
        vox(5.5, 2, 5, 0, 2.8, 0, angelGold, 0.15, headGroup); // cabelo dourado
        vox(1.5, 2, 4, -3.3, 1.5, 0, angelGold, 0.08, headGroup);
        vox(1.5, 2, 4, 3.3, 1.5, 0, angelGold, 0.08, headGroup);
        vox(1, 1, 0.7, -1.3, 0.3, 2.9, black, 0, headGroup);
        vox(1, 1, 0.7, 1.3, 0.3, 2.9, black, 0, headGroup);
        vox(0.7, 0.7, 0.4, -0.8, 0.6, 3.2, new THREE.Color(0x88ccff), 0.8, headGroup);
        vox(0.7, 0.7, 0.4, 1.6, 0.6, 3.2, new THREE.Color(0x88ccff), 0.8, headGroup);
        // AURÉOLA — anel dourado brilhante
        var haloGroup = new THREE.Group();
        haloGroup.position.set(0, 4.2 * V, 0);
        var haloMat2 = new THREE.MeshStandardMaterial({
          color: 0xffd060, emissive: new THREE.Color(0xffd060),
          emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.15
        });
        for (var _hi = 0; _hi < 14; _hi++) {
          var _ha = (_hi / 14) * Math.PI * 2;
          var _hm = new THREE.Mesh(new THREE.BoxGeometry(0.7 * V, 0.35 * V, 0.35 * V), haloMat2);
          _hm.position.set(Math.cos(_ha) * 3.4 * V, 0, Math.sin(_ha) * 3.4 * V);
          _hm.rotation.y = _ha;
          haloGroup.add(_hm);
        }
        headGroup.add(haloGroup);
        g.userData.haloGroup = haloGroup;
        // torso
        vox(5, 6, 4.5, 0, 4.5, 0, angelGlow2, 0.06);
        vox(3.5, 2.5, 3.5, 0, 1, 0, angelWhite, 0.04);
        vox(0.5, 3, 0.3, 0, 5.5, -2.4, angelGold, 0.55); // cruz
        vox(2.5, 0.5, 0.3, 0, 6.2, -2.4, angelGold, 0.55);
        // ASAS
        var wMatA = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xffeedd), emissiveIntensity: 0.18, roughness: 0.4 });
        var makeWing = function (side) {
          var wg = new THREE.Group();
          var fw = function (px, py, w, h) {
            var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, 0.35 * V), wMatA);
            m.position.set(px * V, py * V, 0); wg.add(m);
          };
          fw(side * 1, 0, 3, 6); fw(side * 3.5, 0.5, 2.5, 5);
          fw(side * 5.5, 0, 2, 4); fw(side * 7, 0, 1.5, 3);
          wg.position.set(side * 3 * V, 5 * V, -1 * V);
          wg.rotation.z = side * 0.32;
          return wg;
        }
        g.add(makeWing(-1)); g.add(makeWing(1));
        // braços
        lArm = new THREE.Group(); lArm.position.set(-3.5 * V, 6.5 * V, 0);
        vox(2, 5, 2, 0, -2.5, 0, angelGlow2, 0.04, lArm); vox(2.5, 2, 2.5, 0, -5.5, 0, angelWhite, 0.08, lArm);
        rArm = new THREE.Group(); rArm.position.set(3.5 * V, 6.5 * V, 0);
        vox(2, 5, 2, 0, -2.5, 0, angelGlow2, 0.04, rArm); vox(2.5, 2, 2.5, 0, -5.5, 0, angelWhite, 0.08, rArm);
        // pernas
        lLeg = new THREE.Group(); lLeg.position.set(-1.8 * V, 1.5 * V, 0);
        vox(2.2, 5, 2.2, 0, -2.5, 0, angelGlow2, 0.03, lLeg); vox(2.5, 1.5, 2.5, 0, -5.5, 0, angelWhite, 0, lLeg);
        rLeg = new THREE.Group(); rLeg.position.set(1.8 * V, 1.5 * V, 0);
        vox(2.2, 5, 2.2, 0, -2.5, 0, angelGlow2, 0.03, rLeg); vox(2.5, 1.5, 2.5, 0, -5.5, 0, angelWhite, 0, rLeg);
        g.add(lArm); g.add(rArm); g.add(lLeg); g.add(rLeg);
      }

      // ── FLOATING ORB (all types) ──
      orbGroup = new THREE.Group(); orbGroup.name = 'Orb';
      orbGroup.position.set(5.5 * V, 9.5 * V, 0);
      var orbMat = new THREE.MeshStandardMaterial({
        color: col, emissive: col,
        emissiveIntensity: evolved ? 2.0 : 1.2, roughness: 0.2
      });
      var orbSize = evolved ? V * 2.5 : V * 2;
      var orbCore = new THREE.Mesh(new THREE.BoxGeometry(orbSize, orbSize, orbSize), orbMat);
      orbGroup.add(orbCore);
      // Orbit ring
      var orbRing = new THREE.Mesh(
        new THREE.BoxGeometry(V * (evolved ? 4 : 3), V * 0.5, V * 0.5),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 })
      );
      orbGroup.add(orbRing);
      if (evolved) {
        // Second orbit ring perpendicular
        var orbRing2 = new THREE.Mesh(
          new THREE.BoxGeometry(V * 0.5, V * 4, V * 0.5),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 })
        );
        orbGroup.add(orbRing2);
      }
      g.add(orbGroup);

      // Store refs for animation
      g.userData.headGroup = headGroup;
      g.userData.lArm = lArm;
      g.userData.rArm = rArm;
      g.userData.lLeg = lLeg;
      g.userData.rLeg = rLeg;
      g.userData.orbGroup = orbGroup;
      g.userData.tail = tail || null;
      g.userData.evolved = evolved || false;

      return g;
    }

    // Build a chibi-style voxel character mesh from element color
    // Style ref: chunky head (~40% of height), short torso, stubby limbs

    // ===== CHIBI CREATURE BUILDER — shape-based bodies + evolved variants =====
    // shape: 'spiky'|'round'|'fluid'|'crystal'|'star'|'beast'
    // evolved: bool — if true, builds the enhanced post-evolution form
    function buildChibiChar(col, shape, evolved) {
      var group = new THREE.Group();
      var V = 0.13;
      evolved = !!evolved;

      var base = new THREE.Color(col);
      var dark = new THREE.Color(col).multiplyScalar(0.42);
      var light = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.38);
      var white = new THREE.Color(0xeeeeee);
      var black = new THREE.Color(0x111111);
      var gold = new THREE.Color(0xffd700);

      function vox(w, h, d, px, py, pz, color, emit, parent) {
        var mat = new THREE.MeshStandardMaterial({
          color: color, roughness: 0.55, metalness: evolved ? 0.15 : 0.04,
          emissive: emit ? (color instanceof THREE.Color ? color : new THREE.Color(color)) : new THREE.Color(0x000000),
          emissiveIntensity: emit || 0
        });
        var m = new THREE.Mesh(new THREE.BoxGeometry(w * V * 0.92, h * V * 0.92, d * V * 0.92), mat);
        m.position.set(px * V, py * V, pz * V);
        m.castShadow = true;
        (parent || group).add(m);
        return m;
      }

      // ── SHARED: big chibi head ──
      var hG = new THREE.Group();
      hG.position.set(0, 8.5 * V, 0);
      vox(6, 6, 6, 0, 0, 0, base, 0, hG);
      vox(6, 2, 6, 0, 3, 0, dark, 0, hG);   // hair
      vox(1, 2, 4, -3.5, 2, 0, dark, 0, hG);
      vox(1, 2, 4, 3.5, 2, 0, dark, 0, hG);
      vox(4, 3, 1, 0, -0.5, 3.1, light, 0, hG);   // face panel
      vox(1, 1, 0.8, -1.2, 0.2, 3.2, black, 0, hG);   // eye L
      vox(1, 1, 0.8, 1.2, 0.2, 3.2, black, 0, hG);   // eye R
      vox(0.5, 0.5, 0.5, -0.8, 0.5, 3.55, white, 0, hG);
      vox(0.5, 0.5, 0.5, 1.5, 0.5, 3.55, white, 0, hG);
      vox(0.8, 0.6, 0.5, -0.8, -1.5, 3.45, dark, 0, hG);
      vox(1.2, 0.5, 0.5, 0, -1.7, 3.45, dark, 0, hG);
      vox(0.8, 0.6, 0.5, 0.8, -1.5, 3.45, dark, 0, hG);
      vox(1.5, 0.8, 0.5, -2, -0.8, 3.3, new THREE.Color(0xffa0a0), 0, hG);
      vox(1.5, 0.8, 0.5, 2, -0.8, 3.3, new THREE.Color(0xffa0a0), 0, hG);
      if (evolved) {
        // Glowing eyes on evolved
        vox(1.2, 1.2, 0.6, -1.2, 0.2, 3.3, base, 1.5, hG);
        vox(1.2, 1.2, 0.6, 1.2, 0.2, 3.3, base, 1.5, hG);
      }
      group.add(hG);

      // ── ARMS & LEGS (shared, styled per shape via scale) ──
      var lA = new THREE.Group(); lA.name = 'LArm'; lA.position.set(-3.8 * V, 4 * V, 0);
      var rA = new THREE.Group(); rA.name = 'RArm'; rA.position.set(3.8 * V, 4 * V, 0);
      var lL = new THREE.Group(); lL.name = 'LLeg'; lL.position.set(-1.5 * V, 0, 0);
      var rL = new THREE.Group(); rL.name = 'RLeg'; rL.position.set(1.5 * V, 0, 0);

      // ── SHAPE-SPECIFIC BODY ──
      if (shape === 'spiky') {
        // Spiky: aggressive, serrated back, forward-leaning torso, tail
        vox(6, 5, 4, 0, 2, 0, base);              // torso
        vox(6, 1, 4, 0, -0.5, 0, dark);           // belt
        vox(2, 1.5, 1, 0, 3.5, 2.2, light);          // chest
        // Spines on back
        var spineCol = evolved ? gold : light;
        vox(1, 3, 1, 0, 6, -2, spineCol, evolved ? 0.6 : 0);
        vox(1, 2, 1, -1, 5, -2, spineCol, evolved ? 0.5 : 0);
        vox(1, 2, 1, 1, 5, -2, spineCol, evolved ? 0.5 : 0);
        vox(1, 4, 1, 0, 7, -1.5, spineCol, evolved ? 0.7 : 0); // tall center spine
        // Tail
        vox(1.5, 1.5, 3, 0, -1, -2, dark);
        vox(1, 1, 2, 0, -1.5, -4, dark);
        vox(0.8, 0.8, 2, 0, -2, -5.5, dark);
        if (evolved) {
          vox(1, 1, 1, -1, -2.5, -6.5, base, 0.4);
          vox(1, 1, 1, 1, -2.5, -6.5, base, 0.4);
        }
        // Arms — clawed
        vox(2, 1.5, 2, 0, -0.5, 0, base, 0, lA);
        vox(1.8, 3, 1.8, 0, -2.5, 0, dark, 0, lA);
        vox(1, 1, 0.8, -0.7, -4.3, 0.5, dark, 0, lA); // claw L
        vox(1, 1, 0.8, 0.7, -4.3, 0.5, dark, 0, lA); // claw R
        vox(2, 1.5, 2, 0, -0.5, 0, base, 0, rA);
        vox(1.8, 3, 1.8, 0, -2.5, 0, dark, 0, rA);
        vox(1, 1, 0.8, -0.7, -4.3, 0.5, dark, 0, rA);
        vox(1, 1, 0.8, 0.7, -4.3, 0.5, dark, 0, rA);
        // Legs
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, lL); vox(2.2, 2, 2.5, 0, -5, 0, base, 0, lL); vox(2.5, 1, 3, 0.2, -6.5, 0.4, dark, 0, lL);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, rL); vox(2.2, 2, 2.5, 0, -5, 0, base, 0, rL); vox(2.5, 1, 3, 0.2, -6.5, 0.4, dark, 0, rL);
        if (evolved) {
          // Head horns
          vox(1, 4, 1, -1.5, 5.5, 0.5, spineCol, 0.8, hG);
          vox(1, 4, 1, 1.5, 5.5, 0.5, spineCol, 0.8, hG);
        }

      } else if (shape === 'round') {
        // Round: fat, wide body, stubby limbs, cute ears on head
        vox(7, 6, 5, 0, 2, 0, base);              // wide torso
        vox(7, 1.5, 5, 0, -0.5, 0, dark);            // belly stripe
        vox(3, 2, 1, 0, 3.5, 2.5, light);          // chest patch
        // Ear nubs on head
        vox(1.5, 2.5, 1.5, -3.2, 3.5, 0, base, 0, hG);
        vox(1.5, 2.5, 1.5, 3.2, 3.5, 0, base, 0, hG);
        vox(0.8, 1.5, 0.8, -3.2, 4, 0, light, 0, hG); // inner ear
        vox(0.8, 1.5, 0.8, 3.2, 4, 0, light, 0, hG);
        // Stubby arms
        vox(2.5, 2, 2.5, 0, -0.5, 0, base, 0, lA); vox(2, 1.5, 2, 0, -2.8, 0, dark, 0, lA);
        vox(2.5, 2, 2.5, 0, -0.5, 0, base, 0, rA); vox(2, 1.5, 2, 0, -2.8, 0, dark, 0, rA);
        // Stubby legs
        vox(3, 3, 3, 0, -1.5, 0, dark, 0, lL); vox(3, 1.5, 3.5, 0.2, -4.2, 0.4, dark, 0, lL);
        vox(3, 3, 3, 0, -1.5, 0, dark, 0, rL); vox(3, 1.5, 3.5, 0.2, -4.2, 0.4, dark, 0, rL);
        lA.position.set(-4.5 * V, 3 * V, 0);
        rA.position.set(4.5 * V, 3 * V, 0);
        if (evolved) {
          // Crown
          vox(1.5, 3, 1.5, -1, 5, 0, gold, 0.9, hG);
          vox(2.5, 1.5, 1.5, 0, 6, 0, gold, 0.7, hG);
          vox(1.5, 3, 1.5, 1, 5, 0, gold, 0.9, hG);
          vox(2, 2, 1, 0, 3.5, -2.5, dark, 0); // fluffy tail
          vox(2.5, 2, 1, 0, 2.5, -3.5, dark, 0);
        }

      } else if (shape === 'fluid') {
        // Fluid: serpentine, sinuous, coiled tail, fin on back
        vox(5, 5, 4, 0, 2, 0, base);              // torso
        vox(5, 1.5, 4, 0, -0.5, 0, light, 0.1);      // belly sheen
        // Back fin
        vox(1, 5, 1, 0, 6, -1.5, light, evolved ? 0.5 : 0.1);
        vox(1, 3, 1, -1, 5, -1.5, light, evolved ? 0.4 : 0.1);
        vox(1, 3, 1, 1, 5, -1.5, light, evolved ? 0.4 : 0.1);
        // Long coiled tail
        vox(2, 1.5, 2.5, 0, -0.5, -2.5, base);
        vox(1.8, 1.3, 2, 0, -1, -5, base);
        vox(1.5, 1.2, 1.8, 0.5, -1.5, -7, dark);
        vox(1, 1, 1.5, 1, -2, -8.5, dark);
        // Scale pattern
        vox(0.8, 0.8, 0.5, 1, 2.5, 2.2, dark);
        vox(0.8, 0.8, 0.5, -1, 1.5, 2.2, dark);
        vox(0.8, 0.8, 0.5, 1, 0.5, 2.2, dark);
        // Arms — flipper-like
        vox(3, 1.5, 1.5, 0, -0.5, 0, base, 0, lA); vox(2.5, 1, 1, 0, -2.5, 0, light, evolved ? 0.3 : 0, lA);
        vox(3, 1.5, 1.5, 0, -0.5, 0, base, 0, rA); vox(2.5, 1, 1, 0, -2.5, 0, light, evolved ? 0.3 : 0, rA);
        lA.position.set(-3.5 * V, 4.5 * V, 0);
        rA.position.set(3.5 * V, 4.5 * V, 0);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, lL); vox(2, 2, 2.5, 0, -5, 0, base, 0, lL); vox(2.5, 1, 3, 0, -6.5, 0.2, base, 0, lL);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, rL); vox(2, 2, 2.5, 0, -5, 0, base, 0, rL); vox(2.5, 1, 3, 0, -6.5, 0.2, base, 0, rL);
        if (evolved) {
          // Extra frills on head
          vox(0.8, 4, 0.8, -3, 3, 0.5, light, 0.6, hG);
          vox(0.8, 4, 0.8, 3, 3, 0.5, light, 0.6, hG);
          vox(0.8, 3, 0.8, -3.5, 1, 0, light, 0.4, hG);
          vox(0.8, 3, 0.8, 3.5, 1, 0, light, 0.4, hG);
        }

      } else if (shape === 'crystal') {
        // Crystal: angular, sharp, crystals growing from body
        vox(5, 5, 4, 0, 2, 0, dark);              // dark base body
        vox(3, 3, 2, 0, 3, 1.5, base, 0.1);        // glowing chest crystal
        // Shoulder crystals
        vox(1.5, 4, 1.5, -3, 4.5, 0, base, evolved ? 0.6 : 0.2);
        vox(1.5, 4, 1.5, 3, 4.5, 0, base, evolved ? 0.6 : 0.2);
        vox(1, 3, 1, -2, 6.5, 0, light, evolved ? 0.9 : 0.4);
        vox(1, 3, 1, 2, 6.5, 0, light, evolved ? 0.9 : 0.4);
        // Back shard cluster
        vox(1, 5, 1, 0, 6.5, -1, base, evolved ? 0.7 : 0.3);
        vox(1, 4, 1, 1, 5.5, -1, base, evolved ? 0.5 : 0.2);
        vox(1, 4, 1, -1, 5.5, -1, base, evolved ? 0.5 : 0.2);
        vox(6, 1, 4, 0, -0.5, 0, base, 0.1);        // glowing belt
        // Arms — crystalline
        vox(2, 1.5, 2, 0, -0.5, 0, dark, 0, lA);
        vox(1.8, 2, 1.8, 0, -2.5, 0, dark, 0, lA);
        vox(1, 3, 1, -0.5, -4, 0.5, base, evolved ? 0.5 : 0.15, lA); // crystal hand
        vox(2, 1.5, 2, 0, -0.5, 0, dark, 0, rA);
        vox(1.8, 2, 1.8, 0, -2.5, 0, dark, 0, rA);
        vox(1, 3, 1, 0.5, -4, 0.5, base, evolved ? 0.5 : 0.15, rA);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, lL); vox(2, 2, 2.5, 0, -5, 0, dark, 0, lL); vox(2.5, 1, 3, 0, -6.5, 0.2, base, 0.1, lL);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, rL); vox(2, 2, 2.5, 0, -5, 0, dark, 0, rL); vox(2.5, 1, 3, 0, -6.5, 0.2, base, 0.1, rL);
        if (evolved) {
          // Crown of shards
          vox(1, 5, 1, -1.5, 5.5, 0, light, 1.2, hG);
          vox(1, 6, 1, 0, 6, 0, base, 1.5, hG);
          vox(1, 5, 1, 1.5, 5.5, 0, light, 1.2, hG);
        }

      } else if (shape === 'star') {
        // Star: ethereal, floating, wing-like arms, halo
        vox(5, 5, 3, 0, 2, 0, base);
        vox(5, 1, 3, 0, -0.5, 0, light, 0.2);       // glowing waist
        vox(2, 2, 1, 0, 3.5, 1.8, light, 0.3);      // chest star
        // Halo
        vox(6, 0.7, 0.7, 0, 13.5, 0, light, evolved ? 1.2 : 0.8, hG);
        vox(0.7, 6, 0.7, 0, 13.5, 0, light, evolved ? 1.2 : 0.8, hG);
        vox(4.5, 0.7, 0.7, 0, 13.5, 0, base, 0.4, hG);
        // Wings on arms
        vox(5, 4, 0.8, 0, -1, 0, light, 0.4, lA);   // wing panel
        vox(3, 2, 0.8, -1, -4, 0, light, 0.2, lA);   // wing tip
        vox(5, 4, 0.8, 0, -1, 0, light, 0.4, rA);
        vox(3, 2, 0.8, 1, -4, 0, light, 0.2, rA);
        lA.position.set(-4 * V, 5 * V, 0); rA.position.set(4 * V, 5 * V, 0);
        // Floating effect — small clouds under feet
        vox(3, 1, 2.5, 0, -1, 0, light, 0.2, lL);
        vox(3, 1, 2.5, 0, -1, 0, light, 0.2, rL);
        lL.position.set(-1.5 * V, 0.5 * V, 0); rL.position.set(1.5 * V, 0.5 * V, 0);
        if (evolved) {
          // Second larger halo
          vox(9, 0.7, 0.7, 0, 14.5, 0, gold, 1.0, hG);
          vox(0.7, 9, 0.7, 0, 14.5, 0, gold, 1.0, hG);
          // Extra wing feathers
          vox(2, 5, 0.6, -1.5, -1.5, 0.5, base, 0.5, lA);
          vox(2, 5, 0.6, 1.5, -1.5, 0.5, base, 0.5, rA);
        }

      } else {
        // Default beast: wolf/quadruped proportions
        vox(6, 5, 4, 0, 2, 0, base);
        vox(6, 1, 4, 0, -0.5, 0, dark);
        vox(2, 2, 1, 0, 3.5, 2.2, light);
        // Mane / collar
        vox(7, 2, 4.5, 0, 4.5, 0, dark);
        vox(2, 1.5, 2, 0, -0.5, 0, base, 0, lA);
        vox(1.8, 3, 1.8, 0, -2.5, 0, dark, 0, lA);
        vox(1.5, 1.5, 2, 0, -4.5, 0.3, dark, 0, lA);
        vox(2, 1.5, 2, 0, -0.5, 0, base, 0, rA);
        vox(1.8, 3, 1.8, 0, -2.5, 0, dark, 0, rA);
        vox(1.5, 1.5, 2, 0, -4.5, 0.3, dark, 0, rA);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, lL); vox(2.2, 2, 2.5, 0, -5, 0, base, 0, lL); vox(2.5, 1, 3, 0.2, -6.5, 0.4, dark, 0, lL);
        vox(2.5, 4, 2.5, 0, -2, 0, dark, 0, rL); vox(2.2, 2, 2.5, 0, -5, 0, base, 0, rL); vox(2.5, 1, 3, 0.2, -6.5, 0.4, dark, 0, rL);
        if (evolved) {
          vox(1.5, 4, 1, -1.5, 4.5, 0, dark, 0, hG); // wolf ears
          vox(1.5, 4, 1, 1.5, 4.5, 0, dark, 0, hG);
          // Bushy tail
          vox(2, 4, 2, 0, -1, -3, base);
          vox(2.5, 2, 2.5, 0, -1.5, -5, light, 0.2);
        }
      }

      group.add(lA); group.add(rA); group.add(lL); group.add(rL);

      // ── EVOLVED: body aura overlay + gold trim ──
      if (evolved) {
        // Gold trim at waist
        vox(7, 0.8, 5, 0, -0.2, 0, gold, 0.6);
        // Glowing outline on shoulders
        vox(8, 1, 5, 0, 5.8, 0, base, 0.4);
      }

      // ── FLOATING ORB (element color) ──
      var orbG = new THREE.Group(); orbG.name = 'Orb';
      orbG.position.set(5 * V, 9 * V, 0);
      var orbMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: evolved ? 1.8 : 1.2, roughness: 0.2 });
      orbG.add(new THREE.Mesh(new THREE.BoxGeometry(V * 2, V * 2, V * 2), orbMat));
      orbG.add(new THREE.Mesh(new THREE.BoxGeometry(V * 3, V * 0.5, V * 0.5), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: evolved ? 1.4 : 0.8 })));
      if (evolved) {
        // Second orbiting mini-orb
        var orb2 = new THREE.Mesh(new THREE.BoxGeometry(V * 1.2, V * 1.2, V * 1.2),
          new THREE.MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: 2.0 }));
        orb2.position.set(-V * 3, V * 1.5, 0);
        orbG.add(orb2);
      }
      group.add(orbG);

      group.userData.headGroup = hG;
      group.userData.lArm = lA; group.userData.rArm = rA;
      group.userData.lLeg = lL; group.userData.rLeg = rL;
      group.userData.orbGroup = orbG;
      group.userData.evolved = evolved;
      return group;
    }


    function spawnS(wid, c) {
      killS(wid);
      var w = document.getElementById(wid); if (!w) return;
      // Compute battle arena dimensions from viewport
      // Each fighter panel = half of full viewport width (minus center col ~70px)
      // Arena height = viewport minus cards area
      // Use parent container dimensions so creatures stay centered
      // regardless of browser zoom level
      var _parent = w.parentElement || w;
      var _arena = document.querySelector('.b-arena') || document.getElementById('battle');
      var _cardsEl = document.querySelector('.cards-area');
      var _cardsH = _cardsEl ? (_cardsEl.offsetHeight || 130) : 130;
      // Use offsetWidth of parent fighter panel for accurate size
      var W = _parent.offsetWidth > 50 ? _parent.offsetWidth : Math.floor((_arena ? _arena.offsetWidth : window.innerWidth * (window._uiScale || 1)) / 2 - 35);
      var H = _parent.offsetHeight > 100 ? _parent.offsetHeight : Math.floor((window.innerHeight * (window._uiScale || 1)) - _cardsH);
      if (W < 120) W = 200;
      if (H < 200) H = 300;
      // Set explicit pixel size on cwrap so canvas fills it correctly
      w.style.width = W + 'px';
      w.style.height = H + 'px';
      var rend = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      rend.setSize(W, H);
      rend.setPixelRatio(Math.min(devicePixelRatio, 2));
      rend.shadowMap.enabled = true;
      w.appendChild(rend.domElement);

      var scene = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(48, W / H, 0.1, 100);
      // Slightly elevated angle — isometric-ish view like the chibi ref
      cam.position.set(0, 1.4, 3.8);
      cam.lookAt(0, 0.5, 0);

      // Lighting — 3-point like in the reference image
      scene.add(new THREE.AmbientLight(0xffffff, 0.45));
      var keyL = new THREE.DirectionalLight(0xfff8ee, 1.4);
      keyL.position.set(3, 5, 4);
      keyL.castShadow = true;
      scene.add(keyL);
      var fillL = new THREE.DirectionalLight(0x8ab0ff, 0.5);
      fillL.position.set(-4, 2, -2);
      scene.add(fillL);
      // Hybrid creatures use blended color, otherwise use element color
      var baseCol = (c._blendCol !== undefined) ? c._blendCol : (EL[c.el] ? EL[c.el].col : 0xffffff);
      var rimL = new THREE.DirectionalLight(new THREE.Color(baseCol), 0.8);
      rimL.position.set(0, -2, -5);
      scene.add(rimL);

      var col = baseCol;
      // For hybrids: add a subtle second-color glow from parent elements
      if (c._parentEls && c._parentEls.length === 2 && EL[c._parentEls[1]]) {
        var secondCol = EL[c._parentEls[1]].col;
        var accentL = new THREE.PointLight(new THREE.Color(secondCol), 0.4, 6);
        accentL.position.set(2, 1, 0);
        scene.add(accentL);
      }
      var isEvolved = !!(c.evolved) || (c.level >= 15);
      var mesh;
      // 1. Se a criatura tem builder de mapa próprio, reutilizar na batalha (escala maior)
      if (c.tplName && typeof MOB_MESH_BUILDERS !== 'undefined' && MOB_MESH_BUILDERS[c.tplName]) {
        mesh = MOB_MESH_BUILDERS[c.tplName]();
        // Escalar para o tamanho de batalha (mobs do mapa são menores)
        var _mapScale = isEvolved ? 2.8 : 2.4;
        mesh.scale.setScalar(_mapScale);
      } else if (c.body && c.body !== 'generic') {
        // 2. Body type definido (lizard, golem, canine, avian, bestial, angelic...)
        mesh = buildCreatureBody(col, c.body, isEvolved);
      } else {
        // 3. Fallback chibi genérico
        mesh = buildChibiChar(col, c.shape, isEvolved);
      }

      // Aplicar visuais de cicatriz se a criatura tiver histórico
      if (typeof applyScarVisuals === 'function') applyScarVisuals(mesh, c);

      // Scale slightly with level — more imposing as they grow
      var s = (c.evolved ? 0.92 : 0.80) + Math.min(c.level, 25) * 0.008;
      mesh.scale.setScalar(s);
      mesh.position.y = -0.5;
      scene.add(mesh);

      // Floating element particles ring
      var pArr = [];
      for (var i = 0; i < 18; i++) {
        var a = (i / 18) * Math.PI * 2;
        var r = 1.1 + Math.random() * 0.25;
        pArr.push(Math.cos(a) * r, (Math.random() - 0.5) * 0.3, Math.sin(a) * r);
      }
      var pG = new THREE.BufferGeometry();
      pG.setAttribute('position', new THREE.Float32BufferAttribute(pArr, 3));
      var pts = new THREE.Points(pG, new THREE.PointsMaterial({
        color: col, size: 0.045, transparent: true, opacity: 0.6
      }));
      pts.position.y = -0.2;
      scene.add(pts);

      var t = 0;
      var ud = mesh.userData;
      var c_scale = (c.evolved ? 0.92 : 0.80) + Math.min(c.level || 1, 25) * 0.008;
      function loop() {
        var id = requestAnimationFrame(loop);
        SCNS[wid].animId = id;
        t += 0.016;

        // Gentle idle bob
        mesh.position.y = -0.5 + Math.sin(t * 1.1) * 0.04;

        // Slow Y rotation — show off the character
        mesh.rotation.y = Math.sin(t * 0.4) * 0.35;

        // Head gentle tilt
        if (ud.headGroup) ud.headGroup.rotation.z = Math.sin(t * 0.7) * 0.06;
        if (ud.headGroup) ud.headGroup.rotation.x = Math.sin(t * 0.5) * 0.04;

        // Arm idle swing
        if (ud.lArm) ud.lArm.rotation.x = Math.sin(t * 1.1) * 0.18;
        if (ud.rArm) ud.rArm.rotation.x = -Math.sin(t * 1.1) * 0.18;

        // Leg tiny shift
        if (ud.lLeg) ud.lLeg.rotation.x = Math.sin(t * 1.1) * 0.08;
        if (ud.rLeg) ud.rLeg.rotation.x = -Math.sin(t * 1.1) * 0.08;

        // Orb orbit
        if (ud.orbGroup) {
          ud.orbGroup.rotation.y += 0.04;
          ud.orbGroup.position.y = (9 + Math.sin(t * 2.2) * 1.2) * 0.13;
        }

        pts.rotation.y -= 0.006;
        rimL.intensity = 0.6 + Math.sin(t * 2.0) * 0.3;

        // Element particle animation
        var sc = SCNS[wid];
        if (sc && sc._particles) {
          var pVisible = sc._attackAnim ? 1.0 : 0.50;
          // During attack: particles scatter outward (bigger radius)
          var pRadiusMult = sc._attackAnim ? (1.0 + Math.sin(sc._attackAnim.t * Math.PI) * 0.5) : 1.0;
          for (var _pi = 0; _pi < sc._particles.length; _pi++) {
            var _p = sc._particles[_pi];
            _p._angle += _p._speed * 0.018;
            _p.position.x = Math.cos(_p._angle) * _p._radius * pRadiusMult;
            _p.position.z = Math.sin(_p._angle) * _p._radius * pRadiusMult;
            _p.position.y = -0.1 + Math.sin(t * 1.8 + _p._yPhase) * _p._yAmp;
            _p.material.opacity = pVisible * (0.5 + Math.sin(t * 2 + _pi) * 0.3);
          }
        }

        // Attack lunge animation
        if (sc && sc._attackAnim) {
          var atk = sc._attackAnim;
          atk.t += 0.07;  // slightly slower = more dramatic
          var progress = Math.sin(atk.t * Math.PI); // 0→1→0 arc
          // Lunge toward opponent + slight Z advance
          mesh.position.x = atk.baseX + atk.dir * progress * 0.70;
          mesh.position.z = -0.5 + progress * (-0.25); // step forward
          // Scale punch: grow at peak then snap back
          var scl = 1.0 + progress * 0.18;
          mesh.scale.setScalar((c_scale || 0.88) * scl);
          // Tilt body forward during lunge
          mesh.rotation.z = atk.dir * progress * -0.18;
          if (atk.t >= 1.0) {
            mesh.position.x = atk.baseX;
            mesh.position.z = -0.5;
            mesh.rotation.z = 0;
            mesh.scale.setScalar(c_scale || 0.88);
            sc._attackAnim = null;
          }
        }

        rend.render(scene, cam);
      }

      SCNS[wid] = {
        rend: rend, mesh: mesh, pl: rimL, scene: scene, cam: cam, animId: null,
        _attackAnim: null,  // { t, dir, baseX }
        _particles: []      // element particle meshes
      };

      // ── Element particles: floating cubes around creature ──
      var elCol = new THREE.Color(col);
      var particleGroup = new THREE.Group();
      var PART_COUNT = 12;  // more particles = richer effect
      for (var pi = 0; pi < PART_COUNT; pi++) {
        var _pSize = 0.05 + Math.random() * 0.06;  // varied cube sizes
        var pGeom = new THREE.BoxGeometry(_pSize, _pSize, _pSize);
        var pMat = new THREE.MeshBasicMaterial({ color: elCol, transparent: true, opacity: 0.55 });
        var pMesh = new THREE.Mesh(pGeom, pMat);
        pMesh._angle = (pi / PART_COUNT) * Math.PI * 2;
        pMesh._radius = 0.6 + Math.random() * 0.35;
        pMesh._speed = 0.5 + Math.random() * 0.7;
        pMesh._yPhase = Math.random() * Math.PI * 2;
        pMesh._yAmp = 0.20 + Math.random() * 0.20;
        particleGroup.add(pMesh);
        SCNS[wid]._particles.push(pMesh);
      }
      scene.add(particleGroup);
      SCNS[wid]._partGroup = particleGroup;

      loop();
    }

    function killS(wid) {
      var s = SCNS[wid]; if (!s) return;
      cancelAnimationFrame(s.animId);
      s.rend.dispose();
      var w = document.getElementById(wid);
      if (w && s.rend.domElement.parentNode === w) w.removeChild(s.rend.domElement);
      delete SCNS[wid];
    }

    function flashS(wid) {
      var s = SCNS[wid]; if (!s) return;
      // Flash all materials in the mesh white
      s.mesh.traverse(function (child) {
        if (child.isMesh) {
          var origColor = child.material.color.getHex();
          child.material.emissive.setHex(0xffffff);
          child.material.emissiveIntensity = 1.5;
          setTimeout(function () {
            if (child.material) {
              child.material.emissive.setHex(0x000000);
              child.material.emissiveIntensity = 0;
            }
          }, 160);
        }
      });
    }

    // ===== MAP CHIBI MESHES =====

    // Player chibi for the overworld map — 3 class variants
    // weapon: 'sword' | 'staff' | 'bow'
    function buildMapPlayerMesh(playerName, weapon) {
      var g = new THREE.Group();
      var V = 0.055;
      weapon = weapon || 'sword';

      function vox(w, h, d, px, py, pz, col, emit, parent) {
        var mat = new THREE.MeshStandardMaterial({
          color: col, roughness: 0.55,
          emissive: emit ? col : 0x000000,
          emissiveIntensity: emit || 0
        });
        var m = new THREE.Mesh(new THREE.BoxGeometry(w * V * 0.92, h * V * 0.92, d * V * 0.92), mat);
        m.position.set(px * V, py * V, pz * V);
        m.castShadow = true;
        (parent || g).add(m);
        return m;
      }

      // ── Shared: HEAD ──
      vox(5, 5, 5, 0, 10, 0, 0xf5c8a0);        // face
      vox(5, 2, 5, 0, 13.2, 0, 0x1a1a3a);       // hair top
      vox(1, 3, 3, -3, 11, 0, 0x1a1a3a);        // hair side L
      vox(1, 3, 3, 3, 11, 0, 0x1a1a3a);        // hair side R
      vox(1, 1, 0.6, -1.2, 10.6, 2.7, 0x111111); // eye L
      vox(1, 1, 0.6, 1.2, 10.6, 2.7, 0x111111); // eye R
      vox(0.6, 0.6, 0.5, -0.8, 11.1, 3.0, 0xffffff); // shine L
      vox(0.6, 0.6, 0.5, 1.5, 11.1, 3.0, 0xffffff); // shine R
      vox(0.7, 0.5, 0.5, 0, 9.5, 2.8, 0xd4906a); // mouth

      // ── CLASS-SPECIFIC BODY + ARMS + WEAPON ──
      if (weapon === 'sword') {
        // ── WARRIOR: armour, broad shoulders ──
        vox(6, 5, 3.5, 0, 5.5, 0, 0x334466);    // chest plate
        vox(6, 1, 3.5, 0, 3.8, 0, 0x8b6914);    // gold belt
        vox(2, 1, 3.5, -3.5, 7.5, 0, 0x556688); // pauldron L
        vox(2, 1, 3.5, 3.5, 7.5, 0, 0x556688); // pauldron R
        vox(1, 5, 3.5, -3.2, 5.5, 0, 0x445577); // armour side L
        vox(1, 5, 3.5, 3.2, 5.5, 0, 0x445577); // armour side R
        // cape
        vox(5, 6, 1, 0, 6, -2, 0x8b1a1a);

        // arms — armoured
        var lArm = new THREE.Group(); lArm.name = 'LArm';
        lArm.position.set(-4.2 * V, 6 * V, 0);
        vox(2, 4, 2, 0, -1, 0, 0x445577, 0, lArm); vox(1.5, 1.5, 2, 0, -3.8, 0.3, 0xf5c8a0, 0, lArm);
        g.add(lArm);

        var rArm = new THREE.Group(); rArm.name = 'RArm';
        rArm.position.set(4.2 * V, 6 * V, 0);
        vox(2, 4, 2, 0, -1, 0, 0x445577, 0, rArm); vox(1.5, 1.5, 2, 0, -3.8, 0.3, 0xf5c8a0, 0, rArm);
        // SWORD in right hand
        vox(0.8, 9, 0.8, 0, -8, 0.5, 0xdddddd, 0, rArm);   // blade
        vox(0.5, 7, 0.4, 0, -8, 0.9, 0x88ddff, 0.4, rArm); // blade glow edge
        vox(4, 0.8, 0.8, 0, -4, 0.5, 0x666633, 0, rArm);   // guard
        vox(0.8, 2, 0.8, 0, -2.5, 0.5, 0x443311, 0, rArm);  // grip
        g.add(rArm);

        // legs — greaves
        var lL = new THREE.Group(); lL.name = 'LLeg'; lL.position.set(-1.5 * V, 0, 0);
        vox(2.5, 3, 2.5, 0, -1.5, 0, 0x223355, 0, lL); vox(2.2, 2, 2.5, 0, -4, 0, 0x334466, 0, lL); vox(2.5, 1.5, 3, 0.2, -5.8, 0.4, 0x1a1a2a, 0, lL);
        g.add(lL);
        var rL = new THREE.Group(); rL.name = 'RLeg'; rL.position.set(1.5 * V, 0, 0);
        vox(2.5, 3, 2.5, 0, -1.5, 0, 0x223355, 0, rL); vox(2.2, 2, 2.5, 0, -4, 0, 0x334466, 0, rL); vox(2.5, 1.5, 3, 0.2, -5.8, 0.4, 0x1a1a2a, 0, rL);
        g.add(rL);

      } else if (weapon === 'staff') {
        // ── MAGE: long robe, wide sleeves, pointed details ──
        vox(5, 7, 3, 0, 5, 0, 0x2a1a4a);        // dark robe torso
        vox(7, 2, 3, 0, 9, 0, 0x2a1a4a);        // wide shoulder yoke
        vox(3, 1, 3, 0, 3.5, 0, 0x7a3aaa);      // robe accent
        // rune on chest
        vox(1, 2, 0.5, 0, 6.5, 1.7, 0xcc88ff, 0.7);
        vox(2, 1, 0.5, 0, 6.5, 1.7, 0xcc88ff, 0.6);
        // cape/robe back long
        vox(5, 8, 1, 0, 4, -2, 0x1a0a2a);

        // arms — wide sleeves
        var lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-4 * V, 7 * V, 0);
        vox(2.5, 5, 2.5, 0, -2, 0, 0x2a1a4a, 0, lArm); vox(1.5, 1.5, 1.5, 0, -5, 0.3, 0xf5c8a0, 0, lArm);
        g.add(lArm);

        var rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(4 * V, 7 * V, 0);
        vox(2.5, 5, 2.5, 0, -2, 0, 0x2a1a4a, 0, rArm); vox(1.5, 1.5, 1.5, 0, -5, 0, 0xf5c8a0, 0, rArm);
        // STAFF — tall, crystal top
        vox(1, 14, 1, 0, -9, 0, 0x4a3218, 0, rArm);       // wood shaft
        vox(3, 3, 3, 0, 6, 0, 0x9933ff, 0.5, rArm);      // crystal orb
        vox(1.5, 1.5, 1.5, 0, 8, 0, 0xcc88ff, 0.9, rArm);   // inner glow
        vox(4, 0.8, 0.8, 0, 5.5, 0, 0x6622aa, 0.2, rArm);    // cross piece
        g.add(rArm);

        // legs — robe bottom, shorter legs visible
        var lL = new THREE.Group(); lL.name = 'LLeg'; lL.position.set(-1.5 * V, 0, 0);
        vox(2.5, 4, 2.5, 0, -2, 0, 0x2a1a4a, 0, lL); vox(2, 1.5, 3, 0.2, -4.5, 0.4, 0x1a0a2a, 0, lL);
        g.add(lL);
        var rL = new THREE.Group(); rL.name = 'RLeg'; rL.position.set(1.5 * V, 0, 0);
        vox(2.5, 4, 2.5, 0, -2, 0, 0x2a1a4a, 0, rL); vox(2, 1.5, 3, 0.2, -4.5, 0.4, 0x1a0a2a, 0, rL);
        g.add(rL);

      } else { // bow
        // ── RANGER: light tunic, hood, quiver on back ──
        vox(5, 5, 3, 0, 5.5, 0, 0x2a4a1a);      // green tunic
        vox(5, 1, 3, 0, 3.8, 0, 0x5a3a0a);      // leather belt
        vox(5, 2, 3, 0, 9, 0, 0x2a4a1a);      // shoulder piece
        // hood over head
        vox(6, 2, 6, 0, 13.5, 0, 0x1a3a0a);
        vox(1, 4, 4, -3.5, 11.5, -0.5, 0x1a3a0a); // hood side L
        vox(1, 4, 4, 3.5, 11.5, -0.5, 0x1a3a0a); // hood side R
        // quiver on back
        vox(1.5, 5, 1.5, 1.5, 6.5, -2.2, 0x5a3a0a); // quiver body
        vox(0.6, 3, 0.6, 1, 8.5, -2.2, 0x4a2800);   // arrow shaft 1
        vox(0.6, 3, 0.6, 2, 8, -2.2, 0x4a2800);   // arrow shaft 2
        vox(0.6, 0.6, 0.6, 1, 10, -2.2, 0xdddd44);   // arrowhead 1
        vox(0.6, 0.6, 0.6, 2, 9.5, -2.2, 0xdddd44);   // arrowhead 2

        // left arm holds bow
        var lArm = new THREE.Group(); lArm.name = 'LArm'; lArm.position.set(-4 * V, 6.5 * V, 0);
        vox(2, 4, 2, 0, -1.5, 0, 0x2a4a1a, 0, lArm); vox(1.5, 1.5, 2, 0, -4, 0.3, 0xf5c8a0, 0, lArm);
        // BOW — curved shape via angled blocks
        vox(1, 10, 1, 0, -5, 1, 0x5a3a0a, 0, lArm);  // bow stave
        vox(0.5, 4, 0.5, -1, -1, 1, 0x5a3a0a, 0, lArm); // tip top angled
        vox(0.5, 4, 0.5, 1, -8, 1, 0x5a3a0a, 0, lArm); // tip bottom angled
        vox(0.3, 9, 0.3, 0, -4.5, 1.5, 0xddddaa, 0.1, lArm); // bowstring
        g.add(lArm);

        var rArm = new THREE.Group(); rArm.name = 'RArm'; rArm.position.set(4 * V, 6.5 * V, 0);
        vox(2, 4, 2, 0, -1.5, 0, 0x2a4a1a, 0, rArm); vox(1.5, 1.5, 2, 0, -4, 0.3, 0xf5c8a0, 0, rArm);
        g.add(rArm);

        // legs — leather pants
        var lL = new THREE.Group(); lL.name = 'LLeg'; lL.position.set(-1.5 * V, 0, 0);
        vox(2.5, 3.5, 2.5, 0, -1.5, 0, 0x3a2810, 0, lL); vox(2.2, 2, 2.5, 0, -4, 0, 0x4a3418, 0, lL); vox(2.5, 1.5, 3, 0.2, -5.8, 0.4, 0x2a1a08, 0, lL);
        g.add(lL);
        var rL = new THREE.Group(); rL.name = 'RLeg'; rL.position.set(1.5 * V, 0, 0);
        vox(2.5, 3.5, 2.5, 0, -1.5, 0, 0x3a2810, 0, rL); vox(2.2, 2, 2.5, 0, -4, 0, 0x4a3418, 0, rL); vox(2.5, 1.5, 3, 0.2, -5.8, 0.4, 0x2a1a08, 0, rL);
        g.add(rL);
      }

      // Store limb refs for animation
      g.userData.weapon = weapon;
      g.userData.lArm = g.getObjectByName('LArm');
      g.userData.rArm = g.getObjectByName('RArm');
      g.userData.lLeg = g.getObjectByName('LLeg');
      g.userData.rLeg = g.getObjectByName('RLeg');
      g.userData.walkT = 0;
      g.userData.isPlayer = true;
      return g;
    }

    // Animal chibi mobs — each biome gets a distinct creature
    var MOB_MESH_BUILDERS = {
      // Biome 0,4: Rastejador = little lizard (green)
      'Rastejador': function () {
        var g = new THREE.Group(); var V = 0.052;
        function v(w, h, d, px, py, pz, col) { var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m; }
        // body
        v(5, 3, 7, 0, 4, 0, 0x3a8a28);
        // head — big chibi
        v(5, 5, 5, 0, 7.5, 1, 0x4aaa32);
        v(1, 1, 0.5, -1.5, 8, 3, 0x111111); v(1, 1, 0.5, 1.5, 8, 3, 0x111111); // eyes
        v(6, 1, 2, 0, 5, 2.5, 0x2a6a18); // eye ridge
        // tail
        v(3, 2, 4, 0, 3, -3, 0x3a8a28);
        v(2, 2, 3, 0, 2.5, -6, 0x3a8a28);
        v(1, 1, 3, 0, 2, -9, 0x3a8a28);
        // legs — stubby 4
        v(2, 3, 2, -3.5, 2, 1, 0x2a6a18); v(2, 3, 2, 3.5, 2, 1, 0x2a6a18);
        v(2, 3, 2, -3, 2, -2, 0x2a6a18); v(2, 3, 2, 3, 2, -2, 0x2a6a18);
        return g;
      },
      // Biome 1,4: Sombra Verde = wolf (dark green/grey)
      'Sombra Verde': function () {
        var g = new THREE.Group(); var V = 0.055;
        function v(w, h, d, px, py, pz, col) { var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m; }
        var fur = 0x2a3a22, dark = 0x1a2a14, light = 0xc8c8a0;
        v(6, 5, 8, 0, 5, 0, fur);       // body
        v(6, 6, 6, 0, 9.5, 2, fur);     // head chibi big
        v(2, 3, 1, -2, 13, 2, dark);      // ear L
        v(2, 3, 1, 2, 13, 2, dark);      // ear R
        v(3, 2, 3, 0, 7.5, 4.5, light);  // snout
        v(1, 1, 0.5, -1.5, 10, 4.5, 0x111122); v(1, 1, 0.5, 1.5, 10, 4.5, 0x111122); // eyes
        v(2, 1, 1, 0, 6.5, 3.5, 0x111111); // nose
        v(2, 8, 2, 0, 4, -4.5, fur);      // tail up
        v(2, 3, 2, 0, 8, -5, fur);
        // legs 4
        v(2.5, 4, 2.5, -3, 2, 1.5, dark); v(2.5, 4, 2.5, 3, 2, 1.5, dark);
        v(2.5, 4, 2.5, -3, 2, -2, dark); v(2.5, 4, 2.5, 3, 2, -2, dark);
        return g;
      },
      // Biome 2: Braseiro = salamander (fire red/orange)
      'Braseiro': function () {
        var g = new THREE.Group(); var V = 0.050;
        function v(w, h, d, px, py, pz, col, emit) { var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col, emissiveIntensity: emit || 0 }); var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m; }
        v(5, 3, 8, 0, 3.5, 0, 0xcc3300);      // body
        v(5, 5, 5, 0, 7, 2, 0xdd4400);      // head
        v(1, 1, 0.5, -1.5, 8, 3, 0xff6600, 0.5); // eyes glow
        v(1, 1, 0.5, 1.5, 8, 3, 0xff6600, 0.5);
        v(2, 1, 2, 0, 6, 3.5, 0x111111);        // nostrils
        // Fire crest on back
        v(1, 4, 1, -1, 7, -1, 0xff4400, 0.8);
        v(1, 5, 1, 0, 8, -1, 0xff6600, 0.9);
        v(1, 4, 1, 1, 7, -1, 0xff4400, 0.8);
        // tail
        v(3, 2, 4, 0, 3, -4, 0xaa2200); v(2, 2, 3, 0, 2.5, -7, 0x882200); v(1, 2, 2, 0, 2, -9, 0x661100);
        // legs
        v(2, 3, 2, -3.5, 1.5, 1.5, 0xaa2200); v(2, 3, 2, 3.5, 1.5, 1.5, 0xaa2200);
        v(2, 3, 2, -3, 1.5, -2, 0xaa2200); v(2, 3, 2, 3, 1.5, -2, 0xaa2200);
        return g;
      },
      // Biome 3: Espectro = bat (dark purple)
      'Espectro': function () {
        var g = new THREE.Group(); var V = 0.055;
        function v(w, h, d, px, py, pz, col, emit) { var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: emit || 0 }); var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m; }
        var purp = 0x3a1a5a, dpurp = 0x220a3a, pink = 0xdd44aa;
        v(5, 4, 4, 0, 5, 0, purp);       // body
        v(5, 5, 5, 0, 9, 0, purp);       // head chibi
        v(1.5, 2, 0.6, -1.5, 12, 0, dpurp);// ear L
        v(1.5, 2, 0.6, 1.5, 12, 0, dpurp);// ear R
        v(1, 1, 0.5, -1.5, 9.5, 2.8, 0xff0066, 0.8); // eyes glow
        v(1, 1, 0.5, 1.5, 9.5, 2.8, 0xff0066, 0.8);
        // Wings spread (flat panels)
        v(9, 5, 1, -7, 6, -0.5, dpurp);
        v(9, 5, 1, 7, 6, -0.5, dpurp);
        v(4, 3, 0.5, -12, 4, -0.5, purp);
        v(4, 3, 0.5, 12, 4, -0.5, purp);
        // tiny legs dangling
        v(1.5, 3, 1.5, -1.5, 2, 0, dpurp); v(1.5, 3, 1.5, 1.5, 2, 0, dpurp);
        return g;
      },
      // Biome 4: Lama Viva = frog (swamp blue-green)
      'Lama Viva': function () {
        var g = new THREE.Group(); var V = 0.055;
        function v(w, h, d, px, py, pz, col) { var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 })); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m; }
        var teal = 0x1a6a5a, dteal = 0x0e4a3a, light = 0x88ddbb;
        v(7, 4, 7, 0, 3, 0, teal);        // body wide
        v(7, 5, 7, 0, 7.5, 0, teal);      // head BIG (frog = mostly head)
        v(2, 1, 1, -4, 10, 0, teal);        // eye bump L
        v(2, 1, 1, 4, 10, 0, teal);        // eye bump R
        v(1.5, 1.5, 0.5, -4, 10.5, 1.5, 0x111111); // eye L
        v(1.5, 1.5, 0.5, 4, 10.5, 1.5, 0x111111); // eye R
        v(7, 1, 2, 0, 5, 3.5, light);      // belly stripe
        v(8, 1, 1, 0, 6, 3.8, dteal);      // mouth line
        // back legs — powerful
        v(4, 2, 5, -5, 1, 2, dteal); v(4, 2, 5, 5, 1, 2, dteal);
        v(3, 1, 6, -6, 0.5, 4.5, teal); v(3, 1, 6, 6, 0.5, 4.5, teal); // webbed feet
        // front arms — small
        v(2.5, 3, 2, -5, 4, -0.5, teal); v(2.5, 3, 2, 5, 4, -0.5, teal);
        return g;
      },
      // Biome 5: Rocha Viva = bear (grey/slate)
      'Rocha Viva': function () {
        var g = new THREE.Group(); var V = 0.058;
        function v(w, h, d, px, py, pz, col) { var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 })); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m; }
        var grey = 0x5a6070, dgrey = 0x3a4050, light = 0x9aa0aa;
        v(8, 6, 8, 0, 5, 0, grey);        // big chunky body
        v(7, 6, 7, 0, 10.5, 0.5, grey);   // head
        v(2, 2, 1, -4, 14, 0, grey);        // ear L
        v(2, 2, 1, 4, 14, 0, grey);        // ear R
        v(1.5, 1.5, 1, -2.5, 14.2, 0, dgrey); // inner ear L
        v(1.5, 1.5, 1, 2.5, 14.2, 0, dgrey); // inner ear R
        v(4, 3, 4, 0, 8, 3, light);       // snout/muzzle
        v(1, 1, 0.5, -1.5, 9.5, 4.5, 0x111111); v(1, 1, 0.5, 1.5, 9.5, 4.5, 0x111111); // eyes
        v(2, 1, 1, 0, 7.5, 4.5, dgrey);     // nose
        // thick arms
        v(3, 6, 3, -6, 5.5, 0, grey); v(3, 6, 3, 6, 5.5, 0, grey);
        v(3, 2, 4, -6, 1.5, 0.5, dgrey); v(3, 2, 4, 6, 1.5, 0.5, dgrey); // paws
        // legs
        v(3.5, 5, 4, -3, 1.5, 0.5, dgrey); v(3.5, 5, 4, 3, 1.5, 0.5, dgrey);
        v(4, 2, 5, -3, -.5, 1, grey); v(4, 2, 5, 3, -.5, 1, grey); // feet
        return g;
      },

      // ── Biome 0: Grifo Cinza — bird-like (light/nature, glides above plains)
      'Grifo Cinza': function () {
        var g = new THREE.Group(); var V = 0.052;
        function v(w, h, d, px, py, pz, col, em) { var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col, emissiveIntensity: em || 0 }); var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); }
        var beige = 0xc8b888, cream = 0xe8dcc0, tan = 0xa89868;
        v(5, 3, 7, 0, 5, 0, beige);       // body
        v(5, 5, 5, 0, 9, 1.5, beige);     // head
        v(2, 3, 1, -1.5, 12, 1, tan);       // ear/crest L
        v(2, 3, 1, 1.5, 12, 1, tan);       // ear/crest R
        v(1, 1, 0.5, -1.5, 10, 3, 0x221100); v(1, 1, 0.5, 1.5, 10, 3, 0x221100); // eyes
        v(2, 1, 2, 0, 8, 3.5, tan);        // beak
        // Wings — wide spread
        v(10, 1, 5, -9, 7, -1, beige);      // wing L
        v(10, 1, 5, 9, 7, -1, beige);      // wing R
        v(5, 1, 3, -14, 5, -1, cream);      // wingtip L
        v(5, 1, 3, 14, 5, -1, cream);      // wingtip R
        // Tail feathers
        v(2, 1, 4, -1, 4, -3.5, tan); v(2, 1, 4, 0, 4, -4, cream); v(2, 1, 4, 1, 4, -3.5, tan);
        // Talons
        v(2, 4, 2, -2, 1, 0, tan); v(2, 4, 2, 2, 1, 0, tan);
        g.position.y = V * 3; // floats slightly
        return g;
      },
      // ── Biome 0: Fungo Saltador — mushroom hopper (nature, bouncy)
      'Fungo Saltador': function () {
        var g = new THREE.Group(); var V = 0.050;
        function v(w, h, d, px, py, pz, col) { var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 })); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); }
        var red = 0xcc3322, spot = 0xffeedd, stem = 0xddbb88;
        // Stem/body
        v(4, 5, 4, 0, 3, 0, stem);
        // Cap — wide mushroom top
        v(10, 3, 10, 0, 8, 0, red);
        v(12, 1, 12, 0, 6.5, 0, red);    // brim
        // Spots on cap
        v(2, 1, 2, -2, 9.5, 1, spot); v(2, 1, 2, 2, 9.5, -1, spot); v(2, 1, 2, 0, 9.5, 3, spot);
        // Little eyes on stem
        v(1, 1, 0.5, -1, 5, 2, 0x221100); v(1, 1, 0.5, 1, 5, 2, 0x221100);
        // Tiny legs — 2
        v(2, 4, 2, -2, 1, 0, stem); v(2, 4, 2, 2, 1, 0, stem);
        v(3, 1, 3, -2, 0, 0, 0x886644); v(3, 1, 3, 2, 0, 0, 0x886644); // feet
        return g;
      },
      // ── Biome 1: Corvus — dark crow (dark, swoops)
      'Corvus': function () {
        var g = new THREE.Group(); var V = 0.050;
        function v(w, h, d, px, py, pz, col, em) { var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, emissive: col, emissiveIntensity: em || 0 }); var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); }
        var blk = 0x111118, blue = 0x1a1a3a, shine = 0x2244aa;
        v(4, 3, 6, 0, 5, 0, blk);          // body sleek
        v(4, 4, 4, 0, 9, 1, blk);          // head
        v(3, 1, 2, 0, 8, 3.5, blk);        // beak long
        v(1, 1, 0.5, -1.5, 10, 2.5, shine, 0.4); v(1, 1, 0.5, 1.5, 10, 2.5, shine, 0.4); // eyes glow
        // Wings folded tight
        v(7, 1, 4, -6, 6, 0, blk); v(7, 1, 4, 6, 6, 0, blk);
        v(4, 1, 3, -10, 5, -0.5, blue); v(4, 1, 3, 10, 5, -0.5, blue);
        // Tail
        v(3, 1, 5, 0, 4, -3, blk);
        // Legs thin
        v(1, 5, 1, -1.5, 1, 0, blk); v(1, 5, 1, 1.5, 1, 0, blk);
        v(3, 1, 1, -1.5, 0, 1, blk); v(3, 1, 1, 1.5, 0, 1, blk); // claws
        return g;
      },
      // ── Biome 2: Cinzeiro — ash golem (fire/earth, slow tank)
      'Cinzeiro': function () {
        var g = new THREE.Group(); var V = 0.058;
        function v(w, h, d, px, py, pz, col, em) { var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, emissive: col, emissiveIntensity: em || 0 }); var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); }
        var ash = 0x443322, coal = 0x221810, ember = 0xff4400;
        v(8, 7, 8, 0, 5, 0, ash);           // massive body
        v(7, 6, 7, 0, 11, 0.5, ash);        // head
        v(2, 2, 1, -4, 15, 0, coal);          // ear/horn L
        v(2, 2, 1, 4, 15, 0, coal);          // ear/horn R
        v(2, 2, 0.5, -2, 13, 3.5, ember, 0.9); // eyes glow
        v(2, 2, 0.5, 2, 13, 3.5, ember, 0.9);
        v(5, 2, 3, 0, 10, 3, coal);         // mouth crack
        // Cracks with ember glow on body
        v(1, 4, 0.5, -2, 6, 4, ember, 0.6);
        v(1, 3, 0.5, 2, 7, 4, ember, 0.5);
        // Massive arms
        v(3, 7, 3, -6, 6, 0, coal); v(3, 7, 3, 6, 6, 0, coal);
        v(4, 3, 4, -6, 1, 0, ash); v(4, 3, 4, 6, 1, 0, ash);  // fists
        // Stumpy legs
        v(4, 4, 4, -2.5, 1, 0, coal); v(4, 4, 4, 2.5, 1, 0, coal);
        return g;
      },
      // ── Biome 3: Véu Sombrio — floating veil wraith (dark, high evasion)
      'Véu Sombrio': function () {
        var g = new THREE.Group(); var V = 0.052;
        function v(w, h, d, px, py, pz, col, em) { var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, emissive: col, emissiveIntensity: em || 0, transparent: true, opacity: 0.9 }); var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat); m.position.set(px * V, py * V, pz * V); g.add(m); }
        var void_ = 0x0a0a18, teal = 0x0a3a4a, glow = 0x00ffcc;
        // Flowing cloak form
        v(8, 10, 2, 0, 5, 0, void_);        // main veil body
        v(6, 8, 2, 0, 5, 0.5, teal, 0.05); // inner shimmer
        v(10, 3, 2, 0, 3, -0.5, void_);      // base wisp
        v(10, 3, 2, 0, 8, -0.5, void_);      // top wisp
        // Face — minimal
        v(6, 5, 3, 0, 10, 0.5, void_);      // face plane
        v(1.5, 1, 0.5, -1.5, 11, 3, glow, 1.2); // eyes glow
        v(1.5, 1, 0.5, 1.5, 11, 3, glow, 1.2);
        // Wispy tendrils
        v(2, 8, 1, -5, 4, 0, void_); v(2, 6, 1, 5, 5, 0, void_);
        v(2, 5, 1, -4, 2, 0.5, teal, 0.05); v(2, 4, 1, 4, 3, 0.5, teal, 0.05);
        g.position.y = V * 4; // floats
        return g;
      },
      // ── Biome 4: Caramujo Ácido — snail (water/nature, very tanky)
      'Caramujo Ácido': function () {
        var g = new THREE.Group(); var V = 0.055;
        function v(w, h, d, px, py, pz, col, em) { var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, emissive: col, emissiveIntensity: em || 0 }); var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); }
        var shell = 0x4a8a22, dark = 0x2a5a12, slime = 0x88ee22;
        // Body/foot
        v(9, 3, 12, 0, 2, 0, slime, 0.05);
        // Shell — stacked rings
        v(8, 4, 8, 1, 6, 0, shell);
        v(6, 4, 6, 2, 9, 0, dark);
        v(4, 3, 4, 3, 12, 0, shell);
        v(2, 2, 2, 3.5, 14, 0, dark);  // shell tip
        // Head + tentacles
        v(5, 4, 5, -2, 5, 4, slime, 0.05);
        v(1, 4, 1, -3.5, 9, 3.5, slime, 0.1); // tentacle L
        v(1, 4, 1, -1, 10, 3.5, slime, 0.1);  // tentacle R
        v(1, 1, 1, -3.5, 13, 3.5, 0x111111); // eye L
        v(1, 1, 1, -1, 14, 3.5, 0x111111);   // eye R
        return g;
      },
      // ── Biome 5: Falcão Trovão — thunder hawk (electric, fast)
      'Falcão Trovão': function () {
        var g = new THREE.Group(); var V = 0.053;
        function v(w, h, d, px, py, pz, col, em) { var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: em || 0 }); var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat); m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); }
        var grey = 0x667788, elec = 0xddee00, dark = 0x334455;
        v(4, 3, 8, 0, 5, 0, grey);           // sleek body
        v(4, 4, 4, 0, 9, 2, grey);           // head
        v(3, 1, 2, 0, 8, 4.5, dark);         // beak hook
        v(1, 1, 0.5, -1.5, 10, 4, elec, 0.8); v(1, 1, 0.5, 1.5, 10, 4, elec, 0.8); // eyes
        // Swept wings
        v(12, 2, 5, -10, 7, -2, grey); v(12, 2, 5, 10, 7, -2, grey);
        v(6, 1, 3, -16, 5.5, -2, dark); v(6, 1, 3, 16, 5.5, -2, dark);
        // Electric markings on wings
        v(4, 1, 1, -8, 8, -1, elec, 0.6); v(4, 1, 1, 8, 8, -1, elec, 0.6);
        // Tail sharp
        v(2, 1, 6, 0, 4, -4, grey);
        // Talons
        v(2, 5, 2, -1.5, 1, 1, dark); v(2, 5, 2, 1.5, 1, 1, dark);
        g.position.y = V * 2;
        return g;
      },

      // ── Lobo das Sombras (canídeo) ──
      'Lobo das Sombras': function () {
        var g = new THREE.Group(); var V = 0.052;
        function v(w, h, d, px, py, pz, col, emit) {
          var mat = new THREE.MeshStandardMaterial({
            color: col, roughness: 0.65,
            emissive: emit ? new THREE.Color(col) : new THREE.Color(0), emissiveIntensity: emit || 0
          });
          var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat);
          m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m;
        }
        // body
        v(6, 4, 8, 0, 5, 0, 0x2a2a3a);
        // neck
        v(4, 3, 4, 0, 8, 1, 0x1a1a2a);
        // head
        v(6, 5, 6, 0, 11, 1.5, 0x2a2a3a);
        // muzzle
        v(4, 3, 4, 0, 9.5, 4, 0x1a1a2a);
        // eyes glowing
        v(1, 1, 0.5, -1.8, 12, 4, 0xff4400, 0.8); v(1, 1, 0.5, 1.8, 12, 4, 0xff4400, 0.8);
        // ears
        v(2, 4, 1.5, -2.5, 14.5, -0.5, 0x1a1a2a); v(2, 4, 1.5, 2.5, 14.5, -0.5, 0x1a1a2a);
        // legs (4)
        v(2, 5, 2, -2.5, 2, -2, 0x1a1a2a); v(2, 5, 2, 2.5, 2, -2, 0x1a1a2a);
        v(2, 5, 2, -2.5, 2, 2, 0x1a1a2a); v(2, 5, 2, 2.5, 2, 2, 0x1a1a2a);
        // tail
        v(2, 6, 2, 0, 5, -5, 0x3a3a4a); v(1.5, 4, 1.5, 0, 9, -6.5, 0x4a4a5a);
        g.position.y = V * 3;
        return g;
      },

      // ── Raposa Ígnea (canídeo pequeno) ──
      'Raposa Ígnea': function () {
        var g = new THREE.Group(); var V = 0.048;
        function v(w, h, d, px, py, pz, col, emit) {
          var mat = new THREE.MeshStandardMaterial({
            color: col, roughness: 0.6,
            emissive: emit ? new THREE.Color(col) : new THREE.Color(0), emissiveIntensity: emit || 0
          });
          var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat);
          m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m;
        }
        v(5, 3.5, 7, 0, 4.5, 0, 0xcc4400);  // body
        v(3.5, 3, 4, 0, 7.5, 1.5, 0xdd5500); // neck
        v(5, 4.5, 5.5, 0, 10.5, 1.5, 0xcc4400); // head
        v(3, 2.5, 3.5, 0, 9, 4, 0xbb3300);   // muzzle
        v(1, 1, 0.5, -1.5, 11.5, 3.8, 0x111111); v(1, 1, 0.5, 1.5, 11.5, 3.8, 0x111111); // eyes
        v(0.7, 0.7, 0.4, -1, 11.8, 4.1, 0xffaa00, 0.6); v(0.7, 0.7, 0.4, 1.7, 11.8, 4.1, 0xffaa00, 0.6);
        v(1.5, 3.5, 1, -2.5, 13, 0, 0x882200); v(1.5, 3.5, 1, 2.5, 13, 0, 0x882200); // ears
        v(1, 2, 0.8, -2.5, 15, 0, 0xffffff); v(1, 2, 0.8, 2.5, 15, 0, 0xffffff);  // white tips
        v(1.8, 4.5, 1.8, -2.2, 2, -2, 0xbb3300); v(1.8, 4.5, 1.8, 2.2, 2, -2, 0xbb3300); // front legs
        v(1.8, 4.5, 1.8, -2.2, 2, 2, 0xbb3300); v(1.8, 4.5, 1.8, 2.2, 2, 2, 0xbb3300);  // back legs
        v(2.5, 7, 2.5, 0, 5, -5, 0xcc4400); v(2, 5, 2, 0, 10, -6.5, 0xffffff); // tail
        v(2, 4, 2, 0, 13, -6, 0xee6600, 0.3); // tail glow tip
        g.position.y = V * 2;
        return g;
      },

      // ── Corvus Sombrio (pássaro grande) ──
      'Corvus Sombrio': function () {
        var g = new THREE.Group(); var V = 0.055;
        function v(w, h, d, px, py, pz, col, emit) {
          var mat = new THREE.MeshStandardMaterial({
            color: col, roughness: 0.5,
            emissive: emit ? new THREE.Color(col) : new THREE.Color(0), emissiveIntensity: emit || 0
          });
          var m = new THREE.Mesh(new THREE.BoxGeometry(w * V, h * V, d * V), mat);
          m.position.set(px * V, py * V, pz * V); m.castShadow = true; g.add(m); return m;
        }
        v(5, 4, 6, 0, 6, 0, 0x1a1a2a);   // body
        v(4, 3.5, 4.5, 0, 9.5, 0.5, 0x1a1a2a); // neck
        v(5, 4.5, 5, 0, 12.5, 0.5, 0x1a1a2a); // head
        v(2, 1.5, 3, 0, 11, 3.5, 0x111111);   // beak
        v(1, 1, 0.5, -1.5, 13, 3.5, 0x8800ff, 0.7); // glowing eyes
        v(1, 1, 0.5, 1.5, 13, 3.5, 0x8800ff, 0.7);
        v(1.5, 4, 1, -2.5, 15.5, 0, 0x111111); v(1.5, 4, 1, 2.5, 15.5, 0, 0x111111); // ear tufts
        // wings spread
        v(8, 1.5, 6, -5.5, 7, -0.5, 0x111111); v(2, 1.2, 5, -10, 6.5, -0.3, 0x1a1a2a);
        v(8, 1.5, 6, 5.5, 7, -0.5, 0x111111); v(2, 1.2, 5, 10, 6.5, -0.3, 0x1a1a2a);
        // feather tips glowing
        v(1.5, 0.8, 4, -12, 6.5, -0.2, 0x8800ff, 0.4); v(1.5, 0.8, 4, 12, 6.5, -0.2, 0x8800ff, 0.4);
        v(2, 5, 2, -1.5, 2.5, 0, 0x1a1a2a); v(2, 5, 2, 1.5, 2.5, 0, 0x1a1a2a); // legs
        g.position.y = V * 4;
        return g;
      },
    };

    function buildMapMobMesh(mobName, color) {
      var builder = MOB_MESH_BUILDERS[mobName];
      if (builder) return builder();
      // Fallback: simple colored chibi blob
      var g = new THREE.Group(); var V = 0.05;
      var m = new THREE.Mesh(new THREE.BoxGeometry(V * 5, V * 6, V * 5), new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 }));
      m.position.y = V * 3; g.add(m);
      var head = new THREE.Mesh(new THREE.BoxGeometry(V * 5, V * 5, V * 5), new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 }));
      head.position.y = V * 9; g.add(head);
      return g;
    }// ===== CREATURE CHIBI BUILDER =====
    // shape: 'spiky'|'round'|'fluid'|'crystal'|'star'
    // evolved: bool — larger, more ornate version


    // ─── Trigger attack lunge on a creature's canvas ───────────────
    // wid: 'my-wrap' or 'en-wrap'
    // dir: +1 = lunge right (my attacker), -1 = lunge left (enemy attacker)
    function triggerAttackAnim(wid, dir) {
      var sc = SCNS[wid];
      if (!sc || !sc.mesh) return;
      if (sc._attackAnim) return; // don't interrupt mid-anim
      sc._attackAnim = {
        t: 0,
        dir: dir,
        baseX: sc.mesh.position.x
      };
    }


    // ── WEATHER × BATTLE ──
    // Plane 0 (forest/rain): water+nature +20% atk, fire -15%
    // Plane 1 (volcanic):    fire+electric +20%, water -15%
    // Plane 2 (spectral):    dark+light +20%, no penalties
    var WEATHER_BUFFS = [
      // Plano 0 — Floresta das Almas
      {
        boost: ['water', 'nature'], penalty: ['fire', 'electric'], name: 'Chuva Ancestral', icon: '🌧',
        boostMult: 1.20, penaltyMult: 0.80,
        battleFx: 'Água/Nature +20% ataque · Fogo/Elétrico -20%'
      },
      // Plano 1 — Charneca Ardente
      {
        boost: ['fire', 'earth'], penalty: ['water', 'nature'], name: 'Brasa Vulcânica', icon: '🌋',
        boostMult: 1.22, penaltyMult: 0.78,
        battleFx: 'Fogo/Terra +22% ataque · Água/Nature -22%'
      },
      // Plano 2 — Abismo Espectral
      {
        boost: ['dark', 'voidarc'], penalty: ['light'], name: 'Névoa Espectral', icon: '👻',
        boostMult: 1.25, penaltyMult: 0.75,
        battleFx: 'Sombra/Void +25% ataque · Luz -25%'
      }
    ];


    function getWeatherDesc() {
      var plane = (G && G.plane) || 0;
      var wb = WEATHER_BUFFS[plane];
      if (!wb) return '';
      return wb.icon + ' ' + wb.name;
    }
    function getWeatherBattleDesc() {
      var plane = (G && G.plane) || 0;
      var wb = WEATHER_BUFFS[plane];
      if (!wb) return '';
      return wb.battleFx || '';
    }

    // Floating damage number
    function floatDmg(pfx, amount, isHeal, isCrit) {
      var el = document.getElementById(pfx + '-dmg-float');
      if (!el) return;
      el.textContent = (isHeal ? '+' : '-') + amount + (isCrit ? '!!' : '');
      el.className = 'battle-dmg-float' + (isHeal ? ' heal' : '') + (isCrit ? ' crit' : '');
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0px)';
      el.style.transition = 'none';
      // Force reflow
      el.offsetHeight;
      el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(-28px)';
    }
    // ===== BATTLE LOGIC =====

    //   // Score combinado: nível + elemento
    //   var score = d - elAdv; // score positivo = eu em desvantagem

    //   if (score <= -4) return 'dominant';   // muito acima: nível bem maior + vantagem de elemento
    //   if (score <= -2) return 'favorable';  // acima: vantagem de nível ou elemento
    //   if (score <= 1) return 'fair';       // equilibrado
    //   if (score <= 3) return 'hard';       // desvantagem leve
    //   if (score <= 5) return 'brutal';     // desvantagem grave
    //   return 'lethal';                       // letal
    // }


    function buildHand() {
      HAND.m1 = 3;
      HAND.m2 = 3;
      HAND.mh = 2;       // inherited skill — 2 uses per battle
      HAND.ultUsed = false;

      var active = ac ? ac() : null;
      if (!active) return;

      // ── SORTEIO DE CARTAS POR BATALHA ──
      // Sortear nova mão se a criatura ainda não tem uma para esta batalha
      if (typeof drawBattleHand === 'function' && !active._battleHand) {
        active._battleHand = drawBattleHand(active);
      }

      // Learned card bonus: +1 m2 use, ult starts with CD already ticking
      if (active.learnedCards) {
        if (active.learnedCards.indexOf('m2') >= 0) HAND.m2 += 1;
        if (active.learnedCards.indexOf('u') >= 0 && active.ultCD > 0) active.ultCD = Math.max(0, active.ultCD - 1);
      }
      // Híbrida sem m2 sorteado → zerar usos de m2
      if (active.isHybrid && active._battleHand && !active._battleHand.m2) HAND.m2 = 0;
    }

    // Get the inherited card for a hybrid creature (from dominant parent's m1)
    function getHybridInheritedCard(creature) {
      if (!creature.isHybrid) return null;
      // Ascendido tem a ult do chefe como habilidade herdada fixa
      if (creature.isAscended && creature._inheritedCard) return creature._inheritedCard;
      if (!creature._parentEls || !creature._parentEls.length) return null;
      // Híbrido normal: m1 do elemento dominante
      var domEl = creature._parentEls[0];
      var domCards = CARDS[domEl];
      if (!domCards) return null;
      return domCards.m1;
    }

    function startBattle(aIdx) {
      // Strip nulls from team before any battle logic
      G.team = G.team.filter(function (c) { return c !== null && c !== undefined; });
      if (!G.team.filter(function (c) { return c && !c.dead; }).length) {
        var hallAlive = (G.hall || []).filter(function (x) { return !x.dead; });
        if (hallAlive.length > 0) {
          while (G.team.length < 3 && G.hall.length > 0) {
            var r = G.hall.shift(); r.hp = Math.max(1, Math.floor(r.maxHp * 0.30)); G.team.push(r);
          }
          G.activeIdx = 0;
        } else if (typeof emergencyHatch === 'function' && emergencyHatch(aIdx)) {
          // Egg hatched as emergency — continue to battle with newborn creature
        } else {
          moveAllDeadToBook(); wipeAndGameOver();
        }
        return;
      }
      G.activeIdx = G.team.findIndex(function (c) { return c && !c.dead; });
      var area = AREAS[aIdx], enemy = mkEnemy(area);
      G.battle = {
        enemy: enemy, area: area, aIdx: aIdx, over: false, danger: 'fair', _fieldState: null, escUsed: false,
        mySt: { poison: 0, burn: 0, paralyze: 0, shield: 0 },
        enSt: { poison: 0, burn: 0, paralyze: 0, shield: 0 }
      };
      buildHand();
      stopMap();
      document.getElementById('explore').style.display = 'none';
      document.getElementById('battle').style.display = 'block';
      updateDangerUI(); renderBattle(); renderCards(); clearLog();
      addLog('Voce encontrou um ' + enemy.name + ' selvagem! (Nv. ' + enemy.level + ')', 'evt');
      warnDanger();
      // Weather battle effect notification
      if (typeof getWeatherBattleDesc === 'function') {
        var _wfx = getWeatherBattleDesc();
        if (_wfx) addLog((getWeatherDesc ? getWeatherDesc() : '🌦') + ' — ' + _wfx, 'evt');
      }
      // Re-enable vincular button for fresh battle
      var capBtnFresh = document.getElementById('capbtn');
      if (capBtnFresh) { capBtnFresh.disabled = false; capBtnFresh.style.opacity = ''; }
      bestiaryRecord(enemy.name, 'seen');
      renderPassivePips();
      spawnS('my-wrap', ac()); spawnS('en-wrap', enemy);
    }

    function updateDangerUI() {
      G.battle.danger = calcDanger(ac(), G.battle.enemy);
      var msgs = {
        dominant: ['✦ DOMINANTE', 'di-dominant'],
        favorable: ['▲ VANTAGEM', 'di-favorable'],
        fair: ['EQUILÍBRIO', 'di-fair'],
        hard: ['▼ DESVANTAGEM', 'di-hard'],
        brutal: ['⚠ BRUTAL', 'di-brutal'],
        lethal: ['💀 LETAL — FUJA', 'di-lethal']
      };
      var m = msgs[G.battle.danger];
      var el = document.getElementById('dind'); el.textContent = m[0]; el.className = 'dind ' + m[1];
      // Weather buff indicator in VS column
      var btInd = document.getElementById('battle-type-ind');
      if (btInd && typeof getWeatherDesc === 'function') {
        var wdesc = getWeatherDesc();
        var wfx = typeof getWeatherBattleDesc === 'function' ? getWeatherBattleDesc() : '';
        // Uma linha única: ícone+nome · efeitos
        btInd.innerHTML = wdesc
          ? '<span style="font-size:.84rem;white-space:nowrap">' + wdesc + (wfx ? ' &nbsp;·&nbsp; <span style="opacity:.75">' + wfx + '</span>' : '') + '</span>'
          : '';
      }
    }

    function warnDanger() {
      if (G.battle.danger === 'lethal') addLog('AVISO: Desnivel extremo!', 'evt');
      else if (G.battle.danger === 'brutal') addLog('Cuidado: batalha desequilibrada.', 'sys');
    }

    function setBP(pfx, c) {
      if (!c) return; // guard: no active creature (e.g. mid-hatch)
      var p = c.maxHp > 0 ? c.hp / c.maxHp : 0;
      document.getElementById(pfx + '-n').textContent = c.name || '?';
      document.getElementById(pfx + '-lv').textContent = 'Nv.' + (c.level || 1);
      var el = document.getElementById(pfx + '-el');
      if (el) { el.className = 'eb el-' + (c.el || 'earth'); el.textContent = (EL[c.el] ? EL[c.el].name : (c.el || '?')); }
      var hpEl = document.getElementById(pfx + '-hp');
      if (hpEl) {
        hpEl.style.width = (p * 100) + '%';
        hpEl.style.animation = p < 0.20 ? 'lowHpFlash 0.7s ease-in-out infinite' : 'none';
      }
      var htEl = document.getElementById(pfx + '-ht');
      if (htEl) htEl.textContent = c.hp + ' / ' + c.maxHp;
    }

    function renderStatus(elId, st) {
      var h = '';
      if (st.poison > 0) h += '<span class="st-icon st-poison">VENENO x' + st.poison + '</span>';
      if (st.burn > 0) h += '<span class="st-icon st-burn">' + (st.burnHeavy ? '🔥BRASA ' : 'QUEIMADURA ') + st.burn + '</span>';
      if (st.paralyze > 0) h += '<span class="st-icon st-paralyze">PARALISIA ' + st.paralyze + 't</span>';
      if (st.blind > 0) h += '<span class="st-icon st-paralyze">CEGO ' + st.blind + 't</span>';
      if (st.weaken > 0) h += '<span class="st-icon st-poison">ATK-35% ' + st.weaken + 't</span>';
      if (st.weakenDef > 0) h += '<span class="st-icon st-burn">DEF-40% ' + st.weakenDef + 't</span>';
      if (st.antiheal > 0) h += '<span class="st-icon st-burn">ANTI-CURA ' + st.antiheal + 't</span>';
      if (st.reflect > 0) h += '<span class="st-icon" style="color:#558833">REFLETE ' + st.reflect + 't</span>';
      if (st.shield > 0) h += '<span class="st-icon st-shield">ESCUDO ' + st.shield + '</span>';
      document.getElementById(elId).innerHTML = h;
    }

    function renderBattle() {
      // Re-sync activeIdx if it fell out of sync (e.g. after emergency hatch)
      if (!ac() && G.team) {
        var _newIdx = G.team.findIndex(function (c) { return c && !c.dead; });
        if (_newIdx >= 0) G.activeIdx = _newIdx;
      }
      // Guard: if creatures canvas is missing (e.g. after emergency hatch), respawn
      var _myWrap = document.getElementById('my-wrap');
      var _enWrap = document.getElementById('en-wrap');
      if (_myWrap && !_myWrap.querySelector('canvas') && ac()) {
        requestAnimationFrame(function () { if (ac()) spawnS('my-wrap', ac()); });
      }
      if (_enWrap && !_enWrap.querySelector('canvas') && G.battle && G.battle.enemy) {
        requestAnimationFrame(function () { spawnS('en-wrap', G.battle.enemy); });
      }
      setBP('my', ac()); setBP('en', G.battle.enemy);
      renderStatus('my-st', G.battle.mySt);
      renderStatus('en-st', G.battle.enSt);
      var my = ac();
      var xpPct = my.xpNext > 0 ? Math.floor((my.xp / my.xpNext) * 100) : 0;
      document.getElementById('my-xpbar').style.width = xpPct + '%';
      document.getElementById('my-xpt').textContent = 'XP ' + my.xp + '/' + my.xpNext;
      var ep = G.battle.enemy.hp / G.battle.enemy.maxHp;
      var cb = document.getElementById('capbtn');
      cb.disabled = ep >= 0.25; cb.textContent = ep < 0.25 ? 'Vincular (' + Math.round(ep * 100) + '%)' : 'Vincular';
      document.getElementById('swapbtn').disabled = G.team.filter(function (c) { return !c.dead; }).length <= 1;
      renderBattleBuffs();
      if (typeof updateFieldStateBar === 'function') updateFieldStateBar();
    }

    function addLog(msg, cls) {
      var l = document.getElementById('blog'), d = document.createElement('div');
      d.className = 'le ' + (cls || ''); d.textContent = msg; l.appendChild(d); l.scrollTop = l.scrollHeight;
    }

    function clearLog() { document.getElementById('blog').innerHTML = ''; }

    function mkSvg(path) { return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>'; }
    function mkPips(total, left, col) { var h = ''; for (var i = 0; i < total; i++)h += '<span class="pip' + (i >= left ? ' e' : '') + '" style="color:' + col + '"></span>'; return h; }

    function renderCards() {
      var _waiting = !!(G.battle && G.battle._waitingEnemy);
      var my = ac(), hex = EL[my.el] ? EL[my.el].hex : '#aaaaaa';
      // Usar cartas sorteadas para esta batalha ou fallback para CARDS padrão
      var _hand = (my._battleHand) ? my._battleHand : null;
      var def = CARDS[my.el] || CARDS.fire;
      var battleM1 = (_hand && _hand.m1) ? _hand.m1 : def.m1;
      var battleM2 = (_hand && _hand.m2) ? _hand.m2 : def.m2;
      var battleU = (_hand && _hand.u) ? _hand.u : def.u;
      var elCls = 'card-' + my.el;
      var inheritedCard = getHybridInheritedCard(my);
      // Hybrid colour: use the hybrid element colour for inherited card accent
      var inheritHex = my._parentEls && EL[my._parentEls[0]] ? EL[my._parentEls[0]].hex : hex;
      var cs = [
        { id: 'b', lbl: 'Basico', card: def.b, maxU: 0, left: 0, col: hex, dis: _waiting, ult: false, rarity: 'basic' },
        { id: 'm1', lbl: 'Magia', card: battleM1, maxU: 3, left: HAND.m1, col: hex, dis: HAND.m1 <= 0 || _waiting, ult: false, rarity: battleM1.stackable ? 'stackable' : (battleM1.combo ? 'combo' : 'magic') },
        { id: 'm2', lbl: 'Magia', card: battleM2, maxU: 3, left: HAND.m2, col: hex, dis: HAND.m2 <= 0 || _waiting || !battleM2, ult: false, rarity: battleM2 ? (battleM2.stackable ? 'stackable' : (battleM2.combo ? 'combo' : 'magic')) : 'magic' }
      ];
      // Hybrid: insert inherited card before ultimate
      if (my.isHybrid && inheritedCard) {
        cs.push({ id: 'mh', lbl: 'Herdada', card: inheritedCard, maxU: 2, left: HAND.mh, col: inheritHex, dis: HAND.mh <= 0 || _waiting, ult: false, rarity: 'inherited' });
      }
      cs.push({
        id: 'u', lbl: (my.ultCD > 0 ? 'Recarga (' + my.ultCD + ')' : 'Ultimate'), card: battleU, maxU: 1,
        left: (HAND.ultUsed || my.ultCD > 0) ? 0 : 1, col: '#c9933a', dis: HAND.ultUsed || my.ultCD > 0 || _waiting, ult: true, rarity: 'ultimate'
      });
      var rarityLabels = { basic: 'Comum', magic: 'Magia', ultimate: 'Lendaria', inherited: 'Herdada', stackable: 'Gatilho', combo: 'Cadeia' };
      var html = '';
      cs.forEach(function (c) {
        var onclick = '';
        var pips = c.maxU ? '<div class="pips">' + mkPips(c.maxU, c.left, c.col) + '</div>' : '';
        var cardCls = 'card animated ' + elCls
          + (c.ult ? ' card-ultimate' : '')
          + ' rarity-' + c.rarity
          + (c.dis ? ' dis' : '');
        var isLearned = (my.learnedCards && my.learnedCards.indexOf(c.id) >= 0);
        var badge = '<span class="card-rarity-badge"' + (isLearned ? ' style="background:rgba(180,120,255,.25);color:#c090ff"' : '') + '>' + rarityLabels[c.rarity] + (isLearned ? ' ✦' : '') + '</span>';
        html += '<div class="card-wrap">';
        html += '<div class="' + cardCls.trim() + '" data-card-id="' + c.id + '" data-drag-card="' + c.id + '" draggable="' + (!c.dis ? 'true' : 'false') + '">';
        html += '<div class="card-inner">';
        html += badge;
        html += '<span class="ctl" style="color:' + c.col + '">' + c.lbl + '</span>';
        html += '<span class="cic" style="color:' + c.col + '">' + mkSvg(c.card.p) + '</span>';
        html += '<div class="cnm">' + c.card.n + '</div>';
        html += '<div class="cds">' + c.card.d + '</div>';
        html += pips;
        html += '</div></div></div>';
      });
      // Turn indicator: prepend banner when waiting for enemy
      if (_waiting) {
        html = '<div style="grid-column:1/-1;text-align:center;padding:4px 0 0;font-family:Cinzel,serif;font-size:.90rem;letter-spacing:.15em;color:rgba(255,120,80,.65);pointer-events:none;animation:pulseGlow 1s infinite alternate;">— INIMIGO ATACANDO... —</div>' + html;
      }
      document.getElementById('crow').innerHTML = html;
      initCardHolo();
      // Init drag on each render (re-attaches for new cards)
      if (typeof initCardDrag === 'function') {
        var crow = document.getElementById('crow');
        if (crow) { crow._dragInited = false; initCardDrag(); }
      }
    }

    var _cardHoloStyle = null;
    function initCardHolo() {
      var cards = document.querySelectorAll('#crow .card');
      if (!_cardHoloStyle) {
        _cardHoloStyle = document.createElement('style');
        _cardHoloStyle.id = 'holo-hover-style';
        document.head.appendChild(_cardHoloStyle);
      }
      cards.forEach(function (card) {
        var _timeout;
        card.addEventListener('mousemove', function (e) {
          var rect = card.getBoundingClientRect();
          var l = e.clientX - rect.left;
          var t = e.clientY - rect.top;
          var w = rect.width, h = rect.height;
          var px = Math.abs(Math.floor(100 / w * l) - 100);
          var py = Math.abs(Math.floor(100 / h * t) - 100);
          var pa = (50 - px) + (50 - py);
          var lp = 50 + (px - 50) / 1.5;
          var tp = 50 + (py - 50) / 1.5;
          var px_spark = 50 + (px - 50) / 7;
          var py_spark = 50 + (py - 50) / 7;
          var p_opc = 20 + (Math.abs(pa) * 1.5);
          var ty = ((tp - 50) / 2) * -1;
          var tx = ((lp - 50) / 1.5) * .5;
          var id = '[data-card-id="' + card.getAttribute('data-card-id') + '"]';
          _cardHoloStyle.innerHTML =
            '#crow .card' + id + ':hover:before{background-position:' + lp + '% ' + tp + '%;}' +
            '#crow .card' + id + ':hover:after{background-position:' + px_spark + '% ' + py_spark + '%;opacity:' + (p_opc / 100) + '}';
          card.style.transform = 'rotateX(' + ty + 'deg) rotateY(' + tx + 'deg)';
          card.classList.remove('animated');
          card.classList.add('active');
          clearTimeout(_timeout);
        });
        card.addEventListener('mouseleave', function () {
          _cardHoloStyle.innerHTML = '';
          card.style.transform = '';
          card.classList.remove('active');
          _timeout = setTimeout(function () { card.classList.add('animated'); }, 2500);
        });
      });
    }




    // ===== PASSIVE ABILITIES =====








    function renderPassivePips() {
      var my = ac();
      var el = document.getElementById('passive-pips');
      if (!el) return;
      // Use getActivePassives which supports TPLS, _passives, and HYBRID_PASSIVES
      var allPassives = getActivePassives(my);
      // Also show locked passives from TPLS
      var tpl = TPLS.find(function (t) { return t.name === my.name || t.name === my.tplName; });
      var allDefined = [];
      if (tpl && tpl.passives) allDefined = allDefined.concat(tpl.passives);
      if (my._passives) my._passives.forEach(function (p) { if (!allDefined.some(function (d) { return d.id === p.id; })) allDefined.push(p); });
      // Hybrid passives (all, active + locked)
      if (my.isHybrid && my._hybridEl && typeof HYBRID_PASSIVES !== 'undefined' && HYBRID_PASSIVES[my._hybridEl]) {
        HYBRID_PASSIVES[my._hybridEl].forEach(function (p) { if (!allDefined.some(function (d) { return d.id === p.id; })) allDefined.push(p); });
      }
      if (!allDefined.length) { el.innerHTML = ''; return; }
      var html = '<div class="passive-list">';
      allDefined.forEach(function (p) {
        var active = allPassives.some(function (a) { return a.id === p.id; });
        var isHybridP = my._hybridEl && typeof HYBRID_PASSIVES !== 'undefined' && HYBRID_PASSIVES[my._hybridEl] && HYBRID_PASSIVES[my._hybridEl].some(function (h) { return h.id === p.id; });
        var dot = isHybridP ? '✦' : '◆';
        html += '<div class="passive-pip ' + (active ? 'active' : 'locked') + '" title="' + (p.desc || '') + '">';
        html += '<span class="passive-dot">' + dot + '</span>';
        html += '<span>' + p.name + '</span>';
        html += '<span class="passive-lvl">' + (active ? 'Ativo' : 'Nv.' + p.lvl) + '</span>';
        html += '</div>';
      });
      html += '</div>';
      el.innerHTML = html;
    }

    function playCard(id) {
      if (typeof sfx === 'function') sfx('card_play');
      if (!G.battle || G.battle.over) return;
      // Turn system: block if waiting for enemy to attack
      if (G.battle._waitingEnemy) return;
      var my = ac(), en = G.battle.enemy, def = CARDS[my.el] || CARDS.fire;
      var card, mult;
      var inheritedCard2 = getHybridInheritedCard(my);
      // Usar cartas sorteadas da mão de batalha
      var _bh = my._battleHand || {};
      var _bm1 = _bh.m1 || def.m1;
      var _bm2 = _bh.m2 || def.m2;
      var _bu = _bh.u || def.u;
      if (id === 'b') { card = def.b; mult = 1.0; }
      else if (id === 'm1') { if (HAND.m1 <= 0) return; card = _bm1; mult = card.m; HAND.m1--; }
      else if (id === 'm2') { if (HAND.m2 <= 0 || !_bm2) return; card = _bm2; mult = card.m; HAND.m2--; }
      else if (id === 'mh') { if (HAND.mh <= 0 || !inheritedCard2) return; card = inheritedCard2; mult = card.m; HAND.mh--; }
      else if (id === 'u') { if (HAND.ultUsed || my.ultCD > 0) return; card = _bu; mult = card.m; HAND.ultUsed = true; }
      else return;

      if (id === 'b' && G.battle.mySt.poison + G.battle.mySt.burn > 0) {
        applyStatusDmg(my, G.battle.mySt, my.name);
        if (my.hp <= 0) { killCreature(my); return; }
        renderBattle();
      }

      if (G.battle.mySt.paralyze > 0) {
        G.battle.mySt.paralyze--;
        if (Math.random() < 0.5) {
          addLog(my.name + ' esta paralisado e nao consegue agir!', 'para-log');
          renderCards(); renderBattle();
          G.battle._waitingEnemy = true; setTimeout(enemyAtk, 620);
          return;
        }
      }

      var shieldOnly = applyCardStatus(card, my, en, G.battle.enSt, G.battle.mySt);
      if (shieldOnly) {
        renderCards(); renderBattle();
        G.battle._waitingEnemy = true; setTimeout(enemyAtk, 620);
        return;
      }

      if (mult === 0) mult = card.m;
      var em = eMult(my.el, en.el);

      var critChance = 0.15 + getPassiveCritBonus(my);
      if (em > 1) critChance += 0.25;
      var isCrit = Math.random() < critChance;
      var critMult = isCrit ? 1.8 : 1.0;

      var resistMult = getPassiveElResist(en, my.el);
      var weatherMult = getWeatherMult(my.el, true) * getWeatherMult(en.el, false);
      // voidarc_pierce: ignore 30% of enemy DEF
      var defMult = hasPassive(my, 'voidarc_pierce') ? 0.70 : 1.0;
      // Weaken DEF: enemy weakenDef status
      if (G.battle.enSt.weakenDef > 0) defMult *= 0.60;
      // storm_surge: accumulated ATK bonus
      var surgeMult = (my._surgeStacks && hasPassive(my, 'storm_surge')) ? (1 + my._surgeStacks * 0.08) : 1.0;
      // My ATK weakened by enemy debuff?
      var myAtkMult = (G.battle.mySt.weaken > 0) ? 0.65 : 1.0;
      // Blind: 30% chance to miss entirely
      if (G.battle.mySt.blind > 0 && Math.random() < 0.30) {
        addLog(my.name + ' errou o ataque! (cego)', 'evt');
        setBP('my', my); setBP('en', en); renderStatus('my-st', G.battle.mySt); renderStatus('en-st', G.battle.enSt);
        G.battle._waitingEnemy = true; setTimeout(enemyAtk, 420); return;
      }
      var _relicDmgMult = (typeof getEquippedRelic === 'function' && getEquippedRelic() && getEquippedRelic().effect === 'dmg_boost') ? 1.12 : 1.0;
      // COMBO SYSTEM: register card and get multiplier based on ascending-rarity chain
      var _comboMult = (typeof registerComboCard === 'function') ? registerComboCard(id) : 1.0;
      // CLASS PASSIVES
      var _classMult = 1.0;
      if (heroHasPassive('arcane_amplify') && em >= 1.0) _classMult *= 1.15; // Arcano: +15% elemental
      if (heroHasPassive('hunter_mark') && en._hunterMark) _classMult *= 1.20; // Caçador: marca +20%
      // ── SISTEMA DE ESTADOS DE CAMPO (Stackable/Combo chains) ──
      var _fieldBoost = 1.0;
      var _fieldLog = '';
      if (!G.battle._fieldState) G.battle._fieldState = null;

      // Verificar se esta carta consome um estado de campo ativo (combo)
      if (card.combo && G.battle._fieldState === card.combo && mult > 0) {
        _fieldBoost = 1.6; // +60% de dano ao consumir estado
        _fieldLog = '⚡ CADEIA: ' + G.battle._fieldState.toUpperCase() + ' → ' + card.n + ' ×1.6!';
        G.battle._fieldState = null; // consumir estado
      }
      // Verificar se esta carta deixa um estado de campo (stackable)
      if (card.stackable && mult >= 0) {
        // Determinar nome do estado pelo nome da carta
        var _stateName = card.n.toLowerCase()
          .replace('rastro de ', '').replace(' profundo', '').replace('carga ', '')
          .replace('gelo ', 'gelo').replace('ruptura do solo', 'ruptura')
          .replace('sombra rastreadora', 'sombra').replace('florescimento', 'flora')
          .replace('aura divina', 'aura').replace('carga elétrica', 'carga')
          .split(' ')[0];
        G.battle._fieldState = _stateName;
        if (mult === 0) { // stackable + pure_def não causa dano mas ativa estado
          addLog('✨ ' + card.n + ' — estado [' + _stateName.toUpperCase() + '] ativado!', 'evt');
          renderCards(); renderBattle();
          G.battle._waitingEnemy = true; setTimeout(enemyAtk, 620);
          return;
        }
        addLog('✨ ' + card.n + ' — [' + _stateName.toUpperCase() + '] ativo! Próximo ataque amplificado.', 'evt');
      }

      var comboBonus = _comboMult - 1;
      var relicBonus = _relicDmgMult - 1;
      var classBonus = _classMult - 1;
      var fieldBonus = _fieldBoost - 1;
      var surgeBonus = surgeMult - 1;
      var additiveBonus = 1 + comboBonus + relicBonus + classBonus + fieldBonus + surgeBonus;
      var coreMult = mult * em * critMult * resistMult * weatherMult;

      var atkRoll = my.atk * myAtkMult * additiveBonus * coreMult * (0.85 + Math.random() * 0.3);
      var mitigation = atkRoll / (atkRoll + (en.def * defMult) * 1.2);
      var rawDmg = Math.max(1, Math.floor(atkRoll * mitigation));
      var finalDmg = calcDmgWithShield(rawDmg, G.battle.enSt, G.battle.mySt);

      var lbl = (id === 'u' ? 'ULTIMATE: ' : '') + card.n + '! ';
      // Exibir log de combo chain se houve amplificação
      if (_fieldLog) addLog(_fieldLog, 'combo-log');
      // Arcano: Explosão Arcana — hero bonus attack when ult fires
      if (id === 'u' && heroHasPassive('arcane_surge') && G.hero) {
        var _surgeDmg = Math.max(2, Math.floor(G.hero.atk * 0.8));
        en.hp = Math.max(0, en.hp - _surgeDmg);
        addLog('🔮 Explosão Arcana! Herói atacou por ' + _surgeDmg + '!', 'evt');
      }
      if (em > 1) lbl += '(Super efetivo!) '; if (em < 1) lbl += '(Pouco efetivo) ';
      if (resistMult < 1) lbl += '(Resistencia!) ';
      if (isCrit) lbl += 'CRITICO!! ';
      if (hasPassive(my, 'crit_boost')) lbl += '';
      var _comboLabel = (typeof getComboLabel === 'function') ? getComboLabel() : null;
      if (_comboLabel) lbl += '(' + _comboLabel + ') ';

      en.hp = Math.max(0, en.hp - finalDmg);
      floatDmg('en', finalDmg, false, isCrit);
      if (typeof triggerAttackAnim === 'function') triggerAttackAnim('my-wrap', 1);
      addLog(lbl + my.name + ' causou ' + finalDmg + ' de dano!', 'dmg' + (isCrit ? ' crit-log' : ''));
      if (typeof sfx === 'function') sfx(isCrit ? 'hit_crit' : 'hit_normal');
      flashS('en-wrap');
      // COMBO: chain registered above via registerComboCard

      applyPassivesOnDamageDealt(my, en, finalDmg);

      var thornsDmg = applyPassivesOnDamageReceived(en, finalDmg);
      if (thornsDmg > 0) { my.hp = Math.max(0, my.hp - thornsDmg); }

      if (id === 'u') {
        my.ultCD = Math.floor(Math.random() * 4) + 3;
      }

      if (card.status === 'drain') {
        var drain = Math.floor(finalDmg * 0.35);
        my.hp = Math.min(my.maxHp, my.hp + drain);
        addLog(my.name + ' drenou ' + drain + ' HP!', 'drain-log');
      }

      if (card.status && card.status !== 'drain') {
        applyCardStatus(card, my, en, G.battle.enSt, G.battle.mySt);
      }

      renderCards();
      if (en.hp <= 0) {
        addLog(en.name + ' foi derrotado!', 'evt');
        if (typeof sfx === 'function') sfx('enemy_die');
        // Registrar vitória contra Bestial
        if (typeof onBattleWinBestialCheck === 'function') onBattleWinBestialCheck();
        if (typeof onKillUpdateEco === 'function') onKillUpdateEco(G.battle ? G.battle._sourceMob : null);
        if (typeof checkTerritoryExpansion === 'function') checkTerritoryExpansion();
        var _relicSoulBoost = (typeof getEquippedRelic === 'function' && getEquippedRelic() && getEquippedRelic().effect === 'soul_boost') ? 1.25 : 1.0;
        var _repBonus = (G.battle && G.battle.aIdx !== undefined) ? getRepSoulsBonus(G.battle.aIdx) : 1;
        var souls = Math.floor((en.level * 10 + Math.floor(Math.random() * 18)) * _relicSoulBoost * _repBonus);
        if (G.battle.isBoss) {
          var bossData = AREAS[G.battle.aIdx].boss;
          souls = bossData.souls;
          if (!G.bossDefeated) G.bossDefeated = [false, false, false, false, false, false];
          G.bossDefeated[G.battle.aIdx] = true;
          try { if (typeof onBossDefeated === 'function') onBossDefeated(G.battle.aIdx); } catch (e) { }
          addItem(bossData.reward);
          // Drop relic for this area
          var _relicDef = typeof RELIC_DEFS !== 'undefined' ? RELIC_DEFS.find(function (r) { return r.aIdx === G.battle.aIdx; }) : null;
          if (_relicDef) {
            addRelic(_relicDef.id);
            addLog('💎 RELÍQUIA OBTIDA: ' + _relicDef.icon + ' ' + _relicDef.name + '!', 'evt');
          }
          addLog('★ CHEFE DERROTADO! Recompensa: ' + bossData.reward + ' + ' + souls + ' almas!', 'evt');
          bestiaryRecord(en.name, 'defeated');
        }
        G.souls += souls;
        addLog('+' + souls + ' almas coletadas.', 'sys');
        var xpGain = Math.floor(en.level * 12 * (en.level >= my.level ? 1.3 : 0.8));
        if (G.buffs && G.buffs.xp_boost) { xpGain = Math.floor(xpGain * 1.5); G.buffs.xp_boost = false; addLog('Tonico consumido! XP x1.5!', 'evt'); renderBuffBar(); }
        addLog(my.name + ' ganhou ' + xpGain + ' XP!', 'xplog');
        tryDrop(G.battle.area.danger, en.el, G.battle.aIdx);
        try { bestiaryRecord(en.name, 'defeated'); } catch (e) { }
        try { questProgress('defeat', { areaIdx: G.battle.aIdx, el: en.el }); } catch (e) { }
        try { questProgress('win', { areaIdx: G.battle.aIdx }); } catch (e) { }
        try { if (G.battle.aIdx !== undefined) recordWin(G.battle.aIdx); } catch (e) { }
        // CRITICAL: mark over and close battle — nothing below must throw
        G.battle.over = true;
        renderBattle();
        var _xpGain2 = xpGain, _souls2 = souls, _my2 = my;
        setTimeout(function () {
          try { grantXP(_my2, _xpGain2); } catch (e) { }
          setTimeout(function () {
            var battleEl = document.getElementById('battle');
            if (battleEl) battleEl.style.display = 'none';
            var lvlOv = document.getElementById('lvlup-ov');
            if (lvlOv) lvlOv.style.display = 'none';
            try { notify('+' + _souls2 + ' Almas | +' + _xpGain2 + ' XP'); } catch (e) { }
            // Mob battle: permanently kill the map mob on victory
            if (G.battle && G.battle.isMobBattle && G.battle._sourceMob) {
              try { killMapMob(G.battle._sourceMob); } catch (e) { }
            }
            // Tick egg incubation
            try { if (typeof tickEggIncubation === 'function') tickEggIncubation(); } catch (e) { }
            // post_battle_regen relic: heal team 12% after victory
            try {
              var _prRelic = typeof getEquippedRelic === 'function' ? getEquippedRelic() : null;
              if (_prRelic && _prRelic.effect === 'post_battle_regen' && G.team) {
                G.team.forEach(function (tc) { if (tc && !tc.dead) { tc.hp = Math.min(tc.maxHp, tc.hp + Math.floor(tc.maxHp * 0.12)); } });
                addLog('[Raiz Sangrenta] o grupo recuperou HP!', 'evt');
              }
            } catch (e) { }
            // Dungeon: trigger callback instead of returning to explore
            if (G.battle && G.battle._dungCb) {
              var _cb = G.battle._dungCb;
              G.battle._dungCb = null;
              try { _cb(true); } catch (e) { showExplore(); }
            } else {
              showExplore();
            }
          }, 900);
        }, 50);
        return;
      }
      renderBattle();
      applyPassivesEndOfTurn(ac());
      renderPassivePips();
      G.battle._waitingEnemy = true; setTimeout(enemyAtk, 620);
    }

    function enemyAtk() {
      if (!G.battle || G.battle.over) return;
      // Clear turn lock — enemy is now attacking, player can plan next move after this
      if (G.battle) G.battle._waitingEnemy = false;
      var my = ac(), en = G.battle.enemy, def = CARDS[en.el];

      var stDmg = applyStatusDmg(en, G.battle.enSt, en.name);
      if (stDmg > 0) renderBattle();
      if (en.hp <= 0) {
        addLog(en.name + ' sucumbiu ao veneno/queimadura!', 'evt');
        var _relicSoulBoost = (typeof getEquippedRelic === 'function' && getEquippedRelic() && getEquippedRelic().effect === 'soul_boost') ? 1.25 : 1.0;
        var souls = Math.floor((en.level * 10 + Math.floor(Math.random() * 18)) * _relicSoulBoost);
        G.souls += souls;
        var xpGain = Math.floor(en.level * 12 * (en.level >= my.level ? 1.3 : 0.8));
        try { grantXP(my, xpGain); } catch (e) { }
        try { tryDrop(G.battle.area.danger, en.el, G.battle.aIdx); } catch (e) { }
        try { bestiaryRecord(en.name, 'defeated'); } catch (e) { }
        try { questProgress('defeat', { areaIdx: G.battle.aIdx, el: en.el }); } catch (e) { }
        try { questProgress('win', { areaIdx: G.battle.aIdx }); } catch (e) { }
        try { if (G.battle.aIdx !== undefined) recordWin(G.battle.aIdx); } catch (e) { }
        G.battle.over = true;
        renderBattle();
        setTimeout(function () {
          var battleEl2 = document.getElementById('battle');
          if (battleEl2) battleEl2.style.display = 'none';
          var lvlOv = document.getElementById('lvlup-ov');
          if (lvlOv) lvlOv.style.display = 'none';
          try { notify('+' + souls + ' Almas | +' + xpGain + ' XP'); } catch (e) { }
          showExplore();
        }, 900);
        return;
      }

      if (G.battle.enSt.paralyze > 0) {
        G.battle.enSt.paralyze--;
        if (Math.random() < 0.5) {
          addLog(en.name + ' esta paralisado e nao consegue agir!', 'para-log');
          renderBattle();
          return;
        }
      }

      var r = Math.random(), card, mult;
      if (r < 0.5) { card = def.b; mult = 1.0; } else if (r < 0.82) { card = def.m1; mult = def.m1.m; } else { card = def.m2; mult = def.m2.m; }
      var em = eMult(en.el, my.el);
      var critChance = 0.12;
      var isCrit = Math.random() < critChance;
      var critMult = isCrit ? 1.6 : 1.0;
      var myResist = getPassiveElResist(my, en.el);
      // PARRY: challenge shown inside the crit branch below (after rawDmg is known)

      var weatherMult2 = getWeatherMult(en.el, true) * getWeatherMult(my.el, false);
      // Enemy ATK weaken debuff
      var enAtkMult = (G.battle.enSt.weaken > 0) ? 0.65 : 1.0;
      // Enemy blind: 25% miss chance
      if (G.battle.enSt.blind > 0 && Math.random() < 0.25) {
        addLog(en.name + ' errou! (cego)', 'evt');
        applyPassivesEndOfTurn(ac()); applyStatusDmg(ac(), G.battle.mySt, ac().name); applyStatusDmg(en, G.battle.enSt, en.name);
        setBP('my', ac()); setBP('en', en); renderStatus('my-st', G.battle.mySt); renderStatus('en-st', G.battle.enSt);
        checkBattleEnd(); return;
      }
      // Player DEF weakened?
      var myDefMult = (G.battle.mySt.weakenDef > 0) ? 0.60 : 1.0;
      var coreMult = mult * em * critMult * myResist * weatherMult2;
      var atkRoll = en.atk * enAtkMult * coreMult * (0.85 + Math.random() * 0.3);
      var mitigation = atkRoll / (atkRoll + (my.def * myDefMult) * 1.2);
      var rawDmg = Math.max(1, Math.floor(atkRoll * mitigation));

      // FLEE FAIL PENALTY: boosted enemy damage
      if (_fleeFailPenalty) { rawDmg = Math.floor(rawDmg * 1.5); _fleeFailPenalty = false; addLog('Penalidade de fuga: dano aumentado!', 'sys'); }

      // GUARDIAN PASSIVAS — aplicadas antes da mitigação final
      if (heroHasPassive('guardian_block') && Math.random() < 0.20) {
        addLog('🛡 Escudo do Herói! Ataque bloqueado completamente!', 'evt');
        renderBattle();
        applyPassivesEndOfTurn(ac());
        setBP('my', ac()); setBP('en', en);
        renderStatus('my-st', G.battle.mySt); renderStatus('en-st', G.battle.enSt);
        checkBattleEnd(); return;
      }
      if (heroHasPassive('guardian_taunt') && G.hero && G.hero.hp > 1) {
        var _tauntDmg = Math.floor(rawDmg * 0.30);
        rawDmg = Math.max(1, rawDmg - _tauntDmg);
        G.hero.hp = Math.max(0, G.hero.hp - _tauntDmg);
        addLog('🛡 Provocação! Herói absorveu ' + _tauntDmg + ' de dano.', 'evt');
        renderHeroHUD && renderHeroHUD();
      }

      // Build label
      var lbl2 = card.n + '! ';
      if (em > 1) lbl2 += '(Super efetivo!) '; if (em < 1) lbl2 += '(Pouco efetivo) ';
      if (isCrit) lbl2 += 'CRITICO!! ';

      // PARRY: only on crits — show challenge, defer damage by parry window duration
      // Normal hits apply immediately with zero extra delay
      if (isCrit) {
        if (typeof showParryChallenge === 'function') showParryChallenge();
        var _snapRaw = rawDmg, _snapCard = card, _snapLbl = lbl2;
        var _snapMy = my, _snapEn = en;
        G.battle._waitingEnemy = true;
        var _parryResolveMs = (typeof _parryWindowMs !== 'undefined' ? _parryWindowMs : 2800) + 80;
        setTimeout(function () {
          if (!G.battle || G.battle.over) return;
          G.battle._waitingEnemy = false;
          var parried = !!_parrySuccess;
          _parrySuccess = false;
          var dmgMult = parried ? 0.25 : 1.0;
          var adjRaw = Math.max(1, Math.floor(_snapRaw * dmgMult));
          var finalDmg = calcDmgWithShield(adjRaw, G.battle.mySt, G.battle.enSt);
          var lbl = _snapLbl;
          if (parried) {
            lbl += '(APARADO! -75% DMG) ';
            var cDmg = Math.floor(_snapRaw * 0.40);
            _snapEn.hp = Math.max(0, _snapEn.hp - cDmg);
            addLog('⚡ PARRY PERFEITO! ' + _snapMy.name + ' contra-atacou por ' + cDmg + '!', 'evt');
          } else {
            if (typeof resetCombo === 'function') resetCombo();
          }
          _snapMy.hp = Math.max(0, _snapMy.hp - finalDmg);
          floatDmg('my', finalDmg, false);
          if (typeof triggerAttackAnim === 'function') triggerAttackAnim('en-wrap', -1);
          addLog(_snapEn.name + ': ' + lbl + 'causou ' + finalDmg + ' de dano!', 'edm crit-log');
          flashS('my-wrap');
          var tDmg = applyPassivesOnDamageReceived(_snapMy, finalDmg);
          if (tDmg > 0) { _snapEn.hp = Math.max(0, _snapEn.hp - tDmg); addLog(_snapEn.name + ' recebeu ' + tDmg + ' de espinhos!', 'dmg'); }
          if (G.battle.mySt.reflect > 0) { var rDmg = Math.floor(finalDmg * 0.40); _snapEn.hp = Math.max(0, _snapEn.hp - rDmg); addLog(_snapMy.name + ' [Espinhos] refletiu ' + rDmg + '!', 'evt'); }
          applyPassivesOnDamageDealt(_snapEn, _snapMy, finalDmg);
          if (_snapCard.status && _snapCard.status !== 'drain' && _snapCard.status !== 'shield') {
            applyCardStatus(_snapCard, _snapEn, _snapMy, G.battle.mySt, G.battle.enSt);
          }
          if (_snapMy.hp <= 0) {
            if ((G.battle.danger === 'lethal' || G.battle.danger === 'brutal') && !G.battle.escUsed) {
              _snapMy.hp = Math.ceil(_snapMy.maxHp * 0.02); G.battle.escUsed = true;
              addLog(_snapMy.name + ' esta com 2% HP! MINIJOGO DE FUGA!', 'evt');
              renderBattle(); setTimeout(startEscape, 750);
            } else { killCreature(_snapMy); }
          } else {
            renderBattle();
            if (_snapMy.hp / _snapMy.maxHp < 0.25) addLog(_snapMy.name + ' esta com HP critico!', 'sys');
          }
        }, _parryResolveMs);
        return; // deferred block handles everything for crits
      }

      // NON-CRIT: immediate damage, no delay at all
      var finalDmg = calcDmgWithShield(rawDmg, G.battle.mySt, G.battle.enSt);
      if (typeof resetCombo === 'function') resetCombo();
      my.hp = Math.max(0, my.hp - finalDmg);
      floatDmg('my', finalDmg, false);
      if (typeof triggerAttackAnim === 'function') triggerAttackAnim('en-wrap', -1);
      addLog(en.name + ': ' + lbl2 + 'causou ' + finalDmg + ' de dano!', 'edm');
      flashS('my-wrap');
      var thornsDmg = applyPassivesOnDamageReceived(my, finalDmg);
      if (thornsDmg > 0) { en.hp = Math.max(0, en.hp - thornsDmg); addLog(en.name + ' recebeu ' + thornsDmg + ' de espinhos!', 'dmg'); }
      if (G.battle.mySt.reflect > 0) { var refDmg2 = Math.floor(finalDmg * 0.40); en.hp = Math.max(0, en.hp - refDmg2); addLog(my.name + ' [Espinhos Antigos] refletiu ' + refDmg2 + '!', 'evt'); }
      applyPassivesOnDamageDealt(en, my, finalDmg);
      if (card.status && card.status !== 'drain' && card.status !== 'shield') {
        applyCardStatus(card, en, my, G.battle.mySt, G.battle.enSt);
      }
      if (my.hp <= 0) {
        if ((G.battle.danger === 'lethal' || G.battle.danger === 'brutal') && !G.battle.escUsed) {
          my.hp = Math.ceil(my.maxHp * 0.02); G.battle.escUsed = true;
          addLog(my.name + ' esta com 2% HP! MINIJOGO DE FUGA!', 'evt');
          renderBattle(); setTimeout(startEscape, 750);
        } else { killCreature(my); }
      } else {
        renderBattle();
        if (my.hp / my.maxHp < 0.25) addLog(my.name + ' esta com HP critico!', 'sys');
      }
    }


  



    // ===== STATE =====
    var G = { playerName: 'Cacador', souls: 0, team: [], hall: [], dead: [], items: [], battle: null, activeIdx: 0, regenInt: null, areaWins: [0, 0, 0, 0, 0, 0] };
    var HAND = { m1: 3, m2: 3, ultUsed: false };

    // ===== CREATURES =====




    // ===== XP & LEVEL UP =====



    function showLearnCardAnim(creature, learn) {
      var el = EL[creature.el];
      var hex = el ? el.hex : '#c9933a';
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-120px);' +
        'background:rgba(8,4,20,.96);border:1px solid ' + hex + ';border-radius:8px;' +
        'padding:12px 20px;text-align:center;z-index:9999;pointer-events:none;' +
        'animation:revFadeIn .3s ease;font-family:Cinzel,serif;';
      toast.innerHTML = '<div style="font-size:.86rem;color:' + hex + ';letter-spacing:.12em;margin-bottom:4px">NOVA HABILIDADE</div>' +
        '<div style="font-size:1.1rem;color:#eee;font-weight:600">' + learn.name + '</div>' +
        '<div style="font-size:.90rem;color:#aaa;margin-top:3px">Nv.' + learn.lvl + ' — ' + (creature.tplName || creature.name) + '</div>';
      document.body.appendChild(toast);
      setTimeout(function () { toast.style.opacity = '0'; toast.style.transition = 'opacity .4s'; }, 2200);
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2700);
    }

    function showLevelUpAnim(c, gains) {
      var ov = document.getElementById('lvlup-ov');
      ov.style.display = 'flex'; ov.style.flexDirection = 'column';
      ov.style.alignItems = 'center'; ov.style.justifyContent = 'center';
      document.getElementById('lu-name').textContent = c.name;
      document.getElementById('lu-lv').textContent = 'Nivel ' + c.level;
      document.getElementById('lu-stats').innerHTML =
        '<div class="lu-stat"><div class="lu-stat-lbl">HP MAX</div><div class="lu-stat-val">' + c.maxHp + '</div><div class="lu-stat-diff">+' + gains.hp + '</div></div>' +
        '<div class="lu-stat"><div class="lu-stat-lbl">ATK</div><div class="lu-stat-val">' + c.atk + '</div><div class="lu-stat-diff">+' + gains.atk + '</div></div>' +
        '<div class="lu-stat"><div class="lu-stat-lbl">DEF</div><div class="lu-stat-val">' + c.def + '</div><div class="lu-stat-diff">+' + gains.def + '</div></div>';
      setTimeout(function () { ov.style.display = 'none'; }, 2800);
    }

    // ===== SAVE / LOAD =====
    var SAVE_KEY_PREFIX = 'soulmon_save_v1_';
    var SAVE_LIST_KEY = 'soulmon_savelist_v1';





    function loadGameData(pname) {
      try {
        var raw = localStorage.getItem(SAVE_KEY_PREFIX + pname);
        if (!raw) return false;
        var data = JSON.parse(raw);
        if (G.regenInt) clearInterval(G.regenInt);
        Object.keys(SCNS).forEach(killS);
        OW.initialized = false;  // force mesh rebuild with saved weapon class
        destroyMap();
        if (OW.player) OW.player.mesh = null;
        G = {
          playerName: data.playerName || pname, souls: data.souls || 0, team: data.team || [], hall: data.hall || [], dead: data.dead || [], items: data.items || [], battle: null, activeIdx: data.activeIdx || 0, regenInt: null,
          areaWins: data.areaWins || [0, 0, 0, 0, 0, 0],
          bestiary: data.bestiary || {},
          quests: data.quests || {},
          buffs: data.buffs || {},
          bossDefeated: data.bossDefeated || [false, false, false, false, false, false],
          areaKills: data.areaKills || [0, 0, 0, 0, 0, 0],
          areaItems: data.areaItems || [0, 0, 0, 0, 0, 0],
          hero: data.hero || makeHero('sword'),
          plane: data.plane || 0,
          planePos: data.planePos || {},
          planeBossDefeated: data.planeBossDefeated || [false, false, false]
        };
        document.getElementById('titlescreen').style.display = 'none';
        document.getElementById('loadgame-ov').style.display = 'none';
        document.querySelector('#game > header').style.display = 'none';
        HAND = { m1: 3, m2: 3, ultUsed: false };
        startRegen(); showExplore();
        return true;
      } catch (e) { return false; }
    }


    // ===== TITLE SCREEN OVERLAYS =====
    function showNewGameModal() {
      var iv = document.getElementById('pname-input');
      iv.value = '';
      document.getElementById('newgame-ov').style.display = 'flex';
      iv.focus();
    }

    function cancelNewGame() {
      document.getElementById('newgame-ov').style.display = 'none';
    }

    function confirmNewGame() {
      var name = document.getElementById('pname-input').value.trim();
      if (!name) { notify('Digite um nome valido!'); return; }
      document.getElementById('newgame-ov').style.display = 'none';
      startNewGame(name);
    }

    function showLoadGameModal() {
      var grid = document.getElementById('save-grid');
      grid.innerHTML = '<div style="color:var(--mu);text-align:center;padding:16px;font-size:.7rem">Carregando saves...</div>';
      document.getElementById('loadgame-ov').style.display = 'flex';

      // Always start with local saves
      var localList = getSaveList();

      // If logged in, merge with cloud saves
      if (typeof sbLoadSaves === 'function' && SB && SB.token) {
        sbLoadSaves().then(function (cloudRows) {
          // Build merged list — cloud takes priority for same player_name
          var merged = {};
          localList.forEach(function (s) { merged[s.name] = { name: s.name, souls: s.souls, alive: s.alive, time: s.time, source: 'local' }; });
          cloudRows.forEach(function (row) {
            var d = row.save_data;
            var alive = (d.team || []).filter(function (c) { return !c.dead; }).length;
            merged[row.player_name] = { name: row.player_name, souls: d.souls || 0, alive: alive, time: new Date(row.updated_at).getTime(), source: 'cloud' };
            // Also sync cloud save to localStorage
            try {
              localStorage.setItem(SAVE_KEY_PREFIX + row.player_name, JSON.stringify(d));
              updateSaveList(row.player_name, { souls: d.souls || 0, alive: alive });
            } catch (e) { }
          });
          renderSaveGrid(Object.values(merged));
        }).catch(function () { renderSaveGrid(localList); });
      } else {
        renderSaveGrid(localList);
      }
    }

    function renderSaveGrid(list) {
      var grid = document.getElementById('save-grid');
      if (!list.length) { grid.innerHTML = '<div style="color:var(--mu);text-align:center;padding:16px;font-size:.7rem">Nenhum save encontrado.</div>'; return; }
      list.sort(function (a, b) { return b.time - a.time; });
      var html = '';
      list.forEach(function (s) {
        var dateStr = new Date(s.time).toLocaleString('pt-BR');
        var cloudBadge = s.source === 'cloud' ? '<span class="save-cloud-badge">☁ Nuvem</span>' : '<span class="save-cloud-badge local-badge">📁 Local</span>';
        html += '<div class="save-card-wrap">';
        html += '<div class="save-card" onclick="loadGameData(\'' + s.name + '\')">';
        html += '<div class="save-name">' + s.name + ' ' + cloudBadge + '</div>';
        html += '<div class="save-info">' + s.alive + ' criatura(s) viva(s) · ' + s.souls + ' almas<br>' + dateStr + '</div>';
        html += '</div>';
        html += '<button class="save-delete-btn" onclick="confirmDeleteSave(\'' + s.name + '\', \'' + s.source + '\')" title="Apagar save">✕</button>';
        html += '</div>';
      });
      grid.innerHTML = html;
    }

    function confirmDeleteSave(pname, source) {
      var modal = document.getElementById('delete-save-modal');
      document.getElementById('delete-save-name').textContent = pname;
      modal._pname = pname;
      modal._source = source;
      modal.style.display = 'flex';
    }

    function cancelDeleteSave() {
      document.getElementById('delete-save-modal').style.display = 'none';
    }

    function executeDeleteSave() {
      var modal = document.getElementById('delete-save-modal');
      var pname = modal._pname;
      var source = modal._source;
      modal.style.display = 'none';

      // Delete local
      try {
        localStorage.removeItem(SAVE_KEY_PREFIX + pname);
        var list = getSaveList().filter(function (s) { return s.name !== pname; });
        localStorage.setItem(SAVE_LIST_KEY, JSON.stringify(list));
      } catch (e) { }

      // Delete cloud if logged in
      if (source === 'cloud' && typeof sbDeleteSave === 'function' && SB && SB.token) {
        sbDeleteSave(pname).catch(function () { });
      }

      notify('Save "' + pname + '" apagado.');
      showLoadGameModal(); // refresh grid
    }

    function cancelLoadGame() {
      document.getElementById('loadgame-ov').style.display = 'none';
    }

    var SOULMON_DEBUG = (function () {
      var params;
      try { params = new URLSearchParams(window.location.search || ''); }
      catch (e) { params = new URLSearchParams(''); }
      return {
        autostart: params.get('debug_autostart') === '1',
        skipCrawl: params.get('debug_skip_crawl') === '1' || params.get('debug_autostart') === '1',
        name: params.get('debug_name') || 'Debug',
        started: false
      };
    })();

    function showTitle() {
      if (G.regenInt) clearInterval(G.regenInt);
      document.getElementById('titlescreen').style.display = 'flex';
      document.getElementById('explore').style.display = 'none';
      document.getElementById('battle').style.display = 'none';
      document.getElementById('goscreen').style.display = 'none';
      document.querySelector('#game > header').style.display = 'none';
      renderAuthUI();

      // Check saves — cloud if logged in, else local
      if (typeof sbLoadSaves === 'function' && SB && SB.token) {
        document.getElementById('save-hint').textContent = 'Verificando saves na nuvem...';
        document.getElementById('btn-load').disabled = false;
        sbLoadSaves().then(function (rows) {
          var localList = getSaveList();
          var names = new Set(rows.map(function (r) { return r.player_name; }));
          localList.forEach(function (s) { names.add(s.name); });
          var total = names.size;
          document.getElementById('btn-load').disabled = total === 0;
          document.getElementById('save-hint').textContent = total > 0 ? '☁ ' + total + ' save(s) na nuvem' : 'Nenhum save encontrado';
        }).catch(function () {
          var list = getSaveList();
          document.getElementById('btn-load').disabled = list.length === 0;
          document.getElementById('save-hint').textContent = list.length > 0 ? list.length + ' save(s) local(is)' : 'Nenhum save encontrado';
        });
      } else {
        var list = getSaveList();
        var has = list.length > 0;
        document.getElementById('btn-load').disabled = !has;
        document.getElementById('save-hint').textContent = has ? list.length + ' save(s) encontrado(s)' : 'Nenhum save encontrado';
      }

      if (SOULMON_DEBUG.autostart && !SOULMON_DEBUG.started) {
        SOULMON_DEBUG.started = true;
        setTimeout(function () {
          startNewGame(SOULMON_DEBUG.name);
        }, 60);
      }
    }


    // ══════════════════════════════════════════════════════════════
    // INTRO CRAWL — Star Wars style, shown on first new game
    // ESC skips it. Auto-ends after ~20s.
    // ══════════════════════════════════════════════════════════════
    var _crawlTimer = null;
    var _crawlKeyHandler = null;

    function showIntroCrawl(onDone) {
      var crawl = document.getElementById('intro-crawl');
      if (!crawl) { onDone(); return; }
      if (SOULMON_DEBUG.skipCrawl) { onDone(); return; }

      // Generate stars
      var starsEl = document.getElementById('crawl-stars');
      if (starsEl && !starsEl._built) {
        var starsHtml = '';
        for (var i = 0; i < 180; i++) {
          var x = Math.random() * 100, y = Math.random() * 100;
          var s = 0.5 + Math.random() * 2;
          var op = 0.3 + Math.random() * 0.7;
          starsHtml += '<div style="position:absolute;left:' + x + '%;top:' + y + '%;width:' + s + 'px;height:' + s + 'px;background:#fff;border-radius:50%;opacity:' + op + ';"></div>';
        }
        starsEl.innerHTML = starsHtml;
        starsEl._built = true;
        // Random twinkle on some stars
        starsEl.querySelectorAll('div').forEach(function (s, i) {
          if (Math.random() < 0.35) {
            var dur = (1.5 + Math.random() * 3).toFixed(1) + 's';
            var delay = (Math.random() * 3).toFixed(1) + 's';
            s.style.animation = 'twinkle ' + dur + ' ease-in-out ' + delay + ' infinite';
          }
        });
      }

      crawl.style.display = 'flex';
      // Reset animation
      var content = document.getElementById('crawl-content');
      if (content) { content.style.animation = 'none'; void content.offsetWidth; content.style.animation = 'crawlScroll 28s linear forwards'; }

      function endCrawl() {
        if (_crawlTimer) { clearTimeout(_crawlTimer); _crawlTimer = null; }
        if (_crawlKeyHandler) { window.removeEventListener('keydown', _crawlKeyHandler); _crawlKeyHandler = null; }
        crawl.style.animation = 'crawlFadeOut 0.8s ease forwards';
        setTimeout(function () {
          crawl.style.display = 'none';
          crawl.style.animation = '';
          onDone();
        }, 800);
      }

      _crawlTimer = setTimeout(endCrawl, 28500);

      _crawlKeyHandler = function (e) {
        if (e.key === 'Escape') { e.preventDefault(); endCrawl(); }
      };
      window.addEventListener('keydown', _crawlKeyHandler);
    }
    function startNewGame(pname) {
      document.getElementById('titlescreen').style.display = 'none';
      document.querySelector('#game > header').style.display = 'none'; // explore is now fullscreen
      if (G.regenInt) clearInterval(G.regenInt);
      Object.keys(SCNS).forEach(killS);
      OW.initialized = false;  // force mesh rebuild with correct weapon class
      destroyMap();
      if (OW.player) OW.player.mesh = null;
      G = {
        playerName: pname, souls: 0, team: [], hall: [], dead: [], items: [], battle: null, activeIdx: 0, regenInt: null,
        areaWins: [0, 0, 0, 0, 0, 0],
        bestiary: {},
        quests: {},
        bossDefeated: [false, false, false, false, false, false],
        areaKills: [0, 0, 0, 0, 0, 0],
        areaItems: [0, 0, 0, 0, 0, 0],
        hero: makeHero(_selectedWeapon || 'sword'),
        plane: 0,
        planePos: {},
        planeBossDefeated: [false, false, false],
        viveiro: [],
        equippedRelic: null,
        relicInventory: [],
        discoveredSpecials: {}
      };
      HAND = { m1: 3, m2: 3, ultUsed: false };
      G._runStart = Date.now(); // track run duration
      G._runCaptures = 0;       // count creatures captured this run
      // Apply metamorphosis from previous run
      try { if (typeof applyMetamorphosis === 'function') setTimeout(applyMetamorphosis, 1000); } catch (e) { }
      // Gift: 1 random Œuf Maudit to start — element chosen randomly
      var _startEls = ['fire', 'water', 'earth', 'dark', 'light', 'nature', 'electric'];
      var _startEl = _startEls[Math.floor(Math.random() * _startEls.length)];
      G.viveiro = [{ id: 'start_egg', el: _startEl, rarity: 'common', battlesLeft: 3, incubating: true }];
      // Show intro crawl on first play, then start the game
      showIntroCrawl(function () {
        startRegen(); showExplore();
        saveGame();
      });
    }

    function quitGame() {
      document.getElementById('titlescreen').innerHTML =
        '<div style="text-align:center;padding:40px"><div class="title-logo" style="font-size:2rem;margin-bottom:16px">ATE A PROXIMA</div>' +
        '<div style="color:var(--mu);font-style:italic;font-size:.9rem">Feche esta aba para sair.</div>' +
        '<div class="title-deco"></div>' +
        '<button class="tmenu-btn tmenu-new" onclick="location.reload()" style="max-width:220px;margin:0 auto">↩ Voltar ao Menu</button></div>';
    }

    function initGame() {
      G = {
        playerName: 'Cacador', souls: 0, team: [mkC(TPLS[0], 3), mkC(TPLS[2], 4)], hall: [], dead: [], items: [], battle: null, activeIdx: 0, regenInt: null,
        areaWins: [0, 0, 0, 0, 0, 0],
        bestiary: {},
        quests: {},
        bossDefeated: [false, false, false, false, false, false],
        areaKills: [0, 0, 0, 0, 0, 0],
        areaItems: [0, 0, 0, 0, 0, 0]
      };
      HAND = { m1: 3, m2: 3, ultUsed: false };
      showTitle();

      // Apply saved UI scale
      try {
        var _s = loadSettings();
        if (_s.ui_scale) applyUIScale(_s.ui_scale);
        if (_s.ui_scale_battle) {
          applyUIScaleBattle(_s.ui_scale_battle);
          var bsl = document.getElementById('set-ui-scale-battle');
          var bslv = document.getElementById('set-ui-scale-battle-val');
          if (bsl) bsl.value = _s.ui_scale_battle;
          if (bslv) bslv.textContent = Math.round(_s.ui_scale_battle * 100) + '%';
        }
      } catch (e) { }
      // Iniciar ecossistema
      if (typeof initEcosystem === 'function') setTimeout(initEcosystem, 2000);
    }

    // ===== REGEN =====

    // ===== EXPLORE =====
    function cleanupDeadTeam() {
      var alive = [];
      G.team.forEach(function (c) {
        if (!c) return; // skip null slots
        if (c.dead) G.dead.push(c);
        else alive.push(c);
      });
      G.team = alive;
    }

    function showExplore() {
      _encCooldown = 4;
      _mobBattleReturnTime = Date.now();
      _mobBattleCooldown = false;
      doScreenTransition(function () {
        if (typeof stopBattleVisuals === 'function') stopBattleVisuals();
        if (typeof applyBattleScars === 'function') applyBattleScars();
        if (typeof updateAllDockBadges === 'function') updateAllDockBadges();
        // Limpar mãos sorteadas — nova batalha = novo sorteio
        if (G && G.team) G.team.forEach(function (cr) { if (cr) cr._battleHand = null; });
        if (G && G.hall) G.hall.forEach(function (cr) { if (cr) cr._battleHand = null; });
        document.getElementById('explore').style.display = 'flex';
        document.getElementById('battle').style.display = 'none';
        var lvlOv = document.getElementById('lvlup-ov');
        if (lvlOv) lvlOv.style.display = 'none';
        var contBtn = document.getElementById('battle-continue-btn');
        if (contBtn) contBtn.style.display = 'none';
        document.getElementById('goscreen').style.display = 'none';
        killS('my-wrap'); killS('en-wrap');
        cleanupDeadTeam();

        // Decrement Ultimate Cooldowns after battle
        G.team.forEach(function (c) {
          if (c.ultCD > 0) c.ultCD--;
        });
        G.hall.forEach(function (c) {
          if (c.ultCD > 0) c.ultCD--;
        });

        // Only save if the player still has a living creature somewhere
        var anyAlive = G.team.some(function (c) { return !c.dead; }) || G.hall.some(function (c) { return !c.dead; });
        if (anyAlive) saveGame();
        renderExpC();
        ensureHero();
        renderHeroHUD();
        setTimeout(function () { renderAreas(); }, 50);
      }); // end doScreenTransition
    }

    function renderExplore() { renderExpC(); setTimeout(function () { renderAreas(); }, 50); }

    function updateAllDockBadges() {
      // Viveiro
      updateVivBadge();

      // Bestiário — mostrar ponto se tem criaturas não vistas
      var bb = document.getElementById('bbadge');
      if (bb) {
        var bCount = G.bestiary ? Object.keys(G.bestiary).length : 0;
        bb.style.display = 'none'; // sem número, só silencioso
      }

      // Quests — mostrar ! se tem quest nova/completada
      var qb = document.getElementById('qbadge');
      if (qb) {
        var hasNew = false;
        if (G.quests) {
          Object.keys(G.quests).forEach(function (qid) {
            var qs = G.quests[qid];
            if (qs && qs.status === 'complete' && !qs.claimed) hasNew = true;
          });
        }
        qb.style.display = hasNew ? 'inline-block' : 'none';
      }

      // Itens/Relíquias — mostrar número se > 0
      var ib = document.getElementById('ibadge');
      if (ib) {
        var tot = typeof totalUniqueItems === 'function' ? totalUniqueItems() : 0;
        if (tot > 0) { ib.style.display = 'inline'; ib.textContent = tot; }
        else ib.style.display = 'none';
      }
    }

    function updateVivBadge() {
      var badge = document.getElementById('viv-badge');
      if (!badge) return;
      var eggs = (G.viveiro || []);
      var incubating = eggs.filter(function (e) { return e.incubating; }).length;
      var ready = eggs.filter(function (e) { return e.battlesLeft <= 0; }).length;
      if (ready > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = '!';
        badge.style.background = '#2ecc71';
      } else if (incubating > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = incubating;
        badge.style.background = '';
      } else {
        badge.style.display = 'none';
      }
    }

    // ===== 2D MINIMAP =====
    var _mmCache = null; // cached terrain ImageData

    function drawMinimap() {
      var canvas = document.getElementById('minimap-canvas');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var S = 160; // canvas resolution = 1px per tile
      var TILES = WW.W; // world tiles
      // canvas interno é sempre 160x160; o CSS faz o upscale para 220px (pixelated)

      // Rebuild terrain cache when grid changes (once per plane load)
      if (!_mmCache || OW._miniDirty) {
        _mmCache = ctx.createImageData(S, S);
        var d = _mmCache.data;
        for (var tz = 0; tz < TILES; tz++) {
          for (var tx = 0; tx < TILES; tx++) {
            var cell = OW.grid[tx + ',' + tz];
            var r = 6, g = 8, b = 16; // default dark
            if (cell) {
              var biome = BIOMES[cell.biome];
              if (!biome) biome = BIOMES[0];
              var col = cell.hn < 0.22 ? 0x1a5888 : (biome.top || 0x3a9e58);
              if (cell.special === 'bosslair') col = 0x8a0a0a;
              else if (cell.special === 'dungeon') col = 0x5a1a8a;
              // sanctuary/vendor painted separately (only after discovery)
              else if (cell.special === 'portal_exit') col = 0x9922ff;
              else if (cell.special === 'portal_return') col = 0x22aaff;
              else if (cell.solid) col = 0x2a4a1e; // trees darker
              else if (cell.enc) col = 0x0d2e0e;   // bushes very dark
              r = (col >> 16) & 0xff;
              g = (col >> 8) & 0xff;
              b = col & 0xff;
              // Height shading — brighter on peaks
              var bright = 0.7 + cell.hn * 0.5;
              r = Math.min(255, Math.round(r * bright));
              g = Math.min(255, Math.round(g * bright));
              b = Math.min(255, Math.round(b * bright));
            }
            var i = (tz * S + tx) * 4;
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
          }
        }
        // Draw special markers into cache (static — only rebuilt on plane change)
        // Sanctuary + vendor only appear after player discovers them (steps on tile)
        // Boss lairs always visible
        var _specDefs = [
          { type: 'sanctuary', color: [212, 160, 23], r: 3, requiresDisc: true },
          { type: 'vendor', color: [58, 128, 217], r: 2, requiresDisc: true },
          { type: 'bosslair', color: [180, 20, 20], r: 3, requiresDisc: false },
          { type: 'portal_exit', color: [153, 34, 255], r: 2, requiresDisc: false },
          { type: 'portal_return', color: [34, 170, 255], r: 2, requiresDisc: false },
          { type: 'peaceful', color: [80, 200, 120], r: 4, requiresDisc: false },
          { type: 'nest', color: [200, 150, 40], r: 2, requiresDisc: true },
          { type: 'boss_vendor', color: [255, 100, 200], r: 3, requiresDisc: false },
        ];
        var _disc = G.discoveredSpecials || {};
        for (var _ssk in OW.grid) {
          var _ssc = OW.grid[_ssk];
          if (!_ssc || !_ssc.special) continue;
          var _sdef = _specDefs.find(function (sd) { return sd.type === _ssc.special; });
          if (!_sdef) continue;
          // Skip undiscovered sanctuary/vendor
          if (_sdef.requiresDisc && !_disc[_ssc.special + ':' + _ssk]) continue;
          var _ssxy = _ssk.split(',');
          var _ssx = parseInt(_ssxy[0]), _ssz = parseInt(_ssxy[1]);
          for (var _dr = -_sdef.r; _dr <= _sdef.r; _dr++) {
            for (var _dc = -_sdef.r; _dc <= _sdef.r; _dc++) {
              if (_dr * _dr + _dc * _dc > _sdef.r * _sdef.r) continue;
              var _pi = ((_ssz + _dc) * S + (_ssx + _dr)) * 4;
              if (_pi < 0 || _pi >= _mmCache.data.length - 3) continue;
              _mmCache.data[_pi] = _sdef.color[0];
              _mmCache.data[_pi + 1] = _sdef.color[1];
              _mmCache.data[_pi + 2] = _sdef.color[2];
              _mmCache.data[_pi + 3] = 255;
            }
          }
        }
        OW._miniDirty = false;
      }

      ctx.putImageData(_mmCache, 0, 0);


      // Draw player position
      var px = OW.player.x, pz = OW.player.z;
      // Facing arrow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px + 0.5, pz + 0.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#aaddff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, pz + 0.5);
      ctx.lineTo(px + 0.5 + OW.player.facing.x * 5, pz + 0.5 + OW.player.facing.z * 5);
      ctx.stroke();

      // View cone (fog of war hint) — draw rectangle of visible range
      ctx.strokeStyle = 'rgba(180,220,255,0.25)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px - 15, pz - 12, 30, 24);
    }

    function owDebug(msg) {
      var ui = document.getElementById('ow-ui');
      if (ui) ui.textContent = msg;
      console.log('[OW]', msg);
    }

    function renderAreas() {
      var wrap = document.getElementById('ow-wrap');
      if (!wrap) { owDebug('ERR: no ow-wrap'); return; }
      var W = wrap.offsetWidth, H = wrap.offsetHeight;
      owDebug('renderAreas W=' + W + ' H=' + H + ' init=' + OW.initialized);
      if (W < 10 || H < 10) {
        setTimeout(function () { renderAreas(); }, 150);
        return;
      }
      if (!OW.initialized) {
        try { initMap(); } catch (e) { owDebug('initMap ERR: ' + e.message); }
      } else {
        if (!OW.animId) drawMapLoop();
        if (OW.rend) {
          OW.rend.setSize(W, H);
          if (OW.cam) { OW.cam.aspect = W / H; OW.cam.updateProjectionMatrix(); }
        }
      }
    }

    // ===== BUFF DISPLAY =====
    var BUFF_META = {
      orb_better: { icon: '📖', label: 'Grimorio Reforçado', desc: '+20% chance de vinculacao na proxima batalha', cls: 'bc-orb' },
      xp_boost: { icon: '★', label: 'Tônico Ativo', desc: '+50% XP na próxima vitória', cls: 'bc-xp' }
    };
    function renderBuffBar() {
      var bar = document.getElementById('buff-bar');
      if (!bar) return;
      if (!G.buffs) G.buffs = {};
      var active = Object.keys(BUFF_META).filter(function (k) { return G.buffs[k]; });
      if (!active.length) { bar.style.display = 'none'; return; }
      var html = '<span class="buff-bar-label">Buffs Ativos</span>';
      active.forEach(function (k) {
        var m = BUFF_META[k];
        html += '<span class="buff-chip ' + m.cls + '">';
        html += '<span class="buff-chip-icon">' + m.icon + '</span>';
        html += m.label;
        html += '<span class="buff-chip-desc">' + m.desc + '</span>';
        html += '</span>';
      });
      bar.innerHTML = html;
      bar.style.display = 'flex';
    }
    function renderBattleBuffs() {
      var el = document.getElementById('battle-buffs');
      if (!el) return;
      if (!G.buffs) G.buffs = {};
      var active = Object.keys(BUFF_META).filter(function (k) { return G.buffs[k]; });
      if (!active.length) { el.innerHTML = ''; return; }
      el.innerHTML = active.map(function (k) {
        var m = BUFF_META[k];
        return '<span class="bbuff-pill ' + m.cls + '" title="' + m.desc + '">' + m.icon + ' ' + m.label + '</span>';
      }).join('');
    }

    function renderExpC() {
      document.getElementById('ui-pname').textContent = (G.playerName || 'CACADOR SEM NOME').toUpperCase();
      document.getElementById('soul-c').textContent = G.souls;
      document.getElementById('alive-c').textContent = G.team.filter(function (c) { return !c.dead; }).length;
      document.getElementById('hall-c').textContent = G.hall.length;
      document.getElementById('dead-c').textContent = G.dead.length;
      if (typeof updateAllDockBadges === 'function') updateAllDockBadges();
      renderBuffBar();
      var g = document.getElementById('mycreat');
      var html = '';
      G.team.forEach(function (c) {
        var p = c.hp / c.maxHp;
        var xpPct = c.xpNext > 0 ? Math.floor((c.xp / c.xpNext) * 100) : 0;
        var rg = (!c.dead && c.hp < c.maxHp) ? '<div class="rgl-slow">regen lento (campo)</div>' : '';
        var tpl = TPLS.find(function (t) { return t.name === c.name; });
        var passiveHtml = '';
        if (tpl && tpl.passives && tpl.passives.length) {
          passiveHtml = '<div class="cpassive-row">' + tpl.passives.map(function (p) {
            var active = c.level >= p.lvl;
            return '<span class="cpassive-tag' + (active ? '' : ' locked') + '" title="' + p.desc + (active ? '' : ' (Nivel ' + p.lvl + ')') + '">' + p.name + '</span>';
          }).join('') + '</div>';
        }
        html += '<div class="cc' + (c.dead ? ' dead' : '') + '">';
        html += '<div class="cname">' + c.name + '</div>';
        html += '<div class="clvl">Nivel ' + c.level + '</div>';
        html += '<div class="eb el-' + c.el + '">' + EL[c.el].name + '</div>';
        html += '<div class="hbw"><div class="hb" style="width:' + (p * 100) + '%;background:' + hpCol(p) + '"></div></div>';
        html += '<div class="hbt">' + c.hp + '/' + c.maxHp + ' HP</div>';
        html += '<div class="xpbar-w"><div class="xpbar" style="width:' + xpPct + '%"></div></div>';
        html += '<div class="xpt">XP ' + c.xp + '/' + c.xpNext + '</div>';
        // Cicatrizes
        var scarHtml = '';
        if (c._scars && c._scars.length > 0) {
          var scarIcons = { slash: '⚔', burn: '🔥', claw: '🐾', bite: '💀', void: '☽' };
          scarHtml = '<div style="font-size:1.04rem;color:rgba(200,80,80,.7);margin-top:2px;letter-spacing:.05em">' +
            c._scars.map(function (s) { return scarIcons[s.type] || '⚔'; }).join('') +
            ' <span style="opacity:.6">cicatriz</span></div>';
        }
        html += passiveHtml + scarHtml + rg + '</div>';
      });
      g.innerHTML = html;
      // Draw minimap
      try { if (OW.grid && Object.keys(OW.grid).length > 0) drawMinimap(); } catch (e) { }
    }

    // ===== 3D OVERWORLD =====
    // ============================================================
    // SOULMON — VOXEL WORLD  (contiguous biome map)
    // ============================================================


    // ============================================================
    // SOULMON — VOXEL WORLD  (contiguous biome map)
    // ============================================================
    var OW = {
      rend: null, scene: null, cam: null, animId: null, initialized: false,
      keys: { w: 0, a: 0, s: 0, d: 0 },
      player: { x: 0, z: 0, mesh: null, moveT: 0, tX: 0, tZ: 0, facing: { x: 0, z: 1 } },
      grid: {},        // key "x,z" -> cell {aIdx,h,enc,special,biome}
      chunkGroup: null,
      _lastZone: -1,
      _miniCanvas: null,
      _miniDirty: true
    };

    // ---- World dimensions ----
    var WW = { W: 160, H: 160, WATER: 2 };

    // ---- Biome definitions (one per area index 0-5) ----
    var BIOMES = [
      { name: 'plains', top: 0x3a9e58, side: 0x2d7a44, sub: 0x6b3e1e, enc: 0.55 },
      { name: 'forest', top: 0x1a5c30, side: 0x14431f, sub: 0x3d2210, enc: 0.70 },
      { name: 'volcanic', top: 0x6e3010, side: 0x4a1e08, sub: 0x8a2200, enc: 0.45 },
      { name: 'void', top: 0x12141e, side: 0x0a0c14, sub: 0x1a1c2a, enc: 0.60 },
      { name: 'swamp', top: 0x1e4428, side: 0x162f1c, sub: 0x2a1e10, enc: 0.65 },
      { name: 'thunder', top: 0x4a5060, side: 0x32383e, sub: 0x58606a, enc: 0.50 },
    ];
    var WATER_COL = 0x1a5888;
    var LAVA_COL = 0xdd4400;
    var SAND_COL = 0xc4a862; // beach sand
    var SAND_WET = 0xa08848; // wet sand (water edge)
    var SANC_COL = 0xd4a017;
    var SHOP_COL = 0x3a80d9;
    var PLAYER_COL = 0xc9933a;
    var BOSS_COL = 0x8a0a0a;
    var PEACE_COL = 0x88cc88; // peaceful village green
    var PEACE_WALL = 0xc8b48a; // warm stone walls
    var PEACE_ROOF = 0x884422; // dark wood roofs
    var PEACE_LIGHT = 0xffeeaa; // warm lantern glow
    var PORTAL_COL = 0x9922ff;

    // ===== PLANE DEFINITIONS =====
    // Each plane is a self-contained 160x160 map with unique biome seed + fog + mobs
    var PLANES = [
      {
        id: 0,
        name: 'Floresta das Almas',
        subtitle: 'Onde os espíritos da natureza vagam...',
        fogColor: 0x060810,
        heightSeed: 3.7,
        biomeShift: 0,   // uses default owBiome
        portalPos: { x: 78, z: 58 },   // exit portal to plane 1 (near center)
        returnPos: null,                // no return (first plane)
        unlockReq: null,                // always open
        bossIdxRequired: null,          // no boss req (entry plane)
        playerStart: { x: 35, z: 35 }
      },
      {
        id: 1,
        name: 'Charneca Ardente',
        subtitle: 'Calor eterno. Cinzas que nunca pousam.',
        fogColor: 0x1a0800,
        heightSeed: 7.2,
        biomeShift: 2,   // biomes shifted: volcanic dominant
        portalPos: { x: 100, z: 80 },  // exit portal to plane 2
        returnPos: { x: 60, z: 100 },  // return portal to plane 0 — well away from exit
        unlockReq: 0,                   // need plane 0 boss defeated
        bossIdxRequired: [2, 5],        // volcanic + thunder bosses
        playerStart: { x: 80, z: 80 }
      },
      {
        id: 2,
        name: 'Abismo Espectral',
        subtitle: 'Além da morte. Além do esquecimento.',
        fogColor: 0x08021a,
        heightSeed: 11.9,
        biomeShift: 3,   // void dominant
        portalPos: null,                // no exit (final plane)
        returnPos: { x: 35, z: 35 },   // return to plane 1
        unlockReq: 1,                   // need plane 1 boss defeated
        bossIdxRequired: [3],           // void boss
        playerStart: { x: 75, z: 75 }
      }
    ];

    // current active plane index
    // (stored in G.plane, default 0)


    // ---- Area center positions in the 160x160 map ----
    var AREA_CENTERS = [
      { x: 35, z: 35 },   // 0 Planicie
      { x: 110, z: 30 },   // 1 Floresta
      { x: 130, z: 100 },  // 2 Vulcanico
      { x: 75, z: 130 },  // 3 Vazio
      { x: 28, z: 110 },  // 4 Pantano
      { x: 80, z: 65 },   // 5 Pico (centro)
    ];

    // ---- Noise (layered sines) ----


    //   // ── Island edge falloff: irregular coastline ──
    //   // Distance from each edge (0=edge, 1=center)
    //   var ex = Math.min(x, WW.W - 1 - x) / (WW.W * 0.18);
    //   var ez = Math.min(z, WW.H - 1 - z) / (WW.H * 0.18);
    //   var edgeDist = Math.min(1.0, Math.min(ex, ez));
    //   // Coastal noise: makes the waterline jagged instead of straight
    //   var coastNoise = owNoise(x, z, 0.28, _ps * 2.7) * 0.55
    //     + owNoise(x, z, 0.55, _ps * 5.1) * 0.30
    //     + owNoise(x, z, 1.1, _ps * 9.3) * 0.15;
    //   // edgeFalloff: smoothly pulls height down near edges, modulated by coast noise
    //   // Near the edge (edgeDist→0), coastNoise determines how much land vs water
    //   var edgeFalloff = Math.pow(edgeDist, 1.4) * (0.55 + coastNoise * 0.45);
    //   h = h * edgeFalloff + (1 - edgeFalloff) * 0.08;

    //   return Math.max(0.05, Math.min(1.0, h));
    // }


    // ---- Build grid ----
    // Returns 0..1 — density of encounter vegetation at this tile
    // Uses two noise layers: large blobs + medium variation
    // Result < 0.45 → open clearing, > 0.45 → possible vegetation

    function buildGrid() {
      OW.grid = {};
      var specials = {};

      // Boss lairs: one per area, fixed near center
      for (var i = 0; i < AREA_CENTERS.length; i++) {
        var cx = AREA_CENTERS[i].x, cz = AREA_CENTERS[i].z;
        specials[cx + ',' + (cz - 5)] = { special: 'bosslair', aIdx: i };
      }

      // 2 sanctuaries + 2 vendors placed at truly random map positions
      // Seeded so layout is stable per plane, but scattered across the whole map
      var _rng = (function (seed) {
        var s = seed;
        return function () { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
      })(31337 + (G.plane || 0) * 9973);

      function _randSpecial(type, aIdx) {
        var tries = 0, tx, tz;
        do {
          tx = 8 + Math.floor(_rng() * (WW.W - 16));
          tz = 8 + Math.floor(_rng() * (WW.H - 16));
          tries++;
          // Must be on solid land (not water or beach)
          var _hn = owHeight(tx, tz);
          if (_hn < 0.32) continue; // water / beach — skip
          var key = tx + ',' + tz;
          var tooClose = specials[key] || false;
          if (!tooClose) {
            for (var _k in specials) {
              var _kp = _k.split(',');
              if (Math.abs(parseInt(_kp[0]) - tx) < 12 && Math.abs(parseInt(_kp[1]) - tz) < 12) { tooClose = true; break; }
            }
          }
          if (!tooClose) break;
        } while (tries < 60);
        if (tries < 60) specials[tx + ',' + tz] = { special: type, aIdx: aIdx };
      }

      // Pick 2 random area indices for sanctuary, 2 different ones for vendor
      var _allAreas = [0, 1, 2, 3, 4, 5];
      // Shuffle with rng
      for (var _si = _allAreas.length - 1; _si > 0; _si--) {
        var _sj = Math.floor(_rng() * (_si + 1));
        var _tmp2 = _allAreas[_si]; _allAreas[_si] = _allAreas[_sj]; _allAreas[_sj] = _tmp2;
      }
      _randSpecial('sanctuary', _allAreas[0]);
      _randSpecial('sanctuary', _allAreas[1]);
      _randSpecial('vendor', _allAreas[2]);
      _randSpecial('vendor', _allAreas[3]);

      // Peaceful zones: 1 per plane near player start, + 1 extra scattered
      var _planeStart = (PLANES[G.plane || 0] || PLANES[0]).playerStart || { x: 35, z: 35 };
      specials[_planeStart.x + ',' + _planeStart.z] = { special: 'peaceful', aIdx: 0 };
      _randSpecial('peaceful', _allAreas[4]);

      // Egg nests: 4 scattered across map (biome element varies by position)
      _randSpecial('nest', _allAreas[0]);
      _randSpecial('nest', _allAreas[2]);
      _randSpecial('nest', _allAreas[4]);
      _randSpecial('nest', _allAreas[5]);

      // Dungeon Express: 2 entrances per map, in different areas
      _randSpecial('dungeon', _allAreas[1]);
      _randSpecial('dungeon', _allAreas[3]);

      // Portal tiles for current plane
      var _curPlane = PLANES[G.plane || 0] || PLANES[0];
      if (_curPlane.portalPos) {
        var pp = _curPlane.portalPos;
        specials[pp.x + ',' + pp.z] = { special: 'portal_exit', toPlane: (_curPlane.id + 1) };
      }
      if (_curPlane.returnPos) {
        var rp = _curPlane.returnPos;
        specials[rp.x + ',' + rp.z] = { special: 'portal_return', toPlane: (_curPlane.id - 1) };
      }
      for (var z = 0; z < WW.H; z++) {
        for (var x = 0; x < WW.W; x++) {
          var key = x + ',' + z;
          var biome = owBiome(x, z);
          var hn = owHeight(x, z);
          var colH = Math.max(1, Math.round(1 + hn * 5));
          var sp = specials[key] || null;
          // Peaceful zone: mark surrounding tiles as 'inPeaceful' for ambient coloring
          if (sp && sp.special === 'peaceful') {
            for (var _pz = z - 9; _pz <= z + 9; _pz++) for (var _px = x - 9; _px <= x + 9; _px++) {
              if (Math.sqrt((_pz - z) * (_pz - z) + (_px - x) * (_px - x)) < 8) specials[_px + ',' + _pz] = specials[_px + ',' + _pz] || { special: 'peaceful_zone' };
            }
          }
          // Enc uses spatial density noise: only ~40% of tiles can have encounters,
          // concentrated in organic blobs. BIOMES[biome].enc scales max density per biome.
          var _density = owEncDensity(x, z);
          var _encThreshold = 0.52; // tiles with density > this are "vegetated zones"
          var _inVegZone = _density > _encThreshold;
          // Inside a veg zone: chance scales with how deep in the zone we are
          var _zoneDepth = _inVegZone ? (_density - _encThreshold) / (1.0 - _encThreshold) : 0;
          var _encChance = _inVegZone ? (0.15 + _zoneDepth * BIOMES[biome].enc * 0.6) : 0.0;
          var enc = !sp && hn > 0.2 && hn < 0.85 && Math.random() < _encChance;
          // Deterministic tree check (same formula as buildFullMap)
          var _isTile = !sp && hn > 0.38;
          var _tn = owNoise(x * 1.7, z * 1.7, 0.22, 99.1);
          var _tn2 = owNoise(x * 0.9, z * 0.9, 0.15, 7.3);
          var _isTree = _isTile && biome === 0 && _tn > 0.72 && _tn2 > 0.45;
          var _isDead = _isTile && (biome === 2 || biome === 3) && owNoise(x * 1.4, z * 1.4, 0.19, 55.5) > 0.78;
          OW.grid[key] = {
            aIdx: biome,
            h: colH,
            hn: hn,
            enc: enc,
            encD: _inVegZone ? _zoneDepth : 0,
            special: sp ? sp.special : null,
            biome: biome,
            solid: !!(_isTree || _isDead)  // blocks player movement
          };
        }
      }
    }

    // ---- Voxel mesh builder (instanced, chunk-based) ----
    var _voxMeshes = [];
    var _vegMeshes = []; // low-poly vegetation meshes (separate from voxels)

    // ── LOW-POLY VEGETATION SYSTEM — INSTANCED ──────────────────────────────────
    // Each unique (geometry+color) becomes ONE InstancedMesh — same draw-call
    // efficiency as the voxel system, but with organic low-poly shapes.
    function _buildLowPolyVegetation() {
      // Dispose previous vegetation
      for (var i = 0; i < _vegMeshes.length; i++) {
        OW.scene.remove(_vegMeshes[i]);
        try { _vegMeshes[i].geometry.dispose(); _vegMeshes[i].material.dispose(); } catch (e) { }
      }
      _vegMeshes = [];

      var x0 = 0, x1 = WW.W - 1;
      var z0 = 0, z1 = WW.H - 1;

      // ── INSTANCING ACCUMULATOR ──
      // Instead of creating one Mesh per call, we collect transforms per (geo+color) bucket.
      // At the end we build one InstancedMesh per bucket — massive draw call reduction.
      var _instBuckets = {}; // key → { geo, col, instances:[ {px,py,pz,sx,sy,sz,ry} ] }

      // Shared geometry cache (geometries are shared across all instances)
      var _geoCache = {};
      function _geo(type, args) {
        var key = type + JSON.stringify(args);
        if (!_geoCache[key]) {
          switch (type) {
            case 'box': _geoCache[key] = new THREE.BoxGeometry(args[0], args[1], args[2]); break;
            case 'cone': _geoCache[key] = new THREE.ConeGeometry(args[0], args[1], args[2]); break;
            case 'cyl': _geoCache[key] = new THREE.CylinderGeometry(args[0], args[1], args[2], args[3] || 6); break;
            case 'dodec': _geoCache[key] = new THREE.DodecahedronGeometry(args[0], 0); break;
            case 'icosa': _geoCache[key] = new THREE.IcosahedronGeometry(args[0], 0); break;
            case 'sphere': _geoCache[key] = new THREE.SphereGeometry(args[0], args[1] || 5, args[2] || 4); break;
            case 'oct': _geoCache[key] = new THREE.OctahedronGeometry(args[0], 0); break;
          }
        }
        return _geoCache[key];
      }

      // _mat is kept for compatibility but color is passed separately to addVegMesh
      function _mat(col) { return col; } // returns the color int — instancing handles material

      // addVegMesh now queues into the instancing buckets instead of creating a Mesh immediately
      var _dummy = new THREE.Object3D();
      function addVegMesh(geo, col, px, py, pz, sx, sy, sz, ry) {
        if (!geo) return; // guard: skip if geometry type not found
        // col may be a THREE.Material (from special structures) or a number — extract color int
        var colInt = (typeof col === 'object' && col.color) ? col.color.getHex() : col;
        var geoKey = geo.uuid; // geometry identity
        var bKey = geoKey + '_' + colInt;
        if (!_instBuckets[bKey]) _instBuckets[bKey] = { geo: geo, col: colInt, instances: [] };
        _instBuckets[bKey].instances.push({ px: px, py: py, pz: pz, sx: sx || 1, sy: sy || 1, sz: sz || 1, ry: ry || 0 });
      }

      // Called after all addVegMesh calls — builds InstancedMeshes
      function _flushInstances() {
        var _m4 = new THREE.Matrix4();
        for (var bk in _instBuckets) {
          var b = _instBuckets[bk];
          if (!b.instances.length) continue;
          var mat = new THREE.MeshPhongMaterial({ color: b.col, flatShading: true });
          var im = new THREE.InstancedMesh(b.geo, mat, b.instances.length);
          im.castShadow = false;
          im.receiveShadow = false;
          for (var ii = 0; ii < b.instances.length; ii++) {
            var inst = b.instances[ii];
            _dummy.position.set(inst.px, inst.py, inst.pz);
            _dummy.scale.set(inst.sx, inst.sy, inst.sz);
            _dummy.rotation.set(0, inst.ry, 0);
            _dummy.updateMatrix();
            im.setMatrixAt(ii, _dummy.matrix);
          }
          im.instanceMatrix.needsUpdate = true;
          OW.scene.add(im);
          _vegMeshes.push(im);
        }
        _instBuckets = {};
      }

      // ── PER-CELL VEGETATION PLACEMENT ──
      var _vpx = OW.player ? OW.player.x : 35;
      var _vpz = OW.player ? OW.player.z : 35;
      for (var z = z0; z <= z1; z++) {
        for (var x = x0; x <= x1; x++) {
          var cell = OW.grid[x + ',' + z];
          if (!cell || cell.special || cell.enc) continue;
          var h = cell.h;
          var _vDist = Math.max(Math.abs(x - _vpx), Math.abs(z - _vpz));
          var _farLOD = _vDist > 16; // beyond 18 tiles: skip sub-blobs, simpler geo

          // ── BIOME 0 (grassland): mixed deciduous trees & round bushes ──
          if (cell.hn > 0.32 && cell.biome === 0) {
            var _tn = owNoise(x * 1.7, z * 1.7, 0.22, 99.1);
            var _tn2 = owNoise(x * 0.9, z * 0.9, 0.15, 7.3);

            if (_tn > 0.64 && _tn2 > 0.38) {
              // Full deciduous tree — trunk (cylinder) + 3 canopy layers (cones/dodec)
              var trunkH = 1.8 + owNoise(x, z, 0.5, 13.7) * 1.8;
              var canopyR = 0.9 + owNoise(x * 0.5, z * 0.5, 0.3, 31.1) * 0.7;
              var variety = owNoise(x * 2.1, z * 1.3, 0.4, 77.7); // 0..1 determines tree shape

              // Trunk
              var trunkCol = (variety > 0.5) ? 0x4a2e1a : 0x5c3a1e;
              addVegMesh(_geo('cyl', [0.08, 0.12, trunkH, 4]), _mat(trunkCol),
                x, h + trunkH * 0.5, z, 1, 1, 1, owNoise(x, z, 0.1, 3.3) * Math.PI * 2);

              var cy = h + trunkH;

              if (variety < 0.35) {
                // PINE TREE — stacked cones, darker green
                var pineGreen = (owNoise(x, z, 0.2, 19) > 0.5) ? 0x1e5c1a : 0x234f20;
                var pineMid = 0x2d6e2a;
                var pineLight = 0x3a8035;
                addVegMesh(_geo('cone', [canopyR * 1.5, canopyR * 2.5, 5]), _mat(pineGreen),
                  x, cy + canopyR * 1.2, z, 1, 1, 1, variety * Math.PI);
                addVegMesh(_geo('cone', [canopyR * 1.1, canopyR * 2.0, 5]), _mat(pineMid),
                  x, cy + canopyR * 2.5, z, 1, 1, 1, variety * Math.PI + 0.5);
                addVegMesh(_geo('cone', [canopyR * 0.65, canopyR * 1.4, 4]), _mat(pineLight),
                  x, cy + canopyR * 3.7, z, 1, 1, 1, variety * Math.PI + 1.2);

              } else if (variety < 0.65) {
                // ROUND DECIDUOUS — dodecahedron canopy (like codepen cloud style)
                var leafCol1 = (owNoise(x * 1.1, z * 1.1, 0.3, 41) > 0.5) ? 0x2e7d32 : 0x388e3c;
                var leafCol2 = 0x1b5e20;
                var leafLight = 0x4caf50;
                // Main canopy blob
                addVegMesh(_geo('dodec', [canopyR * 1.1]), _mat(leafCol1),
                  x, cy + canopyR, z, 1, 0.85, 1, variety * Math.PI * 2);
                if (!_farLOD) {
                  addVegMesh(_geo('icosa', [canopyR * 0.65]), _mat(leafCol2),
                    x + canopyR * 0.55, cy + canopyR * 0.7, z + canopyR * 0.3, 1, 1, 1, 0);
                  addVegMesh(_geo('icosa', [canopyR * 0.55]), _mat(leafLight),
                    x - canopyR * 0.4, cy + canopyR * 1.1, z - canopyR * 0.5, 1, 1, 1, 0);
                }

              } else {
                // AUTUMN TREE — warm tones, spiky octahedron crown
                var autumnCols = [0xc0392b, 0xe67e22, 0xf39c12, 0x8e6030];
                var acol = autumnCols[Math.floor(owNoise(x, z, 0.6, 55) * 4)];
                var acol2 = autumnCols[Math.floor(owNoise(x + 1, z, 0.6, 55) * 4)];
                addVegMesh(_geo('oct', [canopyR * 1.1]), _mat(acol),
                  x, cy + canopyR * 0.9, z, 1.1, 0.9, 1.1, variety * Math.PI);
                if (!_farLOD) {
                  addVegMesh(_geo('icosa', [canopyR * 0.7]), _mat(acol2),
                    x + canopyR * 0.4, cy + canopyR * 1.3, z - canopyR * 0.3, 1, 1, 1, 0);
                }
              }
            }

            // ── BUSH: smaller, rounder, scattered more densely ──
            var _bn = owNoise(x * 2.3, z * 2.3, 0.28, 44.4);
            var _bn2 = owNoise(x * 1.1, z * 1.4, 0.22, 88.1);
            if (_bn > 0.52 && _bn2 < 0.65 && _tn <= 0.54) {
              var bushR = 0.35 + owNoise(x * 3, z * 3, 0.2, 7.1) * 0.25;
              var bushCol = [0x388e3c, 0x2e7d32, 0x558b2f, 0x33691e][Math.floor(owNoise(x, z, 0.7, 22) * 4)];
              var bushTop = [0x43a047, 0x4caf50, 0x66bb6a][Math.floor(owNoise(x + 0.3, z, 0.5, 11) * 3)];
              // Base blob
              addVegMesh(_geo('dodec', [bushR]), _mat(bushCol),
                x + (owNoise(x, z, 0.1, 5.5) - 0.5) * 0.4,
                h + bushR * 0.8,
                z + (owNoise(x + 1, z, 0.1, 5.5) - 0.5) * 0.4,
                1, 0.65, 1, owNoise(x, z, 0.3, 9.9) * Math.PI);
              // Highlight blob on top
              if (!_farLOD) {
                addVegMesh(_geo('icosa', [bushR * 0.6]), _mat(bushTop),
                  x + (owNoise(x, z, 0.15, 3.3) - 0.5) * 0.3,
                  h + bushR * 1.35,
                  z + (owNoise(x, z + 1, 0.15, 3.3) - 0.5) * 0.3,
                  1, 0.7, 1, 0);
              }
            }
          }

          // ── ENC CELLS: low-poly bushes (replace old square voxels) ──
          if (cell.enc) {
            var _d = cell.encD || 0;
            var _bSeed = owNoise(x * 3.1, z * 3.1, 0.3, 17.3);
            var _bJX = (owNoise(x, z, 0.1, 5.5) - 0.5) * 0.35;
            var _bJZ = (owNoise(x + 1, z, 0.1, 5.5) - 0.5) * 0.35;
            if (_d > 0.65) {
              // Dense thicket: 3 round blobs clustered
              var _dc1 = [0x1b4d1e, 0x1e5820, 0x235f25][Math.floor(_bSeed * 3)];
              var _dc2 = [0x2e7d32, 0x388e3c, 0x33691e][Math.floor(owNoise(x, z + 1, 0.3, 9) * 3)];
              var _dr = 0.38 + _bSeed * 0.18;
              addVegMesh(_geo('dodec', [_dr]), _mat(_dc1), x + _bJX, h + _dr * 0.75, z + _bJZ, 1, 0.7, 1, _bSeed * Math.PI * 2);
              addVegMesh(_geo('dodec', [_dr * 0.75]), _mat(_dc2), x + _bJX + 0.35, h + _dr * 0.6, z + _bJZ - 0.2, 1, 0.65, 1, _bSeed * 2);
              addVegMesh(_geo('icosa', [_dr * 0.55]), _mat(_dc1), x + _bJX - 0.28, h + _dr * 1.1, z + _bJZ + 0.15, 1, 0.7, 1, 0);
              // Highlight top
              var _dht = [0x43a047, 0x4caf50, 0x66bb6a][Math.floor(owNoise(x, z, 0.5, 33) * 3)];
              addVegMesh(_geo('icosa', [_dr * 0.38]), _mat(_dht), x + _bJX, h + _dr * 1.5, z + _bJZ, 1, 0.6, 1, 0);
            } else if (_d > 0.35) {
              // Medium bush: 2 blobs
              var _mc = [0x2e7d32, 0x388e3c, 0x33691e][Math.floor(_bSeed * 3)];
              var _mt = [0x43a047, 0x558b2f, 0x4caf50][Math.floor(owNoise(x, z + 0.5, 0.4, 22) * 3)];
              var _mr = 0.28 + _bSeed * 0.14;
              addVegMesh(_geo('dodec', [_mr]), _mat(_mc), x + _bJX, h + _mr * 0.8, z + _bJZ, 1, 0.68, 1, _bSeed * Math.PI);
              addVegMesh(_geo('icosa', [_mr * 0.58]), _mat(_mt), x + _bJX + 0.22, h + _mr * 1.25, z + _bJZ - 0.15, 1, 0.65, 1, 0);
            } else {
              // Sparse shrub: single small dodec
              var _sc = [0x388e3c, 0x2e7d32, 0x558b2f][Math.floor(_bSeed * 3)];
              var _sr = 0.20 + _bSeed * 0.10;
              addVegMesh(_geo('dodec', [_sr]), _mat(_sc), x + _bJX, h + _sr * 0.75, z + _bJZ, 1, 0.65, 1, _bSeed * Math.PI * 1.5);
            }
          }

          // ── BIOME 1 (snow/ice): sparse white-tipped pine trees ──
          if (!cell.special && !cell.enc && cell.hn > 0.36 && cell.biome === 1) {
            var _stn = owNoise(x * 1.5, z * 1.5, 0.20, 63.3);
            if (_stn > 0.66) {
              var snowTrunkH = 1.5 + owNoise(x, z, 0.4, 17.7) * 1.5;
              addVegMesh(_geo('cyl', [0.07, 0.1, snowTrunkH, 4]), _mat(0x4a3728),
                x, h + snowTrunkH * 0.5, z, 1, 1, 1, 0);
              var sct = h + snowTrunkH;
              // Dark green pine tiers
              addVegMesh(_geo('cone', [0.7, 1.4, 5]), _mat(0x1a3d1a), x, sct + 0.65, z, 1, 1, 1, _stn * Math.PI);
              addVegMesh(_geo('cone', [0.5, 1.1, 5]), _mat(0x1e4a1e), x, sct + 1.55, z, 1, 1, 1, _stn * Math.PI + 0.8);
              // Snow cap (white icosa on top)
              addVegMesh(_geo('oct', [0.35]), _mat(0xe8e8f0), x, sct + 2.3, z, 1.0, 0.5, 1.0, 0);
            }
          }

          // ── BIOME 2-3 (volcanic/swamp): dead spiky trees ──
          if (!cell.special && !cell.enc && cell.hn > 0.34 && cell.biome >= 2 && cell.biome <= 3) {
            var _dtn = owNoise(x * 1.4, z * 1.4, 0.19, 55.5);
            if (_dtn > 0.70) {
              var deadH = 1.8 + owNoise(x, z, 0.4, 9.9) * 1.4;
              var deadCol = (cell.biome === 2) ? 0x2a1a0a : 0x1a2a1a;
              // Gnarled trunk
              addVegMesh(_geo('cyl', [0.06, 0.1, deadH, 4]), _mat(deadCol),
                x, h + deadH * 0.5, z, 1, 1, 1, _dtn * Math.PI * 2);
              // Bare branch stubs — small cylinders rotated out
              var branchCol = (cell.biome === 2) ? 0x3a2010 : 0x1e2a18;
              addVegMesh(_geo('cyl', [0.04, 0.04, 0.7, 4]), _mat(branchCol),
                x + 0.35, h + deadH * 0.75, z, 1, 1, 1, Math.PI * 0.5);
              addVegMesh(_geo('cyl', [0.04, 0.04, 0.5, 4]), _mat(branchCol),
                x - 0.25, h + deadH * 0.85, z + 0.15, 1, 1, 1, -Math.PI * 0.4);
              // Spiky dead crown — dark octahedron
              if (cell.biome === 2) {
                addVegMesh(_geo('oct', [0.3]), _mat(0x1a0a00),
                  x, h + deadH + 0.3, z, 1.2, 0.8, 1.2, _dtn);
              } else {
                // Swamp: add sickly green wisps
                addVegMesh(_geo('dodec', [0.28]), _mat(0x2d4a1e),
                  x, h + deadH + 0.25, z, 1, 0.5, 1, 0);
              }
            }
          }

          // ── BIOME 4+ (desert/wasteland): cacti-like pillars ──
          if (!cell.special && !cell.enc && cell.hn > 0.34 && cell.biome >= 4) {
            var _ctn = owNoise(x * 2.0, z * 2.0, 0.25, 71.1);
            if (_ctn > 0.72) {
              var cactusH = 1.2 + owNoise(x, z, 0.5, 33.3) * 1.0;
              addVegMesh(_geo('cyl', [0.14, 0.16, cactusH, 5]), _mat(0x4a7c3f),
                x, h + cactusH * 0.5, z, 1, 1, 1, 0);
              // Arms
              if (owNoise(x, z, 0.3, 55) > 0.5) {
                addVegMesh(_geo('cyl', [0.09, 0.09, 0.55, 4]), _mat(0x4a7c3f),
                  x + 0.3, h + cactusH * 0.65, z, 1, 1, 1, Math.PI * 0.5);
              }
              // Flower on top
              addVegMesh(_geo('dodec', [0.18]), _mat(0xff6688),
                x, h + cactusH + 0.15, z, 1, 0.6, 1, 0);
            }
          }
        }
      }

      // ── SECOND PASS: special structures (bosslair + village) ──
      for (var sz = z0; sz <= z1; sz++) {
        for (var sx = x0; sx <= x1; sx++) {
          var scell = OW.grid[sx + ',' + sz];
          if (!scell) continue;
          var sh = scell.h;

          // ══ BOSS LAIR — pentagrama no chão + velas + altar dark ══
          if (scell.special === 'bosslair') {
            var bx = sx, bz = sz, by = sh;

            // ── Chão de pedra escura — disco base ──
            addVegMesh(_geo('cyl', [3.6, 3.6, 0.12, 10]), _mat(0x110404), bx, by + 0.06, bz, 1, 1, 1, 0);
            addVegMesh(_geo('cyl', [2.4, 2.4, 0.14, 10]), _mat(0x0d0101), bx, by + 0.13, bz, 1, 1, 1, Math.PI / 10);

            // ── Pentagrama gravado no chão ──
            // Círculo externo do pentagrama (anel fino)
            addVegMesh(_geo('cyl', [2.2, 2.2, 0.04, 32]), _mat(0x6a0000), bx, by + 0.20, bz, 1, 1, 1, 0);
            addVegMesh(_geo('cyl', [1.85, 1.85, 0.04, 32]), _mat(0x110404), bx, by + 0.21, bz, 1, 1, 1, 0);
            // Círculo interno
            addVegMesh(_geo('cyl', [0.28, 0.28, 0.04, 16]), _mat(0x8a0000), bx, by + 0.22, bz, 1, 1, 1, 0);

            // 5 pontas do pentagrama — losangos achatados nas pontas
            var _pentR = 1.8;
            for (var _pi = 0; _pi < 5; _pi++) {
              var _pa = (_pi * Math.PI * 2 / 5) - Math.PI / 2;
              var _px2 = bx + Math.cos(_pa) * _pentR;
              var _pz2 = bz + Math.sin(_pa) * _pentR;
              addVegMesh(_geo('oct', [0.22]), _mat(0x8a0000), _px2, by + 0.22, _pz2, 1, 0.08, 1, _pa);
              // Linha do pentagrama — cilindro fino entre pontas adjacentes
              var _pa2 = ((_pi + 2) * Math.PI * 2 / 5) - Math.PI / 2; // pula 2 pontos (forma estrela)
              var _px3 = bx + Math.cos(_pa2) * _pentR;
              var _pz3 = bz + Math.sin(_pa2) * _pentR;
              var _lineLen = Math.sqrt((_px3 - _px2) * (_px3 - _px2) + (_pz3 - _pz2) * (_pz3 - _pz2));
              var _lineMidX = (_px2 + _px3) / 2, _lineMidZ = (_pz2 + _pz3) / 2;
              var _lineAng = Math.atan2(_pz3 - _pz2, _px3 - _px2);
              // Usar scaleX para o comprimento, rotar o cilindro deitado
              addVegMesh(_geo('cyl', [0.04, 0.04, _lineLen, 4]), _mat(0x6a0000),
                _lineMidX, by + 0.22, _lineMidZ, 1, 1, 1, 0);
              // rotate via geometry hack — just use scaleX trick with a flat box
              // Actually use a thin horizontal cyl rotated by setting rotation.y
              // We'll approximate with stretched dodec (flat marker on each segment midpoint)
            }

            // ── Altar central — pedestal com gema ──
            // Base hexagonal
            addVegMesh(_geo('cyl', [0.62, 0.62, 0.4, 6]), _mat(0x1a0000), bx, by + 0.36, bz, 1, 1, 1, 0);
            // Coluna
            addVegMesh(_geo('cyl', [0.28, 0.32, 0.9, 6]), _mat(0x110000), bx, by + 1.0, bz, 1, 1, 1, 0);
            // Topo do altar
            addVegMesh(_geo('cyl', [0.48, 0.48, 0.18, 6]), _mat(0x220000), bx, by + 1.54, bz, 1, 1, 1, 0);
            // Gema pulsante — icosaedro vermelho-escuro achatado
            addVegMesh(_geo('icosa', [0.30]), _mat(0xdd0000), bx, by + 1.80, bz, 1, 0.65, 1, 0);
            // Brilho ao redor da gema — disco emissivo
            addVegMesh(_geo('cyl', [0.44, 0.44, 0.03, 12]), _mat(0x880000), bx, by + 1.68, bz, 1, 1, 1, 0);

            // ── Velas nos 5 pontos do pentagrama ──
            for (var _vi = 0; _vi < 5; _vi++) {
              var _va = (_vi * Math.PI * 2 / 5) - Math.PI / 2;
              var _vR = 1.9;
              var _vcx = bx + Math.cos(_va) * _vR;
              var _vcz = bz + Math.sin(_va) * _vR;
              // Corpo da vela
              var _vcH = 0.55 + owNoise(_vcx, _vcz, 0.5, 3) * 0.35;
              addVegMesh(_geo('cyl', [0.09, 0.09, _vcH, 6]), _mat(0xddd0b8), _vcx, by + _vcH * 0.5 + 0.14, _vcz, 1, 1, 1, 0);
              // Chama — cone laranja pequeno
              addVegMesh(_geo('cone', [0.06, 0.22, 4]), _mat(0xff6600), _vcx, by + _vcH + 0.24, _vcz, 1, 1, 1, 0);
              // Ponta da chama — amarela
              addVegMesh(_geo('cone', [0.03, 0.14, 4]), _mat(0xffdd00), _vcx, by + _vcH + 0.34, _vcz, 1, 1, 1, 0);
              // Derrame de cera — disco achatado na base
              addVegMesh(_geo('cyl', [0.14, 0.14, 0.04, 8]), _mat(0xeee8d5), _vcx, by + 0.16, _vcz, 1, 1, 1, 0);
            }

            // ── 4 velas maiores nos cantos ──
            var _corners = [[-2.5, 2.5], [2.5, 2.5], [-2.5, -2.5], [2.5, -2.5]];
            for (var _ci3 = 0; _ci3 < 4; _ci3++) {
              var _ccx = bx + _corners[_ci3][0], _ccz = bz + _corners[_ci3][1];
              var _ccH = 0.9 + owNoise(_ccx, _ccz, 0.4, 7) * 0.4;
              addVegMesh(_geo('cyl', [0.12, 0.12, _ccH, 6]), _mat(0x1a0000), _ccx, by + _ccH * 0.5 + 0.14, _ccz, 1, 1, 1, 0);
              addVegMesh(_geo('cone', [0.08, 0.28, 4]), _mat(0xff4400), _ccx, by + _ccH + 0.28, _ccz, 1, 1, 1, 0);
              addVegMesh(_geo('cone', [0.04, 0.16, 4]), _mat(0xffaa00), _ccx, by + _ccH + 0.40, _ccz, 1, 1, 1, 0);
              // Suporte de pedra
              addVegMesh(_geo('cyl', [0.22, 0.22, 0.25, 5]), _mat(0x1a0808), _ccx, by + 0.12, _ccz, 1, 1, 1, 0);
            }

            // ── Crânio central no altar ──
            addVegMesh(_geo('icosa', [0.20]), _mat(0xc8b89a), bx, by + 2.15, bz, 1, 0.9, 1, 0);
            // Mandíbula
            addVegMesh(_geo('cyl', [0.12, 0.08, 0.14, 5]), _mat(0xb8a888), bx, by + 1.96, bz, 1, 1, 1, 0);
          }

          // ══ SANCTUARY — altar dourado com pilares rúnicos ══
          if (scell.special === 'sanctuary') {
            var sx2 = sx, sz2 = sz, sy2 = sh;
            // Base de pedra dourada
            addVegMesh(_geo('cyl', [1.4, 1.4, 0.18, 6]), _mat(0x998833), sx2, sy2 + 0.09, sz2, 1, 1, 1, 0);
            addVegMesh(_geo('cyl', [0.85, 0.85, 0.12, 6]), _mat(0xbbaa44), sx2, sy2 + 0.24, sz2, 1, 1, 1, Math.PI / 6);
            // Dois pilares rúnicos
            function _sancPillar(px, pz) {
              addVegMesh(_geo('cyl', [0.14, 0.18, 0.3, 6]), _mat(0x998833), px, sy2 + 0.33, pz, 1, 1, 1, 0);
              addVegMesh(_geo('cyl', [0.10, 0.10, 1.8, 6]), _mat(0xd4a017), px, sy2 + 1.23, pz, 1, 1, 1, 0);
              addVegMesh(_geo('cyl', [0.20, 0.12, 0.25, 6]), _mat(0xd4a017), px, sy2 + 2.22, pz, 1, 1, 1, 0);
              addVegMesh(_geo('oct', [0.18]), _mat(0xffe566), px, sy2 + 2.52, pz, 1, 0.65, 1, 0);
            }
            _sancPillar(sx2 - 0.85, sz2);
            _sancPillar(sx2 + 0.85, sz2);
            // Viga horizontal entre pilares
            addVegMesh(_geo('cyl', [0.07, 0.07, 1.78, 5]), _mat(0xd4a017), sx2, sy2 + 2.22, sz2, 1, 1, 1, Math.PI * 0.5);
            // Orbe central flutuante — icosa dourado
            addVegMesh(_geo('icosa', [0.26]), _mat(0xffdd44), sx2, sy2 + 1.55, sz2, 1, 0.8, 1, 0);
            // Chama no topo — cone amarelo/laranja
            addVegMesh(_geo('cone', [0.12, 0.45, 5]), _mat(0xff9900), sx2, sy2 + 2.88, sz2, 1, 1, 1, 0);
            addVegMesh(_geo('cone', [0.06, 0.28, 5]), _mat(0xffee00), sx2, sy2 + 3.10, sz2, 1, 1, 1, 0);
            // Aura: anel horizontal ao redor do orbe
            addVegMesh(_geo('cyl', [0.55, 0.55, 0.04, 12]), _mat(0xcc9900), sx2, sy2 + 1.50, sz2, 1, 1, 1, 0);
          }

          // ══ VENDOR — tenda de mercador compacta ══
          if (scell.special === 'vendor') {
            var vdx = sx, vdz = sz, vdy = sh;
            var _vdS = owNoise(vdx, vdz, 0.5, 9);
            // Base de pedra
            addVegMesh(_geo('cyl', [1.1, 1.1, 0.16, 6]), _mat(0x777766), vdx, vdy + 0.08, vdz, 1, 1, 1, 0);
            // Corpo da tenda — prisma 6 lados achatado
            addVegMesh(_geo('cyl', [0.75, 0.75, 1.2, 6]), _mat(0xc8b89a), vdx, vdy + 0.76, vdz, 1, 1, 1, Math.PI / 6);
            // Telhado — cone baixo colorido
            var _tentCol = [0x3355aa, 0xaa2222, 0x228833, 0x884400][Math.floor(_vdS * 4)];
            addVegMesh(_geo('cone', [0.92, 0.62, 6]), _mat(_tentCol), vdx, vdy + 1.72, vdz, 1, 1, 1, Math.PI / 6);
            // Borda do telhado (aba) — cilindro achatado
            addVegMesh(_geo('cyl', [1.0, 1.0, 0.10, 6]), _mat(_tentCol), vdx, vdy + 1.44, vdz, 1, 1, 1, Math.PI / 6);
            // Poste central
            addVegMesh(_geo('cyl', [0.06, 0.06, 2.3, 5]), _mat(0x5c3a1e), vdx, vdy + 1.15, vdz, 1, 1, 1, 0);
            // Bandeirinha no topo
            addVegMesh(_geo('cone', [0.16, 0.32, 3]), _mat(SHOP_COL), vdx, vdy + 2.55, vdz, 1, 1, 1, 0);
            // Janelinha de vitrine (dodec achatado na frente)
            addVegMesh(_geo('dodec', [0.18]), _mat(0xffdd88), vdx + 0.65, vdy + 0.85, vdz, 1, 0.4, 1, 0);
            // Sinal pendurado — disco colorido
            addVegMesh(_geo('cyl', [0.22, 0.22, 0.05, 5]), _mat(SHOP_COL), vdx + 0.7, vdy + 1.38, vdz - 0.3, 1, 1, 1, 0);
          }

          // ══ NEST — ninho de ovo orgânico ══
          // ══ DUNGEON ENTRANCE — portal de pedra com arco ══
          if (scell.special === 'dungeon') {
            var dx = sx, dz = sz, dy = sh;
            var _ds = owNoise(dx, dz, 0.5, 7);
            // Base platform de pedra escura
            addVegMesh(_geo('box', [2.8, 0.18, 2.8]), _mat(0x1a0a2a), dx, dy + 0.09, dz, 0, 0, 0, 1);
            // Pilares do arco (esquerda e direita)
            addVegMesh(_geo('box', [0.28, 1.6, 0.28]), _mat(0x2a1040), dx - 0.9, dy + 0.8, dz, 0, 0, 0, 1);
            addVegMesh(_geo('box', [0.28, 1.6, 0.28]), _mat(0x2a1040), dx + 0.9, dy + 0.8, dz, 0, 0, 0, 1);
            // Arco superior
            addVegMesh(_geo('box', [2.1, 0.28, 0.28]), _mat(0x3a1850), dx, dy + 1.64, dz, 0, 0, 0, 1);
            // Cristal brilhante no topo
            addVegMesh(_geo('box', [0.22, 0.38, 0.22]), _mat(0x8822cc), dx, dy + 2.0, dz, 0, 0.3, 0, 1);
            // Runas nas laterais (pequenos blocos)
            for (var _ri = 0; _ri < 3; _ri++) {
              addVegMesh(_geo('box', [0.1, 0.1, 0.05]), _mat(0xaa44ff), dx - 1.02, dy + 0.4 + _ri * 0.4, dz, 0, 0, 0, 1);
              addVegMesh(_geo('box', [0.1, 0.1, 0.05]), _mat(0xaa44ff), dx + 1.02, dy + 0.4 + _ri * 0.4, dz, 0, 0, 0, 1);
            }
            // Névoa escura no chão (caixas baixas escuras)
            for (var _fi = 0; _fi < 4; _fi++) {
              var _fa = _fi * Math.PI * 0.5;
              addVegMesh(_geo('box', [0.4, 0.06, 0.4]), _mat(0x0a0418),
                dx + Math.cos(_fa) * 0.7, dy + 0.03, dz + Math.sin(_fa) * 0.7, 0, 0, 0, 1);
            }
          }

          if (scell.special === 'nest') {
            var nx = sx, nz2 = sz, ny = sh;
            var _ns = owNoise(nx, nz2, 0.6, 13);
            // Anel de musgo/pedra — disco irregular
            addVegMesh(_geo('cyl', [0.85, 0.85, 0.14, 7]), _mat(0x2d4a1e), nx, ny + 0.07, nz2, 1, 1, 1, _ns * Math.PI);
            addVegMesh(_geo('cyl', [0.55, 0.55, 0.10, 7]), _mat(0x3a5c28), nx, ny + 0.18, nz2, 1, 1, 1, _ns * Math.PI + 0.5);
            // Pedras ao redor do ninho — octaedros pequenos
            for (var _ni = 0; _ni < 5; _ni++) {
              var _na = _ni * Math.PI * 0.4 + _ns * Math.PI;
              var _nr = 0.65 + owNoise(nx + _ni, nz2, 0.3, _ni + 1) * 0.15;
              addVegMesh(_geo('oct', [0.12 + owNoise(nx, nz2 + _ni, 0.2, 7) * 0.06]),
                _mat([0x556644, 0x446633, 0x3d5530][_ni % 3]),
                nx + Math.cos(_na) * _nr, ny + 0.18, nz2 + Math.sin(_na) * _nr, 1, 0.55, 1, _na);
            }
            // Ovo central — icosaedro glow creme
            var _eggCol = [0xeeddaa, 0xd4f0c0, 0xffd0e0, 0xe8e8ff][Math.floor(_ns * 4)];
            addVegMesh(_geo('icosa', [0.28]), _mat(_eggCol), nx, ny + 0.52, nz2, 1, 1.1, 1, _ns * Math.PI);
            // Brilhinho sutil ao redor do ovo
            addVegMesh(_geo('cyl', [0.32, 0.32, 0.04, 8]), _mat(_eggCol), nx, ny + 0.34, nz2, 1, 1, 1, 0);
            // Ramalhetes de grama ao redor
            for (var _ngi = 0; _ngi < 6; _ngi++) {
              var _nga = _ngi * Math.PI / 3 + _ns;
              addVegMesh(_geo('cone', [0.04, 0.28, 3]), _mat(0x3a6a20),
                nx + Math.cos(_nga) * 0.75, ny + 0.14, nz2 + Math.sin(_nga) * 0.75, 1, 1, 1, _nga);
            }
          }

          // ══ PEACEFUL VILLAGE — low-poly aconchegante e compacta ══
          if (scell.special === 'peaceful') {
            var vx = sx, vz = sz, vy = sh;
            var _vseed = owNoise(vx, vz, 0.5, 5);

            // ── Plaza: dois discos sobrepostos ──
            addVegMesh(_geo('cyl', [2.8, 2.8, 0.12, 8]), _mat(0xb0aa88), vx, vy + 0.06, vz, 1, 1, 1, Math.PI / 8);
            addVegMesh(_geo('cyl', [1.5, 1.5, 0.08, 8]), _mat(0x9a9478), vx, vy + 0.13, vz, 1, 1, 1, 0);

            // ── Fonte central: mais baixinha e compacta ──
            // Bacia inferior
            addVegMesh(_geo('cyl', [0.55, 0.55, 0.28, 8]), _mat(0x887766), vx, vy + 0.28, vz, 1, 1, 1, 0);
            // Água (azul, levemente elevada)
            addVegMesh(_geo('cyl', [0.44, 0.44, 0.06, 8]), _mat(0x3377aa), vx, vy + 0.44, vz, 1, 1, 1, 0);
            // Coluna central fina
            addVegMesh(_geo('cyl', [0.06, 0.06, 0.7, 5]), _mat(0x998877), vx, vy + 0.75, vz, 1, 1, 1, 0);
            // Bacia superior pequena
            addVegMesh(_geo('cyl', [0.22, 0.22, 0.14, 6]), _mat(0x998877), vx, vy + 1.15, vz, 1, 1, 1, 0);
            // Agua do topo
            addVegMesh(_geo('cyl', [0.16, 0.16, 0.04, 6]), _mat(0x5599cc), vx, vy + 1.25, vz, 1, 1, 1, 0);

            // ── 2 postes de lanterna ──
            function _lantern(lx, lz) {
              addVegMesh(_geo('cyl', [0.05, 0.05, 1.4, 5]), _mat(0x554422), lx, vy + 0.7, lz, 1, 1, 1, 0);
              // Cápsula da lanterna — cubo achatado (dodec)
              addVegMesh(_geo('cyl', [0.14, 0.14, 0.22, 5]), _mat(0x443322), lx, vy + 1.52, lz, 1, 1, 1, 0);
              // Luz interior
              addVegMesh(_geo('dodec', [0.10]), _mat(0xffdd66), lx, vy + 1.52, lz, 1, 0.5, 1, 0);
              // Telhado mini cone
              addVegMesh(_geo('cone', [0.18, 0.18, 5]), _mat(0x332211), lx, vy + 1.72, lz, 1, 1, 1, 0);
            }
            _lantern(vx + 2.0, vz - 1.0);
            _lantern(vx - 2.0, vz + 1.0);

            // ── Casa builder — compacta, low-poly ──
            function _lpHut2(hx, hz, roofCol, wallCol, rotY) {
              // Base de pedra
              addVegMesh(_geo('cyl', [1.0, 1.0, 0.14, 4]), _mat(0x999888), hx, vy + 0.07, hz, 1, 1, 1, Math.PI / 4 + rotY);
              // Paredes — prisma 4 lados (square cyl)
              addVegMesh(_geo('cyl', [0.78, 0.78, 1.1, 4]), _mat(wallCol), hx, vy + 0.69, hz, 1, 1, 1, Math.PI / 4 + rotY);
              // Janela (dodec achatado)
              var _wx = hx + Math.cos(rotY + Math.PI * 0.25) * 0.75;
              var _wz = hz + Math.sin(rotY + Math.PI * 0.25) * 0.75;
              addVegMesh(_geo('dodec', [0.12]), _mat(0xffdd88), _wx, vy + 0.88, _wz, 1, 0.4, 1, 0);
              // Telhado — pirâmide 4 lados
              addVegMesh(_geo('cone', [0.95, 0.95, 4]), _mat(roofCol), hx, vy + 1.78, hz, 1, 1, 1, Math.PI / 4 + rotY);
              // Chaminé
              var _cmx = hx + Math.cos(rotY + Math.PI) * 0.42;
              var _cmz = hz + Math.sin(rotY + Math.PI) * 0.42;
              addVegMesh(_geo('cyl', [0.09, 0.09, 0.45, 4]), _mat(0x554444), _cmx, vy + 1.96, _cmz, 1, 1, 1, 0);
              addVegMesh(_geo('icosa', [0.13]), _mat(0xbbbbbb), _cmx, vy + 2.38, _cmz, 1, 0.45, 1, 0);
            }

            var _roofCols = [0x8b2222, 0x7a4a10, 0x3a5c2e, 0x555566];
            var _wallCols = [0xd4c4a8, 0xc8b89a, 0xe0cca8, 0xccb888];
            var _rc1 = _roofCols[Math.floor(_vseed * 4)];
            var _wc1 = _wallCols[Math.floor(owNoise(vx + 1, vz, 0.4, 7) * 4)];
            var _rc2 = _roofCols[Math.floor(owNoise(vx, vz + 1, 0.5, 11) * 4)];
            var _wc2 = _wallCols[Math.floor(owNoise(vx, vz + 2, 0.4, 13) * 4)];
            // Casas mais próximas — distância 2.5 em vez de 3.8
            _lpHut2(vx - 2.5, vz - 0.5, _rc1, _wc1, 0);
            _lpHut2(vx + 2.5, vz + 0.5, _rc2, _wc2, Math.PI * 0.5);

            // ── Flores ao redor da praça ──
            var _fc = [0xff6688, 0xffcc44, 0xee88ff, 0xff9944, 0x88ffaa, 0xff5577];
            for (var _fi2 = 0; _fi2 < 6; _fi2++) {
              var _fa2 = _fi2 * Math.PI / 3 + _vseed * 0.8;
              var _fr2 = 1.6 + owNoise(vx + _fi2, vz, 0.2, _fi2 + 1) * 0.7;
              var _fcol2 = _fc[_fi2];
              // Caule
              addVegMesh(_geo('cyl', [0.03, 0.03, 0.25, 4]), _mat(0x3a7a30),
                vx + Math.cos(_fa2) * _fr2, vy + 0.12, vz + Math.sin(_fa2) * _fr2, 1, 1, 1, 0);
              // Flor
              addVegMesh(_geo('dodec', [0.11]), _mat(_fcol2),
                vx + Math.cos(_fa2) * _fr2, vy + 0.33, vz + Math.sin(_fa2) * _fr2, 1, 0.5, 1, _fa2);
            }

            // ── Pequena cerca de pedra ao redor (8 postesinhos) ──
            for (var _fei = 0; _fei < 8; _fei++) {
              var _fea = _fei * Math.PI / 4;
              var _feR = 2.6;
              addVegMesh(_geo('cyl', [0.07, 0.07, 0.45, 4]), _mat(0x998877),
                vx + Math.cos(_fea) * _feR, vy + 0.22, vz + Math.sin(_fea) * _feR, 1, 1, 1, 0);
            }
          }
        }
      }

      // ── FLUSH: convert all queued instances into InstancedMeshes ──
      _flushInstances();
    }

    function buildFullMap() {
      // Dispose old voxel meshes
      for (var i = 0; i < _voxMeshes.length; i++) {
        OW.scene.remove(_voxMeshes[i]);
        _voxMeshes[i].geometry.dispose();
        _voxMeshes[i].material.dispose();
      }
      _voxMeshes = [];
      // Dispose old vegetation meshes (handled inside _buildLowPolyVegetation)
      for (var vi = 0; vi < _vegMeshes.length; vi++) {
        OW.scene.remove(_vegMeshes[vi]);
        try { _vegMeshes[vi].geometry.dispose(); _vegMeshes[vi].material.dispose(); } catch (e) { }
      }
      _vegMeshes = [];

      var x0 = 0, x1 = WW.W - 1;
      var z0 = 0, z1 = WW.H - 1;

      var colorBuckets = {};

      function addBlock(wx, wy, wz, col) {
        if (!colorBuckets[col]) colorBuckets[col] = [];
        colorBuckets[col].push(wx, wy, wz);
      }

      var dummy = new THREE.Object3D();

      for (var z = z0; z <= z1; z++) {
        for (var x = x0; x <= x1; x++) {
          var cell = OW.grid[x + ',' + z];
          if (!cell) continue;
          var biome = BIOMES[cell.biome];
          // Area evolution: use evolved biome colors if boss defeated
          var _cellAreaEvolved = isAreaEvolved && cell.aIdx >= 0 && isAreaEvolved(cell.aIdx);
          if (_cellAreaEvolved && BIOMES_EVOLVED[cell.biome]) {
            biome = Object.assign({}, biome, BIOMES_EVOLVED[cell.biome]);
          }
          var h = cell.h;

          if (cell.special === 'sanctuary') {
            // Sanctuary rendered as low-poly in second pass
            for (var y = 0; y <= h; y++) addBlock(x, y, z, biome.top);
            addBlock(x, h, z, 0xaaa888); // golden stone base
            continue;
          }
          if (cell.special === 'vendor') {
            // Vendor rendered as low-poly in second pass
            for (var y = 0; y <= h; y++) addBlock(x, y, z, biome.top);
            addBlock(x, h, z, 0x777766);
            continue;
          }
          if (cell.special === 'peaceful') {
            // Village is fully low-poly — just lay the ground tile
            for (var y = 0; y <= h; y++) addBlock(x, y, z, biome.side);
            addBlock(x, h, z, 0xaaa999); // plaza stone
            continue;
          }
          if (cell.special === 'nest') {
            // Nest rendered as low-poly in second pass
            for (var y = 0; y <= h; y++) addBlock(x, y, z, biome.top);
            addBlock(x, h, z, 0x446633); // mossy ground
            continue;
          }
          if (cell.special === 'portal' && OW._portalsBlocked) {
            if (!OW._lastPortalBlockMsg || Date.now() - OW._lastPortalBlockMsg > 4000) {
              OW._lastPortalBlockMsg = Date.now();
              var _wev = _liveWeatherActive;
              notify((_wev ? _wev.icon : '⚠') + ' Portais bloqueados — aguarde o clima passar!');
            }
            return;
          }

          if (cell.special === 'bosslair') {
            // Boss lair ground is rendered as dark stone flat — low-poly handles the rest
            for (var y = 0; y <= h; y++) addBlock(x, y, z, 0x110505);
            addBlock(x, h, z, 0x0d0000); // dark center tile
            continue;
          }
          if (cell.special === 'portal_exit' || cell.special === 'portal_return') {
            for (var y = 0; y <= h; y++) addBlock(x, y, z, biome.top);
            // Portal arch: two pillars + lintel
            var pcol = cell.special === 'portal_exit' ? PORTAL_COL : 0x22aaff;
            addBlock(x - 1, h + 1, z, pcol); addBlock(x - 1, h + 2, z, pcol); addBlock(x - 1, h + 3, z, pcol);
            addBlock(x + 1, h + 1, z, pcol); addBlock(x + 1, h + 2, z, pcol); addBlock(x + 1, h + 3, z, pcol);
            addBlock(x - 1, h + 4, z, pcol); addBlock(x, h + 4, z, pcol); addBlock(x + 1, h + 4, z, pcol);
            // Inner glow blocks
            addBlock(x, h + 1, z, pcol); addBlock(x, h + 2, z, pcol); addBlock(x, h + 3, z, pcol);
            continue;
          }

          if (cell.hn < 0.22) {
            for (var y = 0; y < WW.WATER; y++) addBlock(x, y, z, biome.sub);
            addBlock(x, WW.WATER, z, WATER_COL);
            continue;
          }
          // Beach: shallow coastal band — sandy gradient
          if (cell.hn < 0.30) {
            var _beachH = Math.max(1, Math.round(1 + cell.hn * 3));
            var _isSand = cell.hn > 0.25; // slightly above waterline = dry sand
            var _sandTop = _isSand ? SAND_COL : SAND_WET;
            for (var y = 0; y < _beachH; y++) addBlock(x, y, z, biome.sub);
            addBlock(x, _beachH, z, _sandTop);
            continue;
          }
          if (cell.biome === 2 && cell.hn < 0.38) {
            for (var y = 0; y < h; y++) addBlock(x, y, z, biome.sub);
            addBlock(x, h, z, LAVA_COL);
            continue;
          }
          for (var y = 0; y < h; y++) {
            var col = (y === h - 1) ? biome.side : biome.sub;
            addBlock(x, y, z, col);
          }
          addBlock(x, h, z, biome.top);

          if (cell.enc) {
            // enc bushes are now rendered as low-poly meshes in _buildLowPolyVegetation
            // just lay the ground tile here
          }

          // Trees and dead trees are now rendered as low-poly meshes
          // in _buildLowPolyVegetation() — no voxel blocks needed here
        }
      }

      var colorKeys = Object.keys(colorBuckets);
      for (var ci = 0; ci < colorKeys.length; ci++) {
        var col = parseInt(colorKeys[ci]);
        var pts = colorBuckets[colorKeys[ci]];
        var count = pts.length / 3;
        if (count === 0) continue;
        var isEmissive = (col === SANC_COL || col === SHOP_COL || col === LAVA_COL || col === PORTAL_COL || col === 0x22aaff);
        var geo = new THREE.BoxGeometry(1, 1, 1);
        var mat = new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.85,
          metalness: 0.05,
          emissive: isEmissive ? col : 0x000000,
          emissiveIntensity: isEmissive ? 0.5 : 0
        });
        var mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        for (var pi = 0; pi < count; pi++) {
          dummy.position.set(pts[pi * 3], pts[pi * 3 + 1], pts[pi * 3 + 2]);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(pi, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        OW.scene.add(mesh);
        _voxMeshes.push(mesh);
      }

      OW._miniDirty = true;

      // ── LOW-POLY TREES & BUSHES (flat-shaded geometry meshes) ──
      // These are separate THREE.js meshes placed on top of the voxel terrain
      // using the same noise seeds as the voxel tree placement, so they line up perfectly.
      _buildLowPolyVegetation();

      // ── OCEAN BORDER — single large plane + wave rows ──
      // One flat ocean plane covering the border ring (very cheap — 1 draw call)
      var OCEAN_R = 30; // tiles of ocean outside the map
      var mapW = WW.W, mapH = WW.H;
      // Ocean floor plane: centered on map, extends OCEAN_R beyond each edge
      var oceanW = mapW + OCEAN_R * 2;
      var oceanH = mapH + OCEAN_R * 2;
      var oceanGeo = new THREE.PlaneGeometry(oceanW, oceanH);
      oceanGeo.rotateX(-Math.PI / 2);
      var deepCol = 0x0d3a5c;
      var shallowCol = 0x1a5888;
      var oceanMat = new THREE.MeshStandardMaterial({
        color: shallowCol, roughness: 0.15, metalness: 0.5,
        transparent: true, opacity: 0.88
      });
      var oceanPlane = new THREE.Mesh(oceanGeo, oceanMat);
      // Y=1 so it sits just at water level, centered on map
      oceanPlane.position.set((mapW - 1) / 2, 1.05, (mapH - 1) / 2);
      OW.scene.add(oceanPlane);
      _voxMeshes.push(oceanPlane); // tracked for cleanup

      // Animated wave rings — 4 concentric rows of low blocks that pulse via material
      var WAVE_ROWS = 4;
      OW._waveRows = [];
      for (var wr = 0; wr < WAVE_ROWS; wr++) {
        var wOffset = -(wr + 1); // how many tiles outside the map
        var wavePts = [];
        for (var wx = wOffset; wx < mapW - wOffset; wx++) {
          wavePts.push(wx, 1.12 + wr * 0.04, wOffset);
          wavePts.push(wx, 1.12 + wr * 0.04, mapH - 1 - wOffset);
        }
        for (var wz = wOffset + 1; wz < mapH - wOffset - 1; wz++) {
          wavePts.push(wOffset, 1.12 + wr * 0.04, wz);
          wavePts.push(mapW - 1 - wOffset, 1.12 + wr * 0.04, wz);
        }
        var wCnt = wavePts.length / 3;
        if (!wCnt) continue;
        var wGeo = new THREE.BoxGeometry(0.95, 0.15, 0.95);
        var wMat = new THREE.MeshStandardMaterial({
          color: 0x4ab8e8,
          emissive: 0x2288cc, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.6,
          roughness: 0.1, metalness: 0.3
        });
        var wDummy = new THREE.Object3D();
        var wMesh = new THREE.InstancedMesh(wGeo, wMat, wCnt);
        for (var wi = 0; wi < wCnt; wi++) {
          wDummy.position.set(wavePts[wi * 3], wavePts[wi * 3 + 1], wavePts[wi * 3 + 2]);
          wDummy.scale.set(1, 1, 1); wDummy.rotation.set(0, 0, 0);
          wDummy.updateMatrix();
          wMesh.setMatrixAt(wi, wDummy.matrix);
        }
        wMesh.instanceMatrix.needsUpdate = true;
        OW.scene.add(wMesh);
        _voxMeshes.push(wMesh);
        OW._waveRows.push({ mesh: wMesh, offset: wr, phase: wr * (Math.PI / 2) });
      }
    }

    // ---- Sync area unlocks ----

  





    function tryDrop(danger, el, aIdx) {
      // Rare egg drop from mob (5% chance)
      if (Math.random() < 0.05) {
        var dropEls = ['fire', 'water', 'earth', 'dark', 'light', 'nature', 'electric'];
        var dropEl = dropEls[Math.floor(Math.random() * dropEls.length)];
        addEufMaudit(dropEl, 'common');
        addLog('🥚 Um Œuf Maudit caiu do inimigo derrotado!', 'evt');
      }
      var chance = danger === 'low' ? 0.08 : danger === 'mid' ? 0.12 : danger === 'high' ? 0.15 : 0.05;
      if (Math.random() < chance) {
        var drops = ['potion_minor', 'potion_minor', 'elixir_minor'];
        var item = drops[Math.floor(Math.random() * drops.length)];
        addItem(item);
        addLog('Item encontrado: ' + item + '!', 'evt');
        // Count item for boss unlock
        if (aIdx >= 0 && aIdx < 6) {
          if (!G.areaItems) G.areaItems = [0, 0, 0, 0, 0, 0];
          G.areaItems[aIdx]++;
        }
      }
    }

    function owDebug(msg) {
      var ui = document.getElementById('ow-ui');
      if (ui) ui.textContent = msg;
      console.log('[OW]', msg);
    }

    function setEngineError(message) {
      var box = document.getElementById('engine-error');
      var text = document.getElementById('engine-error-text');
      if (text) text.textContent = message;
      if (box) box.style.display = 'flex';
    }

    function clearEngineError() {
      var box = document.getElementById('engine-error');
      if (box) box.style.display = 'none';
    }

    function ensureThreeReady() {
      if (window.THREE && typeof THREE.WebGLRenderer === 'function') {
        clearEngineError();
        return true;
      }
      var sourceHint = window.__threeLoadError === 'local'
        ? 'A copia local de three.js nao foi encontrada em node_modules/three/build/three.min.js.'
        : window.__threeLoadError === 'cdn'
          ? 'O carregamento pelo CDN falhou.'
          : 'O motor 3D ainda nao esta disponivel.';
      var message = sourceHint + ' O mapa 3D nao pode iniciar sem three.js.';
      setEngineError(message);
      owDebug('ERR: ' + message);
      return false;
    }

    function renderAreas() {
      var wrap = document.getElementById('ow-wrap');
      if (!wrap) return;
      if (!ensureThreeReady()) { OW.initialized = false; return; }
      var W = wrap.offsetWidth, H = wrap.offsetHeight;
      if (W < 10 || H < 10) { setTimeout(function () { renderAreas(); }, 150); return; }
      if (!OW.initialized) {
        try { initMap(); } catch (e) { owDebug('initMap ERR: ' + e.message); }
      } else {
        if (!OW.animId) drawMapLoop();
        if (OW.rend) {
          OW.rend.setSize(W, H);
          if (OW.cam) { OW.cam.aspect = W / H; OW.cam.updateProjectionMatrix(); }
        }
      }
    }

    function renderGameToText() {
      var wrap = document.getElementById('ow-wrap');
      var errorBox = document.getElementById('engine-error');
      var visibleMobs = typeof MAP_MOBS !== 'undefined'
        ? MAP_MOBS.filter(function (mob) { return mob && mob._alive && mob.mesh && mob._meshVisible; }).slice(0, 6).map(function (mob) {
          return {
            name: mob.name,
            x: mob.x,
            z: mob.z,
            state: mob.state,
            hp: mob.hp,
            maxHp: mob.maxHp
          };
        })
        : [];
      var payload = {
        mode: document.getElementById('battle').style.display !== 'none'
          ? 'battle'
          : document.getElementById('explore').style.display !== 'none'
            ? 'explore'
            : document.getElementById('titlescreen').style.display !== 'none'
              ? 'title'
              : 'other',
        three: {
          ready: !!(window.THREE && typeof THREE.WebGLRenderer === 'function'),
          source: window.__threeSource || null,
          loadError: window.__threeLoadError || null
        },
        engineErrorVisible: !!(errorBox && errorBox.style.display !== 'none' && errorBox.style.display !== ''),
        wrap: wrap ? {
          width: wrap.offsetWidth,
          height: wrap.offsetHeight,
          canvasCount: wrap.querySelectorAll('canvas').length
        } : null,
        player: (typeof OW !== 'undefined' && OW.player) ? {
          x: OW.player.x,
          z: OW.player.z,
          hasMesh: !!OW.player.mesh
        } : null,
        ow: (typeof OW !== 'undefined') ? {
          initialized: !!OW.initialized,
          hasRenderer: !!OW.rend,
          hasScene: !!OW.scene,
          hasCamera: !!OW.cam
        } : null,
        mobs: visibleMobs
      };
      return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;

    // ---- initMap ----
    function initMap() {
      var w = document.getElementById('ow-wrap');
      if (!w) return;
      var W = w.offsetWidth || w.clientWidth;
      var H = w.offsetHeight || w.clientHeight;
      if (W < 10 || H < 10) { OW.initialized = false; setTimeout(initMap, 200); return; }
      OW.initialized = true;

      // Destroy old renderer/canvas before creating new one
      if (OW.rend) {
        if (OW.rend.domElement && OW.rend.domElement.parentNode) {
          OW.rend.domElement.parentNode.removeChild(OW.rend.domElement);
        }
        OW.rend.dispose();
        OW.rend = null;
      }
      // Also clear any leftover canvas elements from previous runs
      var oldCanvases = w.querySelectorAll('canvas');
      oldCanvases.forEach(function (cv) { cv.parentNode.removeChild(cv); });

      OW.rend = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      OW.rend.setSize(W, H);
      OW.rend.shadowMap.enabled = false;
      w.appendChild(OW.rend.domElement);

      OW.scene = new THREE.Scene();
      var _skyCol = new THREE.Color(0x0d2a4a);  // deep ocean blue sky
      OW.scene.background = _skyCol;
      // Fog matches sky — seamless horizon
      OW.scene.fog = new THREE.Fog(0x0d2a4a, 35, 90);
      // Hemisphere light: sky color from above, ground bounce from below
      var hemiLight = new THREE.HemisphereLight(0x88bbdd, 0x223311, 0.6);
      OW.scene.add(hemiLight);
      OW.scene.fog = new THREE.FogExp2(0x060810, 0.028);

      OW.cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 400);

      OW.scene.add(new THREE.AmbientLight(0x9aaabb, 0.7));
      var dl = new THREE.DirectionalLight(0xfff4e8, 0.9);
      dl.position.set(30, 60, 20);
      OW.scene.add(dl);
      var dl2 = new THREE.DirectionalLight(0x334466, 0.25);
      dl2.position.set(-20, 20, -30);
      OW.scene.add(dl2);

      syncAreaUnlocks();
      buildGrid();

      // Use saved position for this plane, or plane's default start
      var _plane = PLANES[G.plane || 0] || PLANES[0];
      var _savedPos = (G.planePos || {})[G.plane || 0];
      OW.player.x = _savedPos ? _savedPos.x : _plane.playerStart.x;
      OW.player.z = _savedPos ? _savedPos.z : _plane.playerStart.z;
      OW.player.tX = OW.player.x;
      OW.player.tZ = OW.player.z;
      // Apply plane sky + fog
      if (OW.scene) {
        var _skyCols = [0x0d2a4a, 0x2a0a00, 0x0a0020];
        var _fogCols = [0x0d2a4a, 0x2a0a00, 0x0a0020];
        var _fogFar = [90, 80, 75];
        var _pIdx = G.plane || 0;
        var _sc = new THREE.Color(_skyCols[_pIdx] || 0x0d2a4a);
        OW.scene.background = _sc;
        OW.scene.fog = new THREE.Fog(_fogCols[_pIdx] || 0x0d2a4a, 35, _fogFar[_pIdx] || 90);
        // Update hemisphere light sky color per plane
        OW.scene.children.forEach(function (ch) {
          if (ch.isHemisphereLight) { ch.color.set(_sc); }
        });
      }
      OW.player.moveT = 0;

      buildFullMap();

      // Ensure hero exists before building mesh so weapon class is correct
      ensureHero();
      // Chibi player character
      OW.player.mesh = buildMapPlayerMesh(G.playerName, G.hero ? G.hero.weapon : 'sword');
      OW.player.mesh.scale.setScalar(1.1);
      var startCell = OW.grid[OW.player.x + ',' + OW.player.z];
      var startH = startCell ? startCell.h : 1;
      OW.player.mesh.position.set(OW.player.x, startH + 1.1, OW.player.z);
      OW.scene.add(OW.player.mesh);

      var px0 = AREA_CENTERS[0].x, pz0 = AREA_CENTERS[0].z;
      var sc0 = OW.grid[px0 + ',' + pz0];
      var sy0 = sc0 ? sc0.h + 0.7 : 2;
      OW.cam.position.set(px0 - 2, sy0 + 14, pz0 + 18);
      OW.cam.lookAt(px0, sy0 + 1, pz0 - 2);


      if (!OW._boundKeys) {
        window.addEventListener('keydown', function (e) {
          var k = e.key.toLowerCase();
          var inInput = (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'));

          // ── ESC: universal modal closer ──
          if (k === 'escape') {
            e.preventDefault();
            // Priority list — first open one gets closed
            var _escTargets = [
              { id: 'pause-ov', fn: function () { closePauseMenu(); } },
              { id: 'status-ov', fn: function () { closeStatusScreen(); } },
              { id: 'hall-ov', fn: function () { closeHall(); } },
              { id: 'death-ov', fn: function () { closeDeath(); } },
              { id: 'items-ov', fn: function () { closeItems(); } },
              { id: 'bestiary-ov', fn: function () { closeBestiary(); } },
              { id: 'quests-ov', fn: function () { closeQuests(); } },
              { id: 'fusion-ov', fn: function () { closeFusion(); } },
              { id: 'viveiro-ov', fn: function () { closeViveiro(); } },
              { id: 'swap-ov', fn: function () { closeSwap(); } },
              { id: 'cap-ov', fn: function () { closeCap(); } },
              { id: 'random-event-ov', fn: function () { document.getElementById('random-event-ov').style.display = 'none'; OW._eventPaused = false; } },
              { id: 'relic-ov', fn: function () { document.getElementById('relic-ov').style.display = 'none'; } },
              { id: 'pbv-ov', fn: function () { try { closePostBossVendor(); } catch (e) { } } },
              { id: 'lvlup-ov', fn: function () { document.getElementById('lvlup-ov').style.display = 'none'; } }
            ];
            for (var _ei = 0; _ei < _escTargets.length; _ei++) {
              var _et = _escTargets[_ei];
              var _el = document.getElementById(_et.id);
              if (_el && _el.style.display !== 'none' && _el.style.display !== '') {
                _et.fn(); return;
              }
            }
            // Nothing open → open pause
            openPauseMenu();
            return;
          }

          if (inInput) return; // don't fire shortcuts when typing

          // ── Shortcut keys for all menus ──
          // P — Pausa
          if (k === 'p') {
            var pauseOv = document.getElementById('pause-ov');
            if (pauseOv && pauseOv.style.display !== 'none') closePauseMenu();
            else openPauseMenu();
          }
          // U — Status
          if (k === 'u') {
            var sOv = document.getElementById('status-ov');
            if (sOv && sOv.style.display !== 'none') closeStatusScreen(); else openStatusScreen();
          }
          // H — Hall
          if (k === 'h') {
            var hOv = document.getElementById('hall-ov');
            if (hOv && hOv.style.display !== 'none') closeHall(); else openHall();
          }
          // B — Bestário
          if (k === 'b') {
            var bOv = document.getElementById('bestiary-ov');
            if (bOv && bOv.style.display !== 'none') closeBestiary(); else openBestiary();
          }
          // Q — Missões (Quests)
          if (k === 'q') {
            var qOv = document.getElementById('quests-ov');
            if (qOv && qOv.style.display !== 'none') closeQuests(); else openQuests();
          }
          // F — Fusão
          if (k === 'f') {
            var fOv = document.getElementById('fusion-ov');
            if (fOv && fOv.style.display !== 'none') closeFusion(); else openFusion();
          }
          // O — Ovos (Viveiro)
          if (k === 'o') {
            var vOv = document.getElementById('viveiro-ov');
            if (vOv && vOv.style.display !== 'none') closeViveiro(); else openViveiro();
          }
          // M — Mortos (Death book)
          if (k === 'm') {
            var dOv = document.getElementById('death-ov');
            if (dOv && dOv.style.display !== 'none') closeDeath(); else openDeath();
          }
          // R — Relíquias
          if (k === 'r') {
            var iOv = document.getElementById('items-ov');
            if (iOv && iOv.style.display !== 'none') closeItems(); else openItems();
          }
          // Ctrl+S — Salvar (save) — avoids conflict with movement
          if (k === 's' && e.ctrlKey) { e.preventDefault(); manualSave(); }
          if (k === 'w' || k === 'arrowup') OW.keys.w = 1;
          if (k === 'a' || k === 'arrowleft') OW.keys.a = 1;
          if (k === 's' || k === 'arrowdown') OW.keys.s = 1;
          if (k === 'd' || k === 'arrowright') OW.keys.d = 1;
        });
        window.addEventListener('keyup', function (e) {
          var k = e.key.toLowerCase();
          if (k === 'w' || k === 'arrowup') OW.keys.w = 0;
          if (k === 'a' || k === 'arrowleft') OW.keys.a = 0;
          if (k === 's' || k === 'arrowdown') OW.keys.s = 0;
          if (k === 'd' || k === 'arrowright') OW.keys.d = 0;
        });
        window.addEventListener('blur', function () { OW.keys = { w: 0, a: 0, s: 0, d: 0 }; });
        OW._boundKeys = true;
      }

      if (OW.animId) cancelAnimationFrame(OW.animId);
      drawMapLoop();
      // Spawn initial mobs and init click handler
      spawnMapMobs(OW.player.x, OW.player.z);

      // Spawn portal particles after grid + scene are ready
      setTimeout(spawnPortalParticles, 400);
      setTimeout(initWeather, 600);
      // Update plane indicator
      // Update region name in topbar (etb-region-name) — plane-indicator hidden
      var _pln = PLANES[G.plane || 0];
      var _plCols = ['#44cc77', '#ff6622', '#9922ff'];
      var _plColor = _plCols[G.plane || 0] || '#9922ff';
      var _plInd = document.getElementById('plane-indicator');
      if (_plInd) { _plInd.textContent = ''; } // clear old floating label
      var _etbReg = document.getElementById('etb-region-name');
      if (_etbReg && _pln) {
        _etbReg.textContent = _pln.name.toUpperCase();
        _etbReg.style.color = _plColor;
        _etbReg.style.textShadow = '0 0 8px ' + _plColor;
      }
      _lastMobTick = Date.now();
      initMapClick();
      // Show hero HUD
      renderHeroHUD();
      // Start biome music after a short delay
      setTimeout(function () { try { checkBiomeMusic(); } catch (e) { } }, 1200);
    }

    // ---- Game loop ----

    var _encCooldown = 0;


    // ── ALERTA PERIÓDICO DE HP CRÍTICO DO HERÓI ──
    var _lastHpAlert = 0;
    function checkHeroHpAlert() {
      if (!G || !G.hero) return;
      var h = G.hero;
      if (!h || h.hp <= 0) return;
      var ratio = h.hp / h.maxHp;
      var now = Date.now();
      if (ratio <= 0.15 && now - _lastHpAlert > 12000) {
        _lastHpAlert = now;
        notify('💀 HP CRÍTICO! ' + h.hp + '/' + h.maxHp + ' — BOLSA [U]!', 'danger');
      } else if (ratio <= 0.30 && now - _lastHpAlert > 20000) {
        _lastHpAlert = now;
        notify('⚠ HP BAIXO! ' + h.hp + '/' + h.maxHp, 'danger');
      }
    }

    function drawMapLoop() {
      if (!OW.rend) return;
      OW.animId = requestAnimationFrame(drawMapLoop);
      if (typeof checkHeroHpAlert === 'function') checkHeroHpAlert();
      // Expirar buffs temporários do herói
      if (typeof tickHeroTempBuffs === 'function' && Date.now() % 5000 < 200) tickHeroTempBuffs();
      // ── PAUSE GUARD — freeze all gameplay while paused ──
      var _pauseEl = document.getElementById('pause-ov');
      if (_pauseEl && _pauseEl.style.display !== 'none') {
        OW.keys = { w: 0, a: 0, s: 0, d: 0 };
        OW.rend.render(OW.scene, OW.cam); // keep rendering 3D, just freeze logic
        return;
      }
      var exploreVisible = document.getElementById('explore').style.display !== 'none';

      if (OW.player.moveT <= 0 && exploreVisible) {
        var dx = 0, dz = 0;
        if (OW.keys.w) dz = -1; else if (OW.keys.s) dz = 1;
        if (OW.keys.a) dx = -1; else if (OW.keys.d) dx = 1;
        if (dx !== 0 || dz !== 0) {
          // Try diagonal first, fall back to each axis independently
          var nx = OW.player.x + dx, nz = OW.player.z + dz;
          nx = Math.max(0, Math.min(WW.W - 1, nx));
          nz = Math.max(0, Math.min(WW.H - 1, nz));
          var ncell = OW.grid[nx + ',' + nz];
          // If diagonal is blocked, try each axis separately
          if (!ncell || ncell.hn < 0.22 || ncell.solid) {
            var nx2 = OW.player.x + dx, nz2 = OW.player.z;
            var nc2 = OW.grid[nx2 + ',' + nz2];
            var nx3 = OW.player.x, nz3 = OW.player.z + dz;
            var nc3 = OW.grid[nx3 + ',' + nz3];
            if (nc2 && nc2.hn >= 0.22 && !nc2.solid) { nx = nx2; nz = nz2; ncell = nc2; dz = 0; }
            else if (nc3 && nc3.hn >= 0.22 && !nc3.solid) { nx = nx3; nz = nz3; ncell = nc3; dx = 0; }
          }
          if (ncell && ncell.hn >= 0.22 && !ncell.solid) {
            // Diagonal: same moveT but animation speed accounts for sqrt(2) distance
            OW.player.tX = nx; OW.player.tZ = nz;
            OW.player.moveT = 1.0;
            OW.player.facing.x = dx; OW.player.facing.z = dz;
            var _targetAngle = Math.atan2(dx, dz);
            OW.player.mesh.rotation.y = _targetAngle;
          }
        }
      }

      if (OW.player.moveT > 0) {
        // Diagonal covers sqrt(2) distance — reduce speed to match cardinal pace
        var _isDiagMove = (OW.player.tX !== OW.player.x && OW.player.tZ !== OW.player.z);
        var spd = _isDiagMove ? 0.0247 : 0.035; // 0.035 / sqrt(2) ≈ 0.0247
        OW.player.moveT -= spd;
        if (OW.player.moveT <= 0) {
          OW.player.moveT = 0;
          OW.player.x = OW.player.tX; OW.player.z = OW.player.tZ;
          var cell = OW.grid[OW.player.x + ',' + OW.player.z];
          var tH = cell ? cell.h + 1.1 : 1.1;
          OW.player.mesh.position.set(OW.player.x, tH, OW.player.z);
          // Footstep sound — pitch varies slightly by biome
          var _stepBiome = cell ? cell.biome : 0;
          var _stepFreq = [280, 220, 380, 160, 200, 320][_stepBiome] || 280;
          playNoise(0.045, 0.035 + Math.random() * 0.02, _stepFreq + Math.random() * 80);
          checkForEncounter(OW.player.x, OW.player.z);
          // hero_regen_step relic: +3 HP per step
          try {
            var _stepRelic = typeof getEquippedRelic === 'function' ? getEquippedRelic() : null;
            if (_stepRelic && _stepRelic.effect === 'hero_regen_step' && G.hero && G.hero.hp < G.hero.maxHp) {
              G.hero.hp = Math.min(G.hero.maxHp, G.hero.hp + 3);
              renderHeroHUD();
            }
          } catch (e) { }
          // Full map loaded — no chunk reload needed
        } else {
          var prog = 1.0 - OW.player.moveT;
          var fromCell = OW.grid[OW.player.x + ',' + OW.player.z];
          var toCell = OW.grid[OW.player.tX + ',' + OW.player.tZ];
          var fromH = fromCell ? fromCell.h + 1.1 : 1.1;
          var toH = toCell ? toCell.h + 1.1 : 1.1;
          var lerpH = fromH + (toH - fromH) * prog;
          // Very subtle vertical bob — mostly limb-driven walk
          var hop = Math.sin(prog * Math.PI) * 0.06;
          OW.player.mesh.position.x = OW.player.x + (OW.player.tX - OW.player.x) * prog;
          OW.player.mesh.position.z = OW.player.z + (OW.player.tZ - OW.player.z) * prog;
          OW.player.mesh.position.y = lerpH + hop;
          // Body slight lean forward
          OW.player.mesh.rotation.x = OW.player.facing.z * 0.08;
          OW.player.mesh.rotation.z = -OW.player.facing.x * 0.08;
          // Walk cycle — bigger limb swing, alternating stride
          var _wud = OW.player.mesh.userData;
          var _wt = prog * Math.PI * 2;
          var _stride = Math.sin(_wt);
          if (_wud && _wud.lLeg) { _wud.lLeg.rotation.x = _stride * 0.65; }
          if (_wud && _wud.rLeg) { _wud.rLeg.rotation.x = -_stride * 0.65; }
          if (_wud && _wud.lArm) { _wud.lArm.rotation.x = -_stride * 0.5; }
          if (_wud && _wud.rArm) { _wud.rArm.rotation.x = _stride * 0.5; }
        }
      } else {
        var idleCell = OW.grid[OW.player.x + ',' + OW.player.z];
        var idleH = idleCell ? idleCell.h + 1.1 : 1.1;
        OW.player.mesh.position.y = idleH + Math.sin(Date.now() * 0.0025) * 0.05;
        OW.player.mesh.rotation.x += (0 - OW.player.mesh.rotation.x) * 0.15;
        OW.player.mesh.rotation.z += (0 - OW.player.mesh.rotation.z) * 0.15;
        // Idle sway on limbs
        var _ud = OW.player.mesh.userData;
        if (_ud) {
          var _t = Date.now() * 0.003;
          if (_ud.lArm) _ud.lArm.rotation.x = Math.sin(_t * 0.8) * 0.12;
          if (_ud.rArm) _ud.rArm.rotation.x = -Math.sin(_t * 0.8) * 0.12;
          if (_ud.lLeg) _ud.lLeg.rotation.x = Math.sin(_t * 0.8) * 0.05;
          if (_ud.rLeg) _ud.rLeg.rotation.x = -Math.sin(_t * 0.8) * 0.05;
        }
      }

      var cx = OW.player.mesh.position.x;
      var cz = OW.player.mesh.position.z;
      // Fixed AFK Journey angle — snaps directly to player, no lerp or lookahead
      var _camCell = OW.grid[OW.player.x + ',' + OW.player.z] || OW.grid[OW.player.tX + ',' + OW.player.tZ];
      var _groundY = _camCell ? _camCell.h + 1.1 : 1.1;
      OW.cam.position.set(cx - 2, _groundY + 14, cz + 18);
      OW.cam.lookAt(cx, _groundY + 1.5, cz - 2);

      updateMapMobs();
      updatePortalParticles(0.016);
      if (OW._dnFrame === undefined) OW._dnFrame = 0;
      OW._dnFrame++;
      if (OW._dnFrame % 90 === 0) { try { updateDayNight(); } catch (e) { } } // update every ~1.5s
      // Refresh minimap player dot every 30 frames
      if (!OW._mmFrame) OW._mmFrame = 0;
      OW._mmFrame++;
      if (OW._mmFrame % 30 === 0) { try { drawMinimap(); } catch (e) { } }
      if (OW._mmFrame % 300 === 0) { try { checkBiomeMusic(); } catch (e) { } }
      if (OW._mmFrame % 900 === 0) { try { checkLiveWeather(); } catch (e) { } }

      // Animate wave rows — pulse emissive + slight Y offset
      if (OW._waveRows && OW._waveRows.length) {
        var _wt = Date.now() * 0.0018;
        OW._waveRows.forEach(function (wr) {
          var pulse = 0.3 + Math.sin(_wt + wr.phase) * 0.25;
          wr.mesh.material.emissiveIntensity = pulse;
          wr.mesh.material.opacity = 0.45 + Math.sin(_wt * 0.7 + wr.phase) * 0.2;
        });
      }
      OW.rend.render(OW.scene, OW.cam);
      updateMobHpOverlay();
    }

    // ===== BOSS LAIR SYSTEM =====

    var _bossBannerShowing = false;
    var _bossBannerTimer = null;

    function isBossUnlocked(aIdx) {
      if (!G.areaKills) G.areaKills = [0, 0, 0, 0, 0, 0];
      if (!G.areaItems) G.areaItems = [0, 0, 0, 0, 0, 0];
      if (!BOSS_REQS || !BOSS_REQS[aIdx]) return false;
      var req = BOSS_REQS[aIdx];
      return G.areaKills[aIdx] >= req.kills && G.areaItems[aIdx] >= req.items;
    }

    function getMissingBossReqs(aIdx) {
      if (!BOSS_REQS || !BOSS_REQS[aIdx]) return ['requisitos desconhecidos'];
      var req = BOSS_REQS[aIdx];
      var missing = [];
      var kills = G.areaKills ? (G.areaKills[aIdx] || 0) : 0;
      var items = G.areaItems ? (G.areaItems[aIdx] || 0) : 0;
      if (kills < req.kills) missing.push((req.kills - kills) + ' derrotas restantes');
      if (items < req.items) missing.push((req.items - items) + ' itens restantes');
      return missing.length ? missing : ['requisitos completos'];
    }

    function showBossLairBanner(aIdx) {
      var area = AREAS[aIdx];
      if (!area || !area.boss) return;
      if (!G.areaKills) G.areaKills = [0, 0, 0, 0, 0, 0];
      if (!G.areaItems) G.areaItems = [0, 0, 0, 0, 0, 0];

      var boss = area.boss;
      var req = BOSS_REQS[aIdx] || { kills: 5, items: 1 };
      var kills = Math.min(G.areaKills[aIdx] || 0, req.kills);
      var items = Math.min(G.areaItems[aIdx] || 0, req.items);
      var unlocked = isBossUnlocked(aIdx);
      var defeated = G.bossDefeated && G.bossDefeated[aIdx];

      var dangerColors = { low: '#6ab890', mid: '#d4a017', high: '#e87a30', extreme: '#e84545' };
      var dangerLabels = { low: 'SEGURO', mid: 'PERIGOSO', high: 'HOSTIL', extreme: 'LETAL' };
      var dcol = dangerColors[area.danger] || '#aaa';
      var dlbl = dangerLabels[area.danger] || area.danger;

      var bn = document.getElementById('boss-banner');
      if (!bn) return;

      document.getElementById('bb-name').textContent = boss.name.toUpperCase();
      var bd = document.getElementById('bb-danger');
      bd.textContent = dlbl + '  ·  Nv. ' + boss.lvl;
      bd.style.color = dcol;
      bd.style.border = '1px solid ' + dcol + '44';
      bd.style.background = dcol + '14';
      bd.style.borderRadius = '3px';
      bd.style.padding = '2px 8px';
      bd.style.fontSize = '.6rem';
      bd.style.fontWeight = '700';
      bd.style.letterSpacing = '.1em';

      var statusEl = document.getElementById('bb-status');
      var reqsEl = document.getElementById('bb-reqs');

      if (defeated) {
        reqsEl.innerHTML = '';
        statusEl.textContent = '✓ CHEFE DERROTADO';
        statusEl.style.color = '#6ab890';
        statusEl.className = '';
      } else if (unlocked) {
        reqsEl.innerHTML = '';
        statusEl.innerHTML = '⚠ ENTRE PARA BATALHAR';
        statusEl.className = 'bb-ready';
      } else {
        // Progress bars
        var kPct = Math.round(kills / req.kills * 100);
        var iPct = Math.round(items / req.items * 100);
        reqsEl.innerHTML =
          '<div class="bb-req-row">' +
          '<span class="bb-req-icon">⚔</span>' +
          '<div class="bb-req-bar"><div class="bb-req-fill kills" style="width:' + kPct + '%"></div></div>' +
          '<span class="bb-req-text">' + kills + ' / ' + req.kills + '</span>' +
          '</div>' +
          '<div class="bb-req-row">' +
          '<span class="bb-req-icon">🎁</span>' +
          '<div class="bb-req-bar"><div class="bb-req-fill items" style="width:' + iPct + '%"></div></div>' +
          '<span class="bb-req-text">' + items + ' / ' + req.items + '</span>' +
          '</div>';
        statusEl.textContent = 'Libere o chefe completando os requisitos';
        statusEl.style.color = '';
        statusEl.className = 'bb-locked';
      }

      if (!_bossBannerShowing) sfx('boss_proximity');
      _bossBannerShowing = true;
      bn.style.display = 'flex';
      if (_bossBannerTimer) clearTimeout(_bossBannerTimer);
    }

    function hideBossLairBanner() {
      if (!_bossBannerShowing) return;
      var bn = document.getElementById('boss-banner');
      if (bn) bn.style.display = 'none';
      _bossBannerShowing = false;
      if (_bossBannerTimer) { clearTimeout(_bossBannerTimer); _bossBannerTimer = null; }
    }

    // Boss proximity check — show banner when within 3 tiles of a lair
    // ===== PORTAL SYSTEM =====

    var _portalParticles = []; // { mesh, angle, radius, speed, baseY }
    var _portalCooldown = false;

    // Spawn spinning particles around portal tiles
    function spawnPortalParticles() {
      // Clear old
      _portalParticles.forEach(function (p) { if (p.mesh) OW.scene.remove(p.mesh); });
      _portalParticles = [];

      var plane = PLANES[G.plane || 0] || PLANES[0];
      var portals = [];
      if (plane.portalPos) portals.push({ pos: plane.portalPos, col: 0x9922ff, isLocked: isPortalLocked(plane.id + 1) });
      if (plane.returnPos) portals.push({ pos: plane.returnPos, col: 0x22aaff, isLocked: false });

      portals.forEach(function (portal) {
        var px = portal.pos.x, pz = portal.pos.z;
        var cell = OW.grid[px + ',' + pz];
        if (!cell) return;
        var baseY = cell.h + 2.5;
        var col = portal.isLocked ? 0x444444 : portal.col;
        var count = portal.isLocked ? 6 : 12;

        for (var i = 0; i < count; i++) {
          var mat = new THREE.MeshStandardMaterial({
            color: col, emissive: col, emissiveIntensity: 1.8,
            transparent: true, opacity: 0.85
          });
          var size = 0.08 + Math.random() * 0.1;
          var mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
          var angle = (i / count) * Math.PI * 2;
          var radius = 0.5 + Math.random() * 0.4;
          mesh.position.set(px + Math.cos(angle) * radius, baseY + Math.random() * 1.5, pz + Math.sin(angle) * radius);
          OW.scene.add(mesh);
          _portalParticles.push({ mesh: mesh, angle: angle, radius: radius, speed: 0.6 + Math.random() * 0.8, baseY: baseY + Math.random() * 1.5, px: px, pz: pz });
        }
      });
    }

    function updatePortalParticles(dt) {
      var t = Date.now() * 0.001;
      _portalParticles.forEach(function (p) {
        p.angle += p.speed * dt;
        p.mesh.position.x = p.px + Math.cos(p.angle) * p.radius;
        p.mesh.position.z = p.pz + Math.sin(p.angle) * p.radius;
        p.mesh.position.y = p.baseY + Math.sin(t * 1.5 + p.angle) * 0.25;
        p.mesh.rotation.x += 0.05;
        p.mesh.rotation.y += 0.07;
        // Pulse opacity
        p.mesh.material.opacity = 0.5 + Math.sin(t * 2 + p.angle) * 0.35;
      });
    }


    function activatePortal(toPlane) {
      if (_portalCooldown) return;
      if (isPortalLocked(toPlane)) {
        // Show locked message
        var srcPlane = PLANES[toPlane - 1] || PLANES[0];
        var missing = (srcPlane.bossIdxRequired || []).filter(function (idx) {
          return !(G.bossDefeated && G.bossDefeated[idx]);
        });
        var bossNames = missing.map(function (idx) { return AREAS[idx] ? AREAS[idx].boss.name : 'Boss ' + idx; });
        notify('🔒 Portal bloqueado! Derrote: ' + bossNames.join(', '));
        return;
      }
      _portalCooldown = true;
      // Save current position for this plane
      if (!G.planePos) G.planePos = {};
      G.planePos[G.plane || 0] = { x: OW.player.x, z: OW.player.z };
      showPlaneTransition(toPlane, function () {
        G.plane = toPlane;
        saveGame();
        OW.initialized = false;
        if (OW.player) OW.player.mesh = null;
        _portalParticles.forEach(function (p) { if (p.mesh) OW.scene.remove(p.mesh); });
        _portalParticles = [];
        destroyMap();
        setTimeout(function () {
          showExplore();
          _portalCooldown = false;
        }, 200);
      });
    }

    // ===== PLANE TRANSITION SCREEN =====
    function showPlaneTransition(toPlane, onComplete) {
      var plane = PLANES[toPlane] || PLANES[0];
      var col = toPlane === 0 ? '#22aaff' : toPlane === 1 ? '#ff6622' : '#9922ff';

      // Overlay
      var ov = document.createElement('div');
      ov.id = 'plane-transition-ov';
      ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity 0.6s;font-family:"Cinzel",serif;';

      // Portal ring animation (CSS)
      var rings = '';
      for (var i = 0; i < 3; i++) {
        rings += '<div style="position:absolute;width:' + (160 + i * 60) + 'px;height:' + (160 + i * 60) + 'px;border:3px solid ' + col + ';border-radius:50%;opacity:' + (0.7 - i * 0.2) + ';animation:portalRing ' + (1.2 + i * 0.3) + 's linear infinite;"></div>';
      }

      ov.innerHTML = '<style>'
        + '@keyframes portalRing{from{transform:rotate(0deg) scale(0.8)}to{transform:rotate(360deg) scale(1.2)}}'
        + '@keyframes portalPulse{0%,100%{opacity:0.3}50%{opacity:1}}'
        + '@keyframes planeIn{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}'
        + '</style>'
        + '<div style="position:relative;width:220px;height:220px;display:flex;align-items:center;justify-content:center;margin-bottom:32px;">'
        + rings
        + '<div style="width:80px;height:80px;background:radial-gradient(circle,' + col + ',transparent);border-radius:50%;animation:portalPulse 1s infinite;"></div>'
        + '</div>'
        + '<div style="animation:planeIn 0.8s 0.3s both;text-align:center;">'
        + '<div style="font-size:0.75rem;letter-spacing:0.4em;color:#666;margin-bottom:8px;text-transform:uppercase;">Atravessando o Portal</div>'
        + '<div style="font-size:2.2rem;color:' + col + ';letter-spacing:0.15em;text-shadow:0 0 30px ' + col + ';margin-bottom:12px;">' + plane.name + '</div>'
        + '<div style="font-size:0.9rem;color:#888;font-style:italic;font-family:serif;">' + plane.subtitle + '</div>'
        + '</div>';

      document.body.appendChild(ov);
      // Fade in
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { ov.style.opacity = '1'; });
      });

      setTimeout(function () {
        ov.style.opacity = '0';
        setTimeout(function () {
          if (ov.parentNode) ov.parentNode.removeChild(ov);
          if (onComplete) onComplete();
        }, 700);
      }, 2800);
    }

    function checkBossProximity(px, pz) {
      var PROX = 3;
      var ENTER = 1; // tiles away to actually trigger boss
      for (var i = 0; i < AREA_CENTERS.length; i++) {
        var lairX = AREA_CENTERS[i].x;
        var lairZ = AREA_CENTERS[i].z - 5;
        var dx = Math.abs(px - lairX), dz = Math.abs(pz - lairZ);
        if (dx <= PROX && dz <= PROX) {
          if (AREAS[i] && AREAS[i].unlocked) {
            showBossLairBanner(i);
            // Trigger boss battle when close enough (handles water tiles blocking exact step)
            if (dx <= ENTER && dz <= ENTER) {
              if ((!G.bossDefeated || !G.bossDefeated[i]) && isBossUnlocked(i)) {
                if (!G.battle || G.battle.over) {
                  OW.keys = { w: 0, a: 0, s: 0, d: 0 };
                  _encCooldown = 6;
                  startBossBattle(i);
                  return;
                }
              }
            }
            return;
          }
        }
      }
      hideBossLairBanner();
    }

    function startBossBattle(aIdx) {
      if (!G.team.filter(function (c) { return !c.dead; }).length) return;
      // Guard: boss já derrotado — não permitir refight
      if (aIdx !== undefined && G.bossDefeated && G.bossDefeated[aIdx]) {
        notify('✓ ' + (AREAS[aIdx] && AREAS[aIdx].boss ? AREAS[aIdx].boss.name : 'Chefe') + ' já foi derrotado!', 'info');
        return;
      }
      G.activeIdx = G.team.findIndex(function (c) { return c && !c.dead; });
      var area = AREAS[aIdx];
      var boss = area.boss;
      var enemy = {
        id: Math.random().toString(36).slice(2, 9),
        name: boss.name,
        el: boss.el,
        hp: Math.floor(boss.lvl * 22),
        maxHp: Math.floor(boss.lvl * 22),
        atk: boss.atk,
        def: boss.def,
        level: boss.lvl,
        xp: 0,
        xpNext: boss.lvl * 20,
        dead: false,
        evolved: false,
        ultCD: 0,
        isBossEnemy: true,
        tplName: boss.name,
        shape: 'round',
        body: boss.el === 'fire' ? 'lizard' : (boss.el === 'earth' ? 'golem' : 'orb')
      };
      G.battle = {
        enemy: enemy, area: area, aIdx: aIdx, over: false,
        isBoss: true, escUsed: false, danger: 'fair',
        mySt: { poison: 0, burn: 0, paralyze: 0, shield: 0 },
        enSt: { poison: 0, burn: 0, paralyze: 0, shield: 0 }
      };
      buildHand(); stopMap();
      doScreenTransition(function () {
        document.getElementById('explore').style.display = 'none';
        document.getElementById('battle').style.display = 'flex';
        hideBossLairBanner();
        updateDangerUI(); renderBattle(); renderCards(); clearLog();
        // Iniciar visuais de batalha
        var _bvMyC2 = G.team && G.team[G.activeIdx] ? G.team[G.activeIdx] : null;
        if (typeof initBattleVisuals === 'function') {
          initBattleVisuals(_bvMyC2 ? _bvMyC2.el : 'water', boss.el || 'dark');
        }
        // Boss intro lines
        var lines = boss.intro || ['Um poder colossal se aproxima!'];
        lines.forEach(function (l, i) { setTimeout(function () { addLog(l, 'evt'); }, i * 700); });
        setTimeout(function () { addLog('⚠ BATALHA DE CHEFE INICIADA!', 'evt'); warnDanger(); }, lines.length * 700);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { spawnS('my-wrap', ac()); spawnS('en-wrap', enemy); });
        });
      });
      renderPassivePips();
      requestAnimationFrame(function () { requestAnimationFrame(function () { spawnS('my-wrap', ac()); spawnS('en-wrap', enemy); }); });
    }

    // ===== EVOLUTION SYSTEM =====

    var _evoTarget = null; // creature pending evolution


    function showEvoPrompt(creature) {
      var evo = EVO_TABLE[creature.tplName];
      if (!evo) return;
      _evoTarget = creature;

      document.getElementById('evo-from').textContent = creature.name + ' (Nv.' + creature.level + ')';
      document.getElementById('evo-to').textContent = evo.name;

      var hpDiff = Math.round((evo.hpMult - 1) * 100);
      var atkDiff = Math.round((evo.atkMult - 1) * 100);
      var defDiff = Math.round((evo.defMult - 1) * 100);
      document.getElementById('evo-stats').innerHTML =
        '<span class="evo-stat-good">HP +' + hpDiff + '%  ·  ATK +' + atkDiff + '%  ·  DEF +' + defDiff + '%</span><br>' +
        '<span style="font-style:italic;color:var(--mu)">' + evo.desc + '</span>';

      var ol = document.getElementById('evo-overlay');
      ol.style.display = 'flex';
    }

    function confirmEvolve() {
      var ol = document.getElementById('evo-overlay');
      ol.style.display = 'none';
      if (!_evoTarget) return;
      var c = _evoTarget;
      var evo = EVO_TABLE[c.tplName];
      if (!evo) { _evoTarget = null; return; }

      c.name = evo.name;
      c.maxHp = Math.floor(c.maxHp * evo.hpMult);
      c.hp = c.maxHp; // full heal on evolution
      c.atk = Math.floor(c.atk * evo.atkMult);
      c.def = Math.floor(c.def * evo.defMult);
      c.passive = evo.passive;
      c.evolved = true;
      c._evoPending = false;

      addLog('✨ ' + c.name + ' evoluiu! HP/ATK/DEF aumentados e nova passiva desbloqueada!', 'evt');
      notify('✨ Evolução completa: ' + c.name + '!');
      renderTeam();
      saveGame(G.playerName);
      _evoTarget = null;
    }

    function dismissEvolve() {
      var ol = document.getElementById('evo-overlay');
      ol.style.display = 'none';
      // Allow re-prompt next level-up
      if (_evoTarget) { _evoTarget._evoPending = false; }
      _evoTarget = null;
    }

    function checkForEncounter(x, z) {
      var cell = OW.grid[x + ',' + z];
      if (!cell) return;
      if (G.battle && !G.battle.over) return;

      // Random event check — every 35-60 steps, 25% base chance
      _eventStepCounter = (_eventStepCounter || 0) + 1;
      // Dynamic threshold: varies from 20 to 90 steps, probability 15-45%
      var _evChance = 0.15 + (Math.sin(_eventStepCounter * 0.18) * 0.5 + 0.5) * 0.30;
      if (_eventStepCounter >= _EVENT_STEP_NEXT && Math.random() < _evChance) {
        _eventStepCounter = 0;
        // Randomize next threshold — short burst (20-35) or long wait (50-90)
        _EVENT_STEP_NEXT = Math.random() < 0.3
          ? 20 + Math.floor(Math.random() * 15)   // 30% chance: quick succession
          : 50 + Math.floor(Math.random() * 40);  // 70% chance: longer wait
        try { triggerRandomEvent(); } catch (e) { }
      }

      // Peaceful zone — no encounters, no battles. Show ambient message once.
      if (cell.special === 'peaceful' || cell.special === 'peaceful_zone') {
        if (!OW._lastPeacefulMsg || Date.now() - OW._lastPeacefulMsg > 8000) {
          OW._lastPeacefulMsg = Date.now();
          notify('✦ Zona Pacífica — nenhuma criatura ousará atacar aqui.');
        }
        return;
      }

      // Post-boss vendor
      if (cell.special === 'boss_vendor') {
        if (!G._encOv || Date.now() - (G._bvCd || 0) > 1000) {
          G._bvCd = Date.now();
          openPostBossVendor(cell.aIdx || 0);
        }
        return;
      }

      // Egg nest interaction
      if (cell.special === 'nest') {
        if (!G.discoveredSpecials) G.discoveredSpecials = {};
        var nestKey = 'nest:' + x + ',' + z;
        if (!G.discoveredSpecials[nestKey]) {
          G.discoveredSpecials[nestKey] = true;
          OW._miniDirty = true;
          // Give egg based on biome element
          var nestEl = (function () {
            var biomeEls = ['earth', 'nature', 'fire', 'dark', 'water', 'electric', 'light'];
            return biomeEls[cell.biome] || 'earth';
          })();
          addEufMaudit(nestEl, 'rare');
          notify('🥚 Œuf Maudit encontrado! Um casulo sombrio pulsa no ninho.');
        } else {
          notify('O ninho está vazio. A alma já partiu.');
        }
        return;
      }

      // Check boss proximity (shows/hides banner)
      checkBossProximity(x, z);

      // Proximity discovery: reveal sanctuary/vendor on minimap when within 8 tiles
      (function () {
        if (!G.discoveredSpecials) G.discoveredSpecials = {};
        var DISC_RANGE = 8;
        for (var _dx = -DISC_RANGE; _dx <= DISC_RANGE; _dx++) {
          for (var _dz = -DISC_RANGE; _dz <= DISC_RANGE; _dz++) {
            if (_dx * _dx + _dz * _dz > DISC_RANGE * DISC_RANGE) continue;
            var _nc = OW.grid[(x + _dx) + ',' + (z + _dz)];
            if (!_nc || !_nc.special) continue;
            if (_nc.special !== 'sanctuary' && _nc.special !== 'vendor') continue;
            var _dk = _nc.special + ':' + (x + _dx) + ',' + (z + _dz);
            if (!G.discoveredSpecials[_dk]) {
              G.discoveredSpecials[_dk] = true;
              OW._miniDirty = true;
              _mmCache = null; // force full minimap rebuild to show new dot
              var _icon = _nc.special === 'sanctuary' ? '✦' : (_nc.special === 'dungeon' ? '⚔' : '🛒');
              var _nm = _nc.special === 'sanctuary' ? 'Santuário das Almas' : (_nc.special === 'dungeon' ? 'Dungeon Express' : 'Mercador Errante');
              notify(_icon + ' ' + _nm + ' descoberto!');
            }
          }
        }
      })();

      // Region banner on biome change
      if (cell.aIdx >= 0 && cell.aIdx !== OW._lastZone) {
        OW._lastZone = cell.aIdx;
        showRegionBanner(cell.aIdx);
      }
      // Portal interaction
      if (cell.special === 'portal_exit' || cell.special === 'portal_return') {
        var _isReturn = cell.special === 'portal_return';
        var _toPlane = _isReturn
          ? (G.plane || 0) - 1
          : (G.plane || 0) + 1;
        if (_toPlane >= 0 && _toPlane < PLANES.length) {
          // Return portals are NEVER locked — you can always go back
          if (_isReturn) {
            if (!_portalCooldown) {
              _portalCooldown = true;
              if (!G.planePos) G.planePos = {};
              G.planePos[G.plane || 0] = { x: OW.player.x, z: OW.player.z };
              showPlaneTransition(_toPlane, function () {
                G.plane = _toPlane;
                saveGame();
                OW.initialized = false;
                if (OW.player) OW.player.mesh = null;
                _portalParticles.forEach(function (p) { if (p.mesh) OW.scene.remove(p.mesh); });
                _portalParticles = [];
                destroyMap();
                setTimeout(function () { showExplore(); _portalCooldown = false; }, 200);
              });
            }
          } else {
            activatePortal(_toPlane);
          }
        } else {
          notify('Não há mais planos nessa direção.');
        }
        return;
      }
      if (cell.special === 'sanctuary') {
        OW.keys = { w: 0, a: 0, s: 0, d: 0 };
        if (!G.discoveredSpecials) G.discoveredSpecials = {};
        G.discoveredSpecials['sanctuary:' + x + ',' + z] = true;
        OW._miniDirty = true;
        openSanctuary(cell.aIdx);
        return;
      }
      if (cell.special === 'dungeon') {
        OW.keys = { w: 0, a: 0, s: 0, d: 0 };
        if (!G.discoveredSpecials) G.discoveredSpecials = {};
        G.discoveredSpecials['dungeon:' + x + ',' + z] = true;
        OW._miniDirty = true;
        openDungeonExpress(cell.aIdx);
        return;
      }
      if (cell.special === 'vendor') {
        OW.keys = { w: 0, a: 0, s: 0, d: 0 };
        if (!G.discoveredSpecials) G.discoveredSpecials = {};
        G.discoveredSpecials['vendor:' + x + ',' + z] = true;
        OW._miniDirty = true;
        openVendor(cell.aIdx);
        return;
      }
      if (cell.special === 'bosslair') {
        var _bArea = AREAS[cell.aIdx];
        if (!_bArea) return;
        if (!_bArea.unlocked) {
          if (!OW._lastBossMsg || Date.now() - OW._lastBossMsg > 4000) {
            OW._lastBossMsg = Date.now();
            var _bSrc = _bArea.unlockedBy >= 0 ? AREAS[_bArea.unlockedBy] : null;
            var _bHave = _bSrc ? (G.areaWins[_bArea.unlockedBy] || 0) : 0;
            notify('🔒 Cova do Chefe — desbloqueie ' + _bArea.name + ' primeiro (' + _bHave + '/' + _bArea.winsNeeded + ' vitórias)');
          }
          return;
        }
        if (G.bossDefeated && G.bossDefeated[cell.aIdx]) {
          notify('✓ ' + _bArea.boss.name + ' já foi derrotado nesta área.');
          return;
        }
        if (!isBossUnlocked(cell.aIdx)) {
          // Show which creatures are still needed
          var _missing = getMissingBossReqs(cell.aIdx);
          if (!OW._lastBossMsg || Date.now() - OW._lastBossMsg > 4000) {
            OW._lastBossMsg = Date.now();
            notify('🔒 Chefe bloqueado — capture: ' + _missing.join(', '));
          }
          return;
        }
        OW.keys = { w: 0, a: 0, s: 0, d: 0 };
        _encCooldown = 6;
        startBossBattle(cell.aIdx);
        return;
      }
      if (cell.enc && cell.aIdx >= 0) {
        if (_encCooldown > 0) { _encCooldown--; return; }
        var area = AREAS[cell.aIdx];
        if (area && area.unlocked && Math.random() < 0.22) {
          OW.keys = { w: 0, a: 0, s: 0, d: 0 };
          startBattle(cell.aIdx);
        } else if (area && !area.unlocked) {
          // Show locked area hint (throttled to not spam)
          if (!OW._lastLockedMsg || Date.now() - OW._lastLockedMsg > 5000) {
            OW._lastLockedMsg = Date.now();
            var _srcArea = area.unlockedBy >= 0 ? AREAS[area.unlockedBy] : null;
            var _need = area.winsNeeded || 0;
            var _have = _srcArea ? (G.areaWins[area.unlockedBy] || 0) : 0;
            notify('🔒 ' + area.name + ' bloqueada — vença ' + _need + ' batalhas em ' +
              (_srcArea ? _srcArea.name : 'área anterior') + ' (' + _have + '/' + _need + ')');
          }
        }
      }
    }

    function stopMap() {
      // Light stop — just pause the animation loop (used when entering battle)
      if (OW.animId) { cancelAnimationFrame(OW.animId); OW.animId = null; }
    }

    function destroyMap() {
      // Full GPU cleanup — used only when changing planes
      stopWeather();
      stopMap();
      clearMapMobs();
      if (OW.scene) {
        for (var _vi = 0; _vi < _voxMeshes.length; _vi++) {
          OW.scene.remove(_voxMeshes[_vi]);
          if (_voxMeshes[_vi].geometry) _voxMeshes[_vi].geometry.dispose();
          if (_voxMeshes[_vi].material) _voxMeshes[_vi].material.dispose();
        }
      }
      _voxMeshes = [];
      OW._waveRows = [];
      OW.grid = {};
      _portalParticles.forEach(function (p) { if (p.mesh && OW.scene) OW.scene.remove(p.mesh); });
      _portalParticles = [];
    }


    // ===== UTILS & OVERLAYS =====

    function showDropToast(msg) {
      var el = document.createElement('div'); el.className = 'dtoast'; el.textContent = 'RELIQUIA: ' + msg;
      document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2400);
    }

    function openHall() { renderHall(); var ov = document.getElementById('hall-ov'); ov.style.display = 'flex'; ov.style.flexDirection = 'column'; ov.style.alignItems = 'center'; }
    function closeHall() { document.getElementById('hall-ov').style.display = 'none'; renderExplore(); }
    // renderHall moved to end of file (drag-and-drop version)
    function addToTeam(id) {
      if (G.team.filter(function (c) { return !c.dead; }).length >= 3 && G.team.length >= 3) { notify('Grupo cheio!'); return; }
      var idx = G.hall.findIndex(function (c) { return c.id === id; }); if (idx < 0) return;
      var c = G.hall.splice(idx, 1)[0], ds = G.team.findIndex(function (x) { return x.dead; });
      if (ds !== -1 && G.team.length >= 3) G.team[ds] = c; else G.team.push(c);
      notify(c.name + ' adicionado ao grupo!'); renderHall();
    }
    function rmFromTeam(id) {
      var idx = G.team.findIndex(function (c) { return c.id === id; }); if (idx < 0) return;
      if (G.team.filter(function (c) { return !c.dead; }).length <= 1 && !G.team[idx].dead) { notify('Nao pode remover a ultima criatura viva!'); return; }
      var c = G.team.splice(idx, 1)[0]; G.hall.unshift(c); notify(c.name + ' enviado para o Hall.'); renderHall();
    }

    function openDeath() { G.team.filter(function (c) { return c.dead; }).forEach(function (c) { moveSingleToBook(c); }); renderDeath(); var ov = document.getElementById('death-ov'); ov.style.display = 'flex'; ov.style.flexDirection = 'column'; ov.style.alignItems = 'center'; }
    function closeDeath() { document.getElementById('death-ov').style.display = 'none'; renderExplore(); }
    function renderDeath() {
      var tot = totalUniqueItems(); document.getElementById('ritcount').textContent = tot + ' / 5 elementos ativos'; document.getElementById('dead-lc').textContent = G.dead.length;
      var reqEls = ['fire', 'water', 'earth', 'dark', 'light'], sh = '';
      for (var i = 0; i < 5; i++) { var elId = reqEls[i], hasIt = G.items.some(function (it) { return it.id === elId && it.qty > 0; }), def = ITEM_DEFS.find(function (d) { return d.id === elId; }); sh += '<div class="rslot' + (hasIt ? ' f' : '') + '">' + (def ? def.ico : '') + '</div>'; }
      document.getElementById('rslots').innerHTML = sh; document.getElementById('rdesc').textContent = tot < 5 ? 'Colete reliquias dos 5 elementos (Falta ' + (5 - tot) + ')' : 'Voce possui todas reliquias! Escolha uma alma.';
      var dg = document.getElementById('dgrid'); if (!G.dead.length) { dg.innerHTML = '<div class="empty" style="color:#5a3040">Nenhuma criatura sucumbiu ainda.</div>'; return; }
      var html = '';
      G.dead.forEach(function (c) { var canRev = tot >= 5; html += '<div class="dcard"><div class="dname">' + c.name + '</div><div class="dlvl">Nivel ' + c.level + '</div><div class="del">' + EL[c.el].name + '</div><div style="font-size:1.1rem;color:#5a3040;font-style:italic;margin-bottom:5px;line-height:1.3">Ressurge com 25% HP, 2 niveis abaixo</div><button class="drev" onclick="attemptRevive(\'' + c.id + '\')" ' + (canRev ? '' : 'disabled') + '>' + (canRev ? 'Realizar Ritual' : 'Faltam Elementos') + '</button></div>'; });
      dg.innerHTML = html;
    }
    function attemptRevive(id) {
      if (totalUniqueItems() < 5) { notify('Voce precisa de 1 reliquia de CADA elemento!'); return; }
      var c = G.dead.find(function (x) { return x.id === id; }); if (!c) return;
      var required = ['fire', 'water', 'earth', 'dark', 'light'];
      G.items = G.items.map(function (i) { if (required.indexOf(i.id) !== -1) return { id: i.id, qty: i.qty - 1 }; return i; }).filter(function (i) { return i.qty > 0; });
      document.getElementById('death-ov').style.display = 'none'; showReviveAnim(c);
    }
    function showReviveAnim(c) {
      var anim = document.getElementById('rev-anim'); anim.style.display = 'flex'; anim.style.flexDirection = 'column'; anim.style.alignItems = 'center'; anim.style.justifyContent = 'center';
      document.getElementById('rev-t').textContent = 'Invocando ' + c.name + '...'; document.getElementById('rev-s').textContent = 'As sombras se dissipam...';
      setTimeout(function () { document.getElementById('rev-s').textContent = 'A alma retorna ao corpo...'; }, 1000);
      setTimeout(function () { document.getElementById('rev-t').textContent = c.name + ' RESSUSCITOU!'; document.getElementById('rev-s').textContent = 'Retorna com 25% HP e 2 niveis a menos'; }, 2200);
      setTimeout(function () {
        anim.style.display = 'none'; G.dead = G.dead.filter(function (x) { return x.id !== c.id; });
        // Move any dead team members to dead book to free up slots
        var _deadInTeam = G.team.filter(function (x) { return x && x.dead; });
        _deadInTeam.forEach(function (d) { G.dead.push(d); });
        G.team = G.team.filter(function (x) { return x && !x.dead; });
        var newLvl = Math.max(1, c.level - 2), tpl = TPLS.find(function (t) { return t.name === c.name; }) || TPLS[0], rev = mkC(tpl, newLvl); rev.hp = Math.ceil(rev.maxHp * 0.25); rev.id = c.id;
        var _aliveSlots = G.team.filter(function (x) { return x && !x.dead; }).length;
        if (_aliveSlots < 3) {
          G.team.push(rev);
          notify(c.name + ' ressuscitou e voltou ao grupo!');
        } else {
          G.hall.unshift(rev);
          notify(c.name + ' ressuscitou e foi para o Hall!');
        }
        saveGame();
        showExplore();
        renderExplore();
      }, 3400);
    }

    function openItems() { renderItems(); var ov = document.getElementById('items-ov'); ov.style.display = 'flex'; ov.style.flexDirection = 'column'; ov.style.alignItems = 'center'; }
    function closeItems() { document.getElementById('items-ov').style.display = 'none'; renderExplore(); }
    function renderItems() {
      var ig = document.getElementById('igrid'), tot = totalItems(); if (!tot) { ig.innerHTML = '<div class="empty" style="color:#7ab898;font-size:1.06rem">Nenhuma reliquia coletada.</div>'; return; }
      var rarCol = { comum: '#3a6050', incomum: '#4a8060', raro: '#6ab890' }, html = '';
      ITEM_DEFS.forEach(function (def) {
        var found = G.items.find(function (i) { return i.id === def.id; }); if (!found) return;
        var qty = found.qty, pips = ''; for (var i = 0; i < Math.min(qty, 5); i++) pips += '<div class="ippi on"></div>';
        html += '<div class="icard"><span class="iico" style="color:' + def.col + '">' + def.ico + '</span><div class="irar" style="color:' + (rarCol[def.rar] || '#3a6050') + '">' + def.rar.toUpperCase() + '</div><div class="inm" style="color:' + def.col + '">' + def.name + '</div><div class="ids">' + def.desc + '</div><div class="iqt" style="color:' + def.col + '">x' + qty + '</div><div class="ipiprow">' + pips + '</div></div>';
      });
      ig.innerHTML = html || '<div class="empty" style="color:#7ab898;font-size:1.06rem">Nenhuma reliquia coletada.</div>';
    }

    function moveAllDeadToBook() { G.team.filter(function (c) { return c.dead; }).forEach(function (c) { G.dead.push(c); }); G.team = G.team.filter(function (c) { return !c.dead; }); }
    function moveSingleToBook(c) { G.dead.push(c); G.team = G.team.filter(function (x) { return x.id !== c.id; }); }

    // ═══════════════════════════════════════════════════════════════
    // FLEE MINIGAME — multi-zone, 3 attempts
    // ═══════════════════════════════════════════════════════════════
    var _fleeAnim = null;
    var _fleePos = 0;
    var _fleeDir = 1;
    var _fleeSpeed = 2.2;
    var _fleeZones = []; // [{l, r}]
    var _fleeActive = false;
    var _fleeAttempts = 0;
    var _fleeMaxAttempts = 3;
    var _fleeFailPenalty = false;
    var _fleeEscapeMode = false; // when true: success→endEscape(true), fail→endEscape(false)

    function openFleeMiniGame() {
      if (!G.battle || G.battle.over) return;
      if (G.battle.isBoss) { addLog('Não é possível fugir de um CHEFE!', 'sys'); return; }
      _fleeAttempts = 0;
      _startFleeMiniGame();
    }

    function _startFleeMiniGame() {
      _fleeActive = true;
      _fleePos = 0;
      _fleeDir = 1;
      var speeds = { fair: 1.4, hard: 2.2, brutal: 3.2, lethal: 4.4 };
      _fleeSpeed = speeds[G.battle.danger] || 2.2;
      // 3 small zones scattered across the track
      var zoneSizes = { fair: 14, hard: 10, brutal: 7, lethal: 5 };
      var zoneW = zoneSizes[G.battle.danger] || 10;
      _fleeZones = [];
      // Place 3 non-overlapping zones
      var positions = [8, 38, 68]; // approximate starting positions, shuffle
      positions.sort(function () { return Math.random() - 0.5; });
      positions.forEach(function (p) {
        var l = p + Math.floor(Math.random() * 10);
        l = Math.min(l, 90 - zoneW);
        _fleeZones.push({ l: l, r: l + zoneW });
      });

      // Build zone HTML
      var track = document.getElementById('flee-track');
      if (track) {
        // Remove old zones
        track.querySelectorAll('.flee-zone').forEach(function (z) { z.remove(); });
        _fleeZones.forEach(function (z, i) {
          var el = document.createElement('div');
          el.className = 'flee-zone';
          el.style.left = z.l + '%';
          el.style.width = (z.r - z.l) + '%';
          track.appendChild(el);
        });
      }

      var result = document.getElementById('flee-result');
      var attemptsEl = document.getElementById('flee-attempts');
      if (result) { result.textContent = ''; result.style.color = '#fff'; }
      if (attemptsEl) attemptsEl.textContent = 'Tentativas restantes: ' + (_fleeMaxAttempts - _fleeAttempts);

      var btn = document.getElementById('flee-press-btn');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ FUGIR AGORA!'; }

      document.getElementById('flee-minigame').style.display = 'flex';
      if (_fleeAnim) cancelAnimationFrame(_fleeAnim);
      _fleeAnimLoop();
    }

    function _fleeAnimLoop() {
      if (!_fleeActive) return;
      var cursor = document.getElementById('flee-cursor');
      if (!cursor) return;
      _fleePos += _fleeDir * _fleeSpeed * 0.5;
      if (_fleePos >= 97) { _fleePos = 97; _fleeDir = -1; }
      if (_fleePos <= 0) { _fleePos = 0; _fleeDir = 1; }
      cursor.style.left = _fleePos + '%';
      _fleeAnim = requestAnimationFrame(_fleeAnimLoop);
    }

    function fleePressAction() {
      if (!_fleeActive) return;
      _fleeActive = false;
      if (_fleeAnim) cancelAnimationFrame(_fleeAnim);
      var btn = document.getElementById('flee-press-btn');
      var result = document.getElementById('flee-result');
      if (btn) btn.disabled = true;

      // Check if cursor is in any zone
      var inZone = _fleeZones.some(function (z) { return _fleePos >= z.l && _fleePos <= z.r; });

      if (inZone) {
        if (result) { result.textContent = '✓ FUGA BEM-SUCEDIDA!'; result.style.color = '#60ee60'; }
        resetCombo();
        setTimeout(function () {
          document.getElementById('flee-minigame').style.display = 'none';
          if (_fleeEscapeMode) {
            _fleeEscapeMode = false;
            endEscape(true);
          } else {
            addLog('Você escapou com sucesso!', 'evt');
            G.battle.over = true;
            setTimeout(showExplore, 600);
          }
        }, 900);
      } else {
        _fleeAttempts++;
        var remaining = _fleeMaxAttempts - _fleeAttempts;
        if (remaining > 0) {
          // Try again — flash red, reshuffle zones
          if (result) { result.textContent = '✗ Errou! Tentativas restantes: ' + remaining; result.style.color = '#ee6644'; }
          var track = document.getElementById('flee-track');
          if (track) { track.style.background = 'rgba(200,50,50,0.18)'; setTimeout(function () { track.style.background = ''; }, 300); }
          setTimeout(function () {
            _startFleeMiniGame();
          }, 900);
        } else {
          // All attempts failed
          if (result) { result.textContent = '✗ FUGA FALHOU! Voltando à batalha...'; result.style.color = '#ee4444'; }
          setTimeout(function () {
            document.getElementById('flee-minigame').style.display = 'none';
            if (_fleeEscapeMode) {
              _fleeEscapeMode = false;
              endEscape(false);
            } else {
              addLog('Todas as tentativas de fuga falharam! Inimigo contra-atacou!', 'dmg');
              _fleeFailPenalty = true;
              enemyAtk();
            }
          }, 1100);
        }
      }
    }

    function tryFlee() { openFleeMiniGame(); }

    // ═══════════════════════════════════════════════════════════════
    // COMBO SYSTEM — chain cards by ascending rarity
    // Básica → Magia → Magia2 → Ultimate builds combo multiplier
    // ═══════════════════════════════════════════════════════════════
    // Rarity order: basic=0, magic=1, magic2=2 (second magic), ultimate=3
    var _comboChain = [];      // array of rarity indices used this battle sequence
    var _comboLastRarity = -1; // rarity of last card played (-1 = none)
    var _comboMagicCount = 0;  // track how many magics used in current chain (max 2)

    // Rarity to numeric level
    function _rarityLevel(id) {
      if (id === 'b') return 0;
      if (id === 'm1' || id === 'm2') return 1;
      if (id === 'mh') return 1; // hybrid card counts as magic
      if (id === 'u') return 3;
      return -1;
    }

    // Call this when a card is played; returns the combo damage multiplier to apply
    function registerComboCard(cardId) {
      var level = _rarityLevel(cardId);
      if (level < 0) return 1.0;

      // Must be same or higher rarity, and magic can be used up to 2x consecutively
      var valid = false;
      if (_comboChain.length === 0) {
        // Any card can start a chain
        valid = true;
      } else {
        var lastLevel = _comboChain[_comboChain.length - 1];
        if (level === 1 && lastLevel === 1 && _comboMagicCount < 2) {
          valid = true; // second magic in a row
        } else if (level > lastLevel) {
          valid = true; // ascending rarity
        }
      }

      if (valid) {
        _comboChain.push(level);
        if (level === 1) _comboMagicCount++;
        else _comboMagicCount = 0;
      } else {
        // Chain broken — reset to this card
        _comboChain = [level];
        _comboMagicCount = (level === 1) ? 1 : 0;
      }

      renderComboDisplay();
      return getComboMult();
    }

    function getComboMult() {
      var len = _comboChain.length;
      if (len <= 1) return 1.0;
      if (len === 2) return 1.20;   // Básica + Magia
      if (len === 3) return 1.45;   // Básica + Magia + Magia2
      if (len >= 4) return 1.80;   // FULL COMBO: Básica → Magia → Magia2 → Ultimate
      return 1.0;
    }

    function getComboLabel() {
      var len = _comboChain.length;
      if (len <= 1) return null;
      if (len === 2) return 'COMBO x1.2!';
      if (len === 3) return 'COMBO CRESCENTE x1.45!';
      if (len >= 4) return '★ COMBO COMPLETO x1.8! ★';
      return null;
    }

    function resetCombo() {
      _comboChain = [];
      _comboLastRarity = -1;
      _comboMagicCount = 0;
      var disp = document.getElementById('combo-display');
      if (disp && disp.style.display !== 'none') {
        disp.classList.add('combo-fade');
        setTimeout(function () { disp.style.display = 'none'; disp.classList.remove('combo-fade'); }, 500);
      }
    }

    function renderComboDisplay() {
      var disp = document.getElementById('combo-display');
      var countEl = document.getElementById('combo-count');
      var multEl = document.getElementById('combo-mult');
      if (!disp || !countEl || !multEl) return;
      var len = _comboChain.length;
      if (len <= 1) { disp.style.display = 'none'; return; }
      disp.style.display = 'block';
      disp.classList.remove('combo-fade');
      var chains = ['', 'B', 'B→M', 'B→M→M', 'B→M→M→U'];
      countEl.textContent = chains[Math.min(len, 4)] || (len + 'x');
      var mult = getComboMult();
      multEl.textContent = 'x' + mult.toFixed(2);
      var colors = ['#ffd700', '#ffaa00', '#ff7700', '#ff2200'];
      var ci = Math.min(len - 2, colors.length - 1);
      countEl.style.color = colors[ci];
      countEl.style.textShadow = '0 0 20px ' + colors[ci] + ', 0 2px 4px rgba(0,0,0,0.9)';
      countEl.style.animation = 'none';
      void countEl.offsetWidth;
      countEl.style.animation = 'comboPop .25s cubic-bezier(0.22,1,0.36,1) both';
    }

    // ═══════════════════════════════════════════════════════════════
    // PARRY SYSTEM — triggered only on enemy critical hits
    // Circle of colored keys (Clair Obscur style)
    // ═══════════════════════════════════════════════════════════════
    var _parryActive = false;
    var _parrySuccess = false;
    var _parrySequence = [];      // correct sequence of keys
    var _parryProgress = 0;       // how many keys correctly pressed
    var _parryTimer = null;
    var _parryWindowMs = 2800;    // total window duration
    var _parryKeyListener = null;

    var _PARRY_COLORS = ['#ff4444', '#44bbff', '#ffcc00', '#44ee88'];
    var _PARRY_KEYS = ['Q', 'W', 'E', 'R'];
    var _PARRY_LABELS = ['Q', 'W', 'E', 'R'];

    function showParryChallenge() {
      // Generate a random sequence of 3 keys
      _parryActive = true;
      _parrySuccess = false;
      _parryProgress = 0;
      var len = 3;
      _parrySequence = [];
      for (var i = 0; i < len; i++) {
        _parrySequence.push(Math.floor(Math.random() * _PARRY_KEYS.length));
      }

      _buildParryUI();

      // Keyboard listener
      if (_parryKeyListener) document.removeEventListener('keydown', _parryKeyListener);
      _parryKeyListener = function (e) {
        if (!_parryActive) return;
        var key = e.key.toUpperCase();
        var idx = _PARRY_KEYS.indexOf(key);
        if (idx < 0) return;
        // Block Q/W/E/R from triggering any game menus during parry
        e.stopImmediatePropagation();
        e.preventDefault();
        _handleParryKey(idx);
      };
      document.addEventListener('keydown', _parryKeyListener);

      // Auto-expire
      if (_parryTimer) clearTimeout(_parryTimer);
      _parryTimer = setTimeout(function () {
        if (_parryActive) _closeParryChallenge(false);
      }, _parryWindowMs);
    }

    function _buildParryUI() {
      var ov = document.getElementById('parry-challenge-ov');
      if (!ov) return;

      var seqHtml = _parrySequence.map(function (ki, pos) {
        var done = pos < _parryProgress;
        var active = pos === _parryProgress;
        var col = _PARRY_COLORS[ki];
        var key = _PARRY_LABELS[ki];
        var scale = active ? 'scale(1.25)' : 'scale(1)';
        var opacity = done ? '0.35' : '1';
        var border = active ? ('3px solid ' + col) : '2px solid rgba(255,255,255,0.2)';
        var bg = done ? 'rgba(255,255,255,0.05)' : ('rgba(0,0,0,0.4)');
        var shadow = active ? ('0 0 22px ' + col + ', 0 0 8px ' + col) : 'none';
        return '<div class="parry-key" style="'
          + 'background:' + bg + ';'
          + 'border:' + border + ';'
          + 'color:' + (done ? 'rgba(255,255,255,0.3)' : col) + ';'
          + 'transform:' + scale + ';'
          + 'opacity:' + opacity + ';'
          + 'box-shadow:' + shadow + ';'
          + '">' + (done ? '✓' : key) + '</div>';
      }).join('');

      var pct = (_parryWindowMs - 0) / _parryWindowMs * 100; // full at start
      ov.innerHTML =
        '<div class="parry-chal-box">'
        + '<div class="parry-chal-title">⚡ ATAQUE CRÍTICO! APARAR!</div>'
        + '<div class="parry-chal-sub">Pressione a sequência:</div>'
        + '<div class="parry-key-row">' + seqHtml + '</div>'
        + '<div class="parry-time-bar-w"><div class="parry-time-bar" id="parry-time-bar" style="width:100%"></div></div>'
        + '</div>';
      ov.style.display = 'flex';

      // Animate bar shrinking
      setTimeout(function () {
        var bar = document.getElementById('parry-time-bar');
        if (bar) {
          bar.style.transition = 'width ' + (_parryWindowMs / 1000) + 's linear';
          bar.style.width = '0%';
        }
      }, 30);
    }

    function _handleParryKey(keyIdx) {
      if (!_parryActive) return;
      var expected = _parrySequence[_parryProgress];
      if (keyIdx === expected) {
        _parryProgress++;
        // Flash key green
        _buildParryUI();
        if (_parryProgress >= _parrySequence.length) {
          // SUCCESS!
          _parrySuccess = true;
          _closeParryChallenge(true);
        }
      } else {
        // Wrong key — flash red, fail
        _parrySuccess = false;
        var ov = document.getElementById('parry-challenge-ov');
        if (ov) {
          var box = ov.querySelector('.parry-chal-box');
          if (box) { box.style.background = 'rgba(200,30,30,0.3)'; setTimeout(function () { if (box) box.style.background = ''; }, 300); }
        }
        _closeParryChallenge(false);
      }
    }

    function _closeParryChallenge(success) {
      _parryActive = false;
      if (_parryTimer) clearTimeout(_parryTimer);
      if (_parryKeyListener) { document.removeEventListener('keydown', _parryKeyListener); _parryKeyListener = null; }
      var ov = document.getElementById('parry-challenge-ov');
      if (!ov) return;
      if (success) {
        ov.innerHTML = '<div class="parry-chal-box parry-success-box"><div class="parry-chal-title" style="color:#66ff88;font-size:1.2rem;">✦ PARRY PERFEITO! ✦</div><div class="parry-chal-sub" style="color:#aaffcc">Dano reduzido + contra-ataque!</div></div>';
        if (typeof sfx === 'function') sfx('hit_crit');
        setTimeout(function () { if (ov) ov.style.display = 'none'; }, 900);
      } else {
        ov.innerHTML = '<div class="parry-chal-box"><div class="parry-chal-title" style="color:#ff6655;">✗ Parry falhou</div></div>';
        setTimeout(function () { if (ov) ov.style.display = 'none'; }, 600);
      }
    }

    // showParryWindow kept as alias for non-crit calls (unused now, just safety)
    function showParryWindow() { }
    function closeParryWindow() { }
    function doParry() { }
    // tryCapture: ver implementação completa abaixo (sistema Bestial/Angelic)
    function showCapAnim(enemy) {
      var sc = document.getElementById('cap-ov'); sc.style.display = 'flex';
      document.getElementById('cap-res').textContent = '';
      document.getElementById('cap-close').style.display = 'none';
      var pct = enemy.hp / enemy.maxHp;
      var chance = Math.max(0.05, 0.92 - pct * 1.8);
      if (G.buffs && G.buffs.orb_better) { chance = Math.min(0.98, chance + 0.20); G.buffs.orb_better = false; addLog('Grimório Reforçado consumido!', 'evt'); renderBuffBar(); }
      var success = Math.random() < chance;
      var cap_enemy_name = enemy.name;

      // Função de processamento do resultado (chamada pelo callback da animação)
      function processCapResult(won) {
        var res = document.getElementById('cap-res');
        if (won) {
          var cap = Object.assign({}, enemy);
          // Garantir campos essenciais de criatura jogável
          if (!cap.id) cap.id = Math.random().toString(36).slice(2, 9);
          if (!cap.level) cap.level = 1;
          if (!cap.xp) cap.xp = 0;
          if (!cap.xpNext || cap.xpNext === 99) {
            cap.xpNext = typeof xpForLevel === 'function' ? xpForLevel(cap.level) : cap.level * 20;
          }
          if (cap.dead === undefined) cap.dead = false;
          if (cap.evolved === undefined) cap.evolved = false;
          if (cap.ultCD === undefined) cap.ultCD = 0;
          if (!cap.atk) cap.atk = cap.level * 2 + 8;
          if (!cap.def) cap.def = cap.level * 1 + 6;
          var _capRelic2 = typeof getEquippedRelic === 'function' ? getEquippedRelic() : null;
          if (_capRelic2 && _capRelic2.effect === 'capture_bonus_hp') {
            cap.hp = Math.min(cap.maxHp, Math.floor(cap.hp * 1.20));
          }
          if (G.team.length < 3) { G.team.push(cap); res.textContent = cap.name + ' vinculado ao Grimório!'; }
          else { G.hall.push(cap); res.textContent = cap.name + ' inscrito no Hall!'; }
          res.className = 'cap-res cap-ok';
          G.battle.over = true;
          bestiaryRecord(cap.name, 'captured');
          questProgress('capture', { el: cap.el });
          if (G._runCaptures !== undefined) G._runCaptures++;
        } else {
          if (res) res.textContent = cap_enemy_name + ' resistiu ao Grimório!';
          if (res) res.className = 'cap-res cap-fail';
        }
        var closeBtn = document.getElementById('cap-close');
        if (closeBtn) closeBtn.style.display = 'block';
      }

      if (typeof startGrimoireAnim === 'function') {
        // Passar success diretamente — a animação controla o timing internamente
        startGrimoireAnim(enemy, success, processCapResult);
      } else {
        // Fallback sem animação
        setTimeout(function () { processCapResult(success); }, 1800);
      }
    }
    function closeCap() { document.getElementById('cap-ov').style.display = 'none'; if (G.battle.over) showExplore(); else { renderBattle(); setTimeout(enemyAtk, 420); } }

    function openSwap(forced) {
      var list = document.getElementById('swlist'), alive = G.team.filter(function (c) { return !c.dead && c !== ac(); }), html = '';
      alive.forEach(function (c) { var p = c.hp / c.maxHp; html += '<div class="switem" onclick="selectSwap(\'' + c.id + '\')"><span>' + c.name + ' Nv.' + c.level + '</span><span style="color:' + hpCol(p) + '">' + c.hp + '/' + c.maxHp + '</span></div>'; });
      if (forced) html += '<div style="color:var(--mu);font-size:.98rem;padding:8px;font-style:italic;text-align:center">Deve escolher uma criatura.</div>';
      list.innerHTML = html; document.getElementById('swap-ov').style.display = 'flex';
    }
    function closeSwap() { document.getElementById('swap-ov').style.display = 'none'; }
    function selectSwap(id) { var idx = G.team.findIndex(function (c) { return c.id === id; }); G.activeIdx = idx; closeSwap(); buildHand(); updateDangerUI(); renderBattle(); renderCards(); requestAnimationFrame(function () { spawnS('my-wrap', ac()); }); addLog(ac().name + ' entrou na batalha!', 'evt'); renderPassivePips(); }

    var ESC = { active: false, px: 52, py: 135, tent: [], animId: null };
    function startEscape() {
      // Redirect to the new timing-bar flee minigame.
      // Bypasses isBoss check — this is triggered by critical HP, not the player flee button.
      // On success/fail, hooks into endEscape() instead of normal battle flow.
      _fleeAttempts = 0;
      _fleeFailPenalty = false;
      _fleeEscapeMode = true;
      _startFleeMiniGame();
    }
    function endEscape(ok) {
      document.getElementById('esc-ov').style.display = 'none';
      var my = ac();
      if (ok) {
        addLog('FUGA BEM-SUCEDIDA! ' + my.name + ' escapou!', 'evt');
        G.battle.over = true;
        renderBattle();
        // Restore map mob on successful flee
        if (G.battle && G.battle.isMobBattle && G.battle._sourceMob) {
          var _fm = G.battle._sourceMob;
          _fm._inBattle = false;
          _fm.state = 'wander';
          _fm._aggroTimer = 0;
          if (_fm.mesh) _fm.mesh.visible = true;
        }
        setTimeout(showExplore, 1300);
      } else {
        addLog('Fuga falhou! ' + my.name + ' morreu...', 'dmg');
        killCreature(my);
      }
    }

    function showGameOver() { killS('my-wrap'); killS('en-wrap'); document.getElementById('explore').style.display = 'none'; document.getElementById('battle').style.display = 'none'; document.getElementById('goscreen').style.display = 'flex'; }

    function showEscapedByHall(rescued) {
      var names = rescued.map(function (c) { return c.name; }).join(', ');
      var ov = document.getElementById('hall-rescue-ov');
      document.getElementById('hr-names').textContent = names;
      document.getElementById('hr-count').textContent = rescued.length;
      ov.style.display = 'flex';
      saveGame();
    }

    function closeHallRescue() {
      document.getElementById('hall-rescue-ov').style.display = 'none';
      showExplore();
    }

    function wipeAndGameOver() {
      try { if (typeof recordRunForMeta === 'function') recordRunForMeta(); } catch (e) { }
      if (G.playerName) {
        try {
          var key = SAVE_KEY_PREFIX + G.playerName;
          localStorage.removeItem(key);
          var list = JSON.parse(localStorage.getItem(SAVE_LIST_KEY) || '[]');
          list = list.filter(function (n) { return n !== G.playerName; });
          localStorage.setItem(SAVE_LIST_KEY, JSON.stringify(list));
        } catch (e) { }
        // Delete cloud save too
        if (typeof sbDeleteSave === 'function' && SB && SB.token) {
          sbDeleteSave(G.playerName).catch(function () { });
        }
      }
      killS('my-wrap'); killS('en-wrap');
      document.getElementById('explore').style.display = 'none';
      document.getElementById('battle').style.display = 'none';
      if (typeof stopBattleVisuals === 'function') stopBattleVisuals();
      destroyMap();
      showGameOverScreen();
    }

    function showGameOverScreen() {
      var gs = document.getElementById('goscreen');
      var totalKills = (G.areaKills || []).reduce(function (s, v) { return s + v; }, 0);
      var totalWins = (G.areaWins || []).reduce(function (s, v) { return s + v; }, 0);
      var bossCount = (G.bossDefeated || []).filter(Boolean).length;
      var captures = G._runCaptures || 0;
      var runMs = G._runStart ? Date.now() - G._runStart : 0;
      var runMin = Math.floor(runMs / 60000);
      var runSec = Math.floor((runMs % 60000) / 1000);
      var timeStr = runMin + 'm ' + runSec + 's';
      var planeReached = (G.plane || 0) + 1;
      var elIcons = { fire: '🔥', water: '💧', earth: '🌿', dark: '☽', light: '✦', nature: '🌱', electric: '⚡' };

      // Best creature (highest level alive/dead)
      var allC = (G.team || []).concat(G.hall || [], G.dead || []).filter(Boolean);
      var best = allC.reduce(function (b, c) { return (!b || c.level > b.level) ? c : b; }, null);
      var bestStr = best ? (elIcons[best.el] || '') + ' ' + best.name + ' Nv.' + (best.level || 1) : '—';

      // Dominant element
      var elCount = {};
      allC.forEach(function (c) { elCount[c.el] = (elCount[c.el] || 0) + 1; });
      var domEl = Object.keys(elCount).reduce(function (a, b) { return (elCount[a] || 0) >= (elCount[b] || 0) ? a : b; }, 'fire');

      // Best run record (localStorage)
      var record = {};
      try { record = JSON.parse(localStorage.getItem('soulmon_best_run') || '{}'); } catch (e) { }
      var isNewRecord = totalKills > (record.kills || 0);
      if (isNewRecord) {
        try { localStorage.setItem('soulmon_best_run', JSON.stringify({ kills: totalKills, wins: totalWins, time: timeStr, name: G.playerName })); } catch (e) { }
      }

      var statsHtml =
        '<div class="go-stats-grid">' +
        '<div class="go-stat"><span class="go-stat-lbl">Tempo</span><span class="go-stat-val">' + timeStr + '</span></div>' +
        '<div class="go-stat"><span class="go-stat-lbl">Batalhas</span><span class="go-stat-val">' + totalWins + '</span></div>' +
        '<div class="go-stat"><span class="go-stat-lbl">Abates</span><span class="go-stat-val">' + totalKills + '</span></div>' +
        '<div class="go-stat"><span class="go-stat-lbl">Capturas</span><span class="go-stat-val">' + captures + '</span></div>' +
        '<div class="go-stat"><span class="go-stat-lbl">Chefes</span><span class="go-stat-val">' + bossCount + '/6</span></div>' +
        '<div class="go-stat"><span class="go-stat-lbl">Plano</span><span class="go-stat-val">' + planeReached + '/3</span></div>' +
        '<div class="go-stat"><span class="go-stat-lbl">Almas</span><span class="go-stat-val">' + (G.souls || 0) + '</span></div>' +
        '<div class="go-stat"><span class="go-stat-lbl">Melhor criatura</span><span class="go-stat-val">' + bestStr + '</span></div>' +
        '</div>' +
        (isNewRecord ? '<div class="go-record">🏆 NOVO RECORDE PESSOAL — ' + totalKills + ' abates!</div>' : '') +
        '<div class="go-meta-hint">✦ Suas escolhas moldaram o próximo mundo.<br><span style="color:#555;font-size:.6rem">Elemento dominante: ' + (elIcons[domEl] || '') + (domEl) + '</span></div>';

      gs.querySelector('.got').textContent = G.playerName ? G.playerName.toUpperCase() + ' PERECEU' : 'VOCÊ PERECEU';
      gs.querySelector('.gos').innerHTML = statsHtml;
      gs.style.display = 'flex';
      // Animate stats in
      setTimeout(function () {
        var stats = gs.querySelectorAll('.go-stat');
        stats.forEach(function (s, i) { setTimeout(function () { s.classList.add('go-stat-show'); }, i * 80); });
      }, 300);
    }
    function resetGame() { if (G.regenInt) clearInterval(G.regenInt); Object.keys(SCNS).forEach(killS); try { stopMusic(); } catch (e) { } showTitle(); }

    function notify(msg, type) {
      // type: 'danger' (vermelho), 'success' (verde), 'info' (azul), undefined (dourado)
      var el = document.getElementById('notif');
      el.textContent = msg;
      el.className = 'notif' + (type ? ' notif-' + type : '');
      el.style.display = 'block';
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'sIn .3s ease';
      var dur = type === 'danger' ? 3500 : 2600;
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, dur);
    }

    // ===== QUESTS =====
    var _questAreaTab = 0;

    function questGetState(qid) {
      if (!G.quests) G.quests = {};
      if (!G.quests[qid]) G.quests[qid] = { progress: 0, done: false };
      return G.quests[qid];
    }

    function questIsUnlocked(q) {
      // Area must be unlocked
      return AREAS[q.area] && AREAS[q.area].unlocked;
    }

    function questCheck(q) {
      var s = questGetState(q.id);
      if (s.done) return;
      // Check if previous quest in same area is done (chain requirement)
      var areaQuests = QUESTS.filter(function (x) { return x.area === q.area; });
      var myIdx = areaQuests.indexOf(q);
      if (myIdx > 0 && !questGetState(areaQuests[myIdx - 1].id).done) return; // previous not done
      return s;
    }

    function questProgress(type, payload) {
      // payload: { areaIdx, el, name }
      if (!G.quests) G.quests = {};
      var anyCompleted = false;
      QUESTS.forEach(function (q) {
        if (!questIsUnlocked(q)) return;
        var s = questCheck(q);
        if (!s || s.done) return;
        var hit = false;
        switch (q.type) {
          case 'defeat_any':
            hit = (type === 'defeat' && payload.areaIdx === q.areaIdx); break;
          case 'defeat_el':
            hit = (type === 'defeat' && payload.el === q.el); break;
          case 'capture_any':
            hit = (type === 'capture'); break;
          case 'capture_el':
            hit = (type === 'capture' && payload.el === q.el); break;
          case 'win_area':
            hit = (type === 'win' && payload.areaIdx === q.areaIdx); break;
        }
        if (!hit) return;
        s.progress++;
        if (s.progress >= q.goal) {
          s.progress = q.goal;
          s.done = true;
          anyCompleted = true;
          grantQuestReward(q);
        }
      });
      if (anyCompleted) updateQuestBadge();
    }

    function grantQuestReward(q) {
      G.souls += q.reward.souls;
      if (q.reward.item) addItem(q.reward.item);
      var itemName = q.reward.item
        ? (ITEM_DEFS.find(function (d) { return d.id === q.reward.item; }) || {}).name || q.reward.item
        : null;
      var msg = '✦ MISSÃO: ' + q.title + ' — +' + q.reward.souls + ' almas' + (itemName ? ' + ' + itemName : '') + '!';
      notify(msg);
      addLog(msg, 'drop');
      updateQuestBadge();
    }

    function updateQuestBadge() {
      // Show badge if any quest is newly completable or done
      var badge = document.getElementById('qbadge');
      if (!badge) return;
      var hasNew = QUESTS.some(function (q) {
        if (!questIsUnlocked(q)) return false;
        var s = questGetState(q.id);
        return s.done;
      });
      badge.style.display = hasNew ? 'inline' : 'none';
    }

    function openQuests() {
      _questAreaTab = 0;
      renderQuests();
      var ov = document.getElementById('quests-ov');
      ov.style.display = 'flex'; ov.style.flexDirection = 'column'; ov.style.alignItems = 'center';
    }

    function closeQuests() {
      document.getElementById('quests-ov').style.display = 'none';
    }

    function setQuestTab(idx) {
      _questAreaTab = idx;
      renderQuests();
    }

    function renderQuests() {
      if (!G.quests) G.quests = {};
      var totalQ = QUESTS.length;
      var doneQ = QUESTS.filter(function (q) { return questGetState(q.id).done; }).length;
      var activeQ = QUESTS.filter(function (q) {
        if (!questIsUnlocked(q)) return false;
        var s = questGetState(q.id);
        return !s.done && s.progress > 0;
      }).length;

      document.getElementById('quest-summary').innerHTML =
        '<div><span class="quest-summary-val">' + doneQ + '/' + totalQ + '</span>Completas</div>' +
        '<div><span class="quest-summary-val">' + activeQ + '</span>Em progresso</div>' +
        '<div><span class="quest-summary-val">' + (totalQ - doneQ) + '</span>Restantes</div>';

      // Area tabs
      var tabsHtml = '';
      AREAS.forEach(function (a, i) {
        var unlocked = a.unlocked;
        var areaQuests = QUESTS.filter(function (q) { return q.area === i; });
        var hasDone = areaQuests.some(function (q) { return questGetState(q.id).done; });
        var tabCls = 'qtab' + (i === _questAreaTab ? ' active' : '') + (!unlocked ? ' locked' : '');
        var dot = hasDone && !areaQuests.every(function (q) { return questGetState(q.id).done; })
          ? '<span class="qtab-dot"></span>' : '';
        tabsHtml += '<button class="' + tabCls + '" onclick="' + (unlocked ? 'setQuestTab(' + i + ')' : '') + '">'
          + a.icon + ' ' + a.name.split(' ')[0] + dot + '</button>';
      });
      document.getElementById('quest-area-tabs').innerHTML = tabsHtml;

      // Quest list for current tab
      var areaQuests = QUESTS.filter(function (q) { return q.area === _questAreaTab; });
      var areaUnlocked = AREAS[_questAreaTab] && AREAS[_questAreaTab].unlocked;
      var listHtml = '';

      if (!areaUnlocked) {
        listHtml = '<div class="empty" style="color:var(--mu);text-align:center;padding:20px">🔒 Região bloqueada — desbloqueie esta área para ver as missões.</div>';
      } else {
        areaQuests.forEach(function (q, qi) {
          var s = questGetState(q.id);
          // Chain: only first is available, subsequent require previous done
          var prevDone = qi === 0 || questGetState(areaQuests[qi - 1].id).done;
          var status = s.done ? 'completed' : (!prevDone ? 'locked' : s.progress > 0 ? 'active' : 'available');
          var statusLabels = { locked: 'Bloqueada', available: 'Disponível', active: 'Em curso', completed: 'Completa' };
          var sbCls = { locked: 'qsb-locked', available: 'qsb-available', active: 'qsb-active', completed: 'qsb-done' };
          var pct = q.goal > 0 ? Math.min(100, Math.round(s.progress / q.goal * 100)) : 0;
          var rewardItemDef = q.reward.item ? ITEM_DEFS.find(function (d) { return d.id === q.reward.item; }) : null;
          var rewardHtml = '<div class="quest-reward">'
            + '<span class="quest-reward-souls">⚔ +' + q.reward.souls + ' almas</span>'
            + (rewardItemDef ? '<span class="quest-reward-item">✦ ' + rewardItemDef.name + '</span>' : '')
            + '</div>';

          listHtml += '<div class="quest-card q-' + status + '">';
          listHtml += '<div class="quest-card-header">'
            + '<div class="quest-title">' + q.title + '</div>'
            + '<span class="quest-status-badge ' + sbCls[status] + '">' + statusLabels[status] + '</span>'
            + '</div>';
          listHtml += '<div class="quest-desc">' + q.desc + '</div>';
          if (status !== 'locked') {
            listHtml += '<div class="quest-progress-wrap">'
              + '<div class="quest-progress-bar-bg"><div class="quest-progress-bar" style="width:' + pct + '%"></div></div>'
              + '<div class="quest-progress-txt">' + s.progress + ' / ' + q.goal + (s.done ? ' — Concluída!' : '') + '</div>'
              + '</div>';
          }
          listHtml += rewardHtml + '</div>';
        });
      }
      document.getElementById('quest-list').innerHTML = listHtml;
    }

    // ===== SANCTUARY =====
    var SANC_SERVICES = [
      {
        id: 'heal_all', icon: '✦', name: 'Bênção de Cura', repReq: 0,
        desc: 'Restaura todo o HP do grupo ativo e do Hall imediatamente.',
        cost: function () { return 180; }, costLabel: '180 Almas'
      },
      {
        id: 'boost_atk', icon: '⚔', name: 'Oferenda de Força', repReq: 0,
        desc: 'Aumenta permanentemente o ATK de uma criatura do grupo em +2.',
        cost: function () { return 320; }, costLabel: '320 Almas'
      },
      {
        id: 'boost_def', icon: '🛡', name: 'Oferenda de Pedra', repReq: 0,
        desc: 'Aumenta permanentemente o DEF de uma criatura do grupo em +2.',
        cost: function () { return 320; }, costLabel: '320 Almas'
      },
      {
        id: 'resurrect', icon: '💀', name: 'Essência da Ressurreição', repReq: 0,
        desc: 'Ressuscita a criatura mais recente do Livro dos Mortos com 50% HP.',
        cost: function () { return 500; }, costLabel: '500 Almas'
      },
      {
        id: 'fusion_prep', icon: '🔮', name: 'Preparação de Fusão', repReq: 2,
        desc: 'Reduz o custo de almas da próxima fusão em 40%. Requer Reputação: Caçador.',
        cost: function () { return 250; }, costLabel: '250 Almas · Rep. Caçador'
      },
      {
        id: 'xp_boost', icon: '⭐', name: 'Ritual do Crescimento', repReq: 3,
        desc: 'Todas as criaturas do grupo ganham 1 nível imediatamente. Requer Rep: Dominador.',
        cost: function () { var n = (G.team || []).length || 1; return 400 * n; },
        costLabel: '400/criatura · Rep. Dominador'
      },
      {
        id: 'legend_bond', icon: '✦', name: 'Vínculo Lendário', repReq: 4,
        desc: 'Criatura ativa ganha +5 ATK, +5 DEF e aprende sua carta especial se ainda não aprendeu. Requer Rep: Lenda.',
        cost: function () { return 800; }, costLabel: '800 Almas · Rep. Lenda'
      },
    ];


    // // ── Itens do Herói: efeitos e uso no campo ──

    var _sancAIdx = 0;
    function openSanctuary(aIdx) {
      OW._eventPaused = true;
      _sancAIdx = aIdx || 0;
      document.getElementById('sanc-sub').textContent = AREAS[aIdx].name + ' — Um lugar de poder antigo. Ofereça almas e receba bênçãos.';
      renderSancSouls();
      renderSancGrid(_sancAIdx);
      var ov = document.getElementById('sanc-ov');
      ov.style.display = 'flex'; ov.style.flexDirection = 'column'; ov.style.alignItems = 'center';
    }
    function closeSanctuary() {
      document.getElementById('sanc-ov').style.display = 'none';
      OW._eventPaused = false;
      // move player off the tile
      OW.player.tX = OW.player.x + 1; OW.player.tZ = OW.player.z;
      if (!OW.grid[OW.player.tX + ',' + OW.player.tZ]) { OW.player.tX = OW.player.x; OW.player.tZ = OW.player.z + 1; }
      OW.player.x = OW.player.tX; OW.player.z = OW.player.tZ;
      OW.player.mesh.position.set(OW.player.x, 0.6, OW.player.z);
    }
    function renderSancSouls() {
      document.getElementById('sanc-souls').innerHTML = 'Almas disponíveis: <span>' + G.souls + '</span>';
    }
    function getSancRepTier(aIdx) {
      var kills = (G.areaKills && G.areaKills[aIdx]) || 0;
      var tier = 0;
      REP_TIERS.forEach(function (t) { if (kills >= t.kills) tier = t.id; });
      return tier;
    }

    function renderSancGrid(aIdx) {
      aIdx = (aIdx !== undefined) ? aIdx : _sancAIdx;
      var repTier = getSancRepTier(aIdx);
      var repName = REP_TIERS[repTier] ? REP_TIERS[repTier].name : 'Desconhecido';
      var html = '<div style="font-size:.90rem;color:#888;text-align:center;margin-bottom:8px;letter-spacing:.1em">Sua reputação aqui: <span style="color:' + (REP_TIERS[repTier] || { color: '#888' }).color + '">' + (REP_TIERS[repTier] || { icon: '?' }).icon + ' ' + repName + '</span></div>';
      SANC_SERVICES.forEach(function (s) {
        var cost = s.cost();
        var canAfford = G.souls >= cost;
        var repLocked = repTier < (s.repReq || 0);
        var cls = 'service-card sanc-card';
        if (repLocked) cls += ' rep-locked';
        else if (!canAfford) cls += ' disabled';
        var onclick = repLocked ? '' : 'onclick="buySancService(\'' + s.id + '\')"';
        html += '<div class="' + cls + '" ' + onclick + '>';
        html += '<div class="svc-icon">' + s.icon + '</div>';
        html += '<div class="svc-name">' + s.name + '</div>';
        if (repLocked) {
          var reqTier = REP_TIERS[s.repReq] || REP_TIERS[1];
          html += '<div class="svc-desc" style="color:#775544">🔒 Requer reputação: ' + reqTier.icon + ' ' + reqTier.name + '</div>';
        } else {
          html += '<div class="svc-desc">' + s.desc + '</div>';
        }
        html += '<div class="svc-cost">' + s.costLabel + '</div>';
        html += '</div>';
      });
      document.getElementById('sanc-grid').innerHTML = html;
    }
    function buySancService(id) {
      var svc = SANC_SERVICES.find(function (s) { return s.id === id; });
      if (!svc) return;
      var cost = svc.cost();
      if (G.souls < cost) { notify('Almas insuficientes!'); return; }

      if (id === 'heal_all') {
        G.team.forEach(function (c) { c.hp = c.maxHp; });
        G.hall.forEach(function (c) { c.hp = c.maxHp; });
        G.souls -= cost;
        notify('✦ Todo o grupo foi curado!');
      } else if (id === 'boost_atk') {
        if (!G.team.length) { notify('Grupo vazio!'); return; }
        G.team[0].atk += 2;
        G.souls -= cost;
        notify('⚔ ' + G.team[0].name + ' ATK +2!');
      } else if (id === 'boost_def') {
        if (!G.team.length) { notify('Grupo vazio!'); return; }
        G.team[0].def += 2;
        G.souls -= cost;
        notify('🛡 ' + G.team[0].name + ' DEF +2!');
      } else if (id === 'resurrect') {
        if (!G.dead || !G.dead.length) { notify('Nenhuma criatura nos mortos!'); return; }
        var revived = G.dead[G.dead.length - 1];
        G.dead.splice(G.dead.length - 1, 1);
        revived.hp = Math.ceil(revived.maxHp * 0.50);
        revived.dead = false;
        G.team.push(revived);
        G.souls -= cost;
        notify('💀 ' + revived.name + ' ressuscitou com 50% HP!');
        addLog('✦ Santuário: ' + revived.name + ' voltou dos mortos!', 'evt');
      } else if (id === 'fusion_prep') {
        G._fusionDiscount = 0.40; // 40% off next fusion
        G.souls -= cost;
        notify('🔮 Próxima fusão com 40% de desconto!');
        addLog('✦ Preparação de Fusão ativa.', 'evt');
      } else if (id === 'xp_boost') {
        var alive = (G.team || []).filter(function (c) { return c && !c.dead; });
        if (!alive.length) { notify('Nenhuma criatura no grupo!'); return; }
        G.souls -= cost;
        alive.forEach(function (c) {
          var tpl = TPLS.find(function (t) { return t.name === c.name; }) || TPLS[0];
          levelUp(c); checkLearnedCards(c, tpl);
        });
        notify('⭐ Todo o grupo subiu de nível!');
        addLog('✦ Ritual do Crescimento concluído!', 'evt');
        renderTeam && renderTeam();
      } else if (id === 'legend_bond') {
        var hero_c = ac();
        if (!hero_c) { notify('Nenhuma criatura ativa!'); return; }
        hero_c.atk += 5; hero_c.def += 5;
        var tpl = TPLS.find(function (t) { return t.name === hero_c.name; }) || TPLS[0];
        if (tpl && tpl.learns) {
          tpl.learns.forEach(function (l) {
            if (!hero_c.learnedCards) hero_c.learnedCards = [];
            if (hero_c.learnedCards.indexOf(l.card) < 0) {
              hero_c.learnedCards.push(l.card);
              addLog('✦ ' + hero_c.name + ' aprendeu ' + l.name + ' via Vínculo Lendário!', 'evt');
            }
          });
        }
        G.souls -= cost;
        notify('✦ ' + hero_c.name + ' recebeu Vínculo Lendário!');
      } else if (id === 'revive_item') {
        ['fire', 'water', 'earth', 'dark', 'light', 'nature', 'electric'].forEach(function (el) { addItem(el); });
        G.souls -= cost;
        notify('◈ Essências obtidas!');
      }
      updateExploreUI();
      renderSancSouls();
      renderSancGrid(_sancAIdx);
    }

    // ===== VENDOR =====
    // Temporary buffs stored in G

    // ══════════════════════════════════════════════════════════════
    // SISTEMA DE INVENTÁRIO DO HERÓI
    // ══════════════════════════════════════════════════════════════

    function useHeroItem(id) {
      ensureHero();
      var h = G.hero;
      if (!h.items) h.items = [];
      var inv = h.items.find(function (i) { return i.id === id; });
      var hi = typeof HERO_ITEMS !== 'undefined' ? HERO_ITEMS[id] : null;
      if (!inv || !hi || (inv.qty || 0) <= 0) { notify('Item indisponível!'); return; }

      if (hi.type === 'heal') {
        var heal = Math.floor(h.maxHp * hi.val);
        var before = h.hp;
        h.hp = Math.min(h.maxHp, h.hp + heal);
        var gained = h.hp - before;
        if (gained <= 0) { notify('HP já está cheio!'); return; }
        notify(hi.icon + ' ' + h.hp + '/' + h.maxHp + ' HP!', 'success');
      } else if (hi.type === 'buff_def') {
        h.def = (h.def || 4) + hi.val;
        if (!h._tempBuffs) h._tempBuffs = {};
        h._tempBuffs.def_boost = { val: hi.val, expires: Date.now() + (hi.dur || 300000) };
        notify(hi.icon + ' +' + hi.val + ' DEF por 5 minutos!', 'success');
      } else if (hi.type === 'buff_atk') {
        h.atk = (h.atk || 10) + hi.val;
        if (!h._tempBuffs) h._tempBuffs = {};
        h._tempBuffs.atk_boost = { val: hi.val, expires: Date.now() + (hi.dur || 300000) };
        notify(hi.icon + ' +' + hi.val + ' ATQ por 5 minutos!', 'success');
      } else if (hi.type === 'revive') {
        if (h._reviveStored) { notify('Cristal já guardado!'); return; }
        h._reviveStored = true;
        notify(hi.icon + ' Cristal guardado — ativa ao cair em 0 HP!', 'success');
      }

      inv.qty--;
      if (inv.qty <= 0) h.items = h.items.filter(function (i) { return i.id !== id; });
      renderHeroHUD();
      updateHeroBagBadge();
      renderHeroBag();
    }

    function _useBagItem(el) {
      var id = el ? el.getAttribute('data-item-id') : null;
      if (id) useHeroItem(id);
    }

    function updateHeroBagBadge() {
      ensureHero();
      var badge = document.getElementById('hero-bag-badge');
      if (!badge) return;
      var items = (G.hero && G.hero.items) ? G.hero.items : [];
      var total = items.reduce(function (s, i) { return s + (i.qty || 0); }, 0);
      badge.textContent = total;
      badge.style.display = total > 0 ? 'inline-block' : 'none';
      // Atualizar badge na dock também
      var dockBadge = document.getElementById('hero-bag-dock-badge');
      if (dockBadge) {
        dockBadge.textContent = total;
        dockBadge.style.display = total > 0 ? 'inline-block' : 'none';
      }
    }

    function renderHeroBag() {
      var panel = document.getElementById('hero-bag-panel');
      if (!panel) return;
      ensureHero();
      var items = (G.hero && G.hero.items) ? G.hero.items.filter(function (i) { return (i.qty || 0) > 0; }) : [];

      if (!items.length) {
        panel.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.3);font-size:.7rem;padding:20px">Bolsa vazia.<br>Compre itens nos Vendedores!</div>';
        return;
      }

      // Usar createElement para evitar problemas de escapamento de aspas no onclick
      panel.innerHTML = '';
      items.forEach(function (inv) {
        var hi = (typeof HERO_ITEMS !== 'undefined') ? HERO_ITEMS[inv.id] : null;
        if (!hi) return;
        var div = document.createElement('div');
        div.className = 'hero-bag-item';
        div.setAttribute('data-item-id', inv.id);
        div.onclick = function () { useHeroItem(inv.id); };
        div.innerHTML =
          '<span class="hbi-icon">' + hi.icon + '</span>' +
          '<div class="hbi-info">' +
          '<div class="hbi-name">' + hi.name + '</div>' +
          '<div class="hbi-desc">' + hi.desc + '</div>' +
          '</div>' +
          '<span class="hbi-qty">×' + (inv.qty || 0) + '</span>';
        panel.appendChild(div);
      });
    }

    // Verificar buffs temporários do herói (expirar)
    function tickHeroTempBuffs() {
      if (!G || !G.hero || !G.hero._tempBuffs) return;
      var now = Date.now();
      var tb = G.hero._tempBuffs;
      if (tb.def_boost && now >= tb.def_boost.expires) {
        G.hero.def = Math.max(4, G.hero.def - tb.def_boost.val);
        delete tb.def_boost;
        notify('🛡 Bônus de DEF expirou.', 'info');
        renderHeroHUD();
      }
      if (tb.atk_boost && now >= tb.atk_boost.expires) {
        G.hero.atk = Math.max(WEAPONS[G.hero.weapon || 'sword'].atk, G.hero.atk - tb.atk_boost.val);
        delete tb.atk_boost;
        notify('⚡ Bônus de ATQ expirou.', 'info');
        renderHeroHUD();
      }
    }

    function openVendor(aIdx) {
      OW._eventPaused = true;
      OW._vendorAIdx = aIdx; // store for reputation discount
      var repTier = getRepTier(aIdx);
      var discountNote = (repTier && repTier.bonus && repTier.bonus.vendorDiscount)
        ? ' <span style="color:#c9933a;font-size:.80rem">✦ Desconto ' + Math.round(repTier.bonus.vendorDiscount * 100) + '% (Lenda)</span>' : '';
      document.getElementById('vendor-sub').innerHTML = AREAS[aIdx].name + ' — Um comerciante misterioso oferece suas mercadorias raras.' + discountNote;
      renderVendorSouls();
      renderVendorGrid();
      var ov = document.getElementById('vendor-ov');
      ov.style.display = 'flex'; ov.style.flexDirection = 'column'; ov.style.alignItems = 'center';
    }
    function closeVendor() {
      document.getElementById('vendor-ov').style.display = 'none';
      OW._eventPaused = false;
      OW.player.tX = OW.player.x + 1; OW.player.tZ = OW.player.z;
      if (!OW.grid[OW.player.tX + ',' + OW.player.tZ]) { OW.player.tX = OW.player.x; OW.player.tZ = OW.player.z + 1; }
      OW.player.x = OW.player.tX; OW.player.z = OW.player.tZ;
      OW.player.mesh.position.set(OW.player.x, 0.6, OW.player.z);
    }
    function renderVendorSouls() {
      document.getElementById('vendor-souls').innerHTML = 'Almas disponíveis: <span>' + G.souls + '</span>';
    }
    function renderVendorGrid() {
      if (!G.buffs) G.buffs = {};
      var html = '';
      // Reputation discount
      var _vAIdx = OW._vendorAIdx !== undefined ? OW._vendorAIdx : 0;
      var _vRepT = getRepTier(_vAIdx);
      var _vDisc = (_vRepT && _vRepT.bonus && _vRepT.bonus.vendorDiscount) ? _vRepT.bonus.vendorDiscount : 0;

      VENDOR_STOCK.forEach(function (s) {
        var finalCost = _vDisc > 0 ? Math.max(1, Math.floor(s.cost * (1 - _vDisc))) : s.cost;
        var canAfford = G.souls >= finalCost;
        var hasBuff = G.buffs[s.id];
        var disabled = !canAfford || hasBuff;
        var costClass = canAfford ? 'blue' : 'red';
        var costLabel = _vDisc > 0
          ? '<s style="color:#555;font-size:.80rem">' + s.cost + '</s> ' + finalCost + ' Almas'
          : finalCost + ' Almas';
        html += '<div class="service-card shop-card' + (disabled ? ' disabled' : '') + '" onclick="buyVendorItem(\'' + s.id + '\', ' + finalCost + ')">';
        html += '<div class="svc-icon">' + s.icon + '</div>';
        html += '<div class="svc-name">' + s.name + (hasBuff ? ' <span style="color:#6ab890;font-size:.45rem">(Ativo)</span>' : '') + '</div>';
        html += '<div class="svc-desc">' + s.desc + '</div>';
        html += '<div class="svc-cost ' + costClass + '">' + costLabel + '</div>';
        html += '</div>';
      });
      document.getElementById('vendor-grid').innerHTML = html;
    }
    function buyVendorItem(id, overrideCost) {
      var item = VENDOR_STOCK.find(function (s) { return s.id === id; });
      if (!item) return;
      var cost = (overrideCost !== undefined) ? overrideCost : item.cost;
      if (G.souls < cost) { notify('Almas insuficientes!'); return; }
      if (!G.buffs) G.buffs = {};

      if (id === 'potion_sm') {
        var c = G.team[0]; if (!c) { notify('Grupo vazio!'); return; }
        c.hp = Math.min(c.maxHp, c.hp + Math.floor(c.maxHp * 0.30));
        G.souls -= cost;
        notify('🧪 ' + c.name + ' recuperou 30% HP!');
        updateExploreUI();
      } else if (id === 'potion_lg') {
        var c = G.team[0]; if (!c) { notify('Grupo vazio!'); return; }
        c.hp = Math.min(c.maxHp, c.hp + Math.floor(c.maxHp * 0.70));
        G.souls -= cost;
        notify('⚗ ' + c.name + ' recuperou 70% HP!');
        updateExploreUI();
      } else if (id === 'orb_better') {
        if (G.buffs.orb_better) { notify('Buff já ativo!'); return; }
        G.buffs.orb_better = true;
        G.souls -= cost;
        notify('◎ Orbe Reforçado ativo!');
      } else if (id === 'xp_boost') {
        if (G.buffs.xp_boost) { notify('Buff já ativo!'); return; }
        G.buffs.xp_boost = true;
        G.souls -= cost;
        notify('★ Tônico ativo! +50% XP na próxima batalha.');
      } else if (id === 'souls_map') {
        G.souls -= cost;
        notify('🗺 Santuários: blocos dourados. Vendedores: blocos azuis.');
      }
      // ── Itens do Herói ──
      else if (typeof HERO_ITEMS !== 'undefined' && HERO_ITEMS[id]) {
        ensureHero();
        if (!G.hero.items) G.hero.items = [];
        var hi = G.hero.items.find(function (i) { return i.id === id; });
        if (hi) { hi.qty = (hi.qty || 0) + 1; }
        else G.hero.items.push({ id: id, qty: 1 });
        G.souls -= cost;
        notify(HERO_ITEMS[id].icon + ' ' + HERO_ITEMS[id].name + ' adicionado à bolsa!', 'success');
        renderVendorSouls();
        renderVendorGrid();
        updateHeroBagBadge();
        return;
      }
      renderVendorSouls();
      renderVendorGrid();
    }

    // ===== BESTIARY =====
    var _bestiaryFilter = 'all';



  



    function bestiaryRecord(name, event) {
      // event: 'seen' | 'defeated' | 'captured'
      if (!G.bestiary) G.bestiary = {};
      if (!G.discoveredSpecials) G.discoveredSpecials = {};
      if (!G.relicInventory) G.relicInventory = [];
      if (!G.equippedRelic) G.equippedRelic = null;
      if (!G.viveiro) G.viveiro = [];
      if (!G.bestiary[name]) G.bestiary[name] = { seen: 0, defeated: 0, captured: false };
      var e = G.bestiary[name];
      if (event === 'seen') { e.seen++; }
      if (event === 'defeated') { e.defeated++; e.seen = Math.max(e.seen, 1); }
      if (event === 'captured') { e.captured = true; e.seen = Math.max(e.seen, 1); }
      // Update badge
      var total = Object.keys(G.bestiary).length;
      var bb = document.getElementById('bbadge');
      if (bb) { bb.style.display = 'inline'; bb.textContent = total; }
    }

    var _bestiaryBook = 'bestial'; // 'bestial' | 'common' | 'special'

    // Common mobs (map creatures)
    var COMMON_CREATURE_NAMES = ['Rastejador', 'Sombra Verde', 'Braseiro', 'Espectro', 'Lama Viva', 'Rocha Viva'];
    // Boss names (from BOSS_REQS keys or derived from data)
    var BOSS_CREATURE_NAMES = [];

    function openBestiary() {
      _bestiaryFilter = 'all';
      _bestiaryBook = 'bestial';
      renderBestiary();
      var ov = document.getElementById('bestiary-ov');
      ov.style.display = 'flex';
      ov.style.flexDirection = 'column';
    }

    function closeBestiary() {
      document.getElementById('bestiary-ov').style.display = 'none';
      // Dispose voxel preview scene
      if (_bstScene) { _bstScene = null; _bstRenderer = null; }
    }

    function setBestiaryFilter(f) {
      _bestiaryFilter = f;
      renderBestiary();
    }

    function setBestiaryBook(book) {
      _bestiaryBook = book;
      ['bestial', 'common', 'special'].forEach(function (b) {
        var btn = document.getElementById('best-tab-' + b);
        if (btn) btn.className = 'best-tab' + (b === book ? ' active' : '');
      });
      renderBestiary();
    }

    function getShapeIcon(shape) {
      var icons = { spiky: '🔺', round: '⭕', fluid: '💧', crystal: '💎', star: '⭐' };
      return icons[shape] || '◆';
    }

    // Voxel preview state
    var _bstScene = null, _bstRenderer = null, _bstMesh = null, _bstAnimId = null;

    function renderBestiary() {
      if (!G.bestiary) G.bestiary = {};
      var total = TPLS.length + COMMON_CREATURE_NAMES.length;
      var seen = 0, captured = 0;
      TPLS.forEach(function (t) {
        var e = G.bestiary[t.name];
        if (e && e.seen > 0) seen++;
        if (e && e.captured) captured++;
      });
      COMMON_CREATURE_NAMES.forEach(function (n) {
        var e = G.bestiary[n];
        if (e && e.seen > 0) seen++;
      });

      document.getElementById('best-stats').innerHTML =
        '<div style="text-align:center"><span class="best-stat-val">' + seen + '/' + total + '</span>Encontradas</div>' +
        '<div style="text-align:center"><span class="best-stat-val">' + captured + '/' + TPLS.length + '</span>Vinculadas</div>' +
        '<div style="text-align:center"><span class="best-stat-val">' + Math.round(seen / total * 100) + '%</span>Completo</div>';

      // Filter buttons
      var filters = [{ key: 'all', label: 'Todas' }, { key: 'seen', label: 'Encontradas' }, { key: 'captured', label: 'Vinculadas' }, { key: 'missing', label: 'Não Vistas' }];
      var fhtml = '';
      filters.forEach(function (f) {
        fhtml += '<button class="bfilt' + (_bestiaryFilter === f.key ? ' active' : '') + '" onclick="setBestiaryFilter(\'' + f.key + '\')">' + f.label + '</button>';
      });
      // Only show capture filter on bestial book
      if (_bestiaryBook !== 'bestial') {
        fhtml = fhtml.replace('Vinculadas', '<span style="opacity:.3">Vinculadas</span>');
      }
      document.getElementById('best-filters').innerHTML = fhtml;

      var html = '';

      if (_bestiaryBook === 'bestial') {
        // ── LIVRO 1: Criaturas Bestiais (capturáveis) ──
        TPLS.forEach(function (t) {
          var e = G.bestiary[t.name] || { seen: 0, defeated: 0, captured: false };
          var isSeen = e.seen > 0, isCaptured = e.captured;
          if (_bestiaryFilter === 'seen' && !isSeen) return;
          if (_bestiaryFilter === 'captured' && !isCaptured) return;
          if (_bestiaryFilter === 'missing' && isSeen) return;
          var elData = EL[t.el] || {};
          var cardClass = 'best-card best-card-voxel ' + (isCaptured ? 'captured' : isSeen ? 'seen' : 'unknown');
          var hexCol = elData.hex || '#888';
          var badges = '';
          if (isCaptured) badges += '<span class="best-badge cap-b">✦ Vinculada</span>';
          else if (isSeen) badges += '<span class="best-badge seen-b">Encontrada</span>';
          if (e.defeated > 0) badges += '<span class="best-badge defeats-b">✕' + e.defeated + '</span>';
          var evoNote = isSeen && t.evo ? '<div class="best-evo-hint">→ Evolui para: <b>' + t.evo + '</b></div>' : '';
          var statsRow = isSeen
            ? '<div class="best-stats-row">ATK <b>' + t.atk + '</b> · DEF <b>' + t.def + '</b></div>'
            : '<div class="best-stats-row">ATK <b>?</b> · DEF <b>?</b></div>';
          html += '<div class="' + cardClass + '" style="--el-col:' + hexCol + '" onclick="previewBestiaryCreature(\'' + t.name + '\')">';
          html += '<div class="best-voxel-wrap" id="bvox-' + t.name.replace(/\s/g, '_') + '">';
          if (isSeen) {
            html += '<canvas class="best-voxel-canvas" width="80" height="80" data-name="' + t.name + '" data-el="' + t.el + '"></canvas>';
          } else {
            html += '<div class="best-unknown-silhouette">?</div>';
          }
          html += '</div>';
          html += '<div class="best-name">' + (isSeen ? t.name : '???') + '</div>';
          html += '<div class="best-el eb el-' + t.el + '">' + (isSeen ? (elData.name || t.el) : '?') + '</div>';
          html += statsRow + evoNote;
          html += '<div class="best-badge-row">' + badges + '</div>';
          html += '</div>';
        });

      } else if (_bestiaryBook === 'common') {
        // ── LIVRO 2: Criaturas Comuns (mobs do mapa) ──
        var MOB_DATA = [
          { name: 'Rastejador', el: 'earth', atk: 6, def: 4, color: 0x5aaa44, desc: 'Lagartixa ágil das planícies e pântanos.' },
          { name: 'Sombra Verde', el: 'dark', atk: 10, def: 6, color: 0x226622, desc: 'Lobo sombrio das florestas densas.' },
          { name: 'Braseiro', el: 'fire', atk: 14, def: 5, color: 0xaa4422, desc: 'Salamandra do interior vulcânico.' },
          { name: 'Espectro', el: 'dark', atk: 12, def: 3, color: 0x111122, desc: 'Morcego espectral do abismo.' },
          { name: 'Lama Viva', el: 'water', atk: 8, def: 8, color: 0x224488, desc: 'Sapo de argila dos pântanos.' },
          { name: 'Rocha Viva', el: 'earth', atk: 16, def: 12, color: 0x556677, desc: 'Urso de pedra das montanhas de trovão.' }
        ];
        MOB_DATA.forEach(function (mob) {
          var e = G.bestiary[mob.name] || { seen: 0, defeated: 0 };
          var isSeen = e.seen > 0 || e.defeated > 0;
          if (_bestiaryFilter === 'seen' && !isSeen) return;
          if (_bestiaryFilter === 'missing' && isSeen) return;
          if (_bestiaryFilter === 'captured') return; // mobs can't be captured
          var cardClass = 'best-card best-card-voxel ' + (isSeen ? 'seen' : 'unknown');
          html += '<div class="' + cardClass + '" style="--el-col:#556677">';
          html += '<div class="best-voxel-wrap">';
          if (isSeen) {
            html += '<div class="best-mob-icon" style="color:#' + mob.color.toString(16).padStart(6, '0') + '">' + getShapeIcon('beast') + '</div>';
          } else {
            html += '<div class="best-unknown-silhouette">?</div>';
          }
          html += '</div>';
          html += '<div class="best-name">' + (isSeen ? mob.name : '???') + '</div>';
          html += '<div class="best-el eb el-' + mob.el + '">' + (isSeen ? (EL[mob.el] ? EL[mob.el].name : mob.el) : '?') + '</div>';
          if (isSeen) html += '<div class="best-desc">' + mob.desc + '</div>';
          if (e.defeated > 0) html += '<div class="best-badge-row"><span class="best-badge defeats-b">✕' + e.defeated + ' derrotados</span></div>';
          html += '</div>';
        });

      } else if (_bestiaryBook === 'special') {
        // ── LIVRO 3: Especiais & Chefes ──
        var SPECIAL_DATA = [
          { name: 'Guardião da Floresta', el: 'earth', desc: 'Chefe colossal da Floresta das Almas. Antigo protetor dos espíritos selvagens.', unlockArea: 0 },
          { name: 'Tyrant das Chamas', el: 'fire', desc: 'Chefe da Charneca Ardente. Forjado no núcleo vulcânico.', unlockArea: 1 },
          { name: 'Vórtice Espectral', el: 'dark', desc: 'Chefe do Abismo Espectral. Uma singularidade de trevas puras.', unlockArea: 2 },
        ];
        SPECIAL_DATA.forEach(function (sp) {
          var defeated = G.bossDefeated && G.bossDefeated[sp.unlockArea];
          var cardClass = 'best-card best-card-boss ' + (defeated ? 'seen' : 'unknown');
          html += '<div class="' + cardClass + '" style="--el-col:' + (EL[sp.el] ? EL[sp.el].hex : '#888') + '">';
          html += '<div class="best-boss-icon">' + (defeated ? '💀' : '👑') + '</div>';
          html += '<div class="best-name">' + (defeated ? sp.name : '??? Chefe ???') + '</div>';
          html += '<div class="best-el eb el-' + sp.el + '">' + (EL[sp.el] ? EL[sp.el].name : sp.el) + '</div>';
          if (defeated) html += '<div class="best-desc">' + sp.desc + '</div>';
          html += '<div class="best-badge-row">' + (defeated ? '<span class="best-badge cap-b">Derrotado</span>' : '<span class="best-badge">Não Encontrado</span>') + '</div>';
          html += '</div>';
        });
      }

      if (!html) html = '<div class="empty" style="grid-column:1/-1;color:var(--mu);text-align:center;padding:20px">Nenhuma criatura nesta categoria ainda.</div>';
      document.getElementById('best-grid').innerHTML = html;

      // Render voxel canvases for seen bestial creatures
      if (_bestiaryBook === 'bestial') {
        setTimeout(renderBestiaryVoxels, 50);
      }
    }

    function renderBestiaryVoxels() {
      var canvases = document.querySelectorAll('.best-voxel-canvas');
      canvases.forEach(function (canvas) {
        var tplName = canvas.getAttribute('data-name');
        var tpl = TPLS.find(function (t) { return t.name === tplName; });
        if (!tpl) return;
        try { renderVoxelToCanvas(canvas, tpl); } catch (e) { }
      });
    }

    function renderVoxelToCanvas(canvas, tpl) {
      var W = canvas.width, H = canvas.height;
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);

      var scene = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
      cam.position.set(2.5, 2.5, 3.5);
      cam.lookAt(0, 0.5, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      var dl = new THREE.DirectionalLight(0xfff4e8, 1.2);
      dl.position.set(3, 5, 3);
      scene.add(dl);

      var col = EL[tpl.el] ? EL[tpl.el].col : 0x888888;
      var mesh = buildChibiChar(col, tpl.shape, false);
      // Scale down to fit canvas nicely
      mesh.scale.setScalar(0.42);
      mesh.rotation.y = -0.4;
      scene.add(mesh);

      // Animate rotation
      var startTime = Date.now();
      function animate() {
        if (!canvas.isConnected) { renderer.dispose(); return; }
        var t = (Date.now() - startTime) * 0.001;
        mesh.rotation.y = -0.4 + Math.sin(t * 0.6) * 0.3;
        renderer.render(scene, cam);
        requestAnimationFrame(animate);
      }
      animate();
    }

    function previewBestiaryCreature(name) {
      // Already handled inline by voxel canvas
    }


    // ===== WEATHER + AMBIENT AUDIO SYSTEM =====
    var _weatherParticles = [];
    var _ambientNodes = {};   // { noise: OscNode, gain: GainNode }
    var _weatherActive = false;

    var WEATHER_DEFS = [
      // plane 0 — forest: light rain + wind
      { plane: 0, type: 'rain', fogDensity: 0.032, fogCol: 0x081828, particleCol: 'rgba(140,180,230,', count: 80 },
      // plane 1 — volcanic: embers + ash
      { plane: 1, type: 'embers', fogDensity: 0.038, fogCol: 0x1a0800, particleCol: 'rgba(255,120,40,', count: 50 },
      // plane 2 — spectral: void sparks
      { plane: 2, type: 'sparks', fogDensity: 0.042, fogCol: 0x040010, particleCol: 'rgba(160,80,255,', count: 60 },
    ];

    function initWeather() {
      stopWeather();
      var plane = G.plane || 0;
      var def = WEATHER_DEFS[plane] || WEATHER_DEFS[0];

      // Create overlay canvas for 2D particles
      var existing = document.getElementById('weather-canvas');
      if (existing) existing.remove();
      var owWrap = document.getElementById('ow-wrap');
      if (!owWrap) return;
      var wc = document.createElement('canvas');
      wc.id = 'weather-canvas';
      wc.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;';
      wc.width = owWrap.offsetWidth || 800;
      wc.height = owWrap.offsetHeight || 420;
      owWrap.appendChild(wc);

      // Init particles
      _weatherParticles = [];
      for (var i = 0; i < def.count; i++) {
        _weatherParticles.push(makeWeatherParticle(wc, def));
      }
      _weatherActive = true;

      // Adjust fog
      if (OW.scene && OW.scene.fog) {
        OW.scene.fog.density = def.fogDensity;
      }

      startAmbientSound(plane);
      animateWeather(wc, def);
    }

    function makeWeatherParticle(canvas, def) {
      var p = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 0.8 + Math.random() * 1.8,
        size: def.type === 'rain' ? (0.8 + Math.random()) : (1.5 + Math.random() * 2),
        drift: (Math.random() - 0.5) * 0.5,
        alpha: 0.2 + Math.random() * 0.5,
        col: def.particleCol
      };
      if (def.type === 'rain') { p.len = 6 + Math.random() * 8; p.angle = 0.2; }
      if (def.type === 'embers') { p.flicker = Math.random() * Math.PI * 2; p.speed *= 0.5; p.drift = (Math.random() - 0.5) * 1.5; }
      if (def.type === 'sparks') { p.flicker = Math.random() * Math.PI * 2; p.speed *= 0.3; p.drift = (Math.random() - 0.5) * 2; }
      return p;
    }

    function animateWeather(canvas, def) {
      if (!_weatherActive) return;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      _weatherParticles.forEach(function (p) {
        p.y += p.speed;
        p.x += p.drift;
        if (def.type === 'embers' || def.type === 'sparks') {
          p.flicker += 0.08;
          p.alpha = 0.15 + Math.abs(Math.sin(p.flicker)) * 0.6;
          p.y -= p.speed * 1.2; // rise upward
          p.x += Math.sin(p.flicker * 0.5) * 0.4;
        }
        if (p.y > canvas.height || p.x < -10 || p.x > canvas.width + 10) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.col + p.alpha + ')';
        if (def.type === 'rain') {
          ctx.strokeStyle = p.col + p.alpha + ')';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.len * Math.sin(p.angle), p.y + p.len * Math.cos(p.angle));
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(function () { animateWeather(canvas, def); });
    }

    function stopWeather() {
      _weatherActive = false;
      var wc = document.getElementById('weather-canvas');
      if (wc) wc.remove();
      _weatherParticles = [];
      stopAmbientSound();
    }

    // ══════════════════════════════════════════════════════════════════
    // SISTEMA DE CLIMA COMO EVENTO VIVO
    // ══════════════════════════════════════════════════════════════════
    var LIVE_WEATHER_EVENTS = [
      { id: 'thunderstorm', name: 'Tempestade Elétrica', icon: '\u26a1', desc: 'Raios rasgam o ceu. Criaturas eletricas emergem das nuvens.', duration: 90000, fogCol: 0x0a0a1a, fogDensity: 0.055, particleCol: 'rgba(180,220,255,', particleType: 'rain', particleCount: 120, battleBoosts: { electric: 1.45, storm: 1.35 }, battlePenalty: { earth: 0.70, nature: 0.75 }, spawnName: 'Falcao Trovao', spawnEl: 'electric', portalBlock: false, passiveEffect: null },
      { id: 'ashrain', name: 'Chuva de Cinzas', icon: '\ud83c\udf0b', desc: 'Cinzas vivas caem do ceu. Os portais ficam instaveis.', duration: 75000, fogCol: 0x1a0a00, fogDensity: 0.065, particleCol: 'rgba(200,120,40,', particleType: 'embers', particleCount: 100, battleBoosts: { fire: 1.40, ashes: 1.35 }, battlePenalty: { water: 0.65 }, spawnName: 'Cinzeiro', spawnEl: 'fire', portalBlock: true, passiveEffect: { type: 'burn_tick', dmg: 1 } },
      { id: 'shadowtide', name: 'Mare de Sombras', icon: '\ud83c\udf11', desc: 'A escuridao engole tudo. Sombras emergem de toda parte.', duration: 80000, fogCol: 0x020208, fogDensity: 0.075, particleCol: 'rgba(80,40,120,', particleType: 'sparks', particleCount: 90, battleBoosts: { dark: 1.50, voidarc: 1.40 }, battlePenalty: { light: 0.60 }, spawnName: 'Veu Sombrio', spawnEl: 'dark', portalBlock: false, passiveEffect: { type: 'forced_night' } },
      { id: 'sacredwind', name: 'Vento Sagrado', icon: '\u2726', desc: 'Uma brisa divina percorre o mundo. A luz caminha livre.', duration: 70000, fogCol: 0x101828, fogDensity: 0.018, particleCol: 'rgba(255,240,160,', particleType: 'sparks', particleCount: 60, battleBoosts: { light: 1.40, aurora: 1.35 }, battlePenalty: { dark: 0.75 }, spawnName: 'Grifo Cinza', spawnEl: 'light', portalBlock: false, passiveEffect: { type: 'heal_tick', hp: 2 } }
    ];
    var _liveWeatherActive = null, _liveWeatherTimer = null, _liveWeatherSpawnedMobs = [], _liveWeatherCooldown = 0, _liveWeatherPassiveTick = null, _liveWeatherCheckCounter = 0;
    function checkLiveWeather() {
      if (_liveWeatherActive || Date.now() < _liveWeatherCooldown) return;
      _liveWeatherCheckCounter++;
      if (_liveWeatherCheckCounter < 8) return;
      _liveWeatherCheckCounter = 0;
      if (Math.random() > 0.30) return;
      var cell = OW.grid && OW.grid[OW.player.x + ',' + OW.player.z], biome = cell ? (cell.biome || 0) : 0;
      var biased = LIVE_WEATHER_EVENTS.filter(function (e) {
        if (biome === 0 || biome === 4) return e.id === 'sacredwind' || e.id === 'thunderstorm';
        if (biome === 1) return e.id === 'shadowtide' || e.id === 'thunderstorm';
        if (biome === 2) return e.id === 'ashrain';
        if (biome === 3) return e.id === 'shadowtide' || e.id === 'ashrain';
        if (biome === 5) return e.id === 'thunderstorm' || e.id === 'ashrain';
        return true;
      });
      var pool = biased.length ? biased : LIVE_WEATHER_EVENTS;
      startLiveWeatherEvent(pool[Math.floor(Math.random() * pool.length)]);
    }
    function startLiveWeatherEvent(ev) {
      _liveWeatherActive = ev;
      showWeatherAnnouncement(ev);
      applyWeatherVisuals(ev, true);
      startEventParticles(ev);
      spawnWeatherMobs(ev);
      startWeatherPassive(ev);
      if (ev.portalBlock) { OW._portalsBlocked = true; notify(ev.icon + ' Portais bloqueados pela ' + ev.name + '!'); }
      OW._liveWeatherBoosts = ev.battleBoosts; OW._liveWeatherPenalty = ev.battlePenalty;
      if (_liveWeatherTimer) clearTimeout(_liveWeatherTimer);
      _liveWeatherTimer = setTimeout(endLiveWeatherEvent, ev.duration);
    }
    function endLiveWeatherEvent() {
      if (!_liveWeatherActive) return;
      var ev = _liveWeatherActive;
      notify(ev.icon + ' ' + ev.name + ' passou. O mundo respira novamente.');
      _liveWeatherActive = null; _liveWeatherCooldown = Date.now() + 120000;
      applyWeatherVisuals(null, false);
      _liveWeatherSpawnedMobs.forEach(function (m) { m._alive = false; if (m.mesh) { try { OW.scene.remove(m.mesh); } catch (e) { } m.mesh = null; } if (m.labelDiv) { try { m.labelDiv.remove(); } catch (e) { } m.labelDiv = null; } });
      _liveWeatherSpawnedMobs = []; OW._portalsBlocked = false; OW._liveWeatherBoosts = null; OW._liveWeatherPenalty = null;
      if (_liveWeatherPassiveTick) { clearInterval(_liveWeatherPassiveTick); _liveWeatherPassiveTick = null; }
      initWeather(); updateWeatherHUD(null);
    }
    function showWeatherAnnouncement(ev) {
      var old = document.getElementById('weather-event-banner'); if (old) old.remove();
      var b = document.createElement('div'); b.id = 'weather-event-banner';
      b.innerHTML = '<div class="wev-icon">' + ev.icon + '</div><div class="wev-text"><div class="wev-name">' + ev.name.toUpperCase() + '</div><div class="wev-desc">' + ev.desc + '</div></div>';
      document.body.appendChild(b);
      setTimeout(function () { if (b.parentNode) { b.style.animation = 'wevFadeOut 0.8s ease forwards'; setTimeout(function () { if (b.parentNode) b.remove(); }, 800); } }, 5000);
      updateWeatherHUD(ev);
    }
    function updateWeatherHUD(ev) {
      var hud = document.getElementById('weather-hud'); if (!hud) return;
      if (!ev) { hud.style.display = 'none'; return; }
      hud.style.display = 'flex'; hud.textContent = ev.icon + ' ' + ev.name;
      var cols = { thunderstorm: '#aabbff', ashrain: '#ffaa66', shadowtide: '#aa88ff', sacredwind: '#ffeebb' };
      hud.style.color = cols[ev.id] || '#ccc';
    }
    function applyWeatherVisuals(ev, isStart) {
      if (!OW.scene) return;
      if (isStart && ev) {
        if (OW.scene.fog) { OW.scene.fog.color.setHex(ev.fogCol); OW.scene.fog.density = ev.fogDensity; }
        if (OW._ambientLight) OW._ambientLight.intensity = ev.id === 'shadowtide' ? 0.08 : ev.id === 'ashrain' ? 0.15 : 0.22;
        if (OW._hemiLight) OW._hemiLight.intensity = ev.id === 'shadowtide' ? 0.05 : 0.20;
      } else { try { updateDayNight(); } catch (e) { } }
    }
    function startEventParticles(ev) {
      stopWeather();
      var owWrap = document.getElementById('ow-wrap'); if (!owWrap) return;
      var wc = document.createElement('canvas'); wc.id = 'weather-canvas';
      wc.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;';
      wc.width = owWrap.offsetWidth || 800; wc.height = owWrap.offsetHeight || 420;
      owWrap.appendChild(wc);
      var fd = { type: ev.particleType, particleCol: ev.particleCol, count: ev.particleCount };
      _weatherParticles = [];
      for (var i = 0; i < ev.particleCount; i++) _weatherParticles.push(makeWeatherParticle(wc, fd));
      _weatherActive = true;
      if (ev.id === 'thunderstorm') scheduleLightningFlash();
      animateWeather(wc, fd);
    }
    function scheduleLightningFlash() {
      if (!_liveWeatherActive || _liveWeatherActive.id !== 'thunderstorm') return;
      setTimeout(function () {
        if (!_liveWeatherActive || _liveWeatherActive.id !== 'thunderstorm') return;
        var fl = document.getElementById('lightning-flash');
        if (!fl) { fl = document.createElement('div'); fl.id = 'lightning-flash'; fl.style.cssText = 'position:fixed;inset:0;background:#8899ff;pointer-events:none;z-index:50;opacity:0;'; document.body.appendChild(fl); }
        fl.style.transition = 'none'; fl.style.opacity = '0.30';
        try { sfx('boss_proximity'); } catch (e) { } notify('\u26a1');
        setTimeout(function () { fl.style.transition = 'opacity 0.4s'; fl.style.opacity = '0'; }, 80);
        if (Math.random() < 0.35) spawnWeatherMobs(_liveWeatherActive, 1);
        scheduleLightningFlash();
      }, 4000 + Math.random() * 8000);
    }
    function spawnWeatherMobs(ev, count) {
      count = count || 2 + Math.floor(Math.random() * 2);
      var def = MOB_DEFS.find(function (d) { return d.name === ev.spawnName; }) || MOB_DEFS.find(function (d) { return d.el === ev.spawnEl; });
      if (!def) return;
      var px = OW.player.x, pz = OW.player.z, planeMult = [1, 1.25, 1.50][G.plane || 0] || 1;
      for (var i = 0; i < count; i++) {
        var angle = Math.random() * Math.PI * 2, dist = 10 + Math.random() * 8;
        var mx = Math.round(px + Math.cos(angle) * dist), mz = Math.round(pz + Math.sin(angle) * dist);
        var cell = OW.grid && OW.grid[mx + ',' + mz]; if (!cell || cell.hn < 0.22) continue;
        var mob = { def: def, x: mx, z: mz, hp: Math.floor(def.hp * planeMult * 1.2), _alive: true, _isWeatherMob: true, state: 'chase', _aggroTimer: 999, _targetX: mx, _targetZ: mz, _spawnH: 0.55, _lastAtkTime: 0, mesh: null, labelDiv: null };
        MAP_MOBS.push(mob); _liveWeatherSpawnedMobs.push(mob);
      }
    }
    function startWeatherPassive(ev) {
      if (!ev.passiveEffect) return;
      if (_liveWeatherPassiveTick) clearInterval(_liveWeatherPassiveTick);
      _liveWeatherPassiveTick = setInterval(function () {
        if (!_liveWeatherActive) { clearInterval(_liveWeatherPassiveTick); return; }
        ensureHero(); var eff = ev.passiveEffect;
        if (eff.type === 'burn_tick') { var c = OW.grid ? OW.grid[OW.player.x + ',' + OW.player.z] : null; var ip = c && (c.special === 'peaceful' || c.special === 'peaceful_zone'); if (!ip && G.hero && G.hero.hp > 1) { G.hero.hp = Math.max(1, G.hero.hp - eff.dmg); renderHeroHUD(); try { spawnDmgNumber(OW.player.x, OW.player.z, eff.dmg, '#ff6600'); } catch (e) { } } }
        else if (eff.type === 'heal_tick') { if (G.hero && G.hero.hp < G.hero.maxHp) { G.hero.hp = Math.min(G.hero.maxHp, G.hero.hp + eff.hp); renderHeroHUD(); } }
        else if (eff.type === 'forced_night') { OW._nightBuff = true; }
      }, 5000);
    }

    // ── AMBIENT AUDIO ──
    var _ambientGain = null;
    var _ambientOscs = [];

    function startAmbientSound(plane) {
      stopAmbientSound();
      var ctx = getAudioCtx();
      if (!ctx) return;

      _ambientGain = ctx.createGain();
      _ambientGain.gain.setValueAtTime(0, ctx.currentTime);
      _ambientGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3);
      _ambientGain.connect(ctx.destination);

      // Plane 0: wind — filtered noise
      // Plane 1: volcanic rumble — low oscillation
      // Plane 2: spectral hum — eerie drone
      if (plane === 0) {
        // Wind: white noise looped through bandpass + gentle LFO modulation
        var bufSize = ctx.sampleRate * 4; // 4s buffer — looped
        var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
        var src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 350; bp.Q.value = 0.4;
        // Volume LFO for gentle gusting effect
        var windLfo = ctx.createOscillator(); windLfo.type = 'sine'; windLfo.frequency.value = 0.08;
        var windLfoGain = ctx.createGain(); windLfoGain.gain.value = 0.025;
        windLfo.connect(windLfoGain); windLfoGain.connect(_ambientGain.gain);
        src.connect(bp); bp.connect(_ambientGain);
        src.start(); windLfo.start();
        _ambientOscs.push(src, windLfo);
      } else if (plane === 1) {
        // Volcanic: two low oscillators + crackle
        [55, 58].forEach(function (freq) {
          var osc = ctx.createOscillator();
          osc.type = 'sawtooth'; osc.frequency.value = freq;
          var g = ctx.createGain(); g.gain.value = 0.4;
          osc.connect(g); g.connect(_ambientGain);
          osc.start(); _ambientOscs.push(osc);
        });
      } else if (plane === 2) {
        // Spectral: eerie sine drone with slow vibrato
        var osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = 80;
        var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.15;
        var lfoGain = ctx.createGain(); lfoGain.gain.value = 8;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        osc.connect(_ambientGain);
        osc.start(); lfo.start();
        _ambientOscs.push(osc, lfo);
      }
    }

    function stopAmbientSound() {
      if (_ambientGain) {
        try {
          _ambientGain.gain.linearRampToValueAtTime(0, _ambientGain.context.currentTime + 1.5);
        } catch (e) { }
      }
      setTimeout(function () {
        _ambientOscs.forEach(function (o) { try { o.stop(); } catch (e) { } });
        _ambientOscs = [];
        _ambientGain = null;
      }, 1600);
    }


    // ============================================================
    // FUSION SYSTEM — combine 2 creatures into 1 stronger hybrid
    // Rules:
    //   - Picks the dominant element (higher ATK creature's element)
    //   - Stats: avg(ATK)*1.25, avg(DEF)*1.15, avg(maxHP)*1.20
    //   - Inherits one passive from each parent (lvl 5 passive)
    //   - Level = avg of both parents
    //   - Shape: dominant parent's shape
    //   - Body: dominant parent's body
    //   - Name: mashup of both names
    //   - Both parents are CONSUMED (removed from team/hall)
    // Costs: 50 souls
    // ============================================================
    var FUSION_COST = 50;
    var _fusionSlots = { a: null, b: null };
    var _fusionPickTarget = null; // 'a' or 'b'


    // ══════════════════════════════════════════════════════════════
    // FUSÃO COM CHEFES — helpers de tier
    // ══════════════════════════════════════════════════════════════
    function getCreatureTier(cr) {
      if (!cr) return 'normal';
      if (cr.isAscended) return 'ascended';
      if (cr.isBossEnemy) return 'boss';
      if (cr.isHybrid) return 'hybrid';
      var tpl = TPLS.find(function (t) { return t.name === (cr.tplName || cr.name); });
      if (tpl && tpl.tier === 'bestial') return 'bestial';
      if (tpl && tpl.tier === 'angelic') return 'angelic';
      return 'normal';
    }
    function canFuseWithBoss(partner) {
      var tier = getCreatureTier(partner);
      return tier === 'bestial' || tier === 'angelic' || tier === 'hybrid';
    }
    function canFuseAtAll(cr) {
      // Ascendidos não podem ser fundidos novamente
      if (!cr) return false;
      if (cr._fusionLocked || cr.isAscended) return false;
      return true;
    }

    function openFusion() {
      _fusionSlots = { a: null, b: null };
      _fusionPickTarget = null;
      renderFusionSlots();
      document.getElementById('fusion-preview').style.display = 'none';
      document.getElementById('fusion-pick-list').style.display = 'none';
      document.getElementById('fusion-go-btn').disabled = true;
      document.getElementById('fusion-sub').textContent = 'Combine duas criaturas para forjar uma entidade mais poderosa. Custo: ' + FUSION_COST + ' almas.';
      var ov = document.getElementById('fusion-ov');
      ov.style.display = 'flex';
    }

    function closeFusion() {
      document.getElementById('fusion-ov').style.display = 'none';
    }

    function fusionSelectSlot(slot) {
      _fusionPickTarget = slot;
      // Build pick list from team + hall, excluding already-selected
      var otherSlot = slot === 'a' ? 'b' : 'a';
      var otherSelected = _fusionSlots[otherSlot];
      var allCreatures = G.team.filter(function (c) { return c && !c.dead; })
        .concat((G.hall || []).filter(function (c) { return c && !c.dead; }));
      // Filter out the other slot's selection
      if (otherSelected) allCreatures = allCreatures.filter(function (c) { return c.id !== otherSelected.id; });

      var listEl = document.getElementById('fusion-pick-list');
      if (!allCreatures.length) {
        listEl.innerHTML = '<div style="color:var(--mu);text-align:center;padding:10px;font-size:.90rem">Nenhuma criatura disponível.</div>';
      } else {
        listEl.innerHTML = allCreatures.map(function (cr) {
          var elData = EL[cr.el] || {};
          return '<div class="fusion-pick-item" onclick="fusionPickCreature(\'' + cr.id + '\')">' +
            '<span class="fusion-pick-name">' + cr.name + ((typeof getCreatureTier === 'function') ? ({ 'ascended': '<span style="font-size:.5rem;color:#ffd700;margin-left:4px;text-shadow:0 0 4px rgba(255,215,0,.5)">☆ ASCENDIDO</span>', 'boss': '<span style="font-size:.5rem;color:#e06040;margin-left:4px">⚔ CHEFE</span>', 'bestial': '<span style="font-size:.5rem;color:#e08040;margin-left:4px">🐾 BESTIAL</span>', 'angelic': '<span style="font-size:.5rem;color:#c8dcff;margin-left:4px">⭐ ANGELICAL</span>', 'hybrid': '<span style="font-size:.5rem;color:#ffcc44;margin-left:4px">✦ HÍBRIDA</span>' }[getCreatureTier(cr)] || '') : '') + ' <span style="color:var(--mu);font-size:.6rem">Nv.' + cr.level + '</span></span>' +
            '<span class="fusion-pick-stats"><span style="color:' + (elData.hex || '#888') + '">' + (elData.name || cr.el) + '</span> · ATK ' + cr.atk + ' DEF ' + cr.def + '</span>' +
            '</div>';
        }).join('');
      }
      listEl.style.display = 'flex';
    }

    function fusionPickCreature(id) {
      var allCreatures = G.team.filter(function (c) { return c && !c.dead; })
        .concat((G.hall || []).filter(function (c) { return c && !c.dead; }));
      var cr = allCreatures.find(function (c) { return c.id === id; });
      if (!cr) return;
      _fusionSlots[_fusionPickTarget] = cr;
      document.getElementById('fusion-pick-list').style.display = 'none';
      _fusionPickTarget = null;
      renderFusionSlots();
      updateFusionPreview();
    }

    function renderFusionSlots() {
      ['a', 'b'].forEach(function (s) {
        var slot = document.getElementById('fslot-' + s);
        var inner = document.getElementById('fslot-' + s + '-inner');
        var cr = _fusionSlots[s];
        if (cr) {
          var elData = EL[cr.el] || {};
          inner.innerHTML =
            '<div class="fusion-slot-icon" style="color:' + (elData.hex || '#888') + '">⬡</div>' +
            '<div class="fusion-slot-name">' + cr.name + '</div>' +
            '<div class="fusion-slot-el eb el-' + cr.el + '">' + (elData.name || cr.el) + '</div>' +
            '<div class="fusion-slot-hp">Nv.' + cr.level + ' · HP ' + cr.hp + '/' + cr.maxHp + '</div>';
          slot.className = 'fusion-slot filled';
        } else {
          inner.innerHTML = '<div class="fusion-slot-icon">?</div><div class="fusion-slot-name">Selecionar</div>';
          slot.className = 'fusion-slot';
        }
      });
      var canFuse = _fusionSlots.a && _fusionSlots.b && G.souls >= FUSION_COST;
      if (canFuse && typeof getCreatureTier === 'function') {
        var _tA = getCreatureTier(_fusionSlots.a), _tB = getCreatureTier(_fusionSlots.b);
        if (_tA === 'ascended' || _tB === 'ascended') canFuse = false;
        if (_tA === 'boss' && _tB === 'boss') canFuse = false;
        if (_tA === 'boss' && !canFuseWithBoss(_fusionSlots.b)) canFuse = false;
        if (_tB === 'boss' && !canFuseWithBoss(_fusionSlots.a)) canFuse = false;
      }
      document.getElementById('fusion-go-btn').disabled = !canFuse;
      if (_fusionSlots.a && _fusionSlots.b && G.souls < FUSION_COST) {
        document.getElementById('fusion-sub').textContent = '⚠ Almas insuficientes! Você precisa de ' + FUSION_COST + ' almas.';
      } else {
        document.getElementById('fusion-sub').textContent = 'Combine duas criaturas. Custo: ' + FUSION_COST + ' almas. Saldo: ' + G.souls + ' almas.';
      }
    }

    function calcFusionResult(a, b) {
      // ── Detectar tiers dos pais ──
      var tierA = (typeof getCreatureTier === 'function') ? getCreatureTier(a) : 'normal';
      var tierB = (typeof getCreatureTier === 'function') ? getCreatureTier(b) : 'normal';
      var hasBoss = tierA === 'boss' || tierB === 'boss';
      var hasSpecial = tierA !== 'normal' || tierB !== 'normal';
      var isAscended = hasBoss && (tierA !== 'normal' || tierB !== 'normal');

      // ── FUSÃO ASCENDIDA (Chefe × Especial) ──
      if (isAscended) {
        var boss = (tierA === 'boss') ? a : b;
        var partner = (tierA === 'boss') ? b : a;
        var avgLvl = Math.max(1, Math.round((a.level + b.level) / 2));
        // Stats com bônus extra (+40% atk, +30% def, +35% hp)
        var newAtk = Math.round((a.atk + b.atk) / 2 * 1.40);
        var newDef = Math.round((a.def + b.def) / 2 * 1.30);
        var newMaxHp = Math.round((a.maxHp + b.maxHp) / 2 * 1.35);
        // Nome baseado no chefe + sufixo do parceiro
        var bossRoot = boss.name;
        var partnerRoot = partner.name.slice(0, Math.ceil(partner.name.length / 3));
        var newName = bossRoot + ' ' + partnerRoot.charAt(0).toUpperCase() + partnerRoot.slice(1);
        // Elemento do chefe mantido
        var newEl = boss.el;
        var elData = EL[newEl] || {};
        // Passivos de ambos
        var passives = [];
        var domTpl = TPLS.find(function (t) { return t.name === (boss.tplName || boss.name); });
        var subTpl = TPLS.find(function (t) { return t.name === (partner.tplName || partner.name); });
        if (domTpl && domTpl.passives && domTpl.passives[0]) passives.push(domTpl.passives[0]);
        if (subTpl && subTpl.passives && subTpl.passives[0] &&
          !passives.some(function (p) { return p.id === subTpl.passives[0].id; })) {
          passives.push(subTpl.passives[0]);
        }
        // Cor especial — dourado+elemento do chefe
        var bossCol = EL[boss.el] ? EL[boss.el].col : 0xffffff;
        var goldTint = 0xd4a017;
        var blendCol = (((Math.round(((bossCol >> 16) & 0xff) * 0.7 + ((goldTint >> 16) & 0xff) * 0.3)) << 16) |
          ((Math.round(((bossCol >> 8) & 0xff) * 0.7 + ((goldTint >> 8) & 0xff) * 0.3)) << 8) |
          (Math.round((bossCol & 0xff) * 0.7 + (goldTint & 0xff) * 0.3)));
        // Ult do chefe como habilidade herdada fixa
        var bossCards = CARDS[boss.el] || CARDS.fire;
        var inheritedUlt = (boss._battleHand && boss._battleHand.u) || bossCards.u;
        return {
          name: newName,
          el: newEl,
          shape: boss.shape || 'round',
          body: boss.body || null,
          tplName: boss.tplName || boss.name,
          level: avgLvl,
          atk: newAtk,
          def: newDef,
          maxHp: newMaxHp,
          hp: newMaxHp,
          dead: false,
          evolved: false,
          xp: 0,
          xpNext: Math.floor(50 + avgLvl * 25),
          ultCD: 0,
          _passives: passives,
          _hybridEl: null,
          _blendCol: blendCol,
          _parentEls: [boss.el, partner.el],
          _inheritedCard: inheritedUlt,  // ult do chefe como habilidade herdada
          isHybrid: true,                // tem habilidade herdada
          isBossEnemy: false,            // resultado não é chefe — é ascendido
          isAscended: true,              // tier especial novo
          _fusionLocked: true,           // não pode fundir de novo
          id: Math.random().toString(36).slice(2, 9)
        };
      }


      // Check for known hybrid element combo
      var hybridEl = (typeof getFusionElement === 'function') ? getFusionElement(a.el, b.el) : null;
      // Dominant = higher ATK parent
      var dom = (a.atk >= b.atk) ? a : b;
      var sub = (a.atk >= b.atk) ? b : a;
      var avgLvl = Math.max(1, Math.round((a.level + b.level) / 2));
      var newAtk = Math.round((a.atk + b.atk) / 2 * 1.25);
      var newDef = Math.round((a.def + b.def) / 2 * 1.15);
      var newMaxHp = Math.round((a.maxHp + b.maxHp) / 2 * 1.20);
      // Name — if hybrid combo known, use hybrid element name as basis; else mashup
      var newEl = hybridEl || dom.el;
      var elData = EL[newEl] || {};
      var newName;
      if (hybridEl) {
        // Build name from hybrid element concept + dom creature root
        var domRoot = dom.name.slice(0, Math.ceil(dom.name.length / 2));
        var subRoot = sub.name.slice(Math.floor(sub.name.length / 2));
        newName = domRoot + subRoot;
      } else {
        var nameA = dom.name, nameB = sub.name;
        newName = nameA.slice(0, Math.ceil(nameA.length / 2)) + nameB.slice(Math.floor(nameB.length / 2));
      }
      // Inherit passives: one from each parent (first passive each)
      var passives = [];
      var domTpl = TPLS.find(function (t) { return t.name === dom.tplName || t.name === dom.name; });
      var subTpl = TPLS.find(function (t) { return t.name === sub.tplName || t.name === sub.name; });
      if (domTpl && domTpl.passives && domTpl.passives[0]) passives.push(domTpl.passives[0]);
      if (subTpl && subTpl.passives && subTpl.passives[0] &&
        !passives.some(function (p) { return p.id === subTpl.passives[0].id; })) passives.push(subTpl.passives[0]);
      // Color: interpolate between two parent element colors for 3D model
      var colA = EL[dom.el] ? EL[dom.el].col : 0xffffff;
      var colB = EL[sub.el] ? EL[sub.el].col : 0xaaaaaa;
      var blendCol = hybridEl ? (EL[hybridEl].col || colA) :
        (((Math.round(((colA >> 16) & 0xff) * 0.6 + ((colB >> 16) & 0xff) * 0.4)) << 16) |
          ((Math.round(((colA >> 8) & 0xff) * 0.6 + ((colB >> 8) & 0xff) * 0.4)) << 8) |
          (Math.round((colA & 0xff) * 0.6 + (colB & 0xff) * 0.4)));
      return {
        name: newName,
        el: newEl,
        shape: dom.shape || 'round',
        body: dom.body || null,
        tplName: dom.tplName || dom.name,
        level: avgLvl,
        atk: newAtk,
        def: newDef,
        maxHp: newMaxHp,
        hp: newMaxHp,
        dead: false,
        evolved: false,
        xp: 0,
        xpNext: Math.floor(30 + avgLvl * 18),
        ultCD: 0,
        _passives: passives,
        _hybridEl: hybridEl,      // remember hybrid origin
        _blendCol: blendCol,      // interpolated color for 3D model
        _parentEls: [dom.el, sub.el],
        isHybrid: !!hybridEl,
        id: Math.random().toString(36).slice(2, 9)
      };
    }

    function updateFusionPreview() {
      var a = _fusionSlots.a, b = _fusionSlots.b;
      if (!a || !b) { document.getElementById('fusion-preview').style.display = 'none'; return; }
      var result = calcFusionResult(a, b);
      var elData = EL[result.el] || {};
      var passiveNames = (result._passives || []).map(function (p) { return p.name; }).join(', ') || 'Nenhuma';
      var isKnownHybrid = !!result._hybridEl;
      var hybridBadge = result.isAscended ?
        '<span style="color:#ffd700;font-size:.6rem;font-family:Cinzel,serif;letter-spacing:.1em;text-shadow:0 0 8px rgba(255,215,0,.5)"> ☆ ASCENDIDO</span>' :
        (isKnownHybrid ? '<span style="color:#ffcc44;font-size:.6rem;font-family:Cinzel,serif;letter-spacing:.1em"> ✦ ELEMENTO HÍBRIDO</span>' : '');
      // Mostrar habilidade herdada do chefe no preview se for Ascendido
      var ascendedInheritedInfo = result.isAscended && result._inheritedCard ?
        '<div style="font-size:.6rem;color:#ffd700;margin-top:4px;font-family:Cinzel,serif">⚔ Habilidade Herdada: ' + result._inheritedCard.n + '</div>' : '';
      var hybridPassiveNames = isKnownHybrid && typeof HYBRID_PASSIVES !== 'undefined' && HYBRID_PASSIVES[result._hybridEl]
        ? HYBRID_PASSIVES[result._hybridEl].map(function (p) { return p.name; }).join(', ')
        : '';
      document.getElementById('fusion-preview-body').innerHTML =
        '<b style="color:' + (elData.hex || '#fff') + ';font-family:Cinzel,serif;font-size:1.15rem">' + result.name + '</b>' +
        ' <span class="eb el-' + result.el + '" style="font-size:.90rem">' + (elData.name || result.el) + '</span>' +
        hybridBadge +
        '<br>Nível <span class="fusion-preview-stat">' + result.level + '</span> &nbsp;' +
        'ATK <span class="fusion-preview-stat">' + result.atk + '</span> &nbsp;' +
        'DEF <span class="fusion-preview-stat">' + result.def + '</span> &nbsp;' +
        'HP <span class="fusion-preview-stat">' + result.maxHp + '</span>' +
        '<br><span style="color:var(--mu);font-size:.87rem">Passivos herdados: </span>' +
        '<span style="color:#bb66ff;font-size:.87rem">' + passiveNames + '</span>' +
        (hybridPassiveNames ? '<br><span style="color:#ffcc44;font-size:.87rem">✦ Passivos híbridos: ' + hybridPassiveNames + '</span>' : '');
      // Adicionar info de habilidade herdada do chefe (fusão Ascendida)
      if (result.isAscended && result._inheritedCard) {
        document.getElementById('fusion-preview-body').innerHTML +=
          '<div style="font-size:1.02rem;color:#ffd700;margin-top:6px;font-family:Cinzel,serif">⚔ Habilidade Herdada: ' + result._inheritedCard.n + '</div>';
      }
      document.getElementById('fusion-preview').style.display = 'block';
    }

    function executeFusion() {
      var a = _fusionSlots.a, b = _fusionSlots.b;
      if (!a || !b) return;

      // Regras de fusão especial
      var tierA = (typeof getCreatureTier === 'function') ? getCreatureTier(a) : 'normal';
      var tierB = (typeof getCreatureTier === 'function') ? getCreatureTier(b) : 'normal';
      // Ascendidos são terminais — não podem fundir
      if (tierA === 'ascended') { notify('☆ ' + a.name + ' é Ascendido — não pode ser fundido!', 'info'); return; }
      if (tierB === 'ascended') { notify('☆ ' + b.name + ' é Ascendido — não pode ser fundido!', 'info'); return; }
      // Dois chefes não podem fundir entre si
      if (tierA === 'boss' && tierB === 'boss') { notify('⚔ Dois Chefes não podem fundir entre si!'); return; }
      // Chefe só funde com especial
      if (tierA === 'boss' && !(typeof canFuseWithBoss === 'function' && canFuseWithBoss(b))) {
        notify('⚔ Chefes só podem fundir com Bestiais, Angelicais ou Híbridos!'); return;
      }
      if (tierB === 'boss' && !(typeof canFuseWithBoss === 'function' && canFuseWithBoss(a))) {
        notify('⚔ Chefes só podem fundir com Bestiais, Angelicais ou Híbridos!'); return;
      }

      var _effFusionCost = FUSION_COST;
      if (G._fusionDiscount) { _effFusionCost = Math.floor(FUSION_COST * (1 - G._fusionDiscount)); G._fusionDiscount = 0; }
      if (G.souls < _effFusionCost) { notify('Almas insuficientes!'); return; }

      G.souls -= _effFusionCost;
      var result = calcFusionResult(a, b);

      // Remove both parents from team and hall
      G.team = G.team.filter(function (c) { return c && c.id !== a.id && c.id !== b.id; });
      G.hall = (G.hall || []).filter(function (c) { return c && c.id !== a.id && c.id !== b.id; });

      // Add result to team if space, else hall
      if (G.team.filter(function (c) { return c && !c.dead; }).length < 3) {
        G.team.push(result);
      } else {
        G.hall.push(result);
      }
      G.activeIdx = G.team.findIndex(function (c) { return c && !c.dead; });
      if (G.activeIdx < 0) G.activeIdx = 0;

      // Record in bestiary
      bestiaryRecord(result.name, 'captured');

      // Visual flash
      var ov = document.getElementById('fusion-ov');
      ov.classList.add('fusion-flash');
      setTimeout(function () { ov.classList.remove('fusion-flash'); }, 1200);

      saveGame();
      renderHeroHUD();
      notify('✦ ' + a.name + ' + ' + b.name + ' = ' + result.name + '! Fusão completa!');

      setTimeout(function () {
        closeFusion();
      }, 1400);
    }

    //initGame();

    if (typeof TPLS !== 'undefined' && TPLS.length > 0) {
      initGame();
    } else {
      window._pendingInit = true;
    }


    // ============================================================
    // HERO SYSTEM — stats, weapons, map combat
    // ============================================================


    function heroXpNext(lvl) { return Math.floor(30 + lvl * 18); }

    function makeHero(weapon) {
      var wp = weapon || 'sword';
      return {
        hp: 40, maxHp: 40,
        atk: WEAPONS[wp].atk,
        def: 4,
        level: 1,
        xp: 0, xpNext: heroXpNext(1),
        weapon: wp,
        passives: [],   // unlocked passive IDs
        items: [],       // inventário pessoal do herói
        _atkCd: 0,      // timestamp of last attack
        _firstBlood: true,
        _marked: false
      };
    }

    function heroUnlockedPassives() {
      if (!G.hero) return [];
      var wp = WEAPONS[G.hero.weapon];
      if (!wp || !wp.passives) return [];
      return wp.passives.filter(function (p) { return G.hero.level >= p.lvl; });
    }

    function heroHasPassive(id) {
      var up = heroUnlockedPassives();
      return up.some(function (p) { return p.id === id; });
    }

    function ensureHero() {
      if (!G.hero) G.hero = makeHero('sword');
    }

    function heroLevelUp() {
      G.hero.level++;
      var gain = Math.floor(8 + G.hero.level * 3);
      G.hero.maxHp += gain;
      G.hero.hp = Math.min(G.hero.maxHp, G.hero.hp + Math.floor(gain * 0.6));
      G.hero.atk = Math.floor(WEAPONS[G.hero.weapon].atk * (1 + (G.hero.level - 1) * 0.12));
      // Check for new class passive unlocks
      var wp = WEAPONS[G.hero.weapon];
      if (wp && wp.passives) {
        wp.passives.forEach(function (p) {
          if (G.hero.level === p.lvl) {
            addLog('✦ Herói desbloqueou: ' + p.name + '!', 'evt');
            notify('🌟 Nova passiva: ' + p.name);
          }
        });
      }
      G.hero.def = Math.floor(4 * (1 + (G.hero.level - 1) * 0.10));
      G.hero.xpNext = heroXpNext(G.hero.level);
      renderHeroHUD();
      sfx('hero_level_up');
      notify('★ ' + G.playerName + ' subiu para Nv.' + G.hero.level + '!');
    }

    function heroGainXP(amount) {
      ensureHero();
      // Hero XP is 35% of normal to keep hero below creature levels
      var gain = Math.max(1, Math.floor(amount * 0.35));
      G.hero.xp += gain;
      while (G.hero.xp >= G.hero.xpNext) {
        G.hero.xp -= G.hero.xpNext;
        heroLevelUp();
      }
      renderHeroHUD();
    }



    // ══════════════════════════════════════════════════════
    // VIVEIRO DAS ALMAS — Œuf Maudit (egg) system
    // ══════════════════════════════════════════════════════

    var EUF_HATCH_BATTLES = { common: 3, rare: 5, legendary: 8 };

    function addEufMaudit(el, rarity) {
      rarity = rarity || 'common';
      if (!G.viveiro) G.viveiro = [];
      // Max 4 eggs total (2 incubating + 2 waiting)
      if (G.viveiro.length >= 4) { notify('Viveiro cheio! Libere espaço primeiro.'); return; }
      var egg = {
        id: Math.random().toString(36).slice(2, 8),
        el: el,
        rarity: rarity,
        battlesLeft: EUF_HATCH_BATTLES[rarity] || 3,
        incubating: false
      };
      G.viveiro.push(egg);
      notify('🥚 Œuf Maudit adicionado ao Viveiro das Almas.');
      if (document.getElementById('viveiro-ov').style.display !== 'none') renderViveiro();
      saveGame();
    }

    function startIncubating(eggId) {
      if (!G.viveiro) return;
      var incubating = G.viveiro.filter(function (e) { return e.incubating; });
      if (incubating.length >= 2) { notify('Apenas 2 œufs podem incubar ao mesmo tempo.'); return; }
      var egg = G.viveiro.find(function (e) { return e.id === eggId; });
      if (!egg) return;
      egg.incubating = true;
      notify('✦ Œuf colocado para incubar. ' + egg.battlesLeft + ' batalhas restantes.');
      renderViveiro();
      saveGame();
    }

    function tickEggIncubation() {
      // Called after every battle win — decrement incubating eggs
      if (!G.viveiro) return;
      var hatched = [];
      G.viveiro.forEach(function (egg) {
        if (!egg.incubating) return;
        egg.battlesLeft = Math.max(0, egg.battlesLeft - 1);
        if (egg.battlesLeft <= 0) hatched.push(egg);
      });
      hatched.forEach(function (egg) {
        G.viveiro = G.viveiro.filter(function (e) { return e.id !== egg.id; });
        hatchEuf(egg);
      });
      if (hatched.length === 0 && G.viveiro.some(function (e) { return e.incubating; })) {
        var remaining = G.viveiro.filter(function (e) { return e.incubating; }).map(function (e) { return e.battlesLeft; });
        addLog('[Viveiro] Incubação em progresso. Batalhas restantes: ' + remaining.join(', '), 'sys');
      }
    }

    function hatchEuf(egg) {
      // Pick random creature template of the egg's element
      var pool = TPLS.filter(function (t) { return t.el === egg.el; });
      if (!pool.length) pool = TPLS;
      var tpl = pool[Math.floor(Math.random() * pool.length)];
      var lvl = egg.rarity === 'legendary' ? 8 : egg.rarity === 'rare' ? 5 : 3;
      var newC = mkC(tpl, lvl);
      newC._fromEgg = true;
      if (G.team.filter(function (c) { return c && !c.dead; }).length < 3 && G.team.length < 3) {
        G.team.push(newC);
        notify('🐣 ' + newC.name + ' nasceu e entrou no grupo! (' + egg.rarity + ')');
      } else {
        G.hall.push(newC);
        notify('🐣 ' + newC.name + ' nasceu e foi para o Hall! (' + egg.rarity + ')');
      }
      renderExpC();
      saveGame();
    }

    // Emergency hatch — triggers on first battle with no living creatures
    function emergencyHatch(aIdx) {
      if (!G.viveiro || !G.viveiro.length) return false;
      var egg = G.viveiro[0]; // hatch the first available egg
      G.viveiro = G.viveiro.slice(1);
      var pool = TPLS.filter(function (t) { return t.el === egg.el; });
      if (!pool.length) pool = TPLS;
      var tpl = pool[Math.floor(Math.random() * pool.length)];
      var newC = mkC(tpl, 2);
      newC._fromEgg = true;
      G.team = G.team.filter(function (c) { return c !== null; });
      G.team.push(newC);
      G.activeIdx = G.team.findIndex(function (c) { return c && !c.dead; });
      addLog('🐣 NASCIMENTO DE URGÊNCIA! ' + newC.name + ' eclodiu para entrar em batalha!', 'evt');
      notify('🐣 ' + newC.name + ' nasceu em urgência!');
      renderExpC();
      saveGame();
      return true;
    }

    function openViveiro() {

      OW._eventPaused = true; if (!G.viveiro) G.viveiro = [];
      renderViveiro();
      var ov = document.getElementById('viveiro-ov');
      ov.style.display = 'flex';
    }

    function closeViveiro() {

      OW._eventPaused = false; document.getElementById('viveiro-ov').style.display = 'none';
    }

    function renderViveiro() {
      if (!G.viveiro) G.viveiro = [];
      var rarityColors = { common: '#aaa', rare: '#c9933a', legendary: '#cc66ff' };
      var rarityLabel = { common: 'Comum', rare: 'Raro', legendary: 'Lendário' };
      var elIcons = { fire: '🔥', water: '💧', earth: '🌿', dark: '☽', light: '✦', nature: '🌱', electric: '⚡' };

      var incubating = G.viveiro.filter(function (e) { return e.incubating; });
      var waiting = G.viveiro.filter(function (e) { return !e.incubating; });

      var html = '';

      // Incubating slots (max 2)
      html += '<div class="viv-section-lbl">Incubando (' + incubating.length + '/2)</div>';
      html += '<div class="viv-slots">';
      for (var i = 0; i < 2; i++) {
        var egg = incubating[i];
        if (egg) {
          var col = rarityColors[egg.rarity] || '#aaa';
          html += '<div class="viv-egg incubating" style="border-color:' + col + '">';
          html += '<div class="viv-egg-icon">🥚</div>';
          html += '<div class="viv-egg-el" style="color:' + col + '">' + (elIcons[egg.el] || '') + ' ' + (EL[egg.el] ? EL[egg.el].name : egg.el) + '</div>';
          html += '<div class="viv-egg-rar" style="color:' + col + '">' + rarityLabel[egg.rarity] + '</div>';
          html += '<div class="viv-egg-cd">' + egg.battlesLeft + ' batalhas</div>';
          html += '</div>';
        } else {
          html += '<div class="viv-egg viv-empty"><div style="opacity:.3">— vazio —</div></div>';
        }
      }
      html += '</div>';

      // Waiting eggs
      html += '<div class="viv-section-lbl" style="margin-top:14px">Aguardando (' + waiting.length + ')</div>';
      if (!waiting.length) {
        html += '<div style="color:#555;font-size:.90rem;text-align:center;padding:8px">Nenhum œuf esperando.</div>';
      } else {
        html += '<div class="viv-slots">';
        waiting.forEach(function (egg) {
          var col = rarityColors[egg.rarity] || '#aaa';
          html += '<div class="viv-egg waiting" style="border-color:' + col + ';cursor:pointer" onclick="startIncubating(\'' + egg.id + '\')">';
          html += '<div class="viv-egg-icon">🥚</div>';
          html += '<div class="viv-egg-el" style="color:' + col + '">' + (elIcons[egg.el] || '') + ' ' + (EL[egg.el] ? EL[egg.el].name : egg.el) + '</div>';
          html += '<div class="viv-egg-rar" style="color:' + col + '">' + rarityLabel[egg.rarity] + '</div>';
          html += '<div class="viv-egg-cd">' + egg.battlesLeft + ' batalhas para nascer</div>';
          html += '<div style="font-size:.80rem;color:#888;margin-top:4px">Clique para incubar</div>';
          html += '</div>';
        });
        html += '</div>';
      }

      document.getElementById('viveiro-grid').innerHTML = html;
    }


    // ══════════════════════════════════════════════════
    // AREA EVOLUTION — triggered after boss defeat
    // Biome tiles shift tone, new mob variants appear,
    // a special post-boss vendor spawns in the area
    // ══════════════════════════════════════════════════

    // Evolved biome colors (brighter, more saturated — the area "awakened")
    var BIOMES_EVOLVED = [
      { top: 0x5abe72, side: 0x3d9455, enc: 0.65 }, // plains  → vivid green
      { top: 0x267840, side: 0x1a5428, enc: 0.80 }, // forest  → deep emerald
      { top: 0x8c4018, side: 0x621c06, enc: 0.55 }, // volcanic→ deeper ember
      { top: 0x1e2030, side: 0x12141e, enc: 0.70 }, // void    → abyssal
      { top: 0x284f34, side: 0x1c3a24, enc: 0.75 }, // swamp   → denser
      { top: 0x5a6070, side: 0x40484e, enc: 0.60 }, // thunder → stormcloud
    ];

    // Evolved mob stat multipliers on top of base
    var AREA_EVOLVED_MOB_MULT = 1.35;

    function isAreaEvolved(aIdx) {
      return !!(G.bossDefeated && G.bossDefeated[aIdx]);
    }

    function getEvolvedBiome(biomeIdx) {
      return BIOMES_EVOLVED[biomeIdx] || BIOMES[biomeIdx];
    }

    function onBossDefeated(aIdx) {
      // Triggers area evolution visuals
      OW._miniDirty = true;
      notify('✦ ' + AREAS[aIdx].name + ' desperta. O bioma foi transformado.');
      setTimeout(function () {
        if (OW.chunkGroup && OW.scene) { OW.scene.remove(OW.chunkGroup); OW.chunkGroup = null; }
        buildTiles();
      }, 800);
      // Spawn boss_vendor tile adjacent to the boss lair
      setTimeout(function () {
        var bossPos = null;
        if (OW.grid) {
          Object.keys(OW.grid).forEach(function (k) {
            var cell = OW.grid[k]; if (cell && cell.special === 'bosslair' && cell.aIdx === aIdx) bossPos = k;
          });
        }
        if (bossPos) {
          var parts = bossPos.split(',');
          var bx = parseInt(parts[0]), bz = parseInt(parts[1]);
          var vendorKey = (bx + 2) + ',' + (bz + 2);
          if (OW.grid[vendorKey]) {
            OW.grid[vendorKey].special = 'boss_vendor';
            OW.grid[vendorKey].aIdx = aIdx;
            OW._miniDirty = true;
            buildTiles();
            notify('🏪 Um novo mercador surgiu nas ruínas — ' + AREAS[aIdx].name);
          }
        }
      }, 2000);
    }
    // ══════════════════════════════════════════════════
    // STATUS SCREEN — opens on U key
    // ══════════════════════════════════════════════════
    var _statusActiveTab = 0;

    function switchStatusTab(n) {
      _statusActiveTab = n;
      for (var i = 0; i <= 5; i++) {
        var p = document.getElementById('st-panel-' + i);
        if (p) p.style.display = i === n ? 'block' : 'none';
      }
      var tabPanelMap = [0, 1, 2, 4, 3, 5];
      var tabs = document.querySelectorAll('.st-tab');
      tabs.forEach(function (t, i) { t.classList.toggle('st-tab-active', tabPanelMap[i] === n); });
      if (n === 3) renderHeritagePanel();
      if (n === 4) renderStatusScreen();
      if (n === 5) { renderHeroBag(); updateHeroBagBadge(); }
    }

    function openStatusScreen() {
      _statusActiveTab = 0;
      switchStatusTab(0);
      renderStatusScreen();
      document.getElementById('status-ov').style.display = 'flex';
    }

    function renderHeritagePanel() {
      var meta = loadMeta();
      var runs = meta.runs || [];
      var elIcons = {
        fire: '🔥', water: '💧', earth: '🌿', dark: '☽', light: '✦', nature: '🌱', electric: '⚡',
        vapor: '💨', ashes: '🔥', storm: '⚡', magnet: '⚙', twilight: '🌙', ancient: '🌲', voidarc: '💜', aurora: '🌊'
      };
      var html = '<div class="ss-heritage">';

      // ── Efeitos ativos ──
      html += '<div class="ss-h-section">Efeitos Ativos nesta Run</div>';
      var hasEffects = false;
      if (OW._suppressedEl) {
        html += '<div class="ss-h-effect ss-h-bad">' + (elIcons[OW._suppressedEl] || '●') + ' Elemento <b>' + OW._suppressedEl + '</b> suprimido — 60% menos mobs desta espécie</div>';
        hasEffects = true;
      }
      if (OW._scarceArea !== undefined && OW._scarceArea !== null && AREAS[OW._scarceArea]) {
        html += '<div class="ss-h-effect ss-h-bad">💀 <b>' + AREAS[OW._scarceArea].name + '</b> dizimada — 50% menos spawns nessa área</div>';
        hasEffects = true;
      }
      if (OW._memoryBosses > 0) {
        html += '<div class="ss-h-effect ss-h-neut">⚔ ' + OW._memoryBosses + ' chefe(s) de runs passadas deixaram marcas</div>';
        hasEffects = true;
      }
      if (!hasEffects) {
        html += '<div class="ss-h-effect ss-h-ok">✓ Nenhuma herança ativa — mundo limpo</div>';
      }

      // ── Controles ──
      html += '<div class="ss-h-section" style="margin-top:14px">Controle da Herança</div>';
      html += '<div class="ss-h-ctrl">';
      html += '<span style="font-size:.6rem;color:#665544">Próxima run: Herança <b style="color:' + (_metaEnabled ? '#6a9e5a' : '#a44') + '">' + (_metaEnabled ? 'ATIVA' : 'DESATIVADA') + '</b></span>';
      html += '<button class="ss-h-btn" onclick="resetMetamorphosis();renderHeritagePanel()">🗑 Resetar</button>';
      html += '</div>';

      // ── Histórico de runs ──
      html += '<div class="ss-h-section" style="margin-top:14px">Histórico (' + runs.length + ' runs)</div>';
      if (!runs.length) {
        html += '<div style="font-size:.6rem;color:#443;font-style:italic;padding:8px 0">Nenhuma run registrada ainda.</div>';
      } else {
        runs.slice(-5).reverse().forEach(function (r, i) {
          var totalK = r.totalKills || 0;
          var bosses = r.bossesDefeated || 0;
          var souls = r.runSouls || 0;
          html += '<div class="ss-h-run">' +
            '<div class="ss-h-run-top">' +
            '<span class="ss-h-run-name">' + (r.playerName || '?') + '</span>' +
            (i === 0 ? '<span style="color:#c9933a;font-size:.98rem">última run</span>' : '') +
            '</div>' +
            '<div class="ss-h-run-stats">' +
            (r.dominantEl ? (elIcons[r.dominantEl] || '') + ' ' + r.dominantEl + '  ·  ' : '') +
            totalK + ' abates  ·  ' +
            bosses + ' chefes  ·  ' +
            souls + ' ☽' +
            '</div>' +
            '</div>';
        });
      }

      html += '</div>';
      var panel = document.getElementById('st-heritage-panel');
      if (panel) panel.innerHTML = html;
    }
    function closeStatusScreen() {
      document.getElementById('status-ov').style.display = 'none';
    }

    function renderStatusScreen() {
      var h = G.hero;
      var wp = WEAPONS[h.weapon] || WEAPONS.sword;
      var hpPct = Math.round(h.hp / h.maxHp * 100);
      var xpPct = h.xpNext > 0 ? Math.round(h.xp / h.xpNext * 100) : 0;
      var relic = getEquippedRelic();
      var totalWins = (G.areaWins || []).reduce(function (s, v) { return s + v; }, 0);
      var totalKills = (G.areaKills || []).reduce(function (s, v) { return s + v; }, 0);
      var totalBoss = (G.bossDefeated || []).filter(Boolean).length;

      // ── HERO panel ──
      var heroHtml =
        '<div class="st-hero-name">' + wp.icon + ' ' + (G.playerName || 'Caçador') + '</div>' +
        '<div class="st-hero-class">Nv.' + h.level + ' · ' + wp.name + '</div>' +
        '<div class="st-bars">' +
        '<div class="st-bar-row"><span>HP</span>' +
        '<div class="st-bar-w"><div class="st-bar-hp" style="width:' + hpPct + '%"></div></div>' +
        '<span>' + h.hp + '/' + h.maxHp + '</span></div>' +
        '<div class="st-bar-row"><span>XP</span>' +
        '<div class="st-bar-w"><div class="st-bar-xp" style="width:' + xpPct + '%"></div></div>' +
        '<span>' + h.xp + '/' + h.xpNext + '</span></div>' +
        '</div>' +
        '<div class="st-stats-grid">' +
        '<div class="st-stat"><span class="st-stat-lbl">ATQ</span><span class="st-stat-val">' + h.atk + '</span></div>' +
        '<div class="st-stat"><span class="st-stat-lbl">DEF</span><span class="st-stat-val">' + h.def + '</span></div>' +
        '<div class="st-stat"><span class="st-stat-lbl">Almas</span><span class="st-stat-val">' + G.souls + '</span></div>' +
        '<div class="st-stat"><span class="st-stat-lbl">Vitórias</span><span class="st-stat-val">' + totalWins + '</span></div>' +
        '<div class="st-stat"><span class="st-stat-lbl">Abates</span><span class="st-stat-val">' + totalKills + '</span></div>' +
        '<div class="st-stat"><span class="st-stat-lbl">Chefes</span><span class="st-stat-val">' + totalBoss + '/6</span></div>' +
        '</div>' +
        (relic ? '<div class="st-relic-row">' + relic.icon + ' <span style="color:#c9933a">' + relic.name + '</span> <span style="color:#666;font-size:.6rem">— ' + relic.desc + '</span></div>' : '<div class="st-relic-row" style="color:#444">Nenhuma relíquia equipada</div>');

      // ── Hero class passives section ──
      heroHtml += '<div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.07);padding-top:10px">' +
        '<div style="font-size:1.1rem;letter-spacing:.14em;color:#556;margin-bottom:8px">HABILIDADES PASSIVAS</div>';
      var allPassives = wp.passives || [];
      allPassives.forEach(function (p) {
        var unlocked = h.level >= p.lvl;
        heroHtml += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;padding:6px 8px;border-radius:5px;' +
          (unlocked ? 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)' : 'background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.03);opacity:0.45') + '">' +
          '<div style="min-width:28px;text-align:center;font-size:.9rem">' + (unlocked ? '✦' : '🔒') + '</div>' +
          '<div style="flex:1">' +
          '<div style="font-size:.86rem;color:' + (unlocked ? '#c9a86c' : '#666') + ';font-weight:bold;margin-bottom:2px">' + p.name + '</div>' +
          '<div style="font-size:.57rem;color:' + (unlocked ? '#aaa' : '#555') + '">' + p.desc + '</div>' +
          (unlocked ? '' : '<div style="font-size:1.04rem;color:#664;margin-top:2px">Desbloqueia no nível ' + p.lvl + '</div>') +
          '</div>' +
          '</div>';
      });
      heroHtml += '</div>';

      document.getElementById('st-hero-panel').innerHTML = heroHtml;

      // ── REPUTATION panel ──
      var repHtml = '<div style="padding:2px 0">';
      var areaNames = ['Planície', 'Floresta Sombria', 'Charneca Ardente', 'Abismo Espectral', 'Pântano', 'Pico dos Trovões'];
      var areaIcons = ['🌿', '🌲', '🔥', '🌑', '🌊', '⚡'];
      for (var _ri = 0; _ri < 6; _ri++) {
        var _rtier = getRepTier(_ri);
        var _rkills = getRepKills(_ri);
        var _rnext = getRepNextTier(_ri);
        var _rpct = _rnext ? Math.min(100, Math.floor((_rkills - _rtier.kills) / (_rnext.kills - _rtier.kills) * 100)) : 100;
        repHtml +=
          '<div style="margin-bottom:8px;background:rgba(0,0,0,0.25);border-radius:5px;padding:6px 8px;border:1px solid rgba(255,255,255,0.06)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
          '<span style="font-size:.86rem;color:#ccc">' + areaIcons[_ri] + ' ' + areaNames[_ri] + '</span>' +
          '<span style="font-size:.6rem;color:' + _rtier.color + ';font-weight:bold">' + _rtier.icon + ' ' + _rtier.name + '</span>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.07);border-radius:3px;height:5px;overflow:hidden">' +
          '<div style="height:100%;border-radius:3px;background:' + _rtier.color + ';width:' + _rpct + '%;transition:width .4s"></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;margin-top:3px">' +
          '<span style="font-size:1.04rem;color:#666">' + _rkills + ' abates</span>' +
          (_rnext ? '<span style="font-size:1.04rem;color:#555">→ ' + _rnext.name + ' em ' + (_rnext.kills - _rkills) + '</span>' :
            '<span style="font-size:1.04rem;color:' + _rtier.color + '">✦ Máximo!</span>') +
          '</div>' +
          (_rtier.bonus ? '<div style="font-size:1.04rem;color:#887755;margin-top:2px">' + _rtier.bonus.desc + '</div>' : '') +
          '</div>';
      }
      repHtml += '</div>';
      var repPanel = document.getElementById('st-rep-panel');
      if (repPanel) repPanel.innerHTML = repHtml;

      // ── CREATURES panel ──
      var allCreatures = (G.team || []).concat(G.hall || []);
      var elIcons = {
        fire: '🔥', water: '💧', earth: '🌿', dark: '☽', light: '✦', nature: '🌱', electric: '⚡',
        vapor: '💨', ashes: '🔥', storm: '⚡', magnet: '⚙', twilight: '🌙', ancient: '🌲', voidarc: '💜', aurora: '🌊'
      };
      var crHtml = '';
      if (!allCreatures.length) {
        crHtml = '<div style="color:#444;text-align:center;padding:20px;font-size:.7rem">Nenhuma criatura vinculada.</div>';
      }
      allCreatures.forEach(function (cr) {
        if (!cr) return;
        var p = cr.maxHp > 0 ? cr.hp / cr.maxHp : 0;
        var xpP = cr.xpNext > 0 ? cr.xp / cr.xpNext : 0;
        var col = hpCol(p);
        var inTeam = G.team.indexOf(cr) >= 0;
        var isHyb = cr.isHybrid;
        var passives = typeof getActivePassives === 'function' ? getActivePassives(cr) : [];
        crHtml +=
          '<div class="st-cr-card' + (cr.dead ? ' st-cr-dead' : '') + (isHyb ? ' st-cr-hybrid' : '') + '">' +
          '<div class="st-cr-header">' +
          '<span class="st-cr-name">' + (elIcons[cr.el] || '') + ' ' + cr.name + (isHyb ? ' ✦' : '') + '</span>' +
          '<span class="eb el-' + cr.el + '" style="font-size:.5rem">' + (EL[cr.el] ? EL[cr.el].name : cr.el) + '</span>' +
          '<span class="st-cr-loc">' + (cr.dead ? '💀 Morta' : inTeam ? '⚔ Grupo' : '🏠 Hall') + '</span>' +
          '</div>' +
          '<div class="st-cr-lv">Nv.' + cr.level + ' &nbsp;·&nbsp; ATQ ' + cr.atk + ' &nbsp;·&nbsp; DEF ' + cr.def + '</div>' +
          '<div class="st-bar-row" style="gap:6px;margin:3px 0">' +
          '<span style="font-size:.80rem;color:#666;width:20px">HP</span>' +
          '<div class="st-bar-w"><div style="height:100%;border-radius:2px;background:' + col + ';width:' + Math.round(p * 100) + '%;transition:width .3s"></div></div>' +
          '<span style="font-size:1.1rem;color:#888">' + cr.hp + '/' + cr.maxHp + '</span>' +
          '</div>' +
          '<div class="st-bar-row" style="gap:6px;margin:2px 0">' +
          '<span style="font-size:.80rem;color:#3a5a8a;width:20px">XP</span>' +
          '<div class="st-bar-w" style="background:rgba(58,90,138,.15)"><div style="height:100%;border-radius:2px;background:#3a80d9;width:' + Math.round(xpP * 100) + '%;transition:width .3s"></div></div>' +
          '<span style="font-size:1.1rem;color:#666">' + cr.xp + '/' + cr.xpNext + '</span>' +
          '</div>' +
          (passives.length ? '<div class="st-cr-passives">' + passives.map(function (p) { return '<span class="cpassive-tag' + (cr.level >= p.lvl ? '' : ' locked') + '">' + p.name + '</span>'; }).join('') + '</div>' : '') +
          (function () {
            var tpl2 = TPLS.find(function (t) { return t.name === (cr.tplName || cr.name); });
            if (!tpl2 || !tpl2.learns || !tpl2.learns.length) return '';
            var lHtml = '<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:4px">';
            tpl2.learns.forEach(function (l) {
              var got = cr.learnedCards && cr.learnedCards.indexOf(l.card) >= 0;
              lHtml += '<span style="font-size:.6rem;padding:2px 6px;border-radius:3px;font-family:Cinzel,serif;' +
                (got ? 'background:rgba(160,80,255,.2);color:#c090ff;border:1px solid rgba(160,80,255,.4)' :
                  'background:rgba(80,80,80,.15);color:#666;border:1px dashed #444') + '">' +
                (got ? '✦ ' : '🔒 ') + l.name + ' (Nv.' + l.lvl + ')' + '</span>';
            });
            return lHtml + '</div>';
          })() +
          '</div>';
      });
      document.getElementById('st-cr-list').innerHTML = crHtml;

      // ── AREAS panel ──
      var arHtml = '';
      AREAS.forEach(function (area, i) {
        var wins = (G.areaWins || [])[i] || 0;
        var kills = (G.areaKills || [])[i] || 0;
        var boss = G.bossDefeated && G.bossDefeated[i];
        var evolved = boss; // area evolves after boss defeated
        arHtml +=
          '<div class="st-area-row' + (evolved ? ' st-area-evolved' : '') + '">' +
          '<span class="st-area-icon">' + area.icon + '</span>' +
          '<div class="st-area-info">' +
          '<span class="st-area-name">' + area.name + (evolved ? ' ✦' : '') + '</span>' +
          '<span class="st-area-stats">' + wins + ' vitórias · ' + kills + ' abates' + (boss ? ' · Chefe derrotado' : '') + '</span>' +
          '</div>' +
          '<div class="st-area-badge' + (boss ? ' cleared' : area.unlocked ? ' active' : ' locked') + '">' +
          (boss ? 'LIMPA' : area.unlocked ? 'ATIVA' : 'BLOQ.') +
          '</div>' +
          '</div>';
      });
      document.getElementById('st-area-list').innerHTML = arHtml;
    }


    // ══════════════════════════════════════════════════════════════
    // H — METAMORFOSE ENTRE RUNS
    // O jogo lembra o que aconteceu na run anterior e muda o mundo.
    // Dados salvos em localStorage com prefixo 'soulmon_meta_'
    // ══════════════════════════════════════════════════════════════
    var META_KEY = 'soulmon_metamorphosis';

    function loadMeta() {
      try { return JSON.parse(localStorage.getItem(META_KEY) || 'null') || {}; } catch (e) { return {}; }
    }
    function saveMeta(data) {
      try { localStorage.setItem(META_KEY, JSON.stringify(data)); } catch (e) { }
    }

    // Called on game over (wipeAndGameOver) — snapshot the run
    function recordRunForMeta() {
      var meta = loadMeta();
      var prev = {
        killedByArea: (function () { var mx = -1, mxi = -1; (G.areaKills || []).forEach(function (k, i) { if (k > mx) { mx = k; mxi = i; } }); return mxi; })(),
        dominantEl: (function () {
          var counts = {};
          (G.team || []).concat(G.dead || []).forEach(function (c) { if (c) counts[c.el] = (counts[c.el] || 0) + 1; });
          var best = 'fire', bv = 0; for (var k in counts) { if (counts[k] > bv) { bv = counts[k]; best = k; } } return best;
        })(),
        totalKills: (G.areaKills || []).reduce(function (s, v) { return s + v; }, 0),
        bossesDefeated: (G.bossDefeated || []).filter(Boolean).length,
        runSouls: G.souls || 0,
        playerName: G.playerName || 'Desconhecido',
        date: Date.now()
      };
      meta.runs = meta.runs || [];
      meta.runs.push(prev);
      if (meta.runs.length > 5) meta.runs = meta.runs.slice(-5); // keep last 5
      meta.last = prev;
      saveMeta(meta);
    }

    // Apply metamorphosis effects at game start based on previous run

    // ══════════════════════════════════════════════════════════════
    // METAMORPHOSIS TOGGLE — shown on new game screen
    // ══════════════════════════════════════════════════════════════
    var _metaEnabled = true; // default on

    function toggleMetaToggle() {
      _metaEnabled = !_metaEnabled;
      var btn = document.getElementById('meta-toggle-btn');
      var desc = document.getElementById('meta-toggle-desc');
      if (btn) { btn.textContent = _metaEnabled ? 'ON' : 'OFF'; btn.className = 'meta-toggle ' + (_metaEnabled ? 'meta-toggle-on' : 'meta-toggle-off'); }
      if (desc) { desc.textContent = _metaEnabled ? 'Efeitos de runs anteriores afetam este mundo' : 'Começa do zero — sem herança de runs passadas'; }
    }

    function resetMetamorphosis() {
      try { localStorage.removeItem('soulmon_metamorphosis'); } catch (e) { }
      OW._suppressedEl = null;
      OW._scarceArea = null;
      OW._memoryBosses = 0;
      OW._metaVillageWarning = null;
      notify('✦ Herança Maldita resetada. O mundo começa do zero.');
    }
    function applyMetamorphosis() {
      if (!_metaEnabled) return; // disabled by player on new game screen
      var meta = loadMeta();
      if (!meta.last) return; // first ever run — no history
      var last = meta.last;
      var msgs = [];

      // 1. Dominant element mobs reduced (they "migrated")
      if (last.dominantEl) {
        OW._suppressedEl = last.dominantEl;
        msgs.push('🌿 As criaturas de ' + (EL[last.dominantEl] ? EL[last.dominantEl].name : last.dominantEl) + ' migraram. São mais raras agora.');
      }

      // 2. Most-killed area spawns scarcer mobs
      if (last.killedByArea >= 0 && last.killedByArea < AREAS.length) {
        OW._scarceArea = last.killedByArea;
        msgs.push('💀 ' + AREAS[last.killedByArea].name + ' foi dizimada. Menos mobs lá desta vez.');
      }

      // 3. Boss defeated previously → that area starts slightly evolved (visual tribute)
      if (last.bossesDefeated > 0) {
        if (!G.bossDefeated) G.bossDefeated = [false, false, false, false, false, false];
        // Add memory: area already had a guardian fall before
        OW._memoryBosses = last.bossesDefeated;
        msgs.push('⚔ ' + last.bossesDefeated + ' chefe(s) do passado deixaram marcas no mundo.');
      }

      // 4. Souls echo: player starts with a small echo of past souls
      var echoSouls = Math.floor(last.runSouls * 0.08);
      if (echoSouls > 0) {
        G.souls = (G.souls || 0) + echoSouls;
        msgs.push('✨ Eco das almas passadas: +' + echoSouls + ' almas de ' + last.playerName + '.');
      }

      // 5. If player died a lot in a boss fight, a villager in the peaceful zone warns
      if (last.bossesDefeated === 0 && last.totalKills > 10) {
        OW._metaVillageWarning = AREAS[last.killedByArea >= 0 ? last.killedByArea : 0].name;
        msgs.push('🏡 Um ancião na vila fala do seu nome como aviso...');
      }

      if (msgs.length) {
        setTimeout(function () {
          msgs.forEach(function (m, i) { setTimeout(function () { notify(m); }, i * 2200); });
        }, 3000);
      }
    }

    // Apply suppressed element to mob spawner — reduce frequency
    function isMetaSuppressedMob(def) {
      if (!OW._suppressedEl) return false;
      // 60% chance to skip mobs of suppressed element
      if (def && def.el === OW._suppressedEl && Math.random() < 0.60) return true;
      return false;
    }

    // Apply scarce area — reduce mob density there
    function isMetaScarceArea(aIdx) {
      if (OW._scarceArea === undefined || OW._scarceArea === null) return false;
      return aIdx === OW._scarceArea && Math.random() < 0.50;
    }
    // ══════════════════════════════════════════════════════════════
    // C — CICLO DIA / NOITE
    // Um dia completo dura DAY_DURATION_MS ms de tempo real.
    // Fases: madrugada → amanhecer → dia → entardecer → noite → madrugada
    // ══════════════════════════════════════════════════════════════
    var DAY_DURATION_MS = 8 * 60 * 1000; // 8 minutos = 1 dia completo
    var _dayStart = Date.now();

    // Retorna fase normalizada [0..1] onde 0=meia-noite, 0.5=meio-dia
    function getDayPhase() {
      return ((Date.now() - _dayStart) % DAY_DURATION_MS) / DAY_DURATION_MS;
    }

    function getDayLabel() {
      var p = getDayPhase();
      if (p < 0.10) return { name: 'Madrugada', icon: '🌑' };
      if (p < 0.22) return { name: 'Amanhecer', icon: '🌅' };
      if (p < 0.55) return { name: 'Dia', icon: '☀' };
      if (p < 0.68) return { name: 'Entardecer', icon: '🌆' };
      if (p < 0.82) return { name: 'Noite', icon: '🌙' };
      return { name: 'Madrugada', icon: '🌑' };
    }

    function isNight() {
      var p = getDayPhase();
      return p > 0.68 || p < 0.22;
    }

    // Returns 0 (full day) → 1 (full night) smoothly
    function getNightness() {
      var p = getDayPhase();
      // Peak night at p=0, p=1. Peak day at p=0.38
      var dist = Math.min(Math.abs(p - 0), Math.abs(p - 1), Math.abs(p - 0.5));
      // remap: 0..0.5 distance → nightness
      var n = Math.max(0, Math.min(1, 1.0 - (Math.min(Math.abs(p - 0.0), Math.abs(p - 1.0)) / 0.22)));
      // Build smooth nightness: 0=day, 1=midnight
      var center = 0.38; // noon
      var diff = Math.abs(p - center);
      if (diff > 0.5) diff = 1.0 - diff;
      return Math.max(0, Math.min(1, (diff - 0.10) / 0.28));
    }

    // Sky color palettes for each hour-phase
    var DAY_SKY_COLS = [
      { t: 0.00, sky: 0x05081a, fog: 0x05081a, amb: 0.20 }, // midnight
      { t: 0.12, sky: 0x1a1030, fog: 0x150d28, amb: 0.25 }, // pre-dawn
      { t: 0.22, sky: 0x3d1a00, fog: 0x3d1a00, amb: 0.45 }, // sunrise orange
      { t: 0.30, sky: 0x1a4a8a, fog: 0x0d2a4a, amb: 0.65 }, // morning blue
      { t: 0.38, sky: 0x0d2a4a, fog: 0x0d2a4a, amb: 0.85 }, // noon
      { t: 0.55, sky: 0x0d2a4a, fog: 0x0d2a4a, amb: 0.80 }, // afternoon
      { t: 0.62, sky: 0x3d1500, fog: 0x2a0f00, amb: 0.55 }, // sunset
      { t: 0.72, sky: 0x160830, fog: 0x0f0520, amb: 0.32 }, // dusk
      { t: 0.82, sky: 0x05081a, fog: 0x05081a, amb: 0.22 }, // night
      { t: 1.00, sky: 0x05081a, fog: 0x05081a, amb: 0.20 }, // loop back
    ];

    function lerpHex(a, b, t) {
      var ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
      var br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
      var rr = Math.round(ar + (br - ar) * t), rg = Math.round(ag + (bg - ag) * t), rb = Math.round(ab + (bb - ab) * t);
      return (rr << 16) | (rg << 8) | rb;
    }

    var _lastDayPhaseLabel = '';
    function updateDayNight() {
      if (!OW.scene) return;
      var p = getDayPhase();
      // Find surrounding keyframes
      var prev = DAY_SKY_COLS[0], next = DAY_SKY_COLS[DAY_SKY_COLS.length - 1];
      for (var i = 0; i < DAY_SKY_COLS.length - 1; i++) {
        if (p >= DAY_SKY_COLS[i].t && p < DAY_SKY_COLS[i + 1].t) {
          prev = DAY_SKY_COLS[i]; next = DAY_SKY_COLS[i + 1]; break;
        }
      }
      var span = next.t - prev.t;
      var frac = span > 0 ? (p - prev.t) / span : 0;
      var sky = lerpHex(prev.sky, next.sky, frac);
      var fog = lerpHex(prev.fog, next.fog, frac);
      var amb = prev.amb + (next.amb - prev.amb) * frac;

      OW.scene.background.set(sky);
      if (OW.scene.fog) {
        OW.scene.fog.color.set(fog);
        if (OW.scene.fog.density !== undefined) OW.scene.fog.density = 0.028 - amb * 0.010;
      }
      // Update ambient + directional lights
      OW.scene.children.forEach(function (ch) {
        if (ch.isHemisphereLight) { ch.color.set(sky); ch.intensity = 0.3 + amb * 0.4; }
        if (ch.isAmbientLight) { ch.intensity = 0.3 + amb * 0.5; }
        if (ch.isDirectionalLight && ch.position.y > 30) {
          ch.intensity = Math.max(0.05, amb * 0.9);
          // Sun angle: rises from east, sets in west
          var sunAngle = p * Math.PI * 2;
          ch.position.set(Math.cos(sunAngle) * 50, Math.abs(Math.sin(sunAngle)) * 60 + 10, Math.sin(sunAngle) * 30);
        }
      });

      // Night buff for dark creatures
      OW._nightBuff = isNight(); // referenced in battle.js via window.OW

      // Notify on phase transition
      var label = getDayLabel();
      if (label.name !== _lastDayPhaseLabel) {
        _lastDayPhaseLabel = label.name;
        var msg = label.icon + ' ' + label.name;
        if (label.name === 'Noite') msg += ' — criaturas das trevas ficam mais agressivas.';
        if (label.name === 'Amanhecer') msg += ' — a luz volta a iluminar o mundo.';
        if (label.name === 'Entardecer') msg += ' — o céu sangra em tons de cinza.';
        notify(msg);
      }

      // HUD clock
      var hud = document.getElementById('day-hud');
      if (hud) {
        var pct = Math.round(p * 100);
        hud.textContent = label.icon + ' ' + label.name;
        hud.style.color = isNight() ? '#9988cc' : '#ddcc88';
      }
    }

    // ══════════════════════════════════════════════════════════════
    // D — EVENTOS ALEATÓRIOS NARRATIVOS
    // Chance de evento a cada N passos. Escolha do jogador.
    // ══════════════════════════════════════════════════════════════
    var _eventStepCounter = 0;
    var _EVENT_STEP_MIN = 35; // base — replaced dynamically
    var _EVENT_STEP_NEXT = 35; // next threshold, randomized after each event
    var _eventCooldownUntil = 0;

    var RANDOM_EVENTS = [
      {
        id: 'traveler', weight: 3,
        title: 'Um Viajante Ferido',
        text: 'Um homem encostado numa árvore, sangue no ombro. Ele sussurra: "Por favor... tenho filhos em casa."',
        opts: [
          { label: 'Gastar 80 almas para curar', cost: 'souls:80', fn: 'healTraveler', reward: 'xp:40', hint: 'Você sente um calor estranho ao ajudar.' },
          { label: 'Ignorar e seguir caminho', cost: null, fn: 'ignoreTraveler', reward: 'nothing', hint: 'Ele te acompanha com o olhar até você desaparecer.' },
          { label: 'Revistar os pertences dele', cost: null, fn: 'robTraveler', reward: 'souls:40', hint: 'Você encontra moedas... e um remorso. Karma: -1.' }
        ]
      },
      {
        id: 'trapped_creature', weight: 3,
        title: 'Criatura Presa',
        text: 'Uma criatura jovem se debate numa armadilha de metal. Parece ser do elemento ' + '??' + '. Seus olhos suplicam.',
        opts: [
          { label: 'Tentar libertar (risco de batalha)', cost: null, fn: 'freeTrap', reward: 'capture_chance', hint: 'Pode virar aliada — ou atacar você.' },
          { label: 'Deixar para lá', cost: null, fn: 'leaveTrap', reward: 'nothing', hint: 'Ela para de se debater. Você segue.' },
          { label: 'Pedir 120 almas para libertar', cost: null, fn: 'sellTrap', reward: 'souls:120', hint: 'Um mercador passa e oferece — você cede.' }
        ]
      },
      {
        id: 'old_shrine', weight: 2,
        title: 'Santuário Esquecido',
        text: 'Uma pedra coberta de musgo pulsa com luz fraca. Inscrições antigas prometem bênçãos... ou maldições.',
        opts: [
          { label: 'Oferecer 60 almas ao santuário', cost: 'souls:60', fn: 'blessShrine', reward: 'hp_restore', hint: 'Uma força antiga aquece seu grupo.' },
          { label: 'Tocar a pedra sem oferecer', cost: null, fn: 'touchShrine', reward: 'rng_buff_debuff', hint: 'O santuário reage ao seu toque.' },
          { label: 'Ignorar', cost: null, fn: 'ignoreShrine', reward: 'nothing', hint: 'Você sente a pedra observando suas costas.' }
        ]
      },
      {
        id: 'storm_omen', weight: 2,
        title: 'Presságio de Tempestade',
        text: 'O céu muda de cor. Mobs ao longe ficam agitados. Um pássaro caído no caminho murmura em língua antiga.',
        opts: [
          { label: 'Seguir em frente (mobs +20% por 2min)', cost: null, fn: 'braveStorm', reward: 'xp_boost_2min', hint: 'A tempestade forja os corajosos.' },
          { label: 'Acampar e esperar (curar criaturas)', cost: 'time:120', fn: 'campStorm', reward: 'full_heal_team', hint: 'Você desperta com o grupo descansado.' }
        ]
      },
      {
        id: 'mysterious_merchant', weight: 2,
        title: 'Mercador das Sombras',
        text: 'Uma figura encapuzada aparece do nada. "Tenho algo raro... por um preço especial. Ou podemos fazer um trato."',
        opts: [
          { label: 'Comprar item misterioso (150 almas)', cost: 'souls:150', fn: 'buyMystery', reward: 'mystery_item', hint: 'Você não sabe o que é — até abrir.' },
          { label: 'Fazer um trato de alma', cost: 'hp:15', fn: 'soulTrade', reward: 'relic_fragment', hint: 'Você sente algo partir de você.' },
          { label: 'Expulsar o mercador', cost: null, fn: 'expelMerchant', reward: 'nothing', hint: 'Ele desaparece entre gargalhadas.' }
        ]
      },
      {
        id: 'lost_child', weight: 1,
        title: 'A Criança Perdida',
        text: 'Uma criança pequena, sozinha no meio do mapa. Ela olha para você com olhos muito grandes. "Você viu minha família?"',
        opts: [
          { label: 'Acompanhar ela até o santuário', cost: 'time:60', fn: 'helpChild', reward: 'xp:80', hint: 'Ela some assim que chega lá. Talvez nunca tenha sido real.' },
          { label: 'Dar comida (curar criatura ativa)', cost: 'hp_give:15', fn: 'feedChild', reward: 'souls:30', hint: 'Ela agradece com uma moeda antiga.' },
          { label: 'Deixar ela para trás', cost: null, fn: 'leaveChild', reward: 'nothing', hint: 'Ela não te segue. Só observa.' }
        ]
      }
    ];

    function triggerRandomEvent() {
      if (Date.now() < _eventCooldownUntil) return;
      if (document.getElementById('random-event-ov').style.display !== 'none') return;
      // Filter by weight
      var pool = [];
      RANDOM_EVENTS.forEach(function (ev) { for (var i = 0; i < ev.weight; i++) pool.push(ev); });
      var ev = pool[Math.floor(Math.random() * pool.length)];
      _eventCooldownUntil = Date.now() + 90000; // 90s cooldown between events
      openRandomEvent(ev);
    }

    function openRandomEvent(ev) {
      // Pause mob movement briefly
      OW._eventPaused = true;
      var ov = document.getElementById('random-event-ov');
      var box = document.getElementById('rev-box');
      var optHtml = ev.opts.map(function (opt, i) {
        var costLabel = opt.cost ? ' <span style="color:#c44;font-size:.80rem">(' + opt.cost.replace('souls:', '') + ' almas' + (opt.cost.startsWith('hp:') ? ' HP' : '') + ')</span>' : '';
        return '<button class="rev-opt" onclick="resolveEvent(\'' + ev.id + '\',' + i + ')">' +
          opt.label + costLabel + '</button>';
      }).join('');
      box.innerHTML =
        '<button class="rev-x" onclick="closeRandomEvent()" title="Fechar (ESC)">✕</button>' +
        '<div class="rev-title">' + ev.title + '</div>' +
        '<div class="rev-text">' + ev.text + '</div>' +
        '<div class="rev-opts">' + optHtml + '</div>';
      ov.style.display = 'flex';
      // Click outside the box closes
      ov.onclick = function (e) { if (e.target === ov) { closeRandomEvent(); } };
    }

    function resolveEvent(evId, optIdx) {
      var ev = RANDOM_EVENTS.find(function (e) { return e.id === evId; });
      if (!ev) return;
      var opt = ev.opts[optIdx];
      var result = '';

      // Apply cost
      if (opt.cost) {
        var parts = opt.cost.split(':');
        if (parts[0] === 'souls') { var amt = parseInt(parts[1]); if (G.souls < amt) { notify('Almas insuficientes.'); return; } G.souls -= amt; }
        if (parts[0] === 'hp') { if (G.hero) { G.hero.hp = Math.max(1, G.hero.hp - parseInt(parts[1])); renderHeroHUD(); } }
        if (parts[0] === 'hp_give') {
          var cr = G.team && G.team.find(function (c) { return c && !c.dead; });
          if (cr) cr.hp = Math.max(1, cr.hp - parseInt(parts[1]));
        }
      }

      // Apply reward
      var fnName = opt.fn;
      var hint = opt.hint;
      if (fnName === 'healTraveler') { G.team.forEach(function (cr) { if (cr && !cr.dead) { cr.hp = Math.min(cr.maxHp, cr.hp + Math.floor(cr.maxHp * 0.3)); } }); G.hero.xp = (G.hero.xp || 0) + 40; result = '✦ Grupo curado em 30% HP. +40 XP.'; }
      else if (fnName === 'ignoreTraveler') { result = 'Você segue seu caminho.'; }
      else if (fnName === 'robTraveler') { G.souls += 40; result = '💀 +40 almas. Um peso estranho te acompanha.'; }
      else if (fnName === 'freeTrap') {
        // Start a battle with a random creature that might be captured
        result = '⚔ A criatura se solta... e ataca!';
        document.getElementById('random-event-ov').style.display = 'none';
        OW._eventPaused = false;
        setTimeout(function () { startBattle(OW.grid[OW.player.x + ',' + OW.player.z] ? (OW.grid[OW.player.x + ',' + OW.player.z].aIdx || 0) : 0); }, 400);
        return;
      }
      else if (fnName === 'leaveTrap') { result = 'A criatura continua presa.'; }
      else if (fnName === 'sellTrap') { G.souls += 120; result = '🪙 +120 almas. A criatura desaparece.'; }
      else if (fnName === 'blessShrine') { G.team.forEach(function (cr) { if (cr && !cr.dead) { cr.hp = cr.maxHp; } }); G.hero.hp = G.hero.maxHp; result = '✦ Grupo e herói restaurados completamente!'; renderHeroHUD(); }
      else if (fnName === 'touchShrine') {
        if (Math.random() < 0.5) { G.buffs = G.buffs || {}; G.buffs.xp_boost = true; result = '✦ O santuário te abençoa! XP boost ativado.'; }
        else { G.hero.hp = Math.max(1, G.hero.hp - 20); result = '💀 O santuário te pune! -20 HP do herói.'; renderHeroHUD(); }
      }
      else if (fnName === 'ignoreShrine') { result = 'O santuário fica para trás.'; }
      else if (fnName === 'braveStorm') { OW._stormRage = Date.now() + 120000; result = '⚡ Tempestade ativada! Mobs mais fortes por 2 min.'; }
      else if (fnName === 'campStorm') { G.team.forEach(function (cr) { if (cr && !cr.dead) { cr.hp = cr.maxHp; } }); result = '⛺ Grupo descansou. HP completo!'; }
      else if (fnName === 'buyMystery') { var items = ['hp_potion', 'atk_shard', 'soul_gem']; var it = items[Math.floor(Math.random() * items.length)]; addToItems(it, 1); result = '🎁 Item misterioso obtido: ' + it; }
      else if (fnName === 'soulTrade') { if (G.hero) { G.hero.hp = Math.max(1, G.hero.hp - 15); renderHeroHUD(); } addRelic(['earth_root', 'eternal_ash', 'void_stone', 'spectral_echo', 'bog_bone', 'peak_crystal'][Math.floor(Math.random() * 6)]); result = '💜 Um fragmento de relíquia — e uma cicatriz.'; }
      else if (fnName === 'expelMerchant') { result = 'O mercador desaparece entre risadas.'; }
      else if (fnName === 'helpChild') { if (G.hero) { G.hero.xp = (G.hero.xp || 0) + 80; } result = '✦ +80 XP do herói. A criança desaparece.'; }
      else if (fnName === 'feedChild') { G.souls += 30; result = '🪙 +30 almas. A criança agradece.'; }
      else if (fnName === 'leaveChild') { result = 'Você a deixa para trás.'; }

      // Show result hint
      document.getElementById('rev-box').innerHTML =
        '<div class="rev-title" style="color:#c9933a">Resultado</div>' +
        '<div class="rev-text">' + hint + '</div>' +
        '<div class="rev-result">' + result + '</div>' +
        '<button class="rev-opt rev-close" onclick="closeRandomEvent()">Continuar</button>';
      saveGame();
      renderExpC();
    }

    function closeRandomEvent() {
      document.getElementById('random-event-ov').style.display = 'none';
      OW._eventPaused = false;
    }

    // ══════════════════════════════════════════════════════════════
    // DUNGEON EXPRESS — mini-masmorra de 5 salas
    // ══════════════════════════════════════════════════════════════
    var _DUNG = {
      active: false,
      aIdx: 0,
      room: 0,         // 0-4
      completed: [],   // room results: 'done'|'fail'
      rewards: [],
      canFlee: false
    };

    var DUNG_ROOM_TYPES = [
      // room 0
      function () { dungRoomBattle(false); },
      // room 1
      function () { dungRoomBattle(false); },
      // room 2
      function () { dungRoomEvent(); },
      // room 3
      function () { dungRoomBattle(true); },  // elite
      // room 4
      function () { dungRoomBoss(); }
    ];

    var DUNG_EVENTS = [
      {
        icon: '💊', title: 'Altar de Cura', desc: 'Uma luz suave emana do altar. Suas criaturas se recuperam.',
        effect: function () { healAllCreatures(0.35); addLog('✦ Altar curou 35% do HP de todas as criaturas.', 'evt'); }
      },
      {
        icon: '⚡', title: 'Essência Selvagem', desc: 'Uma energia estranha flui pelo ar. Seu time fica energizado.',
        effect: function () {
          var c = ac(); if (c) { c.atk = Math.floor(c.atk * 1.15); addLog('✦ ' + c.name + ' +15% ataque por esta dungeon.', 'evt'); }
        }
      },
      {
        icon: '🔮', title: 'Visão do Vazio', desc: 'Você vislumbra o inimigo final. Ganhe conhecimento útil.',
        effect: function () {
          var area = AREAS[_DUNG.aIdx] || AREAS[0];
          var pool = TPLS.filter(function (t) { return area.elems.indexOf(t.el) >= 0; });
          var boss = pool[Math.floor(Math.random() * pool.length)];
          addLog('✦ O chefe será do tipo ' + boss.el.toUpperCase() + '. Prepare-se.', 'evt');
        }
      },
      {
        icon: '💰', title: 'Câmara do Tesouro', desc: 'Uma pilha de almas brilha no chão.',
        effect: function () { var bonus = Math.floor(80 + Math.random() * 120); G.souls += bonus; addLog('✦ Encontrou ' + bonus + ' almas!', 'evt'); renderSoulHUD && renderSoulHUD(); }
      },
      {
        icon: '🛡', title: 'Escudo Espectral', desc: 'Uma barreira protetora envolve seu time.',
        effect: function () {
          if (!G.battle) G.battle = {};
          G.battle._dungShield = true;
          addLog('✦ Escudo espectral ativo: próximo ataque crítico inimigo será absorvido.', 'evt');
        }
      }
    ];

    function healAllCreatures(pct) {
      var all = (G.team || []).concat(G.hall || []);
      all.forEach(function (c) { if (c && !c.dead) { c.hp = Math.min(c.maxHp, c.hp + Math.floor(c.maxHp * pct)); } });
      renderTeam && renderTeam();
    }

    function openDungeonExpress(aIdx) {
      _DUNG.active = true;
      _DUNG.aIdx = aIdx;
      _DUNG.room = 0;
      _DUNG.completed = [];
      _DUNG.rewards = [];
      _DUNG.canFlee = false;
      OW._eventPaused = true;
      document.getElementById('dungeon-ov').style.display = 'flex';
      dungUpdatePips();
      dungShowIntro();
    }

    function closeDungeonExpress(won) {
      _DUNG.active = false;
      OW._eventPaused = false;
      document.getElementById('dungeon-ov').style.display = 'none';
      // Garantir que explore está visível e o loop do mapa está rodando
      var exploreEl = document.getElementById('explore');
      var battleEl = document.getElementById('battle');
      if (exploreEl) exploreEl.style.display = 'flex';
      if (battleEl) battleEl.style.display = 'none';
      if (typeof stopBattleVisuals === 'function') stopBattleVisuals();
      if (typeof renderExpC === 'function') renderExpC();
      if (typeof renderHeroHUD === 'function') renderHeroHUD();
      if (typeof renderAreas === 'function') setTimeout(renderAreas, 50);
      if (won) {
        // Guarantee drop: relic shard or rare egg
        var area = AREAS[_DUNG.aIdx] || AREAS[0];
        var rewardEl = area.elems[Math.floor(Math.random() * area.elems.length)];
        addToItems && addToItems(rewardEl, 1);
        var soulsBonus = Math.floor(150 + Math.random() * 150);
        G.souls += soulsBonus;
        renderSoulHUD && renderSoulHUD();
        // Reputation boost
        G.areaKills[_DUNG.aIdx] = (G.areaKills[_DUNG.aIdx] || 0) + 5;
        checkRepTierUp && checkRepTierUp(_DUNG.aIdx);
        addLog('✦ Dungeon concluída! +' + soulsBonus + ' almas · Relíquia elemental adquirida.', 'evt');
        notify('⚔ Dungeon Express concluída!');
      }
    }

    function dungUpdatePips() {
      for (var i = 0; i < 5; i++) {
        var pip = document.getElementById('dpip' + i);
        if (!pip) continue;
        pip.className = 'dung-pip';
        if (i < _DUNG.completed.length) {
          pip.classList.add(_DUNG.completed[i] === 'done' ? 'done' : 'fail');
        } else if (i === _DUNG.room) {
          pip.classList.add('active');
        }
      }
      var lbl = document.getElementById('dung-room-label');
      if (lbl) {
        var roomNames = ['Sala 1', 'Sala 2', 'Sala 3 — Evento', 'Sala 4 — Elite', 'Sala 5 — Chefe'];
        lbl.textContent = roomNames[_DUNG.room] + ' / 5';
      }
    }

    function dungSetContent(html) {
      var el = document.getElementById('dung-content');
      if (el) el.innerHTML = html;
    }

    function dungShowIntro() {
      var area = AREAS[_DUNG.aIdx] || AREAS[0];
      dungSetContent(
        '<div class="dung-room-card">' +
        '<div class="dung-room-icon">⚔</div>' +
        '<div class="dung-room-title">ENTRADA DA MASMORRA</div>' +
        '<div class="dung-room-desc">Uma passagem obscura se abre diante de você.<br>' +
        'Cinco salas aguardam — batalhas, um evento e um chefe.<br>' +
        '<span style="color:#ff9966">Não é possível sair até o fim ou derrota.</span></div>' +
        '<div style="margin-top:8px;font-size:.7rem;color:#9966cc;font-family:Cinzel,serif;letter-spacing:.08em">' +
        'Área: ' + (area.name || 'Desconhecida') + '</div>' +
        '<div style="margin-top:16px">' +
        '<button class="dung-btn gold" onclick="dungNextRoom()">⚔ Entrar na Masmorra</button>' +
        '<button class="dung-btn danger" onclick="dungFlee()">↩ Recuar</button>' +
        '</div></div>'
      );
    }

    function dungFlee() {
      closeDungeonExpress(false);
      addLog('Recuou da entrada da masmorra.', 'evt');
    }

    function dungNextRoom() {
      if (_DUNG.room >= 5) { dungShowReward(); return; }
      dungUpdatePips();
      DUNG_ROOM_TYPES[_DUNG.room]();
    }

    function dungRoomBattle(isElite) {
      var area = AREAS[_DUNG.aIdx] || AREAS[0];
      var elems = area.elems || ['fire'];
      var el = elems[Math.floor(Math.random() * elems.length)];
      var pool = TPLS.filter(function (t) { return t.el === el; });
      var tpl = pool[Math.floor(Math.random() * pool.length)] || TPLS[0];
      var lvl = (area.minL || 1) + Math.floor(Math.random() * ((area.maxL || 5) - (area.minL || 1) + 1));
      if (isElite) lvl = Math.min(lvl + 3, (area.maxL || 5) + 2);
      var enemy = mkC(tpl, lvl);
      if (isElite) { enemy.maxHp = Math.floor(enemy.maxHp * 1.5); enemy.hp = enemy.maxHp; enemy.atk = Math.floor(enemy.atk * 1.2); }

      // Store enemy for button click
      window._dungRoomEnemy = enemy;
      dungSetContent(
        '<div class="dung-room-card">' +
        '<div class="dung-room-icon">' + (isElite ? '💀' : '⚔') + '</div>' +
        '<div class="dung-room-title">' + (isElite ? 'INIMIGO ELITE' : 'BATALHA') + '</div>' +
        '<div class="dung-room-desc">' +
        '<span style="font-size:1.1rem;color:#e0c0ff">' + enemy.name + '</span><br>' +
        '<span style="font-size:.7rem;color:#aaa">Nv.' + enemy.level + ' · ' + el.toUpperCase() +
        (isElite ? ' <span style="color:#ff8888">· ELITE +50% HP</span>' : '') + '</span>' +
        '</div>' +
        '<button class="dung-btn gold" onclick="_dungPendingEnemy=_dungRoomEnemy;dungStartBattle(_dungPendingEnemy,' + (isElite ? 'true' : 'false') + ')">⚔ Combater</button>' +
        '</div>'
      );
    }

    var _dungPendingEnemy = null;

    function dungStartBattle(enemyObj, isElite) {
      var enemy = enemyObj || window._dungRoomEnemy;
      if (!enemy) return;
      enemy.dead = false;
      _dungPendingEnemy = enemy;
      _DUNG._pendingElite = isElite;
      document.getElementById('dungeon-ov').style.display = 'none';
      startBattleWithMobEnemy(enemy, null, function (won) {
        document.getElementById('dungeon-ov').style.display = 'flex';
        if (won) {
          _DUNG.completed.push('done');
          _DUNG.room++;
          dungUpdatePips();
          if (_DUNG.room >= 5) {
            setTimeout(dungShowReward, 400);
          } else {
            setTimeout(dungNextRoom, 400);
          }
        } else {
          _DUNG.completed.push('fail');
          dungUpdatePips();
          dungShowDefeat();
        }
      });
    }

    function dungRoomEvent() {
      var ev = DUNG_EVENTS[Math.floor(Math.random() * DUNG_EVENTS.length)];
      // Apply effect immediately
      ev.effect();
      dungSetContent(
        '<div class="dung-room-card">' +
        '<div class="dung-room-icon">' + ev.icon + '</div>' +
        '<div class="dung-room-title">' + ev.title.toUpperCase() + '</div>' +
        '<div class="dung-room-desc">' + ev.desc + '</div>' +
        '<button class="dung-btn gold" onclick="dungCompleteEvent()">Continuar →</button>' +
        '</div>'
      );
    }

    function dungCompleteEvent() {
      _DUNG.completed.push('done');
      _DUNG.room++;
      dungUpdatePips();
      setTimeout(dungNextRoom, 300);
    }

    function dungRoomBoss() {
      var area = AREAS[_DUNG.aIdx] || AREAS[0];
      var elems = area.elems || ['dark'];
      var el = elems[Math.floor(Math.random() * elems.length)];
      var pool = TPLS.filter(function (t) { return t.el === el; });
      var tpl = pool[Math.floor(Math.random() * pool.length)] || TPLS[0];
      var lvl = Math.min((area.maxL || 5) + 4, 20);
      var boss = mkC(tpl, lvl);
      boss.maxHp = Math.floor(boss.maxHp * 2.0);
      boss.hp = boss.maxHp;
      boss.atk = Math.floor(boss.atk * 1.35);
      boss.name = boss.name + ' das Sombras';

      window._dungRoomEnemy = boss;
      dungSetContent(
        '<div class="dung-room-card" style="border-color:rgba(200,80,80,.5)">' +
        '<div class="dung-room-icon">💀</div>' +
        '<div class="dung-room-title" style="color:#ff9988">CHEFE DA MASMORRA</div>' +
        '<div class="dung-room-desc">' +
        '<span style="font-size:.88rem;color:#ffccaa">' + boss.name + '</span><br>' +
        '<span style="font-size:.98rem;color:#ff8888">Nv.' + boss.level + ' · ' + el.toUpperCase() + ' · +100% HP · CHEFE</span>' +
        '</div>' +
        '<div style="font-size:.7rem;color:#cc9966;margin:8px 0">Derrote o chefe para completar a dungeon e receber recompensa garantida!</div>' +
        '<button class="dung-btn danger" onclick="_dungPendingEnemy=_dungRoomEnemy;dungStartBattle(_dungPendingEnemy,false)">⚔ Enfrentar o Chefe</button>' +
        '</div>'
      );
    }

    function dungShowDefeat() {
      dungSetContent(
        '<div class="dung-room-card" style="border-color:rgba(200,60,60,.5)">' +
        '<div class="dung-room-icon">💀</div>' +
        '<div class="dung-room-title" style="color:#ff8888">DERROTA</div>' +
        '<div class="dung-room-desc">Seu time foi derrotado. A masmorra te expulsa nas trevas.</div>' +
        '<button class="dung-btn danger" onclick="closeDungeonExpress(false)">↩ Sair da Masmorra</button>' +
        '</div>'
      );
    }

    function dungShowReward() {
      _DUNG.completed.push('done');
      dungUpdatePips();
      var area = AREAS[_DUNG.aIdx] || AREAS[0];
      var rewardEl = area.elems ? area.elems[Math.floor(Math.random() * area.elems.length)] : 'fire';
      var itemDef = ITEM_DEFS ? ITEM_DEFS.find(function (d) { return d.id === rewardEl; }) : null;
      var itemName = itemDef ? itemDef.name : (rewardEl + ' Elemental');
      var soulsBonus = Math.floor(150 + Math.random() * 150);

      dungSetContent(
        '<div class="dung-room-card" style="border-color:rgba(201,147,58,.5)">' +
        '<div class="dung-room-icon">✦</div>' +
        '<div class="dung-room-title" style="color:#e8b860">MASMORRA CONCLUÍDA!</div>' +
        '<div class="dung-room-desc">Todas as salas foram superadas. Recompensas garantidas:</div>' +
        '<div style="margin:12px 0">' +
        '<span class="dung-reward-item">💰 ' + soulsBonus + ' Almas</span>' +
        '<span class="dung-reward-item">✦ ' + itemName + '</span>' +
        '<span class="dung-reward-item">⭐ +5 Reputação</span>' +
        '</div>' +
        '<button class="dung-btn gold" onclick="closeDungeonExpress(true)">Receber Recompensas ✦</button>' +
        '</div>'
      );
    }

    // Hook into battle result for dungeon context
    var _origBattleWin = typeof onBattleWin !== 'undefined' ? onBattleWin : null;
    var _dungBattleCb = null; // set before each dungeon battle



    function addToItems(id, qty) {
      if (!G.items) G.items = [];
      var ex = G.items.find(function (i) { return i.id === id; });
      if (ex) ex.qty = (ex.qty || 1) + qty;
      else G.items.push({ id: id, qty: qty });
    }


    // ══════════════════════════════════════════════════════════════
    // BATTLE VISUAL FX — VS shader canvas + nebula particle bg
    // ══════════════════════════════════════════════════════════════

    var _bvAnim = null; // animation frame id
    var _bvStarted = false;

    function initBattleVisuals(myEl, enEl) {
      // Obter cores dos elementos das criaturas
      var EL_COLORS = {
        fire: { r: 232, g: 69, b: 68 },
        water: { r: 74, g: 144, b: 217 },
        earth: { r: 95, g: 175, b: 94 },
        nature: { r: 95, g: 175, b: 94 },
        dark: { r: 148, g: 68, b: 204 },
        light: { r: 240, g: 210, b: 100 },
        electric: { r: 240, g: 210, b: 60 }
      };
      var myCol = EL_COLORS[myEl] || { r: 74, g: 144, b: 217 };
      var enCol = EL_COLORS[enEl] || { r: 232, g: 69, b: 68 };

      // ── Background nebulosa ──────────────────────────────────
      var bgCv = document.getElementById('battle-bg-canvas');
      var vsCv = document.getElementById('battle-vs-canvas');
      if (!bgCv || !vsCv) return;

      bgCv.width = window.innerWidth;
      bgCv.height = window.innerHeight;
      vsCv.width = window.innerWidth;
      vsCv.height = window.innerHeight;

      var bgCtx = bgCv.getContext('2d');
      var vsCtx = vsCv.getContext('2d');

      // Partículas nebulosas
      var W = bgCv.width, H = bgCv.height;
      var NPARTS = 180;
      var parts = [];
      for (var i = 0; i < NPARTS; i++) {
        var side = Math.random() > 0.5;
        var col = side ? myCol : enCol;
        parts.push({
          x: side ? Math.random() * W * 0.48 : W * 0.52 + Math.random() * W * 0.48,
          y: Math.random() * H,
          r: 1.5 + Math.random() * 3.5,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          alpha: 0.1 + Math.random() * 0.35,
          col: col,
          side: side,
          phase: Math.random() * Math.PI * 2
        });
      }

      // VS shader com canvas 2D (gradiente + texto animado)
      var vsFont = Math.min(W, H) * 0.38;

      var t = 0;
      // Ciclo do foil VS: alterna entre descanso e burst
      var _vsRestDur = 2.5 + Math.random() * 2;   // duração do descanso (s)
      var _vsBurstDur = 1.8 + Math.random() * 1.5; // duração do burst
      var _vsPhase = 'rest'; // 'rest' | 'burst'
      var _vsPhaseT = 0;      // tempo dentro da fase atual
      var _vsBurstIntensity = 0; // 0..1 suavizado
      if (_bvAnim) cancelAnimationFrame(_bvAnim);

      function drawFrame() {
        t += 0.018;
        W = bgCv.width; H = bgCv.height;

        // Ciclo do foil: descanso → burst → descanso...
        var _dt = 0.018;
        _vsPhaseT += _dt;
        if (_vsPhase === 'rest' && _vsPhaseT >= _vsRestDur) {
          _vsPhase = 'burst';
          _vsPhaseT = 0;
          _vsBurstDur = 1.5 + Math.random() * 2.0;
        } else if (_vsPhase === 'burst' && _vsPhaseT >= _vsBurstDur) {
          _vsPhase = 'rest';
          _vsPhaseT = 0;
          _vsRestDur = 2.0 + Math.random() * 3.0;
        }
        // Intensidade suavizada: easing in/out
        var _targetIntensity = _vsPhase === 'burst' ? 1.0 : 0.0;
        _vsBurstIntensity += (_targetIntensity - _vsBurstIntensity) * 0.05;

        // ── Background nebulosa ──
        bgCtx.clearRect(0, 0, W, H);

        // Gradiente de fundo dividido ao meio
        var grad = bgCtx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(' + myCol.r + ',' + myCol.g + ',' + myCol.b + ',0.06)');
        grad.addColorStop(0.45, 'rgba(' + myCol.r + ',' + myCol.g + ',' + myCol.b + ',0.02)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0)');
        grad.addColorStop(0.55, 'rgba(' + enCol.r + ',' + enCol.g + ',' + enCol.b + ',0.02)');
        grad.addColorStop(1, 'rgba(' + enCol.r + ',' + enCol.g + ',' + enCol.b + ',0.06)');
        bgCtx.fillStyle = grad;
        bgCtx.fillRect(0, 0, W, H);

        // Orbes pulsantes em cada lado
        var pulse1 = 0.5 + 0.5 * Math.sin(t * 1.2);
        var pulse2 = 0.5 + 0.5 * Math.sin(t * 1.2 + Math.PI);

        var orb1 = bgCtx.createRadialGradient(W * 0.18, H * 0.5, 0, W * 0.18, H * 0.5, W * 0.22);
        orb1.addColorStop(0, 'rgba(' + myCol.r + ',' + myCol.g + ',' + myCol.b + ',' + (0.09 + pulse1 * 0.06) + ')');
        orb1.addColorStop(1, 'rgba(0,0,0,0)');
        bgCtx.fillStyle = orb1;
        bgCtx.fillRect(0, 0, W, H);

        var orb2 = bgCtx.createRadialGradient(W * 0.82, H * 0.5, 0, W * 0.82, H * 0.5, W * 0.22);
        orb2.addColorStop(0, 'rgba(' + enCol.r + ',' + enCol.g + ',' + enCol.b + ',' + (0.09 + pulse2 * 0.06) + ')');
        orb2.addColorStop(1, 'rgba(0,0,0,0)');
        bgCtx.fillStyle = orb2;
        bgCtx.fillRect(0, 0, W, H);

        // Partículas
        for (var p = 0; p < parts.length; p++) {
          var pt = parts[p];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.phase += 0.01;
          var blink = 0.6 + 0.4 * Math.sin(pt.phase);
          // Wrap
          if (pt.x < 0) pt.x = W;
          if (pt.x > W) pt.x = 0;
          if (pt.y < 0) pt.y = H;
          if (pt.y > H) pt.y = 0;

          bgCtx.beginPath();
          bgCtx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
          bgCtx.fillStyle = 'rgba(' + pt.col.r + ',' + pt.col.g + ',' + pt.col.b + ',' + (pt.alpha * blink) + ')';
          bgCtx.fill();
        }

        // Linha divisória central com gradiente
        var lineGrad = bgCtx.createLinearGradient(W * 0.5, 0, W * 0.5, H);
        lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
        lineGrad.addColorStop(0.2, 'rgba(255,255,255,' + (0.06 + 0.04 * Math.sin(t)) + ')');
        lineGrad.addColorStop(0.5, 'rgba(255,255,255,' + (0.12 + 0.06 * Math.sin(t * 1.5)) + ')');
        lineGrad.addColorStop(0.8, 'rgba(255,255,255,' + (0.06 + 0.04 * Math.sin(t)) + ')');
        lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
        bgCtx.strokeStyle = lineGrad;
        bgCtx.lineWidth = 1;
        bgCtx.beginPath();
        bgCtx.moveTo(W * 0.5, 0);
        bgCtx.lineTo(W * 0.5, H);
        bgCtx.stroke();

        // ── VS Canvas — efeito foil iridescente ──
        vsCtx.clearRect(0, 0, W, H);

        vsFont = Math.min(W, H) * 0.32;
        vsCtx.save();
        vsCtx.font = 'bold ' + vsFont + 'px "Cinzel Decorative", serif';
        vsCtx.textAlign = 'center';
        vsCtx.textBaseline = 'middle';

        // Medir o texto para criar gradiente no tamanho certo
        var vsMetrics = vsCtx.measureText('VS');
        var vsW = vsMetrics.width;
        var vsX = W * 0.5 - vsW * 0.5;
        var vsY = H * 0.5 - vsFont * 0.5;

        // === FOIL: gradiente diagonal que se move com o tempo ===
        // Cria um gradiente que varre todas as cores do espectro
        // Velocidade do foil varia com o ciclo: descanso=lento, burst=rápido
        var _foilSpeed = 0.04 + _vsBurstIntensity * 0.40;
        var foilOffset = (t * _foilSpeed) % 1.0;
        var foilAngle = t * 0.4; // rotação do gradiente
        var fCos = Math.cos(foilAngle), fSin = Math.sin(foilAngle);
        var fR = vsFont * 0.9;
        var foilGrad = vsCtx.createLinearGradient(
          W * 0.5 + fCos * (-fR), H * 0.5 + fSin * (-fR),
          W * 0.5 + fCos * fR, H * 0.5 + fSin * fR
        );

        // 12 stops de arco-íris com shift animado — cores do jogador e inimigo integradas
        var hueStops = 12;
        for (var hi = 0; hi <= hueStops; hi++) {
          var hPos = hi / hueStops;
          var hShift = (hPos + foilOffset) % 1.0;
          // Interpolar entre cor do jogador, arco-íris, cor do inimigo
          var hue = Math.floor(hShift * 360);
          // Saturação e brilho variam para efeito foil metálico
          // No descanso: saturação baixa e cores dos elementos; no burst: arco-íris vivo
          var sat = (20 + _vsBurstIntensity * 70) + 10 * Math.sin(hShift * Math.PI * 2 + t);
          var lgt = 40 + 20 * Math.abs(Math.sin(hShift * Math.PI + t * 0.7));
          // Misturar com cores dos elementos nas extremidades
          // Extremidades sempre mostram cores dos elementos, meio varia com intensidade
          if (hPos < 0.15) {
            var rA = Math.round(myCol.r * (1 - _vsBurstIntensity * 0.3));
            var gA = Math.round(myCol.g * (1 - _vsBurstIntensity * 0.3));
            var bA = Math.round(myCol.b * (1 - _vsBurstIntensity * 0.3));
            foilGrad.addColorStop(hPos, 'rgba(' + rA + ',' + gA + ',' + bA + ',0.9)');
          } else if (hPos > 0.85) {
            var rB = Math.round(enCol.r * (1 - _vsBurstIntensity * 0.3));
            var gB = Math.round(enCol.g * (1 - _vsBurstIntensity * 0.3));
            var bB = Math.round(enCol.b * (1 - _vsBurstIntensity * 0.3));
            foilGrad.addColorStop(hPos, 'rgba(' + rB + ',' + gB + ',' + bB + ',0.9)');
          } else {
            foilGrad.addColorStop(hPos, 'hsl(' + hue + ',' + sat + '%,' + lgt + '%)');
          }
        }

        // Sem glow externo — foil puro sem sombra
        vsCtx.shadowColor = 'transparent';
        vsCtx.shadowBlur = 0;

        // Preencher VS com gradiente foil
        vsCtx.fillStyle = foilGrad;
        var scale = 1 + 0.018 * Math.sin(t * 1.6);
        vsCtx.translate(W * 0.5, H * 0.5);
        vsCtx.scale(scale, 1.0); // sem achatamento vertical
        vsCtx.fillText('VS', 0, 0);

        // Camada de reflexo especular — só aparece no burst
        var specPos = ((t * (0.2 + _vsBurstIntensity * 0.4)) % 1.4) - 0.2;
        var specX0 = W * 0.5 - vsW * 0.8 + specPos * vsW * 1.6;
        var specGrad2 = vsCtx.createLinearGradient(specX0 - vsFont * 0.18, 0, specX0 + vsFont * 0.18, 0);
        specGrad2.addColorStop(0, 'rgba(255,255,255,0)');
        specGrad2.addColorStop(0.5, 'rgba(255,255,255,' + (0.08 + _vsBurstIntensity * 0.32) + ')');
        specGrad2.addColorStop(1, 'rgba(255,255,255,0)');
        vsCtx.fillStyle = specGrad2;
        vsCtx.globalCompositeOperation = 'overlay';
        vsCtx.fillText('VS', 0, 0);
        vsCtx.globalCompositeOperation = 'source-over';

        // Sem borda
        vsCtx.restore();

        _bvAnim = requestAnimationFrame(drawFrame);
      }

      drawFrame();
      _bvStarted = true;
    }

    function stopBattleVisuals() {
      if (_bvAnim) { cancelAnimationFrame(_bvAnim); _bvAnim = null; }
      _bvStarted = false;
      var bgCv = document.getElementById('battle-bg-canvas');
      var vsCv = document.getElementById('battle-vs-canvas');
      if (bgCv) bgCv.getContext('2d').clearRect(0, 0, bgCv.width, bgCv.height);
      if (vsCv) vsCv.getContext('2d').clearRect(0, 0, vsCv.width, vsCv.height);
    }



    // ══════════════════════════════════════════════════════════════
    // BESTIAIS & ANGELICAIS — mecânicas de captura especial
    // ══════════════════════════════════════════════════════════════

    // Rastrear vitórias consecutivas contra uma criatura bestial específica
    // G._bestialWins = { creatureName: count }

    function isBestialCreature(enemy) {
      if (enemy.tier === 'bestial') return true;
      var tpl = TPLS.find(function (t) { return t.name === enemy.name; });
      return tpl && tpl.tier === 'bestial';
    }

    function isAngelicCreature(enemy) {
      if (enemy.tier === 'angelic') return true;
      var tpl = TPLS.find(function (t) { return t.name === enemy.name; });
      return tpl && tpl.tier === 'angelic';
    }

    function canCaptureBestial(enemy) {
      // Requer 3 vitórias consecutivas contra essa criatura específica
      if (!G._bestialWins) G._bestialWins = {};
      var wins = G._bestialWins[enemy.name] || 0;
      return wins >= 2; // 3 vitórias (0,1,2 → captura na 3ª)
    }

    function recordBestialWin(enemy) {
      if (!G._bestialWins) G._bestialWins = {};
      G._bestialWins[enemy.name] = (G._bestialWins[enemy.name] || 0) + 1;
      var wins = G._bestialWins[enemy.name];
      if (wins < 3) {
        var left = 3 - wins;
        notify('🐾 ' + enemy.name + ' domado ' + wins + '/3 vezes. Faltam ' + left + ' para poder vincular!');
      }
    }

    function canCaptureAngelic(enemy) {
      // Requer herói com HP <= 20% ("prova de devoção")
      var h = G.hero;
      if (!h) return false;
      return (h.hp / h.maxHp) <= 0.20;
    }

    function getBestialSpawnChance(aIdx) {
      // Bestiais só aparecem em áreas com evolução alta
      var kills = G.areaKills ? (G.areaKills[aIdx] || 0) : 0;
      if (kills < 30) return 0;       // < 30 kills: nunca
      if (kills < 60) return 0.04;    // 30-60: 4%
      if (kills < 100) return 0.08;   // 60-100: 8%
      return 0.12;                     // 100+: 12%
    }

    function getAngelicEventActive() {
      // Angelicais aparecem durante eventos especiais
      // Por enquanto: 5% de chance por batalha em planos 2+
      if (!G || G.plane < 1) return false;
      return Math.random() < 0.05;
    }

    // Hook no sistema de captura para validar Bestiais e Angelicais
    var _origTryCapture = null;
    function tryCapture() {
      if (!G.battle || G.battle.over) return;
      var en = G.battle.enemy;

      // Verificar se é Bestial
      if (isBestialCreature(en)) {
        if (!canCaptureBestial(en)) {
          var wins = (G._bestialWins && G._bestialWins[en.name]) || 0;
          var left = 3 - wins;
          addLog('🐾 Criatura Bestial! Derrote-a mais ' + left + ' vez(es) para domar.', 'sys');
          notify('🐾 Bestial: ' + left + ' vitórias até o vínculo');
          return;
        }
        addLog('🐾 ' + en.name + ' foi domado após 3 batalhas! Iniciando vínculo...', 'evt');
      }

      // Verificar se é Angelical
      if (isAngelicCreature(en)) {
        if (!canCaptureAngelic(en)) {
          addLog('⭐ Criatura Angelical! Requer Prova de Devoção — entre em batalha com HP ≤ 20%.', 'sys');
          notify('⭐ Angelical: entre com HP crítico para vincular');
          return;
        }
        addLog('⭐ ' + en.name + ' reconhece sua devoção! Iniciando vínculo sagrado...', 'evt');
      }

      // HP alto demais (verificação normal)
      if (en.hp / en.maxHp >= 0.25 && !isBestialCreature(en) && !isAngelicCreature(en)) {
        addLog('HP alto demais para vincular!', 'sys'); return;
      }

      showCapAnim(en);
    }

    // Registrar vitória contra Bestial após batalha

  


    function onBattleWinBestialCheck() {
      if (!G.battle || !G.battle.enemy) return;
      var en = G.battle.enemy;
      if (isBestialCreature(en)) {
        recordBestialWin(en);
      }
    }

    // Indicador visual na batalha: badge de tier especial
    function renderTierBadge(enemy) {
      if (!enemy) return '';
      if (enemy.isAscended) {
        return '<span style="font-size:.80rem;background:rgba(212,160,23,.2);border:1px solid rgba(255,215,0,.5);color:#ffd700;padding:1px 6px;border-radius:3px;letter-spacing:.05em;text-shadow:0 0 6px rgba(255,215,0,.4)">☆ ASCENDIDO</span>';
      }
      if (enemy.isBossEnemy) {
        return '<span style="font-size:.80rem;background:rgba(200,60,40,.2);border:1px solid rgba(200,60,40,.5);color:#e06040;padding:1px 6px;border-radius:3px;letter-spacing:.05em">⚔ CHEFE</span>';
      }
      if (enemy.tier === 'bestial' || (typeof isBestialCreature === 'function' && isBestialCreature(enemy))) {
        return '<span style="font-size:.80rem;background:rgba(200,80,40,.25);border:1px solid rgba(200,80,40,.5);color:#e06040;padding:1px 6px;border-radius:3px;letter-spacing:.05em">🐾 BESTIAL</span>';
      }
      if (enemy.tier === 'angelic' || (typeof isAngelicCreature === 'function' && isAngelicCreature(enemy))) {
        return '<span style="font-size:.80rem;background:rgba(200,220,255,.15);border:1px solid rgba(200,220,255,.4);color:#c8dcff;padding:1px 6px;border-radius:3px;letter-spacing:.05em">⭐ ANGELICAL</span>';
      }
      if (enemy.isHybrid) {
        return '<span style="font-size:.80rem;background:rgba(255,200,50,.1);border:1px solid rgba(255,200,50,.3);color:#ffcc44;padding:1px 6px;border-radius:3px;letter-spacing:.05em">✦ HÍBRIDO</span>';
      }
      return '';
    }

    // ══════════════════════════════════════════════════════════════
    // GRIMÓRIO ANIMADO — captura de criaturas
    // ══════════════════════════════════════════════════════════════

    var _capAnim = null;
    var _capAnimState = 'open'; // 'open' | 'scanning' | 'success' | 'fail'
    var _capAnimT = 0;
    var _capCreature = null;
    var _capElColor = { r: 140, g: 60, b: 200 }; // roxo padrão

    var EL_CAP_COLORS = {
      fire: { r: 232, g: 80, b: 50 },
      water: { r: 60, g: 140, b: 220 },
      earth: { r: 80, g: 160, b: 80 },
      nature: { r: 80, g: 160, b: 80 },
      dark: { r: 140, g: 50, b: 200 },
      light: { r: 240, g: 210, b: 80 },
      electric: { r: 220, g: 200, b: 40 },
      bestial: { r: 200, g: 80, b: 40 },
      angelic: { r: 200, g: 220, b: 255 }
    };

    function startGrimoireAnim(enemy, success, onResult) {
      var cv = document.getElementById('cap-canvas');
      if (!cv) { onResult(); return; }
      var ctx = cv.getContext('2d');
      var W = cv.width, H = cv.height;
      var col = EL_CAP_COLORS[enemy.el] || _capElColor;
      _capCreature = enemy;
      _capAnimT = 0;
      _capAnimState = 'open';

      // Partículas da criatura
      var particles = [];
      for (var i = 0; i < 60; i++) {
        var angle = Math.random() * Math.PI * 2;
        var dist = 30 + Math.random() * 70;
        particles.push({
          x: W / 2 + Math.cos(angle) * dist,
          y: H / 2 - 20 + Math.sin(angle) * dist,
          tx: W / 2 + (Math.random() - 0.5) * 20,
          ty: H / 2 - 20 + (Math.random() - 0.5) * 20,
          r: 1.5 + Math.random() * 3,
          alpha: 0.3 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
          col: col
        });
      }

      // Runas ao redor
      var RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ'];
      var runeAngs = RUNES.map(function (r, i) { return (i / RUNES.length) * Math.PI * 2; });

      // Durations (em frames a 60fps)
      // open: 0..80, scanning: 80..180, result: 180+
      var OPEN_END = 80, SCAN_END = 180;

      if (_capAnim) cancelAnimationFrame(_capAnim);

      function frame() {
        _capAnimT++;
        var t = _capAnimT;
        ctx.clearRect(0, 0, W, H);

        // ── Fundo do grimório ──
        var bookW = 260, bookH = 200, bx = W / 2 - bookW / 2, by = H / 2 - bookH / 2 + 10;

        // Abertura do livro (t: 0→80): páginas se dobrando de fechado para aberto
        var openProg = Math.min(1, t / OPEN_END);
        var easeOpen = 1 - Math.pow(1 - openProg, 3); // ease-out cubic

        // Capa do grimório (sempre visível)
        ctx.save();
        var coverAlpha = 1;
        ctx.globalAlpha = coverAlpha;
        // Sombra do livro
        ctx.shadowColor = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.5)';
        ctx.shadowBlur = 20 + 10 * Math.sin(t * 0.05);

        // Página direita (estática)
        ctx.fillStyle = '#1a1228';
        ctx.beginPath();
        ctx.roundRect(W / 2, by, bookW / 2, bookH, [0, 6, 6, 0]);
        ctx.fill();
        ctx.strokeStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Página esquerda (animada — abre da direita para a esquerda)
        var pageFlip = easeOpen; // 0=fechado (tudo à direita) → 1=aberto (metade esquerda)
        ctx.save();
        ctx.translate(W / 2, by + bookH / 2);
        ctx.scale(-pageFlip, 1); // escala X de 0→1 (flip de abertura)
        ctx.fillStyle = '#150f22';
        ctx.beginPath();
        ctx.roundRect(0, -bookH / 2, bookW / 2, bookH, [6, 0, 0, 6]);
        ctx.fill();
        ctx.strokeStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Linhas de texto na página esquerda (quando aberta)
        if (pageFlip > 0.3) {
          ctx.globalAlpha = (pageFlip - 0.3) / 0.7;
          ctx.fillStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.25)';
          for (var li = 0; li < 8; li++) {
            var lw = (20 + Math.random() * 40) * (0.3 + Math.random() * 0.7);
            ctx.fillRect(8, -bookH / 2 + 18 + li * 18, lw, 2);
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Linha central do grimório
        ctx.strokeStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W / 2, by);
        ctx.lineTo(W / 2, by + bookH);
        ctx.stroke();
        ctx.restore();

        // ── Símbolo central na página direita ──
        if (t > OPEN_END * 0.5) {
          var symAlpha = Math.min(1, (t - OPEN_END * 0.5) / 30);
          ctx.save();
          ctx.globalAlpha = symAlpha;
          ctx.font = 'bold 2.5rem "Cinzel Decorative", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.7)';
          ctx.shadowColor = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.8)';
          ctx.shadowBlur = 15;
          // Símbolo do elemento
          var elSymbols = { fire: '🔥', water: '💧', earth: '🌿', dark: '☽', light: '✦', electric: '⚡', nature: '🌱', bestial: '🐾', angelic: '⭐' };
          var sym = elSymbols[enemy.el] || '᛭';
          ctx.fillText(sym, W / 2 + bookW / 4, by + bookH / 2);
          ctx.restore();
        }

        // ── Runas girando (fase scanning) ──
        if (t > OPEN_END) {
          var runeAlpha = Math.min(1, (t - OPEN_END) / 20);
          var runeRadius = 110 + 10 * Math.sin(t * 0.04);
          var runeSpeed = t > SCAN_END ? 0 : (t - OPEN_END) / (SCAN_END - OPEN_END);

          ctx.save();
          ctx.globalAlpha = runeAlpha * 0.75;
          ctx.font = '1rem serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          RUNES.forEach(function (rune, ri) {
            var ang = runeAngs[ri] + (t * 0.025 * runeSpeed);
            var rx = W / 2 + Math.cos(ang) * runeRadius;
            var ry = H / 2 - 10 + Math.sin(ang) * runeRadius * 0.55;
            var hue = (ri / RUNES.length * 360 + t) % 360;
            ctx.fillStyle = 'hsl(' + hue + ',60%,65%)';
            ctx.shadowColor = 'hsl(' + hue + ',80%,55%)';
            ctx.shadowBlur = 6;
            ctx.fillText(rune, rx, ry);
          });
          ctx.restore();
        }

        // ── Partículas: flutuam durante scanning, convergem no sucesso ──
        if (t > OPEN_END) {
          var pProg = Math.min(1, (t - OPEN_END) / 60);
          particles.forEach(function (p) {
            var px = p.x + (p.tx - p.x) * pProg + Math.sin(t * 0.04 + p.phase) * 4;
            var py = p.y + (p.ty - p.y) * pProg + Math.cos(t * 0.03 + p.phase) * 3;
            var blink = 0.5 + 0.5 * Math.sin(t * 0.08 + p.phase);
            ctx.beginPath();
            ctx.arc(px, py, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + p.col.r + ',' + p.col.g + ',' + p.col.b + ',' + (p.alpha * blink) + ')';
            ctx.fill();
          });
        }

        // ── Nome da criatura (aparece ao centro) ──
        if (t > OPEN_END + 20) {
          var nameAlpha = Math.min(1, (t - OPEN_END - 20) / 25);
          ctx.save();
          ctx.globalAlpha = nameAlpha;
          ctx.font = '0.8rem "Cinzel", serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.fillText(enemy.name, W / 2, by - 22);
          ctx.fillStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.5)';
          ctx.font = '0.6rem "Cinzel", serif';
          ctx.fillText('Nv.' + (enemy.level || 1), W / 2, by - 8);
          ctx.restore();
        }

        // ── Barra de progresso de leitura ──
        if (t > OPEN_END && t <= SCAN_END) {
          var barProg = (t - OPEN_END) / (SCAN_END - OPEN_END);
          var barW = bookW * 0.8;
          var bx2 = W / 2 - barW / 2, by2 = by + bookH + 16;
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.beginPath(); ctx.roundRect(bx2, by2, barW, 4, 2); ctx.fill();
          ctx.fillStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.7)';
          ctx.beginPath(); ctx.roundRect(bx2, by2, barW * barProg, 4, 2); ctx.fill();

          ctx.font = '0.55rem "Cinzel", serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillText('Consultando o Grimório...', W / 2, by2 + 16);
        }

        // ── Resultado: sucesso ──
        if (_capAnimState === 'success' && t > SCAN_END) {
          var resProg = Math.min(1, (t - SCAN_END) / 40);
          // Flash de luz
          ctx.save();
          ctx.globalAlpha = Math.max(0, 0.6 - resProg * 0.8);
          ctx.fillStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',1)';
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
          // Símbolo de sucesso
          ctx.save();
          ctx.globalAlpha = resProg;
          ctx.font = 'bold 2.8rem "Cinzel Decorative", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',0.9)';
          ctx.shadowColor = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',1)';
          ctx.shadowBlur = 30;
          ctx.fillText('᛭', W / 2, H / 2 - 40);
          // Texto VINCULADO
          ctx.font = 'bold 1.2rem "Cinzel", serif';
          ctx.fillStyle = 'rgba(120,240,160,' + resProg + ')';
          ctx.shadowColor = 'rgba(80,200,120,0.8)';
          ctx.shadowBlur = 15;
          ctx.fillText('✦ VINCULADO! ✦', W / 2, H / 2 + 20);
          ctx.restore();
          if (resProg >= 1) {
            cancelAnimationFrame(_capAnim); _capAnim = null;
            onResult(true); return;
          }
        }

        // ── Resultado: falha ──
        if (_capAnimState === 'fail' && t > SCAN_END) {
          var failProg = Math.min(1, (t - SCAN_END) / 50);
          // Livro fechando
          ctx.save();
          ctx.globalAlpha = Math.min(1, failProg * 2);
          ctx.fillStyle = 'rgba(0,0,0,' + (failProg * 0.7) + ')';
          ctx.fillRect(bx, by, bookW, bookH);
          // Fumaça
          for (var si = 0; si < 8; si++) {
            var sa = 0.3 - failProg * 0.3 + Math.random() * 0.15;
            var sx = W / 2 + (Math.random() - 0.5) * 80;
            var sy = by - failProg * 40 - Math.random() * 30;
            var sr = 6 + Math.random() * 12;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(100,80,80,' + sa + ')';
            ctx.fill();
          }
          ctx.restore();
          // Texto RESISTIU
          if (failProg > 0.4) {
            ctx.save();
            ctx.globalAlpha = (failProg - 0.4) / 0.6;
            ctx.font = 'bold 1.1rem "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(240,80,80,' + ctx.globalAlpha + ')';
            ctx.shadowColor = 'rgba(200,50,50,0.8)';
            ctx.shadowBlur = 12;
            ctx.fillText('✗ RESISTIU AO GRIMÓRIO ✗', W / 2, H / 2 + 20);
            ctx.restore();
          }
          if (failProg >= 1) {
            cancelAnimationFrame(_capAnim); _capAnim = null;
            onResult(false); return;
          }
        }

        // Disparar resultado quando scan termina
        if (t === SCAN_END) {
          _capAnimState = success ? 'success' : 'fail';
        }

        _capAnim = requestAnimationFrame(frame);
      }

      frame();

    }



    // ══════════════════════════════════════════════════════════════
    // BATALHAS DE TERRITÓRIO + ECOSSISTEMA VIVO
    // ══════════════════════════════════════════════════════════════

    // Rastreia quanto tempo (em ticks) o jogador ignorou cada área
    // G._areaNeglect[aIdx] = ticks sem kill nessa área
    var _ecoTickInterval = null;
    var ECO_TICK_MS = 45000; // tick a cada 45s

    // Tabela predador/presa por bioma
    var PREDATOR_PREY = {
      0: { predator: 'Grifo Cinza', prey: 'Rastejador' },
      1: { predator: 'Lobo das Sombras', prey: 'Sombra Verde' },
      2: { predator: 'Corvus Sombrio', prey: 'Braseiro' },
      3: { predator: 'Véu Sombrio', prey: 'Espectro' },
      4: { predator: 'Harpia Solar', prey: 'Fungo Saltador' },
      5: { predator: 'Falcão Trovão', prey: 'Cinzeiro' }
    };

    function initEcosystem() {
      if (_ecoTickInterval) clearInterval(_ecoTickInterval);
      if (!G._areaNeglect) G._areaNeglect = [0, 0, 0, 0, 0, 0];
      if (!G._ecoBalance) G._ecoBalance = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0]; // 0.5=presa domina, 2.0=predador domina
      _ecoTickInterval = setInterval(ecoTick, ECO_TICK_MS);
    }


    // ══════════════════════════════════════════════════════════════
    // INDICADOR DE ECOSSISTEMA NO HUD
    // ══════════════════════════════════════════════════════════════
    function renderEcoHUD() {
      var el = document.getElementById('eco-hud-panel') || document.getElementById('eco-hud');
      if (!el) return;
      if (!G || !G._ecoBalance) { el.style.display = 'none'; return; }
      var anyUnbalanced = G._ecoBalance.some(function (b) { return b < 0.7 || b > 1.4; });
      if (!anyUnbalanced && (!G._areaNeglect || G._areaNeglect.every(function (n) { return n < 3; }))) {
        el.style.display = 'none'; return;
      }
      el.style.display = 'block';
      var html = '<div style="font-size:.86rem;color:rgba(255,255,255,.5);letter-spacing:.1em;margin-bottom:5px;font-family:Cinzel,serif">ECOSSISTEMA</div>';
      var areaNames = ['Floresta', 'Charneca', 'Abismo', 'Pântano', 'Planície', 'Vulcão'];
      for (var i = 0; i < 6; i++) {
        var balance = (G._ecoBalance && G._ecoBalance[i]) || 1.0;
        var neglect = (G._areaNeglect && G._areaNeglect[i]) || 0;
        if (balance >= 0.85 && balance <= 1.2 && neglect < 3) continue;
        var status, col, desc;
        if (neglect >= 5) { status = '⚠ ' + (areaNames[i] || 'Área ' + (i + 1)); col = '#e06040'; desc = 'Território expandido'; }
        else if (balance > 1.3) { status = '🐾 ' + (areaNames[i] || 'Área ' + (i + 1)); col = '#e08040'; desc = 'Predadores dominantes'; }
        else if (balance < 0.7) { status = '🍄 ' + (areaNames[i] || 'Área ' + (i + 1)); col = '#80c060'; desc = 'Presas proliferando'; }
        else continue;
        html += '<div style="margin:3px 0">' +
          '<span style="font-size:.7rem;color:' + col + ';font-family:Cinzel,serif">' + status + '</span>' +
          '<div style="font-size:1.1rem;color:rgba(255,255,255,.4);margin-left:4px">' + desc + '</div>' +
          '</div>';
      }
      el.innerHTML = html;
    }


    //   for (var aIdx = 0; aIdx < 6; aIdx++) {
    //     // Incrementar negligência em áreas que o jogador não visita
    //     if (aIdx !== playerArea) {
    //       G._areaNeglect[aIdx] = (G._areaNeglect[aIdx] || 0) + 1;
    //     } else {
    //       // Área ativa: resetar negligência
    //       G._areaNeglect[aIdx] = 0;
    //     }

    //     var neglect = G._areaNeglect[aIdx];
    //     var balance = G._ecoBalance[aIdx] || 1.0;

    //     // Após 3 ticks sem visita: predadores crescem (mais agressivos, mais fortes)
    //     if (neglect >= 3 && neglect < 8) {
    //       G._ecoBalance[aIdx] = Math.min(2.5, balance + 0.15);
    //       if (neglect === 3) {
    //         var pp = PREDATOR_PREY[aIdx];
    //         if (pp) addLog('⚠ Área ' + (aIdx + 1) + ': ' + pp.predator + ' está dominando!', 'sys');
    //       }
    //     }
    //     // Após 8 ticks: colapso — presas dominam, predadores fugiram
    //     else if (neglect >= 8) {
    //       G._ecoBalance[aIdx] = Math.max(0.3, balance - 0.2);
    //       if (neglect === 8) {
    //         var pp2 = PREDATOR_PREY[aIdx];
    //         if (pp2) addLog('⚠ Área ' + (aIdx + 1) + ': ' + pp2.prey + ' se proliferou! Drops mudados.', 'sys');
    //       }
    //     }
    //   }
    //   if (typeof renderEcoHUD === 'function') renderEcoHUD();
    // }




    // ══ BATALHAS DE TERRITÓRIO ══
    // Zonas de influência que crescem se ignoradas

    var _territoryWarnings = {}; // aIdx → last warn time


    // ══════════════════════════════════════════════════════════════
    // CICATRIZ PERMANENTE — criaturas sobreviventes com HP crítico
    // ══════════════════════════════════════════════════════════════


    // Chamado quando a batalha termina (vitória)

    // Aplicar modificadores visuais de cicatriz no mesh da batalha
    function applyScarVisuals(mesh, creature) {
      if (!creature || !creature._scars || creature._scars.length === 0) return;
      if (typeof THREE === 'undefined') return; // guard: THREE.js necessário
      var scarCount = creature._scars.length;
      // Escurecer levemente o mesh com base no número de cicatrizes
      mesh.traverse(function (obj) {
        if (obj.isMesh && obj.material) {
          var mat = obj.material;
          // Tinge levemente de vermelho-escuro para cicatrizes de batalha
          if (mat.color) {
            var scarTint = new THREE.Color(0x220000);
            mat.color.lerp(scarTint, scarCount * 0.06);
          }
        }
      });
      // Adicionar marcas visuais de cicatriz (pequenos cubos escuros na frente do mesh)
      var scarColors = { slash: 0x8a1a00, burn: 0x2a1a00, claw: 0x1a1a2a, bite: 0x3a0a0a, void: 0x1a0a2a };
      creature._scars.forEach(function (scar, i) {
        var scarMat = new THREE.MeshStandardMaterial({
          color: scarColors[scar.type] || 0x220000,
          roughness: 0.9, emissive: new THREE.Color(scarColors[scar.type] || 0x220000),
          emissiveIntensity: 0.2
        });
        var scarMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08 + i * 0.02, 0.02), scarMat);
        // Posicionar na frente do torso, deslocado por índice
        scarMesh.position.set((i - 1) * 0.08, 0.5 + i * 0.1, 0.35);
        scarMesh.rotation.z = (Math.random() - 0.5) * 0.5;
        mesh.add(scarMesh);
      });
    }

    // ══════════════════════════════════════════════════════════════
    // BATTLE CONSUMABLES — catálogo + funções de uso em batalha
    // ══════════════════════════════════════════════════════════════

    function toggleBattleItems() {
      var panel = document.getElementById('battle-items-panel');
      if (!panel) return;
      if (panel.style.display === 'none' || !panel.style.display) {
        renderBattleItemsPanel();
        panel.style.display = 'flex';
      } else {
        panel.style.display = 'none';
      }
    }

    function renderBattleItemsPanel() {
      var panel = document.getElementById('battle-items-panel');
      if (!panel) return;
      var items = (G.items || []).filter(function (i) { return BATTLE_ITEMS[i.id] && (i.qty || 0) > 0; });
      if (!items.length) {
        panel.innerHTML = '<span style="font-size:1.1rem;color:#666;padding:4px">Nenhum item disponível. Compre no Vendor!</span>';
        return;
      }
      var html = '';
      items.forEach(function (inv) {
        var bi = BATTLE_ITEMS[inv.id];
        if (!bi) return;
        html += "<button onclick=\"useBattleItem('" + inv.id + "')\""
          + " style=\"display:flex;flex-direction:column;align-items:center;gap:2px;"
          + "padding:6px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);"
          + "border-radius:5px;cursor:pointer;min-width:60px;color:#ddd\">"
          + "<span style=\"font-size:1.1rem\">" + bi.icon + "</span>"
          + "<span style=\"font-size:.80rem;color:#bbb;text-align:center;line-height:1.2\">" + bi.name + "</span>"
          + "<span style=\"font-size:.5rem;color:#888\">" + bi.desc + "</span>"
          + "<span style=\"font-size:1.04rem;color:#6a8;margin-top:1px\">x" + (inv.qty || 1) + "</span>"
          + "</button>";
      });
      panel.innerHTML = html;
    }

    function useBattleItem(id) {
      if (!G.battle || G.battle.over) return;
      var inv = (G.items || []).find(function (i) { return i.id === id; });
      var bi = BATTLE_ITEMS[id];
      if (!inv || !bi || (inv.qty || 0) <= 0) { notify('Item indisponível!'); return; }
      var my = ac ? ac() : null;
      if (!my) return;

      if (bi.type === 'heal') {
        var heal = Math.floor(my.maxHp * bi.val);
        my.hp = Math.min(my.maxHp, my.hp + heal);
        addLog(bi.icon + ' ' + my.name + ' recuperou ' + heal + ' HP!', 'evt');
        sfx && sfx('heal');
      } else if (bi.type === 'buff_atk') {
        if (!G.battle.mySt) G.battle.mySt = {};
        G.battle.mySt._atkBoost = (G.battle.mySt._atkBoost || 0) + bi.val;
        G.battle.mySt._atkBoostVal = 1.20;
        addLog(bi.icon + ' ATQ +20% por ' + bi.val + ' turnos!', 'evt');
      } else if (bi.type === 'buff_def') {
        if (!G.battle.mySt) G.battle.mySt = {};
        G.battle.mySt._defBoost = (G.battle.mySt._defBoost || 0) + bi.val;
        G.battle.mySt._defBoostVal = 1.20;
        addLog(bi.icon + ' DEF +20% por ' + bi.val + ' turnos!', 'evt');
      } else if (bi.type === 'cleanse') {
        if (G.battle.mySt) { G.battle.mySt.poison = 0; G.battle.mySt.burn = 0; }
        addLog(bi.icon + ' Veneno e queimadura removidos!', 'evt');
      } else if (bi.type === 'damage') {
        var dmg = Math.floor(20 + Math.random() * 15);
        var en = G.battle.enemy;
        if (en) {
          en.hp = Math.max(0, en.hp - dmg);
          addLog(bi.icon + ' Bomba! ' + dmg + ' de dano ao ' + en.name + '!', 'evt');
          floatDmg && floatDmg('en-dmg-float', dmg, '#ff8833');
          sfx && sfx('hit');
        }
      }

      // Consumir item
      inv.qty = (inv.qty || 1) - 1;
      if (inv.qty <= 0) G.items = G.items.filter(function (i) { return i.id !== id || (i.qty || 0) > 0; });

      // Atualizar painel e batalha
      renderBattleItemsPanel();
      renderBattle && renderBattle();
      var panel = document.getElementById('battle-items-panel');
      if (panel && panel.style.display !== 'none') renderBattleItemsPanel();
    }

    // ══════════════════════════════════════════════════════════════
    // POST-BOSS VENDOR — opens after boss defeated in that area
    // Special tile 'boss_vendor' spawned near boss lair
    // ══════════════════════════════════════════════════════════════
    function openPostBossVendor(aIdx) {
      var ov = document.getElementById('pbv-ov');
      if (!ov) return;
      OW.keys = { w: 0, a: 0, s: 0, d: 0 };
      renderPostBossVendor(aIdx);
      ov.style.display = 'flex';
      ov._aIdx = aIdx;
    }
    function closePostBossVendor() {
      var ov = document.getElementById('pbv-ov');
      if (ov) ov.style.display = 'none';
    }
    function renderPostBossVendor(aIdx) {
      var area = AREAS[aIdx] || AREAS[0];
      var stock = (typeof POST_BOSS_STOCK !== 'undefined') ? (POST_BOSS_STOCK[aIdx] || []) : [];
      document.getElementById('pbv-title').textContent = area.name.toUpperCase() + ' — LEGADOS DO CHEFE';
      document.getElementById('pbv-sub').textContent = 'Derrotar ' + area.boss.name + ' revelou estes itens únicos.';
      document.getElementById('pbv-souls').innerHTML = 'Almas: <span style="color:#c9933a">' + G.souls + '</span>';
      var html = '';
      stock.forEach(function (item) {
        var can = G.souls >= item.cost;
        var bought = G._pbvBought && G._pbvBought[item.id];
        html += '<div class="pbv-card' + (!can || bought ? ' pbv-disabled' : '') + '" onclick="buyPostBossItem(\'' + aIdx + '\',\'' + item.id + '\')">' +
          '<div class="pbv-icon">' + item.icon + '</div>' +
          '<div class="pbv-info">' +
          '<div class="pbv-name">' + item.name + (bought ? ' <span style="color:#4a8a4a;font-size:.5rem">✓ Comprado</span>' : '') + '</div>' +
          '<div class="pbv-desc">' + item.desc + '</div>' +
          '</div>' +
          '<div class="pbv-cost' + (can ? '' : ' pbv-broke') + '">' + item.cost + ' ☽</div>' +
          '</div>';
      });
      document.getElementById('pbv-grid').innerHTML = html;
    }
    function buyPostBossItem(aIdx, itemId) {
      aIdx = parseInt(aIdx);
      var stock = (typeof POST_BOSS_STOCK !== 'undefined') ? (POST_BOSS_STOCK[aIdx] || []) : [];
      var item = stock.find(function (i) { return i.id === itemId; });
      if (!item) return;
      if (G.souls < item.cost) { notify('Almas insuficientes!'); return; }
      if (!G._pbvBought) G._pbvBought = {};
      if (G._pbvBought[itemId]) { notify('Já comprado!'); return; }
      G.souls -= item.cost;
      G._pbvBought[itemId] = true;

      var ef = item.effect;
      var firstAlive = G.team && G.team.find(function (c) { return c && !c.dead; });

      if (ef === 'perm_def_3') { if (firstAlive) firstAlive.def += 3; notify(item.icon + ' +3 DEF para ' + (firstAlive ? firstAlive.name : 'grupo') + '!'); }
      else if (ef === 'team_maxhp_15') { G.team.forEach(function (c) { if (c && !c.dead) { var add = Math.floor(c.maxHp * 0.15); c.maxHp += add; c.hp += add; } }); notify(item.icon + ' +15% HP máximo do grupo!'); }
      else if (ef === 'rez_last') {
        var last = (G.dead || []).slice(-1)[0];
        if (last) {
          last.dead = false;
          last.hp = Math.floor(last.maxHp * 0.5);
          G.dead = G.dead.filter(function (c) { return c !== last; });
          // Add to team if slot available (count only non-dead alive slots)
          var aliveInTeam = G.team.filter(function (x) { return x && !x.dead; }).length;
          if (aliveInTeam < 3) {
            G.team.push(last);
            notify(item.icon + ' ' + last.name + ' ressuscitou e voltou ao grupo!');
          } else {
            G.hall.unshift(last);
            notify(item.icon + ' ' + last.name + ' ressuscitou e foi para o Hall!');
          }
          saveGame(); renderExplore();
        }
      }
      else if (ef === 'perm_atk_4') { if (firstAlive) firstAlive.atk += 4; notify(item.icon + ' +4 ATQ para ' + (firstAlive ? firstAlive.name : 'grupo') + '!'); }
      else if (ef === 'capture_boost') { if (!G.buffs) G.buffs = {}; G.buffs.capture_boost = true; notify(item.icon + ' Próxima captura +40% chance!'); }
      else if (ef === 'burn_immunity') { if (!G.buffs) G.buffs = {}; G.buffs.burn_immune = true; notify(item.icon + ' Grupo imune a queimadura!'); }
      else if (ef === 'hero_atk_5') { if (G.hero) G.hero.atk += 5; notify(item.icon + ' Herói +5 ATQ!'); renderHeroHUD(); }
      else if (ef === 'perm_lifesteal') { if (firstAlive) { if (!firstAlive.passives) firstAlive.passives = []; firstAlive.passives.push({ lvl: 1, id: 'lifesteal', name: 'Drenagem Abissal', desc: 'Rouba 15% do dano causado como HP' }); } notify(item.icon + ' Lifesteal adicionado!'); }
      else if (ef === 'soul_double') { if (!G.buffs) G.buffs = {}; G.buffs.soul_double = true; notify(item.icon + ' Almas dobradas ativas!'); }
      else if (ef === 'full_heal') { G.team.forEach(function (c) { if (c && !c.dead) { c.hp = c.maxHp; } }); if (G.hero) G.hero.hp = G.hero.maxHp; renderHeroHUD(); notify(item.icon + ' Grupo e herói curados completamente!'); }
      else if (ef === 'egg_hatch_fast') { if (G.viveiro) G.viveiro.forEach(function (e) { if (e.incubating) e.battlesLeft = Math.max(1, Math.floor(e.battlesLeft / 2)); }); notify(item.icon + ' Incubação acelerada!'); }
      else if (ef === 'storm_boost') { if (!G.buffs) G.buffs = {}; G.buffs.storm_boost = true; notify(item.icon + ' +10% dano elétrico ativo!'); }
      else if (ef === 'reveal_all') {
        if (!G.discoveredSpecials) G.discoveredSpecials = {};
        if (OW.grid) { Object.keys(OW.grid).forEach(function (k) { var cell = OW.grid[k]; if (cell && cell.special) G.discoveredSpecials[cell.special + ':' + k] = true; }); }
        OW._miniDirty = true; notify(item.icon + ' Todos os especiais revelados no minimapa!');
      }
      else if (ef.startsWith('rare_egg_') || ef.startsWith('leg_egg_')) {
        var rar = ef.startsWith('leg_') ? 'legendary' : 'rare';
        var elMap = { dark: 'dark', fire: 'fire', water: 'water', elec: 'electric' };
        var elKey = ef.split('_').pop();
        var el = elMap[elKey] || 'dark';
        addEufMaudit(el, rar);
        notify(item.icon + ' ' + item.name + ' adicionado ao Viveiro!');
      }

      renderPostBossVendor(aIdx);
      renderExpC();
      saveGame();
    }


    // ══════════════════════════════════════════════════════════════
    // TRILHA SONORA PROCEDURAL POR BIOMA
    // Cada bioma tem uma atmosfera musical gerada em tempo real
    // via Web Audio API oscillators + filters + reverb
    // ══════════════════════════════════════════════════════════════
    var _musicGainNode = null;
    var _musicNodes = []; // active oscillators/sources
    var _currentBiomeMusic = -1;
    var _musicFading = false;

    // Biome music profiles
    var BIOME_MUSIC = [
      // 0: Planície — melodia suave, harpa etérea
      { name: 'plains', baseFreq: 220, scale: [0, 3, 7, 10, 12, 15], tempo: 1.2, filterFreq: 1800, reverbWet: 0.4, droneFreq: 55, color: '#3a9e58' },
      // 1: Floresta — sons profundos, claustrofóbicos
      { name: 'forest', baseFreq: 146, scale: [0, 2, 5, 7, 10, 12], tempo: 0.8, filterFreq: 900, reverbWet: 0.6, droneFreq: 36, color: '#1a5c30' },
      // 2: Vulcânico — pulso grave, dissonância
      { name: 'volcanic', baseFreq: 110, scale: [0, 1, 5, 6, 10, 11], tempo: 1.5, filterFreq: 600, reverbWet: 0.3, droneFreq: 27, color: '#6e3010' },
      // 3: Abismo — espacial, etéreo, inquietante
      { name: 'void', baseFreq: 82, scale: [0, 2, 4, 6, 9, 11], tempo: 0.5, filterFreq: 2400, reverbWet: 0.5, droneFreq: 20, color: '#12141e' },
      // 4: Pântano — nebuloso, úmido, orgânico
      { name: 'swamp', baseFreq: 164, scale: [0, 2, 3, 7, 9, 12], tempo: 1.0, filterFreq: 700, reverbWet: 0.45, droneFreq: 41, color: '#1e4428' },
      // 5: Trovão — tenso, elétrico, ritmado
      { name: 'thunder', baseFreq: 184, scale: [0, 2, 5, 7, 11, 12], tempo: 1.8, filterFreq: 2800, reverbWet: 0.25, droneFreq: 46, color: '#4a5060' }
    ];

    // Battle music — dark pulse
    var BATTLE_MUSIC = { baseFreq: 160, scale: [0, 1, 5, 6, 10, 11], tempo: 2.2, filterFreq: 1200, reverbWet: 0.2, droneFreq: 40 };

    function createReverb(ctx, wet) {
      try {
        var conv = ctx.createConvolver();
        var sampleRate = ctx.sampleRate;
        var len = sampleRate * 2;
        var buf = ctx.createBuffer(2, len, sampleRate);
        for (var ch = 0; ch < 2; ch++) {
          var data = buf.getChannelData(ch);
          // Smoother decay + softer noise to reduce "fridge hum" artifacts
          for (var i = 0; i < len; i++) {
            var decay = Math.pow(1 - i / len, 4.0);
            // Average adjacent samples to smooth high-freq noise
            var noise = (Math.random() + Math.random() + Math.random()) / 3 * 2 - 1;
            data[i] = noise * decay * 0.6;
          }
        }
        conv.buffer = buf;
        var dryGain = ctx.createGain(); dryGain.gain.value = 1 - wet;
        var wetGain = ctx.createGain(); wetGain.gain.value = wet;
        // Return a simple object with connect method
        return {
          conv: conv, dryGain: dryGain, wetGain: wetGain,
          connect: function (dest) {
            dryGain.connect(dest); conv.connect(wetGain); wetGain.connect(dest);
            return { connect: function (src) { src.connect(dryGain); src.connect(conv); } };
          }
        };
      } catch (e) { return null; }
    }

    function stopMusic() {
      _musicNodes.forEach(function (n) { try { n.stop(0); } catch (e) { } try { n.disconnect(); } catch (e) { } });
      _musicNodes = [];
    }

    function startBiomeMusic(biomeIdx, isBattle) {
      var musicVol = getVolume('music', 0.35);
      if (musicVol <= 0.01) return;
      var ctx = getAudioCtx();
      if (!ctx) return;
      var profile = isBattle ? BATTLE_MUSIC : (BIOME_MUSIC[biomeIdx] || BIOME_MUSIC[0]);

      stopMusic();

      var masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);
      _musicGainNode = masterGain;

      // Fade in
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(musicVol, ctx.currentTime + 3.0);

      // 1. Sub drone — constant low rumble
      try {
        var drone = ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = profile.droneFreq;
        var droneGain = ctx.createGain();
        droneGain.gain.value = 0.08;
        var droneFilter = ctx.createBiquadFilter();
        droneFilter.type = 'lowpass';
        droneFilter.frequency.value = 180;
        drone.connect(droneFilter); droneFilter.connect(droneGain); droneGain.connect(masterGain);
        drone.start(0);
        _musicNodes.push(drone);
      } catch (e) { }

      // 2. Melodic arpeggio — notes from scale
      var scale = profile.scale;
      var base = profile.baseFreq;
      var tempoMs = Math.round(1000 / profile.tempo);
      var _arpeggioStep = 0;
      var _arpeggioInterval = setInterval(function () {
        if (!_musicGainNode || _musicNodes.length === 0) { clearInterval(_arpeggioInterval); return; }
        var ctx2 = getAudioCtx();
        if (!ctx2) return;
        var note = scale[_arpeggioStep % scale.length];
        var freq = base * Math.pow(2, note / 12);
        // Occasional octave up for interest
        if (Math.random() < 0.15) freq *= 2;

        try {
          var osc = ctx2.createOscillator();
          osc.type = biomeIdx === 2 ? 'sawtooth' : biomeIdx === 3 ? 'sine' : 'triangle';
          osc.frequency.value = freq;
          var noteGain = ctx2.createGain();
          var filt = ctx2.createBiquadFilter();
          filt.type = 'bandpass';
          filt.frequency.value = profile.filterFreq;
          filt.Q.value = 1.5;
          var vol = 0.055 + Math.random() * 0.02;
          noteGain.gain.setValueAtTime(0, ctx2.currentTime);
          noteGain.gain.linearRampToValueAtTime(vol, ctx2.currentTime + 0.05);
          noteGain.gain.linearRampToValueAtTime(0, ctx2.currentTime + (tempoMs / 1000) * 0.9);
          osc.connect(filt); filt.connect(noteGain); noteGain.connect(masterGain);
          osc.start(ctx2.currentTime);
          osc.stop(ctx2.currentTime + (tempoMs / 1000) * 1.1);
        } catch (e) { }
        _arpeggioStep++;
      }, tempoMs);
      // Store interval ref so we can clear it
      _musicNodes.push({ stop: function () { clearInterval(_arpeggioInterval); }, disconnect: function () { } });

      // 3. Pad — slow modulated tone
      try {
        var pad = ctx.createOscillator();
        pad.type = 'sine';
        pad.frequency.value = base * 1.5;
        var lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        var lfoGain = ctx.createGain();
        lfoGain.gain.value = base * 0.008;
        lfo.connect(lfoGain); lfoGain.connect(pad.frequency);
        var padGain = ctx.createGain();
        padGain.gain.value = 0.04;
        var padFilt = ctx.createBiquadFilter();
        padFilt.type = 'lowpass';
        padFilt.frequency.value = profile.filterFreq * 0.6;
        pad.connect(padFilt); padFilt.connect(padGain); padGain.connect(masterGain);
        pad.start(0); lfo.start(0);
        _musicNodes.push(pad, lfo);
      } catch (e) { }
    }

    function crossfadeBiomeMusic(newBiome, isBattle) {
      if (_currentBiomeMusic === newBiome && !isBattle) return;
      _currentBiomeMusic = newBiome;
      var musicVol = getVolume('music', 0.35);
      if (musicVol <= 0.01) { stopMusic(); return; }
      // Fade out old
      if (_musicGainNode) {
        try {
          _musicGainNode.gain.linearRampToValueAtTime(0, getAudioCtx().currentTime + 2.5);
        } catch (e) { }
        setTimeout(function () { startBiomeMusic(newBiome, isBattle); }, 2600);
      } else {
        startBiomeMusic(newBiome, isBattle);
      }
    }

    // Hook into biome detection in drawMapLoop
    var _lastMusicBiome = -1;
    function checkBiomeMusic() {
      if (!OW.grid) return;
      var cell = OW.grid[OW.player.x + ',' + OW.player.z];
      if (!cell) return;
      var bm = cell.biome !== undefined ? cell.biome : 0;
      if (bm !== _lastMusicBiome) {
        _lastMusicBiome = bm;
        crossfadeBiomeMusic(bm, false);
      }
    }
    // ══════════════════════════════════════════════════════════════
    // MENU DE PAUSA — tecla P ou ESC quando nenhum modal está aberto
    // ══════════════════════════════════════════════════════════════
    var _PAUSE_OVERLAY_IDS = ['random-event-ov', 'status-ov', 'viveiro-ov', 'relic-ov', 'hall-ov', 'dungeon-ov',
      'vendor-ov', 'sanc-ov', 'death-ov', 'pbv-ov', 'fusion-ov', 'items-ov', 'bestiary-ov', 'quests-ov'];

    function isAnyOverlayOpen() {
      // Only block pause if these specific overlays are actively shown via JS (style.display set to flex/block)
      var activeOvIds = ['random-event-ov', 'status-ov', 'viveiro-ov', 'relic-ov', 'vendor-ov', 'sanc-ov', 'pbv-ov', 'fusion-ov'];
      return activeOvIds.some(function (id) {
        var el = document.getElementById(id);
        return el && el.style.display && el.style.display !== 'none';
      });
    }

    function openPauseMenu() {
      if (isAnyOverlayOpen()) return;
      OW.keys = { w: 0, a: 0, s: 0, d: 0 };
      var ov = document.getElementById('pause-ov');
      if (!ov) return;
      ov.style.display = 'flex';
      try { renderSettingsPanel(); } catch (e) { }
    }
    function closePauseMenu() {
      document.getElementById('pause-ov').style.display = 'none';
    }

    function pauseSave() {
      manualSave();
      notify('✦ Jogo salvo.');
    }
    function pauseQuitToMenu() {
      closePauseMenu();
      if (G.regenInt) clearInterval(G.regenInt);
      destroyMap();
      showTitle();
    }

    // Settings — persisted in localStorage
    var SETTINGS_KEY = 'soulmon_settings';
    function loadSettings() {
      try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { return {}; }
    }
    function saveSettings(s) {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { }
    }
    function getVolume(key, def) {
      var s = loadSettings(); return (s[key] !== undefined) ? s[key] : def;
    }
    function setVolume(key, val) {
      var s = loadSettings(); s[key] = parseFloat(val); saveSettings(s);
      applyVolumeSettings();
    }
    function applyVolumeSettings() {
      if (typeof _musicGainNode !== 'undefined' && _musicGainNode) {
        _musicGainNode.gain.value = getVolume('music', 0.35);
      }
      // SFX volume applied per-sound via _sfxVolume global
      window._sfxVolume = getVolume('sfx', 0.7);
    }
    function renderSettingsPanel() {
      var s = loadSettings();
      var mv = (s.music !== undefined) ? s.music : 0.35;
      var sv = (s.sfx !== undefined) ? s.sfx : 0.70;
      var bv = (s.battle_speed !== undefined) ? s.battle_speed : 1;
      var uv = (s.ui_scale !== undefined) ? s.ui_scale : 1.0;
      document.getElementById('set-music-val').textContent = Math.round(mv * 100) + '%';
      document.getElementById('set-sfx-val').textContent = Math.round(sv * 100) + '%';
      document.getElementById('set-music-slider').value = mv;
      document.getElementById('set-sfx-slider').value = sv;
      document.getElementById('set-battle-speed').value = bv;
      var uiSlider = document.getElementById('set-ui-scale');
      var uiLabel = document.getElementById('set-ui-scale-val');
      if (uiSlider) uiSlider.value = uv;
      if (uiLabel) uiLabel.textContent = Math.round(uv * 100) + '%';
      applyUIScale(uv);
    }

    function setUIScale(val) {
      val = parseFloat(val);
      if (isNaN(val) || val < 0.5 || val > 2) return;
      var s = loadSettings();
      s.ui_scale = val;
      saveSettings(s);
      window._uiScale = val;
      var lbl = document.getElementById('set-ui-scale-val');
      if (lbl) lbl.textContent = Math.round(val * 100) + '%';
      applyUIScale(val);
    }

    function setUIScaleBattle(val) {
      val = parseFloat(val);
      if (isNaN(val) || val < 0.5 || val > 2) return;
      var s = loadSettings();
      s.ui_scale_battle = val;
      saveSettings(s);
      window._uiScaleBattle = val;
      var lbl = document.getElementById('set-ui-scale-battle-val');
      if (lbl) lbl.textContent = Math.round(val * 100) + '%';
      applyUIScaleBattle(val);
    }

    function applyUIScaleBattle(val) {
      val = parseFloat(val) || 1.0;
      window._uiScaleBattle = val;
      var pct = Math.round(val * 100) + '%';
      var zoomVal = val === 1.0 ? '' : pct;
      var battleHudClasses = [
        '.b-actions-float', '.cards-area', '.b-log',
        '.b-info', '.b-hp-row', '.b-xp-row'
      ];
      battleHudClasses.forEach(function (sel) {
        var els = document.querySelectorAll(sel);
        els.forEach(function (el) { el.style.zoom = zoomVal; });
      });
    }

    function applyUIScale(val) {
      val = parseFloat(val) || 1.0;
      window._uiScale = val;
      document.documentElement.style.setProperty('--ui-scale', val);
      var pct = Math.round(val * 100) + '%';
      var zoomVal = val === 1.0 ? '' : pct;

      // Elementos de HUD do mapa (explore)
      var exploreHudIds = [
        'hero-hud',          // card do personagem (canto superior esquerdo)
        'explore-topbar',    // barra superior (nome, almas, contadores)
        'explore-team',      // criaturas da equipe
        'minimap-panel',     // painel do mini mapa + ecossistema
        'explore-dock',      // barra de menus/ações inferior
        'mycreat',           // card criatura ativa
        'buff-bar',          // buffs
        'weather-hud',       // clima no mapa
        'day-hud',           // dia/noite
      ];
      exploreHudIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.zoom = zoomVal;
      });

      // Elementos de HUD da batalha
      var battleHudIds = [
        'my-wrap',           // container criatura jogador (não a arena, só info)
        'en-wrap',
      ];
      // Batalha tem escala própria — applyUIScaleBattle é chamado separadamente
      // (não escala elementos de batalha aqui)
    }

    // ══════════════════════════════════════════════════════════════
    // SCREEN TRANSITIONS — fade + symbol flash between map/battle
    // ══════════════════════════════════════════════════════════════
    function doScreenTransition(onMidpoint) {
      var el = document.getElementById('screen-transition');
      if (!el) { onMidpoint(); return; }
      el.style.opacity = '0';
      el.style.display = 'flex';
      el.style.transition = 'opacity 0.25s ease';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.style.opacity = '1';
          setTimeout(function () {
            onMidpoint();
            el.style.transition = 'opacity 0.35s ease';
            el.style.opacity = '0';
            setTimeout(function () { el.style.display = 'none'; }, 360);
          }, 260);
        });
      });
    }
    // ── RELIC SYSTEM ──
    function addRelic(id) {
      if (!G.relicInventory) G.relicInventory = [];
      if (G.relicInventory.indexOf(id) === -1) G.relicInventory.push(id);
    }

    function equipRelic(id) {
      if (!G.relicInventory || G.relicInventory.indexOf(id) === -1) return;
      G.equippedRelic = id;
      var def = RELIC_DEFS.find(function (r) { return r.id === id; });
      notify((def ? def.icon + ' ' : '') + 'Relíquia equipada: ' + (def ? def.name : id));
      renderRelicHUD();
      saveGame();
    }

    function unequipRelic() {
      G.equippedRelic = null;
      renderRelicHUD();
      saveGame();
    }

    function getEquippedRelic() {
      if (!G.equippedRelic) return null;
      return RELIC_DEFS ? RELIC_DEFS.find(function (r) { return r.id === G.equippedRelic; }) : null;
    }

    function renderRelicHUD() {
      var slot = document.getElementById('hh-relic-slot');
      if (!slot) return;
      var rel = getEquippedRelic();
      if (rel) {
        slot.innerHTML = '<span title="' + rel.name + ': ' + rel.desc + '">' + rel.icon + '</span>';
        slot.style.opacity = '1';
        slot.style.cursor = 'pointer';
        slot.onclick = function () { openRelicOverlay(); };
      } else {
        slot.innerHTML = '<span title="Nenhuma relíquia equipada">○</span>';
        slot.style.opacity = '0.35';
        slot.style.cursor = 'pointer';
        slot.onclick = function () { openRelicOverlay(); };
      }
    }

    function openRelicOverlay() {
      if (!G.relicInventory || !G.relicInventory.length) {
        notify('Você não possui nenhuma relíquia ainda.');
        return;
      }
      var html = '<div class="relic-overlay" id="relic-ov" onclick="if(event.target===this)closeRelicOverlay()" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:14px;overflow-y:auto;padding:24px 0;">';
      html += '<div style="font-family:Cinzel,serif;color:#c9933a;font-size:1.1rem;letter-spacing:.18em;margin-bottom:4px">RELÍQUIAS</div>';
      if (!G.relicInventory || !G.relicInventory.length) {
        html += '<div style="color:#aaa;font-size:1.1rem;font-style:italic;padding:20px">Nenhuma relíquia coletada.</div>';
      }
      (G.relicInventory || []).forEach(function (id) {
        var def = RELIC_DEFS ? RELIC_DEFS.find(function (r) { return r.id === id; }) : null;
        if (!def) return;
        var isEq = G.equippedRelic === id;
        html += '<div style="width:340px;background:rgba(14,10,28,0.96);border:1px solid ' + (isEq ? '#c9933a' : 'rgba(201,147,58,0.35)') + ';border-radius:8px;padding:16px 20px;cursor:pointer;transition:border-color .15s;" onclick="equipRelic(\'' + id + '\')">';
        html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">';
        html += '<span style="font-size:1.6rem">' + def.icon + '</span>';
        html += '<span style="font-family:Cinzel,serif;color:' + (isEq ? '#e8b860' : '#eee') + ';font-size:.88rem;font-weight:600">' + def.name + (isEq ? ' <span style="color:#c9933a;font-size:.98rem">✦ EQUIPADA</span>' : '') + '</span>';
        html += '</div>';
        html += '<div style="font-size:1.04rem;color:#cccccc;margin-bottom:6px;line-height:1.5">' + def.desc + '</div>';
        html += '<div style="font-size:.92rem;color:#aa9966;font-style:italic;line-height:1.4">' + def.flavor + '</div>';
        html += '</div>';
      });
      if (G.equippedRelic) {
        html += '<div style="font-size:.98rem;color:#aaa;cursor:pointer;margin-top:4px;padding:6px 14px;border:1px solid rgba(255,255,255,.15);border-radius:4px" onclick="unequipRelic();closeRelicOverlay()">Desequipar</div>';
      }
      html += '<div style="font-size:1.04rem;color:#ccc;margin-top:8px;cursor:pointer;padding:8px 20px;border:1px solid rgba(255,255,255,.2);border-radius:4px;font-family:Cinzel,serif;letter-spacing:.1em" onclick="closeRelicOverlay()">FECHAR</div>';
      html += '</div>';
      var el = document.createElement('div');
      el.id = 'relic-ov-wrap';
      el.innerHTML = html;
      document.body.appendChild(el);
    }

    function closeRelicOverlay() {
      var el = document.getElementById('relic-ov-wrap');
      if (el) el.remove();
    }
    function renderHeroHUD() {
      ensureHero();
      var h = G.hero;
      var wp = WEAPONS[h.weapon] || WEAPONS.sword;
      var hpPct = Math.max(0, h.hp / h.maxHp * 100);
      var xpPct = h.xpNext > 0 ? Math.min(100, h.xp / h.xpNext * 100) : 0;
      var ico = document.getElementById('hh-weapon-icon');
      var nm = document.getElementById('hh-hero-name');
      var hp = document.getElementById('hh-hp-bar');
      var xp = document.getElementById('hh-xp-bar');
      var lv = document.getElementById('hh-lv-text');
      if (ico) ico.textContent = wp.icon;
      if (nm) {
        var _cls = wp.className ? (' · ' + wp.className) : '';
        nm.textContent = (G.playerName || 'Cacador') + _cls;
      }
      if (hp) hp.style.width = hpPct + '%';
      if (xp) xp.style.width = xpPct + '%';
      if (lv) lv.textContent = 'Nv.' + h.level + ' · HP ' + h.hp + '/' + h.maxHp;

      // ── ALERTA VISUAL DE HP BAIXO ──
      var hud = document.getElementById('hero-hud');
      var vig = document.getElementById('hp-danger-vignette');
      var hpRatio = h.hp / h.maxHp;
      if (hud) {
        hud.classList.remove('danger-low', 'danger-critical');
        if (hpRatio <= 0.15) hud.classList.add('danger-critical');
        else if (hpRatio <= 0.30) hud.classList.add('danger-low');
      }
      if (vig) {
        vig.classList.remove('active-low', 'active-critical');
        if (hpRatio <= 0.15) vig.classList.add('active-critical');
        else if (hpRatio <= 0.30) vig.classList.add('active-low');
      }
      // Cor da barra de HP muda para vermelho intenso quando crítico
      if (hp) {
        if (hpRatio <= 0.15) hp.style.background = 'linear-gradient(90deg,#8b0000,#e74c3c)';
        else if (hpRatio <= 0.30) hp.style.background = 'linear-gradient(90deg,#c0392b,#e74c3c)';
        else if (hpRatio <= 0.60) hp.style.background = 'linear-gradient(90deg,#e67e22,#f39c12)';
        else hp.style.background = 'linear-gradient(90deg,#27ae60,#2ecc71)';
      }
      renderRelicHUD();
    }

    function heroHitFlash() {
      var el = document.getElementById('hero-hit-flash');
      if (!el) return;
      el.style.opacity = '1';
      setTimeout(function () { el.style.opacity = '0'; }, 120);
    }

    // ============================================================
    // MAP MOBS
    // ============================================================

    var MAP_MOBS = [];   // active mob entities
    var _mobMaterial = null;
    var _mobGeo = null;

    var MOB_DEFS = [
      // behavior: 'wander'=normal | 'patrol'=wider range, chases earlier |
      //           'ambush'=stays still, lunges when close | 'flock'=moves with nearby same-type |
      //           'timid'=flees player | 'stationary'=never moves voluntarily
      // ── Biome 0: Planície
      { color: 0x5aaa44, name: 'Rastejador', el: 'earth', atk: 6, def: 4, hp: 18, xp: 8, biomes: [0], shape: 'round', body: 'golem', behavior: 'patrol', aggroRange: 5 },
      { color: 0xc8b888, name: 'Grifo Cinza', el: 'light', atk: 9, def: 3, hp: 16, xp: 11, biomes: [0], shape: 'spiky', body: 'phantom', behavior: 'flock', aggroRange: 6 },
      { color: 0xcc3322, name: 'Fungo Saltador', el: 'nature', atk: 5, def: 7, hp: 22, xp: 9, biomes: [0, 4], shape: 'round', body: 'golem', behavior: 'stationary', aggroRange: 3 },
      // ── Biome 1: Floresta
      { color: 0x226622, name: 'Sombra Verde', el: 'dark', atk: 10, def: 6, hp: 24, xp: 12, biomes: [1], shape: 'crystal', body: 'phantom', behavior: 'ambush', aggroRange: 3 },
      { color: 0x111118, name: 'Corvus', el: 'dark', atk: 13, def: 2, hp: 18, xp: 13, biomes: [1, 3], shape: 'crystal', body: 'phantom', behavior: 'flock', aggroRange: 7 },
      { color: 0x3a8a28, name: 'Rastejador', el: 'earth', atk: 6, def: 4, hp: 18, xp: 8, biomes: [1], shape: 'round', body: 'golem', behavior: 'patrol', aggroRange: 5 },
      // ── Biome 2: Vulcânico
      { color: 0xaa4422, name: 'Braseiro', el: 'fire', atk: 14, def: 5, hp: 30, xp: 16, biomes: [2], shape: 'spiky', body: 'lizard', behavior: 'patrol', aggroRange: 7 },
      { color: 0x443322, name: 'Cinzeiro', el: 'fire', atk: 10, def: 14, hp: 40, xp: 20, biomes: [2, 5], shape: 'round', body: 'golem', behavior: 'stationary', aggroRange: 4 },
      // ── Biome 3: Abismo
      { color: 0x111122, name: 'Espectro', el: 'dark', atk: 12, def: 3, hp: 20, xp: 14, biomes: [3], shape: 'crystal', body: 'phantom', behavior: 'timid', aggroRange: 3 },
      { color: 0x0a0a18, name: 'Véu Sombrio', el: 'dark', atk: 8, def: 2, hp: 15, xp: 16, biomes: [3], shape: 'crystal', body: 'phantom', behavior: 'ambush', aggroRange: 2 },
      { color: 0x111118, name: 'Corvus', el: 'dark', atk: 13, def: 2, hp: 18, xp: 13, biomes: [3], shape: 'crystal', body: 'phantom', behavior: 'flock', aggroRange: 7 },
      // ── Biome 4: Pântano
      { color: 0x224488, name: 'Lama Viva', el: 'water', atk: 8, def: 8, hp: 22, xp: 10, biomes: [4], shape: 'fluid', body: 'serpent', behavior: 'stationary', aggroRange: 4 },
      { color: 0x4a8a22, name: 'Caramujo Ácido', el: 'nature', atk: 6, def: 15, hp: 35, xp: 14, biomes: [4], shape: 'round', body: 'golem', behavior: 'timid', aggroRange: 3 },
      { color: 0xcc3322, name: 'Fungo Saltador', el: 'nature', atk: 5, def: 7, hp: 22, xp: 9, biomes: [4, 0], shape: 'round', body: 'golem', behavior: 'stationary', aggroRange: 3 },
      // ── Biome 5: Pico dos Trovões
      { color: 0x556677, name: 'Rocha Viva', el: 'earth', atk: 16, def: 12, hp: 35, xp: 18, biomes: [5], shape: 'round', body: 'golem', behavior: 'stationary', aggroRange: 4 },
      { color: 0x667788, name: 'Falcão Trovão', el: 'electric', atk: 18, def: 4, hp: 25, xp: 20, biomes: [5], shape: 'spiky', body: 'phantom', behavior: 'patrol', aggroRange: 8 },
      { color: 0x443322, name: 'Cinzeiro', el: 'fire', atk: 10, def: 14, hp: 40, xp: 20, biomes: [5], shape: 'round', body: 'golem', behavior: 'stationary', aggroRange: 4 },

      // ── CANÍDEOS ──
      { color: 0x2a2a3a, name: 'Lobo das Sombras', el: 'dark', atk: 13, def: 7, hp: 28, xp: 16, biomes: [1, 3], shape: 'spiky', body: 'canine', behavior: 'patrol', aggroRange: 8, tier: 'normal' },
      { color: 0xcc4400, name: 'Raposa Ígnea', el: 'fire', atk: 11, def: 6, hp: 22, xp: 13, biomes: [2, 5], shape: 'spiky', body: 'canine', behavior: 'flock', aggroRange: 6, tier: 'normal' },

      // ── AVIANOS ──
      { color: 0x1a1a2a, name: 'Corvus Sombrio', el: 'dark', atk: 15, def: 5, hp: 20, xp: 15, biomes: [1, 3], shape: 'crystal', body: 'avian', behavior: 'patrol', aggroRange: 10, tier: 'normal' },
      { color: 0xdd8800, name: 'Harpia Solar', el: 'light', atk: 12, def: 8, hp: 24, xp: 14, biomes: [0, 4], shape: 'star', body: 'avian', behavior: 'flock', aggroRange: 7, tier: 'normal' }
    ];


    // ══════════════════════════════════════════════════════════════
    // REPUTATION SYSTEM — baseado em G.areaKills por área
    // Tiers: 0=Desconhecido 1=Explorador 2=Caçador 3=Dominador 4=Lenda
    // ══════════════════════════════════════════════════════════════
    var REP_TIERS = [
      { id: 0, name: 'Desconhecido', icon: '❓', kills: 0, color: '#555566', bonus: null },
      { id: 1, name: 'Explorador', icon: '🗺', kills: 5, color: '#4a7a5a', bonus: { souls: 0.05, desc: '+5% almas' } },
      { id: 2, name: 'Caçador', icon: '⚔', kills: 15, color: '#5a8aaa', bonus: { souls: 0.12, desc: '+12% almas, itens mais raros' } },
      { id: 3, name: 'Dominador', icon: '🔥', kills: 35, color: '#aa8822', bonus: { souls: 0.20, rareSpawn: true, desc: '+20% almas, criaturas raras' } },
      { id: 4, name: 'Lenda', icon: '✦', kills: 70, color: '#c9933a', bonus: { souls: 0.30, rareSpawn: true, vendorDiscount: 0.15, desc: '+30% almas, desconto vendedor, criaturas lendárias' } },
    ];

    var AREA_NAMES = ['Planície', 'Floresta Sombria', 'Charneca Ardente', 'Abismo Espectral', 'Pântano', 'Pico dos Trovões'];




    // Called after each kill — check for tier-up

    // Returns souls multiplier from reputation in current area


    // Visibility thresholds (in tiles)
    var MOB_VIS_NEAR = 28; // show mesh + HP label
    var MOB_VIS_FAR = 45; // show mesh, hide HP label

    function spawnMapMobs(centerX, centerZ) {
      clearMapMobs();
      // ~1 mob per 55 tiles → ~46 mob slots
      var totalTiles = WW.W * WW.H;
      var attempts = Math.floor(totalTiles / 55);

      for (var i = 0; i < attempts; i++) {
        var mx = Math.floor(Math.random() * WW.W);
        var mz = Math.floor(Math.random() * WW.H);
        var cell = OW.grid[mx + ',' + mz];
        if (!cell || cell.hn < 0.22 || cell.special) continue;
        if (Math.abs(mx - OW.player.x) < 5 && Math.abs(mz - OW.player.z) < 5) continue;

        var biome = cell.biome;
        // Metamorphosis: scarce area → skip half spawns
        if (typeof isMetaScarceArea === 'function' && isMetaScarceArea(cell.aIdx)) continue;
        var defs = MOB_DEFS.filter(function (d) { return d.biomes.indexOf(biome) >= 0; });
        if (!defs.length) defs = MOB_DEFS;
        var def = defs[Math.floor(Math.random() * defs.length)];
        // Metamorphosis: suppressed element → skip this mob
        if (typeof isMetaSuppressedMob === 'function' && isMetaSuppressedMob(def)) continue;
        var spawnH = cell.h + 0.55;

        MAP_MOBS.push({
          mesh: null,   // created lazily when player approaches
          _meshVisible: false,
          x: mx, z: mz,
          hp: def.hp, maxHp: def.hp,
          xp: def.xp,
          name: def.name,
          def: def,
          state: 'wander',
          _moveTimer: 0,
          _alive: true,
          _evolved: isAreaEvolved(cell.aIdx || 0),
          _targetX: mx, _targetY: spawnH, _targetZ: mz,
          _spawnH: spawnH
        });
      }
    }

    // Called every frame from lerpMobMeshes — shows/hides meshes by distance
    function updateMobVisibility() {
      var px = OW.player.x, pz = OW.player.z;
      MAP_MOBS.forEach(function (mob) {
        if (!mob._alive) return;
        var dx = mob.x - px, dz = mob.z - pz;
        var dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= MOB_VIS_FAR) {
          // Ensure mesh exists
          if (!mob.mesh) {
            // Apply plane variant (different name/color/stats for planes 1 & 2)
            var _plane = G.plane || 0;
            if (_plane > 0 && typeof MOB_PLANE_VARIANTS !== 'undefined' && MOB_PLANE_VARIANTS[_plane]) {
              var _variant = MOB_PLANE_VARIANTS[_plane].find(function (v) { return v.base === mob.def.name; });
              if (_variant) {
                mob.name = _variant.name;
                // Area evolved: additional stat boost on top of plane variant
                if (mob._evolved) {
                  var _em = AREA_EVOLVED_MOB_MULT;
                  mob.def = Object.assign({}, mob.def, {
                    atk: Math.floor(mob.def.atk * _em),
                    def: Math.floor(mob.def.def * _em),
                    hp: Math.floor(mob.def.hp * _em)
                  });
                  mob.hp = mob.def.hp; mob.maxHp = mob.def.hp;
                }
                mob.def = Object.assign({}, mob.def, {
                  name: _variant.name,
                  color: _variant.color,
                  atk: Math.floor(mob.def.atk * _variant.statMult),
                  def: Math.floor(mob.def.def * _variant.statMult),
                  hp: Math.floor(mob.def.hp * _variant.statMult),
                  xp: Math.floor(mob.def.xp * _variant.statMult)
                });
                mob.hp = mob.def.hp;
                mob.maxHp = mob.def.hp;
              }
            }
            mob.mesh = buildMapMobMesh(mob.def.name, mob.def.color);
            mob.mesh.scale.setScalar(1.0);
            mob.mesh.position.set(mob._targetX, mob._spawnH, mob._targetZ);
            OW.scene.add(mob.mesh);
          }
          mob.mesh.visible = true;
          mob._meshVisible = true;
          // HP label visibility driven by dist in updateMobHPOverlays
          // Show label only when alert — cleaner map, more readable
          var _isAlert = mob.state === 'chase' || mob.state === 'aggro' || mob.state === 'flee';
          mob._showLabel = _isAlert && dist <= MOB_VIS_NEAR;
          // Record as 'seen' in bestiary when first spotted
          if (mob.name && !mob._seenRecorded) { mob._seenRecorded = true; bestiaryRecord(mob.name, 'seen'); }
        } else {
          // Far away — hide mesh (keep in memory, don't dispose)
          if (mob.mesh) mob.mesh.visible = false;
          mob._meshVisible = false;
          mob._showLabel = false;
        }
      });
    }

    // Respawn a single mob at a random location far from player (called on mob death)
    function respawnOneMob(biome) {
      var attempts = 50;
      for (var i = 0; i < attempts; i++) {
        var mx = Math.floor(Math.random() * WW.W);
        var mz = Math.floor(Math.random() * WW.H);
        var cell = OW.grid[mx + ',' + mz];
        if (!cell || cell.hn < 0.22 || cell.special) continue;
        // Spawn far from player (>20 tiles)
        var dd = Math.abs(mx - OW.player.x) + Math.abs(mz - OW.player.z);
        if (dd < 20) continue;
        var defs = MOB_DEFS.filter(function (d) { return d.biomes.indexOf(biome) >= 0; });
        if (!defs.length) defs = MOB_DEFS;
        var def = defs[Math.floor(Math.random() * defs.length)];
        var spawnH = cell.h + 0.55;
        MAP_MOBS.push({
          mesh: null, _meshVisible: false,
          x: mx, z: mz,
          hp: def.hp, maxHp: def.hp, xp: def.xp,
          name: def.name, def: def,
          state: 'wander', _moveTimer: 0, _alive: true,
          _targetX: mx, _targetY: spawnH, _targetZ: mz, _spawnH: spawnH
        });
        return;
      }
    }

    function clearMapMobs() {
      MAP_MOBS.forEach(function (m) {
        if (m.mesh) {
          OW.scene.remove(m.mesh);
          // Traverse Group to dispose all child geometries/materials
          m.mesh.traverse(function (child) {
            if (child.isMesh) {
              if (child.geometry) child.geometry.dispose();
              if (child.material) child.material.dispose();
            }
          });
        }
      });
      MAP_MOBS = [];
    }


    // Convert a live map mob into a battle enemy object
    function mkMobEnemy(mob) {
      var def = mob.def || {};
      var areaCell = OW.grid[mob.x + ',' + mob.z];
      var aIdx = areaCell ? (areaCell.aIdx || 0) : 0;
      var area = AREAS[aIdx] || AREAS[0];
      // Level scales with area
      var lvl = area.minL + Math.floor(Math.random() * Math.max(1, area.maxL - area.minL));
      var sc = 1 + (lvl - 1) * 0.12;
      var _ecoMult = typeof getEcoMobStatMult === 'function' ? getEcoMobStatMult(mob) : 1.0;
      var baseAtk = Math.floor((def.atk || 8) * _ecoMult);
      var baseDef = Math.floor((def.def || 5) * _ecoMult);
      var baseHp = Math.floor((def.hp || 20) * _ecoMult);
      return {
        id: Math.random().toString(36).slice(2, 9),
        name: def.name || mob.name || 'Mob',
        tplName: def.name || mob.name,
        el: def.el || 'earth',
        level: lvl,
        shape: def.shape || 'round',
        body: def.body || null,
        maxHp: Math.floor(baseHp * sc * 1.4),
        hp: Math.floor(baseHp * sc * 1.4),
        atk: Math.floor(baseAtk * sc),
        def: Math.floor(baseDef * sc),
        dead: false, evolved: false,
        xp: 0, xpNext: (typeof xpForLevel === 'function' ? xpForLevel(lvl) : 99),
        ultCD: 0,
        _isMobEnemy: true,   // flag — this enemy came from a map mob
        _mapMob: mob,        // reference back so we can kill it on defeat
        _aIdx: aIdx
      };
    }

    // ── MOB BATTLE — triggered when aggro/chase mob reaches the player ──
    var _mobBattleCooldown = false; // prevent double-trigger
    var _mobBattleReturnTime = 0;  // timestamp of last battle end — enforces post-battle grace period
    var MOB_BATTLE_GRACE_MS = 2500; // 2.5s after returning to map before mobs can trigger battle again

    function startMobBattle(mob) {
      if (!mob || !mob._alive) return;
      if (_mobBattleCooldown) return;
      if (G.battle && !G.battle.over) return; // already in battle
      if (OW._eventPaused || (typeof isAnyOverlayOpen === 'function' && isAnyOverlayOpen())) return; // paused
      // Grace period: give player 2.5s of safety after returning from any battle
      if (Date.now() - _mobBattleReturnTime < MOB_BATTLE_GRACE_MS) return;
      // Peaceful zone — no mob battles allowed
      var _playerCell = OW.grid ? OW.grid[OW.player.x + ',' + OW.player.z] : null;
      if (_playerCell && (_playerCell.special === 'peaceful' || _playerCell.special === 'peaceful_zone')) return;
      _mobBattleCooldown = true;
      setTimeout(function () { _mobBattleCooldown = false; }, 1500);

      // Wander mobs do old-style hero hit, not battle
      if (mob.state !== 'aggro' && mob.state !== 'chase') return;

      // Need at least one living creature
      var alive = G.team ? G.team.filter(function (c) { return c && !c.dead; }) : [];
      if (!alive.length) {
        // No creatures — hero takes direct damage (survival scenario)
        aggroMobAttack(mob);
        return;
      }

      // Remove mob from map immediately (it's entering battle)
      mob._inBattle = true;
      mob.state = 'wander'; // stop chasing
      if (mob.mesh) mob.mesh.visible = false; // hide mesh during battle

      var enemy = mkMobEnemy(mob);
      startBattleWithMobEnemy(enemy, mob);
    }

    function startBattleWithMobEnemy(enemy, sourceMob, _dungCb) {
      G.team = G.team.filter(function (c) { return c !== null && c !== undefined; });
      G.activeIdx = G.team.findIndex(function (c) { return c && !c.dead; });
      if (G.activeIdx < 0) {
        // Sem criaturas vivas — tenta eclosão de emergência antes de atacar herói
        var aIdx = enemy._aIdx || 0;
        if (typeof emergencyHatch === 'function' && emergencyHatch(aIdx)) {
          // Eclodiu — re-calcular activeIdx e entrar em batalha normalmente
          G.team = G.team.filter(function (c) { return c !== null && c !== undefined; });
          G.activeIdx = G.team.findIndex(function (c) { return c && !c.dead; });
          if (G.activeIdx < 0) { aggroMobAttack(sourceMob); return; }
          // continua abaixo com a criatura recém-nascida
        } else {
          aggroMobAttack(sourceMob); return;
        }
      }

      var aIdx = enemy._aIdx || 0;
      if (G.hero) { G.hero._firstBlood = true; G.hero._marked = false; }
      G.battle = {
        enemy: enemy,
        area: AREAS[aIdx] || AREAS[0],
        aIdx: aIdx,
        over: false,
        danger: 'fair',
        escUsed: false,
        isMobBattle: true,       // flag — rewards map mob XP, removes mob on win
        _sourceMob: sourceMob,
        _dungCb: _dungCb || null,
        mySt: { poison: 0, burn: 0, paralyze: 0, shield: 0 },
        enSt: { poison: 0, burn: 0, paralyze: 0, shield: 0 }
      };

      buildHand();
      stopMap();
      doScreenTransition(function () {
        document.getElementById('explore').style.display = 'none';
        document.getElementById('battle').style.display = 'flex';
        updateDangerUI(); renderBattle(); renderCards(); clearLog();
        addLog('⚔ ' + enemy.name + ' te desafiou para batalha! (Nv. ' + enemy.level + ')', 'evt');
        warnDanger();
        // Iniciar visuais de batalha
        var _bvMyC = G.team && G.team[G.activeIdx] ? G.team[G.activeIdx] : null;
        if (typeof initBattleVisuals === 'function') {
          initBattleVisuals(_bvMyC ? _bvMyC.el : 'water', enemy.el || 'dark');
        }
        var capBtnFresh = document.getElementById('capbtn');
        if (capBtnFresh) { capBtnFresh.disabled = false; capBtnFresh.style.opacity = ''; }
        bestiaryRecord(enemy.name, 'seen');
        renderPassivePips();
        // Triple rAF + ac() guard — ensures layout painted AND team updated before spawn
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              var _myC = ac();
              if (_myC) spawnS('my-wrap', _myC);
              spawnS('en-wrap', enemy);
            });
          });
        });
      });
    }
    var _eggHatchHitCounter = 0; // tracks mob hits with no creatures → triggers emergency hatch

    function aggroMobAttack(mob) {
      if (!mob || !mob._alive) return;
      if (OW._eventPaused || (typeof isAnyOverlayOpen === 'function' && isAnyOverlayOpen())) return; // paused
      var now = Date.now();
      if (!mob._lastAtkTime) mob._lastAtkTime = 0;
      if (now - mob._lastAtkTime < 1400) return; // 1.4s cooldown per mob
      mob._lastAtkTime = now;

      ensureHero();
      var h = G.hero;
      if (!h || h.hp <= 0) return;
      // No mob damage inside peaceful zone
      var _pCell = OW.grid ? OW.grid[OW.player.x + ',' + OW.player.z] : null;
      if (_pCell && (_pCell.special === 'peaceful' || _pCell.special === 'peaceful_zone')) return;

      // If player has no living creatures — count hits toward emergency trigger
      var hasLiving = G.team && G.team.some(function (c) { return c && !c.dead; });
      if (!hasLiving) {
        _eggHatchHitCounter++;
        var hasEggs = G.viveiro && G.viveiro.length > 0;
        var hitsLeft = 3 - _eggHatchHitCounter;

        if (_eggHatchHitCounter >= 3) {
          _eggHatchHitCounter = 0;
          mob.state = 'wander';
          mob._aggroTimer = 0;

          if (hasEggs) {
            // CASO A: tem ovo → sempre eclode (100%)
            notify('🥚 Nascimento de Urgência! Um ovo eclodiu sob pressão!');
            if (typeof emergencyHatch === 'function') {
              emergencyHatch(0);
              setTimeout(function () {
                if (G.team && G.team.some(function (c) { return c && !c.dead; })) {
                  startMobBattle(mob);
                }
              }, 400);
            }
          } else {
            // ── CASO B: sem ovo nem criatura → abre tela de Última Chance ──
            // Gera um inimigo temporário baseado no mob que atacou
            var _svEnemy = {
              name: mob.def ? mob.def.name : 'Criatura',
              el: mob.def ? mob.def.el : 'dark',
              level: mob.level || 1,
              hp: mob.hp || 20,
              maxHp: mob.hp || 20,
              atk: mob.def ? mob.def.atk : 8,
              def: mob.def ? mob.def.def : 4,
              xp: mob.def ? mob.def.xp : 10,
              color: mob.def ? mob.def.color : 0x444444,
              _isMob: true,   // flag to signal origin
              _sourceMob: mob
            };
            notify('⚠ Sem criaturas! Última Chance — enfraquece e captura!');
            setTimeout(function () {
              try { openSurvivalScreen(_svEnemy); } catch (e) { console.error('SurvivalScreen error:', e); }
            }, 300);
          }
          return;
        } else {
          if (hasEggs) {
            var _warnEgg = G.viveiro && G.viveiro[0];
            var _warnChance = _warnEgg ? (_warnEgg.rarity === 'legendary' ? 80 : _warnEgg.rarity === 'rare' ? 65 : 50) : 50;
            notify('⚠ Œuf sob pressão! ' + hitsLeft + ' golpe' + (hitsLeft > 1 ? 's' : '') + ' — ' + _warnChance + '% de eclodir, ' + (100 - _warnChance) + '% Última Chance');
          } else {
            notify('💀 Sem criaturas! ' + hitsLeft + ' golpe' + (hitsLeft > 1 ? 's' : '') + ' até a Última Chance...');
          }
        }
        return; // don't deal direct hero damage when counting down
      }

      var dmg = Math.max(1, Math.floor(mob.hp * 0.04 + 2 + Math.random() * 3 - h.def * 0.3));
      h.hp = Math.max(0, h.hp - dmg);
      heroHitFlash();
      sfx('hero_hurt');
      spawnDmgNumber(OW.player.x, OW.player.z, dmg, '#ff6600');
      renderHeroHUD();
      // Visual: mob flashes red when attacking
      if (mob.mesh) mob.mesh.traverse(function (child) {
        if (child.isMesh) {
          child.material.emissive.setHex(0xff2200);
          child.material.emissiveIntensity = 1.5;
        }
      });
      setTimeout(function () {
        if (mob._alive && mob.mesh) mob.mesh.traverse(function (child) {
          if (child.isMesh) { child.material.emissive.setHex(0x000000); child.material.emissiveIntensity = 0; }
        });
      }, 200);
      if (h.hp <= 0) heroDefeated();
    }

    var _mobTickTimer = 0;

    function tickMobs(dt) {
      _mobTickTimer += dt;
      if (_mobTickTimer < 500) return;
      _mobTickTimer = 0;

      var px = OW.player.x, pz = OW.player.z;

      MAP_MOBS.forEach(function (mob) {
        if (!mob._alive) return;
        var dx = px - mob.x, dz = pz - mob.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        var behavior = (mob.def && mob.def.behavior) || 'patrol';
        var aggroRange = ((mob.def && mob.def.aggroRange) || 5) + (mob._aggroBoost || 0);

        // ── Arcano: burn tick damage on mob ──
        if (mob._burn > 0) {
          var _burnDmg = Math.max(1, Math.floor((mob.def && mob.def.hp ? mob.def.hp * 0.04 : 5)));
          mob.hp = Math.max(0, mob.hp - _burnDmg);
          mob._burn--;
          if (mob._burn === 0) notify('Queimadura extinguida.');
          if (mob.hp <= 0 && mob._alive) {
            mob._alive = false;
            if (mob.mesh) { OW.scene.remove(mob.mesh); mob.mesh = null; }
            G.souls = (G.souls || 0) + Math.floor(8 + Math.random() * 12);
            renderSoulHUD && renderSoulHUD();
          }
        }

        // ── Flock: alert nearby same-name mobs when this one is aggroed ──
        if (mob.state === 'aggro' && behavior === 'flock' && !mob._flockAlerted) {
          mob._flockAlerted = true;
          MAP_MOBS.forEach(function (other) {
            if (other !== mob && other._alive && other.def.name === mob.def.name) {
              var fdx = other.x - mob.x, fdz = other.z - mob.z;
              if (Math.sqrt(fdx * fdx + fdz * fdz) <= 8) {
                other.state = 'chase';
                other._aggroTimer = 12;
              }
            }
          });
        }
        if (mob.state !== 'aggro') mob._flockAlerted = false;

        // ── State transitions by behavior ──
        if (mob.state === 'aggro') {
          mob._aggroTimer = (mob._aggroTimer || 0) - 1;
          if (mob._aggroTimer <= 0) { mob.state = 'wander'; mob._fleeDir = null; }
        } else if (behavior === 'timid') {
          // Timid: flee when player is close
          if (dist <= aggroRange + 2) mob.state = 'flee';
          else if (dist > aggroRange + 5) mob.state = 'wander';
        } else if (behavior === 'ambush') {
          // Ambush: stay still until player is very close, then lunge aggro
          if (dist <= aggroRange) { mob.state = 'aggro'; mob._aggroTimer = 8; }
        } else if (behavior === 'stationary') {
          // Stationary: never chase, but triggers battle if player walks into it
          mob.state = 'wander'; // keeps wander logic below (which barely moves)
        } else {
          // patrol / flock / default
          if (dist <= aggroRange) mob.state = 'chase';
          else if (dist > aggroRange + 4) mob.state = 'wander';
        }

        var nx = mob.x, nz = mob.z;

        if (mob.state === 'flee') {
          // Move away from player
          var fsx = mob.x - px, fsz = mob.z - pz;
          var flen = Math.sqrt(fsx * fsx + fsz * fsz) || 1;
          nx += Math.round(fsx / flen);
          nz += Math.round(fsz / flen);

        } else if (mob.state === 'aggro' || mob.state === 'chase') {
          var stepX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
          var stepZ = dz !== 0 ? (dz > 0 ? 1 : -1) : 0;
          // Patrol moves every tick; others only when close
          if (mob.state === 'aggro' || behavior === 'patrol' || dist <= aggroRange) {
            nx += stepX; nz += stepZ;
          }

        } else {
          // Wander — stationary barely moves, patrol roams wider
          var stayBias = (behavior === 'stationary') ? 10 : (behavior === 'patrol' ? 2 : 5);
          var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          // Add stay options based on bias
          for (var _si = 0; _si < stayBias; _si++) dirs.push([0, 0]);
          // Patrol: occasionally picks a random farther target
          if (behavior === 'patrol' && Math.random() < 0.15) {
            nx += (Math.random() < 0.5 ? 2 : -2);
            nz += (Math.random() < 0.5 ? 2 : -2);
          } else {
            var d = dirs[Math.floor(Math.random() * dirs.length)];
            nx += d[0]; nz += d[1];
          }
        }

        nx = Math.max(0, Math.min(WW.W - 1, nx));
        nz = Math.max(0, Math.min(WW.H - 1, nz));
        var nc = OW.grid[nx + ',' + nz];
        if (!nc || nc.hn < 0.22 || nc.special) {
          if (mob.state === 'aggro' || mob.state === 'chase') {
            var adjDist = Math.abs(px - mob.x) + Math.abs(pz - mob.z);
            if (adjDist <= 1.5) startMobBattle(mob);
          }
          return;
        }

        var blocked = MAP_MOBS.some(function (other) {
          return other !== mob && other._alive && other.x === nx && other.z === nz;
        });
        if (blocked) return;

        mob.x = nx; mob.z = nz;
        mob._targetX = nx;
        mob._targetY = nc.h + 0.55;
        mob._targetZ = nz;

        if ((mob.state === 'aggro' || mob.state === 'chase') && nx === px && nz === pz) {
          startMobBattle(mob);
        }
        // Stationary: player walks into it
        if (behavior === 'stationary' && nx === px && nz === pz) {
          startMobBattle(mob);
        }
      });
    }

    function lerpMobMeshes() {
      // Congelar mobs quando overlay aberto
      if (OW._eventPaused || (typeof isAnyOverlayOpen === 'function' && isAnyOverlayOpen())) return;
      updateMobVisibility();  // lazy show/hide by distance
      var SPEED = 0.02;
      var now = Date.now() * 0.001;
      MAP_MOBS.forEach(function (mob) {
        if (!mob._alive || !mob.mesh || !mob._meshVisible) return;
        if (mob._targetX === undefined) return;
        var mx = mob.mesh.position;
        var dx = mob._targetX - mx.x;
        var dy = mob._targetY - mx.y;
        var dz = mob._targetZ - mx.z;
        var moving = Math.abs(dx) + Math.abs(dz) > 0.05;
        mx.x += dx * SPEED;
        mx.y += dy * SPEED;
        mx.z += dz * SPEED;

        // Face direction of movement
        if (moving) {
          var targetAngle = Math.atan2(dx, dz);
          var ca = mob.mesh.rotation.y;
          var diff = targetAngle - ca;
          // Shortest arc
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          mob.mesh.rotation.y += diff * 0.18;
        }

        // Idle bob — unique phase + behavior-driven animation
        var phase = (mob.x + mob.z) * 0.7;
        var bhv = mob.def && mob.def.behavior;
        var isAggro = mob.state === 'aggro' || mob.state === 'chase';
        var isFlee = mob.state === 'flee';

        // Ambush: crouch low while waiting, snap up when triggered
        if (bhv === 'ambush' && !isAggro) {
          mob.mesh.position.y = mx.y - 0.06 + Math.abs(Math.sin(now * 1.0 + phase)) * 0.01;
          mob.mesh.scale.setScalar(0.88);
        } else if (isAggro) {
          // Aggro pulse: scale up slightly and bob faster
          mob.mesh.position.y = mx.y + Math.abs(Math.sin(now * 4.5 + phase)) * 0.06;
          var pulse = 1.0 + Math.abs(Math.sin(now * 6 + phase)) * 0.04;
          mob.mesh.scale.setScalar(pulse);
        } else if (bhv === 'stationary') {
          // Stationary: slow rotation + gentle float
          mob.mesh.rotation.y += 0.008;
          mob.mesh.position.y = mx.y + Math.abs(Math.sin(now * 1.4 + phase)) * 0.04;
          mob.mesh.scale.setScalar(1.0);
        } else if (isFlee) {
          // Flee: rapid bob
          mob.mesh.position.y = mx.y + Math.abs(Math.sin(now * 7 + phase)) * 0.015;
          mob.mesh.scale.setScalar(0.95);
        } else {
          mob.mesh.position.y = mx.y + Math.abs(Math.sin(now * 2.2 + phase)) * 0.015;
          mob.mesh.scale.setScalar(1.0);
        }

        // Walk bounce when moving
        if (moving) {
          mob.mesh.rotation.z = Math.sin(now * 8 + phase) * 0.06;
        } else {
          mob.mesh.rotation.z += (0 - mob.mesh.rotation.z) * 0.1;
        }
      });
    }

    // ===== ATTACK VISUAL EFFECTS =====
    function spawnAttackEffect(weapon, mob) {
      if (!OW.scene || !OW.player.mesh) return;
      var px = OW.player.mesh.position.x;
      var py = OW.player.mesh.position.y;
      var pz = OW.player.mesh.position.z;

      // Direction toward mob
      var dx = mob.mesh.position.x - px;
      var dz = mob.mesh.position.z - pz;
      var len = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= len; dz /= len;

      if (weapon === 'sword') {
        // ── SLASH: 3 white arcs that appear and fade in 0.25s ──
        var slashGroup = new THREE.Group();
        slashGroup.position.set(px + dx * 0.7, py + 0.5, pz + dz * 0.7);
        slashGroup.rotation.y = Math.atan2(dx, dz);
        var slashMat = new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0xaaddff, emissiveIntensity: 1.5,
          transparent: true, opacity: 0.9
        });
        // 3 slash lines at angles
        [-0.35, 0, 0.35].forEach(function (ang) {
          var sl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), slashMat.clone());
          sl.rotation.z = ang;
          sl.position.set(Math.sin(ang) * 0.2, 0, 0);
          slashGroup.add(sl);
        });
        // Horizontal cross bar
        var bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), slashMat.clone());
        bar.position.y = 0.1;
        slashGroup.add(bar);
        OW.scene.add(slashGroup);

        var t0 = Date.now();
        var _fadeSlash = function () {
          var age = (Date.now() - t0) / 250;
          if (age >= 1) { OW.scene.remove(slashGroup); return; }
          slashGroup.children.forEach(function (ch) {
            ch.material.opacity = 0.9 * (1 - age);
          });
          slashGroup.scale.setScalar(1 + age * 0.5);
          requestAnimationFrame(_fadeSlash);
        };
        requestAnimationFrame(_fadeSlash);

      } else if (weapon === 'staff') {
        // ── FIREBALL: golden cube that flies to mob and bursts ──
        var fbMat = new THREE.MeshStandardMaterial({
          color: 0xffaa00, emissive: 0xff6600, emissiveIntensity: 2.0,
          transparent: true, opacity: 1.0
        });
        var fb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), fbMat);
        fb.position.set(px + dx * 0.5, py + 0.5, pz + dz * 0.5);
        OW.scene.add(fb);

        var tx = mob.mesh.position.x, tz = mob.mesh.position.z, ty = mob.mesh.position.y + 0.5;
        var t1 = Date.now();
        var _moveFb = function () {
          var age = (Date.now() - t1) / 320;
          if (age >= 1) {
            OW.scene.remove(fb);
            // Burst: 6 tiny cubes flying out
            for (var i = 0; i < 6; i++) {
              var bm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xff4400, emissiveIntensity: 1.5, transparent: true, opacity: 1 }));
              bm.position.set(tx, ty, tz);
              var ba = (i / 6) * Math.PI * 2;
              var bv = { x: Math.cos(ba) * 0.08, y: 0.05 + Math.random() * 0.04, z: Math.sin(ba) * 0.08 };
              OW.scene.add(bm);
              var t2 = Date.now();
              (function (mesh, vel) {
                var _fb2 = function () {
                  var a2 = (Date.now() - t2) / 400;
                  if (a2 >= 1) { OW.scene.remove(mesh); return; }
                  mesh.position.x += vel.x; mesh.position.y += vel.y; mesh.position.z += vel.z;
                  mesh.material.opacity = 1 - a2;
                  requestAnimationFrame(_fb2);
                }; requestAnimationFrame(_fb2);
              })(bm, bv);
            }
            return;
          }
          fb.position.set(
            px + dx * 0.5 + (tx - px - dx * 0.5) * age,
            py + 0.5 + (ty - py - 0.5) * age + Math.sin(age * Math.PI) * 0.3,
            pz + dz * 0.5 + (tz - pz - dz * 0.5) * age
          );
          fb.rotation.x += 0.15; fb.rotation.y += 0.12;
          requestAnimationFrame(_moveFb);
        };
        requestAnimationFrame(_moveFb);

      } else { // bow
        // ── ARROW: thin elongated box flies straight to mob ──
        var arrowMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.5 });
        var tipMat = new THREE.MeshStandardMaterial({ color: 0xddddaa, emissive: 0xddddaa, emissiveIntensity: 0.3 });
        var arrowG = new THREE.Group();
        // shaft — BoxGeometry elongated = "square cylinder"
        var shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.55), arrowMat);
        arrowG.add(shaft);
        // tip
        var tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), tipMat);
        tip.position.z = 0.3; arrowG.add(tip);
        // fletching
        var fl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.08), arrowMat);
        fl.position.z = -0.28; arrowG.add(fl);

        arrowG.position.set(px + dx * 0.5, py + 0.5, pz + dz * 0.5);
        arrowG.rotation.y = Math.atan2(dx, dz);
        OW.scene.add(arrowG);

        var ax = mob.mesh.position.x, az = mob.mesh.position.z, ay = mob.mesh.position.y + 0.5;
        var t3 = Date.now();
        var _moveArrow = function () {
          var age = (Date.now() - t3) / 200; // faster than fireball
          if (age >= 1) { OW.scene.remove(arrowG); return; }
          arrowG.position.set(
            px + dx * 0.5 + (ax - px - dx * 0.5) * age,
            py + 0.5 + (ay - py - 0.5) * age,
            pz + dz * 0.5 + (az - pz - dz * 0.5) * age
          );
          requestAnimationFrame(_moveArrow);
        };
        requestAnimationFrame(_moveArrow);
      }
    }

    function hitMob(mob) {
      if (!mob || !mob._alive) return;
      ensureHero();
      var h = G.hero;
      var wp = WEAPONS[h.weapon] || WEAPONS.sword;

      var now = Date.now();
      var _heroCd = heroHasPassive('hunter_swift') ? Math.floor(wp.cd * 0.75) : wp.cd;
      if (now - h._atkCd < _heroCd) { sfx('error'); notify('Arma em recarga!'); return; }
      h._atkCd = now;
      sfx('hero_atk_' + (h.weapon || 'sword'));
      spawnAttackEffect(h.weapon || 'sword', mob);

      // Calc damage with small variance + class passives
      var dmg = Math.max(1, h.atk + Math.floor(Math.random() * 4) - 2);

      // Caçador: Emboscada (+50% first hit per battle context)
      if (heroHasPassive('hunter_firstblood') && h._firstBlood) {
        dmg = Math.floor(dmg * 1.5);
        h._firstBlood = false;
        addLog('💥 Emboscada! Primeiro golpe +50% dano.', 'evt');
      }
      // Caçador: Tiro Veloz (atkCd reduction applied via cd factor — handled in cooldown)
      // Caçador: Marca — set mob._hunterMark flag
      if (heroHasPassive('hunter_mark')) {
        mob._hunterMark = true;
      }

      mob.hp -= dmg;

      // Guardian rally: heal active creature 5HP on hero attack
      if (heroHasPassive('guardian_rally')) {
        var _rc = ac ? ac() : null;
        if (_rc && !_rc.dead) {
          _rc.hp = Math.min(_rc.maxHp, _rc.hp + 5);
          renderTeam && renderTeam();
        }
      }

      // Mob becomes aggressive when hit
      mob.state = 'aggro';
      mob._aggroTimer = 8; // seconds of aggro

      // Arcano: Canalização — 25% chance to apply burn on mob
      if (heroHasPassive('arcane_channel') && Math.random() < 0.25) {
        mob._burn = (mob._burn || 0) + 3; // 3 ticks of burn
        notify('🔮 Canalização! Inimigo queimando!');
      }

      // Visual feedback: flash all child meshes white briefly
      if (mob.mesh) mob.mesh.traverse(function (child) {
        if (child.isMesh) {
          child.material.emissive.setHex(0xffffff);
          child.material.emissiveIntensity = 2.0;
        }
      });
      setTimeout(function () {
        if (mob._alive && mob.mesh) {
          mob.mesh.traverse(function (child) {
            if (child.isMesh) {
              child.material.emissive.setHex(0x000000);
              child.material.emissiveIntensity = 0;
            }
          });
        }
      }, 130);
      spawnDmgNumber(mob.x, mob.z, dmg, '#e84545');

      // Mob counter-attacks ONLY if it is truly adjacent (≤1 tile) AND not already dead
      // Use mesh position (interpolated) for accurate distance check
      var mwx = mob.mesh ? mob.mesh.position.x : mob.x;
      var mwz = mob.mesh ? mob.mesh.position.z : mob.z;
      var realDist = Math.sqrt(Math.pow(OW.player.x - mwx, 2) + Math.pow(OW.player.z - mwz, 2));
      var wp2 = WEAPONS[h.weapon] || WEAPONS.sword;
      // Counter-attack only in melee range AND only for non-ranged weapons
      var counterRange = (wp2.range <= 1.6) ? 1.2 : 0.6; // bow/staff barely get counter'd
      if (realDist <= counterRange && mob.hp > 0) {
        var mobDmg = Math.max(1, Math.floor(2 + mob.hp * 0.06 - h.def * 0.4 + Math.random() * 2));
        h.hp = Math.max(0, h.hp - mobDmg);
        heroHitFlash();
        sfx('hero_hurt');
        spawnDmgNumber(OW.player.x, OW.player.z, mobDmg, '#f39c12');
        renderHeroHUD();
        if (h.hp <= 0) {
          heroDefeated();
          return;
        }
      }

      if (mob.hp <= 0) {
        killMapMob(mob);
      }
    }

    function killMapMob(mob) {
      mob._alive = false;
      sfx('mob_die');
      // Record in bestiary
      if (mob.name) bestiaryRecord(mob.name, 'defeated');
      if (mob.mesh) {
        OW.scene.remove(mob.mesh);
        mob.mesh.traverse(function (child) {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          }
        });
        mob.mesh = null;
      } // end if mesh
      // Respawn a replacement mob far from player after a short delay
      var _deadBiome = mob.def ? (mob.def.biomes[0] || 0) : 0;
      setTimeout(function () { respawnOneMob(_deadBiome); }, 8000 + Math.random() * 7000);

      // XP and possible item drop
      heroGainXP(mob.xp);
      var area = OW.grid[mob.x + ',' + mob.z];
      var aIdx = area ? area.aIdx : 0;
      // Small chance of item — counts for boss unlock
      if (Math.random() < 0.12) {
        var drops = ['potion_minor', 'potion_minor', 'elixir_minor'];
        var item = drops[Math.floor(Math.random() * drops.length)];
        addItem(item);
        if (!G.areaItems) G.areaItems = [0, 0, 0, 0, 0, 0];
        G.areaItems[aIdx]++;
        addLog('Item encontrado: ' + item + '!', 'evt');
      }
      // Kill count for boss unlock
      if (!G.areaKills) G.areaKills = [0, 0, 0, 0, 0, 0];
      G.areaKills[aIdx] = (G.areaKills[aIdx] || 0) + 1;
      if (typeof checkRepTierUp === 'function') checkRepTierUp(aIdx);
    }

    function heroDefeated() {
      // Hero ran out of HP from map mob attacks — proper game over
      ensureHero();
      // Verificar cristal de ressurreição
      if (G.hero._reviveStored) {
        G.hero._reviveStored = false;
        G.hero.hp = Math.floor(G.hero.maxHp * 0.50);
        renderHeroHUD();
        notify('💎 Cristal de Ressurreição ativado! ' + G.hero.hp + ' HP!', 'success');
        return;
      }
      G.hero.hp = 0;
      renderHeroHUD();
      // Freeze mob ticking immediately
      if (OW && OW.rend) {
        // Stop aggro attacks from firing again
        MAP_MOBS.forEach(function (m) { m._lastAtkTime = Date.now() + 99999; });
      }
      notify('💀 Você foi abatido pelos mobs do mapa!');
      setTimeout(function () {
        destroyMap();
        moveAllDeadToBook();
        wipeAndGameOver();
      }, 1200);
    }

    // ---- Raycast click on map canvas ----
    var _raycaster = null;
    var _clickMouse = { x: 0, y: 0 };

    function initMapClick() {
      var canvas = OW.rend ? OW.rend.domElement : null;
      if (!canvas) return;
      _raycaster = new THREE.Raycaster();
      canvas.addEventListener('click', function (e) {
        if (!OW.rend || !OW.cam) return;
        if (G.battle && !G.battle.over) return;
        var rect = canvas.getBoundingClientRect();
        _clickMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _clickMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        _raycaster.setFromCamera(_clickMouse, OW.cam);

        // Collect alive mob meshes — use recursive=true to hit child blocks of Group
        var meshes = MAP_MOBS.filter(function (m) { return m._alive && m.mesh; }).map(function (m) { return m.mesh; });
        var hits = _raycaster.intersectObjects(meshes, true);

        var mob = null;
        if (hits.length) {
          // Walk up from hit child to find the root mob group
          var hitObj = hits[0].object;
          mob = MAP_MOBS.find(function (m) {
            if (!m._alive || !m.mesh) return false;
            var found = false;
            m.mesh.traverse(function (child) { if (child === hitObj) found = true; });
            return found;
          });
        }

        // Fallback: proximity click — find nearest mob within 1.5 tiles of ray
        if (!mob) {
          var ray = _raycaster.ray;
          var bestD = 1.8, bestMob = null;
          MAP_MOBS.forEach(function (m) {
            if (!m._alive || !m.mesh) return;
            var mpos = m.mesh.position;
            var t = ray.direction.clone().dot(mpos.clone().sub(ray.origin));
            if (t < 0) return;
            var closest = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
            var d = closest.distanceTo(mpos);
            if (d < bestD) { bestD = d; bestMob = m; }
          });
          mob = bestMob;
        }

        if (!mob || !mob._alive) return;

        // Range check
        var ddx = Math.abs(OW.player.x - mob.x);
        var ddz = Math.abs(OW.player.z - mob.z);
        var wp = WEAPONS[(G.hero || {}).weapon || 'sword'];
        if (Math.sqrt(ddx * ddx + ddz * ddz) > wp.range + 0.5) {
          notify('Muito longe! Chegue mais perto.');
          return;
        }

        hitMob(mob);
      });
    }

    // ---- Hook mobs into drawMapLoop ----
    var _lastMobTick = 0;

    function updateMapMobs() {
      var now = Date.now();
      tickMobs(now - _lastMobTick);
      _lastMobTick = now;
      lerpMobMeshes();
      // No chunk-based respawn — mobs are persistent across the full map
    }

    // ============================================================
    // WEAPON SELECTION (new game)
    // ============================================================

    var _selectedWeapon = 'sword';

    function selectWeapon(wp) {
      _selectedWeapon = wp;
      ['sword', 'staff', 'bow'].forEach(function (w) {
        var el = document.getElementById('wopt-' + w);
        if (el) el.className = 'weapon-opt' + (w === wp ? ' selected' : '');
      });
    }

    // ============================================================
    // SURVIVAL SCREEN
    // ============================================================

    var _survivalState = null; // { enemy, heroHp, enemyHp, defending }

    // ── SURVIVAL SCREEN ──
    // New rules: when hero brings enemy to ≤25% HP → auto-capture (guaranteed continuation)
    // Defeat = game over. Flee = escape with 15% HP (no capture).
    // No manual capture button needed — the fight itself is the capture attempt.

    var SV_CAPTURE_THRESHOLD = 0.25; // auto-capture below this % of enemy HP

    function openSurvivalScreen(enemy) {
      ensureHero();
      var h = G.hero;
      // Enemy enters already wounded (~50% HP — creature battle wore it down)
      var eHp = Math.max(1, Math.floor(enemy.maxHp * 0.50));
      _survivalState = {
        enemy: enemy,
        heroHp: h.hp,
        enemyHp: eHp,
        maxEnemyHp: eHp,
        defending: false,
        over: false
      };

      var wpIcon = WEAPONS[h.weapon] ? WEAPONS[h.weapon].icon : '⚔';
      document.getElementById('sv-hero-icon').textContent = wpIcon;
      document.getElementById('sv-hero-name').textContent = (G.playerName || 'Cacador').toUpperCase();
      document.getElementById('sv-enemy-icon').textContent = '👾';
      document.getElementById('sv-enemy-name').textContent = enemy.name.toUpperCase();

      // Hide old capture button — no longer needed
      var capBtn = document.getElementById('sv-btn-cap');
      if (capBtn) capBtn.style.display = 'none';

      updateSurvivalBars();

      var logEl = document.getElementById('sv-log');
      logEl.innerHTML = '';
      if (enemy._isMob) {
        svLog('⚠ ' + enemy.name + ' te encurralou! Última Chance para sobreviver...');
        svLog('Enfraquece abaixo de ' + Math.round(SV_CAPTURE_THRESHOLD * 100) + '% HP para vinculá-lo e ter uma aliada!');
      } else {
        svLog('⚠ Suas criaturas caíram! Uma última chance...');
        svLog('Enfraqueça ' + enemy.name + ' abaixo de ' + Math.round(SV_CAPTURE_THRESHOLD * 100) + '% HP para vinculá-lo!');
      }

      setBtnsEnabled(true);
      document.getElementById('survival-screen').style.display = 'flex';
    }

    function svLog(msg) {
      var el = document.getElementById('sv-log');
      if (!el) return;
      el.innerHTML += '<div>' + msg + '</div>';
      el.scrollTop = el.scrollHeight;
    }

    function setBtnsEnabled(enabled) {
      ['sv-btn-atk', 'sv-btn-def', 'sv-btn-flee'].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) b.disabled = !enabled;
      });
    }

    function survivalAction(action) {
      if (!_survivalState || _survivalState.over) return;
      ensureHero();
      var h = G.hero;
      var s = _survivalState;
      setBtnsEnabled(false);

      if (action === 'flee') {
        if (Math.random() < 0.55) {
          svLog('✓ Você conseguiu fugir! Voltou ferido...');
          s.over = true;
          setTimeout(function () {
            document.getElementById('survival-screen').style.display = 'none';
            G.hero.hp = Math.max(1, Math.floor(h.maxHp * 0.15));
            renderHeroHUD();
            showExplore();
          }, 1200);
        } else {
          svLog('✗ Fuga falhou!');
          var fDmg = Math.max(1, Math.floor(s.enemy.atk * 0.7 + Math.random() * 4));
          if (s.defending) fDmg = Math.max(1, Math.floor(fDmg * 0.5));
          s.heroHp -= fDmg;
          h.hp = s.heroHp;
          svLog(s.enemy.name + ' bloqueou a fuga: -' + fDmg + ' HP');
          renderHeroHUD();
          updateSurvivalBars();
          if (s.heroHp <= 0) { survivalGameOver(); return; }
          setTimeout(function () { setBtnsEnabled(true); }, 600);
        }
        return;
      }

      if (action === 'def') {
        s.defending = true;
        svLog('🛡 Posição defensiva. Próximo golpe reduzido.');
      }

      if (action === 'atk') {
        var dmg = Math.max(1, h.atk + Math.floor(Math.random() * 6) - 2);
        s.enemyHp = Math.max(0, s.enemyHp - dmg);
        svLog('⚔ Você atacou: -' + dmg + ' HP em ' + s.enemy.name);
        updateSurvivalBars();

        // ── AUTO-CAPTURE threshold reached ──
        var ePct = s.enemyHp / s.maxEnemyHp;
        if (ePct <= SV_CAPTURE_THRESHOLD && !s.over) {
          s.over = true;
          svLog('');
          svLog('✦ ' + s.enemy.name + ' está exausto e se rende ao seu grimório!');
          heroGainXP(s.enemy.level * 12);
          setTimeout(function () {
            // Clone enemy as captured creature with remaining HP
            var cap = Object.assign({}, s.enemy);
            cap.hp = Math.max(1, Math.ceil(s.enemyHp));
            cap.id = Math.random().toString(36).slice(2, 9);
            cap.dead = false;
            // BUG FIX: remove any duplicate of this enemy already in team
            // (could have been added by the vincular button before creatures died)
            G.team = G.team.filter(function (x) {
              return x && x.name !== cap.name;
            });
            G.hall = (G.hall || []).filter(function (x) {
              return x && x.name !== cap.name;
            });
            if (G.team.filter(function (x) { return x && !x.dead; }).length < 3) {
              G.team.push(cap);
            } else {
              G.hall.push(cap);
            }
            G.activeIdx = 0;
            bestiaryRecord(cap.name, 'captured');
            document.getElementById('survival-screen').style.display = 'none';
            G.hero.hp = Math.max(1, Math.floor(G.hero.maxHp * 0.25));
            renderHeroHUD();
            // If this creature came from a map mob — remove it from the map
            if (s.enemy._sourceMob) {
              var sm = s.enemy._sourceMob;
              sm._alive = false;
              sm.state = 'dead';
              if (sm.mesh) { try { OW.scene.remove(sm.mesh); } catch (e) { } sm.mesh = null; }
              if (sm.labelDiv) { try { sm.labelDiv.remove(); } catch (e) { } sm.labelDiv = null; }
            }
            showExplore();
            saveGame();
          }, 2000);
          return;
        }

        // ── Enemy defeated without capture (shouldn't reach 0 normally, but handle it) ──
        if (s.enemyHp <= 0 && !s.over) {
          s.over = true;
          svLog('✓ ' + s.enemy.name + ' foi destruído. Você sobreviveu, mas sem captura.');
          heroGainXP(s.enemy.level * 8);
          setTimeout(function () {
            document.getElementById('survival-screen').style.display = 'none';
            G.hero.hp = Math.max(1, Math.floor(h.maxHp * 0.30));
            renderHeroHUD();
            if (s.enemy._sourceMob) {
              var sm2 = s.enemy._sourceMob;
              sm2._alive = false;
              if (sm2.mesh) { try { OW.scene.remove(sm2.mesh); } catch (e) { } sm2.mesh = null; }
              if (sm2.labelDiv) { try { sm2.labelDiv.remove(); } catch (e) { } sm2.labelDiv = null; }
            }
            showExplore();
          }, 1800);
          return;
        }
      }

      // Enemy counter-attack
      setTimeout(function () {
        if (s.over) return;
        var eDmg = Math.max(1, Math.floor(s.enemy.atk * 0.5 + Math.random() * 4));
        if (s.defending) { eDmg = Math.max(1, Math.floor(eDmg * 0.45)); svLog('🛡 Defesa reduziu o dano!'); }
        s.defending = false;
        s.heroHp -= eDmg;
        h.hp = s.heroHp;
        svLog(s.enemy.name + ' atacou: -' + eDmg + ' HP');
        renderHeroHUD();
        updateSurvivalBars();
        if (s.heroHp <= 0) { survivalGameOver(); return; }
        setBtnsEnabled(true);
      }, 700);
    }

    function updateSurvivalBars() {
      var s = _survivalState;
      if (!s) return;
      ensureHero();
      var h = G.hero;
      var hPct = Math.max(0, s.heroHp / h.maxHp * 100);
      var ePct = Math.max(0, s.enemyHp / s.maxEnemyHp * 100);
      document.getElementById('sv-hero-hp-bar').style.width = hPct + '%';
      document.getElementById('sv-enemy-hp-bar').style.width = ePct + '%';
      document.getElementById('sv-hero-hp-text').textContent = Math.max(0, s.heroHp) + '/' + h.maxHp;
      document.getElementById('sv-enemy-hp-text').textContent = Math.max(0, s.enemyHp) + '/' + s.maxEnemyHp;
      // Highlight enemy bar when in capture zone
      var enBar = document.getElementById('sv-enemy-hp-bar');
      if (enBar) {
        enBar.style.background = ePct <= SV_CAPTURE_THRESHOLD * 100
          ? 'linear-gradient(90deg,#5500aa,#9922ff)'
          : 'linear-gradient(90deg,#8c1a1a,#e03030)';
      }
    }

    function survivalGameOver() {
      _survivalState.over = true;
      svLog('💀 Você foi derrotado... A jornada termina aqui.');
      setBtnsEnabled(false);
      setTimeout(function () {
        // Close ALL possible overlays before showing game over screen
        var overlays = [
          'survival-screen', 'status-ov', 'battle', 'explore',
          'flee-minigame', 'parry-challenge-ov', 'hall-rescue-ov',
          'esc-ov', 'quest-ov', 'bestiary-ov', 'settings-ov',
          'shop-ov', 'pedia-ov', 'capture-ov'
        ];
        overlays.forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
        moveAllDeadToBook();
        wipeAndGameOver();
      }, 2200);
    }

    // ============================================================
    // MOB HP OVERLAY — floating 2D bars projected from 3D positions
    // ============================================================

    function updateMobHpOverlay() {
      var overlay = document.getElementById('mob-hp-overlay');
      if (!overlay || !OW.rend || !OW.cam) return;

      var canvas = OW.rend.domElement;
      var cw = canvas.offsetWidth || canvas.width;
      var ch = canvas.offsetHeight || canvas.height;

      // Reuse or create tags
      var existing = overlay.querySelectorAll('.mob-hp-tag');
      var pool = Array.prototype.slice.call(existing);

      var tagIdx = 0;
      var _v3 = new THREE.Vector3();

      MAP_MOBS.forEach(function (mob) {
        if (!mob._alive || !mob.mesh) return;

        // Project mob world position to screen
        if (!mob._showLabel) { return; } // only show label when close
        _v3.set(mob.mesh.position.x, mob.mesh.position.y + 1.8, mob.mesh.position.z);
        _v3.project(OW.cam);

        // NDC to pixel
        var sx = (_v3.x * 0.5 + 0.5) * cw;
        var sy = (-_v3.y * 0.5 + 0.5) * ch;

        // Behind camera or off screen — hide
        if (_v3.z > 1 || sx < -20 || sx > cw + 20 || sy < -20 || sy > ch + 20) return;

        var tag;
        if (tagIdx < pool.length) {
          tag = pool[tagIdx];
          tag.style.display = 'flex';
        } else {
          tag = document.createElement('div');
          tag.className = 'mob-hp-tag';
          tag.innerHTML =
            '<div class="mob-hp-name"></div>' +
            '<div class="mob-hp-bar-w"><div class="mob-hp-bar-f"></div></div>';
          overlay.appendChild(tag);
        }
        tagIdx++;

        tag.style.left = sx + 'px';
        tag.style.top = sy + 'px';

        var pct = Math.max(0, mob.hp / mob.maxHp * 100);
        var isHostile = (mob.state === 'aggro' || mob.state === 'chase');
        var isFlee = mob.state === 'flee';
        // Behavior icon
        var bIcon = '';
        var bhv = mob.def && mob.def.behavior;
        if (isHostile && bhv === 'flock') bIcon = '👥 ';
        else if (isHostile && bhv === 'ambush') bIcon = '💥 ';
        else if (isHostile) bIcon = '⚔ ';
        else if (isFlee) bIcon = '💨 ';
        var nameEl = tag.querySelector('.mob-hp-name');
        nameEl.textContent = bIcon + mob.name;
        nameEl.style.color = isHostile ? '#ff6644' : isFlee ? '#88ccff' : '#dddddd';
        nameEl.style.fontWeight = isHostile ? 'bold' : 'normal';
        tag.querySelector('.mob-hp-bar-f').style.width = pct + '%';
        var col = pct > 60 ? '#27ae60' : pct > 30 ? '#f39c12' : '#e84545';
        tag.querySelector('.mob-hp-bar-f').style.background =
          isHostile ? '#ff6644' : isFlee ? '#4488ff' : col;
        tag.style.border = isHostile ? '1px solid rgba(255,100,68,0.6)'
          : isFlee ? '1px solid rgba(100,180,255,0.4)' : '';
        tag.style.boxShadow = isHostile ? '0 0 8px rgba(255,100,68,0.3)'
          : isFlee ? '0 0 6px rgba(100,180,255,0.2)' : '';
      });

      // Hide unused tags
      for (var i = tagIdx; i < pool.length; i++) {
        pool[i].style.display = 'none';
      }
    }

    // ============================================================
    // CARD DRAG SYSTEM
    // ============================================================

    var _dragCardId = null;
    var _dragGhost = null;
    var _dragOffX = 0, _dragOffY = 0;
    var _dropZoneEl = null;
    var _isOverDrop = false;

    function initCardDrag() {
      _dragGhost = document.getElementById('drag-ghost');
      _dropZoneEl = document.getElementById('card-drop-zone');

      // Delegate: listen on #crow for drag events
      var crow = document.getElementById('crow');
      if (!crow) return;

      crow.addEventListener('mousedown', function (e) {
        var wrap = e.target.closest('[data-drag-card]');
        if (!wrap) return;
        var cardId = wrap.getAttribute('data-drag-card');
        if (!cardId) return;
        // Check if card is disabled
        if (wrap.getAttribute('draggable') === 'false') return;

        e.preventDefault();
        startCardDrag(cardId, wrap, e.clientX, e.clientY);
      });

      crow.addEventListener('touchstart', function (e) {
        var wrap = e.target.closest('[data-drag-card]');
        if (!wrap || wrap.getAttribute('draggable') === 'false') return;
        var t = e.touches[0];
        startCardDrag(wrap.getAttribute('data-drag-card'), wrap, t.clientX, t.clientY);
      }, { passive: true });
    }

    function startCardDrag(cardId, srcEl, cx, cy) {
      sfx('card_pickup');
      _dragCardId = cardId;

      // Clone card as ghost
      var cardEl = srcEl.closest('.card') || srcEl;
      var clone = cardEl.cloneNode(true);
      clone.style.cssText =
        'width:' + cardEl.offsetWidth + 'px;' +
        'height:' + cardEl.offsetHeight + 'px;' +
        'border-radius:5%/3.5%;overflow:hidden;';
      _dragGhost.innerHTML = '';
      _dragGhost.appendChild(clone);
      _dragGhost.style.display = 'block';

      var rect = cardEl.getBoundingClientRect();
      _dragOffX = cx - rect.left;
      _dragOffY = cy - rect.top;
      moveDragGhost(cx, cy);

      // Dim source card
      var wrapEl = srcEl.closest('.card-wrap');
      if (wrapEl) wrapEl.classList.add('dragging');

      // Show drop zone
      if (_dropZoneEl) _dropZoneEl.classList.add('active');

      // Global move / up
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      document.addEventListener('touchmove', onDragTouchMove, { passive: false });
      document.addEventListener('touchend', onDragTouchEnd);
    }

    function moveDragGhost(cx, cy) {
      _dragGhost.style.left = (cx - _dragOffX) + 'px';
      _dragGhost.style.top = (cy - _dragOffY) + 'px';

      // Check if over drop zone
      if (_dropZoneEl) {
        var dz = _dropZoneEl.getBoundingClientRect();
        var over = cx >= dz.left && cx <= dz.right && cy >= dz.top && cy <= dz.bottom;
        if (over !== _isOverDrop) {
          _isOverDrop = over;
          _dropZoneEl.classList.toggle('over', over);
        }
      }
    }

    function onDragMove(e) { moveDragGhost(e.clientX, e.clientY); }
    function onDragTouchMove(e) {
      e.preventDefault();
      var t = e.touches[0];
      moveDragGhost(t.clientX, t.clientY);
    }

    function onDragEnd(e) { finishDrag(e.clientX, e.clientY); }
    function onDragTouchEnd(e) {
      var t = e.changedTouches[0];
      finishDrag(t.clientX, t.clientY);
    }

    function finishDrag(cx, cy) {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchmove', onDragTouchMove);
      document.removeEventListener('touchend', onDragTouchEnd);

      // Restore cards
      var draggingWrap = document.querySelector('.card-wrap.dragging');
      if (draggingWrap) draggingWrap.classList.remove('dragging');

      _dragGhost.style.display = 'none';
      _dragGhost.innerHTML = '';
      if (_dropZoneEl) { _dropZoneEl.classList.remove('active'); _dropZoneEl.classList.remove('over'); }
      _isOverDrop = false;

      if (!_dragCardId) return;

      // Check if dropped over drop zone
      if (_dropZoneEl) {
        var dz = _dropZoneEl.getBoundingClientRect();
        if (cx >= dz.left && cx <= dz.right && cy >= dz.top && cy <= dz.bottom) {
          var id = _dragCardId;
          _dragCardId = null;
          sfx('card_drop');
          setTimeout(function () { playCard(id); }, 80);
          return;
        }
      }
      _dragCardId = null;
    }

    // ============================================================
    // FLOATING DAMAGE NUMBERS ON MAP
    // ============================================================

    function spawnDmgNumber(worldX, worldZ, value, color) {
      if (!OW.rend || !OW.cam) return;
      var overlay = document.getElementById('mob-hp-overlay');
      if (!overlay) return;

      var canvas = OW.rend.domElement;
      var cw = canvas.offsetWidth || canvas.width;
      var ch = canvas.offsetHeight || canvas.height;

      var _v = new THREE.Vector3(worldX, (OW.grid[worldX + ',' + worldZ] || { h: 1 }).h + 1.5, worldZ);
      _v.project(OW.cam);
      if (_v.z > 1) return;

      var sx = (_v.x * 0.5 + 0.5) * cw;
      var sy = (-_v.y * 0.5 + 0.5) * ch;

      var el = document.createElement('div');
      el.textContent = '-' + value;
      el.style.cssText =
        'position:absolute;left:' + sx + 'px;top:' + sy + 'px;' +
        'font-family:Cinzel,serif;font-size:.98rem;font-weight:900;' +
        'color:' + (color || '#e84545') + ';' +
        'text-shadow:0 1px 4px rgba(0,0,0,0.9);' +
        'pointer-events:none;transform:translateX(-50%);' +
        'animation:floatDmg .9s ease-out forwards;';
      overlay.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950);
    }

    // Init drag on battle start
    function initCardDragIfNeeded() {
      if (!document.querySelector('#crow')) return;
      // Remove old listener to avoid duplicates
      var crow = document.getElementById('crow');
      if (crow && !crow._dragInited) {
        crow._dragInited = true;
        initCardDrag();
      }
    }

    // ============================================================
    // PROCEDURAL AUDIO ENGINE
    // ============================================================

    var _audioCtx = null;

    function getAudioCtx() {
      if (!_audioCtx) {
        try {
          _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { _audioCtx = null; }
      }
      // Resume if suspended (browser autoplay policy)
      if (_audioCtx && _audioCtx.state === 'suspended') {
        _audioCtx.resume();
      }
      return _audioCtx;
    }

    // Core: play a tone with envelope
    function playTone(opts) {
      var ctx = getAudioCtx();
      if (!ctx) return;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      var now = ctx.currentTime;

      o.type = opts.wave || 'sine';
      o.frequency.setValueAtTime(opts.freq || 440, now);
      if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(opts.freqEnd, now + (opts.dur || 0.2));

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(opts.vol || 0.18, now + (opts.attack || 0.01));
      g.gain.exponentialRampToValueAtTime(0.001, now + (opts.dur || 0.2));

      o.connect(g); g.connect(ctx.destination);
      o.start(now); o.stop(now + (opts.dur || 0.2) + 0.05);
    }

    // Core: noise burst (hit/impact sounds)
    function playNoise(dur, vol, filterFreq) {
      var ctx = getAudioCtx();
      if (!ctx) return;
      var bufSize = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      var src = ctx.createBufferSource();
      src.buffer = buf;

      var filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = filterFreq || 800;
      filt.Q.value = 0.8;

      var g = ctx.createGain();
      var now = ctx.currentTime;
      g.gain.setValueAtTime(vol || 0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);

      src.connect(filt); filt.connect(g); g.connect(ctx.destination);
      src.start(now); src.stop(now + dur);
    }

    // ---- Named sound effects ----

    function sfx(name) {
      try {
        switch (name) {

          // MAP — footstep (subtle, called on movement)
          case 'step':
            playNoise(0.04, 0.04, 300 + Math.random() * 200);
            break;

          // MAP — hero attacks a mob
          case 'hero_atk_sword':
            playNoise(0.06, 0.18, 1200);
            playTone({ wave: 'sawtooth', freq: 180, freqEnd: 90, vol: 0.10, dur: 0.08, attack: 0.005 });
            break;
          case 'hero_atk_staff':
            playTone({ wave: 'sine', freq: 520, freqEnd: 820, vol: 0.14, dur: 0.15, attack: 0.01 });
            playTone({ wave: 'sine', freq: 660, freqEnd: 1200, vol: 0.08, dur: 0.12, attack: 0.02 });
            break;
          case 'hero_atk_bow':
            playNoise(0.03, 0.12, 2400);
            playTone({ wave: 'triangle', freq: 240, freqEnd: 80, vol: 0.09, dur: 0.09, attack: 0.003 });
            break;

          // MAP — hero takes damage
          case 'hero_hurt':
            playNoise(0.12, 0.22, 600);
            playTone({ wave: 'sawtooth', freq: 120, freqEnd: 60, vol: 0.15, dur: 0.14, attack: 0.005 });
            break;

          // MAP — mob dies
          case 'mob_die':
            playNoise(0.18, 0.20, 400);
            playTone({ wave: 'square', freq: 160, freqEnd: 50, vol: 0.12, dur: 0.20, attack: 0.005 });
            break;

          // MAP — encounter (boss proximity)
          case 'boss_proximity':
            playTone({ wave: 'sine', freq: 90, vol: 0.12, dur: 0.4, attack: 0.05 });
            playTone({ wave: 'sine', freq: 180, vol: 0.08, dur: 0.4, attack: 0.08 });
            break;

          // BATTLE — play a card
          case 'card_play':
            playNoise(0.04, 0.10, 1800);
            playTone({ wave: 'sine', freq: 440, freqEnd: 660, vol: 0.12, dur: 0.12, attack: 0.01 });
            break;

          // BATTLE — card drag pickup
          case 'card_pickup':
            playTone({ wave: 'sine', freq: 320, freqEnd: 480, vol: 0.08, dur: 0.08, attack: 0.005 });
            break;

          // BATTLE — card drag drop (into zone)
          case 'card_drop':
            playTone({ wave: 'triangle', freq: 560, freqEnd: 420, vol: 0.10, dur: 0.10, attack: 0.005 });
            break;

          // BATTLE — damage dealt
          case 'hit_normal':
            playNoise(0.08, 0.18, 900);
            playTone({ wave: 'square', freq: 200, freqEnd: 100, vol: 0.10, dur: 0.09, attack: 0.003 });
            break;
          case 'hit_crit':
            playNoise(0.10, 0.25, 1400);
            playTone({ wave: 'sawtooth', freq: 280, freqEnd: 120, vol: 0.14, dur: 0.13, attack: 0.003 });
            playTone({ wave: 'sine', freq: 560, freqEnd: 280, vol: 0.08, dur: 0.10, attack: 0.01 });
            break;

          // BATTLE — status applied (poison, burn, etc)
          case 'status_poison':
            playTone({ wave: 'sine', freq: 220, freqEnd: 180, vol: 0.08, dur: 0.20, attack: 0.02 });
            playTone({ wave: 'sine', freq: 330, freqEnd: 260, vol: 0.05, dur: 0.22, attack: 0.04 });
            break;
          case 'status_burn':
            playNoise(0.14, 0.12, 2200);
            playTone({ wave: 'sawtooth', freq: 380, freqEnd: 500, vol: 0.08, dur: 0.14, attack: 0.01 });
            break;
          case 'status_paralyze':
            playNoise(0.06, 0.14, 3000);
            playTone({ wave: 'square', freq: 600, freqEnd: 800, vol: 0.09, dur: 0.08, attack: 0.003 });
            playTone({ wave: 'square', freq: 400, freqEnd: 600, vol: 0.06, dur: 0.08, attack: 0.02 });
            break;

          // BATTLE — enemy defeated
          case 'enemy_die':
            playTone({ wave: 'sine', freq: 660, freqEnd: 880, vol: 0.14, dur: 0.12, attack: 0.01 });
            playTone({ wave: 'sine', freq: 880, freqEnd: 1320, vol: 0.10, dur: 0.14, attack: 0.04 });
            playNoise(0.15, 0.12, 600);
            break;

          // BATTLE — capture success
          case 'capture':
            for (var i = 0; i < 3; i++) {
              (function (ii) {
                setTimeout(function () {
                  playTone({ wave: 'sine', freq: 440 + ii * 110, vol: 0.12, dur: 0.12, attack: 0.01 });
                }, ii * 120);
              })(i);
            }
            break;

          // LEVEL UP — creature
          case 'level_up':
            [330, 440, 550, 660, 880].forEach(function (f, i) {
              setTimeout(function () {
                playTone({ wave: 'triangle', freq: f, vol: 0.13, dur: 0.14, attack: 0.01 });
              }, i * 90);
            });
            break;

          // LEVEL UP — hero
          case 'hero_level_up':
            [220, 330, 440, 550, 660, 880, 1100].forEach(function (f, i) {
              setTimeout(function () {
                playTone({ wave: 'sine', freq: f, vol: 0.11, dur: 0.16, attack: 0.01 });
              }, i * 80);
            });
            break;

          // HALL — drag creature
          case 'hall_drag':
            playTone({ wave: 'triangle', freq: 280, freqEnd: 360, vol: 0.07, dur: 0.08, attack: 0.005 });
            break;
          case 'hall_drop':
            playTone({ wave: 'triangle', freq: 400, freqEnd: 320, vol: 0.09, dur: 0.10, attack: 0.005 });
            break;

          // UI
          case 'notify':
            playTone({ wave: 'sine', freq: 520, freqEnd: 640, vol: 0.07, dur: 0.10, attack: 0.01 });
            break;
          case 'error':
            playTone({ wave: 'square', freq: 180, freqEnd: 120, vol: 0.10, dur: 0.12, attack: 0.005 });
            break;
          case 'boss_start':
            [110, 140, 180].forEach(function (f, i) {
              setTimeout(function () {
                playTone({ wave: 'sawtooth', freq: f, vol: 0.18, dur: 0.5, attack: 0.04 });
              }, i * 200);
            });
            break;
        }
      } catch (e) { }
    }

    // ============================================================
    // HALL DRAG AND DROP
    // ============================================================
    // Draggable zones: tslot (team slots 0-2) and hcard (hall)
    // Drop targets: tslot and hcard — swap or move creatures between them


    // ===== HALL — REORDER WITH BUTTONS =====

    function renderHall() {
      // NEVER modify G.team here — use display slots only
      var slots = [G.team[0] || null, G.team[1] || null, G.team[2] || null];

      document.getElementById('ts-c').textContent = G.team.filter(function (c) { return c && !c.dead; }).length + '/3';
      document.getElementById('res-c').textContent = G.hall.length;

      // ---- TEAM SLOTS ----
      var ts = document.getElementById('tslots');
      ts.innerHTML = '';

      for (var i = 0; i < 3; i++) {
        var slot = document.createElement('div');
        var cr = slots[i];
        slot.className = 'tslot' + (cr ? ' f' : '');

        if (cr) {
          var p = cr.hp / cr.maxHp;
          var xpPct = cr.xpNext > 0 ? Math.floor(cr.xp / cr.xpNext * 100) : 0;
          var rg = (!cr.dead && cr.hp < cr.maxHp) ? '<span class="rgl-slow">regen lento</span>' : '';

          var upDis = (i === 0 || !slots[i - 1]) ? 'disabled' : '';
          var downDis = (i === 2 || !slots[i + 1]) ? 'disabled' : '';
          var aliveCount = G.team.filter(function (c) { return c && !c.dead; }).length;
          var toHallDis = (cr.dead || aliveCount <= 1) ? 'disabled' : '';

          slot.innerHTML =
            '<div class="tslot-header">' +
            '<span class="slot-num">' + (i + 1) + '</span>' +
            '<span class="slot-name">' + cr.name + '</span>' +
            '<div class="order-btns">' +
            '<button class="obtn" onclick="teamMove(\'' + cr.id + '\',-1)" ' + upDis + ' title="Subir">↑</button>' +
            '<button class="obtn" onclick="teamMove(\'' + cr.id + '\',1)"  ' + downDis + ' title="Descer">↓</button>' +
            '<button class="obtn" onclick="teamToHall(\'' + cr.id + '\')" ' + toHallDis + ' title="Enviar ao Hall" style="font-size:.80rem;width:28px">Hall</button>' +
            '</div>' +
            '</div>' +
            '<div class="eb el-' + cr.el + '" style="font-size:1.04rem">' + EL[cr.el].name + '</div>' +
            '<span style="font-size:.6rem;color:var(--mu)">Nv. ' + cr.level + '</span>' +
            '<div style="width:100%;background:#1a0a0a;height:4px;border-radius:2px;margin:2px 0">' +
            '<div style="width:' + (p * 100) + '%;height:100%;background:' + hpCol(p) + ';border-radius:2px"></div></div>' +
            '<span style="font-size:1.1rem;color:var(--mu)">' + cr.hp + '/' + cr.maxHp + '</span>' +
            '<div style="width:100%;background:#0a0a18;height:3px;border-radius:2px;margin:2px 0">' +
            '<div style="width:' + xpPct + '%;height:100%;background:var(--xp);border-radius:2px"></div></div>' +
            '<span style="font-size:.80rem;color:#3a5a8a">XP ' + cr.xp + '/' + cr.xpNext + '</span>' +
            (cr.dead ? '<span style="color:var(--dg);font-size:1.04rem">MORTO</span>' : rg);
        } else {
          slot.innerHTML = '<span style="opacity:.16;font-size:1.1rem">+</span><span>Slot vazio</span>';
        }
        ts.appendChild(slot);
      }

      // ---- HALL GRID ----
      var hg = document.getElementById('hgrid');
      hg.innerHTML = '';

      if (!G.hall.length) {
        hg.innerHTML = '<div class="empty">Nenhuma criatura em reserva.</div>' +
          '<div class="regen-note">Envie criaturas do grupo para recuperacao rapida</div>';
        return;
      }

      var filledTeam = G.team.filter(function (c) { return c && !c.dead; }).length;
      var teamFull = filledTeam >= 3 && G.team.filter(function (c) { return !!c; }).length >= 3;

      hg.innerHTML = '<div class="regen-note">Regen rapido ativo — ' +
        Math.floor(REGEN_HALL * 100) + '% HP a cada ' + (REGEN_MS / 1000) + 's</div>';

      G.hall.forEach(function (cr, idx) {
        var p = cr.hp / cr.maxHp;
        var xpPct = cr.xpNext > 0 ? Math.floor(cr.xp / cr.xpNext * 100) : 0;
        var rg = (!cr.dead && cr.hp < cr.maxHp)
          ? '<div class="rgl-fast">regen rapido</div>'
          : '<div style="font-size:1.1rem;color:#27ae60">HP cheio</div>';

        var upDis = idx === 0 ? 'disabled' : '';
        var downDis = idx === G.hall.length - 1 ? 'disabled' : '';
        var toTeamDis = teamFull ? 'disabled' : '';

        var card = document.createElement('div');
        card.className = 'hcard';
        card.innerHTML =
          '<div class="hcard-header">' +
          '<span class="hcard-name">' + cr.name + '</span>' +
          '<div class="order-btns">' +
          '<button class="obtn" onclick="hallMove(\'' + cr.id + '\',-1)" ' + upDis + ' title="Subir">↑</button>' +
          '<button class="obtn" onclick="hallMove(\'' + cr.id + '\',1)"  ' + downDis + ' title="Descer">↓</button>' +
          '</div>' +
          '</div>' +
          '<div class="clvl">Nv. ' + cr.level + '</div>' +
          '<div class="eb el-' + cr.el + '" style="font-size:.80rem;margin-bottom:6px">' + EL[cr.el].name + '</div>' +
          '<div class="hbw"><div class="hb" style="width:' + (p * 100) + '%;background:' + hpCol(p) + '"></div></div>' +
          '<div class="hbt">' + cr.hp + '/' + cr.maxHp + ' (' + Math.round(p * 100) + '%)</div>' +
          '<div class="xpbar-w"><div class="xpbar" style="width:' + xpPct + '%"></div></div>' +
          '<div class="xpt">XP ' + cr.xp + '/' + cr.xpNext + '</div>' +
          rg +
          '<div class="hbtns">' +
          '<button class="hbtn hbtn-a" onclick="addToTeam(\'' + cr.id + '\')" ' + toTeamDis + '>Grupo</button>' +
          '</div>';
        hg.appendChild(card);
      });
    }
    // Move creature within team (dir = -1 up, 1 down)
    function teamMove(id, dir) {
      // Work on real team array — no nulls
      var realTeam = G.team.filter(function (c) { return c !== null && c !== undefined; });
      var idx = realTeam.findIndex(function (c) { return c && c.id === id; });
      if (idx < 0) return;
      var tgt = idx + dir;
      if (tgt < 0 || tgt >= realTeam.length) return;
      var tmp = realTeam[tgt];
      realTeam[tgt] = realTeam[idx];
      realTeam[idx] = tmp;
      G.team = realTeam; // assign back clean — no nulls
      var firstAlive = G.team.findIndex(function (c) { return c && !c.dead; });
      if (firstAlive >= 0) G.activeIdx = firstAlive;
      sfx('hall_drop');
      saveGame();
      renderHall();
    }
    function hallMove(id, dir) {
      var idx = G.hall.findIndex(function (c) { return c.id === id; });
      if (idx < 0) return;
      var tgt = idx + dir;
      if (tgt < 0 || tgt >= G.hall.length) return;
      var tmp = G.hall[tgt];
      G.hall[tgt] = G.hall[idx];
      G.hall[idx] = tmp;
      sfx('hall_drop');
      saveGame();
      renderHall();
    }

    // Send team creature to hall
    function teamToHall(id) {
      var idx = G.team.findIndex(function (c) { return c && c.id === id; });
      if (idx < 0) return;
      var cr = G.team[idx];
      var aliveCount = G.team.filter(function (c) { return c && !c.dead; }).length;
      if (!cr.dead && aliveCount <= 1) { notify('Nao pode remover a ultima criatura viva!'); return; }
      G.team[idx] = null;
      G.hall.unshift(cr); // add to front of hall
      // Compact team: remove nulls (other code expects no nulls outside renderHall)
      G.team = G.team.filter(function (x) { return x !== null; });
      var firstAlive = G.team.findIndex(function (c) { return c && !c.dead; });
      if (firstAlive >= 0) G.activeIdx = firstAlive;
      sfx('hall_drag');
      saveGame();
      renderHall();
    }

    function findCreatureById(id) {
      var c = G.team.find(function (x) { return x && x.id === id; });
      return c || G.hall.find(function (x) { return x && x.id === id; });
    }

    // ═══════════════════════════════════════════════════════════════
    // REGION BANNER + NOTIFY (sourced from bundle, now in engine.js)
    // ═══════════════════════════════════════════════════════════════
    var _regionBannerTimer = null;

    function showRegionBanner(aIdx) {
      var area = AREAS[aIdx];
      if (!area) return;
      var dangerLabels = { low: 'Seguro', mid: 'Perigoso', high: 'Hostil', extreme: 'Letal' };
      var dangerClass = { low: 'd-low', mid: 'd-mid', high: 'd-high', extreme: 'd-extreme' };

      // Update top-right topbar region name
      var etbRegion = document.getElementById('etb-region-name');
      if (etbRegion) etbRegion.textContent = area.name.toUpperCase();

      // Update floating banner (shows briefly on entry)
      var bn = document.getElementById('region-banner');
      if (!bn) return;
      var rbIcon = document.getElementById('rb-icon');
      var rbName = document.getElementById('rb-name');
      var rbSub = document.getElementById('rb-sub');
      var rbDang = document.getElementById('rb-danger');
      if (rbIcon) rbIcon.textContent = area.icon || '◆';
      if (rbName) rbName.textContent = area.name.toUpperCase();
      if (rbSub) rbSub.textContent = 'Nv. ' + area.minL + '–' + area.maxL + ' · ' + area.elems.map(function (e) { return EL[e] ? EL[e].name : e; }).join(', ');
      if (rbDang) { rbDang.textContent = dangerLabels[area.danger] || area.danger; rbDang.className = 'rb-danger ' + (dangerClass[area.danger] || ''); }
      bn.style.display = 'none';
      void bn.offsetWidth;
      bn.style.display = 'flex';
      if (_regionBannerTimer) clearTimeout(_regionBannerTimer);
      _regionBannerTimer = setTimeout(function () {
        bn.style.transition = 'opacity .6s';
        bn.style.opacity = '0';
        setTimeout(function () { bn.style.display = 'none'; bn.style.opacity = '1'; bn.style.transition = ''; }, 620);
      }, 3500);
    }

    function notify(msg) {
      var el = document.getElementById('notif');
      if (!el) return;
      el.textContent = msg;
      el.style.display = 'block';
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'sIn .3s ease';
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.style.display = 'none'; }, 2600);
    }


  