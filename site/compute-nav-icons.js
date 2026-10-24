const COMPUTE_NAV_ICON_PATHS = Object.freeze({
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
  inventory_2: '<path d="M4 8h16v12H4z"></path><path d="M8 8V4h8v4M4 13h16"></path>',
  dns: '<circle cx="6" cy="6" r="2.5"></circle><circle cx="18" cy="6" r="2.5"></circle><circle cx="12" cy="18" r="2.5"></circle><path d="M8.2 7.3 10.8 15M15.8 7.3 13.2 15M8.5 6h7"></path>',
  view_in_ar: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"></path><circle cx="12" cy="12" r="3"></circle><path d="M12 9V3M14.6 13.5l5.4 3M9.4 13.5l-5.4 3"></path>',
  monitor_heart: '<path d="M3 12h3l2.2-6 4 12 3.3-9 2 3H21"></path>',
  vibration: '<path d="M3 12h2l1.5-5 3 10 3-14 3 18 2.5-9H21"></path>',
  bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7z"></path>',
  recycling: '<path d="m7 7 2.5-4L12 7M9.5 3l3 5"></path><path d="m17 9 4 .2-2.5 3.5M21 9.2l-3 5"></path><path d="m13 19-2.2 3L8 18M10.8 22l-3-5"></path><path d="M12.5 8h3.8M18 14l-2 3.5H9.5M7.8 17 6 14"></path>',
  lan: '<rect x="3" y="4" width="18" height="6" rx="2"></rect><rect x="3" y="14" width="18" height="6" rx="2"></rect><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"></path>',
  wifi: '<path d="M5 18a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M11 12a2 2 0 0 1 2 0"></path><circle cx="12" cy="19" r="1"></circle>',
  warning: '<path d="M12 3 2.8 20h18.4z"></path><path d="M12 9v4M12 17h.01"></path>',
  category: '<path d="m12 3 9 5-9 5-9-5z"></path><path d="m3 12 9 5 9-5M3 16l9 5 9-5"></path>',
  memory: '<rect x="7" y="7" width="10" height="10" rx="2"></rect><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M10 10h4v4h-4z"></path>',
  memory_alt: '<rect x="6" y="7" width="12" height="10" rx="2"></rect><path d="M9 3v4M15 3v4M9 17v4M15 17v4M2 10h4M2 14h4M18 10h4M18 14h4"></path><path d="M10 11h4M10 14h4"></path>',
  developer_board: '<path d="M5 4h14v16H5z"></path><path d="M8 8h3v3H8zM14 8h2M14 11h2M8 15h8"></path>',
  account_tree: '<circle cx="6" cy="5" r="2"></circle><circle cx="18" cy="5" r="2"></circle><circle cx="6" cy="19" r="2"></circle><path d="M6 7v10M18 7c0 5-3 6-10 6"></path>',
  local_shipping: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"></path><circle cx="7" cy="18" r="2"></circle><circle cx="18" cy="18" r="2"></circle>',
  verified_user: '<path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"></path><path d="m8.5 12 2.2 2.2 4.8-5"></path>',
  hub: '<rect x="9" y="3" width="6" height="5" rx="1"></rect><rect x="3" y="16" width="6" height="5" rx="1"></rect><rect x="15" y="16" width="6" height="5" rx="1"></rect><path d="M12 8v4M6 16v-4h12v4"></path>',
  library_books: '<path d="M4 4.5A3.5 3.5 0 0 1 7.5 3H12v17H7.5A3.5 3.5 0 0 0 4 21.5z"></path><path d="M20 4.5A3.5 3.5 0 0 0 16.5 3H12v17h4.5a3.5 3.5 0 0 1 3.5 1.5z"></path>',
  fact_check: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><path d="m14.5 18 2 2 4-5"></path>',
  foundation: '<path d="M3 21h18M4 21V9l8-5 8 5v12"></path><rect x="8.5" y="12" width="7" height="4" rx="1"></rect><path d="M8.5 14h-3M18.5 14h-3"></path>',
});

function computeNavIcon(name) {
  const body = COMPUTE_NAV_ICON_PATHS[name] || COMPUTE_NAV_ICON_PATHS.dashboard;
  return `<svg class="csys-nav-icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
