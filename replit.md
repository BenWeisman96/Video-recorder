# Mini Zoom Share

A screen/camera recording and sharing web app. Users can record their screen and camera, upload to Supabase Storage, and get a shareable link with optional expiration.

## Tech Stack
- **Runtime**: Node.js 20
- **Server**: Express.js (serves both API and static frontend)
- **Storage**: Supabase (Storage for video files, PostgreSQL for metadata)
- **Frontend**: Vanilla HTML/CSS/JS (in `public/`)

## Project Structure
```
server.js          - Express server with upload and share APIs
public/
  index.html       - Recording UI
  view.html        - Share link viewer
  app.js           - Frontend recording logic
  styles.css       - Styling
supabase/
  schema.sql       - Database schema (recordings + share_links tables)
```

## Environment Variables
- `PORT` — Server port (default: 5000)
- `SUPABASE_URL` — Supabase project URL (secret)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (secret)
- `SUPABASE_BUCKET` — Storage bucket name (default: "recordings")
- `DEFAULT_EXPIRE_DAYS` — Days until share links expire (default: 7)

## API Endpoints
- `POST /api/upload` — Upload a video recording (multipart form)
- `GET /api/share/:token` — Fetch recording metadata and signed video URL
- `GET /v/:token` — Serve the view page for a share link

## Deployment
- Configured for autoscale deployment with `node server.js`
- Server binds to `0.0.0.0:5000`
