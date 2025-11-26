// ------------------------------------------------------
// REAL MARKET PRICE + SIMULATED MARKET FEED (NEOSTOX TYPE)
// Render FREE HOSTING + Yahoo Price Proxy Version
// ------------------------------------------------------

const WebSocket = require("ws");
const http = require("http");
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// Render assigns PORT automatically
const PORT = process.env.PORT || 10000;

// INTERVALS
const TICK_INTERVAL = 500;         // WebSocket tick frequency (500ms)
const REAL_FETCH_INTERVAL = 4000;  // Real price update frequency (4 sec)

// NSE STOCKS (You can add more symbols anytime)
const SYMBOLS = [
  "RELIANCE.NS","TCS.NS","INFY.NS","SBIN.NS","HDFCBANK.NS","ICICIBANK.NS",
  "TATAMOTORS.NS","HINDUNILVR.NS","LT.NS","WIPRO.NS","SUNPHARMA.NS",
  "AXISBANK.NS","POWERGRID.NS","ASIANPAINT.NS"
];

// Store fetched real prices
let REAL = {};

// ------------------------------------------------------
// 1️⃣ REAL MARKET PRICE FETCH (WITH PROXY)
// ------------------------------------------------------
async function fetchReal(symbol) {
  try {
    const yurl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(yurl)}`;

    const r = await fetch(proxy);
    const d = await r.json();

    return d.quoteResponse.result[0]?.regularMarketPrice || null;
  } catch (e) {
    console.log("Real fetch error:", e);
    return null;
  }
}

// Fetch real prices continuously
async function updateReal() {
  console.log("Updating real prices...");
  for (let s of SYMBOLS) {
    const p = await fetchReal(s);
    if (p) REAL[s] = p;
  }
}
setInterval(updateReal, REAL_FETCH_INTERVAL);
updateReal(); // Run immediately

// ------------------------------------------------------
// 2️⃣ GENERATE SIMULATED PRICE (NEOSTOX STYLE)
// ------------------------------------------------------
function simulate(real) {
  if (!real) return null;

  // Very tiny smooth random micro-movement
  const micro = (Math.random() - 0.5) * 1.2;
  return +(real + micro).toFixed(2);
}

// Market depth simulation
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

// Generate individual tick
function generateTick(sym) {
  const real = REAL[sym];

  // Fallback when real price not available (rare)
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
      warning: "real price not available"
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
// 3️⃣ HTTP SERVER (REQUIRED FOR RENDER DETECTION)
// ------------------------------------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket Feed Server Running");
});

// ------------------------------------------------------
// 4️⃣ WebSocket Server Setup
// ------------------------------------------------------
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.send(JSON.stringify({
    type: "welcome",
    msg: "Connected to Real Market + Simulated Feed"
  }));
});

// ------------------------------------------------------
// 5️⃣ SEND TICKS CONTINUOUSLY
// ------------------------------------------------------
setInterval(() => {
  const ticks = [];

  // Send 10 random stocks per tick, like Neostox feed
  for (let i = 0; i < 10; i++) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const tick = generateTick(sym);
    if (tick) ticks.push(tick);
  }

  const packet = JSON.stringify({
    type: "batch_ticks",
    timestamp: new Date().toISOString(),
    ticks
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN)
      client.send(packet);
  });

}, TICK_INTERVAL);

// ------------------------------------------------------
// 6️⃣ RENDER PORT BINDING (MANDATORY)
// ------------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log("WS server running on", PORT);
});
