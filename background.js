const LimitAction = Object.freeze({ BLOCK: "block", CLOSE_OLDEST: "close_oldest" });

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

// entry: number (legacy) | { maxTabs, action: LimitAction.* | null }
function getDomainConfig(entry) {
    if (typeof entry === "number") return { maxTabs: entry, action: null };
    return entry || { maxTabs: 1, action: null };
}

// null = use global
function getEffectiveAction(domainAction, globalAction) {
    return domainAction ?? globalAction ?? LimitAction.BLOCK;
}

function setBadge(tabId, text, color) {
    if (!actionApi) return;
    actionApi.setBadgeText({tabId, text: text || ""}).catch(() => {});
    if (color && actionApi.setBadgeBackgroundColor) {
        actionApi.setBadgeBackgroundColor({tabId, color}).catch(() => {});
    }
}

function clearBadge(tabId) {
    setBadge(tabId, "");
}

function updateBadgeForActiveTab() {
    chrome.storage.sync.get({domains: {}, showBadge: false}, ({domains, showBadge}) => {

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

            const cfg = getDomainConfig(domains[matchedDomain]);

            chrome.tabs.query({url: getUrlPatterns(matchedDomain)}, (matchedTabs) => {
                const openCount = (matchedTabs || []).length;
                let left = cfg.maxTabs - openCount;
                if (left < 0) left = 0;

                const text = left > 9 ? "9+" : String(left);
                setBadge(activeTab.id, text, left === 0 ? "#d93025" : "#1a73e8");
            });
        });
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;

    chrome.storage.sync.get({domains: {}, limitAction: LimitAction.BLOCK}, ({domains, limitAction}) => {
        const hostname = normalizeHostnameFromUrl(changeInfo.url);
        if (!hostname) return;

        const matchedDomain = getBestMatchingDomain(hostname, domains);
        if (!matchedDomain) return;

        const cfg = getDomainConfig(domains[matchedDomain]);
        const maxTabs = cfg.maxTabs;
        const action = getEffectiveAction(cfg.action, limitAction);

        chrome.tabs.query({url: getUrlPatterns(matchedDomain)}, (tabs) => {
            if ((tabs || []).length > maxTabs) {
                if (action === LimitAction.CLOSE_OLDEST) {
                    const sorted = [...tabs].sort((a, b) => a.index - b.index);
                    const oldest = sorted.find(t => t.id !== tabId) || sorted[0];
                    chrome.tabs.remove(oldest.id).catch(() => {});
                } else {
                    chrome.tabs.remove(tabId).catch(() => {});
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
                }
            } else {
                updateBadgeForActiveTab();
            }
        });
    });
});

chrome.tabs.onActivated.addListener(() => updateBadgeForActiveTab());
chrome.tabs.onRemoved.addListener(() => updateBadgeForActiveTab());
chrome.tabs.onCreated.addListener((tab) => {
    updateBadgeForActiveTab();

    chrome.storage.sync.get({totalLimit: 0, limitAction: LimitAction.BLOCK}, ({totalLimit, limitAction}) => {
        if (!totalLimit || totalLimit < 1) return;

        chrome.tabs.query({}, (tabs) => {
            const userTabs = tabs || [];
            if (userTabs.length > totalLimit) {
                if (limitAction === LimitAction.CLOSE_OLDEST) {
                    const sorted = userTabs.sort((a, b) => a.index - b.index);
                    const oldest = sorted.find(t => t.id !== tab.id) || sorted[0];
                    chrome.tabs.remove(oldest.id).catch(() => {});
                } else {
                    chrome.tabs.remove(tab.id).catch(() => {});
                    chrome.notifications.create({
                        type: "basic",
                        iconUrl: "favicon-32x32.png",
                        title: "Tab Limiter",
                        message:
                            "Maximum " +
                            totalLimit +
                            " tab" +
                            (totalLimit > 1 ? "s" : "") +
                            " allowed globally",
                    });
                }
            }
        });
    });
});
chrome.windows.onFocusChanged?.addListener(() => updateBadgeForActiveTab());

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.domains || changes.showBadge || changes.totalLimit) updateBadgeForActiveTab();
});

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

updateBadgeForActiveTab();
