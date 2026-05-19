/**
 * Tooltip that automatically show and hide themselves on mouseenter and mouseleave events.
 * Will also remove themselves if the node to watch is removed from DOM through
 * a MutationObserver.
 *
 * Note this is not using Discord's internals but normal DOM manipulation and emulates
 * Discord's own tooltips as closely as possible.
 *
 * @module Tooltip
 */

import {DOMTools, DiscordClasses, DiscordSelectors, Logger, WebpackModules} from "modules";

const TOOLTIP_STYLE_ID = "ZLibraryTooltipFallback";
const fallbackClasses = {
    top: "zpl-tooltip-top",
    right: "zpl-tooltip-right",
    bottom: "zpl-tooltip-bottom",
    left: "zpl-tooltip-left",
    black: "zpl-tooltip-black",
    brand: "zpl-tooltip-brand",
    green: "zpl-tooltip-green",
    grey: "zpl-tooltip-grey",
    red: "zpl-tooltip-red",
    yellow: "zpl-tooltip-yellow",
    layer: "zpl-tooltip-layer",
    tooltip: "zpl-tooltip",
    tooltipPointer: "zpl-tooltip-pointer",
    tooltipContent: "zpl-tooltip-content",
    tooltipDisablePointerEvents: "zpl-tooltip-disable-pointer-events",
    disabledPointerEvents: "zpl-tooltip-disable-pointer-events"
};

const fallbackCSS = `
    .zpl-tooltip-layer {
        position: fixed;
        z-index: 1002;
        pointer-events: none;
    }

    .zpl-tooltip {
        position: relative;
        max-width: 240px;
        padding: 8px 12px;
        border-radius: 5px;
        font-size: 14px;
        line-height: 1.2;
        box-shadow: var(--elevation-high, 0 8px 16px rgba(0, 0, 0, 0.24));
        background: var(--background-floating, #111214);
        color: var(--text-normal, #fff);
    }

    .zpl-tooltip-pointer {
        position: absolute;
        width: 10px;
        height: 10px;
        background: inherit;
        transform: rotate(45deg);
    }

    .zpl-tooltip-top .zpl-tooltip-pointer {
        bottom: -5px;
        left: calc(50% - 5px);
    }

    .zpl-tooltip-bottom .zpl-tooltip-pointer {
        top: -5px;
        left: calc(50% - 5px);
    }

    .zpl-tooltip-left .zpl-tooltip-pointer {
        right: -5px;
        top: calc(50% - 5px);
    }

    .zpl-tooltip-right .zpl-tooltip-pointer {
        left: -5px;
        top: calc(50% - 5px);
    }

    .zpl-tooltip-brand {
        background: var(--brand-500, #5865f2);
        color: #fff;
    }

    .zpl-tooltip-green {
        background: var(--status-positive, #248046);
        color: #fff;
    }

    .zpl-tooltip-grey {
        background: var(--background-secondary, #2b2d31);
        color: var(--text-normal, #fff);
    }

    .zpl-tooltip-red {
        background: var(--status-danger, #da373c);
        color: #fff;
    }

    .zpl-tooltip-yellow {
        background: var(--status-warning, #f0b232);
        color: #111214;
    }

    .zpl-tooltip-disable-pointer-events {
        pointer-events: none;
    }
`;

const ensureFallbackStyles = function() {
    if (document.getElementById(TOOLTIP_STYLE_ID)) return;
    DOMTools.addStyle(TOOLTIP_STYLE_ID, fallbackCSS);
};

const classString = function(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.toString();
};

const getTooltipClass = function(prop) {
    return classString(DiscordClasses.Tooltips?.[prop]) || fallbackClasses[prop] || "";
};

const getLayerClass = function(prop) {
    return classString(DiscordClasses.TooltipLayers?.[prop]) || fallbackClasses[prop] || "";
};

const getClass = function(sideOrColor) {
    const upperCase = sideOrColor[0].toUpperCase() + sideOrColor.slice(1);
    return getTooltipClass(`tooltip${upperCase}`) || fallbackClasses[sideOrColor.toLowerCase()] || "";
};

const classExists = function(sideOrColor) {
    return !!getClass(sideOrColor);
};

const toPx = function(value) {
    return `${value}px`;
};

/* <div class="layer-v9HyYc da-layer" style="left: 234.5px; bottom: 51px;">
    <div class="tooltip-2QfLtc da-tooltip tooltipTop-XDDSxx tooltipBlack-PPG47z">
        <div class="tooltipPointer-3ZfirK da-tooltipPointer"></div>
        User Settings
    </div>
</div> */

export default class Tooltip {
    /**
     *
     * @constructor
     * @param {(HTMLElement|jQuery)} node - DOM node to monitor and show the tooltip on
     * @param {string} tip - string to show in the tooltip
     * @param {object} options - additional options for the tooltip
     * @param {string} [options.style=black] - correlates to the discord styling/colors (black, brand, green, grey, red, yellow)
     * @param {string} [options.side=top] - can be any of top, right, bottom, left
     * @param {boolean} [options.preventFlip=false] - prevents moving the tooltip to the opposite side if it is too big or goes offscreen
     * @param {boolean} [options.isTimestamp=false] - adds the timestampTooltip class (disables text wrapping)
     * @param {boolean} [options.disablePointerEvents=false] - disables pointer events
     * @param {boolean} [options.disabled=false] - whether the tooltip should be disabled from showing on hover
     */
    constructor(node, text, options = {}) {
        const {style = "black", side = "top", preventFlip = false, isTimestamp = false, disablePointerEvents = false, disabled = false} = options;
        ensureFallbackStyles();
        this.node = DOMTools.resolveElement(node);
        this.label = text;
        this.style = style.toLowerCase();
        this.side = side.toLowerCase();
        this.preventFlip = preventFlip;
        this.isTimestamp = isTimestamp;
        this.disablePointerEvents = disablePointerEvents;
        this.disabled = disabled;
        this.active = false;

        if (!classExists(this.side)) return Logger.err("Tooltip", `Side ${this.side} does not exist.`);
        if (!classExists(this.style)) return Logger.err("Tooltip", `Style ${this.style} does not exist.`);

        this.layerClass = getLayerClass("layer");
        this.tooltipClass = getTooltipClass("tooltip");
        this.tooltipPointerClass = getTooltipClass("tooltipPointer");
        this.tooltipContentClass = getTooltipClass("tooltipContent");
        this.tooltipDisablePointerEventsClass = getTooltipClass("tooltipDisablePointerEvents");
        this._className = `${this.tooltipClass} ${getClass(this.style)}`.trim();

        this.element = DOMTools.createElement(`<div class="${this.layerClass}">`);
        this.tooltipElement = DOMTools.createElement(`<div class="${this._className}"><div class="${this.tooltipPointerClass}"></div><div class="${this.tooltipContentClass}">${this.label}</div></div>`);
        this.labelElement = this.tooltipElement.childNodes[1];
        this.element.append(this.tooltipElement);

        if (this.disablePointerEvents) {
            this.element.classList.add(getLayerClass("disabledPointerEvents"));
            if (this.tooltipDisablePointerEventsClass) this.tooltipElement.classList.add(this.tooltipDisablePointerEventsClass);
        }
        if (this.isTimestamp) this.tooltipElement.classList.add(WebpackModules.getByProps("timestampTooltip").timestampTooltip);


        this.node.addEventListener("mouseenter", () => {
            if (this.disabled) return;
            this.show();
        });

        this.node.addEventListener("mouseleave", () => {
            this.hide();
        });
    }

    /** Alias for the constructor */
    static create(node, text, options = {}) {return new Tooltip(node, text, options);}

    /** Container where the tooltip will be appended. */
    get container() {
        const selector = DiscordSelectors.App?.app?.sibling?.(DiscordSelectors.TooltipLayers?.layerContainer);
        return selector ? (document.querySelector(String(selector)) ?? document.body) : document.body;
    }
    /** Boolean representing if the tooltip will fit on screen above the element */
    get canShowAbove() {return this.node.getBoundingClientRect().top - this.element.offsetHeight >= 0;}
    /** Boolean representing if the tooltip will fit on screen below the element */
    get canShowBelow() {return this.node.getBoundingClientRect().top + this.node.offsetHeight + this.element.offsetHeight <= DOMTools.screenHeight;}
    /** Boolean representing if the tooltip will fit on screen to the left of the element */
    get canShowLeft() {return this.node.getBoundingClientRect().left - this.element.offsetWidth >= 0;}
    /** Boolean representing if the tooltip will fit on screen to the right of the element */
    get canShowRight() {return this.node.getBoundingClientRect().left + this.node.offsetWidth + this.element.offsetWidth <= DOMTools.screenWidth;}

    /** Hides the tooltip. Automatically called on mouseleave. */
    hide() {
        /** Don't rehide if already inactive */
        if (!this.active) return;
        this.active = false;
        this.element.remove();
        this.tooltipElement.className = this._className;
    }

    /** Shows the tooltip. Automatically called on mouseenter. Will attempt to flip if position was wrong. */
    show() {
        /** Don't reshow if already active */
        if (this.active) return;
        this.active = true;
        this.tooltipElement.className = this._className;
        if (this.disablePointerEvents && this.tooltipDisablePointerEventsClass) this.tooltipElement.classList.add(this.tooltipDisablePointerEventsClass);
        if (this.isTimestamp) this.tooltipElement.classList.add(WebpackModules.getByProps("timestampTooltip").timestampTooltip);
        this.labelElement.textContent = this.label;
        this.container.append(this.element);

        if (this.side == "top") {
            if (this.canShowAbove || (!this.canShowAbove && this.preventFlip)) this.showAbove();
            else this.showBelow();
        }

        if (this.side == "bottom") {
            if (this.canShowBelow || (!this.canShowBelow && this.preventFlip)) this.showBelow();
            else this.showAbove();
        }

        if (this.side == "left") {
            if (this.canShowLeft || (!this.canShowLeft && this.preventFlip)) this.showLeft();
            else this.showRight();
        }

        if (this.side == "right") {
            if (this.canShowRight || (!this.canShowRight && this.preventFlip)) this.showRight();
            else this.showLeft();
        }

        /** Do not create a new observer each time if one already exists! */
        if (this.observer) return;
        /** Use an observer in show otherwise you'll cause unclosable tooltips */
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const nodes = Array.from(mutation.removedNodes);
                const directMatch = nodes.indexOf(this.node) > -1;
                const parentMatch = nodes.some(parent => parent.contains(this.node));
                if (directMatch || parentMatch) {
                    this.hide();
                    this.observer.disconnect();
                }
            });
        });

        this.observer.observe(document.body, {subtree: true, childList: true});
    }

    /** Force showing the tooltip above the node. */
    showAbove() {
        this.tooltipElement.classList.add(getClass("top"));
        this.element.style.setProperty("top", toPx(this.node.getBoundingClientRect().top - this.element.offsetHeight - 10));
        this.centerHorizontally();
    }

    /** Force showing the tooltip below the node. */
    showBelow() {
        this.tooltipElement.classList.add(getClass("bottom"));
        this.element.style.setProperty("top", toPx(this.node.getBoundingClientRect().top + this.node.offsetHeight + 10));
        this.centerHorizontally();
    }

    /** Force showing the tooltip to the left of the node. */
    showLeft() {
        this.tooltipElement.classList.add(getClass("left"));
        this.element.style.setProperty("left", toPx(this.node.getBoundingClientRect().left - this.element.offsetWidth - 10));
        this.centerVertically();
    }

    /** Force showing the tooltip to the right of the node. */
    showRight() {
        this.tooltipElement.classList.add(getClass("right"));
        this.element.style.setProperty("left", toPx(this.node.getBoundingClientRect().left + this.node.offsetWidth + 10));
        this.centerVertically();
    }

    centerHorizontally() {
        const nodecenter = this.node.getBoundingClientRect().left + (this.node.offsetWidth / 2);
        this.element.style.setProperty("left", toPx(nodecenter - (this.element.offsetWidth / 2)));
    }

    centerVertically() {
        const nodecenter = this.node.getBoundingClientRect().top + (this.node.offsetHeight / 2);
        this.element.style.setProperty("top", toPx(nodecenter - (this.element.offsetHeight / 2)));
    }
}
