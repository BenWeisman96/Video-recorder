let mediaRecorder;
let chunks = [];
let stream;

const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const preview = document.getElementById('preview');

startBtn.onclick = async () => {
  try {
    resultEl.textContent = '';
    statusEl.textContent = 'Requesting permissions...';

    const useScreen = document.getElementById('screen').checked;
    const useCamera = document.getElementById('camera').checked;

    let tracks = [];

    if (useScreen) {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      tracks = tracks.concat(s.getTracks());
    }

    if (useCamera) {
      const c = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tracks = tracks.concat(c.getTracks());
    }

    if (!tracks.length) {
      throw new Error('Select screen or camera.');
    }

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
    statusEl.textContent = e.message;
  }
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
    statusEl.textContent = data.error || 'Upload failed';
    startBtn.disabled = false;
    return;
  }

  statusEl.textContent = 'Done';
  resultEl.textContent = `Link: ${data.link}\n${data.noExpiry ? 'No expiration' : `Expires: ${new Date(data.expiresAt).toLocaleString()}`}`;
  startBtn.disabled = false;
}
