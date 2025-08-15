import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

const CODA_API_KEY = process.env.CODA_API_KEY;
const CODA_DOC_ID = process.env.CODA_DOC_ID;
const CODA_TABLE_ID = process.env.CODA_TABLE_ID;

app.get('/', async (req, res) => {
  const sopKey = req.query.sop;
  const user = req.query.user || 'Unknown';
  if (!sopKey) return res.status(400).send('Missing SOP key');

  // Lookup target URL from Coda by SOP key
  let targetUrl;
  try {
    const response = await fetch(
      `https://coda.io/apis/v1/docs/${CODA_DOC_ID}/tables/${encodeURIComponent(CODA_TABLE_ID)}/rows`,
      { headers: { Authorization: `Bearer ${CODA_API_KEY}` } }
    );
    const data = await response.json();
    
console.log("SOP key from query:", sopKey);
console.log("Available SOP keys:", data.items.map(r => r.values['c-6GZ4CdfgQ2']));

    // Find the row with matching COL_SOPKEY (replace c-rhlNSZ2BLc with your column ID)
    const row = data.items.find(r =>
  r.values['c-6GZ4CdfgQ2']?.trim().toLowerCase() === sopKey?.trim().toLowerCase()
);
    if (!row) return res.status(404).send('SOP key not found');

    // COL_TARGET column ID = c-F0C8ROruiq
    targetUrl = row.values['c-_kMwNG2VcE'];
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error fetching SOP URL');
  }

  const today = new Date().toISOString().split('T')[0];

  // Log click to Coda
  const payload = {
    rows: [
      {
        cells: [
          { column: 'c-rhlNSZ2BLc', value: sopKey },
          { column: 'c-9RvcvQbDA4', value: today },
          { column: 'c-F0C8ROruiq', value: targetUrl },
          { column: 'c-zwWtPBEYNe', value: user },
        ],
      },
    ],
  };

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
    if (!codaRes.ok) console.error('Coda API error:', codaRes.status, await codaRes.text());
  } catch (error) {
    console.error('Error logging to Coda:', error);
  }

  // Redirect to the real target
  return res.redirect(targetUrl);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
