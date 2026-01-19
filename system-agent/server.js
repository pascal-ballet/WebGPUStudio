import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || '127.0.0.1';

let lastCpuSample = null;

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
};

const listTutorialPdfs = async (lang) => {
  const safeLang = (lang === 'en') ? 'en' : (lang === 'fr' ? 'fr' : null);
  if (!safeLang) return null;
  const dir = path.join(ROOT_DIR, 'Tutos', safeLang);
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    return items
      .filter((d) => d.isFile() && /\.pdf$/i.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  } catch (e) {
    return [];
  }
};

const sendText = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
};

const safeReadFile = async (path) => {
  try {
    return await fs.readFile(path, 'utf8');
  } catch (e) {
    return null;
  }
};

const safeExec = async (cmd, args, opts = {}) => {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: 2000,
      maxBuffer: 1024 * 1024,
      ...opts,
    });
    return String(stdout || '');
  } catch (e) {
    return null;
  }
};

const parseMemInfo = (txt) => {
  if (!txt) return null;
  const out = {};
  txt.split(/\r?\n/).forEach((line) => {
    const m = /^([A-Za-z_]+):\s+(\d+)\s+kB\s*$/.exec(line);
    if (!m) return;
    out[m[1]] = Number(m[2]);
  });
  return out;
};

const parseCpuInfoModel = (txt) => {
  if (!txt) return null;
  const lines = txt.split(/\r?\n/);
  for (const line of lines) {
    const m = /^model name\s*:\s*(.+)$/.exec(line);
    if (m) return m[1].trim();
  }
  for (const line of lines) {
    const m = /^Hardware\s*:\s*(.+)$/.exec(line);
    if (m) return m[1].trim();
  }
  return null;
};

const parseProcStatCpu = (txt) => {
  if (!txt) return null;
  const first = txt.split(/\r?\n/)[0];
  const parts = first.trim().split(/\s+/);
  if (!parts.length || parts[0] !== 'cpu') return null;
  const nums = parts.slice(1).map((x) => Number(x));
  const total = nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const idle = (nums[3] || 0) + (nums[4] || 0);
  return { total, idle };
};

const computeCpuUsage = (sample) => {
  if (!sample) return null;
  const prev = lastCpuSample;
  lastCpuSample = sample;
  if (!prev) return null;
  const totalDelta = sample.total - prev.total;
  const idleDelta = sample.idle - prev.idle;
  if (!(totalDelta > 0)) return null;
  const usage = 1 - idleDelta / totalDelta;
  return Math.max(0, Math.min(1, usage));
};

const parseUptime = (txt) => {
  if (!txt) return null;
  const m = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/.exec(txt.trim());
  if (!m) return null;
  return {
    uptimeSeconds: Number(m[1]),
    idleSeconds: Number(m[2]),
  };
};

const parseNvidiaSmiCsv = (txt) => {
  if (!txt) return null;
  const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  return lines.map((line) => {
    const cols = line.split(/\s*,\s*/);
    const [
      name,
      uuid,
      driverVersion,
      memTotalMB,
      memUsedMB,
      utilGpu,
      tempC,
    ] = cols;
    return {
      name: name || null,
      uuid: uuid || null,
      driverVersion: driverVersion || null,
      memoryTotalMB: memTotalMB ? Number(memTotalMB) : null,
      memoryUsedMB: memUsedMB ? Number(memUsedMB) : null,
      utilizationGpuPercent: utilGpu ? Number(utilGpu) : null,
      temperatureC: tempC ? Number(tempC) : null,
    };
  });
};

const getGpuInfo = async () => {
  const out = {
    nvidiaSmi: null,
    pci: null,
  };

  const nvidia = await safeExec('nvidia-smi', [
    '--query-gpu=name,uuid,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu',
    '--format=csv,noheader,nounits',
  ]);
  if (nvidia) {
    out.nvidiaSmi = parseNvidiaSmiCsv(nvidia);
  }

  const lspci = await safeExec('lspci', ['-nn']);
  if (lspci) {
    out.pci = lspci
      .split(/\r?\n/)
      .filter((l) => /VGA compatible controller|3D controller|Display controller/i.test(l))
      .map((l) => l.trim());
  }

  return out;
};

const getSystemInfo = async () => {
  const now = new Date().toISOString();

  const cpuinfo = await safeReadFile('/proc/cpuinfo');
  const meminfo = await safeReadFile('/proc/meminfo');
  const stat = await safeReadFile('/proc/stat');
  const uptime = await safeReadFile('/proc/uptime');

  const mem = parseMemInfo(meminfo);
  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();

  const cpuSample = parseProcStatCpu(stat);
  const cpuUsage01 = computeCpuUsage(cpuSample);

  const up = parseUptime(uptime);

  const gpu = await getGpuInfo();

  return {
    time: now,
    os: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptimeSeconds: up?.uptimeSeconds ?? os.uptime(),
    },
    cpu: {
      model: parseCpuInfoModel(cpuinfo) || (os.cpus()?.[0]?.model ?? null),
      coresLogical: os.cpus()?.length ?? null,
      loadavg: os.loadavg(),
      usage01: cpuUsage01,
    },
    memory: {
      totalBytes: totalMemBytes,
      freeBytes: freeMemBytes,
      meminfoKB: mem,
    },
    gpu,
  };
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  if (!req.url) {
    sendText(res, 400, 'Bad Request');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/' || url.pathname === '/health') {
    sendJson(res, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  if (url.pathname === '/system') {
    const info = await getSystemInfo();
    sendJson(res, 200, info);
    return;
  }

  if (url.pathname === '/tutos') {
    const lang = url.searchParams.get('lang') || 'fr';
    const pdfs = await listTutorialPdfs(lang);
    if (pdfs === null) {
      sendJson(res, 400, { error: 'Invalid lang. Use fr or en.' });
      return;
    }
    sendJson(res, 200, { pdfs });
    return;
  }

  sendText(res, 404, 'Not found');
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`WebGPUStudio System Agent listening on http://${HOST}:${PORT}`);
});
