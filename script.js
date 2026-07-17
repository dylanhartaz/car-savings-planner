const state = {
  userData: null,
  progress: load("carSavingsProgress", []),
  accomplishments: load("carSavingsWins", []),
  messages: [],
};

const screens = {
  input: document.querySelector("#screen-input"),
  plan: document.querySelector("#screen-plan"),
  tracker: document.querySelector("#screen-tracker"),
  accomplishments: document.querySelector("#screen-accomplishments"),
};

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
