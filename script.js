/* ============================================================
   CONFIG — edit these before going live
   ============================================================ */
const CONFIG = {
  // Your Discord user ID (right-click your profile in Discord with
  // Developer Mode on > Copy User ID). You also need to join the
  // Lanyard discord server once (discord.gg/lanyard) so it can see
  // your presence — you don't need to do anything there besides join.
  LANYARD_USER_ID: "PUT_YOUR_DISCORD_USER_ID_HERE",

  // Discord webhook URL (Server Settings > Integrations > Webhooks
  // > New Webhook > Copy URL). Both buttons post here, just tagged
  // with different colors so you can tell them apart.
  WEBHOOK_URL: "PUT_YOUR_DISCORD_WEBHOOK_URL_HERE",

  // how often to refresh the live status panel (ms)
  STATUS_POLL_MS: 15000,

  // minimum seconds between sends per visitor, per action, so the
  // webhook can't get hammered
  COOLDOWN_SECONDS: 45,
};

const MESSAGE_OPTIONS = [
  "👋 just stopping by to say hi",
  "🎵 your noise music goes hard",
  "🖥️ rate my rice?? (jk... unless)",
  "👀 found you a good liminal space pic",
  "🎮 wanna co-op sometime?",
];

const CHALLENGE_GAMES = [
  "Minecraft",
  "Helldivers 2",
  "Fortnite",
  "surprise me",
];

/* ============================================================
   live status panel (Lanyard)
   ============================================================ */
const statusVal = document.getElementById("statusVal");
const activityVal = document.getElementById("activityVal");

const STATUS_META = {
  online: { label: "● ONLINE", color: "var(--online)" },
  idle: { label: "● IDLE", color: "var(--idle)" },
  dnd: { label: "● DO NOT DISTURB", color: "var(--dnd)" },
  offline: { label: "● OFFLINE", color: "var(--offline)" },
};

async function fetchStatus() {
  if (!CONFIG.LANYARD_USER_ID || CONFIG.LANYARD_USER_ID.startsWith("PUT_")) {
    statusVal.textContent = "not configured";
    activityVal.textContent = "add your Discord ID in script.js";
    return;
  }

  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${CONFIG.LANYARD_USER_ID}`);
    const json = await res.json();
    if (!json.success) throw new Error("lanyard lookup failed");

    const d = json.data;
    const meta = STATUS_META[d.discord_status] || STATUS_META.offline;
    statusVal.textContent = meta.label;
    statusVal.style.color = meta.color;

    if (d.listening_to_spotify && d.spotify) {
      activityVal.textContent = `listening — ${d.spotify.artist} · ${d.spotify.song}`;
    } else {
      const game = (d.activities || []).find((a) => a.type === 0);
      if (game) {
        activityVal.textContent = game.details
          ? `playing ${game.name} — ${game.details}`
          : `playing ${game.name}`;
      } else {
        activityVal.textContent = "no activity detected";
      }
    }
  } catch (err) {
    statusVal.textContent = "⚠ unreachable";
    activityVal.textContent = "couldn't reach Lanyard";
  }
}

fetchStatus();
setInterval(fetchStatus, CONFIG.STATUS_POLL_MS);

/* uptime counter — just how long this tab has been open, for flavor */
const uptimeVal = document.getElementById("uptimeVal");
const startTime = Date.now();
setInterval(() => {
  const secs = Math.floor((Date.now() - startTime) / 1000);
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  uptimeVal.textContent = `${m}:${s}`;
}, 1000);

/* ============================================================
   modals
   ============================================================ */
function openModal(el) { el.classList.remove("hidden"); }
function closeModal(el) { el.classList.add("hidden"); }

const modalMessage = document.getElementById("modalMessage");
const modalChallenge = document.getElementById("modalChallenge");

document.getElementById("openMessage").addEventListener("click", () => openModal(modalMessage));
document.getElementById("openChallenge").addEventListener("click", () => openModal(modalChallenge));

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", (e) => closeModal(e.target.closest(".modal-overlay")));
});
[modalMessage, modalChallenge].forEach((overlay) => {
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(overlay); });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(modalMessage); closeModal(modalChallenge); }
});

/* ============================================================
   cooldown helper (per visitor, via localStorage)
   ============================================================ */
function secondsLeft(key) {
  const last = parseInt(localStorage.getItem(key) || "0", 10);
  const elapsed = (Date.now() - last) / 1000;
  return Math.max(0, CONFIG.COOLDOWN_SECONDS - elapsed);
}
function markSent(key) {
  localStorage.setItem(key, String(Date.now()));
}

/* ============================================================
   toast
   ============================================================ */
const toastEl = document.getElementById("toast");
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
}

/* ============================================================
   sending to the webhook
   ============================================================ */
async function sendToDiscord({ description, colorHex, cooldownKey }) {
  if (!CONFIG.WEBHOOK_URL || CONFIG.WEBHOOK_URL.startsWith("PUT_")) {
    showToast("webhook not configured yet");
    return false;
  }

  const wait = secondsLeft(cooldownKey);
  if (wait > 0) {
    showToast(`slow down — try again in ${Math.ceil(wait)}s`);
    return false;
  }

  try {
    await fetch(CONFIG.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          description,
          color: parseInt(colorHex, 16),
        }],
      }),
    });
    markSent(cooldownKey);
    return true;
  } catch (err) {
    showToast("send failed — try again later");
    return false;
  }
}

/* ============================================================
   populate option lists
   ============================================================ */
const messageList = document.getElementById("messageOptions");
MESSAGE_OPTIONS.forEach((text) => {
  const btn = document.createElement("button");
  btn.className = "option-btn";
  btn.textContent = text;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const ok = await sendToDiscord({
      description: `**New message from the site:**\n${text}`,
      colorHex: "22d3ee", // cyan
      cooldownKey: "lastMsgSent",
    });
    closeModal(modalMessage);
    showToast(ok ? "sent — thanks!" : "");
    btn.disabled = false;
  });
  messageList.appendChild(btn);
});

const challengeList = document.getElementById("challengeOptions");
CHALLENGE_GAMES.forEach((game) => {
  const btn = document.createElement("button");
  btn.className = "option-btn";
  btn.textContent = game;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const ok = await sendToDiscord({
      description: `**🎮 Challenge incoming:** someone wants to play **${game}** with you!`,
      colorHex: "a855f7", // purple
      cooldownKey: "lastChallengeSent",
    });
    closeModal(modalChallenge);
    showToast(ok ? "challenge sent!" : "");
    btn.disabled = false;
  });
  challengeList.appendChild(btn);
});
