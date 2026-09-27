try {
  window.addEventListener('unhandledrejection', (event) => {
    if (event && event.reason && String(event.reason.message || event.reason).includes('Extension context invalidated')) {
      event.preventDefault();
    }
  });
} catch (e) {}

let categories = [];

function getFaviconUrl(url) {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, '');
    if (!domain) return '../icons/icon.svg';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch {
    return '../icons/icon.svg';
  }
}

function shortHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function broadcastSync(type, data) {
  try {
    chrome.runtime.sendMessage({
      action: 'broadcast-sync',
      payload: { type, [type]: data, timestamp: Date.now() }
    }).catch(() => {});
  } catch {}
}

let overlayEnabled = true;

async function init() {
  const data = await chrome.storage.local.get(['categories', 'theme', 'overlayEnabled']);
  if (data.theme) {
    document.documentElement.setAttribute('data-theme', data.theme);
  }
  
  overlayEnabled = data.overlayEnabled !== false;
  updateOverlayBtn();

  const toggleBtn = document.getElementById('toggleOverlayBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      overlayEnabled = !overlayEnabled;
      updateOverlayBtn();
      await chrome.storage.local.set({ overlayEnabled });
      broadcastSync('overlayEnabled', overlayEnabled);
    });
  }

  categories = data.categories || [];
  
  const select = document.getElementById('categorySelect');
  select.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });

  renderCategories();
}

function updateOverlayBtn() {
  const btn = document.getElementById('toggleOverlayBtn');
  if (!btn) return;
  if (overlayEnabled) {
    btn.textContent = 'Overlay: ON';
    btn.classList.remove('off');
    btn.title = 'Turn Off';
  } else {
    btn.textContent = 'Overlay: OFF';
    btn.classList.add('off');
    btn.title = 'Turn On';
  }
}

function renderCategories(searchTerm = '') {
  const list = document.getElementById('categoryList');
  list.innerHTML = '';
  
  categories.forEach(cat => {
    const matches = (cat.bookmarks || []).filter(b => 
      (b.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (b.url || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (searchTerm && matches.length === 0) return;
    
    const div = document.createElement('div');
    div.className = 'cat-item';
    if (searchTerm) div.classList.add('expanded');
    
    div.innerHTML = `
      <div class="cat-header">
        <span>${cat.name}</span>
        <span style="color: ${cat.color}">${matches.length}</span>
      </div>
      <div class="bm-list">
        ${matches.map(bm => `
          <a href="${bm.url}" class="bm-item" target="_blank">
            <img src="${getFaviconUrl(bm.url)}" class="bp-pop-fav" data-url="${bm.url}" alt="">
            <span>${bm.title}</span>
          </a>
        `).join('')}
      </div>
    `;

    div.querySelectorAll('.bp-pop-fav').forEach(img => {
      img.addEventListener('error', function () {
        const host = shortHost(img.dataset.url || '');
        if (host && !img.dataset.fallbackTried) {
          img.dataset.fallbackTried = 'true';
          img.src = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
        } else {
          img.src = '../icons/icon.svg';
        }
      }, { once: true });
    });
    
    div.querySelector('.cat-header').addEventListener('click', () => {
      div.classList.toggle('expanded');
    });
    
    list.appendChild(div);
  });
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  renderCategories(e.target.value);
});

document.getElementById('openDashboardBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.google.com' }).catch(() => {});
});

document.getElementById('addCurrentBtn').addEventListener('click', async () => {
  const catId = document.getElementById('categorySelect').value;
  if (!catId) return;
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (tab) {
    const catIndex = categories.findIndex(c => c.id === catId);
    if (catIndex > -1) {
      categories[catIndex].bookmarks.push({
        id: 'bm-' + Date.now(),
        title: tab.title,
        url: tab.url,
        order: categories[catIndex].bookmarks.length
      });
      await chrome.storage.local.set({ categories });
      broadcastSync('categories', categories);
      renderCategories();
      
      const btn = document.getElementById('addCurrentBtn');
      const originalText = btn.textContent;
      btn.textContent = 'Added!';
      setTimeout(() => btn.textContent = originalText, 1000);
    }
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.categories) {
    categories = changes.categories.newValue || [];
    renderCategories();
  }
  if (changes.theme) {
    document.documentElement.setAttribute('data-theme', changes.theme.newValue || 'dark');
  }
  if (changes.overlayEnabled !== undefined) {
    overlayEnabled = changes.overlayEnabled.newValue !== false;
    updateOverlayBtn();
  }
});

init();
