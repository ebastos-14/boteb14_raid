const tmi = require('tmi.js');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

// ===============================
const CHANNEL_TOKENS = {
  "ebastos14_": process.env.EB14_TOKEN,
  "jaciitv": process.env.JACIITV_TOKEN,
  "hholasoynuevo": process.env.HHOLA_TOKEN,
  "boteb14": process.env.BOTEB14_TOKEN,
  "mrryden": process.env.MRRYDEN_TOKEN,
  "tempcount1": process.env.TEMP1_TOKEN,
  "tempcount2": process.env.TEMP2_TOKEN,
  "tempcount3": process.env.TEMP3_TOKEN
};

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
// 🔐 AUTH
function isAuthorized(tags) {
  return tags.mod || (tags.badges && tags.badges.broadcaster === '1');
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
    if (!data.data || data.data.length === 0) return 100;
    return data.data[0].viewer_count;

  } catch {
    return 10;
  }
}

// ===============================
let matches = {};

const DEFAULT_DURATION = 45000;
const DEFAULT_MAX_ATTACKS = 100;
const BOSS_DELAY = 5000;

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

      duration: DEFAULT_DURATION,
      maxAttacks: DEFAULT_MAX_ATTACKS
    };
  }

  return matches[key];
}

// ===============================
function parseCustomEvent(message) {
  const parts = message.split(" ");

  let duration = null;
  let maxAttacks = null;

  parts.forEach(p => {

    if (p.endsWith("m")) {
      const val = parseInt(p);
      if (!isNaN(val)) duration = val * 60000;
    }

    if (p.endsWith("s")) {
      const val = parseInt(p);
      if (!isNaN(val)) duration = val * 1000;
    }

    if (p.endsWith("a")) {
      const val = parseInt(p);
      if (!isNaN(val)) maxAttacks = val;
    }

  });

  if (duration && duration > 10 * 60000) duration = 10 * 60000;
  if (maxAttacks && maxAttacks > 500) maxAttacks = 500;

  return { duration, maxAttacks };
}

// ===============================
async function startEvent(channelRaw) {

  const channel = cleanChannel(channelRaw);
  const match = getMatch(channel);

  if (match.active) return false;

  match.active = true;
  match.finished = false;
  match.bossSpawned = false;
  match.damageLog = {};
  match.endTime = 0;

  const players = await getViewerCount(channel);

  match.bossName = bosses[Math.random() * bosses.length | 0];
  match.bossMaxHP = 3 * players;
  match.bossHP = 3 * players;
  match.startTime = Date.now();

  client.say(normalizeChannel(channel), "📢 Evento iniciando...");
  client.say(normalizeChannel(channel), "💥 Usa !attack 💥");

  setTimeout(() => {

    match.bossSpawned = true;

    client.say(
      normalizeChannel(channel),
      `👹 ${match.bossName} ❤️ ${match.bossMaxHP}`
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
    const remaining = Math.max(0, match.duration - elapsed);
    const sec = Math.ceil(remaining / 1000);

    if ([30,20,10].includes(sec)) {
      client.say(normalizeChannel(channel),
        `⏱️ ${sec}s - ❤️ ${Math.floor(match.bossHP)}`
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

  const msg = message.toLowerCase().trim();

  // 🔒 CUSTOM EVENT SOLO MOD/STREAMER
  if (msg.startsWith('!customevent')) {

    if (!isAuthorized(tags)) return;

    const { duration, maxAttacks } = parseCustomEvent(msg);

    if (duration) match.duration = duration;
    if (maxAttacks) match.maxAttacks = maxAttacks;

    client.say(channel,
      `⚙️ Custom: ⏱️ ${duration ? duration/1000+"s" : "default"} | ⚔️ ${maxAttacks || "default"}`
    );

    return;
  }

  // ===============================
  if (!match.active || match.finished || !match.bossSpawned) return;

  if (!['!attack','!a'].includes(msg)) return;

  const user = tags.username;

  if (!match.damageLog[user]) match.damageLog[user] = [];

  if (match.damageLog[user].length >= match.maxAttacks) return;

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

  return Object.entries(match.damageLog)
    .map(([user,hits]) => ({
      user,
      maxHit: Math.max(...hits)
    }))
    .sort((a,b)=>b.maxHit-a.maxHit)
    .slice(0,3);
}

// ===============================
function finishMatch(channelRaw, win) {

  const channel = cleanChannel(channelRaw);
  const match = getMatch(channel);

  if (!match.active || match.finished) return;

  match.active = false;
  match.finished = true;
  match.endTime = Date.now();

  if (match.interval) clearInterval(match.interval);

  const target = normalizeChannel(channel);

  client.say(target,
    win ? `🏆 Victoria` : `☠️ Derrota`
  );

  const top3 = buildTop3(match);

  client.say(target,
    top3.map((p,i)=>
      `${["🥇","🥈","🥉"][i]} ${p.user} ${Math.floor(p.maxHit)}`
    ).join(" - ")
  );

  match.duration = DEFAULT_DURATION;
  match.maxAttacks = DEFAULT_MAX_ATTACKS;
}

// ===============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🔥 BOT SEGURO LISTO 🔥");
});
