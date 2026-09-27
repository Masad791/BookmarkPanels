# Privacy Policy for BookmarkPanels

**Last Updated:** September 2026

BookmarkPanels ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains our data handling practices.

---

### 1. Zero Personal Data Collection
BookmarkPanels does **not** collect, store, track, sell, or transmit any personally identifiable information (PII), browsing history, search queries, or analytics.

### 2. Local Data Storage Architecture
All data managed by BookmarkPanels is stored strictly on your local computer:
* **Bookmarks & Categories**: Kept locally using Chrome's native `chrome.storage.local` API and synchronized with your local Chrome bookmarks via `chrome.bookmarks`.
* **User Preferences**: Your aesthetic settings (brightness, blur, light/dark theme, panel coordinates) are stored only in your local browser storage.
* **No Remote Servers**: We do not operate external database servers, analytics platforms, or cloud sync servers.

### 3. Third-Party Icon (Favicon) Retrieval
To display site icons (favicons) next to saved bookmarks, the extension fetches icon images by querying domain hostnames using public favicon endpoints:
* Google Public Favicon Service (`https://www.google.com/s2/favicons?domain=...`)
* DuckDuckGo Icon Service (`https://icons.duckduckgo.com/ip3/...`) as a fallback

**Privacy Safeguard**: Only the base domain hostname (e.g., `github.com`) is queried. Full URLs, URL paths, query parameters, auth tokens, personal identifiers, and browsing activity are **never** included in these icon requests.

### 4. Permissions Used
BookmarkPanels requests only the minimal permissions required for its functionality:
* **`bookmarks`**: Required to display, organize, create, edit, and categorize bookmarks.
* **`storage`**: Required to save custom categories, layout coordinates, themes, and aesthetic preferences locally on your device.
* **`contextMenus`**: Allows right-clicking any page and choosing "Add to BookmarkPanels".
* **`activeTab`**: Used only when clicking the extension icon or adding the active page to your bookmarks.
* **Host Access (`<all_urls>`)**: Required to allow the customizable glassmorphic sidebar and floating bookmark panels to be toggled on web pages you browse via keyboard shortcut (`Alt+B`) or the edge tab. No webpage content is monitored, harvested, or transmitted.

### 5. Contact
If you have questions about this Privacy Policy, please open an issue on the official GitHub repository.
