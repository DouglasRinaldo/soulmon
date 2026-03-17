// =====================================================
// src/model-loader.js — Soulmon GLB Model Loader
// Carrega modelos 3D externos (.glb) para criaturas
// que tenham o campo "modelFile" no creatures.json
//
// Uso:
//   ModelLoader.load('raposa_laranja.glb', function(mesh) {
//     scene.add(mesh);
//   });
//   ModelLoader.preload(['raposa_laranja.glb']); // pré-carrega na inicialização
// =====================================================

var ModelLoader = (function () {
  var _cache = {};       // cache de meshes já carregados
  var _pending = {};     // callbacks aguardando o mesmo arquivo
  var _loader = null;    // instância do GLTFLoader (lazy init)
  var _basePath = './models/';

  // ─────────────────────────────────────────────────
  // Inicializa o GLTFLoader (lazy — só quando necessário)
  // ─────────────────────────────────────────────────
  function _getLoader() {
    if (_loader) return _loader;

    if (typeof THREE === 'undefined') {
      console.error('[ModelLoader] THREE.js não encontrado.');
      return null;
    }

    // GLTFLoader via CDN (mesmo CDN usado pelo Three.js)
    // Precisa estar carregado antes de usar
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.error('[ModelLoader] THREE.GLTFLoader não encontrado. Adicione o script no index.html.');
      return null;
    }

    _loader = new THREE.GLTFLoader();
    return _loader;
  }

  // ─────────────────────────────────────────────────
  // load — carrega um .glb e retorna o mesh via callback
  // Se já estiver em cache, retorna imediatamente
  // ─────────────────────────────────────────────────
  function load(filename, onLoaded, onError) {
    var url = _basePath + filename;

    // Cache hit — clona para não compartilhar o mesmo objeto
    if (_cache[filename]) {
      var clone = _cache[filename].clone();
      if (onLoaded) onLoaded(clone);
      return;
    }

    // Já está carregando — enfileira callback
    if (_pending[filename]) {
      _pending[filename].push(onLoaded);
      return;
    }

    var loader = _getLoader();
    if (!loader) {
      if (onError) onError('GLTFLoader não disponível');
      return;
    }

    _pending[filename] = [onLoaded];

    loader.load(
      url + '?_=' + Date.now(), // cache-bust
      function (gltf) {
        var scene = gltf.scene;

        // Ativar sombras em todos os meshes do modelo
        scene.traverse(function (node) {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = false;
            // Renderiza os dois lados das faces (corrige partes falhadas)
            if (node.material) {
              if (Array.isArray(node.material)) {
                node.material.forEach(function (mat) {
                  mat.side = THREE.DoubleSide;
                });
              } else {
                node.material.side = THREE.DoubleSide;
              }
            }
          }
        });
        // Salvar no cache
        _cache[filename] = scene;

        // Disparar todos os callbacks pendentes
        var callbacks = _pending[filename] || [];
        delete _pending[filename];

        callbacks.forEach(function (cb) {
          if (cb) cb(scene.clone());
        });

        console.log('[ModelLoader] ✅ Carregado: ' + filename);

        if (window.EventBus) {
          EventBus.emit('model:loaded', { filename: filename });
        }
      },
      function (progress) {
        // Progresso de carregamento (opcional)
      },
      function (error) {
        console.error('[ModelLoader] ❌ Erro ao carregar ' + filename + ':', error);
        delete _pending[filename];
        if (onError) onError(error);
      }
    );
  }

  // ─────────────────────────────────────────────────
  // preload — pré-carrega uma lista de modelos
  // Chame no início do jogo para evitar delay na batalha
  // ─────────────────────────────────────────────────
  function preload(filenames) {
    filenames.forEach(function (f) {
      if (!_cache[f]) {
        load(f, null, function (err) {
          console.warn('[ModelLoader] Falha no preload de ' + f);
        });
      }
    });
  }

  // ─────────────────────────────────────────────────
  // preloadFromTpls — lê TPLS e pré-carrega todos os
  // modelos que tiverem o campo modelFile
  // ─────────────────────────────────────────────────
  function preloadFromTpls() {
    if (typeof TPLS === 'undefined') return;
    var files = [];
    TPLS.forEach(function (tpl) {
      if (tpl.modelFile && files.indexOf(tpl.modelFile) < 0) {
        files.push(tpl.modelFile);
      }
    });
    if (files.length) {
      console.log('[ModelLoader] Pré-carregando ' + files.length + ' modelo(s):', files.join(', '));
      preload(files);
    }
  }

  // ─────────────────────────────────────────────────
  // spawnForBattle — versão pronta para usar no spawnS
  // Cria o mesh do modelo com escala e posição corretas
  // e chama onReady(mesh) quando estiver pronto
  // ─────────────────────────────────────────────────
  function spawnForBattle(creature, scene, onReady) {
    var tpl = (typeof TPLS !== 'undefined')
      ? TPLS.find(function (t) { return t.name === (creature.tplName || creature.name); })
      : null;

    if (!tpl || !tpl.modelFile) {
      if (onReady) onReady(null); // sem modelo externo
      return;
    }

    load(tpl.modelFile, function (mesh) {
      // Escala base do modelo + escala por nível
      var baseScale = tpl.modelScale || 1.0;
      var levelScale = (creature.evolved ? 0.92 : 0.80) + Math.min(creature.level, 25) * 0.008;
      mesh.scale.setScalar(baseScale * levelScale);

      // Offset vertical (modelos podem ter origens diferentes)
      mesh.position.y = (tpl.modelYOffset || 0) - 0.5;
      mesh.rotation.y = tpl.modelRotationY || 0;
      mesh.position.x = tpl.modelOffsetX || 0;
      if (onReady) onReady(mesh);
    });
  }

  return { load, preload, preloadFromTpls, spawnForBattle };
})();

window.ModelLoader = ModelLoader;
console.log('[ModelLoader] Disponível — modelos .glb prontos para carregar.');
