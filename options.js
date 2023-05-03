document.addEventListener("DOMContentLoaded", () => {
    const domainForm = document.getElementById("domain-form");
    const domainList = document.getElementById("domain-list");

    domainForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const domain = domainForm.domain.value;
        const maxTabs = parseInt(domainForm["max-tabs"].value, 10);

        chrome.storage.sync.get("domains", ({ domains }) => {
            domains = domains || {};
            domains[domain] = maxTabs;
            chrome.storage.sync.set({ domains });

            updateDomainList();
        });
    });

    function updateDomainList() {
        chrome.storage.sync.get("domains", ({ domains }) => {
            domainList.innerHTML = "";

            for (const domain in domains) {
                const li = document.createElement("li");
                li.textContent = `${domain}: ${domains[domain]} tabs`;

                const removeButton = document.createElement("button");
                removeButton.textContent = "Delete";
                removeButton.addEventListener("click", () => {
                    delete domains[domain];
                    chrome.storage.sync.set({ domains });

                    updateDomainList();
                });

                li.appendChild(removeButton);
                domainList.appendChild(li);
            }
        });
    }

    updateDomainList();
});