# Mini Zoom Share (Supabase)

Record screen/camera in-browser, upload, and share a link that either expires in 7 days **or never expires**.

## Setup

1. Create a Supabase project.
2. In Storage, create a **private** bucket named `recordings`.
3. Run `supabase/schema.sql` in SQL editor.
4. Copy `.env.example` to `.env` and fill values.
5. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- "Never expire" sets `expires_at = null`.
- Expiring links default to `DEFAULT_EXPIRE_DAYS` (7).
- Viewer link is tokenized (`/v/:token`) and resolves via server-side hash lookup.
- Storage files remain private; playback uses short-lived signed URLs.

## Suggested next hardening

- Add auth (Supabase Auth) and owner-based RLS.
- Add revoke/delete UI.
- Add cleanup cron for expired recordings.
- Add retry/chunked uploads for very large files.
