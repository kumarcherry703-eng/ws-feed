// ------------------------------------------------------
// REAL MARKET PRICE + SIMULATED MARKET FEED (NEOSTOX STYLE)
// Render FREE HOSTING + Yahoo Query2 Version (NO PROXY)
// ------------------------------------------------------

const WebSocket = require("ws");
const http = require("http");
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// Render assigns PORT automatically
const PORT = process.env.PORT || 10000;

// INTERVALS
const TICK_INTERVAL = 500;         // WS ticks every 500ms
const REAL_FETCH_INTERVAL = 4000;  // Real price update every 4 sec

// NSE STOCK LIST
const SYMBOLS = [
  "RELIANCE.NS","TCS.NS","INFY.NS","SBIN.NS","HDFCBANK.NS","ICICIBANK.NS",
  "TATAMOTORS.NS","HINDUNILVR.NS","LT.NS","WIPRO.NS","SUNPHARMA.NS",
  "AXISBANK.NS","POWERGRID.NS","ASIANPAINT.NS"
];

// REAL PRICE STORE
let REAL = {};

// ------------------------------------------------------
// 1️⃣ REAL MARKET FETCH USING YAHOO QUERY2 (VERY STABLE)
// ------------------------------------------------------
async function fetchReal(symbol) {
  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const r = await fetch(url);
    const d = await r.json();

    return d.quoteResponse.result[0]?.regularMarketPrice || null;
  } catch (e) {
    console.log("Real fetch error:", e);
    return null;
  }
}

// Update real prices every 4 sec
async function updateReal() {
  console.log("Updating real prices...");
  for (let s of SYMBOLS) {
    const p = await fetchReal(s);
    if (p) REAL[s] = p;
  }
}
setInterval(updateReal, REAL_FETCH_INTERVAL);
updateReal();

// ------------------------------------------------------
// 2️⃣ NEOSTOX STYLE MICRO SIMULATION
// ------------------------------------------------------
function simulate(real) {
  if (!real) return null;
  const micro = (Math.random() - 0.5) * 1.2;
  return +(real + micro).toFixed(2);
}

// Market depth
function makeDepth(ltp) {
  return {
    bids: [
      [+(ltp - 0.20).toFixed(2), Math.floor(Math.random()*2000)],
      [+(ltp - 0.50).toFixed(2), Math.floor(Math.random()*1500)]
    ],
    asks: [
      [+(ltp + 0.20).toFixed(2), Math.floor(Math.random()*2000)],
      [+(ltp + 0.50).toFixed(2), Math.floor(Math.random()*1500)]
    ]
  };
}

// Tick generator
function generateTick(sym) {
  const real = REAL[sym];

  // Fallback (rare)
  if (!real) {
    const fallback = 100 + Math.random() * 200;
    return {
      type: "tick",
      symbol: sym.replace(".NS", ""),
      ltp: fallback,
      real_price: fallback,
      timestamp: new Date().toISOString(),
      volume: Math.floor(Math.random()*900000),
      oi: Math.floor(Math.random()*30000),
      depth: makeDepth(fallback),
      warning: "fallback used, real price missing"
    };
  }

  const ltp = simulate(real);

  return {
    type: "tick",
    symbol: sym.replace(".NS", ""),
    ltp,
    real_price: real,
    timestamp: new Date().toISOString(),
    volume: Math.floor(Math.random()*900000),
    oi: Math.floor(Math.random()*30000),
    depth: makeDepth(ltp)
  };
}

// ------------------------------------------------------
// 3️⃣ HTTP SERVER (REQUIRED FOR RENDER)
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
    msg: "Connected to REAL MARKET + Simulated Feed"
  }));
});

// ------------------------------------------------------
// 5️⃣ SEND TICKS CONTINUOUSLY
// ------------------------------------------------------
setInterval(() => {
  const ticks = [];

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
// 6️⃣ PORT BIND FOR RENDER
// ------------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log("WS server running on", PORT);
});
