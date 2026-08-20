/* Reports page — depends on shared.js */

function renderReports() {
  const allDeals = state.contacts.flatMap((c) => Array.isArray(c.deals) ? c.deals : []);
  const stages = ["lead", "qualified", "proposal", "won", "lost"];
  const stageCounts = Object.fromEntries(
    stages.map((s) => [s, allDeals.filter((d) => d.stage === s).length])
  );

  const pipelineValue = allDeals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const wonValue = allDeals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  el("statContacts").textContent = state.contacts.length;
  el("statDeals").textContent = allDeals.length;
  el("statPipeline").textContent = "$" + fmtMoney(pipelineValue);
  el("statWon").textContent = "$" + fmtMoney(wonValue);

  const maxCount = Math.max(...Object.values(stageCounts), 1);
  el("stageBreakdown").innerHTML = stages.map((s) => `
    <div class="stage-row">
      <div class="stage-label">${stageLabel(s)}</div>
      <div class="stage-bar-wrap">
        <div class="stage-bar" style="width:${Math.round(stageCounts[s] / maxCount * 100)}%"></div>
      </div>
      <div class="stage-count">${stageCounts[s]}</div>
    </div>
  `).join("");
}

el("refreshBtn").addEventListener("click", renderReports);

el("printBtn").addEventListener("click", () => window.print());

el("exportCsvBtn").addEventListener("click", () => {
  const allDeals = state.contacts.flatMap((c) =>
    (c.deals || []).map((d) => ({
      contact: c.name || "",
      company: c.company || "",
      deal: d.title || "",
      value: d.value ?? "",
      stage: stageLabel(d.stage),
      closeDate: d.closeDate || "",
    }))
  );
  const headers = ["Contact", "Company", "Deal", "Value", "Stage", "Close Date"];
  const rows = allDeals.map((d) =>
    [d.contact, d.company, d.deal, d.value, d.stage, d.closeDate]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crm-deals.csv";
  a.click();
  URL.revokeObjectURL(url);
});

setupHeader(renderReports);
renderReports();
