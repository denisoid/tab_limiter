const LimitAction = Object.freeze({BLOCK: "block", CLOSE_OLDEST: "close_oldest"});

document.addEventListener("DOMContentLoaded", () => {
    const domainForm = document.getElementById("domain-form");
    const domainList = document.getElementById("domain-list");

    function makeNumStepper(min, value, onChange) {
        const wrapper = document.createElement("div");
        wrapper.className = "num-stepper";
        const btnDec = document.createElement("button");
        btnDec.type = "button";
        btnDec.textContent = "−";
        const input = document.createElement("input");
        input.type = "number";
        input.min = String(min);
        input.value = String(value);
        const btnInc = document.createElement("button");
        btnInc.type = "button";
        btnInc.textContent = "+";
        btnDec.addEventListener("click", () => { input.stepDown(); onChange(parseInt(input.value, 10)); });
        btnInc.addEventListener("click", () => { input.stepUp();   onChange(parseInt(input.value, 10)); });
        input.addEventListener("change",  () => { onChange(parseInt(input.value, 10)); });
        wrapper.append(btnDec, input, btnInc);
        return wrapper;
    }

    const showBadgeCheckbox = document.getElementById("show-badge");

    const totalLimitStepper = makeNumStepper(0, 0, (val) => {
        chrome.storage.sync.set({totalLimit: Number.isFinite(val) && val >= 0 ? val : 0});
    });
    document.getElementById("total-limit").replaceWith(totalLimitStepper);
    const totalLimitInput = totalLimitStepper.querySelector("input");

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

    function getDomainConfig(entry) {
        if (typeof entry === "number") return {maxTabs: entry, action: null};
        return entry || {maxTabs: 1, action: null};
    }

    const maxTabsInput = document.getElementById("max-tabs");
    const [stepDec, stepInc] = maxTabsInput.closest(".num-stepper").querySelectorAll("button");
    stepDec.addEventListener("click", () => maxTabsInput.stepDown());
    stepInc.addEventListener("click", () => maxTabsInput.stepUp());

    chrome.storage.sync.get(
        {domains: {}, showBadge: false, totalLimit: 0, limitAction: LimitAction.BLOCK},
        ({domains, showBadge, totalLimit, limitAction}) => {
            showBadgeCheckbox.checked = !!showBadge;
            totalLimitInput.value = totalLimit;

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
            if (radio.checked) chrome.storage.sync.set({limitAction: radio.value});
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
            domains[domain] = {maxTabs, action: null};

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

    const domainSection = document.getElementById("domain-section");

    function render(domains) {
        domainList.innerHTML = "";
        domainSection.hidden = Object.keys(domains).length === 0;

        for (const domain in domains) {
            const cfg = getDomainConfig(domains[domain]);

            const tr = document.createElement("tr");

            const tdDomain = document.createElement("td");
            tdDomain.textContent = domain;

            const tdTabs = document.createElement("td");
            tdTabs.appendChild(makeNumStepper(1, cfg.maxTabs, (val) => {
                if (!Number.isFinite(val) || val < 1) return;
                chrome.storage.sync.get({domains: {}}, ({domains}) => {
                    const c = getDomainConfig(domains[domain]);
                    domains[domain] = {maxTabs: val, action: c.action};
                    chrome.storage.sync.set({domains});
                });
            }));

            const tdAction = document.createElement("td");
            const select = document.createElement("select");
            [
                {value: "", label: "Global"},
                {value: LimitAction.BLOCK, label: "Block new"},
                {value: LimitAction.CLOSE_OLDEST, label: "Close oldest"},
            ].forEach(({value, label}) => {
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = label;
                if ((cfg.action ?? "") === value) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener("change", () => {
                chrome.storage.sync.get({domains: {}}, ({domains}) => {
                    const c = getDomainConfig(domains[domain]);
                    domains[domain] = {maxTabs: c.maxTabs, action: select.value || null};
                    chrome.storage.sync.set({domains});
                });
            });
            tdAction.appendChild(select);

            const tdRemove = document.createElement("td");
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "secondary";
            removeButton.textContent = "×";
            removeButton.addEventListener("click", () => {
                delete domains[domain];
                chrome.storage.sync.set({domains}, () => updateDomainList(domains));
            });
            tdRemove.appendChild(removeButton);

            tr.appendChild(tdDomain);
            tr.appendChild(tdTabs);
            tr.appendChild(tdAction);
            tr.appendChild(tdRemove);
            domainList.appendChild(tr);
        }
    }
});
