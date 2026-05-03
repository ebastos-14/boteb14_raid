const tmi = require('tmi.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// ===============================
// 🔐 TOKENS POR CANAL (MANUAL)
const CHANNEL_TOKENS = {
  "ebastos14_": "550e8400-e29b-41d4-a716-446655440000",
  "jaciitv": "9b2f6a1d-3e4c-4a8b-9d72-5f1c8e7a6b20",
  "hholasoynuevo": "4d7a9c3e-1f52-47b8-a6d1-8e2f5c9b0a73",
  "boteb14": "8c1e2f7a-6b4d-4a9c-8f21-3d5e7b0a9c62",
  "mrryden": "2f9b6c1d-3a7e-4d8f-b521-6c0a9e3b7d45",
  "tempcount1": "5a3d8e1c-9b6f-4c27-ae10-7f2b4d9c6a81",
  "tempcount3": "1d7c5a9e-8b3f-4e2a-9c61-0f8b2d7a4e53",
  "tempcount2": "7e2a4c9d-5b1f-4a83-b6d0-9c3e7f1a2b68"
  
};

// 🔥 LIMITE DE ATAQUES POR USUARIO
const MAX_ATTACKS = 10;

// ⛔ COOL DOWN PARA /start (ANTI SPAM)
const START_COOLDOWN = 10000;
let lastStart = {};

// ===============================
const CHANNELS = Object.keys(CHANNEL_TOKENS);

// ===============================
function normalizeChannel(channel) {
  return channel.startsWith('#') ? channel : `#${channel}`;
}

function cleanChannel(channel) {
  return channel.replace('#', '').toLowerCase();
}

// ===============================
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
function startEvent(channelRaw) {

  const channel = cleanChannel(channelRaw);
  const match = getMatch(channel);

  if (match.active) return false;

  match.active = true;
  match.finished = false;
  match.bossSpawned = false;
  match.damageLog = {};
  match.endTime = 0;

  const players = 10;

  match.bossName = bosses[Math.floor(Math.random() * bosses.length)];
  match.bossMaxHP = players;
  match.bossHP = match.bossMaxHP;
  match.startTime = Date.now();

  client.say(normalizeChannel(channel), "T1");
  client.say(normalizeChannel(channel), "T2");

  setTimeout(() => {

    match.bossSpawned = true;

    client.say(
      normalizeChannel(channel),
      `T3-5`
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
        `T6`
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
    client.say(target, `T7`);
  } else {
    client.say(target, `T8`);
  }

  const top3 = buildTop3(match);

  const text =
    `T9` +
    top3.map((p, i) =>
      `T10`
    ).join(" - ");

  client.say(target, text);
}

// ===============================
// 🔐 ENDPOINT SEGURO
app.get('/start', (req, res) => {

  const channel = (req.query.channel || "").toLowerCase();
  const token = req.query.token;

  if (!channel || !token) {
    return res.status(400).end();
  }

  // ❌ Canal no autorizado
  if (!CHANNEL_TOKENS[channel]) {
    return res.status(403).end();
  }

  // ❌ Token incorrecto
  if (CHANNEL_TOKENS[channel] !== token) {
    return res.status(403).end();
  }

  // ⛔ Anti spam
  if (lastStart[channel] && Date.now() - lastStart[channel] < START_COOLDOWN) {
    return res.status(429).send("Cooldown activo");
  }

  lastStart[channel] = Date.now();

  client.join(normalizeChannel(channel)).catch(() => {});
  startEvent(channel);

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
  console.log("BOT CON TOKENS POR CANAL LISTO 🔐");
});
