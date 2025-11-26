// ------------------------------------------------------
// REAL MARKET PRICE + SIMULATED MARKET FEED (NEOSTOX STYLE)
// Render FREE HOSTING + MoneyControl LTP API (UNLIMITED)
// ------------------------------------------------------

const WebSocket = require("ws");
const http = require("http");
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const PORT = process.env.PORT || 10000;

// INTERVALS
const TICK_INTERVAL = 500;
const REAL_FETCH_INTERVAL = 4000;

// NSE Symbols
const SYMBOLS = [
  "RELIANCE.NS","TCS.NS","INFY.NS","SBIN.NS","HDFCBANK.NS","ICICIBANK.NS",
  "TATAMOTORS.NS","HINDUNILVR.NS","LT.NS","WIPRO.NS","SUNPHARMA.NS",
  "AXISBANK.NS","POWERGRID.NS","ASIANPAINT.NS"
];

// Store real values
let REAL = {};

// ------------------------------------------------------
// REAL NSE PRICE FETCH (MONEYCONTROL) — UNLIMITED
// ------------------------------------------------------
async function fetchReal(symbol) {
  try {
    const pure = symbol.replace(".NS", "");
    const url = `https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/${pure}`;

    const r = await fetch(url);
    const d = await r.json();

    const price = d?.data?.pricecurrent;
    if (!price) return null;

    return Number(price);

  } catch (e) {
    console.log("Real fetch error:", e);
    return null;
  }
}

async function updateReal() {
  console.log("Updating real prices...");
  for (let s of SYMBOLS) {
    const p = await fetchReal(s);
    if (p !== null) REAL[s] = p;
  }
}
setInterval(updateReal, REAL_FETCH_INTERVAL);
updateReal();

// ------------------------------------------------------
// SAFE SIMULATOR
// ------------------------------------------------------
function simulateSafe(real) {
  if (!real || isNaN(real)) return null;

  const micro = (Math.random() - 0.5) * 1.2;
  return +(Number(real) + micro).toFixed(2);
}

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

// ------------------------------------------------------
// FIXED: SYMBOL ALWAYS PRINTS
// ------------------------------------------------------
function generateTick(sym) {

  const symbolName = sym.replace(".NS", "");

  const real = REAL[sym];
  const ltp = simulateSafe(real);

  const finalLTP = ltp || (100 + Math.random() * 200);
  const finalReal = real || finalLTP;

  return {
    type: "tick",
    symbol: symbolName,  // FIX: Symbol always included
    ltp: finalLTP,
    real_price: finalReal,
    timestamp: new Date().toISOString(),
    volume: Math.floor(Math.random() * 900000),
    oi: Math.floor(Math.random() * 30000),
    depth: makeDepth(finalLTP)
  };
}

// ------------------------------------------------------
// HTTP SERVER FOR RENDER
// ------------------------------------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket Feed Server Running");
});

// ------------------------------------------------------
// WEBSOCKET SERVER
// ------------------------------------------------------
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send(JSON.stringify({
    type: "welcome",
    msg: "Connected to LIVE REAL + SIMULATED MARKET FEED"
  }));
});

// ------------------------------------------------------
// SEND 10 TICKS EVERY 500ms
// ------------------------------------------------------
setInterval(() => {
  const ticks = [];

  for (let i = 0; i < 10; i++) {
    const s = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
    ticks.push(generateTick(s));
  }

  const packet = JSON.stringify({
    type: "batch_ticks",
    timestamp: new Date().toISOString(),
    ticks
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(packet);
  });

}, TICK_INTERVAL);

// ------------------------------------------------------
// PORT BINDING FOR RENDER
// ------------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  console.log("WS server running on", PORT);
});
