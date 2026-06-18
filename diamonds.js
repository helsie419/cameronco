/**
 * Cameron & Co. — Diamond Search and Integration Client
 * Handles frontend filtering, API requests to the proxy server,
 * rendering diamond cards, displaying a premium 360-degree video details modal,
 * and linking selections to the appointment booking system.
 */
document.addEventListener('DOMContentLoaded', () => {
  const diamondForm = document.getElementById('diamond-form');
  const resultsContainer = document.getElementById('diamond-results');
  const statusLine = document.getElementById('diamond-status');
  
  // API Endpoint configuration
  // Fallback to same-origin if hosted together, otherwise local development port
  const API_BASE = window.CAMERON_CO_DIAMOND_API || '';

  // Store search state
  let currentSearchOffset = 0;
  const searchLimit = 12;

  // Initialize form listeners
  if (diamondForm) {
    diamondForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentSearchOffset = 0;
      fetchDiamonds();
    });
  }

  // Initial load
  fetchDiamonds();

  /**
   * Fetches diamond list from the proxy backend
   */
  async function fetchDiamonds() {
    if (!resultsContainer || !statusLine) return;

    statusLine.textContent = 'Searching diamond inventory...';
    resultsContainer.innerHTML = `
      <div class="search-loader">
        <div class="spinner"></div>
        <p>Sourcing from Nivoda network...</p>
      </div>
    `;

    // Extract filters from the form
    const formData = new FormData(diamondForm);
    const shape = formData.get('shape');
    const minCarat = parseFloat(formData.get('minCarat')) || 0.2;
    const maxCarat = parseFloat(formData.get('maxCarat')) || 30.0;
    const color = formData.get('color');
    const clarity = formData.get('clarity');
    const labgrown = formData.get('labgrown') === 'on';

    // Build query payload
    const payload = {
      labgrown: labgrown,
      limit: searchLimit,
      offset: currentSearchOffset
    };

    if (shape) payload.shapes = [shape];
    if (minCarat || maxCarat) {
      payload.sizes = [{ from: minCarat, to: maxCarat }];
    }
    if (color) payload.color = [color];
    if (clarity) payload.clarity = [clarity];

    try {
      const response = await fetch(`${API_BASE}/api/diamonds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      renderDiamonds(data.diamonds);
      statusLine.textContent = `Found ${data.count || 0} diamonds matching your criteria.`;
    } catch (error) {
      console.error('Diamond search error:', error);
      statusLine.textContent = 'Failed to load diamonds. Please try again.';
      resultsContainer.innerHTML = `
        <div class="search-error">
          <p>Unable to connect to the diamond feed.</p>
          <button class="brand-button btn-red" onclick="location.reload()">Retry Search</button>
        </div>
      `;
    }
  }

  /**
   * Renders the diamond cards grid
   */
  function renderDiamonds(diamonds) {
    if (!diamonds || diamonds.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          <p>No diamonds found matching those filters. Try adjusting your carat range or shape settings.</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = '';

    diamonds.forEach(stone => {
      const card = document.createElement('div');
      card.className = 'diamond-card';
      
      // Use fallback image if not provided
      const imageUrl = stone.image || 'assets/images/cameron-co-logo-cropped.png';
      
      card.innerHTML = `
        <div class="diamond-media">
          <img src="${imageUrl}" alt="${stone.carat} Carat ${stone.shape} Diamond" loading="lazy">
          ${stone.video ? '<span class="video-badge">360° Video Available</span>' : ''}
        </div>
        <div class="diamond-body">
          <h3>${stone.carat.toFixed(2)} ct ${formatWord(stone.shape)}</h3>
          <div class="diamond-specs">
            <span>Color: <strong>${stone.color}</strong></span>
            <span>Clarity: <strong>${stone.clarity}</strong></span>
            <span>Cut: <strong>${stone.cut}</strong></span>
            <span>Lab: <strong>${stone.lab}</strong></span>
          </div>
          <div class="diamond-price-row">
            <span class="price-val">$${stone.price.toLocaleString()} AUD</span>
            <button class="btn-view-details brand-button btn-red" data-id="${stone.id}">View Details</button>
          </div>
        </div>
      `;

      // Attach details event listener
      card.querySelector('.btn-view-details').addEventListener('click', () => {
        openDiamondModal(stone);
      });

      resultsContainer.appendChild(card);
    });
  }

  /**
   * Formats database strings to Title Case (e.g. ROUND -> Round)
   */
  function formatWord(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Opens a detailed modal displaying the 360-degree video player and full specifications
   */
  function openDiamondModal(stone) {
    // Check if modal container exists, otherwise create it
    let modal = document.getElementById('diamond-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'diamond-detail-modal';
      modal.className = 'modal-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }

    const autoplayVideoUrl = stone.video ? `${stone.video}/autoplay` : '';
    const bookingUrl = `booking.html?diamondId=${encodeURIComponent(stone.id)}&carat=${stone.carat}&shape=${stone.shape}&price=${stone.price}`;

    modal.innerHTML = `
      <div class="modal-card diamond-detail-card">
        <button aria-label="Close details" class="modal-close">&times;</button>
        <div class="modal-detail-grid">
          <div class="detail-media">
            ${stone.video ? `
              <div class="iframe-container">
                <iframe src="${autoplayVideoUrl}" frameborder="0" allow="autoplay" allowfullscreen></iframe>
              </div>
            ` : `
              <img src="${stone.image || 'assets/images/cameron-co-logo-cropped.png'}" alt="Diamond view">
            `}
          </div>
          <div class="detail-specs">
            <h2>${stone.carat.toFixed(2)} Carat ${formatWord(stone.shape)} Diamond</h2>
            <p class="detail-price">$${stone.price.toLocaleString()} AUD</p>
            
            <table class="specs-table">
              <tr><td>Shape</td><td><strong>${formatWord(stone.shape)}</strong></td></tr>
              <tr><td>Carat Weight</td><td><strong>${stone.carat} ct</strong></td></tr>
              <tr><td>Color Grade</td><td><strong>${stone.color}</strong></td></tr>
              <tr><td>Clarity Grade</td><td><strong>${stone.clarity}</strong></td></tr>
              <tr><td>Cut Grade</td><td><strong>${stone.cut}</strong></td></tr>
              <tr><td>Polish</td><td><strong>${stone.polish}</strong></td></tr>
              <tr><td>Symmetry</td><td><strong>${stone.symmetry}</strong></td></tr>
              <tr><td>Lab Certification</td><td><strong>${stone.lab}</strong></td></tr>
              <tr><td>Certificate Number</td><td><strong>${stone.certNumber}</strong></td></tr>
            </table>

            <div class="modal-actions">
              <a href="${bookingUrl}" class="brand-button btn-red btn-full">Book Design Consultation</a>
              <button class="brand-button secondary btn-full btn-inquire" data-cert="${stone.certNumber}">Inquire About This Diamond</button>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.removeAttribute('hidden');
    document.body.classList.add('modal-is-open');

    // Add Close listeners
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', closeDiamondModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDiamondModal();
    });

    // Inquire CTA opens the generic request pricing modal with cert number filled
    const inquireBtn = modal.querySelector('.btn-inquire');
    inquireBtn.addEventListener('click', () => {
      closeDiamondModal();
      const pricingModal = document.getElementById('pricing-modal');
      if (pricingModal) {
        const descField = document.getElementById('rte-content');
        if (descField) {
          descField.innerHTML = `<p>I am interested in inquiring about the ${stone.carat} ct ${formatWord(stone.shape)} diamond (Cert #: ${stone.certNumber}, price: $${stone.price.toLocaleString()} AUD).</p>`;
        }
        // Open pricing modal
        pricingModal.classList.add('open');
        pricingModal.removeAttribute('hidden');
        document.body.classList.add('modal-is-open');
      }
    });
  }

  function closeDiamondModal() {
    const modal = document.getElementById('diamond-detail-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.classList.remove('modal-is-open');
    }
  }
});
