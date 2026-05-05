const tmi = require('tmi.js');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

// ===============================
// 🔐 TOKENS POR CANAL (MANUAL)
const CHANNEL_TOKENS = {
  "ebastos14_": process.env.EB14_TOKEN,
  "jaciitv": process.env.JACIITV_TOKEN,
  "customtemptoken1": process.env.TEMP1_TOKEN,
  "customtemptoken2": process.env.TEMP2_TOKEN,
  "kuruogg": process.env.MRRYDEN_TOKEN,
  "customtemptoken4": process.env.TEMP4_TOKEN,
  "customtemptoken5": process.env.TEMP5_TOKEN,
  "customtemptoken6": process.env.TEMP6_TOKEN
};

// ===============================
const MAX_ATTACKS = 100;
const START_COOLDOWN = 10000;
let lastStart = {};

const CHANNELS = Object.keys(CHANNEL_TOKENS);

// ===============================
function normalizeChannel(channel) {
  return channel.startsWith('#') ? channel : `#${channel}`;
}

function cleanChannel(channel) {
  return channel.replace('#', '').toLowerCase();
}

// ===============================
// 🔥 TWITCH CLIENT
const client = new tmi.Client({
  options: { debug: true, reconnect: true },
  identity: {
    username: process.env.TWITCH_USER,
    password: process.env.TWITCH_OAUTH
  },
  channels: CHANNELS.map(normalizeChannel)
});

client.connect();

// ===============================
// 👥 VIEWERS EXACTOS (ONLINE/OFFLINE)
async function getViewerCount(channel) {
  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${channel}`,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${process.env.TWITCH_APP_TOKEN}`
        }
      }
    );

    const data = await res.json();

    // OFFLINE
    if (!data.data || data.data.length === 0) {
      return 100;
    }

    // ONLINE → valor exacto
    return data.data[0].viewer_count;

  } catch (err) {
    console.error("Error viewers:", err);
    return 10;
  }
}

// ===============================
let matches = {};

const BOSS_DELAY = 5000;
const DURATION = 45000;

const bosses = [
  "Constructor",
  "Sacerdotiza Avaloniana",
  "Basilisco",
  "Capitán Caballero",
  "Reina Danzante",
  "Sir Bedivere"
];

// ===============================
function getMatch(channel) {

  const key = cleanChannel(channel);

  if (!matches[key]) {
    matches[key] = {
      active: false,
      finished: false,
      bossSpawned: false,

      bossName: "",
      bossHP: 0,
      bossMaxHP: 0,

      startTime: 0,
      endTime: 0,

      interval: null,

      damageLog: {}
    };
  }

  return matches[key];
}

// ===============================
// 🚀 INICIAR EVENTO
async function startEvent(channelRaw) {

  const channel = cleanChannel(channelRaw);
  const match = getMatch(channel);

  if (match.active) return false;

  match.active = true;
  match.finished = false;
  match.bossSpawned = false;
  match.damageLog = {};
  match.endTime = 0;

  // 👥 PLAYERS DINÁMICOS (EXACTOS)
  const players = await getViewerCount(channel);

  console.log("PLAYERS =", players);

  match.bossName = bosses[Math.floor(Math.random() * bosses.length)];
  match.bossMaxHP = 14 * players * 0.3;
  match.bossHP = 14 * players * 0.3;
  match.startTime = Date.now();
  
  client.say(normalizeChannel(channel), "📢 Evento en camino... 📢");
  client.say(normalizeChannel(channel), "💥 Recuerda participar usando !attack 💥");

  setTimeout(() => {

    match.bossSpawned = true;

    client.say(
      normalizeChannel(channel),
    `👹 ${match.bossName} ha aparecido ❤️ ${10 * players * 0.3} 👹`
    );

    runClock(channel);

  }, BOSS_DELAY);

  return true;
}

// ===============================
function runClock(channelRaw) {

  const channel = cleanChannel(channelRaw);
  const match = getMatch(channel);

  if (match.interval) clearInterval(match.interval);

  match.interval = setInterval(() => {

    if (!match.active || !match.bossSpawned) return;

    const elapsed = Date.now() - match.startTime;
    const remaining = Math.max(0, DURATION - elapsed);
    const sec = Math.ceil(remaining / 1000);

    if ([30, 20, 10].includes(sec)) {
      client.say(normalizeChannel(channel),
        `⏱️ ${sec}s - 👹 ${match.bossName} - ❤️ ${Math.floor(match.bossHP)}/${match.bossMaxHP}`
      );
    }

    if (sec <= 0) {
      clearInterval(match.interval);
      match.interval = null;
      finishMatch(channel, false);
    }

  }, 1000);
}

// ===============================
client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const key = cleanChannel(channel);
  const match = getMatch(key);

  if (!match.active || match.finished || !match.bossSpawned) return;

  const msg = message.toLowerCase().trim();
  if (msg !== '!attack' && msg !== '!a' && msg !== '!sorteo' && msg !== '!sorteotv') return;

  const user = tags.username;

  if (!match.damageLog[user]) match.damageLog[user] = [];

  if (match.damageLog[user].length >= MAX_ATTACKS) return;

  const dmg = (10 + 4) * (0.5 + Math.random());

  match.damageLog[user].push(dmg);
  match.bossHP -= dmg;

  if (match.bossHP <= 0) {
    match.bossHP = 0;
    finishMatch(key, true);
  }
});

// ===============================
function buildTop3(match) {

  const entries = Object.entries(match.damageLog);

  const sorted = entries.map(([user, hits]) => ({
    user,
    maxHit: Math.max(...hits)
  })).sort((a, b) => b.maxHit - a.maxHit);

  return sorted.slice(0, 3);
}

// ===============================
function finishMatch(channelRaw, win) {

  const channel = cleanChannel(channelRaw);
  const match = getMatch(channel);

  if (!match.active || match.finished) return;

  match.active = false;
  match.finished = true;
  match.endTime = Date.now();

  if (match.interval) {
    clearInterval(match.interval);
    match.interval = null;
  }

  const target = normalizeChannel(channel);

    if (win) {
    client.say(target, `🏆 Victoria - Hemos vencido a 👹 ${match.bossName} 🏆`);
  } else {
    client.say(target, `☠️ ${match.bossName} ha escapado ☠️`);
  }

  const top3 = buildTop3(match);

  const text =
    `📊 ${Object.keys(match.damageLog).length} Participantes - ` +
    top3.map((p, i) =>
      `${["🥇","🥈","🥉"][i]} ${p.user} ✴️ ${Math.floor(p.maxHit)}`
    ).join(" - ");

  client.say(target, text);
}

// ===============================
// 🔐 ENDPOINT SEGURO
app.get('/start', async (req, res) => {

  const channel = (req.query.channel || "").toLowerCase();
  const token = req.query.token;

  if (!channel || !token) {
    return res.status(400).end();
  }

  if (!CHANNEL_TOKENS[channel]) {
    return res.status(403).end();
  }

  if (CHANNEL_TOKENS[channel] !== token) {
    return res.status(403).end();
  }

  if (lastStart[channel] && Date.now() - lastStart[channel] < START_COOLDOWN) {
    return res.status(429).send("Cooldown activo");
  }

  lastStart[channel] = Date.now();

  client.join(normalizeChannel(channel)).catch(() => {});
  await startEvent(channel);

  res.status(204).end();
});

// ===============================
app.get('/state', (req, res) => {

  const channel = cleanChannel(req.query.channel || "");
  const match = matches[channel];

  if (!match) {
    return res.json({ active:false, finished:false });
  }

  if (match.active) {

    const elapsed = Date.now() - match.startTime;
    const remaining = Math.max(0, 45 - Math.floor(elapsed / 1000));

    return res.json({
      active:true,
      finished:false,
      bossSpawned: match.bossSpawned,
      boss: match.bossName,
      hp: Math.floor(match.bossHP),
      maxHP: match.bossMaxHP,
      timeLeft: remaining
    });
  }

  return res.json({
    active:false,
    finished:true,
    boss: match.bossName,
    result: match.bossHP <= 0 ? "win" : "lose",
    endTime: match.endTime
  });
});

// ===============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🔥 BOT CON VIEWERS EXACTOS LISTO 🔥");
});
