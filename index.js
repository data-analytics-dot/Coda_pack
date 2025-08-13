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

  // Extract SOP value (any param that's not target/url)
  let sop = 'Unknown';
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'target' && key !== 'url' && key !== 'user') {
      sop = value;
      break;
    }
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  let user = req.query.user || 'Unknown';

  // Coda payload
  const payload = {
    rows: [
      {
        cells: [
          { column: 'c-7GUpG84D4a', value: sop },
          { column: 'c-pIIz5IhJJZ', value: today },
          { column: 'c-pzBgI-pKEK', value: targetUrl },
          { column: 'c-brtrqo4tMV', value: user },
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
