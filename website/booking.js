(function () {
  var menuToggle = document.querySelector("[data-brand-menu-toggle]");
  var brandLinks = document.querySelector(".brand-nav .nav-links");
  var API_BASE = window.CAMERON_CO_BOOKING_API || (window.location.protocol.indexOf("http") === 0 ? window.location.origin : "http://localhost:5000");
  var params = new URLSearchParams(window.location.search);
  var form = document.getElementById("booking-form");
  var office = document.getElementById("booking-office");
  var slotInput = document.getElementById("selected-slot");
  var slotGrid = document.getElementById("slot-grid");
  var status = document.getElementById("booking-status");
  var refreshButton = document.getElementById("refresh-slots");
  var managePanel = document.getElementById("manage-booking");
  var manageSummary = document.getElementById("manage-summary");
  var activeToken = params.get("booking");

  if (menuToggle && brandLinks) {
    menuToggle.addEventListener("click", function () {
      var open = menuToggle.getAttribute("aria-expanded") !== "true";
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.classList.toggle("open", open);
      brandLinks.classList.toggle("open", open);
    });

    brandLinks.addEventListener("click", function (event) {
      if (!event.target.closest("a")) return;
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.classList.remove("open");
      brandLinks.classList.remove("open");
    });
  }

  // Pre-populate fields based on URL parameters
  if (params.get("office")) office.value = params.get("office");
  var serviceSelect = form ? form.querySelector("[name='service']") : null;
  if (serviceSelect) {
    if (params.get("service")) {
      serviceSelect.value = params.get("service");
    } else if (params.get("diamondId") || params.get("diamond")) {
      // Pre-select Engagement Ring Enquiry if coming from diamond search
      serviceSelect.value = "Engagement Ring Enquiry";
    }
  }

  // Populate diamond details in Notes if coming from diamond search
  var notesField = form ? form.querySelector("[name='notes']") : null;
  if (notesField) {
    var diamondId = params.get("diamondId") || params.get("diamond");
    var carat = params.get("carat");
    var shape = params.get("shape");
    var price = params.get("price");
    if (diamondId) {
      var detailsText = "I am interested in viewing this diamond:\n";
      if (carat && shape) detailsText += "- " + carat + " ct " + shape.charAt(0).toUpperCase() + shape.slice(1).toLowerCase() + "\n";
      if (price) detailsText += "- Retail Price: $" + parseFloat(price).toLocaleString() + " AUD\n";
      detailsText += "- Sourcing ID: " + diamondId;
      notesField.value = detailsText;
    }
  }

  function fmt(value) {
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Australia/Sydney"
    }).format(new Date(value));
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function loadSlots() {
    setStatus("Loading available times...");
    slotGrid.innerHTML = "";
    slotInput.value = "";
    fetch(API_BASE + "/api/booking/availability?office=" + encodeURIComponent(office.value))
      .then(function (response) {
        if (!response.ok) throw new Error("Availability failed");
        return response.json();
      })
      .then(function (json) {
        renderSlots(json.slots || []);
        setStatus("Select an available time.");
      })
      .catch(function () {
        renderSlots(sampleSlots());
        setStatus("Showing sample local times because the booking API is not reachable.");
      });
  }

  function sampleSlots() {
    var slots = [];
    var day = new Date();
    day.setDate(day.getDate() + 1);
    day.setHours(9, 0, 0, 0);
    while (slots.length < 12) {
      if (day.getDay() !== 0 && day.getDay() !== 6) {
        slots.push({ start: day.toISOString(), end: new Date(day.getTime() + 45 * 60000).toISOString() });
      }
      day = new Date(day.getTime() + 90 * 60000);
    }
    return slots;
  }

  function renderSlots(slots) {
    slotGrid.innerHTML = "";
    slots.forEach(function (slot) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "slot-button";
      button.textContent = fmt(slot.start);
      button.addEventListener("click", function () {
        slotGrid.querySelectorAll(".slot-button").forEach(function (item) {
          item.classList.remove("selected");
        });
        button.classList.add("selected");
        slotInput.value = slot.start;
      });
      slotGrid.appendChild(button);
    });
  }

  function formPayload() {
    var data = new FormData(form);
    return {
      office: data.get("office"),
      service: data.get("service"),
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone"),
      notes: data.get("notes"),
      slot: data.get("slot"),
      diamondId: params.get("diamondId") || params.get("diamond") || ""
    };
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!slotInput.value) {
      setStatus("Please select a time.");
      return;
    }
    setStatus("Creating your appointment...");
    fetch(API_BASE + "/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload())
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Booking failed");
        return response.json();
      })
      .then(function (json) {
        activeToken = json.manageToken;
        setStatus("Appointment confirmed. Confirmation and reminders are queued.");
        showManage(json.booking);
      })
      .catch(function () {
        setStatus("The booking API is not reachable. Please try again or contact the office directly.");
      });
  });

  function showManage(booking) {
    if (!booking) return;
    managePanel.hidden = false;
    manageSummary.textContent = booking.service + " at " + fmt(booking.start) + " for " + booking.office + ".";
  }

  function loadManagedBooking() {
    if (!activeToken) return;
    fetch(API_BASE + "/api/booking/" + encodeURIComponent(activeToken))
      .then(function (response) {
        if (!response.ok) throw new Error("Not found");
        return response.json();
      })
      .then(function (json) {
        showManage(json.booking);
        setStatus("Select a new time if you need to reschedule.");
      })
      .catch(function () {
        setStatus("We could not load that appointment. Please contact the office.");
      });
  }

  document.getElementById("manage-cancel").addEventListener("click", function () {
    if (!activeToken) return;
    fetch(API_BASE + "/api/booking/" + encodeURIComponent(activeToken) + "/cancel", { method: "POST" })
      .then(function (response) {
        if (!response.ok) throw new Error("Cancel failed");
        return response.json();
      })
      .then(function () {
        managePanel.hidden = true;
        setStatus("Appointment cancelled. A cancellation email has been queued.");
      })
      .catch(function () {
        setStatus("Unable to cancel online. Please contact the office.");
      });
  });

  document.getElementById("manage-reschedule").addEventListener("click", function () {
    if (!activeToken || !slotInput.value) {
      setStatus("Select a new time first.");
      return;
    }
    fetch(API_BASE + "/api/booking/" + encodeURIComponent(activeToken) + "/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: slotInput.value })
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Reschedule failed");
        return response.json();
      })
      .then(function (json) {
        showManage(json.booking);
        setStatus("Appointment rescheduled. Updated confirmation and reminders are queued.");
      })
      .catch(function () {
        setStatus("Unable to reschedule online. Please contact the office.");
      });
  });

  office.addEventListener("change", loadSlots);
  refreshButton.addEventListener("click", loadSlots);
  loadSlots();
  loadManagedBooking();
})();
