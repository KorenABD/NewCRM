/* Contacts page — depends on shared.js */

const contactList = el("contactList");
const contactSearch = el("contactSearch");
const contactSort = el("contactSort");

const emptyState = el("emptyState");
const detailView = el("detailView");
const detailTitle = el("detailTitle");

const contactForm = el("contactForm");
const deleteContactBtn = el("deleteContactBtn");
const duplicateContactBtn = el("duplicateContactBtn");
const saveHint = el("saveHint");

const newContactBtn = el("newContactBtn");

const dealList = el("dealList");
const newDealBtn = el("newDealBtn");
const dealStageFilter = el("dealStageFilter");

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
    duplicateContactBtn.classList.add("hidden");
    detailTitle.textContent = "Details";
    return;
  }
  emptyState.classList.add("hidden");
  detailView.classList.remove("hidden");
  deleteContactBtn.classList.remove("hidden");
  duplicateContactBtn.classList.remove("hidden");
  detailTitle.textContent = selected.name ? `Details — ${selected.name}` : "Details";
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
    const pills = card.querySelectorAll(".pill");
    const editPill = pills[pills.length - 2];
    const delPill = pills[pills.length - 1];
    editPill.style.cursor = "pointer";
    delPill.style.cursor = "pointer";
    delPill.style.borderColor = "rgba(255,92,106,0.45)";
    delPill.style.color = "rgba(255,92,106,0.95)";
    editPill.addEventListener("click", (e) => { e.stopPropagation(); openDealModal(d.id); });
    delPill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Delete this deal?")) {
        contact.deals = deals.filter((x) => x.id !== d.id);
        touchContact(contact);
        saveState();
        pendo.track("Deal Deleted", {
          dealId: d.id,
          contactId: contact.id,
          stage: d.stage,
          dealValue: Number(d.value) || 0,
          wasOpen: d.stage !== "won" && d.stage !== "lost",
          remainingDealCount: contact.deals.length,
        });
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

newContactBtn.addEventListener("click", () => {
  const c = {
    id: uid(), name: "New Contact", company: "", email: "", phone: "", notes: "", deals: [],
    createdAt: nowISO(), updatedAt: nowISO(),
  };
  state.contacts.unshift(c);
  state.selectedId = c.id;
  saveState();
  pendo.track("Contact Created", {
    contactId: c.id,
    creationMethod: "blank",
    dealCount: 0,
    totalContactCount: state.contacts.length,
  });
  render();
  formFields.name.focus();
  formFields.name.select();
});

deleteContactBtn.addEventListener("click", () => {
  const selected = getSelected();
  if (!selected) return;
  if (!confirm(`Delete "${selected.name || "this contact"}"? This cannot be undone.`)) return;
  state.contacts = state.contacts.filter((c) => c.id !== selected.id);
  state.selectedId = state.contacts[0]?.id ?? null;
  saveState();
  // Deleting a contact also deletes its deals, so record the pipeline removed with it
  const deals = Array.isArray(selected.deals) ? selected.deals : [];
  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  pendo.track("Contact Deleted", {
    contactId: selected.id,
    dealCount: deals.length,
    openDealCount: openDeals.length,
    openPipelineValue: openDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
    contactAgeDays: daysSince(selected.createdAt),
    remainingContactCount: state.contacts.length,
  });
  render();
});

contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const selected = getSelected();
  if (!selected) return;
  const fieldNames = Object.keys(formFields);
  const before = Object.fromEntries(fieldNames.map((k) => [k, selected[k] || ""]));
  selected.name = formFields.name.value.trim() || "Untitled";
  selected.company = formFields.company.value.trim();
  selected.email = formFields.email.value.trim();
  selected.phone = formFields.phone.value.trim();
  selected.notes = formFields.notes.value.trim();
  touchContact(selected);
  saveState();
  // Booleans and lengths only: never send the name, email, phone or notes values (PII)
  const changedFields = fieldNames.filter((k) => before[k] !== selected[k]);
  pendo.track("Contact Saved", {
    contactId: selected.id,
    changedFields: changedFields.join(","),
    changedFieldCount: changedFields.length,
    hasCompany: !!selected.company,
    hasEmail: !!selected.email,
    hasPhone: !!selected.phone,
    hasNotes: !!selected.notes,
    notesLength: selected.notes.length,
    dealCount: (selected.deals || []).length,
  });
  flashSaved();
  renderContacts();
  detailTitle.textContent = `Details — ${selected.name}`;
});

function flashSaved() {
  saveHint.textContent = "Saved ✓";
  setTimeout(() => (saveHint.textContent = ""), 1200);
}

contactSearch.addEventListener("input", renderContacts);
contactSort.addEventListener("change", renderContacts);

// One "Contacts Searched" event per search (once typing pauses), not one per keystroke
let searchTrackTimer = null;
let lastTrackedQuery = "";
contactSearch.addEventListener("input", () => {
  clearTimeout(searchTrackTimer);
  searchTrackTimer = setTimeout(() => {
    const q = contactSearch.value.trim();
    if (q === lastTrackedQuery) return;
    lastTrackedQuery = q;
    if (!q) return;
    pendo.track("Contacts Searched", {
      queryLength: q.length, // never the query itself: searches are mostly names, emails or phones (PII)
      resultsCount: filterContacts(state.contacts).length,
      totalContactCount: state.contacts.length,
      sortOrder: contactSort.value,
    });
  }, 800);
});

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
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeDealModal(); });
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
  let newDeal = null;
  let prevDeal = null;
  if (editingDealId) {
    const idx = selected.deals.findIndex((d) => d.id === editingDealId);
    if (idx >= 0) {
      prevDeal = selected.deals[idx];
      selected.deals[idx] = { ...prevDeal, title, value, stage, closeDate };
    }
  } else {
    newDeal = { id: uid(), title, value, stage, closeDate };
    selected.deals.unshift(newDeal);
  }
  touchContact(selected);
  saveState();
  const dealValue = value === "" ? 0 : value;
  if (newDeal) {
    pendo.track("Deal Created", {
      dealId: newDeal.id,
      contactId: selected.id,
      stage,
      dealValue,
      hasValue: value !== "",
      hasCloseDate: !!closeDate,
      daysUntilClose: daysUntil(closeDate),
      contactDealCount: selected.deals.length,
    });
  }
  if (prevDeal) {
    const next = { title, value, stage, closeDate };
    const changedFields = Object.keys(next).filter((k) => String(prevDeal[k] ?? "") !== String(next[k]));
    // Saving the edit modal without changing anything is not an update
    if (changedFields.length) {
      pendo.track("Deal Updated", {
        dealId: prevDeal.id,
        contactId: selected.id,
        changedFields: changedFields.join(","),
        changedFieldCount: changedFields.length,
        stage,
        previousStage: prevDeal.stage,
        dealValue,
        previousDealValue: Number(prevDeal.value) || 0,
        hasCloseDate: !!closeDate,
      });
    }
    if (prevDeal.stage !== stage) {
      pendo.track("Deal Stage Changed", {
        dealId: prevDeal.id,
        contactId: selected.id,
        fromStage: prevDeal.stage,
        toStage: stage,
        dealValue,
        isClosedWon: stage === "won",
        isClosedLost: stage === "lost",
      });
    }
  }
  closeDealModal();
  render();
});

duplicateContactBtn.addEventListener("click", () => {
  const selected = getSelected();
  if (!selected) return;
  const copy = JSON.parse(JSON.stringify(selected));
  copy.id = uid();
  copy.name = selected.name + " (copy)";
  copy.deals = (copy.deals || []).map((d) => ({ ...d, id: uid() }));
  copy.createdAt = nowISO();
  copy.updatedAt = nowISO();
  state.contacts.unshift(copy);
  state.selectedId = copy.id;
  saveState();
  pendo.track("Contact Created", {
    contactId: copy.id,
    creationMethod: "duplicate",
    sourceContactId: selected.id,
    dealCount: copy.deals.length,
    totalContactCount: state.contacts.length,
  });
  render();
});

el("discardBtn").addEventListener("click", () => {
  renderDetail();
  saveHint.textContent = "";
});

setupHeader(render);
render();
