/* Shared state, utilities, and header handlers — loaded on every page */

const STORAGE_KEY = "simple_crm_v1";

const el = (id) => document.getElementById(id);

const fmtMoney = (n) => {
  if (n === "" || n === null || n === undefined) return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const stageLabel = (s) =>
  ({ lead: "Lead", qualified: "Qualified", proposal: "Proposal", won: "Won", lost: "Lost" }[s] || s);

const nowISO = () => new Date().toISOString();

const DAY_MS = 24 * 60 * 60 * 1000;

/* Today's local date as YYYY-MM-DD, the format <input type="date"> uses */
const todayISODate = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* Whole days from today until a YYYY-MM-DD date (negative once it has passed), or null if unset/invalid */
const daysUntil = (date) => {
  const diff = Date.parse(date) - Date.parse(todayISODate());
  return Number.isFinite(diff) ? Math.round(diff / DAY_MS) : null;
};

/* Whole days elapsed since an ISO timestamp, or null if unset/invalid */
const daysSince = (iso) => {
  const diff = Date.now() - Date.parse(iso);
  return Number.isFinite(diff) ? Math.floor(diff / DAY_MS) : null;
};

const countDeals = (contacts) =>
  contacts.reduce((sum, c) => sum + (Array.isArray(c?.deals) ? c.deals.length : 0), 0);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { contacts: [], selectedId: null, tasks: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contacts)) return { contacts: [], selectedId: null, tasks: [] };
    return { contacts: parsed.contacts, selectedId: parsed.selectedId ?? null, tasks: parsed.tasks || [] };
  } catch {
    return { contacts: [], selectedId: null, tasks: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function touchContact(c) {
  c.updatedAt = nowISO();
  if (!c.createdAt) c.createdAt = c.updatedAt;
}

function seedIfEmpty() {
  if (state.contacts.length) return;

  const c1 = {
    id: uid(),
    name: "ACME Corp",
    company: "ACME Corp",
    email: "ops@acme.example",
    phone: "",
    notes: "Intro call done. Next: demo.",
    deals: [{ id: uid(), title: "Pilot - ACME", value: 15000, stage: "qualified", closeDate: "" }],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  const c2 = {
    id: uid(),
    name: "Jane Doe",
    company: "Nimbus Labs",
    email: "jane@nimbus.example",
    phone: "",
    notes: "Interested in pricing. Send proposal.",
    deals: [{ id: uid(), title: "Expansion - Nimbus", value: 42000, stage: "proposal", closeDate: "" }],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  state.contacts = [c1, c2];
  state.selectedId = c1.id;
  saveState();
}

seedIfEmpty();

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* Export / Import / Reset — called on every page with a re-render callback */
function setupHeader(onDataChange) {
  el("exportBtn").addEventListener("click", () => {
    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "simple-crm-export.json";
    a.click();
    URL.revokeObjectURL(url);
    const totalDeals = state.contacts.reduce((sum, c) => sum + (c.deals ? c.deals.length : 0), 0);
    pendo.track("Exported JSON", {
      fileName: "simple-crm-export.json",
      fileSizeBytes: blob.size,
      fileSizeKB: parseFloat((blob.size / 1024).toFixed(2)),
      characterCount: jsonString.length,
      contactCount: state.contacts.length,
      dealCount: totalDeals,
      taskCount: (state.tasks || []).length,
      screenWidth: window.innerWidth,
    });
  });

  el("importInput").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Truncated so a long file name cannot push the event past Pendo's 512-byte property limit
    const fileName = file.name.slice(0, 64);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.contacts)) throw new Error("Invalid file shape.");
      // Import replaces everything, so capture what is about to be overwritten
      const previousContactCount = state.contacts.length;
      const previousDealCount = countDeals(state.contacts);
      const previousTaskCount = (state.tasks || []).length;
      state = {
        contacts: parsed.contacts,
        selectedId: parsed.selectedId ?? (parsed.contacts[0]?.id ?? null),
        tasks: parsed.tasks || [],
      };
      saveState();
      onDataChange();
      pendo.track("Imported JSON", {
        fileName,
        fileSizeBytes: file.size,
        fileType: file.type,
        contactCount: state.contacts.length,
        dealCount: countDeals(state.contacts),
        taskCount: (state.tasks || []).length,
        previousContactCount,
        previousDealCount,
        previousTaskCount,
      });
      alert("Imported successfully.");
    } catch (err) {
      // Send a category, never err.message: JSON.parse messages can echo file contents (contact PII)
      const failureReason = err instanceof SyntaxError ? "invalid_json"
                          : err?.message === "Invalid file shape." ? "invalid_shape"
                          : "unknown";
      pendo.track("JSON Import Failed", {
        fileName,
        fileSizeBytes: file.size,
        fileType: file.type,
        failureReason,
        errorName: err?.name || "Error",
      });
      alert("Import failed: " + (err?.message || "Unknown error"));
    } finally {
      el("importInput").value = "";
    }
  });

  el("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset all data? This clears localStorage for this app.")) return;
    // Capture what is being wiped before state is replaced
    const previousContactCount = state.contacts.length;
    const previousDealCount = countDeals(state.contacts);
    const previousTaskCount = (state.tasks || []).length;
    localStorage.removeItem(STORAGE_KEY);
    state = { contacts: [], selectedId: null, tasks: [] };
    seedIfEmpty();
    pendo.track("Data Reset", {
      previousContactCount,
      previousDealCount,
      previousTaskCount,
    });
    onDataChange();
  });
}

(function waitForPendo() {
  if (window.pendo && pendo.events && typeof pendo.events.guidesLoaded === 'function') {
    pendo.events.guidesLoaded(function () {
      console.log('[Pendo] guidesLoaded fired — showing guide OyG_IvF9ehdAtsYUbUiotC4N5ko');
      pendo.showGuideById('OyG_IvF9ehdAtsYUbUiotC4N5ko');
    });
  } else {
    setTimeout(waitForPendo, 100);
  }
})();

/* Zendesk help widget (ze-snippet in each page's <head>). Its launcher and panel render in Zendesk
   iframes that Pendo cannot auto-capture. index.html loads a different Zendesk widget than tasks.html
   and reports.html, so listen through both the Classic ("webWidget:on") and Messaging ("messenger:on")
   APIs; each widget only answers its own. zE normally exists by now (the snippet loads synchronously);
   retry briefly, then give up if it is blocked. */
(function listenForHelpWidget(attemptsLeft) {
  if (typeof window.zE !== "function") {
    if (attemptsLeft > 0) setTimeout(() => listenForHelpWidget(attemptsLeft - 1), 250);
    return;
  }
  let reportingApi = null;
  const trackHelpWidgetOpened = (api) => () => {
    // Count each open once, even if both APIs were ever to report it
    if (reportingApi && reportingApi !== api) return;
    reportingApi = api;
    pendo.track("Help Widget Opened", {
      pagePath: window.location.pathname,
      contactCount: state.contacts.length,
      taskCount: (state.tasks || []).length,
    });
  };
  for (const api of ["webWidget:on", "messenger:on"]) {
    try {
      window.zE(api, "open", trackHelpWidgetOpened(api));
    } catch {
      // This page's widget type does not support this API
    }
  }
})(40);
