const LimitAction = Object.freeze({ BLOCK: "block", CLOSE_OLDEST: "close_oldest" });

document.addEventListener("DOMContentLoaded", () => {
    const domainForm = document.getElementById("domain-form");
    const domainList = document.getElementById("domain-list");
    const showBadgeCheckbox = document.getElementById("show-badge");
    const totalLimitInput = document.getElementById("total-limit");
    const saveTotalLimitBtn = document.getElementById("save-total-limit");
    const totalLimitStatus = document.getElementById("total-limit-status");

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

    // entry: number (legacy) | { maxTabs, action: LimitAction.* | null }
    function getDomainConfig(entry) {
        if (typeof entry === "number") return { maxTabs: entry, action: null };
        return entry || { maxTabs: 1, action: null };
    }

    chrome.storage.sync.get({ domains: {}, showBadge: false, totalLimit: 0, limitAction: LimitAction.BLOCK }, ({ domains, showBadge, totalLimit, limitAction }) => {
        showBadgeCheckbox.checked = !!showBadge;
        if (totalLimit > 0) totalLimitInput.value = totalLimit;

        const radio = document.querySelector(`input[name="limit-action"][value="${limitAction}"]`);
        if (radio) radio.checked = true;
        else document.getElementById("action-block").checked = true;

        updateDomainList(domains);
    });

    showBadgeCheckbox.addEventListener("change", () => {
        chrome.storage.sync.set({showBadge: showBadgeCheckbox.checked});
    });

    document.querySelectorAll('input[name="limit-action"]').forEach(radio => {
        radio.addEventListener("change", () => {
            if (radio.checked) chrome.storage.sync.set({ limitAction: radio.value });
        });
    });

    saveTotalLimitBtn.addEventListener("click", () => {
        const val = parseInt(totalLimitInput.value, 10);
        const totalLimit = Number.isFinite(val) && val >= 1 ? val : 0;
        chrome.storage.sync.set({totalLimit}, () => {
            totalLimitStatus.style.display = "inline";
            setTimeout(() => { totalLimitStatus.style.display = "none"; }, 2000);
        });
    });

    domainForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const domainRaw = domainForm.domain.value;
        const domain = normalizeDomainInput(domainRaw);
        const maxTabs = parseInt(domainForm["max-tabs"].value, 10);

        if (!domain || !Number.isFinite(maxTabs) || maxTabs < 1) return;

        chrome.storage.sync.get({domains: {}}, ({domains}) => {
            domains = domains || {};
            const existing = getDomainConfig(domains[domain]);
            domains[domain] = { maxTabs, action: existing.action };

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
            const cfg = getDomainConfig(domains[domain]);
            const li = document.createElement("li");

            li.appendChild(document.createTextNode(`${domain}: ${cfg.maxTabs} tab${cfg.maxTabs !== 1 ? "s" : ""}  `));

            const select = document.createElement("select");
            [
                { value: "",                        label: "Default (global)" },
                { value: LimitAction.BLOCK,         label: "Block new tab" },
                { value: LimitAction.CLOSE_OLDEST,  label: "Close oldest tab" },
            ].forEach(({ value, label }) => {
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = label;
                if ((cfg.action ?? "") === value) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener("change", () => {
                chrome.storage.sync.get({domains: {}}, ({domains}) => {
                    const c = getDomainConfig(domains[domain]);
                    domains[domain] = { maxTabs: c.maxTabs, action: select.value || null };
                    chrome.storage.sync.set({domains});
                });
            });

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "Delete";
            removeButton.addEventListener("click", () => {
                delete domains[domain];
                chrome.storage.sync.set({domains}, () => updateDomainList(domains));
            });

            li.appendChild(select);
            li.appendChild(removeButton);
            domainList.appendChild(li);
        }
    }
});
