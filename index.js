import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables from Render (or your host)
const CODA_API_KEY = process.env.CODA_API_KEY;
const CODA_DOC_ID = process.env.CODA_DOC_ID;
const CODA_TABLE_ID = process.env.CODA_TABLE_ID;

app.get('/', async (req, res) => {
  console.log('Incoming request query:', req.query);


  
  // Determine the target URL (required for redirect + logging)
  let targetUrl = req.query.target || req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing target URL');
  }

const ua = req.headers['user-agent'] || '';
const isBot = /(Googlebot|Slackbot|bingbot|facebookexternalhit)/i.test(ua);
if (isBot) return res.redirect(307, targetUrl);

  // Extract SOP value (any param that's not target/url)
  let sop = 'Unknown';
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'target' && key !== 'url' && key !== 'user') {
      sop = value;
      break;
    }
  }
  let sopName = req.query.sopName || 'Unknown';
  let user = req.query.user || 'Unknown';
  let userName = req.query.userName || 'Unknown';

  const now = new Date();
  const local = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const dateStr = local.toISOString().split('T')[0];  // YYYY-MM-DD
  const timeStr = local.toISOString().split('T')[1].split('.')[0];

  // Coda payload
  const payload = {
    rows: [
      {
        cells: [
          { column: 'c-rhlNSZ2BLc', value: sop },
          { column: 'c-1Hs9TvZi8D', value: sopName },  
          { column: 'c-F0C8ROruiq', value: targetUrl },
          { column: 'c-Bnd91_0ohs', value: user },
          { column: 'c-uOLRfDdGlm', value: userName }, 
          { column: 'c-9RvcvQbDA4', value: dateStr },         
          { column: 'c-EWB8bbzx0H', value: timeStr }, 
        ],
      },
    ],
  };

  console.log('Payload being sent to Coda:', JSON.stringify(payload, null, 2));
  console.log('Env check:', {
    CODA_API_KEY: CODA_API_KEY ? 'SET' : 'MISSING',
    CODA_DOC_ID,
    CODA_TABLE_ID,
  });

  // Log click to Coda before redirect
  try {
    const codaRes = await fetch(
      `https://coda.io/apis/v1/docs/${CODA_DOC_ID}/tables/${encodeURIComponent(CODA_TABLE_ID)}/rows`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CODA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const resText = await codaRes.text();
    if (!codaRes.ok) {
      console.error('Coda API error:', codaRes.status, resText);
    } else {
      console.log('Coda API success:', resText);
    }
  } catch (error) {
    console.error('Error logging to Coda:', error);
  }

  // Redirect to target
  return res.redirect(targetUrl);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
