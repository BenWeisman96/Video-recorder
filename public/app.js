let mediaRecorder;
let chunks = [];
let stream;

async function debugLog(level, source, message, meta = {}) {
  try {
    await fetch('/api/debug/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, source, message, meta })
    });
  } catch {}
}

window.addEventListener('error', (event) => {
  debugLog('error', 'client.window', event.message || 'window-error', {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  debugLog('error', 'client.promise', event.reason?.message || 'unhandled-rejection', {
    reason: String(event.reason)
  });
});

const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const preview = document.getElementById('preview');
const permissionModal = document.getElementById('permissionModal');
const modalCancel = document.getElementById('modalCancel');
const modalContinue = document.getElementById('modalContinue');

function showModal() { permissionModal.classList.remove('hidden'); }
function hideModal() { permissionModal.classList.add('hidden'); }

async function startRecordingFlow() {
  try {
    resultEl.textContent = '';
    statusEl.textContent = 'Requesting permissions...';

    const useScreen = document.getElementById('screen').checked;
    const useCamera = document.getElementById('camera').checked;

    await debugLog('info', 'client.record.start', 'record-requested', {
      useScreen,
      useCamera,
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      hasMediaDevices: !!navigator.mediaDevices
    });

    let tracks = [];

    if (useScreen) {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      tracks = tracks.concat(s.getTracks());
    }

    if (useCamera) {
      const c = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tracks = tracks.concat(c.getTracks());
    }

    if (!tracks.length) throw new Error('Select screen or camera.');

    stream = new MediaStream(tracks);
    preview.srcObject = stream;

    chunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    mediaRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mediaRecorder.onstop = upload;
    mediaRecorder.start(1000);

    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = 'Recording...';
  } catch (e) {
    await debugLog('error', 'client.record.start', e.message || 'Could not start video source', {
      name: e.name,
      stack: e.stack
    });
    statusEl.textContent = e.name === 'NotReadableError'
      ? 'Video source is busy. Close Zoom/Meet/Camera apps, then try again.'
      : (e.message || 'Could not start video source');
  }
}

startBtn.onclick = () => {
  showModal();
};

modalCancel.onclick = () => {
  hideModal();
  statusEl.textContent = 'Canceled.';
};

modalContinue.onclick = async () => {
  hideModal();
  await startRecordingFlow();
};

stopBtn.onclick = () => {
  mediaRecorder?.stop();
  stream?.getTracks().forEach((t) => t.stop());
  stopBtn.disabled = true;
  statusEl.textContent = 'Processing...';
};

async function upload() {
  const blob = new Blob(chunks, { type: 'video/webm' });
  const form = new FormData();
  form.append('video', blob, 'recording.webm');
  form.append('title', document.getElementById('title').value || 'Quick Recording');
  form.append('noExpiry', document.getElementById('noExpiry').checked ? 'true' : 'false');

  statusEl.textContent = 'Uploading...';
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  const data = await res.json();

  if (!res.ok) {
    await debugLog('error', 'client.upload', data.error || 'Upload failed', { status: res.status });
    statusEl.textContent = data.error || 'Upload failed';
    startBtn.disabled = false;
    return;
  }

  await debugLog('info', 'client.upload', 'upload-success', { link: data.link, noExpiry: data.noExpiry });
  statusEl.textContent = 'Done';
  resultEl.textContent = `Link: ${data.link}\n${data.noExpiry ? 'No expiration' : `Expires: ${new Date(data.expiresAt).toLocaleString()}`}`;
  startBtn.disabled = false;
}
