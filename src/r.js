(function (window, inherit, parser) {

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

    var getPathValue = function (scope, path, scopeFinder) {

        if (typeof(path) == "string") {
            path = parser.parse("{" + path + "}");
        }
        path = path.slice();
        var value,
            element,
            fnc;


        while (path.length > 0 && scope) {
            element = path.shift();
            if (element.type == "var") {
                scope = scope[element.name];
            } else if (element.type == "fnc") {

                if (element.fnc) {
                    fnc = element.fnc;
                } else {
                    fnc = scope[element.name];
                }
                var parameters = [];
                for (var i = 0; i < element.parameters.length; i++) {
                    var param = element.parameters[i];
                    if (param instanceof Array) {
                        var paramScope = scopeFinder(param);
                        if (paramScope) {
                            var v = getPathValue(paramScope, param, scopeFinder);
                            parameters.push(v);
                        } else {
                            throw "Couldnt find scope for " + param[0].name;
                        }
                    } else {
                        parameters.push(param);
                    }
                }
                scope = fnc.apply(scope, parameters);
            }
        }

        if (path.length == 0) {
            return scope;
        }

        return value;
    };

    var watchProperty = function (o, property, cb) {

        var propertyDescr = Object.getOwnPropertyDescriptor(o, property);

        if (propertyDescr && propertyDescr.set && propertyDescr.set.listeners) {
            propertyDescr.set.listeners.push(cb);
        } else {
            var value = o[property],
                listeners = [cb];

            var setter = function (v) {
                var oldValue = value;
                value = v;
                for (var i = 0; i < listeners.length; i++) {
                    var cb = listeners[i];
                    cb(v, oldValue);
                }
            };

            setter.listeners = listeners;

            var ret = Object.defineProperty(o, property, {
                get: function () {
                    return value;
                },
                set: setter
            });
        }
    };

    var unwatchProperty = function (o, property, cb) {
        var propertyDescr = Object.getOwnPropertyDescriptor(o, property);
        if (propertyDescr && propertyDescr.set && propertyDescr.set.listeners) {
            var listeners = propertyDescr.set.listeners;
            if (cb) {
                for (var i = 0; i < listeners.length; i++) {
                    var listener = listeners[i];
                    if (listener === cb) {
                        break;
                    }
                }
                if (i < listeners) {
                    listeners.splice(i, 1);
                }
            } else {
                listeners.splice(0, listeners.length);
            }
        }
    };


    var Binding = inherit.Base.inherit({
        ctor: function (scope, path, scopeFindFnc, cb) {
            if (typeof(path) == "string") {
                path = parser.parse(path);
            }
            var self = this;
            this.path = path;
            this.cb = cb;
            this.scopeFindFnc = scopeFindFnc;
            this.scope = scope;
            if (!scope) {
                scope = scopeFindFnc(path);
                this.scope = scope;
            }
            this.currentValue = this.getPathValue(scope, path);
            this.innerCb = function (n, o) {
                self._createSubBinding();
                self._callback(n, o);
            };
            if (path[0].type == "var") {
                watchProperty(scope, path[0].name, this.innerCb);
            } else {
                var parameters = path[0].parameters;
                this.parameters = [];
                for (var i = 0; i < parameters.length; i++) {
                    var param = parameters[i];
                    if (param instanceof Array) {
                        var b = new Binding(null, param, this.scopeFindFnc, function () {
                            self._callback();
                        });
                        this.parameters.push(b);
                    } else {
                        this.parameters.push(param);
                    }
                }
            }

            if (path.length > 1) {
                this._createSubBinding();
            }
        },

        _createSubBinding: function () {
            if (this.subBinding) {
                this.subBinding.destroy();
            }
            //if (this.path[0].type == "var") {
            var pkey = this.path[0].name;
            if (this.scope && this.scope[pkey] && this.path.length > 1) {
                var subScope = this.scope[pkey];
                if (typeof(subScope) == "object" && !(subScope instanceof Array)) {
                    var self = this;
                    this.subBinding = new Binding(subScope, this.path.slice(1), this.scopeFindFnc, function () {
                        self._callback();
                    });
                }
            }
            //}
        },
        destroy: function () {
            if (this.path[0].type == "var") {
                unwatchProperty(this.scope, this.path[0].name, this.innerCb);
            } else {
                for (var i = 0; i < this.parameters.length; i++) {
                    var param = this.parameters[i];
                    if (param instanceof Binding) {
                        param.destroy();
                    }
                }
            }
            this.subBinding && this.subBinding.destroy();
        },
        _callback: function () {
            var oldValue = this.currentValue;
            var newValue = this.getPathValue(this.scope, this.path);
            //var oldValue = getPathValue(o, this.path.slice(1));
            this.currentValue = newValue;
            this.cb(newValue, oldValue);
        },
        getPathValue: function (scope, path) {
            return getPathValue(scope, path, this.scopeFindFnc);
        },
        getValue: function () {
            return this.getPathValue(this.scope, this.path);
        }
    });

    var Component = inherit.Base.inherit({
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
            this.initialized = false;
            this.bindings = [];
            this.listeners = {};
            this.children = [];
            this.parentScope = parentScope || this;
            this.rootScope = rootScope || this;
            this.refScope = refScope || this;
            this.refs = this.refScope.refs || {};
            this.context = context || this;
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
                            var path = parser.parse(value);
                            var b = this.createBinding(path, key);
                            if (b) {
                                value = b.getValue();
                                this.$[key] = value;
                            }
                            this.bindings.push(b);
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
        },

        bind: function (eName, cb, scope) {

            var listeners = this.listeners[eName] = this.listeners[eName] || [];

            listeners.push({
                cb: cb,
                scope: scope || cb
            });
        },

        createBinding: function (watchPath, targetKey) {
            var self = this;
            return new Binding(null, watchPath, function (path) {
                var element = path[0];
                var scope;
                if (element.type == "var") {
                    scope = self.findScopeForKey(element.name, targetKey);
                    return scope ? scope.$ : null;
                } else if (element.type == "fnc") {
                    if (element.fnc) {
                        return self;
                    }
                    scope = self.findScopeForFnc(element.name, targetKey);
                    return scope;
                }
                return null;
            }, function (value) {
                self.set(targetKey, value);
            });
        },

        trigger: function (eName, data) {
            var listeners = this.listeners[eName];
            if (listeners) {
                var args = {
                    type: eName,
                    data: data
                };
                for (var i = 0; i < listeners.length; i++) {
                    var listener = listeners[i];
                    //try {
                    listener.cb.call(listener.scope, args);
                    //} catch (e) {
                    //    console.warn(e);
                    //}

                }
            }
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

        _createChildren: function (children, parentScope, rootScope, refScope) {
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                var childInstance = this._createInstance(child[0], copy(child[1]), child[2], parentScope, rootScope, refScope);
                this.children.push(childInstance);
            }
        },

        _createInstance: function (factory, attributes, children, parentScope, rootScope, refScope) {
            return new factory(attributes, children, parentScope, rootScope, refScope, this.context);
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

            this.el = document.createElementNS("http://www.w3.org/1999/xhtml", this.$.tagName);

            this._renderAttributes();
            this._renderChildren();
            this._bindDomEvents();

            return this.el;
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
            var self = this;
            var scopeFnc = function (path) {
                var element = path[0];
                var scope;
                if (element.type == "var") {
                    scope = self.findScopeForKey(element.name, event);
                    return scope ? scope.$ : null;
                } else if (element.type == "fnc") {
                    if (element.fnc) {
                        return self;
                    }
                    scope = self.findScopeForFnc(element.name, event);
                    return scope;
                }
                return null;
            };

            var path = parser.parse("{" + fncName + "}");
            var scope = scopeFnc(path);
            if (path.length == 1 || path[0].type == "fnc") {
                scope = this.findScopeForFnc(path[0].name);
            } else {
                scope = this.findScopeForKey(path[0].name);
                scope = scope.$;
            }

            if (scope) {
                var callback = function (e) {
                    var fncScope = scope;
                    if (path.length > 1) {
                        fncScope = getPathValue(scope, path.slice(0, path.length - 1), scopeFnc);
                    }
                    if (fncScope) {
                        var fncDef = path[path.length - 1];
                        var fncName = fncDef.name;
                        if (fncScope[fncName] instanceof Function) {
                            var fncParams = [];
                            if (fncDef.type == "fnc") {
                                var parameters = fncDef.parameters;
                                for (var i = 0; i < parameters.length; i++) {
                                    var param = parameters[i];
                                    if (param instanceof Array) {
                                        if (param.length == 1 && param[0].name == "event") {
                                            fncParams.push(e);
                                        } else {
                                            var s = scopeFnc(param);
                                            fncParams.push(getPathValue(s, param, scopeFnc));
                                        }
                                    } else {
                                        fncParams.push(param);
                                    }
                                }
                            } else {
                                fncParams.push(e);
                            }
                            fncScope[fncName].apply(fncScope, fncParams);
                        }
                    }
                };
                if (scope) {
                    this._bindDomEvent(event.substr(2), callback, scope);
                }
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
            if (this.defaults.hasOwnProperty(key) || /^_/.test(key) || key.indexOf("on") == 0 || key == "visible" || key == "ref") {
                return;
            }


            if (value == null) {
                this.el.removeAttribute(key);
            } else {
                if(key == "style"){
                    var elStyle = this.el.style;
                    var styles = value.split(";");
                    for (var i = 0; i < styles.length; i++) {
                        var style = styles[i];
                        if(style){
                            var styleDef = style.split(":");
                            elStyle[styleDef[0].replace(/(\-\w)/g, function (a) {
                                return a.replace("-", "").toUpperCase()
                            }).replace(/^\s+|\s+$/,"")] = styleDef[1];
                        }
                    }
                } else {
                    this.el[key] = value;
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
                handler.call(scope, {domEvent: e, src: self});
            });

        },
        set: function (key, value) {
            this.$[key] = value;

            var ret = {};
            ret[key] = value;

            this.trigger("change", {changedAttributes: ret});

            this._renderAttribute(key, value);
            if (key == "visible") {
                this._renderVisible(value);
            }
        },
        destroy: function () {
            for (var i = 0; i < this.bindings.length; i++) {
                var binding = this.bindings[i];
                binding.destroy();
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
            keyKey: 'key'
        },
        ctor: function () {
            this.callBase();
            this.renderedItems = [];
        },
        render: function () {
            this.callBase();

            return null;
        },
        _renderItem: function (item, i, key) {
            if (i < this.renderedItems.length) {
                var c = this.renderedItems[i].child;
                c.set(this.$.itemKey, item);
                c.set(this.$.indexKey, i);
                c.set(this.$.keyKey, key || null);
                this.renderedItems[i].item = item;
            } else {
                var child = this.createChildInstanceForItem(item, i, key);
                //child.defaults[this.$.itemKey] = null;
                //child.defaults[this.$.indexKey] = null;

                child.init();
                if (child.$.visible) {
                    this._renderChild(child);
                    this.renderedItems.push({
                        item: item,
                        child: child
                    });
                }
            }
        },
        _renderAttribute: function (key, value) {
            if (key == "items") {
                var items = this.$.items;
                if (isArray(items)) {
                    for (var i = 0; items && i < items.length; i++) {
                        var item = items[i];
                        this._renderItem(item, i);
                    }
                } else if (isObject(items)) {
                    var j = 0;
                    for (var ikey in items) {
                        if (items.hasOwnProperty(ikey)) {
                            this._renderItem(items[ikey], j, ikey);
                            j++;
                        }
                    }
                }

                while (this.renderedItems.length > i) {
                    var ri = this.renderedItems.pop();
                    this._removeChild(ri.child);
                }
            }
        },

        _renderChild: function (child) {
            if (child.render) {
                var el = child.render();
                if (el) {
                    var next = this.parentScope.getNextRenderedChild(this);
                    if (next == null) {
                        this.parentScope.el.appendChild(el);
                        this.parentScope.renderedChildren.push(child);
                    } else {
                        this.parentScope.el.insertBefore(el, next.getElement());
                        var i = this.parentScope.renderedChildren.indexOf(next);
                        this.renderedChildren.splice(i - 1, 0, child);
                    }
                }

            }
        },

        isMounted: function () {
            return this.renderedItems.length > 0;
        },

        getElement: function () {
            return this.renderedItems.length > 0 ? this.renderedItems[0].child.el : null;
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
    r.watchProperty = watchProperty;
    r.unwatchProperty = unwatchProperty;
    r.Binding = Binding;

    for (var element in r) {
        if (r.hasOwnProperty(element)) {
            r[element].c = function (factory, attributes) {

            }
        }
    }

    window.r = r;


})
(window, inherit, parser);





