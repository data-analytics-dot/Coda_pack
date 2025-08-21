import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import { google } from "googleapis";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;
// Track recent clicks to prevent duplicates
const recentClicks = new Map(); // key: user+sop, value: timestamp in ms


// --- Google OAuth setup ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI; // e.g. https://traceable-link.onrender.com/auth/callback
const CODA_DOC_ID = process.env.CODA_DOC_ID;
const CODA_TABLE_ID = process.env.CODA_TABLE_ID;
const CODA_API_KEY = process.env.CODA_API_KEY;


const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// --- Session setup ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: true,
  })
);

// --- Step 1: Incoming tracking link ---
app.get("/", (req, res) => {
  const { sop, sopName, target } = req.query;

  // If user already logged in, go straight to /go
  if (req.session.user) {
    return res.redirect("/go");
  }

  // Save pending state for after OAuth
  req.session.pending = { sop, sopName, target };

  // Generate OAuth URL
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    login_hint: req.session.user?.email || "", // Hint account if known
    // prompt: "none", // Uncomment to try silent login first
  });

  return res.redirect(url);
});

// --- Step 2: OAuth callback ---
app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch user info
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userinfo = await oauth2.userinfo.get();

  req.session.user = {
    email: userinfo.data.email,
    name: userinfo.data.name,
  };

  return res.redirect("/go");
});

// --- Step 3: Logging + redirect to Coda ---
app.get("/go", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const { sop, sopName, target } = req.session.pending || {};
  const { email, name } = req.session.user;

  const key = `${email}-${sop}`;
  const nowMs = Date.now();
  if (recentClicks.has(key) && nowMs - recentClicks.get(key) < 3000) {
    console.log(`Duplicate rapid click detected, skipping log for ${key}`);
    return res.redirect(decodeURIComponent(target));
  }
  recentClicks.set(key, nowMs);
  setTimeout(() => recentClicks.delete(key), 5000); // cleanup

 const now = new Date();
  const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // UTC+8

  // Format date (YYYY-MM-DD) → keep as is
  const dateStr = phTime.getUTCFullYear() + "-" +
    String(phTime.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(phTime.getUTCDate()).padStart(2, "0");

  // Format timestamp → 12-hour time with AM/PM
  let hours = phTime.getUTCHours();
  const minutes = String(phTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(phTime.getUTCSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // convert 0 -> 12 for 12AM
  const timeStr = `${hours}:${minutes}:${seconds} ${ampm}`; // e.g., "5:46:01 PM"
  
  // ✅ Log to console
  console.log("CLICK LOG:", {
    sop,
    sopName,
    target,
    email,
    name,
    date: dateStr,
    timestamp: timeStr,
  });

  // --- Log to Coda ---
  try {
    const codaResponse = await axios.post(
      `https://coda.io/apis/v1/docs/${CODA_DOC_ID}/tables/${CODA_TABLE_ID}/rows`,
      {
        rows: [
          {
            cells: [
              { column: "c-rhlNSZ2BLc", value: sop || "" },
              { column: "c-1Hs9TvZi8D", value: sopName || "" },
              { column: "c-F0C8ROruiq", value: target || "" },
              { column: "c-Bnd91_0ohs", value: email || "" },
              { column: "c-uOLRfDdGlm", value: name || "" },
              { column: "c-9RvcvQbDA4", value: dateStr }, 
              { column: "c-EWB8bbzx0H", value: timeStr },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${CODA_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Coda logging response:", codaResponse.data);
  } catch (err) {
    console.error("Error logging to Coda:", err.response?.data || err.message);
  }

  // Redirect to target URL
  res.redirect(decodeURIComponent(target));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});






