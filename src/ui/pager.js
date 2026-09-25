export const DEFAULT_PER_PAGE = 10;

export function pageCount(total, perPage = DEFAULT_PER_PAGE) {
  if (total <= 0 || perPage <= 0) {
    return 1;
  }

  return Math.ceil(total / perPage);
}

export function clampPage(page, total, perPage = DEFAULT_PER_PAGE) {
  const last = pageCount(total, perPage);
  const value = Number.isFinite(page) ? Math.round(page) : 1;
  return Math.min(Math.max(1, value), last);
}

/** Zero-based item index to its one-based page. */
export function pageForIndex(index, perPage = DEFAULT_PER_PAGE) {
  if (!Number.isFinite(index) || index < 0 || perPage <= 0) {
    return 1;
  }

  return Math.floor(index / perPage) + 1;
}

export function sliceForPage(items, page, perPage = DEFAULT_PER_PAGE) {
  const safePage = clampPage(page, items.length, perPage);
  const start = (safePage - 1) * perPage;

  return {
    page: safePage,
    start,
    items: items.slice(start, start + perPage),
  };
}

export function pagerLabel(page, total, perPage = DEFAULT_PER_PAGE) {
  if (!total) {
    return "No sentences yet";
  }

  const { start, items } = sliceForPage(Array.from({ length: total }), page, perPage);
  const first = start + 1;
  const last = start + items.length;

  return `${first}–${last} of ${total} · page ${clampPage(page, total, perPage)} of ${pageCount(total, perPage)}`;
}

export function createPager({ perPage = DEFAULT_PER_PAGE, onRender } = {}) {
  let items = [];
  let page = 1;
  let rendered = false;

  /**
   * Keep the current nodes when selecting a sentence on the same page.
   */
  function show(nextPage, force = false) {
    const view = sliceForPage(items, nextPage, perPage);

    if (!force && rendered && view.page === page) {
      return page;
    }

    page = view.page;
    rendered = true;
    onRender(view.items, {
      page,
      start: view.start,
      total: items.length,
      pages: pageCount(items.length, perPage),
      label: pagerLabel(page, items.length, perPage),
    });
    return page;
  }

  return {
    setItems(next) {
      items = next || [];
      rendered = false;
      page = 1;
      return show(1, true);
    },
    go(nextPage) {
      return show(nextPage);
    },
    step(direction) {
      if (direction === "first") {
        return show(1);
      }

      if (direction === "last") {
        return show(pageCount(items.length, perPage));
      }

      return show(direction === "next" ? page + 1 : page - 1);
    },
    revealIndex(index) {
      return show(pageForIndex(index, perPage));
    },
    revealId(id) {
      const index = items.findIndex((item) => item.id === id);
      return index === -1 ? page : show(pageForIndex(index, perPage));
    },
    get page() {
      return page;
    },
    get total() {
      return items.length;
    },
    get perPage() {
      return perPage;
    },
  };
}
