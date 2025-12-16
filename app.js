document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const textureList = document.getElementById('textureList');
  const textureForm = document.getElementById('textureForm');
  const addBtn = document.getElementById('addTextureBtn');
  const removeBtn = document.getElementById('removeTextureBtn');
  const regenBtn = document.getElementById('regenValuesBtn');
  const preview2D = document.getElementById('preview2D');
  const preview3D = document.getElementById('preview3D');
  const zSlice = document.getElementById('zSlice');
  const sliceLabel = document.getElementById('sliceLabel');
  const toggleButtons = document.querySelectorAll('.toggle');

  const shaderList = document.getElementById('shaderList');
  const shaderForm = document.getElementById('shaderForm');
  const shaderEditor = document.getElementById('shaderEditor');
  const shaderLines = document.getElementById('shaderLines');
  const addShaderBtn = document.getElementById('addShaderBtn');
  const removeShaderBtn = document.getElementById('removeShaderBtn');
  const duplicateShaderBtn = document.getElementById('duplicateShaderBtn');
  const pipelineList = document.getElementById('pipelineList');
  const pipelineTimeline = document.getElementById('pipelineTimeline');
  const addPipelineBtn = document.getElementById('addPipelineBtn');
  const removePipelineBtn = document.getElementById('removePipelineBtn');
  const moveUpBtn = document.getElementById('moveUpBtn');
  const moveDownBtn = document.getElementById('moveDownBtn');
  const pipelineForm = document.getElementById('pipelineForm');
  const pipelineShaderSelect = document.getElementById('pipelineShaderSelect');
  const functionList = document.getElementById('functionList');
  const addFunctionBtn = document.getElementById('addFunctionBtn');
  const removeFunctionBtn = document.getElementById('removeFunctionBtn');
  const duplicateFunctionBtn = document.getElementById('duplicateFunctionBtn');
  const functionForm = document.getElementById('functionForm');
  const functionEditor = document.getElementById('functionEditor');
  const functionLines = document.getElementById('functionLines');
  const statLines = document.getElementById('statLines');
  const statChars = document.getElementById('statChars');
  const consoleArea = document.getElementById('consoleArea');
  const clearConsoleBtn = document.getElementById('clearConsoleBtn');

  const compileBtn  = document.getElementById('compileBtn');
  const stepBtn     = document.getElementById('stepBtn');
  const runBtn      = document.getElementById('runBtn');
  const pauseBtn    = document.getElementById('pauseBtn');
  const stopBtn     = document.getElementById('stopBtn');

  // Vérifications simples pour s'assurer que les boutons sont bien trouvés
  if (!compileBtn) console.warn('compileBtn introuvable dans le DOM'); else console.log('compileBtn détecté');
  if (!runBtn) console.warn('runBtn introuvable dans le DOM'); else console.log('runBtn détecté');
  if (!pauseBtn) console.warn('pauseBtn introuvable dans le DOM'); else console.log('pauseBtn détecté');
  if (!stepBtn) console.warn('stepBtn introuvable dans le DOM'); else console.log('stepBtn détecté');
  if (!stopBtn) console.warn('stopBtn introuvable dans le DOM'); else console.log('stopBtn détecté');
    
  let currentDevice = null;
  let computePipelines = [];
  let bindingBuffers = new Map();
  let lastCompiledWGSL = '';

  let isCompiled = false;
  let isRunning = false;
  let isPaused = false;
  let timerId = null;
  updateButtons()

  let textures = [];
  let selectedTextureId = null;
  let previewMode = '2d';
  let shaders = [];
  let selectedShaderId = null;
  let pipeline = [];
  let selectedStepId = null;
  let pipelineShaderChoiceId = null;
  let functionsStore = [];
  let selectedFunctionId = null;
  let consoleMessages = [];

  // Tabs switching
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // Toggle 2D / 3D preview
  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      previewMode = btn.dataset.mode;
      renderPreview();
    });
  });

  clearConsoleBtn.addEventListener('click', () => {
    consoleMessages = [];
    renderConsole();
  });

  // ********************
  // Toolbar
  // ********************

  compileBtn.addEventListener('click', async () => { // COMPILE BUTTON
    if (compileBtn.style.color === 'grey') return;
    isCompiled = true; updateButtons();
    const wgsl = buildCombinedWGSL();
    lastCompiledWGSL = wgsl;
    alert(wgsl);
    const errors = validateWGSL(wgsl);
    if (errors.length === 0) {
      logConsole('Compilation statique : OK.', 'compile');
      isCompiled = true; updateButtons();
    } else {
      errors.forEach((err) => logConsole(err, 'compile'));
      isCompiled = false; updateButtons();
      return;
    }
    const result = await compileWGSL(wgsl);
    if (result && result.module) {
      buildComputePipelines(result.device, result.module);
    }
  });

  stepBtn.addEventListener('click', async () => { // STEP BUTTON
    if (stepBtn.style.color === 'grey') return;
    await playStep();
    isRunning = true;
    isPaused = true;
    updateButtons();
  });

  runBtn.addEventListener('click', async () => { // RUN BUTTON
    if (runBtn.style.color === 'grey') return;
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

  pauseBtn.addEventListener('click', () => { // PAUSE BUTTON
    if (pauseBtn.style.color === 'grey') return;
    console.log('pause click');
    if (!isRunning) {
      logConsole('Rien à mettre en pause (pas de run en cours).', 'pause');
      return;
    }
    if (isPaused) {
      logConsole('Déjà en pause. Cliquez sur Run pour reprendre.', 'pause');
      return;
    }
    isPaused = true; updateButtons();
    stopTimer();
    logConsole('Exécution en pause. Cliquez sur Run pour reprendre.', 'pause');
  });

  stopBtn.addEventListener('click', () => { // STOP BUTTON
    if (stopBtn.style.color === 'grey') return;
    isRunning  = false;
    isPaused   = false;
    isCompiled = false;
    stopTimer();
    updateButtons();
    resetGPUState();
    logConsole('État GPU réinitialisé. Recompilez pour repartir de zéro.', 'stop');
  });

  // **********************
  // Simulation Timer
  // **********************

  // lancer le timer
  function startTimer() {
    if (timerId === null) {
      timerId = setInterval(play, 500);
    }
  }

  // stopper le timer
  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function play() {
    playStep();
  }

  // ********************
  // Toolbar Update
  // ********************

  async function updateButtons() {
    if (isCompiled == true) { // COMPILED **********
      compileBtn.style.color = 'grey';
      if (isRunning == true) { // RUNNING >>>>>>
        if (isPaused == true) { // PAUSED     :::
          stepBtn.style.color    = 'white';   
          runBtn.style.color     = 'white';       
          pauseBtn.style.color   = 'grey';
          stopBtn.style.color    = 'red';          
        } else {                // NOT PAUSED OOO
          stepBtn.style.color    = 'grey';   
          runBtn.style.color     = 'grey';       
          pauseBtn.style.color   = 'white';
          stopBtn.style.color    = 'red';
        }
      } else {                 // NOT RUNNING |||
        if (isPaused == true) { // PAUSED     :::
          stepBtn.style.color     = 'white';   
          runBtn.style.color      = 'white';
          pauseBtn.style.color    = 'grey';
          stopBtn.style.color     = 'red';
        } else {                 // NOT PAUSED OOO
            stepBtn.style.color    = 'white';   
            runBtn.style.color     = 'white';
            pauseBtn.style.color   = 'grey';
            stopBtn.style.color    = 'red';
        }
      }
    } else {                   // NOT COMPILED ********
      compileBtn.style.color = 'white';
      stepBtn.style.color    = 'grey';
      runBtn.style.color     = 'grey';
      pauseBtn.style.color   = 'grey';
      stopBtn.style.color    = 'grey';
    }

  }

  // ***************************************************************************************
  async function playStep() {
    if (!currentDevice) {
      logConsole('Aucun device WebGPU initialisé. Compile d’abord.', 'run');
      return;
    }
    if (!computePipelines.length) {
      logConsole('Aucun pipeline compute disponible. Compile d’abord.', 'run');
      return;
    }
    try {
      const { entries, readTasks } = prepareBindingBuffers(currentDevice, lastCompiledWGSL);
      if (!entries.length) {
        logConsole('Aucune ressource à binder. Vérifiez le WGSL.', 'run');
        return;
      }
      const commandEncoder = currentDevice.createCommandEncoder();
      const pass = commandEncoder.beginComputePass();
      const bindGroupLayout = computePipelines[0]?.pipeline.getBindGroupLayout(0);
      const bindGroup = bindGroupLayout
        ? currentDevice.createBindGroup({
            layout: bindGroupLayout,
            entries,
          })
        : null;

      pipeline.forEach((step, idx) => {
        const pipeEntry = computePipelines.find((p) => p.stepId === step.id);
        if (!pipeEntry) {
          logConsole(`Étape ${idx + 1}: pipeline introuvable.`, 'run');
          return;
        }
        pass.setPipeline(pipeEntry.pipeline);
        if (bindGroup) pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(
          step.global?.x || 1,
          step.global?.y || 1,
          step.global?.z || 1,
        );
        /// logConsole(`Dispatch étape ${idx + 1} (${step.name || 'étape'})`, 'run');
      });
      pass.end();
      readTasks.forEach((task) => {
        commandEncoder.copyBufferToBuffer(task.src, 0, task.dst, 0, task.size);
      });
      currentDevice.queue.submit([commandEncoder.finish()]);
      await currentDevice.queue.onSubmittedWorkDone();
      /// logConsole('Execution pipeline soumise au GPU.', 'run');

      if (readTasks.length) {
        await Promise.all(
          readTasks.map(async (task) => {
            await task.dst.mapAsync(GPUMapMode.READ);
            const copy = task.tex.type === 'float'
              ? new Float32Array(task.dst.getMappedRange().slice(0))
              : new Int32Array(task.dst.getMappedRange().slice(0));
            task.dst.unmap();
            updateTextureValuesFromFlat(task.tex, copy);
          }),
        );
        renderPreview();
        renderTextureList();
        /// logConsole('Textures synchronisées depuis le GPU.', 'run');
      }
    } catch (err) {
      logConsole(`Échec exécution pipeline: ${err.message || err}`, 'run');
    }
  }
  // ***************************************************************************************

  // Pipeline events
  addPipelineBtn.addEventListener('click', () => {
    if (!shaders.length) return;
    const shaderId = pipelineShaderChoiceId || shaders[0].id;
    const step = buildPipelineStep(shaderId);
    pipeline.push(step);
    selectedStepId = step.id;
    renderPipelineViews();
  });

  removePipelineBtn.addEventListener('click', () => {
    if (!selectedStepId) return;
    pipeline = pipeline.filter((s) => s.id !== selectedStepId);
    selectedStepId = pipeline[0]?.id || null;
    renderPipelineViews();
  });

  moveUpBtn.addEventListener('click', () => moveStep(-1));
  moveDownBtn.addEventListener('click', () => moveStep(1));

  pipelineForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const step = pipeline.find((s) => s.id === selectedStepId);
    if (!step) return;
    const formData = new FormData(pipelineForm);
    step.name = (formData.get('stepName') || step.name).trim() || step.name;
    step.shaderId = formData.get('shaderRef') || step.shaderId;
    step.global = {
      x: clamp(parseInt(formData.get('pGlobalX'), 10) || step.global?.x || 1, 1, 65535),
      y: clamp(parseInt(formData.get('pGlobalY'), 10) || step.global?.y || 1, 1, 65535),
      z: clamp(parseInt(formData.get('pGlobalZ'), 10) || step.global?.z || 1, 1, 65535),
    };
    renderPipelineViews();
  });

  // Functions events
  addFunctionBtn.addEventListener('click', () => {
    const fn = buildDefaultFunction();
    functionsStore.push(fn);
    selectedFunctionId = fn.id;
    renderFunctionViews();
  });

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
  });

  // Compute shader events
  addShaderBtn.addEventListener('click', () => {
    const shader = buildDefaultShader();
    shaders.push(shader);
    selectedShaderId = shader.id;
    renderShaderList();
    renderShaderForm(shader);
    renderShaderEditor(shader);
    pipeline.forEach((step) => {
      if (!step.global) {
        step.global = { x: 32, y: 32, z: 1 };
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
    pipeline.forEach((step) => {
      if (step.shaderId === removedId) step.shaderId = null;
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
    syncShaderEntryName(copy);
    shaders.push(copy);
    selectedShaderId = copy.id;
    renderShaderList();
    renderShaderForm(copy);
    renderShaderEditor(copy);
    renderPipelineViews();
  });

  addBtn.addEventListener('click', () => {
    const newTexture = buildTextureFromForm();
    textures.push(newTexture);
    selectedTextureId = newTexture.id;
    renderTextureList();
    renderForm(newTexture);
    renderPreview();
  });

  removeBtn.addEventListener('click', () => {
    if (!selectedTextureId) return;
    textures = textures.filter((t) => t.id !== selectedTextureId);
    selectedTextureId = textures[0]?.id || null;
    renderTextureList();
    if (selectedTextureId) {
      const tex = textures.find((t) => t.id === selectedTextureId);
      renderForm(tex);
    }
    renderPreview();
  });

  regenBtn.addEventListener('click', () => {
    if (!selectedTextureId) return;
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (!tex) return;
    regenerateValues(tex);
    renderPreview();
  });

  textureForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedTextureId) {
      const newTexture = buildTextureFromForm();
      textures.push(newTexture);
      selectedTextureId = newTexture.id;
    } else {
      const tex = textures.find((t) => t.id === selectedTextureId);
      if (tex) {
        applyFormToTexture(tex);
      }
    }
    renderTextureList();
    renderPreview();
  });

  zSlice.addEventListener('input', () => {
    sliceLabel.textContent = `Z = ${zSlice.value}`;
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
  });

  function buildTextureFromForm() {
    const formData = new FormData(textureForm);
    const size = {
      x: clamp(parseInt(formData.get('sizeX'), 10) || 32, 1, 64),
      y: clamp(parseInt(formData.get('sizeY'), 10) || 32, 1, 64),
      z: clamp(parseInt(formData.get('sizeZ'), 10) || 1, 1, 16),
    };
    const rawName = (formData.get('name') || '').trim().replace(/\s+/g, '');
    const baseName = rawName || nextTextureDefaultName();
    const tex = {
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `tex-${Date.now()}`,
      name: uniqueTextureName(baseName),
      type: formData.get('type') || 'int',
      fill: formData.get('fill') || 'empty',
      size,
      values: [],
    };
    regenerateValues(tex);
    updateSliceControl(tex);
    return tex;
  }

  function applyFormToTexture(tex) {
    const formData = new FormData(textureForm);
    const proposedName = (formData.get('name') || tex.name).trim().replace(/\s+/g, '');
    const isDuplicate = textures.some(
      (t) => t.id !== tex.id && t.name.toLowerCase() === proposedName.toLowerCase(),
    );
    if (proposedName && !isDuplicate) {
      tex.name = proposedName;
    }
    const newSize = {
      x: clamp(parseInt(formData.get('sizeX'), 10) || tex.size.x, 1, 32),
      y: clamp(parseInt(formData.get('sizeY'), 10) || tex.size.y, 1, 32),
      z: clamp(parseInt(formData.get('sizeZ'), 10) || tex.size.z, 1, 16),
    };
    const sizeChanged = newSize.x !== tex.size.x || newSize.y !== tex.size.y || newSize.z !== tex.size.z;
    tex.size = newSize;
    tex.type = formData.get('type') || tex.type;
    tex.fill = formData.get('fill') || tex.fill;
    if (sizeChanged || tex.fill === 'random') {
      regenerateValues(tex);
    } else if (tex.fill === 'empty') {
      ensureValueShape(tex);
    }
    updateSliceControl(tex);
    renderForm(tex);
  }

  function regenerateValues(tex) {
    const { x, y, z } = tex.size;
    tex.values = [];
    for (let k = 0; k < z; k += 1) {
      const layer = [];
      for (let j = 0; j < y; j += 1) {
        const row = [];
        for (let i = 0; i < x; i += 1) {
          row.push(generateValue(tex));
        }
        layer.push(row);
      }
      tex.values.push(layer);
    }
  }

  function ensureValueShape(tex) {
    const { x, y, z } = tex.size;
    if (!tex.values) tex.values = [];
    tex.values.length = z;
    for (let k = 0; k < z; k += 1) {
      if (!tex.values[k]) tex.values[k] = [];
      tex.values[k].length = y;
      for (let j = 0; j < y; j += 1) {
        if (!tex.values[k][j]) tex.values[k][j] = [];
        tex.values[k][j].length = x;
        for (let i = 0; i < x; i += 1) {
          if (tex.values[k][j][i] === undefined) {
            tex.values[k][j][i] = tex.fill === 'empty' ? 0 : generateValue(tex);
          }
        }
      }
    }
  }

  function generateValue(tex) {
    if (tex.fill === 'empty') return 0;
    if (tex.type === 'float') {
      const val = Math.random();
      return Number(val.toFixed(3));
    }
    return Math.floor(Math.random() * 256);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

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
    const pattern = /^texture\s*?(\d+)$/i;
    let maxIdx = 0;
    textures.forEach((t) => {
      const match = t.name.match(pattern);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!Number.isNaN(n)) maxIdx = Math.max(maxIdx, n);
      }
    });
    return `texture${maxIdx + 1}`;
  }

  function buildPipelineStep(shaderIdParam) {
    const idx = pipeline.length + 1;
    const shaderId = shaderIdParam || shaders[0]?.id || null;
    return {
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `step-${Date.now()}`,
      name: `Étape ${idx}`,
      shaderId,
      global: { x: 32, y: 32, z: 1 },
    };
  }

  function renderPipelineShaderList() {
    pipelineList.innerHTML = '';
    addPipelineBtn.disabled = !shaders.length;
    if (!shaders.length) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = 'Ajoutez un compute shader pour le pipeline.';
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
    pipelineTimeline.innerHTML = '<p class="eyebrow">Aucune étape dans le pipeline.</p>';
    return;
  }
  pipeline.forEach((step, index) => {
      const block = document.createElement('div');
      block.className = 'timeline-step';
        block.draggable = true;
      if (step.id === selectedStepId) block.classList.add('active');
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = index + 1;
      const content = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = step.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${pipelineShaderLabel(step.shaderId)} · Global ${step.global?.x ?? 1}×${step.global?.y ?? 1}×${step.global?.z ?? 1}`;
      content.appendChild(title);
      content.appendChild(meta);
      block.appendChild(badge);
      block.appendChild(content);
      block.addEventListener('click', () => {
        selectedStepId = step.id;
        renderPipelineViews();
      });
      pipelineTimeline.appendChild(block);
    });
  }

  function renderPipelineForm(step) {
    const inputs = pipelineForm.querySelectorAll('input, select, button[type="submit"]');
    if (!step) {
      inputs.forEach((el) => { el.disabled = true; });
      pipelineForm.stepName.value = '';
      pipelineShaderSelect.innerHTML = '';
      return;
    }
    inputs.forEach((el) => { el.disabled = false; });
    pipelineForm.stepName.value = step.name;
    pipelineShaderSelect.innerHTML = '';
    if (!shaders.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Aucun compute shader disponible';
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
      pipelineShaderSelect.value = step.shaderId || shaders[0].id;
    }
    pipelineForm.pGlobalX.value = step.global?.x ?? 64;
    pipelineForm.pGlobalY.value = step.global?.y ?? 64;
    pipelineForm.pGlobalZ.value = step.global?.z ?? 1;
  }

  function renderPipelineViews() {
    const current = pipeline.find((s) => s.id === selectedStepId) || pipeline[0];
    selectedStepId = current ? current.id : null;
    renderPipelineShaderList();
    renderPipelineTimeline();
    renderPipelineForm(current || null);
    const idx = pipeline.findIndex((s) => s.id === selectedStepId);
    moveUpBtn.disabled = idx <= 0;
    moveDownBtn.disabled = idx === -1 || idx >= pipeline.length - 1;
    removePipelineBtn.disabled = !selectedStepId;
  }

  function pipelineShaderLabel(shaderId) {
    const shader = shaders.find((s) => s.id === shaderId);
    return shader ? `Shader : ${shader.name}` : 'Shader manquant';
  }

  function moveStep(delta) {
    const idx = pipeline.findIndex((s) => s.id === selectedStepId);
    if (idx === -1) return;
    const newIndex = idx + delta;
    if (newIndex < 0 || newIndex >= pipeline.length) return;
    const [step] = pipeline.splice(idx, 1);
    pipeline.splice(newIndex, 0, step);
    selectedStepId = step.id;
    renderPipelineViews();
  }

  function buildDefaultFunction() {
    const idx = functionsStore.length + 1;
    return {
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `fn-${Date.now()}`,
      name: `Fonction ${idx}`,
      code: defaultFunctionCode(),
    };
  }

  function defaultFunctionCode() {
    return [
      'fn clamp01(value : f32) -> f32 {',
      '    return max(0.0, min(1.0, value));',
      '}',
      '',
      'fn lerp(a : f32, b : f32, t : f32) -> f32 {',
      '    return a + (b - a) * clamp01(t);',
      '}',
    ].join('\n');
  }

  function renderFunctionList() {
    functionList.innerHTML = '';
    if (!functionsStore.length) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = 'Aucune fonction. Ajoutez-en une.';
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
      return;
    }
    functionEditor.disabled = false;
    functionEditor.value = fn.code;
    updateFunctionStats(fn.code);
  }

  function renderFunctionViews() {
    const fn = functionsStore.find((f) => f.id === selectedFunctionId) || functionsStore[0];
    selectedFunctionId = fn ? fn.id : null;
    renderFunctionList();
    renderFunctionForm(fn || null);
    renderFunctionEditor(fn || null);
  }

  function updateFunctionStats(code) {
    const lines = code ? code.split(/\r?\n/).length : 0;
    const chars = code ? code.length : 0;
    functionLines.textContent = `${lines} ${lines > 1 ? 'lignes' : 'ligne'}`;
    statLines.textContent = lines;
    statChars.textContent = chars;
  }

  function sanitizeEntryName(name) {
    return (name || 'main').replace(/[^A-Za-z0-9_]/g, '') || 'main';
  }

  function enforceEntryName(code, entryName) {
    const fnRegex = /(fn\s+)([A-Za-z_][\w]*)/m;
    if (!fnRegex.test(code)) return code;
    return code.replace(fnRegex, `$1${entryName}`);
  }

  function adjustLiteralsForTarget(code, isFloatTarget) {
    if (isFloatTarget) return code;
    return code.replace(/(\d+)\.0\b/g, '$1').replace(/(\d+\.\d+)/g, (match) => {
      const asInt = parseInt(match, 10);
      return Number.isNaN(asInt) ? match : `${asInt}`;
    });
  }

  function sanitizedIdentifier(name, fallback = 'identifier') {
    const trimmed = (name || fallback).replace(/[^A-Za-z0-9_]/g, '');
    if (/^[A-Za-z_]/.test(trimmed)) return trimmed || fallback;
    return `_${trimmed || fallback}`;
  }

  function logConsole(message, meta = '') {
    const time = new Date().toLocaleTimeString();
    consoleMessages.push({ time, message, meta });
    renderConsole();
  }

  function renderConsole() {
    if (!consoleArea) return;
    consoleArea.innerHTML = '';
    if (!consoleMessages.length) {
      const empty = document.createElement('div');
      empty.className = 'console-line';
      empty.textContent = 'Aucune erreur pour le moment.';
      consoleArea.appendChild(empty);
      return;
    }
    consoleMessages.slice(-100).forEach((msg) => {
      const line = document.createElement('div');
      line.className = 'console-line';
      const metaEl = document.createElement('span');
      metaEl.className = 'meta';
      const metaText = `[${msg.time}] ${msg.meta || ''}`.trim();
      metaEl.textContent = metaText;
      line.appendChild(metaEl);
      const messageEl = document.createElement('span');
      messageEl.textContent = ` ${msg.message}`;
      line.appendChild(messageEl);
      consoleArea.appendChild(line);
    });
  }

  function buildCombinedWGSL() {
    const fnSection = functionsStore
      .map((f) => f.code.trim())
      .filter(Boolean)
      .join('\n\n');

    const textureSection = textures
      .map((tex, idx) => {
        const name = sanitizedIdentifier(tex.name || `texture${idx + 1}`, `texture${idx + 1}`);
        const scalar = tex.type === 'float' ? 'f32' : 'i32';
        return `@group(0) @binding(${idx}) var<storage, read_write> ${name} : array<${scalar}>;`;
      })
      .join('\n');

    const declSeen = new Set();
    const bindingOffset = textures.length;
    const primaryTextureName = textures[0]
      ? sanitizedIdentifier(textures[0].name || 'texture0', 'texture0')
      : null;
    const primaryTextureType = textures[0]?.type || null;
    const shaderSection = shaders
      .map((s) => normalizeComputeCode(
        s.code,
        bindingOffset,
        declSeen,
        primaryTextureName,
        primaryTextureType,
      ))
      .filter(Boolean)
      .join('\n\n');

    return [
      '// --- Fonctions ---',
      fnSection || '// (aucune fonction)',
      '',
      '// --- Textures ---',
      textureSection || '// (aucune texture)',
      '',
      '// --- Compute Shaders ---',
      shaderSection || '// (aucun compute shader)',
    ].join('\n');
  }

  function normalizeComputeCode(code, bindingOffset, declSeen, primaryTextureName, primaryTextureType) {
    if (!code) return '';
    const lines = code.split('\n');
    const normalized = [];
    const bindingRegex = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<[^>]+>\s*([A-Za-z_][\w]*)/;
    let replacedVar = null;
    lines.forEach((line) => {
      const match = line.match(bindingRegex);
      if (match) {
        const originalBinding = parseInt(match[1], 10) || 0;
        const varName = match[2];
        // Si une texture primaire existe, on fait travailler le compute dessus et on supprime la déclaration locale
        if (primaryTextureName && replacedVar === null) {
          replacedVar = varName;
          return;
        }
        const newBinding = bindingOffset + originalBinding;
        const replaced = line.replace(
          /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*\d+\s*\)/,
          `@group(0) @binding(${newBinding})`,
        );
        const key = replaced.replace(/\s+/g, ' ').trim();
        if (!declSeen.has(key)) {
          declSeen.add(key);
          normalized.push(replaced);
        }
        return;
      }
      normalized.push(line);
    });
    let output = normalized.join('\n');
    if (replacedVar && primaryTextureName) {
      const varRegex = new RegExp(`\\b${replacedVar}\\b`, 'g');
      output = output.replace(varRegex, primaryTextureName);
      output = adjustLiteralsForTarget(output, primaryTextureType === 'float');
    }
    return output.trim();
  }

  function validateWGSL(wgsl) {
    const errors = [];
    const fnMissingParen = /fn\s+[A-Za-z_][\w]*\s*{/.exec(wgsl);
    if (fnMissingParen) {
      errors.push('Une fonction semble manquer ses parenthèses : utilisez "fn nom()"');
      isCompiled = false;
    }
    let balance = 0;
    wgsl.split('').forEach((ch) => {
      if (ch === '{') balance += 1;
      if (ch === '}') balance -= 1;
    });
    if (balance !== 0) {
      errors.push('Accolades déséquilibrées dans le WGSL généré.');
      isCompiled = false;
    }
    updateButtons();
    return errors;
  }

  async function compileWGSL(wgsl) {
    if (!navigator.gpu) {
      logConsole('WebGPU non supporté dans ce navigateur.', 'compile');
      isCompiled = false; updateButtons();
      return null;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        logConsole('Impossible d’obtenir un adaptateur WebGPU.', 'compile');
        isCompiled = false; updateButtons();
        return null;
      }
      const device = await adapter.requestDevice();
      const module = device.createShaderModule({ code: wgsl });
      const info = typeof module.getCompilationInfo === 'function'
        ? await module.getCompilationInfo()
        : { messages: [] };
      if (info.messages.some((m) => m.type === 'error')) {
        info.messages.forEach((m) => {
          if (m.type === 'error') {
            logConsole(`Erreur WGSL: ${m.message} (L${m.lineNum} C${m.linePos})`, 'compile');
          } else if (m.type === 'warning') {
            logConsole(`Avertissement WGSL: ${m.message} (L${m.lineNum} C${m.linePos})`, 'compile');
          }
        });
        isCompiled = false; updateButtons();
        return null;
      }
      logConsole('Compilation WGSL WebGPU : OK.', 'compile');
      isCompiled = true; updateButtons();
      currentDevice = device;
      return { device, module };
    } catch (err) {
      logConsole(`Échec compilation WebGPU: ${err.message || err}`, 'compile');
      isCompiled = false; updateButtons();
      return null;
    }
  }

  function buildComputePipelines(device, module) {
    computePipelines = [];
    if (!pipeline.length) {
      logConsole('Aucun pipeline défini : module compilé sans pipeline.', 'pipeline');
      isCompiled = false; updateButtons();
      return;
    }
    pipeline.forEach((step, idx) => {
      const shader = shaders.find((s) => s.id === step.shaderId);
      if (!shader) {
        logConsole(`Étape ${idx + 1}: shader manquant.`, 'pipeline');
        isCompiled = false; updateButtons();
        return;
      }
      const entryPoint = sanitizeEntryName(shader.name);
      try {
        const pipe = device.createComputePipeline({
          layout: 'auto',
          compute: { module, entryPoint },
        });
        computePipelines.push({ stepId: step.id, pipeline: pipe });
        logConsole(`Pipeline étape ${idx + 1} créé pour ${shader.name}.`, 'pipeline');
        isCompiled = true; updateButtons();
      } catch (err) {
        logConsole(`Échec création pipeline pour ${shader.name}: ${err.message || err}`, 'pipeline');
        isCompiled = false; updateButtons();
      }
    });
  }

  function prepareBindingBuffers(device, wgsl) {
    const entries = [];
    const readTasks = [];
    if (!wgsl) return { entries, readTasks };

    const bindings = new Map();
    // Textures bindings
    textures.forEach((tex, idx) => {
      bindings.set(idx, {
        binding: idx,
        scalar: tex.type === 'float' ? 'f32' : 'i32',
        length: tex.size.x * tex.size.y * tex.size.z,
        tex,
      });
    });

    // Other storage buffers from WGSL
    const storageRegex = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<storage,[^>]*>\s*[A-Za-z_][\w]*\s*:\s*array<([A-Za-z0-9_]+)>/g;
    let match;
    while ((match = storageRegex.exec(wgsl)) !== null) {
      const binding = parseInt(match[1], 10);
      const scalar = match[2].toLowerCase().startsWith('f') ? 'f32' : 'i32';
      if (!bindings.has(binding)) {
        bindings.set(binding, {
          binding,
          scalar,
          length: 256,
          tex: null,
        });
      }
    }

    bindings.forEach((info, binding) => {
      const byteLength = Math.max(4, info.length * 4);
      let bufEntry = bindingBuffers.get(binding);
      if (!bufEntry || bufEntry.size !== byteLength) {
        const buffer = device.createBuffer({
          size: byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        bufEntry = { buffer, size: byteLength };
        bindingBuffers.set(binding, bufEntry);
      }
      entries.push({
        binding,
        resource: { buffer: bufEntry.buffer },
      });

      if (info.tex) {
        const readBuffer = device.createBuffer({
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        readTasks.push({ dst: readBuffer, src: bufEntry.buffer, size: byteLength, tex: info.tex });
      }
    });

    return { entries, readTasks };
  }

  function updateTextureValuesFromFlat(tex, flatArray) {
    const { x, y, z } = tex.size;
    tex.values = [];
    let ptr = 0;
    for (let k = 0; k < z; k += 1) {
      const layer = [];
      for (let j = 0; j < y; j += 1) {
        const row = [];
        for (let i = 0; i < x; i += 1) {
          row.push(flatArray[ptr] ?? 0);
          ptr += 1;
        }
        layer.push(row);
      }
      tex.values.push(layer);
    }
  }

  function resetGPUState() {
    computePipelines = [];
    lastCompiledWGSL = '';
    bindingBuffers.forEach((entry) => {
      if (entry?.buffer) entry.buffer.destroy();
    });
    bindingBuffers = new Map();
    if (currentDevice && typeof currentDevice.destroy === 'function') {
      currentDevice.destroy();
    }
    currentDevice = null;
  }

  function logConsole(message, meta = '') {
    const time = new Date().toLocaleTimeString();
    consoleMessages.push({ time, message, meta });
    renderConsole();
  }

  function renderConsole() {
    if (!consoleArea) return;
    consoleArea.innerHTML = '';
    if (!consoleMessages.length) {
      const empty = document.createElement('div');
      empty.className = 'console-line';
      empty.textContent = 'Aucune erreur pour le moment.';
      consoleArea.appendChild(empty);
      return;
    }
    consoleMessages.slice(-100).forEach((msg) => {
      const line = document.createElement('div');
      line.className = 'console-line';
      const metaEl = document.createElement('span');
      metaEl.className = 'meta';
      metaEl.textContent = `[${msg.time}] ${msg.meta || ''}`.trim();
      line.appendChild(metaEl);
      line.appendChild(document.createTextNode(msg.message));
      consoleArea.appendChild(line);
    });
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
    const step = buildPipelineStep();
    pipeline.push(step);
    selectedStepId = step.id;
    renderPipelineViews();
  }

  function seedInitialFunction() {
    const fn = buildDefaultFunction();
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
    };
  }

  function defaultShaderCode(entryName = 'main') {
    return [
      '@group(0) @binding(0) var<storage, read_write> texture1 : array<u32>;',
      '',
      '@compute @workgroup_size(8, 8, 1)',
      `fn ${entryName}(@builtin(global_invocation_id) gid : vec3<u32>) {`,
      '    let index = gid.y * 64u + gid.x;',
      '    if (index < arrayLength(&texture1)) {',
      '        texture1[index] = texture1[index] + 1;',
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
    shader.workgroup = {
      x: clamp(parseInt(formData.get('wgX'), 10) || shader.workgroup.x, 1, 1024),
      y: clamp(parseInt(formData.get('wgY'), 10) || shader.workgroup.y, 1, 1024),
      z: clamp(parseInt(formData.get('wgZ'), 10) || shader.workgroup.z, 1, 64),
    };
    renderShaderForm(shader);
  }

  function renderShaderList() {
    shaderList.innerHTML = '';
    if (shaders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = 'Aucun compute shader. Ajoutez-en un.';
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
      const title = document.createElement('div');
      title.textContent = shader.name;
      item.appendChild(title);
      item.addEventListener('click', () => {
        selectedShaderId = shader.id;
        renderShaderList();
        renderShaderForm(shader);
        renderShaderEditor(shader);
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
      return;
    }
    inputs.forEach((input) => {
      input.disabled = false;
    });
    shaderForm.shaderName.value = shader.name;
    shaderForm.wgX.value = shader.workgroup.x;
    shaderForm.wgY.value = shader.workgroup.y;
    shaderForm.wgZ.value = shader.workgroup.z;
  }

  function renderShaderEditor(shader) {
    if (!shader) {
      shaderEditor.value = '';
      shaderEditor.disabled = true;
      updateShaderLines('');
      return;
    }
    shaderEditor.disabled = false;
    shaderEditor.value = shader.code;
    updateShaderLines(shader.code);
  }

  function updateShaderLines(code) {
    const lines = code ? code.split(/\r?\n/).length : 0;
    shaderLines.textContent = `${lines} ${lines > 1 ? 'lignes' : 'ligne'}`;
  }

  function renderTextureList() {
    textureList.innerHTML = '';
    if (textures.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'list-item';
      empty.textContent = 'Aucune texture. Ajoutez-en une.';
      textureList.appendChild(empty);
      removeBtn.disabled = true;
      return;
    }
    removeBtn.disabled = false;
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
      textureList.appendChild(item);
    });
  }

  function renderForm(tex) {
    textureForm.name.value = tex.name;
    textureForm.sizeX.value = tex.size.x;
    textureForm.sizeY.value = tex.size.y;
    textureForm.sizeZ.value = tex.size.z;
    textureForm.type.value = tex.type;
    textureForm.fill.value = tex.fill;
    updateSliceControl(tex);
  }

  function renderPreview() {
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (!tex) {
      preview2D.innerHTML = '<p class="eyebrow">Aucune texture sélectionnée</p>';
      preview3D.innerHTML = '';
      return;
    }
    if (previewMode === '2d') {
      preview2D.classList.remove('hidden');
      preview3D.classList.add('hidden');
      render2D(tex);
    } else {
      preview2D.classList.add('hidden');
      preview3D.classList.remove('hidden');
      render3D(tex);
    }
  }

  function render2D(tex) {
    const sliceIndex = clamp(parseInt(zSlice.value, 10) || 0, 0, tex.size.z - 1);
    sliceLabel.textContent = `Z = ${sliceIndex}`;
    const layer = tex.values[sliceIndex] || [];
    preview2D.style.gridTemplateColumns = `repeat(${tex.size.x}, minmax(0, 1fr))`;
    preview2D.innerHTML = '';
    layer.forEach((row) => {
      row.forEach((val) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = tex.type === 'float' ? Number(val).toFixed(3) : Math.round(val);
        preview2D.appendChild(cell);
      });
    });
  }

  function render3D(tex) {
    preview3D.innerHTML = '';
    for (let k = 0; k < tex.size.z; k += 1) {
      const slice = document.createElement('div');
      slice.className = 'slice';
      const title = document.createElement('h4');
      title.textContent = `Couche Z = ${k}`;
      slice.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'slice-grid';
      grid.style.gridTemplateColumns = `repeat(${tex.size.x}, minmax(0, 1fr))`;
      tex.values[k].forEach((row) => {
        row.forEach((val) => {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.textContent = tex.type === 'float' ? Number(val).toFixed(3) : Math.round(val);
          grid.appendChild(cell);
        });
      });
      slice.appendChild(grid);
      preview3D.appendChild(slice);
    }
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
      name: 'texture1',
      type: 'int',
      fill: 'random',
      size: { x: 32, y: 32, z: 1 },
      values: [],
    };
    regenerateValues(defaultTex);
    textures.push(defaultTex);
    selectedTextureId = defaultTex.id;
    renderTextureList();
    renderForm(defaultTex);
    renderPreview();
  }

  seedInitialShader();
  seedInitialPipeline();
  seedInitialFunction();
  seedInitialTexture();
});
