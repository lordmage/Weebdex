// ==UserScript==
// @name         WeebDex++
// @namespace    Weebdex++
// @version      1.0.0
// @description  Manga tracker / filter system for WeebDex
// @namespace    https://weebdex.org/
// @match        https://weebdex.org/*
// @match        http://weebdex.org/*
// @icon         https://weebdex.org/favicon.ico
// @run-at       document-end
// @copyright    Lordmage 2026
// @namespace    https://github.com/lordmage/MangaDex-Combined
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
        }
    }

    // ==================== DOM UTILITIES ====================
    class DOMUtils {
        static extractEntryID(url) {
            const match = url.match(/title\/([^/]+)/);
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
    }

    // ==================== UI COMPONENTS ====================
    class UIComponents {
        constructor(state) {
            this.state = state;
        }

        createControlButton(text, bgColor, onClick) {
    const btn = DOMUtils.createElement('button', {
        className: 'weebdex-control-btn',
        textContent: text,
        onclick: onClick
    }, {
        backgroundColor: 'transparent', // Changed from bgColor to white
        padding: '4px 8px',
        border: '1px solid rgba(209, 213, 219, 0.5)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
        color: 'white',
        fontWeight: '500'
    });

    btn.addEventListener('mouseenter', () => {
        btn.style.opacity = '0.9';
        btn.style.transform = 'translateY(-1px)';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        btn.style.backgroundColor = 'transparent';

    });

    btn.addEventListener('mouseleave', () => {
        btn.style.opacity = '1';
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
        btn.style.backgroundColor = 'transparent'; // Back to white
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

            readBtn.addEventListener('click', (e) => this.handleReadClick(e, entryID));
            ignoreBtn.addEventListener('click', (e) => this.handleIgnoreClick(e, entryID));
            clearBtn.addEventListener('click', (e) => this.handleClearClick(e, entryID));

            container.appendChild(readBtn);
            container.appendChild(ignoreBtn);
            container.appendChild(clearBtn);

            return container;
        }

        handleReadClick(event, entryID) {
            localStorage.setItem(entryID, '1');
            this.updateButtonColors(event.currentTarget, CONFIG.BUTTON_COLORS.READ, 'transparent');
            window.weebdexApp.categorize();
        }

        handleIgnoreClick(event, entryID) {
            localStorage.setItem(entryID, '-1');
            this.updateButtonColors(event.currentTarget, CONFIG.BUTTON_COLORS.IGNORE, 'transparent', true);
            window.weebdexApp.categorize();
        }

        handleClearClick(event, entryID) {
            localStorage.removeItem(entryID);
            const container = event.currentTarget.parentNode;
            const readBtn = container.querySelector('.weebdex-read');
            const ignoreBtn = container.querySelector('.weebdex-ignore');
            if (readBtn) readBtn.style.backgroundColor = 'transparent';
            if (ignoreBtn) ignoreBtn.style.backgroundColor = 'transparent';
            window.weebdexApp.categorize();
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
        }

        async init() {
            this.addStyles();
            this.startObserver();
            this.addControlBar();

            setTimeout(() => this.mainLoop(), 1000);

            console.log('WeebDex++ v2.7 initialized');
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

        // ==================== CONTROL BAR ====================
        addControlBar() {
            // Try to integrate into header first
            if (this.tryHeaderIntegration()) {
                console.log('Control bar integrated into header');
                return;
            }

            // Fallback to floating control bar
            console.log('Falling back to floating control bar');
            this.addFloatingControlBar();
        }

        tryHeaderIntegration() {
            try {
                // Find the WeebDex logo
                const weebdexLogo = document.querySelector('a.text-xl.font-semibold[href="/"]');
                if (!weebdexLogo) {
                    console.log('WeebDex logo not found');
                    return false;
                }

                // Find the navigation container
                const navContainer = weebdexLogo.closest('nav');
                if (!navContainer) {
                    console.log('Navigation container not found');
                    return false;
                }

                // Find the flex-auto container (where search/other buttons are)
                const flexAutoContainer = navContainer.querySelector('.flex.flex-auto.shrink-0.items-center.justify-end.gap-1');
                if (!flexAutoContainer) {
                    console.log('Flex auto container not found');
                    return false;
                }

                // Check if controls already exist
                let controls = navContainer.querySelector('.weebdex-header-controls');
                if (controls) {
                    this.updateControlButtons(controls);
                    return true;
                }

                // Create header controls container
                controls = DOMUtils.createElement('div', {
                    className: 'weebdex-header-controls'
                });

                // Create control buttons
                const button1 = this.ui.createControlButton(
                    this.state.hideRead ? 'Read Hidden' : 'Read Shown',
                    //'white',
                    this.state.hideRead ? CONFIG.BUTTON_COLORS.READ : 'transparent',
                    () => {
                        DOMUtils.hideEntries();
                        this.state.hideRead = !this.state.hideRead;
                        button1.style.backgroundColor = this.state.hideRead ? CONFIG.BUTTON_COLORS.READ : 'transparent';
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
                    this.state.hideIgnore ? 'Ignore Hidden' : 'Ignore Shown',// 'white',
                  this.state.hideIgnore ? CONFIG.BUTTON_COLORS.IGNORE : 'transparent',
                    () => {
                        DOMUtils.hideEntries();
                        this.state.hideIgnore = !this.state.hideIgnore;
                        button2.style.backgroundColor = this.state.hideIgnore ? CONFIG.BUTTON_COLORS.IGNORE : 'transparent';
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
                    this.state.hideUnmarked ? 'Unmarked Hidden' : 'Unmarked Shown',//'white',
                    this.state.hideUnmarked ? CONFIG.BUTTON_COLORS.UNMARKED : 'transparent',
                    () => {
                        DOMUtils.hideEntries();
                        this.state.hideUnmarked = !this.state.hideUnmarked;
                        button3.style.backgroundColor = this.state.hideUnmarked ? CONFIG.BUTTON_COLORS.UNMARKED : 'transparent';
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
                        this.state.hideAllRead ? 'All Read Hidden' : 'All Read Shown',//'white',
                        this.state.hideAllRead ? CONFIG.BUTTON_COLORS.HIDE_ALL_READ : 'transparent',
                        () => {
                            DOMUtils.hideEntries();
                            this.state.hideAllRead = !this.state.hideAllRead;
                            button4.style.backgroundColor = this.state.hideAllRead ? CONFIG.BUTTON_COLORS.HIDE_ALL_READ : 'transparent';
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

                // Insert controls into header - after logo, before flex-auto container
                const logoParentDiv = weebdexLogo.closest('div.flex.shrink-0.items-center.gap-3');
                if (logoParentDiv && logoParentDiv.parentNode === navContainer) {
                    navContainer.insertBefore(controls, flexAutoContainer);
                } else {
                    weebdexLogo.parentNode.insertBefore(controls, flexAutoContainer);
                }

                return true;
            } catch (error) {
                console.error('Header integration failed:', error);
                return false;
            }
        }

        updateControlButtons(container) {
            const buttons = container.querySelectorAll('.weebdex-control-btn');
            const buttonConfigs = [
                { filter: 'hideRead', color: CONFIG.BUTTON_COLORS.READ, text: (v) => v ? "Read Hidden" : "Read Shown" },
                { filter: 'hideIgnore', color: CONFIG.BUTTON_COLORS.IGNORE, text: (v) => v ? "Ignore Hidden" : "Ignore Shown" },
                { filter: 'hideUnmarked', color: CONFIG.BUTTON_COLORS.UNMARKED, text: (v) => v ? "Unmarked Hidden" : "Unmarked Shown" }
            ];

            if (CONFIG.FEATURES.HIDE_ALL_READ) {
                buttonConfigs.push({ filter: 'hideAllRead', color: CONFIG.BUTTON_COLORS.HIDE_ALL_READ, text: (v) => v ? "All Read Hidden" : "All Read Shown" });
            }

            buttonConfigs.forEach((config, index) => {
                if (buttons[index]) {
                    const value = this.state[config.filter];
                    buttons[index].style.backgroundColor = value ? config.color : "transparent";
                    buttons[index].textContent = config.text(value);
                }
            });
        }

        addFloatingControlBar() {
            // Remove existing control bar if any
            const existingBar = document.querySelector('#weebdex-control-bar');
            if (existingBar) existingBar.remove();

            // Create control bar container
            const controlBar = DOMUtils.createElement('div', {
                id: 'weebdex-control-bar'
            }, {
                position: 'fixed',
                top: '10px',
                right: '10px',
                zIndex: '9999',
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '10px 15px',
                borderRadius: '8px',
                border: '1px solid rgba(229, 231, 235, 0.8)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
            });

            // Create filter buttons
            const button1 = this.ui.createControlButton(
                this.state.hideRead ? 'Read Hidden' : 'Read Shown',
                this.state.hideRead ? CONFIG.BUTTON_COLORS.READ : 'transparent',
                () => {
                    DOMUtils.hideEntries();
                    this.state.hideRead = !this.state.hideRead;
                    button1.style.backgroundColor = this.state.hideRead ? CONFIG.BUTTON_COLORS.READ : 'transparent';
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
                this.state.hideIgnore ? CONFIG.BUTTON_COLORS.IGNORE : 'transparent',
                () => {
                    DOMUtils.hideEntries();
                    this.state.hideIgnore = !this.state.hideIgnore;
                    button2.style.backgroundColor = this.state.hideIgnore ? CONFIG.BUTTON_COLORS.IGNORE : 'transparent';
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
                this.state.hideUnmarked ? CONFIG.BUTTON_COLORS.UNMARKED : 'transparent',
                () => {
                    DOMUtils.hideEntries();
                    this.state.hideUnmarked = !this.state.hideUnmarked;
                    button3.style.backgroundColor = this.state.hideUnmarked ? CONFIG.BUTTON_COLORS.UNMARKED : 'transparent';
                    button3.textContent = this.state.hideUnmarked ? 'Unmarked Hidden' : 'Unmarked Shown';

                    if (!this.state.hideUnmarked) {
                        DOMUtils.restoreAllElements(this);
                    }

                    this.categorize();
                    this.hideAllReadFunc();
                    DOMUtils.showEntries();
                }
            );

            controlBar.appendChild(button1);
            controlBar.appendChild(button2);
            controlBar.appendChild(button3);

            if (CONFIG.FEATURES.HIDE_ALL_READ) {
                const button4 = this.ui.createControlButton(
                    this.state.hideAllRead ? 'All Read Hidden' : 'All Read Shown',
                    this.state.hideAllRead ? CONFIG.BUTTON_COLORS.HIDE_ALL_READ : 'transparent',
                    () => {
                        DOMUtils.hideEntries();
                        this.state.hideAllRead = !this.state.hideAllRead;
                        button4.style.backgroundColor = this.state.hideAllRead ? CONFIG.BUTTON_COLORS.HIDE_ALL_READ : 'transparent';
                        button4.textContent = this.state.hideAllRead ? 'All Read Hidden' : 'All Read Shown';
                        this.hideAllReadFunc();
                        DOMUtils.showEntries();
                    }
                );
                controlBar.appendChild(button4);
            }

            // Add settings cog
            const settingsCog = this.createSettingsCog();
            controlBar.appendChild(settingsCog);

            document.body.appendChild(controlBar);
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

        // ==================== MANGA BUTTONS ====================
        addButtons() {
            // List format
            document.querySelectorAll('article.flex.gap-2.border-t-2.py-2').forEach(entry => {
                const link = entry.querySelector('h2.truncate.font-semibold a[href*="/title/"]');
                if (link && !entry.querySelector('.weebdex-tracker-btns')) {
                    const entryID = DOMUtils.extractEntryID(link.href);
                    if (entryID) this.addButtonsForElement(entryID, entry);
                }
            });

            // Thumbnail format
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

            // Detail page
            if (window.location.href.includes('/title/') && !window.location.href.includes('/title/random')) {
                const entry = document.querySelector('main,[role="main"]') || document.body;
                const entryID = DOMUtils.extractEntryID(window.location.href);
                if (entryID) this.addButtonsForElement(entryID, entry, true);
            }
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
        }        categorize() {
            const entries = document.querySelectorAll('article.flex.gap-2.border-t-2.py-2, article .group.list-card.flex.gap-4, [class*="manga-card"], .manga-card, .title-card');

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

        hideAllReadFunc() {
            if (!CONFIG.FEATURES.HIDE_ALL_READ) return;

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
    }

    // ==================== INITIALIZATION ====================
    window.weebdexApp = new WeebDexApp();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.weebdexApp.init();
        });
    } else {
        window.weebdexApp.init();
    }
})();
