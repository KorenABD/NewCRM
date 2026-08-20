/* Simple CRM (no backend)
   - Contacts + deals
   - LocalStorage persistence
   - Import/Export JSON
*/

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
    if (!raw) return { contacts: [], selectedId: null };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.contacts)) return { contacts: [], selectedId: null };
    return { contacts: parsed.contacts, selectedId: parsed.selectedId ?? null };
  } catch {
    return { contacts: [], selectedId: null };
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
    deals: [
      { id: uid(), title: "Pilot - ACME", value: 15000, stage: "qualified", closeDate: "" }
    ],
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
    deals: [
      { id: uid(), title: "Expansion - Nimbus", value: 42000, stage: "proposal", closeDate: "" }
    ],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  state.contacts = [c1, c2];
  state.selectedId = c1.id;
  saveState();
}

seedIfEmpty();

/** UI refs */
const contactList = el("contactList");
const contactSearch = el("contactSearch");
const contactSort = el("contactSort");

const emptyState = el("emptyState");
const detailView = el("detailView");
const detailTitle = el("detailTitle");

const contactForm = el("contactForm");
const deleteContactBtn = el("deleteContactBtn");
const saveHint = el("saveHint");

const newContactBtn = el("newContactBtn");

const dealList = el("dealList");
const newDealBtn = el("newDealBtn");
const dealStageFilter = el("dealStageFilter");

const exportBtn = el("exportBtn");
const importInput = el("importInput");
const resetBtn = el("resetBtn");

/** Modal refs */
const modalBackdrop = el("modalBackdrop");
const modalTitle = el("modalTitle");
const modalClose = el("modalClose");
const dealForm = el("dealForm");
const dealCancel = el("dealCancel");

const formFields = {
  name: el("name"),
  company: el("company"),
  email: el("email"),
  phone: el("phone"),
  notes: el("notes"),
};

const dealFields = {
  title: el("dealTitle"),
  value: el("dealValue"),
  stage: el("dealStage"),
  closeDate: el("dealCloseDate"),
};

let editingDealId = null;

function getSelected() {
  return state.contacts.find((c) => c.id === state.selectedId) || null;
}

function setSelected(id) {
  state.selectedId = id;
  saveState();
  render();
}

function sortContacts(arr) {
  const key = contactSort.value;
  const copy = [...arr];

  if (key === "nameAsc") {
    copy.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (key === "companyAsc") {
    copy.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
  } else {
    // updatedDesc
    copy.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }
  return copy;
}

function filterContacts(arr) {
  const q = (contactSearch.value || "").trim().toLowerCase();
  if (!q) return arr;
  return arr.filter((c) => {
    const hay = `${c.name || ""} ${c.company || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderContacts() {
  const filtered = sortContacts(filterContacts(state.contacts));

  contactList.innerHTML = "";
  if (!filtered.length) {
    const div = document.createElement("div");
    div.className = "empty";
    div.innerHTML = `<p><strong>No contacts found.</strong></p><p>Try a different search.</p>`;
    contactList.appendChild(div);
    return;
  }

  for (const c of filtered) {
    const card = document.createElement("div");
    card.className = "card" + (c.id === state.selectedId ? " active" : "");
    const deals = Array.isArray(c.deals) ? c.deals : [];
    const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length;

    card.innerHTML = `
      <div class="card-title">${escapeHtml(c.name || "Untitled")}</div>
      <div class="card-sub">
        ${c.company ? `<span class="pill">${escapeHtml(c.company)}</span>` : ""}
        ${c.email ? `<span class="pill">${escapeHtml(c.email)}</span>` : ""}
        ${deals.length ? `<span class="pill">${deals.length} deal(s)</span>` : `<span class="pill">No deals</span>`}
        ${deals.length ? `<span class="pill">${openDeals} open</span>` : ""}
      </div>
    `;
    card.addEventListener("click", () => setSelected(c.id));
    contactList.appendChild(card);
  }
}

function renderDetail() {
  const selected = getSelected();

  if (!selected) {
    emptyState.classList.remove("hidden");
    detailView.classList.add("hidden");
    deleteContactBtn.classList.add("hidden");
    detailTitle.textContent = "Details";
    return;
  }

  emptyState.classList.add("hidden");
  detailView.classList.remove("hidden");
  deleteContactBtn.classList.remove("hidden");

  detailTitle.textContent = selected.name ? `Details — ${selected.name}` : "Details";

  // Fill form
  formFields.name.value = selected.name || "";
  formFields.company.value = selected.company || "";
  formFields.email.value = selected.email || "";
  formFields.phone.value = selected.phone || "";
  formFields.notes.value = selected.notes || "";

  renderDeals(selected);
}

function renderDeals(contact) {
  const stage = dealStageFilter.value;
  const deals = Array.isArray(contact.deals) ? contact.deals : [];

  const filtered = stage === "all" ? deals : deals.filter((d) => d.stage === stage);

  dealList.innerHTML = "";
  if (!filtered.length) {
    const div = document.createElement("div");
    div.className = "empty";
    div.innerHTML = `<p><strong>No deals.</strong></p><p>Add a deal to track pipeline.</p>`;
    dealList.appendChild(div);
    return;
  }

  for (const d of filtered) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-title">${escapeHtml(d.title || "Untitled deal")}</div>
      <div class="card-sub">
        <span class="pill">${stageLabel(d.stage)}</span>
        ${Number.isFinite(Number(d.value)) && Number(d.value) > 0 ? `<span class="pill">$${fmtMoney(d.value)}</span>` : ""}
        ${d.closeDate ? `<span class="pill">Close: ${escapeHtml(d.closeDate)}</span>` : ""}
        <span class="pill">Edit</span>
        <span class="pill" data-danger="1">Delete</span>
      </div>
    `;

    // Click targets within the card
    const pills = card.querySelectorAll(".pill");
    const editPill = pills[pills.length - 2];
    const delPill = pills[pills.length - 1];

    editPill.style.cursor = "pointer";
    delPill.style.cursor = "pointer";
    delPill.style.borderColor = "rgba(255,92,106,0.45)";
    delPill.style.color = "rgba(255,92,106,0.95)";

    editPill.addEventListener("click", (e) => {
      e.stopPropagation();
      openDealModal(d.id);
    });

    delPill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Delete this deal?")) {
        contact.deals = deals.filter((x) => x.id !== d.id);
        touchContact(contact);
        saveState();
        render();
      }
    });

    dealList.appendChild(card);
  }
}

function render() {
  renderContacts();
  renderDetail();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Contacts actions */
newContactBtn.addEventListener("click", () => {
  const c = {
    id: uid(),
    name: "New Contact",
    company: "",
    email: "",
    phone: "",
    notes: "",
    deals: [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  state.contacts.unshift(c);
  state.selectedId = c.id;
  saveState();
  render();
  formFields.name.focus();
  formFields.name.select();
});

deleteContactBtn.addEventListener("click", () => {
  const selected = getSelected();
  if (!selected) return;
  if (!confirm(`Delete "${selected.name || "this contact"}"? This cannot be undone.`)) return;

  state.contacts = state.contacts.filter((c) => c.id !== selected.id);

  // Select next contact if possible
  state.selectedId = state.contacts[0]?.id ?? null;
  saveState();
  render();
});

contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const selected = getSelected();
  if (!selected) return;

  selected.name = formFields.name.value.trim() || "Untitled";
  selected.company = formFields.company.value.trim();
  selected.email = formFields.email.value.trim();
  selected.phone = formFields.phone.value.trim();
  selected.notes = formFields.notes.value.trim();
  touchContact(selected);

  saveState();
  flashSaved();
  renderContacts(); // keep selection, only refresh list header text
  detailTitle.textContent = `Details — ${selected.name}`;
});

function flashSaved() {
  saveHint.textContent = "Saved ✓";
  setTimeout(() => (saveHint.textContent = ""), 1200);
}

/** Search/sort */
contactSearch.addEventListener("input", renderContacts);
contactSort.addEventListener("change", renderContacts);

/** Deals actions */
newDealBtn.addEventListener("click", () => openDealModal(null));
dealStageFilter.addEventListener("change", render);

function openDealModal(dealId) {
  const selected = getSelected();
  if (!selected) return;

  editingDealId = dealId;

  const deals = Array.isArray(selected.deals) ? selected.deals : [];
  const deal = deals.find((d) => d.id === dealId) || null;

  modalTitle.textContent = deal ? "Edit Deal" : "Add Deal";

  dealFields.title.value = deal?.title || "";
  dealFields.value.value = deal?.value ?? "";
  dealFields.stage.value = deal?.stage || "lead";
  dealFields.closeDate.value = deal?.closeDate || "";

  modalBackdrop.classList.remove("hidden");
  dealFields.title.focus();
}

function closeDealModal() {
  editingDealId = null;
  dealForm.reset();
  modalBackdrop.classList.add("hidden");
}

modalClose.addEventListener("click", closeDealModal);
dealCancel.addEventListener("click", closeDealModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeDealModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalBackdrop.classList.contains("hidden")) closeDealModal();
});

dealForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const selected = getSelected();
  if (!selected) return;

  const title = dealFields.title.value.trim();
  if (!title) return;

  const valueRaw = dealFields.value.value;
  const value = valueRaw === "" ? "" : Math.max(0, Math.round(Number(valueRaw)));
  const stage = dealFields.stage.value;
  const closeDate = dealFields.closeDate.value;

  selected.deals = Array.isArray(selected.deals) ? selected.deals : [];

  if (editingDealId) {
    const idx = selected.deals.findIndex((d) => d.id === editingDealId);
    if (idx >= 0) {
      selected.deals[idx] = { ...selected.deals[idx], title, value, stage, closeDate };
    }
  } else {
    selected.deals.unshift({ id: uid(), title, value, stage, closeDate });
  }

  touchContact(selected);
  saveState();
  closeDealModal();
  render();
});

/** Import/Export/Reset */
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "simple-crm-export.json";
  a.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || !Array.isArray(parsed.contacts)) throw new Error("Invalid file shape.");
    state = {
      contacts: parsed.contacts,
      selectedId: parsed.selectedId ?? (parsed.contacts[0]?.id ?? null),
    };

    saveState();
    render();
    alert("Imported successfully.");
  } catch (err) {
    alert("Import failed: " + (err?.message || "Unknown error"));
  } finally {
    importInput.value = "";
  }
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset all data? This clears localStorage for this app.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = { contacts: [], selectedId: null };
  seedIfEmpty();
  render();
});

render();
