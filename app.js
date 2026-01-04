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
  const functionList = document.getElementById('functionList');
  const addFunctionBtn = document.getElementById('addFunctionBtn');
  const removeFunctionBtn = document.getElementById('removeFunctionBtn');
  const duplicateFunctionBtn = document.getElementById('duplicateFunctionBtn');
  const functionForm = document.getElementById('functionForm');
  const functionEditor = document.getElementById('functionEditor');
  const functionLines = document.getElementById('functionLines');
  const texturesEditor = document.getElementById('texturesEditor');
  const statLines = document.getElementById('statLines');
  const statChars = document.getElementById('statChars');
  const consoleArea = document.getElementById('consoleArea');
  const clearConsoleBtn = document.getElementById('clearConsoleBtn');
  const stepLabel = document.getElementById('stepLabel');
  const previewValueLabel = document.getElementById('previewValueLabel');
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
  let previewMode = '3d';
  let shaders = [];
  let selectedShaderId = null;
  let pipeline = [];
  let selectedPipeId = null;
  let pipelineShaderChoiceId = null;
  let functionsStore = [];
  let selectedFunctionId = null;
  let consoleMessages = [];
  let prep = null;
  let bindingsDirty = true; // force regen des bind groups/read buffers quand besoin
  let isSimulationRunning = false; // Empêche les appels concurrents à playSimulationStep
  let bindingMetas = new Map();
  let initialUploadDone = false;
  let simulationSteps = 0;
  let stepBinding = null;
  let mouseXBinding = null;
  let mouseYBinding = null;
  let mouseZBinding = null;
  let sharedPipelineLayout = null;
  let voxelRenderer = null;
  let previewValueCurrent = null;
  let mouseXValue = 0;
  let mouseYValue = 0;
  let mouseZValue = 0;

  function setPreviewValue(x,y,val,valType = null) {
    previewValueCurrent = val;
    if (!previewValueLabel) return;
    const displayVal = (valType === 'uint' && typeof val === 'number') ? (val >>> 0) : val;
    const text = displayVal === null || displayVal === undefined ? '—' : displayVal;
    previewValueLabel.textContent = `Val (${x},${y}) : ${text}`;
  }

  function renderStepCounter() {
    if (!stepLabel) return;
    stepLabel.textContent = `step = ${simulationSteps}`;
  }
  renderStepCounter();

  function updateStepCounterBuffer() {
    if (stepBinding === null || !currentDevice) return;
    const bufEntry = bindingBuffers.get(stepBinding);
    if (!bufEntry) return;
    const data = new Uint32Array([simulationSteps]);
    currentDevice.queue.writeBuffer(
      bufEntry.buffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
  }

  function updateMouseUniformBuffer() {
    if (!currentDevice) return;
    if (mouseXBinding !== null) {
      const bufEntry = bindingBuffers.get(mouseXBinding);
      if (bufEntry) {
        const data = new Uint32Array([mouseXValue]);
        currentDevice.queue.writeBuffer(
          bufEntry.buffer,
          0,
          data.buffer,
          data.byteOffset,
          data.byteLength,
        );
      }
    }
    if (mouseYBinding !== null) {
      const bufEntry = bindingBuffers.get(mouseYBinding);
      if (bufEntry) {
        const data = new Uint32Array([mouseYValue]);
        currentDevice.queue.writeBuffer(
          bufEntry.buffer,
          0,
          data.buffer,
          data.byteOffset,
          data.byteLength,
        );
      }
    }
    if (mouseZBinding !== null) {
      const bufEntry = bindingBuffers.get(mouseZBinding);
      if (bufEntry) {
        const data = new Uint32Array([mouseZValue]);
        currentDevice.queue.writeBuffer(
          bufEntry.buffer,
          0,
          data.buffer,
          data.byteOffset,
          data.byteLength,
        );
      }
    }
  }

  function setMouseUniformPosition(x, y, z, isInside) {
    const nextX = isInside ? x : 0;
    const nextY = isInside ? y : 0;
    const nextZ = z ?? 0;
    mouseXValue = nextX;
    mouseYValue = nextY;
    mouseZValue = nextZ;
    updateMouseUniformBuffer();
  }

  function markBindingsDirty() {
    bindingsDirty = true;
    prep = null;
    bindingMetas = new Map();
    initialUploadDone = false;
    stepBinding = null;
    mouseXBinding = null;
    mouseYBinding = null;
    mouseZBinding = null;
    sharedPipelineLayout = null;
  }

  // Tabs switching
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'functions') {
        updateTextureDeclarationsEditor();
      }
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

  setPreviewValue(0,0,null);























  // ********************
  // Toolbar
  // ********************

  compileBtn.addEventListener('click', async () => { // COMPILE BUTTON
    if (compileBtn.style.color === 'grey') return;
    isCompiled = true; updateButtons();
    const wgsl = buildCombinedWGSL();
    lastCompiledWGSL = wgsl;
    //alert(wgsl);
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
      markBindingsDirty(); // nouveau module/pipelines => regen bind group
    }
  });

  stepBtn.addEventListener('click', async () => { // STEP BUTTON
    if (stepBtn.style.color === 'grey') return;
    playSimulationStep();
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
    simulationSteps = 0;
    renderStepCounter();
    updateStepCounterBuffer();
    stopTimer();
    updateButtons();
    resetGPUState();
    logConsole('État GPU réinitialisé. Recompilez pour repartir de zéro.', 'stop');
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const data = serializeProject();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `project-${stamp}.wgstudio`;
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
          const data = JSON.parse(reader.result);
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
      textures = [];
      shaders = [];
      functionsStore = [];
      pipeline = [];
      selectedTextureId = null;
      selectedShaderId = null;
      selectedFunctionId = null;
      selectedPipeId = null;
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
      renderPreview();
      logConsole('Nouveau projet créé.', 'project');
    });
  }















  // **********************
  // Simulation Timer
  // **********************

  // lancer le timer
  function startTimer() {
    if (timerId === null) {
      timerId = setInterval(play, 1);
    }
  }

  // stopper le timer
  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  // Play
  function play() {
    playSimulationStep();
  }

  // Wrapper pour une exécution complète (prépare + exécute)
  function playSimulationStep() {
    if (isSimulationRunning) return;
    isSimulationRunning = true;
    const prepared = initPipelineExecution();
    if (!prepared) {
      isSimulationRunning = false;
      return;
    }
    const { readTasks, dispatchList } = prepared;
    updateStepCounterBuffer();
    updateMouseUniformBuffer();
    const commandEncoder = currentDevice.createCommandEncoder();
    const passEncoderCompute = commandEncoder.beginComputePass();
    dispatchList.forEach((entry) => {
      passEncoderCompute.setPipeline(entry.pipeline);
      passEncoderCompute.setBindGroup(0, entry.bindGroup);
      passEncoderCompute.dispatchWorkgroups(entry.x, entry.y, entry.z);
    });
    passEncoderCompute.end();
    readTasks.forEach((task) => {
      commandEncoder.copyBufferToBuffer(task.src, 0, task.dst, 0, task.size);
    });
    currentDevice.queue.submit([commandEncoder.finish()]);
    simulationSteps += 1;
    renderStepCounter();
    updateStepCounterBuffer();
    updateMouseUniformBuffer();
    handleReadbacks(readTasks);
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








  // ********************
  // Pipeline
  // ********************

  // Prépare bind group + buffers + dispatchList
  function initPipelineExecution() {
    if (!bindingsDirty && prep) return prep;
    bindingMetas = new Map();
    if (!currentDevice) {
      logConsole('Aucun device WebGPU initialisé. Compile d’abord.', 'run');
      return null;
    }
    if (!computePipelines.length) {
      logConsole('Aucun pipeline compute disponible. Compile d’abord.', 'run');
      return null;
    }
    const { entries, readTasks } = prepareBindingBuffers(currentDevice, lastCompiledWGSL);
    if (!entries.length) {
      logConsole('Aucune ressource à binder. Vérifiez le WGSL.', 'run');
      return null;
    }
    if (!validateLoopStructure(pipeline)) {
      logConsole('Structure de boucle invalide : vérifiez vos Début/Fin.', 'run');
      return null;
    }
    const dispatchList = expandPipeline(pipeline)
      .map((pipe, idx) => {
        const pipeEntry = computePipelines.find((p) => p.pipeId === pipe.id);
        if (!pipeEntry) {
          logConsole(`Pipeline ${idx + 1}: pipeline introuvable.`, 'run');
          return null;
        }
        const layout = pipeEntry.pipeline.getBindGroupLayout(0);
        if (!layout) {
          logConsole(`Pipeline ${idx + 1}: layout introuvable pour le pipeline.`, 'run');
          return null;
        }
        const bindGroup = currentDevice.createBindGroup({ layout, entries });
        return {
          pipeline: pipeEntry.pipeline,
          bindGroup,
          x: pipe.dispatch?.x || 1,
          y: pipe.dispatch?.y || 1,
          z: pipe.dispatch?.z || 1,
        };
      })
      .filter(Boolean);
    prep = { readTasks, dispatchList };
    uploadInitialTextureBuffers();
    bindingsDirty = false;
    return prep;
  }

  // Lit les buffers GPU -> CPU et relâche le verrou quand tout est lu
  function handleReadbacks(readTasks) {
    let pending = readTasks.length;
    if (!pending) {
      isSimulationRunning = false;
      return;
    }
    readTasks.forEach((task) => {
      task.dst.mapAsync(GPUMapMode.READ)
        .then(() => {
          const range = task.dst.getMappedRange();
          const copy = task.tex.type === 'float'
            ? new Float32Array(range.slice(0))
            : new Int32Array(range.slice(0));
          task.dst.unmap();
          updateTextureValuesFromFlat(task.tex, copy);
        })
        .catch((mapErr) => {
          logConsole(`Lecture buffer échouée: ${mapErr.message || mapErr}`, 'run');
        })
        .finally(() => {
          pending -= 1;
          if (pending === 0) {
            renderPreview();
            renderTextureList();
            isSimulationRunning = false;
          }
        });
    });
  }
























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
        name: 'Début boucle',
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
        name: 'Fin boucle',
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
      pipe.dispatch = {
        x: clamp(parseInt(formData.get('pDispatchX'), 10) || pipe.dispatch?.x || 1, 1, 65535),
        y: clamp(parseInt(formData.get('pDispatchY'), 10) || pipe.dispatch?.y || 1, 1, 65535),
        z: clamp(parseInt(formData.get('pDispatchZ'), 10) || pipe.dispatch?.z || 1, 1, 65535),
      };
    } else if (pipelinePanelTitle) {
      pipelinePanelTitle.textContent = pipe.type === 'loopEnd'
        ? 'Fin boucle sélectionné'
        : 'Pipeline sélectionnée';
    }
    renderPipelineViews();
  });

  // Masquer le bouton Appliquer pour les fins de boucle (géré dans renderPipelineForm)
  const pipelineSubmitBtn = pipelineForm.querySelector('button[type="submit"]');

  // Functions events
  addFunctionBtn.addEventListener('click', () => {
    const fn = buildDefaultLibrary();
    functionsStore.push(fn);
    selectedFunctionId = fn.id;
    renderFunctionViews();
  });

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
  });

  // Compute shader events
  addShaderBtn.addEventListener('click', () => {
    const shader = buildDefaultShader();
    shaders.push(shader);
    selectedShaderId = shader.id;
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
    markBindingsDirty();
    renderTextureList();
    renderForm(newTexture);
    renderPreview();
    updateTextureDeclarationsEditor();
  });

  removeBtn.addEventListener('click', () => {
    if (!selectedTextureId) return;
    textures = textures.filter((t) => t.id !== selectedTextureId);
    selectedTextureId = textures[0]?.id || null;
    markBindingsDirty();
    renderTextureList();
    if (selectedTextureId) {
      const tex = textures.find((t) => t.id === selectedTextureId);
      renderForm(tex);
    }
    renderPreview();
    updateTextureDeclarationsEditor();
  });

  regenBtn.addEventListener('click', () => {
    if (!selectedTextureId) return;
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (!tex) return;
    regenerateValues(tex);
    markBindingsDirty();
    renderPreview();
  });

  textureForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedTextureId) {
      const newTexture = buildTextureFromForm();
      textures.push(newTexture);
      selectedTextureId = newTexture.id;
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
  });

  zSlice.addEventListener('input', () => {
    sliceLabel.textContent = `Z = ${zSlice.value}`;
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
  });

  function buildTextureFromForm() {
    const formData = new FormData(textureForm);
    const size = {
      x: clamp(parseInt(formData.get('sizeX'), 10) || 64, 1, Number.MAX_SAFE_INTEGER),
      y: clamp(parseInt(formData.get('sizeY'), 10) || 32, 1, Number.MAX_SAFE_INTEGER),
      z: clamp(parseInt(formData.get('sizeZ'), 10) || 1, 1, Number.MAX_SAFE_INTEGER),
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
      x: clamp(parseInt(formData.get('sizeX'), 10) || tex.size.x, 1, Number.MAX_SAFE_INTEGER),
      y: clamp(parseInt(formData.get('sizeY'), 10) || tex.size.y, 1, Number.MAX_SAFE_INTEGER),
      z: clamp(parseInt(formData.get('sizeZ'), 10) || tex.size.z, 1, Number.MAX_SAFE_INTEGER),
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
    // Génère un entier 32 bits (signé ou non signé selon type)
    const r = (Math.random() * 0x100000000) >>> 0; // 0 .. 2^32-1
    return tex.type === 'uint' ? r >>> 0 : (r | 0);
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

  function buildPipelinePipe(shaderIdParam) {
    const idx = pipeline.length + 1;
    const shaderId = shaderIdParam || shaders[0]?.id || null;
    return {
      type: 'step',
      id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : `pipe-${Date.now()}`,
      name: `Pipeline ${idx}`,
      shaderId,
      dispatch: { x: 8, y: 4, z: 1 },
    };
  }

  function validateLoopStructure(list, allowOpen = false) {
    const stack = [];
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (item.type === 'loopStart') {
        stack.push(item);
      } else if (item.type === 'loopEnd') {
        if (!stack.length) return false;
        stack.pop();
      }
    }
    return allowOpen ? true : stack.length === 0;
  }

  function expandPipeline(list) {
    if (!Array.isArray(list)) return [];
    const stack = [{ items: [] }];
    list.forEach((item) => {
      if (item.type === 'loopStart') {
        stack.push({ repeat: Math.max(1, parseInt(item.repeat, 10) || 1), items: [] });
      } else if (item.type === 'loopEnd') {
        if (stack.length <= 1) return;
        const { repeat, items } = stack.pop();
        for (let i = 0; i < repeat; i += 1) {
          stack[stack.length - 1].items.push(...items);
        }
      } else {
        stack[stack.length - 1].items.push(item);
      }
    });
    return stack.length === 1 ? stack[0].items : [];
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
      pipelineTimeline.innerHTML = '<p class="eyebrow">Aucun Pipeline dans la Pass.</p>';
      return;
    }
    pipeline.forEach((pipe, index) => {
      const block = document.createElement('div');
      block.className = 'timeline-pipe';
      block.draggable = true;
      if (pipe.id === selectedPipeId) block.classList.add('active');
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = index + 1;
      const content = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = pipe.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      if (pipe.type === 'loopStart') {
        meta.textContent = `Répétitions : ${pipe.repeat ?? 1}`;
      } else if (pipe.type === 'loopEnd') {
        meta.textContent = 'Fin boucle';
      } else {
        meta.textContent = `${pipelineShaderLabel(pipe.shaderId)} · Dispatch ${pipe.dispatch?.x ?? 1}×${pipe.dispatch?.y ?? 1}×${pipe.dispatch?.z ?? 1}`;
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
      pipelineShaderSelect.innerHTML = '';
      return;
    }
    const isLoopStart = pipe.type === 'loopStart';
    const isLoopEnd = pipe.type === 'loopEnd';
    inputs.forEach((el) => { el.disabled = isLoopEnd; });
    if (dispatchFields) dispatchFields.classList.toggle('hidden', isLoopStart || isLoopEnd);
    if (pipelineFieldShader) pipelineFieldShader.classList.toggle('hidden', isLoopStart || isLoopEnd);
    if (loopStartFields) loopStartFields.classList.toggle('hidden', !isLoopStart);
    if (loopEndFields) loopEndFields.classList.toggle('hidden', !isLoopEnd);
    const isPipeline = !isLoopStart && !isLoopEnd;
    const dispatchInputs = pipelineForm.querySelectorAll('input[name="pDispatchX"], input[name="pDispatchY"], input[name="pDispatchZ"]');
    dispatchInputs.forEach((input) => {
      input.required = isPipeline;
      input.disabled = !isPipeline;
    });
    // Handle name field visibility/readonly for loops
    const nameLabel = pipelineForm.querySelector('label:nth-of-type(1)');
    const nameInput = pipelineForm.querySelector('input[name="pipeName"]');
    if (nameLabel) nameLabel.classList.toggle('hidden', isLoopStart || isLoopEnd);
    if (nameInput) {
      nameInput.readOnly = isLoopStart || isLoopEnd;
    }
    if (pipelinePanelTitle) {
      if (isLoopStart) {
        pipelinePanelTitle.textContent = 'Début boucle sélectionné';
      } else if (isLoopEnd) {
        pipelinePanelTitle.textContent = 'Fin boucle sélectionné';
      } else {
        pipelinePanelTitle.textContent = 'Pipeline sélectionnée';
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
      opt.textContent = 'Boucle (début)';
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
      opt.textContent = 'Boucle (fin)';
      pipelineShaderSelect.appendChild(opt);
      pipelineShaderSelect.disabled = true;
      pipelineForm.pDispatchX.value = '';
      pipelineForm.pDispatchY.value = '';
      pipelineForm.pDispatchZ.value = '';
    } else {
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
        pipelineShaderSelect.value = pipe.shaderId || shaders[0].id;
      }
      pipelineForm.pDispatchX.value = pipe.dispatch?.x ?? 4;
      pipelineForm.pDispatchY.value = pipe.dispatch?.y ?? 4;
      pipelineForm.pDispatchZ.value = pipe.dispatch?.z ?? 1;
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
      empty.textContent = 'Aucune bibliothèque. Ajoutez-en une.';
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
    updateTextureDeclarationsEditor();
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
      let level = 'info';
      const metaLower = (msg.meta || '').toLowerCase();
      const msgLower = (msg.message || '').toLowerCase();
      if (metaLower.includes('error') || metaLower.includes('err') || msgLower.includes('erreur wgsl')) level = 'error';
      else if (metaLower.includes('warn')) level = 'warn';
      line.className = `console-line ${level}`;
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

    const bindingOffset = textures.length;
    const primaryTextureName = textures[0]
      ? sanitizedIdentifier(textures[0].name || 'texture0', 'texture0')
      : null;
    const primaryTextureType = textures[0]?.type || null;
    const textureSection = buildTextureDeclarationsWGSL();
    const shaderSection = buildShaderSection(bindingOffset, primaryTextureName, primaryTextureType);
    const stepSection = buildStepDeclarationWGSL(textureSection, shaderSection);

    return [
      '// --- Fonctions ---',
      fnSection || '// (aucune fonction)',
      '',
      '// --- Textures ---',
      textureSection || '// (aucune texture)',
      '',
      '// --- Système ---',
      stepSection,
      '',
      '// --- Compute Shaders ---',
      shaderSection || '// (aucun compute shader)',
    ].join('\n');
  }

  function buildTextureDeclarationsWGSL() {
    return textures
      .map((tex, idx) => {
        const name = sanitizedIdentifier(tex.name || `texture${idx + 1}`, `texture${idx + 1}`);
        const scalar = tex.type === 'float' ? 'f32' : (tex.type === 'uint' ? 'u32' : 'i32');
        return `@group(0) @binding(${idx}) var<storage, read_write> ${name} : array<${scalar}>;`;
      })
      .join('\n');
  }

  function buildShaderSection(bindingOffset, primaryTextureName, primaryTextureType) {
    const declSeen = new Set();
    return shaders
      .map((s) => normalizeComputeCode(
        s.code,
        bindingOffset,
        declSeen,
        primaryTextureName,
        primaryTextureType,
      ))
      .filter(Boolean)
      .join('\n\n');
  }

  function buildStepDeclarationWGSL(textureSection, shaderSection) {
    const bindingRegex = /@binding\(\s*(\d+)\s*\)/g;
    let maxBinding = -1;
    const updateMax = (src) => {
      let m = null;
      while ((m = bindingRegex.exec(src)) !== null) {
        const val = parseInt(m[1], 10);
        if (!Number.isNaN(val)) maxBinding = Math.max(maxBinding, val);
      }
    };
    updateMax(textureSection);
    updateMax(shaderSection);
    const stepBinding = (maxBinding >= 0 ? maxBinding + 1 : 0);
    const mouseXBinding = stepBinding + 1;
    const mouseYBinding = stepBinding + 2;
    const mouseZBinding = stepBinding + 3;
    return [
      `@group(0) @binding(${stepBinding}) var<uniform> step : u32;`,
      `@group(0) @binding(${mouseXBinding}) var<uniform> mouseX : u32;`,
      `@group(0) @binding(${mouseYBinding}) var<uniform> mouseY : u32;`,
      `@group(0) @binding(${mouseZBinding}) var<uniform> mouseZ : u32;`,
    ].join('\n');
  }

  function updateTextureDeclarationsEditor() {
    if (!texturesEditor) return;
    const textureSection = buildTextureDeclarationsWGSL();
    const bindingOffset = textures.length;
    const primaryTextureName = textures[0]
      ? sanitizedIdentifier(textures[0].name || 'texture0', 'texture0')
      : null;
    const primaryTextureType = textures[0]?.type || null;
    const shaderSection = buildShaderSection(bindingOffset, primaryTextureName, primaryTextureType);
    const stepSection = buildStepDeclarationWGSL(textureSection, shaderSection);
    const output = [
      textureSection || '// (aucun buffer)',
      stepSection,
    ].join('\n');
    texturesEditor.value = output;
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
    if (!validateLoopStructure(pipeline)) {
      logConsole('Structure de boucle invalide : vérifiez vos Début/Fin.', 'pipeline');
      isCompiled = false; updateButtons();
      return;
    }
    // Construire un layout commun pour tous les pipelines à partir des bindings WGSL détectés
    sharedPipelineLayout = null;
    try {
      const layoutEntries = deriveLayoutEntriesFromWGSL(lastCompiledWGSL);
      if (layoutEntries.length) {
        const bindGroupLayout = device.createBindGroupLayout({ entries: layoutEntries });
        sharedPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
      }
    } catch (err) {
      logConsole(`Impossible de créer le layout commun: ${err.message || err}`, 'pipeline');
    }
    const flatSteps = expandPipeline(pipeline).filter((p) => (p.type || 'step') === 'step');
    flatSteps.forEach((pipeStep, idx) => {
      const shader = shaders.find((s) => s.id === pipeStep.shaderId);
      if (!shader) {
        logConsole(`Pipeline ${idx + 1}: shader manquant.`, 'pipeline');
        isCompiled = false; updateButtons();
        return;
      }
      const entryPoint = sanitizeEntryName(shader.name);
      try {
        const computePipe = device.createComputePipeline({
          layout: sharedPipelineLayout || 'auto',
          compute: { module, entryPoint },
        });
        computePipelines.push({ pipeId: pipeStep.id, pipeline: computePipe });
        logConsole(`Pipeline ${idx + 1} créé pour ${shader.name}.`, 'pipeline');
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
        scalar: tex.type === 'float' ? 'f32' : (tex.type === 'uint' ? 'u32' : 'i32'),
        length: tex.size.x * tex.size.y * tex.size.z,
        tex,
        usage: 'storage',
      });
    });

    // Other storage buffers from WGSL
    const storageRegex = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<storage,[^>]*>\s*[A-Za-z_][\w]*\s*:\s*array<([A-Za-z0-9_]+)>/g;
    let match;
    while ((match = storageRegex.exec(wgsl)) !== null) {
      const binding = parseInt(match[1], 10);
      const scalar = match[2].toLowerCase().startsWith('f')
        ? 'f32'
        : (match[2].toLowerCase().startsWith('u') ? 'u32' : 'i32');
      if (!bindings.has(binding)) {
        bindings.set(binding, {
          binding,
          scalar,
          length: 256,
          tex: null,
          usage: 'storage',
        });
      }
    }

    // Step counter + mouse uniforms if present in WGSL
    const stepMatch = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<uniform>\s*step\s*:\s*u32\s*;/i.exec(wgsl);
    if (stepMatch) {
      const binding = parseInt(stepMatch[1], 10);
      bindings.set(binding, {
        binding,
        scalar: 'u32',
        length: 1,
        tex: null,
        usage: 'uniform',
        isStepCounter: true,
      });
    }
    const mouseXMatch = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<uniform>\s*mouseX\s*:\s*u32\s*;/i.exec(wgsl);
    if (mouseXMatch) {
      const binding = parseInt(mouseXMatch[1], 10);
      bindings.set(binding, {
        binding,
        scalar: 'u32',
        length: 1,
        tex: null,
        usage: 'uniform',
        isMouseX: true,
      });
    }
    const mouseYMatch = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<uniform>\s*mouseY\s*:\s*u32\s*;/i.exec(wgsl);
    if (mouseYMatch) {
      const binding = parseInt(mouseYMatch[1], 10);
      bindings.set(binding, {
        binding,
        scalar: 'u32',
        length: 1,
        tex: null,
        usage: 'uniform',
        isMouseY: true,
      });
    }
    const mouseZMatch = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<uniform>\s*mouseZ\s*:\s*u32\s*;/i.exec(wgsl);
    if (mouseZMatch) {
      const binding = parseInt(mouseZMatch[1], 10);
      bindings.set(binding, {
        binding,
        scalar: 'u32',
        length: 1,
        tex: null,
        usage: 'uniform',
        isMouseZ: true,
      });
    }

    bindings.forEach((info, binding) => {
      const byteLength = Math.max(4, info.length * 4);
      let bufEntry = bindingBuffers.get(binding);
      if (!bufEntry || bufEntry.size !== byteLength) {
        const buffer = device.createBuffer({
          size: byteLength,
          usage: (info.usage === 'uniform' ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE)
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST,
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
      bindingMetas.set(binding, info);
      if (info.isStepCounter) {
        stepBinding = binding;
      }
      if (info.isMouseX) {
        mouseXBinding = binding;
      }
      if (info.isMouseY) {
        mouseYBinding = binding;
      }
      if (info.isMouseZ) {
        mouseZBinding = binding;
      }
    });

    return { entries, readTasks };
  }

  function deriveLayoutEntriesFromWGSL(wgsl) {
    if (!wgsl) return [];
    const bindings = new Map();

    // Textures declared dans l'UI
    textures.forEach((tex, idx) => {
      bindings.set(idx, {
        binding: idx,
        type: 'storage',
      });
    });

    // Storage buffers détectés dans le WGSL
    const storageRegex = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<storage,[^>]*>\s*[A-Za-z_][\w]*\s*:/g;
    let m;
    while ((m = storageRegex.exec(wgsl)) !== null) {
      const binding = parseInt(m[1], 10);
      if (!Number.isNaN(binding)) {
        bindings.set(binding, { binding, type: 'storage' });
      }
    }

    // step + mouse uniforms si présents
    const stepMatch = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<uniform>\s*step\s*:\s*u32\s*;/i.exec(wgsl);
    if (stepMatch) {
      const binding = parseInt(stepMatch[1], 10);
      if (!Number.isNaN(binding)) {
        bindings.set(binding, { binding, type: 'uniform' });
      }
    }
    const mouseXMatch = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<uniform>\s*mouseX\s*:\s*u32\s*;/i.exec(wgsl);
    if (mouseXMatch) {
      const binding = parseInt(mouseXMatch[1], 10);
      if (!Number.isNaN(binding)) {
        bindings.set(binding, { binding, type: 'uniform' });
      }
    }
    const mouseYMatch = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<uniform>\s*mouseY\s*:\s*u32\s*;/i.exec(wgsl);
    if (mouseYMatch) {
      const binding = parseInt(mouseYMatch[1], 10);
      if (!Number.isNaN(binding)) {
        bindings.set(binding, { binding, type: 'uniform' });
      }
    }
    const mouseZMatch = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<uniform>\s*mouseZ\s*:\s*u32\s*;/i.exec(wgsl);
    if (mouseZMatch) {
      const binding = parseInt(mouseZMatch[1], 10);
      if (!Number.isNaN(binding)) {
        bindings.set(binding, { binding, type: 'uniform' });
      }
    }

    return Array.from(bindings.values())
      .sort((a, b) => a.binding - b.binding)
      .map((info) => ({
        binding: info.binding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: info.type === 'uniform' ? 'uniform' : 'storage' },
      }));
  }

  function uploadInitialTextureBuffers() {
    if (initialUploadDone) return;
    bindingMetas.forEach((info, binding) => {
      if (!info.tex) return;
      const bufEntry = bindingBuffers.get(binding);
      if (!bufEntry) return;
      const flat = flattenTextureToTypedArray(info.tex);
      currentDevice.queue.writeBuffer(
        bufEntry.buffer,
        0,
        flat.buffer,
        flat.byteOffset,
        flat.byteLength,
      );
    });
    initialUploadDone = true;
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

  function flattenTextureToTypedArray(tex) {
    const { x, y, z } = tex.size;
    const total = x * y * z;
    const isFloat = tex.type === 'float';
    const isUint = tex.type === 'uint';
    const flat = isFloat ? new Float32Array(total) : (isUint ? new Uint32Array(total) : new Int32Array(total));
    let ptr = 0;
    for (let k = 0; k < z; k += 1) {
      for (let j = 0; j < y; j += 1) {
        for (let i = 0; i < x; i += 1) {
          const val = tex.values?.[k]?.[j]?.[i];
          flat[ptr] = typeof val === 'number' ? val : 0;
          ptr += 1;
        }
      }
    }
    return flat;
  }

  function resetGPUState() {
    computePipelines = [];
    lastCompiledWGSL = '';
    simulationSteps = 0;
    renderStepCounter();
    updateStepCounterBuffer();
    bindingBuffers.forEach((entry) => {
      if (entry?.buffer) entry.buffer.destroy();
    });
    bindingBuffers = new Map();
    if (currentDevice && typeof currentDevice.destroy === 'function') {
      currentDevice.destroy();
    }
    currentDevice = null;
    markBindingsDirty();
  }

  function serializeProject() {
    return {
      version: 1,
      textures,
      shaders,
      functions: functionsStore,
      pipeline,
      pipelineShaderChoiceId,
    };
  }

  function loadProject(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Fichier invalide');
    }
    textures = Array.isArray(data.textures) ? data.textures : [];
    shaders = Array.isArray(data.shaders) ? data.shaders : [];
    functionsStore = Array.isArray(data.functions) ? data.functions : [];
    pipeline = Array.isArray(data.pipeline) ? data.pipeline : [];
    pipelineShaderChoiceId = data.pipelineShaderChoiceId || shaders[0]?.id || null;
    selectedTextureId = textures[0]?.id || null;
    selectedShaderId = shaders[0]?.id || null;
    selectedFunctionId = functionsStore[0]?.id || null;
    selectedPipeId = pipeline[0]?.id || null;
    markBindingsDirty();
    renderTextureList();
    const tex = textures.find((t) => t.id === selectedTextureId);
    if (tex) {
      renderForm(tex);
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
    updateTextureDeclarationsEditor();
  }

  function logConsole(message, meta = '') {
    const time = new Date().toLocaleTimeString();
    consoleMessages.push({ time, message, meta });
    renderConsole();
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
    };
  }

  function defaultShaderCode(entryName = 'main') {
    return [
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
      updateTextureDeclarationsEditor();
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
    updateTextureDeclarationsEditor();
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
      setPreviewValue(0,0,null);
      setMouseUniformPosition(0, 0, 0, false);
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
  }

  function valueToRGBA(val, isFloat) {
    if (isFloat) {
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
        const [r, g, b, a] = valueToRGBA(v, tex.type === 'float');
        imageData.data[ptr] = r;
        imageData.data[ptr + 1] = g;
        imageData.data[ptr + 2] = b;
        imageData.data[ptr + 3] = a || 255;
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
    this.scale = [1,1,1];
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
      uniform float uAlphaScale;
      uniform vec3 uScale;
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
        vec3 camOffset = uRot * vec3(0.0, 0.0, -1.2);
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
        // fixed step raymarch
        for (int i = 0; i < 192; i++) {
          if (t > tmax || acc.a > 0.98) break;
          vec3 p = camera + dir * t;
          vec3 uvw = (p - bmin) / uScale;
          vec4 c = texture(uTex, uvw);
          float a = c.a * uAlphaScale;
          acc.rgb += (1.0 - acc.a) * c.rgb * a;
          acc.a += (1.0 - acc.a) * a;
          t += 0.01;
        }
        outColor = acc;
      }`;
      const vsObj = this.compile(gl.VERTEX_SHADER, vs);
      const fsObj = this.compile(gl.FRAGMENT_SHADER, fs);
      this.program = this.link(vsObj, fsObj);
      this.posLoc = 0;
      this.rotLoc = gl.getUniformLocation(this.program, 'uRot');
      this.alphaLoc = gl.getUniformLocation(this.program, 'uAlphaScale');
      this.scaleLoc = gl.getUniformLocation(this.program, 'uScale');
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
      };
      const onHover = (e) => {
        if (!this.currentTex || !this.onHover) return;
        const val = this.pickValue(e.clientX, e.clientY);
        this.onHover(val);
      };
      const onLeave = () => {
        if (this.onHover) this.onHover(null);
      };
      this.canvas.addEventListener('pointerdown', onDown);
      this.canvas.addEventListener('pointermove', onHover);
      this.canvas.addEventListener('pointerleave', onLeave);
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
      const camOffset = mulMat3Vec3(rot, [0, 0, -1.2]);
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
          const [r, g, b, a] = valueToRGBA(val, tex.type === 'float');
          const alpha = (r === 0 && g === 0 && b === 0) ? 0 : (a ?? 255);
          if ((alpha / 255) * alphaScale > 0.02) {
            return val;
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
            const [r, g, b, a] = valueToRGBA(v, tex.type === 'float');
            const alpha = (r === 0 && g === 0 && b === 0) ? 0 : (a ?? 255);
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
      const w = Math.max(200, rect.width);
      const h = Math.max(200, Math.min(640, w)); // garder le volume à l'échelle carrée
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
      gl.uniform1f(this.alphaLoc, 0.35);
      if (this.scaleLoc && this.scale) {
        gl.uniform3fv(this.scaleLoc, this.scale);
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
    // Désactive l'affichage de valeur en 3D
    voxelRenderer.onHover = null;
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
      name: 'texture1',
      type: 'int',
      fill: 'random',
      size: { x: 64, y: 32, z: 1 },
      values: [],
    };
    regenerateValues(defaultTex);
    textures.push(defaultTex);
    selectedTextureId = defaultTex.id;
    renderTextureList();
    renderForm(defaultTex);
    renderPreview();
    updateTextureDeclarationsEditor();
  }

  seedInitialShader();
  seedInitialPipeline();
  seedInitialFunction();
  seedInitialTexture();
  updateTextureDeclarationsEditor();
});
