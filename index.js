const tmi = require('tmi.js');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

// ===============================
// 🔐 TOKENS POR CANAL
const CHANNEL_TOKENS = {
  "ebastos14_": "550e8400-e29b-41d4-a716-446655440000",
  "jaciitv": "9b2f6a1d-3e4c-4a8b-9d72-5f1c8e7a6b20",
  "hholasoynuevo": "4d7a9c3e-1f52-47b8-a6d1-8e2f5c9b0a73",
  "boteb14": "8c1e2f7a-6b4d-4a9c-8f21-3d5e7b0a9c62",
  "mrryden": "2f9b6c1d-3a7e-4d8f-b521-6c0a9e3b7d45"
};

// ===============================
const MAX_ATTACKS = 1; // 👈 PRODUCCIÓN
const START_COOLDOWN = 10000;
let lastStart = {};

const CHANNELS = Object.keys(CHANNEL_TOKENS);

// ⚙️ CONFIG BALANCE
const ACTIVE_PERCENT = 0.3;
const AVG_DAMAGE = 15;

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
// 🔴 / 🟢 STREAM DATA
async function getStreamData(channel) {
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

    if (!data.data || data.data.length === 0) {
      return { live: false, viewers: 0 };
    }

    return {
      live: true,
      viewers: data.data[0].viewer_count
    };

  } catch (err) {
    console.error(err);
    return { live: false, viewers: 0 };
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
// 🚀 START EVENT
async function startEvent(channelRaw) {

  const channel = cleanChannel(channelRaw);
  const match = getMatch(channel);

  if (match.active) return false;

  match.active = true;
  match.finished = false;
  match.bossSpawned = false;
  match.damageLog = {};
  match.endTime = 0;

  const stream = await getStreamData(channel);

  let hp;

  if (!stream.live) {
    hp = 100; // 🔴 OFFLINE
    console.log(`OFFLINE → HP ${hp}`);
  } else {
    const activePlayers = stream.viewers * ACTIVE_PERCENT;

    hp = activePlayers * AVG_DAMAGE;

    // 🔢 Redondeo a centenas
    hp = Math.ceil(hp / 100) * 100;

    console.log(`ONLINE → viewers:${stream.viewers} HP:${hp}`);
  }

  match.bossName = bosses[Math.floor(Math.random() * bosses.length)];
  match.bossMaxHP = hp;
  match.bossHP = hp;
  match.startTime = Date.now();

  client.say(normalizeChannel(channel), "⚔️ Evento iniciado!");
  client.say(normalizeChannel(channel), "💥 Usa !attack");

  setTimeout(() => {
    match.bossSpawned = true;
    client.say(normalizeChannel(channel), `👹 ${match.bossName} apareció con ${hp} HP`);
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
  if (msg !== '!attack') return;

  const user = tags.username;

  if (!match.damageLog[user]) match.damageLog[user] = [];

  if (match.damageLog[user].length >= MAX_ATTACKS) return;

  // 🔥 DAÑO RANDOM
  const dmg = Math.floor((10 + 5) * (0.5 + Math.random()));

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

  return entries.map(([user, hits]) => ({
    user,
    maxHit: Math.max(...hits)
  })).sort((a, b) => b.maxHit - a.maxHit).slice(0, 3);
}

// ===============================
function finishMatch(channelRaw, win) {

  const channel = cleanChannel(channelRaw);
  const match = getMatch(channel);

  if (!match.active || match.finished) return;

  match.active = false;
  match.finished = true;

  if (match.interval) clearInterval(match.interval);

  const target = normalizeChannel(channel);

  client.say(target, win ? "🏆 Victoria!" : "☠️ Derrota!");

  const top3 = buildTop3(match);

  const text = top3.map((p, i) =>
    `${["🥇","🥈","🥉"][i]} ${p.user} (${Math.floor(p.maxHit)})`
  ).join(" - ");

  client.say(target, text);
}

// ===============================
app.get('/start', async (req, res) => {

  const channel = (req.query.channel || "").toLowerCase();
  const token = req.query.token;

  if (!CHANNEL_TOKENS[channel] || CHANNEL_TOKENS[channel] !== token) {
    return res.status(403).end();
  }

  if (lastStart[channel] && Date.now() - lastStart[channel] < START_COOLDOWN) {
    return res.status(429).send("Cooldown");
  }

  lastStart[channel] = Date.now();

  client.join(normalizeChannel(channel)).catch(() => {});
  await startEvent(channel);

  res.status(204).end();
});

// ===============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🔥 BOT BALANCEADO LISTO 🔥");
});
