/**
 * QuickSee - UI Components, Modal Handlers & Helpers
 */

export function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = type === 'success' 
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : type === 'error'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  toast.innerHTML = `
    <span style="display:flex;align-items:center;flex-shrink:0;">${iconSvg}</span>
    <span style="flex:1;font-size:0.86rem;line-height:1.4;">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('active'));

  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

export async function copyToClipboard(text, entityName = 'Contract address') {
  if (!text) {
    showToast('No address available to copy.', 'warning');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Copied ${entityName} to clipboard!`, 'success', 2500);
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast(`Copied ${entityName} to clipboard!`, 'success', 2500);
  }
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function truncateAddress(address, start = 6, end = 4) {
  if (!address || address.length <= start + end) return address || '';
  return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
}

export function renderContractChip(address, network = '') {
  if (!address) {
    return `<span style="color:var(--text-muted);font-size:0.75rem;">None</span>`;
  }
  const trunc = truncateAddress(address);
  return `
    <span class="ca-chip" title="Click to copy full CA: ${escapeHtml(address)}" onclick="window.QuickSeeUI.copyCA('${escapeHtml(address)}')">
      <span>${escapeHtml(trunc)}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
    </span>
  `;
}

export function renderStatusBadge(status) {
  const norm = (status || 'Joined').toLowerCase().replace(/\s+/g, '');
  return `<span class="badge badge-status-${norm}"><span class="badge-dot"></span>${escapeHtml(status || 'Joined')}</span>`;
}

export function renderTypeBadge(type) {
  if (type === 'Whitelist') {
    return `<span class="badge badge-whitelist">Whitelist</span>`;
  } else if (type === 'Game') {
    return `<span class="badge badge-game">Game</span>`;
  }
  return `<span class="badge badge-airdrop">Airdrop</span>`;
}

export function renderConfidenceBadge(confidence) {
  if (confidence === 'Confirmed') {
    return `<span class="badge badge-confidence-confirmed">Confirmed</span>`;
  }
  return `<span class="badge badge-confidence-estimated">Estimated</span>`;
}

export function formatPrice(price) {
  if (price === null || price === undefined || price === '' || isNaN(Number(price))) {
    return '<span style="color:var(--text-muted);">-</span>';
  }
  const num = Number(price);
  return `<span style="font-family:var(--font-mono);font-weight:600;color:var(--mint-primary);">$${num.toFixed(2)}</span>`;
}

// Modal System
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Close on backdrop click and ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    activeModals.forEach(m => {
      m.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
});

// Confirmation Modal Helper
export function showConfirmModal({ title, message, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
  const modalEl = document.getElementById('modal-confirm');
  if (!modalEl) return;

  const titleEl = modalEl.querySelector('.modal-title');
  const bodyEl = modalEl.querySelector('.modal-confirm-body');
  const confirmBtn = document.getElementById('btn-confirm-action');

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = `<p style="color:var(--text-secondary);line-height:1.5;">${escapeHtml(message)}</p>`;
  
  if (confirmBtn) {
    confirmBtn.className = `btn ${confirmClass}`;
    confirmBtn.textContent = confirmText;
    
    // Replace listener cleanly
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
      closeModal('modal-confirm');
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  openModal('modal-confirm');
}

// Attach globally for inline HTML onclick handlers
window.QuickSeeUI = {
  copyCA: (addr) => copyToClipboard(addr, 'Contract address'),
  closeModal: (id) => closeModal(id)
};
