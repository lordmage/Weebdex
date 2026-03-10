// ==UserScript==
// @name         WeebDex++
// @namespace    https://weebdex.org/
// @version      1.0.1
// @description  Enhanced QOL for WeebDex - Advanced tracking, filtering, blocking, keyboard shortcuts, and more. Now hides both read chapters and manga articles when all chapters are read.
// @author       WeebDex++
// @match        https://weebdex.org/*
// @match        http://weebdex.org/*
// @icon         https://weebdex.org/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    //------------------CONFIG----------------//
    const POLLING_TIME = 300;
    const API_REQUEST_INTERVAL = 1000;
    const READ_BUTTON_COLOR = "#13ab493d";
    const IGNORE_BUTTON_COLOR = "#ab13133d";
    const UNMARKED_BUTTON_COLOR = "#4242cd3d";
    const HIDE_ALL_READ_BUTTON_COLOR = "#ff80003d";
    const TAG_BLOCK_COLOR = "#ff6b6b3d";
    const DOES_HIDE_ALL_READ = true;

    let hideRead = false;
    let hideIgnore = true;
    let hideUnmarked = false;
    let hideAllRead = true;
    let forceRecheckNewEntry = false;
    let queue = [];
    let initialized = false;
    let settingsOpen = false;
    let autoMarkRead = true;
    let hideObserverRunning = false;
    let observerTimer = null;
    const queuedIDs = new Set();

    const USER_LIST = [];
    const GROUP_LIST = [];
    const TAG_LIST = ["boys' love"];

    const CATEGORY_UPDATES = "https://weebdex.org/updates";
    const CATEGORY_SEARCH = "https://weebdex.org/search?sort=createdAt";
    const CATEGORY_TITLE = "https://weebdex.org/title/";
    const CATEGORY_AUTHOR = "https://weebdex.org/author/";
    const CATEGORY_GROUP = "https://weebdex.org/group/";
    const CATEGORY_TAG = "https://weebdex.org/tag/";
    const CATEGORY_CHAPTER = "https://weebdex.org/chapter/";

    const FORMAT_NOT_FOUND = 0;
    const FORMAT_LIST = 1;
    const FORMAT_THUMBNAIL = 2;
    const FORMAT_DETAIL = 3;

    let allTags = [];

    // Config storage functions
    function getConfig(key, defaultValue) {
        return GM_getValue(key, defaultValue);
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }

    function fetchTags() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://api.weebdex.org/manga/tag?limit=100',
                headers: {
                    'Referer': 'https://weebdex.org/'
                },
                onload: function(res) {
                    try {
                        const data = JSON.parse(res.responseText);
                        allTags = data.data.map(tag => tag.name.toLowerCase()).sort();
                        resolve(allTags);
                    } catch (err) {
                        console.error('Failed to parse tags', err);
                        allTags = [];
                        resolve([]);
                    }
                },
                onerror: function(err) {
                    console.error('Failed to fetch tags', err);
                    allTags = [];
                    resolve([]);
                }
            });
        });
    }

    //------------------UTILS----------------//
    function getFormat(href) {
    if (href.startsWith("https://weebdex.org/title/")) return 3; // FORMAT_DETAIL
    if (href.startsWith("https://weebdex.org/group")) return 2; // FORMAT_THUMBNAIL
    if (href.startsWith("https://weebdex.org/author")) return 2;
    if (href.startsWith("https://weebdex.org/tag")) return 2;
    if (href.startsWith("https://weebdex.org/updates")) return 1; // FORMAT_LIST
    if (href.startsWith("https://weebdex.org/search?sort=createdAt")) return 1; // FORMAT_LIST for recent feed
    if (href.startsWith("https://weebdex.org/search")) return 2;
    return 2;
}
    function extractEntryID(url) {
        const match = url.match(/title\/([^/]+)/);
        return match ? match[1] : null;
    }

    function toggleVisibility(element, on) {
        if (!element || element.hasAttribute("hidden-override")) return;
        // avoid unnecessary style changes which can cause flicker
        const currentlyVisible = element.style.display !== "none";
        if (currentlyVisible === on) return;
        element.style.display = on ? "" : "none";
    }

    function hideEntries() {
        document.body.classList.add('weebdex-hiding');
    }
function addControllers() {
    let ele = document.querySelector("#weebdex-controls");
    if (!ele) {
        ele = document.createElement("div");
        ele.id = "weebdex-controls";
        ele.style.cssText = `
            position: fixed; top: 70px; right: 10px; z-index: 9999;
            background: white; padding: 12px; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); border:1px solid #e5e7eb;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            min-width:180px; max-width:220px;
        `;
        document.body.appendChild(ele);

        // Header with title and settings cog
        const header = document.createElement("div");
        header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;";

        const title = document.createElement("div");
        title.textContent = "WeebDex++ Controls";
        title.style.cssText = "font-weight:600;font-size:14px;color:#374151;";

        const settingsBtn = document.createElement("button");
        settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        settingsBtn.style.cssText = "background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;color:#6b7280;";
        settingsBtn.addEventListener("mouseenter", () => settingsBtn.style.color = "#374151");
        settingsBtn.addEventListener("mouseleave", () => settingsBtn.style.color = "#6b7280");
        settingsBtn.addEventListener("click", toggleSettings);

        header.appendChild(title);
        header.appendChild(settingsBtn);
        ele.appendChild(header);
    }

    if (ele.querySelector(".control-btn")) return;

    const controlsContainer = document.createElement("div");
    controlsContainer.style.cssText = "display:flex;flex-direction:column;gap:6px;";

    const button1 = createControlButton(hideRead ? "Read Hidden" : "Read Shown", hideRead ? READ_BUTTON_COLOR : "transparent", () => { hideEntries(); hideRead = !hideRead; button1.style.backgroundColor = hideRead ? READ_BUTTON_COLOR : "transparent"; button1.textContent = hideRead ? "Read Hidden" : "Read Shown"; categorize(getFormat(window.location.href), window.location.href === CATEGORY_UPDATES); hideAllReadFunc(); document.body.classList.remove('weebdex-hiding'); });
    const button2 = createControlButton(hideIgnore ? "Ignore Hidden" : "Ignore Shown", hideIgnore ? IGNORE_BUTTON_COLOR : "transparent", () => { hideEntries(); hideIgnore = !hideIgnore; button2.style.backgroundColor = hideIgnore ? IGNORE_BUTTON_COLOR : "transparent"; button2.textContent = hideIgnore ? "Ignore Hidden" : "Ignore Shown"; categorize(getFormat(window.location.href), window.location.href === CATEGORY_UPDATES); hideAllReadFunc(); document.body.classList.remove('weebdex-hiding'); });
    const button3 = createControlButton(hideUnmarked ? "Unmarked Hidden" : "Unmarked Shown", hideUnmarked ? UNMARKED_BUTTON_COLOR : "transparent", () => { hideEntries(); hideUnmarked = !hideUnmarked; button3.style.backgroundColor = hideUnmarked ? UNMARKED_BUTTON_COLOR : "transparent"; button3.textContent = hideUnmarked ? "Unmarked Hidden" : "Unmarked Shown"; categorize(getFormat(window.location.href), window.location.href === CATEGORY_UPDATES); hideAllReadFunc(); document.body.classList.remove('weebdex-hiding'); });
    const button4 = createControlButton(hideAllRead ? "All Read Hidden" : "All Read Shown", hideAllRead ? HIDE_ALL_READ_BUTTON_COLOR : "transparent", () => { hideEntries(); hideAllRead = !hideAllRead; button4.style.backgroundColor = hideAllRead ? HIDE_ALL_READ_BUTTON_COLOR : "transparent"; button4.textContent = hideAllRead ? "All Read Hidden" : "All Read Shown"; hideAllReadFunc(); document.body.classList.remove('weebdex-hiding'); });

    controlsContainer.appendChild(button1);
    controlsContainer.appendChild(button2);
    controlsContainer.appendChild(button3);
    if (DOES_HIDE_ALL_READ) controlsContainer.appendChild(button4);

    ele.appendChild(controlsContainer);
}

function createControlButton(text,bgColor,onClick){
    const btn=document.createElement("button");btn.className="control-btn";btn.textContent=text;
    btn.style.cssText=`background-color:${bgColor};padding:6px 10px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:12px;text-align:left;transition:all 0.2s;color:#374151;`;
    btn.addEventListener("mouseenter",function(){this.style.backgroundColor=bgColor==="transparent"?"#f3f4f6":this.style.backgroundColor; this.style.opacity="0.9";});
    btn.addEventListener("mouseleave",function(){this.style.backgroundColor=bgColor; this.style.opacity="1";});
    btn.addEventListener("click",onClick);
    return btn;
}
    //------------------STYLES----------------//
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .weebdex-btn:hover {opacity:0.8; transform:translateY(-1px);}
            .weebdex-btn:active {transform:translateY(0);}
            #weebdex-controls {font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;}
            .control-btn:hover {opacity:0.9; transform:translateY(-1px); box-shadow:0 2px 4px rgba(0,0,0,0.1);}
            .weebdex-tracker-btns {animation: fadeIn 0.3s ease;}
            @keyframes fadeIn {from {opacity:0; transform:translateY(-5px);} to {opacity:1; transform:translateY(0);}}
            /* hide entries while we’re recalculating visibility to prevent flicker */
            body.weebdex-hiding article.flex.gap-2.border-t-2.py-2,
            body.weebdex-hiding [class*="manga-card"],
            body.weebdex-hiding .manga-card,
            body.weebdex-hiding .title-card {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    //------------------AUTO MARK READ----------------//
    function autoMarkReadOnChapter() {
        if (!autoMarkRead || !window.location.href.includes(CATEGORY_CHAPTER)) return;
        // Extract chapter ID from chapter URL, assuming format /chapter/mangaId-chapterId
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length >= 3) {
            const chapterPart = pathParts[2]; // e.g., "mangaId-chapterId"
            const mangaId = chapterPart.split('-')[0];
            const chapterId = chapterPart.split('-')[1];
            if (chapterId) {
                localStorage.setItem(chapterId, "1");
            }
            if (mangaId) {
                localStorage.setItem(mangaId, "1");
            }
        }
    }

    //------------------STATISTICS----------------//
    function getStatistics() {
        const stats = { read: 0, ignored: 0, unmarked: 0, tagBlocked: 0 };
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.length > 10 && !key.startsWith("_conf_")) {
                const value = localStorage.getItem(key);
                if (value === "1") stats.read++;
                else if (value === "-1") stats.ignored++;
                else if (value === "-2") stats.unmarked++;
                else if (value === "-3") stats.tagBlocked++;
            }
        }
        return stats;
    }

    //------------------HIDE ALL READ----------------//
function hideAllReadFunc() {
    const mangaArticles = document.querySelectorAll('article.flex.gap-2.border-t-2.py-2');

    mangaArticles.forEach(mangaArticle => {
        const chapterArticles = mangaArticle.querySelectorAll('article.relative.border-l-2');
        if (chapterArticles.length === 0) return;

        let allRead = true;
        chapterArticles.forEach(chapterArticle => {
            // Get chapter ID from the link
            const link = chapterArticle.querySelector('a[href*="/chapter/"]');
            if (!link) return;
            const entryID = link.getAttribute('href').split('/').pop();

            // Check localStorage
            const isReadLS = localStorage.getItem(entryID) === "1";

            // Check SVG icon inside the button
            const svg = chapterArticle.querySelector('button svg');
            const isReadSVG = svg && svg.classList.contains('lucide-eye-off');

            const isRead = isReadLS || isReadSVG;

            if (isRead) {
                chapterArticle.style.display = "none";
                chapterArticle.setAttribute("hidden-override", "true");
            } else {
                chapterArticle.style.display = "";
                chapterArticle.removeAttribute("hidden-override");
                allRead = false;
            }
        });

        if (hideAllRead && allRead) {
            mangaArticle.style.display = "none";
            mangaArticle.setAttribute("hidden-override", "true");
        } else {
            mangaArticle.style.display = "";
            mangaArticle.removeAttribute("hidden-override");
        }
    });
}
     //------------------hide observer----------------//
    function startHideObserver(){

        const observer = new MutationObserver(() => {
            if(observerTimer) return;

            observerTimer = setTimeout(()=>{
                categorize(getFormat(location.href), location.href===CATEGORY_UPDATES);
                if (hideAllRead) hideAllReadFunc();
                observerTimer = null;
            }, 200);
        });

        observer.observe(document.body,{
            childList: true,
            subtree: true
        });

    }

    //------------------QUEUE----------------//
    function handleQueue() {
        if (queue.length > 0) { checkPage(queue.shift()); }
        setTimeout(handleQueue, API_REQUEST_INTERVAL);
    }

    function checkPage(entryID) {
        queuedIDs.delete(entryID);
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://api.weebdex.org/manga/${entryID}`,
            headers: {
                'Referer': 'https://weebdex.org/'
            },
            onload: function(res) {
                if (res.status >= 200 && res.status < 300) {
                    try {
                        parseAndHandleEntry(entryID, JSON.parse(res.responseText));
                    } catch (e) {
                        console.error('Error parsing response for manga ' + entryID, e);
                    }
                }
            },
            onerror: function() {
                console.error('Failed to fetch manga ' + entryID);
            }
        });
    }

    function parseAndHandleEntry(entryID, metadata) {
        if (!metadata) return;
        const tags = metadata.relationships?.tags || [];
        for (let i=0;i<tags.length;i++) {
            const tag = tags[i]?.name?.toLowerCase?.() || "";
            if (TAG_LIST.includes(tag)) {
                localStorage.setItem(entryID,"-3");
                categorize(getFormat(window.location.href), window.location.href===CATEGORY_UPDATES);
                return;
            }
        }
        localStorage.setItem(entryID,"-2");
    }

    //------------------BLOCK USERS----------------//
    function blockUsers(format) {
        if (format!==FORMAT_LIST) return;
        const entries=document.querySelectorAll('article.flex.gap-2.border-t-2.py-2');
        entries.forEach(entry=>{
            let shouldHide=false;
            entry.querySelectorAll('a[href*="/user/"]').forEach(link=>{
                const href = link.getAttribute('href');
                const id = href ? href.split('/').pop() : null;
                if(id && USER_LIST.includes(id)) shouldHide=true;
            });
            if(!shouldHide) entry.querySelectorAll('a[href*="/group/"]').forEach(link=>{
                const href = link.getAttribute('href');
                const id = href ? href.split('/').pop() : null;
                if(id && GROUP_LIST.includes(id)) shouldHide=true;
            });
            if(shouldHide) entry.style.display="none";
        });
    }

    //------------------CATEGORIZE----------------//
    function categorize(format,isLatestPage){
        if(format === FORMAT_DETAIL) return;
        if(format===FORMAT_NOT_FOUND) return;
        let selector='main,[role="main"]';
        if(format===FORMAT_LIST) selector='article.flex.gap-2.border-t-2.py-2';
        if(format===FORMAT_THUMBNAIL) selector='[class*="manga-card"],.manga-card,.title-card';
        document.querySelectorAll(selector).forEach(entry=>{
            const readBtn=entry.querySelector(".weebdex-read");
            const ignoreBtn=entry.querySelector(".weebdex-ignore");
            if(readBtn && ignoreBtn){
                const entryID=readBtn.getAttribute("entryid");
                const flag=localStorage.getItem(entryID);
                if(flag==="1"){readBtn.style.backgroundColor=READ_BUTTON_COLOR; ignoreBtn.style.backgroundColor="transparent"; toggleVisibility(entry,!hideRead);}
                else if(flag==="-1"){readBtn.style.backgroundColor="transparent"; ignoreBtn.style.backgroundColor=IGNORE_BUTTON_COLOR; toggleVisibility(entry,!hideIgnore);}
                else if(flag==="-3"){readBtn.style.backgroundColor="transparent"; ignoreBtn.style.backgroundColor=TAG_BLOCK_COLOR; toggleVisibility(entry,!hideIgnore);}
                else{readBtn.style.backgroundColor="transparent"; ignoreBtn.style.backgroundColor="transparent"; toggleVisibility(entry,!hideUnmarked);
                    if(isLatestPage&&(flag===null||forceRecheckNewEntry)&&!queuedIDs.has(entryID)) {queue.push(entryID); queuedIDs.add(entryID);}}
            }
        });
    }

    //------------------TRACKER BUTTONS----------------//
    function addButtons(format){
        switch(format){case FORMAT_LIST: addButtonsForListFormat(); break; case FORMAT_THUMBNAIL: addButtonsForThumbnailFormat(); break; case FORMAT_DETAIL: addButtonsForDetailFormat(); break;}
    }

    // simplified addButtonsForListFormat/addButtonsForThumbnailFormat/addButtonsForDetailFormat using addButtonsForElement
    function addButtonsForListFormat(){document.querySelectorAll('article.flex.gap-2.border-t-2.py-2').forEach(entry=>{const link=entry.querySelector('h2.truncate.font-semibold a[href*="/title/"]');if(link && !entry.querySelector('.weebdex-tracker-btns')){const entryID=extractEntryID(link.href);if(entryID) addButtonsForElement(entryID,entry,FORMAT_LIST);}});}
    function addButtonsForThumbnailFormat(){document.querySelectorAll('[class*="manga-card"],.manga-card,.title-card,article[class*="flex"]').forEach(entry=>{const link=entry.querySelector('a[href*="/title/"]');if(link && !entry.querySelector('.weebdex-tracker-btns')){const entryID=extractEntryID(link.href);if(entryID) addButtonsForElement(entryID,entry,FORMAT_THUMBNAIL);}});}
    function addButtonsForDetailFormat(){const entry=document.querySelector('main,[role="main"]')||document.body;try{const entryID=extractEntryID(window.location.href);if(entryID)addButtonsForElement(entryID,entry,FORMAT_DETAIL);}catch(e){console.error("Error getting entry ID:",e);}}

    function addButtonsForElement(entryID,element,format){
        if(element.querySelector(".weebdex-tracker-btns")) return;
        const container=(format===FORMAT_LIST)?element.querySelector('div.w-0.flex-auto.space-y-1'):element.querySelector('.manga-info,.card-content')||element;
        if(!container) return;
        const btnContainer=createButtonContainer(entryID,format===FORMAT_DETAIL);
        if(format===FORMAT_LIST){const titleContainer=element.querySelector('h2.truncate.font-semibold');if(titleContainer && titleContainer.parentNode) titleContainer.parentNode.insertBefore(btnContainer,titleContainer.nextSibling);}
        else if(format===FORMAT_DETAIL){
            const synopsisDiv = document.querySelector('div > strong.font-semibold');
            if (synopsisDiv && synopsisDiv.textContent.trim() === 'Synopsis') {
                const parentDiv = synopsisDiv.parentNode;
                parentDiv.parentNode.insertBefore(btnContainer, parentDiv);
            } else {
                container.appendChild(btnContainer);
            }
        }
        else container.appendChild(btnContainer);
    }

    function createButtonContainer(entryID,isDetail=false){
        const btnContainer=document.createElement("div");
        btnContainer.className="weebdex-tracker-btns";
        btnContainer.style.cssText=isDetail?"display:flex;gap:10px;margin:15px 0;":"display:flex;gap:5px;margin:8px 0;";
        const readBtn=createTrackerButton(isDetail?"Mark as Read":"Read",entryID,"weebdex-read");
        const ignoreBtn=createTrackerButton(isDetail?"Ignore Manga":"Ignore",entryID,"weebdex-ignore");
        const clearBtn=createTrackerButton(isDetail?"Clear Status":"Clear",entryID,"weebdex-clear");
        btnContainer.appendChild(readBtn); btnContainer.appendChild(ignoreBtn); btnContainer.appendChild(clearBtn);
        return btnContainer;
    }

    function createTrackerButton(text,entryID,className){
        const btn=document.createElement("button");
        btn.className=`weebdex-btn ${className}`;
        btn.setAttribute("entryid",entryID);
        btn.textContent=text;
        btn.style.cssText="background-color:transparent;padding:6px 12px;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:12px;transition:all 0.2s;";
        btn.addEventListener("mouseenter",()=>btn.style.opacity="0.8");
        btn.addEventListener("mouseleave",()=>btn.style.opacity="1");
        if(className.includes("read")) btn.addEventListener("click",queueEntry);
        else if(className.includes("ignore")) btn.addEventListener("click",ignoreEntry);
        else if(className.includes("clear")) btn.addEventListener("click",clearEntry);
        return btn;
    }

    function queueEntry(event){const entryID=event.currentTarget.getAttribute("entryid");localStorage.setItem(entryID,"1");updateButtonColors(event.currentTarget,READ_BUTTON_COLOR,"transparent");categorize(getFormat(window.location.href),window.location.href===CATEGORY_UPDATES);}
    function ignoreEntry(event){const entryID=event.currentTarget.getAttribute("entryid");localStorage.setItem(entryID,"-1");updateButtonColors(event.currentTarget,IGNORE_BUTTON_COLOR,"transparent",true);categorize(getFormat(window.location.href),window.location.href===CATEGORY_UPDATES);}
    function clearEntry(event){const entryID=event.currentTarget.getAttribute("entryid");localStorage.removeItem(entryID);const container=event.currentTarget.parentNode;const readBtn=container.querySelector(".weebdex-read");const ignoreBtn=container.querySelector(".weebdex-ignore");if(readBtn) readBtn.style.backgroundColor="transparent";if(ignoreBtn) ignoreBtn.style.backgroundColor="transparent";categorize(getFormat(window.location.href),window.location.href===CATEGORY_UPDATES);}
    function updateButtonColors(clickedBtn,clickedColor,otherColor,isIgnore=false){const container=clickedBtn.parentNode;const readBtn=container.querySelector(".weebdex-read");const ignoreBtn=container.querySelector(".weebdex-ignore");clickedBtn.style.backgroundColor=clickedColor;if(isIgnore && readBtn) readBtn.style.backgroundColor=otherColor;if(!isIgnore && ignoreBtn) ignoreBtn.style.backgroundColor=otherColor;}

    //------------------SETTINGS PANEL----------------//
    function toggleSettings(){
        const controlsPanel=document.querySelector("#weebdex-controls");
        let settingsPanel=document.querySelector("#weebdex-settings");
        if(settingsOpen){if(settingsPanel) settingsPanel.remove(); settingsOpen=false; return;}
        if(!settingsPanel){
            settingsPanel=document.createElement("div");settingsPanel.id="weebdex-settings";
            settingsPanel.style.cssText="position:fixed;top:70px;right:240px;z-index:9998;background:white;padding:16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:1px solid #e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-width:300px;max-width:350px;max-height:80vh;overflow-y:auto;";
            document.body.appendChild(settingsPanel);

            const settingsTitle=document.createElement("div");settingsTitle.textContent="WeebDex++ Settings";
            settingsTitle.style.cssText="font-weight:600;font-size:16px;color:#374151;margin-bottom:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;";
            settingsPanel.appendChild(settingsTitle);

            // User block input
            const userDiv=document.createElement("div");
            const userLabel=document.createElement("label");userLabel.textContent="Blocked Users:";userLabel.style.cssText="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;";userDiv.appendChild(userLabel);
            const userInput=document.createElement("input");userInput.placeholder="Add user ID to block";userInput.style.cssText="width:calc(100% - 60px);padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;margin-bottom:8px;";
            const addUserBtn=document.createElement("button");addUserBtn.textContent="Add";addUserBtn.style.cssText="padding:8px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-left:8px;";
            addUserBtn.addEventListener("click",()=>{const user=userInput.value.trim();if(user&&!USER_LIST.includes(user)){USER_LIST.push(user);userInput.value="";updateBlockedList(userListDiv,USER_LIST,"user");}});
            const userInputContainer=document.createElement("div");userInputContainer.style.cssText="display:flex;margin-bottom:8px;";userInputContainer.appendChild(userInput);userInputContainer.appendChild(addUserBtn);userDiv.appendChild(userInputContainer);
            const userListDiv=document.createElement("div");userListDiv.style.cssText="max-height:100px;overflow-y:auto;border:1px solid #d1d5db;padding:8px;border-radius:4px;font-size:12px;";userDiv.appendChild(userListDiv);
            updateBlockedList(userListDiv,USER_LIST,"user");
            settingsPanel.appendChild(userDiv);

            // Group block input
            const groupDiv=document.createElement("div");
            const groupLabel=document.createElement("label");groupLabel.textContent="Blocked Groups:";groupLabel.style.cssText="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;";groupDiv.appendChild(groupLabel);
            const groupInput=document.createElement("input");groupInput.placeholder="Add group ID to block";groupInput.style.cssText="width:calc(100% - 60px);padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;margin-bottom:8px;";
            const addGroupBtn=document.createElement("button");addGroupBtn.textContent="Add";addGroupBtn.style.cssText="padding:8px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-left:8px;";
            addGroupBtn.addEventListener("click",()=>{const group=groupInput.value.trim();if(group&&!GROUP_LIST.includes(group)){GROUP_LIST.push(group);groupInput.value="";updateBlockedList(groupListDiv,GROUP_LIST,"group");}});
            const groupInputContainer=document.createElement("div");groupInputContainer.style.cssText="display:flex;margin-bottom:8px;";groupInputContainer.appendChild(groupInput);groupInputContainer.appendChild(addGroupBtn);groupDiv.appendChild(groupInputContainer);
            const groupListDiv=document.createElement("div");groupListDiv.style.cssText="max-height:100px;overflow-y:auto;border:1px solid #d1d5db;padding:8px;border-radius:4px;font-size:12px;";groupDiv.appendChild(groupListDiv);
            updateBlockedList(groupListDiv,GROUP_LIST,"group");
            settingsPanel.appendChild(groupDiv);

            // Tag block input
            const tagDiv=document.createElement("div");
            const tagLabel=document.createElement("label");tagLabel.textContent="Blocked Tags:";tagLabel.style.cssText="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;";tagDiv.appendChild(tagLabel);
            const tagContainer=document.createElement("div");tagContainer.style.cssText="max-height:200px;overflow-y:auto;border:1px solid #d1d5db;padding:8px;border-radius:4px;font-size:12px;";
            tagContainer.innerHTML = "Loading tags...";
            tagDiv.appendChild(tagContainer);
            settingsPanel.appendChild(tagDiv);

            // Load tags
            fetchTags().then(tags => {
                tagContainer.innerHTML = "";
                if (tags.length === 0) {
                    tagContainer.innerHTML = "Failed to load tags.";
                    return;
                }
                tags.forEach(tag => {
                    const label = document.createElement("label");
                    label.style.cssText = "display:block;margin-bottom:2px;cursor:pointer;";
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.value = tag;
                    checkbox.checked = TAG_LIST.includes(tag);
                    checkbox.style.cssText = "margin-right:8px;";
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(tag));
                    tagContainer.appendChild(label);
                });
            });

            // Statistics
            const stats = getStatistics();
            const statsDiv = document.createElement("div");
            statsDiv.style.cssText = "margin:16px 0;border-top:1px solid #e5e7eb;padding-top:8px;";
            statsDiv.innerHTML = `<strong>Statistics:</strong><br>Read: ${stats.read} | Ignored: ${stats.ignored} | Tag Blocked: ${stats.tagBlocked} | Unmarked: ${stats.unmarked}`;
            settingsPanel.appendChild(statsDiv);

            // Export/Import
            const exportBtn = document.createElement("button");
            exportBtn.textContent = "📤 Export Settings";
            exportBtn.style.cssText = "width:48%;padding:8px;background-color:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4%;";
            exportBtn.addEventListener("click", exportSettings);
            const importBtn = document.createElement("button");
            importBtn.textContent = "📥 Import Settings";
            importBtn.style.cssText = "width:48%;padding:8px;background-color:#f59e0b;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;";
            importBtn.addEventListener("click", importSettings);
            const exportImportDiv = document.createElement("div");
            exportImportDiv.style.cssText = "display:flex;margin-top:8px;";
            exportImportDiv.appendChild(exportBtn);
            exportImportDiv.appendChild(importBtn);
            settingsPanel.appendChild(exportImportDiv);

            // Save button
            const saveBtn=document.createElement("button");saveBtn.textContent="💾 Save Configuration";
            saveBtn.style.cssText="width:100%;padding:10px;background-color:#8b5cf6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-top:8px;transition:background-color 0.2s;";
            saveBtn.addEventListener("click",()=>{ 
                const checkedTags = Array.from(tagContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                saveConfiguration(USER_LIST.join(", "), GROUP_LIST.join(", "), checkedTags);
            });
            settingsPanel.appendChild(saveBtn);
        }
        settingsOpen=true;
    }

    function addBlockButton(type, id) {
        const h1 = document.querySelector('h1.truncate.text-2xl.font-semibold');
        if (!h1 || document.querySelector('.weebdex-block-btn')) return;
        const button = document.createElement("button");
        button.className = "weebdex-block-btn";
        const list = type === 'user' ? USER_LIST : GROUP_LIST;
        const isBlocked = list.includes(id);
        button.textContent = isBlocked ? `Unblock ${type}` : `Block ${type}`;
        button.style.cssText = `margin-left:10px;padding:4px 8px;background:${isBlocked ? '#ef4444' : '#10b981'};color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;`;
        button.addEventListener("click", () => {
            if (isBlocked) {
                const index = list.indexOf(id);
                if (index > -1) list.splice(index, 1);
            } else {
                list.push(id);
            }
            setConfig(type === 'user' ? "_conf_users" : "_conf_groups", list.toString());
            const nowBlocked = list.includes(id);
            button.textContent = nowBlocked ? `Unblock ${type}` : `Block ${type}`;
            button.style.background = nowBlocked ? '#ef4444' : '#10b981';
        });
        h1.insertAdjacentElement('afterend', button);
    }
    function exportSettings() {
        const settings = {
            users: USER_LIST,
            groups: GROUP_LIST,
            tags: TAG_LIST,
            autoMarkRead,
            hideRead,
            hideIgnore,
            hideUnmarked,
            hideAllRead
        };
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'weebdex_settings.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    function updateBlockedList(listDiv, list, type) {
        listDiv.innerHTML = "";
        list.forEach(item => {
            const itemDiv = document.createElement("div");
            itemDiv.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f0f0f0;";
            const nameSpan = document.createElement("span");
            nameSpan.textContent = item;
            itemDiv.appendChild(nameSpan);
            const removeBtn = document.createElement("button");
            removeBtn.textContent = "Remove";
            removeBtn.style.cssText = "background:#ef4444;color:white;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;";
            removeBtn.addEventListener("click", () => {
                const index = list.indexOf(item);
                if (index > -1) list.splice(index, 1);
                updateBlockedList(listDiv, list, type);
            });
            itemDiv.appendChild(removeBtn);
            listDiv.appendChild(itemDiv);
            // Fetch name
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.weebdex.org/${type}/${item}`,
                headers: {
                    'Referer': 'https://weebdex.org/'
                },
                onload: function(res) {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.name) {
                            nameSpan.textContent = `${data.name} (${item})`;
                        }
                    } catch (e) {
                        // ignore
                    }
                },
                onerror: function() {
                    // ignore
                }
            });
        });
    }
    function importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const settings = JSON.parse(e.target.result);
                        USER_LIST.length = 0;
                        USER_LIST.push(...(settings.users || []));
                        GROUP_LIST.length = 0;
                        GROUP_LIST.push(...(settings.groups || []));
                        TAG_LIST.length = 0;
                        TAG_LIST.push(...(settings.tags || []));
                        hideRead = settings.hideRead || false;
                        hideIgnore = settings.hideIgnore !== false;
                        hideUnmarked = settings.hideUnmarked || false;
                        hideAllRead = settings.hideAllRead !== false;
                        setConfig("_conf_users", USER_LIST.toString());
                        setConfig("_conf_groups", GROUP_LIST.toString());
                        setConfig("_conf_tags", TAG_LIST.toString());
                        forceRecheckNewEntry = true;
                        categorize(getFormat(window.location.href), window.location.href === CATEGORY_UPDATES);
                        alert('Settings imported successfully!');
                    } catch (err) {
                        alert('Error importing settings: ' + err.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    function saveConfiguration(users,groups,tags){
        USER_LIST.length=0; USER_LIST.push(...users.split(",").map(u=>u.trim()).filter(u=>u));
        GROUP_LIST.length=0; GROUP_LIST.push(...groups.split(",").map(g=>g.trim()).filter(g=>g));
        if (Array.isArray(tags)) {
            TAG_LIST.length=0; TAG_LIST.push(...tags);
        } else {
            TAG_LIST.length=0; TAG_LIST.push(...tags.split(",").map(t=>t.trim().toLowerCase()).filter(t=>t));
        }
        setConfig("_conf_users",USER_LIST.toString());
        setConfig("_conf_groups",GROUP_LIST.toString());
        setConfig("_conf_tags",TAG_LIST.toString());
        forceRecheckNewEntry=true;
        settingsOpen=false;
        const panel=document.querySelector("#weebdex-settings"); if(panel) panel.remove();
        categorize(getFormat(window.location.href),window.location.href===CATEGORY_UPDATES);
    }

    //------------------MAIN LOOP----------------//
    function main(){
        const lastTagList=getConfig("_conf_tags", "");
        const currentTagList=TAG_LIST.toString();
        if(lastTagList!==currentTagList){forceRecheckNewEntry=true; setConfig("_conf_tags", currentTagList);}
        handleBaseUrl(window.location.href);
        setTimeout(main,POLLING_TIME);
    }

    function handleBaseUrl(baseUrl){
        const url=new URL(baseUrl);
        const format=getFormat(url.href);
        blockUsers(format);
        if(format===FORMAT_NOT_FOUND) return;
        if(!initialized){
            if(format !== FORMAT_DETAIL) addControllers();
            initialized=true;
        }
        addButtons(format);
        if (format === FORMAT_DETAIL) {
            const pathname = url.pathname;
            if (pathname.startsWith('/group/')) {
                const id = pathname.split('/')[2];
                if (id) addBlockButton('group', id);
            } else if (pathname.startsWith('/user/')) {
                const id = pathname.split('/')[2];
                if (id) addBlockButton('user', id);
            }
        }
        categorize(format,url.href===CATEGORY_UPDATES);
    }

    //------------------INIT----------------//
    function init(){
        addStyles();
        startHideObserver();
        autoMarkReadOnChapter();
        // Load saved lists
        const savedUsers = getConfig("_conf_users", "");
        if (savedUsers) USER_LIST.push(...savedUsers.split(",").filter(u=>u));
        const savedGroups = getConfig("_conf_groups", "");
        if (savedGroups) GROUP_LIST.push(...savedGroups.split(",").filter(g=>g));
        setTimeout(handleQueue,API_REQUEST_INTERVAL);
        setTimeout(main,1000);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();

})();
