import './style.css';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createClient } from '@supabase/supabase-js';
import { gsap } from 'gsap';
import placeholderImg from './assets/placeholder.png';

// Setup Tauri Window
const appWindow = getCurrentWindow();
document.getElementById('titlebar-minimize')?.addEventListener('click', () => appWindow.minimize());
document.getElementById('titlebar-maximize')?.addEventListener('click', async () => {
  try {
    const maximized = await appWindow.isMaximized();
    if (maximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  } catch (err) {
    console.error('Maximize error:', err);
  }
});
document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());

// State
let supabase = null;
let strains = [];
let currentRating = 0;
let currentUser = null;
let isOwner = false;
let isUser = false;

// ===== FAVORITES MODULE =====
const Favorites = {
  state: [], // cached array of favorited strain IDs

  async load() {
    if (!supabase || !currentUser) {
      this.state = [];
      return;
    }
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('strain_id')
        .eq('user_id', currentUser.id);
      if (error) throw error;
      this.state = (data || []).map(row => row.strain_id);
    } catch (err) {
      console.error('[Favorites] load error:', err.message);
      this.state = [];
    }
  },

  async toggle(strainId) {
    if (!supabase || !currentUser) return;
    const isFav = this.isFavorite(strainId);
    // Optimistic update
    if (isFav) {
      this.state = this.state.filter(id => id !== strainId);
    } else {
      this.state = [...this.state, strainId];
    }
    try {
      if (isFav) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('strain_id', strainId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert([{ user_id: currentUser.id, strain_id: strainId }]);
        if (error) throw error;
      }
    } catch (err) {
      // Rollback optimistic update on failure
      if (isFav) {
        this.state = [...this.state, strainId];
      } else {
        this.state = this.state.filter(id => id !== strainId);
      }
      throw err;
    }
  },

  isFavorite(strainId) {
    return this.state.includes(strainId);
  }
};

// App state for UI filters
const appState = {
  showFavoritesOnly: false
};

// Initialize App
async function init() {
  lucide.createIcons();
  setupRouting();
  setupSidebar();
  setupStarRating();
  setupForms();
  setupSearchAndFilter();
  setupCustomSelects();

  // Initialize lightbox
  if (!document.getElementById('lightbox-overlay')) {
    const lb = document.createElement('div');
    lb.id = 'lightbox-overlay';
    lb.innerHTML = `
      <button id="lightbox-close" aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img id="lightbox-img" src="" alt="Strain image">
    `;
    document.body.appendChild(lb);

    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.closest('#lightbox-close')) closeLightbox();
    });

    // Add mousewheel zoom functionality
    lb.addEventListener('wheel', (e) => {
      if (!lb.classList.contains('active')) return;
      e.preventDefault();

      const img = document.getElementById('lightbox-img');
      if (!img) return;

      const zoomStep = 0.2;
      if (e.deltaY < 0) {
        lightboxZoom = Math.min(lightboxZoom + zoomStep, 4);
      } else {
        lightboxZoom = Math.max(lightboxZoom - zoomStep, 1);
      }

      img.style.transform = `scale(${lightboxZoom})`;
    }, { passive: false });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.getElementById('lightbox-overlay')?.classList.contains('active')) {
        closeLightbox();
        return;
      }
      forceResetModalOverlays();
    }
  });

  // Empty state floating animation
  gsap.to('.floating-logo', {
    y: -10,
    duration: 2,
    yoyo: true,
    repeat: -1,
    ease: 'power1.inOut'
  });

  await loadSettings();
  if (supabase) {
    await fetchStrains();
  } else {
    window.location.hash = '#about';
  }
}

// Supabase Connection
async function loadSettings() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    supabase = createClient(url, key);

    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;
    if (currentUser) {
      await Favorites.load();
    }
    updateAuthUI();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const wasLoggedIn = !!currentUser;
      currentUser = session?.user || null;
      if (currentUser) {
        await Favorites.load();
      } else if (wasLoggedIn) {
        // Logout: reset favorites state and filter
        Favorites.state = [];
        appState.showFavoritesOnly = false;
        const favBtn = document.getElementById('fav-filter-btn');
        if (favBtn) favBtn.classList.remove('filter-active');
      }
      updateAuthUI();
      if (window.location.hash === '#dashboard' || window.location.hash === '') {
        renderStrains();
      }
    });

    updateConnectionStatus(true);
  } else {
    updateConnectionStatus(false);
    showToast('Supabase not configured', 'error');
  }
}

function updateAuthUI() {
  if (currentUser) {
    const role = currentUser.app_metadata?.role || currentUser.user_metadata?.role || '';
    isOwner = role.toLowerCase() === 'owner' || role.toLowerCase() === 'admin';
    isUser = !isOwner;
  } else {
    isOwner = false;
    isUser = false;
  }

  const authBtn = document.getElementById('auth-btn');
  if (authBtn) {
    if (currentUser) {
      authBtn.innerHTML = '<i data-lucide="log-out"></i> <span id="auth-btn-text">Log out</span>';
      authBtn.classList.remove('btn-secondary');
      authBtn.classList.add('btn-danger');
    } else {
      authBtn.innerHTML = '<i data-lucide="log-in"></i> <span id="auth-btn-text">Login</span>';
      authBtn.classList.remove('btn-danger');
      authBtn.classList.add('btn-secondary');
    }
  }

  const adminPanelBtn = document.getElementById('admin-panel-btn');
  if (adminPanelBtn) adminPanelBtn.style.display = isOwner ? 'flex' : 'none';

  const userPanelBtn = document.getElementById('user-panel-btn');
  if (userPanelBtn) userPanelBtn.style.display = isUser ? 'flex' : 'none';

  // Show/hide favorites filter button based on auth state
  const favFilterBtn = document.getElementById('fav-filter-btn');
  if (favFilterBtn) favFilterBtn.style.display = currentUser ? 'flex' : 'none';

  if (window.lucide) window.lucide.createIcons();
}

function updateConnectionStatus(isConnected) {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  if (isConnected) {
    dot.className = 'status-dot online';
    text.textContent = 'Connected';
  } else {
    dot.className = 'status-dot offline';
    text.textContent = 'Offline';
  }
}

// Routing & Sidebar
function setupRouting() {
  window.addEventListener('hashchange', handleRoute);
  if (!window.location.hash) window.location.hash = '#dashboard';
  handleRoute();
}

function closeAllModals() {
  forceResetModalOverlays();
}

function forceResetModalOverlays() {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('active');
  });
  document.body.style.overflow = '';
  document.body.classList.remove('modal-open', 'overflow-hidden', 'blur-active');
}

function handleRoute() {
  const hash = window.location.hash.substring(1) || 'dashboard';

  // Close all modals when navigating
  closeAllModals();

  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.add('hidden');
  });

  // Show active view
  const activeView = document.getElementById(`view-${hash}`);
  if (activeView) {
    activeView.classList.remove('hidden');
    gsap.fromTo(activeView,
      { opacity: 0, y: 10, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out' }
    );
  }

  // Reset form when leaving add view
  if (hash !== 'add') {
    resetAddForm();
  }

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-view') === hash) {
      item.classList.add('active');
      const indicator = document.querySelector('.nav-indicator');
      gsap.to(indicator, {
        y: item.offsetTop,
        duration: 0.3,
        ease: 'power2.out'
      });
    }
  });

  // Load specific view data
  if (hash === 'dashboard') {
    renderStrains();
  } else if (hash === 'statistics') {
    renderStatistics(strains);
  }
}

function setupSidebar() {
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.style.width === '64px') {
      sidebar.style.width = '240px';
      document.querySelectorAll('.nav-label').forEach(el => el.style.display = 'block');
    } else {
      sidebar.style.width = '64px';
      document.querySelectorAll('.nav-label').forEach(el => el.style.display = 'none');
    }
  });
}

// Data Fetching
async function fetchStrains() {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('strains')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    strains = data || [];
    if (window.location.hash === '#dashboard' || window.location.hash === '') {
      renderStrains();
    } else if (window.location.hash === '#statistics') {
      renderStatistics(strains);
    }
  } catch (err) {
    showToast('Failed to fetch strains: ' + err.message, 'error');
  }
}

function canEditStrain(strain) {
  if (!currentUser) return false;
  if (isOwner) return true;
  return strain.user_id === currentUser.id;
}

// Lightbox Functions
let lightboxZoom = 1;

function openLightbox(src, alt = '') {
  const overlay = document.getElementById('lightbox-overlay');
  const img = document.getElementById('lightbox-img');
  if (!overlay || !img) return;

  lightboxZoom = 1;
  img.src = src;
  img.alt = alt;
  img.style.transform = 'scale(1)';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  lightboxZoom = 1;
}

// Render Strains
function renderStrains() {
  const grid = document.getElementById('strain-grid');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input').value.toLowerCase();
  const typeFilter = document.getElementById('type-filter').value;
  const sortValue = document.getElementById('filter-sort')?.value || 'newest';

  grid.innerHTML = '';

  let filteredStrains = strains.filter(strain => {
    const matchesSearch = strain.name.toLowerCase().includes(searchInput) ||
      (strain.medical_name && strain.medical_name.toLowerCase().includes(searchInput));
    const matchesType = typeFilter === 'all' || strain.type === typeFilter;
    const matchesFav = !appState.showFavoritesOnly || Favorites.isFavorite(strain.id);
    return matchesSearch && matchesType && matchesFav;
  });

  if (sortValue === 'newest') {
    filteredStrains.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (sortValue === 'rating') {
    filteredStrains.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortValue === 'name') {
    filteredStrains.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortValue === 'thc') {
    filteredStrains.sort((a, b) => (parseFloat(b.thc_content ?? b.thc) || 0) - (parseFloat(a.thc_content ?? a.thc) || 0));
  }

  if (filteredStrains.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');

    filteredStrains.forEach((strain, index) => {
      const card = document.createElement('div');
      card.className = 'strain-card';

      const typeClass = strain.type === 'Indica' ? 'type-indica' :
        strain.type === 'Sativa' ? 'type-sativa' : 'type-hybrid';

      const imgSrc = strain.image_url || placeholderImg;

      const dateStr = strain.created_at ? new Date(strain.created_at).toLocaleDateString('de-DE') : '';
      const effectsText = strain.effects || 'No effects listed';

      const privateBadge = strain.is_private ? `<div class="card-type-badge" style="background:rgba(0,0,0,0.6); right:auto; left:12px;"><i data-lucide="lock" style="width:12px; height:12px; vertical-align:middle;"></i> Private</div>` : '';

      card.innerHTML = `
        <div class="card-image-wrap">
          <img src="${imgSrc}" alt="${strain.name}" loading="lazy" onerror="this.src='${placeholderImg}'">
          <div class="card-type-badge ${typeClass}">${strain.type}</div>
          ${privateBadge}
        </div>
        <div class="card-content">
          <div class="card-header">
            <div>
              <div class="card-title">${strain.name}</div>
              <div class="card-medical">${strain.medical_name || ''}</div>
            </div>
            <div class="card-rating">
              <span>${(strain.rating || 0).toFixed(1)}</span>
              <i data-lucide="star"></i>
            </div>
          </div>
          <div class="card-stats">
            <div class="stat">
              <span class="stat-label">THC</span>
              <span class="stat-value">${strain.thc_content || 0}%</span>
            </div>
            <div class="stat">
              <span class="stat-label">CBD</span>
              <span class="stat-value">${strain.cbd_content || 0}%</span>
            </div>
          </div>
          <div class="card-effects">${effectsText}</div>
          <div class="card-footer">
            <div class="card-date">${dateStr}</div>
            <div class="card-actions">
              ${currentUser ? `
              <button class="btn-favorite" title="${Favorites.isFavorite(strain.id) ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzuf\u00fcgen'}" aria-label="${Favorites.isFavorite(strain.id) ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzuf\u00fcgen'}" onclick="window.App.toggleFavorite('${strain.id}'); event.stopPropagation()">
                ${Favorites.isFavorite(strain.id)
                  ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                  : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                }
              </button>
              ` : ''}
              ${canEditStrain(strain) ? `
              <button class="card-action-btn edit" title="Edit">
                <i data-lucide="pencil"></i>
              </button>
              <button class="card-action-btn delete" title="Delete">
                <i data-lucide="trash-2"></i>
              </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      card.dataset.id = strain.id;

      // Mouse tracking for glow effect
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });

      card.addEventListener('click', () => openStrainModal(strain));

      if (canEditStrain(strain)) {
        const editBtn = card.querySelector('.edit');
        const deleteBtn = card.querySelector('.delete');

        editBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          editStrain(strain);
        });

        deleteBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteStrain(strain);
        });
      }

      grid.appendChild(card);
    });

    lucide.createIcons();

    // Custom Upload Button Logic
    const uploadZone = document.getElementById('upload-dropzone');
    const uploadBtn = document.getElementById('upload-trigger-btn');
    const uploadInput = document.getElementById('image_upload');
    const uploadFilename = document.getElementById('upload-filename');

    if (uploadBtn && uploadInput) {
      // Click auf Button oder gesamte Zone öffnet File-Dialog
      uploadZone.addEventListener('click', () => uploadInput.click());
      uploadBtn.addEventListener('click', (e) => { e.stopPropagation(); uploadInput.click(); });

      // Dateiname anzeigen wenn Datei gewählt
      uploadInput.addEventListener('change', () => {
        const file = uploadInput.files[0];
        uploadFilename.textContent = file ? file.name : 'Keine Datei ausgewählt';
        uploadFilename.style.color = file ? 'var(--text-primary)' : 'var(--text-muted)';
      });

      // Drag & Drop hover effect
      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--accent)';
        uploadZone.style.background = 'rgba(16,185,129,0.06)';
      });
      uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = '';
        uploadZone.style.background = '';
      });
      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = '';
        uploadZone.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          const dt = new DataTransfer();
          dt.items.add(file);
          uploadInput.files = dt.files;
          uploadInput.dispatchEvent(new Event('change'));
        }
      });
    }

    // Animate cards in
    gsap.fromTo('.strain-card',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.05, duration: 0.4, ease: 'power2.out' }
    );
  }
}

// Modal Logic
function openStrainModal(strain) {
  const modal = document.getElementById('strain-modal');
  const body = document.getElementById('modal-body');
  const modalContent = modal?.querySelector('.modal-content');

  const typeClass = strain.type === 'Indica' ? 'type-indica' :
    strain.type === 'Sativa' ? 'type-sativa' : 'type-hybrid';

  const heroSrc = strain.image_url || placeholderImg;

  const effectsTags = strain.effects ? strain.effects.split(',').map(e => `<span class="modal-tag">${e.trim()}</span>`).join('') : '<span class="modal-tag">No effects listed</span>';
  const flavorTags = strain.taste ? strain.taste.split(',').map(f => `<span class="modal-tag">${f.trim()}</span>`).join('') : '<span class="modal-tag">No flavors listed</span>';

  const medicalName = strain.medical_name || '';
  const copyBtn = medicalName ? ` 
    <button class="modal-copy-btn" id="copy-medical-btn" title="Copy medical name" aria-label="Copy medical name"> 
      <i data-lucide="copy"></i> 
    </button>` : '';

  body.innerHTML = `
    <div class="modal-hero">
      <img id="modal-hero-img" src="${heroSrc}" alt="${strain.name}" loading="lazy" onerror="this.src='${placeholderImg}'" style="cursor: zoom-in;">
      <div class="modal-hero-gradient"></div>
    </div>
    <div class="modal-details">
      <div class="modal-title-row">
        <h2 class="modal-title">${strain.name}</h2>
        <div class="modal-type-badge ${typeClass}">${strain.type}</div>
      </div>
      <div class="modal-medical-row"> 
        <span class="modal-medical">${medicalName}</span> 
        ${copyBtn} 
      </div> 
      
      <div class="modal-stats-grid">
        <div class="modal-stat-box">
          <span class="label">Rating</span>
          <span class="value" style="font-size: 18px;">
            ${(strain.rating || 0).toFixed(1)} 
            <span style="display:flex; margin-left:6px; gap:2px;">
              ${[1, 2, 3, 4, 5].map(i => {
    const r = strain.rating || 0;
    const isFull = i <= Math.floor(r);
    const isHalf = i === Math.ceil(r) && r % 1 !== 0;
    const overlayWidth = isFull ? '100%' : (isHalf ? '50%' : '0%');
    return `<span style="position:relative;display:inline-block;width:14px;height:14px;"><i data-lucide="star" style="width:14px; height:14px; color:var(--text-muted); fill:none;"></i>${(isFull || isHalf) ? `<div style="position:absolute;top:0;left:0;width:${overlayWidth};height:100%;overflow:hidden;"><i data-lucide="star" style="min-width:14px; width:14px; height:14px; fill:var(--star); color:var(--star);"></i></div>` : ''}</span>`;
  }).join('')}
            </span>
          </span>
        </div>
        <div class="modal-stat-box">
          <span class="label">THC</span>
          <span class="value">${strain.thc_content || 0}%</span>
        </div>
        <div class="modal-stat-box">
          <span class="label">CBD</span>
          <span class="value">${strain.cbd_content || 0}%</span>
        </div>
        ${strain.importer ? `
        <div class="modal-stat-box">
          <span class="label">Grower</span>
          <span class="value" style="font-size: 16px;">${strain.importer}</span>
        </div>` : ''}
        ${strain.price ? `
        <div class="modal-stat-box">
          <span class="label">Price</span>
          <span class="value" style="font-size: 18px;">${strain.price} €<span style="font-size:12px; color:var(--text-muted); margin-left:4px;">/g</span></span>
        </div>` : ''}
      </div>
      
      <div class="modal-section">
        <h3><i data-lucide="sparkles"></i> Effects</h3>
        <div class="modal-tags">${effectsTags}</div>
      </div>
      
      <div class="modal-section">
        <h3><i data-lucide="coffee"></i> Flavor Profile</h3>
        <div class="modal-tags">${flavorTags}</div>
      </div>
      
      <div class="modal-section">
        <h3><i data-lucide="file-text"></i> Notes & Details</h3>
        <div class="modal-notes">
          ${strain.notes || 'No notes provided.'}
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();

  // Add lightbox click handler to modal hero image with setTimeout to ensure DOM is ready
  setTimeout(() => {
    const heroImg = document.getElementById('modal-hero-img');
    if (heroImg) {
      heroImg.addEventListener('click', () => {
        openLightbox(heroSrc, strain.name);
      });
    }
  }, 0);

  const copyBtnEl = document.getElementById('copy-medical-btn');
  if (copyBtnEl && medicalName) {
    copyBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(medicalName).then(() => {
        copyBtnEl.classList.add('copied');
        copyBtnEl.innerHTML = '<i data-lucide="check"></i>';
        lucide.createIcons();
        showToast('Medical name copied!', 'success');
        setTimeout(() => {
          copyBtnEl.classList.remove('copied');
          copyBtnEl.innerHTML = '<i data-lucide="copy"></i>';
          lucide.createIcons();
        }, 2000);
      }).catch(() => showToast('Could not copy to clipboard', 'error'));
    });
  }

  modal.classList.remove('hidden');
  gsap.fromTo(modalContent,
    { y: 50, scale: 0.95, opacity: 0 },
    { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.5)' }
  );
}

function closeStrainModal() {
  const modal = document.getElementById('strain-modal');
  const modalContent = modal?.querySelector('.modal-content');
  gsap.to(modalContent, {
    y: 20, scale: 0.95, opacity: 0, duration: 0.2, ease: 'power2.in',
    onComplete: () => {
      modal.classList.add('hidden');
    }
  });
}

document.getElementById('modal-close')?.addEventListener('click', closeStrainModal);
document.getElementById('strain-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'strain-modal') closeStrainModal();
});

// Search and Filter
function setupSearchAndFilter() {
  document.getElementById('search-input')?.addEventListener('input', renderStrains);
  document.getElementById('type-filter')?.addEventListener('change', renderStrains);
  document.getElementById('filter-sort')?.addEventListener('change', () => renderStrains());

  document.getElementById('fav-filter-btn')?.addEventListener('click', () => {
    appState.showFavoritesOnly = !appState.showFavoritesOnly;
    const btn = document.getElementById('fav-filter-btn');
    btn?.classList.toggle('filter-active', appState.showFavoritesOnly);
    renderStrains();
  });
}

// ===== APP GLOBAL INTERFACE =====
window.App = {
  async toggleFavorite(strainId) {
    if (!currentUser) {
      showToast('Bitte einloggen um Favoriten zu nutzen', 'error');
      return;
    }
    const wasFav = Favorites.isFavorite(strainId);
    try {
      await Favorites.toggle(strainId);
      // Update only the affected card's heart button (no full re-render)
      const card = document.querySelector(`.strain-card[data-id="${strainId}"]`);
      if (card) {
        const favBtn = card.querySelector('.btn-favorite');
        if (favBtn) {
          const isFavNow = Favorites.isFavorite(strainId);
          favBtn.title = isFavNow ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzuf\u00fcgen';
          favBtn.setAttribute('aria-label', isFavNow ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzuf\u00fcgen');
          favBtn.innerHTML = isFavNow
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
          // If favoritesOnly filter is active and we just un-favorited, re-render
          if (appState.showFavoritesOnly && !Favorites.isFavorite(strainId)) {
            renderStrains();
          }
        }
      }
      showToast(
        Favorites.isFavorite(strainId) ? 'Zu Favoriten hinzugefügt ❤️' : 'Aus Favoriten entfernt',
        'success'
      );
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error');
    }
  }
};

// Forms and Settings
function setupForms() {

  // Image Upload Preview
  const imageUpload = document.getElementById('image_upload');
  const imagePreview = document.getElementById('image_preview');

  imageUpload?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Bild darf maximal 5MB groß sein', 'error');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
      };
      reader.readAsDataURL(file);
    } else {
      imagePreview.innerHTML = '<i data-lucide="image" style="color: var(--text-muted);"></i>';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  document.getElementById('refresh-data-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-data-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Refreshing...';
    btn.disabled = true;
    lucide.createIcons();
    await fetchStrains();
    btn.innerHTML = originalText;
    btn.disabled = false;
    lucide.createIcons();
    showToast('Data refreshed successfully', 'success');
  });

  // Add Strain Form
  document.getElementById('add-strain-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) {
      showToast('Not connected to Supabase', 'error');
      return;
    }

    const strainId = document.getElementById('strain-id').value;
    const btn = document.getElementById('save-strain-btn');
    const originalText = btn.textContent;
    btn.textContent = strainId ? 'Updating...' : 'Saving...';
    btn.disabled = true;

    const strainData = {
      name: document.getElementById('name').value,
      medical_name: document.getElementById('medical_name').value,
      type: document.getElementById('type').value,
      thc_content: parseFloat(document.getElementById('thc').value) || 0,
      cbd_content: parseFloat(document.getElementById('cbd').value) || 0,
      rating: currentRating,
      effects: document.getElementById('effects').value,
      taste: document.getElementById('flavor').value,
      importer: document.getElementById('importer').value,
      price: parseFloat(document.getElementById('price').value) || 0,
      notes: document.getElementById('notes').value,
      image_url: document.getElementById('image_url').value,
      is_private: document.getElementById('is_private').checked
    };

    if (!strainId && currentUser) {
      strainData.user_id = currentUser.id;
    }

    try {
      // Image Upload Logic
      const imageFile = document.getElementById('image_upload').files[0];
      if (imageFile) {
        btn.textContent = 'Lade Bild hoch...';
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${currentUser ? currentUser.id : 'public'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('strain-images')
          .upload(filePath, imageFile);

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error('Fehler beim Bild-Upload. Nutze Bucket "strain-images": ' + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('strain-images')
          .getPublicUrl(filePath);

        strainData.image_url = publicUrl;
      }

      btn.textContent = strainId ? 'Speichere Daten...' : 'Speichere Daten...';
      if (strainId) {
        const { data, error } = await supabase
          .from('strains')
          .update(strainData)
          .eq('id', strainId)
          .select();
        if (error) throw error;

        const index = strains.findIndex(s => s.id === strainId);
        if (index !== -1) strains[index] = data[0];

        showToast('Strain updated successfully', 'success');
      } else {
        const { data, error } = await supabase
          .from('strains')
          .insert([strainData])
          .select();

        if (error) throw error;
        strains.unshift(data[0]);
        showToast('Strain added successfully', 'success');
      }

      renderStrains();
      e.target.reset();
      resetAddForm();
      window.location.hash = '#dashboard';
    } catch (err) {
      showToast(err.message, 'error');
    }

    btn.textContent = originalText;
    btn.disabled = false;
  });

  // Auth logic
  document.getElementById('auth-btn')?.addEventListener('click', async () => {
    if (currentUser) {
      await supabase.auth.signOut();
      showToast('Logged out successfully', 'success');
    } else {
      document.getElementById('auth-modal').classList.remove('hidden');
    }
  });

  document.getElementById('auth-modal-close')?.addEventListener('click', () => {
    document.getElementById('auth-modal').classList.add('hidden');
  });

  document.getElementById('show-register-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('register-modal').classList.remove('hidden');
  });

  document.getElementById('show-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-modal').classList.add('hidden');
    document.getElementById('auth-modal').classList.remove('hidden');
  });

  document.getElementById('register-modal-close')?.addEventListener('click', () => {
    document.getElementById('register-modal').classList.add('hidden');
  });

  document.getElementById('reg-submit-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;
    const btn = document.getElementById('reg-submit-btn');

    if (!email || !password) return showToast('Please enter email and password', 'error');
    if (password !== confirm) return showToast('Passwords do not match', 'error');

    btn.textContent = 'Registrieren...';
    btn.disabled = true;

    const { error } = await supabase.auth.signUp({ email, password });

    btn.textContent = 'Registrieren';
    btn.disabled = false;

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Registration successful! Please login.', 'success');
      document.getElementById('register-modal').classList.add('hidden');
      document.getElementById('auth-modal').classList.remove('hidden');
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-password-confirm').value = '';
    }
  });

  document.getElementById('auth-submit-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-submit-btn');

    if (!email || !password) return showToast('Please enter email and password', 'error');

    btn.textContent = 'Logging in...';
    btn.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    btn.textContent = 'Login';
    btn.disabled = false;

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Logged in successfully', 'success');
      document.getElementById('auth-modal').classList.add('hidden');
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-password').value = '';
    }
  });

  const handleAuthEnter = (e) => {
    if (e.key === 'Enter') {
      document.getElementById('auth-submit-btn')?.click();
    }
  };

  document.getElementById('auth-email')?.addEventListener('keydown', handleAuthEnter);
  document.getElementById('auth-password')?.addEventListener('keydown', handleAuthEnter);

  // User Panel Handlers
  document.getElementById('user-panel-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('user-panel-modal').classList.remove('hidden');
    loadUserStrains();
  });

  document.getElementById('user-panel-close')?.addEventListener('click', () => {
    document.getElementById('user-panel-modal').classList.add('hidden');
  });

  // Admin Panel Handlers
  document.getElementById('admin-panel-btn')?.addEventListener('click', (e) => {
    e.preventDefault();

    // Force-close any stuck modal overlays before opening admin panel 
    forceResetModalOverlays();

    try {
      const adminPanelModal = document.getElementById('admin-panel-modal');
      adminPanelModal.classList.remove('hidden');
      loadAdminStrains();
    } catch (err) {
      console.error('[AdminPanel] Failed to open:', err);
      // Reset everything on failure 
      forceResetModalOverlays();
    }
  });

  document.getElementById('admin-panel-close')?.addEventListener('click', () => {
    document.getElementById('admin-panel-modal').classList.add('hidden');
  });

  // Generic modal close on overlay background click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  // Admin Panel Tabs
  const tabStrains = document.getElementById('admin-tab-strains');
  const tabUsers = document.getElementById('admin-tab-users');

  tabStrains?.addEventListener('click', () => {
    tabStrains.classList.add('active');
    tabUsers?.classList.remove('active');
    document.getElementById('admin-section-strains').classList.remove('hidden');
    document.getElementById('admin-section-users').classList.add('hidden');
    loadAdminStrains();
  });

  tabUsers?.addEventListener('click', () => {
    tabUsers.classList.add('active');
    tabStrains?.classList.remove('active');
    document.getElementById('admin-section-users').classList.remove('hidden');
    document.getElementById('admin-section-strains').classList.add('hidden');
    loadAdminUsers();
  });
}

function loadUserStrains() {
  const container = document.getElementById('user-strains-list');
  container.innerHTML = '';

  if (!currentUser) return;

  const userStrains = strains.filter(s => s.user_id === currentUser.id);

  if (userStrains.length === 0) {
    container.innerHTML = '<p class="text-muted">Du hast noch keine Sorten hinzugefügt.</p>';
    return;
  }

  userStrains.forEach(strain => {
    const item = document.createElement('div');
    item.className = 'admin-list-item'; // Reusing existing styling if any, or a simple flex layout
    item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-secondary); border-radius:8px;';

    const typeClass = strain.type === 'Indica' ? 'type-indica' : strain.type === 'Sativa' ? 'type-sativa' : 'type-hybrid';
    const privateBadge = strain.is_private ? '<span style="font-size:12px; background:rgba(0,0,0,0.5); padding:2px 6px; border-radius:4px; margin-left:8px;"><i data-lucide="lock" style="width:10px; height:10px;"></i> Private</span>' : '';

    item.innerHTML = `
      <div>
        <div style="font-weight:600;">${strain.name}</div>
        <div style="font-size:12px; margin-top:4px;">
          <span class="card-type-badge ${typeClass}" style="position:static; padding:2px 6px;">${strain.type}</span>
          ${privateBadge}
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-icon edit-btn" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="btn btn-danger btn-icon del-btn" title="Delete"><i data-lucide="trash-2"></i></button>
      </div>
    `;

    item.querySelector('.edit-btn').addEventListener('click', () => {
      document.getElementById('user-panel-modal').classList.add('hidden');
      editStrain(strain);
    });

    item.querySelector('.del-btn').addEventListener('click', () => {
      deleteStrain(strain);
    });

    container.appendChild(item);
  });

  if (window.lucide) window.lucide.createIcons();
}

function loadAdminStrains() {
  const container = document.getElementById('admin-strains-list');
  container.innerHTML = '';

  if (!currentUser || !isOwner) return;

  if (strains.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Sorten in der Datenbank vorhanden.</p>';
    return;
  }

  strains.forEach(strain => {
    const item = document.createElement('div');
    item.className = 'admin-list-item';
    item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-secondary); border-radius:8px;';

    const typeClass = strain.type === 'Indica' ? 'type-indica' : strain.type === 'Sativa' ? 'type-sativa' : 'type-hybrid';
    const privateBadge = strain.is_private ? '<span style="font-size:12px; background:rgba(0,0,0,0.5); padding:2px 6px; border-radius:4px; margin-left:8px;"><i data-lucide="lock" style="width:10px; height:10px;"></i> Private</span>' : '';

    // Check if it's the admin's own strain vs another user's
    const ownershipInfo = strain.user_id === currentUser.id
      ? '<span style="font-size:11px; color:var(--accent);">Deine</span>'
      : '<span style="font-size:11px; color:#aaa;">Andere User</span>';

    item.innerHTML = `
      <div>
        <div style="font-weight:600;">${strain.name}</div>
        <div style="font-size:12px; margin-top:4px;">
          <span class="card-type-badge ${typeClass}" style="position:static; padding:2px 6px;">${strain.type}</span>
          ${privateBadge}
          <span style="margin-left: 8px;">${ownershipInfo}</span>
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-icon edit-btn" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="btn btn-danger btn-icon del-btn" title="Delete"><i data-lucide="trash-2"></i></button>
      </div>
    `;

    item.querySelector('.edit-btn').addEventListener('click', () => {
      document.getElementById('admin-panel-modal').classList.add('hidden');
      editStrain(strain);
    });

    item.querySelector('.del-btn').addEventListener('click', () => {
      deleteStrain(strain);
    });

    container.appendChild(item);
  });

  if (window.lucide) window.lucide.createIcons();
}

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-list');
  container.innerHTML = '<div style="text-align:center; padding:20px;"><i data-lucide="loader" class="animate-spin"></i> Lade Benutzer...</div>';
  if (window.lucide) window.lucide.createIcons();

  if (!currentUser || !isOwner) return;

  try {
    const { data: users, error } = await supabase.rpc('get_all_users');

    if (error) throw error;

    container.innerHTML = '';

    if (!users || users.length === 0) {
      container.innerHTML = '<p class="text-muted">Keine Benutzer gefunden.</p>';
      return;
    }

    users.forEach(user => {
      const item = document.createElement('div');
      item.className = 'admin-list-item';
      item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-secondary); border-radius:8px;';

      const roleBadge = user.role === 'owner' ? '<span style="font-size:11px; color:#f59e0b; border: 1px solid rgba(245,158,11,0.3); padding: 2px 6px; border-radius: 4px;">Owner</span>' :
        user.role === 'admin' ? '<span style="font-size:11px; color:#3b82f6; border: 1px solid rgba(59,130,246,0.3); padding: 2px 6px; border-radius: 4px;">Admin</span>' :
          '<span style="font-size:11px; color:#10b981; border: 1px solid rgba(16,185,129,0.3); padding: 2px 6px; border-radius: 4px;">User</span>';

      item.innerHTML = `
        <div>
          <div style="font-weight:600; font-size:14px;">${user.email}</div>
          <div style="font-size:12px; margin-top:6px; display:flex; gap:8px; align-items: center;">
            ${roleBadge}
            <span style="color:var(--text-muted); font-family: monospace;">ID: ${user.id.substring(0, 8)}...</span>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <div class="custom-select-wrapper role-dropdown" style="min-width:90px;"></div>
          <button class="btn btn-danger btn-icon del-user-btn" title="Delete User"><i data-lucide="trash-2"></i></button>
        </div>
      `;

      const roles = ['user', 'admin', 'owner'];
      const dropdownWrapper = item.querySelector('.role-dropdown');
      let currentRole = user.role;

      const trigger = document.createElement('div');
      trigger.className = 'custom-select-trigger';
      trigger.innerHTML = `<span>${currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}</span> <i data-lucide="chevron-down"></i>`;

      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'custom-select-options';

      roles.forEach(r => {
        const optDiv = document.createElement('div');
        optDiv.className = 'custom-select-option' + (r === currentRole ? ' selected' : '');
        optDiv.textContent = r.charAt(0).toUpperCase() + r.slice(1);
        optDiv.dataset.value = r;
        optDiv.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (r === currentRole) { dropdownWrapper.classList.remove('open'); return; }
          try {
            const { error: updateErr } = await supabase.rpc('update_user_role', { target_user_id: user.id, new_role: r });
            if (updateErr) throw updateErr;
            currentRole = r;
            trigger.querySelector('span').textContent = r.charAt(0).toUpperCase() + r.slice(1);
            optionsContainer.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
            optDiv.classList.add('selected');
            showToast('Benutzerrolle aktualisiert!', 'success');
            loadAdminUsers();
          } catch (err) {
            showToast('Fehler: ' + err.message, 'error');
          }
          dropdownWrapper.classList.remove('open');
        });
        optionsContainer.appendChild(optDiv);
      });

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
          if (w !== dropdownWrapper) w.classList.remove('open');
        });
        dropdownWrapper.classList.toggle('open');
      });

      dropdownWrapper.appendChild(trigger);
      dropdownWrapper.appendChild(optionsContainer);

      item.querySelector('.del-user-btn').addEventListener('click', () => {
        showConfirmModal(`Möchtest du den Benutzer "${user.email}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`, async () => {
          try {
            const { error: delErr } = await supabase.rpc('delete_user', { target_user_id: user.id });
            if (delErr) throw delErr;
            showToast('Benutzer gelöscht', 'success');
            loadAdminUsers(); // Refresh the list
          } catch (err) {
            showToast('Fehler beim Löschen: ' + err.message, 'error');
          }
        });
      });

      container.appendChild(item);
    });

    if (window.lucide) window.lucide.createIcons();

  } catch (err) {
    container.innerHTML = `<p class="text-danger" style="color: #ef4444;">Fehler beim Laden: ${err.message}</p>`;
  }
}

// Star Rating Input
function setupStarRating() {
  const container = document.getElementById('star-rating-input');
  if (!container) return;

  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('div');
    star.innerHTML = `<i data-lucide="star"></i>`;
    star.dataset.value = i;
    star.style.position = 'relative';
    star.addEventListener('click', (e) => {
      // Logic for half stars based on click position
      const rect = star.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const isHalf = clickX < rect.width / 2;
      setRating(isHalf ? i - 0.5 : i);
    });
    container.appendChild(star);
  }
  lucide.createIcons();

  container.addEventListener('mousemove', (e) => {
    const stars = container.querySelectorAll('svg');
    const rect = container.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right) return;

    let hoverIndex = 0;
    stars.forEach((star, idx) => {
      const sRect = star.getBoundingClientRect();
      if (e.clientX >= sRect.left) hoverIndex = idx + 1;
    });

    stars.forEach((star, idx) => {
      if (idx < hoverIndex) star.classList.add('active');
      else star.classList.remove('active');
    });
  });

  container.addEventListener('mouseleave', () => {
    setRating(currentRating); // Reset to selected
  });
}

function setRating(rating) {
  currentRating = rating;
  document.getElementById('rating').value = rating;
  const starDivs = document.getElementById('star-rating-input').querySelectorAll('div[data-value]');
  starDivs.forEach((starDiv, idx) => {
    const existingOverlay = starDiv.querySelector('.half-overlay');
    if (existingOverlay) existingOverlay.remove();

    const svg = starDiv.querySelector('svg');
    if (idx < Math.floor(rating)) {
      svg.classList.add('active');
    } else if (idx === Math.floor(rating) && rating % 1 !== 0) {
      svg.classList.remove('active');
      const overlay = document.createElement('div');
      overlay.className = 'half-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '50%';
      overlay.style.height = '100%';
      overlay.style.overflow = 'hidden';
      const clone = svg.cloneNode(true);
      clone.classList.add('active');
      clone.style.minWidth = '24px';
      overlay.appendChild(clone);
      starDiv.appendChild(overlay);
    } else {
      svg.classList.remove('active');
    }
  });
}

// Statistics
let chartInstances = {};

function destroyCharts() {
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};
}

function renderStatistics(strainsList) {
  if (!strainsList) return;
  destroyCharts();

  // KPIs
  document.getElementById('kpi-total').textContent = strainsList.length;
  const avgRating = strainsList.length ? (strainsList.reduce((s, x) => s + (x.rating || 0), 0) / strainsList.length).toFixed(1) : '0.0';
  document.getElementById('kpi-avg-rating').textContent = avgRating + ' ★';
  const avgThc = strainsList.length ? Math.round(strainsList.reduce((s, x) => s + (parseFloat(x.thc_content || x.thc) || 0), 0) / strainsList.length) : 0;
  document.getElementById('kpi-avg-thc').textContent = avgThc + '%';
  const typeCounts = strainsList.reduce((acc, x) => { acc[x.type] = (acc[x.type] || 0) + 1; return acc; }, {});
  const topType = Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0];
  document.getElementById('kpi-top-type').textContent = topType ? topType[0] : '—';

  // Chart defaults (dark theme)
  Chart.defaults.color = '#888';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

  // Chart 1 — Doughnut: Typ-Verteilung
  const typeLabels = ['Hybrid', 'Indica', 'Sativa', 'CBD'];
  const typeColors = ['#10b981', '#8b5cf6', '#f59e0b', '#3b82f6'];
  const chartTypesElement = document.getElementById('chart-types');
  if (chartTypesElement) {
    chartInstances.types = new Chart(chartTypesElement, {
      type: 'doughnut',
      data: {
        labels: typeLabels,
        datasets: [{
          data: typeLabels.map(t => typeCounts[t] || 0),
          backgroundColor: typeColors,
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#aaa', padding: 16, font: { size: 13 } } }
        },
        cutout: '65%'
      }
    });
  }

  // Chart 2 — Horizontal Bar: Top 10 THC
  const thcSorted = [...strainsList].sort((a,b) => (parseFloat(b.thc_content || b.thc)||0) - (parseFloat(a.thc_content || a.thc)||0)).slice(0,10);
  const chartThcElement = document.getElementById('chart-thc');
  if (chartThcElement) {
    chartInstances.thc = new Chart(chartThcElement, {
      type: 'bar',
      data: {
        labels: thcSorted.map(s => s.name),
        datasets: [{
          label: 'THC %',
          data: thcSorted.map(s => parseFloat(s.thc_content || s.thc) || 0),
          backgroundColor: 'rgba(16, 185, 129, 0.7)', // var(--accent) with opacity
          borderColor: '#10b981', // var(--accent)
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 40, ticks: { callback: v => v + '%' } },
          y: { ticks: { font: { size: 12 } } }
        }
      }
    });
  }

  // Chart 3 — Horizontal Bar: Top 10 Bewertungen
  const ratedSorted = [...strainsList].filter(s => s.rating > 0).sort((a,b) => b.rating - a.rating).slice(0,10);
  const chartRatingsElement = document.getElementById('chart-ratings');
  if (chartRatingsElement) {
    chartInstances.ratings = new Chart(chartRatingsElement, {
      type: 'bar',
      data: {
        labels: ratedSorted.map(s => s.name),
        datasets: [{
          label: 'Bewertung',
          data: ratedSorted.map(s => s.rating),
          backgroundColor: 'rgba(245, 158, 11, 0.7)', // var(--star) with opacity
          borderColor: '#f59e0b', // var(--star)
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 5, ticks: { callback: v => v + ' ★' } },
          y: { ticks: { font: { size: 12 } } }
        }
      }
    });
  }
}

// Toasts
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  gsap.fromTo(toast,
    { x: 100, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' }
  );

  setTimeout(() => {
    gsap.to(toast, {
      x: 100, opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: () => toast.remove()
    });
  }, 3000);
}

// Edit & Delete Handlers
function editStrain(strain) {
  if (!canEditStrain(strain)) {
    return showToast('You do not have permission to edit this strain', 'error');
  }
  document.getElementById('strain-id').value = strain.id;
  document.getElementById('name').value = strain.name || '';
  document.getElementById('medical_name').value = strain.medical_name || '';
  document.getElementById('type').value = strain.type || 'Indica';
  document.getElementById('thc').value = strain.thc_content || '';
  document.getElementById('cbd').value = strain.cbd_content || '';
  document.getElementById('effects').value = strain.effects || '';
  document.getElementById('flavor').value = strain.taste || '';
  document.getElementById('importer').value = strain.importer || '';
  document.getElementById('price').value = strain.price || '';
  document.getElementById('notes').value = strain.notes || '';

  const imgUrl = strain.image_url || '';
  document.getElementById('image_url').value = imgUrl;
  const imagePreview = document.getElementById('image_preview');
  if (imagePreview) {
    if (imgUrl) {
      imagePreview.innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      imagePreview.innerHTML = '<i data-lucide="image" style="color: var(--text-muted);"></i>';
      if (window.lucide) window.lucide.createIcons();
    }
  }

  document.getElementById('is_private').checked = strain.is_private || false;

  setRating(strain.rating || 0);

  const header = document.querySelector('#view-add .view-header h1');
  if (header) header.textContent = 'Edit Strain';

  // Custom select needs to be updated
  document.getElementById('type').dispatchEvent(new Event('change'));

  window.location.hash = '#add';
}

function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const msgEl = document.getElementById('confirm-modal-message');
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  const closeBtn = document.getElementById('confirm-modal-close');

  msgEl.textContent = message;

  // Clone to remove old event listeners
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  newConfirmBtn.addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });

  newCancelBtn.addEventListener('click', closeModal);
  newCloseBtn.addEventListener('click', closeModal);

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

async function deleteStrain(strain) {
  if (!canEditStrain(strain)) {
    return showToast('You do not have permission to delete this strain', 'error');
  }

  showConfirmModal(`Möchtest du "${strain.name}" wirklich löschen?`, async () => {
    try {
      const { error } = await supabase.from('strains').delete().eq('id', strain.id);
      if (error) throw error;

      strains = strains.filter(s => s.id !== strain.id);
      renderStrains();

      const userPanelModal = document.getElementById('user-panel-modal');
      if (userPanelModal && !userPanelModal.classList.contains('hidden')) {
        loadUserStrains();
      }

      const adminPanelModal = document.getElementById('admin-panel-modal');
      if (adminPanelModal && !adminPanelModal.classList.contains('hidden')) {
        loadAdminStrains();
      }

      showToast('Strain deleted', 'success');
    } catch (err) {
      showToast('Failed to delete: ' + err.message, 'error');
    }
  });
}

function resetAddForm() {
  const form = document.getElementById('add-strain-form');
  if (form) {
    form.reset();
    document.getElementById('strain-id').value = '';
    document.getElementById('is_private').checked = false;
    setRating(0);
    const header = document.querySelector('#view-add .view-header h1');
    if (header) header.textContent = 'Add New Strain';
    const btn = document.getElementById('save-strain-btn');
    if (btn) btn.textContent = 'Save Strain';

    // Clear image upload
    const imageUpload = document.getElementById('image_upload');
    if (imageUpload) imageUpload.value = '';
    const imagePreview = document.getElementById('image_preview');
    if (imagePreview) {
      imagePreview.innerHTML = '<i data-lucide="image" style="color: var(--text-muted);"></i>';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// Start
document.addEventListener('DOMContentLoaded', init);

// Custom Select Implementation
function setupCustomSelects() {
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    if (select.parentElement.classList.contains('custom-select-wrapper')) return;

    select.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const selected = document.createElement('div');
    selected.className = 'custom-select-trigger';
    const selectedOpt = select.options[select.selectedIndex];
    selected.innerHTML = `<span>${selectedOpt ? selectedOpt.text : ''}</span> <i data-lucide="chevron-down"></i>`;
    wrapper.appendChild(selected);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';

    Array.from(select.options).forEach(option => {
      const optDiv = document.createElement('div');
      optDiv.className = 'custom-select-option';
      if (option.selected) optDiv.classList.add('selected');
      optDiv.textContent = option.text;
      optDiv.dataset.value = option.value;

      optDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        select.value = option.value;
        selected.querySelector('span').textContent = option.text;

        optionsContainer.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
        optDiv.classList.add('selected');

        select.dispatchEvent(new Event('change'));
        wrapper.classList.remove('open');
      });
      optionsContainer.appendChild(optDiv);
    });

    wrapper.appendChild(optionsContainer);

    selected.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
        if (w !== wrapper) w.classList.remove('open');
      });
      wrapper.classList.toggle('open');
    });
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
    w.classList.remove('open');
  });
});

document.querySelectorAll('form').forEach(form => {
  form.addEventListener('reset', () => {
    setTimeout(() => {
      form.querySelectorAll('select').forEach(select => {
        const wrapper = select.parentElement;
        if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
          const selectedOpt = select.options[select.selectedIndex];
          wrapper.querySelector('.custom-select-trigger span').textContent = selectedOpt ? selectedOpt.text : '';
          wrapper.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === select.value);
          });
        }
      });
    }, 0);
  });
});

// ===== CUSTOM CURSOR =====
function initCursor() {
  const cursor = document.createElement('div');
  cursor.id = 'custom-cursor';
  cursor.innerHTML = `
    <svg class="cursor-arrow" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <!-- Glow-Layer (blur, semi-transparent) -->
      <path d="M4 2L4 18L8.5 13.5L11.5 20.5L14 19.5L11 12.5L17.5 12.5Z"
        fill="rgba(16,185,129,0.35)" stroke="none"/>
      <!-- Haupt-Pfeil: voll grün gefüllt + grüner Stroke -->
      <path d="M4 2L4 18L8.5 13.5L11.5 20.5L14 19.5L11 12.5L17.5 12.5Z"
        fill="#10b981" stroke="#10b981" stroke-width="0.8" stroke-linejoin="round"/>
    </svg>
    <svg class="cursor-icon" id="cursor-icon-svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
  `;
  document.body.appendChild(cursor);

  const iconSvg = document.getElementById('cursor-icon-svg');

  const ICONS = {
    edit: `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`,
    delete: `<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>`,
    text: `<line x1="12" y1="3" x2="12" y2="21" stroke-width="2"/><line x1="9" y1="3" x2="15" y2="3" stroke-width="2"/><line x1="9" y1="21" x2="15" y2="21" stroke-width="2"/>`,
    heart: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`
  };

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });

  function setCursorMode(mode, iconKey = null) {
    cursor.className = '';
    if (mode === 'text') {
      cursor.classList.add('mode-icon', 'mode-text');
      iconSvg.innerHTML = ICONS.text;
      iconSvg.style.marginTop = '12px';
      iconSvg.style.marginLeft = '12px';
    } else if (mode === 'icon' && iconKey) {
      iconSvg.style.marginTop = '12px';
      iconSvg.style.marginLeft = '12px';
      cursor.classList.add('mode-icon');
      iconSvg.innerHTML = ICONS[iconKey];
    } else if (mode === 'pointer') {
      cursor.classList.add('mode-pointer');
    }
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target;

    // Delete Button
    if (el.closest('.card-action-btn.delete')) {
      cursor.style.opacity = '1';
      setCursorMode('icon', 'delete');
      return;
    }

    // Edit Button
    if (el.closest('.card-action-btn')) {
      cursor.style.opacity = '1';
      setCursorMode('icon', 'edit');
      return;
    }

    // Favorite Button
    if (el.closest('.btn-favorite') || el.closest('#fav-filter-btn')) {
      cursor.style.opacity = '1';
      setCursorMode('icon', 'heart');
      return;
    }

    // Input / Textarea / Select → custom I-Beam
    if (el.closest('input, textarea, select')) {
      cursor.style.opacity = '1';
      setCursorMode('text');
      return;
    }

    cursor.style.opacity = '1';

    if (el.closest('button, a, [role="button"], .nav-item, .strain-card, .titlebar-button, .custom-select-trigger, .custom-select-option, .star-rating-input, .modal-close, .admin-tab-btn, #lightbox-close')) {
      setCursorMode('pointer');
      return;
    }

    setCursorMode('default');
  });

  document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { cursor.style.opacity = '1'; });

  document.addEventListener('mousedown', () => {
    cursor.style.transform = 'scale(0.85)';
  });
  document.addEventListener('mouseup', () => {
    cursor.style.transform = 'scale(1)';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCursor);
} else {
  initCursor();
}