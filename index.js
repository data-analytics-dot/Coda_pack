import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables from Render (set these in your Render dashboard)
const CODA_API_KEY = process.env.CODA_API_KEY;
const CODA_DOC_ID = process.env.CODA_DOC_ID;
const CODA_TABLE_ID = process.env.CODA_TABLE_ID;

app.get('/', async (req, res) => {
  console.log('Incoming request query:', req.query);

  // Required: Target URL for redirect
  let targetUrl = req.query.target || req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing target URL');
  }

  // Extract SOP value (from query param "sop" or "sopKey")
  let sop = req.query.sop || req.query.sopKey || 'Unknown';

  // Extract user email from query (passed from CreateSopTraceLink)
  let userEmail = req.query.user || 'Unknown';

  // Date in YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  // Coda payload
  const payload = {
    rows: [
      {
        cells: [
          { column: 'c-7GUpG84D4a', value: sop },       // COL_SOP
          { column: 'c-pIIz5IhJJZ', value: today },     // COL_DATE
          { column: 'c-pzBgI-pKEK', value: targetUrl }, // COL_URL
          { column: 'c-brtrqo4tMV', value: userEmail }, // COL_USER (fixed typo!)
        ],
      },
    ],
  };

  console.log('Payload to Coda:', JSON.stringify(payload, null, 2));

  // Send to Coda
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

  // Redirect to final target
  return res.redirect(targetUrl);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
