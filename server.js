const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Serve ALL files from the root directory (index.html, admin.html, etc.)
app.use(express.static(__dirname));

// AI suggestion proxy — keeps your API key safe on the server
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
        system: 'You are a friendly North Shore Lake Tahoe and Truckee local. The user has young kids (toddlers to early elementary). 2 short casual sentences max. Name ONE specific local spot. No Reno. Only suggest from: Kings Beach SRA, Carnelian Bay Beach, Tahoe City Commons Beach, William Kent Beach, Tahoe Vista Rec Area, Truckee River Regional Park, West End Beach Donner Lake, KidZone Museum, Woodward Tahoe, BridgeTender, Rosies Cafe, Fireside Pizza, Poppys Frozen Yogurt, Log Cabin Caffe, Squeeze In, Jax at the Tracks, Burger Me, Kings Beach Miniature Golf, Magic Carpet Golf, Truckee River Rafting.',
        messages: [{
          role: 'user',
          content: `Hi ${greeting} Weather near ${city}: ${condition}, ${temp}F, wind ${wind}mph. It's the ${timeOfDay}. Best spot for a family with young kids?`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Kings Beach SRA is calling — grab the towels and arrive before 10am for the best parking.';
    res.json({ suggestion: text });
  } catch (err) {
    res.json({ suggestion: 'Kings Beach SRA is calling — grab the towels and arrive before 10am for the best parking.' });
  }
});

// Fallback — serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Lakeside + Little Ones live on port ${PORT}`));
