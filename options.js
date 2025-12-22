document.addEventListener("DOMContentLoaded", () => {
    const domainForm = document.getElementById("domain-form");
    const domainList = document.getElementById("domain-list");
    const showBadgeCheckbox = document.getElementById("show-badge");

    function normalizeDomainInput(input) {
        let v = (input || "").trim().toLowerCase();
        if (!v) return "";

        try {
            if (v.includes("://")) return new URL(v).hostname.toLowerCase();
        } catch (_) {
        }

        v = v.split("/")[0];
        return v;
    }

    chrome.storage.sync.get({ domains: {}, showBadge: false }, ({ domains, showBadge }) => {
        showBadgeCheckbox.checked = !!showBadge;
        updateDomainList(domains);
    });

    showBadgeCheckbox.addEventListener("change", () => {
        chrome.storage.sync.set({showBadge: showBadgeCheckbox.checked});
    });

    domainForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const domainRaw = domainForm.domain.value;
        const domain = normalizeDomainInput(domainRaw);
        const maxTabs = parseInt(domainForm["max-tabs"].value, 10);

        if (!domain || !Number.isFinite(maxTabs) || maxTabs < 1) return;

        chrome.storage.sync.get({domains: {}}, ({domains}) => {
            domains = domains || {};
            domains[domain] = maxTabs;

            chrome.storage.sync.set({domains}, () => {
                domainForm.domain.value = "";
                updateDomainList(domains);
            });
        });
    });

    function updateDomainList(domainsArg) {
        if (domainsArg) {
            render(domainsArg);
            return;
        }
        chrome.storage.sync.get({domains: {}}, ({domains}) => render(domains || {}));
    }

    function render(domains) {
        domainList.innerHTML = "";

        for (const domain in domains) {
            const li = document.createElement("li");
            li.textContent = `${domain}: ${domains[domain]} tabs`;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "Delete";
            removeButton.addEventListener("click", () => {
                delete domains[domain];
                chrome.storage.sync.set({domains}, () => updateDomainList(domains));
            });

            li.appendChild(removeButton);
            domainList.appendChild(li);
        }
    }
});
