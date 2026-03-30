const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Serve all files from root
app.use(express.static(__dirname));

// ── SUPABASE CONFIG ────────────────────────────────────────────────────
const SUPABASE_URL = 'https://suiovkkddxxbqywhzavs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1aW92a2tkZHh4YnF5d2h6YXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDcxMDYsImV4cCI6MjA5MDQ4MzEwNn0.m53Ox16ezlphv46lDovCH2XKMbj-arUPaorRVuE6YoA';

// ── SAVE SIGN-IN ───────────────────────────────────────────────────────
app.post('/api/signin', async (req, res) => {
  const { name, email, photo, city } = req.body;
  if (!email) return res.json({ ok: false, error: 'No email' });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_signins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ name, email, photo, city: city || 'Unknown' })
    });

    if (response.ok) {
      res.json({ ok: true });
    } else {
      const err = await response.text();
      console.error('Supabase error:', err);
      res.json({ ok: false, error: err });
    }
  } catch (err) {
    console.error('Sign-in save error:', err);
    res.json({ ok: false, error: err.message });
  }
});

// ── GET USERS (for admin) ──────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/user_signins?select=*&order=signed_in_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI SUGGESTION PROXY ────────────────────────────────────────────────
app.post('/api/suggest', async (req, res) => {
  const { city, condition, temp, wind, timeOfDay, name } = req.body;
  const greeting = name ? name + ',' : '';
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        system: 'You are a friendly North Shore Lake Tahoe and Truckee local. 2 short casual sentences max. Name ONE specific local spot.',
        messages: [{ role: 'user', content: `Hi ${greeting} Weather near ${city}: ${condition}, ${temp}F, wind ${wind}mph. Its the ${timeOfDay}. Best spot for a family with young kids?` }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || 'Kings Beach SRA is a great call today!';
    res.json({ suggestion: text });
  } catch (err) {
    res.json({ suggestion: 'Kings Beach SRA is a great call today!' });
  }
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Lakeside + Little Ones live on port ${PORT}`));
