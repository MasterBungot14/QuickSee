/**
 * QuickSee - Application Controller & View Orchestrator
 */

import { storage } from './storage.js';
import { parseAnnouncement } from './parser.js';
import { checkDuplicate } from './duplicates.js';
import { getAllMilestones, generateMonthGrid, groupMilestonesByAgenda } from './calendar.js';
import { exportCryptoToCSV, exportGamesToCSV, validateAndMapCSV } from './csv.js';
import { SAMPLE_CRYPTO_PROJECTS, SAMPLE_GAMES } from './sampleData.js';
import {
  showToast,
  copyToClipboard,
  openModal,
  closeModal,
  showConfirmModal,
  escapeHtml,
  truncateAddress,
  renderContractChip,
  renderStatusBadge,
  renderTypeBadge,
  renderConfidenceBadge,
  formatPrice
} from './ui.js';

class QuickSeeApp {
  constructor() {
    this.currentView = 'dashboard';
    this.cryptoFilter = { search: '', type: 'all', status: 'all', network: 'all', sort: 'updated' };
    this.cryptoViewMode = 'table'; // 'table' or 'grid'
    
    this.gamesFilter = { search: '', status: 'all', network: 'all', sort: 'updated' };
    this.gamesViewMode = 'table'; // 'table' or 'grid'

    this.calYear = new Date().getFullYear();
    this.calMonth = new Date().getMonth();
    this.calViewMode = 'month'; // 'month' or 'agenda'
    this.calFilterType = 'all';

    this.currentParsedCandidate = null;
    this.currentDuplicateMatch = null;

    this.editingRecordId = null;
    this.editingRecordType = null;
  }

  init() {
    this.bindNavigation();
    this.bindHeaderActions();
    this.bindQuickPaste();
    this.bindCryptoView();
    this.bindGamesView();
    this.bindCalendarView();
    this.bindSettingsView();
    this.bindModals();

    // Auto-seed sample data on first visit if storage is empty
    const stats = storage.getStats();
    if (stats.totalRecords === 0) {
      SAMPLE_CRYPTO_PROJECTS.forEach(p => storage.addCryptoProject(p));
      SAMPLE_GAMES.forEach(g => storage.addGame(g));
    }

    // Subscribe to storage updates for automatic reactive re-renders
    storage.subscribe(() => {
      this.updateBadges();
      this.renderCurrentView();
    });

    this.updateBadges();
    this.navigate(storage.getSettings().defaultView || 'dashboard');
  }

  // --- Router & Navigation ---
  bindNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        if (targetView) {
          this.navigate(targetView);
          this.closeMobileSidebar();
        }
      });
    });

    // Mobile Hamburger
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (menuBtn && sidebar && backdrop) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        backdrop.classList.toggle('active');
      });
      backdrop.addEventListener('click', () => this.closeMobileSidebar());
    }
  }

  closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  navigate(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) targetSection.classList.add('active');

    const activeLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Update Header title
    const titleMap = {
      'dashboard': { title: 'Dashboard', sub: 'Overview of your Web3 portfolio and upcoming milestones' },
      'crypto': { title: 'Crypto Projects', sub: 'Airdrop claims, whitelist allocations, and token dates' },
      'games': { title: 'Web3 Games', sub: 'Gaming releases, alpha/beta phases, and game tokens' },
      'quick-paste': { title: 'Quick Paste Parser', sub: 'Paste announcements from X and automatically extract fields' },
      'calendar': { title: 'Milestones & Calendar', sub: 'Schedule of TGEs, claims, listings, and game releases' },
      'settings': { title: 'Settings & Data Portability', sub: 'Local storage status, CSV import/export, and backup' }
    };

    const header = titleMap[viewName] || { title: 'QuickSee', sub: 'Web3 Radar' };
    const pageHeading = document.getElementById('page-heading');
    const pageSubheading = document.getElementById('page-subheading');
    if (pageHeading) pageHeading.textContent = header.title;
    if (pageSubheading) pageSubheading.textContent = header.sub;

    window.scrollTo({ top: 0, behavior: 'instant' });
    this.renderCurrentView();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'crypto':
        this.renderCryptoProjects();
        break;
      case 'games':
        this.renderGames();
        break;
      case 'quick-paste':
        // Quick paste maintains form state
        break;
      case 'calendar':
        this.renderCalendar();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  }

  updateBadges() {
    const stats = storage.getStats();
    
    // Sidebar badges
    const badgeCrypto = document.getElementById('badge-crypto-count');
    const badgeGames = document.getElementById('badge-games-count');
    const badgeCalendar = document.getElementById('badge-calendar-count');
    const badgeOverdue = document.getElementById('badge-overdue-count');
    const storageSizeLabel = document.getElementById('sidebar-storage-size');

    if (badgeCrypto) badgeCrypto.textContent = stats.cryptoCount;
    if (badgeGames) badgeGames.textContent = stats.gamesCount;
    if (badgeCalendar) badgeCalendar.textContent = stats.upcomingCount;
    if (storageSizeLabel) storageSizeLabel.textContent = `${stats.storageSizeKB} KB used`;

    if (badgeOverdue) {
      if (stats.overdueCount > 0) {
        badgeOverdue.textContent = `${stats.overdueCount} overdue`;
        badgeOverdue.style.display = 'inline-block';
      } else {
        badgeOverdue.style.display = 'none';
      }
    }
  }

  // --- Global Top Header Actions ---
  bindHeaderActions() {
    const globalSearch = document.getElementById('global-search-input');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length > 0) {
          if (this.currentView !== 'crypto' && this.currentView !== 'games') {
            this.navigate('crypto');
          }
          if (this.currentView === 'crypto') {
            this.cryptoFilter.search = query;
            const filterInput = document.getElementById('crypto-search-input');
            if (filterInput) filterInput.value = query;
            this.renderCryptoProjects();
          } else if (this.currentView === 'games') {
            this.gamesFilter.search = query;
            const filterInput = document.getElementById('games-search-input');
            if (filterInput) filterInput.value = query;
            this.renderGames();
          }
        }
      });
    }

    // Top Header Buttons
    const btnQuickPaste = document.getElementById('header-btn-quick-paste');
    if (btnQuickPaste) {
      btnQuickPaste.addEventListener('click', () => this.navigate('quick-paste'));
    }

    const btnAddCrypto = document.getElementById('header-btn-add-crypto');
    if (btnAddCrypto) {
      btnAddCrypto.addEventListener('click', () => this.openAddModal('crypto'));
    }

    const btnAddGame = document.getElementById('header-btn-add-game');
    if (btnAddGame) {
      btnAddGame.addEventListener('click', () => this.openAddModal('game'));
    }
  }

  // ==========================================
  // VIEW 1: DASHBOARD
  // ==========================================
  renderDashboard() {
    const stats = storage.getStats();
    const settings = storage.getSettings();
    const cryptoProjects = storage.getCryptoProjects();
    const games = storage.getGames();
    const milestones = getAllMilestones(cryptoProjects, games);

    // Update Metric Cards
    const elTotal = document.getElementById('dash-stat-total');
    const elWhitelists = document.getElementById('dash-stat-whitelists');
    const elAirdrops = document.getElementById('dash-stat-airdrops');
    const elGames = document.getElementById('dash-stat-games');
    const elUpcoming = document.getElementById('dash-stat-upcoming');
    const elOverdue = document.getElementById('dash-stat-overdue');
    const elWindowSelect = document.getElementById('dash-window-select');

    if (elTotal) elTotal.textContent = stats.totalRecords;
    if (elWhitelists) elWhitelists.textContent = stats.whitelists;
    if (elAirdrops) elAirdrops.textContent = stats.airdrops;
    if (elGames) elGames.textContent = stats.gamesCount;
    if (elUpcoming) elUpcoming.textContent = stats.upcomingCount;
    if (elOverdue) elOverdue.textContent = stats.overdueCount;
    if (elWindowSelect) elWindowSelect.value = String(settings.milestoneWindowDays || 30);

    // In-App Reminder Alert Banner
    const reminderBanner = document.getElementById('dash-reminder-banner');
    const reminderCountEl = document.getElementById('dash-reminder-count');
    if (reminderBanner) {
      if (stats.overdueCount > 0) {
        reminderBanner.style.display = 'flex';
        if (reminderCountEl) reminderCountEl.textContent = stats.overdueCount;
      } else {
        reminderBanner.style.display = 'none';
      }
    }

    // Upcoming Milestones Radar (Next 5 items)
    const upcomingContainer = document.getElementById('dash-upcoming-list');
    if (upcomingContainer) {
      const futureMilestones = milestones.filter(m => !m.isOverdue).slice(0, 5);
      if (futureMilestones.length === 0) {
        upcomingContainer.innerHTML = `
          <div class="empty-state" style="padding:28px 16px;">
            <p>No upcoming dates recorded in the selected window.</p>
          </div>
        `;
      } else {
        upcomingContainer.innerHTML = futureMilestones.map(m => `
          <div class="agenda-item" style="padding:12px 16px;cursor:pointer;" onclick="window.QuickSeeApp.openDetailDrawer('${m.recordId}', '${m.category}')">
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="badge ${m.category === 'crypto' ? (m.subType === 'Whitelist' ? 'badge-whitelist' : 'badge-airdrop') : 'badge-game'}">${escapeHtml(m.subType)}</span>
              <div>
                <div style="font-weight:600;color:var(--text-primary);font-size:0.92rem;">${escapeHtml(m.recordName)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(m.milestoneType)} • <span style="font-family:var(--font-mono);">${m.date}</span></div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${renderConfidenceBadge(m.dateConfidence)}
              <span class="badge" style="background:var(--mint-dim);color:var(--mint-primary);font-family:var(--font-mono);">${escapeHtml(m.relativeLabel)}</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Status Distribution Widget
    const statusContainer = document.getElementById('dash-status-breakdown');
    if (statusContainer) {
      const allRecords = [...cryptoProjects, ...games];
      const statusCounts = {};
      allRecords.forEach(r => {
        const s = r.status || 'Joined';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      const total = allRecords.length || 1;
      const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

      if (sortedStatuses.length === 0) {
        statusContainer.innerHTML = `<p style="padding:20px;text-align:center;">No records saved yet.</p>`;
      } else {
        statusContainer.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${sortedStatuses.map(([status, count]) => {
              const pct = Math.round((count / total) * 100);
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
                    <span style="font-weight:600;color:var(--text-secondary);">${escapeHtml(status)}</span>
                    <span style="color:var(--text-muted);font-family:var(--font-mono);">${count} (${pct}%)</span>
                  </div>
                  <div style="height:6px;background:var(--surface-elevated);border-radius:var(--radius-full);overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, var(--mint-primary), var(--cyan-accent));border-radius:var(--radius-full);"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    // Recently Added / Updated Records
    const recentContainer = document.getElementById('dash-recent-records');
    if (recentContainer) {
      const combined = [
        ...cryptoProjects.map(p => ({ ...p, _category: 'crypto' })),
        ...games.map(g => ({ ...g, _category: 'game' }))
      ];
      combined.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      const recent = combined.slice(0, 6);

      if (recent.length === 0) {
        recentContainer.innerHTML = `
          <div class="empty-state">
            <p>No records found. Click below to add your first project or game!</p>
            <button class="btn btn-primary" onclick="window.QuickSeeApp.navigate('quick-paste')">Try Quick Paste</button>
          </div>
        `;
      } else {
        recentContainer.innerHTML = `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Category</th>
                  <th>Network</th>
                  <th>Contract Address</th>
                  <th>Status</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${recent.map(r => `
                  <tr>
                    <td>
                      <div class="record-name-cell">
                        <span class="record-title" style="cursor:pointer;" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', '${r._category}')">
                          ${escapeHtml(r.name)}
                          ${r.tokenSymbol ? `<span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">(${escapeHtml(r.tokenSymbol)})</span>` : ''}
                        </span>
                      </div>
                    </td>
                    <td>${renderTypeBadge(r.type || 'Game')}</td>
                    <td><span class="network-tag">${escapeHtml(r.network || 'Unknown')}</span></td>
                    <td>${renderContractChip(r.contractAddress, r.network)}</td>
                    <td>${renderStatusBadge(r.status)}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-icon" title="View Details" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', '${r._category}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    }

    // Dashboard Quick Action buttons
    const btnDashPaste = document.getElementById('dash-btn-paste');
    if (btnDashPaste) btnDashPaste.onclick = () => this.navigate('quick-paste');

    const btnDashCrypto = document.getElementById('dash-btn-add-crypto');
    if (btnDashCrypto) btnDashCrypto.onclick = () => this.openAddModal('crypto');

    const btnDashGame = document.getElementById('dash-btn-add-game');
    if (btnDashGame) btnDashGame.onclick = () => this.openAddModal('game');

    const windowSelect = document.getElementById('dash-window-select');
    if (windowSelect) {
      windowSelect.onchange = (e) => {
        storage.updateSettings({ milestoneWindowDays: Number(e.target.value) });
        this.renderDashboard();
      };
    }
  }

  // ==========================================
  // VIEW 2: CRYPTO PROJECTS
  // ==========================================
  bindCryptoView() {
    const searchInput = document.getElementById('crypto-search-input');
    const typeFilter = document.getElementById('crypto-type-filter');
    const statusFilter = document.getElementById('crypto-status-filter');
    const networkFilter = document.getElementById('crypto-network-filter');
    const sortSelect = document.getElementById('crypto-sort-select');
    const btnReset = document.getElementById('crypto-btn-reset');
    const btnAdd = document.getElementById('crypto-btn-add');
    const btnTableView = document.getElementById('crypto-btn-table-view');
    const btnGridView = document.getElementById('crypto-btn-grid-view');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.cryptoFilter.search = e.target.value.trim();
        this.renderCryptoProjects();
      });
    }
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.cryptoFilter.type = e.target.value;
        this.renderCryptoProjects();
      });
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.cryptoFilter.status = e.target.value;
        this.renderCryptoProjects();
      });
    }
    if (networkFilter) {
      networkFilter.addEventListener('change', (e) => {
        this.cryptoFilter.network = e.target.value;
        this.renderCryptoProjects();
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.cryptoFilter.sort = e.target.value;
        this.renderCryptoProjects();
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.cryptoFilter = { search: '', type: 'all', status: 'all', network: 'all', sort: 'updated' };
        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (networkFilter) networkFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'updated';
        this.renderCryptoProjects();
      });
    }
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openAddModal('crypto'));
    }
    if (btnTableView && btnGridView) {
      btnTableView.addEventListener('click', () => {
        this.cryptoViewMode = 'table';
        btnTableView.classList.add('active');
        btnGridView.classList.remove('active');
        this.renderCryptoProjects();
      });
      btnGridView.addEventListener('click', () => {
        this.cryptoViewMode = 'grid';
        btnGridView.classList.add('active');
        btnTableView.classList.remove('active');
        this.renderCryptoProjects();
      });
    }
  }

  renderCryptoProjects() {
    const container = document.getElementById('crypto-records-container');
    const countBadge = document.getElementById('crypto-total-badge');
    if (!container) return;

    let records = storage.getCryptoProjects();
    
    // Populate Network Filter dynamically with existing networks
    const networkSelect = document.getElementById('crypto-network-filter');
    if (networkSelect) {
      const currentVal = networkSelect.value;
      const networks = Array.from(new Set(records.map(r => r.network).filter(Boolean))).sort();
      networkSelect.innerHTML = `<option value="all">All Networks</option>` + 
        networks.map(n => `<option value="${escapeHtml(n)}"${n === currentVal ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
    }

    // Apply Filters
    const { search, type, status, network, sort } = this.cryptoFilter;

    if (search) {
      const q = search.toLowerCase();
      records = records.filter(r => 
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.tokenSymbol && r.tokenSymbol.toLowerCase().includes(q)) ||
        (r.network && r.network.toLowerCase().includes(q)) ||
        (r.contractAddress && r.contractAddress.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    if (type !== 'all') {
      records = records.filter(r => r.type === type);
    }

    if (status !== 'all') {
      records = records.filter(r => r.status === status);
    }

    if (network !== 'all') {
      records = records.filter(r => r.network === network);
    }

    // Apply Sorting
    records.sort((a, b) => {
      switch (sort) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'release':
          return (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'created':
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        case 'updated':
        default:
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }
    });

    if (countBadge) countBadge.textContent = `${records.length} projects`;

    if (records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
          </div>
          <h3>No crypto projects found</h3>
          <p>No records matched your search filters, or no crypto projects have been added yet.</p>
          <div style="display:flex;gap:12px;margin-top:8px;">
            <button class="btn btn-primary" onclick="window.QuickSeeApp.openAddModal('crypto')">+ Add Project</button>
            <button class="btn btn-secondary" onclick="window.QuickSeeApp.navigate('quick-paste')">Quick Paste</button>
          </div>
        </div>
      `;
      return;
    }

    if (this.cryptoViewMode === 'table') {
      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project / Token</th>
                <th>Type</th>
                <th>Network</th>
                <th>Contract (CA)</th>
                <th>Key Dates</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => {
                const datesSnippet = [];
                if (r.releaseDate) datesSnippet.push(`TGE: ${r.releaseDate}`);
                if (r.claimDate) datesSnippet.push(`Claim: ${r.claimDate}`);
                if (r.listingDate) datesSnippet.push(`List: ${r.listingDate}`);

                return `
                  <tr>
                    <td>
                      <div class="record-name-cell">
                        <span class="record-title" style="cursor:pointer;" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', 'crypto')">
                          ${escapeHtml(r.name)}
                          ${r.xPostLink ? `<a href="${escapeHtml(r.xPostLink)}" target="_blank" rel="noopener noreferrer" title="Open X post" onclick="event.stopPropagation();"><svg style="width:13px;height:13px;vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>` : ''}
                        </span>
                        <span class="record-subtitle font-mono">${escapeHtml(r.tokenSymbol || 'No token symbol')}</span>
                      </div>
                    </td>
                    <td>${renderTypeBadge(r.type)}</td>
                    <td><span class="network-tag">${escapeHtml(r.network || 'Unknown')}</span></td>
                    <td>${renderContractChip(r.contractAddress, r.network)}</td>
                    <td>
                      <div style="font-size:0.78rem;display:flex;flex-direction:column;gap:2px;">
                        ${datesSnippet.length > 0 
                          ? `<span style="font-family:var(--font-mono);">${datesSnippet.join(' • ')}</span>${renderConfidenceBadge(r.dateConfidence)}`
                          : '<span style="color:var(--text-muted);">-</span>'}
                      </div>
                    </td>
                    <td>${renderStatusBadge(r.status)}</td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-icon" title="View details" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', 'crypto')">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <button class="btn btn-icon" title="Edit project" onclick="window.QuickSeeApp.openEditModal('${r.id}', 'crypto')">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn btn-icon" title="Delete project" onclick="window.QuickSeeApp.deleteRecordConfirm('${r.id}', 'crypto', '${escapeHtml(r.name)}')">
                          <svg viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Grid Card View
      container.innerHTML = `
        <div class="records-grid">
          ${records.map(r => `
            <div class="record-card">
              <div class="record-card-header">
                <div>
                  <h4 style="font-size:1.05rem;cursor:pointer;" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', 'crypto')">${escapeHtml(r.name)}</h4>
                  <span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(r.tokenSymbol || 'No symbol')}</span>
                </div>
                ${renderTypeBadge(r.type)}
              </div>

              <div class="record-card-meta">
                <div class="meta-field">
                  <span class="meta-label">Network</span>
                  <span class="meta-val">${escapeHtml(r.network || 'Unknown')}</span>
                </div>
                <div class="meta-field">
                  <span class="meta-label">Status</span>
                  <div>${renderStatusBadge(r.status)}</div>
                </div>
                <div class="meta-field" style="grid-column:span 2;">
                  <span class="meta-label">Contract Address</span>
                  <div style="margin-top:2px;">${renderContractChip(r.contractAddress, r.network)}</div>
                </div>
                ${r.releaseDate ? `
                  <div class="meta-field">
                    <span class="meta-label">Release/TGE</span>
                    <span class="meta-val font-mono">${r.releaseDate}</span>
                  </div>
                ` : ''}
                ${r.claimDate ? `
                  <div class="meta-field">
                    <span class="meta-label">Claim Date</span>
                    <span class="meta-val font-mono">${r.claimDate}</span>
                  </div>
                ` : ''}
              </div>

              <div class="record-card-footer">
                <div style="display:flex;align-items:center;gap:6px;">
                  ${renderConfidenceBadge(r.dateConfidence)}
                </div>
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-sm btn-secondary" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', 'crypto')">Details</button>
                  <button class="btn btn-sm btn-secondary" onclick="window.QuickSeeApp.openEditModal('${r.id}', 'crypto')">Edit</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // ==========================================
  // VIEW 3: GAMES
  // ==========================================
  bindGamesView() {
    const searchInput = document.getElementById('games-search-input');
    const statusFilter = document.getElementById('games-status-filter');
    const networkFilter = document.getElementById('games-network-filter');
    const sortSelect = document.getElementById('games-sort-select');
    const btnReset = document.getElementById('games-btn-reset');
    const btnAdd = document.getElementById('games-btn-add');
    const btnTableView = document.getElementById('games-btn-table-view');
    const btnGridView = document.getElementById('games-btn-grid-view');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.gamesFilter.search = e.target.value.trim();
        this.renderGames();
      });
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.gamesFilter.status = e.target.value;
        this.renderGames();
      });
    }
    if (networkFilter) {
      networkFilter.addEventListener('change', (e) => {
        this.gamesFilter.network = e.target.value;
        this.renderGames();
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.gamesFilter.sort = e.target.value;
        this.renderGames();
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.gamesFilter = { search: '', status: 'all', network: 'all', sort: 'updated' };
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';
        if (networkFilter) networkFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'updated';
        this.renderGames();
      });
    }
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openAddModal('game'));
    }
    if (btnTableView && btnGridView) {
      btnTableView.addEventListener('click', () => {
        this.gamesViewMode = 'table';
        btnTableView.classList.add('active');
        btnGridView.classList.remove('active');
        this.renderGames();
      });
      btnGridView.addEventListener('click', () => {
        this.gamesViewMode = 'grid';
        btnGridView.classList.add('active');
        btnTableView.classList.remove('active');
        this.renderGames();
      });
    }
  }

  renderGames() {
    const container = document.getElementById('games-records-container');
    const countBadge = document.getElementById('games-total-badge');
    if (!container) return;

    let records = storage.getGames();

    // Populate Game Network Filter
    const networkSelect = document.getElementById('games-network-filter');
    if (networkSelect) {
      const currentVal = networkSelect.value;
      const networks = Array.from(new Set(records.map(r => r.network).filter(Boolean))).sort();
      networkSelect.innerHTML = `<option value="all">All Networks</option>` + 
        networks.map(n => `<option value="${escapeHtml(n)}"${n === currentVal ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
    }

    // Filters
    const { search, status, network, sort } = this.gamesFilter;

    if (search) {
      const q = search.toLowerCase();
      records = records.filter(r => 
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.tokenSymbol && r.tokenSymbol.toLowerCase().includes(q)) ||
        (r.network && r.network.toLowerCase().includes(q)) ||
        (r.contractAddress && r.contractAddress.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    if (status !== 'all') {
      records = records.filter(r => r.status === status);
    }

    if (network !== 'all') {
      records = records.filter(r => r.network === network);
    }

    // Sort
    records.sort((a, b) => {
      switch (sort) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'release':
          return (a.gameReleaseDate || '9999').localeCompare(b.gameReleaseDate || '9999');
        case 'price':
          return (b.tokenPrice || 0) - (a.tokenPrice || 0);
        case 'created':
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        case 'updated':
        default:
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }
    });

    if (countBadge) countBadge.textContent = `${records.length} games`;

    if (records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="6" cy="12" r="1"></circle><circle cx="18" cy="12" r="1"></circle><line x1="10" y1="12" x2="14" y2="12"></line><line x1="12" y1="10" x2="12" y2="14"></line></svg>
          </div>
          <h3>No Web3 games found</h3>
          <p>No games matched your filters, or none have been added yet.</p>
          <button class="btn btn-primary" onclick="window.QuickSeeApp.openAddModal('game')">+ Add Game</button>
        </div>
      `;
      return;
    }

    if (this.gamesViewMode === 'table') {
      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Game Name</th>
                <th>Network</th>
                <th>Token & Price</th>
                <th>Contract Address</th>
                <th>Release Dates</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td>
                    <div class="record-name-cell">
                      <span class="record-title" style="cursor:pointer;" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', 'game')">
                        ${escapeHtml(r.name)}
                        ${r.officialLink ? `<a href="${escapeHtml(r.officialLink)}" target="_blank" rel="noopener noreferrer" title="Official site" onclick="event.stopPropagation();"><svg style="width:13px;height:13px;vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>` : ''}
                      </span>
                    </div>
                  </td>
                  <td><span class="network-tag">${escapeHtml(r.network || 'Unknown')}</span></td>
                  <td>
                    <div style="font-size:0.84rem;display:flex;align-items:center;gap:6px;">
                      <span class="font-mono" style="font-weight:600;">${escapeHtml(r.tokenSymbol || '-')}</span>
                      ${formatPrice(r.tokenPrice)}
                    </div>
                  </td>
                  <td>${renderContractChip(r.contractAddress, r.network)}</td>
                  <td>
                    <div style="font-size:0.78rem;display:flex;flex-direction:column;gap:2px;">
                      ${r.gameReleaseDate ? `<span class="font-mono">Game: ${r.gameReleaseDate}</span>` : ''}
                      ${r.tokenReleaseDate ? `<span class="font-mono">Token: ${r.tokenReleaseDate}</span>` : ''}
                      ${!r.gameReleaseDate && !r.tokenReleaseDate ? '<span style="color:var(--text-muted);">-</span>' : renderConfidenceBadge(r.dateConfidence)}
                    </div>
                  </td>
                  <td>${renderStatusBadge(r.status)}</td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button class="btn btn-icon" title="View details" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', 'game')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </button>
                      <button class="btn btn-icon" title="Edit game" onclick="window.QuickSeeApp.openEditModal('${r.id}', 'game')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button class="btn btn-icon" title="Delete game" onclick="window.QuickSeeApp.deleteRecordConfirm('${r.id}', 'game', '${escapeHtml(r.name)}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Grid Card View
      container.innerHTML = `
        <div class="records-grid">
          ${records.map(r => `
            <div class="record-card">
              <div class="record-card-header">
                <div>
                  <h4 style="font-size:1.05rem;cursor:pointer;" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', 'game')">${escapeHtml(r.name)}</h4>
                  <span class="network-tag" style="margin-top:4px;">${escapeHtml(r.network || 'Unknown')}</span>
                </div>
                ${renderStatusBadge(r.status)}
              </div>

              <div class="record-card-meta">
                <div class="meta-field">
                  <span class="meta-label">Token & Price</span>
                  <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                    <span class="font-mono">${escapeHtml(r.tokenSymbol || '-')}</span>
                    ${formatPrice(r.tokenPrice)}
                  </div>
                </div>
                <div class="meta-field">
                  <span class="meta-label">Game Release</span>
                  <span class="meta-val font-mono">${r.gameReleaseDate || '-'}</span>
                </div>
                <div class="meta-field" style="grid-column:span 2;">
                  <span class="meta-label">Contract Address</span>
                  <div style="margin-top:2px;">${renderContractChip(r.contractAddress, r.network)}</div>
                </div>
              </div>

              <div class="record-card-footer">
                <div>${renderConfidenceBadge(r.dateConfidence)}</div>
                <div style="display:flex;gap:6px;">
                  <button class="btn btn-sm btn-secondary" onclick="window.QuickSeeApp.openDetailDrawer('${r.id}', 'game')">Details</button>
                  <button class="btn btn-sm btn-secondary" onclick="window.QuickSeeApp.openEditModal('${r.id}', 'game')">Edit</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // ==========================================
  // VIEW 4: QUICK PASTE PARSER
  // ==========================================
  bindQuickPaste() {
    const textarea = document.getElementById('paste-text-input');
    const urlInput = document.getElementById('paste-url-input');
    const btnParse = document.getElementById('paste-btn-parse');
    const btnLoadCryptoSample = document.getElementById('paste-btn-sample-crypto');
    const btnLoadGameSample = document.getElementById('paste-btn-sample-game');
    const btnClear = document.getElementById('paste-btn-clear');
    const btnSaveParsed = document.getElementById('paste-btn-save');

    if (btnLoadCryptoSample && textarea) {
      btnLoadCryptoSample.addEventListener('click', () => {
        textarea.value = `🚀 Monad Public Testnet & Community Airdrop Announced!\n\nWe are excited to launch the official Monad Devnet and Testnet phase. $MON token ticker confirmed for Q4 2026.\n\nContract Address (CA): 0x0000000000000000000000000000000000001010 on Monad network.\n\nSnapshot for Season 1 participants will be taken on Oct 25, with expected TGE on 2026-11-20 and Claim opening Nov 22.\n\nAll verified Discord testers and faucet users are eligible. Official post: https://x.com/monad_xyz/status/1789012345678901234`;
        if (urlInput) urlInput.value = 'https://x.com/monad_xyz/status/1789012345678901234';
        const radio = document.querySelector('input[name="paste-record-type"][value="crypto"]');
        if (radio) radio.checked = true;
        this.runQuickParse();
      });
    }

    if (btnLoadGameSample && textarea) {
      btnLoadGameSample.addEventListener('click', () => {
        textarea.value = `🎮 Off The Grid Early Access Alpha Launching on Avalanche!\n\nGunzilla Games is bringing AAA cyberpunk battle royale to PC and PS5. Token $GUN launching alongside mainnet deployment.\n\nPresale Price: $0.75 USD.\nGame Launch Date: 2026-10-08\nToken TGE: Nov 15, 2026 (Confirmed).\n\nOfficial website: https://gunzillagames.com/en/games/otg`;
        if (urlInput) urlInput.value = 'https://gunzillagames.com/en/games/otg';
        const radio = document.querySelector('input[name="paste-record-type"][value="game"]');
        if (radio) radio.checked = true;
        this.runQuickParse();
      });
    }

    if (btnClear && textarea) {
      btnClear.addEventListener('click', () => {
        textarea.value = '';
        if (urlInput) urlInput.value = '';
        const previewPanel = document.getElementById('paste-review-container');
        if (previewPanel) previewPanel.style.display = 'none';
        this.currentParsedCandidate = null;
        this.currentDuplicateMatch = null;
      });
    }

    if (btnParse) {
      btnParse.addEventListener('click', () => this.runQuickParse());
    }

    if (btnSaveParsed) {
      btnSaveParsed.addEventListener('click', () => this.saveParsedRecord());
    }
  }

  runQuickParse() {
    const text = (document.getElementById('paste-text-input')?.value || '').trim();
    const url = (document.getElementById('paste-url-input')?.value || '').trim();
    const targetType = document.querySelector('input[name="paste-record-type"]:checked')?.value || 'crypto';
    const previewContainer = document.getElementById('paste-review-container');

    if (!text && !url) {
      showToast('Please paste announcement text or enter a URL to parse.', 'warning');
      return;
    }

    const { candidate, confidence, extractedCount, missingFields } = parseAnnouncement(text, targetType, url);
    this.currentParsedCandidate = candidate;

    // Check Duplicate
    const existingRecords = targetType === 'crypto' ? storage.getCryptoProjects() : storage.getGames();
    const dupCheck = checkDuplicate(candidate, existingRecords, targetType);
    this.currentDuplicateMatch = dupCheck.isDuplicate ? dupCheck : null;

    if (previewContainer) {
      previewContainer.style.display = 'block';
      this.renderQuickParseForm(candidate, targetType, confidence, extractedCount, dupCheck);
      previewContainer.scrollIntoView({ behavior: 'smooth' });
    }
  }

  renderQuickParseForm(candidate, targetType, confidence, extractedCount, dupCheck) {
    const headerEl = document.getElementById('paste-confidence-indicator');
    const dupAlertEl = document.getElementById('paste-duplicate-alert');
    const formFieldsEl = document.getElementById('paste-parsed-fields');

    // Confidence badge
    if (headerEl) {
      const confClass = confidence >= 70 ? 'high' : confidence >= 40 ? 'medium' : 'empty';
      headerEl.className = `confidence-indicator ${confClass}`;
      headerEl.innerHTML = `
        <span class="badge-dot"></span>
        <span>Detected ${extractedCount} fields (${confidence}% Confidence)</span>
      `;
    }

    // Duplicate Alert Banner
    if (dupAlertEl) {
      if (dupCheck.isDuplicate) {
        dupAlertEl.style.display = 'flex';
        dupAlertEl.innerHTML = `
          <div class="duplicate-alert-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <span>Duplicate Record Detected (${dupCheck.severity === 'hard' ? 'High Match' : 'Possible Match'})</span>
          </div>
          <div class="duplicate-alert-body">${escapeHtml(dupCheck.reason)}</div>
          <div class="duplicate-actions">
            <button class="btn btn-sm btn-secondary" onclick="window.QuickSeeApp.openDetailDrawer('${dupCheck.matchedRecord.id}', '${targetType}')">View Existing Record</button>
            <button class="btn btn-sm btn-outline-mint" onclick="document.getElementById('paste-duplicate-alert').style.display='none'">Ignore & Save Anyway</button>
          </div>
        `;
      } else {
        dupAlertEl.style.display = 'none';
      }
    }

    // Form fields based on candidate type
    if (formFieldsEl) {
      if (targetType === 'crypto') {
        formFieldsEl.innerHTML = `
          <div class="form-grid">
            <div class="form-group col-span-2">
              <label class="form-label">Project Name <span class="required">*</span> ${candidate.extractedFlags.name ? '<span class="field-badge extracted">Extracted</span>' : '<span class="field-badge missing">Manual</span>'}</label>
              <input type="text" id="parsed-name" class="form-control" value="${escapeHtml(candidate.name)}" placeholder="e.g. Monad Network" required />
            </div>

            <div class="form-group">
              <label class="form-label">Record Type <span class="required">*</span> ${candidate.extractedFlags.type ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <select id="parsed-crypto-type" class="form-control">
                <option value="Airdrop"${candidate.type === 'Airdrop' ? ' selected' : ''}>Airdrop</option>
                <option value="Whitelist"${candidate.type === 'Whitelist' ? ' selected' : ''}>Whitelist</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Network ${candidate.extractedFlags.network ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="text" id="parsed-network" class="form-control" value="${escapeHtml(candidate.network)}" placeholder="e.g. Ethereum, Solana, Base, Monad" />
            </div>

            <div class="form-group">
              <label class="form-label">Token Symbol ${candidate.extractedFlags.tokenSymbol ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="text" id="parsed-token-symbol" class="form-control font-mono" value="${escapeHtml(candidate.tokenSymbol)}" placeholder="$TOKEN" />
            </div>

            <div class="form-group">
              <label class="form-label">Contract Address (CA) ${candidate.extractedFlags.contractAddress ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="text" id="parsed-contract" class="form-control font-mono" value="${escapeHtml(candidate.contractAddress)}" placeholder="0x... or Solana Base58" />
            </div>

            <div class="form-group">
              <label class="form-label">Release / TGE Date ${candidate.extractedFlags.releaseDate ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="date" id="parsed-release-date" class="form-control font-mono" value="${candidate.releaseDate || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Claim Date ${candidate.extractedFlags.claimDate ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="date" id="parsed-claim-date" class="form-control font-mono" value="${candidate.claimDate || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Listing Date ${candidate.extractedFlags.listingDate ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="date" id="parsed-listing-date" class="form-control font-mono" value="${candidate.listingDate || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Date Confidence</label>
              <select id="parsed-confidence" class="form-control">
                <option value="Estimated"${candidate.dateConfidence === 'Estimated' ? ' selected' : ''}>Estimated</option>
                <option value="Confirmed"${candidate.dateConfidence === 'Confirmed' ? ' selected' : ''}>Confirmed</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Status</label>
              <select id="parsed-status" class="form-control">
                <option value="Joined">Joined</option>
                <option value="Eligible">Eligible</option>
                <option value="Researching">Researching</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Claimable">Claimable</option>
                <option value="Listed">Listed</option>
                <option value="Completed">Completed</option>
                <option value="Paused">Paused</option>
                <option value="Dropped">Dropped</option>
                <option value="Not Eligible">Not Eligible</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">X / Post URL ${candidate.extractedFlags.xPostLink ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="url" id="parsed-x-link" class="form-control" value="${escapeHtml(candidate.xPostLink)}" placeholder="https://x.com/..." />
            </div>

            <div class="form-group col-span-2">
              <label class="form-label">Notes & Summary</label>
              <textarea id="parsed-notes" class="form-control" rows="3">${escapeHtml(candidate.notes)}</textarea>
            </div>
          </div>
        `;
      } else {
        // Game fields
        formFieldsEl.innerHTML = `
          <div class="form-grid">
            <div class="form-group col-span-2">
              <label class="form-label">Game Name <span class="required">*</span> ${candidate.extractedFlags.name ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="text" id="parsed-name" class="form-control" value="${escapeHtml(candidate.name)}" placeholder="e.g. Off The Grid" required />
            </div>

            <div class="form-group">
              <label class="form-label">Network ${candidate.extractedFlags.network ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="text" id="parsed-network" class="form-control" value="${escapeHtml(candidate.network)}" placeholder="e.g. Avalanche, Immutable X" />
            </div>

            <div class="form-group">
              <label class="form-label">Official Link ${candidate.extractedFlags.officialLink ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="url" id="parsed-official-link" class="form-control" value="${escapeHtml(candidate.officialLink)}" placeholder="https://..." />
            </div>

            <div class="form-group">
              <label class="form-label">Token Symbol ${candidate.extractedFlags.tokenSymbol ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="text" id="parsed-token-symbol" class="form-control font-mono" value="${escapeHtml(candidate.tokenSymbol)}" placeholder="$TOKEN" />
            </div>

            <div class="form-group">
              <label class="form-label">Token Price (USD) ${candidate.extractedFlags.tokenPrice ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="number" step="0.0001" id="parsed-token-price" class="form-control font-mono" value="${candidate.tokenPrice !== null ? candidate.tokenPrice : ''}" placeholder="0.50" />
            </div>

            <div class="form-group col-span-2">
              <label class="form-label">Contract Address (CA) ${candidate.extractedFlags.contractAddress ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="text" id="parsed-contract" class="form-control font-mono" value="${escapeHtml(candidate.contractAddress)}" placeholder="0x..." />
            </div>

            <div class="form-group">
              <label class="form-label">Game Release Date ${candidate.extractedFlags.gameReleaseDate ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="date" id="parsed-game-release" class="form-control font-mono" value="${candidate.gameReleaseDate || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Token Release Date ${candidate.extractedFlags.tokenReleaseDate ? '<span class="field-badge extracted">Extracted</span>' : ''}</label>
              <input type="date" id="parsed-token-release" class="form-control font-mono" value="${candidate.tokenReleaseDate || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label">Status</label>
              <select id="parsed-status" class="form-control">
                <option value="Researching">Researching</option>
                <option value="Joined">Joined</option>
                <option value="Playing">Playing</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Live">Live</option>
                <option value="Token Upcoming">Token Upcoming</option>
                <option value="Completed">Completed</option>
                <option value="Paused">Paused</option>
                <option value="Dropped">Dropped</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Date Confidence</label>
              <select id="parsed-confidence" class="form-control">
                <option value="Estimated"${candidate.dateConfidence === 'Estimated' ? ' selected' : ''}>Estimated</option>
                <option value="Confirmed"${candidate.dateConfidence === 'Confirmed' ? ' selected' : ''}>Confirmed</option>
              </select>
            </div>

            <div class="form-group col-span-2">
              <label class="form-label">Notes & Summary</label>
              <textarea id="parsed-notes" class="form-control" rows="3">${escapeHtml(candidate.notes)}</textarea>
            </div>
          </div>
        `;
      }
    }
  }

  saveParsedRecord() {
    const targetType = document.querySelector('input[name="paste-record-type"]:checked')?.value || 'crypto';
    const name = (document.getElementById('parsed-name')?.value || '').trim();

    if (!name) {
      showToast('Project name is required before saving.', 'error');
      return;
    }

    if (targetType === 'crypto') {
      const newCrypto = {
        name,
        type: document.getElementById('parsed-crypto-type')?.value || 'Airdrop',
        network: (document.getElementById('parsed-network')?.value || '').trim(),
        tokenSymbol: (document.getElementById('parsed-token-symbol')?.value || '').trim(),
        contractAddress: (document.getElementById('parsed-contract')?.value || '').trim(),
        releaseDate: document.getElementById('parsed-release-date')?.value || '',
        claimDate: document.getElementById('parsed-claim-date')?.value || '',
        listingDate: document.getElementById('parsed-listing-date')?.value || '',
        dateConfidence: document.getElementById('parsed-confidence')?.value || 'Estimated',
        status: document.getElementById('parsed-status')?.value || 'Joined',
        xPostLink: (document.getElementById('parsed-x-link')?.value || '').trim(),
        notes: (document.getElementById('parsed-notes')?.value || '').trim()
      };

      const saved = storage.addCryptoProject(newCrypto);
      showToast(`Saved "${saved.name}" to Crypto Projects!`, 'success');
      this.navigate('crypto');
    } else {
      const rawPrice = document.getElementById('parsed-token-price')?.value;
      const newGame = {
        name,
        network: (document.getElementById('parsed-network')?.value || '').trim(),
        officialLink: (document.getElementById('parsed-official-link')?.value || '').trim(),
        tokenSymbol: (document.getElementById('parsed-token-symbol')?.value || '').trim(),
        tokenPrice: rawPrice && !isNaN(Number(rawPrice)) ? Number(rawPrice) : null,
        contractAddress: (document.getElementById('parsed-contract')?.value || '').trim(),
        gameReleaseDate: document.getElementById('parsed-game-release')?.value || '',
        tokenReleaseDate: document.getElementById('parsed-token-release')?.value || '',
        dateConfidence: document.getElementById('parsed-confidence')?.value || 'Estimated',
        status: document.getElementById('parsed-status')?.value || 'Researching',
        notes: (document.getElementById('parsed-notes')?.value || '').trim()
      };

      const saved = storage.addGame(newGame);
      showToast(`Saved "${saved.name}" to Games!`, 'success');
      this.navigate('games');
    }

    // Reset paste view
    document.getElementById('paste-text-input').value = '';
    document.getElementById('paste-url-input').value = '';
    document.getElementById('paste-review-container').style.display = 'none';
  }

  // ==========================================
  // VIEW 5: CALENDAR & MILESTONES
  // ==========================================
  bindCalendarView() {
    const btnPrev = document.getElementById('cal-btn-prev');
    const btnNext = document.getElementById('cal-btn-next');
    const btnToday = document.getElementById('cal-btn-today');
    const typeFilter = document.getElementById('cal-type-filter');
    const btnMonthMode = document.getElementById('cal-btn-month-mode');
    const btnAgendaMode = document.getElementById('cal-btn-agenda-mode');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        this.calMonth--;
        if (this.calMonth < 0) {
          this.calMonth = 11;
          this.calYear--;
        }
        this.renderCalendar();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this.calMonth++;
        if (this.calMonth > 11) {
          this.calMonth = 0;
          this.calYear++;
        }
        this.renderCalendar();
      });
    }

    if (btnToday) {
      btnToday.addEventListener('click', () => {
        this.calYear = new Date().getFullYear();
        this.calMonth = new Date().getMonth();
        this.renderCalendar();
      });
    }

    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.calFilterType = e.target.value;
        this.renderCalendar();
      });
    }

    if (btnMonthMode && btnAgendaMode) {
      btnMonthMode.addEventListener('click', () => {
        this.calViewMode = 'month';
        btnMonthMode.classList.add('active');
        btnAgendaMode.classList.remove('active');
        this.renderCalendar();
      });
      btnAgendaMode.addEventListener('click', () => {
        this.calViewMode = 'agenda';
        btnAgendaMode.classList.add('active');
        btnMonthMode.classList.remove('active');
        this.renderCalendar();
      });
    }
  }

  renderCalendar() {
    const monthTitle = document.getElementById('cal-month-title');
    const monthViewContainer = document.getElementById('cal-month-container');
    const agendaViewContainer = document.getElementById('cal-agenda-container');

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (monthTitle) {
      monthTitle.textContent = `${monthNames[this.calMonth]} ${this.calYear}`;
    }

    let milestones = getAllMilestones(storage.getCryptoProjects(), storage.getGames());

    // Apply Filter
    if (this.calFilterType !== 'all') {
      milestones = milestones.filter(m => {
        if (this.calFilterType === 'crypto') return m.category === 'crypto';
        if (this.calFilterType === 'game') return m.category === 'game';
        if (this.calFilterType === 'claim') return m.milestoneType === 'Claim';
        if (this.calFilterType === 'tge') return m.milestoneType === 'TGE / Release' || m.milestoneType === 'Token TGE';
        return true;
      });
    }

    if (this.calViewMode === 'month') {
      if (monthViewContainer) monthViewContainer.style.display = 'block';
      if (agendaViewContainer) agendaViewContainer.style.display = 'none';

      const gridCells = generateMonthGrid(this.calYear, this.calMonth, milestones);
      const gridEl = document.getElementById('cal-month-grid');

      if (gridEl) {
        gridEl.innerHTML = gridCells.map(c => `
          <div class="cal-day-cell ${c.isCurrentMonth ? '' : 'other-month'} ${c.isToday ? 'today' : ''}" onclick="window.QuickSeeApp.handleCalendarDayClick('${c.dateStr}', ${c.events.length})">
            <span class="cal-day-num">${c.dayNum}</span>
            <div style="display:flex;flex-direction:column;gap:3px;overflow:hidden;">
              ${c.events.slice(0, 3).map(ev => {
                const pillClass = ev.milestoneType === 'Claim' ? 'claim' : ev.milestoneType === 'Listing' ? 'listing' : ev.category === 'game' ? 'game' : 'tge';
                return `
                  <div class="cal-event-pill ${pillClass}" title="${escapeHtml(ev.recordName)}: ${escapeHtml(ev.milestoneType)} (${escapeHtml(ev.dateConfidence)})">
                    <span style="font-weight:600;">${escapeHtml(ev.recordName.substring(0, 10))}</span>
                    <span>${escapeHtml(ev.milestoneType.split(' ')[0])}</span>
                  </div>
                `;
              }).join('')}
              ${c.events.length > 3 ? `<span style="font-size:0.65rem;color:var(--text-muted);font-weight:600;">+${c.events.length - 3} more</span>` : ''}
            </div>
          </div>
        `).join('');
      }
    } else {
      // Agenda Mode
      if (monthViewContainer) monthViewContainer.style.display = 'none';
      if (agendaViewContainer) agendaViewContainer.style.display = 'block';

      const agendaList = document.getElementById('cal-agenda-list');
      if (agendaList) {
        const groups = groupMilestonesByAgenda(milestones);
        const renderGroup = (title, items, isAlert = false) => {
          if (!items || items.length === 0) return '';
          return `
            <div style="margin-bottom:20px;">
              <h4 style="font-size:0.95rem;color:${isAlert ? 'var(--error)' : 'var(--text-primary)'};margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                ${isAlert ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' : ''}
                ${escapeHtml(title)} (${items.length})
              </h4>
              <div class="agenda-list">
                ${items.map(m => `
                  <div class="agenda-item ${m.isOverdue ? 'overdue' : ''}" onclick="window.QuickSeeApp.openDetailDrawer('${m.recordId}', '${m.category}')">
                    <div style="display:flex;align-items:center;gap:16px;">
                      <div class="agenda-date-box">
                        <span class="agenda-month">${new Date(m.date + 'T00:00:00').toLocaleString('default', { month: 'short' })}</span>
                        <span class="agenda-day">${new Date(m.date + 'T00:00:00').getDate()}</span>
                      </div>
                      <div>
                        <div style="font-weight:600;font-size:1rem;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                          ${escapeHtml(m.recordName)}
                          <span class="badge ${m.category === 'crypto' ? (m.subType === 'Whitelist' ? 'badge-whitelist' : 'badge-airdrop') : 'badge-game'}">${escapeHtml(m.subType)}</span>
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">
                          ${escapeHtml(m.milestoneType)} • Network: <span style="color:var(--text-primary);">${escapeHtml(m.network || 'Unknown')}</span>
                        </div>
                      </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:12px;">
                      ${renderConfidenceBadge(m.dateConfidence)}
                      <span class="badge ${m.isOverdue ? 'badge-status-dropped' : 'badge-airdrop'}" style="font-family:var(--font-mono);font-size:0.8rem;">
                        ${escapeHtml(m.relativeLabel)}
                      </span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        };

        const totalItems = Object.values(groups).reduce((acc, curr) => acc + curr.length, 0);

        if (totalItems === 0) {
          agendaList.innerHTML = `
            <div class="empty-state">
              <p>No milestone dates found matching your criteria.</p>
            </div>
          `;
        } else {
          agendaList.innerHTML = `
            ${renderGroup('Overdue Milestones (Action Needed)', groups.overdue, true)}
            ${renderGroup('Today & Tomorrow', groups.todayAndTomorrow)}
            ${renderGroup('This Week', groups.thisWeek)}
            ${renderGroup('This Month', groups.thisMonth)}
            ${renderGroup('Upcoming Later', groups.later)}
          `;
        }
      }
    }
  }

  handleCalendarDayClick(dateStr, eventCount) {
    if (eventCount === 0) return;
    const milestones = getAllMilestones(storage.getCryptoProjects(), storage.getGames()).filter(m => m.date === dateStr);
    if (milestones.length === 1) {
      this.openDetailDrawer(milestones[0].recordId, milestones[0].category);
    } else if (milestones.length > 1) {
      // Switch to agenda or open drawer for first
      showToast(`${milestones.length} milestones on ${dateStr}`, 'info');
      this.openDetailDrawer(milestones[0].recordId, milestones[0].category);
    }
  }

  // ==========================================
  // VIEW 6: SETTINGS & DATA PORTABILITY
  // ==========================================
  bindSettingsView() {
    // JSON Export
    const btnExportJSON = document.getElementById('btn-export-json');
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', () => {
        const jsonStr = storage.exportJSON();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `quicksee_backup_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Full JSON backup downloaded successfully!', 'success');
        this.renderSettings();
      });
    }

    // JSON Restore
    const fileRestore = document.getElementById('file-restore-json');
    if (fileRestore) {
      fileRestore.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const raw = event.target.result;
            showConfirmModal({
              title: 'Restore JSON Backup',
              message: 'How would you like to restore this backup? You can merge new records without losing current data, or replace your existing database entirely.',
              confirmText: 'Merge Non-Duplicates',
              confirmClass: 'btn-primary',
              onConfirm: () => {
                try {
                  const res = storage.importJSON(raw, 'merge');
                  showToast(`Merged ${res.importedCryptoCount} crypto projects and ${res.importedGamesCount} games!`, 'success');
                  this.updateBadges();
                  this.renderSettings();
                } catch (err) {
                  showToast(err.message, 'error');
                }
              }
            });
          } catch (err) {
            showToast('Failed to read backup file: ' + err.message, 'error');
          }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
      });
    }

    // CSV Exports
    const btnExportCryptoCSV = document.getElementById('btn-export-crypto-csv');
    if (btnExportCryptoCSV) {
      btnExportCryptoCSV.addEventListener('click', () => {
        const records = storage.getCryptoProjects();
        const csv = exportCryptoToCSV(records);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quicksee_crypto_projects_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exported ${records.length} Crypto Projects to CSV!`, 'success');
      });
    }

    const btnExportGamesCSV = document.getElementById('btn-export-games-csv');
    if (btnExportGamesCSV) {
      btnExportGamesCSV.addEventListener('click', () => {
        const records = storage.getGames();
        const csv = exportGamesToCSV(records);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quicksee_games_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exported ${records.length} Games to CSV!`, 'success');
      });
    }

    // CSV Imports
    const fileImportCryptoCSV = document.getElementById('file-import-crypto-csv');
    if (fileImportCryptoCSV) {
      fileImportCryptoCSV.addEventListener('change', (e) => this.handleCSVImport(e, 'crypto'));
    }

    const fileImportGamesCSV = document.getElementById('file-import-games-csv');
    if (fileImportGamesCSV) {
      fileImportGamesCSV.addEventListener('change', (e) => this.handleCSVImport(e, 'game'));
    }

    // Seed Sample Data
    const btnSeed = document.getElementById('btn-seed-sample-data');
    if (btnSeed) {
      btnSeed.addEventListener('click', () => {
        showConfirmModal({
          title: 'Load Curated Sample Data',
          message: 'This will add realistic sample Web3 projects and games (Monad, Berachain, Grass, Illuvium, etc.) to your tracker.',
          confirmText: 'Load Samples',
          confirmClass: 'btn-primary',
          onConfirm: () => {
            SAMPLE_CRYPTO_PROJECTS.forEach(p => storage.addCryptoProject(p));
            SAMPLE_GAMES.forEach(g => storage.addGame(g));
            showToast('Sample Web3 data loaded successfully!', 'success');
            this.updateBadges();
            this.renderSettings();
          }
        });
      });
    }

    // Reset All Data
    const btnClearAll = document.getElementById('btn-clear-all-data');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        showConfirmModal({
          title: 'Clear All Local Records',
          message: 'WARNING: This will permanently delete all stored Crypto Projects and Games from your browser. Please ensure you have exported a backup first!',
          confirmText: 'Delete Everything',
          confirmClass: 'btn-danger',
          onConfirm: () => {
            storage.clearAllData();
            showToast('All local records have been cleared.', 'info');
            this.updateBadges();
            this.renderSettings();
          }
        });
      });
    }

    // Settings Dropdowns
    const windowSelect = document.getElementById('pref-milestone-window');
    if (windowSelect) {
      windowSelect.addEventListener('change', (e) => {
        storage.updateSettings({ milestoneWindowDays: Number(e.target.value) });
        showToast('Preference updated', 'info');
      });
    }

    const defaultViewSelect = document.getElementById('pref-default-view');
    if (defaultViewSelect) {
      defaultViewSelect.addEventListener('change', (e) => {
        storage.updateSettings({ defaultView: e.target.value });
        showToast('Default startup view updated', 'info');
      });
    }
  }

  handleCSVImport(e, targetType) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target.result;
        const existingRecords = targetType === 'crypto' ? storage.getCryptoProjects() : storage.getGames();
        const { totalRows, validRecords, duplicateRows, rejectedRows } = validateAndMapCSV(csvText, targetType, existingRecords);

        // Open Import Validation Preview Modal
        this.showCSVPreviewModal(targetType, totalRows, validRecords, duplicateRows, rejectedRows);
      } catch (err) {
        showToast('CSV parsing error: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  showCSVPreviewModal(targetType, totalRows, validRecords, duplicateRows, rejectedRows) {
    const modalEl = document.getElementById('modal-csv-preview');
    if (!modalEl) return;

    const summaryEl = document.getElementById('csv-preview-summary');
    const tableEl = document.getElementById('csv-preview-table');
    const btnCommit = document.getElementById('btn-csv-commit-import');

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.86rem;">
          <span style="color:var(--text-primary);">Total Rows: <strong>${totalRows}</strong></span>
          <span style="color:var(--success);">Valid to Import: <strong>${validRecords.length}</strong></span>
          <span style="color:var(--warning);">Duplicates (Skipped): <strong>${duplicateRows.length}</strong></span>
          <span style="color:var(--error);">Rejected (Errors): <strong>${rejectedRows.length}</strong></span>
        </div>
      `;
    }

    if (tableEl) {
      tableEl.innerHTML = `
        <div class="table-responsive" style="max-height:260px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Network</th>
                <th>Notes / Info</th>
              </tr>
            </thead>
            <tbody>
              ${validRecords.slice(0, 15).map(r => `
                <tr>
                  <td><span class="badge" style="background:var(--success-dim);color:var(--success);">Valid</span></td>
                  <td style="font-weight:600;">${escapeHtml(r.name)}</td>
                  <td>${escapeHtml(r.network || '-')}</td>
                  <td style="color:var(--text-muted);font-size:0.78rem;">Ready for import</td>
                </tr>
              `).join('')}
              ${duplicateRows.map(d => `
                <tr>
                  <td><span class="badge" style="background:var(--warning-dim);color:var(--warning);">Duplicate</span></td>
                  <td style="font-weight:600;">${escapeHtml(d.record.name)}</td>
                  <td>${escapeHtml(d.record.network || '-')}</td>
                  <td style="color:var(--warning);font-size:0.78rem;">${escapeHtml(d.reason)}</td>
                </tr>
              `).join('')}
              ${rejectedRows.map(err => `
                <tr>
                  <td><span class="badge" style="background:var(--error-dim);color:var(--error);">Error</span></td>
                  <td colspan="3" style="color:var(--error);font-size:0.78rem;">Row ${err.rowNumber}: ${escapeHtml(err.reason)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (btnCommit) {
      btnCommit.onclick = () => {
        closeModal('modal-csv-preview');
        if (validRecords.length === 0) {
          showToast('No valid new records to import.', 'warning');
          return;
        }

        if (targetType === 'crypto') {
          validRecords.forEach(r => storage.addCryptoProject(r));
          showToast(`Successfully imported ${validRecords.length} Crypto Projects!`, 'success');
          this.navigate('crypto');
        } else {
          validRecords.forEach(r => storage.addGame(r));
          showToast(`Successfully imported ${validRecords.length} Games!`, 'success');
          this.navigate('games');
        }
      };
    }

    openModal('modal-csv-preview');
  }

  renderSettings() {
    const stats = storage.getStats();
    const settings = storage.getSettings();

    const elTotal = document.getElementById('settings-total-records');
    const elCrypto = document.getElementById('settings-crypto-records');
    const elGames = document.getElementById('settings-games-records');
    const elStorage = document.getElementById('settings-storage-size');
    const elLastBackup = document.getElementById('settings-last-backup');

    if (elTotal) elTotal.textContent = stats.totalRecords;
    if (elCrypto) elCrypto.textContent = stats.cryptoCount;
    if (elGames) elGames.textContent = stats.gamesCount;
    if (elStorage) elStorage.textContent = `${stats.storageSizeKB} KB`;
    if (elLastBackup) elLastBackup.textContent = stats.lastBackupAt ? new Date(stats.lastBackupAt).toLocaleString() : 'Never exported';

    const windowSelect = document.getElementById('pref-milestone-window');
    if (windowSelect) windowSelect.value = String(settings.milestoneWindowDays || 30);

    const defaultViewSelect = document.getElementById('pref-default-view');
    if (defaultViewSelect) defaultViewSelect.value = settings.defaultView || 'dashboard';
  }

  // ==========================================
  // MODALS & DRAWER DETAILS
  // ==========================================
  bindModals() {
    // Record Add/Edit Form submission
    const recordForm = document.getElementById('form-record-editor');
    if (recordForm) {
      recordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveRecordFromModal();
      });
    }

    // Close buttons for modals
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetModal = btn.closest('.modal-overlay');
        if (targetModal) targetModal.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  openAddModal(type = 'crypto') {
    this.editingRecordId = null;
    this.editingRecordType = type;

    const modalTitle = document.getElementById('modal-editor-title');
    if (modalTitle) modalTitle.textContent = type === 'crypto' ? 'Add Crypto Project' : 'Add Web3 Game';

    this.renderEditorFormFields(null, type);
    openModal('modal-record-editor');
  }

  openEditModal(id, type) {
    const record = type === 'crypto' ? storage.getCryptoProject(id) : storage.getGame(id);
    if (!record) return;

    this.editingRecordId = id;
    this.editingRecordType = type;

    const modalTitle = document.getElementById('modal-editor-title');
    if (modalTitle) modalTitle.textContent = type === 'crypto' ? `Edit Project: ${record.name}` : `Edit Game: ${record.name}`;

    this.renderEditorFormFields(record, type);
    openModal('modal-record-editor');
  }

  renderEditorFormFields(record, type) {
    const fieldsContainer = document.getElementById('modal-editor-fields');
    if (!fieldsContainer) return;

    const r = record || {};

    if (type === 'crypto') {
      fieldsContainer.innerHTML = `
        <div class="form-grid">
          <div class="form-group col-span-2">
            <label class="form-label">Project Name <span class="required">*</span></label>
            <input type="text" id="edit-name" class="form-control" value="${escapeHtml(r.name || '')}" placeholder="e.g. Monad Network" required />
          </div>

          <div class="form-group">
            <label class="form-label">Record Type <span class="required">*</span></label>
            <select id="edit-crypto-type" class="form-control" required>
              <option value="Airdrop"${r.type === 'Airdrop' ? ' selected' : ''}>Airdrop</option>
              <option value="Whitelist"${r.type === 'Whitelist' ? ' selected' : ''}>Whitelist</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Network</label>
            <input type="text" id="edit-network" class="form-control" value="${escapeHtml(r.network || '')}" placeholder="e.g. Ethereum, Solana, Base" />
          </div>

          <div class="form-group">
            <label class="form-label">Token Symbol</label>
            <input type="text" id="edit-token-symbol" class="form-control font-mono" value="${escapeHtml(r.tokenSymbol || '')}" placeholder="$TOKEN" />
          </div>

          <div class="form-group">
            <label class="form-label">Contract Address (CA)</label>
            <input type="text" id="edit-contract" class="form-control font-mono" value="${escapeHtml(r.contractAddress || '')}" placeholder="0x... or Solana Base58" />
          </div>

          <div class="form-group">
            <label class="form-label">Date Joined</label>
            <input type="date" id="edit-date-joined" class="form-control font-mono" value="${r.dateJoined || new Date().toISOString().split('T')[0]}" />
          </div>

          <div class="form-group">
            <label class="form-label">Expected Release / TGE Date</label>
            <input type="date" id="edit-release-date" class="form-control font-mono" value="${r.releaseDate || ''}" />
          </div>

          <div class="form-group">
            <label class="form-label">Claim Date</label>
            <input type="date" id="edit-claim-date" class="form-control font-mono" value="${r.claimDate || ''}" />
          </div>

          <div class="form-group">
            <label class="form-label">Listing Date</label>
            <input type="date" id="edit-listing-date" class="form-control font-mono" value="${r.listingDate || ''}" />
          </div>

          <div class="form-group">
            <label class="form-label">Date Confidence</label>
            <select id="edit-confidence" class="form-control">
              <option value="Estimated"${r.dateConfidence === 'Estimated' ? ' selected' : ''}>Estimated</option>
              <option value="Confirmed"${r.dateConfidence === 'Confirmed' ? ' selected' : ''}>Confirmed</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Status</label>
            <select id="edit-status" class="form-control">
              <option value="Joined"${r.status === 'Joined' ? ' selected' : ''}>Joined</option>
              <option value="Eligible"${r.status === 'Eligible' ? ' selected' : ''}>Eligible</option>
              <option value="Researching"${r.status === 'Researching' ? ' selected' : ''}>Researching</option>
              <option value="Upcoming"${r.status === 'Upcoming' ? ' selected' : ''}>Upcoming</option>
              <option value="Claimable"${r.status === 'Claimable' ? ' selected' : ''}>Claimable</option>
              <option value="Listed"${r.status === 'Listed' ? ' selected' : ''}>Listed</option>
              <option value="Completed"${r.status === 'Completed' ? ' selected' : ''}>Completed</option>
              <option value="Paused"${r.status === 'Paused' ? ' selected' : ''}>Paused</option>
              <option value="Dropped"${r.status === 'Dropped' ? ' selected' : ''}>Dropped</option>
              <option value="Not Eligible"${r.status === 'Not Eligible' ? ' selected' : ''}>Not Eligible</option>
            </select>
          </div>

          <div class="form-group col-span-2">
            <label class="form-label">X / Twitter Post URL</label>
            <input type="url" id="edit-x-link" class="form-control" value="${escapeHtml(r.xPostLink || '')}" placeholder="https://x.com/..." />
          </div>

          <div class="form-group col-span-2">
            <label class="form-label">Notes</label>
            <textarea id="edit-notes" class="form-control" rows="3" placeholder="Tasks completed, points farmed, wallet used...">${escapeHtml(r.notes || '')}</textarea>
          </div>
        </div>
      `;
    } else {
      // Game fields
      fieldsContainer.innerHTML = `
        <div class="form-grid">
          <div class="form-group col-span-2">
            <label class="form-label">Game Name <span class="required">*</span></label>
            <input type="text" id="edit-name" class="form-control" value="${escapeHtml(r.name || '')}" placeholder="e.g. Illuvium" required />
          </div>

          <div class="form-group">
            <label class="form-label">Network</label>
            <input type="text" id="edit-network" class="form-control" value="${escapeHtml(r.network || '')}" placeholder="e.g. Immutable X, Avalanche, Ronin" />
          </div>

          <div class="form-group">
            <label class="form-label">Official / Game Link</label>
            <input type="url" id="edit-official-link" class="form-control" value="${escapeHtml(r.officialLink || '')}" placeholder="https://..." />
          </div>

          <div class="form-group">
            <label class="form-label">Token Symbol</label>
            <input type="text" id="edit-token-symbol" class="form-control font-mono" value="${escapeHtml(r.tokenSymbol || '')}" placeholder="$TOKEN" />
          </div>

          <div class="form-group">
            <label class="form-label">Token Price (USD)</label>
            <input type="number" step="0.0001" id="edit-token-price" class="form-control font-mono" value="${r.tokenPrice !== null && r.tokenPrice !== undefined ? r.tokenPrice : ''}" placeholder="0.50" />
          </div>

          <div class="form-group col-span-2">
            <label class="form-label">Contract Address (CA)</label>
            <input type="text" id="edit-contract" class="form-control font-mono" value="${escapeHtml(r.contractAddress || '')}" placeholder="0x..." />
          </div>

          <div class="form-group">
            <label class="form-label">Date Joined</label>
            <input type="date" id="edit-date-joined" class="form-control font-mono" value="${r.dateJoined || new Date().toISOString().split('T')[0]}" />
          </div>

          <div class="form-group">
            <label class="form-label">Game Release Date</label>
            <input type="date" id="edit-game-release" class="form-control font-mono" value="${r.gameReleaseDate || ''}" />
          </div>

          <div class="form-group">
            <label class="form-label">Token Release Date</label>
            <input type="date" id="edit-token-release" class="form-control font-mono" value="${r.tokenReleaseDate || ''}" />
          </div>

          <div class="form-group">
            <label class="form-label">Date Confidence</label>
            <select id="edit-confidence" class="form-control">
              <option value="Estimated"${r.dateConfidence === 'Estimated' ? ' selected' : ''}>Estimated</option>
              <option value="Confirmed"${r.dateConfidence === 'Confirmed' ? ' selected' : ''}>Confirmed</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Status</label>
            <select id="edit-status" class="form-control">
              <option value="Researching"${r.status === 'Researching' ? ' selected' : ''}>Researching</option>
              <option value="Joined"${r.status === 'Joined' ? ' selected' : ''}>Joined</option>
              <option value="Playing"${r.status === 'Playing' ? ' selected' : ''}>Playing</option>
              <option value="Upcoming"${r.status === 'Upcoming' ? ' selected' : ''}>Upcoming</option>
              <option value="Live"${r.status === 'Live' ? ' selected' : ''}>Live</option>
              <option value="Token Upcoming"${r.status === 'Token Upcoming' ? ' selected' : ''}>Token Upcoming</option>
              <option value="Completed"${r.status === 'Completed' ? ' selected' : ''}>Completed</option>
              <option value="Paused"${r.status === 'Paused' ? ' selected' : ''}>Paused</option>
              <option value="Dropped"${r.status === 'Dropped' ? ' selected' : ''}>Dropped</option>
            </select>
          </div>

          <div class="form-group col-span-2">
            <label class="form-label">Notes</label>
            <textarea id="edit-notes" class="form-control" rows="3" placeholder="Game genre, guild info, inventory notes...">${escapeHtml(r.notes || '')}</textarea>
          </div>
        </div>
      `;
    }
  }

  saveRecordFromModal() {
    const name = (document.getElementById('edit-name')?.value || '').trim();
    if (!name) {
      showToast('Record name is required.', 'error');
      return;
    }

    if (this.editingRecordType === 'crypto') {
      const payload = {
        name,
        type: document.getElementById('edit-crypto-type')?.value || 'Airdrop',
        network: (document.getElementById('edit-network')?.value || '').trim(),
        tokenSymbol: (document.getElementById('edit-token-symbol')?.value || '').trim(),
        contractAddress: (document.getElementById('edit-contract')?.value || '').trim(),
        dateJoined: document.getElementById('edit-date-joined')?.value || '',
        releaseDate: document.getElementById('edit-release-date')?.value || '',
        claimDate: document.getElementById('edit-claim-date')?.value || '',
        listingDate: document.getElementById('edit-listing-date')?.value || '',
        dateConfidence: document.getElementById('edit-confidence')?.value || 'Estimated',
        status: document.getElementById('edit-status')?.value || 'Joined',
        xPostLink: (document.getElementById('edit-x-link')?.value || '').trim(),
        notes: (document.getElementById('edit-notes')?.value || '').trim()
      };

      if (this.editingRecordId) {
        storage.updateCryptoProject(this.editingRecordId, payload);
        showToast(`Updated "${payload.name}"!`, 'success');
      } else {
        storage.addCryptoProject(payload);
        showToast(`Added "${payload.name}"!`, 'success');
      }
      closeModal('modal-record-editor');
      this.renderCryptoProjects();
    } else {
      const rawPrice = document.getElementById('edit-token-price')?.value;
      const payload = {
        name,
        network: (document.getElementById('edit-network')?.value || '').trim(),
        officialLink: (document.getElementById('edit-official-link')?.value || '').trim(),
        tokenSymbol: (document.getElementById('edit-token-symbol')?.value || '').trim(),
        tokenPrice: rawPrice && !isNaN(Number(rawPrice)) ? Number(rawPrice) : null,
        contractAddress: (document.getElementById('edit-contract')?.value || '').trim(),
        dateJoined: document.getElementById('edit-date-joined')?.value || '',
        gameReleaseDate: document.getElementById('edit-game-release')?.value || '',
        tokenReleaseDate: document.getElementById('edit-token-release')?.value || '',
        dateConfidence: document.getElementById('edit-confidence')?.value || 'Estimated',
        status: document.getElementById('edit-status')?.value || 'Researching',
        notes: (document.getElementById('edit-notes')?.value || '').trim()
      };

      if (this.editingRecordId) {
        storage.updateGame(this.editingRecordId, payload);
        showToast(`Updated "${payload.name}"!`, 'success');
      } else {
        storage.addGame(payload);
        showToast(`Added "${payload.name}"!`, 'success');
      }
      closeModal('modal-record-editor');
      this.renderGames();
    }
  }

  deleteRecordConfirm(id, type, name) {
    showConfirmModal({
      title: `Delete ${type === 'crypto' ? 'Crypto Project' : 'Game'}`,
      message: `Are you sure you want to permanently delete "${name}" from your tracker? This action cannot be undone.`,
      confirmText: 'Delete Record',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        if (type === 'crypto') {
          storage.deleteCryptoProject(id);
          showToast(`Deleted "${name}"`, 'info');
          this.renderCryptoProjects();
        } else {
          storage.deleteGame(id);
          showToast(`Deleted "${name}"`, 'info');
          this.renderGames();
        }
      }
    });
  }

  // Record Detail Drawer
  openDetailDrawer(id, type) {
    const record = type === 'crypto' ? storage.getCryptoProject(id) : storage.getGame(id);
    if (!record) return;

    const titleEl = document.getElementById('drawer-record-title');
    const bodyEl = document.getElementById('drawer-record-body');
    const btnEdit = document.getElementById('drawer-btn-edit');
    const btnDelete = document.getElementById('drawer-btn-delete');

    if (titleEl) titleEl.textContent = record.name;

    if (bodyEl) {
      if (type === 'crypto') {
        bodyEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            ${renderTypeBadge(record.type)}
            <span class="network-tag">${escapeHtml(record.network || 'Unknown')}</span>
            ${renderStatusBadge(record.status)}
            ${renderConfidenceBadge(record.dateConfidence)}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:var(--surface-elevated);padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);margin-bottom:16px;">
            <div>
              <span class="meta-label">Token Symbol</span>
              <div class="font-mono" style="font-weight:600;color:var(--text-primary);">${escapeHtml(record.tokenSymbol || '-')}</div>
            </div>
            <div>
              <span class="meta-label">Date Joined</span>
              <div class="font-mono">${record.dateJoined || '-'}</div>
            </div>
            <div style="grid-column:span 2;">
              <span class="meta-label">Contract Address (CA)</span>
              <div style="margin-top:4px;">${renderContractChip(record.contractAddress, record.network)}</div>
            </div>
            ${record.releaseDate ? `
              <div>
                <span class="meta-label">Expected Release / TGE</span>
                <div class="font-mono" style="color:var(--mint-primary);font-weight:600;">${record.releaseDate}</div>
              </div>
            ` : ''}
            ${record.claimDate ? `
              <div>
                <span class="meta-label">Claim Date</span>
                <div class="font-mono" style="color:var(--success);font-weight:600;">${record.claimDate}</div>
              </div>
            ` : ''}
            ${record.listingDate ? `
              <div>
                <span class="meta-label">Listing Date</span>
                <div class="font-mono" style="color:var(--cyan-accent);font-weight:600;">${record.listingDate}</div>
              </div>
            ` : ''}
          </div>

          ${record.xPostLink ? `
            <div style="margin-bottom:16px;">
              <span class="meta-label">X / Twitter Announcement</span>
              <div><a href="${escapeHtml(record.xPostLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.xPostLink)}</a></div>
            </div>
          ` : ''}

          <div>
            <span class="meta-label">Notes</span>
            <div style="background:var(--surface-input);padding:12px;border-radius:var(--radius-xs);border:1px solid var(--border-subtle);font-size:0.86rem;line-height:1.5;color:var(--text-secondary);white-space:pre-wrap;margin-top:4px;">${escapeHtml(record.notes || 'No notes added yet.')}</div>
          </div>

          <div style="margin-top:20px;font-size:0.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
            <span>ID: ${escapeHtml(record.id)}</span>
            <span>Last updated: ${new Date(record.updatedAt).toLocaleDateString()}</span>
          </div>
        `;
      } else {
        // Game detail
        bodyEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <span class="badge badge-game">Game</span>
            <span class="network-tag">${escapeHtml(record.network || 'Unknown')}</span>
            ${renderStatusBadge(record.status)}
            ${renderConfidenceBadge(record.dateConfidence)}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:var(--surface-elevated);padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);margin-bottom:16px;">
            <div>
              <span class="meta-label">Token & Price</span>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                <span class="font-mono" style="font-weight:600;">${escapeHtml(record.tokenSymbol || '-')}</span>
                ${formatPrice(record.tokenPrice)}
              </div>
            </div>
            <div>
              <span class="meta-label">Date Joined</span>
              <div class="font-mono">${record.dateJoined || '-'}</div>
            </div>
            <div style="grid-column:span 2;">
              <span class="meta-label">Contract Address (CA)</span>
              <div style="margin-top:4px;">${renderContractChip(record.contractAddress, record.network)}</div>
            </div>
            ${record.gameReleaseDate ? `
              <div>
                <span class="meta-label">Game Release Date</span>
                <div class="font-mono" style="color:var(--purple-accent);font-weight:600;">${record.gameReleaseDate}</div>
              </div>
            ` : ''}
            ${record.tokenReleaseDate ? `
              <div>
                <span class="meta-label">Token Release Date</span>
                <div class="font-mono" style="color:var(--mint-primary);font-weight:600;">${record.tokenReleaseDate}</div>
              </div>
            ` : ''}
          </div>

          ${record.officialLink ? `
            <div style="margin-bottom:16px;">
              <span class="meta-label">Official Link</span>
              <div><a href="${escapeHtml(record.officialLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.officialLink)}</a></div>
            </div>
          ` : ''}

          <div>
            <span class="meta-label">Notes</span>
            <div style="background:var(--surface-input);padding:12px;border-radius:var(--radius-xs);border:1px solid var(--border-subtle);font-size:0.86rem;line-height:1.5;color:var(--text-secondary);white-space:pre-wrap;margin-top:4px;">${escapeHtml(record.notes || 'No notes added yet.')}</div>
          </div>

          <div style="margin-top:20px;font-size:0.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
            <span>ID: ${escapeHtml(record.id)}</span>
            <span>Last updated: ${new Date(record.updatedAt).toLocaleDateString()}</span>
          </div>
        `;
      }
    }

    if (btnEdit) {
      btnEdit.onclick = () => {
        closeModal('modal-record-drawer');
        this.openEditModal(id, type);
      };
    }

    if (btnDelete) {
      btnDelete.onclick = () => {
        closeModal('modal-record-drawer');
        this.deleteRecordConfirm(id, type, record.name);
      };
    }

    openModal('modal-record-drawer');
  }
}

// Instantiate and expose globally
const app = new QuickSeeApp();
window.QuickSeeApp = app;

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
