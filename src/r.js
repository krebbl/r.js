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
            return String.prototype.toString.call(obj) == '[object Array]';
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

    var R_QUOTE = /'|"/;
    var R_DOT = /\./;
    var R_RESERVED = /isNaN\(|typeof\(|\s+instanceof\s+|null|true|false|new\s+|\s+Number|\s+Array/;


    var extractParameters = function (expression) {
        var parameters = [];

        expression.replace(/[_a-zA-Z]\w*/g, function (match, pos, full) {
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
            if (pos + match.length < full.length) {
                var after = full.charAt(pos + match.length);
                if (R_QUOTE.test(after)) {
                    return match;
                }
                isFunction = after === "(";
            }

            if (isFunction) {
                parameters.push({
                    key: match,
                    type: "fnc"
                });
                return match;
            } else {
                parameters.push({
                    key: match,
                    type: "var"
                });
                return match;
            }

        });
        return parameters;
    };


    var parse = function (expression) {

        var bindingFirst = false;
        var bindingLast = false;
        var parameters = [];
        var res = expression.replace(/\{[^{}]+}/g, function (match, pos, full) {
            if (pos > 0) {
                var before = full.charAt(pos - 1);
            }
            if (pos < full.length) {

            }
            parameters = parameters.concat(extractParameters(match.substr(1, match.length - 2)));
            var inner = "(" + match.substr(1, match.length - 2) + ")";

            if (pos > 0) {
                inner = "' + " + inner;
            } else {
                bindingFirst = true;
            }

            if (pos + match.length < full.length - 1) {
                inner += "+ '";
            } else {
                bindingLast = true;
            }
            return inner;
        });

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
                    for (var i = 0; i < listeners.length; i++) {
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
            this.defintion = definition;

            var d = parse(definition);
            this.fncDef = d.fnc;

            this.parameters = [];
            var parameterArray = [];
            var scopes = [];
            var self = this;
            this.cb = function (e) {
                component._handleBindingChange(self, e);
            };
            for (var i = 0; i < d.parameters.length; i++) {
                var parameter = d.parameters[i];
                if (parameterArray.indexOf(parameter.key) === -1) {
                    if (parameter.type === "var") {
                        parameter.scope = component.findScopeForKey(parameter.key, targetKey);
                    } else {
                        parameter.scope = component.findScopeForFnc(parameter.key);
                    }
                    parameterArray.push(parameter.key);
                    this.parameters.push(parameter);
                    if (scopes.indexOf(parameter.scope) === -1) {
                        parameter.scope.bind("change", this.cb);
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
        }


    });

    var ApplicationContext = inherit.Base.inherit({
        createInstance: function (factory, attributes, children, parentScope, rootScope, refScope) {
            return new factory(attributes, children, parentScope, rootScope, refScope, this);
        }
    });


    var Component = EventDispatcher.inherit({
        defaultChildren: [],
        defaults: {
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
            for (var key in this.$) {
                if (this.$.hasOwnProperty(key)) {
                    value = this.$[key];
                    if (typeof(value) == "string") {
                        var match = value.match(/\{([^\{\}]+)}/);
                        if (match) {
                            var b = new Binding(this, value, key);
                            if (b) {
                                value = b.getValue();
                                this.$[key] = value;
                            }
                            this.bindings[key] = b;
                        }
                    }
                    if (key == "ref") {
                        this.refScope.refs[value] = this;
                    }
                }
            }

            this._createChildren(this.defaultChildren, this, this, this);
            this._createChildren(this.outerChildren, this, this.rootScope, this.refScope);

            this.initialized = true;

            this.postInit();
        },

        postInit: function () {
            // abstract
        },

        bind: function (eName, cb, scope) {

            var listeners = this.listeners[eName] = this.listeners[eName] || [];

            listeners.push({
                cb: cb,
                scope: scope || cb
            });
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
            if (this.el) {
                return this.el;
            }

            this.el = window.document.createElementNS("http://www.w3.org/1999/xhtml", this.$.tagName);

            this._renderAttributes();
            this._renderChildren();
            this._bindDomEvents();

            return this.el;
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
                child.init();
                if (child.$.visible == true) {
                    this._renderChild(child)
                }
            }
        },

        _renderChild: function (child) {
            if (child.render) {
                var el = child.render();
                if (el) {
                    var next = this.getNextRenderedChild(child);
                    if (next == null) {
                        this.el.appendChild(el);
                        this.renderedChildren.push(child);
                    } else {
                        this.el.insertBefore(el, next.getElement());
                        var i = this.renderedChildren.indexOf(next);
                        this.renderedChildren.splice(i - 1, 0, child);
                    }
                }

            }
        },

        _removeChild: function (child) {
            this.el.removeChild(child.el);
            this.renderedChildren.splice(this.renderedChildren.indexOf(child));
        },

        _bindDomEvents: function () {
            for (var k in this.$) {
                if (this.$.hasOwnProperty(k)) {
                    if (k.indexOf("on") == 0) {
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
                scope = this.findScopeForFnc(param.key);
                if (!scope) {
                    scope = this.findScopeForKey(param.key);
                } else {
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
                        fnc.apply(self, ret);
                    } catch (e) {
                        console.warn(e);
                    }
                };
                this._bindDomEvent(event.substr(2), callback, scope);
            } else {
                console.warn("couldnt find callback : " + fncName);
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
            if (!this.el) {
                return;
            }
            if (this.defaults.hasOwnProperty(key) || /^_/.test(key) || key.indexOf("on") == 0 || key == "visible" || key == "ref") {
                return;
            }


            if (value == null) {
                this.el.removeAttribute(key);
            } else {
                if (key == "style") {
                    var elStyle = this.el.style;
                    var styles = value.split(";");
                    for (var i = 0; i < styles.length; i++) {
                        var style = styles[i];
                        if (style) {
                            var styleDef = style.split(":");
                            elStyle[styleDef[0].replace(/(\-\w)/g, function (a) {
                                return a.replace("-", "").toUpperCase()
                            }).replace(/^\s+|\s+$/, "")] = styleDef[1];
                        }
                    }
                } else {
                    if (/^data/.test(key)) {
                        this.el.setAttribute(key, value);
                    } else {
                        if (this.el[key] !== value) {
                            this.el[key] = value;
                        }
                    }
                    //this.el.setAttribute(key, value);
                }
            }

        },

        _renderVisible: function (visible) {
            var isVisible = this.el ? this.el.parentNode === this.parentScope.el : false;
            if (visible == true && !isVisible) {
                var next = this.parentScope.getNextRenderedChild(this);

                var el = this.render();
                if (next == null) {
                    this.parentScope.el.appendChild(el);
                } else {
                    this.parentScope.el.insertBefore(el, next.getElement());
                }
            } else if (isVisible && !visible) {
                this.parentScope.el.removeChild(this.el);
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
            if (isObject(key)) {
                for (var k in key) {
                    if (key.hasOwnProperty(k)) {
                        this.$[k] = key[k];
                    }
                }
            } else {
                this.$[key] = value;

                var ret = {};
                ret[key] = value;
            }

            this.emit("change", {changedAttributes: ret});

            if (isObject(key)) {
                for (var k in key) {
                    if (key.hasOwnProperty(k)) {
                        this._renderAttribute(k, key[k]);
                    }
                }
            } else {
                this._renderAttribute(key, value);
            }
            if (key == "visible") {
                this._renderVisible(value);
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

    var Application = Component.inherit({

        ctor: function (attributes, children, parentScope, rootScope, refScope) {
            var context = {
                app: this,
                services: {}
            };

            this.callBase(attributes, children, parentScope, rootScope, refScope, context);
            for (var key in this.inject) {
                if (this.inject.hasOwnProperty(key)) {

                }
            }
        }

    });

    var DomElement = Component.inherit({
        defaults: {
            tagName: "div"
        }
    });

    var TextElement = DomElement.inherit({
        render: function () {
            if (this.el) {
                return this.el;
            }

            this.el = document.createTextNode(this.text);

            this.el.textContent = this.$.text;

            return this.el;
        },
        _renderAttribute: function (key, value) {
            if (key == "text") {
                this.el.textContent = value;
            }
        }
    });

    var Repeat = Component.inherit({
        defaults: {
            itemKey: "item",
            indexKey: "i",
            keyKey: 'key',
            idKey: "id"
        },
        ctor: function () {
            this.itemMap = {};
            this.renderedItems = [];

            this.callBase();
        },
        render: function () {
            this.callBase();

            return null;
        },

        _handleBindingChange: function (binding, event) {
            if (event.data && event.data.listItemChange) {
                var listItemChange = event.data.listItemChange;
                if (binding.targetKey === "items") {
                    if (binding.getValue() === this.$.items && listItemChange.item) {
                        var renderedChild = this.itemMap[listItemChange.item[this.$.idKey]];
                        if (renderedChild) {
                            renderedChild.view.set(this.$.itemKey, listItemChange.item);
                            return;
                        }
                    }
                }
            }
            this.callBase();
        },

        _renderItem: function (item, i, key) {
            var found = false;
            var remove = [];
            var renderedItems = this.renderedItems;
            for (var j = i; j < renderedItems.length; j++) {
                var renderedItem = renderedItems[j];
                if (renderedItem.item !== item) {
                    remove.push(j);
                } else {
                    renderedItem.view.set(this.$.itemKey, item);
                    renderedItem.view.set(this.$.indexKey, i);
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
                var child = this.createChildInstanceForItem(item, index, key);
                child.init();
                if (i < renderedItems.length - 1) {
                    var el = child.render();
                    parentScope.el.insertBefore(el, renderedItems[i].view.el);
                    var w = parentScope.renderedChildren.indexOf(renderedItems[i].view);
                    parentScope.renderedChildren.splice(w, 0, child);
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

        _getRenderedItemByIndex: function (i) {
            for (var j = 0; j < this.renderedItems.length; j++) {
                var item = this.renderedItems[j];
                if (item.index === i) {
                    return item;
                }
            }

            return null;

        },

        _findRenderedChild: function (item) {
            if (item.hasOwnProperty(this.$.idKey)) {
                return this.itemMap[item[this.$.idKey]];
            }
            return null;
        },

        _findRenderedItem: function (item) {
            if (item.hasOwnProperty(this.$.idKey)) {
                return this.itemMap[item[this.$.idKey]];
            }

            for (var i = 0; i < this.renderedItems.length; i++) {
                var renderedItem = this.renderedItems[i];
                if (renderedItem.item === item) {
                    return renderedItem;
                }
            }
        },

        _saveRenderedItem: function (item, view, index) {
            var renderedItem = {
                item: item,
                view: view
            };

            if (item.hasOwnProperty(this.$.idKey)) {
                this.itemMap[item[this.$.idKey]] = renderedItem;
            }

            return renderedItem;
        },

        _renderAttribute: function (key, value) {
            if (key == "items") {
                if (this.renderedItems.length > 0) {

                }
                var i = 0;
                var item;
                var items = this.$.items;
                if (isArray(items)) {
                    for (; items && i < items.length; i++) {
                        item = items[i];
                        this._renderItem(item, i);
                    }
                } else if (isObject(items)) {
                    for (var ikey in items) {
                        if (items.hasOwnProperty(ikey)) {
                            this._renderItem(items[ikey], i, ikey);
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
                }
            }
        },

        _renderChild: function (child) {
            if (child.render) {
                var el = child.render();
                if (el) {
                    var parentScope = this.parentScope;
                    var next = parentScope.getNextRenderedChild(this);
                    if (next == null) {
                        parentScope.el.appendChild(el);
                        parentScope.renderedChildren.push(child);
                    } else {
                        parentScope.el.insertBefore(el, next.getElement());
                        var i = parentScope.renderedChildren.indexOf(next);
                        this.renderedChildren.splice(i - 1, 0, child);
                    }
                }

            }
        },

        isMounted: function () {
            return this.renderedItems.length > 0;
        },

        getElement: function () {
            return this.renderedItems.length > 0 ? this.renderedItems[0].view.el : null;
        },

        _removeChild: function (child) {
            this.parentScope._removeChild(child);
        },

        _renderChildren: function () {

        },

        createChildInstanceForItem: function (item, index, key) {
            var attributes = {};
            attributes[this.$.itemKey] = item;
            attributes[this.$.indexKey] = index;
            attributes[this.$.keyKey] = key;

            var tpl = this.findTemplate();

            return this._createInstance(tpl[0], extend(attributes, tpl[1]), tpl[2], this.parentScope, this.rootScope, null);
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
        }
    });

    var r = {};

    r.Component = Component;
    r.DomElement = DomElement;
    r.TextElement = TextElement;
    r.Repeat = Repeat;
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





