import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } });

const PORT = Number(process.env.PORT || 3000);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const DEFAULT_EXPIRE_DAYS = Number(process.env.DEFAULT_EXPIRE_DAYS || 7);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const bucket = process.env.SUPABASE_BUCKET || 'recordings';

app.use(express.json());
app.use(express.static('public'));

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const token = () => crypto.randomBytes(24).toString('base64url');
const addDaysISO = (days) => new Date(Date.now() + days * 86400 * 1000).toISOString();

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    const title = (req.body.title || 'Recording').toString().slice(0, 200);
    const noExpiry = req.body.noExpiry === 'true';
    const expiresAt = noExpiry ? null : addDaysISO(DEFAULT_EXPIRE_DAYS);

    const recordingId = uuidv4();
    const ext = req.file.mimetype.includes('mp4') ? 'mp4' : 'webm';
    const storagePath = `${recordingId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (uploadError) throw uploadError;

    const { error: recordingError } = await supabase.from('recordings').insert({
      id: recordingId,
      title,
      storage_path: storagePath,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      expires_at: expiresAt
    });
    if (recordingError) throw recordingError;

    const rawToken = token();
    const { error: linkError } = await supabase.from('share_links').insert({
      recording_id: recordingId,
      token_hash: sha256(rawToken),
      expires_at: expiresAt
    });
    if (linkError) throw linkError;

    res.json({
      link: `${APP_BASE_URL}/v/${rawToken}`,
      expiresAt,
      noExpiry
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

app.get('/api/share/:token', async (req, res) => {
  try {
    const tokenHash = sha256(req.params.token);
    const { data: link, error: linkError } = await supabase
      .from('share_links')
      .select('id, recording_id, expires_at, revoked_at, view_count, recordings(storage_path, title, mime_type)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link || link.revoked_at) return res.status(404).json({ error: 'Link not found' });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired' });
    }

    const recording = Array.isArray(link.recordings) ? link.recordings[0] : link.recordings;
    const { data: signed, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(recording.storage_path, 120);

    if (signError) throw signError;

    await supabase
      .from('share_links')
      .update({ view_count: (link.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq('id', link.id);

    res.json({
      title: recording.title,
      mimeType: recording.mime_type,
      videoUrl: signed.signedUrl,
      expiresAt: link.expires_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not fetch share' });
  }
});

app.get('/v/:token', (_req, res) => {
  res.sendFile(new URL('./public/view.html', import.meta.url).pathname);
});

app.listen(PORT, () => {
  console.log(`mini-zoom-share running on ${APP_BASE_URL}`);
});
