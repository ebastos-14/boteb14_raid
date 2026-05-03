const tmi = require('tmi.js');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

// ===============================
// 🔐 TOKENS POR CANAL (MANUAL)
const CHANNEL_TOKENS = {
  "ebastos14_": "550e8400-e29b-41d4-a716-446655440000",
  "jaciitv": "c1a9f6d2-8c3a-4f8b-bb1e-9d8e7c6b5a4f",
  "boteb14": "c1e8a7f2-5b3d-4c9a-91e6-2f7d0b8a6c55"
};

// ===============================
const MAX_ATTACKS = 10;
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
// 🧠 VERIFICAR SI ESTA EN VIVO
async function isChannelLive(channel) {
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
    return data.data && data.data.length > 0;

  } catch (err) {
    console.error("Error verificando stream:", err);
    return false;
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

      damageLog: {},
      isLive: false
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

  // 🔥 VERIFICAR SI ESTA EN VIVO
  const live = await isChannelLive(channel);
  match.isLive = live;

  let players;

  if (live) {
    players = 10;
    console.log(`🟢 ${channel} ONLINE`);
  } else {
    players = 3;
    console.log(`⚫ ${channel} OFFLINE`);
  }

  match.bossName = bosses[Math.floor(Math.random() * bosses.length)];
  match.bossMaxHP = 100 + players * 20;
  match.bossHP = match.bossMaxHP;
  match.startTime = Date.now();

  client.say(normalizeChannel(channel), "📢 iniciando...");
  client.say(normalizeChannel(channel), "💥 Usa !attack para pelear");

  setTimeout(() => {

    match.bossSpawned = true;

    client.say(
      normalizeChannel(channel),
      `👹 ${match.bossName} ha aparecido (${live ? "LIVE" : "OFFLINE"})`
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
      client.say(
        normalizeChannel(channel),
        `⏱️ ${sec}s - ❤️ ${Math.floor(match.bossHP)}/${match.bossMaxHP}`
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
  if (msg !== '!attack' && msg !== '!a') return;

  const user = tags.username;

  if (!match.damageLog[user]) match.damageLog[user] = [];

  if (match.damageLog[user].length >= MAX_ATTACKS) return;

  const dmg = (10 + 5) * (0.5 + Math.random());

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
    client.say(target, `🏆 Victoria contra ${match.bossName}`);
  } else {
    client.say(target, `☠️ ${match.bossName} escapó`);
  }

  const top3 = buildTop3(match);

  const text =
    `📊 ${Object.keys(match.damageLog).length} jugadores - ` +
    top3.map((p, i) =>
      `${["🥇","🥈","🥉"][i]} ${p.user} ${Math.floor(p.maxHit)}`
    ).join(" - ");

  client.say(target, text);
}

// ===============================
// 🔐 ENDPOINT START
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
      boss: match.bossName,
      hp: Math.floor(match.bossHP),
      maxHP: match.bossMaxHP,
      timeLeft: remaining,
      live: match.isLive
    });
  }

  return res.json({
    active:false,
    finished:true,
    result: match.bossHP <= 0 ? "win" : "lose"
  });
});

// ===============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🔥 BOT LISTO CON VERIFICACION DE STREAM 🔥");
});
