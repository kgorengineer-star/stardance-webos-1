// ---------- App definitions ----------
// Each app returns the HTML for its window body.
const APPS = {
  notes: {
    title: "Notes",
    body: () => `
      <textarea class="notes-area" placeholder="Type your notes here..."></textarea>
      <div class="notes-status">Saved automatically</div>
    `,
    init(win) {
      const area = win.querySelector(".notes-area");
      const status = win.querySelector(".notes-status");
      // Load saved notes (wrapped in try/catch in case storage is blocked)
      try {
        area.value = localStorage.getItem("webos-notes") || "";
      } catch (e) {
        status.textContent = "Storage unavailable";
      }
      area.addEventListener("input", () => {
        try {
          localStorage.setItem("webos-notes", area.value);
          status.textContent = "Saved automatically";
        } catch (e) {
          status.textContent = "Could not save";
        }
      });
    },
  },

  calc: {
    title: "Calculator",
    body: () => `
      <div class="calc-display">0</div>
      <div class="calc-grid">
        ${["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+"]
          .map(k => `<button class="${"/*-+=".includes(k) ? "op" : ""}" data-key="${k}">${k}</button>`)
          .join("")}
        <button data-key="C" style="grid-column: span 4">Clear</button>
      </div>
    `,
    init(win) {
      const display = win.querySelector(".calc-display");
      let current = "0";

      const press = (key) => {
        if (key === "C") {
          current = "0";
        } else if (key === "=") {
          try {
            // Only allow digits and operators to be evaluated
            if (/^[0-9+\-*/.]+$/.test(current)) {
              current = String(Function(`"use strict"; return (${current})`)());
            }
          } catch (e) {
            current = "Error";
          }
        } else {
          current = current === "0" && key !== "." ? key : current + key;
        }
        display.textContent = current;
      };

      win.querySelector(".calc-grid").addEventListener("click", (e) => {
        if (e.target.dataset.key) press(e.target.dataset.key);
      });
    },
  },

  clock: {
    title: "Clock",
    body: () => `
      <div class="clock-time">--:--:--</div>
      <div class="clock-date"></div>
    `,
    init(win) {
      const time = win.querySelector(".clock-time");
      const date = win.querySelector(".clock-date");
      const tick = () => {
        const now = new Date();
        time.textContent = now.toLocaleTimeString();
        date.textContent = now.toLocaleDateString(undefined, {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
      };
      tick();
      const timer = setInterval(tick, 1000);
      // Stop the timer when this window closes
      win.dataset.timer = timer;
    },
    close(win) {
      clearInterval(Number(win.dataset.timer));
    },
  },

  hackatime: {
    title: "Hackatime",
    body: () => `
      <p>Track your WebOS time with <strong>Hackatime</strong>.
         Paste your API key from your Hackatime settings. It's saved only in this browser.</p>
      <input class="ht-key" type="password" placeholder="Hackatime API key" style="width:100%;margin:8px 0;padding:6px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#f1f5f9" />
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button class="ht-save task-btn">Save key</button>
        <button class="ht-toggle task-btn">Start tracking</button>
      </div>
      <div class="ht-status notes-status">Not tracking</div>
    `,
    init(win) {
      const keyInput = win.querySelector(".ht-key");
      const toggle = win.querySelector(".ht-toggle");
      const status = win.querySelector(".ht-status");

      try {
        keyInput.value = localStorage.getItem("webos-hackatime-key") || "";
      } catch (e) {
        status.textContent = "Storage unavailable";
      }

      win.querySelector(".ht-save").addEventListener("click", () => {
        try {
          localStorage.setItem("webos-hackatime-key", keyInput.value.trim());
          status.textContent = "Key saved";
        } catch (e) {
          status.textContent = "Could not save key";
        }
      });

      toggle.addEventListener("click", () => {
        if (hackatimeTimer) {
          stopHackatime();
          toggle.textContent = "Start tracking";
          status.textContent = "Stopped";
        } else {
          const key = keyInput.value.trim();
          if (!key) {
            status.textContent = "Paste your API key first";
            return;
          }
          startHackatime(key);
          toggle.textContent = "Stop tracking";
          status.textContent = "Tracking WebOS time";
        }
      });
    },
    close() {
      // Keep tracking running in the background if it was started
    },
  },

  about: {
    title: "About",
    body: () => `
      <div class="about">
        <p>★ <strong>Stardance WebOS 1</strong></p>
        <p>This little operating system runs entirely in your browser.
           Open apps from the desktop or the Start menu, drag windows by
           their title bars, and close them with the red button.</p>
        <p>Next step: customize it to make it your own!</p>
      </div>
    `,
  },
};

// ---------- Hackatime time tracking ----------
// Sends a heartbeat every 2 minutes while tracking is on.
// The API key only lives in this browser (localStorage) and is never stored in the code.
let hackatimeTimer = null;

function sendHeartbeat(key) {
  const body = [{
    type: "file",
    time: Math.floor(Date.now() / 1000),
    entity: "webos/index.html",
    language: "HTML",
    project: "stardance-webos-1",
  }];
  fetch("https://hackatime.hackclub.com/api/hackatime/v1/users/current/heartbeats", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => {
    // Ignore network errors so the OS keeps running
  });
}

function startHackatime(key) {
  stopHackatime();
  sendHeartbeat(key);
  hackatimeTimer = setInterval(() => sendHeartbeat(key), 2 * 60 * 1000);
}

function stopHackatime() {
  clearInterval(hackatimeTimer);
  hackatimeTimer = null;
}

// ---------- State ----------
let zCounter = 10;
let openCount = 0;
const windowsEl = document.getElementById("windows");
const taskList = document.getElementById("task-list");
const startMenu = document.getElementById("start-menu");

// ---------- Window management ----------
function openApp(appName) {
  const app = APPS[appName];
  if (!app) return;

  // If already open, just focus it
  const existing = windowsEl.querySelector(`[data-app="${appName}"]`);
  if (existing) {
    focusWindow(existing);
    return;
  }

  const win = document.createElement("div");
  win.className = "window";
  win.dataset.app = appName;

  // Stagger new windows so they don't stack exactly on top of each other
  const offset = (openCount % 6) * 28;
  win.style.left = 60 + offset + "px";
  win.style.top = 30 + offset + "px";
  openCount++;

  win.innerHTML = `
    <div class="window-bar">
      <span class="window-title">${app.title}</span>
      <button class="close-btn" title="Close">×</button>
    </div>
    <div class="window-body">${app.body()}</div>
  `;

  windowsEl.appendChild(win);
  app.init && app.init(win);

  // Taskbar button
  const btn = document.createElement("button");
  btn.className = "task-btn";
  btn.textContent = app.title;
  btn.dataset.app = appName;
  taskList.appendChild(btn);

  win.addEventListener("mousedown", () => focusWindow(win));
  btn.addEventListener("click", () => {
    if (win.classList.contains("hidden")) {
      win.classList.remove("hidden");
      focusWindow(win);
    } else if (btn.classList.contains("active")) {
      win.classList.add("hidden");
      btn.classList.remove("active");
    } else {
      focusWindow(win);
    }
  });

  win.querySelector(".close-btn").addEventListener("click", () => {
    app.close && app.close(win);
    win.remove();
    btn.remove();
    openCount = Math.max(0, openCount - 1);
  });

  makeDraggable(win, win.querySelector(".window-bar"));
  focusWindow(win);
  startMenu.classList.add("hidden");
}

function focusWindow(win) {
  win.style.zIndex = ++zCounter;
  windowsEl.querySelectorAll(".window").forEach((w) => {
    const btn = taskList.querySelector(`[data-app="${w.dataset.app}"]`);
    if (btn) btn.classList.toggle("active", w === win);
  });
}

// ---------- Dragging ----------
function makeDraggable(win, handle) {
  let startX, startY, origLeft, origTop;

  handle.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    startX = e.clientX;
    startY = e.clientY;
    origLeft = win.offsetLeft;
    origTop = win.offsetTop;

    const onMove = (ev) => {
      win.style.left = origLeft + (ev.clientX - startX) + "px";
      win.style.top = Math.max(0, origTop + (ev.clientY - startY)) + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

// ---------- Start menu & desktop icons ----------
document.getElementById("start-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  startMenu.classList.toggle("hidden");
});

document.querySelectorAll("[data-app]").forEach((el) => {
  // Desktop icons, start menu items, and task buttons all use data-app;
  // only the desktop icons and start menu items should open apps here.
  if (el.classList.contains("task-btn")) return;
  el.addEventListener("click", () => openApp(el.dataset.app));
});

// Close the start menu when clicking elsewhere
document.addEventListener("click", (e) => {
  if (!startMenu.contains(e.target) && e.target.id !== "start-btn") {
    startMenu.classList.add("hidden");
  }
});

// ---------- Taskbar clock ----------
function updateTrayClock() {
  document.getElementById("tray-clock").textContent =
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
updateTrayClock();
setInterval(updateTrayClock, 1000);

// Open Notes on first load so there's something to see
openApp("about");
