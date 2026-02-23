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
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "simple-crm-export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  el("importInput").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.contacts)) throw new Error("Invalid file shape.");
      state = {
        contacts: parsed.contacts,
        selectedId: parsed.selectedId ?? (parsed.contacts[0]?.id ?? null),
        tasks: parsed.tasks || [],
      };
      saveState();
      onDataChange();
      alert("Imported successfully.");
    } catch (err) {
      alert("Import failed: " + (err?.message || "Unknown error"));
    } finally {
      el("importInput").value = "";
    }
  });

  el("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset all data? This clears localStorage for this app.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { contacts: [], selectedId: null, tasks: [] };
    seedIfEmpty();
    onDataChange();
  });
}
