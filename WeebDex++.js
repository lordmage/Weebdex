// ==UserScript==
// @name         WeebDex++
// @namespace    https://weebdex.org/
// @version      1.1.4
// @description  QOL enhancements for WeebDex - Manga tracking, filtering, and blocking with full settings panel
// @author       WeebDex++
// @match        https://weebdex.org/*
// @match        http://weebdex.org/*
// @icon         https://weebdex.org/favicon.ico
// @grant        none
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
    const DOES_HIDE_ALL_READ = true;

    let hideRead = false;
    let hideIgnore = true;
    let hideUnmarked = false;
    let hideAllRead = true;
    let forceRecheckNewEntry = false;
    let queue = [];
    let initialized = false;
    let settingsOpen = false;

    const USER_LIST = [];
    const GROUP_LIST = [];
    const TAG_LIST = ["boys' love"];

    const CATEGORY_UPDATES = "/updates";
    const CATEGORY_SEARCH = "/search";
    const CATEGORY_TITLE = "/title/";
    const CATEGORY_AUTHOR = "/author/";
    const CATEGORY_GROUP = "/group/";
    const CATEGORY_TAG = "/tag/";

    const FORMAT_NOT_FOUND = 0;
    const FORMAT_LIST = 1;
    const FORMAT_THUMBNAIL = 2;
    const FORMAT_DETAIL = 3;

    //------------------UTILS----------------//
    // Must be at the top, before categorize(), handleBaseUrl(), or addButtons calls
function getFormat(pathname) {
    if (pathname.startsWith("/title/")) return 3; // FORMAT_DETAIL
    if (pathname.startsWith("/group")) return 2; // FORMAT_THUMBNAIL
    if (pathname.startsWith("/author")) return 2;
    if (pathname.startsWith("/tag")) return 2;
    if (pathname === "/updates") return 1; // FORMAT_LIST
    if (pathname.startsWith("/search")) return 2;
    return 2;
}
    function extractEntryID(url) {
        const match = url.match(/\/title\/([^\/]+)/);
        return match ? match[1] : null;
    }

    function toggleVisibility(element, on) {
        if (!element || element.hasAttribute("hidden-override")) return;
        element.style.display = on ? "" : "none";
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

    const button1 = createControlButton("Toggle Read", hideRead ? READ_BUTTON_COLOR : "transparent", () => { hideRead = !hideRead; button1.style.backgroundColor = hideRead ? READ_BUTTON_COLOR : "transparent"; categorize(getFormat(window.location.pathname), window.location.pathname === CATEGORY_UPDATES); });
    const button2 = createControlButton("Toggle Ignore", hideIgnore ? IGNORE_BUTTON_COLOR : "transparent", () => { hideIgnore = !hideIgnore; button2.style.backgroundColor = hideIgnore ? IGNORE_BUTTON_COLOR : "transparent"; categorize(getFormat(window.location.pathname), window.location.pathname === CATEGORY_UPDATES); });
    const button3 = createControlButton("Toggle Unmarked", hideUnmarked ? UNMARKED_BUTTON_COLOR : "transparent", () => { hideUnmarked = !hideUnmarked; button3.style.backgroundColor = hideUnmarked ? UNMARKED_BUTTON_COLOR : "transparent"; categorize(getFormat(window.location.pathname), window.location.pathname === CATEGORY_UPDATES); });
    const button4 = createControlButton("Hide All Read?", hideAllRead ? HIDE_ALL_READ_BUTTON_COLOR : "transparent", () => { hideAllRead = !hideAllRead; button4.style.backgroundColor = hideAllRead ? HIDE_ALL_READ_BUTTON_COLOR : "transparent"; hideAllReadFunc(); });

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
        `;
        document.head.appendChild(style);
    }

    //------------------HIDE ALL READ----------------//
function hideAllReadFunc() {
    const chapterArticles = document.querySelectorAll('article.relative.border-l-2');

    chapterArticles.forEach(article => {
        // Get chapter ID from the link
        const link = article.querySelector('a[href*="/chapter/"]');
        if (!link) return;
        const entryID = link.getAttribute('href').split('/').pop();

        // Check localStorage
        const isReadLS = localStorage.getItem(entryID) === "1";

        // Check SVG icon inside the button
        const svg = article.querySelector('button svg');
        const isReadSVG = svg && svg.classList.contains('lucide-eye-off');

        const isRead = isReadLS || isReadSVG;

        if (hideAllRead && isRead) {
            article.style.display = "none";
            article.setAttribute("hidden-override", "true");
        } else {
            article.style.display = "";
            article.removeAttribute("hidden-override");
        }
    });
}
     //------------------hide observer----------------//
    function startHideObserver() {
        const observer = new MutationObserver(() => { if (hideAllRead) hideAllReadFunc(); });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    //------------------QUEUE----------------//
    function handleQueue() {
        if (queue.length > 0) { checkPage(queue.shift()); }
        setTimeout(handleQueue, API_REQUEST_INTERVAL);
    }

    function checkPage(entryID) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `https://api.weebdex.org/manga/${entryID}`, true);
        xhr.onload = function() {
            if (xhr.status>=200 && xhr.status<300) {
                try { parseAndHandleEntry(entryID, JSON.parse(xhr.responseText)); }
                catch(e){ console.error('Error parsing response for manga '+entryID,e); }
            }
        };
        xhr.onerror = () => console.error('Failed to fetch manga '+entryID);
        xhr.send();
    }

    function parseAndHandleEntry(entryID, metadata) {
        if (!metadata) return;
        const tags = metadata.tags || [];
        for (let i=0;i<tags.length;i++) {
            const tag = tags[i].name ? tags[i].name.toLowerCase() : "";
            if (TAG_LIST.includes(tag)) {
                localStorage.setItem(entryID,"-1");
                categorize(getFormat(window.location.pathname), window.location.pathname===CATEGORY_UPDATES);
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
                const title=link.getAttribute('title');
                if(title && USER_LIST.includes(title.trim())) shouldHide=true;
            });
            if(!shouldHide) entry.querySelectorAll('a[href*="/group/"]').forEach(link=>{
                const title=link.getAttribute('title');
                if(title && GROUP_LIST.includes(title.trim())) shouldHide=true;
            });
            if(shouldHide) entry.style.display="none";
        });
    }

    //------------------CATEGORIZE----------------//
    function categorize(format,isLatestPage){
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
                else{readBtn.style.backgroundColor="transparent"; ignoreBtn.style.backgroundColor="transparent"; toggleVisibility(entry,!hideUnmarked);
                    if(isLatestPage&&(flag===null||forceRecheckNewEntry)&&!queue.includes(entryID)) queue.push(entryID);}
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

    function queueEntry(event){const entryID=event.currentTarget.getAttribute("entryid");localStorage.setItem(entryID,"1");updateButtonColors(event.currentTarget,READ_BUTTON_COLOR,"transparent");categorize(getFormat(window.location.pathname),window.location.pathname===CATEGORY_UPDATES);}
    function ignoreEntry(event){const entryID=event.currentTarget.getAttribute("entryid");localStorage.setItem(entryID,"-1");updateButtonColors(event.currentTarget,IGNORE_BUTTON_COLOR,"transparent",true);categorize(getFormat(window.location.pathname),window.location.pathname===CATEGORY_UPDATES);}
    function clearEntry(event){const entryID=event.currentTarget.getAttribute("entryid");localStorage.removeItem(entryID);const container=event.currentTarget.parentNode;const readBtn=container.querySelector(".weebdex-read");const ignoreBtn=container.querySelector(".weebdex-ignore");if(readBtn) readBtn.style.backgroundColor="transparent";if(ignoreBtn) ignoreBtn.style.backgroundColor="transparent";categorize(getFormat(window.location.pathname),window.location.pathname===CATEGORY_UPDATES);}
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
            const userLabel=document.createElement("label");userLabel.textContent="Blocked Users (comma-separated):";userLabel.style.cssText="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;";userDiv.appendChild(userLabel);
            const userInput=document.createElement("textarea");userInput.value=USER_LIST.join(", ");userInput.style.cssText="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;resize:vertical;min-height:60px;";userDiv.appendChild(userInput);
            settingsPanel.appendChild(userDiv);

            // Group block input
            const groupDiv=document.createElement("div");
            const groupLabel=document.createElement("label");groupLabel.textContent="Blocked Groups (comma-separated):";groupLabel.style.cssText="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;";groupDiv.appendChild(groupLabel);
            const groupInput=document.createElement("textarea");groupInput.value=GROUP_LIST.join(", ");groupInput.style.cssText="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;resize:vertical;min-height:60px;";groupDiv.appendChild(groupInput);
            settingsPanel.appendChild(groupDiv);

            // Tag block input
            const tagDiv=document.createElement("div");
            const tagLabel=document.createElement("label");tagLabel.textContent="Blocked Tags (comma-separated, lowercase):";tagLabel.style.cssText="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;";tagDiv.appendChild(tagLabel);
            const tagInput=document.createElement("textarea");tagInput.value=TAG_LIST.join(", ");tagInput.style.cssText="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;resize:vertical;min-height:60px;";tagDiv.appendChild(tagInput);
            settingsPanel.appendChild(tagDiv);

            // Save button
            const saveBtn=document.createElement("button");saveBtn.textContent="💾 Save Configuration";
            saveBtn.style.cssText="width:100%;padding:10px;background-color:#8b5cf6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-top:8px;transition:background-color 0.2s;";
            saveBtn.addEventListener("click",()=>{saveConfiguration(userInput.value,groupInput.value,tagInput.value);});
            settingsPanel.appendChild(saveBtn);
        }
        settingsOpen=true;
    }

    function saveConfiguration(users,groups,tags){
        USER_LIST.length=0; USER_LIST.push(...users.split(",").map(u=>u.trim()).filter(u=>u));
        GROUP_LIST.length=0; GROUP_LIST.push(...groups.split(",").map(g=>g.trim()).filter(g=>g));
        TAG_LIST.length=0; TAG_LIST.push(...tags.split(",").map(t=>t.trim().toLowerCase()).filter(t=>t));
        localStorage.setItem("_conf_tags",TAG_LIST.toString());
        forceRecheckNewEntry=true;
        settingsOpen=false;
        const panel=document.querySelector("#weebdex-settings"); if(panel) panel.remove();
        categorize(getFormat(window.location.pathname),window.location.pathname===CATEGORY_UPDATES);
    }

    //------------------MAIN LOOP----------------//
    function main(){
        const lastTagList=localStorage.getItem("_conf_tags");
        const currentTagList=TAG_LIST.toString();
        if(lastTagList!==currentTagList){forceRecheckNewEntry=true; localStorage.setItem("_conf_tags",currentTagList);}
        handleBaseUrl(window.location.href);
        setTimeout(main,POLLING_TIME);
    }

    function handleBaseUrl(baseUrl){
        const url=new URL(baseUrl);
        const format=getFormat(url.pathname);
        blockUsers(format);
        if(format===FORMAT_NOT_FOUND) return;
        if(!initialized){addControllers(); initialized=true;}
        addButtons(format);
        categorize(format,url.pathname===CATEGORY_UPDATES);
    }

    //------------------INIT----------------//
    function init(){addStyles();startHideObserver();setTimeout(handleQueue,API_REQUEST_INTERVAL);setTimeout(main,1000);}
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();

})();
