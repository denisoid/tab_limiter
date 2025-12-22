const actionApi = chrome.action || chrome.browserAction;

function normalizeHostnameFromUrl(url) {
    try {
        const u = new URL(url);
        return (u.hostname || "").toLowerCase();
    } catch (_) {
        return "";
    }
}

function hostnameMatchesDomain(hostname, domain) {
    hostname = (hostname || "").toLowerCase();
    domain = (domain || "").toLowerCase();
    return hostname === domain || hostname.endsWith("." + domain);
}

function getBestMatchingDomain(hostname, domainsObj) {
    let best = null;
    for (const d in (domainsObj || {})) {
        if (hostnameMatchesDomain(hostname, d)) {
            if (!best || d.length > best.length) best = d;
        }
    }
    return best;
}

function getUrlPatterns(domain) {
    return [`*://${domain}/*`, `*://*.${domain}/*`];
}

function setBadge(tabId, text, color) {
    if (!actionApi) return;
    actionApi.setBadgeText({tabId, text: text || ""});
    if (color && actionApi.setBadgeBackgroundColor) {
        actionApi.setBadgeBackgroundColor({tabId, color});
    }
}

function clearBadge(tabId) {
    setBadge(tabId, "");
}

function updateBadgeForActiveTab() {
    chrome.storage.sync.get({domains: {}, showBadge: false}, ({domains, showBadge}) => {

        // если выключено — очистим на активной вкладке
        if (!showBadge) {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                const t = tabs && tabs[0];
                if (t && typeof t.id === "number") clearBadge(t.id);
            });
            return;
        }

        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const activeTab = tabs && tabs[0];
            if (!activeTab || typeof activeTab.id !== "number") return;

            const hostname = normalizeHostnameFromUrl(activeTab.url);
            if (!hostname) {
                clearBadge(activeTab.id);
                return;
            }

            const matchedDomain = getBestMatchingDomain(hostname, domains);
            if (!matchedDomain) {
                clearBadge(activeTab.id);
                return;
            }

            const maxTabs = domains[matchedDomain];

            chrome.tabs.query({url: getUrlPatterns(matchedDomain)}, (matchedTabs) => {
                const openCount = (matchedTabs || []).length;
                let left = maxTabs - openCount;
                if (left < 0) left = 0;

                const text = left > 9 ? "9+" : String(left);
                setBadge(activeTab.id, text, left === 0 ? "#d93025" : "#1a73e8");
            });
        });
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;

    chrome.storage.sync.get({domains: {}}, ({domains}) => {
        const hostname = normalizeHostnameFromUrl(changeInfo.url);
        if (!hostname) return;

        const matchedDomain = getBestMatchingDomain(hostname, domains);
        if (!matchedDomain) return;

        const maxTabs = domains[matchedDomain];

        chrome.tabs.query({url: getUrlPatterns(matchedDomain)}, (tabs) => {
            if ((tabs || []).length > maxTabs) {
                chrome.tabs.remove(tabId);
                chrome.notifications.create({
                    type: "basic",
                    iconUrl: "favicon-32x32.png",
                    title: "Tab Limiter",
                    message:
                        "You can open only " +
                        maxTabs +
                        " tab" +
                        (maxTabs > 1 ? "s" : "") +
                        " from " +
                        matchedDomain,
                });
            } else {
                updateBadgeForActiveTab();
            }
        });
    });
});

chrome.tabs.onActivated.addListener(() => updateBadgeForActiveTab());
chrome.tabs.onRemoved.addListener(() => updateBadgeForActiveTab());
chrome.tabs.onCreated.addListener(() => updateBadgeForActiveTab());
chrome.windows.onFocusChanged?.addListener(() => updateBadgeForActiveTab());

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.domains || changes.showBadge) updateBadgeForActiveTab();
});

updateBadgeForActiveTab();
