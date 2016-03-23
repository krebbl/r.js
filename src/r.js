(function (window, inherit) {

    var copy = function (object) {
        var copy = {};
        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                copy[key] = clone(object[key]);
            }
        }

        return copy;
    };

    var isArray = Array.isArray || function (obj) {
            return String.prototype.toString.call(obj) === '[object Array]';
        };

    var clone = function (obj) {
        if (!isObject(obj)) return obj;
        return isArray(obj) ? obj.slice() : extend({}, obj);
    };

    var isObject = function (obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };

    var extend = function (obj) {
        if (!isObject(obj)) return obj;
        var source, prop;
        for (var i = 1, length = arguments.length; i < length; i++) {
            source = arguments[i];
            for (prop in source) {
                if (Object.prototype.hasOwnProperty.call(source, prop)) {
                    obj[prop] = source[prop];
                }
            }
        }
        return obj;
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

    var R_VARNAME = /[_a-zA-Z]\w*/g;
    var R_QUOTE = /'|"/;
    var R_DOT = /\./;
    var R_RESERVED = /isNaN\(|typeof\(|\s+instanceof\s+|null|true|false|new\s+|\s+Number|\s+Array/;
    var R_BINDING_ESCAPE = /\\/;

    var extractParameters = function (expression) {
        var parameters = [];

        expression.replace(R_VARNAME, function (match, pos, full) {
            if (R_RESERVED.test(match)) {
                return match;
            }
            if (pos > 0) {
                var before = full.charAt(pos - 1);
                if (R_QUOTE.test(before) || R_DOT.test(before)) {
                    return match;
                }
            }
            var isFunction = false;
            var matchLength = pos + match.length;
            if (matchLength < full.length) {
                var after = full.charAt(matchLength);
                if (R_QUOTE.test(after)) {
                    return match;
                }
                isFunction = after === "(";
            }

            parameters.push({
                key: match,
                type: isFunction ? "fnc" : "var"
            });
            return match;

        });
        return parameters;
    };


    var parse = function (expression) {

        var bindingFirst = false;
        var bindingLast = false;
        var parameters = [];
        var res = expression.replace(/\{[^{]+}/g, function (match, pos, full) {
            if (pos > 0) {
                var before = full.charAt(pos - 1);
                if (R_BINDING_ESCAPE.test(before)) {
                    return match;
                }
            }
            var matchLength = pos + match.length;
            if (matchLength < full.length) {
                var after = full.charAt(matchLength - 1);
                if (R_BINDING_ESCAPE.test(after)) {
                    return match;
                }
            }
            parameters = parameters.concat(extractParameters(match.substr(1, match.length - 2)));
            var inner = "(" + match.substr(1, match.length - 2) + ")";

            if (pos > 0) {
                inner = "' + " + inner;
            } else {
                bindingFirst = true;
            }

            if (matchLength < full.length - 1) {
                inner += "+ '";
            } else {
                bindingLast = true;
            }
            return inner;
        });

        res = res.replace(/\{/, "{").replace(/\}/, "}");

        if (!bindingFirst) {
            res = "'" + res;
        }

        if (!bindingLast) {
            res += "'";
        }

        return {
            fnc: "return " + res,
            parameters: parameters
        };
    };

    var EventDispatcher = inherit.Base.inherit({
        ctor: function () {
            this.callBase();

            this.listeners = {};
        },

        bind: function (eventName, cb, scope) {
            this.on(eventName, cb, scope);
        },

        on: function (eventName, cb, scope) {
            var listeners = this.listeners[eventName] = this.listeners[eventName] || [];
            listeners.push({
                cb: cb,
                scope: scope
            });
        },

        bindOnce: function (eventName, cb, scope) {
            // todo: implement
        },

        unbind: function (eventName, cb, scope) {
            if (!cb) {
                this.listeners[eventName] = [];
            } else {
                var listeners = this.listeners[eventName];
                if (listeners) {
                    for (var i = listeners.length - 1; i >= 0; i--) {
                        var listener = listeners[i];
                        if (listener.cb === cb && listener.scope === scope) {
                            listeners.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        },

        emit: function (eventName, data, scope) {
            var listeners = this.listeners[eventName];

            if (listeners) {
                var event = {type: eventName, data: data, stopPropagation: false, src: this || scope};
                for (var i = 0; i < listeners.length; i++) {
                    var listener = listeners[i];
                    listener.cb.call(listener.scope || window, event);
                    if (event.stopPropagation === true) {
                        break;
                    }
                }
            }
        }

    });

    var Binding = inherit.Base.inherit({
        ctor: function (component, definition, targetKey) {
            this.targetKey = targetKey;
            this.component = component;
            this.definition = definition;
            this.hasFunction = false;
            var d = parse(definition);
            this.fncDef = d.fnc;

            this.parameters = [];
            this.parameterKeys = {};
            var parameterArray = [];
            var scopes = [];
            var self = this;
            this.cb = function (e) {
                var changed = true;
                if (!self.hasFunction && e.data && e.data.changedAttributes) {
                    changed = false;
                    var changedAttributes = e.data.changedAttributes;
                    for (var k in changedAttributes) {
                        if (changedAttributes.hasOwnProperty(k) && self.parameterKeys.hasOwnProperty(k)) {
                            changed = true;
                            break;
                        }
                    }
                }
                // only react on attributes in the changedAttributes set
                //
                if (changed) {
                    component._handleBindingChange(self, e);
                }
            };
            for (var i = 0; i < d.parameters.length; i++) {
                var parameter = d.parameters[i];
                if (parameterArray.indexOf(parameter.key) === -1) {
                    if (parameter.type === "var") {
                        parameter.scope = component.findScopeForKey(parameter.key, targetKey);
                        this.parameterKeys[parameter.key] = parameter;
                    } else {
                        this.hasFunction = true;
                        parameter.scope = component.findScopeForFnc(parameter.key);
                    }
                    parameterArray.push(parameter.key);
                    this.parameters.push(parameter);
                    if (parameter.scope) {
                        if (scopes.indexOf(parameter.scope) === -1) {
                            parameter.scope.on("change", this.cb);
                        }
                    } else {
                        console.warn("couldnt find scope for " + parameter.key);
                    }
                }
            }

            this.f = new Function(parameterArray, this.fncDef);
        },

        getValue: function () {
            try {
                return this.f.apply(this.component, this.evaluateParams());
            } catch (e) {
                console.warn(e);
                return null;
            }
        },

        evaluateParams: function () {
            var ret = [];
            for (var i = 0; i < this.parameters.length; i++) {
                var p = this.parameters[i];
                if (p.type === "var") {
                    ret.push(p.scope.$[p.key]);
                } else {
                    ret.push(p.scope[p.key].bind(p.scope))
                }
            }
            return ret;
        },
        destroy: function () {
            for (var i = 0; i < this.parameters.length; i++) {
                var p = this.parameters[i];
                p.scope.unbind("change", this.cb);
            }
        }


    });

    var ApplicationContext = inherit.Base.inherit({
        createInstance: function (factory, attributes, children, parentScope, rootScope, refScope) {
            return new factory(attributes, children, parentScope, rootScope, refScope, this);
        }
    });

    var NS_XHTML = "http://www.w3.org/1999/xhtml";

    var Component = EventDispatcher.inherit({
        defaultChildren: [],
        defaults: {
            tagName: "div",
            xmlns: NS_XHTML,
            visible: true
        },
        ctor: function (attributes, children, parentScope, rootScope, refScope, context) {
            this.callBase();

            this._inherit('defaults', function (current, base) {
                return _defaults(current, base);
            });

            this._inherit('nodeDefaults', function (current, base) {
                return _defaults(current, base);
            });

            this._inherit("innerChildren", function (current, base) {
                return current.concat(base);
            });
            this.mixins = this.mixins || [];
            this.initialized = false;
            this.rendered = false;
            this.bindings = {};
            this.listeners = {};
            this.children = [];
            this.parentScope = parentScope || this;
            this.rootScope = rootScope || this;
            this.refScope = refScope || this;
            this.refs = this.refScope.refs || {};
            this.context = context || new ApplicationContext();
            this.renderedChildren = [];

            attributes = attributes || {};

            var defaults = extend({}, this.defaults, this.nodeDefaults);

            //attributes = clone(attributes);
            for (var key in defaults) {
                if (defaults.hasOwnProperty(key)) {
                    if (!attributes.hasOwnProperty(key)) {
                        if (defaults[key] instanceof RegExp) {
                            attributes[key] = defaults[key];
                        } else {
                            attributes[key] = clone(defaults[key]);
                        }
                    }
                }
            }
            this.tagName = attributes.tagName;
            this.xmlns = attributes.xmlns;

            this.$ = attributes;
            this.outerChildren = children || [];

            for (var i = 0; i < this.mixins.length; i++) {
                var mixin = this.mixins[i];
                this.mixin(mixin);
            }
        },

        mixin: function (mixin) {
            mixin.init(this);
            if (this.mixins.indexOf(mixin) === -1) {
                this.mixins.push(mixin)
            }
        },

        init: function () {
            if (this.initialized) {
                return;
            }

            var value;
            if (this.$.hasOwnProperty("each")) {
                if (typeof(this.$.each) === "string") {
                    var eachBinding = new Binding(this, this.$.each, "each");
                    if (eachBinding) {
                        value = eachBinding.getValue();
                        this.$.each = value;
                    }
                    this.bindings["each"] = b;
                }
            } else {
                for (var key in this.$) {
                    if (this.$.hasOwnProperty(key)) {
                        value = this.$[key];
                        if (typeof(value) === "string") {
                            var match = value.match(/\{/);
                            if (match) {
                                var b = new Binding(this, value, key);
                                if (b) {
                                    value = b.getValue();
                                    this.$[key] = value;
                                }
                                this.bindings[key] = b;
                            }
                        }
                        if (key === "ref") {
                            this.refScope.refs[value] = this;
                        }
                    }
                }
                this._createChildren(this.defaultChildren, this, this, this);
                this._createChildren(this.outerChildren, this, this.rootScope, this.refScope);
            }

            this.initialized = true;

            this.postInit();
        },

        postInit: function () {
            // abstract
        },

        _handleBindingChange: function (b, event) {
            if (event.src === this && event.data && event.data.changedAttributes && event.data.changedAttributes.hasOwnProperty(b.targetKey)) {
                return;
            }
            this.set(b.targetKey, b.getValue());
        },

        findScope: function (key, check) {
            var scope = this,
                lastScope = null;

            while (lastScope !== scope) {
                if (check(scope, key)) {
                    return scope;
                } else {
                    lastScope = scope;
                    scope = lastScope.parentScope;
                }
            }
        },

        findScopeForKey: function (key, targetKey) {
            var self = this;
            return this.findScope(key, function (scope, key) {
                return scope.$.hasOwnProperty(key) && (targetKey === key && self !== scope || targetKey !== key);
            });
        },

        findScopeForFnc: function (key) {
            return this.findScope(key, function (scope, key) {
                return scope[key] instanceof Function;
            });
        },

        _findFnc: function (key) {
            var scope = this.findScopeForFnc(key);
            var f = scope[key];
            f.bind(scope);

            return f;
        },

        _findAttr: function (key, targetKey) {
            var scope = this.findScopeForKey(key, targetKey);
            return scope.$[key];
        },

        _createChildren: function (children, parentScope, rootScope, refScope) {
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                var childInstance = this._createInstance(child[0], copy(child[1]), child[2], parentScope, rootScope, refScope);
                childInstance.init();
                this.children.push(childInstance);
            }
        },

        _createInstance: function (factory, attributes, children, parentScope, rootScope, refScope) {
            return this.context.createInstance(factory, attributes, children, parentScope, rootScope, refScope);
        },

        _inherit: function (key, inheritFnc) {
            var factory = this.factory;
            if (factory[key]) {
                return factory[key];
            }
            var base = this.base,
                attributes = this[key];

            while (base && base[key]) {
                attributes = inheritFnc(attributes, base[key]);
                base = base.base;
            }

            factory[key] = attributes;
        },

        render: function () {
            if (this.$.hasOwnProperty("each")) {
                this._renderEach();
                return null;
            } else {
                if (this.el) {
                    return this.el;
                }

                for (var k in this.bindings) {
                    if (this.bindings.hasOwnProperty(k)) {
                        this.$[k] = this.bindings[k].getValue();
                    }
                }

                this.el = window.document.createElementNS(this.xmlns || NS_XHTML, this.tagName);

                this._renderAttributes();
                this._renderChildren();
                this._bindDomEvents();

                this.rendered = true;

                return this.el;
            }
        },

        mount: function (el) {
            this.init();
            var rendered = this.render();
            if (el) {
                el.parentNode.replaceChild(rendered, el);
            } else {
                window.document.body.appendChild(rendered);
            }

            this.emit('mount');
        },

        _renderAttributes: function () {
            for (var key in this.$) {
                if (this.$.hasOwnProperty(key)) {
                    this._renderAttribute(key, this.$[key]);
                }
            }
        },

        _renderChildren: function () {
            var child,
                i;
            for (i = 0; i < this.children.length; i++) {
                child = this.children[i];
                if (child.$.visible) {
                    this._renderChild(child)
                }
            }
            if(this.tagName === "select") {
                this._renderAttribute("value", this.$.value);
            }
        },

        _getRenderScope: function () {
            if (this.$.hasOwnProperty("each")) {
                return this.parentScope;
            } else {
                return this;
            }
        },

        getRef: function (name) {
            return this.refs[name];
        },

        _renderChild: function (child) {
            if (child.render) {
                var el = child.render();
                if (el) {
                    var renderScope = this._getRenderScope();
                    var next = renderScope.getNextRenderedChild(renderScope === this ? child : this);
                    if (next == null) {
                        renderScope.el.appendChild(el);
                        renderScope.renderedChildren.push(child);
                    } else {
                        renderScope.el.insertBefore(el, next.getElement());
                        var i = renderScope.renderedChildren.indexOf(next);
                        renderScope.renderedChildren.splice(i - 1, 0, child);
                    }
                    child.renderScope = renderScope;
                }

            }
        },

        _renderEach: function () {
            var i = 0,
                item,
                items = this.$.each;

            this.renderedItems = this.renderedItems || [];
            this.itemMap = this.itemMap || {};

            if (isArray(items)) {
                for (; items && i < items.length; i++) {
                    item = items[i];
                    this._renderEachItem(item, i);
                }
            } else if (isObject(items)) {
                for (var ikey in items) {
                    if (items.hasOwnProperty(ikey)) {
                        this._renderEachItem(items[ikey], i, ikey);
                        i++;
                    }
                }
            }

            while (this.renderedItems.length > i) {
                var ri = this.renderedItems.pop();
                item = ri.item;
                if (item.hasOwnProperty(this.$.idKey)) {
                    delete this.itemMap[item[this.$.idKey]];
                }
                this._removeChild(ri.view);
                ri.view.destroy();
            }
        },

        _renderEachItem: function (item, i, key) {
            var found = false,
                remove = [],
                renderedItems = this.renderedItems;

            for (var j = i; j < renderedItems.length; j++) {
                var renderedItem = renderedItems[j];
                if (renderedItem.item !== item) {
                    remove.push(j);
                } else {
                    var s = {};
                    s[this.$.eachAs || "item"] = item;
                    s["index"] = i;
                    renderedItem.view.set(s);
                    found = true;
                    break;
                }

            }
            var parentScope = this.parentScope;
            if (found && remove.length > 0) {
                for (var k = 0; k < remove.length; k++) {
                    var index = remove[k];
                    parentScope._removeChild(renderedItems[index].view);
                }
                renderedItems.splice(remove[0], remove.length);
            }

            if (!found) {
                var child = this._createItemView(item, i, key);
                child.init();
                if (i < renderedItems.length - 1) {
                    var el = child.render();
                    parentScope.el.insertBefore(el, renderedItems[i].view.el);
                    var w = parentScope.renderedChildren.indexOf(renderedItems[i].view);
                    parentScope.renderedChildren.splice(w, 0, child);
                    child.renderScope = parentScope;
                } else {
                    this._renderChild(child);
                }

                var c = {item: item, view: child};
                renderedItems.splice(i, 0, c);
                if (item.hasOwnProperty(this.$.idKey)) {
                    this.itemMap[item[this.$.idKey]] = c;
                }
            }
        },

        _createItemView: function (item, index, key) {
            var attributes = clone(this.$);
            attributes[this.$.eachAs || "item"] = item;
            attributes["index"] = index;
            attributes["key"] = key;

            delete attributes.each;
            delete attributes.eachAs;

            if (!this.itemFactory) {
                var defaults = {};
                defaults[this.$.eachAs || "item"] = null;
                defaults["index"] = null;
                defaults["key"] = null;
                this.itemFactory = this.factory.inherit({defaults: defaults});
            }

            return this._createInstance(this.itemFactory, extend({}, attributes), this.outerChildren, this.parentScope, this.rootScope, null);
        },

        findTemplate: function () {
            var ret = null;
            for (var i = 0; i < this.outerChildren.length; i++) {
                var child = this.outerChildren[i];
                if (child[0].classof(DomElement)) {
                    return child;
                }
            }
            return null;
        },


        _removeChild: function (child) {
            var renderScope = this._getRenderScope();
            renderScope.el.removeChild(child.el);
            renderScope.renderedChildren.splice(renderScope.renderedChildren.indexOf(child), 1);
        },

        _bindDomEvents: function () {
            for (var k in this.$) {
                if (this.$.hasOwnProperty(k)) {
                    if (k.indexOf("on") === 0) {
                        var fncName = this.$[k];
                        this._bindDomEventToPath(k, fncName);
                    }
                }
            }
        },

        _bindDomEventToPath: function (event, fncName) {
            var parameters = extractParameters(fncName);
            var scope;
            var parameterArray = [];
            for (var i = 0; i < parameters.length; i++) {
                var param = parameters[i];
                if (param.key === "event") {
                    continue;
                }
                scope = this.rootScope[param.key] ? this.rootScope : null;
                if (!scope) {
                    scope = this.findScopeForKey(param.key);
                } else {
                    scope.bind(this.rootScope);
                    param.type = "fnc";
                }
                if (scope) {
                    param.scope = scope;
                }
                parameterArray.push(param.key);
            }
            parameterArray.push("event");

            var lastKlammer = fncName.indexOf(")");
            if (lastKlammer === -1 || lastKlammer < fncName.length - 1) {
                fncName += "(event)";
            }

            var fnc = new Function(parameterArray, fncName);

            if (scope) {
                var callback = function (e) {
                    var ret = [];
                    for (var i = 0; i < parameters.length; i++) {
                        var p = parameters[i];
                        if (p.key === "event") {
                            ret.push(e);
                        } else {
                            if (p.type === "var") {
                                ret.push(p.scope.$[p.key]);
                            } else {
                                ret.push(p.scope[p.key].bind(p.scope))
                            }
                        }
                    }
                    ret.push(e);
                    try {
                        return fnc.apply(self, ret);
                    } catch (e) {
                        console.warn(e);
                    }
                };
                this._bindDomEvent(event.substr(2), callback, scope);
            } else {
                console.warn("couldn't find handler : " + fncName);
            }
        },

        getNextRenderedChild: function (child) {
            var children = this.children;
            var i = children.indexOf(child) + 1;
            if (i > 0 && i < children.length) {
                var nextChild = children[i];
                while (nextChild && !nextChild.isMounted()) {
                    i++;
                    if (i < children.length) {
                        nextChild = children[i];
                    } else {
                        nextChild = null;
                    }
                }
                return nextChild;

            }
            return null;
        },

        isMounted: function () {
            return this.el && this.el.parentNode === this.parentScope.el ? this.el : null;
        },

        getElement: function () {
            return this.el;
        },

        _renderAttribute: function (key, value) {
            if (key === "each" && this.parentScope.el) {
                this._renderEach();
                return;
            }
            if (key === "visible") {
                this._renderVisible();
                return;
            }
            var el = this.el;
            if (!el) {
                return;
            }
            if (this.defaults.hasOwnProperty(key) || /^_/.test(key) || key.indexOf("on") === 0 || key === "visible" || key === "ref") {
                return;
            }

            var i;

            if (value == null) {
                el.removeAttribute(key);
            } else {
                if (key === "style") {
                    var elStyle = el.style;
                    var styles = value.split(";");
                    for (i = 0; i < styles.length; i++) {
                        var style = styles[i];
                        if (style) {
                            var styleDef = style.split(":");
                            elStyle[styleDef[0].replace(/(\-\w)/g, function (a) {
                                return a.replace("-", "").toUpperCase()
                            }).replace(/^\s+|\s+$/, "")] = styleDef[1];
                        }
                    }
                } else if (key === "children") {
                    // clear children, don't destroy
                    while (this.renderedChildren.length > 0) {
                        this._removeChild(this.renderedChildren[0]);
                    }

                    for (i = 0; i < value.length; i++) {
                        var child = value[i];
                        child.init();
                        this._renderChild(child);
                    }

                } else {
                    if (/^data/.test(key)) {
                        el.setAttribute(key, value);
                    } else {
                        if (this.tagName === "input" && key === "checked") {
                            el.checked = !!value ? "checked" : false;
                        } else if (/input|select/.test(this.tagName) && key === "value") {
                            el.value = value;
                        } else {
                            if (!value) {
                                // first set empty -> needed for Chrome
                                el.setAttribute(key, "");
                                // then remove -> needed for firefox
                                el.removeAttribute(key);
                            } else {
                                var v = value + "";
                                if (el.getAttribute(key) !== v) {
                                    el.setAttribute(key, v);
                                }
                            }
                        }
                    }
                    //this.el.setAttribute(key, value);
                }
            }

        },

        _renderVisible: function () {
            var visible = this.$.visible;
            if (this.rendered && !visible) {
                if (this.parentScope.rendered) {
                    var renderScope = this.parentScope._getRenderScope();
                    if (!visible && this.el && this.el.parentNode === renderScope.el) {
                        this.parentScope._removeChild(this);
                    } else if (visible && this.el && renderScope.el && this.el.parentNode !== renderScope.el) {
                        //this.parentScope._renderChild(this);
                    }
                }
            } else if (visible) {
                if(this.parentScope.rendered) {
                    this.parentScope._renderChild(this);
                }

            }
        },


        _bindDomEvent: function (event, handler, scope) {
            var self = this;
            this.el.addEventListener(event, function (e) {
                e.srcView = self;
                handler.call(scope, e);
            });

        },
        set: function (key, value) {
            var ret;
            if (isObject(key)) {
                ret = key;
                for (var k in key) {
                    if (key.hasOwnProperty(k)) {
                        this.$[k] = key[k];
                    }
                }
            } else {
                this.$[key] = value;

                ret = {};
                ret[key] = value;
            }

            this.update(ret);
        },

        update: function (attributes) {
            attributes = attributes || this.$;
            this.emit("change", {changedAttributes: attributes});

            for (var k in attributes) {
                if (attributes.hasOwnProperty(k)) {
                    this._renderAttribute(k, attributes[k]);
                }
            }

        },

        destroy: function () {
            for (var key in this.bindings) {
                if (this.bindings.hasOwnProperty(key)) {
                    this.bindings[key].destroy();
                }
            }
        }
    });

    var Content = Component.inherit({
        render: function () {
            return null;
        }
    });

    var TextElement = Component.inherit({
        render: function () {
            if (this.el) {
                return this.el;
            }

            this.el = document.createTextNode(this.text);

            this.el.textContent = this.$.text;

            return this.el;
        },
        _renderAttribute: function (key, value) {
            if (!this.el) {
                return;
            }
            if (key === "text") {
                this.el.textContent = value;
            }
        }
    });

    var r = {};

    r.Content = Content;
    r.Component = Component;
    r.TextElement = TextElement;
    r.EventDispatcher = EventDispatcher;

    for (var element in r) {
        if (r.hasOwnProperty(element)) {
            r[element].c = function (factory, attributes) {

            }
        }
    }

    window.r = r;


})
(window, inherit);





