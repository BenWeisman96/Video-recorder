let mediaRecorder;
let chunks = [];
let stream;
let screenStream;
let cameraStream;
let mixedStream;
let drawRaf;

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
const cameraSourceEl = document.getElementById('cameraSource');
const refreshDevicesBtn = document.getElementById('refreshDevices');

function showModal() { permissionModal.classList.remove('hidden'); }
function hideModal() { permissionModal.classList.add('hidden'); }

async function loadCameraDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === 'videoinput');

  cameraSourceEl.innerHTML = '';
  if (!cameras.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No camera devices found';
    cameraSourceEl.appendChild(opt);
    return;
  }

  cameras.forEach((cam, idx) => {
    const opt = document.createElement('option');
    opt.value = cam.deviceId;
    opt.textContent = cam.label || `Camera ${idx + 1}`;
    cameraSourceEl.appendChild(opt);
  });
}

async function requestDeviceLabels() {
  try {
    const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    temp.getTracks().forEach((t) => t.stop());
  } catch {}
}

function cleanupStreams() {
  [stream, mixedStream, screenStream, cameraStream].forEach((s) => s?.getTracks().forEach((t) => t.stop()));
  stream = null;
  mixedStream = null;
  screenStream = null;
  cameraStream = null;
  if (drawRaf) cancelAnimationFrame(drawRaf);
  drawRaf = null;
}

function buildMixedStream() {
  if (!screenStream || !cameraStream) return null;

  const screenVideo = document.createElement('video');
  screenVideo.srcObject = screenStream;
  screenVideo.muted = true;
  screenVideo.playsInline = true;

  const cameraVideo = document.createElement('video');
  cameraVideo.srcObject = cameraStream;
  cameraVideo.muted = true;
  cameraVideo.playsInline = true;

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  const draw = () => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (screenVideo.readyState >= 2) {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
    }

    const pipW = Math.floor(canvas.width * 0.24);
    const pipH = Math.floor(pipW * 9 / 16);
    const margin = 16;
    const x = canvas.width - pipW - margin;
    const y = canvas.height - pipH - margin;

    if (cameraVideo.readyState >= 2) {
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(x - 2, y - 2, pipW + 4, pipH + 4);
      ctx.drawImage(cameraVideo, x, y, pipW, pipH);
    }

    drawRaf = requestAnimationFrame(draw);
  };

  screenVideo.play().catch(() => {});
  cameraVideo.play().catch(() => {});
  draw();

  const out = canvas.captureStream(30);

  const audioTracks = [
    ...screenStream.getAudioTracks(),
    ...cameraStream.getAudioTracks()
  ];
  audioTracks.forEach((t) => out.addTrack(t));

  return out;
}

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

    cleanupStreams();

    if (useScreen) {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    }

    if (useCamera) {
      const selectedCamera = cameraSourceEl.value;
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: true
      });
    }

    if (!useScreen && !useCamera) throw new Error('Select screen or camera.');

    if (useScreen && useCamera) {
      mixedStream = buildMixedStream();
      stream = mixedStream;
    } else {
      stream = useScreen ? screenStream : cameraStream;
    }

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
      ? 'Video source is busy. Pick a different camera source or close other camera apps.'
      : (e.message || 'Could not start video source');
  }
}

refreshDevicesBtn.onclick = async () => {
  await requestDeviceLabels();
  await loadCameraDevices();
  await debugLog('info', 'client.devices', 'camera-list-refreshed');
};

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    loadCameraDevices();
  });
}

startBtn.onclick = () => showModal();

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
  cleanupStreams();
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

(async () => {
  await requestDeviceLabels();
  await loadCameraDevices();
})();
