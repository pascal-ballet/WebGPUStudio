(() => {
  'use strict';

  const PROJECT_URL = 'SimBugs.wgstudio';
  const SAVE_URL = 'default.sma';
  const DEFAULT_SAVE_NAME = 'ma simulation';
  const TARGET_BUFFER_NAME = 'Render';
  const CLICK_BUFFER_NAME = 'Agent_0';
  const CLICK_POSITION_BUFFER_NAME = 'AgentX';
  const DEFAULT_AGENT_TYPES = [
    { id: 'agent-type-rouge', name: 'Rouge', color: '#ff0000' },
    { id: 'agent-type-vert', name: 'Vert', color: '#00ff00' },
    { id: 'agent-type-bleu', name: 'Bleu', color: '#0000ff' },
    { id: 'agent-type-violet', name: 'Violet', color: '#ff44ff' },
  ];
  const AGENT_TYPE_COLOR_SEQUENCE = ['#ff0000', '#00ff00', '#0000ff', '#ff44ff', '#e0a400', '#00a5a5'];
  const FALLBACK_AGENT_TYPE_COLOR = '#ff44ff';

  const StudioCore = window.WebGPUStudio;
  const canvas = document.getElementById('bufferCanvas');
  const meta = document.getElementById('bufferMeta');
  const readout = document.getElementById('bufferReadout');
  const runStatus = document.getElementById('runStatus');
  const runButton = document.getElementById('runButton');
  const stepLabel = document.getElementById('stepLabel');
  const projectNameInput = document.getElementById('projectNameInput');
  const loadSaveButton = document.getElementById('loadSaveButton');
  const saveFileInput = document.getElementById('saveFileInput');
  const saveButton = document.getElementById('saveButton');
  const agentTypesList = document.getElementById('agentTypesList');
  const addAgentTypeButton = document.getElementById('addAgentTypeButton');
  const removeAgentTypeButton = document.getElementById('removeAgentTypeButton');
  const agentNameInput = document.getElementById('agentName');
  const agentColorInput = document.getElementById('agentColor');

  if (!StudioCore || !canvas) return;

  const {
    WebGPUSimulationRuntime,
    clamp,
    ensureValueShape,
    normalizeTextureType,
    normalizeVec3Value,
    normalizeVec4Value,
    regenerateValues,
  } = StudioCore;

  const runtime = new WebGPUSimulationRuntime({
    log(message, type) {
      console[type === 'compile' || type === 'pipeline' ? 'warn' : 'log'](message);
      setStatus(message);
    },
  });

  let projectState = null;
  let renderBuffer = null;
  let isRunning = false;
  let isCompiling = false;
  let stepFrameId = 0;
  let displayedSlice = 0;
  let pendingBufferWrites = [];
  let selectedAgentTypeId = null;

  setupAgentTypeControls();
  setupSaveControls();
  setupCanvasInteractions();
  setupPanelClick();
  setupRunButton();
  loadProject(PROJECT_URL, TARGET_BUFFER_NAME);

  function setupRunButton() {
    if (!runButton) return;
    runButton.addEventListener('click', () => {
      if (isRunning) {
        stopRun();
        return;
      }
      void startRun();
    });
  }

  async function loadProject(projectUrl, bufferName) {
    try {
      setStatus('Chargement du projet...');
      const response = await fetch(projectUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const project = await response.json();
      projectState = prepareProject(project);
      const saveState = await loadSaveState(SAVE_URL);
      projectState.agentTypes = saveState.agentTypes;
      selectedAgentTypeId = projectState.agentTypes[0]?.id || null;
      renderAgentTypes();
      renderBuffer = findProjectBuffer(projectState, bufferName);
      if (!renderBuffer) {
        throw new Error(`Buffer "${bufferName}" introuvable`);
      }

      render2DBuffer(renderBuffer, displayedSlice);
      if (readout) readout.textContent = 'Survolez le buffer pour lire une valeur.';
      setStepLabel(0);
      setStatus('Projet charge. default.sma charge. Cliquez sur run.');
      updateRunButton();
      updateSaveControls();
    } catch (error) {
      const message = error?.message || String(error);
      projectState = null;
      renderBuffer = null;
      selectedAgentTypeId = null;
      renderAgentTypes();
      if (meta) meta.textContent = 'Erreur de chargement';
      if (readout) readout.textContent = `Impossible de charger ${PROJECT_URL} ou ${SAVE_URL} : ${message}`;
      setStatus('Chargement impossible.');
      updateRunButton();
      updateSaveControls();
    }
  }

  function prepareProject(source) {
    const textures = Array.isArray(source?.textures)
      ? source.textures.map(prepareTexture)
      : [];
    const shaders = Array.isArray(source?.shaders)
      ? source.shaders.map((shader) => ({
        ...shader,
        bufferIds: Array.isArray(shader?.bufferIds) ? [...shader.bufferIds] : [],
      }))
      : [];
    const pipeline = Array.isArray(source?.pipeline)
      ? source.pipeline.map(preparePipelineStep)
      : [];

    return {
      ...source,
      agentTypes: [],
      textures,
      shaders,
      functions: Array.isArray(source?.functions) ? source.functions.map((fn) => ({ ...fn })) : [],
      parameters: Array.isArray(source?.parameters) ? source.parameters.map((param) => ({ ...param })) : [],
      pipeline,
      pipelineShaderChoiceId: source?.pipelineShaderChoiceId || shaders[0]?.id || null,
    };
  }

  function prepareAgentTypes(source) {
    const items = Array.isArray(source) ? source : DEFAULT_AGENT_TYPES;
    return items.map(prepareAgentType);
  }

  function prepareAgentType(source, index) {
    const fallback = DEFAULT_AGENT_TYPES[index % DEFAULT_AGENT_TYPES.length] || DEFAULT_AGENT_TYPES[0];
    const name = String(source?.name || fallback.name || `Type ${index + 1}`).trim() || `Type ${index + 1}`;
    return {
      ...source,
      id: String(source?.id || createAgentTypeId()),
      name,
      color: normalizeHexColor(source?.color, fallback.color),
    };
  }

  function prepareTexture(source) {
    const size = source?.size || {};
    const buffer = {
      ...source,
      type: normalizeTextureType(source?.type),
      fill: source?.fill === 'random' ? 'random' : 'empty',
      size: {
        x: clamp(parseInt(size.x, 10) || 1, 1, Number.MAX_SAFE_INTEGER),
        y: clamp(parseInt(size.y, 10) || 1, 1, Number.MAX_SAFE_INTEGER),
        z: clamp(parseInt(size.z, 10) || 1, 1, Number.MAX_SAFE_INTEGER),
      },
      sizeInput: {
        x: String(source?.sizeInput?.x ?? size.x ?? 1),
        y: String(source?.sizeInput?.y ?? size.y ?? 1),
        z: String(source?.sizeInput?.z ?? size.z ?? 1),
      },
      values: Array.isArray(source?.values) ? source.values : [],
    };

    if (buffer.fill === 'random') {
      regenerateValues(buffer);
    } else {
      ensureValueShape(buffer);
    }

    return buffer;
  }

  function preparePipelineStep(source) {
    const dispatch = source?.dispatch || {};
    return {
      ...source,
      activated: source?.activated !== false,
      dispatch: {
        x: clamp(parseInt(dispatch.x, 10) || 1, 1, 65535),
        y: clamp(parseInt(dispatch.y, 10) || 1, 1, 65535),
        z: clamp(parseInt(dispatch.z, 10) || 1, 1, 65535),
      },
      dispatchInput: {
        x: String(source?.dispatchInput?.x ?? dispatch.x ?? 1),
        y: String(source?.dispatchInput?.y ?? dispatch.y ?? 1),
        z: String(source?.dispatchInput?.z ?? dispatch.z ?? 1),
      },
    };
  }

  function findProjectBuffer(project, bufferName) {
    const textures = Array.isArray(project?.textures) ? project.textures : [];
    return textures.find((texture) => texture?.name === bufferName) || null;
  }

  function setupSaveControls() {
    if (loadSaveButton) {
      loadSaveButton.addEventListener('click', () => {
        void chooseAndLoadSaveFile();
      });
    }
    if (saveFileInput) {
      saveFileInput.addEventListener('change', () => {
        const file = saveFileInput.files?.[0];
        saveFileInput.value = '';
        if (file) void loadSaveFromFile(file);
      });
    }
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        void saveCurrentSimulation();
      });
    }
    updateSaveControls();
  }

  async function chooseAndLoadSaveFile() {
    if (!projectState) return;

    try {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'Simulation SMA',
              accept: {
                'application/json': ['.sma'],
              },
            },
          ],
        });
        const file = await handle.getFile();
        await loadSaveFromFile(file);
        return;
      }

      if (saveFileInput) {
        saveFileInput.click();
        return;
      }

      setStatus('Selection de fichier .sma indisponible.');
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('Chargement annule.');
        return;
      }
      setStatus(`Chargement du fichier .sma impossible : ${error?.message || error}`);
    }
  }

  async function loadSaveFromFile(file) {
    try {
      setStatus(`Chargement de ${file.name}...`);
      const source = JSON.parse(await file.text());
      applySaveState(prepareSaveState(source), file.name);
    } catch (error) {
      setStatus(`Chargement de ${file?.name || 'fichier .sma'} impossible : ${error?.message || error}`);
    }
  }

  function applySaveState(saveState, fileName = '') {
    projectState.agentTypes = saveState.agentTypes;
    selectedAgentTypeId = projectState.agentTypes[0]?.id || null;
    renderAgentTypes();

    if (fileName && projectNameInput) {
      projectNameInput.value = fileName.replace(/\.sma$/i, '');
    }

    setStatus(`${fileName || 'Fichier .sma'} charge.`);
  }

  async function loadSaveState(saveUrl) {
    const response = await fetch(saveUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const source = await response.json();
    return prepareSaveState(source);
  }

  function prepareSaveState(source) {
    const agentTypes = Array.isArray(source?.agentTypes)
      ? source.agentTypes
      : (Array.isArray(source) ? source : DEFAULT_AGENT_TYPES);

    return {
      version: Number.isFinite(Number(source?.version)) ? Number(source.version) : 1,
      agentTypes: prepareAgentTypes(agentTypes),
    };
  }

  async function saveCurrentSimulation() {
    if (!projectState) return;

    const data = `${JSON.stringify(buildSaveState(), null, 2)}\n`;
    const fileName = getSaveFileName();

    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'Simulation SMA',
              accept: {
                'application/json': ['.sma', '.json'],
              },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        setStatus(`${fileName} sauvegarde.`);
        return;
      }

      downloadSaveFile(data, fileName);
      setStatus(`${fileName} telecharge.`);
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('Sauvegarde annulee.');
        return;
      }
      setStatus(`Sauvegarde impossible : ${error?.message || error}`);
    }
  }

  function buildSaveState() {
    return {
      version: 1,
      agentTypes: getAgentTypes().map((agentType) => ({
        id: agentType.id,
        name: agentType.name,
        color: agentType.color,
      })),
    };
  }

  function getSaveFileName() {
    const rawName = (projectNameInput?.value || DEFAULT_SAVE_NAME).trim() || DEFAULT_SAVE_NAME;
    const safeName = rawName
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/[. ]+$/g, '')
      .trim() || DEFAULT_SAVE_NAME;

    return /\.sma$/i.test(safeName) ? safeName : `${safeName}.sma`;
  }

  function downloadSaveFile(data, fileName) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function updateSaveControls() {
    const hasProject = Boolean(projectState);
    if (loadSaveButton) loadSaveButton.disabled = !hasProject;
    if (saveButton) saveButton.disabled = !hasProject;
  }

  function setupAgentTypeControls() {
    if (addAgentTypeButton) {
      addAgentTypeButton.addEventListener('click', addAgentType);
    }
    if (removeAgentTypeButton) {
      removeAgentTypeButton.addEventListener('click', removeSelectedAgentType);
    }
    if (agentNameInput) {
      agentNameInput.addEventListener('input', updateSelectedAgentTypeName);
    }
    if (agentColorInput) {
      agentColorInput.addEventListener('input', updateSelectedAgentTypeColor);
    }
    updateAgentTypeControls();
  }

  function renderAgentTypes() {
    if (!agentTypesList) return;

    agentTypesList.replaceChildren();
    const agentTypes = getAgentTypes();

    if (!agentTypes.length) {
      selectedAgentTypeId = null;
      const item = document.createElement('li');
      item.className = 'is-empty';
      item.textContent = 'Aucun type';
      agentTypesList.appendChild(item);
      updateAgentTypeControls();
      return;
    }

    if (!agentTypes.some((agentType) => agentType.id === selectedAgentTypeId)) {
      selectedAgentTypeId = agentTypes[0].id;
    }

    agentTypes.forEach((agentType) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const swatch = document.createElement('span');
      const name = document.createElement('span');
      const isSelected = agentType.id === selectedAgentTypeId;

      button.type = 'button';
      button.className = `agent-type-button${isSelected ? ' is-selected' : ''}`;
      button.dataset.agentTypeId = agentType.id;
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      if (isSelected) button.setAttribute('aria-current', 'true');

      swatch.className = 'agent-type-swatch';
      swatch.style.backgroundColor = agentType.color;
      swatch.setAttribute('aria-hidden', 'true');

      name.className = 'agent-type-name';
      name.textContent = agentType.name;

      button.append(swatch, name);
      button.addEventListener('click', () => selectAgentType(agentType.id));
      item.appendChild(button);
      agentTypesList.appendChild(item);
    });

    updateAgentTypeControls();
  }

  function getAgentTypes() {
    return Array.isArray(projectState?.agentTypes) ? projectState.agentTypes : [];
  }

  function getMutableAgentTypes() {
    if (!projectState) return [];
    if (!Array.isArray(projectState.agentTypes)) projectState.agentTypes = [];
    return projectState.agentTypes;
  }

  function getSelectedAgentType() {
    return getAgentTypes().find((agentType) => agentType.id === selectedAgentTypeId) || null;
  }

  function selectAgentType(agentTypeId) {
    selectedAgentTypeId = agentTypeId;
    renderAgentTypes();
  }

  function addAgentType() {
    const agentTypes = getMutableAgentTypes();
    if (!projectState) return;

    const index = agentTypes.length;
    const agentType = {
      id: createAgentTypeId(),
      name: makeUniqueAgentTypeName(agentTypes),
      color: AGENT_TYPE_COLOR_SEQUENCE[index % AGENT_TYPE_COLOR_SEQUENCE.length],
    };

    agentTypes.push(agentType);
    selectedAgentTypeId = agentType.id;
    renderAgentTypes();
  }

  function removeSelectedAgentType() {
    const agentTypes = getMutableAgentTypes();
    const index = agentTypes.findIndex((agentType) => agentType.id === selectedAgentTypeId);
    if (index === -1) return;

    const agentType = agentTypes[index];
    const confirmed = window.confirm(`Supprimer le type d'agent "${agentType.name}" ?`);
    if (!confirmed) return;

    agentTypes.splice(index, 1);
    selectedAgentTypeId = agentTypes[Math.min(index, agentTypes.length - 1)]?.id || null;
    renderAgentTypes();
  }

  function updateSelectedAgentTypeName() {
    const agentType = getSelectedAgentType();
    if (!agentType || !agentNameInput) return;

    agentType.name = agentNameInput.value.trim() || 'Sans nom';
    renderAgentTypes();
  }

  function updateSelectedAgentTypeColor() {
    const agentType = getSelectedAgentType();
    if (!agentType || !agentColorInput) return;

    agentType.color = normalizeHexColor(agentColorInput.value, agentType.color);
    renderAgentTypes();
  }

  function updateAgentTypeControls() {
    const hasProject = Boolean(projectState);
    const selectedAgentType = getSelectedAgentType();

    if (addAgentTypeButton) addAgentTypeButton.disabled = !hasProject;
    if (removeAgentTypeButton) removeAgentTypeButton.disabled = !hasProject || !selectedAgentType;

    if (agentNameInput) {
      agentNameInput.disabled = !selectedAgentType;
      if (document.activeElement !== agentNameInput) {
        agentNameInput.value = selectedAgentType?.name || '';
      }
    }
    if (agentColorInput) {
      agentColorInput.disabled = !selectedAgentType;
      agentColorInput.value = selectedAgentType?.color || '#000000';
    }
  }

  function makeUniqueAgentTypeName(agentTypes) {
    let index = agentTypes.length + 1;
    let name = `Type ${index}`;

    while (agentTypes.some((agentType) => agentType.name === name)) {
      index += 1;
      name = `Type ${index}`;
    }

    return name;
  }

  function createAgentTypeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `agent-type-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function normalizeHexColor(value, fallback = FALLBACK_AGENT_TYPE_COLOR) {
    const text = String(value || '').trim();
    const fallbackText = /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : FALLBACK_AGENT_TYPE_COLOR;

    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
      return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
    }

    return fallbackText.toLowerCase();
  }

  function colorToBufferValue(color) {
    const normalized = normalizeHexColor(color);
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return (((0xff << 24) >>> 0) | (b << 16) | (g << 8) | r) >>> 0;
  }

  function formatUintHex(value) {
    return `0x${((Number(value) || 0) >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
  }

  function setupPanelClick() {
    if (!canvas) return;
    canvas.addEventListener('click', writeClickBufferValue);
  }

  function writeClickBufferValue(event) {
    const write = buildClickBufferWrite(event);
    if (!write) return;

    const runtimeState = runtime.state || {};
    if (runtimeState.isStepRunning) {
      pendingBufferWrites.push(write);
      setStatus(`Clic en attente - ${pendingBufferWrites.length} placement(s) apres le step.`);
      if (readout) {
        readout.textContent = `${write.agentTypeName} - ${CLICK_BUFFER_NAME}(${write.position.x}, ${write.position.y}, ${write.position.z}) sera place apres le step.`;
      }
      return;
    }

    applyClickBufferWrite(write);

    if ((runtimeState.stepCount || 0) === 0) {
      pendingBufferWrites.push(write);
      setStatus(`${write.agentTypeName} -> ${CLICK_BUFFER_NAME}[${write.index}] = ${formatUintHex(write.agentTypeValue)} - reapplique apres le premier step.`);
    }
  }

  function buildClickBufferWrite(event) {
    if (!projectState) {
      setStatus('Projet non charge.');
      return null;
    }

    const agentType = getSelectedAgentType();
    if (!agentType) {
      setStatus('Aucun type d agent selectionne.');
      return null;
    }

    const buffer = findProjectBuffer(projectState, CLICK_BUFFER_NAME);
    const positionBuffer = findProjectBuffer(projectState, CLICK_POSITION_BUFFER_NAME);
    if (!buffer) {
      setStatus(`Buffer "${CLICK_BUFFER_NAME}" introuvable.`);
      return null;
    }
    if (!positionBuffer) {
      setStatus(`Buffer "${CLICK_POSITION_BUFFER_NAME}" introuvable.`);
      return null;
    }

    const position = getClickedBufferPosition(event, buffer);
    if (!position) {
      setStatus('Cliquez dans la zone du buffer Render.');
      return null;
    }

    const index = getFlatBufferIndex(position, buffer.size);
    if (index === null) {
      setStatus('Index de clic hors limites.');
      return null;
    }

    const positionIndex = getFlatBufferIndex(position, positionBuffer.size);
    if (positionIndex === null) {
      setStatus(`Position de clic hors limites pour ${CLICK_POSITION_BUFFER_NAME}.`);
      return null;
    }

    return {
      position,
      index,
      agentTypeName: agentType.name,
      agentTypeValue: colorToBufferValue(agentType.color),
    };
  }

  function applyClickBufferWrite(write, options = {}) {
    const buffer = findProjectBuffer(projectState, CLICK_BUFFER_NAME);
    const positionBuffer = findProjectBuffer(projectState, CLICK_POSITION_BUFFER_NAME);
    if (!buffer || !positionBuffer || !write?.position) return false;

    const { position, index } = write;
    const agentTypeValue = Number.isFinite(write.agentTypeValue)
      ? write.agentTypeValue
      : colorToBufferValue(FALLBACK_AGENT_TYPE_COLOR);
    const agentTypeName = write.agentTypeName || 'Agent';
    const agentTypeHex = formatUintHex(agentTypeValue);

    setBufferValueAtPosition(buffer, position, agentTypeValue);
    setBufferValueAtPosition(positionBuffer, position, [
      position.x + 0.85,
      position.y + 0.5,
      0,
    ]);
    runtime.markBindingsDirty();

    if (!options.silent) {
      setStatus(`${agentTypeName} -> ${CLICK_BUFFER_NAME}[${index}] = ${agentTypeHex}, ${CLICK_POSITION_BUFFER_NAME}[${index}] = vec3(${position.x + 0.85}, ${position.y + 0.5}, 0)`);
    }
    if (!options.silent && readout) {
      readout.textContent = `${agentTypeName} - ${CLICK_BUFFER_NAME}(${position.x}, ${position.y}, ${position.z}) = ${agentTypeHex} ; ${CLICK_POSITION_BUFFER_NAME} = (${position.x + 0.85}, ${position.y + 0.5}, 0)`;
    }
    return true;
  }

  function flushPendingBufferWrites() {
    if (!pendingBufferWrites.length) return 0;

    const writes = pendingBufferWrites;
    pendingBufferWrites = [];

    let applied = 0;
    let lastWrite = null;
    writes.forEach((write) => {
      if (applyClickBufferWrite(write, { silent: true })) {
        applied += 1;
        lastWrite = write;
      }
    });

    if (lastWrite && readout) {
      const { position } = lastWrite;
      readout.textContent = `${applied} placement(s) applique(s). Dernier: ${lastWrite.agentTypeName || 'Agent'} - ${CLICK_BUFFER_NAME}(${position.x}, ${position.y}, ${position.z}) = ${formatUintHex(lastWrite.agentTypeValue)}`;
    }

    return applied;
  }

  function getClickedBufferPosition(event, targetBuffer) {
    if (!renderBuffer || !targetBuffer) return null;
    const rect = canvas.getBoundingClientRect();
    const canvasX = Math.floor(((event.clientX - rect.left) / rect.width) * renderBuffer.size.x);
    const canvasY = Math.floor(((event.clientY - rect.top) / rect.height) * renderBuffer.size.y);

    if (canvasX < 0 || canvasX >= renderBuffer.size.x || canvasY < 0 || canvasY >= renderBuffer.size.y) {
      return null;
    }

    const renderY = renderBuffer.size.y - canvasY - 1;
    return {
      x: clamp(Math.floor((canvasX / renderBuffer.size.x) * targetBuffer.size.x), 0, targetBuffer.size.x - 1),
      y: clamp(Math.floor((renderY / renderBuffer.size.y) * targetBuffer.size.y), 0, targetBuffer.size.y - 1),
      z: clamp(displayedSlice, 0, targetBuffer.size.z - 1),
    };
  }

  function getFlatBufferIndex(position, size) {
    if (!size) return null;
    if (position.x < 0 || position.x >= size.x) return null;
    if (position.y < 0 || position.y >= size.y) return null;
    if (position.z < 0 || position.z >= size.z) return null;

    return position.z * size.x * size.y + position.y * size.x + position.x;
  }

  function setBufferValueAtPosition(buffer, position, value) {
    ensureValueShape(buffer);
    buffer.values[position.z][position.y][position.x] = value;
  }

  async function startRun() {
    if (!projectState || !renderBuffer || isCompiling) return;
    if (!navigator?.gpu) {
      setStatus('WebGPU non supporte dans ce navigateur.');
      return;
    }

    isCompiling = true;
    updateRunButton();
    setStatus('Compilation WebGPU...');

    try {
      const result = await runtime.compileProject(projectState);
      if (!result?.ok) {
        setStatus('Compilation echouee.');
        return;
      }

      isRunning = true;
      setStatus('Execution en cours...');
      updateRunButton();
      scheduleNextStep();
    } catch (error) {
      setStatus(`Echec WebGPU : ${error?.message || error}`);
    } finally {
      isCompiling = false;
      updateRunButton();
    }
  }

  function stopRun() {
    isRunning = false;
    if (stepFrameId) {
      cancelAnimationFrame(stepFrameId);
      stepFrameId = 0;
    }
    setStatus('Execution arretee.');
    updateRunButton();
  }

  function scheduleNextStep() {
    if (!isRunning || stepFrameId) return;
    stepFrameId = requestAnimationFrame(() => {
      stepFrameId = 0;
      runSimulationStep();
    });
  }

  function runSimulationStep() {
    if (!isRunning || !projectState) return;

    const started = runtime.step(projectState, {
      shouldReadback: true,
      onComplete({ stepCount }) {
        const appliedWrites = flushPendingBufferWrites();
        renderBuffer = findProjectBuffer(projectState, TARGET_BUFFER_NAME);
        if (renderBuffer) {
          render2DBuffer(renderBuffer, displayedSlice);
        }
        setStepLabel(stepCount);
        if (isRunning) {
          const writeText = appliedWrites ? ` - ${appliedWrites} placement(s) applique(s)` : '';
          setStatus(`Execution en cours - step ${stepCount}${writeText}`);
          scheduleNextStep();
        } else if (appliedWrites) {
          setStatus(`${appliedWrites} placement(s) applique(s) apres le step.`);
        }
      },
    });

    if (!started) {
      isRunning = false;
      setStatus('Step impossible. Verifiez la compilation WebGPU.');
      updateRunButton();
    }
  }

  function setupCanvasInteractions() {
    canvas.addEventListener('pointermove', (event) => {
      if (!renderBuffer) return;
      const size = renderBuffer.size;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * size.x);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * size.y);

      if (x < 0 || x >= size.x || y < 0 || y >= size.y) return;

      const bufferY = size.y - y - 1;
      const z = clamp(displayedSlice, 0, size.z - 1);
      const value = renderBuffer.values[z]?.[bufferY]?.[x];
      runtime.setMousePosition(x, bufferY, z);

      if (readout) {
        readout.textContent = `Val (${x}, ${bufferY}, ${z}) : ${formatBufferValue(value, renderBuffer.type)}`;
      }
    });

    canvas.addEventListener('pointerleave', () => {
      if (readout) readout.textContent = 'Survolez le buffer pour lire une valeur.';
    });
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

  function valueToRGBA(value, type) {
    const normalized = normalizeTextureType(type);

    if (normalized === 'vec3f') {
      const [r, g, b] = fractionalVec3ToRGB(value);
      return [r, g, b, 255];
    }

    if (normalized === 'vec4f') {
      const v = normalizeVec4Value(value);
      return [
        Math.round(getFraction01(v[0]) * 255),
        Math.round(getFraction01(v[1]) * 255),
        Math.round(getFraction01(v[2]) * 255),
        Math.round(getFraction01(v[3]) * 255),
      ];
    }

    if (normalized === 'float') {
      const hue = clamp(getFraction01(value), 0, 1) * 300;
      const c = 1;
      const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
      let r = 0;
      let g = 0;
      let b = 0;

      if (hue < 60) {
        r = c;
        g = x;
      } else if (hue < 120) {
        r = x;
        g = c;
      } else if (hue < 180) {
        g = c;
        b = x;
      } else if (hue < 240) {
        g = x;
        b = c;
      } else {
        r = x;
        b = c;
      }

      return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255),
        255,
      ];
    }

    const v = (Number(value) || 0) >>> 0;
    return [
      v & 0xff,
      (v >> 8) & 0xff,
      (v >> 16) & 0xff,
      (v >> 24) & 0xff,
    ];
  }

  function formatBufferValue(value, type) {
    if (value === null || value === undefined) return '';

    const normalized = normalizeTextureType(type);
    if (normalized === 'uint') return String((Number(value) || 0) >>> 0);
    if (normalized === 'int') return String(Number(value) || 0);
    if (normalized === 'float') {
      const n = Number(value);
      return Number.isFinite(n) ? String(n) : '0';
    }
    if (normalized === 'vec3f') {
      const v = normalizeVec3Value(value);
      return `(${v[0]}, ${v[1]}, ${v[2]})`;
    }
    if (normalized === 'vec4f') {
      const v = normalizeVec4Value(value);
      return `(${v[0]}, ${v[1]}, ${v[2]}, ${v[3]})`;
    }

    return String(value);
  }

  function render2DBuffer(buffer, sliceIndex) {
    const size = buffer.size;
    const z = clamp(sliceIndex, 0, size.z - 1);
    const layer = buffer.values[z] || [];

    displayedSlice = z;
    canvas.width = size.x;
    canvas.height = size.y;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(size.x, size.y);
    let ptr = 0;

    for (let y = size.y - 1; y >= 0; y -= 1) {
      for (let x = 0; x < size.x; x += 1) {
        const value = layer[y]?.[x];
        const [r, g, b, a] = valueToRGBA(value, buffer.type);
        imageData.data[ptr] = r;
        imageData.data[ptr + 1] = g;
        imageData.data[ptr + 2] = b;
        imageData.data[ptr + 3] = a ?? 255;
        ptr += 4;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    if (meta) {
      meta.textContent = `${buffer.name} - ${size.x} x ${size.y} x ${size.z} - ${buffer.type}`;
    }
  }

  function setStepLabel(stepCount) {
    if (stepLabel) stepLabel.textContent = `step = ${stepCount || 0}`;
  }

  function setStatus(message) {
    if (runStatus) runStatus.textContent = message;
  }

  function updateRunButton() {
    if (!runButton) return;
    runButton.disabled = isCompiling || !projectState || !renderBuffer;
    runButton.textContent = isRunning ? 'stop' : (isCompiling ? 'compile...' : 'run');
  }
})();
