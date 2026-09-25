/** Hide, rather than recreate, rows so quiz answers survive changing pages. */
export function paginateList(list, perPage, label) {
  if (!list) return;
  document.getElementById(list.id + '-pages')?.remove();
  const rows = [...list.children];
  if (rows.length <= perPage) return;
  const nav = document.createElement('nav');
  nav.id = list.id + '-pages';
  nav.className = 'result-pages';
  nav.setAttribute('aria-label', label + ' pages');
  const previous = document.createElement('button'), next = document.createElement('button'), status = document.createElement('span');
  previous.type = next.type = 'button';
  previous.textContent = '← Previous'; next.textContent = 'Next →';
  status.setAttribute('aria-live', 'polite');
  nav.append(previous, status, next); list.after(nav);
  let page = 0;
  const paint = () => {
    const start = page * perPage;
    rows.forEach((row, index) => { row.hidden = index < start || index >= start + perPage; });
    if (list.tagName === 'OL') list.start = start + 1;
    status.textContent = `${start + 1}–${Math.min(start + perPage, rows.length)} of ${rows.length}`;
    previous.disabled = page === 0; next.disabled = start + perPage >= rows.length;
  };
  const reveal = () => list.scrollIntoView?.({block:'start', behavior:'auto'});
  previous.addEventListener('click', () => { page--; paint(); reveal(); });
  next.addEventListener('click', () => { page++; paint(); reveal(); });
  paint();
}
