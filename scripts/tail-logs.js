import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APP_NAME = process.env.APP_NAME || 'mini-zoom-share';
const POLL_MS = Number(process.env.DEBUG_TAIL_POLL_MS || 3000);
let lastId = Number(process.env.DEBUG_TAIL_START_ID || 0);

console.log(`[tail] app=${APP_NAME} poll=${POLL_MS}ms startId=${lastId}`);

async function poll() {
  const { data, error } = await supabase
    .from('debug_logs')
    .select('id, level, source, message, meta, created_at')
    .eq('app_name', APP_NAME)
    .gt('id', lastId)
    .order('id', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[tail] error', error.message);
    return;
  }

  for (const row of data) {
    lastId = row.id;
    console.log(`[${row.created_at}] [${row.level}] ${row.source} :: ${row.message}`);
    if (row.meta && Object.keys(row.meta).length) {
      console.log(JSON.stringify(row.meta));
    }
  }
}

setInterval(poll, POLL_MS);
poll();
