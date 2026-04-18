const DEFAULT_MINUTES = 25;
const MAX_HOURS_PER_DAY = 16;
const MAX_SLOTS = 16;

let sessionMinutes = DEFAULT_MINUTES;
let startTime = null;
let duration = sessionMinutes * 60 * 1000;
let animationFrameId = null;
let isRunning = false;

let todaySessions = 0;
let todayFocusedMinutes = 0;
let todayTreeStages = new Array(MAX_SLOTS).fill(0);

const timerEl = document.getElementById("timer");
const sessionCountEl = document.getElementById("sessionCount");
const focusHoursEl = document.getElementById("focusHours");
const forestFilledEl = document.getElementById("forestFilled");
const forestPlotEl = document.getElementById("forestPlot");

const editModalEl = document.getElementById("editModal");
const customMinutesEl = document.getElementById("customMinutes");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const editBtn = document.getElementById("editBtn");
const saveTimeBtn = document.getElementById("saveTimeBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

const weekKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDayShortName() {
  return weekKeys[new Date().getDay()];
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateTimerDisplay() {
  timerEl.textContent = formatTime(time);
  const timerLabelEl = document.querySelector(".timer-label");
  timerLabelEl.textContent = isBreak ? "Break Time" : "Focus Time";
}

function getForestPercent() {
  const maxMinutes = MAX_HOURS_PER_DAY * 60;
  return Math.min(100, Math.round((todayFocusedMinutes / maxMinutes) * 100));
}

function getFocusedHours() {
  return (todayFocusedMinutes / 60).toFixed(1);
}

function updateStats() {
  sessionCountEl.textContent = todaySessions;
  focusHoursEl.textContent = `${getFocusedHours()}h`;
  forestFilledEl.textContent = `${getForestPercent()}%`;
}

function buildForest() {
  forestPlotEl.innerHTML = "";

  for (let i = 0; i < MAX_SLOTS; i++) {
    const slot = document.createElement("div");
    slot.className = "plot-slot";

    const stage = todayTreeStages[i];
    const tree = document.createElement("div");
    tree.className = "tree";

    if (stage === 0) {
      tree.textContent = "";
    } else if (stage === 1) {
      tree.textContent = "🌱";
    } else if (stage === 2) {
      tree.textContent = "🌿";
    } else {
      tree.textContent = "🌳";
    }

    slot.appendChild(tree);
    forestPlotEl.appendChild(slot);
  }
}

function updateForestGrowth() {
  const minutesPerSlot = 60;

  for (let i = 0; i < MAX_SLOTS; i++) {
    const slotStart = i * minutesPerSlot;
    const slotEnd = (i + 1) * minutesPerSlot;

    const progress = todayFocusedMinutes - slotStart;

    if (progress >= 60) {
      todayTreeStages[i] = 3; // 🌳
    } else if (progress >= 40) {
      todayTreeStages[i] = 2; // 🌿
    } else if (progress >= 20) {
      todayTreeStages[i] = 1; // 🌱
    } else {
      todayTreeStages[i] = 0;
    }
  }
}

function completeSession() {
  playNotificationSound();
  const maxMinutes = MAX_HOURS_PER_DAY * 60;

  if (todayFocusedMinutes >= maxMinutes) {
    stopTimer();
    time = sessionMinutes * 60;
    updateTimerDisplay();
    return;
  }
  alert("Session completed! Your tree is growing!");
  if (isBreak) {
    alert("Break over! Back to focus.");
    isBreak = false;
    resetTimer();
    return;
  }
  todaySessions += 1;
  todayFocusedMinutes = Math.min(maxMinutes, todayFocusedMinutes + Math.floor(sessionMinutes));
  updateForestGrowth();
  saveSessionHistory();
  saveAppState();
  updateStats();
  buildForest();
  stopTimer();
  time = sessionMinutes * 60;
  updateTimerDisplay();
}

function startTimer() {
  if (isRunning) return;

  isRunning = true;
  startTime = Date.now() - (duration - time * 1000);

  updateTimer();
}

function stopTimer() {
  isRunning = false;
  cancelAnimationFrame(animationFrameId);
  isBreak = false;
}

function resetTimer() {
  stopTimer();
  isBreak = false;
  duration = sessionMinutes * 60 * 1000;
  time = sessionMinutes * 60;
  updateTimerDisplay();
}

function updateTimer() {
  if (!isRunning) return;

  const elapsed = Date.now() - startTime;
  const remaining = duration - elapsed;

  if (remaining <= 0) {
    time = 0;
    updateTimerDisplay();
    completeSession();
    return;
  }

  time = Math.ceil(remaining / 1000);
  updateTimerDisplay();

  animationFrameId = requestAnimationFrame(updateTimer);
}

function openEditModal() {
  customMinutesEl.value = sessionMinutes;
  editModalEl.classList.remove("hidden");
}

function closeEditModal() {
  editModalEl.classList.add("hidden");
}

function saveCustomTime() {
  const val = parseInt(customMinutesEl.value, 10);

  if (!val || val < 1 || val > 180) return;
  isBreak = false;
  sessionMinutes = val;
  duration = sessionMinutes * 60 * 1000;

  resetTimer();
  closeEditModal();
  saveAppState();
}

function getInitialWeeklyData() {
  return {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0
  };
}

function updateWeeklyBars(weeklyMinutes) {
  const maxMinutes = MAX_HOURS_PER_DAY * 60;

  for (const key of weekKeys) {
    const minutes = weeklyMinutes[key] || 0;
    const percent = Math.min(100, (minutes / maxMinutes) * 100);

    const bar = document.getElementById(`bar-${key}`);
    const txt = document.getElementById(`txt-${key}`);

    if (bar) bar.style.width = `${percent}%`;
    if (txt) txt.textContent = `${(minutes / 60).toFixed(1)}h`;
  }
}

function saveAppState() {
  const todayKey = getTodayKey();
  const dayName = getDayShortName();

  const raw = localStorage.getItem("focusForestData");
  const saved = raw ? JSON.parse(raw) : {};

  if (!saved.weeklyMinutes) {
    saved.weeklyMinutes = getInitialWeeklyData();
  }

  saved.todayKey = todayKey;
  saved.sessionMinutes = sessionMinutes;
  saved.todaySessions = todaySessions;
  saved.todayFocusedMinutes = todayFocusedMinutes;
  saved.todayTreeStages = todayTreeStages;
  saved.weeklyMinutes[dayName] = todayFocusedMinutes;

  localStorage.setItem("focusForestData", JSON.stringify(saved));
  updateWeeklyBars(saved.weeklyMinutes);
}

function loadAppState() {
  const raw = localStorage.getItem("focusForestData");

  if (!raw) {
    updateWeeklyBars(getInitialWeeklyData());
    return;
  }

  const saved = JSON.parse(raw);
  const todayKey = getTodayKey();

  sessionMinutes = saved.sessionMinutes || DEFAULT_MINUTES;

  if (saved.todayKey === todayKey) {
    todaySessions = saved.todaySessions || 0;
    todayFocusedMinutes = saved.todayFocusedMinutes || 0;
    todayTreeStages = Array.isArray(saved.todayTreeStages)
      ? saved.todayTreeStages.slice(0, MAX_SLOTS).concat(new Array(Math.max(0, MAX_SLOTS - saved.todayTreeStages.length)).fill(0))
      : new Array(MAX_SLOTS).fill(0);
  } else {
    todaySessions = 0;
    todayFocusedMinutes = 0;
    todayTreeStages = new Array(MAX_SLOTS).fill(0);
  }

  updateWeeklyBars(saved.weeklyMinutes || getInitialWeeklyData());
}

function saveSessionHistory() {
  const raw = localStorage.getItem("focusForestData");
  const saved = raw ? JSON.parse(raw) : {};

  if (!saved.history) saved.history = [];

  saved.history.push({
    date: new Date().toISOString(),
    duration: sessionMinutes
  });

  localStorage.setItem("focusForestData", JSON.stringify(saved));
}

const resetTodayBtn = document.getElementById("resetTodayBtn");

resetTodayBtn.addEventListener("click", () => {
  const raw = localStorage.getItem("focusForestData");
  const saved = raw ? JSON.parse(raw) : {};

  const todayKey = getTodayKey();

  saved.todayKey = todayKey;
  saved.todaySessions = 0;
  saved.todayFocusedMinutes = 0;
  saved.todayTreeStages = new Array(MAX_SLOTS).fill(0);

  localStorage.setItem("focusForestData", JSON.stringify(saved));
  location.reload();
});
const breakBtn = document.getElementById("breakBtn");
const breakModal = document.getElementById("breakModal");
const closeBreakModal = document.getElementById("closeBreakModal");
const startCustomBreak = document.getElementById("startCustomBreak");

let isBreak = false;
breakBtn.addEventListener("click", () => {
  breakModal.classList.remove("hidden");
});

closeBreakModal.addEventListener("click", () => {
  breakModal.classList.add("hidden");
});

function startBreak(minutes) {
  breakModal.classList.add("hidden");

  stopTimer();
  isBreak = true;

  sessionMinutes = minutes;
  duration = sessionMinutes * 60 * 1000;
  time = sessionMinutes * 60;

  updateTimerDisplay();
  startTimer();
}

startCustomBreak.addEventListener("click", () => {
  const val = parseInt(document.getElementById("customBreak").value, 10);
  if (!val || val < 1) return;

  startBreak(val);
});

const historyBtn = document.getElementById("historyBtn");
const modal = document.getElementById("historyModal");
const closeBtn = document.getElementById("closeHistory");
const historyList = document.getElementById("historyList");


historyBtn.onclick = () => {
  renderHistory();
  modal.classList.remove("hidden");
};

closeBtn.onclick = () => {
  modal.classList.add("hidden");
};

function renderHistory() {
  historyList.innerHTML = "";

  const raw = localStorage.getItem("focusForestData");
  const saved = raw ? JSON.parse(raw) : {};

  const history = saved.history || [];
  
  if (history.length === 0) {
    historyList.innerHTML = "<p>No sessions yet</p>";
    return;
  }

  history.reverse().forEach(h => {
    const div = document.createElement("div");
    div.className = "history-item";

    const date = new Date(h.date);
    const time = date.toLocaleTimeString();
    const day = date.toLocaleDateString();

    div.innerHTML = `
      <strong>${h.duration} min</strong><br>
      <small>${day} • ${time}</small>
    `;

    historyList.appendChild(div);
  });
}

function playNotificationSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  function beep(time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 800;
    gain.gain.value = 0.2;

    osc.start(time);
    osc.stop(time + 0.2);
  }

  const now = ctx.currentTime;
  beep(now);
  beep(now + 0.3);
}

document.body.addEventListener("click", () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume();
}, { once: true });

startBtn.addEventListener("click", startTimer);
stopBtn.addEventListener("click", stopTimer);
resetBtn.addEventListener("click", resetTimer);
editBtn.addEventListener("click", openEditModal);
saveTimeBtn.addEventListener("click", saveCustomTime);
closeModalBtn.addEventListener("click", closeEditModal);

loadAppState();
resetTimer();
updateStats();
buildForest();