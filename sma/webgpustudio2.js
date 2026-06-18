(function initWebGPUStudio(global) {
  'use strict';

  const MAX_SHADER_BUFFERS = 1000;
  const UNIFORM_BINDINGS = {
    step: 8,
    mouseX: 9,
    mouseY: 10,
    mouseZ: 11,
    mouseBtn: 12,
    key: 13,
  };
  const USER_BINDING_OFFSET = UNIFORM_BINDINGS.key + 1;
  const BUFFER_BINDING_OFFSET = USER_BINDING_OFFSET;

  const noop = () => {};
  const defaultT = (key, options, fallback) => fallback || key;
  const nowMs = () => (
    typeof global.performance !== 'undefined' && typeof global.performance.now === 'function'
      ? global.performance.now()
      : Date.now()
  );

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getMaxStorageBindings(device) {
    const maxPerBindGroup = device?.limits?.maxBindingsPerBindGroup;
    const maxPerStage = device?.limits?.maxStorageBuffersPerShaderStage;
    let limit = MAX_SHADER_BUFFERS;
    if (Number.isFinite(maxPerBindGroup) && maxPerBindGroup > BUFFER_BINDING_OFFSET) {
      limit = Math.min(limit, maxPerBindGroup - BUFFER_BINDING_OFFSET);
    }
    if (Number.isFinite(maxPerStage) && maxPerStage > 0) {
      limit = Math.min(limit, maxPerStage);
    }
    return limit;
  }

  function normalizeTextureType(type) {
    return type === 'uint' || type === 'float' || type === 'vec3f' || type === 'vec4f' ? type : 'int';
  }

  function isVec3Type(type) {
    return normalizeTextureType(type) === 'vec3f';
  }

  function isVec4Type(type) {
    return normalizeTextureType(type) === 'vec4f';
  }

  function isFloatTextureType(type) {
    const normalized = normalizeTextureType(type);
    return normalized === 'float' || normalized === 'vec3f' || normalized === 'vec4f';
  }

  function getTextureComponentCount(type) {
    if (isVec4Type(type)) return 4;
    if (isVec3Type(type)) return 3;
    return 1;
  }

  function getTextureStorageStrideCount(type) {
    return isVec3Type(type) ? 4 : getTextureComponentCount(type);
  }

  function getTextureScalarWGSL(type) {
    const normalized = normalizeTextureType(type);
    if (normalized === 'uint') return 'u32';
    if (normalized === 'float') return 'f32';
    if (normalized === 'vec3f') return 'vec3<f32>';
    if (normalized === 'vec4f') return 'vec4<f32>';
    return 'i32';
  }

  function normalizeVec3Value(value) {
    if (Array.isArray(value)) {
      return [
        Number(value[0]) || 0,
        Number(value[1]) || 0,
        Number(value[2]) || 0,
      ];
    }
    if (value && typeof value === 'object') {
      return [
        Number(value.x) || 0,
        Number(value.y) || 0,
        Number(value.z) || 0,
      ];
    }
    const n = Number(value) || 0;
    return [n, n, n];
  }

  function normalizeVec4Value(value) {
    if (Array.isArray(value)) {
      return [
        Number(value[0]) || 0,
        Number(value[1]) || 0,
        Number(value[2]) || 0,
        Number(value[3]) || 0,
      ];
    }
    if (value && typeof value === 'object') {
      return [
        Number(value.x) || 0,
        Number(value.y) || 0,
        Number(value.z) || 0,
        Number(value.w) || 0,
      ];
    }
    const n = Number(value) || 0;
    return [n, n, n, n];
  }

  function coerceTextureValue(value, type) {
    const normalized = normalizeTextureType(type);
    if (normalized === 'vec3f') return normalizeVec3Value(value);
    if (normalized === 'vec4f') return normalizeVec4Value(value);
    if (normalized === 'float') {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    if (normalized === 'uint') return (Number(value) || 0) >>> 0;
    return (Number(value) || 0) | 0;
  }

  function generateValue(tex) {
    const type = normalizeTextureType(tex?.type);
    if (type === 'vec3f') {
      if (tex?.fill === 'empty') return [0, 0, 0];
      return [
        Number(Math.random().toFixed(3)),
        Number(Math.random().toFixed(3)),
        Number(Math.random().toFixed(3)),
      ];
    }
    if (type === 'vec4f') {
      if (tex?.fill === 'empty') return [0, 0, 0, 0];
      return [
        Number(Math.random().toFixed(3)),
        Number(Math.random().toFixed(3)),
        Number(Math.random().toFixed(3)),
        Number(Math.random().toFixed(3)),
      ];
    }
    if (tex?.fill === 'empty') return 0;
    if (type === 'float') {
      return Number(Math.random().toFixed(3));
    }
    const r = (Math.random() * 0x100000000) >>> 0;
    return type === 'uint' ? r >>> 0 : (r | 0);
  }

  function regenerateValues(tex) {
    if (!tex || !tex.size) return;
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
    if (!tex || !tex.size) return;
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
            tex.values[k][j][i] = generateValue(tex);
          } else {
            tex.values[k][j][i] = coerceTextureValue(tex.values[k][j][i], tex.type);
          }
        }
      }
    }
  }

  function updateTextureValuesFromFlat(tex, flatArray) {
    if (!tex || !tex.size) return;
    const { x, y, z } = tex.size;
    const lanes = getTextureComponentCount(tex.type);
    const strideLanes = getTextureStorageStrideCount(tex.type);
    tex.values = [];
    let ptr = 0;
    for (let k = 0; k < z; k += 1) {
      const layer = [];
      for (let j = 0; j < y; j += 1) {
        const row = [];
        for (let i = 0; i < x; i += 1) {
          if (lanes > 1) {
            const vec = [];
            for (let lane = 0; lane < lanes; lane += 1) {
              vec.push(Number(flatArray[ptr + lane] ?? 0));
            }
            row.push(vec);
            ptr += strideLanes;
          } else {
            row.push(flatArray[ptr] ?? 0);
            ptr += 1;
          }
        }
        layer.push(row);
      }
      tex.values.push(layer);
    }
  }

  function flattenTextureToTypedArray(tex) {
    const { x, y, z } = tex.size;
    const total = x * y * z;
    const lanes = getTextureComponentCount(tex.type);
    const strideLanes = getTextureStorageStrideCount(tex.type);
    const normalized = normalizeTextureType(tex.type);
    const isFloat = isFloatTextureType(normalized);
    const isUint = normalized === 'uint';
    const flat = isFloat
      ? new Float32Array(total * strideLanes)
      : (isUint ? new Uint32Array(total * strideLanes) : new Int32Array(total * strideLanes));
    let ptr = 0;
    for (let k = 0; k < z; k += 1) {
      for (let j = 0; j < y; j += 1) {
        for (let i = 0; i < x; i += 1) {
          const val = tex.values?.[k]?.[j]?.[i];
          if (lanes > 1) {
            const vec = lanes === 4 ? normalizeVec4Value(val) : normalizeVec3Value(val);
            for (let lane = 0; lane < lanes; lane += 1) {
              flat[ptr + lane] = vec[lane];
            }
            ptr += strideLanes;
          } else {
            flat[ptr] = coerceTextureValue(val, normalized);
            ptr += 1;
          }
        }
      }
    }
    return flat;
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

  function validateWGSLSyntaxOnly(wgsl) {
    const errors = [];
    const fnMissingParen = /fn\s+[A-Za-z_][\w]*\s*{/.exec(wgsl);
    if (fnMissingParen) {
      errors.push('Une fonction semble manquer ses parentheses : utilisez "fn nom()"');
    }
    let balance = 0;
    String(wgsl || '').split('').forEach((ch) => {
      if (ch === '{') balance += 1;
      if (ch === '}') balance -= 1;
    });
    if (balance !== 0) {
      errors.push('Accolades desequilibrees dans le WGSL genere.');
    }
    return errors;
  }

  function formatParameterValueForWGSL(value) {
    if (!Number.isFinite(value)) return null;
    if (Number.isInteger(value)) return String(value);
    const text = String(value);
    if (/[.eE]/.test(text)) return text;
    return `${text}.0`;
  }

  function evaluateParameters(parameters, options = {}) {
    const t = options.t || defaultT;
    const source = Array.isArray(parameters) ? parameters : [];
    const values = new Map();
    const errors = new Map();
    const byName = new Map();
    const duplicates = new Set();
    const byId = new Map(source.map((p) => [p.id, p]));
    const normalizeName = (name) => (name || '').trim();

    source.forEach((param) => {
      const name = normalizeName(param.name);
      if (!name) return;
      const key = name.toLowerCase();
      if (byName.has(key)) {
        duplicates.add(key);
      } else {
        byName.set(key, param.id);
      }
    });

    source.forEach((param) => {
      const name = normalizeName(param.name);
      if (!name) {
        errors.set(param.id, t('parameters.errors.empty_name', null, 'Nom requis.'));
        return;
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        errors.set(param.id, t('parameters.errors.invalid_name', null, 'Nom invalide.'));
        return;
      }
      if (duplicates.has(name.toLowerCase())) {
        errors.set(param.id, t('parameters.errors.duplicate', null, 'Nom deja utilise.'));
      }
    });

    const getParamId = (token) => byName.get(token.toLowerCase());

    const evalParam = (param, stack) => {
      if (!param || errors.has(param.id) || values.has(param.id)) return;
      if (stack.has(param.id)) {
        errors.set(param.id, t('parameters.errors.cycle', null, 'Dependance circulaire detectee.'));
        return;
      }
      const exprRaw = String(param.expr ?? '').trim();
      if (!exprRaw) {
        errors.set(param.id, t('parameters.errors.empty_expr', null, 'Expression requise.'));
        return;
      }
      const tokens = exprRaw.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
      stack.add(param.id);
      for (const token of tokens) {
        const depId = getParamId(token);
        if (!depId) {
          errors.set(param.id, t('parameters.errors.unknown', { name: token }, `Parametre inconnu : ${token}.`));
          stack.delete(param.id);
          return;
        }
        if (depId === param.id) {
          errors.set(param.id, t('parameters.errors.cycle', null, 'Dependance circulaire detectee.'));
          stack.delete(param.id);
          return;
        }
        const depParam = byId.get(depId);
        evalParam(depParam, stack);
        if (errors.has(depId)) {
          errors.set(param.id, t('parameters.errors.dependency', null, 'Dependance invalide.'));
          stack.delete(param.id);
          return;
        }
      }
      stack.delete(param.id);
      if (errors.has(param.id)) return;
      const safeExpr = exprRaw.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (token) => {
        const depId = getParamId(token);
        const depValue = values.get(depId);
        return Number.isFinite(depValue) ? String(depValue) : '0';
      });
      if (/[^0-9+\-*/().\s]/.test(safeExpr)) {
        errors.set(param.id, t('parameters.errors.invalid', null, 'Expression invalide.'));
        return;
      }
      let result;
      try {
        result = Function(`"use strict"; return (${safeExpr});`)();
      } catch (e) {
        errors.set(param.id, t('parameters.errors.invalid', null, 'Expression invalide.'));
        return;
      }
      if (!Number.isFinite(result)) {
        errors.set(param.id, t('parameters.errors.not_finite', null, 'Resultat non fini.'));
        return;
      }
      values.set(param.id, Number(result));
    };

    source.forEach((param) => {
      evalParam(param, new Set());
    });

    return { values, errors };
  }

  function buildParameterNameMap(parameters, evaluation) {
    const map = new Map();
    (Array.isArray(parameters) ? parameters : []).forEach((param) => {
      const name = (param.name || '').trim();
      if (!name) return;
      if (evaluation?.errors?.has(param.id)) return;
      map.set(name.toLowerCase(), param.id);
    });
    return map;
  }

  function resolveSizeInput(rawValue, fallback, evaluation, nameMap) {
    const text = String(rawValue ?? '').trim();
    if (!text) return fallback;
    const numeric = Number(text);
    if (Number.isFinite(numeric)) return Math.floor(numeric);
    const id = nameMap?.get(text.toLowerCase());
    if (!id) return fallback;
    const resolved = evaluation.values.get(id);
    if (!Number.isFinite(resolved)) return fallback;
    return Math.floor(resolved);
  }

  function buildParameterConstWGSL(parameters, options = {}) {
    const source = Array.isArray(parameters) ? parameters : [];
    if (!source.length) return '';
    const evaluation = options.evaluation || evaluateParameters(source, options);
    const lines = [];
    source.forEach((param) => {
      const name = (param.name || '').trim();
      if (!name) return;
      if (evaluation.errors.has(param.id)) return;
      const value = evaluation.values.get(param.id);
      const literal = formatParameterValueForWGSL(value);
      if (literal === null) return;
      lines.push(`const ${name} = ${literal};`);
    });
    return lines.join('\n');
  }

  function getDefaultShaderBufferIds(textures, device) {
    return (Array.isArray(textures) ? textures : [])
      .slice(0, getMaxStorageBindings(device))
      .map((t) => t.id);
  }

  function normalizeShaderBufferIds(shader, textures, device) {
    if (!shader) return [];
    const sourceTextures = Array.isArray(textures) ? textures : [];
    let ids = Array.isArray(shader.bufferIds) ? shader.bufferIds.filter(Boolean) : [];
    const valid = new Set(sourceTextures.map((t) => t.id));
    ids = ids.filter((id) => valid.has(id));
    if (!ids.length && sourceTextures.length) ids = getDefaultShaderBufferIds(sourceTextures, device);
    const maxBindings = getMaxStorageBindings(device);
    if (ids.length > maxBindings) ids = ids.slice(0, maxBindings);
    shader.bufferIds = ids;
    return ids;
  }

  function getShaderSelectedTextures(shader, textures, device) {
    const sourceTextures = Array.isArray(textures) ? textures : [];
    const ids = normalizeShaderBufferIds(shader, sourceTextures, device);
    if (!ids.length) return [];
    const idSet = new Set(ids);
    const selected = [];
    sourceTextures.forEach((tex) => {
      if (idSet.has(tex.id)) selected.push(tex);
    });
    return selected.slice(0, getMaxStorageBindings(device));
  }

  function buildBufferDeclarationsWGSLForTextures(list, bindingOffset = BUFFER_BINDING_OFFSET) {
    return (list || [])
      .map((tex, idx) => {
        const name = sanitizedIdentifier(tex.name || `Buffer${idx + 1}`, `Buffer${idx + 1}`);
        const scalar = getTextureScalarWGSL(tex.type);
        const binding = bindingOffset + idx;
        return `@group(0) @binding(${binding}) var<storage, read_write> ${name} : array<${scalar}>;`;
      })
      .join('\n');
  }

  function buildUniformDeclarationsWGSL() {
    return [
      `@group(0) @binding(${UNIFORM_BINDINGS.step}) var<uniform> step : u32;`,
      `@group(0) @binding(${UNIFORM_BINDINGS.mouseX}) var<uniform> mouseX : u32;`,
      `@group(0) @binding(${UNIFORM_BINDINGS.mouseY}) var<uniform> mouseY : u32;`,
      `@group(0) @binding(${UNIFORM_BINDINGS.mouseZ}) var<uniform> mouseZ : u32;`,
      `@group(0) @binding(${UNIFORM_BINDINGS.mouseBtn}) var<uniform> mouseBtn : u32;`,
      `@group(0) @binding(${UNIFORM_BINDINGS.key}) var<uniform> key : u32; // VK codes`,
    ].join('\n');
  }

  function normalizeComputeCode(code, bindingOffset, declSeen, primaryTextureName, primaryTextureType) {
    if (!code) return '';
    const lines = String(code).split('\n');
    const normalized = [];
    const bindingRegex = /@group\s*\(\s*0\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var<[^>]+>\s*([A-Za-z_][\w]*)/;
    let replacedVar = null;
    lines.forEach((line) => {
      const match = line.match(bindingRegex);
      if (match) {
        const originalBinding = parseInt(match[1], 10) || 0;
        const varName = match[2];
        if (primaryTextureName && replacedVar === null) {
          replacedVar = varName;
          normalized.push('');
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
        } else {
          normalized.push('');
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
    return output;
  }

  function getProjectT(project) {
    return project?.t || defaultT;
  }

  function normalizeProject(project) {
    return {
      textures: Array.isArray(project?.textures) ? project.textures : [],
      shaders: Array.isArray(project?.shaders) ? project.shaders : [],
      functions: Array.isArray(project?.functions) ? project.functions : [],
      parameters: Array.isArray(project?.parameters) ? project.parameters : [],
      pipeline: Array.isArray(project?.pipeline) ? project.pipeline : [],
      selectedShaderId: project?.selectedShaderId || null,
      t: getProjectT(project),
      device: project?.device || null,
    };
  }

  function buildShaderSectionWithMap(project, bindingOffset, primaryTextureName, primaryTextureType) {
    const p = normalizeProject(project);
    const declSeen = new Set();
    const segments = [];
    const normalizeNewlines = (txt) => (txt || '').replace(/\r\n/g, '\n');
    const countNewlines = (txt) => (normalizeNewlines(txt).match(/\n/g) || []).length;
    let currentLine = 1;
    let code = '';

    const append = (txt) => {
      const t = normalizeNewlines(txt);
      code += t;
      currentLine += countNewlines(t);
    };

    const nonEmptyShaders = p.shaders
      .map((s) => ({ s, code: normalizeNewlines(normalizeComputeCode(
        s.code,
        bindingOffset,
        declSeen,
        primaryTextureName,
        primaryTextureType,
      )) }))
      .filter((x) => (x.code || '').trim().length > 0);

    nonEmptyShaders.forEach(({ s, code: shaderCode }, idx) => {
      const startLine = currentLine;
      const linesCount = shaderCode.split('\n').length;
      const endLine = startLine + linesCount - 1;
      segments.push({ kind: 'shader', id: s.id, name: s.name, startLine, endLine });
      append(shaderCode);
      if (idx < nonEmptyShaders.length - 1) append('\n\n');
    });

    return { code, segments };
  }

  function createWGSLBuilder() {
    const segments = [];
    const normalizeNewlines = (txt) => (txt || '').replace(/\r\n/g, '\n');
    const countNewlines = (txt) => (normalizeNewlines(txt).match(/\n/g) || []).length;
    let currentLine = 1;
    let code = '';

    const append = (txt) => {
      const t = normalizeNewlines(txt);
      code += t;
      currentLine += countNewlines(t);
    };

    const pushSegment = (kind, id, name, txt) => {
      const t = normalizeNewlines(txt);
      if (!t.trim()) return;
      const startLine = currentLine;
      const linesCount = t.split('\n').length;
      const endLine = startLine + linesCount - 1;
      segments.push({ kind, id, name, startLine, endLine });
      append(t);
    };

    const offsetSegments = (items, lineOffset) => {
      items.forEach((seg) => {
        segments.push({
          ...seg,
          startLine: seg.startLine + lineOffset - 1,
          endLine: seg.endLine + lineOffset - 1,
        });
      });
    };

    return {
      append,
      pushSegment,
      offsetSegments,
      get currentLine() {
        return currentLine;
      },
      result: () => ({ code, map: { segments } }),
    };
  }

  function buildCombinedWGSLWithMap(project) {
    const p = normalizeProject(project);
    const t = p.t;
    const builder = createWGSLBuilder();

    builder.append('// --- Parametres ---\n');
    const parametersSection = buildParameterConstWGSL(p.parameters, { t });
    if ((parametersSection || '').trim()) {
      builder.pushSegment('system', 'parameters', 'parameters', parametersSection);
      builder.append('\n\n');
    } else {
      builder.append(`// (${t('wgsl.none_parameters', null, 'aucun parametre')})\n\n`);
    }

    builder.append('// --- Fonctions ---\n');
    if (p.functions.length) {
      const nonEmpty = p.functions.filter((f) => (f.code || '').trim().length > 0);
      if (nonEmpty.length) {
        nonEmpty.forEach((f, idx) => {
          builder.pushSegment('function', f.id, f.name, f.code || '');
          if (idx < nonEmpty.length - 1) builder.append('\n\n');
        });
        builder.append('\n\n');
      } else {
        builder.append(`// (${t('wgsl.none_function', null, 'aucune fonction')})\n\n`);
      }
    } else {
      builder.append(`// (${t('wgsl.none_function', null, 'aucune fonction')})\n\n`);
    }

    builder.append('// --- Buffers ---\n');
    const textureSection = buildBufferDeclarationsWGSLForTextures(
      p.textures.slice(0, getMaxStorageBindings(p.device)),
      BUFFER_BINDING_OFFSET,
    );
    if ((textureSection || '').trim()) {
      builder.pushSegment('system', 'textures', 'textures', textureSection);
      builder.append('\n\n');
    } else {
      builder.append(`// (${t('wgsl.none_texture', null, 'aucune texture')})\n\n`);
    }

    builder.append('// --- Uniforms ---\n');
    const bindingOffset = USER_BINDING_OFFSET;
    const primaryTextureName = p.textures[0]
      ? sanitizedIdentifier(p.textures[0].name || 'Buffer1', 'Buffer1')
      : null;
    const primaryTextureType = p.textures[0]?.type || null;
    const shaderSectionBuilt = buildShaderSectionWithMap(
      p,
      bindingOffset,
      primaryTextureName,
      primaryTextureType,
    );
    const stepSection = buildUniformDeclarationsWGSL();
    builder.pushSegment('system', 'step', 'system', stepSection);
    builder.append('\n\n');

    builder.append('// --- Compute Shaders ---\n');
    if ((shaderSectionBuilt.code || '').trim()) {
      const shaderStartLine = builder.currentLine;
      builder.append(shaderSectionBuilt.code);
      builder.offsetSegments(shaderSectionBuilt.segments, shaderStartLine);
    } else {
      builder.append('// (aucun compute shader)');
    }

    return builder.result();
  }

  function buildSingleShaderWGSLWithMap(project, shader, bindingOffset, primaryTextureName, primaryTextureType) {
    const p = normalizeProject(project);
    const t = p.t;
    const builder = createWGSLBuilder();
    const normalizeNewlines = (txt) => (txt || '').replace(/\r\n/g, '\n');

    builder.append('// --- Parametres ---\n');
    const parametersSection = buildParameterConstWGSL(p.parameters, { t });
    if ((parametersSection || '').trim()) {
      builder.pushSegment('system', 'parameters', 'parameters', parametersSection);
      builder.append('\n\n');
    } else {
      builder.append(`// (${t('wgsl.none_parameters', null, 'aucun parametre')})\n\n`);
    }

    builder.append('// --- Textures ---\n');
    const selectedTextures = getShaderSelectedTextures(shader, p.textures, p.device);
    const textureSection = buildBufferDeclarationsWGSLForTextures(selectedTextures, bindingOffset);
    if ((textureSection || '').trim()) {
      builder.pushSegment('system', 'textures', 'textures', textureSection);
      builder.append('\n\n');
    } else {
      builder.append(`// (${t('wgsl.none_texture', null, 'aucune texture')})\n\n`);
    }

    builder.append('// --- Systeme ---\n');
    const declSeen = new Set();
    const shaderCode = normalizeComputeCode(
      shader?.code || '',
      bindingOffset,
      declSeen,
      primaryTextureName,
      primaryTextureType,
    );
    builder.pushSegment('system', 'step', 'system', buildUniformDeclarationsWGSL());
    builder.append('\n\n');

    builder.append('// --- Compute Shaders ---\n');
    if ((shaderCode || '').trim()) {
      builder.pushSegment('shader', shader?.id, shader?.name, normalizeNewlines(shaderCode));
      builder.append('\n\n');
    } else {
      builder.append('// (aucun compute shader)\n\n');
    }

    builder.append('// --- Fonctions ---\n');
    const nonEmpty = p.functions.filter((f) => (f.code || '').trim().length > 0);
    if (nonEmpty.length) {
      nonEmpty.forEach((f, idx) => {
        builder.pushSegment('function', f.id, f.name, f.code || '');
        if (idx < nonEmpty.length - 1) builder.append('\n\n');
      });
    } else {
      builder.append(`// (${t('wgsl.none_function', null, 'aucune fonction')})`);
    }

    return builder.result();
  }

  function buildSingleFunctionWGSLWithMap(project, fn, bindingOffset, primaryTextureName, primaryTextureType) {
    const p = normalizeProject(project);
    const t = p.t;
    const builder = createWGSLBuilder();

    builder.append('// --- Parametres ---\n');
    const parametersSection = buildParameterConstWGSL(p.parameters, { t });
    if ((parametersSection || '').trim()) {
      builder.pushSegment('system', 'parameters', 'parameters', parametersSection);
      builder.append('\n\n');
    } else {
      builder.append(`// (${t('wgsl.none_parameters', null, 'aucun parametre')})\n\n`);
    }

    builder.append('// --- Textures ---\n');
    const baseShader = p.shaders.find((s) => s.id === p.selectedShaderId) || p.shaders[0] || null;
    const selectedTextures = getShaderSelectedTextures(baseShader, p.textures, p.device);
    const textureSection = buildBufferDeclarationsWGSLForTextures(selectedTextures, bindingOffset);
    if ((textureSection || '').trim()) {
      builder.pushSegment('system', 'textures', 'textures', textureSection);
      builder.append('\n\n');
    } else {
      builder.append(`// (${t('wgsl.none_texture', null, 'aucune texture')})\n\n`);
    }

    builder.append('// --- Systeme ---\n');
    normalizeComputeCode('', bindingOffset, new Set(), primaryTextureName, primaryTextureType);
    builder.pushSegment('system', 'step', 'system', buildUniformDeclarationsWGSL());
    builder.append('\n\n');

    builder.append('// --- Fonctions ---\n');
    const allFns = p.functions.filter((f) => (f?.code || '').trim().length > 0);
    const first = fn ? allFns.find((f) => f.id === fn.id) : null;
    if (first) {
      builder.pushSegment('function', first.id, first.name, first.code || '');
      if (allFns.length > 1) builder.append('\n\n');
      allFns.forEach((f) => {
        if (f.id === first.id) return;
        builder.pushSegment('function', f.id, f.name, f.code || '');
        builder.append('\n\n');
      });
    } else if (allFns.length) {
      allFns.forEach((f, idx) => {
        builder.pushSegment('function', f.id, f.name, f.code || '');
        if (idx < allFns.length - 1) builder.append('\n\n');
      });
    } else {
      builder.append(`// (${t('wgsl.none_function', null, 'aucune fonction')})`);
    }

    return builder.result();
  }

  function buildCombinedWGSL(project) {
    return buildCombinedWGSLWithMap(project).code;
  }

  function resolveWGSLLocation(globalLoc, map) {
    if (!globalLoc || !map || !Array.isArray(map.segments)) return null;
    const line = Number(globalLoc.line) || 0;
    const col = Number(globalLoc.col) || 1;
    const seg = map.segments.find((s) => line >= s.startLine && line <= s.endLine);
    if (!seg) return null;
    return {
      kind: seg.kind,
      id: seg.id,
      name: seg.name,
      globalLine: line,
      globalCol: col,
      line: line - seg.startLine + 1,
      col,
    };
  }

  function validateLoopStructure(list, allowOpen = false) {
    const stack = [];
    for (let i = 0; i < (Array.isArray(list) ? list.length : 0); i += 1) {
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

  class WebGPUSimulationRuntime {
    constructor(options = {}) {
      this.navigator = options.navigator || global.navigator;
      this.log = options.log || noop;
      this.onDeviceChange = options.onDeviceChange || noop;
      this.reset();
    }

    reset() {
      this.currentDevice = null;
      this.currentAdapter = null;
      this.currentAdapterInfo = null;
      this.computePipelines = [];
      this.lastCompiledWGSL = '';
      this.uniformBuffers = new Map();
      this.textureBuffers = new Map();
      this.dummyStorageBuffers = new Map();
      this.initialUploadDone = false;
      this.stepCount = 0;
      this.sharedPipelineLayout = null;
      this.prep = null;
      this.bindingsDirty = true;
      this.isStepRunning = false;
      this.uniformValues = {
        mouseX: 0,
        mouseY: 0,
        mouseZ: 0,
        mouseBtn: 0,
        key: 0,
      };
    }

    syncDeviceState() {
      this.onDeviceChange({
        adapter: this.currentAdapter,
        adapterInfo: this.currentAdapterInfo,
        device: this.currentDevice,
      });
    }

    get device() {
      return this.currentDevice;
    }

    get adapter() {
      return this.currentAdapter;
    }

    get adapterInfo() {
      return this.currentAdapterInfo;
    }

    get state() {
      return {
        device: this.currentDevice,
        adapter: this.currentAdapter,
        adapterInfo: this.currentAdapterInfo,
        stepCount: this.stepCount,
        isStepRunning: this.isStepRunning,
        isCompiled: this.computePipelines.length > 0,
        resources: this.getResourceStats(),
      };
    }

    getMaxStorageBindings(device = this.currentDevice) {
      return getMaxStorageBindings(device);
    }

    getResourceStats() {
      return {
        uniformBuffers: this.uniformBuffers.size || 0,
        dummyStorageBuffers: this.dummyStorageBuffers.size || 0,
        textureBuffers: this.textureBuffers.size || 0,
      };
    }

    async probeWebGPU() {
      if (!this.navigator?.gpu) return null;
      if (this.currentAdapter && this.currentDevice) return this.state;
      const adapter = await this.navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return null;
      this.currentAdapter = adapter;
      if (!this.currentAdapterInfo) {
        this.currentAdapterInfo = await this.readAdapterInfo(adapter);
      }
      if (!this.currentDevice) {
        try {
          this.currentDevice = await adapter.requestDevice();
        } catch (e) {
          this.currentDevice = null;
        }
      }
      this.syncDeviceState();
      return this.state;
    }

    async readAdapterInfo(adapter) {
      try {
        if (typeof adapter.requestAdapterInfo === 'function') {
          return await adapter.requestAdapterInfo();
        }
        if (adapter.info) return adapter.info;
      } catch (e) {
      }
      return null;
    }

    disposeGpuResources(options = {}) {
      const destroyDevice = options.destroyDevice !== false;
      this.computePipelines = [];
      this.prep = null;
      this.bindingsDirty = true;
      this.initialUploadDone = false;
      this.textureBuffers.forEach((entry) => {
        try {
          if (entry?.buffer) entry.buffer.destroy();
        } catch (e) {
        }
      });
      this.textureBuffers = new Map();
      this.uniformBuffers.forEach((buf) => {
        try {
          if (buf?.destroy) buf.destroy();
        } catch (e) {
        }
      });
      this.uniformBuffers = new Map();
      this.dummyStorageBuffers.forEach((buf) => {
        try {
          if (buf?.destroy) buf.destroy();
        } catch (e) {
        }
      });
      this.dummyStorageBuffers = new Map();
      this.sharedPipelineLayout = null;
      if (destroyDevice && this.currentDevice && typeof this.currentDevice.destroy === 'function') {
        try {
          this.currentDevice.destroy();
        } catch (e) {
        }
        this.currentDevice = null;
      }
      this.syncDeviceState();
    }

    resetExecution() {
      this.disposeGpuResources();
      this.lastCompiledWGSL = '';
      this.stepCount = 0;
      this.isStepRunning = false;
      this.markBindingsDirty();
    }

    markBindingsDirty() {
      this.bindingsDirty = true;
      this.prep = null;
      this.initialUploadDone = false;
      this.sharedPipelineLayout = null;
    }

    setStepCount(value) {
      this.stepCount = Math.max(0, Number(value) || 0);
      this.updateUniformBuffer('step', this.stepCount);
    }

    setKey(value) {
      this.uniformValues.key = (value >>> 0);
      this.updateUniformBuffer('key', this.uniformValues.key);
    }

    setMouseButton(value) {
      this.uniformValues.mouseBtn = (value >>> 0);
      this.updateUniformBuffer('mouseBtn', this.uniformValues.mouseBtn);
    }

    setMousePosition(x, y, z) {
      this.uniformValues.mouseX = (x >>> 0);
      this.uniformValues.mouseY = (y >>> 0);
      this.uniformValues.mouseZ = (z >>> 0);
      this.updateMouseUniformBuffers();
    }

    updateUniformBuffer(key, value) {
      if (!this.currentDevice) return;
      const buf = this.uniformBuffers.get(key);
      if (!buf) return;
      const data = new Uint32Array([value >>> 0]);
      this.currentDevice.queue.writeBuffer(
        buf,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
    }

    updateStepCounterBuffer() {
      this.updateUniformBuffer('step', this.stepCount);
    }

    updateMouseUniformBuffers() {
      this.updateUniformBuffer('mouseX', this.uniformValues.mouseX);
      this.updateUniformBuffer('mouseY', this.uniformValues.mouseY);
      this.updateUniformBuffer('mouseZ', this.uniformValues.mouseZ);
    }

    updateKeyUniformBuffer() {
      this.updateUniformBuffer('key', this.uniformValues.key);
    }

    updateMouseBtnUniformBuffer() {
      this.updateUniformBuffer('mouseBtn', this.uniformValues.mouseBtn);
    }

    ensureUniformBuffers(device) {
      if (!device) return;
      const ensure = (key) => {
        if (this.uniformBuffers.has(key)) return;
        const buffer = device.createBuffer({
          size: 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.uniformBuffers.set(key, buffer);
      };
      ensure('step');
      ensure('mouseX');
      ensure('mouseY');
      ensure('mouseZ');
      ensure('mouseBtn');
      ensure('key');
    }

    ensureDummyStorageBuffer(device, binding) {
      if (!device) return null;
      if (this.dummyStorageBuffers.has(binding)) return this.dummyStorageBuffers.get(binding);
      const buffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.dummyStorageBuffers.set(binding, buffer);
      return buffer;
    }

    ensureTextureBuffer(device, tex) {
      if (!device || !tex) return null;
      const strideLanes = getTextureStorageStrideCount(tex.type);
      const size = Math.max(4, (tex.size.x * tex.size.y * tex.size.z) * strideLanes * 4);
      let entry = this.textureBuffers.get(tex.id);
      if (!entry || entry.size !== size) {
        if (entry?.buffer) {
          try {
            entry.buffer.destroy();
          } catch (e) {
          }
        }
        const buffer = device.createBuffer({
          size,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        entry = { buffer, size };
        this.textureBuffers.set(tex.id, entry);
      }
      return entry;
    }

    buildTextureReadTasks(device, textures) {
      const readTasks = [];
      if (!device) return readTasks;
      (Array.isArray(textures) ? textures : []).forEach((tex) => {
        const entry = this.ensureTextureBuffer(device, tex);
        if (!entry) return;
        const readBuffer = device.createBuffer({
          size: entry.size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        readTasks.push({ dst: readBuffer, src: entry.buffer, size: entry.size, tex });
      });
      return readTasks;
    }

    buildBindGroupEntriesForShader(device, project, shader) {
      const p = normalizeProject({ ...project, device });
      const entries = [];
      if (!device) return entries;
      const selected = getShaderSelectedTextures(shader, p.textures, device);
      const maxBindings = getMaxStorageBindings(device);
      for (let i = 0; i < maxBindings; i += 1) {
        const tex = selected[i] || null;
        const binding = BUFFER_BINDING_OFFSET + i;
        if (tex) {
          const entry = this.ensureTextureBuffer(device, tex);
          if (entry) entries.push({ binding, resource: { buffer: entry.buffer } });
        } else {
          const dummy = this.ensureDummyStorageBuffer(device, binding);
          if (dummy) entries.push({ binding, resource: { buffer: dummy } });
        }
      }

      this.ensureUniformBuffers(device);
      Object.keys(UNIFORM_BINDINGS).forEach((key) => {
        const buf = this.uniformBuffers.get(key);
        if (buf) entries.push({ binding: UNIFORM_BINDINGS[key], resource: { buffer: buf } });
      });
      return entries;
    }

    uploadInitialTextureBuffers(textures) {
      if (this.initialUploadDone) return;
      if (!this.currentDevice) return;
      (Array.isArray(textures) ? textures : []).forEach((tex) => {
        const entry = this.ensureTextureBuffer(this.currentDevice, tex);
        if (!entry) return;
        const flat = flattenTextureToTypedArray(tex);
        this.currentDevice.queue.writeBuffer(
          entry.buffer,
          0,
          flat.buffer,
          flat.byteOffset,
          flat.byteLength,
        );
      });
      this.initialUploadDone = true;
    }

    prepareExecution(project) {
      const p = normalizeProject(project);
      if (!this.bindingsDirty && this.prep) return this.prep;
      if (!this.currentDevice) {
        this.log('Aucun device WebGPU initialise. Compilez d abord.', 'run');
        return null;
      }
      if (!this.computePipelines.length) {
        this.log('Aucun pipeline compute disponible. Compilez d abord.', 'run');
        return null;
      }
      if (!validateLoopStructure(p.pipeline)) {
        this.log('Structure de boucle invalide : verifiez vos Debut/Fin.', 'run');
        return null;
      }
      const readTasks = this.buildTextureReadTasks(this.currentDevice, p.textures);
      const dispatchList = expandPipeline(p.pipeline)
        .map((pipe, idx) => {
          if ((pipe.type || 'step') === 'step' && pipe.activated === false) return null;
          const pipeEntry = this.computePipelines.find((candidate) => candidate.pipeId === pipe.id);
          if (!pipeEntry) {
            this.log(`Pipeline ${idx + 1}: pipeline introuvable.`, 'run');
            return null;
          }
          const shader = p.shaders.find((s) => s.id === pipeEntry.shaderId);
          if (!shader) {
            this.log(`Pipeline ${idx + 1}: shader manquant pour bindings.`, 'run');
            return null;
          }
          const layout = pipeEntry.pipeline.getBindGroupLayout(0);
          if (!layout) {
            this.log(`Pipeline ${idx + 1}: layout introuvable pour le pipeline.`, 'run');
            return null;
          }
          const entries = this.buildBindGroupEntriesForShader(this.currentDevice, p, shader);
          if (!entries.length) {
            this.log(`Pipeline ${idx + 1}: aucune ressource a binder.`, 'run');
            return null;
          }
          const bindGroup = this.currentDevice.createBindGroup({ layout, entries });
          return {
            pipeline: pipeEntry.pipeline,
            bindGroup,
            x: pipe.dispatch?.x || 1,
            y: pipe.dispatch?.y || 1,
            z: pipe.dispatch?.z || 1,
          };
        })
        .filter(Boolean);
      this.prep = { readTasks, dispatchList };
      this.uploadInitialTextureBuffers(p.textures);
      this.bindingsDirty = false;
      return this.prep;
    }

    async compileProject(project) {
      const p = normalizeProject({ ...project, device: this.currentDevice });
      const navigatorRef = this.navigator;
      if (!navigatorRef?.gpu) {
        this.log('WebGPU non supporte dans ce navigateur.', 'compile');
        return { ok: false, reason: 'webgpu-unavailable' };
      }

      const built = buildCombinedWGSLWithMap({ ...p, device: this.currentDevice });
      this.lastCompiledWGSL = built.code;

      const staticErrors = validateWGSLSyntaxOnly(built.code);
      if (staticErrors.length) {
        staticErrors.forEach((message) => this.log(message, 'compile'));
        return { ok: false, wgsl: built.code, map: built.map, reason: 'static-errors' };
      }

      const adapter = await navigatorRef.gpu.requestAdapter();
      if (!adapter) {
        this.log('Impossible d obtenir un adaptateur WebGPU.', 'compile');
        return { ok: false, wgsl: built.code, map: built.map, reason: 'adapter-unavailable' };
      }

      const adapterInfo = await this.readAdapterInfo(adapter);
      const device = await adapter.requestDevice();
      const flatSteps = expandPipeline(p.pipeline).filter((pipe) => (pipe.type || 'step') === 'step');
      const shaderIds = Array.from(new Set(flatSteps.map((pipe) => pipe.shaderId).filter(Boolean)));
      const shaderModules = new Map();
      let hasErrors = false;

      for (let i = 0; i < shaderIds.length; i += 1) {
        const shader = p.shaders.find((candidate) => candidate.id === shaderIds[i]);
        if (!shader) continue;
        const selectedTextures = getShaderSelectedTextures(shader, p.textures, device);
        const primaryTextureName = selectedTextures[0]
          ? sanitizedIdentifier(selectedTextures[0].name || 'Buffer1', 'Buffer1')
          : null;
        const primaryTextureType = selectedTextures[0]?.type || null;
        const shaderWGSL = buildSingleShaderWGSLWithMap(
          { ...p, device },
          shader,
          USER_BINDING_OFFSET,
          primaryTextureName,
          primaryTextureType,
        ).code;
        const module = device.createShaderModule({ code: shaderWGSL });
        const info = typeof module.getCompilationInfo === 'function'
          ? await module.getCompilationInfo()
          : { messages: [] };
        const messages = info.messages || [];
        const hasShaderErrors = messages.some((m) => m.type === 'error');
        messages.forEach((m) => {
          if (m.type === 'error') {
            this.log(`Erreur WGSL (${shader.name}): ${m.message}`, 'compile', { line: m.lineNum, col: m.linePos });
          } else if (m.type === 'warning') {
            this.log(`Avertissement WGSL (${shader.name}): ${m.message}`, 'compile', { line: m.lineNum, col: m.linePos });
          }
        });
        if (hasShaderErrors) {
          hasErrors = true;
          continue;
        }
        shaderModules.set(shader.id, { module, shader });
      }

      if (hasErrors) {
        if (typeof device.destroy === 'function') {
          try {
            device.destroy();
          } catch (e) {
          }
        }
        return { ok: false, wgsl: built.code, map: built.map, reason: 'shader-errors' };
      }

      this.disposeGpuResources();
      this.currentAdapter = adapter;
      this.currentAdapterInfo = adapterInfo;
      this.currentDevice = device;
      this.syncDeviceState();

      const pipelinesOk = this.buildComputePipelines({ ...p, device }, shaderModules);
      this.markBindingsDirty();
      return { ok: pipelinesOk, wgsl: built.code, map: built.map, device, adapter, adapterInfo };
    }

    buildComputePipelines(project, shaderModules) {
      const p = normalizeProject({ ...project, device: this.currentDevice });
      this.computePipelines = [];
      if (!p.pipeline.length) {
        this.log('Aucun pipeline defini : module compile sans pipeline.', 'pipeline');
        return false;
      }
      if (!validateLoopStructure(p.pipeline)) {
        this.log('Structure de boucle invalide : verifiez vos Debut/Fin.', 'pipeline');
        return false;
      }
      this.sharedPipelineLayout = null;
      try {
        const entries = [];
        const maxBindings = getMaxStorageBindings(this.currentDevice);
        for (let i = 0; i < maxBindings; i += 1) {
          entries.push({
            binding: BUFFER_BINDING_OFFSET + i,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' },
          });
        }
        entries.push(
          { binding: UNIFORM_BINDINGS.step, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: UNIFORM_BINDINGS.mouseX, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: UNIFORM_BINDINGS.mouseY, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: UNIFORM_BINDINGS.mouseZ, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: UNIFORM_BINDINGS.mouseBtn, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          { binding: UNIFORM_BINDINGS.key, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        );
        const bindGroupLayout = this.currentDevice.createBindGroupLayout({ entries });
        this.sharedPipelineLayout = this.currentDevice.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
      } catch (err) {
        this.log(`Impossible de creer le layout commun: ${err.message || err}`, 'pipeline');
      }

      let ok = true;
      const flatSteps = expandPipeline(p.pipeline).filter((pipe) => (pipe.type || 'step') === 'step');
      flatSteps.forEach((pipeStep, idx) => {
        const shader = p.shaders.find((s) => s.id === pipeStep.shaderId);
        if (!shader) {
          this.log(`Pipeline ${idx + 1}: shader manquant.`, 'pipeline');
          ok = false;
          return;
        }
        const entryPoint = sanitizeEntryName(shader.name);
        try {
          const moduleEntry = shaderModules.get(shader.id);
          if (!moduleEntry) {
            this.log(`Pipeline ${idx + 1}: module WGSL manquant pour ${shader.name}.`, 'pipeline');
            ok = false;
            return;
          }
          const computePipe = this.currentDevice.createComputePipeline({
            layout: this.sharedPipelineLayout || 'auto',
            compute: { module: moduleEntry.module, entryPoint },
          });
          this.computePipelines.push({ pipeId: pipeStep.id, pipeline: computePipe, shaderId: shader.id });
          this.log(`Pipeline ${idx + 1} cree pour ${shader.name}.`, 'pipeline');
        } catch (err) {
          this.log(`Echec creation pipeline pour ${shader.name}: ${err.message || err}`, 'pipeline');
          ok = false;
        }
      });
      return ok && this.computePipelines.length > 0;
    }

    step(project, options = {}) {
      if (this.isStepRunning) return false;
      this.isStepRunning = true;
      const prepared = this.prepareExecution(project);
      if (!prepared) {
        this.isStepRunning = false;
        return false;
      }
      const { readTasks, dispatchList } = prepared;
      this.updateStepCounterBuffer();
      this.updateMouseUniformBuffers();
      this.updateKeyUniformBuffer();
      this.updateMouseBtnUniformBuffer();

      const commandEncoder = this.currentDevice.createCommandEncoder();
      const passEncoderCompute = commandEncoder.beginComputePass();
      dispatchList.forEach((entry) => {
        passEncoderCompute.setPipeline(entry.pipeline);
        passEncoderCompute.setBindGroup(0, entry.bindGroup);
        passEncoderCompute.dispatchWorkgroups(entry.x, entry.y, entry.z);
      });
      passEncoderCompute.end();

      const shouldReadback = options.shouldReadback !== false;
      if (shouldReadback) {
        readTasks.forEach((task) => {
          commandEncoder.copyBufferToBuffer(task.src, 0, task.dst, 0, task.size);
        });
      }

      this.currentDevice.queue.submit([commandEncoder.finish()]);
      this.stepCount += 1;
      this.updateStepCounterBuffer();
      this.updateMouseUniformBuffers();
      this.updateKeyUniformBuffer();
      this.updateMouseBtnUniformBuffer();

      if (!shouldReadback) {
        this.currentDevice.queue.onSubmittedWorkDone()
          .catch(() => {})
          .finally(() => {
            this.isStepRunning = false;
            if (typeof options.onComplete === 'function') {
              options.onComplete({ didReadback: false, stepCount: this.stepCount });
            }
          });
        return true;
      }

      this.handleReadbacks(readTasks, options);
      return true;
    }

    handleReadbacks(readTasks, options = {}) {
      let pending = readTasks.length;
      const finish = (didReadback) => {
        this.isStepRunning = false;
        if (typeof options.onComplete === 'function') {
          options.onComplete({ didReadback, stepCount: this.stepCount });
        }
      };
      if (!pending) {
        finish(false);
        return;
      }
      readTasks.forEach((task) => {
        task.dst.mapAsync(GPUMapMode.READ)
          .then(() => {
            const range = task.dst.getMappedRange();
            const copy = isFloatTextureType(task.tex.type)
              ? new Float32Array(range.slice(0))
              : (normalizeTextureType(task.tex.type) === 'uint'
                ? new Uint32Array(range.slice(0))
                : new Int32Array(range.slice(0)));
            task.dst.unmap();
            updateTextureValuesFromFlat(task.tex, copy);
          })
          .catch((mapErr) => {
            this.log(`Lecture buffer echouee: ${mapErr.message || mapErr}`, 'run');
          })
          .finally(() => {
            pending -= 1;
            if (pending === 0) finish(true);
          });
      });
    }
  }

  let lintDevicePromise = null;
  async function getLintDevice(navigatorRef = global.navigator) {
    if (lintDevicePromise) return lintDevicePromise;
    lintDevicePromise = (async () => {
      if (!navigatorRef?.gpu) return null;
      const adapter = await navigatorRef.gpu.requestAdapter();
      if (!adapter) return null;
      return adapter.requestDevice();
    })();
    return lintDevicePromise;
  }

  async function collectWGSLDiagnostics(project, options = {}) {
    const p = normalizeProject(project);
    const navigatorRef = options.navigator || global.navigator;
    const built = buildCombinedWGSLWithMap(p);
    const staticErrors = validateWGSLSyntaxOnly(built.code);
    const messages = [];
    staticErrors.forEach((message) => {
      messages.push({ type: 'error', message, lineNum: null, linePos: null });
    });

    try {
      const device = options.device || await getLintDevice(navigatorRef);
      if (device) {
        const module = device.createShaderModule({ code: built.code });
        const info = typeof module.getCompilationInfo === 'function'
          ? await module.getCompilationInfo()
          : { messages: [] };
        (info.messages || []).forEach((m) => messages.push(m));

        const bindingOffset = USER_BINDING_OFFSET;
        const nonEmptyShaders = p.shaders.filter((s) => (s?.code || '').trim().length > 0);
        for (let i = 0; i < nonEmptyShaders.length; i += 1) {
          const shader = nonEmptyShaders[i];
          const selectedTextures = getShaderSelectedTextures(shader, p.textures, p.device);
          const primaryForShader = selectedTextures[0]
            ? sanitizedIdentifier(selectedTextures[0].name || 'Buffer1', 'Buffer1')
            : null;
          const primaryTypeForShader = selectedTextures[0]?.type || null;
          const builtSingle = buildSingleShaderWGSLWithMap(
            p,
            shader,
            bindingOffset,
            primaryForShader,
            primaryTypeForShader,
          );
          const singleModule = device.createShaderModule({ code: builtSingle.code });
          const singleInfo = typeof singleModule.getCompilationInfo === 'function'
            ? await singleModule.getCompilationInfo()
            : { messages: [] };
          (singleInfo.messages || []).forEach((m) => {
            const globalLoc = (m.lineNum && m.linePos)
              ? { line: m.lineNum, col: m.linePos }
              : null;
            messages.push({
              type: m.type || 'info',
              message: m.message || String(m),
              lineNum: m.lineNum,
              linePos: m.linePos,
              __resolvedOverride: resolveWGSLLocation(globalLoc, builtSingle.map),
            });
          });
        }

        const nonEmptyFunctions = p.functions.filter((f) => (f?.code || '').trim().length > 0);
        for (let i = 0; i < nonEmptyFunctions.length; i += 1) {
          const fn = nonEmptyFunctions[i];
          const selectedTextures = getShaderSelectedTextures(
            p.shaders.find((s) => s.id === p.selectedShaderId) || p.shaders[0],
            p.textures,
            p.device,
          );
          const primaryForShader = selectedTextures[0]
            ? sanitizedIdentifier(selectedTextures[0].name || 'Buffer1', 'Buffer1')
            : null;
          const primaryTypeForShader = selectedTextures[0]?.type || null;
          const builtFn = buildSingleFunctionWGSLWithMap(
            p,
            fn,
            bindingOffset,
            primaryForShader,
            primaryTypeForShader,
          );
          const fnModule = device.createShaderModule({ code: builtFn.code });
          const fnInfo = typeof fnModule.getCompilationInfo === 'function'
            ? await fnModule.getCompilationInfo()
            : { messages: [] };
          (fnInfo.messages || []).forEach((m) => {
            const globalLoc = (m.lineNum && m.linePos)
              ? { line: m.lineNum, col: m.linePos }
              : null;
            messages.push({
              type: m.type || 'info',
              message: m.message || String(m),
              lineNum: m.lineNum,
              linePos: m.linePos,
              __resolvedOverride: resolveWGSLLocation(globalLoc, builtFn.map),
            });
          });
        }
      }
    } catch (err) {
      messages.push({ type: 'error', message: err?.message || String(err), lineNum: null, linePos: null });
    }

    const dedupe = new Set();
    const normalizedMessages = messages
      .filter(Boolean)
      .map((m) => {
        const globalLoc = (m.lineNum && m.linePos)
          ? { line: m.lineNum, col: m.linePos }
          : null;
        const resolved = m.__resolvedOverride || resolveWGSLLocation(globalLoc, built.map);
        return {
          type: m.type || 'info',
          message: m.message || String(m),
          globalLoc,
          resolved,
        };
      })
      .filter((m) => {
        const key = JSON.stringify(m.resolved
          ? {
            t: m.type,
            msg: m.message,
            k: m.resolved.kind || null,
            id: m.resolved.id || null,
            l: m.resolved.line || null,
            c: m.resolved.col || null,
          }
          : {
            t: m.type,
            msg: m.message,
            gl: m.globalLoc?.line || null,
            gc: m.globalLoc?.col || null,
          });
        if (dedupe.has(key)) return false;
        dedupe.add(key);
        return true;
      });

    return { built, messages: normalizedMessages };
  }

  global.WebGPUStudio = {
    MAX_SHADER_BUFFERS,
    UNIFORM_BINDINGS,
    USER_BINDING_OFFSET,
    BUFFER_BINDING_OFFSET,
    WebGPUSimulationRuntime,
    clamp,
    getMaxStorageBindings,
    normalizeTextureType,
    isVec3Type,
    isVec4Type,
    isFloatTextureType,
    getTextureComponentCount,
    getTextureStorageStrideCount,
    getTextureScalarWGSL,
    normalizeVec3Value,
    normalizeVec4Value,
    coerceTextureValue,
    generateValue,
    regenerateValues,
    ensureValueShape,
    updateTextureValuesFromFlat,
    flattenTextureToTypedArray,
    sanitizeEntryName,
    enforceEntryName,
    adjustLiteralsForTarget,
    sanitizedIdentifier,
    validateWGSLSyntaxOnly,
    formatParameterValueForWGSL,
    evaluateParameters,
    buildParameterNameMap,
    resolveSizeInput,
    buildParameterConstWGSL,
    getDefaultShaderBufferIds,
    normalizeShaderBufferIds,
    getShaderSelectedTextures,
    buildBufferDeclarationsWGSLForTextures,
    buildUniformDeclarationsWGSL,
    normalizeComputeCode,
    buildShaderSectionWithMap,
    buildCombinedWGSLWithMap,
    buildSingleShaderWGSLWithMap,
    buildSingleFunctionWGSLWithMap,
    buildCombinedWGSL,
    resolveWGSLLocation,
    validateLoopStructure,
    expandPipeline,
    collectWGSLDiagnostics,
    getLintDevice,
    nowMs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
