document.addEventListener('DOMContentLoaded', async () => {
  const runCompatibilityChecks = async () => {
    const issues = [];

    const isLocalhost = (() => {
      try {
        const h = window.location.hostname;
        return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
      } catch (e) {
        return false;
      }
    })();

    if (!window.isSecureContext && !isLocalhost) {
      issues.push({
        title: 'Contexte sécurisé requis',
        details: `URL actuelle: ${window.location.href}`,
        fix: 'Ouvre l\'app via HTTPS ou via http://localhost (localhost est considéré comme sécurisé).',
      });
    }

    if (!navigator.gpu) {
      issues.push({
        title: 'WebGPU indisponible',
        details: 'navigator.gpu est absent. Le navigateur ne supporte pas WebGPU ou WebGPU est désactivé.',
        fix: 'Chrome/Edge (recommandé): mets à jour le navigateur, puis ouvre chrome://flags, cherche “WebGPU”, active-le et redémarre.\n\nSafari: WebGPU est disponible selon la version (souvent via Safari Technology Preview ou Safari récent). Active le menu Développement (Réglages Safari > Avancé > “Afficher le menu Développement”), puis Développement > “Fonctionnalités expérimentales” > active “WebGPU”, et redémarre Safari.\n\nFirefox: WebGPU n\'est pas toujours activé dans la version stable. Essaie Firefox Nightly, puis about:config > active dom.webgpu.enabled (et redémarre).',
      });
    } else {
      let adapter = null;
      try {
        adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      } catch (e) {
        adapter = null;
      }
      if (!adapter) {
        issues.push({
          title: 'Impossible d\'obtenir un adaptateur WebGPU',
          details: 'navigator.gpu.requestAdapter() a retourné null (ou a échoué).',
          fix: 'Vérifie que l\'accélération matérielle est activée, que les drivers GPU sont à jour, puis redémarre le navigateur.\n\nChrome/Edge: consulte chrome://gpu pour voir si l\'accélération et WebGPU sont bien actifs.\nSafari: Développement > Fonctionnalités expérimentales > vérifie que “WebGPU” est activé.\nFirefox Nightly: about:config > dom.webgpu.enabled = true (et redémarre).',
        });
      } else {
        let device = null;
        try {
          device = await adapter.requestDevice();
        } catch (e) {
          device = null;
        }
        if (!device) {
          issues.push({
            title: 'Impossible de créer un device WebGPU',
            details: 'adapter.requestDevice() a échoué.',
            fix: 'Mets à jour le navigateur et les drivers GPU. Si tu utilises une VM, un environnement sans GPU, ou un mode “remote desktop”, WebGPU peut être indisponible.\n\nChrome/Edge: chrome://gpu pour diagnostiquer.\nSafari: vérifie WebGPU dans les Fonctionnalités expérimentales et redémarre.\nFirefox (Nightly): dom.webgpu.enabled dans about:config, puis redémarre.',
          });
        } else {
          try {
            if (typeof device.destroy === 'function') device.destroy();
          } catch (e) {
          }
        }
      }
    }

    const hasWebGL2 = (() => {
      try {
        const c = document.createElement('canvas');
        return Boolean(c.getContext('webgl2'));
      } catch (e) {
        return false;
      }
    })();

    if (!hasWebGL2) {
      issues.push({
        title: 'WebGL2 requis (aperçu 3D)',
        details: 'Le contexte WebGL2 n\'a pas pu être créé.',
        fix: 'Active l\'accélération matérielle dans le navigateur et mets à jour les drivers GPU. Sur certains environnements (VM, remote desktop), WebGL2 peut être désactivé.\n\nChrome/Edge: vérifie chrome://gpu.\nSafari: Développement > Fonctionnalités expérimentales > active WebGL 2.0 (si présent) et redémarre Safari.\nFirefox: vérifie que WebGL est activé (about:config, webgl.disabled doit être false).',
      });
    }

    return { ok: issues.length === 0, issues };
  };

  const showCompatibilityGate = (issues) => {
    const existing = document.getElementById('wgstudioCompatGate');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'wgstudioCompatGate';
    modal.className = 'modal';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header';

    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Configuration requise non satisfaite';

    const actions = document.createElement('div');
    const retryBtn = document.createElement('button');
    retryBtn.className = 'solid';
    retryBtn.type = 'button';
    retryBtn.textContent = 'Re-tester (recharge la page)';
    retryBtn.addEventListener('click', () => {
      try {
        window.location.reload();
      } catch (e) {
      }
    });
    actions.appendChild(retryBtn);

    header.appendChild(title);
    header.appendChild(actions);

    const intro = document.createElement('p');
    intro.className = 'account-note';
    intro.textContent = 'Tant que ces points ne sont pas corrigés, WebGPU Studio ne démarre pas.';

    const grid = document.createElement('div');
    grid.className = 'system-grid';

    issues.forEach((it) => {
      const card = document.createElement('div');
      card.className = 'system-card';

      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = it.title;

      const box = document.createElement('div');
      box.className = 'system-box';
      box.textContent = `${it.details}\n\nComment résoudre:\n${it.fix}`;

      card.appendChild(eyebrow);
      card.appendChild(box);
      grid.appendChild(card);
    });

    content.appendChild(header);
    content.appendChild(intro);
    content.appendChild(grid);
    modal.appendChild(content);
    document.body.appendChild(modal);
  };

  const compat = await runCompatibilityChecks();
  if (!compat.ok) {
    showCompatibilityGate(compat.issues);
    return;
  }

  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const buffersList = document.getElementById('textureList');
  const bufferForm = document.getElementById('textureForm');
  const addBufferBtn = document.getElementById('addBufferBtn');
  const removeBufferBtn = document.getElementById('removeTextureBtn');
  const regenBtn = document.getElementById('regenValuesBtn');
  const preview2D = document.getElementById('preview2D');
  const preview3D = document.getElementById('preview3D');
  const zSlice = document.getElementById('zSlice');
  const sliceLabel = document.getElementById('sliceLabel');
  const toggleButtons = document.querySelectorAll('.toggle[data-mode]');

  const shaderList = document.getElementById('shaderList');
  const shaderForm = document.getElementById('shaderForm');
  const shaderEditor = document.getElementById('shaderEditor');
  const shaderHighlight = document.getElementById('shaderHighlight');
  const shaderGutter = document.getElementById('shaderGutter');
  const shaderLines = document.getElementById('shaderLines');
  const shaderDiagnostics = document.getElementById('shaderDiagnostics');
  const shaderBufferList = document.getElementById('shaderBufferList');
  const shaderBindingsEditor = document.getElementById('shaderBindingsEditor');
  const addShaderBtn = document.getElementById('addShaderBtn');
  const removeShaderBtn = document.getElementById('removeShaderBtn');
  const duplicateShaderBtn = document.getElementById('duplicateShaderBtn');
  const pipelineList = document.getElementById('pipelineList');
  const pipelineTimeline = document.getElementById('pipelineTimeline');
  const addPipelineBtn = document.getElementById('addPipelineBtn');
  const removePipelineBtn = document.getElementById('removePipelineBtn');
  const moveUpBtn = document.getElementById('moveUpBtn');
  const moveDownBtn = document.getElementById('moveDownBtn');
  const addLoopStartBtn = document.getElementById('addLoopStartBtn');
  const addLoopEndBtn = document.getElementById('addLoopEndBtn');
  const moveShaderUpBtn = document.getElementById('moveShaderUpBtn');
  const moveShaderDownBtn = document.getElementById('moveShaderDownBtn');
  const newProjectBtn = document.getElementById('newProjectBtn');
  const pipelineForm = document.getElementById('pipelineForm');
  const pipelineShaderSelect = document.getElementById('pipelineShaderSelect');
  const pipelinePanelTitle = document.getElementById('pipelinePanelTitle');
  const dispatchFields = document.getElementById('dispatchFields');
  const loopStartFields = document.getElementById('loopStartFields');
  const loopEndFields = document.getElementById('loopEndFields');
  const pipelineFieldShader = pipelineForm.querySelector('.field-shader');
  const pipelineFieldDispatch = pipelineForm.querySelector('.field-dispatch');
  const pipelineFieldRepeat = pipelineForm.querySelector('.field-repeat');
  const pipelineFieldActivated = pipelineForm.querySelector('.field-activated');
  const pipelineActivatedInput = pipelineForm.querySelector('input[name="pipeActivated"]');
  const parameterList = document.getElementById('parameterList');
  const addParameterBtn = document.getElementById('addParameterBtn');
  const removeParameterBtn = document.getElementById('removeParameterBtn');
  const moveParameterUpBtn = document.getElementById('moveParameterUpBtn');
  const moveParameterDownBtn = document.getElementById('moveParameterDownBtn');
  const parameterForm = document.getElementById('parameterForm');
  const parameterPreviewGrid = document.getElementById('parameterPreviewGrid');
  const parameterPreviewEmpty = document.getElementById('parameterPreviewEmpty');
  const parameterValue = document.getElementById('parameterValue');
  const parameterNote = document.getElementById('parameterNote');
  const functionList = document.getElementById('functionList');
  const addFunctionBtn = document.getElementById('addFunctionBtn');
  const removeFunctionBtn = document.getElementById('removeFunctionBtn');
  const duplicateFunctionBtn = document.getElementById('duplicateFunctionBtn');
  const moveFunctionUpBtn = document.getElementById('moveFunctionUpBtn');
  const moveFunctionDownBtn = document.getElementById('moveFunctionDownBtn');
  const functionForm = document.getElementById('functionForm');
  const functionEditor = document.getElementById('functionEditor');
  const functionHighlight = document.getElementById('functionHighlight');
  const functionGutter = document.getElementById('functionGutter');
  const functionLines = document.getElementById('functionLines');
  const functionDiagnostics = document.getElementById('functionDiagnostics');
  const texturesEditor = document.getElementById('texturesEditor');
  const statLines = document.getElementById('statLines');
  const statChars = document.getElementById('statChars');
  const consoleArea = document.getElementById('consoleArea');
  const clearConsoleBtn = document.getElementById('clearConsoleBtn');
  const consoleErrorBadge = document.getElementById('consoleErrorBadge');
  const stepLabel = document.getElementById('stepLabel');
  const runSpeedSlider = document.getElementById('runSpeedSlider');
  const runSpeedLabel = document.getElementById('runSpeedLabel');
  const previewPanel = document.getElementById('previewPanel');
  const previewFullscreenBtn = document.getElementById('previewFullscreenBtn');
  const previewTotalScreenBtn = document.getElementById('previewTotalScreenBtn');
  const previewFullscreenControls = document.getElementById('previewFullscreenControls');
  const fsCompileBtn = document.getElementById('fsCompileBtn');
  const fsStepBtn = document.getElementById('fsStepBtn');
  const fsRunBtn = document.getElementById('fsRunBtn');
  const fsPauseBtn = document.getElementById('fsPauseBtn');
  const fsStopBtn = document.getElementById('fsStopBtn');
  const fsExitFullscreenBtn = document.getElementById('fsExitFullscreenBtn');
  const fsStepLabel = document.getElementById('fsStepLabel');
  const fsZSlice = document.getElementById('fsZSlice');
  const fsSliceLabel = document.getElementById('fsSliceLabel');
  const fsRunSpeedSlider = document.getElementById('fsRunSpeedSlider');
  const fsRunSpeedLabel = document.getElementById('fsRunSpeedLabel');
  const previewValueLabel = document.getElementById('previewValueLabel');
  const previewValuesToggle = document.getElementById('previewValuesToggle');
  const bufferValuesPanel = document.getElementById('bufferValuesPanel');
  const bufferValuesGrid = document.getElementById('bufferValuesGrid');
  const bufferValuesSpacer = document.getElementById('bufferValuesSpacer');
  const bufferValuesViewport = document.getElementById('bufferValuesViewport');
  const bufferValuesMeta = document.getElementById('bufferValuesMeta');
  const bufferValuesEmpty = document.getElementById('bufferValuesEmpty');
  const bufferValuesCopyBtn = document.getElementById('bufferValuesCopyBtn');
  const examplesBtn = document.getElementById('examplesBtn');
  const examplesMenu = document.getElementById('examplesMenu');
  const tutosBtn = document.getElementById('tutosBtn');
  const tutosMenu = document.getElementById('tutosMenu');
  const helpBtn = document.getElementById('helpBtn');
  const helpModal = document.getElementById('helpModal');
  const helpCloseBtn = document.getElementById('helpCloseBtn');
  const helpResetZoomBtn = document.getElementById('helpResetZoomBtn');
  const helpPrevBtn = document.getElementById('helpPrevBtn');
  const helpNextBtn = document.getElementById('helpNextBtn');
  const helpImageWrap = document.getElementById('helpImageWrap');
  const helpMainImage = document.getElementById('helpMainImage');
  const helpThumbs = document.getElementById('helpThumbs');
  const moveTextureUpBtn = document.getElementById('moveTextureUpBtn');
  const moveTextureDownBtn = document.getElementById('moveTextureDownBtn');

  const compileBtn  = document.getElementById('compileBtn');
  const stepBtn     = document.getElementById('stepBtn');
  const runBtn      = document.getElementById('runBtn');
  const pauseBtn    = document.getElementById('pauseBtn');
  const stopBtn     = document.getElementById('stopBtn');
  const loadBtn     = document.getElementById('loadBtn');
  const saveBtn     = document.getElementById('saveBtn');
  const loadFileInput = document.getElementById('loadFileInput');
  const accountToggleBtn = document.getElementById('accountToggleBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const languageSelect = document.getElementById('languageSelect');
  const projectNameInput = document.getElementById('projectNameInput');
  const systemInfoBtn = document.getElementById('systemInfoBtn');
  const systemInfoModal = document.getElementById('systemInfoModal');
  const systemInfoCopyBtn = document.getElementById('systemInfoCopyBtn');
  const systemInfoResize = document.getElementById('systemInfoResize');
  const accountPanel = document.getElementById('accountPanel');
  const accountStatus = document.getElementById('accountStatus');
  const accountForms = document.getElementById('accountForms');
  const accountActions = document.getElementById('accountActions');
  const accountError = document.getElementById('accountError');
  const newsletterOptIn = document.getElementById('newsletterOptIn');
  const authForm = document.getElementById('authForm');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  const googleSignInBtn = document.getElementById('googleSignInBtn');

  const StudioCore = window.WebGPUStudio;
  if (!StudioCore) {
    throw new Error('webgpustudio.js doit etre charge avant app.js');
  }

  let currentDevice = null;
  let currentAdapter = null;
  let currentAdapterInfo = null;
  let lastCompiledWGSL = '';
  const simulationRuntime = new StudioCore.WebGPUSimulationRuntime({
    log: (message, meta = '', loc = null) => logConsole(message, meta, loc),
    onDeviceChange: ({ adapter, adapterInfo, device }) => {
      currentAdapter = adapter || null;
      currentAdapterInfo = adapterInfo || null;
      currentDevice = device || null;
    },
  });
  let firebaseAuth = null;
  let firestoreDb = null;
  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  // Replace with your Firebase config, or define window.WEBGPUSTUDIO_FIREBASE_CONFIG before app.js.
  const firebaseConfig = window.WEBGPUSTUDIO_FIREBASE_CONFIG || {
    apiKey: "AIzaSyAOyPcqRPvWcN18fLta62APH903v2A-Vyg",
    authDomain: "webgpustudio-73aa6.firebaseapp.com",
    projectId: "webgpustudio-73aa6",
    storageBucket: "webgpustudio-73aa6.firebasestorage.app",
    messagingSenderId: "989858482994",
    appId: "1:989858482994:web:76b84b9a1b923a1691652b",
    measurementId: "G-410JNT7EZP",
  };

  let isCompiled = false;
  let isCompiling = false;
  let isRunning = false;
  let isPaused = false;
  let isTotalScreenMode = false;
  let timerId = null;
  let runIntervalMs = 16;
  let runUncapped = false;
  let runRafId = 0;
  let runSpeedMeasured = 0;
  let runSpeedMeasureT0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let runSpeedMeasureSteps0 = 0;
  let runSpeedTargetLabel = '60/s';
  let runReadbackIntervalMs = 150;
  let lastRunReadbackAt = 0;
  let runUiIntervalMs = 150;
  let lastRunUiUpdateAt = 0;
  updateButtons()

  const MAX_SHADER_BUFFERS = StudioCore.MAX_SHADER_BUFFERS;
  const UNIFORM_BINDINGS = StudioCore.UNIFORM_BINDINGS;
  const USER_BINDING_OFFSET = StudioCore.USER_BINDING_OFFSET;
  const BUFFER_BINDING_OFFSET = StudioCore.BUFFER_BINDING_OFFSET;
  const DEFAULT_PROJECT_NAME = 'Projet';

  const getMaxStorageBindings = (device) => StudioCore.getMaxStorageBindings(device || currentDevice);

  const normalizeProjectName = (value) => {
    const name = typeof value === 'string' ? value.trim() : '';
    return name || DEFAULT_PROJECT_NAME;
  };

  const sanitizeProjectFileName = (value) => {
    const base = normalizeProjectName(value).replace(/\.wgstudio$/i, '');
    const cleaned = base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
    return cleaned || DEFAULT_PROJECT_NAME;
  };

  let projectName = DEFAULT_PROJECT_NAME;

  const setProjectName = (value) => {
    projectName = normalizeProjectName(value);
    if (projectNameInput) projectNameInput.value = projectName;
  };

  const getProjectName = () => normalizeProjectName(projectNameInput?.value ?? projectName);

  if (projectNameInput) {
    projectNameInput.addEventListener('input', () => {
      projectName = projectNameInput.value;
    });
    projectNameInput.addEventListener('blur', () => {
      setProjectName(projectNameInput.value);
    });
    projectNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') projectNameInput.blur();
    });
  }

  setProjectName(projectNameInput?.value ?? DEFAULT_PROJECT_NAME);

  let textures = [];
  let selectedTextureId = null;
  let previewMode = '3d';
  let shaders = [];
  let selectedShaderId = null;
  let pipeline = [];
  let selectedPipeId = null;
  let pipelineShaderChoiceId = null;
  let functionsStore = [];
  let selectedFunctionId = null;
  let parameters = [];
  let selectedParameterId = null;
  let consoleMessages = [];
  let activeTabName = Array.from(tabs).find((t) => t.classList.contains('active'))?.dataset?.tab || 'buffers';
  let consoleHasUnreadErrors = false;
  let lastWGSLMap = null;
  let lastLiveWGSLMap = null;
  let lastLiveWGSLMessages = [];
  let shaderIdsWithErrors = new Set();
  let functionIdsWithErrors = new Set();
  let diagnosticsTimer = null;
  let liveDiagnosticsEnabled = false;
  let lastLiveWGSLCode = '';
  let simulationSteps = 0;
  let voxelRenderer = null;
  let previewValueCurrent = null;
  let valuesPanelOpen = false;
  let valuesRenderRaf = 0;
  let valuesRenderForce = false;
  let valuesLastKey = '';
  let valuesLastRange = { sr: -1, er: -1, sc: -1, ec: -1 };
  let valuesSelections = [];
  let valuesActiveSelectionIndex = -1;
  let valuesSelecting = false;
  let valuesSelectionAnchor = null;
  let mouseXValue = 0;
  let mouseYValue = 0;
  let mouseZValue = 0;
  let keyValue = 0;
  let mouseBtnValue = 0;

  const normalizeTextureType = StudioCore.normalizeTextureType;
  const isFloatTextureType = StudioCore.isFloatTextureType;
  const getTextureComponentCount = StudioCore.getTextureComponentCount;
  const getTextureStorageStrideCount = StudioCore.getTextureStorageStrideCount;
  const getTextureScalarWGSL = StudioCore.getTextureScalarWGSL;
  const normalizeVec3Value = StudioCore.normalizeVec3Value;
  const normalizeVec4Value = StudioCore.normalizeVec4Value;

  function getSimulationProject(device = currentDevice) {
    return {
      textures,
      shaders,
      functions: functionsStore,
      parameters,
      pipeline,
      selectedShaderId,
      t,
      device,
    };
  }

  function syncRuntimeState() {
    currentAdapter = simulationRuntime.adapter || null;
    currentAdapterInfo = simulationRuntime.adapterInfo || null;
    currentDevice = simulationRuntime.device || null;
    simulationSteps = simulationRuntime.stepCount;
  }

  function getSimulationStepCount() {
    simulationSteps = simulationRuntime.stepCount;
    return simulationSteps;
  }

  function getFraction01(value) {
    const n = Number(value) || 0;
    return Math.abs(n - Math.floor(n));
  }

  function fractionalVec3ToRGB(value) {
    const v = normalizeVec3Value(value);
    return [
      Math.round(getFraction01(v[0]) * 255),
      Math.round(getFraction01(v[1]) * 255),
      Math.round(getFraction01(v[2]) * 255),
    ];
  }

  function voxelRGBAAlpha(type, rgba) {
    const normalized = normalizeTextureType(type);
    const [r, g, b, a = 255] = rgba;
    if (normalized === 'vec3f') {
      return Math.max(r, g, b);
    }
    if (normalized === 'vec4f') {
      return a;
    }
    return (r === 0 && g === 0 && b === 0) ? 0 : a;
  }

  function setPreviewValue(x,y,val,valType = null) {
    previewValueCurrent = val;
    if (!previewValueLabel) return;
    if (val === null || val === undefined) {
      previewValueLabel.textContent = t('toolbar.values_empty', null, 'Valeurs : —');
      return;
    }
    const text = formatBufferValue(val, valType || 'int');
    previewValueLabel.textContent = t('toolbar.value_at', { x, y, value: text }, `Val (${x},${y}) : ${text}`);
  }

  const VALUES_CELL_W = 96;
  const VALUES_ROW_H = 24;
  const VALUES_OVERSCAN = 2;

  function formatBufferValue(val, type) {
    if (val === null || val === undefined) return '';
    const normalized = normalizeTextureType(type);
    if (normalized === 'uint') return String((Number(val) || 0) >>> 0);
    if (normalized === 'int') return String(Number(val) || 0);
    if (normalized === 'float') {
      const n = Number(val);
      return Number.isFinite(n) ? String(n) : '0';
    }
    if (normalized === 'vec3f') {
      const v = normalizeVec3Value(val);
      return `(${v[0]}, ${v[1]}, ${v[2]})`;
    }
    if (normalized === 'vec4f') {
      const v = normalizeVec4Value(val);
      return `(${v[0]}, ${v[1]}, ${v[2]}, ${v[3]})`;
    }
    return String(val);
  }

  function setValuesEmpty(message) {
    if (!bufferValuesEmpty) return;
    if (message) {
      bufferValuesEmpty.textContent = message;
      bufferValuesEmpty.classList.remove('hidden');
    } else {
      bufferValuesEmpty.classList.add('hidden');
    }
  }

  function updateValuesMeta(tex, sliceIndex) {
    if (!bufferValuesMeta) return;
    if (!tex) {
      bufferValuesMeta.textContent = t('preview.values_empty', null, 'Aucun buffer sélectionné');
      return;
    }
    const meta = t(
      'preview.values_meta',
      { name: tex.name, z: sliceIndex, x: tex.size.x, y: tex.size.y },
      `Buffer ${tex.name} - Z=${sliceIndex} - ${tex.size.x}x${tex.size.y}`
    );
    bufferValuesMeta.textContent = meta;
  }

  function renderBufferValues(force = false) {
    if (!valuesPanelOpen) return;
    if (!bufferValuesPanel || !bufferValuesGrid || !bufferValuesViewport || !bufferValuesSpacer) return;

    const tex = textures.find((t) => t.id === selectedTextureId);
    const sliceIndex = tex ? clamp(parseInt(zSlice?.value, 10) || 0, 0, tex.size.z - 1) : 0;
    updateValuesMeta(tex, sliceIndex);

    if (!tex || !Array.isArray(tex.values) || tex.size.x <= 0 || tex.size.y <= 0) {
      bufferValuesSpacer.style.width = '0px';
      bufferValuesSpacer.style.height = '0px';
      bufferValuesViewport.replaceChildren();
      setValuesEmpty(t('preview.values_empty', null, 'Aucun buffer sélectionné'));
      return;
    }

    setValuesEmpty(null);

    bufferValuesGrid.style.setProperty('--values-cell-w', `${VALUES_CELL_W}px`);
    bufferValuesGrid.style.setProperty('--values-row-h', `${VALUES_ROW_H}px`);

    const totalCols = tex.size.x + 1;
    const totalRows = tex.size.y + 1;
    const gridWidth = totalCols * VALUES_CELL_W;
    const gridHeight = totalRows * VALUES_ROW_H;
    bufferValuesSpacer.style.width = `${gridWidth}px`;
    bufferValuesSpacer.style.height = `${gridHeight}px`;

    valuesSelections = valuesSelections
      .map((sel) => clampValuesSelection(sel, tex))
      .filter(Boolean);

    const viewW = bufferValuesGrid.clientWidth || 0;
    const viewH = bufferValuesGrid.clientHeight || 0;
    const scrollLeft = bufferValuesGrid.scrollLeft || 0;
    const scrollTop = bufferValuesGrid.scrollTop || 0;

    const sr = Math.max(0, Math.floor(scrollTop / VALUES_ROW_H) - VALUES_OVERSCAN);
    const er = Math.min(totalRows - 1, Math.ceil((scrollTop + viewH) / VALUES_ROW_H) + VALUES_OVERSCAN);
    const sc = Math.max(0, Math.floor(scrollLeft / VALUES_CELL_W) - VALUES_OVERSCAN);
    const ec = Math.min(totalCols - 1, Math.ceil((scrollLeft + viewW) / VALUES_CELL_W) + VALUES_OVERSCAN);

    const key = `${tex.id}:${sliceIndex}:${totalRows}:${totalCols}`;
    if (!force && key === valuesLastKey && sr === valuesLastRange.sr && er === valuesLastRange.er && sc === valuesLastRange.sc && ec === valuesLastRange.ec) {
      return;
    }
    valuesLastKey = key;
    valuesLastRange = { sr, er, sc, ec };

    const fragment = document.createDocumentFragment();
    for (let r = sr; r <= er; r += 1) {
      for (let c = sc; c <= ec; c += 1) {
        const cell = document.createElement('div');
        let text = '';
        let cls = 'values-cell';
        const isHeaderRow = r === 0;
        const isHeaderCol = c === 0;
        const isCorner = isHeaderRow && isHeaderCol;
        const isSelected = isValuesCellSelected(r, c, totalRows, totalCols);
        if (isCorner) {
          cls += ' header corner';
          text = 'y\\x';
        } else if (isHeaderRow) {
          cls += ' header';
          text = String(c - 1);
        } else if (isHeaderCol) {
          cls += ' header';
          text = String(tex.size.y - r);
        } else {
          const x = c - 1;
          const y = tex.size.y - r;
          const raw = tex.values?.[sliceIndex]?.[y]?.[x];
          text = formatBufferValue(raw === undefined ? 0 : raw, tex.type);
        }
        if (isSelected) cls += ' selected';
        cell.className = cls;
        cell.textContent = text;
        cell.style.left = `${c * VALUES_CELL_W}px`;
        cell.style.top = `${r * VALUES_ROW_H}px`;
        fragment.appendChild(cell);
      }
    }
    bufferValuesViewport.replaceChildren(fragment);
  }

  function clampValuesSelection(selection, tex) {
    if (!selection || !tex) return selection;
    const totalCols = tex.size.x + 1;
    const totalRows = tex.size.y + 1;
    const clampRow = (v) => Math.max(1, Math.min(totalRows - 1, v));
    const clampCol = (v) => Math.max(1, Math.min(totalCols - 1, v));
    const next = { ...selection };
    if (next.mode === 'row') {
      next.sr = clampRow(next.sr);
      next.er = clampRow(next.er);
      next.sc = 1;
      next.ec = totalCols - 1;
    } else if (next.mode === 'col') {
      next.sc = clampCol(next.sc);
      next.ec = clampCol(next.ec);
      next.sr = 1;
      next.er = totalRows - 1;
    } else {
      next.sr = clampRow(next.sr);
      next.er = clampRow(next.er);
      next.sc = clampCol(next.sc);
      next.ec = clampCol(next.ec);
    }
    if (next.sr > next.er) [next.sr, next.er] = [next.er, next.sr];
    if (next.sc > next.ec) [next.sc, next.ec] = [next.ec, next.sc];
    return next;
  }

  function isCellSelectedForSelection(sel, r, c, totalRows, totalCols) {
    if (r === 0 && c === 0) {
      return sel.mode === 'rect' && sel.sr === 1 && sel.sc === 1 && sel.er === totalRows - 1 && sel.ec === totalCols - 1;
    }
    if (r === 0 && c >= 1) {
      if (sel.mode === 'col') return c >= sel.sc && c <= sel.ec;
      if (sel.mode === 'rect') return c >= sel.sc && c <= sel.ec;
      return false;
    }
    if (c === 0 && r >= 1) {
      if (sel.mode === 'row') return r >= sel.sr && r <= sel.er;
      if (sel.mode === 'rect') return r >= sel.sr && r <= sel.er;
      return false;
    }
    if (r >= 1 && c >= 1) {
      if (sel.mode === 'row') return r >= sel.sr && r <= sel.er;
      if (sel.mode === 'col') return c >= sel.sc && c <= sel.ec;
      return r >= sel.sr && r <= sel.er && c >= sel.sc && c <= sel.ec;
    }
    return false;
  }

  function isValuesCellSelected(r, c, totalRows, totalCols) {
    if (!valuesSelections || valuesSelections.length === 0) return false;
    return valuesSelections.some((sel) => isCellSelectedForSelection(sel, r, c, totalRows, totalCols));
  }

  function getValuesGridCellFromEvent(event, tex) {
    if (!bufferValuesGrid || !tex) return null;
    const rect = bufferValuesGrid.getBoundingClientRect();
    const x = (event.clientX - rect.left) + (bufferValuesGrid.scrollLeft || 0);
    const y = (event.clientY - rect.top) + (bufferValuesGrid.scrollTop || 0);
    if (x < 0 || y < 0) return null;
    const totalCols = tex.size.x + 1;
    const totalRows = tex.size.y + 1;
    const c = Math.min(totalCols - 1, Math.max(0, Math.floor(x / VALUES_CELL_W)));
    const r = Math.min(totalRows - 1, Math.max(0, Math.floor(y / VALUES_ROW_H)));
    return { r, c, totalRows, totalCols };
  }

  function inferValuesSelectionMode(cell) {
    if (!cell) return 'rect';
    if (cell.r === 0 && cell.c === 0) return 'all';
    if (cell.r === 0) return 'col';
    if (cell.c === 0) return 'row';
    return 'rect';
  }

  function makeValuesSelection(mode, startCell, endCell, totalRows, totalCols) {
    if (mode === 'all') {
      return { mode: 'rect', sr: 1, er: totalRows - 1, sc: 1, ec: totalCols - 1 };
    }
    if (mode === 'row') {
      return { mode: 'row', sr: startCell.r, er: endCell.r, sc: 1, ec: totalCols - 1 };
    }
    if (mode === 'col') {
      return { mode: 'col', sr: 1, er: totalRows - 1, sc: startCell.c, ec: endCell.c };
    }
    return { mode: 'rect', sr: startCell.r, er: endCell.r, sc: startCell.c, ec: endCell.c };
  }

  function beginValuesSelection(cell, tex, opts = {}) {
    if (!cell || !tex) return;
    const { r, c, totalRows, totalCols } = cell;
    const mode = inferValuesSelectionMode(cell);
    const additive = Boolean(opts.additive);
    const extending = Boolean(opts.extend);
    const hasExisting = valuesSelections.length > 0;

    let anchor = { r, c };
    if (extending && valuesSelectionAnchor) {
      anchor = { ...valuesSelectionAnchor };
    }

    if (mode === 'row') {
      anchor = { r: extending ? anchor.r : r, c: 1 };
    } else if (mode === 'col') {
      anchor = { r: 1, c: extending ? anchor.c : c };
    }

    const selection = makeValuesSelection(mode, anchor, { r, c }, totalRows, totalCols);

    if (!additive && !extending) {
      valuesSelections = [selection];
      valuesActiveSelectionIndex = 0;
    } else if (additive && !extending) {
      valuesSelections = [...valuesSelections, selection];
      valuesActiveSelectionIndex = valuesSelections.length - 1;
    } else if (extending && hasExisting) {
      const idx = valuesActiveSelectionIndex >= 0 ? valuesActiveSelectionIndex : valuesSelections.length - 1;
      valuesSelections = valuesSelections.map((sel, i) => (i === idx ? selection : sel));
      valuesActiveSelectionIndex = idx;
    } else {
      valuesSelections = [selection];
      valuesActiveSelectionIndex = 0;
    }

    valuesSelectionAnchor = anchor;
  }

  function updateValuesSelection(cell, tex) {
    if (!cell || !tex) return;
    if (valuesActiveSelectionIndex < 0) return;
    const totalCols = tex.size.x + 1;
    const totalRows = tex.size.y + 1;
    const current = valuesSelections[valuesActiveSelectionIndex];
    if (!current) return;
    const mode = current.mode;
    const anchor = valuesSelectionAnchor || { r: cell.r, c: cell.c };
    const next = makeValuesSelection(mode, anchor, cell, totalRows, totalCols);
    valuesSelections = valuesSelections.map((sel, i) => (
      i === valuesActiveSelectionIndex ? clampValuesSelection(next, tex) : sel
    ));
  }

  const handleValuesPointerMove = (e) => {
    if (!valuesSelecting) return;
    const tex = textures.find((t) => t.id === selectedTextureId);
    const cell = getValuesGridCellFromEvent(e, tex);
    if (!cell || !tex) return;
    updateValuesSelection(cell, tex);
    scheduleValuesRender();
    e.preventDefault();
  };

  const handleValuesPointerUp = (e) => {
    if (!valuesSelecting) return;
    valuesSelecting = false;
    if (bufferValuesGrid) bufferValuesGrid.classList.remove('selecting');
    window.removeEventListener('pointermove', handleValuesPointerMove);
    window.removeEventListener('pointerup', handleValuesPointerUp);
    window.removeEventListener('pointercancel', handleValuesPointerUp);
    try {
      if (bufferValuesGrid) bufferValuesGrid.releasePointerCapture(e.pointerId);
    } catch (err) {
    }
  };

  function getTSVRangesForSelection(selection, tex) {
    if (!selection || !tex) return null;
    const totalCols = tex.size.x + 1;
    const totalRows = tex.size.y + 1;
    const sel = clampValuesSelection(selection, tex);
    if (!sel) return null;
    const sr = Math.max(1, Math.min(totalRows - 1, sel.sr));
    const er = Math.max(1, Math.min(totalRows - 1, sel.er));
    const sc = Math.max(1, Math.min(totalCols - 1, sel.sc));
    const ec = Math.max(1, Math.min(totalCols - 1, sel.ec));
    return { sr, er, sc, ec };
  }

  function buildTSVForSelection(selection, tex, sliceIndex) {
    const range = getTSVRangesForSelection(selection, tex);
    if (!range) return '';
    const { sr, er, sc, ec } = range;
    const lines = [];
    for (let r = sr; r <= er; r += 1) {
      const y = tex.size.y - r;
      const row = [];
      for (let c = sc; c <= ec; c += 1) {
        const x = c - 1;
        const raw = tex.values?.[sliceIndex]?.[y]?.[x];
        row.push(formatBufferValue(raw === undefined ? 0 : raw, tex.type));
      }
      lines.push(row.join('\t'));
    }
    return lines.join('\n');
  }

  async function copyValuesSelectionAsTSV() {
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (!tex || !Array.isArray(tex.values)) return;
    if (!valuesSelections || valuesSelections.length === 0) return;
    const sliceIndex = clamp(parseInt(zSlice?.value, 10) || 0, 0, tex.size.z - 1);
    const blocks = valuesSelections
      .map((sel) => buildTSVForSelection(sel, tex, sliceIndex))
      .filter((block) => block.length);
    if (!blocks.length) return;
    const tsv = blocks.join('\n\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tsv);
        return;
      }
    } catch (e) {
    }
    const textarea = document.createElement('textarea');
    textarea.value = tsv;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (e) {
    }
    document.body.removeChild(textarea);
  }

  const scheduleValuesRender = (() => {
    return (force = false) => {
      if (!valuesPanelOpen) return;
      if (force) valuesRenderForce = true;
      if (valuesRenderRaf) return;
      valuesRenderRaf = requestAnimationFrame(() => {
        valuesRenderRaf = 0;
        const shouldForce = valuesRenderForce;
        valuesRenderForce = false;
        renderBufferValues(shouldForce);
      });
    };
  })();

  function renderStepCounter() {
    if (!stepLabel) return;
    const stepCount = getSimulationStepCount();
    const label = t('toolbar.step_counter', { count: stepCount }, `step = ${stepCount}`);
    stepLabel.textContent = label;
    if (fsStepLabel) fsStepLabel.textContent = label;
  }
  renderStepCounter();

  function setRunSpeed(stepsPerSec) {
    const sliderMax = Number(runSpeedSlider?.max || fsRunSpeedSlider?.max || 240);
    const raw = Number(stepsPerSec) || 60;
    const isMax = raw >= sliderMax;
    runUncapped = Boolean(isMax);
    const s = runUncapped
      ? sliderMax
      : Math.max(1, Math.min(Math.max(1, sliderMax - 1), raw));
    runIntervalMs = runUncapped ? 0 : Math.max(1, Math.round(1000 / s));
    if (runUncapped) {
      runSpeedMeasureT0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      runSpeedMeasureSteps0 = getSimulationStepCount();
      runSpeedMeasured = 0;
    }
    runSpeedTargetLabel = runUncapped ? 'MAX' : `${s}/s`;
    const label = `${runSpeedTargetLabel} (${Math.round(runSpeedMeasured)}/s)`;
    if (runSpeedLabel) runSpeedLabel.textContent = label;
    if (runSpeedSlider) runSpeedSlider.value = String(s);
    if (fsRunSpeedLabel) fsRunSpeedLabel.textContent = label;
    if (fsRunSpeedSlider) fsRunSpeedSlider.value = String(s);
    try {
      localStorage.setItem('wgstudio.runSpeed', String(s));
    } catch (e) {
    }
    if (isRunning && !isPaused) {
      stopTimer();
      startTimer();
    }
  }

  function updateMeasuredRunSpeedLabel() {
    if (runUncapped) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if ((now - lastRunUiUpdateAt) < runUiIntervalMs) return;
      lastRunUiUpdateAt = now;
    }
    const label = `${runSpeedTargetLabel} (${Math.round(runSpeedMeasured)}/s)`;
    if (runSpeedLabel) runSpeedLabel.textContent = label;
    if (fsRunSpeedLabel) fsRunSpeedLabel.textContent = label;
  }

  function resetRunSpeedMeasure() {
    runSpeedMeasureT0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    runSpeedMeasureSteps0 = getSimulationStepCount();
    lastRunUiUpdateAt = 0;
  }

  function scheduleNextUncappedStep() {
    if (!runUncapped || !isRunning || isPaused) return;
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(() => {
        if (!runUncapped || !isRunning || isPaused) return;
        if (!simulationRuntime.isStepRunning) playSimulationStep();
      });
      return;
    }
    setTimeout(() => {
      if (!runUncapped || !isRunning || isPaused) return;
      if (!simulationRuntime.isStepRunning) playSimulationStep();
    }, 0);
  }

  function noteStepCompleted() {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const dt = Math.max(1, now - runSpeedMeasureT0);
    const ds = getSimulationStepCount() - runSpeedMeasureSteps0;
    if (ds > 0) {
      runSpeedMeasured = (ds * 1000) / dt;
      updateMeasuredRunSpeedLabel();
      if (dt >= 250) {
        runSpeedMeasureT0 = now;
        runSpeedMeasureSteps0 = getSimulationStepCount();
      }
    }
  }

  function updatePreviewFullscreenControlsVisibility() {
    if (!previewPanel || !previewFullscreenControls) return;
    const enabled = previewPanel.classList.contains('fullscreen');
    const isTotal = previewPanel.classList.contains('total-screen');
    previewFullscreenControls.classList.toggle('hidden', !enabled || isTotal);
  }

  function setPreviewFullscreen(enabled) {
    if (!previewPanel) return;
    previewPanel.classList.toggle('fullscreen', Boolean(enabled));
    updatePreviewFullscreenControlsVisibility();
    try {
      const appRoot = document.querySelector('main.app');
      if (appRoot) appRoot.classList.toggle('preview-maximized', Boolean(enabled));
    } catch (e) {
    }
    try {
      document.documentElement.classList.toggle('preview-overlay', Boolean(enabled));
    } catch (e) {
    }
    try {
      updateButtons();
    } catch (e) {
    }
    try {
      syncPreviewModeToggles();
    } catch (e) {
    }
    schedulePreviewResize();
  }

  async function enterTotalScreen() {
    if (!previewPanel) return;
    isTotalScreenMode = true;
    previewPanel.classList.add('total-screen');
    setPreviewFullscreen(true);
    if (typeof previewPanel.requestFullscreen !== 'function') {
      isTotalScreenMode = false;
      previewPanel.classList.remove('total-screen');
      setPreviewFullscreen(false);
      logConsole('Mode Total Screen indisponible sur ce navigateur.', 'run');
      return;
    }
    try {
      if (document.fullscreenElement !== previewPanel) {
        await previewPanel.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch (err) {
      try {
        if (document.fullscreenElement !== previewPanel) {
          await previewPanel.requestFullscreen();
        }
      } catch (fallbackErr) {
        isTotalScreenMode = false;
        previewPanel.classList.remove('total-screen');
        setPreviewFullscreen(false);
        logConsole(`Mode Total Screen indisponible: ${fallbackErr.message || fallbackErr}`, 'run');
      }
    }
  }

  async function exitTotalScreen() {
    isTotalScreenMode = false;
    if (previewPanel) previewPanel.classList.remove('total-screen');
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (e) {
      }
    }
    setPreviewFullscreen(false);
  }

  function enableTabIndent(editor) {
    if (!editor) return;
    editor.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const scrollTop = editor.scrollTop;
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const value = editor.value;
      const tab = '\t';
      editor.value = `${value.slice(0, start)}${tab}${value.slice(end)}`;
      const cursor = start + tab.length;
      editor.selectionStart = cursor;
      editor.selectionEnd = cursor;
      editor.scrollTop = scrollTop;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const RUST_KEYWORDS = new Set([
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum',
    'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
    'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct', 'super',
    'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
    'abstract', 'become', 'box', 'do', 'final', 'macro', 'override', 'priv', 'try',
    'typeof', 'unsized', 'virtual', 'yield',
  ]);
  const RUST_TYPES = new Set([
    'bool', 'char', 'str', 'String',
    'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
    'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
    'f32', 'f64',
    'Vec', 'Option', 'Result', 'Some', 'None', 'Ok', 'Err',
    'array', 'atomic', 'mat2x2', 'mat2x3', 'mat2x4', 'mat3x2', 'mat3x3', 'mat3x4',
    'mat4x2', 'mat4x3', 'mat4x4', 'ptr', 'vec2', 'vec3', 'vec4',
  ]);
  const RUST_BUILTINS = new Set([
    'drop', 'format', 'panic', 'println', 'todo', 'unreachable', 'vec',
    'abs', 'acos', 'asin', 'atan', 'ceil', 'clamp', 'cos', 'dot', 'exp', 'floor',
    'length', 'max', 'min', 'normalize', 'pow', 'round', 'sin', 'sqrt', 'tan',
  ]);

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function isRustIdentifierStart(ch) {
    return /[A-Za-z_]/.test(ch || '');
  }

  function isRustIdentifierPart(ch) {
    return /[A-Za-z0-9_]/.test(ch || '');
  }

  function tokenSpan(cls, text) {
    return `<span class="${cls}">${escapeHtml(text)}</span>`;
  }

  function findRustRawStringEnd(code, start, hashes) {
    const needle = `"${'#'.repeat(hashes)}`;
    const idx = code.indexOf(needle, start);
    return idx === -1 ? code.length : idx + needle.length;
  }

  function readRustRawString(code, i) {
    let j = i + 1;
    if (code[i] === 'b' && code[i + 1] === 'r') {
      j = i + 2;
    }
    let hashes = 0;
    while (code[j] === '#') {
      hashes += 1;
      j += 1;
    }
    if (code[j] !== '"') return null;
    const end = findRustRawStringEnd(code, j + 1, hashes);
    return { end, text: code.slice(i, end) };
  }

  function readQuotedString(code, i) {
    const quote = code[i];
    let j = i + 1;
    while (j < code.length) {
      if (code[j] === '\\') {
        j += 2;
        continue;
      }
      if (code[j] === quote) {
        j += 1;
        break;
      }
      if (quote === "'" && /[\r\n]/.test(code[j])) break;
      j += 1;
    }
    return code.slice(i, j);
  }

  function readNumberToken(code, i) {
    let j = i;
    if (code[j] === '0' && /[xXbBoO]/.test(code[j + 1] || '')) {
      j += 2;
      while (/[A-Fa-f0-9_]/.test(code[j] || '')) j += 1;
    } else {
      while (/[0-9_]/.test(code[j] || '')) j += 1;
      if (code[j] === '.' && code[j + 1] !== '.' && /[0-9]/.test(code[j + 1] || '')) {
        j += 1;
        while (/[0-9_]/.test(code[j] || '')) j += 1;
      }
      if (/[eE]/.test(code[j] || '')) {
        const expStart = j;
        j += 1;
        if (/[+-]/.test(code[j] || '')) j += 1;
        if (/[0-9]/.test(code[j] || '')) {
          while (/[0-9_]/.test(code[j] || '')) j += 1;
        } else {
          j = expStart;
        }
      }
    }
    while (/[A-Za-z0-9_]/.test(code[j] || '')) j += 1;
    return code.slice(i, j);
  }

  function highlightRust(code) {
    const src = String(code || '');
    let out = '';
    let i = 0;

    while (i < src.length) {
      const ch = src[i];
      const next = src[i + 1] || '';

      if (ch === '/' && next === '/') {
        const end = src.indexOf('\n', i);
        const text = end === -1 ? src.slice(i) : src.slice(i, end);
        out += tokenSpan('tok-comment', text);
        i += text.length;
        continue;
      }

      if (ch === '/' && next === '*') {
        const end = src.indexOf('*/', i + 2);
        const stop = end === -1 ? src.length : end + 2;
        out += tokenSpan('tok-comment', src.slice(i, stop));
        i = stop;
        continue;
      }

      if ((ch === 'r' || (ch === 'b' && next === 'r')) && !isRustIdentifierPart(src[i - 1])) {
        const raw = readRustRawString(src, i);
        if (raw) {
          out += tokenSpan('tok-string', raw.text);
          i = raw.end;
          continue;
        }
      }

      if (ch === '"' || (ch === 'b' && next === '"')) {
        const start = ch === 'b' ? i + 1 : i;
        const text = (ch === 'b' ? 'b' : '') + readQuotedString(src, start);
        out += tokenSpan('tok-string', text);
        i += text.length;
        continue;
      }

      if (ch === "'" && (next === '\\' || src[i + 2] === "'")) {
        const quoted = readQuotedString(src, i);
        out += tokenSpan('tok-string', quoted);
        i += quoted.length;
        continue;
      }

      if (ch === "'" && isRustIdentifierStart(next)) {
        let j = i + 2;
        while (isRustIdentifierPart(src[j])) j += 1;
        if (src[j] === "'") {
          const quoted = readQuotedString(src, i);
          out += tokenSpan('tok-string', quoted);
          i += quoted.length;
        } else {
          out += tokenSpan('tok-lifetime', src.slice(i, j));
          i = j;
        }
        continue;
      }

      if (ch === '#' && (next === '[' || (next === '!' && src[i + 2] === '['))) {
        const end = src.indexOf(']', i + 1);
        const stop = end === -1 ? src.length : end + 1;
        out += tokenSpan('tok-attribute', src.slice(i, stop));
        i = stop;
        continue;
      }

      if (ch === '@' && isRustIdentifierStart(next)) {
        let j = i + 2;
        while (isRustIdentifierPart(src[j])) j += 1;
        out += tokenSpan('tok-attribute', src.slice(i, j));
        i = j;
        continue;
      }

      if (/[0-9]/.test(ch)) {
        const token = readNumberToken(src, i);
        out += tokenSpan('tok-number', token);
        i += token.length;
        continue;
      }

      if (isRustIdentifierStart(ch)) {
        let j = i + 1;
        while (isRustIdentifierPart(src[j])) j += 1;
        const ident = src.slice(i, j);
        if (src[j] === '!' && src[j + 1] !== '=') {
          out += tokenSpan('tok-macro', `${ident}!`);
          i = j + 1;
          continue;
        }
        if (RUST_KEYWORDS.has(ident)) {
          out += tokenSpan('tok-keyword', ident);
        } else if (RUST_TYPES.has(ident)) {
          out += tokenSpan('tok-type', ident);
        } else if (RUST_BUILTINS.has(ident)) {
          out += tokenSpan('tok-builtin', ident);
        } else if (src[j] === '(') {
          out += tokenSpan('tok-function', ident);
        } else {
          out += escapeHtml(ident);
        }
        i = j;
        continue;
      }

      if (ch === '{' || ch === '}') {
        out += tokenSpan('tok-brace', ch);
        i += 1;
        continue;
      }

      if (ch === '(' || ch === ')' || ch === '[' || ch === ']') {
        out += tokenSpan('tok-paren', ch);
        i += 1;
        continue;
      }

      if (/[+\-*%=!<>|&^~?:.,;]/.test(ch)) {
        out += tokenSpan('tok-operator', ch);
        i += 1;
        continue;
      }

      out += escapeHtml(ch);
      i += 1;
    }

    return out;
  }

  function syncRustHighlight(textarea, highlightEl) {
    if (!textarea || !highlightEl) return;
    const html = highlightRust(textarea.value || '');
    highlightEl.innerHTML = `${html}\n`;
    syncHighlightScroll(textarea, highlightEl);
  }

  const closeExamplesMenu = () => {
    if (!examplesMenu) return;
    examplesMenu.classList.add('hidden');
  };

  const openExamplesMenu = async () => {
    if (!examplesMenu) return;
    examplesMenu.classList.remove('hidden');
    if (examplesMenu.dataset.loaded === '1') return;

    let exampleFiles = [];
    try {
      const res = await fetch('examples/manifest.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json)) exampleFiles = json;
      else if (Array.isArray(json?.examples)) exampleFiles = json.examples;
    } catch (e) {
      logConsole(`Impossible de charger examples/manifest.json : ${e.message || e}`, 'load');
    }

    examplesMenu.innerHTML = '';
    if (!exampleFiles.length) {
      const empty = document.createElement('div');
      empty.className = 'eyebrow';
      empty.style.padding = '10px 12px';
      empty.textContent = '—';
      examplesMenu.appendChild(empty);
      examplesMenu.dataset.loaded = '1';
      return;
    }

    exampleFiles.forEach((fileName) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'examples-item';
      btn.textContent = String(fileName).replace(/\.wgstudio$/i, '');
      btn.addEventListener('click', async () => {
        try {
          closeExamplesMenu();
          const res = await fetch(`examples/${encodeURIComponent(fileName)}`, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          loadProject(data);
          logConsole(`Exemple chargé : ${fileName}`, 'load');
        } catch (err) {
          logConsole(`Échec chargement exemple : ${err.message || err}`, 'load');
        }
      });
      examplesMenu.appendChild(btn);
    });

    examplesMenu.dataset.loaded = '1';
  };

  if (examplesBtn && examplesMenu) {
    examplesBtn.addEventListener('click', async () => {
      if (!examplesMenu.classList.contains('hidden')) {
        closeExamplesMenu();
        return;
      }
      if (tutosMenu) tutosMenu.classList.add('hidden');
      await openExamplesMenu();
    });

    document.addEventListener('click', (e) => {
      if (examplesMenu.classList.contains('hidden')) return;
      const target = e.target;
      if (target === examplesBtn) return;
      if (examplesMenu.contains(target)) return;
      closeExamplesMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeExamplesMenu();
    });
  }

  const closeTutosMenu = () => {
    if (!tutosMenu) return;
    tutosMenu.classList.add('hidden');
    try {
      localStorage.setItem('wgstudio.mission.menuOpen', '0');
    } catch (e) {
    }
  };

  const loadMissionChecklist = (lang) => {
    try {
      const raw = localStorage.getItem(`wgstudio.mission.checklist.${lang}`);
      const json = raw ? JSON.parse(raw) : null;
      return (json && typeof json === 'object') ? json : {};
    } catch (e) {
      return {};
    }
  };

  const saveMissionChecklist = (lang, data) => {
    try {
      localStorage.setItem(`wgstudio.mission.checklist.${lang}`, JSON.stringify(data || {}));
    } catch (e) {
    }
  };

  const openTutosMenu = async () => {
    if (!tutosMenu) return;
    tutosMenu.classList.remove('hidden');
    try {
      localStorage.setItem('wgstudio.mission.menuOpen', '1');
    } catch (e) {
    }

    const lang = (window.i18next && window.i18next.isInitialized && window.i18next.language)
      ? window.i18next.language
      : (getStoredLanguage() || 'fr');
    const safeLang = (lang === 'en') ? 'en' : 'fr';

    if (tutosMenu.dataset.loaded === '1' && tutosMenu.dataset.lang === safeLang) return;
    tutosMenu.dataset.lang = safeLang;

    let pdfFiles = [];
    try {
      const agentRes = await fetch(`${agentBaseUrl}/tutos?lang=${encodeURIComponent(safeLang)}`, { cache: 'no-cache' });
      if (agentRes.ok) {
        const json = await agentRes.json();
        if (Array.isArray(json?.pdfs)) pdfFiles = json.pdfs;
      } else {
        throw new Error(`HTTP ${agentRes.status}`);
      }
    } catch (e) {
      try {
        const res = await fetch(`Tutos/${encodeURIComponent(safeLang)}/manifest.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (Array.isArray(json)) pdfFiles = json;
        else if (Array.isArray(json?.pdfs)) pdfFiles = json.pdfs;
      } catch (err) {
        logConsole(`Impossible de charger la liste des tutos : ${err.message || err}`, 'load');
      }
    }

    tutosMenu.innerHTML = '';
    if (!pdfFiles.length) {
      const empty = document.createElement('div');
      empty.className = 'eyebrow';
      empty.style.padding = '10px 12px';
      empty.textContent = '—';
      tutosMenu.appendChild(empty);
      tutosMenu.dataset.loaded = '1';
      return;
    }

    const checklist = loadMissionChecklist(safeLang);
    let lastMission = null;
    try {
      lastMission = localStorage.getItem(`wgstudio.mission.last.${safeLang}`);
    } catch (e) {
      lastMission = null;
    }

    pdfFiles.forEach((fileName) => {
      const row = document.createElement('div');
      row.className = 'mission-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'mission-check';
      cb.checked = Boolean(checklist[fileName]);
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      cb.addEventListener('change', () => {
        checklist[fileName] = Boolean(cb.checked);
        saveMissionChecklist(safeLang, checklist);
      });

      const link = document.createElement('a');
      link.className = 'examples-item';
      link.href = `Tutos/${encodeURIComponent(safeLang)}/${encodeURIComponent(fileName)}`;
      link.download = '';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = String(fileName);
      if (lastMission && String(lastMission) === String(fileName)) {
        try {
          link.style.borderColor = 'rgba(124, 247, 196, 0.45)';
        } catch (e) {
        }
      }
      link.addEventListener('click', () => {
        try {
          localStorage.setItem(`wgstudio.mission.last.${safeLang}`, String(fileName));
        } catch (e) {
        }
        closeTutosMenu();
      });

      row.appendChild(cb);
      row.appendChild(link);
      tutosMenu.appendChild(row);
    });

    tutosMenu.dataset.loaded = '1';
  };

  if (tutosBtn && tutosMenu) {
    tutosBtn.addEventListener('click', async () => {
      if (!tutosMenu.classList.contains('hidden')) {
        closeTutosMenu();
        return;
      }
      closeExamplesMenu();
      await openTutosMenu();
    });

    document.addEventListener('click', (e) => {
      if (tutosMenu.classList.contains('hidden')) return;
      const target = e.target;
      if (target === tutosBtn) return;
      if (tutosMenu.contains(target)) return;
      closeTutosMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeTutosMenu();
    });
  }

  try {
    if (tutosMenu && localStorage.getItem('wgstudio.mission.menuOpen') === '1') {
      openTutosMenu();
    }
  } catch (e) {
  }

  const helpState = {
    images: [],
    lang: null,
    themeDir: null,
    index: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
  };

  const getSafeLang = () => {
    const lang = (window.i18next && window.i18next.isInitialized && window.i18next.language)
      ? window.i18next.language
      : (getStoredLanguage() || 'fr');
    return (lang === 'en') ? 'en' : 'fr';
  };

  const getSafeHelpThemeDir = () => {
    const theme = (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.theme === 'light')
      ? 'light'
      : (getStoredTheme() || 'dark');
    return theme === 'light' ? 'Light' : 'Dark';
  };

  const closeHelpModal = () => {
    if (!helpModal) return;
    helpModal.classList.add('hidden');
  };

  const applyHelpTransform = () => {
    if (!helpMainImage) return;
    const z = Math.max(1, Math.min(6, helpState.zoom || 1));
    helpState.zoom = z;
    const x = Number.isFinite(helpState.panX) ? helpState.panX : 0;
    const y = Number.isFinite(helpState.panY) ? helpState.panY : 0;
    helpMainImage.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    if (helpImageWrap) {
      try {
        helpImageWrap.classList.toggle('is-zoomed', z > 1);
      } catch (e) {
      }
    }
  };

  const resetHelpZoom = () => {
    helpState.zoom = 1;
    helpState.panX = 0;
    helpState.panY = 0;
    applyHelpTransform();
  };

  const setHelpIndex = (nextIndex) => {
    if (!helpState.images.length) return;
    const max = helpState.images.length;
    const idx = ((nextIndex % max) + max) % max;
    helpState.index = idx;
    if (helpMainImage) {
      helpMainImage.src = helpState.images[idx];
    }
    resetHelpZoom();
    if (helpThumbs) {
      Array.from(helpThumbs.querySelectorAll('.help-thumb')).forEach((el, i) => {
        try {
          el.classList.toggle('active', i === idx);
        } catch (e) {
        }
      });
    }
  };

  const renderHelpThumbs = () => {
    if (!helpThumbs) return;
    helpThumbs.innerHTML = '';
    helpState.images.forEach((src, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'help-thumb';
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      thumb.appendChild(img);
      thumb.addEventListener('click', () => setHelpIndex(i));
      helpThumbs.appendChild(thumb);
    });
  };

  const renderHelpEmpty = () => {
    if (helpMainImage) {
      helpMainImage.removeAttribute('src');
    }
    if (helpThumbs) {
      helpThumbs.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'eyebrow';
      empty.style.padding = '10px 12px';
      empty.textContent = '—';
      helpThumbs.appendChild(empty);
    }
  };

  const fetchHelpManifest = async (lang, themeDir) => {
    const root = `Aide/${encodeURIComponent(lang)}`;
    const themed = `${root}/${encodeURIComponent(themeDir)}/manifest.json`;
    const legacy = `${root}/manifest.json`;
    let res = await fetch(themed, { cache: 'no-cache' });
    if (!res.ok) {
      res = await fetch(legacy, { cache: 'no-cache' });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  const loadHelpImages = async () => {
    const safeLang = getSafeLang();
    const themeDir = getSafeHelpThemeDir();
    if (helpState.lang === safeLang && helpState.themeDir === themeDir && helpState.images.length) return;

    const normalize = (lang, themeDir, json) => {
      const list = Array.isArray(json) ? json : (Array.isArray(json?.images) ? json.images : []);
      return list
        .map((name) => `Aide/${encodeURIComponent(lang)}/${encodeURIComponent(themeDir)}/${encodeURIComponent(String(name))}`)
        .filter(Boolean);
    };

    let images = [];
    try {
      images = normalize(safeLang, themeDir, await fetchHelpManifest(safeLang, themeDir));
    } catch (e) {
    }

    helpState.lang = safeLang;
    helpState.themeDir = themeDir;
    helpState.images = images;
    helpState.index = 0;
    if (helpState.images.length) {
      renderHelpThumbs();
      setHelpIndex(0);
    } else {
      renderHelpEmpty();
      resetHelpZoom();
    }
  };

  const openHelpModal = async () => {
    if (!helpModal) return;
    await loadHelpImages();
    helpModal.classList.remove('hidden');
    applyHelpTransform();
  };

  if (helpBtn) {
    helpBtn.addEventListener('click', async () => {
      if (helpModal && !helpModal.classList.contains('hidden')) {
        closeHelpModal();
        return;
      }
      try {
        closeExamplesMenu();
      } catch (e) {
      }
      try {
        closeTutosMenu();
      } catch (e) {
      }
      await openHelpModal();
    });
  }

  if (helpCloseBtn) {
    helpCloseBtn.addEventListener('click', () => closeHelpModal());
  }
  if (helpResetZoomBtn) {
    helpResetZoomBtn.addEventListener('click', () => resetHelpZoom());
  }
  if (helpPrevBtn) {
    helpPrevBtn.addEventListener('click', () => setHelpIndex(helpState.index - 1));
  }
  if (helpNextBtn) {
    helpNextBtn.addEventListener('click', () => setHelpIndex(helpState.index + 1));
  }

  if (helpImageWrap && helpMainImage) {
    helpImageWrap.addEventListener('wheel', (e) => {
      if (!helpModal || helpModal.classList.contains('hidden')) return;
      e.preventDefault();

      const rect = helpImageWrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const prevZoom = helpState.zoom;
      const delta = e.deltaY;
      const factor = delta > 0 ? 0.9 : 1.1;
      const nextZoom = Math.max(1, Math.min(6, prevZoom * factor));
      if (nextZoom === prevZoom) return;

      // Keep the point under the cursor stable in screen space.
      // With transform: translate(pan) scale(zoom) and origin (0,0), the screen point is:
      // s = (p * zoom) + pan  =>  p = (s - pan) / zoom
      const px = (mx - helpState.panX) / prevZoom;
      const py = (my - helpState.panY) / prevZoom;
      helpState.zoom = nextZoom;
      helpState.panX = mx - px * nextZoom;
      helpState.panY = my - py * nextZoom;
      applyHelpTransform();
    }, { passive: false });

    helpMainImage.addEventListener('dblclick', (e) => {
      if (!helpModal || helpModal.classList.contains('hidden')) return;
      e.preventDefault();
      if (helpState.zoom > 1) {
        resetHelpZoom();
        return;
      }

      const rect = helpImageWrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const nextZoom = 2;
      helpState.zoom = nextZoom;
      helpState.panX = -(mx * (nextZoom - 1));
      helpState.panY = -(my * (nextZoom - 1));
      applyHelpTransform();
    });

    helpMainImage.addEventListener('mousedown', (e) => {
      if (helpState.zoom <= 1) return;
      helpState.isDragging = true;
      helpState.dragStartX = e.clientX;
      helpState.dragStartY = e.clientY;
      helpState.dragStartPanX = helpState.panX;
      helpState.dragStartPanY = helpState.panY;
      try {
        helpImageWrap.classList.add('is-dragging');
      } catch (err) {
      }
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!helpState.isDragging) return;
      const dx = e.clientX - helpState.dragStartX;
      const dy = e.clientY - helpState.dragStartY;
      helpState.panX = helpState.dragStartPanX + dx;
      helpState.panY = helpState.dragStartPanY + dy;
      applyHelpTransform();
    });

    document.addEventListener('mouseup', () => {
      if (!helpState.isDragging) return;
      helpState.isDragging = false;
      try {
        helpImageWrap.classList.remove('is-dragging');
      } catch (err) {
      }
    });
  }
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      const content = helpModal.querySelector('.modal-content');
      const target = e.target;
      if (content && content.contains(target)) return;
      closeHelpModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (helpModal && !helpModal.classList.contains('hidden')) {
      closeHelpModal();
      return;
    }
  });

  function toggleAccountPanel(forceOpen) {
    if (!accountPanel) return;
    if (forceOpen === true) accountPanel.classList.remove('hidden');
    else if (forceOpen === false) accountPanel.classList.add('hidden');
    else accountPanel.classList.toggle('hidden');
  }

  function t(key, options, fallback) {
    try {
      if (window.i18next && window.i18next.isInitialized) {
        const res = window.i18next.t(key, options);
        if (typeof res === 'string' && res.length) return res;
      }
    } catch (e) {
    }
    return fallback;
  }

  const schedulePreviewResize = (() => {
    let raf = 0;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (activeTabName === 'buffers') {
          renderPreview();
        }
      });
    };
  })();

  const scheduleSystemLayoutUpdate = (() => {
    let raf = 0;
    let lastStacked = false;
    let lastTwoCol = false;

    const MIN_MAIN_WIDTH = 980;
    const UNSTACK_MAIN_WIDTH = 1100;

    const TWO_COL_MAIN_WIDTH = 1180;
    const UN_TWO_COL_MAIN_WIDTH = 1280;

    const getShellGap = () => {
      try {
        const shell = document.querySelector('.app-shell');
        if (!shell) return 12;
        const gap = parseFloat(getComputedStyle(shell).gap);
        return Number.isFinite(gap) ? gap : 12;
      } catch (e) {
        return 12;
      }
    };

    const applyStackedClass = (stacked) => {
      try {
        document.documentElement.classList.toggle('system-stacked', Boolean(stacked));
      } catch (e) {
      }
      lastStacked = Boolean(stacked);

      if (stacked) {
        try {
          document.documentElement.classList.remove('system-two-col');
        } catch (e) {
        }
        lastTwoCol = false;
      }

      if (!systemInfoModal) return;
      if (stacked) {
        try {
          systemInfoModal.style.width = '';
        } catch (e) {
        }
      }
    };

    const update = () => {
      if (!systemInfoModal) return;
      const isOpen = !systemInfoModal.classList.contains('hidden');
      try {
        if (!isOpen) {
          applyStackedClass(false);
          try {
            document.documentElement.classList.remove('system-two-col');
          } catch (e) {
          }
          lastTwoCol = false;
          return;
        }

        const main = document.querySelector('main.app');
        if (!main) return;

        const shell = document.querySelector('.app-shell');
        const shellW = shell ? shell.getBoundingClientRect().width : window.innerWidth;
        const mainW = main.getBoundingClientRect().width;
        const gap = getShellGap();
        const minPanelW = 320;
        const maxPanelW = Math.floor(shellW - gap - MIN_MAIN_WIDTH);

        if (maxPanelW < minPanelW) {
          applyStackedClass(true);
          return;
        }

        if (lastStacked) {
          if (mainW > UNSTACK_MAIN_WIDTH) {
            applyStackedClass(false);
            const storedW = getStoredSystemPanelWidth();
            if (storedW) applySystemPanelWidth(storedW);
          }
          return;
        }

        if (mainW < MIN_MAIN_WIDTH) {
          applyStackedClass(true);
          return;
        }

        if (lastTwoCol) {
          if (mainW > UN_TWO_COL_MAIN_WIDTH) {
            try {
              document.documentElement.classList.remove('system-two-col');
            } catch (e) {
            }
            lastTwoCol = false;
          }
        } else if (mainW < TWO_COL_MAIN_WIDTH) {
          try {
            document.documentElement.classList.add('system-two-col');
          } catch (e) {
          }
          lastTwoCol = true;
        }
      } catch (e) {
      }
    };

    return () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
  })();

  const sysFpsValue = document.getElementById('sysFpsValue');
  const sysFrameTimeValue = document.getElementById('sysFrameTimeValue');
  const sysHeapValue = document.getElementById('sysHeapValue');
  const sysFpsBar = document.getElementById('sysFpsBar');
  const sysFrameBar = document.getElementById('sysFrameBar');
  const sysHeapBar = document.getElementById('sysHeapBar');
  const sysFpsChart = document.getElementById('sysFpsChart');

  const sysBrowser = document.getElementById('sysBrowser');
  const sysPlatform = document.getElementById('sysPlatform');
  const sysLanguage = document.getElementById('sysLanguage');
  const sysCpu = document.getElementById('sysCpu');
  const sysRam = document.getElementById('sysRam');
  const sysScreen = document.getElementById('sysScreen');
  const sysStorage = document.getElementById('sysStorage');
  const sysAgentStatus = document.getElementById('sysAgentStatus');
  const sysOs = document.getElementById('sysOs');
  const sysCpuModel = document.getElementById('sysCpuModel');
  const sysCpuUsage = document.getElementById('sysCpuUsage');
  const sysLoadAvg = document.getElementById('sysLoadAvg');
  const sysRamUsage = document.getElementById('sysRamUsage');

  const sysWebGpu = document.getElementById('sysWebGpu');
  const sysWebGpuAdapter = document.getElementById('sysWebGpuAdapter');
  const sysWebGpuFeatures = document.getElementById('sysWebGpuFeatures');
  const sysWebGl = document.getElementById('sysWebGl');
  const sysGpuName = document.getElementById('sysGpuName');
  const sysGpuDriver = document.getElementById('sysGpuDriver');
  const sysGpuUtil = document.getElementById('sysGpuUtil');
  const sysVramUsage = document.getElementById('sysVramUsage');
  const sysGpuUtilBar = document.getElementById('sysGpuUtilBar');
  const sysVramBar = document.getElementById('sysVramBar');
  const sysGpuUtilChart = document.getElementById('sysGpuUtilChart');
  const sysVramChart = document.getElementById('sysVramChart');
  const sysGpuDetectedCount = document.getElementById('sysGpuDetectedCount');
  const sysGpuDetectedList = document.getElementById('sysGpuDetectedList');

  const sysTexCount = document.getElementById('sysTexCount');
  const sysTexBytes = document.getElementById('sysTexBytes');
  const sysWebGpuLimitsCount = document.getElementById('sysWebGpuLimitsCount');
  const sysWebGpuLimits = document.getElementById('sysWebGpuLimits');

  let sysRafId = null;
  let sysAgentIntervalId = null;
  let sysLastAgentData = null;
  let sysLastTs = 0;
  let sysFrameTimes = [];
  let sysFpsSamples = [];
  let sysFpsAccumMs = 0;
  let sysFpsAccumFrames = 0;
  let sysGpuUtilSamples = [];
  let sysVramSamples = [];
  let webgpuProbePromise = null;

  const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

  const formatBytes = (bytes) => {
    const b = Number(bytes) || 0;
    if (!Number.isFinite(b) || b <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = b;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
  };

  const formatPercent = (n01) => `${Math.round(clamp01(n01) * 100)}%`;

  const safeJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return '';
    }
  };

  const extractPrototypeGetters = (obj) => {
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return obj;
    const out = {};
    try {
      const proto = Object.getPrototypeOf(obj);
      if (!proto) return obj;
      Object.getOwnPropertyNames(proto).forEach((name) => {
        if (name === 'constructor') return;
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        if (!desc || typeof desc.get !== 'function') return;
        try {
          const v = obj[name];
          if (typeof v !== 'function') out[name] = v;
        } catch (e) {
        }
      });
    } catch (e) {
      return obj;
    }
    return Object.keys(out).length ? out : obj;
  };

  const toSerializable = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj;
    const extracted = extractPrototypeGetters(obj);
    if (extracted !== obj) return extracted;
    try {
      const keys = Reflect.ownKeys(obj);
      if (keys && keys.length) return obj;
    } catch (e) {
    }
    return obj;
  };

  const ensureWebGPUProbe = async () => {
    if (!navigator.gpu) return;
    if (currentAdapter && currentDevice) return;
    if (webgpuProbePromise) {
      try {
        await webgpuProbePromise;
      } catch (e) {
      }
      return;
    }

    webgpuProbePromise = (async () => {
      await simulationRuntime.probeWebGPU();
      syncRuntimeState();
    })();

    try {
      await webgpuProbePromise;
    } catch (e) {
    } finally {
      webgpuProbePromise = null;
    }
  };

  const limitsToObject = (limits) => {
    if (!limits) return null;
    const extracted = extractPrototypeGetters(limits);
    if (extracted && extracted !== limits) return extracted;
    return null;
  };

  const getLimitsEntries = (limits) => {
    if (!limits) return [];
    const out = [];
    const seen = new Set();
    const add = (key, value) => {
      if (!key || key === 'constructor' || seen.has(key)) return;
      seen.add(key);
      out.push([key, value]);
    };
    try {
      const proto = Object.getPrototypeOf(limits);
      if (proto) {
        Object.getOwnPropertyNames(proto).forEach((name) => {
          const desc = Object.getOwnPropertyDescriptor(proto, name);
          if (!desc || typeof desc.get !== 'function') return;
          try {
            const v = limits[name];
            if (typeof v !== 'function') add(name, v);
          } catch (e) {
          }
        });
      }
    } catch (e) {
    }
    try {
      Object.keys(limits).forEach((name) => add(name, limits[name]));
    } catch (e) {
    }
    return out;
  };

  const setBar = (el, value01) => {
    if (!el) return;
    el.style.width = `${Math.round(clamp01(value01) * 100)}%`;
  };

  const drawSpark = (canvas, samples, minV, maxV) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(124, 247, 196, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const n = samples.length;
    if (n <= 1) return;
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1)) * (w - 8) + 4;
      const v = samples[i];
      const t = clamp01((v - minV) / (maxV - minV));
      const y = (1 - t) * (h - 8) + 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  const drawSparkTime = (canvas, samples, minV, maxV, windowMs) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(124, 247, 196, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const n = samples.length;
    if (n <= 1) return;
    const t1 = samples[n - 1]?.t;
    const t0 = Number.isFinite(t1) ? (t1 - (Number(windowMs) || 0)) : samples[0]?.t;
    const denom = (t1 - t0) || 1;
    for (let i = 0; i < n; i += 1) {
      const s = samples[i];
      const x = clamp01((s.t - t0) / denom) * (w - 8) + 4;
      const v = s.v;
      const t = clamp01((v - minV) / (maxV - minV));
      const y = (1 - t) * (h - 8) + 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  const getWebGLInfo = () => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return 'Not available';
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        return `${vendor} · ${renderer}`;
      }
      return String(gl.getParameter(gl.RENDERER) || 'WebGL');
    } catch (e) {
      return 'Not available';
    }
  };

  const updateSystemStatic = async () => {
    await ensureWebGPUProbe();
    if (sysBrowser) sysBrowser.textContent = navigator.userAgent || '—';
    if (sysPlatform) sysPlatform.textContent = navigator.platform || '—';
    if (sysLanguage) sysLanguage.textContent = navigator.language || '—';

    try {
      const ua = navigator.userAgentData;
      if (ua && typeof ua.getHighEntropyValues === 'function') {
        const hi = await ua.getHighEntropyValues(['platformVersion', 'architecture', 'model', 'uaFullVersion']);
        if (sysPlatform) {
          const parts = [ua.platform, hi.platformVersion, hi.architecture, hi.model].filter(Boolean);
          sysPlatform.textContent = parts.join(' · ') || (navigator.platform || '—');
        }
        if (sysBrowser) {
          const brand = Array.isArray(ua.brands) ? ua.brands.map((b) => `${b.brand} ${b.version}`).join(', ') : '';
          sysBrowser.textContent = [brand, hi.uaFullVersion].filter(Boolean).join(' · ') || (navigator.userAgent || '—');
        }
      }
    } catch (e) {
    }

    const cores = navigator.hardwareConcurrency;
    if (sysCpu) {
      sysCpu.textContent = Number.isFinite(cores)
        ? t('system.values.cpu_cores', { count: cores }, `${cores} cores`)
        : '—';
    }

    const ramGb = navigator.deviceMemory;
    if (sysRam) sysRam.textContent = Number.isFinite(ramGb) ? `~${ramGb} GB` : '—';

    const screenText = `${window.screen?.width || 0}×${window.screen?.height || 0} @${window.devicePixelRatio || 1}x`;
    if (sysScreen) sysScreen.textContent = screenText;

    if (sysWebGpu) {
      sysWebGpu.textContent = navigator.gpu
        ? t('system.values.supported', null, 'Supported')
        : t('system.values.not_supported', null, 'Not supported');
    }
    if (sysWebGl) {
      const glInfo = getWebGLInfo();
      sysWebGl.textContent = (glInfo === 'Not available')
        ? t('system.values.not_available', null, 'Not available')
        : glInfo;
    }

    if (sysStorage) {
      try {
        if (navigator.storage && typeof navigator.storage.estimate === 'function') {
          const est = await navigator.storage.estimate();
          const usage = est?.usage;
          const quota = est?.quota;
          if (Number.isFinite(usage) && Number.isFinite(quota) && quota > 0) {
            sysStorage.textContent = `${formatBytes(usage)} / ${formatBytes(quota)} (${formatPercent(usage / quota)})`;
          } else {
            sysStorage.textContent = '—';
          }
        } else {
          sysStorage.textContent = '—';
        }
      } catch (e) {
        sysStorage.textContent = '—';
      }
    }

    if (sysWebGpuAdapter) {
      if (currentAdapterInfo && typeof currentAdapterInfo === 'object') {
        const parts = [];
        if (currentAdapterInfo.vendor) parts.push(currentAdapterInfo.vendor);
        if (currentAdapterInfo.architecture) parts.push(currentAdapterInfo.architecture);
        if (currentAdapterInfo.description) parts.push(currentAdapterInfo.description);
        if (currentAdapterInfo.device) parts.push(currentAdapterInfo.device);
        sysWebGpuAdapter.textContent = parts.filter(Boolean).join(' · ') || '—';
      } else {
        sysWebGpuAdapter.textContent = '—';
      }
    }

    if (sysWebGpuFeatures) {
      if (currentDevice && currentDevice.features) {
        const feats = Array.from(currentDevice.features);
        sysWebGpuFeatures.textContent = feats.slice(0, 12).join(', ') || '—';
      } else {
        sysWebGpuFeatures.textContent = '—';
      }
    }

    if (sysWebGpuLimits) {
      if (currentDevice && currentDevice.limits) {
        const entries = getLimitsEntries(currentDevice.limits)
          .sort(([a], [b]) => a.localeCompare(b));
        if (sysWebGpuLimitsCount) {
          sysWebGpuLimitsCount.textContent = entries.length ? String(entries.length) : '—';
        }
        sysWebGpuLimits.textContent = entries.length
          ? entries.map(([k, v]) => `${k}: ${Number.isFinite(v) ? v.toLocaleString() : String(v)}`).join('\n')
          : '—';
      } else {
        if (sysWebGpuLimitsCount) sysWebGpuLimitsCount.textContent = '—';
        sysWebGpuLimits.textContent = '—';
      }
    }
  };

  const estimateTextureBytes = () => {
    let total = 0;
    textures.forEach((tex) => {
      const x = tex?.size?.x || 0;
      const y = tex?.size?.y || 0;
      const z = tex?.size?.z || 0;
      total += x * y * z * getTextureComponentCount(tex?.type) * 4;
    });
    return total;
  };

  const estimateBufferBytes = () => {
    let total = 0;
    try {
      const resources = simulationRuntime.getResourceStats();
      const uniformCount = resources.uniformBuffers || 0;
      total += uniformCount * 4;
      total += (resources.dummyStorageBuffers || 0) * 4;
    } catch (e) {
    }
    return total;
  };

  const updateSystemApp = () => {
    if (sysTexCount) sysTexCount.textContent = String(textures.length);
    if (sysTexBytes) {
      const texBytes = estimateTextureBytes();
      const bufBytes = estimateBufferBytes();
      sysTexBytes.textContent = `${formatBytes(texBytes)} (+ ${formatBytes(bufBytes)} buffers)`;
    }
  };

  const getSystemSnapshot = async () => {
    let storage = null;
    try {
      storage = (navigator.storage && navigator.storage.estimate) ? await navigator.storage.estimate() : null;
    } catch (e) {
      storage = null;
    }
    return {
      time: new Date().toISOString(),
      navigator: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemoryGB: navigator.deviceMemory,
      },
      screen: {
        width: window.screen?.width,
        height: window.screen?.height,
        devicePixelRatio: window.devicePixelRatio,
      },
      storage,
      webgl: {
        renderer: getWebGLInfo(),
      },
      webgpu: {
        supported: Boolean(navigator.gpu),
        adapterInfo: currentAdapterInfo ? toSerializable(currentAdapterInfo) : null,
        features: currentDevice?.features ? Array.from(currentDevice.features) : [],
        limits: currentDevice?.limits ? limitsToObject(currentDevice.limits) : null,
      },
      agent: sysLastAgentData,
      app: {
        texturesCount: textures.length,
        texturesBytesEstimated: estimateTextureBytes(),
        buffersBytesEstimated: estimateBufferBytes(),
        textures: textures.map((tex) => ({
          id: tex.id,
          name: tex.name,
          type: tex.type,
          size: tex.size,
          bytesEstimated: (tex?.size?.x || 0) * (tex?.size?.y || 0) * (tex?.size?.z || 0) * 4,
        })),
      },
    };
  };

  const agentBaseUrl = 'http://127.0.0.1:8765';
  const systemPanelWidthKey = 'wgstudio.systemPanelWidth';

  const getStoredSystemPanelWidth = () => {
    try {
      const v = Number(localStorage.getItem(systemPanelWidthKey));
      return Number.isFinite(v) ? v : null;
    } catch (e) {
      return null;
    }
  };

  const setStoredSystemPanelWidth = (px) => {
    try {
      localStorage.setItem(systemPanelWidthKey, String(Math.round(px)));
    } catch (e) {
    }
  };

  const applySystemPanelWidth = (px) => {
    if (!systemInfoModal) return;
    try {
      if (document.documentElement.classList.contains('system-stacked')) {
        systemInfoModal.style.width = '';
        return;
      }
    } catch (e) {
    }

    const shell = document.querySelector('.app-shell');
    const shellW = shell ? shell.getBoundingClientRect().width : window.innerWidth;
    let gap = 12;
    try {
      gap = shell ? (parseFloat(getComputedStyle(shell).gap) || 12) : 12;
    } catch (e) {
    }

    const minPanelW = 320;
    const minMainW = 980;
    const maxPanelW = Math.max(minPanelW, Math.floor(shellW - gap - minMainW));

    const candidate = Number(px) || 0;
    const w = Math.max(minPanelW, Math.min(window.innerWidth * 0.92, Math.min(maxPanelW, candidate)));

    if (Number.isFinite(w) && w > 0) systemInfoModal.style.width = `${Math.round(w)}px`;
    scheduleSystemLayoutUpdate();
  };

  const stopAgentPoll = () => {
    if (sysAgentIntervalId) clearInterval(sysAgentIntervalId);
    sysAgentIntervalId = null;
  };

  let agentSystemDisabled = false;

  const fetchAgentSystem = async () => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 900);
    try {
      const res = await fetch(`${agentBaseUrl}/system`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      agentSystemDisabled = true;
      throw err;
    } finally {
      clearTimeout(to);
    }
  };

  const setText = (el, txt) => {
    if (!el) return;
    el.textContent = txt;
  };

  const updateFromAgent = (data) => {
    sysLastAgentData = data;
    setText(sysAgentStatus, t('system.values.agent_online', null, 'Online'));

    if (sysCpu) {
      const c = data?.cpu?.coresLogical;
      if (Number.isFinite(c)) {
        sysCpu.textContent = t('system.values.cpu_cores', { count: c }, `${c} cores`);
      }
    }

    if (sysRam) {
      const totalBytes = data?.memory?.totalBytes;
      if (Number.isFinite(totalBytes) && totalBytes > 0) {
        sysRam.textContent = `~${formatBytes(totalBytes)}`;
      }
    }

    const osText = data?.os
      ? `${data.os.platform || ''} ${data.os.release || ''} ${data.os.arch || ''}`.trim()
      : '—';
    setText(sysOs, osText || '—');

    setText(sysCpuModel, data?.cpu?.model || '—');

    const cpuUsage01 = (typeof data?.cpu?.usage01 === 'number') ? data.cpu.usage01 : null;
    setText(sysCpuUsage, cpuUsage01 === null ? '—' : `${Math.round(cpuUsage01 * 100)}%`);

    const load = Array.isArray(data?.cpu?.loadavg) ? data.cpu.loadavg : null;
    setText(sysLoadAvg, load ? load.map((n) => Number(n).toFixed(2)).join(', ') : '—');

    const total = data?.memory?.totalBytes;
    const free = data?.memory?.freeBytes;
    if (Number.isFinite(total) && Number.isFinite(free) && total > 0) {
      const used = total - free;
      setText(sysRamUsage, `${formatBytes(used)} / ${formatBytes(total)} (${formatPercent(used / total)})`);
    } else {
      setText(sysRamUsage, '—');
    }

    const nvsmi = Array.isArray(data?.gpu?.nvidiaSmi) ? data.gpu.nvidiaSmi : null;
    if (nvsmi && nvsmi.length) {
      const g0 = nvsmi[0];
      setText(sysGpuName, g0.name || 'NVIDIA');
      setText(sysGpuDriver, g0.driverVersion || '—');
      const utilPct = Number.isFinite(g0.utilizationGpuPercent) ? g0.utilizationGpuPercent : null;
      setText(sysGpuUtil, utilPct === null ? '—' : `${utilPct}%`);
      if (sysGpuUtilBar) setBar(sysGpuUtilBar, utilPct === null ? 0 : clamp01(utilPct / 100));
      if (utilPct !== null) {
        sysGpuUtilSamples.push(utilPct);
        sysGpuUtilSamples = sysGpuUtilSamples.slice(-90);
        drawSpark(sysGpuUtilChart, sysGpuUtilSamples, 0, 100);
      }

      if (Number.isFinite(g0.memoryUsedMB) && Number.isFinite(g0.memoryTotalMB) && g0.memoryTotalMB > 0) {
        const usedB = g0.memoryUsedMB * 1024 * 1024;
        const totB = g0.memoryTotalMB * 1024 * 1024;
        setText(sysVramUsage, `${formatBytes(usedB)} / ${formatBytes(totB)} (${formatPercent(usedB / totB)})`);
        if (sysVramBar) setBar(sysVramBar, clamp01(usedB / totB));
        const vramPct = (usedB / totB) * 100;
        sysVramSamples.push(vramPct);
        sysVramSamples = sysVramSamples.slice(-90);
        drawSpark(sysVramChart, sysVramSamples, 0, 100);
      } else {
        setText(sysVramUsage, '—');
        if (sysVramBar) setBar(sysVramBar, 0);
      }
    } else {
      const pci = Array.isArray(data?.gpu?.pci) ? data.gpu.pci : null;
      setText(sysGpuName, pci && pci.length ? pci[0] : '—');
      setText(sysGpuDriver, '—');
      setText(sysGpuUtil, '—');
      setText(sysVramUsage, '—');
      if (sysGpuUtilBar) setBar(sysGpuUtilBar, 0);
      if (sysVramBar) setBar(sysVramBar, 0);
      sysGpuUtilSamples = [];
      sysVramSamples = [];
      drawSpark(sysGpuUtilChart, sysGpuUtilSamples, 0, 100);
      drawSpark(sysVramChart, sysVramSamples, 0, 100);
    }

    const pci = Array.isArray(data?.gpu?.pci) ? data.gpu.pci : [];
    const allGpuLines = [];
    if (pci.length) {
      allGpuLines.push('PCI:');
      pci.forEach((l) => allGpuLines.push(`- ${l}`));
    }
    if (nvsmi && nvsmi.length) {
      allGpuLines.push('nvidia-smi:');
      nvsmi.forEach((g) => {
        const used = Number.isFinite(g.memoryUsedMB) ? `${g.memoryUsedMB}MB` : '—';
        const tot = Number.isFinite(g.memoryTotalMB) ? `${g.memoryTotalMB}MB` : '—';
        const util = Number.isFinite(g.utilizationGpuPercent) ? `${g.utilizationGpuPercent}%` : '—';
        const temp = Number.isFinite(g.temperatureC) ? `${g.temperatureC}°C` : '—';
        allGpuLines.push(`- ${g.name || 'NVIDIA'} · VRAM ${used}/${tot} · util ${util} · ${temp}`);
      });
    }
    if (sysGpuDetectedCount) {
      const count = (pci?.length || 0) || (nvsmi?.length || 0) || 0;
      sysGpuDetectedCount.textContent = count ? String(count) : '—';
    }
    if (sysGpuDetectedList) {
      sysGpuDetectedList.textContent = allGpuLines.join('\n');
    }

  };

  const setAgentOffline = (err) => {
    sysLastAgentData = null;
    setText(sysAgentStatus, t('system.values.agent_offline', null, 'Offline'));
    setText(sysOs, '—');
    setText(sysCpuModel, '—');
    setText(sysCpuUsage, '—');
    setText(sysLoadAvg, '—');
    setText(sysRamUsage, '—');
    setText(sysGpuName, '—');
    setText(sysGpuDriver, '—');
    setText(sysGpuUtil, '—');
    setText(sysVramUsage, '—');
    if (sysGpuUtilBar) setBar(sysGpuUtilBar, 0);
    if (sysVramBar) setBar(sysVramBar, 0);
    sysGpuUtilSamples = [];
    sysVramSamples = [];
    drawSpark(sysGpuUtilChart, sysGpuUtilSamples, 0, 100);
    drawSpark(sysVramChart, sysVramSamples, 0, 100);
    if (sysGpuDetectedCount) sysGpuDetectedCount.textContent = '—';
    if (sysGpuDetectedList) sysGpuDetectedList.textContent = '';
  };

  const startAgentPoll = () => {
    stopAgentPoll();
    const tick = async () => {
      if (!systemInfoModal || systemInfoModal.classList.contains('hidden')) {
        stopAgentPoll();
        return;
      }
      if (agentSystemDisabled) {
        stopAgentPoll();
        return;
      }
      try {
        const data = await fetchAgentSystem();
        updateFromAgent(data);
      } catch (e) {
        setAgentOffline(e);
        stopAgentPoll();
      }
    };
    tick();
    sysAgentIntervalId = setInterval(tick, 1000);
  };

  const stopSystemMonitor = () => {
    if (sysRafId) cancelAnimationFrame(sysRafId);
    sysRafId = null;
    sysLastTs = 0;
    sysFrameTimes = [];
    sysFpsSamples = [];
    sysFpsAccumMs = 0;
    sysFpsAccumFrames = 0;
  };

  const startSystemMonitor = () => {
    if (sysRafId) return;
    const loop = (ts) => {
      const systemOpen = Boolean(systemInfoModal && !systemInfoModal.classList.contains('hidden'));
      if (sysLastTs) {
        const dt = ts - sysLastTs;
        sysFrameTimes.push(dt);
        if (sysFrameTimes.length > 120) sysFrameTimes.shift();
        sysFpsAccumMs += dt;
        sysFpsAccumFrames += 1;
        if (sysFpsAccumMs >= 120) {
          const v = (!isRunning || isPaused) ? 0 : (Number.isFinite(runSpeedMeasured) ? runSpeedMeasured : 0);
          sysFpsSamples.push({ t: ts, v });
          const keepMs = 60000;
          while (sysFpsSamples.length && (ts - sysFpsSamples[0].t) > keepMs) sysFpsSamples.shift();
          sysFpsAccumMs = 0;
          sysFpsAccumFrames = 0;
        }
      }
      sysLastTs = ts;

      const avgFps = sysFpsSamples.length
        ? sysFpsSamples.reduce((a, b) => a + (b?.v || 0), 0) / sysFpsSamples.length
        : 0;
      const avgFrame = sysFrameTimes.length
        ? sysFrameTimes.reduce((a, b) => a + b, 0) / sysFrameTimes.length
        : 0;

      if (systemOpen) {
        const sliderMax = Number(runSpeedSlider?.max || fsRunSpeedSlider?.max || 240);
        const simNow = (!isRunning || isPaused) ? 0 : (Number.isFinite(runSpeedMeasured) ? runSpeedMeasured : 0);
        const simFpsText = `${Math.round(simNow)}/s`;
        if (sysFpsValue) sysFpsValue.textContent = simFpsText;
        if (sysFrameTimeValue) sysFrameTimeValue.textContent = avgFrame ? `${avgFrame.toFixed(2)} ms` : '—';
        setBar(sysFpsBar, sliderMax > 0 ? clamp01(simNow / sliderMax) : 0);
        setBar(sysFrameBar, clamp01(avgFrame / 16.67));
        const fpsWindowMs = 30000;
        const fpsWindow = sysFpsSamples.filter((s) => s && Number.isFinite(s.t) && (ts - s.t) <= fpsWindowMs);
        let minFps = Infinity;
        let maxFps = -Infinity;
        for (let i = 0; i < fpsWindow.length; i += 1) {
          const v = fpsWindow[i].v;
          if (!Number.isFinite(v)) continue;
          if (v < minFps) minFps = v;
          if (v > maxFps) maxFps = v;
        }
        if (!Number.isFinite(minFps) || !Number.isFinite(maxFps)) {
          minFps = 0;
          maxFps = 120;
        }
        const pad = Math.max(1, (maxFps - minFps) * 0.12);
        const minV = Math.max(0, minFps - pad);
        const maxV = Math.max(minV + 1, maxFps + pad);
        drawSparkTime(sysFpsChart, fpsWindow, minV, maxV, fpsWindowMs);
        updateSystemApp();
      }

      if (sysHeapValue || sysHeapBar) {
        const mem = performance && performance.memory ? performance.memory : null;
        if (mem && mem.usedJSHeapSize && mem.jsHeapSizeLimit) {
          const used = mem.usedJSHeapSize;
          const limit = mem.jsHeapSizeLimit;
          if (sysHeapValue) sysHeapValue.textContent = `${formatBytes(used)} / ${formatBytes(limit)}`;
          setBar(sysHeapBar, clamp01(used / limit));
        } else {
          if (sysHeapValue) sysHeapValue.textContent = '—';
          setBar(sysHeapBar, 0);
        }
      }

      sysRafId = requestAnimationFrame(loop);
    };
    sysRafId = requestAnimationFrame(loop);
  };

  const openSystemInfo = async () => {
    if (!systemInfoModal) return;
    systemInfoModal.classList.remove('hidden');
    try {
      document.documentElement.classList.add('system-open');
    } catch (e) {
    }
    const storedW = getStoredSystemPanelWidth();
    if (storedW) applySystemPanelWidth(storedW);

    schedulePreviewResize();
    try {
      systemInfoModal.getBoundingClientRect();
      const main = document.querySelector('main.app');
      if (main) main.getBoundingClientRect();
      const shell = document.querySelector('.app-shell');
      if (shell) shell.getBoundingClientRect();
    } catch (e) {
    }

    scheduleSystemLayoutUpdate();
    requestAnimationFrame(() => scheduleSystemLayoutUpdate());
    setTimeout(() => scheduleSystemLayoutUpdate(), 0);
    setTimeout(() => scheduleSystemLayoutUpdate(), 80);

    await updateSystemStatic();
    updateSystemApp();
    startSystemMonitor();
    startAgentPoll();
    schedulePreviewResize();
    scheduleSystemLayoutUpdate();
  };

  const closeSystemInfo = () => {
    if (!systemInfoModal) return;
    systemInfoModal.classList.add('hidden');
    try {
      document.documentElement.classList.remove('system-open');
    } catch (e) {
    }
    try {
      document.documentElement.classList.remove('system-stacked');
    } catch (e) {
    }
    stopAgentPoll();
    schedulePreviewResize();
    scheduleSystemLayoutUpdate();
  };

  function getStoredTheme() {
    try {
      const raw = localStorage.getItem('wgstudio.theme');
      return (raw === 'light' || raw === 'dark') ? raw : null;
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem('wgstudio.theme', theme);
    } catch (e) {
    }
  }

  function applyTheme(theme) {
    const next = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    if (themeToggleBtn) {
      themeToggleBtn.textContent = next === 'dark' ? '☀' : '☾';
      themeToggleBtn.setAttribute('aria-label', next === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre');
    }
    setStoredTheme(next);
  }

  function getStoredLanguage() {
    try {
      const raw = localStorage.getItem('wgstudio.language');
      return (raw === 'fr' || raw === 'en') ? raw : null;
    } catch (e) {
      return null;
    }
  }

  function setStoredLanguage(lang) {
    try {
      localStorage.setItem('wgstudio.language', lang);
    } catch (e) {
    }
  }

  function applyTranslations() {
    if (!window.i18next || !window.i18next.isInitialized) return;

    const versionPill = document.getElementById('versionPill');
    if (versionPill && versionPill.dataset && versionPill.dataset.version) {
      versionPill.textContent = window.i18next.t('header.version', { version: versionPill.dataset.version });
    }

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      if (el === versionPill) return;
      const translation = window.i18next.t(key);
      if (typeof translation !== 'string') return;

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        return;
      }

      if (translation.includes('<')) el.innerHTML = translation;
      else el.textContent = translation;
    });

    document.documentElement.lang = window.i18next.language || 'fr';

    if (languageSelect) {
      languageSelect.value = window.i18next.language || 'fr';
    }

    renderStepCounter();
    setPreviewValue(0, 0, null);
    setRunSpeed(runSpeedSlider?.value || 60);
    if (selectedPipeId) renderPipelineViews();
    if (selectedFunctionId) renderFunctionViews();
    renderParameterViews();
    if (selectedShaderId) {
      const shader = shaders.find((s) => s.id === selectedShaderId) || shaders[0];
      if (shader) {
        selectedShaderId = shader.id;
        renderShaderList();
        renderShaderForm(shader);
        renderShaderEditor(shader);
      }
    }
    if (activeTabName === 'buffers') {
      renderPreview();
    }
  }

  async function initI18n() {
    if (!window.i18next || !window.i18nextHttpBackend) return;
    const lng = getStoredLanguage() || document.documentElement.lang || 'fr';
    try {
      await window.i18next
        .use(window.i18nextHttpBackend)
        .init({
          lng,
          fallbackLng: 'fr',
          debug: false,
          backend: {
            loadPath: 'locales/{{lng}}/translation.json',
          },
          interpolation: {
            escapeValue: false,
          },
          returnNull: false,
        });
      if (languageSelect) {
        languageSelect.value = window.i18next.language || lng;
      }
      applyTranslations();
    } catch (e) {
    }
  }

  function setAccountError(message) {
    if (!accountError) return;
    accountError.textContent = message || '';
  }

  function setAuthFormsDisabled(disabled) {
    const fields = [
      authEmail,
      authPassword,
    ];
    fields.forEach((el) => {
      if (el) el.disabled = disabled;
    });
    if (newsletterOptIn) newsletterOptIn.disabled = disabled;
    if (loginBtn) loginBtn.disabled = disabled;
    if (signupBtn) signupBtn.disabled = disabled;
    if (googleSignInBtn) googleSignInBtn.disabled = disabled;
    if (logoutBtn) logoutBtn.disabled = disabled;
    if (deleteAccountBtn) deleteAccountBtn.disabled = disabled;
  }

  function setAccountState(user) {
    if (!accountStatus) return;
    accountStatus.textContent = user
      ? `Connecté: ${user.email || 'utilisateur'}`
      : 'Non connecté';
    if (accountForms) accountForms.classList.toggle('hidden', !!user);
    if (accountActions) accountActions.classList.toggle('hidden', !user);
    if (newsletterOptIn) {
      newsletterOptIn.disabled = !user;
      if (!user) newsletterOptIn.checked = false;
    }
  }

  function syncEditorRailHeight(textarea, rail) {
    if (!textarea || !rail) return;
    const h = textarea.getBoundingClientRect().height;
    if (!Number.isFinite(h) || h <= 0) return;
    rail.style.height = `${h}px`;
  }

  function getTextareaLineCount(textarea) {
    const value = textarea.value || '';
    return value ? value.split(/\r?\n/).length : 1;
  }

  function getTextareaCaretLine(textarea) {
    const value = textarea.value || '';
    const cursor = Math.max(0, Math.min(textarea.selectionStart || 0, value.length));
    const beforeCursor = value.slice(0, cursor);
    return beforeCursor ? beforeCursor.split(/\r?\n/).length : 1;
  }

  function normalizeLineSet(lines) {
    const out = new Set();
    if (!lines || typeof lines.forEach !== 'function') return out;
    lines.forEach((line) => {
      const n = Number(line);
      if (Number.isFinite(n) && n > 0) out.add(Math.floor(n));
    });
    return out;
  }

  function getEditorLineMetrics(textarea) {
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight) || 21;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    return {
      lineHeight,
      paddingTop,
      scrollTop: textarea.scrollTop || 0,
      clientHeight: textarea.clientHeight || textarea.getBoundingClientRect().height || 0,
    };
  }

  function appendRailLine(rail, line, top, lineHeight, isActive, isError) {
    const marker = document.createElement('div');
    marker.className = [
      'code-rail-line',
      isActive ? 'active' : '',
      isError ? 'error' : '',
    ].filter(Boolean).join(' ');
    marker.style.top = `${top}px`;
    marker.style.height = `${lineHeight}px`;
    marker.style.lineHeight = `${lineHeight}px`;
    marker.textContent = String(line);
    rail.appendChild(marker);
  }

  function renderEditorRail(textarea, rail, errorLines = new Set()) {
    if (!textarea || !rail) return;
    syncEditorRailHeight(textarea, rail);
    const lineCount = getTextareaLineCount(textarea);
    const caretLine = getTextareaCaretLine(textarea);
    const safeErrorLines = normalizeLineSet(errorLines);
    const metrics = getEditorLineMetrics(textarea);
    const startLine = Math.max(
      1,
      Math.floor((metrics.scrollTop - metrics.paddingTop) / metrics.lineHeight) - 1,
    );
    const endLine = Math.min(
      lineCount,
      Math.ceil((metrics.scrollTop + metrics.clientHeight - metrics.paddingTop) / metrics.lineHeight) + 2,
    );

    rail._errorLines = safeErrorLines;
    rail.innerHTML = '';
    for (let line = startLine; line <= endLine; line += 1) {
      appendRailLine(
        rail,
        line,
        metrics.paddingTop + (line - 1) * metrics.lineHeight - metrics.scrollTop,
        metrics.lineHeight,
        line === caretLine,
        safeErrorLines.has(line),
      );
    }
  }

  function refreshEditorRail(textarea, rail) {
    if (!textarea || !rail) return;
    renderEditorRail(textarea, rail, rail._errorLines || new Set());
  }

  function clearEditorRailErrors(textarea, rail) {
    if (!textarea || !rail) return;
    renderEditorRail(textarea, rail, new Set());
  }

  function renderEditorRailErrors(textarea, rail, errorLines) {
    if (!textarea || !rail) return;
    renderEditorRail(textarea, rail, errorLines);
  }

  function attachEditorRailEvents(textarea, rail, highlight) {
    if (!textarea || !rail) return;
    textarea.addEventListener('scroll', () => {
      refreshEditorRail(textarea, rail);
      if (highlight) syncHighlightScroll(textarea, highlight);
    });
    ['click', 'focus', 'keyup', 'select'].forEach((eventName) => {
      textarea.addEventListener(eventName, () => refreshEditorRail(textarea, rail));
    });
  }

  function notifyEditorRailChanged(textarea) {
    if (!textarea) return;
    textarea.dispatchEvent(new Event('select', { bubbles: true }));
    textarea.dispatchEvent(new Event('scroll', { bubbles: true }));
  }

  function firstErrorLocation(kind, id) {
    const candidates = lastLiveWGSLMessages
      .filter((m) => m.resolved && m.resolved.kind === kind && m.resolved.id === id)
      .filter((m) => (m.type || '').toLowerCase().includes('error'))
      .map((m) => m.resolved);
    if (!candidates.length) return null;
    candidates.sort((a, b) => (a.line - b.line) || (a.col - b.col));
    return candidates[0];
  }

  function updateListErrorIndicators() {
    if (functionList) {
      functionList.querySelectorAll('.list-item[data-id]').forEach((el) => {
        const id = el.dataset.id;
        el.classList.toggle('has-error', functionIdsWithErrors.has(id));
      });
    }
    if (shaderList) {
      shaderList.querySelectorAll('.list-item[data-id]').forEach((el) => {
        const id = el.dataset.id;
        el.classList.toggle('has-error', shaderIdsWithErrors.has(id));
      });
    }
  }

  function loadNewsletterPreference(user) {
    if (!firestoreDb || !newsletterOptIn || !user) return;
    firestoreDb
      .collection('users')
      .doc(user.uid)
      .get()
      .then((doc) => {
        const data = doc.exists ? doc.data() : {};
        newsletterOptIn.checked = !!data.newsletterOptIn;
      })
      .catch((err) => {
        setAccountError(err.message || String(err));
      });
  }

  function saveNewsletterPreference(user) {
    if (!firestoreDb || !newsletterOptIn || !user) return;
    firestoreDb
      .collection('users')
      .doc(user.uid)
      .set({
        newsletterOptIn: !!newsletterOptIn.checked,
        email: user.email || null,
        displayName: user.displayName || null,
      }, { merge: true })
      .catch((err) => {
        setAccountError(err.message || String(err));
      });
  }

  function ensureUserProfile(user) {
    if (!firestoreDb || !user) return;
    firestoreDb
      .collection('users')
      .doc(user.uid)
      .set({
        email: user.email || null,
        displayName: user.displayName || null,
      }, { merge: true })
      .catch((err) => {
        setAccountError(err.message || String(err));
      });
  }

  function initFirebaseAuth() {
    if (!accountPanel) return;
    if (!window.firebase || !firebase.initializeApp || !firebase.auth) {
      setAccountError(t('account.errors.firebase_sdk', null, 'Firebase SDK non charge.'));
      setAuthFormsDisabled(true);
      return;
    }
    const missingConfig = Object.values(firebaseConfig).some((val) => !val || val === 'REPLACE_ME');
    if (missingConfig) {
      setAccountError(t('account.errors.firebase_config_missing', null, 'Firebase config manquante.'));
      setAuthFormsDisabled(true);
      return;
    }
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firebaseAuth = firebase.auth();
    firestoreDb = (firebase.firestore && typeof firebase.firestore === 'function')
      ? firebase.firestore()
      : null;
    firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
      setAccountError(err.message || String(err));
    });
    firebaseAuth.onAuthStateChanged((user) => {
      setAccountError('');
      setAccountState(user);
      loadNewsletterPreference(user);
      ensureUserProfile(user);
    });
    setAuthFormsDisabled(false);

    const getAuthCredentials = () => {
      const email = (authEmail?.value || '').trim();
      const password = authPassword?.value || '';
      if (!email || !password) {
        setAccountError(t('account.errors.email_password_required', null, 'Email et mot de passe requis.'));
        return null;
      }
      return { email, password };
    };

    if (loginBtn) {
      loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!firebaseAuth) return;
        const creds = getAuthCredentials();
        if (!creds) return;
        setAccountError('');
        firebaseAuth.signInWithEmailAndPassword(creds.email, creds.password).catch((err) => {
          setAccountError(err.message || String(err));
        });
      });
    }

    if (signupBtn) {
      signupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!firebaseAuth) return;
        const creds = getAuthCredentials();
        if (!creds) return;
        setAccountError('');
        firebaseAuth.createUserWithEmailAndPassword(creds.email, creds.password).catch((err) => {
          setAccountError(err.message || String(err));
        });
      });
    }

    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!firebaseAuth) return;
        const creds = getAuthCredentials();
        if (!creds) return;
        setAccountError('');
        firebaseAuth.signInWithEmailAndPassword(creds.email, creds.password).catch((err) => {
          setAccountError(err.message || String(err));
        });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!firebaseAuth) return;
        firebaseAuth.signOut().catch((err) => {
          setAccountError(err.message || String(err));
        });
      });
    }

    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!firebaseAuth) return;
        const user = firebaseAuth.currentUser;
        if (!user) return;
        const ok = window.confirm('Confirmer la suppression definitive du compte ?');
        if (!ok) return;
        setAccountError('');
        user.delete().catch((err) => {
          setAccountError(err.message || String(err));
        });
      });
    }

    if (googleSignInBtn) {
      googleSignInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!firebaseAuth) return;
        const provider = new firebase.auth.GoogleAuthProvider();
        setAccountError('');
        firebaseAuth.signInWithPopup(provider).catch((err) => {
          setAccountError(err.message || String(err));
        });
      });
    }

    if (newsletterOptIn) {
      newsletterOptIn.addEventListener('change', () => {
        const user = firebaseAuth.currentUser;
        if (!user) return;
        saveNewsletterPreference(user);
      });
    }

  }

  if (accountToggleBtn) {
    accountToggleBtn.addEventListener('click', () => toggleAccountPanel());
  }
  if (accountPanel) {
    accountPanel.addEventListener('click', (e) => {
      const card = accountPanel.querySelector('.account-card');
      const target = e.target;
      if (card && card.contains(target)) return;
      toggleAccountPanel(false);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!accountPanel || accountPanel.classList.contains('hidden')) return;
    toggleAccountPanel(false);
  });

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  if (languageSelect) {
    languageSelect.addEventListener('change', async () => {
      const lng = languageSelect.value;
      setStoredLanguage(lng);
      if (tutosMenu) {
        delete tutosMenu.dataset.loaded;
        delete tutosMenu.dataset.lang;
      }
      if (helpState) {
        helpState.lang = null;
        helpState.images = [];
        helpState.index = 0;
      }
      if (window.i18next && window.i18next.isInitialized) {
        try {
          await window.i18next.changeLanguage(lng);
        } catch (e) {
        }
        applyTranslations();
      } else {
        initI18n();
      }
    });
  }

  if (systemInfoBtn) {
    systemInfoBtn.addEventListener('click', () => {
      if (systemInfoModal && !systemInfoModal.classList.contains('hidden')) {
        closeSystemInfo();
      } else {
        openSystemInfo();
      }
    });
  }

  startSystemMonitor();

  if (systemInfoResize && systemInfoModal) {
    let resizing = false;
    let startX = 0;
    let startW = 0;

    const onMove = (e) => {
      if (!resizing) return;
      const dx = startX - e.clientX;
      const nextW = startW + dx;
      applySystemPanelWidth(nextW);
      schedulePreviewResize();
    };

    const onUp = () => {
      if (!resizing) return;
      resizing = false;
      try {
        const w = parseFloat(getComputedStyle(systemInfoModal).width);
        if (Number.isFinite(w) && w > 0) setStoredSystemPanelWidth(w);
      } catch (e) {
      }
      schedulePreviewResize();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    systemInfoResize.addEventListener('pointerdown', (e) => {
      resizing = true;
      startX = e.clientX;
      try {
        startW = parseFloat(getComputedStyle(systemInfoModal).width) || systemInfoModal.getBoundingClientRect().width;
      } catch (err) {
        startW = systemInfoModal.getBoundingClientRect().width;
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  try {
    const shell = document.querySelector('.app-shell');
    if (shell && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(() => {
        schedulePreviewResize();
        scheduleSystemLayoutUpdate();
      });
      ro.observe(shell);
    }
  } catch (e) {
  }

  applyTheme(getStoredTheme() || 'dark');
  initI18n();
  initFirebaseAuth();

  window.addEventListener('keydown', (e) => {
    setKeyUniform(keyEventToU32(e));
  });
  window.addEventListener('keyup', () => {
    setKeyUniform(0);
  });
  window.addEventListener('blur', () => {
    setKeyUniform(0);
  });
  window.addEventListener('pointerdown', (e) => {
    const btn = (typeof e.button === 'number') ? (e.button + 1) : 0;
    setMouseBtnUniform(btn);
  });
  window.addEventListener('pointerup', () => {
    setMouseBtnUniform(0);
  });
  window.addEventListener('blur', () => {
    setMouseBtnUniform(0);
  });

  function updateStepCounterBuffer() {
    simulationRuntime.updateStepCounterBuffer();
  }

  function updateMouseUniformBuffer() {
    simulationRuntime.setMousePosition(mouseXValue, mouseYValue, mouseZValue);
  }

  function updateKeyUniformBuffer() {
    simulationRuntime.setKey(keyValue);
  }

  function updateMouseBtnUniformBuffer() {
    simulationRuntime.setMouseButton(mouseBtnValue);
  }

  function keyEventToU32(e) {
    if (typeof e.keyCode === 'number' && e.keyCode > 0) return e.keyCode >>> 0;
    if (typeof e.which === 'number' && e.which > 0) return e.which >>> 0;
    if (typeof e.key === 'string' && e.key.length === 1) {
      return e.key.codePointAt(0) >>> 0;
    }
    return 0;
  }

  function setKeyUniform(value) {
    keyValue = (value >>> 0);
    updateKeyUniformBuffer();
  }

  function setMouseBtnUniform(value) {
    mouseBtnValue = (value >>> 0);
    updateMouseBtnUniformBuffer();
  }

  function getDisplayedBufferSize() {
    const tex = textures.find((t) => t.id === selectedTextureId);
    const size = tex?.size || {};
    const readSize = (value) => {
      const n = Math.floor(Number(value));
      return Number.isFinite(n) && n > 0 ? n : 1;
    };
    return {
      x: readSize(size.x),
      y: readSize(size.y),
      z: readSize(size.z),
    };
  }

  function clampMouseCoordinate(value, extent) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return 0;
    return clamp(n, 0, Math.max(0, extent - 1)) >>> 0;
  }

  function setMouseUniformPosition(x, y, z, isInside) {
    const size = getDisplayedBufferSize();
    const nextX = isInside ? x : mouseXValue;
    const nextY = isInside ? y : mouseYValue;
    const nextZ = z ?? mouseZValue;
    mouseXValue = clampMouseCoordinate(nextX, size.x);
    mouseYValue = clampMouseCoordinate(nextY, size.y);
    mouseZValue = clampMouseCoordinate(nextZ, size.z);
    updateMouseUniformBuffer();
  }

  function stopCurrentExecution(withLog) {
    isRunning = false;
    isPaused = false;
    isCompiled = false;
    simulationRuntime.resetExecution();
    syncRuntimeState();
    renderStepCounter();
    updateStepCounterBuffer();
    stopTimer();
    runSpeedMeasured = 0;
    resetRunSpeedMeasure();
    updateMeasuredRunSpeedLabel();
    updateButtons();
    resetGPUState();
    textures.forEach((tex) => {
      if (tex?.fill === 'random' || tex?.fill === 'empty') {
        regenerateValues(tex);
        return;
      }
      if (!Array.isArray(tex.values) || tex.values.length === 0) {
        ensureValueShape(tex);
      }
    });
    renderTextureList();
    renderPreview();
    if (withLog) {
      logConsole('État GPU réinitialisé. Recompilez pour repartir de zéro.', 'stop');
    }
  }

  function markBindingsDirty() {
    simulationRuntime.markBindingsDirty();
  }

  // Tabs switching
  function setConsoleTabHasError(hasError) {
    const consoleTab = Array.from(tabs).find((t) => t.dataset.tab === 'console');
    if (!consoleTab) return;
    consoleHasUnreadErrors = Boolean(hasError);
    consoleTab.classList.toggle('has-error', consoleHasUnreadErrors);
    if (consoleErrorBadge) consoleErrorBadge.classList.toggle('hidden', !consoleHasUnreadErrors);
  }

  function activateTab(tabName) {
    tabs.forEach((t) => t.classList.remove('active'));
    tabContents.forEach((c) => c.classList.remove('active'));
    const tab = Array.from(tabs).find((t) => t.dataset.tab === tabName);
    const content = document.getElementById(`tab-${tabName}`);
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
    activeTabName = tabName;
    try {
      localStorage.setItem('wgstudio.activeTab', String(tabName));
    } catch (e) {
    }
    if (tabName === 'functions') updateTextureDeclarationsEditor();
    renderDiagnosticsPanels();
    if (tabName === 'buffers') {
      requestAnimationFrame(() => {
        renderPreview();
      });
    }
  }

  function validateWGSLSyntaxOnly(wgsl) {
    return StudioCore.validateWGSLSyntaxOnly(wgsl);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activateTab(tab.dataset.tab);
    });
  });

  try {
    let storedTab = localStorage.getItem('wgstudio.activeTab');
    if (storedTab === 'textures') storedTab = 'buffers';
    if (storedTab && Array.from(tabs).some((t) => t.dataset.tab === storedTab)) {
      activateTab(storedTab);
    }
  } catch (e) {
  }

  const syncPreviewModeToggles = () => {
    toggleButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === previewMode);
    });
  };

  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      previewMode = btn.dataset.mode;
      syncPreviewModeToggles();
      renderPreview();
    });
  });

  syncPreviewModeToggles();

  if (previewValuesToggle) {
    previewValuesToggle.addEventListener('click', () => {
      valuesPanelOpen = !valuesPanelOpen;
      previewValuesToggle.classList.toggle('active', valuesPanelOpen);
      if (bufferValuesPanel) bufferValuesPanel.classList.toggle('hidden', !valuesPanelOpen);
      if (valuesPanelOpen) {
        scheduleValuesRender(true);
      }
    });
  }

  if (bufferValuesGrid) {
    bufferValuesGrid.addEventListener('scroll', () => scheduleValuesRender());
    bufferValuesGrid.addEventListener('pointerdown', (e) => {
      if (!valuesPanelOpen) return;
      if (e.button !== 0) return;
      const tex = textures.find((t) => t.id === selectedTextureId);
      const cell = getValuesGridCellFromEvent(e, tex);
      if (!cell) return;
      valuesSelecting = true;
      const additive = e.ctrlKey || e.metaKey;
      const extending = e.shiftKey;
      beginValuesSelection(cell, tex, { additive, extend: extending });
      scheduleValuesRender(true);
      try {
        bufferValuesGrid.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      bufferValuesGrid.classList.add('selecting');
      window.addEventListener('pointermove', handleValuesPointerMove);
      window.addEventListener('pointerup', handleValuesPointerUp);
      window.addEventListener('pointercancel', handleValuesPointerUp);
      e.preventDefault();
    });
  }

  if (bufferValuesCopyBtn) {
    bufferValuesCopyBtn.addEventListener('click', () => {
      if (!valuesPanelOpen) return;
      copyValuesSelectionAsTSV();
    });
  }

  document.addEventListener('keydown', (e) => {
    const isCopy = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c';
    if (!isCopy) return;
    if (!valuesPanelOpen) return;
    if (!valuesSelections || valuesSelections.length === 0) return;
    e.preventDefault();
    copyValuesSelectionAsTSV();
  });

  window.addEventListener('resize', () => scheduleValuesRender(true));

  clearConsoleBtn.addEventListener('click', () => {
    consoleMessages = [];
    renderConsole();
    setConsoleTabHasError(false);
  });

  function isConsoleError(message, meta) {
    const metaLower = (meta || '').toLowerCase();
    const msgLower = (message || '').toLowerCase();
    if (metaLower.includes('warn')) return false;
    if (msgLower.includes('webgpu is experimental on this platform')) return false;
    if (msgLower.includes('could not establish connection')) return false;
    return (
      metaLower.includes('error') ||
      metaLower.includes('err') ||
      msgLower.includes('erreur wgsl') ||
      msgLower.includes('échec') ||
      msgLower.includes('error while parsing wgsl') ||
      msgLower.includes('create shadermodule') ||
      msgLower.includes('createshadermodule') ||
      (msgLower.includes('wgsl') && msgLower.includes('error'))
    );
  }

  function gotoTextAreaLocation(textarea, line, col) {
    if (!textarea) return;
    const value = textarea.value || '';
    const lines = value.split(/\r?\n/);
    const safeLine = Math.max(1, Math.min(line || 1, lines.length || 1));
    const safeCol = Math.max(1, col || 1);
    let offset = 0;
    for (let i = 0; i < safeLine - 1; i += 1) {
      offset += (lines[i]?.length || 0) + 1;
    }
    offset += Math.min(safeCol - 1, (lines[safeLine - 1] || '').length);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = Math.max(0, Math.min(offset, value.length));
    try {
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 16;
      textarea.scrollTop = Math.max(0, (safeLine - 1) * lineHeight - textarea.clientHeight / 3);
    } catch (e) {
    }
    notifyEditorRailChanged(textarea);
  }

  function resolveWGSLLocation(globalLoc, map) {
    return StudioCore.resolveWGSLLocation(globalLoc, map);
  }

  function navigateToLocation(loc) {
    if (!loc) return;
    if (loc.kind === 'shader') {
      activateTab('shaders');
      if (loc.id) {
        selectedShaderId = loc.id;
        const shader = shaders.find((s) => s.id === selectedShaderId);
        renderShaderList();
        renderShaderForm(shader || null);
        renderShaderEditor(shader || null);
      }
      requestAnimationFrame(() => gotoTextAreaLocation(shaderEditor, loc.line, loc.col));
      return;
    }
    if (loc.kind === 'function') {
      activateTab('functions');
      if (loc.id) {
        selectedFunctionId = loc.id;
        renderFunctionViews();
      }
      requestAnimationFrame(() => gotoTextAreaLocation(functionEditor, loc.line, loc.col));
    }
  }

  async function getLintDevice() {
    return StudioCore.getLintDevice(navigator);
  }

  function scheduleLiveDiagnostics() {
    if (!liveDiagnosticsEnabled) return;
    if (diagnosticsTimer) window.clearTimeout(diagnosticsTimer);
    diagnosticsTimer = window.setTimeout(() => {
      runLiveDiagnostics();
    }, 400);
  }

  async function runLiveDiagnostics() {
    const result = await StudioCore.collectWGSLDiagnostics(getSimulationProject(), { navigator });
    const built = result.built;
    lastLiveWGSLCode = built.code;
    lastLiveWGSLMap = built.map;
    lastLiveWGSLMessages = result.messages;
    renderDiagnosticsPanels();
  }
  function renderDiagnosticsPanel(container, entries, kind) {
    if (!container) return;
    container.innerHTML = '';
    if (!entries.length) {
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    entries.slice(0, 50).forEach((e) => {
      const div = document.createElement('div');
      const level = (e.type || '').toLowerCase().includes('warn') ? 'warn' : ((e.type || '').toLowerCase().includes('error') ? 'error' : 'info');
      div.className = `diag ${level}`;
      if (e.resolved && e.resolved.kind === kind) {
        div.classList.add('clickable');
        div.addEventListener('click', () => navigateToLocation(e.resolved));
      }
      const locText = (e.resolved && e.resolved.kind === kind)
        ? `${e.resolved.name || ''} L${e.resolved.line} C${e.resolved.col}`.trim()
        : '';
      div.textContent = locText ? `${locText} - ${e.message}` : e.message;
      container.appendChild(div);
    });
  }

  function renderDiagnosticsPanels() {
    const shaderId = selectedShaderId;
    const fnId = selectedFunctionId;

    shaderIdsWithErrors = new Set(
      lastLiveWGSLMessages
        .filter((m) => m.resolved && m.resolved.kind === 'shader')
        .filter((m) => (m.type || '').toLowerCase().includes('error'))
        .map((m) => m.resolved.id)
        .filter(Boolean),
    );
    functionIdsWithErrors = new Set(
      lastLiveWGSLMessages
        .filter((m) => m.resolved && m.resolved.kind === 'function')
        .filter((m) => (m.type || '').toLowerCase().includes('error'))
        .map((m) => m.resolved.id)
        .filter(Boolean),
    );

    const shaderEntriesAll = lastLiveWGSLMessages
      .filter((m) => m.resolved && m.resolved.kind === 'shader');
    const functionEntriesAll = lastLiveWGSLMessages
      .filter((m) => m.resolved && m.resolved.kind === 'function');
    const shaderEntriesSelected = shaderId
      ? shaderEntriesAll.filter((m) => m.resolved.id === shaderId)
      : shaderEntriesAll;
    const functionEntriesSelected = fnId
      ? functionEntriesAll.filter((m) => m.resolved.id === fnId)
      : functionEntriesAll;
    renderDiagnosticsPanel(shaderDiagnostics, shaderEntriesAll, 'shader');
    renderDiagnosticsPanel(functionDiagnostics, functionEntriesAll, 'function');

    const shaderErrorLines = new Set(
      shaderEntriesSelected
        .filter((e) => (e.type || '').toLowerCase().includes('error'))
        .map((e) => e.resolved?.line)
        .filter((n) => Number.isFinite(n)),
    );
    const functionErrorLines = new Set(
      functionEntriesSelected
        .filter((e) => (e.type || '').toLowerCase().includes('error'))
        .map((e) => e.resolved?.line)
        .filter((n) => Number.isFinite(n)),
    );
    renderEditorRailErrors(shaderEditor, shaderGutter, shaderErrorLines);
    renderEditorRailErrors(functionEditor, functionGutter, functionErrorLines);

    updateListErrorIndicators();
  }

  setPreviewValue(0,0,null);























  // ********************
  // Toolbar
  // ********************

  compileBtn.addEventListener('click', async () => { // COMPILE BUTTON
    if (compileBtn.disabled) return;
    isCompiling = true;
    updateButtons();
    const built = buildCombinedWGSLWithMap();
    const wgsl = built.code;
    lastCompiledWGSL = wgsl;
    lastWGSLMap = built.map;
    logLongStringToConsole('WGSL', wgsl);
    await runLiveDiagnostics();
    const errors = validateWGSL(wgsl);
    if (errors.length === 0) {
      logConsole('Compilation statique : OK.', 'compile');
      updateButtons();
    } else {
      errors.forEach((err) => logConsole(err, 'compile'));
      isCompiled = false;
      isCompiling = false;
      updateButtons();
      return;
    }
    try {
      const result = await simulationRuntime.compileProject(getSimulationProject());
      syncRuntimeState();
      if (result?.wgsl) lastCompiledWGSL = result.wgsl;
      if (result?.map) lastWGSLMap = result.map;
      isCompiled = Boolean(result?.ok);
      if (isCompiled) {
        markBindingsDirty();
      }
    } catch (err) {
      logConsole(`Echec compilation WebGPU: ${err.message || err}`, 'compile');
      isCompiled = false;
    } finally {
      isCompiling = false;
      updateButtons();
    }
  });

  stepBtn.addEventListener('click', async () => { // STEP BUTTON
    if (stepBtn.disabled) return;
    playSimulationStep();
    isRunning = true;
    isPaused = true;
    updateButtons();
  });

  runBtn.addEventListener('click', async () => { // RUN BUTTON
    if (runBtn.disabled) return;
    if (isRunning && !isPaused) {
      logConsole('Exécution déjà en cours.', 'run');
      return;
    }
    isRunning = true;
    isPaused = false;
    updateButtons();

    logConsole('Boucle run démarrée.', 'run');
    startTimer();
  });

  if (runSpeedSlider) {
    runSpeedSlider.addEventListener('input', () => setRunSpeed(runSpeedSlider.value));
  }

  if (fsRunSpeedSlider) {
    fsRunSpeedSlider.addEventListener('input', () => setRunSpeed(fsRunSpeedSlider.value));
  }

  if (fsCompileBtn) {
    fsCompileBtn.addEventListener('click', () => compileBtn?.click());
  }

  if (previewFullscreenBtn) {
    previewFullscreenBtn.addEventListener('click', () => setPreviewFullscreen(true));
  }

  if (previewTotalScreenBtn) {
    previewTotalScreenBtn.addEventListener('click', () => {
      void enterTotalScreen();
    });
  }

  if (fsExitFullscreenBtn) {
    fsExitFullscreenBtn.addEventListener('click', () => {
      if (isTotalScreenMode) {
        void exitTotalScreen();
      } else {
        setPreviewFullscreen(false);
      }
    });
  }

  if (fsStepBtn) fsStepBtn.addEventListener('click', () => stepBtn?.click());
  if (fsRunBtn) fsRunBtn.addEventListener('click', () => runBtn?.click());
  if (fsPauseBtn) fsPauseBtn.addEventListener('click', () => pauseBtn?.click());
  if (fsStopBtn) fsStopBtn.addEventListener('click', () => stopBtn?.click());

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === previewPanel) return;
    if (!isTotalScreenMode) return;
    isTotalScreenMode = false;
    if (previewPanel) previewPanel.classList.remove('total-screen');
    setPreviewFullscreen(false);
  });

  const isEditableTarget = (target) => {
    if (!target) return false;
    const tagName = (target.tagName || '').toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
    return Boolean(target.isContentEditable);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewPanel && previewPanel.classList.contains('fullscreen')) {
      if (isTotalScreenMode) {
        e.preventDefault();
        void exitTotalScreen();
      } else {
        setPreviewFullscreen(false);
      }
      return;
    }
    if (!isTotalScreenMode) return;
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (isEditableTarget(e.target)) return;
    if (e.repeat) return;
    e.preventDefault();
    if (!isCompiled) return;
    if (isRunning && !isPaused) {
      pauseBtn?.click();
    } else {
      runBtn?.click();
    }
  });

  try {
    const savedSpeed = Number(localStorage.getItem('wgstudio.runSpeed'));
    if (Number.isFinite(savedSpeed) && savedSpeed > 0) setRunSpeed(savedSpeed);
    else setRunSpeed(60);
  } catch (e) {
    setRunSpeed(60);
  }

  pauseBtn.addEventListener('click', () => { // PAUSE BUTTON
    if (pauseBtn.disabled) return;
    if (!isRunning) {
      logConsole('Rien à mettre en pause. Cliquez sur Run.', 'pause');
      return;
    }
    isPaused = true; updateButtons();
    stopTimer();
    runSpeedMeasured = 0;
    updateMeasuredRunSpeedLabel();
    logConsole('Exécution en pause. Cliquez sur Run pour reprendre.', 'pause');
  });

  stopBtn.addEventListener('click', () => { // STOP BUTTON
    if (stopBtn.disabled) return;
    stopCurrentExecution(true);
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      setProjectName(projectNameInput?.value ?? projectName);
      const data = serializeProject();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = sanitizeProjectFileName(projectNameInput?.value ?? projectName);
      a.download = `${safeName}.wgstudio`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logConsole('Projet sauvegardé.', 'save');
    });
  }

  if (loadBtn && loadFileInput) {
    loadBtn.addEventListener('click', () => {
      loadFileInput.value = '';
      loadFileInput.click();
    });
    loadFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = typeof reader.result === 'string' ? reader.result : '';
          const trimmed = raw.replace(/^\uFEFF/, '').trim();
          if (trimmed.startsWith('version https://git-lfs.github.com/spec/v1')) {
            throw new Error('Fichier Git LFS détecté. Le contenu JSON n’est pas présent.');
          }
          const data = JSON.parse(trimmed);
          loadProject(data);
          logConsole(`Projet chargé : ${file.name}`, 'load');
        } catch (err) {
          logConsole(`Échec chargement : ${err.message || err}`, 'load');
        }
      };
      reader.readAsText(file);
    });
  }

  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', () => {
      const ok = window.confirm('Creer un nouveau projet ? Les donnees non sauvegardees seront perdues.');
      if (!ok) return;
      setProjectName(DEFAULT_PROJECT_NAME);
      textures = [];
      shaders = [];
      functionsStore = [];
      pipeline = [];
      parameters = [];
      selectedTextureId = null;
      selectedShaderId = null;
      selectedFunctionId = null;
      selectedPipeId = null;
      selectedParameterId = null;
      pipelineShaderChoiceId = null;
      markBindingsDirty();
      seedInitialShader();
      seedInitialPipeline();
      seedInitialFunction();
      seedInitialTexture();
      renderTextureList();
      renderShaderList();
      renderFunctionList();
      renderPipelineViews();
      renderParameterViews();
      renderPreview();
      logConsole('Nouveau projet créé.', 'project');
    });
  }















  // **********************
  // Simulation Timer
  // **********************

  // lancer le timer
  function startTimer() {
    resetRunSpeedMeasure();
    if (runUncapped) {
      if (!simulationRuntime.isStepRunning) playSimulationStep();
      return;
    }
    if (timerId === null) {
      timerId = setInterval(play, runIntervalMs);
    }
  }

  // stopper le timer
  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    if (runRafId) {
      cancelAnimationFrame(runRafId);
      runRafId = 0;
    }
  }

  // Play
  function play() {
    playSimulationStep();
  }

  // Wrapper pour une exécution complète (prépare + exécute)
  function playSimulationStep() {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const shouldReadback = !runUncapped || (now - lastRunReadbackAt) >= runReadbackIntervalMs;
    if (shouldReadback) lastRunReadbackAt = now;
    const started = simulationRuntime.step(getSimulationProject(), {
      shouldReadback,
      onComplete: ({ didReadback }) => {
        syncRuntimeState();
        if (!runUncapped) {
          renderStepCounter();
        } else {
          const ts = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          if ((ts - lastRunUiUpdateAt) >= runUiIntervalMs) {
            lastRunUiUpdateAt = ts;
            renderStepCounter();
            updateMeasuredRunSpeedLabel();
          }
        }
        noteStepCompleted();
        if (didReadback) {
          renderPreview();
          renderTextureList();
        }
        if (runUncapped && isRunning && !isPaused) scheduleNextUncappedStep();
      },
    });
    if (started) {
      syncRuntimeState();
      if (!runUncapped) renderStepCounter();
    }
  }








  // ********************
  // Toolbar Update
  // ********************

  async function updateButtons() {
    const setActionButton = (btn, enabled, visible) => {
      if (!btn) return;
      btn.disabled = !enabled;
      btn.classList.toggle('hidden', !visible);
    };

    const canStop = Boolean(isCompiled);
    const canPause = Boolean(isCompiled && isRunning && !isPaused);
    const canStep = Boolean(isCompiled && (!isRunning || isPaused));
    const canRun = Boolean(isCompiled && (!isRunning || isPaused));

    const actionButtonsVisible = Boolean(isCompiled && !isCompiling);

    if (compileBtn) {
      compileBtn.disabled = Boolean(isCompiled || isCompiling);
    }

    if (fsCompileBtn) {
      fsCompileBtn.disabled = Boolean(isCompiled || isCompiling);
      fsCompileBtn.classList.toggle('hidden', false);
    }

    setActionButton(stepBtn, canStep, actionButtonsVisible);
    setActionButton(runBtn, canRun, actionButtonsVisible);
    setActionButton(pauseBtn, canPause, actionButtonsVisible);
    setActionButton(stopBtn, canStop, actionButtonsVisible);

    setActionButton(fsStepBtn, canStep, actionButtonsVisible);
    setActionButton(fsRunBtn, canRun, actionButtonsVisible);
    setActionButton(fsPauseBtn, canPause, actionButtonsVisible);
    setActionButton(fsStopBtn, canStop, actionButtonsVisible);

  }


/*
// example WGSL : Brown transparency
@compute @workgroup_size(4, 4, 4)
fn Compute1(@builtin(global_invocation_id) gid : vec3<u32>) {
    let index = gid.z * 32u * 32u + gid.y * 32u + gid.x;
    if (gid.y <= 10) {
        //texture1[index] = 0xFFFFFF;
    } else {
        texture1[index] = 0x123456AA;
    }
}

// example WGSL : colors and transparency
@compute @workgroup_size(4, 4, 4)
fn Compute1(@builtin(global_invocation_id) gid : vec3<u32>) {
    let index = gid.z * 256u * 256u + gid.y * 256u + gid.x;
    if (gid.y <= 10) {
        //texture1[index] = 0xFFFFFF;
    } else {
         if (gid.x <= 50) {
            texture1[index] = 0x12AA0000 + i32(gid.y) ;
        }
        if (gid.x > 50 && gid.x < 150 ) {
            texture1[index] = 0x1200AA00 +( i32(gid.y)  );
        }
         if (gid.x > 150) {
            texture1[index] = 0x00000099  + ( i32(gid.y) << 24 )  + ( i32(gid.y) << 16 ) + ( i32(gid.y) << 8 );
        }
    }
}

// example WGSL : colors, transparency and step
@compute @workgroup_size(4, 4, 4)
fn Compute1(@builtin(global_invocation_id) gid : vec3<u32>) {
    let index = gid.z * 256u * 256u + gid.y * 256u + gid.x;
    if (gid.y <= 10) {
        //texture1[index] = 0xFFFFFF;
    } else {
         if (gid.x <= 50) {
            texture1[index] = 0x12AA0000 + i32(gid.y) + i32(step)  ;
        }
        if (gid.x > 50 && gid.x < 150 ) {
            texture1[index] = 0x1200AA00 +( i32(gid.y)  );
        }
         if (gid.x > 150) {
            texture1[index] = 0x00000099  + ( i32(gid.y) << 24 )  + ( i32(gid.y) << 16 ) + ( i32(gid.y) << 8 );
        }
    }
}

// example WGSL : Game Of Life
@group(0) @binding(0) var<storage, read_write> texture1 : array<u32>;
@group(0) @binding(1) var<storage, read_write> texture2 : array<u32>;

@group(0) @binding(2) var<uniform> step : u32;

@compute @workgroup_size(8, 8, 1)
fn Compute1(@builtin(global_invocation_id) gid : vec3<u32>) {
    let index = gid.y * 32u + gid.x;
    if (index < arrayLength(&texture1)) {
        if (step == 0) {
            texture1[index] = texture1[index] % 2;
        }
    }
}

@compute @workgroup_size(8, 8, 1)
fn Compute2(@builtin(global_invocation_id) gid : vec3<u32>) {
    let index = gid.y * 32u + gid.x;
    if (step >= 1 && gid.x >= 1 && gid.x <= 30 && gid.y >= 1 && gid.y <= 30) {
        let nb =     texture1[index-1] + texture1[index+1] + texture1[index-32] + texture1[index+32]
                        +  texture1[index-1+32] + texture1[index+1+32] + texture1[index-32-1] + texture1[index-32+1];
        if( texture1[index] == 0 ) { // dead cell
            if ( nb == 3 ) {
                texture2[index] = 1;
            } else {
                 texture2[index] = 0;
            }
        } else { // living cell
            if ( nb == 2 || nb == 3 ) {
              texture2[index] = 1;
            } else {
              texture2[index] = 0;
            }
        }
    }
}

@compute @workgroup_size(8, 8, 1)
fn Compute3(@builtin(global_invocation_id) gid : vec3<u32>) {
    let index = gid.y * 32u + gid.x;
    if (step >= 1 && index < arrayLength(&texture1)) {
        texture1[index] = texture2[index] ;
    }
}


*/








  // ***************************************************************************************
  // GUI
  // ***************************************************************************************

  // Pipeline events
  addPipelineBtn.addEventListener('click', () => {
    if (!shaders.length) return;
    const shaderId = pipelineShaderChoiceId || shaders[0].id;
    const pipe = buildPipelinePipe(shaderId);
    pipeline.push(pipe);
    selectedPipeId = pipe.id;
    renderPipelineViews();
  });

  if (addLoopStartBtn) {
    addLoopStartBtn.addEventListener('click', () => {
      const pos = pipeline.findIndex((p) => p.id === selectedPipeId);
      const insertAt = pos >= 0 ? pos : pipeline.length;
      const loopStart = {
        id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `loop-start-${Date.now()}`,
        type: 'loopStart',
        name: t('pipeline.loop_start_name', null, 'Début boucle'),
        repeat: 2,
      };
      pipeline.splice(insertAt, 0, loopStart);
      if (!validateLoopStructure(pipeline, true)) {
        pipeline.splice(insertAt, 1);
        logConsole('Boucle invalide (Début sans Fin).', 'pipeline');
        return;
      }
      selectedPipeId = loopStart.id;
      renderPipelineViews();
    });
  }

  if (addLoopEndBtn) {
    addLoopEndBtn.addEventListener('click', () => {
      if (!pipeline.length) return;
      const pos = pipeline.findIndex((p) => p.id === selectedPipeId);
      const insertAt = pos >= 0 ? pos + 1 : pipeline.length;
      const loopEnd = {
        id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `loop-end-${Date.now()}`,
        type: 'loopEnd',
        name: t('pipeline.loop_end_name', null, 'Fin boucle'),
      };
      pipeline.splice(insertAt, 0, loopEnd);
      if (!validateLoopStructure(pipeline, true)) {
        pipeline.splice(insertAt, 1);
        logConsole('Boucle invalide (Fin sans Début ou intercalée).', 'pipeline');
        return;
      }
      selectedPipeId = loopEnd.id;
      renderPipelineViews();
    });
  }

  removePipelineBtn.addEventListener('click', () => {
    if (!selectedPipeId) return;
    pipeline = pipeline.filter((s) => s.id !== selectedPipeId);
    selectedPipeId = pipeline[0]?.id || null;
    renderPipelineViews();
  });

  moveUpBtn.addEventListener('click', () => movePipe(-1));
  moveDownBtn.addEventListener('click', () => movePipe(1));

  if (pipelineActivatedInput) {
    pipelineActivatedInput.addEventListener('change', () => {
      const pipe = pipeline.find((s) => s.id === selectedPipeId);
      if (!pipe || pipe.type !== 'step') return;
      pipe.activated = pipelineActivatedInput.checked;
      renderPipelineTimeline();
    });
  }

  pipelineForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pipe = pipeline.find((s) => s.id === selectedPipeId);
    if (!pipe) return;
    if (pipe.type === 'loopEnd') return;
    const formData = new FormData(pipelineForm);
    pipe.name = (formData.get('pipeName') || pipe.name).trim() || pipe.name;
    if (pipe.type === 'loopStart') {
      const repeatInput = loopStartFields
        ? loopStartFields.querySelector('input[name="loopRepeat"]')
        : null;
      const rep = repeatInput
        ? parseInt(repeatInput.value, 10)
        : parseInt(formData.get('pDispatchX'), 10);
      pipe.repeat = Math.max(1, rep || pipe.repeat || 1);
    } else if (pipe.type === 'step') {
      pipe.shaderId = formData.get('shaderRef') || pipe.shaderId;
      pipe.activated = formData.get('pipeActivated') !== null;
      const evaluation = getParameterEvaluation();
      const nameMap = buildParameterNameMap(evaluation);
      const dispatchInput = {
        x: String(formData.get('pDispatchX') ?? '').trim(),
        y: String(formData.get('pDispatchY') ?? '').trim(),
        z: String(formData.get('pDispatchZ') ?? '').trim(),
      };
      pipe.dispatch = {
        x: clamp(resolveSizeInput(dispatchInput.x, pipe.dispatch?.x || 1, evaluation, nameMap), 1, 65535),
        y: clamp(resolveSizeInput(dispatchInput.y, pipe.dispatch?.y || 1, evaluation, nameMap), 1, 65535),
        z: clamp(resolveSizeInput(dispatchInput.z, pipe.dispatch?.z || 1, evaluation, nameMap), 1, 65535),
      };
      pipe.dispatchInput = dispatchInput;
    } else if (pipelinePanelTitle) {
      pipelinePanelTitle.textContent = pipe.type === 'loopEnd'
        ? t('pipeline.panel.loop_end_selected', null, 'Fin boucle sélectionné')
        : t('pipeline.panel.pipeline_selected', null, 'Pipeline sélectionnée');
    }
    renderPipelineViews();
  });

  // Masquer le bouton Appliquer pour les fins de boucle (géré dans renderPipelineForm)
  const pipelineSubmitBtn = pipelineForm.querySelector('button[type="submit"]');

  // Parameters events
  if (addParameterBtn) {
    addParameterBtn.addEventListener('click', () => {
      const param = buildDefaultParameter();
      parameters.push(param);
      selectedParameterId = param.id;
      renderParameterViews();
    });
  }

  if (removeParameterBtn) {
    removeParameterBtn.addEventListener('click', () => {
      if (!selectedParameterId) return;
      parameters = parameters.filter((p) => p.id !== selectedParameterId);
      selectedParameterId = parameters[0]?.id || null;
      renderParameterViews();
    });
  }

  if (parameterForm) {
    parameterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const param = parameters.find((p) => p.id === selectedParameterId);
      if (!param) return;
      const applied = applyFormToParameter(param);
      if (!applied) return;
      renderParameterViews();
    });
  }

  function moveParameter(delta) {
    const idx = parameters.findIndex((p) => p.id === selectedParameterId);
    if (idx === -1) return;
    const newIndex = idx + delta;
    if (newIndex < 0 || newIndex >= parameters.length) return;
    const [param] = parameters.splice(idx, 1);
    parameters.splice(newIndex, 0, param);
    selectedParameterId = param.id;
    renderParameterViews();
  }

  if (moveParameterUpBtn) {
    moveParameterUpBtn.addEventListener('click', () => moveParameter(-1));
  }
  if (moveParameterDownBtn) {
    moveParameterDownBtn.addEventListener('click', () => moveParameter(1));
  }

  // Functions events
  addFunctionBtn.addEventListener('click', () => {
    const fn = buildDefaultLibrary();
    functionsStore.push(fn);
    selectedFunctionId = fn.id;
    renderFunctionViews();
  });

  function moveFunction(delta) {
    const idx = functionsStore.findIndex((f) => f.id === selectedFunctionId);
    if (idx === -1) return;
    const newIndex = idx + delta;
    if (newIndex < 0 || newIndex >= functionsStore.length) return;
    const [fn] = functionsStore.splice(idx, 1);
    functionsStore.splice(newIndex, 0, fn);
    selectedFunctionId = fn.id;
    renderFunctionViews();
  }

  if (moveFunctionUpBtn) {
    moveFunctionUpBtn.addEventListener('click', () => moveFunction(-1));
  }
  if (moveFunctionDownBtn) {
    moveFunctionDownBtn.addEventListener('click', () => moveFunction(1));
  }

  function moveTexture(delta) {
    const idx = textures.findIndex((t) => t.id === selectedTextureId);
    if (idx === -1) return;
    const newIndex = idx + delta;
    if (newIndex < 0 || newIndex >= textures.length) return;
    const [tex] = textures.splice(idx, 1);
    textures.splice(newIndex, 0, tex);
    selectedTextureId = tex.id;
    renderTextureList();
    renderPreview();
  }

  if (moveTextureUpBtn) {
    moveTextureUpBtn.addEventListener('click', () => moveTexture(-1));
  }
  if (moveTextureDownBtn) {
    moveTextureDownBtn.addEventListener('click', () => moveTexture(1));
  }

  removeFunctionBtn.addEventListener('click', () => {
    if (!selectedFunctionId) return;
    functionsStore = functionsStore.filter((f) => f.id !== selectedFunctionId);
    selectedFunctionId = functionsStore[0]?.id || null;
    renderFunctionViews();
  });

  duplicateFunctionBtn.addEventListener('click', () => {
    const fn = functionsStore.find((f) => f.id === selectedFunctionId);
    if (!fn) return;
    const copy = {
      ...fn,
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `fn-${Date.now()}`,
      name: `${fn.name} (copie)`,
    };
    functionsStore.push(copy);
    selectedFunctionId = copy.id;
    renderFunctionViews();
  });

  functionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fn = functionsStore.find((f) => f.id === selectedFunctionId);
    if (!fn) return;
    const formData = new FormData(functionForm);
    fn.name = (formData.get('functionName') || fn.name).trim() || fn.name;
    renderFunctionViews();
  });

  functionEditor.addEventListener('input', (e) => {
    const fn = functionsStore.find((f) => f.id === selectedFunctionId);
    if (!fn) return;
    fn.code = e.target.value;
    updateFunctionStats(fn.code);
    scheduleLiveDiagnostics();
    clearEditorRailErrors(functionEditor, functionGutter);
    syncRustHighlight(functionEditor, functionHighlight);
  });
  enableTabIndent(functionEditor);

  // Compute shader events
  addShaderBtn.addEventListener('click', () => {
    const shader = buildDefaultShader();
    shaders.push(shader);
    selectedShaderId = shader.id;
    normalizeShaderBufferIds(shader);
    renderShaderList();
    renderShaderForm(shader);
    renderShaderEditor(shader);
    pipeline.forEach((pipe) => {
      if (!pipe.dispatch) {
        pipe.dispatch = { x: 8, y: 4, z: 1 };
      }
    });
    renderPipelineViews();
  });

  removeShaderBtn.addEventListener('click', () => {
    if (!selectedShaderId) return;
    const removedId = selectedShaderId;
    shaders = shaders.filter((s) => s.id !== selectedShaderId);
    selectedShaderId = shaders[0]?.id || null;
    if (pipelineShaderChoiceId === removedId) {
      pipelineShaderChoiceId = shaders[0]?.id || null;
    }
    pipeline.forEach((pipe) => {
      if (pipe.shaderId === removedId) pipe.shaderId = null;
    });
    renderShaderList();
    const current = shaders.find((s) => s.id === selectedShaderId);
    renderShaderForm(current);
    renderShaderEditor(current);
    renderPipelineViews();
  });

  duplicateShaderBtn.addEventListener('click', () => {
    if (!selectedShaderId) return;
    const original = shaders.find((s) => s.id === selectedShaderId);
    if (!original) return;
    const copy = {
      ...original,
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `shader-${Date.now()}`,
      name: `${original.name} (copie)`,
    };
    normalizeShaderBufferIds(copy);
    syncShaderEntryName(copy);
    shaders.push(copy);
    selectedShaderId = copy.id;
    renderShaderList();
    renderShaderForm(copy);
    renderShaderEditor(copy);
    renderPipelineViews();
  });

  addBufferBtn.addEventListener('click', () => {
    const newTexture = buildBufferFromForm();
    textures.push(newTexture);
    selectedTextureId = newTexture.id;
    textures.forEach((tex) => {
      if (tex?.fill === 'random' || tex?.fill === 'empty') {
        regenerateValues(tex);
        return;
      }
      if (!Array.isArray(tex.values) || tex.values.length === 0) {
        ensureValueShape(tex);
      }
    });
    normalizeAllShaderBufferIds();
    markBindingsDirty();
    renderTextureList();
    renderForm(newTexture);
    renderPreview();
    updateTextureDeclarationsEditor();
    const currentShader = shaders.find((s) => s.id === selectedShaderId) || shaders[0] || null;
    renderShaderBufferList(currentShader);
    updateShaderBindingsEditor(currentShader);
  });

  removeBufferBtn.addEventListener('click', () => {
    if (!selectedTextureId) return;
    textures = textures.filter((t) => t.id !== selectedTextureId);
    selectedTextureId = textures[0]?.id || null;
    normalizeAllShaderBufferIds();
    markBindingsDirty();
    renderTextureList();
    if (selectedTextureId) {
      const tex = textures.find((t) => t.id === selectedTextureId);
      renderForm(tex);
    }
    renderPreview();
    updateTextureDeclarationsEditor();
    const currentShader = shaders.find((s) => s.id === selectedShaderId) || shaders[0] || null;
    renderShaderBufferList(currentShader);
    updateShaderBindingsEditor(currentShader);
  });

  regenBtn.addEventListener('click', () => {
    if (!selectedTextureId) return;
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (!tex) return;
    regenerateValues(tex);
    markBindingsDirty();
    renderPreview();
  });

  bufferForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedTextureId) {
      const newTexture = buildBufferFromForm();
      textures.push(newTexture);
      selectedTextureId = newTexture.id;
      normalizeAllShaderBufferIds();
      markBindingsDirty();
    } else {
      const tex = textures.find((t) => t.id === selectedTextureId);
      if (tex) {
        applyFormToTexture(tex);
        markBindingsDirty();
      }
    }
    renderTextureList();
    renderPreview();
    updateTextureDeclarationsEditor();
    const currentShader = shaders.find((s) => s.id === selectedShaderId) || shaders[0] || null;
    renderShaderBufferList(currentShader);
    updateShaderBindingsEditor(currentShader);
  });

  zSlice.addEventListener('input', () => {
    sliceLabel.textContent = `Z = ${zSlice.value}`;
    if (fsZSlice && zSlice) {
      fsZSlice.max = zSlice.max;
      fsZSlice.value = zSlice.value;
      if (fsSliceLabel) fsSliceLabel.textContent = `Z = ${fsZSlice.value}`;
    }
    updateButtons();
    schedulePreviewResize();
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (tex) {
      const sliceIndex = clamp(parseInt(zSlice.value, 10) || 0, 0, tex.size.z - 1);
      setMouseUniformPosition(0, 0, sliceIndex, false);
    }
    renderPreview();
  });

  shaderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedShaderId) {
      const shader = buildDefaultShader();
      shaders.push(shader);
      selectedShaderId = shader.id;
      renderShaderList();
      renderShaderForm(shader);
      renderShaderEditor(shader);
      return;
    }
    const shader = shaders.find((s) => s.id === selectedShaderId);
    if (!shader) return;
    applyFormToShader(shader);
    renderShaderList();
    renderShaderEditor(shader);
    renderPipelineViews();
  });

  function moveShader(delta) {
    const idx = shaders.findIndex((s) => s.id === selectedShaderId);
    if (idx === -1) return;
    const newIndex = idx + delta;
    if (newIndex < 0 || newIndex >= shaders.length) return;
    const [sh] = shaders.splice(idx, 1);
    shaders.splice(newIndex, 0, sh);
    selectedShaderId = sh.id;
    renderShaderList();
    renderShaderForm(sh);
    renderShaderEditor(sh);
    renderPipelineViews();
  }

  if (moveShaderUpBtn) moveShaderUpBtn.addEventListener('click', () => moveShader(-1));
  if (moveShaderDownBtn) moveShaderDownBtn.addEventListener('click', () => moveShader(1));

  shaderEditor.addEventListener('input', (e) => {
    const shader = shaders.find((s) => s.id === selectedShaderId);
    if (!shader) return;
    const scrollTop = shaderEditor.scrollTop;
    const cursor = shaderEditor.selectionStart;
    const updated = enforceEntryName(e.target.value, sanitizeEntryName(shader.name));
    const changed = updated !== shader.code;
    shader.code = updated;
    if (changed) {
      shaderEditor.value = updated;
      shaderEditor.selectionStart = shaderEditor.selectionEnd = Math.min(cursor, updated.length);
      shaderEditor.scrollTop = scrollTop;
    }
    updateShaderLines(shader.code);
    updateTextureDeclarationsEditor();
    scheduleLiveDiagnostics();
    clearEditorRailErrors(shaderEditor, shaderGutter);
    syncRustHighlight(shaderEditor, shaderHighlight);
  });
  enableTabIndent(shaderEditor);

  function attachEditorRailAutoSize(textarea, rail) {
    if (!textarea || !rail) return;
    syncEditorRailHeight(textarea, rail);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        syncEditorRailHeight(textarea, rail);
        refreshEditorRail(textarea, rail);
      });
      ro.observe(textarea);
    } else {
      window.addEventListener('resize', () => {
        syncEditorRailHeight(textarea, rail);
        refreshEditorRail(textarea, rail);
      });
    }
  }

  function snapEditorHeightToLine(textarea) {
    if (!textarea) return;
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight);
    const padTop = parseFloat(style.paddingTop) || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
    const innerHeight = textarea.clientHeight - padTop - padBottom;
    if (!Number.isFinite(innerHeight) || innerHeight <= 0) return;
    const lines = Math.max(1, Math.floor(innerHeight / lineHeight));
    const snappedInner = lines * lineHeight;
    const snappedTotal = snappedInner + padTop + padBottom;
    if (Math.abs(textarea.clientHeight - snappedTotal) >= 0.5) {
      textarea.style.height = `${snappedTotal}px`;
    }
  }

  function attachEditorHeightSnap(textarea, rail, highlight) {
    if (!textarea) return;
    const applySnap = () => {
      snapEditorHeightToLine(textarea);
      if (rail) {
        syncEditorRailHeight(textarea, rail);
        refreshEditorRail(textarea, rail);
      }
      if (highlight) syncHighlightScroll(textarea, highlight);
    };
    applySnap();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => applySnap());
      ro.observe(textarea);
    } else {
      window.addEventListener('resize', () => applySnap());
    }
  }

  attachEditorRailEvents(shaderEditor, shaderGutter, shaderHighlight);
  attachEditorRailEvents(functionEditor, functionGutter, functionHighlight);
  attachEditorRailAutoSize(shaderEditor, shaderGutter);
  attachEditorRailAutoSize(functionEditor, functionGutter);
  attachEditorHeightSnap(shaderEditor, shaderGutter, shaderHighlight);
  attachEditorHeightSnap(functionEditor, functionGutter, functionHighlight);

  const getDefaultShaderBufferIds = () => StudioCore.getDefaultShaderBufferIds(textures, currentDevice);

  const normalizeShaderBufferIds = (shader) => {
    return StudioCore.normalizeShaderBufferIds(shader, textures, currentDevice);
  };

  const normalizeAllShaderBufferIds = () => {
    shaders.forEach((shader) => normalizeShaderBufferIds(shader));
  };

  const getShaderSelectedTextures = (shader) => {
    return StudioCore.getShaderSelectedTextures(shader, textures, currentDevice);
  };

  const buildBufferDeclarationsWGSLForTextures = (list, bindingOffset = BUFFER_BINDING_OFFSET) => {
    return StudioCore.buildBufferDeclarationsWGSLForTextures(list, bindingOffset);
  };

  const buildUniformDeclarationsWGSL = () => {
    return StudioCore.buildUniformDeclarationsWGSL();
  };

  const updateShaderBindingsEditor = (shader) => {
    if (!shaderBindingsEditor) return;
    if (!shader) {
      shaderBindingsEditor.value = '';
      return;
    }
    const selected = getShaderSelectedTextures(shader);
    shaderBindingsEditor.value = selected.length
      ? buildBufferDeclarationsWGSLForTextures(selected)
      : '// (aucun buffer sélectionné)';
  };

  const renderShaderBufferList = (shader) => {
    if (!shaderBufferList) return;
    shaderBufferList.innerHTML = '';
    if (!shader) {
      shaderBufferList.textContent = t('shaders.none_selected', null, 'Aucun compute shader sélectionné.');
      return;
    }
    if (!textures.length) {
      shaderBufferList.textContent = t('buffers.empty', null, 'Aucun buffer. Ajoutez-en un.');
      updateShaderBindingsEditor(shader);
      return;
    }
    const ids = normalizeShaderBufferIds(shader);
    const idSet = new Set(ids);
    const selectedOrder = getShaderSelectedTextures(shader);
    const bindingOffset = BUFFER_BINDING_OFFSET;
    const bindingById = new Map();
    selectedOrder.forEach((tex, idx) => bindingById.set(tex.id, bindingOffset + idx));

    textures.forEach((tex) => {
      const row = document.createElement('label');
      row.className = 'buffer-select-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = idSet.has(tex.id);
      const bindingLabel = bindingById.has(tex.id)
        ? `#${bindingById.get(tex.id)}`
        : '—';
      const name = tex.name || `Buffer${bindingById.get(tex.id) ?? ''}`;
      const info = document.createElement('span');
      info.textContent = `${bindingLabel} · ${name}`;
      checkbox.addEventListener('change', () => {
        let next = normalizeShaderBufferIds(shader);
        if (checkbox.checked) {
          if (next.length >= MAX_SHADER_BUFFERS) {
            checkbox.checked = false;
            logConsole(`Limite de ${MAX_SHADER_BUFFERS} buffers par shader atteinte.`, 'compile');
            return;
          }
          next = [...next, tex.id];
        } else {
          next = next.filter((id) => id !== tex.id);
        }
        shader.bufferIds = next;
        normalizeShaderBufferIds(shader);
        renderShaderBufferList(shader);
        updateShaderBindingsEditor(shader);
        updateTextureDeclarationsEditor();
        markBindingsDirty();
        isCompiled = false;
        updateButtons();
      });
      row.appendChild(checkbox);
      row.appendChild(info);
      shaderBufferList.appendChild(row);
    });
  };

  function buildBufferFromForm() {
    const formData = new FormData(bufferForm);
    const evaluation = getParameterEvaluation();
    const nameMap = buildParameterNameMap(evaluation);
    const sizeInput = {
      x: String(formData.get('sizeX') ?? '').trim(),
      y: String(formData.get('sizeY') ?? '').trim(),
      z: String(formData.get('sizeZ') ?? '').trim(),
    };
    const size = {
      x: clamp(resolveSizeInput(sizeInput.x, 64, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
      y: clamp(resolveSizeInput(sizeInput.y, 32, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
      z: clamp(resolveSizeInput(sizeInput.z, 1, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
    };
    const rawName = (formData.get('name') || '').trim().replace(/\s+/g, '');
    const baseName = rawName || nextTextureDefaultName();
    const tex = {
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `tex-${Date.now()}`,
      name: uniqueTextureName(baseName),
      type: normalizeTextureType(formData.get('type') || 'int'),
      fill: formData.get('fill') || 'empty',
      size,
      sizeInput,
      values: [],
    };
    regenerateValues(tex);
    updateSliceControl(tex);
    return tex;
  }

  function applyFormToTexture(tex) {
    const formData = new FormData(bufferForm);
    const proposedName = (formData.get('name') || tex.name).trim().replace(/\s+/g, '');
    const isDuplicate = textures.some(
      (t) => t.id !== tex.id && t.name.toLowerCase() === proposedName.toLowerCase(),
    );
    if (proposedName && !isDuplicate) {
      tex.name = proposedName;
    }
    const evaluation = getParameterEvaluation();
    const nameMap = buildParameterNameMap(evaluation);
    const sizeInput = {
      x: String(formData.get('sizeX') ?? '').trim(),
      y: String(formData.get('sizeY') ?? '').trim(),
      z: String(formData.get('sizeZ') ?? '').trim(),
    };
    const newSize = {
      x: clamp(resolveSizeInput(sizeInput.x, tex.size.x, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
      y: clamp(resolveSizeInput(sizeInput.y, tex.size.y, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
      z: clamp(resolveSizeInput(sizeInput.z, tex.size.z, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
    };
    const sizeChanged = newSize.x !== tex.size.x || newSize.y !== tex.size.y || newSize.z !== tex.size.z;
    const oldType = normalizeTextureType(tex.type);
    tex.size = newSize;
    tex.sizeInput = sizeInput;
    tex.type = normalizeTextureType(formData.get('type') || tex.type);
    const typeChanged = oldType !== tex.type;
    tex.fill = formData.get('fill') || tex.fill;
    if (sizeChanged || typeChanged || tex.fill === 'random') {
      regenerateValues(tex);
    } else if (tex.fill === 'empty') {
      ensureValueShape(tex);
    }
    updateSliceControl(tex);
    renderForm(tex);
  }

  const coerceTextureValue = StudioCore.coerceTextureValue;
  const regenerateValues = StudioCore.regenerateValues;
  const ensureValueShape = StudioCore.ensureValueShape;
  const generateValue = StudioCore.generateValue;
  const clamp = StudioCore.clamp;
  function uniqueTextureName(base) {
    const existing = new Set(textures.map((t) => t.name.toLowerCase()));
    const lower = base.toLowerCase();
    if (!existing.has(lower)) return base;

    const match = base.match(/^(.*?)(\d+)$/);
    const prefix = match ? match[1] : `${base}`;
    let counter = match ? parseInt(match[2], 10) + 1 : 2;
    let candidate = `${prefix}${counter}`;
    while (existing.has(candidate.toLowerCase())) {
      counter += 1;
      candidate = `${prefix}${counter}`;
    }
    return candidate;
  }

  function nextTextureDefaultName() {
    const pattern = /^buffer\s*?(\d+)$/i;
    let maxIdx = 0;
    textures.forEach((t) => {
      const match = t.name.match(pattern);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!Number.isNaN(n)) maxIdx = Math.max(maxIdx, n);
      }
    });
    return `Buffer${maxIdx + 1}`;
  }

  function buildPipelinePipe(shaderIdParam) {
    const idx = pipeline.length + 1;
    const shaderId = shaderIdParam || shaders[0]?.id || null;
    return {
      type: 'step',
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `pipe-${Date.now()}`,
      name: `Pipeline ${idx}`,
      shaderId,
      activated: true,
      dispatch: { x: 8, y: 4, z: 1 },
      dispatchInput: { x: '8', y: '4', z: '1' },
    };
  }

  function validateLoopStructure(list, allowOpen = false) {
    return StudioCore.validateLoopStructure(list, allowOpen);
  }

  function expandPipeline(list) {
    return StudioCore.expandPipeline(list);
  }

  function renderPipelineShaderList() {
    pipelineList.innerHTML = '';
    addPipelineBtn.disabled = !shaders.length;
    if (!shaders.length) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = t('pipeline.no_shader_hint', null, 'Ajoutez un compute shader pour le pipeline.');
      pipelineList.appendChild(empty);
      return;
    }
    if (!pipelineShaderChoiceId) pipelineShaderChoiceId = shaders[0].id;
    shaders.forEach((shader) => {
      const item = document.createElement('div');
      item.className = `list-item ${shader.id === pipelineShaderChoiceId ? 'active' : ''}`;
      const title = document.createElement('div');
      title.textContent = shader.name;
      item.appendChild(title);
      item.addEventListener('click', () => {
        pipelineShaderChoiceId = shader.id;
        renderPipelineShaderList();
      });
      pipelineList.appendChild(item);
    });
  }

  function renderPipelineTimeline() {
    pipelineTimeline.innerHTML = '';
    if (!pipeline.length) {
      pipelineTimeline.innerHTML = `<p class="eyebrow">${t('pipeline.empty_timeline', null, 'Aucun Pipeline dans la Pass.')}</p>`;
      return;
    }
    pipeline.forEach((pipe, index) => {
      const block = document.createElement('div');
      block.className = 'timeline-pipe';
      block.draggable = true;
      if (pipe.id === selectedPipeId) block.classList.add('active');
      if ((pipe.type || 'step') === 'step' && pipe.activated === false) {
        block.classList.add('inactive');
      }
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = index + 1;
      const content = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = pipe.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      if (pipe.type === 'loopStart') {
        meta.textContent = t(
          'pipeline.timeline.repetitions',
          { count: pipe.repeat ?? 1 },
          `Répétitions : ${pipe.repeat ?? 1}`,
        );
      } else if (pipe.type === 'loopEnd') {
        meta.textContent = t('pipeline.timeline.loop_end', null, 'Fin boucle');
      } else {
        meta.textContent = t(
          'pipeline.timeline.dispatch',
          {
            shader: pipelineShaderLabel(pipe.shaderId),
            x: pipe.dispatch?.x ?? 1,
            y: pipe.dispatch?.y ?? 1,
            z: pipe.dispatch?.z ?? 1,
          },
          `${pipelineShaderLabel(pipe.shaderId)} · Dispatch ${pipe.dispatch?.x ?? 1}×${pipe.dispatch?.y ?? 1}×${pipe.dispatch?.z ?? 1}`,
        );
      }
      content.appendChild(title);
      content.appendChild(meta);
      block.appendChild(badge);
      block.appendChild(content);
      block.addEventListener('click', () => {
        selectedPipeId = pipe.id;
        renderPipelineViews();
      });
      pipelineTimeline.appendChild(block);
    });
  }

  function renderPipelineForm(pipe) {
    const inputs = pipelineForm.querySelectorAll('input, select, button[type="submit"]');
    if (!pipe) {
      inputs.forEach((el) => { el.disabled = true; });
      pipelineForm.pipeName.value = '';
      const activatedInput = pipelineForm.querySelector('input[name="pipeActivated"]');
      if (activatedInput) activatedInput.checked = true;
      pipelineShaderSelect.innerHTML = '';
      return;
    }
    const isLoopStart = pipe.type === 'loopStart';
    const isLoopEnd = pipe.type === 'loopEnd';
    inputs.forEach((el) => { el.disabled = isLoopEnd; });
    if (dispatchFields) dispatchFields.classList.toggle('hidden', isLoopStart || isLoopEnd);
    if (pipelineFieldShader) pipelineFieldShader.classList.toggle('hidden', isLoopStart || isLoopEnd);
    if (pipelineFieldActivated) pipelineFieldActivated.classList.toggle('hidden', isLoopStart || isLoopEnd);
    if (loopStartFields) loopStartFields.classList.toggle('hidden', !isLoopStart);
    if (loopEndFields) loopEndFields.classList.toggle('hidden', !isLoopEnd);
    const isPipeline = !isLoopStart && !isLoopEnd;
    const dispatchInputs = pipelineForm.querySelectorAll('input[name="pDispatchX"], input[name="pDispatchY"], input[name="pDispatchZ"]');
    dispatchInputs.forEach((input) => {
      input.required = isPipeline;
      input.disabled = !isPipeline;
    });
    const activatedInput = pipelineForm.querySelector('input[name="pipeActivated"]');
    if (activatedInput) {
      activatedInput.disabled = !isPipeline;
      activatedInput.checked = pipe.activated !== false;
    }
    // Handle name field visibility/readonly for loops
    const nameLabel = pipelineForm.querySelector('label:nth-of-type(1)');
    const nameInput = pipelineForm.querySelector('input[name="pipeName"]');
    if (nameLabel) nameLabel.classList.toggle('hidden', isLoopStart || isLoopEnd);
    if (nameInput) {
      nameInput.readOnly = isLoopStart || isLoopEnd;
    }
    if (pipelinePanelTitle) {
      if (isLoopStart) {
        pipelinePanelTitle.textContent = t('pipeline.panel.loop_start_selected', null, 'Début boucle sélectionné');
      } else if (isLoopEnd) {
        pipelinePanelTitle.textContent = t('pipeline.panel.loop_end_selected', null, 'Fin boucle sélectionné');
      } else {
        pipelinePanelTitle.textContent = t('pipeline.panel.pipeline_selected', null, 'Pipeline sélectionnée');
      }
    }
    if (pipelineSubmitBtn) {
      pipelineSubmitBtn.classList.toggle('hidden', isLoopEnd);
    }
    pipelineForm.pipeName.value = pipe.name;
    pipelineShaderSelect.innerHTML = '';
    if (isLoopStart) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('pipeline.select.loop_start', null, 'Boucle (début)');
      pipelineShaderSelect.appendChild(opt);
      pipelineShaderSelect.disabled = true;
      pipelineForm.pDispatchX.value = pipe.repeat || 1;
      pipelineForm.pDispatchY.value = '';
      pipelineForm.pDispatchZ.value = '';
      const repeatInput = pipelineForm.querySelector('input[name="loopRepeat"]');
      if (repeatInput) repeatInput.value = pipe.repeat || 1;
    } else if (isLoopEnd) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('pipeline.select.loop_end', null, 'Boucle (fin)');
      pipelineShaderSelect.appendChild(opt);
      pipelineShaderSelect.disabled = true;
      pipelineForm.pDispatchX.value = '';
      pipelineForm.pDispatchY.value = '';
      pipelineForm.pDispatchZ.value = '';
    } else {
      if (!shaders.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = t('pipeline.select.no_shader', null, 'Aucun compute shader disponible');
        pipelineShaderSelect.appendChild(opt);
        pipelineShaderSelect.disabled = true;
      } else {
        pipelineShaderSelect.disabled = false;
        shaders.forEach((shader) => {
          const opt = document.createElement('option');
          opt.value = shader.id;
          opt.textContent = shader.name;
          pipelineShaderSelect.appendChild(opt);
        });
        pipelineShaderSelect.value = pipe.shaderId || shaders[0].id;
      }
      const dispatchInput = pipe.dispatchInput || {};
      pipelineForm.pDispatchX.value = dispatchInput.x !== undefined && dispatchInput.x !== null && dispatchInput.x !== '' ? dispatchInput.x : (pipe.dispatch?.x ?? 4);
      pipelineForm.pDispatchY.value = dispatchInput.y !== undefined && dispatchInput.y !== null && dispatchInput.y !== '' ? dispatchInput.y : (pipe.dispatch?.y ?? 4);
      pipelineForm.pDispatchZ.value = dispatchInput.z !== undefined && dispatchInput.z !== null && dispatchInput.z !== '' ? dispatchInput.z : (pipe.dispatch?.z ?? 1);
    }
  }

  function renderPipelineViews() {
    const current = pipeline.find((p) => p.id === selectedPipeId) || pipeline[0];
    selectedPipeId = current ? current.id : null;
    renderPipelineShaderList();
    renderPipelineTimeline();
    renderPipelineForm(current || null);
    const idx = pipeline.findIndex((p) => p.id === selectedPipeId);
    moveUpBtn.disabled = idx <= 0;
    moveDownBtn.disabled = idx === -1 || idx >= pipeline.length - 1;
    removePipelineBtn.disabled = !selectedPipeId;
  }

  function pipelineShaderLabel(shaderId) {
    const shader = shaders.find((s) => s.id === shaderId);
    return shader ? `Shader : ${shader.name}` : 'Shader manquant';
  }

  function movePipe(delta) {
    const idx = pipeline.findIndex((p) => p.id === selectedPipeId);
    if (idx === -1) return;
    const newIndex = idx + delta;
    if (newIndex < 0 || newIndex >= pipeline.length) return;
    const clone = [...pipeline];
    const [pipe] = clone.splice(idx, 1);
    clone.splice(newIndex, 0, pipe);
    if (!validateLoopStructure(clone, true)) return;
    pipeline = clone;
    selectedPipeId = pipe.id;
    renderPipelineViews();
  }

  function formatParameterValue(value) {
    if (!Number.isFinite(value)) return '—';
    if (Number.isInteger(value)) return String(value);
    const rounded = Math.round(value * 1e6) / 1e6;
    return String(rounded);
  }

  const formatParameterValueForWGSL = StudioCore.formatParameterValueForWGSL;

  function buildParameterNameMap(evaluation) {
    return StudioCore.buildParameterNameMap(parameters, evaluation);
  }

  const resolveSizeInput = StudioCore.resolveSizeInput;

  function buildParameterConstWGSL() {
    return StudioCore.buildParameterConstWGSL(parameters, { t });
  }
  function updateTextureSizesFromParameters(evaluation) {
    if (!textures.length) return;
    const nameMap = buildParameterNameMap(evaluation);
    let didChange = false;
    textures.forEach((tex) => {
      const sizeInput = tex.sizeInput || {};
      const nextSize = {
        x: clamp(resolveSizeInput(sizeInput.x, tex.size.x, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
        y: clamp(resolveSizeInput(sizeInput.y, tex.size.y, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
        z: clamp(resolveSizeInput(sizeInput.z, tex.size.z, evaluation, nameMap), 1, Number.MAX_SAFE_INTEGER),
      };
      const sizeChanged = nextSize.x !== tex.size.x || nextSize.y !== tex.size.y || nextSize.z !== tex.size.z;
      if (sizeChanged) {
        tex.size = nextSize;
        regenerateValues(tex);
        didChange = true;
      }
    });
    if (!didChange) return;
    markBindingsDirty();
    const current = textures.find((t) => t.id === selectedTextureId);
    if (current) updateSliceControl(current);
    renderPreview();
  }

  function updatePipelineDispatchFromParameters(evaluation) {
    if (!pipeline.length) return;
    const nameMap = buildParameterNameMap(evaluation);
    let didChange = false;
    pipeline.forEach((pipe) => {
      if ((pipe.type || 'step') !== 'step') return;
      const dispatchInput = pipe.dispatchInput || {};
      const nextDispatch = {
        x: clamp(resolveSizeInput(dispatchInput.x, pipe.dispatch?.x ?? 1, evaluation, nameMap), 1, 65535),
        y: clamp(resolveSizeInput(dispatchInput.y, pipe.dispatch?.y ?? 1, evaluation, nameMap), 1, 65535),
        z: clamp(resolveSizeInput(dispatchInput.z, pipe.dispatch?.z ?? 1, evaluation, nameMap), 1, 65535),
      };
      const prev = pipe.dispatch || {};
      if (nextDispatch.x !== prev.x || nextDispatch.y !== prev.y || nextDispatch.z !== prev.z) {
        pipe.dispatch = nextDispatch;
        didChange = true;
      }
    });
    if (didChange) renderPipelineTimeline();
  }

  function buildDefaultParameter() {
    const base = t('parameters.default_name', null, 'Param');
    let idx = parameters.length + 1;
    let name = `${base}${idx}`;
    const exists = (candidate) => parameters.some((p) => (p.name || '').toLowerCase() === candidate.toLowerCase());
    while (exists(name)) {
      idx += 1;
      name = `${base}${idx}`;
    }
    return {
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `param-${Date.now()}`,
      name,
      expr: '0',
    };
  }

  function getParameterEvaluation() {
    return StudioCore.evaluateParameters(parameters, { t });
  }
  function renderParameterList(evaluation) {
    if (!parameterList) return;
    const { values, errors } = evaluation;
    parameterList.innerHTML = '';
    if (!parameters.length) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = t('parameters.empty', null, 'Aucun paramètre. Ajoutez-en un.');
      parameterList.appendChild(empty);
      if (removeParameterBtn) removeParameterBtn.disabled = true;
      return;
    }
    if (removeParameterBtn) removeParameterBtn.disabled = false;
    parameters.forEach((param) => {
      const item = document.createElement('div');
      item.className = `list-item ${param.id === selectedParameterId ? 'active' : ''}`;
      if (errors.has(param.id)) item.classList.add('has-error');
      const info = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = param.name || t('parameters.default_name', null, 'Param');
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = (param.expr || '').trim() || '0';
      info.appendChild(title);
      info.appendChild(meta);
      const value = document.createElement('div');
      value.className = 'param-value';
      if (errors.has(param.id)) {
        value.textContent = '—';
        value.classList.add('is-error');
      } else {
        value.textContent = formatParameterValue(values.get(param.id));
      }
      item.appendChild(info);
      item.appendChild(value);
      item.addEventListener('click', () => {
        selectedParameterId = param.id;
        renderParameterViews();
      });
      parameterList.appendChild(item);
    });
  }

  function renderParameterPreview(evaluation) {
    if (!parameterPreviewGrid) return;
    const { values, errors } = evaluation;
    parameterPreviewGrid.innerHTML = '';
    if (!parameters.length) {
      if (parameterPreviewEmpty) parameterPreviewEmpty.classList.remove('hidden');
      return;
    }
    if (parameterPreviewEmpty) parameterPreviewEmpty.classList.add('hidden');
    parameters.forEach((param) => {
      const row = document.createElement('div');
      row.className = 'parameters-row';
      if (errors.has(param.id)) row.classList.add('has-error');
      const left = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'parameters-name';
      name.textContent = param.name || t('parameters.default_name', null, 'Param');
      const expr = document.createElement('div');
      expr.className = 'parameters-expr';
      expr.textContent = `= ${(param.expr || '').trim() || '0'}`;
      left.appendChild(name);
      left.appendChild(expr);
      const value = document.createElement('div');
      value.className = 'parameters-value';
      if (errors.has(param.id)) {
        value.textContent = '—';
        value.title = errors.get(param.id) || '';
      } else {
        value.textContent = formatParameterValue(values.get(param.id));
      }
      row.appendChild(left);
      row.appendChild(value);
      row.addEventListener('click', () => {
        selectedParameterId = param.id;
        renderParameterViews();
      });
      parameterPreviewGrid.appendChild(row);
    });
  }

  function renderParameterForm(param, evaluation) {
    if (!parameterForm) return;
    const inputs = parameterForm.querySelectorAll('input, button');
    if (!param) {
      inputs.forEach((el) => { el.disabled = true; });
      parameterForm.parameterName.value = '';
      parameterForm.parameterExpr.value = '';
      if (parameterValue) {
        parameterValue.textContent = '—';
        parameterValue.classList.remove('is-error');
      }
      if (parameterNote) parameterNote.textContent = '';
      return;
    }
    inputs.forEach((el) => { el.disabled = false; });
    parameterForm.parameterName.value = param.name || '';
    parameterForm.parameterExpr.value = String(param.expr ?? '');
    const error = evaluation.errors.get(param.id);
    if (parameterValue) {
      if (error) {
        parameterValue.textContent = '—';
        parameterValue.classList.add('is-error');
      } else {
        parameterValue.textContent = formatParameterValue(evaluation.values.get(param.id));
        parameterValue.classList.remove('is-error');
      }
    }
    if (parameterNote) parameterNote.textContent = error || '';
  }

  function renderParameterViews() {
    const evaluation = getParameterEvaluation();
    const current = parameters.find((p) => p.id === selectedParameterId) || parameters[0] || null;
    selectedParameterId = current ? current.id : null;
    renderParameterList(evaluation);
    renderParameterPreview(evaluation);
    renderParameterForm(current, evaluation);
    updateTextureSizesFromParameters(evaluation);
    updatePipelineDispatchFromParameters(evaluation);
  }

  function applyFormToParameter(param) {
    if (!parameterForm) return false;
    const formData = new FormData(parameterForm);
    const proposedName = String(formData.get('parameterName') || param.name || '').trim();
    const proposedExprRaw = String(formData.get('parameterExpr') ?? param.expr ?? '').trim();
    if (!proposedName) {
      if (parameterNote) parameterNote.textContent = t('parameters.errors.empty_name', null, 'Nom requis.');
      return false;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(proposedName)) {
      if (parameterNote) parameterNote.textContent = t('parameters.errors.invalid_name', null, 'Nom invalide.');
      return false;
    }
    const isDuplicate = parameters.some(
      (p) => p.id !== param.id && (p.name || '').toLowerCase() === proposedName.toLowerCase(),
    );
    if (isDuplicate) {
      if (parameterNote) parameterNote.textContent = t('parameters.errors.duplicate', null, 'Nom déjà utilisé.');
      return false;
    }
    param.name = proposedName;
    param.expr = proposedExprRaw || '0';
    if (parameterNote) parameterNote.textContent = '';
    return true;
  }

  function buildDefaultLibrary() {
    const idx = functionsStore.length + 1;
    return {
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `fn-${Date.now()}`,
      name: `Bibliothèque ${idx}`,
      code: defaultFunctionCode(),
    };
  }

  function defaultFunctionCode() {
    return [
      '/* Exemple de fonctions ',
      'fn clamp01(value : f32) -> f32 {',
      '    return max(0.0, min(1.0, value));',
      '}',
      '',
      'fn lerp(a : f32, b : f32, t : f32) -> f32 {',
      '    return a + (b - a) * clamp01(t);',
      '} */',
    ].join('\n');
  }

  function renderFunctionList() {
    functionList.innerHTML = '';
    if (!functionsStore.length) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = t('functions.empty', null, 'Aucune bibliothèque. Ajoutez-en une.');
      functionList.appendChild(empty);
      removeFunctionBtn.disabled = true;
      duplicateFunctionBtn.disabled = true;
      return;
    }
    removeFunctionBtn.disabled = false;
    duplicateFunctionBtn.disabled = false;
    functionsStore.forEach((fn) => {
      const item = document.createElement('div');
      item.className = `list-item ${fn.id === selectedFunctionId ? 'active' : ''}`;
      item.dataset.id = fn.id;
      if (functionIdsWithErrors.has(fn.id)) item.classList.add('has-error');
      const title = document.createElement('div');
      title.textContent = fn.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${fn.code.split(/\r?\n/).length} lignes`;
      item.appendChild(title);
      item.appendChild(meta);
      item.addEventListener('click', () => {
        selectedFunctionId = fn.id;
        renderFunctionViews();
        const loc = firstErrorLocation('function', fn.id);
        if (loc) navigateToLocation(loc);
      });
      functionList.appendChild(item);
    });
  }

  function renderFunctionForm(fn) {
    const inputs = functionForm.querySelectorAll('input, button');
    if (!fn) {
      inputs.forEach((el) => { el.disabled = true; });
      functionForm.functionName.value = '';
      return;
    }
    inputs.forEach((el) => { el.disabled = false; });
    functionForm.functionName.value = fn.name;
  }

  function renderFunctionEditor(fn) {
    if (!fn) {
      functionEditor.value = '';
      functionEditor.disabled = true;
      updateFunctionStats('');
      renderDiagnosticsPanels();
      clearEditorRailErrors(functionEditor, functionGutter);
      syncRustHighlight(functionEditor, functionHighlight);
      return;
    }
    functionEditor.disabled = false;
    functionEditor.value = fn.code;
    updateFunctionStats(fn.code);
    scheduleLiveDiagnostics();
    clearEditorRailErrors(functionEditor, functionGutter);
    syncRustHighlight(functionEditor, functionHighlight);
  }

  function renderFunctionViews() {
    const fn = functionsStore.find((f) => f.id === selectedFunctionId) || functionsStore[0];
    selectedFunctionId = fn ? fn.id : null;
    renderFunctionList();
    renderFunctionForm(fn || null);
    renderFunctionEditor(fn || null);
    updateTextureDeclarationsEditor();
  }

  function updateFunctionStats(code) {
    const lines = code ? code.split(/\r?\n/).length : 0;
    const chars = code ? code.length : 0;
    if (functionLines) {
      functionLines.textContent = t('stats.lines_count', { count: lines }, `${lines} ${lines > 1 ? 'lignes' : 'ligne'}`);
    }
    statLines.textContent = lines;
    statChars.textContent = chars;
  }

  function sanitizeEntryName(name) {
    return StudioCore.sanitizeEntryName(name);
  }

  function enforceEntryName(code, entryName) {
    return StudioCore.enforceEntryName(code, entryName);
  }

  function adjustLiteralsForTarget(code, isFloatTarget) {
    return StudioCore.adjustLiteralsForTarget(code, isFloatTarget);
  }

  function sanitizedIdentifier(name, fallback = 'identifier') {
    return StudioCore.sanitizedIdentifier(name, fallback);
  }

  function logConsole(message, meta = '', loc = null) {
    const time = new Date().toLocaleTimeString();
    const resolved = resolveWGSLLocation(loc, lastWGSLMap);
    consoleMessages.push({ time, message, meta, loc, resolved });
    if (isConsoleError(message, meta)) setConsoleTabHasError(true);
    renderConsole();
  }

  function logLongStringToConsole(label, text, chunkSize = 10000) {
    if (text === null || text === undefined) {
      console.log(label, text);
      return;
    }
    const str = String(text);
    if (str.length <= chunkSize) {
      console.log(label, str);
      return;
    }
    const total = Math.ceil(str.length / chunkSize);
    for (let i = 0; i < total; i += 1) {
      const start = i * chunkSize;
      const chunk = str.slice(start, start + chunkSize);
      console.log(`${label} [${i + 1}/${total}]`, chunk);
    }
  }

  function renderConsole() {
    if (!consoleArea) return;
    consoleArea.innerHTML = '';
    const hasErrors = consoleMessages.some((m) => isConsoleError(m.message, m.meta));
    setConsoleTabHasError(hasErrors);
    if (!consoleMessages.length) {
      const empty = document.createElement('div');
      empty.className = 'console-line';
      empty.textContent = t('console.empty', null, 'Aucune erreur pour le moment.');
      consoleArea.appendChild(empty);
      return;
    }
    consoleMessages.slice(-100).forEach((msg) => {
      const line = document.createElement('div');
      let level = 'info';
      const metaLower = (msg.meta || '').toLowerCase();
      const msgLower = (msg.message || '').toLowerCase();
      if (isConsoleError(msg.message, msg.meta)) level = 'error';
      else if (metaLower.includes('warn')) level = 'warn';
      line.className = `console-line ${level}`;
      const targetLoc = msg.resolved;
      if (targetLoc) {
        line.classList.add('clickable');
        line.addEventListener('click', () => navigateToLocation(targetLoc));
      }
      const metaEl = document.createElement('span');
      metaEl.className = 'meta';
      const metaText = `[${msg.time}] ${msg.meta || ''}`.trim();
      metaEl.textContent = metaText;
      line.appendChild(metaEl);
      const messageEl = document.createElement('span');
      const locText = targetLoc
        ? ` [${targetLoc.kind === 'shader'
          ? t('console.location.shader', null, 'Shader')
          : t('console.location.function', null, 'Fonction')}: ${targetLoc.name} L${targetLoc.line} C${targetLoc.col}]`
        : '';
      messageEl.textContent = ` ${msg.message}${locText}`;
      line.appendChild(messageEl);
      consoleArea.appendChild(line);
    });
  }

  function buildShaderSectionWithMap(bindingOffset, primaryTextureName, primaryTextureType) {
    return StudioCore.buildShaderSectionWithMap(
      getSimulationProject(),
      bindingOffset,
      primaryTextureName,
      primaryTextureType,
    );
  }

  function buildCombinedWGSLWithMap() {
    return StudioCore.buildCombinedWGSLWithMap(getSimulationProject());
  }

  function buildSingleShaderWGSLWithMap(shader, bindingOffset, primaryTextureName, primaryTextureType) {
    return StudioCore.buildSingleShaderWGSLWithMap(
      getSimulationProject(),
      shader,
      bindingOffset,
      primaryTextureName,
      primaryTextureType,
    );
  }

  function buildSingleFunctionWGSLWithMap(fn, bindingOffset, primaryTextureName, primaryTextureType) {
    return StudioCore.buildSingleFunctionWGSLWithMap(
      getSimulationProject(),
      fn,
      bindingOffset,
      primaryTextureName,
      primaryTextureType,
    );
  }

  function buildCombinedWGSL() {
    return StudioCore.buildCombinedWGSL(getSimulationProject());
  }

  function buildTextureDeclarationsWGSL() {
    return StudioCore.buildBufferDeclarationsWGSLForTextures(
      textures.slice(0, getMaxStorageBindings(currentDevice)),
      BUFFER_BINDING_OFFSET,
    );
  }

  function buildShaderSection(bindingOffset, primaryTextureName, primaryTextureType) {
    return buildShaderSectionWithMap(bindingOffset, primaryTextureName, primaryTextureType).code;
  }

  function buildStepDeclarationWGSL() {
    return StudioCore.buildUniformDeclarationsWGSL();
  }

  function updateTextureDeclarationsEditor() {
    if (!texturesEditor) return;
    texturesEditor.value = buildStepDeclarationWGSL();
  }

  function normalizeComputeCode(code, bindingOffset, declSeen, primaryTextureName, primaryTextureType) {
    return StudioCore.normalizeComputeCode(
      code,
      bindingOffset,
      declSeen,
      primaryTextureName,
      primaryTextureType,
    );
  }

  function validateWGSL(wgsl) {
    const errors = StudioCore.validateWGSLSyntaxOnly(wgsl);
    if (errors.length) isCompiled = false;
    updateButtons();
    return errors;
  }

  async function compileWGSL() {
    const result = await simulationRuntime.compileProject(getSimulationProject());
    syncRuntimeState();
    isCompiled = Boolean(result?.ok);
    updateButtons();
    return result;
  }

  function buildComputePipelines(device, shaderModules) {
    const ok = simulationRuntime.buildComputePipelines(getSimulationProject(device), shaderModules);
    isCompiled = Boolean(ok);
    updateButtons();
    return ok;
  }

  const updateTextureValuesFromFlat = StudioCore.updateTextureValuesFromFlat;
  const flattenTextureToTypedArray = StudioCore.flattenTextureToTypedArray;

  function resetGPUState() {
    simulationRuntime.resetExecution();
    syncRuntimeState();
    renderStepCounter();
  }
  function serializeProject() {
    return {
      version: 1,
      projectName: getProjectName(),
      textures: textures.map((tex) => ({
        ...tex,
        values: [],
      })),
      shaders,
      functions: functionsStore,
      parameters,
      pipeline,
      pipelineShaderChoiceId,
    };
  }

  function loadProject(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Fichier invalide');
    }
    stopCurrentExecution(false);
    consoleMessages = [];
    renderConsole();
    setConsoleTabHasError(false);
    if (Object.prototype.hasOwnProperty.call(data, 'projectName')) {
      setProjectName(data.projectName);
    }
    textures = Array.isArray(data.textures)
      ? data.textures.map((tex) => {
        const size = tex?.size || { x: 1, y: 1, z: 1 };
        const existing = tex?.sizeInput;
        const sizeInput = (existing && typeof existing === 'object')
          ? {
            x: typeof existing.x === 'string' || typeof existing.x === 'number' ? String(existing.x) : String(size?.x ?? 1),
            y: typeof existing.y === 'string' || typeof existing.y === 'number' ? String(existing.y) : String(size?.y ?? 1),
            z: typeof existing.z === 'string' || typeof existing.z === 'number' ? String(existing.z) : String(size?.z ?? 1),
          }
          : { x: String(size?.x ?? 1), y: String(size?.y ?? 1), z: String(size?.z ?? 1) };
        return {
          ...tex,
          type: normalizeTextureType(tex?.type),
          fill: tex?.fill === 'random' ? 'random' : 'empty',
          size,
          sizeInput,
          values: Array.isArray(tex?.values) ? tex.values : [],
        };
      })
      : [];
    textures.forEach((tex) => {
      if (tex?.fill === 'random') {
        regenerateValues(tex);
        return;
      }
      ensureValueShape(tex);
    });
    shaders = Array.isArray(data.shaders) ? data.shaders : [];
    functionsStore = Array.isArray(data.functions) ? data.functions : [];
    parameters = Array.isArray(data.parameters)
      ? data.parameters.map((param, idx) => ({
        id: param?.id || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `param-${Date.now()}-${idx}`),
        name: typeof param?.name === 'string' ? param.name : String(param?.name ?? ''),
        expr: (typeof param?.expr === 'string' || typeof param?.expr === 'number')
          ? String(param.expr)
          : '',
      }))
      : [];
    pipeline = Array.isArray(data.pipeline) ? data.pipeline : [];
    pipeline.forEach((pipe) => {
      if ((pipe.type || 'step') === 'step' && typeof pipe.activated !== 'boolean') {
        pipe.activated = true;
      }
      if ((pipe.type || 'step') === 'step') {
        const dispatch = pipe.dispatch || { x: 1, y: 1, z: 1 };
        pipe.dispatch = {
          x: clamp(parseInt(dispatch.x, 10) || 1, 1, 65535),
          y: clamp(parseInt(dispatch.y, 10) || 1, 1, 65535),
          z: clamp(parseInt(dispatch.z, 10) || 1, 1, 65535),
        };
        if (!pipe.dispatchInput || typeof pipe.dispatchInput !== 'object') {
          pipe.dispatchInput = {
            x: String(pipe.dispatch.x),
            y: String(pipe.dispatch.y),
            z: String(pipe.dispatch.z),
          };
        }
      }
    });
    pipelineShaderChoiceId = data.pipelineShaderChoiceId || shaders[0]?.id || null;
    normalizeAllShaderBufferIds();
    selectedTextureId = textures[0]?.id || null;
    selectedShaderId = shaders[0]?.id || null;
    selectedFunctionId = functionsStore[0]?.id || null;
    selectedPipeId = pipeline[0]?.id || null;
    selectedParameterId = parameters[0]?.id || null;
    markBindingsDirty();
    renderTextureList();
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (tex) {
      renderForm(tex);
      if (!Array.isArray(tex.values) || tex.values.length === 0) {
        ensureValueShape(tex);
      }
      renderPreview();
    } else {
      renderForm({ size: { x: 1, y: 1, z: 1 }, type: 'int', fill: 'empty', name: '' });
    }
    renderShaderList();
    const currentShader = shaders.find((s) => s.id === selectedShaderId) || shaders[0];
    renderShaderForm(currentShader || null);
    renderShaderEditor(currentShader || null);
    renderFunctionViews();
    renderPipelineViews();
    renderParameterViews();
    updateTextureDeclarationsEditor();
  }

  function syncShaderEntryName(shader) {
    const entryName = sanitizeEntryName(shader.name);
    const computePattern = /(@compute[^\n]*\n\s*fn\s+)([A-Za-z_][\w]*)/m;
    const fnPattern = /(fn\s+)([A-Za-z_][\w]*)/m;
    if (computePattern.test(shader.code)) {
      shader.code = shader.code.replace(computePattern, `$1${entryName}`);
    } else if (fnPattern.test(shader.code)) {
      shader.code = shader.code.replace(fnPattern, `$1${entryName}`);
    } else {
      shader.code = `${shader.code || ''}\nfn ${entryName}() {\n}\n`;
    }
  }

  function seedInitialPipeline() {
    if (!shaders.length) return;
    const pipe = buildPipelinePipe();
    pipeline.push(pipe);
    selectedPipeId = pipe.id;
    renderPipelineViews();
  }

  function seedInitialFunction() {
    const fn = buildDefaultLibrary();
    functionsStore.push(fn);
    selectedFunctionId = fn.id;
    renderFunctionViews();
  }

  function buildDefaultShader() {
    const idx = shaders.length + 1;
    const shaderName = `Compute${idx}`;
    const entryName = shaderName.replace(/\s+/g, '');
    return {
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `shader-${Date.now()}`,
      name: shaderName,
      workgroup: { x: 8, y: 8, z: 1 },
      code: defaultShaderCode(entryName),
      bufferIds: getDefaultShaderBufferIds(),
    };
  }

  function defaultShaderCode(entryName = 'main') {
    return [
      '@compute @workgroup_size(8, 8, 1)',
      `fn ${entryName}(@builtin(global_invocation_id) gid : vec3<u32>) {`,
      '    let index = gid.y * 64u + gid.x;',
      '    if (index < arrayLength(&Buffer1)) {',
      '        Buffer1[index] = Buffer1[index] + 1;',
      '    }',
      '}',
    ].join('\n');
  }

  function applyFormToShader(shader) {
    const formData = new FormData(shaderForm);
    const proposedName = (formData.get('shaderName') || shader.name).trim();
    const isDuplicate = shaders.some(
      (s) => s.id !== shader.id && s.name.toLowerCase() === proposedName.toLowerCase(),
    );
    if (proposedName && !isDuplicate) {
      shader.name = proposedName;
      syncShaderEntryName(shader);
    }

    renderShaderForm(shader);
  }

  function renderShaderList() {
    shaderList.innerHTML = '';
    if (shaders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = t('shaders.empty', null, 'Aucun compute shader. Ajoutez-en un.');
      shaderList.appendChild(empty);
      removeShaderBtn.disabled = true;
      duplicateShaderBtn.disabled = true;
      renderShaderForm(null);
      renderShaderEditor(null);
      return;
    }
    removeShaderBtn.disabled = false;
    duplicateShaderBtn.disabled = false;
    shaders.forEach((shader) => {
      const item = document.createElement('div');
      item.className = `list-item ${shader.id === selectedShaderId ? 'active' : ''}`;
      item.dataset.id = shader.id;
      if (shaderIdsWithErrors.has(shader.id)) item.classList.add('has-error');
      const title = document.createElement('div');
      title.textContent = shader.name;
      item.appendChild(title);
      item.addEventListener('click', () => {
        selectedShaderId = shader.id;
        renderShaderList();
        renderShaderForm(shader);
        renderShaderEditor(shader);
        const loc = firstErrorLocation('shader', shader.id);
        if (loc) navigateToLocation(loc);
      });
      shaderList.appendChild(item);
    });
  }

  function renderShaderForm(shader) {
    const inputs = shaderForm.querySelectorAll('input');
    if (!shader) {
      inputs.forEach((input) => {
        input.value = '';
        input.disabled = true;
      });
      renderShaderBufferList(null);
      updateShaderBindingsEditor(null);
      return;
    }
    inputs.forEach((input) => {
      input.disabled = false;
    });
    shaderForm.shaderName.value = shader.name;
    renderShaderBufferList(shader);
    updateShaderBindingsEditor(shader);
  }

  function renderShaderEditor(shader) {
    if (!shader) {
      shaderEditor.value = '';
      shaderEditor.disabled = true;
      updateShaderLines('');
      renderDiagnosticsPanels();
      clearEditorRailErrors(shaderEditor, shaderGutter);
      syncRustHighlight(shaderEditor, shaderHighlight);
      return;
    }
    shaderEditor.disabled = false;
    shaderEditor.value = shader.code;
    updateShaderLines(shader.code);
    scheduleLiveDiagnostics();
    clearEditorRailErrors(shaderEditor, shaderGutter);
    syncRustHighlight(shaderEditor, shaderHighlight);
  }

  function updateShaderLines(code) {
    const lines = code ? code.split(/\r?\n/).length : 0;
    if (shaderLines) {
      shaderLines.textContent = t('stats.lines_count', { count: lines }, `${lines} ${lines > 1 ? 'lignes' : 'ligne'}`);
    }
  }

  function renderTextureList() {
    bufferList.innerHTML = '';
    if (textures.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = t('buffers.empty', null, 'Aucune texture. Ajoutez-en une.');
      bufferList.appendChild(empty);
      removeBufferBtn.disabled = true;
      updateTextureDeclarationsEditor();
      return;
    }
    removeBufferBtn.disabled = false;
    textures.forEach((tex) => {
      const item = document.createElement('div');
      item.className = `list-item ${tex.id === selectedTextureId ? 'active' : ''}`;
      const title = document.createElement('div');
      title.textContent = tex.name;
      item.appendChild(title);
      item.addEventListener('click', () => {
        selectedTextureId = tex.id;
        renderForm(tex);
        renderTextureList();
        renderPreview();
      });
      bufferList.appendChild(item);
    });
    updateTextureDeclarationsEditor();
  }

  function renderForm(tex) {
    const sizeInput = tex.sizeInput || {};
    bufferForm.name.value = tex.name;
    bufferForm.sizeX.value = sizeInput.x !== undefined && sizeInput.x !== null && sizeInput.x !== '' ? sizeInput.x : tex.size.x;
    bufferForm.sizeY.value = sizeInput.y !== undefined && sizeInput.y !== null && sizeInput.y !== '' ? sizeInput.y : tex.size.y;
    bufferForm.sizeZ.value = sizeInput.z !== undefined && sizeInput.z !== null && sizeInput.z !== '' ? sizeInput.z : tex.size.z;
    bufferForm.type.value = normalizeTextureType(tex.type);
    bufferForm.fill.value = tex.fill;
    updateSliceControl(tex);
  }

  function renderPreview() {
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (!tex) {
      preview2D.innerHTML = `<p class="eyebrow">${t('preview.none_selected', null, 'Aucune texture sélectionnée')}</p>`;
      preview3D.innerHTML = '';
      setPreviewValue(0,0,null);
      setMouseUniformPosition(0, 0, 0, false);
      valuesSelections = [];
      valuesActiveSelectionIndex = -1;
      valuesSelectionAnchor = null;
      scheduleValuesRender(true);
      return;
    }
    const sliceIndex = clamp(parseInt(zSlice.value, 10) || 0, 0, tex.size.z - 1);
    if (previewMode === '2d') {
      preview2D.classList.remove('hidden');
      preview3D.classList.add('hidden');
      setMouseUniformPosition(0, 0, sliceIndex, false);
      render2DImage(tex);
    } else {
      setPreviewValue(0,0,null);
      setMouseUniformPosition(0, 0, sliceIndex, false);
      preview2D.classList.add('hidden');
      preview3D.classList.remove('hidden');
      render3DImage(tex);
    }
    scheduleValuesRender(true);
  }

  function valueToRGBA(val, typeOrFloat) {
    const normalized = typeof typeOrFloat === 'string'
      ? normalizeTextureType(typeOrFloat)
      : (typeOrFloat ? 'float' : 'int');
    if (normalized === 'vec3f') {
      const [r, g, b] = fractionalVec3ToRGB(val);
      return [r, g, b, 255];
    }
    if (normalized === 'vec4f') {
      const v = normalizeVec4Value(val);
      return [
        Math.round(getFraction01(v[0]) * 255),
        Math.round(getFraction01(v[1]) * 255),
        Math.round(getFraction01(v[2]) * 255),
        Math.round(getFraction01(v[3]) * 255),
      ];
    }
    if (normalized === 'float') {
      // Utilise uniquement la partie décimale pour une palette arc-en-ciel
      const frac = (() => {
        const n = Number(val) || 0;
        return Math.abs(n - Math.floor(n));
      })();
      const t = Math.max(0, Math.min(1, frac));
      // Arc-en-ciel simple : map 0..1 -> HSV (hue 0..300°), s=1, v=1
      const hue = t * 300.0; // limite à magenta pour éviter retour rouge
      const c = 1.0;
      const x = c * (1.0 - Math.abs(((hue / 60.0) % 2.0) - 1.0));
      let r = 0.0; let g = 0.0; let b = 0.0;
      if (hue < 60.0)      { r = c; g = x; b = 0.0; }
      else if (hue < 120.0){ r = x; g = c; b = 0.0; }
      else if (hue < 180.0){ r = 0.0; g = c; b = x; }
      else if (hue < 240.0){ r = 0.0; g = x; b = c; }
      else                 { r = x; g = 0.0; b = c; }
      return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255),
        255,
      ];
    }
    const v = (Number(val) || 0) >>> 0;
    return [
      v & 0xff,
      (v >> 8) & 0xff,
      (v >> 16) & 0xff,
      (v >> 24) & 0xff,
    ];
  }

  function render2DImage(tex) {
    preview2D.classList.add('image-mode');
    const sliceIndex = clamp(parseInt(zSlice.value, 10) || 0, 0, tex.size.z - 1);
    sliceLabel.textContent = `Z = ${sliceIndex}`;
    setMouseUniformPosition(0, 0, sliceIndex, false);
    const layer = tex.values[sliceIndex] || [];
    preview2D.innerHTML = '';
    preview2D.style.gridTemplateColumns = '';
    const canvas = document.createElement('canvas');
    canvas.className = 'texture-canvas';
    canvas.width = tex.size.x;
    canvas.height = tex.size.y;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(tex.size.x, tex.size.y);
    let ptr = 0;
    for (let j = tex.size.y-1; j >= 0 ; j -= 1) {
      for (let i = 0; i < tex.size.x; i += 1) {
        const v = layer[j]?.[i];
        const [r, g, b, a] = valueToRGBA(v, tex.type);
        imageData.data[ptr] = r;
        imageData.data[ptr + 1] = g;
        imageData.data[ptr + 2] = b;
        imageData.data[ptr + 3] = a ?? 255;
        ptr += 4;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const valType = tex.type;
    const handleHover = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * tex.size.x);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * tex.size.y);
      if (x >= 0 && x < tex.size.x && y >= 0 && y < tex.size.y) {
        const invY = tex.size.y - y - 1;
        const v = layer[invY]?.[x];
        setPreviewValue(x, invY, v, valType);
        setMouseUniformPosition(x, invY, sliceIndex, true);
      } else {
        setPreviewValue(0,0,null);
        setMouseUniformPosition(0, 0, sliceIndex, false);
      }
    };
    canvas.addEventListener('pointerdown', handleHover);
    canvas.addEventListener('pointermove', handleHover);
    canvas.addEventListener('pointerleave', () => {
      setPreviewValue(0,0,null);
      setMouseUniformPosition(0, 0, sliceIndex, false);
    });
    preview2D.appendChild(canvas);
  }

  function add3(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }
  function sub3(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }
  function mul3(a, s) {
    return [a[0] * s, a[1] * s, a[2] * s];
  }
  function mulMat3Vec3(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  }
  function normalize3(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }
  function intersectBox(orig, dir, bmin, bmax) {
    const inv = [1 / dir[0], 1 / dir[1], 1 / dir[2]];
    const t0s = [(bmin[0] - orig[0]) * inv[0], (bmin[1] - orig[1]) * inv[1], (bmin[2] - orig[2]) * inv[2]];
    const t1s = [(bmax[0] - orig[0]) * inv[0], (bmax[1] - orig[1]) * inv[1], (bmax[2] - orig[2]) * inv[2]];
    const tsmaller = [Math.min(t0s[0], t1s[0]), Math.min(t0s[1], t1s[1]), Math.min(t0s[2], t1s[2])];
    const tbigger = [Math.max(t0s[0], t1s[0]), Math.max(t0s[1], t1s[1]), Math.max(t0s[2], t1s[2])];
    const tmin = Math.max(tsmaller[0], Math.max(tsmaller[1], tsmaller[2]));
    const tmax = Math.min(tbigger[0], Math.min(tbigger[1], tbigger[2]));
    if (tmax >= Math.max(tmin, 0)) return [tmin, tmax];
    return null;
  }

  class VoxelRenderer {
    constructor(container, onHover) {
      this.container = container;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'voxel-canvas';
      this.gl = this.canvas.getContext('webgl2', { alpha: false, antialias: true });
      this.isValid = !!this.gl;
      this.program = null;
      this.tex = null;
      this.size = [1, 1, 1];
      this.scale = [1, 1, 1];
      this.camDist = 1.2;
      this.rotX = -0.75;
      this.rotY = 0.9;
      this.isDragging = false;
      this.lastPos = { x: 0, y: 0 };
      this.onHover = onHover;
      this.currentTex = null;
      if (this.isValid) {
        this.initGL();
        this.attachInteractions();
      }
    }

    initGL() {
      const gl = this.gl;
      const vs = `#version 300 es
      layout(location=0) in vec2 position;
      out vec2 vUV;
      void main() {
        vUV = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }`;
      const fs = `#version 300 es
      precision highp float;
      precision highp sampler3D;
      in vec2 vUV;
      out vec4 outColor;
      uniform sampler3D uTex;
      uniform mat3 uRot;
      uniform float uCamDist;
      uniform float uAlphaScale;
      uniform float uAmbient;
      uniform vec3 uScale;
      uniform vec3 uTexSize;
      const vec3 center = vec3(0.5);

      // Simple ray-box intersection against [0,1]^3
      bool intersectBox(vec3 orig, vec3 dir, vec3 bmin, vec3 bmax, out float tmin, out float tmax) {
        vec3 inv = 1.0 / dir;
        vec3 t0s = (bmin - orig) * inv;
        vec3 t1s = (bmax - orig) * inv;
        vec3 tsmaller = min(t0s, t1s);
        vec3 tbigger = max(t0s, t1s);
        tmin = max(max(tsmaller.x, tsmaller.y), tsmaller.z);
        tmax = min(min(tbigger.x, tbigger.y), tbigger.z);
        return tmax >= max(tmin, 0.0);
      }

      void main() {
        vec2 uv = vUV * 2.0 - 1.0;
        vec3 dir = normalize(uRot * vec3(uv, 1.3));
        vec3 camOffset = uRot * vec3(0.0, 0.0, -uCamDist);
        vec3 camera = center + camOffset;
        vec3 halfS = 0.5 * uScale;
        vec3 bmin = center - halfS;
        vec3 bmax = center + halfS;
        float tmin; float tmax;
        if (!intersectBox(camera, dir, bmin, bmax, tmin, tmax)) {
          outColor = vec4(0.0);
          return;
        }
        float t = max(tmin, 0.0);
        vec4 acc = vec4(0.0);
        // Adaptive step to avoid skipping voxels when the view is near-perpendicular.
        float voxelStep = min(min(uScale.x / max(uTexSize.x, 1.0), uScale.y / max(uTexSize.y, 1.0)), uScale.z / max(uTexSize.z, 1.0));
        float stepSize = max(0.0015, voxelStep * 0.6);
        // fixed step raymarch
        for (int i = 0; i < 768; i++) {
          if (t > tmax || acc.a > 0.98) break;
          vec3 p = camera + dir * t;
          vec3 uvw = (p - bmin) / uScale;
          vec4 c = texture(uTex, uvw);
          float a = c.a * uAlphaScale;
          // Ambient boost to keep low-intensity voxels readable.
          vec3 lit = c.rgb * (1.0 + uAmbient);
          acc.rgb += (1.0 - acc.a) * lit * a;
          acc.a += (1.0 - acc.a) * a;
          t += stepSize;
        }
        outColor = acc;
      }`;
      const vsObj = this.compile(gl.VERTEX_SHADER, vs);
      const fsObj = this.compile(gl.FRAGMENT_SHADER, fs);
      this.program = this.link(vsObj, fsObj);
      this.posLoc = 0;
      this.rotLoc = gl.getUniformLocation(this.program, 'uRot');
      this.camDistLoc = gl.getUniformLocation(this.program, 'uCamDist');
      this.alphaLoc = gl.getUniformLocation(this.program, 'uAlphaScale');
      this.ambientLoc = gl.getUniformLocation(this.program, 'uAmbient');
      this.scaleLoc = gl.getUniformLocation(this.program, 'uScale');
      this.texSizeLoc = gl.getUniformLocation(this.program, 'uTexSize');
      this.quadVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_3D, this.tex);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    }

    attachInteractions() {
      const minCamDist = 0.2;
      const maxCamDist = 10.0;
      const onDown = (e) => {
        this.isDragging = true;
        this.lastPos = { x: e.clientX, y: e.clientY };
      };
      const onUp = () => {
        this.isDragging = false;
      };
      const onMove = (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastPos.x;
        const dy = e.clientY - this.lastPos.y;
        this.lastPos = { x: e.clientX, y: e.clientY };
        const sens = 0.01;
        this.rotY += dx * sens;
        this.rotX += dy * sens;
        const maxPitch = 1.5;
        this.rotX = Math.max(-maxPitch, Math.min(maxPitch, this.rotX));
        this.render();
        if (this.currentTex && this.onHover) {
          const rect = this.canvas.getBoundingClientRect();
          const inside = e.clientX >= rect.left && e.clientX <= rect.right
            && e.clientY >= rect.top && e.clientY <= rect.bottom;
          if (inside) this.onHover(this.pickValue(e.clientX, e.clientY));
        }
      };
      const onWheel = (e) => {
        e.preventDefault();
        const zoom = Math.exp(e.deltaY * 0.0015);
        const next = this.camDist * zoom;
        this.camDist = Math.max(minCamDist, Math.min(maxCamDist, next));
        this.render();
        onHover(e);
      };
      const onHover = (e) => {
        if (!this.currentTex || !this.onHover) return;
        const hit = this.pickValue(e.clientX, e.clientY);
        this.onHover(hit);
      };
      const onLeave = () => {
        if (this.onHover) this.onHover(null);
      };
      const onPointerDown = (e) => {
        onDown(e);
        onHover(e);
      };
      this.canvas.addEventListener('pointerdown', onPointerDown);
      this.canvas.addEventListener('pointermove', onHover);
      this.canvas.addEventListener('pointerleave', onLeave);
      this.canvas.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointermove', onMove);
    }

    pickValue(clientX, clientY) {
      if (!this.currentTex) return null;
      const rect = this.canvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
      const rotX = this.rotX;
      const rotY = this.rotY;
      const cx = Math.cos(rotX); const sx = Math.sin(rotX);
      const cy = Math.cos(rotY); const sy = Math.sin(rotY);
      const rot = [
        cy, 0, -sy,
        sx * sy, cx, sx * cy,
        cx * sy, -sx, cx * cy,
      ];
      const dir = normalize3(mulMat3Vec3(rot, [nx, ny, 1.3]));
      const camOffset = mulMat3Vec3(rot, [0, 0, -this.camDist]);
      const center = [0.5, 0.5, 0.5];
      const camera = add3(center, camOffset);
      const halfS = [this.scale[0] * 0.5, this.scale[1] * 0.5, this.scale[2] * 0.5];
      const bmin = sub3(center, halfS);
      const bmax = add3(center, halfS);
      const hit = intersectBox(camera, dir, bmin, bmax);
      if (!hit) return null;
      let [tmin, tmax] = hit;
      let t = Math.max(0, tmin);
      const alphaScale = 0.35;
      const tex = this.currentTex;
      const maxDim = Math.max(tex.size.x, tex.size.y, tex.size.z, 1);
      const minScale = Math.min(this.scale[0], this.scale[1], this.scale[2]);
      const step = (minScale / maxDim) * 1.1;
      for (let i = 0; i < 512; i += 1) {
        if (t > tmax) break;
        const p = add3(camera, mul3(dir, t));
        const uvw = [
          (p[0] - bmin[0]) / this.scale[0],
          (p[1] - bmin[1]) / this.scale[1],
          (p[2] - bmin[2]) / this.scale[2],
        ];
        if (uvw[0] >= 0 && uvw[0] < 1 && uvw[1] >= 0 && uvw[1] < 1 && uvw[2] >= 0 && uvw[2] < 1) {
          const ix = Math.floor(uvw[0] * tex.size.x);
          const iy = Math.floor(uvw[1] * tex.size.y);
          const iz = Math.floor(uvw[2] * tex.size.z);
          const val = tex.values[iz]?.[iy]?.[ix];
          const rgba = valueToRGBA(val, tex.type);
          const alpha = voxelRGBAAlpha(tex.type, rgba);
          if ((alpha / 255) * alphaScale > 0.02) {
            return { x: ix, y: iy, z: iz, value: val };
          }
        }
        t += step;
      }
      return null;
    }

    compile(type, src) {
      const gl = this.gl;
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
      }
      return sh;
    }

    link(vs, fs) {
      const gl = this.gl;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, 'position');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
      }
      return prog;
    }

    updateTexture(tex) {
      if (!this.isValid) return;
      const gl = this.gl;
      this.size = [tex.size.x, tex.size.y, tex.size.z];
      this.currentTex = tex;
      const maxDim = Math.max(tex.size.x, tex.size.y, tex.size.z, 1);
      this.scale = [
        tex.size.x / maxDim,
        tex.size.y / maxDim,
        tex.size.z / maxDim,
      ];
      const data = new Uint8Array(tex.size.x * tex.size.y * tex.size.z * 4);
      let ptr = 0;
      for (let z = 0; z < tex.size.z; z += 1) {
        for (let y = 0; y < tex.size.y; y += 1) {
          for (let x = 0; x < tex.size.x; x += 1) {
            const v = tex.values[z]?.[y]?.[x];
            const rgba = valueToRGBA(v, tex.type);
            const [r, g, b] = rgba;
            const alpha = voxelRGBAAlpha(tex.type, rgba);
            data[ptr] = r;
            data[ptr + 1] = g;
            data[ptr + 2] = b;
            data[ptr + 3] = alpha;
            ptr += 4;
          }
        }
      }
      gl.bindTexture(gl.TEXTURE_3D, this.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(
        gl.TEXTURE_3D,
        0,
        gl.RGBA8,
        tex.size.x,
        tex.size.y,
        tex.size.z,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.container.getBoundingClientRect();
      const w = Math.max(80, rect.width);
      const h = Math.max(80, rect.height || 80);
      const dw = Math.floor(w * dpr);
      const dh = Math.floor(h * dpr);
      if (this.canvas.width !== dw || this.canvas.height !== dh) {
        this.canvas.width = dw;
        this.canvas.height = dh;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    render() {
      if (!this.isValid) return;
      this.resize();
      if (!this.canvas.parentNode) {
        this.container.appendChild(this.canvas);
      }
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.enableVertexAttribArray(this.posLoc);
      gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, this.tex);
      const rotX = this.rotX;
      const rotY = this.rotY;
      const cx = Math.cos(rotX); const sx = Math.sin(rotX);
      const cy = Math.cos(rotY); const sy = Math.sin(rotY);
      const rot = [
        cy, 0, -sy,
        sx * sy, cx, sx * cy,
        cx * sy, -sx, cx * cy,
      ];
      gl.uniformMatrix3fv(this.rotLoc, false, rot);
      if (this.camDistLoc) gl.uniform1f(this.camDistLoc, this.camDist);
      gl.uniform1f(this.alphaLoc, 0.35);
      if (this.ambientLoc) gl.uniform1f(this.ambientLoc, 0.65);
      if (this.scaleLoc && this.scale) {
        gl.uniform3fv(this.scaleLoc, this.scale);
      }
      if (this.texSizeLoc && this.size) {
        gl.uniform3f(this.texSizeLoc, this.size[0], this.size[1], this.size[2]);
      }
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  function render3DImage(tex) {
    preview3D.innerHTML = '';
    if (!voxelRenderer) {
      voxelRenderer = new VoxelRenderer(preview3D, null);
    }
    voxelRenderer.onHover = (hit) => {
      if (!hit) {
        setMouseUniformPosition(0, 0, mouseZValue, false);
        return;
      }
      setMouseUniformPosition(hit.x, hit.y, hit.z, true);
    };
    if (!voxelRenderer.isValid) {
      preview3D.innerHTML = '<p class="eyebrow">WebGL2 requis pour l’aperçu 3D RGBA.</p>';
      return;
    }
    voxelRenderer.updateTexture(tex);
    setPreviewValue(0,0,null);
    voxelRenderer.render();
  }

  function updateSliceControl(tex) {
    zSlice.max = Math.max(0, tex.size.z - 1);
    if (parseInt(zSlice.value, 10) > zSlice.max) {
      zSlice.value = zSlice.max;
    }
    sliceLabel.textContent = `Z = ${zSlice.value}`;
  }

  function seedInitialShader() {
    const shader = buildDefaultShader();
    shaders.push(shader);
    selectedShaderId = shader.id;
    renderShaderList();
    renderShaderForm(shader);
    renderShaderEditor(shader);
  }

  function seedInitialTexture() {
    const defaultTex = {
      id: 'tex-default',
      name: 'Buffer1',
      type: 'int',
      fill: 'random',
      size: { x: 64, y: 32, z: 1 },
      sizeInput: { x: '64', y: '32', z: '1' },
      values: [],
    };
    regenerateValues(defaultTex);
    textures.push(defaultTex);
    selectedTextureId = defaultTex.id;
    normalizeAllShaderBufferIds();
    renderTextureList();
    renderForm(defaultTex);
    renderPreview();
    updateTextureDeclarationsEditor();
    const currentShader = shaders.find((s) => s.id === selectedShaderId) || shaders[0] || null;
    renderShaderBufferList(currentShader);
    updateShaderBindingsEditor(currentShader);
  }

  seedInitialShader();
  seedInitialPipeline();
  seedInitialFunction();
  seedInitialTexture();
  renderParameterViews();
  updateTextureDeclarationsEditor();
});
  function syncHighlightScroll(textarea, highlightEl) {
    if (!textarea || !highlightEl) return;
    highlightEl.style.transform = `translateY(${-textarea.scrollTop}px) translateX(${-textarea.scrollLeft}px)`;
  }

