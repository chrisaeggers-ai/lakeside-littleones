const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const SUPABASE_URL = 'https://suiovkkddxxbqywhzavs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1aW92a2tkZHh4YnF5d2h6YXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDcxMDYsImV4cCI6MjA5MDQ4MzEwNn0.m53Ox16ezlphv46lDovCH2XKMbj-arUPaorRVuE6YoA';

async function supabase(method, table, data, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query||''}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': method==='POST' ? 'return=minimal' : undefined
  };
  if (!headers.Prefer) delete headers.Prefer;
  const opts = { method, headers };
  if (data) opts.body = JSON.stringify(data);
  const res = await fetch(url, opts);
  if (method === 'GET') return res.json();
  return res;
}

// ── SAVE SIGN-IN ──────────────────────────────────────────────────────
app.post('/api/signin', async (req, res) => {
  const { name, email, photo, city } = req.body;
  if (!email) return res.json({ ok: false });
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_signins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'on-conflict': 'email'
      },
      body: JSON.stringify({ name, email, photo, city: city||'Unknown', signed_in_at: new Date().toISOString() })
    });
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false }); }
});

// ── TRACK EVENT ───────────────────────────────────────────────────────
app.post('/api/track', async (req, res) => {
  const { event_type, session_id, user_email, city, weather_code,
          category, listing_name, tab_name, filter_value,
          map_provider, duration_seconds, search_query } = req.body;
  try {
    await supabase('POST', 'events', {
      event_type, session_id, user_email: user_email||null,
      city: city||null, weather_code: weather_code||null,
      category: category||null, listing_name: listing_name||null,
      tab_name: tab_name||null, filter_value: filter_value||null,
      map_provider: map_provider||null,
      duration_seconds: duration_seconds||null,
      search_query: search_query||null
    });
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false }); }
});

// ── GET USERS ─────────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const data = await supabase('GET', 'user_signins', null, '?select=*&order=signed_in_at.desc');
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET ANALYTICS ─────────────────────────────────────────────────────
app.get('/api/analytics', async (req, res) => {
  try {
    const events = await supabase('GET', 'events', null, '?select=*&order=created_at.desc&limit=5000');

    // Top listings by map opens
    const mapOpens = {};
    const phoneTaps = {};
    const listingViews = {};

    events.forEach(e => {
      if (e.event_type === 'map_open' && e.listing_name) {
        mapOpens[e.listing_name] = (mapOpens[e.listing_name]||0) + 1;
      }
      if (e.event_type === 'phone_tap' && e.listing_name) {
        phoneTaps[e.listing_name] = (phoneTaps[e.listing_name]||0) + 1;
      }
      if (e.event_type === 'listing_view' && e.listing_name) {
        listingViews[e.listing_name] = (listingViews[e.listing_name]||0) + 1;
      }
    });

    // Tab popularity + avg dwell time
    const tabDuration = {};
    const tabCount = {};
    events.forEach(e => {
      if (e.event_type === 'tab_view' && e.tab_name) {
        tabDuration[e.tab_name] = (tabDuration[e.tab_name]||0) + (e.duration_seconds||0);
        tabCount[e.tab_name] = (tabCount[e.tab_name]||0) + 1;
      }
    });

    // Category/filter clicks
    const filterClicks = {};
    events.forEach(e => {
      if (e.event_type === 'filter_click' && e.filter_value) {
        filterClicks[e.filter_value] = (filterClicks[e.filter_value]||0) + 1;
      }
    });

    // Hourly usage
    const hourly = new Array(24).fill(0);
    events.forEach(e => {
      const h = new Date(e.created_at).getHours();
      hourly[h]++;
    });

    // Map provider split
    const mapProviders = {};
    events.forEach(e => {
      if (e.event_type === 'map_choice' && e.map_provider) {
        mapProviders[e.map_provider] = (mapProviders[e.map_provider]||0) + 1;
      }
    });

    // Weather breakdown
    const weatherEvents = {};
    events.forEach(e => {
      if (e.weather_code !== null && e.weather_code !== undefined) {
        const w = e.weather_code <= 1 ? 'Sunny' : e.weather_code <= 3 ? 'Cloudy' : e.weather_code <= 67 ? 'Rain' : 'Snow';
        weatherEvents[w] = (weatherEvents[w]||0) + 1;
      }
    });

    // Search queries
    const searches = {};
    events.forEach(e => {
      if (e.event_type === 'search_query' && e.search_query) {
        searches[e.search_query.toLowerCase()] = (searches[e.search_query.toLowerCase()]||0) + 1;
      }
    });

    // Build listing leaderboard
    const allListings = new Set([...Object.keys(mapOpens), ...Object.keys(phoneTaps), ...Object.keys(listingViews)]);
    const listingBoard = Array.from(allListings).map(name => ({
      name,
      views: listingViews[name]||0,
      mapOpens: mapOpens[name]||0,
      phoneTaps: phoneTaps[name]||0,
      mapCtr: listingViews[name] ? Math.round((mapOpens[name]||0)/listingViews[name]*100) : 0
    })).sort((a,b) => b.mapOpens - a.mapOpens);

    const tabStats = Object.keys(tabCount).map(tab => ({
      tab,
      visits: tabCount[tab],
      avgDuration: Math.round(tabDuration[tab]/tabCount[tab])
    })).sort((a,b) => b.visits - a.visits);

    res.json({
      totalEvents: events.length,
      listingBoard,
      tabStats,
      filterClicks,
      hourly,
      mapProviders,
      weatherEvents,
      topSearches: Object.entries(searches).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([q,c])=>({q,c})),
      recentEvents: events.slice(0,100)
    });
  } catch(e) {
    console.error('Analytics error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── AI PROXY ──────────────────────────────────────────────────────────
app.post('/api/suggest', async (req, res) => {
  const { city, condition, temp, wind, timeOfDay, name } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 150,
        system: 'North Shore Tahoe local. 2 casual sentences. ONE specific spot only.',
        messages: [{ role: 'user', content: `Weather near ${city}: ${condition}, ${temp}F, ${wind}mph wind. ${timeOfDay}. Best family spot?` }]
      })
    });
    const data = await response.json();
    res.json({ suggestion: data.content?.[0]?.text || 'Kings Beach SRA is a great call today!' });
  } catch(e) { res.json({ suggestion: 'Kings Beach SRA is a great call today!' }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Lakeside + Little Ones live on port ${PORT}`));
