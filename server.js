// ------------------------------------------------------
// REAL MARKET PRICE + SIMULATED MARKET FEED (NEOSTOX STYLE)
// Render FREE HOSTING + MoneyControl LTP API (UNLIMITED)
// ------------------------------------------------------

const WebSocket = require("ws");
const http = require("http");
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const PORT = process.env.PORT || 10000;

// INTERVALS
const TICK_INTERVAL = 500;         // 500ms for WS ticks
const REAL_FETCH_INTERVAL = 4000;  // update real every 4 sec

// NSE STOCK LIST
const SYMBOLS = [
  "RELIANCE.NS","TCS.NS","INFY.NS","SBIN.NS","HDFCBANK.NS","ICICIBANK.NS",
  "TATAMOTORS.NS","HINDUNILVR.NS","LT.NS","WIPRO.NS","SUNPHARMA.NS",
  "AXISBANK.NS","POWERGRID.NS","ASIANPAINT.NS"
];

// Store real prices
let REAL = {};

// ------------------------------------------------------
// 1️⃣ REAL LTP FETCH (UNLIMITED API - MONEYCONTROL)
// ------------------------------------------------------
async function fetchReal(symbol) {
  try {
    const pure = symbol.replace(".NS", ""); // TCS.NS → TCS
    const url = `https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${pure}`;

    const r = await fetch(url);
    const d = await r.json();

    return d.data?.pricecurrent || null;
  } catch (e) {
    console.log("Real fetch error:", e);
    return null;
  }
}

// Update all real prices every 4 sec
async function updateReal() {
  console.log("Updating real prices...");
  for (let s of SYMBOLS) {
    const p = await fetchReal(s);
    if (p) REAL[s] = p;
  }
}
setInterval(updateReal, REAL_FETCH_INTERVAL);
updateReal(); // run immediately

// ------------------------------------------------------
// 2️⃣ SIMULATED TICKS (NEOSTOX STYLE)
// ------------------------------------------------------
function simulate(real) {
  const micro = (Math.random() - 0.5) * 1.2; // smooth movement
  return +(real + micro).toFixed(2);
}

function makeDepth(ltp) {
  return {
    bids: [
      [+(ltp - 0.20).toFixed(2), Math.floor(Math.random() * 2000)],
      [+(ltp - 0.50).toFixed(2), Math.floor(Math.random() * 1500)]
    ],
    asks: [
      [+(ltp + 0.20).toFixed(2), Math.floor(Math.random() * 2000)],
      [+(ltp + 0.50).toFixed(2), Math.floor(Math.random() * 1500)]
    ]
  };
}

function generateTick(sym) {
  const real = REAL[sym];

  // fallback if real fails (rare)
  if (!real) {
    const fallback = 100 + Math.random() * 200;
    return {
      type: "tick",
      symbol: sym.replace(".NS", ""),
      ltp: fallback,
      real_price: fallback,
      timestamp: new Date().toISOString(),
      volume: Math.floor(Math.random() * 900000),
      oi: Math.floor(Math.random() * 30000),
      depth: makeDepth(fallback),
      warning: "fallback used"
    };
  }

  const ltp = simulate(real);

  return {
    type: "tick",
    symbol: sym.replace(".NS", ""),
    ltp,
    real_price: real,
    timestamp: new Date().toISOString(),
    volume: Math.floor(Math.random() * 900000),
    oi: Math.floor(Math.random() * 30000),
    depth: makeDepth(ltp)
  };
}

// ------------------------------------------------------
// 3️⃣ HTTP SERVER (REQUIRED BY RENDER)
// ------------------------------------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket Feed Server Running");
});

// ------------------------------------------------------
// 4️⃣ WEBSOCKET SERVER
// ------------------------------------------------------
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send(JSON.stringify({
    type: "welcome",
    msg: "Connected to LIVE REAL MARKET + SIMULATED FEED"
  }));
});

// ------------------------------------------------------
// 5️⃣ SEND TICKS CONTINUOUSLY
// ------------------------------------------------------
setInterval(() => {
  const ticks = [];

  for (let i = 0; i < 10; i++) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    ticks.push(generateTick(sym));
  }

  const packet = JSON.stringify({
    type: "batch_ticks",
    timestamp: new Date().toISOString(),
    ticks
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(packet);
  });

}, TICK_INTERVAL);

// ------------------------------------------------------
// 6️⃣ PORT BINDING FOR RENDER
// ------------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log("WS server running on", PORT);
});
