export function hideStatsPage() {
  console.log('[hideStatsPage] Called!');
  console.log('[hideStatsPage] __navigatingToHome:', window.__navigatingToHome);

  if (statsContainer) {
    statsContainer.remove();
    statsContainer = null;
    console.log('[hideStatsPage] stats-container removed and reference cleared');
  }

  if (!mainContainer) mainContainer = document.querySelector('.container');
  if (mainContainer) {
    mainContainer.style.display = 'block';
    console.log('[hideStatsPage] mainContainer display set to block');
  }

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.style.display = '';
    console.log('[hideStatsPage] sidebar display reset');
  }
  
  // Восстанавливаем видимость search-container и top-actions-bar
  const searchContainer = document.querySelector('.search-container');
  if (searchContainer) {
    searchContainer.style.display = '';
    console.log('[hideStatsPage] search-container display reset');
  }
  
  const topActionsBar = document.querySelector('.top-actions-bar');
  if (topActionsBar) {
    topActionsBar.style.display = '';
    console.log('[hideStatsPage] top-actions-bar display reset');
  }

  const evt = new Event('statsClosed'); window.dispatchEvent(evt);

  console.log('[hideStatsPage] Done!');
}
