document.addEventListener('DOMContentLoaded', function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.menu-icon');
  if (toggle && header) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('mobile-open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
});

// Keep reveal sections visible if no IntersectionObserver animation is configured.
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.reveal-on-scroll').forEach(function (el) {
    el.classList.add('is-visible');
  });
});

// Tap-to-open nav dropdowns (About / Education) on touch devices, where
// hover never fires. First tap reveals the submenu instead of navigating;
// a second tap on the same link follows through to its href.
document.addEventListener('DOMContentLoaded', function () {
  var parents = document.querySelectorAll('.primary-nav > li > .nav-parent');

  function closeAllDropdowns(except) {
    document.querySelectorAll('.primary-nav > li.dropdown-open').forEach(function (li) {
      if (li !== except) li.classList.remove('dropdown-open');
    });
  }

  parents.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var li = link.closest('li');
      var isOpen = li.classList.contains('dropdown-open');
      if (!isOpen) {
        e.preventDefault();
        closeAllDropdowns(li);
        li.classList.add('dropdown-open');
      }
      // Already open: let the click proceed and navigate normally.
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.primary-nav > li')) closeAllDropdowns();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllDropdowns();
  });
});

// Pricing request modal: open/close only. NOTE: the form itself has no
// submission endpoint wired up — see the flag raised alongside this change.
document.addEventListener('DOMContentLoaded', function () {
  var modal = document.getElementById('pricing-modal');
  if (!modal) return;
  var closeBtn = modal.querySelector('.modal-close');
  var form = modal.querySelector('#pricing-form');
  var success = modal.querySelector('#form-success');

  function openModal(e) {
    if (e) e.preventDefault();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.open-pricing-modal').forEach(function (link) {
    link.addEventListener('click', openModal);
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.hidden = true;
      if (success) success.hidden = false;
    });
  }
});

// Cookie consent banner: shows once per browser until a choice is saved.
document.addEventListener('DOMContentLoaded', function () {
  var banner = document.querySelector('[data-cookie-banner]');
  var panel = document.querySelector('[data-cookie-panel]');
  if (!banner) return;

  var STORAGE_KEY = 'cc_cookie_consent';
  var saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    saved = null;
  }

  if (!saved) banner.hidden = false;

  function saveConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      /* localStorage unavailable; consent just won't persist across visits */
    }
  }

  banner.addEventListener('click', function (e) {
    var action = e.target.closest('[data-cookie-action]');
    if (!action) return;
    var type = action.getAttribute('data-cookie-action');

    if (type === 'accept') {
      saveConsent('accepted');
      banner.hidden = true;
    } else if (type === 'decline') {
      saveConsent('declined');
      banner.hidden = true;
    } else if (type === 'close') {
      banner.hidden = true;
    } else if (type === 'settings' && panel) {
      panel.hidden = false;
      banner.hidden = true;
    }
  });

  if (panel) {
    panel.addEventListener('click', function (e) {
      var action = e.target.closest('[data-cookie-action]');
      if (!action || action.getAttribute('data-cookie-action') !== 'save') return;
      var analytics = panel.querySelector('[data-cookie-analytics]');
      saveConsent(analytics && analytics.checked ? 'accepted-analytics' : 'accepted-necessary-only');
      panel.hidden = true;
    });
  }
});

// Custom-styled office maps (Google Maps JavaScript API). Called by the
// Maps script's own ?callback= param once the API has loaded, so this
// must stay a top-level global rather than a DOMContentLoaded listener —
// the API can finish loading before or after the DOM is ready.
window.ccMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f7f5f3' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4d493f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f7f5f3' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9c2b5' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eeece5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dde0d3' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e3ddd0' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f0ece2' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d5b226' }, { lightness: 55 }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8c6a2f' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbe2e0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9aa19c' }] }
];

window.initStyledMaps = function () {
  var els = document.querySelectorAll('[data-styled-map]');
  if (!els.length) return;
  var geocoder = new google.maps.Geocoder();

  els.forEach(function (el) {
    var address = el.getAttribute('data-address');
    if (!address) return;

    geocoder.geocode({ address: address }, function (results, status) {
      if (status !== 'OK' || !results || !results[0]) {
        console.warn('Map geocoding failed for "' + address + '":', status);
        return;
      }
      var location = results[0].geometry.location;
      var map = new google.maps.Map(el, {
        center: location,
        zoom: 15,
        styles: window.ccMapStyle,
        disableDefaultUI: true,
        zoomControl: true
      });
      new google.maps.Marker({
        position: location,
        map: map,
        title: address
      });
    });
  });
};
