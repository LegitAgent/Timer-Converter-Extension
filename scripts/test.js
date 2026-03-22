(() => {
    // avoid registering multiple listeners if script gets injected again
    if (window.__timeExtensionPageControllerLoaded) return;
    window.__timeExtensionPageControllerLoaded = true;

    const STYLE_ID = "time-extension-hide-page-style";

    function enableHidePage() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            html, body {
                visibility: hidden !important;
            }
        `;

        document.documentElement.appendChild(style);
        console.log("Page hidden.");
    }

    function disableHidePage() {
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();

        console.log("Page restored.");
    }

    window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (event.data?.type !== "TIME_EXTENSION_TOGGLE") return;

        if (event.data.enabled) {
            enableHidePage();
        } else {
            disableHidePage();
        }
    });

    console.log("Time extension page controller loaded.");
})();