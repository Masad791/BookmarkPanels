try {
  self.addEventListener('unhandledrejection', (event) => {
    if (event) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  });
} catch (e) {}

const PRESET_COLORS = [
  '#a8d8ea', '#b8d4e3', '#f4b9c2', '#545b6d',
  '#c4b7cb', '#b5ead7', '#e2d5f1', '#ffdac1',
  '#c7ceea', '#d4e6f1', '#f0e6ef', '#3e4451'
];

const DEFAULT_CATEGORY = () => ({
  id: 'cat-main',
  name: 'Main Bookmarks',
  color: '#a8d8ea',
  order: 0,
  collapsed: false,
  bookmarks: []
});

function isEligibleTab(tab) {
  if (!tab || !tab.id) return false;
  const u = tab.url || tab.pendingUrl || '';
  if (!u) return false;
  return u.startsWith('http://') ||
         u.startsWith('https://') ||
         u.startsWith(`chrome-extension://${chrome.runtime.id}/`);
}

async function safeSendMessage(tabId, message) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {}
}

let storageChain = Promise.resolve();

function withCategories(mutator) {
  const run = async () => {
    const data = await chrome.storage.local.get('categories');
    let categories = (data && data.categories) || [];
    if (categories.length === 0) categories = [DEFAULT_CATEGORY()];

    const result = await mutator(categories);

    await chrome.storage.local.set({ categories, hasInstalled: true });
    return { categories, result };
  };

  const next = storageChain.then(run, run);
  storageChain = next.catch(() => {});
  return next;
}

function getOrCreateCategory(categories, name, { createIfMissing = true } = {}) {
  const clean = (name || 'Bookmarks Bar').trim();
  let cat = categories.find(c => c.name.trim().toLowerCase() === clean.toLowerCase());
  if (!cat && createIfMissing) {
    cat = {
      id: 'cat-' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: clean,
      color: PRESET_COLORS[categories.length % PRESET_COLORS.length],
      order: categories.length,
      collapsed: false,
      bookmarks: []
    };
    categories.push(cat);
  }
  return cat;
}

function findBookmarkByUrl(categories, url) {
  for (const cat of categories) {
    const bm = (cat.bookmarks || []).find(b => b.url === url);
    if (bm) return { cat, bm };
  }
  return null;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['categories', 'hasInstalled'], (data) => {
    if (chrome.runtime.lastError) return;
    if (!data || !data.hasInstalled) {
      chrome.storage.local.set({
        categories: [DEFAULT_CATEGORY()],
        theme: 'dark',
        bpCards: true,
        hasInstalled: true
      });
    }
  });

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'add-to-bookmarkpanels',
      title: 'Add to BookmarkPanels',
      contexts: ['page']
    });
  });
});

chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (!bookmark || !bookmark.url) return;

  let folderName = null;
  if (bookmark.parentId) {
    try {
      const parents = await chrome.bookmarks.get(bookmark.parentId);
      if (parents && parents[0] && parents[0].title) {
        folderName = parents[0].title.trim();
      }
    } catch (e) {}
  }

  await withCategories((cats) => {
    let targetCat;
    if (folderName) {
      targetCat = getOrCreateCategory(cats, folderName);
    } else {
      targetCat = cats[0];
    }
    targetCat.bookmarks = targetCat.bookmarks || [];

    const exists = targetCat.bookmarks.some(b => b.url === bookmark.url);
    if (!exists) {
      targetCat.bookmarks.push({
        id: 'bm-' + Date.now() + Math.random().toString(36).slice(2, 6),
        title: bookmark.title || bookmark.url,
        url: bookmark.url,
        order: targetCat.bookmarks.length
      });
    }
  });
});

chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  const url = removeInfo && removeInfo.node && removeInfo.node.url;
  if (!url) return;

  await withCategories((cats) => {
    const hit = findBookmarkByUrl(cats, url);
    if (hit) {
      hit.cat.bookmarks = hit.cat.bookmarks.filter(b => b.url !== url);
      return true;
    }
    return false;
  });
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  if (!changeInfo || (!changeInfo.title && !changeInfo.url)) return;

  await withCategories((cats) => {
    for (const cat of cats) {
      for (const bm of (cat.bookmarks || [])) {
        if (changeInfo.url && bm.url === changeInfo.url) {
          if (changeInfo.title) bm.title = changeInfo.title;
          return true;
        }
      }
    }
    return false;
  });
});

chrome.bookmarks.onMoved.addListener(async () => {});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;

  if (!isEligibleTab(tab)) {
    try {
      await chrome.tabs.update(tab.id, { url: 'https://www.google.com' });
    } catch (e) {
      chrome.tabs.create({ url: 'https://www.google.com' }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
    return;
  }

  await safeSendMessage(tab.id, { action: 'toggle-panel' });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return false;

  switch (msg.action) {
    case 'broadcast-sync': {
      if (sendResponse) sendResponse({ success: true });
      return false;
    }

    case 'import-bookmarks': {
      handleImportBookmarks()
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'open-tab': {
      if (msg.url) {
        chrome.tabs.create({ url: msg.url }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
      return false;
    }

    default:
      return false;
  }
});

async function handleImportBookmarks() {
  const tree = await new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((t) => {
      if (chrome.runtime.lastError || !t) reject(new Error('Cannot read bookmarks'));
      else resolve(t);
    });
  });

  let importedCount = 0;

  const { categories } = await withCategories((cats) => {
    function walk(node, currentFolderTitle) {
      if (!node) return;
      if (node.url) {
        const targetTitle = currentFolderTitle || 'Bookmarks Bar';
        const cat = getOrCreateCategory(cats, targetTitle);
        cat.bookmarks = cat.bookmarks || [];
        const alreadyExists = cat.bookmarks.some(b => b.url === node.url);
        if (!alreadyExists) {
          cat.bookmarks.push({
            id: 'bm-' + Date.now() + Math.random().toString(36).slice(2, 6),
            title: node.title || node.url,
            url: node.url,
            order: cat.bookmarks.length
          });
          importedCount++;
        }
      } else if (node.children) {
        let folderName = currentFolderTitle;
        if (node.title) folderName = node.title;
        else if (node.id === '1') folderName = 'Bookmarks Bar';
        else if (node.id === '2') folderName = 'Other Bookmarks';
        else if (node.id === '3') folderName = 'Mobile Bookmarks';

        for (const child of node.children) walk(child, folderName);
      }
    }

    for (const rootNode of tree) walk(rootNode, null);

    return cats.filter(c => (c.bookmarks || []).length > 0);
  });

  return { success: true, count: importedCount, categories };
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'add-to-bookmarkpanels') return;
  const pageUrl = (tab && tab.url) || info.pageUrl;
  if (!pageUrl) return;

  await withCategories((cats) => {
    const target = cats[0];
    target.bookmarks = target.bookmarks || [];
    const exists = target.bookmarks.some(b => b.url === pageUrl);
    if (!exists) {
      target.bookmarks.push({
        id: 'bm-' + Date.now() + Math.random().toString(36).slice(2, 6),
        title: (tab && tab.title) || pageUrl,
        url: pageUrl,
        order: target.bookmarks.length
      });
    }
  });
});