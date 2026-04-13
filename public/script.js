const protocol = window.location.protocol;
const currentHost = window.location.host;
const CDN = `${protocol}//${currentHost}/assets`;
const sofficeJs = `${CDN}/soffice.js`;
const sofficeWasm = `${CDN}/soffice.wasm`;
const sofficeData = `${CDN}/soffice.data`;
const sofficeWorkerJs = `${CDN}/browser.worker.global.js`;

let worker = null;
let workerReady = false;
let selectedFile = null;
let msgId = 0;
const pending = new Map();

const $ = id => document.getElementById(id);
const show = id => $(id).style.display = '';
const hide = id => $(id).style.display = 'none';

function setProgress(pct, msg, status='') {
  $('prog-fill').style.width = pct + '%';
  $('prog-pct').textContent = Math.round(pct) + '%';
  $('prog-msg').textContent = msg;
  $('status').textContent = status;
}

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
  return (n/1048576).toFixed(1) + ' MB';
}

function getExt(name) {
  return name.split('.').pop().toLowerCase();
}

function createWorkerBlob() {
  const code = `
    let workerUrl = null;
    let innerWorker = null;
    const msgBuf = [];

    self.onmessage = function(e) {
      if (e.data.__setWorkerUrl) {
        workerUrl = e.data.__setWorkerUrl;
        innerWorker = new Worker(workerUrl);
        innerWorker.onmessage = function(ev) { self.postMessage(ev.data); };
        msgBuf.forEach(m => innerWorker.postMessage(m.data, m.transfer));
        return;
      }
      if (innerWorker) {
        const transfer = e.data.inputData ? [e.data.inputData.buffer] : [];
        innerWorker.postMessage(e.data, transfer.filter(b => b instanceof ArrayBuffer));
      } else {
        msgBuf.push({data: e.data, transfer: []});
      }
    };
  `;
  return new Worker(URL.createObjectURL(new Blob([code], {type:'application/javascript'})));
}

function initWorker() {
  if (worker) return;
  worker = createWorkerBlob();
  worker.postMessage({__setWorkerUrl: sofficeWorkerJs});

  worker.onmessage = function(e) {
    const msg = e.data;
    if (msg.type === 'loaded') {
      const id = ++msgId;
      pending.set(id, null);
      worker.postMessage({type:'init', id, sofficeJs, sofficeWasm, sofficeData, sofficeWorkerJs, verbose: false, enableProgressTracking: true});
      return;
    }
    if (msg.type === 'progress') {
      if (pending.has(msg.id)) {
        const p = msg.progress;
        if (p) {
          const pct = p.percent || 0;
          const phase = p.phase || '';
          const phaseLabel = {
            'download-wasm': 'Downloading WebAssembly',
            'download-data': 'Downloading file system',
            'compile': 'Compiling',
            'filesystem': 'Setting up filesystem',
            'lok-init': 'Initializing LibreOfficeKit',
            'ready': 'Ready',
            'converting': 'Converting',
            'complete': 'Done'
          }[phase] || phase;
          setProgress(pct, phaseLabel, p.message || '');
        }
      }
      return;
    }
    if (msg.type === 'ready') {
      workerReady = true;
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      if (cb) cb(null, null);
      hide('progress-wrap');
      show('notice');
      $('convert-btn').disabled = !selectedFile;
      return;
    }
    if (msg.type === 'result') {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      if (cb) cb(null, msg.data);
      return;
    }
    if (msg.type === 'error') {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      if (cb) cb(msg.error || 'Unknown error', null);
      return;
    }
  };
}

function workerConvert(fileData, ext) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, (err, data) => {
      if (err) reject(new Error(err));
      else resolve(data);
    });
    const inputData = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
    worker.postMessage({type:'convert', id, inputData, inputExt: ext, outputFormat:'pdf'}, [inputData.buffer]);
  });
}

function preloadWorker() {
  if (worker) return;
  hide('notice');
  show('progress-wrap');
  setProgress(0, 'Starting up…', 'Initializing LibreOffice in the background');
  $('convert-btn').disabled = true;
  initWorker();
}

const dropZone = $('drop-zone');
const fileInput = $('file-input');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(f) {
  selectedFile = f;
  $('fname').textContent = f.name;
  $('fsize').textContent = fmtSize(f.size);
  show('file-info');
  hide('result');
  hide('error');
  if (workerReady) {
    $('convert-btn').disabled = false;
  } else {
    preloadWorker();
  }
}

async function converting(data, ext, filename) {
  if (!workerReady) return;
  hide('result');
  hide('error');
  show('progress-wrap');
  $('convert-btn').disabled = true;
  setProgress(5, 'Reading file…', '');

  try {
    setProgress(10, 'Converting…', 'Sending to LibreOffice WASM');

    const id = ++msgId;
    show('progress-wrap');

    const pdfData = await new Promise((resolve, reject) => {
      pending.set(id, (err, d) => { err ? reject(new Error(err)) : resolve(d); });
      const inputData = new Uint8Array(data);
      worker.postMessage({type:'convert', id, inputData, inputExt: ext, outputFormat:'pdf'}, [inputData.buffer]);
    });

    hide('progress-wrap');
    const blob = new Blob([pdfData], {type:'application/pdf'});
    const url = URL.createObjectURL(blob);
    const dlName = filename.replace(/\.[^.]+$/, '') + '.pdf';
    $('dl-link').href = url;
    $('dl-link').download = dlName;
    $('result-info').textContent = `${dlName} · ${fmtSize(pdfData.length)}`;
    show('result');
    $('convert-btn').disabled = false;
  } catch (err) {
    hide('progress-wrap');
    $('error-msg').textContent = err.message || String(err);
    show('error');
    $('convert-btn').disabled = false;
  }
}

$('convert-btn').addEventListener('click', async () => {
  if (!selectedFile) return;
  const buf = await selectedFile.arrayBuffer();
  const data = new Uint8Array(buf);
  const ext = getExt(selectedFile.name);
  converting(data, ext, selectedFile.name);
});

window.addEventListener('load', () => {
  preloadWorker();
});