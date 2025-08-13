import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables from Render
const CODA_API_KEY = process.env.CODA_API_KEY;
const CODA_DOC_ID = process.env.CODA_DOC_ID;
const CODA_TABLE_ID = process.env.CODA_TABLE_ID;

app.get('/', async (req, res) => {
  console.log('Incoming query:', req.query);

  // Always use fixed query param names
  const targetUrl = req.query.target;
  const sop = req.query.sop || 'Unknown';
  const userEmail = req.query.user || 'Unknown';

  if (!targetUrl) {
    return res.status(400).send('Missing target URL');
  }

  const today = new Date().toISOString().split('T')[0];

  const payload = {
    rows: [
      {
        cells: [
          { column: 'c-7GUpG84D4a', value: sop },
          { column: 'c-pIIz5IhJJZ', value: today },
          { column: 'c-pzBgI-pKEK', value: targetUrl },
          { column: 'c-brtrqo4tMV', value: userEmail },
        ],
      },
    ],
  };

  console.log('Payload to Coda:', JSON.stringify(payload, null, 2));

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

  // Redirect
  res.redirect(targetUrl);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
