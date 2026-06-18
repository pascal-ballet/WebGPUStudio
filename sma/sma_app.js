(() => {
  'use strict';

  const PROJECT_URL = 'SimBugs.wgstudio';
  const TARGET_BUFFER_NAME = 'Render';
  const CLICK_BUFFER_NAME = 'Agent_0';
  const CLICK_BUFFER_VALUE = 0xffff44ff >>> 0;

  const StudioCore = window.WebGPUStudio;
  const panel = document.querySelector('.panel');
  const canvas = document.getElementById('bufferCanvas');
  const meta = document.getElementById('bufferMeta');
  const readout = document.getElementById('bufferReadout');
  const runStatus = document.getElementById('runStatus');
  const runButton = document.getElementById('runButton');
  const stepLabel = document.getElementById('stepLabel');

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
      renderBuffer = findProjectBuffer(projectState, bufferName);
      if (!renderBuffer) {
        throw new Error(`Buffer "${bufferName}" introuvable`);
      }

      render2DBuffer(renderBuffer, displayedSlice);
      if (readout) readout.textContent = 'Survolez le buffer pour lire une valeur.';
      setStepLabel(0);
      setStatus('Projet charge. Cliquez sur run.');
      updateRunButton();
    } catch (error) {
      const message = error?.message || String(error);
      projectState = null;
      renderBuffer = null;
      if (meta) meta.textContent = 'Erreur de chargement';
      if (readout) readout.textContent = `Impossible de charger ${PROJECT_URL} : ${message}`;
      setStatus('Chargement impossible.');
      updateRunButton();
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
      textures,
      shaders,
      functions: Array.isArray(source?.functions) ? source.functions.map((fn) => ({ ...fn })) : [],
      parameters: Array.isArray(source?.parameters) ? source.parameters.map((param) => ({ ...param })) : [],
      pipeline,
      pipelineShaderChoiceId: source?.pipelineShaderChoiceId || shaders[0]?.id || null,
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

  function setupPanelClick() {
    if (!panel) return;
    panel.addEventListener('click', (event) => {
      if (event.target?.closest?.('button')) return;
      writeClickBufferValue(event);
    });
  }

  function writeClickBufferValue(event) {
    if (!projectState) {
      setStatus('Projet non charge.');
      return;
    }

    const buffer = findProjectBuffer(projectState, CLICK_BUFFER_NAME);
    if (!buffer) {
      setStatus(`Buffer "${CLICK_BUFFER_NAME}" introuvable.`);
      return;
    }

    const position = getClickedBufferPosition(event, buffer);
    if (!position) {
      setStatus('Cliquez dans la zone du buffer Render.');
      return;
    }

    const index = getFlatBufferIndex(position, buffer.size);
    if (index === null) {
      setStatus('Index de clic hors limites.');
      return;
    }

    setBufferValueAtPosition(buffer, position, CLICK_BUFFER_VALUE);
    runtime.markBindingsDirty();
    setStatus(`${CLICK_BUFFER_NAME}[${index}] = 0xFFFF44FF`);
    if (readout) {
      readout.textContent = `${CLICK_BUFFER_NAME}(${position.x}, ${position.y}, ${position.z}) = 0xFFFF44FF`;
    }
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
        renderBuffer = findProjectBuffer(projectState, TARGET_BUFFER_NAME);
        if (renderBuffer) {
          render2DBuffer(renderBuffer, displayedSlice);
        }
        setStepLabel(stepCount);
        if (isRunning) {
          setStatus(`Execution en cours - step ${stepCount}`);
          scheduleNextStep();
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
