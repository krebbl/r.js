(function (window, inherit, r) {

    var isObject = function (obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    var _defaults = function (obj) {
        if (!isObject(obj)) return obj;
        for (var i = 1, length = arguments.length; i < length; i++) {
            var source = arguments[i];
            for (var prop in source) {
                if (obj[prop] === void 0) obj[prop] = source[prop];
            }
        }
        return obj;
    };

    var rAction = {};

    rAction.Actions = r.EventDispatcher.inherit({
        actions: {},
        ns: "default",
        ctor: function (executor) {

            this.callBase();

            function createActionFnc(executor, ns, action, defaultPayload) {

                return function (payload) {
                    _defaults(payload, defaultPayload);
                    executor.execute(ns, action, payload);
                }
            }

            var payload;
            var self = this;
            this.executor = executor;
            for (var action in this.actions) {
                if (this.actions.hasOwnProperty(action)) {
                    payload = this.actions[action];
                    this.factory.prototype[action] = createActionFnc(this.executor, this.ns, action, payload);
                }
            }

        }
    });

    rAction.Store = r.EventDispatcher.inherit({
        name: "store",
        defaults: function () {

        },
        init: function(component){
            component.set(this.name, this);
            this.bind("change", function(e){
                component.emit("change", e.data)
            });
        },
        ctor: function () {
            this.callBase();

            var defaults = this.defaults;
            for (var key in defaults) {
                if (defaults.hasOwnProperty(key)) {
                    this[key] = defaults[key];
                }
            }
        },
        handlesAction: function (ns, action) {
            return this.ns === ns && this[action] instanceof Function;
        },
        emit: function (event, data, scope) {
            this.callBase(event, data, scope);
            if (event === "change") {
                this._changeEmitted = true;
            }
        },
        callAction: function (ns, action, payload) {
            if (this.beforeAll instanceof Function) {
                this.beforeAll.call(this, payload, ns, action);
            }

            this._changeEmitted = false;

            if (this[action] instanceof Function) {
                this[action].call(this, payload);
            }

            if (!this._changeEmitted) {
                this.emit("change");
            }

            if (this.afterAll instanceof Function) {
                this.afterAll.call(this, payload, ns, action);
            }
        }
    });

    rAction.Executor = inherit.Base.inherit({
        ctor: function (stores) {
            this.callBase();
            this.stores = stores || [];
        },

        addStore: function (store) {
            this.stores.push(store);
        },

        removeStore: function (store) {
            // TODO: implement
        },

        execute: function (ns, action, payload) {
            for (var i = 0; i < this.stores.length; i++) {
                var store = this.stores[i];
                if (store.handlesAction(ns, action)) {
                    store.callAction(ns, action, payload);
                }
            }
        }

    });

    window.rAction = rAction;

})
(window, inherit, r);