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

// Initialize App
async function init() {
  lucide.createIcons();
  setupRouting();
  setupSidebar();
  setupStarRating();
  setupForms();
  setupSearchAndFilter();
  setupCustomSelects();
  
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
    updateAuthUI();
    
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
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
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.classList.add('hidden');
  });
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
    updateStatistics();
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

// Render Strains
function renderStrains() {
  const grid = document.getElementById('strain-grid');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input').value.toLowerCase();
  const typeFilter = document.getElementById('type-filter').value;
  
  grid.innerHTML = '';
  
  let filteredStrains = strains.filter(strain => {
    const matchesSearch = strain.name.toLowerCase().includes(searchInput) || 
                          (strain.medical_name && strain.medical_name.toLowerCase().includes(searchInput));
    const matchesType = typeFilter === 'all' || strain.type === typeFilter;
    return matchesSearch && matchesType;
  });

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
            ${canEditStrain(strain) ? `
            <div class="card-actions">
              <button class="card-action-btn edit" title="Edit">
                <i data-lucide="pencil"></i>
              </button>
              <button class="card-action-btn delete" title="Delete">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
            ` : ''}
          </div>
        </div>
      `;
      
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
  
  const typeClass = strain.type === 'Indica' ? 'type-indica' : 
                    strain.type === 'Sativa' ? 'type-sativa' : 'type-hybrid';
  
  const heroSrc = strain.image_url || placeholderImg;
  
  const effectsTags = strain.effects ? strain.effects.split(',').map(e => `<span class="modal-tag">${e.trim()}</span>`).join('') : '<span class="modal-tag">No effects listed</span>';
  const flavorTags = strain.taste ? strain.taste.split(',').map(f => `<span class="modal-tag">${f.trim()}</span>`).join('') : '<span class="modal-tag">No flavors listed</span>';

  body.innerHTML = `
    <div class="modal-hero">
      <img src="${heroSrc}" alt="${strain.name}" loading="lazy" onerror="this.src='${placeholderImg}'">
      <div class="modal-hero-gradient"></div>
    </div>
    <div class="modal-details">
      <div class="modal-type-badge ${typeClass}">${strain.type}</div>
      <h2 class="modal-title">${strain.name}</h2>
      <div class="modal-medical">${strain.medical_name || ''}</div>
      
      <div class="modal-stats-grid">
        <div class="modal-stat-box">
          <span class="label">Rating</span>
          <span class="value" style="font-size: 18px;">
            ${(strain.rating || 0).toFixed(1)} 
            <span style="display:flex; margin-left:6px; gap:2px;">
              ${[1,2,3,4,5].map(i => `<i data-lucide="star" style="width:14px; height:14px; ${i <= (strain.rating || 0) ? 'fill:var(--star); color:var(--star);' : 'color:var(--text-muted);'}"></i>`).join('')}
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
  
  modal.classList.remove('hidden');
  gsap.fromTo('.modal-content', 
    { y: 50, scale: 0.95, opacity: 0 },
    { y: 0, scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.5)' }
  );
}

function closeStrainModal() {
  const modal = document.getElementById('strain-modal');
  gsap.to('.modal-content', {
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
}

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
  document.getElementById('user-panel-btn')?.addEventListener('click', () => {
    document.getElementById('user-panel-modal').classList.remove('hidden');
    loadUserStrains();
  });
  
  document.getElementById('user-panel-close')?.addEventListener('click', () => {
    document.getElementById('user-panel-modal').classList.add('hidden');
  });

  // Admin Panel Handlers
  document.getElementById('admin-panel-btn')?.addEventListener('click', () => {
    document.getElementById('admin-panel-modal').classList.remove('hidden');
    loadAdminStrains();
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
            <span style="color:var(--text-muted); font-family: monospace;">ID: ${user.id.substring(0,8)}...</span>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <select class="user-role-select" style="background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-subtle); padding:6px 8px; border-radius:6px; font-size:13px; outline:none; cursor: pointer;">
            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="owner" ${user.role === 'owner' ? 'selected' : ''}>Owner</option>
          </select>
          <button class="btn btn-danger btn-icon del-user-btn" title="Delete User"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      
      const select = item.querySelector('.user-role-select');
      select.addEventListener('change', async (e) => {
        const newRole = e.target.value;
        try {
          const { error: updateErr } = await supabase.rpc('update_user_role', { target_user_id: user.id, new_role: newRole });
          if (updateErr) throw updateErr;
          showToast('Benutzerrolle aktualisiert!', 'success');
          loadAdminUsers();
        } catch(err) {
          showToast('Fehler: ' + err.message, 'error');
          e.target.value = user.role; // revert
        }
      });
      
      item.querySelector('.del-user-btn').addEventListener('click', () => {
        showConfirmModal(`Möchtest du den Benutzer "${user.email}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`, async () => {
          try {
            const { error: delErr } = await supabase.rpc('delete_user', { target_user_id: user.id });
            if (delErr) throw delErr;
            showToast('Benutzer gelöscht', 'success');
            loadAdminUsers(); // Refresh the list
          } catch(err) {
            showToast('Fehler beim Löschen: ' + err.message, 'error');
          }
        });
      });
      
      container.appendChild(item);
    });
    
    if (window.lucide) window.lucide.createIcons();
    
  } catch(err) {
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
  const stars = document.getElementById('star-rating-input').querySelectorAll('svg');
  stars.forEach((star, idx) => {
    if (idx < Math.floor(rating)) {
      star.classList.add('active');
    } else if (idx === Math.floor(rating) && rating % 1 !== 0) {
      // Handle half star visual if supported by SVG, or just full for now
      star.classList.add('active');
      star.style.clipPath = 'polygon(0 0, 50% 0, 50% 100%, 0% 100%)';
    } else {
      star.classList.remove('active');
      star.style.clipPath = 'none';
    }
  });
}

// Statistics
function updateStatistics() {
  if (!strains.length) return;
  
  const total = strains.length;
  const avgRating = strains.reduce((acc, s) => acc + s.rating, 0) / total;
  const avgThc = strains.reduce((acc, s) => acc + (s.thc_content || 0), 0) / total;
  
  gsap.to('#stat-total', { innerHTML: total, duration: 1.5, snap: { innerHTML: 1 }, ease: 'power2.out' });
  gsap.to('#stat-avg-rating', { innerHTML: avgRating.toFixed(1), duration: 1.5, snap: { innerHTML: 0.1 }, ease: 'power2.out' });
  gsap.to('#stat-avg-thc', { innerHTML: avgThc.toFixed(1), duration: 1.5, snap: { innerHTML: 0.1 }, ease: 'power2.out' });
  
  const indicaCount = strains.filter(s => s.type === 'Indica').length;
  const sativaCount = strains.filter(s => s.type === 'Sativa').length;
  const hybridCount = strains.filter(s => s.type === 'Hybrid').length;
  
  const iPct = (indicaCount / total) * 100;
  const sPct = (sativaCount / total) * 100;
  const hPct = (hybridCount / total) * 100;
  
  document.getElementById('dist-indica').style.width = `${iPct}%`;
  document.getElementById('dist-sativa').style.width = `${sPct}%`;
  document.getElementById('dist-hybrid').style.width = `${hPct}%`;
  
  gsap.to('#dist-indica-val', { innerHTML: Math.round(iPct), duration: 1, snap: { innerHTML: 1 } });
  gsap.to('#dist-sativa-val', { innerHTML: Math.round(sPct), duration: 1, snap: { innerHTML: 1 } });
  gsap.to('#dist-hybrid-val', { innerHTML: Math.round(hPct), duration: 1, snap: { innerHTML: 1 } });
  
  // Top Rated Strain
  const topStrain = [...strains].sort((a, b) => b.rating - a.rating)[0];
  if (topStrain) {
    const typeClass = topStrain.type === 'Indica' ? 'type-indica' : topStrain.type === 'Sativa' ? 'type-sativa' : 'type-hybrid';
    document.getElementById('top-strain-container').innerHTML = `
      <div style="display:flex; align-items:center; gap: 16px;">
        <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden;">
           <img src="${topStrain.image_url || 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?auto=format&fit=crop&w=400&q=80'}" style="width:100%; height:100%; object-fit:cover;">
        </div>
        <div>
          <div style="font-weight: 600; font-size: 18px;">${topStrain.name}</div>
          <div style="color: var(--text-secondary); font-size: 13px; margin-top:4px;">
            <span class="card-type-badge ${typeClass}" style="position:static; padding: 2px 8px;">${topStrain.type}</span>
            <span style="margin-left:8px; color:var(--star);"><i data-lucide="star" style="width:12px; height:12px; fill:var(--star)"></i> ${topStrain.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
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
