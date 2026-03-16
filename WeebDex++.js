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
// @author       @ Theo1996, MangaDexPP, patched by Workik
// @homepageURL  https://github.com/lordmage/Weebdex
// @updateURL    https://github.com/lordmage/Weebdex/raw/refs/heads/main/WeebDex++.js
// @downloadURL  https://github.com/lordmage/Weebdex/raw/refs/heads/main/WeebDex++.js
// @icon         https://icons.duckduckgo.com/ip2/www.weebdex.org.ico
// @grant        none
// ==/UserScript==

(function() {
'use strict';

/* ================= CONFIG / STATE ================= */

const READ_BUTTON_COLOR = "#13ab493d";
    const IGNORE_BUTTON_COLOR = "#ab13133d";
    const UNMARKED_BUTTON_COLOR = "#4242cd3d";
    const HIDE_ALL_READ_BUTTON_COLOR = "#ff80003d";
    const SETTINGS_BUTTON_COLOR = "#6b72803d";
    const TAG_BLOCK_COLOR = "#ff6b6b3d";

    const DOES_HIDE_ALL_READ = true;

    let hideRead = false;
    let hideIgnore = true;
    let hideUnmarked = false;
    let hideAllRead = true;
    let scriptLoaded = false;
/* ================= UTILITIES ================= */

function extractIdFromHref(href){

    if(!href) return null;

    try{
        const url = new URL(href);
        const parts = url.pathname.split('/');
        const idx = parts.indexOf('title');

        if(idx !== -1 && parts[idx+1]){
            return parts[idx+1];
        }
    }catch(e){
        const m = href.match(/title\/([^/]+)/);
        if(m) return m[1];
    }

    return null;
}

function toggleVisibility(element,on){

    if(!element || element.hasAttribute("hidden-override"))
        return;

    const visible = element.style.display !== "none";

    if(visible === on) return;

    element.style.display = on ? "" : "none";
}

function logState(msg){
    console.log("[WeebDex++] " + msg);
}

/* ================= FILTER LOGIC ================= */

function shouldFilterArticle(entryID){

    const flag = localStorage.getItem(entryID);

    if(flag === "1")
        return hideRead;

    if(flag === "-1" || flag === "-3")
        return hideIgnore;

    return hideUnmarked;
}

/* ================ EXPORT / IMPORT ================ */
    function exportLocalStorage() {
        try {
            const data = JSON.stringify(localStorage, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "weebdexpp-localstorage.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {

            alert("Export failed — see console.");
        }
    }

    function importLocalStorage() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.onchange = e => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                try {
                    const parsed = JSON.parse(r.result);
                    Object.entries(parsed).forEach(([k, v]) => localStorage.setItem(k, v));
                    alert("Import complete. Refresh if needed.");
                } catch (err) {

                    alert("Invalid JSON file.");
                }
            };
            r.readAsText(f);
        };
        document.body.appendChild(input);
        input.click();
        input.remove();
    }

    /* ================ SETTINGS COG ================ */
   function createSettingsCog() {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.classList.add("weebdexpp-settings-container");

    const btn = document.createElement("input");
    btn.type = "button";
    btn.value = "⚙";
    btn.title = "WeebDex++ Settings";
    btn.style.padding = "0 0.8em";
    btn.style.marginLeft = "6px";
    btn.style.borderRadius = "4px";
    btn.style.backgroundColor = SETTINGS_BUTTON_COLOR;
    btn.style.cursor = "pointer";
    btn.style.zIndex = "2147483648"; // above menu

    const menu = document.createElement("div");
    menu.style.display = "none";
    menu.style.position = "fixed";
    menu.style.top = "50px";
    menu.style.right = "10px";
    menu.style.background = "#1a1a1a";
    menu.style.border = "1px solid #333";
    menu.style.borderRadius = "6px";
    menu.style.zIndex = "2147483647";
    menu.style.minWidth = "220px";
    menu.style.padding = "10px";
    menu.style.boxSizing = "border-box";
    menu.style.color = "#eee";
    menu.style.maxHeight = "80vh";
    menu.style.overflowY = "auto";
    menu.style.pointerEvents = "auto"; // allow clicks inside

    // Prevent menu clicks from closing it
    menu.addEventListener("click", e => e.stopPropagation());

    // Data section
    const dataTitle = document.createElement("div");
    dataTitle.textContent = "Data";
    dataTitle.style.fontWeight = "700";
    dataTitle.style.marginBottom = "6px";
    menu.appendChild(dataTitle);

    // Export button
    const exBtn = document.createElement("button");
    exBtn.textContent = "Export Data";
    exBtn.style.width = "100%";
    exBtn.style.marginBottom = "6px";
    exBtn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        exportLocalStorage();
    });
    menu.appendChild(exBtn);

    // Import button
    const imBtn = document.createElement("button");
    imBtn.textContent = "Import Data";
    imBtn.style.width = "100%";
    imBtn.style.marginBottom = "6px";
    imBtn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        importLocalStorage();
    });
    menu.appendChild(imBtn);

    // Close menu when clicking outside
    document.addEventListener("click", e => {
        if (!menu.contains(e.target) && e.target !== btn) {
            menu.style.display = "none";
        }
    });

    // Toggle menu visibility
    btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(menu);
    return wrapper;
}
/* ================= CONTROLS ================= */

function createControlsRow(entryID){

    const row = document.createElement("div");

    row.className="weebdexpp-controls";
    row.style.display="flex";
    row.style.gap="4px";
    row.style.marginTop="4px";

    function mk(label,cls,cb){

        const b=document.createElement("input");

        b.type="button";
        b.value=label;
        b.className=cls;
        b.setAttribute("entryid",entryID);

        b.onclick=e=>{
            e.preventDefault();
            e.stopPropagation();

            cb(entryID);

            categorize();
        };

        return b;
    }

    row.appendChild(
        mk("Read","weebdexpp-read",
        id=>localStorage.setItem(id,"1"))
    );

    row.appendChild(
        mk("Ignore","weebdexpp-ignore",
        id=>localStorage.setItem(id,"-1"))
    );

    row.appendChild(
        mk("Clear","weebdexpp-clear",
        id=>localStorage.removeItem(id))
    );

    return row;
}

/* ================= INSERT CONTROLS ================= */

 /* ================ INSERTION HELPERS ================ */
    function getCandidateContainerForAnchor(a) {
        if (a.closest('[data-slot="sidebar-menu"]')) {
            return null;
        }

        if (a.href && a.href.includes('/chapter/')) {
            return null;
        }

        if (window.location.href.includes('/search')) {
            return a.closest("article") ||
                   a.closest(".group.list-card") ||
                   a.parentElement;
        }

        return a.closest("article.flex.gap-2.border-t-2.py-2") ||
               a.closest(".group.list-card") ||
               a.closest(".manga-card") ||
               a.closest("[class*='manga-card']") ||
               a.closest(".title-card") ||
               a.closest("article") ||
               a.parentElement;
    }

    function insertControlsUnderTitleForAnchor(a, isDetailPage = false) {
        try {
            if (a.closest(".weebdexpp-controls")) return;

            const href = a.getAttribute("href") || a.href || "";
            const id = extractIdFromHref(href);
            if (!id) return;

            let cont;
            let titleElement;

            if (isDetailPage) {
                titleElement = document.querySelector('h1.truncate.text-2xl.font-semibold');
                if (!titleElement) return;

                const existingControls = document.querySelector(`.weebdexpp-controls input[entryid="${id}"]`);
                if (existingControls) return;

                const controls = createControlsRow(id, true);
                titleElement.parentNode.insertBefore(controls, titleElement.nextSibling);
                updateButtonColors(controls, localStorage.getItem(id));
                return;
            }

            cont = getCandidateContainerForAnchor(a);
            if (!cont) return;

            const existingControls = cont.querySelector(`.weebdexpp-controls input[entryid="${id}"]`);
            if (existingControls) {
                return;
            }

            if (window.location.href.includes('/search')) {
                titleElement = cont.querySelector("h3 a[href*='/title/']")?.parentElement ||
                              cont.querySelector("h3") ||
                              a;
            } else {
                titleElement = cont.querySelector("h2.truncate.font-semibold a[href*='/title/']")?.parentElement ||
                              cont.querySelector("h2.truncate.font-semibold") ||
                              a;
            }

            const controls = createControlsRow(id, false);

            try {
                if (titleElement && titleElement.parentNode) {
                    titleElement.parentNode.insertBefore(controls, titleElement.nextSibling);
                } else {
                    // Fallback: append to container
                    cont.appendChild(controls);
                }
            } catch (error) {
                // If insertBefore fails, try other methods
                const tagsRow = cont.querySelector(".flex.flex-wrap.gap-1");
                if (tagsRow && tagsRow.parentNode) {
                    tagsRow.parentNode.insertBefore(controls, tagsRow);
                } else {
                    const titleDiv = cont.querySelector('div.flex.w-0.flex-auto.flex-col');
                    if (titleDiv) {
                        titleDiv.appendChild(controls);
                    } else {
                        cont.appendChild(controls);
                    }
                }
            }

            updateButtonColors(controls, localStorage.getItem(id));

        } catch (e) {
            // Silently fail
        }
    }

    function addControlsToAll() {
        const isDetailPage = window.location.href.includes('/title/') &&
                           !window.location.href.includes('/title/random');

        if (isDetailPage) {
            const titleLink = document.querySelector('h1.truncate.text-2xl.font-semibold a[href*="/title/"]') ||
                            document.querySelector('a[href*="/title/"]');
            if (titleLink) {
                insertControlsUnderTitleForAnchor(titleLink, true);
            }
            return;
        }

        let titleLinks;

        if (window.location.href.includes('/search')) {
            titleLinks = document.querySelectorAll('h3 a[href*="/title/"]');
        } else if (window.location.href.includes('/updates')) {
            titleLinks = document.querySelectorAll('h2.truncate.font-semibold a[href*="/title/"]');
        } else {
            titleLinks = document.querySelectorAll('h2.truncate.font-semibold a[href*="/title/"], h3 a[href*="/title/"]');
        }

        const processedContainers = new Set();

        titleLinks.forEach(a => {
            if (
                a.closest("nav") ||
                a.closest("header") ||
                a.closest(".weebdexpp-settings-container") ||
                a.closest('[data-slot="sidebar"]') ||
                a.closest('[data-slot="sidebar-menu"]')
            ) return;

            const cont = getCandidateContainerForAnchor(a);
            if (!cont) return;

            if (processedContainers.has(cont)) {
                return;
            }

            insertControlsUnderTitleForAnchor(a, false);
            processedContainers.add(cont);
        });
    }

/* ================= FILTER APPLICATION ================= */

function categorize(){

    const entries = document.querySelectorAll(
        'article, .group.list-card, .manga-card, .title-card'
    );

    entries.forEach(entry=>{

        const readBtn =
        entry.querySelector(".weebdexpp-read");

        if(!readBtn) return;

        const id =
        readBtn.getAttribute("entryid");

        const hide =
        shouldFilterArticle(id);

        toggleVisibility(entry,!hide);
    });
}

/* ================= SEARCH PATCH ================= */

function categorizeSearch(){

    const entries = document.querySelectorAll(
        'article, .group.list-card, .manga-card, .title-card'
    );

    entries.forEach(entry=>{

        const readBtn =
        entry.querySelector(".weebdexpp-read");

        if(!readBtn) return;

        const id =
        readBtn.getAttribute("entryid");

        const hide =
        shouldFilterArticle(id);

        toggleVisibility(entry,!hide);
    });
}

function observeSearchPage(){

    if(!location.pathname.startsWith("/search"))
        return;

    const root =
        document.querySelector("main") ||
        document.body;

    let scanTimer=null;

    const observer=new MutationObserver(()=>{

        clearTimeout(scanTimer);

        scanTimer=setTimeout(()=>{

            addControlsToAll();
            categorizeSearch();

        },120);

    });

    observer.observe(root,{
        childList:true,
        subtree:true
    });
}

/* ================= TOGGLE BAR ================= */
function addToggleControls() {
        const existingControls = document.querySelector(".weebdexpp-toggle-controls");
        if (existingControls) existingControls.remove();

        if (window.location.href.includes('/title/') && !window.location.href.includes('/title/random')) {
            return;
        }

        const controls = document.createElement("div");
        controls.className = "weebdexpp-toggle-controls";
        controls.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            background: rgba(0,0,0,0.85);
            padding: 10px 15px;
            border-radius: 8px;
            color: white;
            display: flex;
            gap: 8px;
            align-items: center;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        function mk(label, get, set, color) {
            const b = document.createElement("input");
            b.type = "button";
            b.value = label;
            b.style.padding = "6px 12px";
            b.style.margin = "0";
            b.style.borderRadius = "4px";
            b.style.cursor = "pointer";
            b.style.backgroundColor = get() ? color : "transparent";
            b.style.fontSize = "13px";
            b.style.height = "32px";
            b.style.lineHeight = "20px";
            b.style.boxSizing = "border-box";
            b.style.fontFamily = "inherit";
            b.style.fontWeight = "500";
            b.style.border = "1px solid rgba(255, 255, 255, 0.2)";
            b.style.transition = "all 0.15s ease";
            b.style.color = "white";
            b.addEventListener("click", () => {
                const v = !get();
                set(v);
                b.style.backgroundColor = v ? color : "transparent";
                logState(`${label} filter toggled: ${v ? "ON" : "OFF"}`);




                categorize();
                document.body.classList.remove('weebdex-hiding');
            });

            b.addEventListener("mouseenter", () => {
                b.style.opacity = "0.9";
                b.style.transform = "translateY(-1px)";
                b.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
            });
            b.addEventListener("mouseleave", () => {
                b.style.opacity = "1";
                b.style.transform = "translateY(0)";
                b.style.boxShadow = "none";
            });

            return b;
        }

        controls.appendChild(mk("Read", () => hideRead, v => hideRead = v, READ_BUTTON_COLOR));
        controls.appendChild(mk("Ignore", () => hideIgnore, v => hideIgnore = v, IGNORE_BUTTON_COLOR));
        controls.appendChild(mk("Unmarked", () => hideUnmarked, v => hideUnmarked = v, UNMARKED_BUTTON_COLOR));

        const cog = createSettingsCog();
        cog.classList.add("weebdexpp-settings-cog");
        controls.appendChild(cog);

        document.body.appendChild(controls);
    } /* ================ PER-TITLE CONTROLS ================ */
    function createControlsRow(entryID, isDetailPage = false) {
        const row = document.createElement("div");
        row.className = "weebdexpp-controls";
        row.style.marginTop = isDetailPage ? "15px" : "4px";
        row.style.display = "flex";
        row.style.gap = isDetailPage ? "10px" : "4px";
        row.style.justifyContent = "flex-start";
        row.style.flexDirection = "row";

        row.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); return false; });

        function mk(label, cls, cb) {
            const b = document.createElement("input");
            b.type = "button";
            b.value = label;
            b.className = cls;
            b.setAttribute("entryid", entryID);
            b.style.padding = isDetailPage ? "8px 16px" : "2px 6px";
            b.style.borderRadius = "4px";
            b.style.cursor = "pointer";
            b.style.background = "transparent";
            b.style.fontSize = isDetailPage ? "14px" : "12px";
            b.style.minWidth = isDetailPage ? "100px" : "70px";
            b.style.height = isDetailPage ? "36px" : "28px";
            b.style.lineHeight = isDetailPage ? "20px" : "24px";
            b.style.boxSizing = "border-box";
            b.style.whiteSpace = "nowrap";
            b.style.fontFamily = "inherit";
            b.style.fontWeight = "500";
            b.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            b.style.transition = "all 0.15s ease";
            b.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                const oldFlag = localStorage.getItem(entryID);
                cb(entryID);
                const newFlag = localStorage.getItem(entryID);
                logState(`Manga ${entryID}: ${oldFlag || "null"} → ${newFlag || "null"}`);
                if (!isDetailPage) {
                    categorize();
                } else {
                    updateButtonColors(row, newFlag);
                }
                return false;
            });

            b.addEventListener("mouseenter", () => {
                b.style.opacity = "0.9";
                b.style.transform = "translateY(-1px)";
                b.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
            });
            b.addEventListener("mouseleave", () => {
                b.style.opacity = "1";
                b.style.transform = "translateY(0)";
                b.style.boxShadow = "none";
            });

            return b;
        }

        row.appendChild(mk("Read", "weebdexpp-read", id => localStorage.setItem(id, "1")));
        row.appendChild(mk("Ignore", "weebdexpp-ignore", id => localStorage.setItem(id, "-1")));
        row.appendChild(mk("Clear", "weebdexpp-clear", id => localStorage.removeItem(id)));

        return row;
    }

    function updateButtonColors(row, flag) {
        const readBtn = row.querySelector(".weebdexpp-read");
        const ignoreBtn = row.querySelector(".weebdexpp-ignore");

        if (flag === "1") {
            readBtn.style.background = READ_BUTTON_COLOR;
            ignoreBtn.style.background = "transparent";
        } else if (flag === "-1") {
            readBtn.style.background = "transparent";
            ignoreBtn.style.background = IGNORE_BUTTON_COLOR;
        } else {
            readBtn.style.background = "transparent";
            ignoreBtn.style.background = "transparent";
        }
    }

/* ================= INIT ================= */

function runOnce(){

    if(!scriptLoaded){
        logState("Script loaded");
        scriptLoaded=true;
    }

    addToggleControls();
    addControlsToAll();

    if(location.pathname.startsWith("/search")){
        observeSearchPage();
        categorizeSearch();
    }else{
        categorize();
    }
}

function startPolling(){

    runOnce();

    setInterval(runOnce,2000);
}

if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",startPolling);
}else{
    startPolling();
}

})();
