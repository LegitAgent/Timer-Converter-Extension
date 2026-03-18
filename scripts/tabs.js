import { savePopupState } from "./manageState.js";
import { DOM } from "./dom.js";

/**
 * sets up the navigation bar at the top of the extension
 */
export function setUpTabs() {
    DOM.tabs.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            DOM.tabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            DOM.slider.style.transform = `translateX(${index * 100}%)`;
            DOM.track.style.transform = `translateX(-${index * 50}%)`;
            savePopupState();
        });
    });
}