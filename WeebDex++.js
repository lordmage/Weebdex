// ==UserScript==
// @name         WeebDex++
// @namespace    Weebdex++
// @version      1.0.1
// @description  Manga tracker / filter system for WeebDex
// @match        https://weebdex.org/*
// @match        http://weebdex.org/*
// @run-at       document-end
// @copyright    Lordmage 2026
// @author       @ lordmage
// @homepageURL  https://github.com/lordmage/Weebdex
// @updateURL    https://github.com/lordmage/Weebdex/raw/refs/heads/main/WeebDex++.js
// @downloadURL  https://github.com/lordmage/Weebdex/raw/refs/heads/main/WeebDex++.js
// @icon         https://icons.duckduckgo.com/ip2/www.weebdex.org.ico
// @grant        none
// ==/UserScript==


(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        BUTTON_COLORS: {
            READ: "#13ab493d",
            IGNORE: "#ab13133d",
            UNMARKED: "#4242cd3d",
            HIDE_ALL_READ: "#ff80003d"
        },
        FEATURES: {
            HIDE_ALL_READ: true,
            AUTO_MARK_READ: true
        }
    };

    // ==================== STATE ====================
    class StateManager {
        constructor() {
            this.hideRead = false;
            this.hideIgnore = true;
            this.hideUnmarked = false;
            this.hideAllRead = true;
            this.initialized = false;
            this.settingsOpen = false;
            this.observerTimer = null;
            this.lastUrl = null;
            this.removedElements = new Map();
            this.hiddenElements = new Map();
            this.headerIntegrationAttempted = false;
        }
    }

    // ==================== DOM UTILITIES ====================
    class DOMUtils {
        static extractEntryID(url) {
            const match = url.match(/title\/([^/]+)/);
            return match ? match[1] : null;
        }

        static extractChapterID(url) {
            const match = url.match(/chapter\/([^/]+)/);
            return match ? match[1] : null;
        }

        static toggleVisibility(element, on, appInstance) {
            if (!element || element.hasAttribute("hidden-override")) return;

            const entryID = this.getEntryIDFromElement(element);

            if (on) {
                if (appInstance.state.removedElements.has(entryID)) {
                    this.restoreElement(entryID, appInstance);
                } else if (appInstance.state.hiddenElements.has(entryID)) {
                    const hiddenElement = appInstance.state.hiddenElements.get(entryID);
                    hiddenElement.style.display = "";
                    hiddenElement.removeAttribute("hidden-override");
                    appInstance.state.hiddenElements.delete(entryID);
                }
            } else {
                const card = element.closest("article");
                const isSearchPage = window.location.href.includes('/search');

                if (isSearchPage && card && card.parentElement?.classList.contains("grid")) {
                    this.storeRemovedElement(entryID, card, appInstance);
                    card.remove();
                } else {
                    element.style.display = "none";
                    element.setAttribute("hidden-override", "true");
                    if (entryID) {
                        appInstance.state.hiddenElements.set(entryID, element);
                    }
                }
            }
        }

        static getEntryIDFromElement(element) {
            const readBtn = element.querySelector('.weebdex-read');
            if (readBtn) {
                return readBtn.getAttribute('entryid');
            }

            const link = element.querySelector('a[href*="/title/"]');
            if (link) {
                return this.extractEntryID(link.href);
            }

            return null;
        }

        static storeRemovedElement(entryID, element, appInstance) {
            if (!entryID) return;

            const parent = element.parentElement;
            const nextSibling = element.nextSibling;

            appInstance.state.removedElements.set(entryID, {
                element: element,
                parent: parent,
                nextSibling: nextSibling
            });
        }

        static restoreElement(entryID, appInstance) {
            if (!appInstance.state.removedElements.has(entryID)) return false;

            const { element, parent, nextSibling } = appInstance.state.removedElements.get(entryID);

            if (parent && document.body.contains(parent)) {
                if (nextSibling && nextSibling.parentNode === parent) {
                    parent.insertBefore(element, nextSibling);
                } else {
                    parent.appendChild(element);
                }

                appInstance.state.removedElements.delete(entryID);
                return true;
            }

            return false;
        }

        static restoreAllElements(appInstance) {
            let restoredCount = 0;

            for (const [entryID, data] of appInstance.state.removedElements.entries()) {
                if (this.restoreElement(entryID, appInstance)) {
                    restoredCount++;
                }
            }

            for (const [entryID, element] of appInstance.state.hiddenElements.entries()) {
                if (element && element.parentNode) {
                    element.style.display = "";
                    element.removeAttribute("hidden-override");
                    restoredCount++;
                }
            }

            appInstance.state.hiddenElements.clear();
            return restoredCount;
        }

        static hideEntries() {
            document.body.classList.add('weebdex-hiding');
        }

        static showEntries() {
            document.body.classList.remove('weebdex-hiding');
        }

        static createElement(tag, attributes = {}, styles = {}) {
            const element = document.createElement(tag);

            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'textContent') {
                    element.textContent = value;
                } else if (key === 'innerHTML') {
                    element.innerHTML = value;
                } else if (key === 'className') {
                    element.className = value;
                } else if (key.startsWith('on')) {
                    element.addEventListener(key.substring(2).toLowerCase(), value);
                } else {
                    element.setAttribute(key, value);
                }
            });

            Object.entries(styles).forEach(([key, value]) => {
                element.style[key] = value;
            });

            return element;
        }
    static isInSidebar(element) {
    return element.closest('[data-sidebar="content"]') !== null;
}
    }

    // ==================== UI COMPONENTS ====================
    class UIComponents {
        constructor(state) {
            this.state = state;
        }

        createControlButton(text, onClick) {
            const btn = DOMUtils.createElement('button', {
                className: 'weebdex-control-btn',
                textContent: text,
                onclick: onClick
            }, {
                backgroundColor: 'white',
                padding: '4px 8px',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                color: '#374151',
                fontWeight: '500'
            });

            btn.addEventListener('mouseenter', () => {
                btn.style.opacity = '0.9';
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                btn.style.backgroundColor = 'rgba(243, 244, 246, 0.5)';
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.opacity = '1';
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
                btn.style.backgroundColor = 'white';
            });

            return btn;
        }

        createTrackerButton(text, entryID, className) {
            const btn = DOMUtils.createElement('button', {
                className: `weebdex-btn ${className}`,
                entryid: entryID,
                textContent: text
            }, {
                backgroundColor: 'transparent',
                padding: '6px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s'
            });

            btn.addEventListener('mouseenter', () => btn.style.opacity = '0.8');
            btn.addEventListener('mouseleave', () => btn.style.opacity = '1');

            return btn;
        }

        createButtonContainer(entryID, isDetail = false) {
            const container = DOMUtils.createElement('div', {
                className: 'weebdex-tracker-btns'
            }, {
                display: 'flex',
                gap: isDetail ? '10px' : '5px',
                margin: isDetail ? '15px 0' : '8px 0'
            });

            const readBtn = this.createTrackerButton(isDetail ? 'Mark as Read' : 'Read', entryID, 'weebdex-read');
            const ignoreBtn = this.createTrackerButton(isDetail ? 'Ignore Manga' : 'Ignore', entryID, 'weebdex-ignore');
            const clearBtn = this.createTrackerButton(isDetail ? 'Clear Status' : 'Clear', entryID, 'weebdex-clear');

            // FIXED: Proper event handlers that don't interfere with each other
            readBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                localStorage.setItem(entryID, '1');
                this.updateButtonColors(readBtn, CONFIG.BUTTON_COLORS.READ, 'transparent');
                window.weebdexApp.categorize();
            });

            ignoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                localStorage.setItem(entryID, '-1');
                this.updateButtonColors(ignoreBtn, CONFIG.BUTTON_COLORS.IGNORE, 'transparent', true);
                window.weebdexApp.categorize();
            });

            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                localStorage.removeItem(entryID);
                const container = e.currentTarget.parentNode;
                const readBtn = container.querySelector('.weebdex-read');
                const ignoreBtn = container.querySelector('.weebdex-ignore');
                if (readBtn) readBtn.style.backgroundColor = 'transparent';
                if (ignoreBtn) ignoreBtn.style.backgroundColor = 'transparent';
                window.weebdexApp.categorize();
            });

            container.appendChild(readBtn);
            container.appendChild(ignoreBtn);
            container.appendChild(clearBtn);

            return container;
        }

        updateButtonColors(clickedBtn, clickedColor, otherColor, isIgnore = false) {
            const container = clickedBtn.parentNode;
            const readBtn = container.querySelector('.weebdex-read');
            const ignoreBtn = container.querySelector('.weebdex-ignore');
            clickedBtn.style.backgroundColor = clickedColor;
            if (isIgnore && readBtn) readBtn.style.backgroundColor = otherColor;
            if (!isIgnore && ignoreBtn) ignoreBtn.style.backgroundColor = otherColor;
        }
    }

    // ==================== MAIN APPLICATION ====================
    class WeebDexApp {
        constructor() {
            this.state = new StateManager();
            this.ui = new UIComponents(this.state);
            this.observer = null;
            this.headerObserver = null;
        }

        async init() {
            this.addStyles();
            this.startObserver();
            this.startHeaderObserver();

            // Try initial header integration
            setTimeout(() => this.tryHeaderIntegration(), 1000);

            setTimeout(() => this.mainLoop(), 1000);

            console.log('WeebDex++ v1.0.1 initialized');
        }

        addStyles() {
            const style = DOMUtils.createElement('style', {
                textContent: `
                    .weebdex-btn:hover { opacity: 0.8; transform: translateY(-1px); }
                    .weebdex-btn:active { transform: translateY(0); }
                    .weebdex-control-btn:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .weebdex-tracker-btns { animation: fadeIn 0.3s ease; }
                    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
                    body.weebdex-hiding article.flex.gap-2.border-t-2.py-2,
                    body.weebdex-hiding article .group.list-card.flex.gap-4,
                    body.weebdex-hiding [class*="manga-card"],
                    body.weebdex-hiding .manga-card,
                    body.weebdex-hiding .title-card {
                        display: none !important;
                    }
                    #weebdex-control-bar {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    }
                    #weebdex-settings-panel {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    }
                    .weebdex-header-controls {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        margin-left: 16px;
                        margin-right: 16px;
                        flex-wrap: wrap;
                        flex: 1;
                        justify-content: center;
                    }
                    .weebdex-manga-controls {
                        margin: 20px 0;
                        padding: 15px;
                        background: rgba(243, 244, 246, 0.3);
                        border-radius: 8px;
                        border: 1px solid rgba(209, 213, 219, 0.5);
                    }
                    .weebdex-chapter-read {
                        opacity: 0.5;
                    }
                `
            });
            document.head.appendChild(style);
        }

        startObserver() {
            this.observer = new MutationObserver((mutations) => {
                let addedNodes = [];
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) addedNodes.push(node);
                    }
                }

                if (addedNodes.length === 0) return;
                if (this.state.observerTimer) return;

                this.state.observerTimer = setTimeout(() => {
                    addedNodes.forEach(node => {
                        this.processNewNode(node);
                    });

                    if (this.state.hideAllRead) {
                        this.hideAllReadFunc();
                    }

                    this.state.observerTimer = null;
                }, 100);
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        startHeaderObserver() {
            this.headerObserver = new MutationObserver(() => {
                if (!this.state.headerIntegrationAttempted) {
                    this.tryHeaderIntegration();
                }
            });

            this.headerObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        processNewNode(node) {
            const entries = node.querySelectorAll?.('article.flex.gap-2.border-t-2.py-2, article .group.list-card.flex.gap-4, [class*="manga-card"], .manga-card, .title-card') || [];

            if (entries.length > 0) {
                entries.forEach(entry => {
                    if (entry.dataset.weebdexProcessed) return;
                    entry.dataset.weebdexProcessed = "1";

                    const link = entry.querySelector('a[href*="/title/"]');
                    if (link) {
                        const entryID = DOMUtils.extractEntryID(link.href);
                        if (entryID) {
                            this.addButtonsForElement(entryID, entry);
                        }
                    }
                });

                this.categorizeNode(node);
            }
        }

        categorizeNode(container) {
            const entries = container.querySelectorAll?.('article.flex.gap-2.border-t-2.py-2, article .group.list-card.flex.gap-4, [class*="manga-card"], .manga-card, .title-card') || [];

            entries.forEach(entry => {
                const readBtn = entry.querySelector('.weebdex-read');
                const ignoreBtn = entry.querySelector('.weebdex-ignore');

                if (readBtn && ignoreBtn) {
                    const entryID = readBtn.getAttribute('entryid');
                    const flag = localStorage.getItem(entryID);

                    if (flag === '1') {
                        readBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.READ;
                        ignoreBtn.style.backgroundColor = 'transparent';
                        DOMUtils.toggleVisibility(entry, !this.state.hideRead, this);
                    } else if (flag === '-1') {
                        readBtn.style.backgroundColor = 'transparent';
                        ignoreBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.IGNORE;
                        DOMUtils.toggleVisibility(entry, !this.state.hideIgnore, this);
                    } else {
                        readBtn.style.backgroundColor = 'transparent';
                        ignoreBtn.style.backgroundColor = 'transparent';
                        DOMUtils.toggleVisibility(entry, !this.state.hideUnmarked, this);
                    }
                }
            });
        }

        mainLoop() {
            if (!this.state.initialized) {
                this.state.initialized = true;
            }

            this.addButtons();
            this.categorize();

            if (CONFIG.FEATURES.AUTO_MARK_READ && window.location.href.includes('/chapter/')) {
                this.autoMarkReadOnChapter();
            }

            setTimeout(() => this.mainLoop(), 300);
        }

        // ==================== PAGE-SPECIFIC LOGIC ====================
        addButtons() {
            const currentPath = window.location.pathname;

            // Handle Search page (grid layout)
            if (currentPath.includes('/search')) {
                this.handleSearchPage();
            }
            // Handle Updates page (list layout)
            else if (currentPath.includes('/updates')) {
                this.handleUpdatesPage();
            }
            // Handle Title detail page
            else if (currentPath.includes('/title/') && !currentPath.includes('/title/random')) {
                this.handleTitlePage();
            }
            // Handle homepage and other pages
            else {
                this.handleGenericPages();
            }
        }

        handleSearchPage() {
    document.querySelectorAll('a[href*="/title/"]').forEach(link => {
        const entryID = DOMUtils.extractEntryID(link.href);
        if (!entryID) return
        if (DOMUtils.isInSidebar(link)) return;

        // Find the closest visual card container
        const entry =
            link.closest('article') ||
            link.closest('div[class*="card"]') ||
            link.closest('div');

        if (!entry) return;

        if (!entry.querySelector('.weebdex-tracker-btns')) {
            this.addButtonsForElement(entryID, entry);
        }
    });
}

        handleUpdatesPage() {
            // Updates page uses list layout with article.flex.gap-2.border-t-2.py-2
            document.querySelectorAll('article.flex.gap-2.border-t-2.py-2').forEach(entry => {
                const link = entry.querySelector('h2.truncate.font-semibold a[href*="/title/"]');
                if (link && !entry.querySelector('.weebdex-tracker-btns')) {
                    const entryID = DOMUtils.extractEntryID(link.href);
                    if (entryID) this.addButtonsForElement(entryID, entry);
                }
            });
        }

        handleTitlePage() {
            const entryID = DOMUtils.extractEntryID(window.location.href);
            if (!entryID) return;

            // Add manga controls before Synopsis
            this.addMangaControls(entryID);

            // Process chapters on title page
            this.processChaptersOnTitlePage();
        }

        handleGenericPages() {
            // Generic handling for homepage and other pages
            const thumbnailSelectors = [
                'article .group.list-card.flex.gap-4',
                '[class*="manga-card"]',
                '.manga-card',
                '.title-card'
            ].join(', ');

            document.querySelectorAll(thumbnailSelectors).forEach(entry => {
                let link = entry.querySelector('h3 a[href*="/title/"]');
                if (!link) link = entry.querySelector('a[href*="/title/"]');

                if (link && !entry.querySelector('.weebdex-tracker-btns')) {
                    const entryID = DOMUtils.extractEntryID(link.href);
                    if (entryID) this.addButtonsForElement(entryID, entry);
                }
            });
        }

        addMangaControls(entryID) {
            // Find the Synopsis section - look for <strong>Synopsis</strong>
            const synopsisElements = Array.from(document.querySelectorAll('strong')).filter(el =>
                el.textContent.trim() === 'Synopsis'
            );

            if (synopsisElements.length === 0) return;

            const synopsisSection = synopsisElements[0];

            // Check if controls already exist
            const existingControls = synopsisSection.parentElement?.querySelector('.weebdex-manga-controls');
            if (existingControls) return;

            // Create a container for manga controls
            const controlsContainer = DOMUtils.createElement('div', {
                className: 'weebdex-manga-controls'
            });

            // Add buttons
            const btnContainer = this.ui.createButtonContainer(entryID, true);
            controlsContainer.appendChild(btnContainer);

            // Insert before the Synopsis section
            const parent = synopsisSection.parentElement;
            if (parent) {
                parent.insertBefore(controlsContainer, synopsisSection);
            }
        }

        processChaptersOnTitlePage() {
            // Process chapters on title page to hide read ones
            const chapterArticles = document.querySelectorAll('article.relative.border-l-2');

            chapterArticles.forEach(chapterArticle => {
                const link = chapterArticle.querySelector('a[href*="/chapter/"]');
                if (!link) return;

                const chapterID = DOMUtils.extractChapterID(link.href) || link.getAttribute('href').split('/').pop();
                const isRead = localStorage.getItem(chapterID) === '1';

                if (isRead) {
                    chapterArticle.classList.add('weebdex-chapter-read');
                    if (this.state.hideAllRead) {
                        chapterArticle.style.display = 'none';
                        chapterArticle.setAttribute('hidden-override', 'true');
                    }
                } else {
                    chapterArticle.classList.remove('weebdex-chapter-read');
                    chapterArticle.style.display = '';
                    chapterArticle.removeAttribute('hidden-override');
                }
            });
        }

        addButtonsForElement(entryID, element, isDetail = false) {
            if (element.querySelector('.weebdex-tracker-btns')) return;

            let container = element.querySelector('div.w-0.flex-auto.space-y-1') ||
                           element.querySelector('.flex.w-0.flex-auto.flex-col') ||
                           element.querySelector('.manga-info, .card-content') ||
                           element;

            if (!container) return;

            const btnContainer = this.ui.createButtonContainer(entryID, isDetail);

            // Try to insert after title
            const titleElement = element.querySelector('h2.truncate.font-semibold') ||
                               element.querySelector('h3') ||
                               element.querySelector('h1');

            if (titleElement && titleElement.parentNode) {
                titleElement.parentNode.insertBefore(btnContainer, titleElement.nextSibling);
            } else {
                container.appendChild(btnContainer);
            }
        }

        categorize() {
            const currentPath = window.location.pathname;

            if (currentPath.includes('/search')) {
                this.categorizeSearchPage();
            } else if (currentPath.includes('/updates')) {
                this.categorizeUpdatesPage();
            } else if (currentPath.includes('/title/')) {
                this.categorizeTitlePage();
            } else {
                this.categorizeGenericPages();
            }
        }

        categorizeSearchPage() {
    document.querySelectorAll('a[href*="/title/"]').forEach(link => {
        const entry =
            link.closest('article') ||
            link.closest('div[class*="card"]') ||
            link.closest('div');

        if (!entry) return;

        const readBtn = entry.querySelector('.weebdex-read');
        const ignoreBtn = entry.querySelector('.weebdex-ignore');

        if (!readBtn || !ignoreBtn) return;

        const entryID = readBtn.getAttribute('entryid');
        const flag = localStorage.getItem(entryID);

        if (flag === '1') {
            readBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.READ;
            ignoreBtn.style.backgroundColor = 'transparent';
            DOMUtils.toggleVisibility(entry, !this.state.hideRead, this);
        } else if (flag === '-1') {
            readBtn.style.backgroundColor = 'transparent';
            ignoreBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.IGNORE;
            DOMUtils.toggleVisibility(entry, !this.state.hideIgnore, this);
        } else {
            readBtn.style.backgroundColor = 'transparent';
            ignoreBtn.style.backgroundColor = 'transparent';
            DOMUtils.toggleVisibility(entry, !this.state.hideUnmarked, this);
        }
    });
}

        categorizeUpdatesPage() {
            document.querySelectorAll('article.flex.gap-2.border-t-2.py-2').forEach(entry => {
                const readBtn = entry.querySelector('.weebdex-read');
                const ignoreBtn = entry.querySelector('.weebdex-ignore');

                if (readBtn && ignoreBtn) {
                    const entryID = readBtn.getAttribute('entryid');
                    const flag = localStorage.getItem(entryID);

                    if (flag === '1') {
                        readBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.READ;
                        ignoreBtn.style.backgroundColor = 'transparent';
                        DOMUtils.toggleVisibility(entry, !this.state.hideRead, this);
                    } else if (flag === '-1') {
                        readBtn.style.backgroundColor = 'transparent';
                        ignoreBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.IGNORE;
                        DOMUtils.toggleVisibility(entry, !this.state.hideIgnore, this);
                    } else {
                        readBtn.style.backgroundColor = 'transparent';
                        ignoreBtn.style.backgroundColor = 'transparent';
                        DOMUtils.toggleVisibility(entry, !this.state.hideUnmarked, this);
                    }
                }
            });
        }

        categorizeTitlePage() {
            // On title page, we don't hide the main content, just chapters
            const entryID = DOMUtils.extractEntryID(window.location.href);
            if (!entryID) return;

            const flag = localStorage.getItem(entryID);
            const controls = document.querySelector('.weebdex-manga-controls');
            if (controls) {
                const readBtn = controls.querySelector('.weebdex-read');
                const ignoreBtn = controls.querySelector('.weebdex-ignore');

                if (readBtn && ignoreBtn) {
                    if (flag === '1') {
                        readBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.READ;
                        ignoreBtn.style.backgroundColor = 'transparent';
                    } else if (flag === '-1') {
                        readBtn.style.backgroundColor = 'transparent';
                        ignoreBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.IGNORE;
                    } else {
                        readBtn.style.backgroundColor = 'transparent';
                        ignoreBtn.style.backgroundColor = 'transparent';
                    }
                }
            }
        }

        categorizeGenericPages() {
            const thumbnailSelectors = [
                'article .group.list-card.flex.gap-4',
                '[class*="manga-card"]',
                '.manga-card',
                '.title-card'
            ].join(', ');

            document.querySelectorAll(thumbnailSelectors).forEach(entry => {
                const readBtn = entry.querySelector('.weebdex-read');
                const ignoreBtn = entry.querySelector('.weebdex-ignore');

                if (readBtn && ignoreBtn) {
                    const entryID = readBtn.getAttribute('entryid');
                    const flag = localStorage.getItem(entryID);

                    if (flag === '1') {
                        readBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.READ;
                        ignoreBtn.style.backgroundColor = 'transparent';
                        DOMUtils.toggleVisibility(entry, !this.state.hideRead, this);
                    } else if (flag === '-1') {
                        readBtn.style.backgroundColor = 'transparent';
                        ignoreBtn.style.backgroundColor = CONFIG.BUTTON_COLORS.IGNORE;
                        DOMUtils.toggleVisibility(entry, !this.state.hideIgnore, this);
                    } else {
                        readBtn.style.backgroundColor = 'transparent';
                        ignoreBtn.style.backgroundColor = 'transparent';
                        DOMUtils.toggleVisibility(entry, !this.state.hideUnmarked, this);
                    }
                }
            });
        }

        hideAllReadFunc() {
            if (!CONFIG.FEATURES.HIDE_ALL_READ) return;

            // Handle different page types
            const currentPath = window.location.pathname;

            if (currentPath.includes('/updates')) {
                this.hideAllReadOnUpdatesPage();
            } else if (currentPath.includes('/title/')) {
                this.hideAllReadOnTitlePage();
            } else {
                this.hideAllReadGeneric();
            }
        }

        hideAllReadOnUpdatesPage() {
            const mangaArticles = document.querySelectorAll('article.flex.gap-2.border-t-2.py-2');

            mangaArticles.forEach(mangaArticle => {
                const chapterArticles = mangaArticle.querySelectorAll('article.relative.border-l-2');
                if (chapterArticles.length === 0) return;

                let allRead = true;
                chapterArticles.forEach(chapterArticle => {
                    const link = chapterArticle.querySelector('a[href*="/chapter/"]');
                    if (!link) return;
                    const entryID = link.getAttribute('href').split('/').pop();

                    const isReadLS = localStorage.getItem(entryID) === '1';
                    const svg = chapterArticle.querySelector('button svg');
                    const isReadSVG = svg && svg.classList.contains('lucide-eye-off');
                    const isRead = isReadLS || isReadSVG;

                    if (isRead) {
                        chapterArticle.style.display = 'none';
                        chapterArticle.setAttribute('hidden-override', 'true');
                    } else {
                        chapterArticle.style.display = '';
                        chapterArticle.removeAttribute('hidden-override');
                        allRead = false;
                    }
                });

                if (this.state.hideAllRead && allRead) {
                    mangaArticle.style.display = 'none';
                    mangaArticle.setAttribute('hidden-override', 'true');
                } else {
                    mangaArticle.style.display = '';
                    mangaArticle.removeAttribute('hidden-override');
                }
            });
        }

        hideAllReadOnTitlePage() {
            // Already handled in processChaptersOnTitlePage
            this.processChaptersOnTitlePage();
        }

        hideAllReadGeneric() {
            const mangaArticles = document.querySelectorAll('article.flex.gap-2.border-t-2.py-2');

            mangaArticles.forEach(mangaArticle => {
                const chapterArticles = mangaArticle.querySelectorAll('article.relative.border-l-2');
                if (chapterArticles.length === 0) return;

                let allRead = true;
                chapterArticles.forEach(chapterArticle => {
                    const link = chapterArticle.querySelector('a[href*="/chapter/"]');
                    if (!link) return;
                    const entryID = link.getAttribute('href').split('/').pop();

                    const isReadLS = localStorage.getItem(entryID) === '1';
                    const svg = chapterArticle.querySelector('button svg');
                    const isReadSVG = svg && svg.classList.contains('lucide-eye-off');
                    const isRead = isReadLS || isReadSVG;

                    if (isRead) {
                        chapterArticle.style.display = 'none';
                        chapterArticle.setAttribute('hidden-override', 'true');
                    } else {
                        chapterArticle.style.display = '';
                        chapterArticle.removeAttribute('hidden-override');
                        allRead = false;
                    }
                });

                if (this.state.hideAllRead && allRead) {
                    mangaArticle.style.display = 'none';
                    mangaArticle.setAttribute('hidden-override', 'true');
                } else {
                    mangaArticle.style.display = '';
                    mangaArticle.removeAttribute('hidden-override');
                }
            });
        }

        autoMarkReadOnChapter() {
            if (!CONFIG.FEATURES.AUTO_MARK_READ) return;

            const pathParts = window.location.pathname.split('/');
            if (pathParts.length >= 3) {
                const chapterPart = pathParts[2];
                const mangaId = chapterPart.split('-')[0];
                const chapterId = chapterPart.split('-')[1];
                if (chapterId) localStorage.setItem(chapterId, '1');
                if (mangaId) localStorage.setItem(mangaId, '1');
            }
        }

        clearElementTracking() {
            this.state.removedElements.clear();
            this.state.hiddenElements.clear();
        }

        // ==================== HEADER INTEGRATION ====================
        tryHeaderIntegration() {
            if (this.state.headerIntegrationAttempted) return false;

            try {
                // Look for header elements - SvelteKit apps often have different structures
                const headerSelectors = [
                    'header',
                    'nav',
                    '[role="navigation"]',
                    '.header',
                    '.navigation',
                    'div[class*="header"]',
                    'div[class*="nav"]'
                ];

                let header = null;
                for (const selector of headerSelectors) {
                    header = document.querySelector(selector);
                    if (header) break;
                }

                if (!header) {
                    console.log('No header found');
                    return false;
                }

                // Look for WeebDex logo - try multiple selectors
                const logoSelectors = [
                    'a[href="/"]',
                    'a[href="/"] span',
                    'a[href="/"] .logo',
                    '[class*="logo"] a',
                    'a.text-xl',
                    'a.font-semibold'
                ];

                let logo = null;
                for (const selector of logoSelectors) {
                    logo = header.querySelector(selector);
                    if (logo) break;
                }

                if (!logo) {
                    console.log('WeebDex logo not found in header');
                    return false;
                }

                // Check if controls already exist
                let controls = header.querySelector('.weebdex-header-controls');
                if (controls) {
                    this.updateControlButtons(controls);
                    this.state.headerIntegrationAttempted = true;
                    return true;
                }

                // Create header controls container
                controls = DOMUtils.createElement('div', {
                    className: 'weebdex-header-controls'
                });

                // Create control buttons
                const button1 = this.ui.createControlButton(
                    this.state.hideRead ? 'Read Hidden' : 'Read Shown',
                    () => {
                        DOMUtils.hideEntries();
                        this.state.hideRead = !this.state.hideRead;
                        button1.textContent = this.state.hideRead ? 'Read Hidden' : 'Read Shown';

                        if (!this.state.hideRead) {
                            DOMUtils.restoreAllElements(this);
                        }

                        this.categorize();
                        this.hideAllReadFunc();
                        DOMUtils.showEntries();
                    }
                );

                const button2 = this.ui.createControlButton(
                    this.state.hideIgnore ? 'Ignore Hidden' : 'Ignore Shown',
                    () => {
                        DOMUtils.hideEntries();
                        this.state.hideIgnore = !this.state.hideIgnore;
                        button2.textContent = this.state.hideIgnore ? 'Ignore Hidden' : 'Ignore Shown';

                        if (!this.state.hideIgnore) {
                            DOMUtils.restoreAllElements(this);
                        }

                        this.categorize();
                        this.hideAllReadFunc();
                        DOMUtils.showEntries();
                    }
                );

                const button3 = this.ui.createControlButton(
                    this.state.hideUnmarked ? 'Unmarked Hidden' : 'Unmarked Shown',
                    () => {
                        DOMUtils.hideEntries();
                        this.state.hideUnmarked = !this.state.hideUnmarked;
                        button3.textContent = this.state.hideUnmarked ? 'Unmarked Hidden' : 'Unmarked Shown';

                        if (!this.state.hideUnmarked) {
                            DOMUtils.restoreAllElements(this);
                        }

                        this.categorize();
                        this.hideAllReadFunc();
                        DOMUtils.showEntries();
                    }
                );

                controls.appendChild(button1);
                controls.appendChild(button2);
                controls.appendChild(button3);

                if (CONFIG.FEATURES.HIDE_ALL_READ) {
                    const button4 = this.ui.createControlButton(
                        this.state.hideAllRead ? 'All Read Hidden' : 'All Read Shown',
                        () => {
                            DOMUtils.hideEntries();
                            this.state.hideAllRead = !this.state.hideAllRead;
                            button4.textContent = this.state.hideAllRead ? 'All Read Hidden' : 'All Read Shown';
                            this.hideAllReadFunc();
                            DOMUtils.showEntries();
                        }
                    );
                    controls.appendChild(button4);
                }

                // Add settings cog
                const settingsCog = this.createSettingsCog();
                controls.appendChild(settingsCog);

                // Insert controls after the logo
                const logoParent = logo.parentElement;
                if (logoParent) {
                    logoParent.insertBefore(controls, logo.nextSibling);
                } else {
                    header.insertBefore(controls, logo.nextSibling);
                }

                this.state.headerIntegrationAttempted = true;
                console.log('Control bar integrated into header');
                return true;

            } catch (error) {
                console.error('Header integration failed:', error);
                return false;
            }
        }


              updateControlButtons(container) {
            const buttons = container.querySelectorAll('.weebdex-control-btn');
            const buttonConfigs = [
                { filter: 'hideRead', text: (v) => v ? "Read Hidden" : "Read Shown" },
                { filter: 'hideIgnore', text: (v) => v ? "Ignore Hidden" : "Ignore Shown" },
                { filter: 'hideUnmarked', text: (v) => v ? "Unmarked Hidden" : "Unmarked Shown" }
            ];

            if (CONFIG.FEATURES.HIDE_ALL_READ) {
                buttonConfigs.push({ filter: 'hideAllRead', text: (v) => v ? "All Read Hidden" : "All Read Shown" });
            }

            buttonConfigs.forEach((config, index) => {
                if (buttons[index]) {
                    const value = this.state[config.filter];
                    buttons[index].textContent = config.text(value);
                }
            });
        }

        createSettingsCog() {
            const cog = DOMUtils.createElement('button', {
                innerHTML: '⚙',
                title: 'Settings',
                onclick: (e) => {
                    e.stopPropagation();
                    this.toggleSettings();
                }
            }, {
                background: 'transparent',
                border: '1px solid rgba(209, 213, 219, 0.5)',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '6px 12px',
                fontSize: '14px',
                color: '#6b7280',
                transition: 'all 0.2s'
            });

            cog.addEventListener('mouseenter', () => {
                cog.style.color = '#374151';
                cog.style.backgroundColor = 'rgba(243, 244, 246, 0.5)';
            });

            cog.addEventListener('mouseleave', () => {
                cog.style.color = '#6b7280';
                cog.style.backgroundColor = 'transparent';
            });

            return cog;
        }

        toggleSettings() {
            let settingsPanel = document.querySelector('#weebdex-settings-panel');

            if (this.state.settingsOpen) {
                if (settingsPanel) settingsPanel.remove();
                this.state.settingsOpen = false;
                return;
            }

            if (!settingsPanel) {
                settingsPanel = this.createSettingsPanel();
                document.body.appendChild(settingsPanel);
            }

            this.state.settingsOpen = true;
        }

        createSettingsPanel() {
            const panel = DOMUtils.createElement('div', {
                id: 'weebdex-settings-panel'
            }, {
                position: 'fixed',
                top: '60px',
                right: '10px',
                zIndex: '10000',
                background: 'white',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: '250px',
                maxWidth: '300px',
                maxHeight: '80vh',
                overflowY: 'auto'
            });

            const title = DOMUtils.createElement('div', {
                textContent: 'WeebDex++ Settings'
            }, {
                fontWeight: '600',
                fontSize: '16px',
                color: '#374151',
                marginBottom: '16px',
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: '8px'
            });
            panel.appendChild(title);

            // Export button
            const exportBtn = DOMUtils.createElement('button', {
                textContent: '📤 Export Data',
                onclick: () => this.exportData()
            }, {
                width: '100%',
                padding: '10px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: '8px',
                transition: 'background-color 0.2s'
            });

            exportBtn.addEventListener('mouseenter', () => exportBtn.style.backgroundColor = '#0da271');
            exportBtn.addEventListener('mouseleave', () => exportBtn.style.backgroundColor = '#10b981');

            // Import button
            const importBtn = DOMUtils.createElement('button', {
                textContent: '📥 Import Data',
                onclick: () => this.importData()
            }, {
                width: '100%',
                padding: '10px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: '8px',
                transition: 'background-color 0.2s'
            });

            importBtn.addEventListener('mouseenter', () => importBtn.style.backgroundColor = '#d97706');
            importBtn.addEventListener('mouseleave', () => importBtn.style.backgroundColor = '#f59e0b');

            // Close button
            const closeBtn = DOMUtils.createElement('button', {
                textContent: 'Close',
                onclick: () => this.toggleSettings()
            }, {
                width: '100%',
                padding: '10px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background-color 0.2s'
            });

            closeBtn.addEventListener('mouseenter', () => closeBtn.style.backgroundColor = '#dc2626');
            closeBtn.addEventListener('mouseleave', () => closeBtn.style.backgroundColor = '#ef4444');

            panel.appendChild(exportBtn);
            panel.appendChild(importBtn);
            panel.appendChild(closeBtn);

            // Close panel when clicking outside
            document.addEventListener('click', (e) => {
                const isSettingsCog = e.target.closest('button[title="Settings"]');
                if (!panel.contains(e.target) && !isSettingsCog) {
                    if (this.state.settingsOpen) {
                        this.toggleSettings();
                    }
                }
            });

            return panel;
        }

        exportData() {
            try {
                const data = {};

                // Export all localStorage items
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        data[key] = localStorage.getItem(key);
                    }
                }

                const dataStr = JSON.stringify(data, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = 'weebdex_data.json';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                alert('Data exported successfully!');
            } catch (e) {
                alert('Export failed: ' + e.message);
            }
        }

        importData() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        Object.entries(data).forEach(([key, value]) => {
                            localStorage.setItem(key, value);
                        });
                        alert('Data imported successfully! Page will refresh.');
                        setTimeout(() => location.reload(), 1000);
                    } catch (err) {
                        alert('Error importing data: ' + err.message);
                    }
                };
                reader.readAsText(file);
            };

            input.click();
        }
    }

    // ==================== INITIALIZATION ====================
    window.weebdexApp = new WeebDexApp();

    // Wait for SvelteKit to load content
    const waitForSvelteKit = () => {
        // Check if SvelteKit has loaded content
        const hasContent = document.querySelector('nav, header, [role="navigation"]') ||
                          document.querySelector('main, [role="main"]') ||
                          document.querySelector('article, .manga-card, .title-card');

        if (hasContent) {
            window.weebdexApp.init();
        } else {
            // Use MutationObserver to wait for content
            const observer = new MutationObserver((mutations, obs) => {
                const content = document.querySelector('nav, header, [role="navigation"], main, [role="main"], article, .manga-card, .title-card');
                if (content) {
                    obs.disconnect();
                    setTimeout(() => window.weebdexApp.init(), 500);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Fallback timeout
            setTimeout(() => {
                observer.disconnect();
                window.weebdexApp.init();
            }, 5000);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForSvelteKit);
    } else {
        waitForSvelteKit();
    }
})();
