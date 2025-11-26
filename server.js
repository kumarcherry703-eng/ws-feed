// --------------------------------------
// REAL PRICE + SIMULATED MARKET FEED WS
// Render FREE Hosting Version
// --------------------------------------

const WebSocket = require("ws");
const http = require("http");
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const PORT = process.env.PORT || 10000;
const TICK_INTERVAL = 500;
const REAL_FETCH_INTERVAL = 4000;

// Real symbols list
const SYMBOLS = [
  "RELIANCE.NS","TCS.NS","INFY.NS","SBIN.NS","HDFCBANK.NS","ICICIBANK.NS",
  "TATAMOTORS.NS","HINDUNILVR.NS","LT.NS","WIPRO.NS","SUNPHARMA.NS",
  "AXISBANK.NS","POWERGRID.NS","ASIANPAINT.NS"
];

// Store real prices -> symbol: price
let REAL = {};

// Fetch real NSE price from Yahoo
async function fetchReal(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const r = await fetch(url);
    const d = await r.json();
    return d.quoteResponse.result[0]?.regularMarketPrice || null;
  } catch {
    return null;
  }
}

// Update real prices continuously
async function updateReal() {
  for (let s of SYMBOLS) {
    const p = await fetchReal(s);
    if (p) REAL[s] = p;
  }
}
setInterval(updateReal, REAL_FETCH_INTERVAL);
updateReal();

// Simulate price around real price
function simulate(real) {
  if (!real) return null;
  const micro = (Math.random() - 0.5) * 1.2;
  return +(real + micro).toFixed(2);
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

function generateTick(sym) {
  const real = REAL[sym];
  if (!real) return null;

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

// ------------ WebSocket Server Setup -------------
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.send(JSON.stringify({ type: "welcome", msg: "Connected to Real-Stimulated Feed" }));
});

// send ticks every 500ms
setInterval(() => {
  const ticks = [];

  for (let i = 0; i < 10; i++) {
    const s = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
    const t = generateTick(s);
    if (t) ticks.push(t);
  }

  const pack = JSON.stringify({
    type: "batch_ticks",
    timestamp: new Date().toISOString(),
    ticks
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(pack);
  });

}, TICK_INTERVAL);

server.listen(PORT, () => console.log("WS server running on", PORT));
