const state = {
  userData: null,
  progress: load("carSavingsProgress", []),
  accomplishments: load("carSavingsWins", []),
  messages: [],
  previousScreen: "input",
};

const screens = {
  input: document.querySelector("#screen-input"),
  plan: document.querySelector("#screen-plan"),
  tracker: document.querySelector("#screen-tracker"),
  accomplishments: document.querySelector("#screen-accomplishments"),
  game: document.querySelector("#screen-game"),
};

const game = {
  canvas: document.querySelector("#eco-game"),
  ctx: document.querySelector("#eco-game").getContext("2d"),
  running: false,
  finished: false,
  score: 0,
  timeLeft: 45,
  lane: 1,
  speed: 2.4,
  lastTime: 0,
  spawnTimer: 0,
  items: [],
  keys: new Set(),
};

const upgrades = [
  {
    name: "Catalytic converter",
    detail: "Cuts dirty exhaust from a gas car.",
    points: 40,
    symbol: "CC",
    kind: "converter",
  },
  {
    name: "Low rolling tires",
    detail: "Helps the car use less energy.",
    points: 90,
    symbol: "T",
    kind: "tire",
  },
  {
    name: "Hybrid battery",
    detail: "Adds electric support for city driving.",
    points: 150,
    symbol: "HB",
    kind: "battery",
  },
  {
    name: "Electric motor",
    detail: "Turns the car fully electric.",
    points: 230,
    symbol: "EV",
    kind: "motor",
  },
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[name].classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderAccomplishmentButton();
  if (name === "game") {
    renderGame();
  } else {
    game.running = false;
  }
}

function monthlyIncome(paycheck, frequency) {
  const multipliers = {
    weekly: 4.33,
    biweekly: 2.17,
    twicemonthly: 2,
    monthly: 1,
  };
  return paycheck * multipliers[frequency];
}

function getPlanNumbers() {
  const monthly = monthlyIncome(state.userData.paycheck, state.userData.frequency);
  const available = monthly - state.userData.expenses;
  const needed = state.userData.carPrice / state.userData.timeGoal;
  const weeklyTarget = needed / 4.33;
  const cushion = available - needed;
  return { monthly, available, needed, weeklyTarget, cushion };
}

function getReality(cushion) {
  if (cushion >= 150) return "realistic";
  if (cushion >= 0) return "tight but doable";
  return "needs a backup plan";
}

function challengeTips(challenges) {
  const text = challenges.toLowerCase();
  const tips = [];

  if (text.includes("food") || text.includes("eat") || text.includes("friends")) {
    tips.push("Pick one planned food hangout each week and set the rest aside for the car before you go out.");
  }
  if (text.includes("impulse") || text.includes("buy") || text.includes("shopping")) {
    tips.push("Use a 24-hour pause for non-essential buys. If you still want it tomorrow, compare it with your weekly car target first.");
  }
  if (text.includes("gas") || text.includes("transport")) {
    tips.push("Treat gas like a fixed bill and subtract it before you decide what is safe to spend.");
  }
  if (text.includes("family") || text.includes("help")) {
    tips.push("Decide on a small helping-others amount ahead of time so generosity does not quietly swallow the whole plan.");
  }

  tips.push("Move your weekly target into savings the same day you get paid.");
  tips.push("Keep a simple note after each week: what worked, what tempted you, and what changes next week.");

  return [...new Set(tips)].slice(0, 4);
}

function renderPlan() {
  const { monthly, available, needed, weeklyTarget, cushion } = getPlanNumbers();
  const reality = getReality(cushion);
  const firstThree = [1, 2, 3]
    .filter((month) => month <= state.userData.timeGoal)
    .map((month) => `<li>Month ${month}: ${money.format(needed * month)} saved</li>`)
    .join("");
  const lastMonth = `<li>Month ${state.userData.timeGoal}: ${money.format(state.userData.carPrice)} saved</li>`;

  document.querySelector("#stats-grid").innerHTML = [
    ["Monthly income", monthly],
    ["Monthly target", needed],
    ["Weekly target", weeklyTarget],
    ["Money left after target", cushion],
  ]
    .map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${money.format(value)}</strong></article>`)
    .join("");

  document.querySelector("#plan-output").innerHTML = `
    <section class="coach-section">
      <h2>The numbers</h2>
      <ul>
        <li>Your monthly income is about <strong>${money.format(monthly)}</strong>.</li>
        <li>After monthly expenses, about <strong>${money.format(available)}</strong> is available.</li>
        <li>To hit the goal, save <strong>${money.format(needed)}</strong> each month.</li>
        <li>That comes out to about <strong>${money.format(weeklyTarget)}</strong> per week.</li>
      </ul>
    </section>
    <section class="coach-section">
      <h2>Your timeline</h2>
      <ul>${firstThree}${state.userData.timeGoal > 3 ? lastMonth : ""}</ul>
    </section>
    <section class="coach-section">
      <h2>What could derail you</h2>
      <p>${state.userData.challenges || "The biggest risk is not seeing small spending as real spending. A few casual purchases can erase a week of progress quickly."}</p>
    </section>
    <section class="coach-section">
      <h2>How to stick to it</h2>
      <ul>${challengeTips(state.userData.challenges).map((tip) => `<li>${tip}</li>`).join("")}</ul>
    </section>
    <section class="coach-section">
      <h2>Reality check</h2>
      <p>This goal is <strong>${reality}</strong>. ${
        cushion < 0
          ? `You are short by about ${money.format(Math.abs(cushion))} each month, so try a longer timeline, a lower car price, more income, or a mix of all three.`
          : cushion < 150
            ? "There is not much wiggle room, so missed weeks need to be fixed quickly."
            : "You have enough breathing room to make this work if you keep the weekly habit steady."
      }</p>
    </section>
  `;
}

function renderTracker() {
  const totalSaved = state.progress.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const percent = Math.min((totalSaved / state.userData.carPrice) * 100, 100);
  document.querySelector("#saved-label").textContent = `${money.format(totalSaved)} saved`;
  document.querySelector("#goal-label").textContent = `${money.format(state.userData.carPrice)} goal`;
  document.querySelector("#progress-fill").style.width = `${percent}%`;
  document.querySelector("#percent-label").textContent = `${percent.toFixed(1)}% complete`;
  document.querySelector("#log-title").textContent = `Log week ${state.progress.length + 1}`;

  const list = document.querySelector("#history-list");
  if (!state.progress.length) {
    list.innerHTML = `<div class="empty-state">No progress logged yet. Start with this week.</div>`;
  } else {
    list.innerHTML = state.progress
      .slice()
      .reverse()
      .map(
        (entry) => `
          <article class="history-item">
            <strong>Week ${entry.week} · ${entry.date}</strong>
            <p>${entry.saved ? `Saved ${money.format(entry.amount)}` : "Did not save this week"}</p>
            ${entry.note ? `<p>${entry.note}</p>` : ""}
          </article>
        `,
      )
      .join("");
  }

  if (totalSaved >= state.userData.carPrice) {
    document.querySelector("#complete-dialog").showModal();
  }
}

function renderCheckIn() {
  const totalSaved = state.progress.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const successfulWeeks = state.progress.filter((entry) => entry.saved).length;
  const expected = (state.userData.carPrice / state.userData.timeGoal) * (state.progress.length / 4.33);
  const status = totalSaved >= expected ? "on track or ahead" : "behind pace";

  document.querySelector("#checkin-output").innerHTML = `
    <section class="coach-section">
      <h2>How you are doing</h2>
      <p>You have saved <strong>${money.format(totalSaved)}</strong>. Based on the time that has passed, you would expect about <strong>${money.format(expected)}</strong>, so you are <strong>${status}</strong>.</p>
    </section>
    <section class="coach-section">
      <h2>Reflection questions</h2>
      <ul>
        <li>What spending decision helped your goal most this week?</li>
        <li>Where did money disappear faster than you expected?</li>
        <li>What is one situation you can prepare for before next week starts?</li>
      </ul>
    </section>
    <section class="coach-section">
      <h2>Red flags</h2>
      <p>Watch for skipped logs, vague notes, and spending that gets justified as small. Those are usually the first signs the plan is drifting.</p>
    </section>
    <section class="coach-section">
      <h2>This week's focus</h2>
      <p>Hit the weekly target first, then decide what is left for fun. You have had ${successfulWeeks} successful saving week${successfulWeeks === 1 ? "" : "s"} so far.</p>
    </section>
  `;
}

function renderMessages() {
  const box = document.querySelector("#messages");
  box.innerHTML = state.messages
    .map((message) => `<div class="message ${message.role}">${message.text}</div>`)
    .join("");
  box.scrollTop = box.scrollHeight;
}

function coachReply(question) {
  const { needed, weeklyTarget, cushion } = getPlanNumbers();
  const lower = question.toLowerCase();

  if (lower.includes("timeline") || lower.includes("month")) {
    return `Your current timeline needs ${money.format(needed)} per month. If that feels too tight, adding a few months lowers the monthly target and makes the plan easier to keep.`;
  }
  if (lower.includes("spend") || lower.includes("buy") || lower.includes("tempt")) {
    return `Before spending, compare the purchase to your weekly target of ${money.format(weeklyTarget)}. If it takes a big bite out of that number, wait a day before deciding.`;
  }
  if (lower.includes("behind") || lower.includes("miss")) {
    return `Missing a week is fixable. Split the missed amount across the next two or three weeks instead of trying to punish yourself with one huge catch-up week.`;
  }
  if (lower.includes("realistic") || lower.includes("doable")) {
    return cushion >= 0
      ? `It is doable, but your cushion is ${money.format(cushion)} per month. Keep that number visible because it tells you how much room you actually have.`
      : `Right now the plan is short by ${money.format(Math.abs(cushion))} per month. The clean fix is a longer timeline, lower car budget, extra income, or some of each.`;
  }

  return `Keep the next step small and specific: save about ${money.format(weeklyTarget)} this week, log what happened, then adjust from real evidence instead of guessing.`;
}

function renderAccomplishmentButton() {
  document.querySelector("#view-accomplishments").classList.toggle("hidden", state.accomplishments.length === 0);
}

function renderWins() {
  const wins = document.querySelector("#wins-list");
  if (!state.accomplishments.length) {
    wins.innerHTML = `<div class="empty-state">No completed goals yet. Your first one will show up here.</div>`;
    return;
  }
  wins.innerHTML = state.accomplishments
    .map(
      (win) => `
        <article class="win-card">
          <strong>${money.format(win.carPrice)} car goal</strong>
          <p>Completed on ${win.completedDate} after a ${win.timeGoal}-month plan.</p>
        </article>
      `,
    )
    .join("");
}

function openGame(fromScreen) {
  state.previousScreen = fromScreen;
  resetGame();
  showScreen("game");
}

function resetGame() {
  game.running = false;
  game.finished = false;
  game.score = 0;
  game.timeLeft = 45;
  game.lane = 1;
  game.speed = 2.4;
  game.lastTime = 0;
  game.spawnTimer = 0;
  game.items = [];
  document.querySelector("#start-game").textContent = "Play";
  renderGameHud();
  renderUpgrades();
  renderGame();
}

function startGame() {
  if (game.running) return;
  if (game.finished || game.timeLeft <= 0) resetGame();
  game.running = true;
  document.querySelector("#start-game").textContent = "Playing";
  requestAnimationFrame(tickGame);
}

function moveCar(direction) {
  game.lane = Math.max(0, Math.min(2, game.lane + direction));
  renderGame();
}

function tickGame(timestamp) {
  if (!game.running) return;
  if (!game.lastTime) game.lastTime = timestamp;
  const delta = Math.min(40, timestamp - game.lastTime);
  game.lastTime = timestamp;
  game.timeLeft = Math.max(0, game.timeLeft - delta / 1000);
  game.spawnTimer -= delta;

  if (game.spawnTimer <= 0) {
    spawnItem();
    game.spawnTimer = Math.max(520, 1000 - game.score * 1.6);
  }

  game.items.forEach((item) => {
    item.y += game.speed * (delta / 16.67);
  });
  checkCollisions();
  game.items = game.items.filter((item) => !item.hit && item.y < game.canvas.height + 60);
  game.speed = 2.4 + game.score / 180;
  renderGameHud();
  renderGame();

  if (game.timeLeft <= 0) {
    endGame();
    return;
  }
  requestAnimationFrame(tickGame);
}

function spawnItem() {
  const lane = Math.floor(Math.random() * 3);
  const upgradeChance = Math.random() > 0.34;
  const upgradeIndex = Math.min(upgrades.length - 1, Math.floor(game.score / 70));
  const upgrade = upgrades[upgradeIndex];
  game.items.push({
    lane,
    y: -42,
    type: upgradeChance ? "upgrade" : "gas",
    label: upgradeChance ? upgrade.symbol : "GAS",
    name: upgradeChance ? upgrade.name : "Gas can",
    kind: upgradeChance ? upgrade.kind : "gas",
    upgradeIndex,
  });
}

function checkCollisions() {
  const carY = game.canvas.height - 92;
  game.items.forEach((item) => {
    if (item.hit) return;
    if (item.lane === game.lane && Math.abs(item.y - carY) < 42) {
      item.hit = true;
      if (item.type === "upgrade") {
        game.score += 25;
      } else {
        game.score = Math.max(0, game.score - 20);
      }
      renderUpgrades();
    }
  });
  game.items = game.items.filter((item) => !item.hit);
}

function endGame() {
  game.running = false;
  game.finished = true;
  document.querySelector("#start-game").textContent = "Play again";
  renderGame();
}

function earnedUpgradeCount() {
  return upgrades.filter((upgrade) => game.score >= upgrade.points).length;
}

function renderGameHud() {
  const earned = earnedUpgradeCount();
  const levelNames = ["Gas car", "Cleaner gas car", "Efficient gas car", "Hybrid car", "Electric car"];
  document.querySelector("#game-score").textContent = `Score ${game.score}`;
  document.querySelector("#game-level").textContent = levelNames[earned];
  document.querySelector("#game-timer").textContent = `${Math.ceil(game.timeLeft)}s`;
}

function renderUpgrades() {
  const list = document.querySelector("#upgrade-list");
  list.innerHTML = upgrades
    .map(
      (upgrade) => `
        <article class="upgrade-item ${game.score >= upgrade.points ? "is-earned" : ""}">
          <div class="upgrade-icon">${upgrade.symbol}</div>
          <div>
            <strong>${upgrade.name}</strong>
            <span>${upgrade.detail}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderGame() {
  const { ctx, canvas } = game;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#f0fbf4";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#cfeedd";
  ctx.fillRect(0, 0, 96, h);
  ctx.fillRect(w - 96, 0, 96, h);

  ctx.fillStyle = "#26312c";
  roundRect(ctx, 112, 0, w - 224, h, 26);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 6;
  ctx.setLineDash([26, 24]);
  [w / 2 - 78, w / 2 + 78].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, -20);
    ctx.lineTo(x, h + 20);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  game.items.forEach(drawItem);
  drawCar();

  if (!game.running) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
    roundRect(ctx, 150, 138, w - 300, 150, 24);
    ctx.fill();
    ctx.fillStyle = "#101312";
    ctx.textAlign = "center";
    ctx.font = "900 28px system-ui";
    ctx.fillText(game.finished ? "Nice drive." : "Ready to drive?", w / 2, 190);
    ctx.font = "700 17px system-ui";
    const message =
      earnedUpgradeCount() === upgrades.length
        ? "You built a fully electric ride."
        : "Collect upgrades. Dodge gas cans.";
    ctx.fillText(message, w / 2, 226);
  }
}

function drawCar() {
  const laneX = [220, 360, 500][game.lane];
  const y = game.canvas.height - 92;
  const earned = earnedUpgradeCount();
  const carColor = earned >= 4 ? "#29c77f" : earned >= 3 ? "#4fbf8b" : "#ffffff";

  const ctx = game.ctx;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  roundRect(ctx, laneX - 52, y + 34, 104, 14, 8);
  ctx.fill();

  ctx.fillStyle = carColor;
  roundRect(ctx, laneX - 48, y - 18, 96, 48, 16);
  ctx.fill();
  ctx.strokeStyle = "#101312";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = earned >= 4 ? "#bff4df" : "#dff6e8";
  roundRect(ctx, laneX - 28, y - 35, 56, 25, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#101312";
  ctx.beginPath();
  ctx.arc(laneX - 32, y + 28, 12, 0, Math.PI * 2);
  ctx.arc(laneX + 32, y + 28, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(laneX - 32, y + 28, 5, 0, Math.PI * 2);
  ctx.arc(laneX + 32, y + 28, 5, 0, Math.PI * 2);
  ctx.fill();

  if (earned >= 4) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("EV", laneX, y + 11);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laneX + 45, y - 7);
    ctx.lineTo(laneX + 58, y - 15);
    ctx.lineTo(laneX + 51, y + 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#167046";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("CAR", laneX, y + 10);
  }
  ctx.restore();
}

function drawItem(item) {
  const laneX = [220, 360, 500][item.lane];
  const ctx = game.ctx;
  ctx.save();
  ctx.translate(laneX, item.y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  roundRect(ctx, -27, 28, 54, 8, 5);
  ctx.fill();

  if (item.kind === "converter") drawCatalyticConverter(ctx);
  if (item.kind === "tire") drawEcoTire(ctx);
  if (item.kind === "battery") drawHybridBattery(ctx);
  if (item.kind === "motor") drawElectricMotor(ctx);
  if (item.kind === "gas") drawGasCan(ctx);

  ctx.restore();
}

function drawCatalyticConverter(ctx) {
  ctx.fillStyle = "#dff6e8";
  roundRect(ctx, -31, -13, 62, 26, 12);
  ctx.fill();
  ctx.strokeStyle = "#167046";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, -15, -22, 30, 44, 10);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#0a3d29";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-42, 0);
  ctx.lineTo(-31, 0);
  ctx.moveTo(31, 0);
  ctx.lineTo(42, 0);
  ctx.stroke();
}

function drawEcoTire(ctx) {
  ctx.fillStyle = "#101312";
  ctx.beginPath();
  ctx.arc(0, 0, 29, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1f8a55";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1f8a55";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-3, -30);
  ctx.quadraticCurveTo(18, -40, 30, -20);
  ctx.quadraticCurveTo(10, -22, -3, -30);
  ctx.stroke();
}

function drawHybridBattery(ctx) {
  ctx.fillStyle = "#dff6e8";
  roundRect(ctx, -32, -22, 64, 44, 10);
  ctx.fill();
  ctx.strokeStyle = "#167046";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#167046";
  roundRect(ctx, 32, -8, 8, 16, 4);
  ctx.fill();
  ctx.font = "900 24px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("+", -12, 8);
  ctx.fillText("-", 14, 7);
}

function drawElectricMotor(ctx) {
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, -32, -24, 64, 48, 14);
  ctx.fill();
  ctx.strokeStyle = "#167046";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#1f8a55";
  ctx.font = "900 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("EV", 0, 7);
  ctx.strokeStyle = "#1f8a55";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-42, -3);
  ctx.lineTo(-32, -3);
  ctx.moveTo(32, -3);
  ctx.lineTo(42, -3);
  ctx.stroke();
}

function drawGasCan(ctx) {
  ctx.fillStyle = "#ffe5df";
  roundRect(ctx, -26, -25, 45, 52, 8);
  ctx.fill();
  ctx.strokeStyle = "#9b2c1f";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#9b2c1f";
  roundRect(ctx, -12, -34, 22, 12, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -20);
  ctx.lineTo(34, -12);
  ctx.lineTo(30, -4);
  ctx.lineTo(18, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("GAS", -3, 5);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

document.querySelector("#plan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.userData = {
    paycheck: Number(document.querySelector("#paycheck").value),
    frequency: document.querySelector("#frequency").value,
    carPrice: Number(document.querySelector("#car-price").value),
    timeGoal: Number(document.querySelector("#time-goal").value),
    expenses: Number(document.querySelector("#expenses").value || 0),
    challenges: document.querySelector("#challenges").value.trim(),
  };
  state.progress = [];
  save("carSavingsProgress", state.progress);
  state.messages = [
    {
      role: "assistant",
      text: "I am here for quick planning help. Ask about your timeline, spending choices, missed weeks, or whether the goal feels realistic.",
    },
  ];
  renderPlan();
  renderMessages();
  showScreen("plan");
});

document.querySelector("#start-tracking").addEventListener("click", () => {
  renderTracker();
  showScreen("tracker");
});

document.querySelector("#edit-plan").addEventListener("click", () => showScreen("input"));
document.querySelector("#back-to-plan").addEventListener("click", () => showScreen("plan"));
document.querySelector("#view-accomplishments").addEventListener("click", () => {
  renderWins();
  showScreen("accomplishments");
});
document.querySelector("#new-goal").addEventListener("click", () => showScreen("input"));
document.querySelector("#open-game-from-home").addEventListener("click", () => openGame("input"));
document.querySelector("#open-game-from-tracker").addEventListener("click", () => openGame("tracker"));
document.querySelector("#exit-game").addEventListener("click", () => showScreen(state.previousScreen));
document.querySelector("#start-game").addEventListener("click", startGame);
document.querySelector("#move-left").addEventListener("click", () => moveCar(-1));
document.querySelector("#move-right").addEventListener("click", () => moveCar(1));

window.addEventListener("keydown", (event) => {
  if (!screens.game.classList.contains("is-active")) return;
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "a", "d"].includes(key)) {
    event.preventDefault();
    if (event.repeat || game.keys.has(key)) return;
    game.keys.add(key);
    if (key === "arrowleft" || key === "a") moveCar(-1);
    if (key === "arrowright" || key === "d") moveCar(1);
  }
});

window.addEventListener("keyup", (event) => {
  game.keys.delete(event.key.toLowerCase());
});

document.querySelector("#open-log").addEventListener("click", () => {
  document.querySelector("#log-dialog").showModal();
});

document.querySelector("#cancel-log").addEventListener("click", () => {
  document.querySelector("#log-dialog").close();
});

document.querySelector("#log-form").addEventListener("change", () => {
  const saved = document.querySelector('input[name="saved"]:checked').value === "yes";
  document.querySelector("#amount-field").classList.toggle("hidden", !saved);
});

document.querySelector("#log-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const saved = document.querySelector('input[name="saved"]:checked').value === "yes";
  const amount = saved ? Number(document.querySelector("#log-amount").value || 0) : 0;
  if (saved && amount <= 0) {
    document.querySelector("#log-amount").focus();
    return;
  }
  state.progress.push({
    week: state.progress.length + 1,
    saved,
    amount,
    note: document.querySelector("#log-note").value.trim(),
    date: new Date().toLocaleDateString(),
  });
  save("carSavingsProgress", state.progress);
  document.querySelector("#log-amount").value = "";
  document.querySelector("#log-note").value = "";
  document.querySelector("#log-dialog").close();
  renderTracker();
});

document.querySelector("#open-checkin").addEventListener("click", () => {
  renderCheckIn();
  document.querySelector("#checkin-dialog").showModal();
});

document.querySelector("#close-checkin").addEventListener("click", () => {
  document.querySelector("#checkin-dialog").close();
});

document.querySelector("#finish-goal").addEventListener("click", () => {
  state.accomplishments.push({
    carPrice: state.userData.carPrice,
    timeGoal: state.userData.timeGoal,
    completedDate: new Date().toLocaleDateString(),
  });
  save("carSavingsWins", state.accomplishments);
  state.progress = [];
  save("carSavingsProgress", state.progress);
  document.querySelector("#complete-dialog").close();
  renderWins();
  showScreen("accomplishments");
});

document.querySelector("#chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  state.messages.push({ role: "user", text });
  state.messages.push({ role: "assistant", text: coachReply(text) });
  input.value = "";
  renderMessages();
});

renderAccomplishmentButton();
renderUpgrades();
renderGame();
