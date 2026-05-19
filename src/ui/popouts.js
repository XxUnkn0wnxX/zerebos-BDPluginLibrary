/**
 * Allows an easy way to create and show popouts.
 * @module Popouts
 */

import {DiscordModules, DOMTools, WebpackModules, Patcher, DiscordClassModules, Utilities} from "modules";

const React = DiscordModules.React;
const {useReducer, useEffect, useRef} = React;

const getAppLayer = () => WebpackModules.getModule(m => Object.values(m).some(v => v?.displayName === "AppLayer"));
const getReferencePositionLayer = () => WebpackModules.getModule(m => m?.prototype?.calculatePositionStyle, {searchExports: true});
const getLayerProvider = (appLayer = getAppLayer()) => Object.values(appLayer ?? {}).find(m => m?.displayName === "AppLayerProvider")?.().props.layerContext?.Provider; // eslint-disable-line new-cap
const getComponentDispatch = () => WebpackModules.getModule(m => m.toString?.().includes("useContext") && m.toString?.().includes(".windowDispatch"), {searchExports: true});
const getComponentActions = () => WebpackModules.getModule(m => m.POPOUT_SHOW, {searchExports: true});
const getPopoutComponent = () => WebpackModules.getModule(m => m?.defaultProps && m?.Animation, {searchExports: true})
    ?? WebpackModules.getModule(m => m?.toString?.().includes("nudgeAlignIntoViewport") && m?.toString?.().includes("positionKey"), {searchExports: true});
const getThemeContext = () => WebpackModules.getModule(m => m?.toString?.().includes(".DARK") && m?.toString?.().includes("primaryColor") && m?.toString?.().includes("Provider"), {searchExports: true});
const getHooksModule = () => WebpackModules.getModule(m => typeof m?.useSyncExternalStore === "function");
const getThemeStore = () => WebpackModules.getModule(m => m.theme);

const createStore = state => {
    const listeners = new Set();

    const setState = function (getter = _ => _) {
        const partial = getter(state);
        if (partial === state) return;

        state = partial;

        [...listeners].forEach(e => e());
    };

    setState.getState = () => state;

    function storeListener(getter = _ => _) {
        const [, forceUpdate] = useReducer(n => !n, true);

        useEffect(() => {
            const dispatch = () => {forceUpdate();};

            listeners.add(dispatch);

            return () => {listeners.delete(dispatch);};
        });

        return getter(state);
    }

    return [
        setState,
        storeListener
    ];
};

const [setPopouts, usePopouts] = createStore([]);

// const AnimationTypes = {FADE: 3, SCALE: 2, TRANSLATE: 1};

export default class Popouts {

    static get runtime() {
        return this._runtime || null;
    }

    static resolveRuntime() {
        const ReactDOM = DiscordModules.ReactDOM;
        const appLayer = getAppLayer();
        const runtime = {
            ReactDOM,
            ReferencePositionLayer: getReferencePositionLayer(),
            LayerProvider: getLayerProvider(appLayer),
            ComponentDispatch: getComponentDispatch(),
            ComponentActions: getComponentActions(),
            Popout: getPopoutComponent(),
            ThemeContext: getThemeContext(),
            Hooks: getHooksModule(),
            ThemeStore: getThemeStore()
        };

        if (!runtime.ReactDOM || !runtime.ReferencePositionLayer || !runtime.Popout) return null;
        return runtime;
    }

    static warmRuntime() {
        void DiscordModules.ReactDOM;
        void DiscordModules.UserPopout;
        void DiscordModules.ModalRoot;
        void DiscordModules.UserProfileModals;
        void DiscordClassModules.TooltipLayers;
    }

    // static get AnimationTypes() {return AnimationTypes;}

    static initialize() {
        if (this._initialized) return true;
        this.warmRuntime();
        const runtime = this.resolveRuntime();
        if (!React || !runtime) return false;
        this.dispose();
        this.popouts = 0;
        this._initialized = true;
        this._runtime = runtime;

        this.container = Object.assign(document.createElement("div"), {
            className: "ZeresPluginLibraryPopoutsRenderer",
            style: "display: none;"
        });

        this.layerContainer = Object.assign(document.createElement("div"), {
            id: "ZeresPluginLibraryPopouts",
            className: DiscordClassModules.TooltipLayers.layerContainer || "ZeresPluginLibraryPopoutsLayer"
        });

        document.body.append(this.container, this.layerContainer);
        if (typeof runtime.ReactDOM.createRoot === "function") {
            this._reactRoot = runtime.ReactDOM.createRoot(this.layerContainer);
            this._reactRoot.render(React.createElement(PopoutsContainer));
            return true;
        }
        runtime.ReactDOM.render(React.createElement(PopoutsContainer), this.layerContainer);
        return true;
    }

    /**
     * Shows the user popout for a user relative to a target element
     * @param {HTMLElement} target - Element to show the popout in relation to
     * @param {object} user - Discord User object for the user to show
     * @param {object} [options] - Options to modify the request
     * @param {string} [options.guild="currentGuildId"] - Id of the guild  (uses current if not specified)
     * @param {string} [options.channel="currentChannelId"] - Id of the channel (uses current if not specified)
     * @param {string} [options.position="right"] - Positioning relative to element
     * @param {string} [options.align="top"] - Positioning relative to element
     */
    static showUserPopout(target, user, options = {}) {
        if (!this.initialize()) return null;
        if (!DiscordModules.UserPopout) return null;

        const currentUser = DiscordModules.UserStore?.getCurrentUser?.();
        const {position = "right", align = "top", guild = DiscordModules.SelectedGuildStore?.getGuildId?.(), channel = DiscordModules.SelectedChannelStore?.getChannelId?.()} = options;
        target = DOMTools.resolveElement(target);
        if (!target || !user?.id) return null;
        // if (target.getBoundingClientRect().right + 250 >= DOMTools.screenWidth && options.autoInvert) position = "left";
        // if (target.getBoundingClientRect().bottom + 400 >= DOMTools.screenHeight && options.autoInvert) align = "bottom";
        // if (target.getBoundingClientRect().top - 400 >= DOMTools.screenHeight && options.autoInvert) align = "top";
        return this.openPopout(target, {
            position: position,
            align: align,
            // animation: options.animation || Popouts.AnimationTypes.TRANSLATE,
            autoInvert: options.autoInvert,
            nudgeAlignIntoViewport: options.nudgeAlignIntoViewport,
            spacing: options.spacing,
            render: (props) => {
                return DiscordModules.React.createElement(DiscordModules.UserPopout, Object.assign({}, props, {
                    user: user,
                    currentUser: currentUser,
                    userId: user.id,
                    guildId: guild,
                    channelId: channel,
                    closePopout: () => this.closePopout(props.popoutId)
                }));
            }
        });
    }

    /**
     * Shows a react popout relative to a target element
     * @param {HTMLElement} target - Element to show the popout in relation to
     * @param {object} [options] - Options to modify the request
     * @param {string} [options.position="right"] - General position relative to element
     * @param {string} [options.align="top"] - Alignment relative to element
     * @param {boolean} [options.autoInvert=true] - Try to automatically adjust the position if it overflows the screen
     * @param {boolean} [options.nudgeAlignIntoViewport=true] - Try to automatically adjust the alignment if it overflows the screen
     * @param {number} [options.spacing=8] - Spacing between target and popout
     */
    static openPopout(target, options) {
        if (!this.initialize()) return null;
        const {Popout, ReactDOM} = this.runtime;
        if (!Popout || !ReactDOM) return null;
        const id = this.popouts++;

        setPopouts(popouts => popouts.concat({
            id: id,
            element: React.createElement(PopoutWrapper, Object.assign({}, Popout.defaultProps, {
                reference: {current: target},
                popoutId: id,
                key: "popout_" + id,
                spacing: 50
            }, options))
        }));

        return id;
    }

    static closePopout(id) {
        const popout = setPopouts.getState().find(e => e.id === id);

        if (!popout) return null;

        setPopouts(popouts => {
            const clone = [...popouts];
            clone.splice(clone.indexOf(popout), 1);
            return clone;
        });
    }

    static dispose() {
        Patcher.unpatchAll("Popouts");
        const container = document.querySelector(".ZeresPluginLibraryPopoutsRenderer");
        const layerContainer = document.querySelector("#ZeresPluginLibraryPopouts");
        const ReactDOM = this.runtime?.ReactDOM;
        this._initialized = false;
        this.popouts = 0;
        this._runtime = null;
        if (this._reactRoot) {
            this._reactRoot.unmount();
            this._reactRoot = null;
        }
        else if (layerContainer && typeof ReactDOM?.unmountComponentAtNode === "function") ReactDOM.unmountComponentAtNode(layerContainer);
        if (container) container.remove();
        if (layerContainer) layerContainer.remove();
    }
}

function DiscordProviders({children, container}) {
    const {Hooks, ThemeStore, LayerProvider, ThemeContext} = Popouts.runtime;
    let theme;
    try {
        if (
            ThemeStore
            && typeof Hooks?.useSyncExternalStore === "function"
            && typeof ThemeStore.addChangeListener === "function"
        ) {
            theme = Hooks.useSyncExternalStore((listener) => {
                ThemeStore.addChangeListener(listener);
                return () => ThemeStore.removeChangeListener?.(listener);
            }, () => ThemeStore.theme);
        }
        else theme = ThemeStore?.theme;
    }
    catch {
        theme = ThemeStore?.theme;
    }
    const LayerWrapper = LayerProvider || React.Fragment;
    const ThemeWrapper = ThemeContext || React.Fragment;

    return React.createElement(LayerWrapper, LayerProvider ? {value: [container]} : null,
                React.createElement(ThemeWrapper, ThemeContext ? {theme} : null, children)
            );
}

function PopoutsContainer() {
    const popouts = usePopouts();

    return React.createElement(DiscordProviders,
        {container: Popouts.layerContainer},
        popouts.map((popout) => popout.element)
    );
}

function PopoutWrapper({render, popoutId, ...props}) {
    const popoutRef = useRef();
    const {ReactDOM, ReferencePositionLayer, ComponentDispatch, ComponentActions} = Popouts.runtime;

    useEffect(() => {
        if (!popoutRef.current) return;

        const node = typeof ReactDOM?.findDOMNode === "function" ? ReactDOM.findDOMNode(popoutRef.current) : null;
        if (!(node instanceof Element)) return;

        const handleClick = ({target}) => {
            if (target === node || node.contains(target)) return;

            Popouts.closePopout(popoutId);
        };

        const target = Utilities.findInTree(node.__reactFiber$, m => m?.stateNode?.updatePosition, {walkable: ["return"]});
        setTimeout(() => target?.stateNode?.updatePosition(), 1);

        document.addEventListener("click", handleClick);

        return () => {
            document.removeEventListener("click", handleClick);
        };
    }, [popoutRef]);

    // switch (animation) {
    //     case PopoutCSSAnimator.Types.FADE:
    //     case PopoutCSSAnimator.Types.SCALE:
    //     case PopoutCSSAnimator.Types.TRANSLATE: {
    //         const renderPopout = render;
    //         render = (renderProps) => {
    //             return React.createElement(PopoutCSSAnimator, {
    //                 position: renderProps.position,
    //                 type: animation
    //             }, renderPopout(renderProps));
    //         };
    //     }
    // }

    // eslint-disable-next-line new-cap
    const ComponentDispatcher = ComponentDispatch?.();

    return React.createElement(ReferencePositionLayer, Object.assign(props, {
        ref: popoutRef,
        positionKey: "0",
        autoInvert: true,
        nudgeAlignIntoViewport: true,
        id: "popout_" + popoutId,
        animation: 2,
        onMount() {
            ComponentDispatcher?.dispatch?.(ComponentActions.POPOUT_SHOW);
        },
        onUnmount() {
            ComponentDispatcher?.dispatch?.(ComponentActions.POPOUT_HIDE);
        },
        children: (props, ...p) => React.createElement(
            "div",
            {
                style: {transform: "translateZ(0)"}, // for z-index to work properly for sub-popouts
            },
            render({popoutId, ...props}, ...p)
        )
    }));
}
