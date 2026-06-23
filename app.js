(function () {
  "use strict";

  var STORAGE_KEY = "cameronCoCrmMvpState";
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

  var nextStage = {
    "New enquiry": "Quote sent",
    "Quote sent": "Awaiting deposit",
    "Awaiting deposit": "CAD approval",
    "CAD approval": "In production",
    "In production": "Quality check",
    "Quality check": "Ready for collection",
    "Ready for collection": "Completed"
  };

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
  var workSort = {
    key: "dueDate",
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
    metricTasks: byId("metricTasks"),
    metricAutomation: byId("metricAutomation"),
    pipelineSummary: byId("pipelineSummary"),
    pipelineRail: byId("pipelineRail"),
    todaySummary: byId("todaySummary"),
    todayTasks: byId("todayTasks"),
    customerForm: byId("customerForm"),
    customerSearch: byId("customerSearch"),
    customerTypeFilter: byId("customerTypeFilter"),
    customerConsentFilter: byId("customerConsentFilter"),
    customerTableBody: byId("customerTableBody"),
    addCustomerButton: byId("addCustomerButton"),
    bulkUploadCustomerButton: byId("bulkUploadCustomerButton"),
    customerModal: byId("customerModal"),
    customerModalClose: byId("customerModalClose"),
    bulkCustomerModal: byId("bulkCustomerModal"),
    bulkCustomerModalClose: byId("bulkCustomerModalClose"),
    bulkCustomerForm: byId("bulkCustomerForm"),
    bulkCustomerCsv: byId("bulkCustomerCsv"),
    workForm: byId("workForm"),
    workCustomer: byId("workCustomer"),
    workStage: byId("workStage"),
    workTitle: byId("workTitle"),
    workMetal: byId("workMetal"),
    workStoneShape: byId("workStoneShape"),
    workStoneType: byId("workStoneType"),
    workStoneProvided: byId("workStoneProvided"),
    workStoneOrigin: byId("workStoneOrigin"),
    workSize: byId("workSize"),
    workDue: byId("workDue"),
    workMaterials: byId("workMaterials"),
    workLabour: byId("workLabour"),
    workSupplier: byId("workSupplier"),
    workPrice: byId("workPrice"),
    workDeposit: byId("workDeposit"),
    workOwner: byId("workOwner"),
    workImages: byId("workImages"),
    workNotes: byId("workNotes"),
    workFilter: byId("workFilter"),
    workSearch: byId("workSearch"),
    workOwnerFilter: byId("workOwnerFilter"),
    workTableBody: byId("workTableBody"),
    newWorkButton: byId("newWorkButton"),
    workModal: byId("workModal"),
    workModalClose: byId("workModalClose"),
    boardSearch: byId("boardSearch"),
    boardOwner: byId("boardOwner"),
    jobBoardColumns: byId("jobBoardColumns"),
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
      state = createDemoState();
      save("Demo reset");
      render();
    });

    els.customerSearch.addEventListener("input", renderCustomers);
    els.customerTypeFilter.addEventListener("change", renderCustomers);
    els.customerConsentFilter.addEventListener("change", renderCustomers);
    els.addCustomerButton.addEventListener("click", openCustomerModal);
    els.bulkUploadCustomerButton.addEventListener("click", openBulkCustomerModal);
    els.newWorkButton.addEventListener("click", function () {
      openWorkModal();
    });
    els.customerModalClose.addEventListener("click", closeCustomerModal);
    els.bulkCustomerModalClose.addEventListener("click", closeBulkCustomerModal);
    els.workModalClose.addEventListener("click", closeWorkModal);
    els.customerModal.addEventListener("click", function (event) {
      if (event.target === els.customerModal) closeCustomerModal();
    });
    els.bulkCustomerModal.addEventListener("click", function (event) {
      if (event.target === els.bulkCustomerModal) closeBulkCustomerModal();
    });
    els.workModal.addEventListener("click", function (event) {
      if (event.target === els.workModal) closeWorkModal();
    });
    document.querySelectorAll("[data-customer-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateCustomerSort(button.dataset.customerSort);
      });
    });
    els.workFilter.addEventListener("change", renderWork);
    els.workSearch.addEventListener("input", renderWork);
    els.workOwnerFilter.addEventListener("change", renderWork);
    document.querySelectorAll("[data-work-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateWorkSort(button.dataset.workSort);
      });
    });
    els.boardSearch.addEventListener("input", renderJobBoard);
    els.boardOwner.addEventListener("change", renderJobBoard);
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

    els.customerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      state.customers.unshift({
        id: makeId("cus"),
        createdAt: todayIso(),
        name: value("customerName"),
        type: value("customerType"),
        phone: value("customerPhone"),
        email: value("customerEmail"),
        address: value("customerAddress"),
        preferred: value("customerPreferred"),
        source: value("customerSource"),
        ringSize: value("customerRingSize"),
        partner: value("customerPartner"),
        notes: value("customerNotes"),
        consent: {
          email: byId("customerEmailConsent").checked,
          sms: byId("customerSmsConsent").checked,
          marketing: byId("customerMarketingConsent").checked,
          updatedAt: todayIso(),
          source: "CRM capture"
        }
      });
      els.customerForm.reset();
      byId("customerEmailConsent").checked = true;
      byId("customerSmsConsent").checked = true;
      byId("customerMarketingConsent").checked = true;
      closeCustomerModal();
      save("Customer added");
      render();
    });

    els.bulkCustomerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var imported = importCustomersFromCsv(els.bulkCustomerCsv.value);
      if (!imported) {
        save("No customers imported");
        return;
      }
      els.bulkCustomerForm.reset();
      closeBulkCustomerModal();
      save(imported + " customers imported");
      render();
    });

    els.workForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var price = numberValue("workPrice");
      var deposit = numberValue("workDeposit");
      var stoneDetails = selectedStoneDetails();
      var images = await readImageFiles(els.workImages.files);
      var work = {
        id: makeId("wrk"),
        number: "CC-" + String(state.nextWorkNumber++).padStart(4, "0"),
        customerId: els.workCustomer.value,
        stage: value("workStage"),
        title: value("workTitle"),
        metal: value("workMetal"),
        stones: stoneSummary(stoneDetails),
        stoneShape: stoneDetails.shape,
        stoneType: stoneDetails.type,
        stoneProvided: stoneDetails.provided,
        stoneOrigin: stoneDetails.origin,
        size: value("workSize"),
        dueDate: value("workDue"),
        materials: numberValue("workMaterials"),
        labour: numberValue("workLabour"),
        supplier: numberValue("workSupplier"),
        price: price,
        deposit: deposit,
        balance: Math.max(price - deposit, 0),
        owner: value("workOwner"),
        images: images,
        notes: value("workNotes"),
        satisfaction: "Not recorded",
        createdAt: todayIso(),
        stageUpdatedAt: todayIso(),
        completedAt: "",
        nextCleanDate: "",
        approvals: {
          quote: stageIndex(value("workStage")) >= stageIndex("Awaiting deposit"),
          deposit: deposit > 0,
          cad: stageIndex(value("workStage")) >= stageIndex("In production"),
          stone: stoneDetails.type !== "Not selected" || stoneDetails.shape !== "Not selected",
          qa: false
        },
        timeline: [{ date: todayIso(), text: "Work created at " + value("workStage") }]
      };
      state.work.unshift(work);
      runDueAutomations(work.id);
      els.workForm.reset();
      closeWorkModal();
      save("Work added");
      render();
    });

    els.workTableBody.addEventListener("click", function (event) {
      var customerButton = event.target.closest("[data-customer-id]");
      if (customerButton) {
        openCustomerDetail(customerButton.dataset.customerId);
        return;
      }
      var row = event.target.closest("[data-work-row]");
      if (row) openWorkDetail(row.dataset.workId);
    });

    els.customerTableBody.addEventListener("click", function (event) {
      var contact = event.target.closest("[data-customer-contact]");
      if (contact) {
        openCorrespondenceForCustomer(contact.dataset.customerContact);
        return;
      }
      var row = event.target.closest("[data-customer-row]");
      if (row) openCustomerDetail(row.dataset.customerId);
    });

    els.jobBoardColumns.addEventListener("dragstart", function (event) {
      var card = event.target.closest("[data-work-card]");
      if (!card) return;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.workId);
    });

    els.jobBoardColumns.addEventListener("dragend", function (event) {
      var card = event.target.closest("[data-work-card]");
      if (card) card.classList.remove("dragging");
      document.querySelectorAll(".kanban-column").forEach(function (column) {
        column.classList.remove("drag-over");
      });
    });

    els.jobBoardColumns.addEventListener("dragover", function (event) {
      var column = event.target.closest("[data-stage]");
      if (!column) return;
      event.preventDefault();
      column.classList.add("drag-over");
    });

    els.jobBoardColumns.addEventListener("dragleave", function (event) {
      var column = event.target.closest("[data-stage]");
      if (column && !column.contains(event.relatedTarget)) column.classList.remove("drag-over");
    });

    els.jobBoardColumns.addEventListener("drop", function (event) {
      var column = event.target.closest("[data-stage]");
      if (!column) return;
      event.preventDefault();
      column.classList.remove("drag-over");
      var work = findWork(event.dataTransfer.getData("text/plain"));
      if (!work || work.stage === column.dataset.stage) return;
      setWorkStage(work, column.dataset.stage, "Dragged on job board");
      save("Job moved");
      render();
    });

    els.jobBoardColumns.addEventListener("click", function (event) {
      var customerButton = event.target.closest("[data-customer-id]");
      if (customerButton) {
        openCustomerDetail(customerButton.dataset.customerId);
        return;
      }
      var card = event.target.closest("[data-work-card]");
      if (card) openWorkDetail(card.dataset.workId);
    });

    els.detailModalClose.addEventListener("click", closeDetailModal);
    els.detailModal.addEventListener("click", function (event) {
      if (event.target === els.detailModal) closeDetailModal();
      var action = event.target.closest("[data-modal-action]");
      if (!action) return;
      if (action.dataset.modalAction === "save-work") saveWorkDetail(action.dataset.workId);
      if (action.dataset.modalAction === "upload-job-images") uploadJobImages(action.dataset.workId);
      if (action.dataset.modalAction === "open-customer") openCustomerDetail(action.dataset.customerId);
      if (action.dataset.modalAction === "open-work") openWorkDetail(action.dataset.workId);
      if (action.dataset.modalAction === "create-work-customer") {
        closeDetailModal();
        openWorkModal(action.dataset.customerId);
      }
      if (action.dataset.modalAction === "send-customer-correspondence") {
        openCorrespondenceForCustomer(action.dataset.customerId);
      }
      if (action.dataset.modalAction === "save-customer-record") saveCustomerRecord(action.dataset.customerId);
    });

    els.detailModal.addEventListener("change", function (event) {
      var rating = event.target.closest("[data-rating-select]");
      if (rating) updateWorkSatisfaction(rating.dataset.workId, rating.value);
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
  }

  function render() {
    renderSelects();
    renderContactMode();
    renderRecipientMode();
    renderMetrics();
    renderDashboard();
    renderCustomers();
    renderWork();
    renderJobBoard();
    updateTemplateFields();
    renderCommunications();
    renderAutomation();
    renderReports();
  }

  function renderSelects() {
    var selectedWorkCustomer = els.workCustomer.value;
    var selectedCommCustomer = els.commCustomer.value || (state.customers[0] && state.customers[0].id);
    els.workCustomer.innerHTML = "";
    state.customers.forEach(function (customer) {
      els.workCustomer.appendChild(new Option(customer.name, customer.id));
    });
    if (selectedWorkCustomer) els.workCustomer.value = selectedWorkCustomer;
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
      return '<button class="search-result" data-pick-customer="' + customer.id + '" type="button"' + (selected ? " disabled" : "") + '><strong>' + escapeHtml(customer.name) + '</strong><span>' + escapeHtml([customer.phone, customer.email].filter(Boolean).join(" - ") || customer.type) + '</span></button>';
    }).join("") : empty("No customers found.");
  }

  function selectCommCustomer(customerId, skipRender) {
    var customer = findCustomer(customerId);
    if (!customer) return;
    els.commCustomer.value = customer.id;
    els.commCustomerSearch.value = customer.name;
    els.commCustomerSelected.textContent = [customer.phone, customer.email].filter(Boolean).join(" - ");
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

  function renderMetrics() {
    var activeQuotes = state.work.filter(function (work) {
      return work.stage === "New enquiry" || work.stage === "Quote sent";
    });
    var workshop = state.work.filter(function (work) {
      return stageIndex(work.stage) >= stageIndex("CAD approval") && work.stage !== "Completed";
    });
    var overdue = state.work.filter(isOverdue);
    var balances = state.work.reduce(function (sum, work) {
      return sum + work.balance;
    }, 0);
    var dueTasks = state.tasks.filter(function (task) {
      return task.status === "Open" && task.dueDate <= todayIso();
    });
    var schedules = buildSchedules();
    var dueAutomations = schedules.filter(function (item) {
      return item.dueDate <= todayIso();
    });

    els.metricQuoteValue.textContent = money(activeQuotes.reduce(function (sum, work) {
      return sum + work.price;
    }, 0));
    els.metricQuoteCount.textContent = activeQuotes.length + " active quotes";
    els.metricWorkshop.textContent = workshop.length;
    els.metricOverdue.textContent = overdue.length + " overdue jobs";
    els.metricBalances.textContent = money(balances);
    els.metricTasks.textContent = dueTasks.length;
    els.metricAutomation.textContent = dueAutomations.length;
  }

  function renderDashboard() {
    var max = Math.max.apply(null, stages.map(function (stage) {
      return countStage(stage);
    }).concat([1]));

    els.pipelineSummary.textContent = state.work.length + " records";
    els.pipelineRail.innerHTML = stages.map(function (stage) {
      var count = countStage(stage);
      var width = Math.max((count / max) * 100, count ? 10 : 0);
      return '<div class="pipeline-stage stage-' + stageClass(stage) + '"><strong>' + escapeHtml(stage) + '</strong><div class="bar"><span style="width:' + width + '%"></span></div><span>' + count + '</span></div>';
    }).join("");

    var todayTasks = state.tasks.filter(function (task) {
      return task.status === "Open" && task.dueDate <= todayIso();
    }).slice(0, 8);
    els.todaySummary.textContent = todayTasks.length + " actions";
    els.todayTasks.innerHTML = todayTasks.length ? todayTasks.map(function (task) {
      var customer = findCustomer(task.customerId);
      var work = findWork(task.workId);
      return '<article class="timeline-item"><header><div><h4>' + escapeHtml(task.title) + '</h4><p class="meta">' + escapeHtml(task.owner) + ' - due ' + formatDate(task.dueDate) + '</p></div><span class="status-pill">' + escapeHtml(task.status) + '</span></header><p class="fineprint">' + escapeHtml(customer ? customer.name : "No customer") + (work ? " - " + escapeHtml(work.number) : "") + '</p></article>';
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

  function renderCustomerRow(record) {
    var customer = record.customer;
    return '<tr data-customer-row data-customer-id="' + customer.id + '" tabindex="0"><td><strong>' + escapeHtml(customer.name) + '</strong><span>' + escapeHtml(customer.address || customer.source || "No address") + '</span></td><td>' + escapeHtml(customer.type || "Unknown") + '</td><td>' + escapeHtml(customer.phone || "-") + '</td><td>' + escapeHtml(customer.email || "-") + '</td><td>' + (record.lastJobDue ? formatDate(record.lastJobDue) : "No jobs") + '</td><td><span class="stage-pill">' + record.jobCount + '</span></td><td>' + escapeHtml(record.consent.join(", ") || "Missing") + '</td><td><button class="icon-button" data-customer-contact="' + customer.id + '" type="button" title="Send correspondence" aria-label="Send correspondence to ' + escapeHtml(customer.name) + '">✉️</button></td></tr>';
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

  function renderWork() {
    var filter = els.workFilter.value;
    var owner = els.workOwnerFilter.value;
    var search = els.workSearch.value.trim().toLowerCase();
    var rows = state.work.map(workTableRecord).filter(function (record) {
      var work = record.work;
      var haystack = [
        work.number,
        work.title,
        work.stage,
        work.metal,
        stoneSummary(work),
        work.owner,
        record.customerName
      ].join(" ").toLowerCase();
      return (filter === "All" || work.stage === filter) &&
        (owner === "All" || work.owner === owner) &&
        haystack.indexOf(search) !== -1;
    }).sort(sortWorkRecords);

    els.workTableBody.innerHTML = rows.length ? rows.map(renderWorkRow).join("") : '<tr><td colspan="7">' + empty("No jobs match these filters.") + '</td></tr>';
    updateWorkSortIndicators();
  }

  function workTableRecord(work) {
    var customer = findCustomer(work.customerId);
    return {
      work: work,
      customer: customer,
      customerName: customer ? customer.name : "Unknown customer",
      margin: work.price - work.materials - work.labour - work.supplier
    };
  }

  function renderWorkRow(record) {
    var work = record.work;
    return '<tr data-work-row data-work-id="' + work.id + '" tabindex="0"><td><strong>' + escapeHtml(work.number) + '</strong><span>' + escapeHtml(work.title) + '</span><span>' + escapeHtml(stoneSummary(work) || "Stone details TBC") + '</span></td><td><button class="clickable-name" data-customer-id="' + (record.customer ? record.customer.id : "") + '" type="button">' + escapeHtml(record.customerName) + '</button></td><td><span class="stage-pill">' + escapeHtml(work.stage) + '</span></td><td>' + formatDate(work.dueDate) + '</td><td>' + escapeHtml(work.owner) + '</td><td><strong>' + money(work.balance) + '</strong><span>Margin ' + money(record.margin) + '</span></td><td>' + satisfactionBadge(work.satisfaction) + '</td></tr>';
  }

  function sortWorkRecords(a, b) {
    var key = workSort.key;
    var av = workSortValue(a, key);
    var bv = workSortValue(b, key);
    if (typeof av === "number" || typeof bv === "number") {
      return (Number(av || 0) - Number(bv || 0)) * (workSort.direction === "asc" ? 1 : -1);
    }
    return String(av || "").localeCompare(String(bv || "")) * (workSort.direction === "asc" ? 1 : -1);
  }

  function workSortValue(record, key) {
    if (key === "customer") return record.customerName;
    if (key === "balance") return record.work.balance;
    if (key === "satisfaction") return record.work.satisfaction || "";
    return record.work[key] || "";
  }

  function updateWorkSort(key) {
    if (workSort.key === key) {
      workSort.direction = workSort.direction === "asc" ? "desc" : "asc";
    } else {
      workSort.key = key;
      workSort.direction = key === "dueDate" || key === "balance" ? "desc" : "asc";
    }
    renderWork();
  }

  function updateWorkSortIndicators() {
    document.querySelectorAll("[data-work-sort]").forEach(function (button) {
      var active = button.dataset.workSort === workSort.key;
      button.dataset.sortDirection = active ? workSort.direction : "";
    });
  }

  function renderJobBoard() {
    var search = els.boardSearch.value.trim().toLowerCase();
    var owner = els.boardOwner.value;
    els.jobBoardColumns.innerHTML = stages.map(function (stage) {
      var cards = state.work.filter(function (work) {
        var customer = findCustomer(work.customerId);
        var haystack = [work.number, work.title, stoneSummary(work), work.owner, work.stage, customer && customer.name].join(" ").toLowerCase();
        return shouldShowOnBoard(work) && work.stage === stage && (owner === "All" || work.owner === owner) && haystack.indexOf(search) !== -1;
      });
      return '<section class="kanban-column" data-stage="' + escapeHtml(stage) + '"><div class="kanban-heading"><h3>' + escapeHtml(stage) + '</h3><span class="stage-pill">' + cards.length + '</span></div><div class="kanban-cards">' + (cards.length ? cards.map(renderBoardCard).join("") : empty("Drop jobs here.")) + '</div></section>';
    }).join("");
  }

  function renderBoardCard(work) {
    var customer = findCustomer(work.customerId) || { id: "", name: "Unknown customer" };
    var overdue = isOverdue(work) ? '<span class="status-pill">Overdue</span>' : "";
    return '<article class="job-card stage-' + stageClass(work.stage) + '" draggable="true" data-work-card data-work-id="' + work.id + '" tabindex="0"><div class="job-card-header"><div><h4>' + escapeHtml(work.number) + '</h4><p class="meta">' + escapeHtml(work.title) + '</p></div>' + satisfactionBadge(work.satisfaction) + '</div><button class="clickable-name" data-customer-id="' + customer.id + '" type="button">' + escapeHtml(customer.name) + '</button><div class="job-card-meta"><span>Due ' + formatDate(work.dueDate) + '</span><span>' + escapeHtml(work.owner) + '</span><span>' + escapeHtml(work.metal) + '</span><span>' + money(work.balance) + ' owing</span></div><p class="fineprint">' + escapeHtml(stoneSummary(work) || "Stone details TBC") + '</p>' + overdue + '</article>';
  }

  function openWorkDetail(workId) {
    var work = findWork(workId);
    if (!work) return;
    var customer = findCustomer(work.customerId) || { id: "", name: "Unknown customer" };
    var communications = state.communications.filter(function (item) { return item.workId === work.id; });
    var tasks = state.tasks.filter(function (task) { return task.workId === work.id; });
    els.detailContent.innerHTML = '<div class="modal-title-row"><div><p class="eyebrow">Job detail</p><h2 id="detailModalTitle">' + escapeHtml(work.number) + '</h2><p class="hero-copy">' + escapeHtml(work.title) + '</p></div>' + satisfactionSelect(work) + '</div><div class="modal-section"><div class="detail-grid"><div class="detail"><span>Customer</span><strong><button class="clickable-name" data-modal-action="open-customer" data-customer-id="' + customer.id + '" type="button">' + escapeHtml(customer.name) + '</button></strong></div><div class="detail"><span>Stage</span><strong>' + escapeHtml(work.stage) + '</strong></div><div class="detail"><span>Due</span><strong>' + formatDate(work.dueDate) + '</strong></div><div class="detail"><span>Metal</span><strong>' + escapeHtml(work.metal) + '</strong></div><div class="detail"><span>Stone</span><strong>' + escapeHtml(stoneSummary(work) || "TBC") + '</strong></div><div class="detail"><span>Balance</span><strong>' + money(work.balance) + '</strong></div></div></div>' + renderWorkImageSection(work) + '<div class="modal-section"><h3>Manual update</h3><div class="edit-row"><label>Status<select id="modalStage">' + optionList(stages, work.stage) + '</select></label><label>Customer happiness<select id="modalSatisfaction">' + optionList(satisfactionOptions(work.satisfaction), work.satisfaction) + '</select></label><button class="button primary" data-modal-action="save-work" data-work-id="' + work.id + '" type="button">Save update</button></div></div><div class="modal-section"><h3>Workshop notes</h3><p>' + escapeHtml(work.notes || "No notes.") + '</p></div><div class="history-grid modal-section"><section><h3>Correspondence</h3><div class="customer-history-list">' + renderMiniCommunications(communications) + '</div></section><section><h3>Tasks</h3><div class="customer-history-list">' + renderMiniTasks(tasks) + '</div></section></div>';
    els.detailModal.hidden = false;
  }

  function openCustomerDetail(customerId) {
    var customer = findCustomer(customerId);
    if (!customer) return;
    var works = state.work.filter(function (work) { return work.customerId === customer.id; });
    var communications = state.communications.filter(function (item) { return item.customerId === customer.id; });
    els.detailContent.innerHTML = [
      '<div class="modal-title-row">',
      '<div><p class="eyebrow">Customer profile</p><h2 id="detailModalTitle">' + escapeHtml(customer.name) + '</h2><p class="hero-copy">' + escapeHtml(customer.type) + ' - ' + escapeHtml(customer.source) + '</p></div>',
      '<div class="modal-action-stack"><span class="stage-pill">' + works.length + ' jobs</span><button class="button primary" data-modal-action="create-work-customer" data-customer-id="' + customer.id + '" type="button">Create job</button><button class="button secondary" data-modal-action="send-customer-correspondence" data-customer-id="' + customer.id + '" type="button">Send correspondence</button></div>',
      '</div>',
      '<div class="modal-section"><h3>Customer record</h3><div class="form-grid customer-edit-grid">',
      '<label>Full name<input id="modalCustomerName" value="' + escapeHtml(customer.name || "") + '"></label>',
      '<label>Customer type<select id="modalCustomerType">' + optionList(["Private client", "Insurance client", "Retail partner", "Trade"], customer.type) + '</select></label>',
      '<label>Phone<input id="modalCustomerPhone" value="' + escapeHtml(customer.phone || "") + '"></label>',
      '<label>Email<input id="modalCustomerEmail" type="email" value="' + escapeHtml(customer.email || "") + '"></label>',
      '<label class="wide">Address<input id="modalCustomerAddress" value="' + escapeHtml(customer.address || "") + '"></label>',
      '<label>Preferred contact<select id="modalCustomerPreferred">' + optionList(["Phone", "Email", "SMS", "In-store"], customer.preferred) + '</select></label>',
      '<label>Lead source<select id="modalCustomerSource">' + optionList(["Referral", "Insurance", "Website", "Walk-in", "Retail partner", "Instagram"], customer.source) + '</select></label>',
      '<label>Ring size<input id="modalCustomerRingSize" value="' + escapeHtml(customer.ringSize || "") + '"></label>',
      '<label>Partner / occasion<input id="modalCustomerPartner" value="' + escapeHtml(customer.partner || "") + '"></label>',
      '<label class="wide">Free text notes<textarea id="modalCustomerNotes" rows="5">' + escapeHtml(customer.notes || "") + '</textarea></label>',
      '<div class="consent-row wide"><label><input id="modalCustomerEmailConsent" type="checkbox"' + checked(customer.consent.email) + '> Email consent</label><label><input id="modalCustomerSmsConsent" type="checkbox"' + checked(customer.consent.sms) + '> SMS consent</label><label><input id="modalCustomerMarketingConsent" type="checkbox"' + checked(customer.consent.marketing) + '> Marketing consent</label></div>',
      '<button class="button primary wide" data-modal-action="save-customer-record" data-customer-id="' + customer.id + '" type="button">Save customer</button>',
      '</div></div>',
      '<div class="history-grid modal-section"><section><h3>Previous jobs</h3><div class="customer-history-list">' + renderMiniWorks(works) + '</div></section><section><h3>Correspondence</h3><div class="customer-history-list">' + renderMiniCommunications(communications) + '</div></section></div>'
    ].join("");
    els.detailModal.hidden = false;
  }

  function closeDetailModal() {
    els.detailModal.hidden = true;
    els.detailContent.innerHTML = "";
  }

  function openCustomerModal() {
    els.customerModal.hidden = false;
  }

  function closeCustomerModal() {
    els.customerModal.hidden = true;
  }

  function openBulkCustomerModal() {
    els.bulkCustomerModal.hidden = false;
  }

  function closeBulkCustomerModal() {
    els.bulkCustomerModal.hidden = true;
  }

  function openWorkModal(customerId) {
    if (customerId) els.workCustomer.value = customerId;
    els.workModal.hidden = false;
  }

  function closeWorkModal() {
    els.workModal.hidden = true;
  }

  function importCustomersFromCsv(csv) {
    var rows = csv.split(/\r?\n/).map(function (row) {
      return row.trim();
    }).filter(Boolean);
    if (!rows.length) return 0;
    if (/^name\s*,/i.test(rows[0])) rows.shift();
    var imported = 0;
    rows.forEach(function (row) {
      var cells = parseCsvRow(row);
      if (!cells[0]) return;
      state.customers.unshift({
        id: makeId("cus"),
        createdAt: todayIso(),
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
      });
      imported += 1;
    });
    return imported;
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

  function saveWorkDetail(workId) {
    var work = findWork(workId);
    if (!work) return;
    setWorkStage(work, byId("modalStage").value, "Manual detail edit");
    updateWorkSatisfaction(workId, byId("modalSatisfaction").value, true);
    save("Job detail updated");
    render();
    openWorkDetail(work.id);
  }

  function renderWorkImageSection(work) {
    var images = work.images || [];
    return '<div class="modal-section"><h3>Job images</h3><div class="image-upload-row"><input id="modalWorkImages" type="file" accept="image/*" multiple><button class="button secondary" data-modal-action="upload-job-images" data-work-id="' + work.id + '" type="button">Upload images</button></div><div class="image-gallery">' + (images.length ? images.map(function (image) {
      return '<figure><img src="' + escapeHtml(image.dataUrl) + '" alt="' + escapeHtml(image.name || "Job image") + '"><figcaption>' + escapeHtml(image.name || "Job image") + '</figcaption></figure>';
    }).join("") : empty("No images uploaded for this job.")) + '</div></div>';
  }

  async function uploadJobImages(workId) {
    var work = findWork(workId);
    var input = byId("modalWorkImages");
    if (!work || !input || !input.files.length) return;
    work.images = (work.images || []).concat(await readImageFiles(input.files));
    save("Job images uploaded");
    render();
    openWorkDetail(work.id);
  }

  function readImageFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (file) {
      return /^image\//.test(file.type);
    }).slice(0, 8);
    return Promise.all(files.map(function (file) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          resolve({
            id: makeId("img"),
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: reader.result,
            createdAt: todayIso()
          });
        };
        reader.onerror = function () {
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    })).then(function (images) {
      return images.filter(Boolean);
    });
  }

  function saveCustomerRecord(customerId) {
    var customer = findCustomer(customerId);
    if (!customer) return;
    customer.name = value("modalCustomerName");
    customer.type = value("modalCustomerType");
    customer.phone = value("modalCustomerPhone");
    customer.email = value("modalCustomerEmail");
    customer.address = value("modalCustomerAddress");
    customer.preferred = value("modalCustomerPreferred");
    customer.source = value("modalCustomerSource");
    customer.ringSize = value("modalCustomerRingSize");
    customer.partner = value("modalCustomerPartner");
    customer.notes = value("modalCustomerNotes");
    customer.consent = {
      email: byId("modalCustomerEmailConsent").checked,
      sms: byId("modalCustomerSmsConsent").checked,
      marketing: byId("modalCustomerMarketingConsent").checked,
      updatedAt: todayIso(),
      source: "CRM detail edit"
    };
    save("Customer saved");
    render();
    openCustomerDetail(customer.id);
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

  function updateWorkSatisfaction(workId, value, skipRender) {
    var work = findWork(workId);
    if (!work) return;
    work.satisfaction = value;
    work.timeline.unshift({ date: todayIso(), text: "Customer happiness set to " + work.satisfaction });
    save("Rating updated");
    if (!skipRender) {
      render();
      openWorkDetail(work.id);
    }
  }

  function renderMiniWorks(works) {
    return works.length ? works.map(function (work) {
      return '<article class="timeline-item"><header><div><h4><button class="clickable-name" data-modal-action="open-work" data-work-id="' + work.id + '" type="button">' + escapeHtml(work.number + " - " + work.title) + '</button></h4><p class="meta">' + escapeHtml(work.stage) + ' - due ' + formatDate(work.dueDate) + '</p></div>' + satisfactionBadge(work.satisfaction) + '</header><p class="fineprint">' + escapeHtml(work.notes || "No notes.") + '</p></article>';
    }).join("") : empty("No previous jobs.");
  }

  function renderMiniCommunications(items) {
    return items.length ? items.map(function (item) {
      return '<article class="timeline-item ' + (item.restricted ? "restricted" : "") + '"><header><div><h4>' + escapeHtml(item.subject || item.channel) + '</h4><p class="meta">' + escapeHtml(item.channel) + ' - ' + formatDate(item.createdAt) + '</p></div><span class="status-pill">' + escapeHtml(item.status) + '</span></header><div class="fineprint message-body">' + renderMessageBody(item.body || "No message.") + '</div></article>';
    }).join("") : empty("No correspondence recorded.");
  }

  function renderMiniTasks(tasks) {
    return tasks.length ? tasks.map(function (task) {
      return '<article class="timeline-item"><header><div><h4>' + escapeHtml(task.title) + '</h4><p class="meta">' + escapeHtml(task.owner) + ' - due ' + formatDate(task.dueDate) + '</p></div><span class="status-pill">' + escapeHtml(task.status) + '</span></header></article>';
    }).join("") : empty("No tasks for this job.");
  }

  function satisfactionBadge(value) {
    var label = value || "Not recorded";
    var klass = label.toLowerCase().replace(/\s+/g, "-");
    return '<span class="satisfaction ' + escapeHtml(klass) + '" title="Customer happiness: ' + escapeHtml(label) + '"><span class="satisfaction-face" aria-hidden="true">' + escapeHtml(satisfactionFace(label)) + '</span>' + escapeHtml(label) + '</span>';
  }

  function satisfactionSelect(work) {
    var label = work.satisfaction || "Not recorded";
    var klass = label.toLowerCase().replace(/\s+/g, "-");
    return '<label class="rating-select-wrap satisfaction ' + escapeHtml(klass) + '" title="Customer happiness"><span class="satisfaction-face" aria-hidden="true">' + escapeHtml(satisfactionFace(label)) + '</span><span class="rating-select-label">Customer rating</span><select data-rating-select data-work-id="' + escapeHtml(work.id) + '" id="modalTopSatisfaction">' + optionList(satisfactionOptions(label), label) + '</select></label>';
  }

  function satisfactionFace(value) {
    if (value === "Delighted") return "🤩";
    if (value === "Happy") return "😊";
    if (value === "Neutral") return "😐";
    if (value === "Concern" || value === "Unsatisfied") return "☹️";
    return "⚪️";
  }

  function satisfactionOptions(current) {
    var options = ["Not recorded", "Delighted", "Happy", "Neutral", "Unsatisfied"];
    if (current === "Concern") options.push("Concern");
    return options;
  }

  function optionList(options, selected) {
    return options.map(function (option) {
      return '<option' + (option === selected ? " selected" : "") + '>' + escapeHtml(option) + '</option>';
    }).join("");
  }

  function approvalPill(work, key, label) {
    return '<button class="approval ' + (work.approvals[key] ? "done" : "") + '" data-action="approval" data-key="' + key + '" data-id="' + work.id + '" type="button">' + label + ': ' + (work.approvals[key] ? "Done" : "Open") + '</button>';
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
    var logo = document.querySelector(".brand-mark img");
    return logo ? logo.getAttribute("src") : "";
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

  function advanceWork(work) {
    var target = nextStage[work.stage];
    if (!target) return;
    setWorkStage(work, target, "Advanced");
  }

  function setWorkStage(work, target, source) {
    if (!target || work.stage === target) return;
    work.stage = target;
    work.stageUpdatedAt = todayIso();
    work.timeline.unshift({ date: todayIso(), text: source + " to " + target });
    if (target === "Awaiting deposit") work.approvals.quote = true;
    if (target === "CAD approval" && work.deposit > 0) work.approvals.deposit = true;
    if (target === "In production") work.approvals.cad = true;
    if (target === "Quality check") work.approvals.stone = true;
    if (target === "Ready for collection") work.approvals.qa = true;
    if (target === "Completed") {
      work.completedAt = todayIso();
      work.nextCleanDate = addDaysIso(180);
      work.balance = 0;
      state.tasks.unshift({
        id: makeId("tsk"),
        title: "Prepare 30-day care follow-up for " + work.number,
        owner: "Admin",
        dueDate: addDaysIso(30),
        status: "Open",
        customerId: work.customerId,
        workId: work.id
      });
    }
    runDueAutomations(work.id);
  }

  function markDepositPaid(work) {
    var targetDeposit = Math.max(work.deposit, Math.round(work.price * .4));
    work.deposit = Math.min(targetDeposit, work.price);
    work.balance = Math.max(work.price - work.deposit, 0);
    work.approvals.deposit = work.deposit > 0;
    work.timeline.unshift({ date: todayIso(), text: "Deposit marked paid" });
  }

  function toggleApproval(work, key) {
    work.approvals[key] = !work.approvals[key];
    work.timeline.unshift({ date: todayIso(), text: key.toUpperCase() + " approval toggled" });
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

  function selectedStoneDetails() {
    return {
      shape: value("workStoneShape"),
      type: value("workStoneType"),
      provided: value("workStoneProvided"),
      origin: value("workStoneOrigin")
    };
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

  function shouldShowOnBoard(work) {
    if (work.stage !== "Completed") return true;
    return isCurrentMonth(work.completedAt || work.dueDate);
  }

  function isCurrentMonth(iso) {
    if (!iso) return false;
    var date = new Date(iso + "T00:00:00");
    var today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
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
    return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short" }).format(new Date(iso + "T00:00:00"));
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
    els.saveState.textContent = message || "Saved locally";
    window.clearTimeout(save._timer);
    save._timer = window.setTimeout(function () {
      els.saveState.textContent = "Saved locally";
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
