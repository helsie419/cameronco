(function () {
  "use strict";

  var STORAGE_KEY = "cameronCoCrmMvpState";
  var API = "/api";
  var CUSTOMER_TYPE_TO_API = {
    "Private client": "private",
    "Insurance client": "insurance",
    "Retail partner": "retail_partner",
    "Trade": "trade"
  };
  var CUSTOMER_TYPE_FROM_API = {
    "private": "Private client",
    "insurance": "Insurance client",
    "retail_partner": "Retail partner",
    "trade": "Trade"
  };
  var stages = [
    "New enquiry",
    "Quote sent",
    "Awaiting deposit",
    "CAD approval",
    "In production",
    "Quality check",
    "Ready for collection",
    "Completed"
  ];


  var templates = {
    quoteFollowup: {
      subject: "Following up on {{work_title}}",
      body: "Hi {{customer_first_name}}, just following up on quote {{work_number}} for {{work_title}}. Please let us know if you would like us to proceed or make any changes."
    },
    depositRequest: {
      subject: "Deposit request for {{work_title}}",
      body: "Hi {{customer_first_name}}, we can begin once the deposit for {{work_title}} has been received. Balance currently showing: {{balance_due}}."
    },
    cadApproval: {
      subject: "CAD approval required for {{work_title}}",
      body: "Hi {{customer_first_name}}, the design stage for {{work_title}} is ready for approval. Once approved, our workshop can continue to production."
    },
    readyCollection: {
      subject: "{{work_title}} is ready for collection",
      body: "Hi {{customer_first_name}}, your item is ready for collection from Cameron & Co. Please contact us if you would like to arrange a time."
    },
    careReminder: {
      subject: "Jewellery cleaning reminder",
      body: "Hi {{customer_first_name}}, it is time for a clean and check of {{work_title}}. We would be pleased to inspect the setting and give the item a complimentary clean."
    }
  };

  var state = loadState();
  var customerSort = {
    key: "name",
    direction: "asc"
  };
  var selectedCommList = [];
  var editingAutomationRuleId = "";

  var els = {
    saveState: byId("saveState"),
    resetDemo: byId("resetDemo"),
    metricQuoteValue: byId("metricQuoteValue"),
    metricQuoteCount: byId("metricQuoteCount"),
    metricWorkshop: byId("metricWorkshop"),
    metricOverdue: byId("metricOverdue"),
    metricBalances: byId("metricBalances"),
    metricResponses: byId("metricResponses"),
    metricResponsesOverdue: byId("metricResponsesOverdue"),
    metricTasks: byId("metricTasks"),
    metricAutomation: byId("metricAutomation"),
    pipelineSummary: byId("pipelineSummary"),
    pipelineRail: byId("pipelineRail"),
    todaySummary: byId("todaySummary"),
    todayTasks: byId("todayTasks"),
    customerSearch: byId("customerSearch"),
    customerTypeFilter: byId("customerTypeFilter"),
    customerConsentFilter: byId("customerConsentFilter"),
    customerTableBody: byId("customerTableBody"),
    addCustomerButton: byId("addCustomerButton"),
    bulkUploadCustomerButton: byId("bulkUploadCustomerButton"),
    bulkCustomerModal: byId("bulkCustomerModal"),
    bulkCustomerModalClose: byId("bulkCustomerModalClose"),
    bulkCustomerForm: byId("bulkCustomerForm"),
    bulkCustomerCsv: byId("bulkCustomerCsv"),
    commContactMode: byId("commContactMode"),
    commRecipientMode: byId("commRecipientMode"),
    commCustomer: byId("commCustomer"),
    commCustomerWrap: byId("commCustomerWrap"),
    commCustomerSearch: byId("commCustomerSearch"),
    commCustomerSelected: byId("commCustomerSelected"),
    commCustomerResults: byId("commCustomerResults"),
    commCustomerListSearch: byId("commCustomerListSearch"),
    commCustomerListResults: byId("commCustomerListResults"),
    commCustomerChips: byId("commCustomerChips"),
    commCustomerListWrap: byId("commCustomerListWrap"),
    commWork: byId("commWork"),
    commTemplate: byId("commTemplate"),
    commTemplateWrap: byId("commTemplateWrap"),
    commChannel: byId("commChannel"),
    commChannelWrap: byId("commChannelWrap"),
    commStatus: byId("commStatus"),
    commStatusWrap: byId("commStatusWrap"),
    commSubject: byId("commSubject"),
    commBody: byId("commBody"),
    commRestricted: byId("commRestricted"),
    commCreateTask: byId("commCreateTask"),
    commSubmitButton: byId("commSubmitButton"),
    commForm: byId("commForm"),
    templatePreview: byId("templatePreview"),
    commSummary: byId("commSummary"),
    commTimeline: byId("commTimeline"),
    runAutomations: byId("runAutomations"),
    automationTemplateForm: byId("automationTemplateForm"),
    automationTemplateName: byId("automationTemplateName"),
    automationPhase: byId("automationPhase"),
    automationDelay: byId("automationDelay"),
    automationSubject: byId("automationSubject"),
    automationBody: byId("automationBody"),
    automationSaveButton: byId("automationSaveButton"),
    automationRuleSummary: byId("automationRuleSummary"),
    automationRuleList: byId("automationRuleList"),
    scheduleSummary: byId("scheduleSummary"),
    automationSchedule: byId("automationSchedule"),
    automationLogSummary: byId("automationLogSummary"),
    automationLog: byId("automationLog"),
    reportRole: byId("reportRole"),
    exportReport: byId("exportReport"),
    salesReport: byId("salesReport"),
    stageReport: byId("stageReport"),
    qualityReport: byId("qualityReport"),
    auditLog: byId("auditLog"),
    detailModal: byId("detailModal"),
    detailModalClose: byId("detailModalClose"),
    detailContent: byId("detailContent")
  };

  bindEvents();
  render();
  bindHashRouting();
  loadCustomersFromApi();
  syncHeaderHeightVar();
  window.addEventListener("resize", syncHeaderHeightVar);

  function syncHeaderHeightVar() {
    var header = document.querySelector(".site-header");
    if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach(function (button) {
      button.addEventListener("click", function () {
        switchTab(button.dataset.tab);
      });
    });

    document.querySelectorAll("[data-open-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        switchTab(button.dataset.openTab);
      });
    });

    els.resetDemo.addEventListener("click", function () {
      // Customers live in the real database now — reset everything else,
      // then immediately re-sync the customer list so it doesn't show
      // stale demo seed data until the next page load.
      state = createDemoState();
      save("Demo reset");
      render();
      loadCustomersFromApi();
    });

    els.customerSearch.addEventListener("input", renderCustomers);
    els.customerTypeFilter.addEventListener("change", renderCustomers);
    els.customerConsentFilter.addEventListener("change", renderCustomers);
    els.addCustomerButton.addEventListener("click", function () {
      window.location.href = "quote-entry.html";
    });
    els.bulkUploadCustomerButton.addEventListener("click", openBulkCustomerModal);
    els.bulkCustomerModalClose.addEventListener("click", closeBulkCustomerModal);
    els.bulkCustomerModal.addEventListener("click", function (event) {
      if (event.target === els.bulkCustomerModal) closeBulkCustomerModal();
    });
    document.querySelectorAll("[data-customer-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateCustomerSort(button.dataset.customerSort);
      });
    });
    els.commContactMode.addEventListener("change", function () {
      renderContactMode();
      updateTemplateFields();
    });
    els.commRecipientMode.addEventListener("change", function () {
      renderRecipientMode();
      renderWorkSelects();
      updateTemplateFields();
      renderCommunications();
    });
    els.commCustomerSearch.addEventListener("input", function () {
      renderCustomerSearchResults(els.commCustomerSearch.value, els.commCustomerResults, "single");
    });
    els.commCustomerSearch.addEventListener("focus", function () {
      renderCustomerSearchResults(els.commCustomerSearch.value, els.commCustomerResults, "single");
    });
    els.commCustomerResults.addEventListener("click", function (event) {
      var result = event.target.closest("[data-pick-customer]");
      if (result) selectCommCustomer(result.dataset.pickCustomer);
    });
    els.commCustomerListSearch.addEventListener("input", function () {
      renderCustomerSearchResults(els.commCustomerListSearch.value, els.commCustomerListResults, "list");
    });
    els.commCustomerListSearch.addEventListener("focus", function () {
      renderCustomerSearchResults(els.commCustomerListSearch.value, els.commCustomerListResults, "list");
    });
    els.commCustomerListResults.addEventListener("click", function (event) {
      var result = event.target.closest("[data-pick-customer]");
      if (result) addCommListCustomer(result.dataset.pickCustomer);
    });
    els.commCustomerChips.addEventListener("click", function (event) {
      var remove = event.target.closest("[data-remove-customer]");
      if (remove) removeCommListCustomer(remove.dataset.removeCustomer);
    });
    els.commWork.addEventListener("change", updateTemplateFields);
    els.commTemplate.addEventListener("change", updateTemplateFields);
    els.commChannel.addEventListener("change", updateTemplateFields);
    els.commSubject.addEventListener("input", renderTemplatePreview);
    els.commBody.addEventListener("input", renderTemplatePreview);
    document.querySelectorAll(".editor-toolbar").forEach(function (toolbar) {
      toolbar.addEventListener("click", handleEditorToolbar);
    });
    els.automationTemplateForm.addEventListener("submit", saveAutomationRule);
    els.automationRuleList.addEventListener("click", function (event) {
      var edit = event.target.closest("[data-automation-action='edit']");
      if (edit) editAutomationRule(edit.dataset.ruleId);
    });

    els.bulkCustomerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      importCustomersFromCsv(els.bulkCustomerCsv.value).then(function (imported) {
        if (!imported) {
          save("No customers imported");
          return;
        }
        els.bulkCustomerForm.reset();
        closeBulkCustomerModal();
        save(imported + " customers imported");
        render();
      });
    });

    els.customerTableBody.addEventListener("click", function (event) {
      if (event.target.closest(".phone-link")) return;
      var contact = event.target.closest("[data-customer-contact]");
      if (contact) {
        openCorrespondenceForCustomer(contact.dataset.customerContact);
        return;
      }
      var newQuote = event.target.closest("[data-new-quote]");
      if (newQuote) {
        window.location.href = "quote-entry.html?customer=" + encodeURIComponent(newQuote.dataset.newQuote);
        return;
      }
      var row = event.target.closest("[data-customer-row]");
      if (row) openCustomerDetail(row.dataset.customerId);
    });

    els.detailModalClose.addEventListener("click", closeDetailModal);
    els.detailModal.addEventListener("click", function (event) {
      if (event.target === els.detailModal) closeDetailModal();
      var action = event.target.closest("[data-modal-action]");
      if (!action) return;
      if (action.dataset.modalAction === "open-customer") openCustomerDetail(action.dataset.customerId);
      if (action.dataset.modalAction === "send-customer-correspondence") {
        openCorrespondenceForCustomer(action.dataset.customerId);
      }
      if (action.dataset.modalAction === "refresh-customer-email") {
        loadCustomerEmails(action.dataset.customerId);
      }
      if (action.dataset.modalAction === "save-customer-record") saveCustomerRecord(action.dataset.customerId);
    });

    els.commForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var isSendEmail = els.commContactMode.value === "send";
      var channel = isSendEmail ? "Email" : els.commChannel.value;
      var status = isSendEmail ? "Pending" : els.commStatus.value;
      var recipients = commRecipients();
      if (!recipients.length) return;
      recipients.forEach(function (customer) {
        var blocked = isSuppressed(customer, channel, els.commTemplate.value);
        var communication = {
          id: makeId("com"),
          customerId: customer.id,
          workId: els.commRecipientMode.value === "single" ? els.commWork.value : "",
          channel: channel,
          subject: mergeForSelection(els.commSubject.value.trim(), customer.id, els.commRecipientMode.value === "single" ? els.commWork.value : ""),
          body: mergeForSelection(els.commBody.value.trim(), customer.id, els.commRecipientMode.value === "single" ? els.commWork.value : ""),
          status: blocked ? "Suppressed" : status,
          restricted: els.commRestricted.checked,
          createdAt: todayIso()
        };
        state.communications.unshift(communication);
        if (els.commCreateTask.checked && communication.status !== "Suppressed") {
          state.tasks.unshift({
            id: makeId("tsk"),
            title: "Follow up " + customer.name + " after " + channel.toLowerCase(),
            owner: "Admin",
            dueDate: addDaysIso(2),
            status: "Open",
            customerId: customer.id,
            workId: communication.workId
          });
        }
      });
      save(isSendEmail ? "Email queued" : (recipients.length > 1 ? "Logs saved" : "Log saved"));
      render();
    });

    els.runAutomations.addEventListener("click", function () {
      runDueAutomations();
      save("Automations run");
      render();
    });

    els.exportReport.addEventListener("click", function () {
      var role = els.reportRole.value;
      var allowed = role === "Owner" || role === "Finance";
      state.audit.unshift({
        id: makeId("aud"),
        createdAt: nowLabel(),
        role: role,
        report: "Management dashboard",
        outcome: allowed ? "Export allowed" : "Blocked by permission"
      });
      save("Export audited");
      renderReports();
    });
  }

  function switchTab(tabName) {
    document.querySelectorAll(".tab").forEach(function (button) {
      button.classList.toggle("active", button.dataset.tab === tabName);
    });
    document.querySelectorAll(".panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === tabName + "Panel");
    });
    document.querySelectorAll(".main-nav a[data-tab-link]").forEach(function (link) {
      link.classList.toggle("active", link.dataset.tabLink === tabName);
    });
  }

  // The other pages (job-board.html, quotes.html, rates.html) link back here
  // via index.html#customers, #contact, etc. — same panels, addressable by hash.
  function bindHashRouting() {
    var hashTabs = {
      "": "dashboard",
      customers: "customers",
      contact: "communications",
      automation: "automation",
      reports: "reports"
    };

    function applyHash() {
      var hash = window.location.hash.replace("#", "");
      if (Object.prototype.hasOwnProperty.call(hashTabs, hash)) {
        switchTab(hashTabs[hash]);
      }
    }

    window.addEventListener("hashchange", applyHash);
    applyHash();
  }

  function render() {
    renderSelects();
    renderContactMode();
    renderRecipientMode();
    loadDashboardSummary();
    renderCustomers();
    updateTemplateFields();
    renderCommunications();
    renderAutomation();
    renderReports();
  }

  function renderSelects() {
    var selectedCommCustomer = els.commCustomer.value || (state.customers[0] && state.customers[0].id);
    if (selectedCommCustomer) selectCommCustomer(selectedCommCustomer, true);
    renderCommCustomerChips();
    renderWorkSelects();
  }

  function renderContactMode() {
    var isSendEmail = els.commContactMode.value === "send";
    els.commChannelWrap.hidden = isSendEmail;
    els.commStatusWrap.hidden = isSendEmail;
    els.commTemplateWrap.hidden = !isSendEmail;
    els.commSubmitButton.textContent = isSendEmail ? "Send email" : "Save previous log";
    if (isSendEmail) {
      els.commChannel.value = "Email";
      els.commStatus.value = "Pending";
      els.commSubject.placeholder = "Email subject";
      els.commBody.placeholder = "";
    } else {
      els.commStatus.value = "Logged";
      els.commSubject.placeholder = "Call outcome or log title";
      els.commBody.placeholder = "Notes from phone call, SMS, showroom visit or other communication";
      els.commSubject.value = "";
      els.commBody.value = "";
      renderTemplatePreview();
    }
  }

  function renderRecipientMode() {
    var listMode = els.commRecipientMode.value === "list";
    els.commCustomerWrap.hidden = listMode;
    els.commCustomerListWrap.hidden = !listMode;
    els.commWork.disabled = listMode;
    els.commCustomerResults.innerHTML = "";
    els.commCustomerListResults.innerHTML = "";
    renderCommCustomerChips();
  }

  function renderCustomerSearchResults(query, container, mode) {
    var clean = String(query || "").trim().toLowerCase();
    var matches = state.customers.filter(function (customer) {
      var haystack = [customer.name, customer.phone, customer.email, customer.address, customer.type].join(" ").toLowerCase();
      return !clean || haystack.indexOf(clean) !== -1;
    }).slice(0, 8);
    container.innerHTML = matches.length ? matches.map(function (customer) {
      var selected = mode === "list" && selectedCommList.indexOf(customer.id) !== -1;
      // Plain formatted text, not a tel: link — this sits inside a
      // "pick this customer" button, and a nested <a> would fight the
      // button's own click for the tap.
      var detail = [customer.phone ? formatPhoneAU(customer.phone) : "", customer.email].filter(Boolean).join(" - ") || customer.type;
      return '<button class="search-result" data-pick-customer="' + customer.id + '" type="button"' + (selected ? " disabled" : "") + '><strong>' + escapeHtml(customer.name) + '</strong><span>' + escapeHtml(detail) + '</span></button>';
    }).join("") : empty("No customers found.");
  }

  function selectCommCustomer(customerId, skipRender) {
    var customer = findCustomer(customerId);
    if (!customer) return;
    els.commCustomer.value = customer.id;
    els.commCustomerSearch.value = customer.name;
    els.commCustomerSelected.innerHTML = [customer.phone ? phoneLinkHtml(customer.phone) : "", escapeHtml(customer.email || "")].filter(Boolean).join(" - ");
    els.commCustomerResults.innerHTML = "";
    if (!skipRender) {
      renderWorkSelects();
      updateTemplateFields();
      renderCommunications();
    }
  }

  function addCommListCustomer(customerId) {
    if (selectedCommList.indexOf(customerId) === -1) selectedCommList.push(customerId);
    els.commCustomerListSearch.value = "";
    els.commCustomerListResults.innerHTML = "";
    renderCommCustomerChips();
    updateTemplateFields();
    renderCommunications();
  }

  function removeCommListCustomer(customerId) {
    selectedCommList = selectedCommList.filter(function (id) { return id !== customerId; });
    renderCommCustomerChips();
    updateTemplateFields();
    renderCommunications();
  }

  function renderCommCustomerChips() {
    els.commCustomerChips.innerHTML = selectedCommList.map(findCustomer).filter(Boolean).map(function (customer) {
      return '<span class="recipient-chip">' + escapeHtml(customer.name) + '<button data-remove-customer="' + customer.id + '" type="button" aria-label="Remove ' + escapeHtml(customer.name) + '">×</button></span>';
    }).join("");
  }

  function renderWorkSelects() {
    var selected = els.commWork.value;
    var customerId = els.commCustomer.value || (state.customers[0] && state.customers[0].id);
    els.commWork.innerHTML = "";
    els.commWork.appendChild(new Option("General customer record", ""));
    if (els.commRecipientMode.value === "list") return;
    state.work.filter(function (work) {
      return !customerId || work.customerId === customerId;
    }).forEach(function (work) {
      els.commWork.appendChild(new Option(work.number + " - " + work.title, work.id));
    });
    if (selected) els.commWork.value = selected;
  }

  // Metrics + pipeline + today's actions are now one real, database-backed
  // view (GET /api/dashboard/summary) instead of being computed from the
  // localStorage-only state.work/state.tasks. "Today's actions" substitutes
  // jobs due and quotes awaiting a decision for the old task list, since
  // generic tasks don't exist on the real backend yet.
  function loadDashboardSummary() {
    return fetch(API + "/dashboard/summary")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load dashboard summary");
        return res.json();
      })
      .then(renderDashboardSummary)
      .catch(function (err) {
        console.error(err);
        els.pipelineSummary.textContent = "Couldn't load";
        els.todaySummary.textContent = "Couldn't load";
      });
  }

  function renderDashboardSummary(summary) {
    els.metricQuoteValue.textContent = money(summary.openQuoteValue);
    els.metricQuoteCount.textContent = summary.activeQuoteCount + " active quotes";
    els.metricWorkshop.textContent = summary.workshopLoad;
    els.metricOverdue.textContent = summary.overdueJobs + " overdue jobs";
    els.metricBalances.textContent = money(summary.unpaidBalances);
    els.metricResponses.textContent = summary.awaitingResponse;
    els.metricResponsesOverdue.textContent = summary.overdueResponses + " overdue";

    var max = Math.max.apply(null, summary.pipeline.map(function (p) { return p.count; }).concat([1]));
    els.pipelineSummary.textContent = summary.totalRecords + " records";
    els.pipelineRail.innerHTML = summary.pipeline.map(function (p) {
      var width = Math.max((p.count / max) * 100, p.count ? 10 : 0);
      return '<div class="pipeline-stage stage-' + stageClass(p.stage) + '"><strong>' + escapeHtml(p.stage) + '</strong><div class="meter-bar"><span style="width:' + width + '%"></span></div><span>' + p.count + '</span></div>';
    }).join("");

    els.todaySummary.textContent = summary.todayItems.length + " actions";
    els.todayTasks.innerHTML = summary.todayItems.length ? summary.todayItems.map(function (item) {
      var meta = /^Job due /.test(item.meta) ? "Job due " + formatDate(item.meta.replace("Job due ", ""))
        : /^Respond by /.test(item.meta) ? "Respond by " + formatDate(item.meta.replace("Respond by ", ""))
        : item.meta;
      var tag = item.claim_id ? "a" : "article";
      var href = item.claim_id ? ' href="quote-entry.html?claim=' + item.claim_id + '"' : "";
      return '<' + tag + ' class="timeline-item"' + href + '><header><div><h4>' + escapeHtml(item.title) + '</h4><p class="meta">' + escapeHtml(meta) + '</p></div></header><p class="fineprint">' + escapeHtml(item.customer || "No customer") + '</p></' + tag + '>';
    }).join("") : empty("No actions due today.");
  }

  function renderCustomers() {
    var search = els.customerSearch.value.trim().toLowerCase();
    var typeFilter = els.customerTypeFilter.value;
    var consentFilter = els.customerConsentFilter.value;
    var rows = state.customers.map(customerTableRecord).filter(function (record) {
      var haystack = [
        record.customer.name,
        record.customer.email,
        record.customer.phone,
        record.customer.address,
        record.customer.notes,
        record.customer.ringSize,
        record.customer.partner,
        record.customer.type,
        record.customer.source
      ].join(" ").toLowerCase();
      var matchesSearch = haystack.indexOf(search) !== -1;
      var matchesType = typeFilter === "All" || record.customer.type === typeFilter;
      var matchesConsent = consentFilter === "All" ||
        (consentFilter === "Marketing" && record.customer.consent.marketing) ||
        (consentFilter === "Email" && record.customer.consent.email) ||
        (consentFilter === "SMS" && record.customer.consent.sms) ||
        (consentFilter === "Missing" && !record.customer.consent.email && !record.customer.consent.sms && !record.customer.consent.marketing);
      return matchesSearch && matchesType && matchesConsent;
    }).sort(sortCustomerRecords);

    els.customerTableBody.innerHTML = rows.length ? rows.map(renderCustomerRow).join("") : '<tr><td colspan="8">' + empty("No customers match these filters.") + '</td></tr>';
    updateCustomerSortIndicators();
  }

  function customerTableRecord(customer) {
    var works = state.work.filter(function (work) { return work.customerId === customer.id; });
    var datedWorks = works.filter(function (work) { return work.dueDate; }).sort(function (a, b) {
      return b.dueDate.localeCompare(a.dueDate);
    });
    var consent = [];
    if (customer.consent.email) consent.push("Email");
    if (customer.consent.sms) consent.push("SMS");
    if (customer.consent.marketing) consent.push("Marketing");
    return {
      customer: customer,
      works: works,
      jobCount: works.length,
      lastJobDue: datedWorks[0] ? datedWorks[0].dueDate : "",
      consent: consent
    };
  }

  var ENVELOPE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2"></rect><path d="M3 6.5l9 6.5 9-6.5"></path></svg>';

  function renderCustomerRow(record) {
    var customer = record.customer;
    return '<tr data-customer-row data-customer-id="' + customer.id + '" tabindex="0"><td><strong>' + escapeHtml(customer.name) + '</strong><span>' + escapeHtml(customer.address || customer.source || "No address") + '</span></td><td>' + escapeHtml(customer.type || "Unknown") + '</td><td>' + (customer.phone ? phoneLinkHtml(customer.phone, "-") : "-") + '</td><td>' + escapeHtml(customer.email || "-") + '</td><td>' + (record.lastJobDue ? formatDate(record.lastJobDue) : "No jobs") + '</td><td><div class="jobs-cell"><span class="stage-pill">' + record.jobCount + '</span><button class="icon-button small" data-new-quote="' + customer.id + '" type="button" title="New quote for ' + escapeHtml(customer.name) + '" aria-label="New quote for ' + escapeHtml(customer.name) + '">+</button></div></td><td>' + escapeHtml(record.consent.join(", ") || "Missing") + '</td><td><button class="icon-button" data-customer-contact="' + customer.id + '" type="button" title="Send correspondence" aria-label="Send correspondence to ' + escapeHtml(customer.name) + '">' + ENVELOPE_ICON_SVG + '</button></td></tr>';
  }

  function sortCustomerRecords(a, b) {
    var key = customerSort.key;
    var av = customerSortValue(a, key);
    var bv = customerSortValue(b, key);
    if (typeof av === "number" || typeof bv === "number") {
      return (Number(av || 0) - Number(bv || 0)) * (customerSort.direction === "asc" ? 1 : -1);
    }
    return String(av || "").localeCompare(String(bv || "")) * (customerSort.direction === "asc" ? 1 : -1);
  }

  function customerSortValue(record, key) {
    if (key === "jobCount") return record.jobCount;
    if (key === "lastJobDue") return record.lastJobDue || "";
    if (key === "consent") return record.consent.join(", ");
    return record.customer[key] || "";
  }

  function updateCustomerSort(key) {
    if (customerSort.key === key) {
      customerSort.direction = customerSort.direction === "asc" ? "desc" : "asc";
    } else {
      customerSort.key = key;
      customerSort.direction = key === "lastJobDue" || key === "jobCount" ? "desc" : "asc";
    }
    renderCustomers();
  }

  function updateCustomerSortIndicators() {
    document.querySelectorAll("[data-customer-sort]").forEach(function (button) {
      var active = button.dataset.customerSort === customerSort.key;
      button.dataset.sortDirection = active ? customerSort.direction : "";
    });
  }

  function openCustomerDetail(customerId) {
    var customer = findCustomer(customerId);
    if (!customer) return;
    var communications = state.communications.filter(function (item) { return item.customerId === customer.id; });
    els.detailContent.innerHTML = [
      '<div class="modal-title-row">',
      '<div><h2 id="detailModalTitle">' + escapeHtml(customer.name) + ' <a class="help-link" href="user-manuals.html#customer-record" title="Open the Customer Record manual" aria-label="Open the Customer Record manual">?</a></h2><p class="hero-copy">' + escapeHtml([customer.type, customer.source].filter(Boolean).join(" - ")) + '</p></div>',
      '<div class="modal-header-actions">',
      '<div class="button-row">',
      '<button class="button primary" data-modal-action="save-customer-record" data-customer-id="' + customer.id + '" type="button">Save customer</button>',
      '<button class="button secondary" data-modal-action="send-customer-correspondence" data-customer-id="' + customer.id + '" type="button">Send correspondence</button>',
      '</div>',
      '<div class="consent-row"><label><input id="modalCustomerEmailConsent" type="checkbox"' + checked(customer.consent.email) + '> Email consent</label><label><input id="modalCustomerSmsConsent" type="checkbox"' + checked(customer.consent.sms) + '> SMS consent</label><label><input id="modalCustomerMarketingConsent" type="checkbox"' + checked(customer.consent.marketing) + '> Marketing consent</label></div>',
      '</div>',
      '</div>',
      '<div class="modal-section">',
      '<h3>Customer record</h3>',
      '<div class="form-grid customer-edit-grid quad">',
      '<label>Full name<input id="modalCustomerName" value="' + escapeHtml(customer.name || "") + '"></label>',
      '<label>Customer type<select id="modalCustomerType">' + optionList(["Private client", "Insurance client", "Retail partner", "Trade"], customer.type) + '</select></label>',
      '<label>Phone<div class="field-with-action"><input id="modalCustomerPhone" value="' + escapeHtml(customer.phone || "") + '">' + (customer.phone ? '<a class="call-button" href="' + telHrefAU(customer.phone) + '" title="Call ' + escapeHtml(customer.name) + '" aria-label="Call ' + escapeHtml(customer.name) + '">☎</a>' : "") + '</div></label>',
      '<label>Email<input id="modalCustomerEmail" type="email" value="' + escapeHtml(customer.email || "") + '"></label>',
      '</div>',
      '<div class="form-grid customer-edit-grid">',
      '<label>Address<input id="modalCustomerAddress" value="' + escapeHtml(customer.address || "") + '"></label>',
      '<label>Preferred contact<select id="modalCustomerPreferred">' + optionList(["Phone", "Email", "SMS", "In-store"], customer.preferred) + '</select></label>',
      '</div>',
      '<div class="form-grid customer-edit-grid triple">',
      '<label>Ring size<input id="modalCustomerRingSize" value="' + escapeHtml(customer.ringSize || "") + '"></label>',
      '<label>Partner / occasion<input id="modalCustomerPartner" value="' + escapeHtml(customer.partner || "") + '"></label>',
      '<label>Lead source<select id="modalCustomerSource">' + optionList(["Referral", "Insurance", "Website", "Walk-in", "Retail partner", "Instagram"], customer.source) + '</select></label>',
      '</div>',
      '<div class="form-grid customer-edit-grid">',
      '<label class="wide">Free text notes<textarea id="modalCustomerNotes" rows="5">' + escapeHtml(customer.notes || "") + '</textarea></label>',
      '</div>',
      '</div>',
      '<div class="history-grid modal-section"><section><h3>Work Orders</h3><div class="customer-history-list" id="customerClaimsList">' + empty("Loading...") + '</div></section><section><div class="surface-heading"><h3>Correspondence</h3><button class="button secondary compact" data-modal-action="refresh-customer-email" data-customer-id="' + customer.id + '" type="button">Refresh email</button></div><div class="customer-history-list" id="customerEmailList">' + empty(customer.email ? "Loading mailbox..." : "Add an email address to search the mailbox.") + '</div><h4 class="mini-section-title">Logged notes</h4><div class="customer-history-list">' + renderMiniCommunications(communications) + '</div></section></div>'
    ].join("");
    els.detailModal.hidden = false;
    loadCustomerClaims(customer.id);
    if (customer.email) loadCustomerEmails(customer.id);
  }

  function loadCustomerClaims(customerId) {
    var container = byId("customerClaimsList");
    fetch(API + "/claims?customer_id=" + encodeURIComponent(customerId))
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load claims");
        return res.json();
      })
      .then(function (claims) {
        if (!container) return; // modal was closed/replaced before this resolved
        container.innerHTML = renderMiniClaims(claims);
      })
      .catch(function (err) {
        console.error(err);
        if (container) container.innerHTML = empty("Couldn't load claims.");
      });
  }

  function renderMiniClaims(claims) {
    return claims.length ? claims.map(function (claim) {
      var total = claim.quoted_nett != null ? money(claim.quoted_nett) : "No quote yet";
      // No dedicated "order type" field exists yet — the clearest signal
      // available today is whether an insurer is attached at all.
      var orderType = claim.insurer ? "Insurance work - " + escapeHtml(claim.insurer) : "Private work";
      var status = escapeHtml(claim.status || "").replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      return '<a class="timeline-item" href="quote-entry.html?claim=' + claim.claim_id + '"><header><div><h4>' + orderType + '</h4><p class="meta">' + escapeHtml(claim.claim_number) + ' - ' + status + ' - ' + formatDate(claim.date_received) + '</p></div><span class="status-pill">' + total + '</span></header></a>';
    }).join("") : empty("No work orders yet.");
  }

  function loadCustomerEmails(customerId) {
    var container = byId("customerEmailList");
    if (!container) return;
    container.innerHTML = empty("Loading mailbox...");

    fetch(API + "/email/customer/" + encodeURIComponent(customerId) + "?limit=20")
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var err = new Error(body.error || "Failed to load mailbox");
            err.status = res.status;
            err.body = body;
            throw err;
          }
          return body;
        });
      })
      .then(function (body) {
        if (!container) return;
        container.innerHTML = renderMailboxMessages(body.messages || []);
      })
      .catch(function (err) {
        console.error(err);
        if (!container) return;
        if (err.status === 503) {
          container.innerHTML = empty("SiteGround email is not configured yet.");
          return;
        }
        if (err.status === 400) {
          container.innerHTML = empty("Add an email address to search the mailbox.");
          return;
        }
        container.innerHTML = empty("Couldn't load SiteGround email.");
      });
  }

  function renderMailboxMessages(messages) {
    return messages.length ? messages.map(function (message) {
      var people = message.direction === "Outbound" ? "To: " + (message.to || "-") : "From: " + (message.from || "-");
      var attachment = message.hasAttachments ? " - Attachments" : "";
      return '<article class="timeline-item"><header><div><h4>' + escapeHtml(message.subject || "(No subject)") + '</h4><p class="meta">' + escapeHtml(message.direction) + ' - ' + formatDate(message.date) + ' - ' + escapeHtml(message.mailbox || "Mailbox") + attachment + '</p></div><span class="status-pill">Email</span></header><p class="fineprint">' + escapeHtml(people) + '</p><div class="fineprint message-body">' + escapeHtml(message.snippet || "No preview available.") + '</div></article>';
    }).join("") : empty("No recent SiteGround emails found.");
  }

  function closeDetailModal() {
    els.detailModal.hidden = true;
    els.detailContent.innerHTML = "";
  }

  function openBulkCustomerModal() {
    els.bulkCustomerModal.hidden = false;
  }

  function closeBulkCustomerModal() {
    els.bulkCustomerModal.hidden = true;
  }

  function importCustomersFromCsv(csv) {
    var rows = csv.split(/\r?\n/).map(function (row) {
      return row.trim();
    }).filter(Boolean);
    if (!rows.length) return Promise.resolve(0);
    if (/^name\s*,/i.test(rows[0])) rows.shift();
    var records = rows.map(parseCsvRow).filter(function (cells) {
      return cells[0];
    });
    var imported = 0;
    // Posted one at a time (not concurrently) so a CSV of any size doesn't
    // fire a burst of simultaneous requests at the API.
    return records.reduce(function (chain, cells) {
      return chain.then(function () {
        var fields = {
          name: cells[0] || "",
          type: cells[1] || "Private client",
          phone: cells[2] || "",
          email: cells[3] || "",
          preferred: cells[4] || "Email",
          source: cells[5] || "Imported",
          ringSize: cells[6] || "",
          partner: cells[7] || "",
          notes: cells[8] || "",
          consent: {
            email: true,
            sms: false,
            marketing: false,
            updatedAt: todayIso(),
            source: "Bulk upload"
          }
        };
        return fetch(API + "/customers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(customerApiPayload(fields))
        })
          .then(function (res) {
            return res.ok ? res.json() : null;
          })
          .then(function (row) {
            if (row) {
              state.customers.unshift(normalizeApiCustomer(row));
              imported += 1;
            }
          })
          .catch(function (err) {
            console.error(err);
          });
      });
    }, Promise.resolve()).then(function () {
      return imported;
    });
  }

  function parseCsvRow(row) {
    var cells = [];
    var current = "";
    var quoted = false;
    for (var i = 0; i < row.length; i += 1) {
      var char = row[i];
      var next = row[i + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  function saveCustomerRecord(customerId) {
    var customer = findCustomer(customerId);
    if (!customer) return;
    var fields = {
      name: value("modalCustomerName"),
      type: value("modalCustomerType"),
      phone: value("modalCustomerPhone"),
      email: value("modalCustomerEmail"),
      address: value("modalCustomerAddress"),
      preferred: value("modalCustomerPreferred"),
      source: value("modalCustomerSource"),
      ringSize: value("modalCustomerRingSize"),
      partner: value("modalCustomerPartner"),
      notes: value("modalCustomerNotes"),
      consent: {
        email: byId("modalCustomerEmailConsent").checked,
        sms: byId("modalCustomerSmsConsent").checked,
        marketing: byId("modalCustomerMarketingConsent").checked,
        updatedAt: todayIso(),
        source: "CRM detail edit"
      }
    };
    fetch(API + "/customers/" + customerId, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(customerApiPayload(fields))
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to update customer");
        return res.json();
      })
      .then(function (row) {
        Object.assign(customer, normalizeApiCustomer(row));
        save("Customer saved");
        render();
        openCustomerDetail(customer.id);
      })
      .catch(function (err) {
        console.error(err);
        window.alert("Couldn't save changes - check the database connection and try again.");
      });
  }

  function openCorrespondenceForCustomer(customerId) {
    closeDetailModal();
    switchTab("communications");
    els.commRecipientMode.value = "single";
    selectCommCustomer(customerId, true);
    renderRecipientMode();
    renderWorkSelects();
    updateTemplateFields();
    renderCommunications();
  }

  function renderMiniCommunications(items) {
    return items.length ? items.map(function (item) {
      return '<article class="timeline-item ' + (item.restricted ? "restricted" : "") + '"><header><div><h4>' + escapeHtml(item.subject || item.channel) + '</h4><p class="meta">' + escapeHtml(item.channel) + ' - ' + formatDate(item.createdAt) + '</p></div><span class="status-pill">' + escapeHtml(item.status) + '</span></header><div class="fineprint message-body">' + renderMessageBody(item.body || "No message.") + '</div></article>';
    }).join("") : empty("No correspondence recorded.");
  }

  function optionList(options, selected) {
    return options.map(function (option) {
      return '<option' + (option === selected ? " selected" : "") + '>' + escapeHtml(option) + '</option>';
    }).join("");
  }

  function handleEditorToolbar(event) {
    var button = event.target.closest("button");
    if (!button) return;
    var toolbar = event.currentTarget;
    var editor = byId(toolbar.dataset.editorFor);
    if (!editor) return;
    editor.focus();
    if (button.dataset.editorCommand) {
      document.execCommand(button.dataset.editorCommand, false, null);
      return;
    }
    if (button.dataset.editorAction === "link") {
      var href = window.prompt("Paste the link URL");
      if (href) document.execCommand("createLink", false, href);
    }
    if (button.dataset.editorAction === "logo") {
      document.execCommand("insertHTML", false, signatureHtml());
    }
  }

  function signatureHtml() {
    return '<p><br></p><p><img class="email-signature-logo" src="' + escapeHtml(logoSrc()) + '" alt="Cameron & Co"></p>';
  }

  function logoSrc() {
    return "assets/cameron-co-logo-cropped.png";
  }

  function editorHtml(editor) {
    return sanitizeEmailHtml(editor.innerHTML.trim());
  }

  function setEditorHtml(editor, html) {
    editor.innerHTML = formatMessageHtml(html || "");
  }

  function clearEditor(editor) {
    editor.innerHTML = "";
  }

  function renderMessageBody(body) {
    return formatMessageHtml(body || "");
  }

  function formatMessageHtml(body) {
    var value = String(body || "");
    if (/<[a-z][\s\S]*>/i.test(value)) return sanitizeEmailHtml(value);
    return value ? escapeHtml(value).replace(/\n/g, "<br>") : "";
  }

  function sanitizeEmailHtml(html) {
    var template = document.createElement("template");
    template.innerHTML = String(html || "");
    var allowed = ["A", "B", "BR", "DIV", "EM", "I", "IMG", "LI", "OL", "P", "SPAN", "STRONG", "U", "UL"];
    Array.prototype.slice.call(template.content.querySelectorAll("*")).forEach(function (node) {
      if (allowed.indexOf(node.tagName) === -1) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        return;
      }
      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var keep = (node.tagName === "A" && name === "href") ||
          (node.tagName === "IMG" && (name === "src" || name === "alt" || name === "class")) ||
          name === "class";
        if (!keep) node.removeAttribute(attr.name);
      });
      if (node.tagName === "A") {
        if (!/^https?:\/\//i.test(node.getAttribute("href") || "")) node.removeAttribute("href");
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener");
      }
      if (node.tagName === "IMG" && !/^(https?:\/\/|assets\/|\.\.\/|\.\.\/\.\.\/|data:image\/)/i.test(node.getAttribute("src") || "")) {
        node.remove();
      }
    });
    return template.innerHTML.trim();
  }

  function saveAutomationRule(event) {
    event.preventDefault();
    var payload = {
      name: els.automationTemplateName.value.trim() || "Untitled automation",
      phase: els.automationPhase.value,
      delayDays: Number(els.automationDelay.value || 0),
      channel: "Email",
      subject: els.automationSubject.value.trim() || "Update from Cameron & Co",
      body: editorHtml(els.automationBody) || "<p>Hi {{customer_first_name}},</p><p>We have an update about {{work_title}}.</p>",
      createdAt: todayIso()
    };
    if (editingAutomationRuleId) {
      var existing = state.automationRules.find(function (rule) {
        return rule.id === editingAutomationRuleId;
      });
      if (existing) {
        Object.assign(existing, payload, {
          id: existing.id,
          createdAt: existing.createdAt || todayIso(),
          updatedAt: todayIso()
        });
      }
    } else {
      state.automationRules.unshift(Object.assign({
        id: makeId("aut")
      }, payload));
    }
    editingAutomationRuleId = "";
    els.automationTemplateForm.reset();
    clearEditor(els.automationBody);
    els.automationSaveButton.textContent = "Save automation";
    save("Automation saved");
    render();
  }

  function editAutomationRule(ruleId) {
    var rule = state.automationRules.find(function (item) {
      return item.id === ruleId;
    });
    if (!rule) return;
    editingAutomationRuleId = rule.id;
    els.automationTemplateName.value = rule.name;
    els.automationPhase.value = rule.phase;
    els.automationDelay.value = String(rule.delayDays || 0);
    els.automationSubject.value = rule.subject;
    setEditorHtml(els.automationBody, rule.body);
    els.automationSaveButton.textContent = "Update automation";
    els.automationTemplateName.focus();
  }

  function updateTemplateFields() {
    if (els.commContactMode.value === "log") {
      renderTemplatePreview();
      return;
    }
    var template = templates[els.commTemplate.value];
    els.commSubject.value = merge(template.subject);
    els.commBody.value = merge(template.body);
    renderTemplatePreview();
  }

  function renderTemplatePreview() {
    els.templatePreview.innerHTML = '<strong>' + escapeHtml(els.commSubject.value || "No subject") + '</strong><p>' + escapeHtml(els.commBody.value || "No message").replace(/\n/g, "<br>") + '</p>';
  }

  function renderCommunications() {
    var customerIds = els.commRecipientMode.value === "list" ? selectedCommCustomerIds() : [els.commCustomer.value];
    var items = state.communications.filter(function (communication) {
      return customerIds.indexOf(communication.customerId) !== -1;
    });
    els.commSummary.textContent = items.length + " items";
    els.commTimeline.innerHTML = items.length ? items.map(function (item) {
      var work = findWork(item.workId);
      var customer = findCustomer(item.customerId);
      return '<article class="timeline-item ' + (item.restricted ? "restricted" : "") + '"><header><div><h4>' + escapeHtml(item.subject || item.channel) + '</h4><p class="meta">' + escapeHtml(item.channel) + ' - ' + formatDate(item.createdAt) + (customer ? ' - ' + escapeHtml(customer.name) : '') + (work ? ' - ' + escapeHtml(work.number) : '') + '</p></div><span class="status-pill">' + escapeHtml(item.status) + '</span></header><div class="message-body">' + renderMessageBody(item.body) + '</div></article>';
    }).join("") : empty("No communications for this customer.");
  }

  function selectedCommCustomerIds() {
    return selectedCommList.slice();
  }

  function commRecipients() {
    if (els.commRecipientMode.value === "list") {
      return selectedCommCustomerIds().map(findCustomer).filter(Boolean);
    }
    return [findCustomer(els.commCustomer.value)].filter(Boolean);
  }

  function renderAutomation() {
    var schedules = buildSchedules();
    var dueCount = schedules.filter(function (item) { return item.dueDate <= todayIso(); }).length;
    els.automationRuleSummary.textContent = state.automationRules.length + " active";
    els.automationRuleList.innerHTML = state.automationRules.length ? state.automationRules.map(function (rule) {
      return '<article class="automation-item"><header><div><h4>' + escapeHtml(rule.name) + '</h4><p class="meta">Email - ' + escapeHtml(rule.phase) + ' - ' + timingLabel(rule.delayDays) + '</p></div><div class="automation-actions"><span class="status-pill">Active</span><button class="button secondary compact" data-automation-action="edit" data-rule-id="' + rule.id + '" type="button">Edit</button></div></header><p class="fineprint">' + escapeHtml(rule.subject) + '</p></article>';
    }).join("") : empty("No email automations configured yet.");
    els.scheduleSummary.textContent = dueCount + " due";
    els.automationSchedule.innerHTML = schedules.length ? schedules.slice(0, 12).map(function (item) {
      return '<article class="automation-item ' + (item.status || "").toLowerCase() + '"><header><div><h4>' + escapeHtml(item.title) + '</h4><p class="meta">' + escapeHtml(item.channel) + ' - due ' + formatDate(item.dueDate) + ' - ' + escapeHtml(item.customerName) + '</p></div><span class="status-pill">' + escapeHtml(item.status) + '</span></header><p class="fineprint">' + escapeHtml(item.reason) + '</p></article>';
    }).join("") : empty("No scheduled automations.");

    els.automationLogSummary.textContent = state.automationLog.length + " logged";
    els.automationLog.innerHTML = state.automationLog.length ? state.automationLog.slice(0, 12).map(function (item) {
      return '<article class="automation-item ' + item.status.toLowerCase() + '"><header><div><h4>' + escapeHtml(item.title) + '</h4><p class="meta">' + escapeHtml(item.createdAt) + ' - ' + escapeHtml(item.customerName) + '</p></div><span class="status-pill">' + escapeHtml(item.status) + '</span></header><p class="fineprint">' + escapeHtml(item.reason) + '</p></article>';
    }).join("") : empty("No automation runs yet.");
  }

  function renderReports() {
    var quoteValue = state.work.filter(function (work) {
      return work.stage === "New enquiry" || work.stage === "Quote sent";
    }).reduce(function (sum, work) {
      return sum + work.price;
    }, 0);
    var acceptedValue = state.work.filter(function (work) {
      return stageIndex(work.stage) >= stageIndex("Awaiting deposit");
    }).reduce(function (sum, work) {
      return sum + work.price;
    }, 0);
    var automationStats = state.automationLog.reduce(function (acc, item) {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    els.salesReport.innerHTML = reportRow("Open quote value", money(quoteValue)) + reportRow("Accepted job value", money(acceptedValue)) + reportRow("Average job value", money(avg(state.work.map(function (work) { return work.price; })))) + reportRow("Automation sent", automationStats.Sent || 0);
    els.stageReport.innerHTML = stages.map(function (stage) {
      return reportRow(stage, countStage(stage));
    }).join("");

    var quality = dataQualityIssues();
    els.qualityReport.innerHTML = quality.length ? quality.map(function (issue) {
      return reportRow(issue.label, issue.count);
    }).join("") : empty("No data quality issues found.");

    els.auditLog.innerHTML = state.audit.length ? state.audit.slice(0, 8).map(function (item) {
      return '<article class="report-row"><span>' + escapeHtml(item.createdAt) + ' - ' + escapeHtml(item.role) + '</span><strong>' + escapeHtml(item.outcome) + '</strong></article>';
    }).join("") : empty("No export attempts recorded.");
  }

  function buildSchedules() {
    var schedules = [];
    state.automationRules.forEach(function (rule) {
      state.work.filter(function (work) {
        return work.stage === rule.phase;
      }).forEach(function (work) {
        var customer = findCustomer(work.customerId);
        if (!customer) return;
        var baseDate = phaseDate(work, rule.phase);
        schedules.push(scheduleItem(rule, addDaysIso(rule.delayDays, baseDate), work, customer));
      });
    });
    return schedules.sort(function (a, b) {
      return a.dueDate.localeCompare(b.dueDate);
    });
  }

  function scheduleItem(rule, dueDate, work, customer) {
    var status = isSuppressed(customer, "Email") ? "Suppressed" : "Pending";
    return {
      id: rule.id + work.id + dueDate,
      ruleId: rule.id,
      title: rule.name,
      channel: "Email",
      dueDate: dueDate,
      workId: work.id,
      customerId: customer.id,
      customerName: customer.name,
      status: status,
      subject: mergeForSelection(rule.subject, customer.id, work.id),
      body: mergeForSelection(rule.body, customer.id, work.id),
      reason: rule.phase + " correspondence, " + timingLabel(rule.delayDays).toLowerCase() + "."
    };
  }

  function runDueAutomations(workId) {
    buildSchedules().filter(function (item) {
      return item.dueDate <= todayIso() && (!workId || item.workId === workId);
    }).forEach(function (item) {
      if (state.automationLog.some(function (run) { return run.scheduleId === item.id; })) return;
      var status = item.status === "Suppressed" ? "Suppressed" : (Math.random() > .16 ? "Sent" : "Failed");
      state.automationLog.unshift({
        scheduleId: item.id,
        title: item.title,
        customerName: item.customerName,
        status: status,
        reason: status === "Failed" ? "Provider simulation returned a temporary failure." : item.reason,
        createdAt: nowLabel()
      });
      if (status === "Sent") {
        state.communications.unshift({
          id: makeId("com"),
          customerId: item.customerId,
          workId: item.workId,
          channel: item.channel,
          subject: item.subject,
          body: item.body,
          status: "Delivered",
          restricted: false,
          createdAt: todayIso()
        });
      }
    });
  }

  function dataQualityIssues() {
    return [
      { label: "Customers missing email", count: state.customers.filter(function (customer) { return !customer.email; }).length },
      { label: "Customers missing consent", count: state.customers.filter(function (customer) { return !customer.consent.email && !customer.consent.sms; }).length },
      { label: "Work missing due date", count: state.work.filter(function (work) { return !work.dueDate; }).length },
      { label: "Open balances", count: state.work.filter(function (work) { return work.balance > 0; }).length },
      { label: "Overdue active jobs", count: state.work.filter(isOverdue).length }
    ].filter(function (issue) {
      return issue.count > 0;
    });
  }

  function stoneSummary(work) {
    if (!work) return "";
    if (!work.stoneShape && !work.stoneType && !work.stoneProvided && !work.stoneOrigin) return work.stones || "";
    var parts = [];
    if (work.stoneOrigin && work.stoneOrigin !== "Not applicable") parts.push(work.stoneOrigin);
    if (work.stoneShape && work.stoneShape !== "Not selected") parts.push(work.stoneShape);
    if (work.stoneType && work.stoneType !== "Not selected") parts.push(work.stoneType);
    if (!parts.length) return work.stones || "";
    parts.push(work.stoneProvided === "Yes" ? "customer supplied" : "Cameron supplied");
    return parts.join(" ");
  }

  function merge(text) {
    var customerId = els.commRecipientMode.value === "list" ? (selectedCommCustomerIds()[0] || els.commCustomer.value) : els.commCustomer.value;
    var workId = els.commRecipientMode.value === "list" ? "" : els.commWork.value;
    return mergeForSelection(text, customerId, workId);
  }

  function mergeForSelection(text, customerId, workId) {
    var customer = findCustomer(customerId) || state.customers[0] || { name: "there" };
    var work = findWork(workId) || state.work.find(function (item) { return item.customerId === customer.id; }) || {};
    var values = {
      customer_first_name: customer.name.split(" ")[0] || "there",
      customer_full_name: customer.name,
      work_title: work.title || "your item",
      work_number: work.number || "the record",
      balance_due: money(work.balance || 0),
      store_name: "Cameron & Co",
      store_phone: "(03) 9836 9922"
    };
    return String(text || "").replace(/\{\{([^}]+)\}\}/g, function (_, key) {
      return values[key.trim()] || "";
    });
  }

  function phaseDate(work, phase) {
    if (phase === "Completed" && work.completedAt) return work.completedAt;
    return work.stageUpdatedAt || work.createdAt || todayIso();
  }

  function timingLabel(days) {
    if (!Number(days)) return "Immediately";
    if (Number(days) === 1) return "1 day later";
    return days + " days later";
  }

  function isSuppressed(customer, channel, templateKey) {
    if (!customer) return true;
    if (templateKey === "careReminder" && !customer.consent.marketing) return true;
    if (channel === "SMS" && !customer.consent.sms) return true;
    if (channel === "Email" && !customer.consent.email) return true;
    return false;
  }

  function reportRow(label, value) {
    return '<article class="report-row"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(String(value)) + '</strong></article>';
  }

  function empty(text) {
    return '<div class="empty-state">' + escapeHtml(text) + '</div>';
  }

  function countStage(stage) {
    return state.work.filter(function (work) {
      return work.stage === stage;
    }).length;
  }

  function isOverdue(work) {
    return work.dueDate && work.dueDate < todayIso() && work.stage !== "Completed";
  }

  function stageIndex(stage) {
    return stages.indexOf(stage);
  }

  function stageClass(stage) {
    return String(stage || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function findCustomer(id) {
    return state.customers.find(function (customer) {
      return customer.id === id;
    });
  }

  // Customers are the one entity now backed by the real database (the rest
  // of state still runs on localStorage). These keep the same in-memory
  // Customer shape everything else in this file already expects, so only
  // the load/create/update paths change — every render/sort/filter
  // function downstream is untouched.
  function normalizeApiCustomer(c) {
    return {
      id: String(c.id),
      createdAt: c.created_at || todayIso(),
      name: [c.first_name, c.last_name].filter(Boolean).join(" ").trim(),
      type: CUSTOMER_TYPE_FROM_API[c.customer_type] || c.customer_type || "Private client",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address_line1 || "",
      preferred: c.preferred_contact || "",
      source: c.source || "",
      ringSize: c.ring_size || "",
      partner: c.partner_or_occasion || "",
      notes: c.notes || "",
      consent: {
        email: !!c.consent_email,
        sms: !!c.consent_sms,
        marketing: !!c.consent_marketing,
        updatedAt: c.consent_updated_at || c.created_at || todayIso(),
        source: c.consent_source || ""
      }
    };
  }

  function customerApiPayload(fields) {
    var nameParts = (fields.name || "").trim().split(/\s+/).filter(Boolean);
    return {
      first_name: nameParts.shift() || "",
      last_name: nameParts.join(" "),
      phone: fields.phone || null,
      email: fields.email || null,
      address_line1: fields.address || null,
      customer_type: CUSTOMER_TYPE_TO_API[fields.type] || "private",
      preferred_contact: fields.preferred || null,
      source: fields.source || null,
      ring_size: fields.ringSize || null,
      partner_or_occasion: fields.partner || null,
      notes: fields.notes || null,
      consent_email: !!fields.consent.email,
      consent_sms: !!fields.consent.sms,
      consent_marketing: !!fields.consent.marketing,
      consent_updated_at: fields.consent.updatedAt || null,
      consent_source: fields.consent.source || null
    };
  }

  function loadCustomersFromApi() {
    els.saveState.textContent = "Checking database...";
    return fetch(API + "/customers", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("API " + res.status + " from " + API + "/customers");
        return res.json();
      })
      .then(function (rows) {
        state.customers = rows.map(normalizeApiCustomer);
        els.saveState.textContent = "Connected";
        render();
      })
      .catch(function (err) {
        console.error(err);
        els.saveState.textContent = "Offline - API not reachable";
        els.saveState.title = err.message || "Couldn't reach " + API + "/customers";
      });
  }

  function findWork(id) {
    return state.work.find(function (work) {
      return work.id === id;
    });
  }

  function value(id) {
    return byId(id).value.trim();
  }

  function numberValue(id) {
    return Number(byId(id).value || 0);
  }

  function money(value) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function avg(values) {
    var clean = values.filter(function (value) { return Number.isFinite(value); });
    if (!clean.length) return 0;
    return clean.reduce(function (sum, value) { return sum + value; }, 0) / clean.length;
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDaysIso(days, fromIso) {
    var date = fromIso ? new Date(fromIso + "T00:00:00") : new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    if (!iso) return "No date";
    var value = String(iso);
    var date = new Date(value.indexOf("T") === -1 ? value + "T00:00:00" : value);
    if (Number.isNaN(date.getTime())) return "No date";
    return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short" }).format(date);
  }

  function nowLabel() {
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
  }

  function makeId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function checked(value) {
    return value ? " checked" : "";
  }

  function save(message) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    els.saveState.textContent = message || "Connected";
    window.clearTimeout(save._timer);
    save._timer = window.setTimeout(function () {
      els.saveState.textContent = "Connected";
    }, 1400);
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.customers && saved.work) return normalizeState(saved);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return createDemoState();
  }

  function normalizeState(saved) {
    saved.nextWorkNumber = Math.max(saved.nextWorkNumber || 1051, 1051);
    saved.audit = saved.audit || [];
    saved.automationLog = saved.automationLog || [];
    saved.automationRules = saved.automationRules || defaultAutomationRules();
    saved.tasks = saved.tasks || [];
    saved.communications = saved.communications || [];
    saved.work.forEach(function (work) {
      work.satisfaction = work.satisfaction || "Not recorded";
      work.stageUpdatedAt = work.stageUpdatedAt || work.completedAt || work.createdAt || todayIso();
      work.stoneShape = work.stoneShape || "";
      work.stoneType = work.stoneType || "";
      work.stoneProvided = work.stoneProvided || "";
      work.stoneOrigin = work.stoneOrigin || "";
      work.stones = work.stones || stoneSummary(work);
      work.images = work.images || [];
      work.timeline = work.timeline || [];
      work.approvals = work.approvals || { quote: false, deposit: false, cad: false, stone: false, qa: false };
    });
    saved.customers.forEach(function (customer) {
      customer.address = customer.address || "";
      customer.consent = customer.consent || { email: true, sms: false, marketing: false, updatedAt: todayIso(), source: "Imported" };
    });
    return saved;
  }

  function createDemoState() {
    var customers = [
      {
        id: "cus-roslyn",
        createdAt: addDaysIso(-24),
        name: "Roslyn Parker",
        type: "Insurance client",
        phone: "0412 220 118",
        email: "roslyn@example.com",
        address: "18 Maling Road, Canterbury VIC 3126",
        preferred: "Email",
        source: "Insurance",
        ringSize: "M 1/2",
        partner: "Wedding ring replacement",
        notes: "Prefers classic settings and white metals. Appreciates careful updates during claim work.",
        consent: { email: true, sms: true, marketing: true, updatedAt: addDaysIso(-24), source: "Insurance intake" }
      },
      {
        id: "cus-marina",
        createdAt: addDaysIso(-16),
        name: "Marina Elliott",
        type: "Private client",
        phone: "0438 004 291",
        email: "marina@example.com",
        address: "42 Glyndon Road, Camberwell VIC 3124",
        preferred: "SMS",
        source: "Referral",
        ringSize: "N",
        partner: "Anniversary in September",
        notes: "Likes rose gold, green sapphires, and delicate claw settings.",
        consent: { email: true, sms: true, marketing: false, updatedAt: addDaysIso(-16), source: "Showroom visit" }
      },
      {
        id: "cus-classique",
        createdAt: addDaysIso(-40),
        name: "Classique Jewellery",
        type: "Retail partner",
        phone: "(02) 8000 2291",
        email: "orders@classique.example",
        address: "12 King Street, Sydney NSW 2000",
        preferred: "Email",
        source: "Retail partner",
        ringSize: "",
        partner: "Trade repairs",
        notes: "Batch repair work. Needs fast status visibility and invoice references.",
        consent: { email: true, sms: false, marketing: false, updatedAt: addDaysIso(-40), source: "Trade account" }
      },
      {
        id: "cus-hannah",
        createdAt: addDaysIso(-9),
        name: "Hannah Lowe",
        type: "Private client",
        phone: "0403 771 229",
        email: "hannah@example.com",
        address: "7 Grace Street, Hawthorn VIC 3122",
        preferred: "Email",
        source: "Instagram",
        ringSize: "L",
        partner: "Engagement consultation",
        notes: "Modern fine bands, elongated stones, and low-profile settings. Wants gentle education on lab-grown options.",
        consent: { email: true, sms: true, marketing: true, updatedAt: addDaysIso(-9), source: "Instagram enquiry" }
      },
      {
        id: "cus-michael",
        createdAt: addDaysIso(-13),
        name: "Michael Tan",
        type: "Private client",
        phone: "0418 990 441",
        email: "michael@example.com",
        address: "3 Victoria Avenue, Kew VIC 3101",
        preferred: "Phone",
        source: "Referral",
        ringSize: "Q",
        partner: "Anniversary band",
        notes: "Prefers direct phone updates. Interested in brushed yellow gold and subtle engraving.",
        consent: { email: true, sms: true, marketing: false, updatedAt: addDaysIso(-13), source: "Referral call" }
      },
      {
        id: "cus-amelia",
        createdAt: addDaysIso(-27),
        name: "Amelia Grant",
        type: "Insurance client",
        phone: "0422 615 908",
        email: "amelia@example.com",
        address: "29 Burke Road, Glen Iris VIC 3146",
        preferred: "Email",
        source: "Insurance",
        ringSize: "O",
        partner: "Lost pendant claim",
        notes: "Needs valuation paperwork attached at completion. Likes classic white gold and emerald cuts.",
        consent: { email: true, sms: false, marketing: false, updatedAt: addDaysIso(-27), source: "Insurance intake" }
      },
      {
        id: "cus-victoria",
        createdAt: addDaysIso(-5),
        name: "Victoria Hall",
        type: "Private client",
        phone: "0430 882 145",
        email: "victoria@example.com",
        address: "91 High Street, Armadale VIC 3143",
        preferred: "SMS",
        source: "Walk-in",
        ringSize: "N 1/2",
        partner: "Remodel heirloom ring",
        notes: "Sentimental family stones. Wants approval before any irreversible work.",
        consent: { email: true, sms: true, marketing: true, updatedAt: addDaysIso(-5), source: "Showroom visit" }
      },
      {
        id: "cus-oscar",
        createdAt: addDaysIso(-21),
        name: "Oscar Nguyen",
        type: "Private client",
        phone: "0491 330 812",
        email: "oscar@example.com",
        address: "55 Toorak Road, South Yarra VIC 3141",
        preferred: "Email",
        source: "Website",
        ringSize: "",
        partner: "Signet ring enquiry",
        notes: "Budget conscious but open to staged payments. Likes clean geometry and black onyx.",
        consent: { email: true, sms: false, marketing: true, updatedAt: addDaysIso(-21), source: "Website form" }
      },
      {
        id: "cus-luna",
        createdAt: addDaysIso(-33),
        name: "Luna Bridal",
        type: "Retail partner",
        phone: "(03) 9010 3377",
        email: "studio@lunabridal.example",
        address: "6 Chapel Street, Windsor VIC 3181",
        preferred: "Email",
        source: "Retail partner",
        ringSize: "",
        partner: "Wholesale bridal samples",
        notes: "Monthly sample repairs and resizing. Requires itemised notes for each piece.",
        consent: { email: true, sms: false, marketing: false, updatedAt: addDaysIso(-33), source: "Trade account" }
      },
      {
        id: "cus-claire",
        createdAt: addDaysIso(-7),
        name: "Claire Morris",
        type: "Private client",
        phone: "0408 114 772",
        email: "claire@example.com",
        address: "14 Union Street, Brighton VIC 3186",
        preferred: "Email",
        source: "Walk-in",
        ringSize: "K 1/2",
        partner: "Push present",
        notes: "Likes soft vintage details, milgrain, and warm yellow gold. Needs collection before family event.",
        consent: { email: true, sms: true, marketing: true, updatedAt: addDaysIso(-7), source: "Showroom visit" }
      },
      {
        id: "cus-daniel",
        createdAt: addDaysIso(-18),
        name: "Daniel Brooks",
        type: "Private client",
        phone: "0417 640 003",
        email: "daniel@example.com",
        address: "8 Riversdale Road, Hawthorn VIC 3122",
        preferred: "SMS",
        source: "Website",
        ringSize: "R",
        partner: "Wedding band resize",
        notes: "Needs short SMS updates. Sensitive to turnaround time due to travel.",
        consent: { email: true, sms: true, marketing: false, updatedAt: addDaysIso(-18), source: "Website form" }
      },
      {
        id: "cus-priya",
        createdAt: addDaysIso(-11),
        name: "Priya Shah",
        type: "Insurance client",
        phone: "0429 771 404",
        email: "priya@example.com",
        address: "22 Auburn Road, Hawthorn East VIC 3123",
        preferred: "Email",
        source: "Insurance",
        ringSize: "M",
        partner: "Bracelet repair claim",
        notes: "Insurance replacement for broken bracelet clasp. Requires before and after photos.",
        consent: { email: true, sms: false, marketing: false, updatedAt: addDaysIso(-11), source: "Insurance intake" }
      },
      {
        id: "cus-atelier",
        createdAt: addDaysIso(-46),
        name: "Atelier Grey",
        type: "Retail partner",
        phone: "(03) 9077 1144",
        email: "orders@ateliergrey.example",
        address: "31 Gertrude Street, Fitzroy VIC 3065",
        preferred: "Email",
        source: "Retail partner",
        ringSize: "",
        partner: "Trade custom orders",
        notes: "Prefers concise production updates and consolidated weekly invoices.",
        consent: { email: true, sms: false, marketing: false, updatedAt: addDaysIso(-46), source: "Trade account" }
      }
    ];

    return {
      nextWorkNumber: 1051,
      customers: customers,
      work: [
        {
          id: "wrk-claim",
          number: "CC-1038",
          customerId: "cus-roslyn",
          stage: "CAD approval",
          title: "Platinum solitaire replacement",
          metal: "Platinum",
          stones: "1.05ct round brilliant diamond, Cameron supplied",
          stoneShape: "Round",
          stoneType: "Diamond",
          stoneProvided: "No",
          stoneOrigin: "Natural",
          size: "M 1/2",
          dueDate: addDaysIso(9),
          materials: 1250,
          labour: 1600,
          supplier: 6400,
          price: 11800,
          deposit: 4000,
          balance: 7800,
          owner: "Tracey",
          notes: "Insurance replacement. CAD render sent for approval. Valuation document required at collection.",
          satisfaction: "Happy",
          createdAt: addDaysIso(-18),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: true, cad: false, stone: true, qa: false },
          timeline: [{ date: addDaysIso(-2), text: "CAD render sent for approval" }]
        },
        {
          id: "wrk-sapphire",
          number: "CC-1039",
          customerId: "cus-marina",
          stage: "Ready for collection",
          title: "Rose gold green sapphire ring",
          metal: "18ct rose gold",
          stones: "Client approved oval green sapphire",
          stoneShape: "Oval",
          stoneType: "Sapphire",
          stoneProvided: "Yes",
          stoneOrigin: "Natural",
          size: "N",
          dueDate: addDaysIso(-1),
          materials: 980,
          labour: 1420,
          supplier: 2100,
          price: 6900,
          deposit: 3000,
          balance: 3900,
          owner: "April",
          notes: "Final polish complete. Photograph before collection.",
          satisfaction: "Delighted",
          createdAt: addDaysIso(-31),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: true, cad: true, stone: true, qa: true },
          timeline: [{ date: todayIso(), text: "Ready for collection" }]
        },
        {
          id: "wrk-trade",
          number: "CC-1040",
          customerId: "cus-classique",
          stage: "In production",
          title: "Trade repair batch - claws and rhodium",
          metal: "18ct white gold",
          stones: "Customer supplied diamonds across 6 items",
          stoneShape: "Round",
          stoneType: "Diamond",
          stoneProvided: "Yes",
          stoneOrigin: "Natural",
          size: "Mixed",
          dueDate: addDaysIso(3),
          materials: 360,
          labour: 1800,
          supplier: 0,
          price: 3200,
          deposit: 0,
          balance: 3200,
          owner: "Workshop",
          notes: "Check each setting before rhodium. Return with itemised repair notes.",
          satisfaction: "Neutral",
          createdAt: addDaysIso(-6),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: false, cad: true, stone: true, qa: false },
          timeline: [{ date: addDaysIso(-1), text: "Workshop started repairs" }]
        },
        {
          id: "wrk-clean",
          number: "CC-1028",
          customerId: "cus-roslyn",
          stage: "Completed",
          title: "Clean and setting check",
          metal: "18ct white gold",
          stones: "Diamond dress ring",
          stoneShape: "Round",
          stoneType: "Diamond",
          stoneProvided: "Yes",
          stoneOrigin: "Natural",
          size: "M 1/2",
          dueDate: addDaysIso(-38),
          materials: 0,
          labour: 120,
          supplier: 0,
          price: 0,
          deposit: 0,
          balance: 0,
          owner: "Admin",
          notes: "Complimentary clean after insurance work.",
          satisfaction: "Delighted",
          createdAt: addDaysIso(-45),
          completedAt: addDaysIso(-31),
          nextCleanDate: addDaysIso(-1),
          approvals: { quote: true, deposit: true, cad: true, stone: true, qa: true },
          timeline: [{ date: addDaysIso(-31), text: "Completed and collected" }]
        },
        {
          id: "wrk-lab-oval",
          number: "CC-1041",
          customerId: "cus-hannah",
          stage: "Quote sent",
          title: "Lab oval diamond engagement ring",
          metal: "18ct yellow gold",
          stones: "Lab grown Oval Diamond Cameron supplied",
          stoneShape: "Oval",
          stoneType: "Diamond",
          stoneProvided: "No",
          stoneOrigin: "Lab grown",
          size: "L",
          dueDate: addDaysIso(21),
          materials: 860,
          labour: 1450,
          supplier: 2800,
          price: 7800,
          deposit: 0,
          balance: 7800,
          owner: "Tracey",
          notes: "Quote includes two band widths and low basket setting. Awaiting stone approval.",
          satisfaction: "Not recorded",
          createdAt: addDaysIso(-8),
          stageUpdatedAt: addDaysIso(-2),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: false, cad: false, stone: false, qa: false },
          timeline: [{ date: addDaysIso(-2), text: "Quote sent" }]
        },
        {
          id: "wrk-anniversary",
          number: "CC-1042",
          customerId: "cus-michael",
          stage: "Awaiting deposit",
          title: "Brushed anniversary band",
          metal: "18ct yellow gold",
          stones: "Not selected",
          stoneShape: "Not selected",
          stoneType: "Not selected",
          stoneProvided: "No",
          stoneOrigin: "Not applicable",
          size: "Q",
          dueDate: addDaysIso(14),
          materials: 720,
          labour: 980,
          supplier: 0,
          price: 3200,
          deposit: 0,
          balance: 3200,
          owner: "April",
          notes: "Client approved brushed finish. Waiting for deposit before casting.",
          satisfaction: "Happy",
          createdAt: addDaysIso(-12),
          stageUpdatedAt: addDaysIso(-3),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: false, cad: false, stone: false, qa: false },
          timeline: [{ date: addDaysIso(-3), text: "Accepted quote, deposit requested" }]
        },
        {
          id: "wrk-pendant",
          number: "CC-1043",
          customerId: "cus-amelia",
          stage: "CAD approval",
          title: "Emerald cut pendant replacement",
          metal: "18ct white gold",
          stones: "Natural Emerald Sapphire Cameron supplied",
          stoneShape: "Emerald",
          stoneType: "Sapphire",
          stoneProvided: "No",
          stoneOrigin: "Natural",
          size: "",
          dueDate: addDaysIso(12),
          materials: 640,
          labour: 1100,
          supplier: 1850,
          price: 5600,
          deposit: 2500,
          balance: 3100,
          owner: "Tracey",
          notes: "Insurance claim. CAD needs insurer approval before production.",
          satisfaction: "Neutral",
          createdAt: addDaysIso(-25),
          stageUpdatedAt: addDaysIso(-4),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: true, cad: false, stone: true, qa: false },
          timeline: [{ date: addDaysIso(-4), text: "CAD sent to client and insurer" }]
        },
        {
          id: "wrk-heirloom",
          number: "CC-1044",
          customerId: "cus-victoria",
          stage: "New enquiry",
          title: "Heirloom sapphire remodel",
          metal: "Platinum",
          stones: "Natural Cushion Sapphire customer supplied",
          stoneShape: "Cushion",
          stoneType: "Sapphire",
          stoneProvided: "Yes",
          stoneOrigin: "Natural",
          size: "N 1/2",
          dueDate: addDaysIso(28),
          materials: 0,
          labour: 0,
          supplier: 0,
          price: 0,
          deposit: 0,
          balance: 0,
          owner: "April",
          notes: "Needs inspection and design consult. Customer wants sentimental stones preserved.",
          satisfaction: "Not recorded",
          createdAt: addDaysIso(-4),
          stageUpdatedAt: addDaysIso(-4),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: false, deposit: false, cad: false, stone: true, qa: false },
          timeline: [{ date: addDaysIso(-4), text: "New showroom enquiry" }]
        },
        {
          id: "wrk-signet",
          number: "CC-1045",
          customerId: "cus-oscar",
          stage: "Quality check",
          title: "Onyx signet ring",
          metal: "Sterling silver",
          stones: "Natural Radiant Other Cameron supplied",
          stoneShape: "Radiant",
          stoneType: "Other",
          stoneProvided: "No",
          stoneOrigin: "Natural",
          size: "T",
          dueDate: addDaysIso(2),
          materials: 210,
          labour: 780,
          supplier: 180,
          price: 1650,
          deposit: 800,
          balance: 850,
          owner: "Workshop",
          notes: "Final engraving checked. QA before client SMS.",
          satisfaction: "Happy",
          createdAt: addDaysIso(-19),
          stageUpdatedAt: addDaysIso(-1),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: true, cad: true, stone: true, qa: false },
          timeline: [{ date: addDaysIso(-1), text: "Moved to quality check" }]
        },
        {
          id: "wrk-luna-samples",
          number: "CC-1046",
          customerId: "cus-luna",
          stage: "Completed",
          title: "Bridal sample resize batch",
          metal: "18ct rose gold",
          stones: "Lab grown Round Moissanite customer supplied",
          stoneShape: "Round",
          stoneType: "Moissanite",
          stoneProvided: "Yes",
          stoneOrigin: "Lab grown",
          size: "Mixed",
          dueDate: addDaysIso(-5),
          materials: 120,
          labour: 1280,
          supplier: 0,
          price: 2400,
          deposit: 2400,
          balance: 0,
          owner: "Workshop",
          notes: "Batch completed and returned with itemised notes.",
          satisfaction: "Delighted",
          createdAt: addDaysIso(-28),
          stageUpdatedAt: addDaysIso(-5),
          completedAt: addDaysIso(-5),
          nextCleanDate: addDaysIso(175),
          approvals: { quote: true, deposit: true, cad: true, stone: true, qa: true },
          timeline: [{ date: addDaysIso(-5), text: "Completed and dispatched to retail partner" }]
        },
        {
          id: "wrk-push-present",
          number: "CC-1047",
          customerId: "cus-claire",
          stage: "Ready for collection",
          title: "Vintage ruby pendant",
          metal: "18ct yellow gold",
          stones: "Natural Pear Ruby Cameron supplied",
          stoneShape: "Pear",
          stoneType: "Ruby",
          stoneProvided: "No",
          stoneOrigin: "Natural",
          size: "",
          dueDate: addDaysIso(1),
          materials: 540,
          labour: 920,
          supplier: 760,
          price: 3600,
          deposit: 1800,
          balance: 1800,
          owner: "April",
          notes: "Final chain attached. Needs gift packaging before collection.",
          satisfaction: "Happy",
          createdAt: addDaysIso(-15),
          stageUpdatedAt: todayIso(),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: true, cad: true, stone: true, qa: true },
          timeline: [{ date: todayIso(), text: "Ready for collection" }]
        },
        {
          id: "wrk-wed-resize",
          number: "CC-1048",
          customerId: "cus-daniel",
          stage: "In production",
          title: "Wedding band resize and refinish",
          metal: "Platinum",
          stones: "Not selected",
          stoneShape: "Not selected",
          stoneType: "Not selected",
          stoneProvided: "No",
          stoneOrigin: "Not applicable",
          size: "R",
          dueDate: addDaysIso(5),
          materials: 90,
          labour: 420,
          supplier: 0,
          price: 780,
          deposit: 300,
          balance: 480,
          owner: "Workshop",
          notes: "Resize up half size, soften edges, refinish satin exterior.",
          satisfaction: "Neutral",
          createdAt: addDaysIso(-10),
          stageUpdatedAt: addDaysIso(-2),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: true, cad: true, stone: false, qa: false },
          timeline: [{ date: addDaysIso(-2), text: "Resize started" }]
        },
        {
          id: "wrk-bracelet-claim",
          number: "CC-1049",
          customerId: "cus-priya",
          stage: "Quote sent",
          title: "Bracelet clasp insurance repair",
          metal: "18ct white gold",
          stones: "Natural Round Diamond customer supplied",
          stoneShape: "Round",
          stoneType: "Diamond",
          stoneProvided: "Yes",
          stoneOrigin: "Natural",
          size: "",
          dueDate: addDaysIso(16),
          materials: 280,
          labour: 680,
          supplier: 0,
          price: 1450,
          deposit: 0,
          balance: 1450,
          owner: "Tracey",
          notes: "Quote sent to insurer with photo notes. Awaiting approval.",
          satisfaction: "Not recorded",
          createdAt: addDaysIso(-9),
          stageUpdatedAt: addDaysIso(-1),
          completedAt: "",
          nextCleanDate: "",
          approvals: { quote: true, deposit: false, cad: false, stone: true, qa: false },
          timeline: [{ date: addDaysIso(-1), text: "Quote sent to insurer" }]
        },
        {
          id: "wrk-atelier-custom",
          number: "CC-1050",
          customerId: "cus-atelier",
          stage: "Completed",
          title: "Trade custom signet sample",
          metal: "18ct yellow gold",
          stones: "Natural Emerald Other Cameron supplied",
          stoneShape: "Emerald",
          stoneType: "Other",
          stoneProvided: "No",
          stoneOrigin: "Natural",
          size: "Mixed",
          dueDate: addDaysIso(-2),
          materials: 640,
          labour: 1120,
          supplier: 260,
          price: 2950,
          deposit: 2950,
          balance: 0,
          owner: "Workshop",
          notes: "Sample completed and courier booked. Include invoice in weekly statement.",
          satisfaction: "Delighted",
          createdAt: addDaysIso(-30),
          stageUpdatedAt: addDaysIso(-2),
          completedAt: addDaysIso(-2),
          nextCleanDate: addDaysIso(178),
          approvals: { quote: true, deposit: true, cad: true, stone: true, qa: true },
          timeline: [{ date: addDaysIso(-2), text: "Completed and packed for courier" }]
        }
      ],
      communications: [
        {
          id: "com-1",
          customerId: "cus-marina",
          workId: "wrk-sapphire",
          channel: "SMS",
          subject: "Ready for collection",
          body: "Your sapphire ring is ready for collection.",
          status: "Delivered",
          restricted: false,
          createdAt: todayIso()
        },
        {
          id: "com-2",
          customerId: "cus-roslyn",
          workId: "wrk-claim",
          channel: "Email",
          subject: "CAD approval required",
          body: "CAD render sent for approval before production continues.",
          status: "Delivered",
          restricted: false,
          createdAt: addDaysIso(-2)
        }
      ],
      tasks: [
        { id: "tsk-1", title: "Call Marina about final payment", owner: "April", dueDate: todayIso(), status: "Open", customerId: "cus-marina", workId: "wrk-sapphire" },
        { id: "tsk-2", title: "Chase CAD approval for Roslyn", owner: "Tracey", dueDate: todayIso(), status: "Open", customerId: "cus-roslyn", workId: "wrk-claim" },
        { id: "tsk-3", title: "Confirm trade batch dispatch address", owner: "Admin", dueDate: addDaysIso(1), status: "Open", customerId: "cus-classique", workId: "wrk-trade" }
      ],
      automationRules: defaultAutomationRules(),
      automationLog: [],
      audit: []
    };
  }

  function defaultAutomationRules() {
    return [
      {
        id: "aut-complete-30",
        name: "30-day completion care email",
        phase: "Completed",
        delayDays: 30,
        channel: "Email",
        subject: "How is your {{work_title}} settling in?",
        body: "Hi {{customer_first_name}},\\n\\nIt has been a month since {{work_title}} was completed. We hope you are loving it. If you would like us to check, clean, or adjust anything, please contact Cameron & Co.",
        createdAt: addDaysIso(-10)
      },
      {
        id: "aut-ready-collection",
        name: "Ready for collection email",
        phase: "Ready for collection",
        delayDays: 0,
        channel: "Email",
        subject: "{{work_title}} is ready for collection",
        body: "Hi {{customer_first_name}},\\n\\nYour {{work_title}} is ready for collection from Cameron & Co. Please contact us to arrange a suitable time.",
        createdAt: addDaysIso(-10)
      }
    ];
  }
})();
