/**
 * A file for all DOM elements that are edited
 */
export const DOM = {
    windowID: null,

    locationButton: document.getElementById("getLocation"),
    timezoneOutput: document.getElementById("timezone"),
    tabs: document.querySelectorAll(".navBtn"),
    slider: document.querySelector(".navSlider"),
    track: document.querySelector(".tabsTrack"),

    extensionToggle: document.getElementById("extensionToggle"),
    toggleStatusText: document.getElementById("toggleStatusText"),

    inputTimeConvert: document.getElementById("convertTimeInput"),

    sourceZoneInput: document.getElementById("sourceZoneSearch"),
    sourceZoneValue: document.getElementById("sourceZone"),
    sourceZoneList: document.getElementById("sourceZoneList"),
    clearSourceZoneButton: document.getElementById("clearSourceZone"),

    targetZoneInput: document.getElementById("targetZoneSearch"),
    targetZoneValue: document.getElementById("targetZone"),
    targetZoneList: document.getElementById("targetZoneList"),
    clearTargetZoneButton: document.getElementById("clearTargetZone"),

    convertButton: document.getElementById("convertTimeZone"),
    convertOutput: document.getElementById("convertTimeZoneOutput"),

    copyPasteInput: document.getElementById("copyPasteInput"),
    copyPasteConvertButton: document.getElementById("convertCopyPaste"),

    copyPasteOutput: document.getElementById("convertCopyPasteOutput"),
    clearCopyPasteButton: document.getElementById("clearCopyPasteInput"),
    copyPasteWrapper: document.querySelector(".textareaWrap"),

    openManualIcon: document.getElementById("openManual"),
};