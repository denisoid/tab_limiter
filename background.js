chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {

        console.log(chrome.storage.sync.get("domains"));

        chrome.storage.sync.get("domains", ({domains}) => {
            if (domains) {
                for (const domain in domains) {
                    if (changeInfo.url.includes(domain)) {
                        const maxTabs = domains[domain];

                        chrome.tabs.query({url: `*://*.${domain}/*`}, (tabs) => {
                            if (tabs.length > maxTabs) {
                                chrome.tabs.remove(tab.id);
                                chrome.notifications.create({
                                    type: "basic",
                                    iconUrl: "favicon-32x32.png",
                                    title: "Tab Limiter",
                                    message: "You can open only " + maxTabs + " tab" + (maxTabs > 1 ? "s" : "") + " from " + domain,
                                });
                            }
                        })
                    }
                }
            }
        });
    }
});