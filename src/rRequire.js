(function (exports, require, define, window) {
    var fs, createXhr,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        fetchTpl = function (url, callback) {
            throw new Error('Environment unsupported.');
        },
        buildMap = {};

    // Browser action
    createXhr = function () {
        //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
        var xhr, i, progId;
        if (typeof XMLHttpRequest !== "undefined") {
            return new XMLHttpRequest();
        } else {
            for (i = 0; i < 3; i++) {
                progId = progIds[i];
                try {
                    xhr = new ActiveXObject(progId);
                } catch (e) {
                    // nothing to do here
                }

                if (xhr) {
                    progIds = [progId];  // so faster next time
                    break;
                }
            }
        }

        if (!xhr) {
            throw new Error("getXhr(): XMLHttpRequest not available");
        }

        return xhr;
    };

    var localNameFromDomNode = function (domNode) {
        if (domNode.localName) {
            return domNode.localName;
        }

        var st = domNode.tagName.split(":");
        return st[st.length - 1];
    };

    function getDependency(namespace, localName, namespaceMap, xamlClasses, rewriteMap, r) {

        namespaceMap = namespaceMap || {};
        rewriteMap = rewriteMap || {};
        xamlClasses = xamlClasses || [];

        namespace = (namespaceMap[namespace] || namespace);

        if (!namespace) {
            console.warn("It seems that you forgot to add a namespace. Try using xmlns='http://www.w3.org/1999/xhtml' in your xaml");
        }

        if (namespace.indexOf("http://www.w3.org") === 0 || namespace == "r") {
            return null;
        }

        if (namespace.indexOf("http") === -1) {
            namespace = "rml!" + namespace;
        }

        namespace = namespace.replace(/\./g, '/');
        var fqClassName = [namespace, localName].join("/");


        //for (var i = 0; i < rewriteMap.length; i++) {
        //    var entry = rewriteMap[i];
        //    if (entry.$from && entry.$to) {
        //        if (entry.$from.test(fqClassName)) {
        //            fqClassName = fqClassName.replace(entry.$from, entry.$to);
        //
        //            break;
        //        }
        //    }
        //}

        return fqClassName.replace(/\./g, "/");
    }

    function findDependencies(xaml, namespaceMap, xamlClasses, rewriteMap, requestor) {

        var ret = [];

        function findDependencies(domNode) {

            var localName = localNameFromDomNode(domNode);

            if (localName === "script") {
                return;
            } else {
                var dep = getDependency(domNode.namespaceURI, localName, namespaceMap, xamlClasses, rewriteMap);
            }

            // console.log(dep);


            if (dep && ret.indexOf(dep) == -1 && dep !== requestor) {
                ret.push(dep);
            }

            for (var i = 0; i < domNode.childNodes.length; i++) {
                var childNode = domNode.childNodes[i];
                // element
                if (childNode.nodeType == 1) {
                    findDependencies(childNode);
                }
            }

        }


        if (xaml) {
            findDependencies(xaml);
        }

        return ret;
    }

    var attributeMap = {
        //"class": "className",
        //"for": "htmlFor"
    };

    var resolveAttributes = function (node) {
        var attributes = {};



        if (node.nodeType == 1) {
            if (node.namespaceURI && node.namespaceURI.indexOf("http://www.w3.org/") === 0) {
                attributes["tagName"] = node.tagName;
                attributes["xmlns"] = node.namespaceURI;
            }

            for (var i = 0; i < node.attributes.length; i++) {
                var attribute = node.attributes[i];
                attributes[attributeMap[attribute.localName] || attribute.localName] = attribute.nodeValue;

            }
        } else if (node.nodeType == 3) {
            attributes["text"] = node.nodeValue.replace(/\n/g, " ");
        }

        return attributes;
    };

    var resolveChildren = function (node, factoryMap) {
        var children = [];
        for (var i = 0; i < node.childNodes.length; i++) {
            var childNode = node.childNodes[i];
            var descr = nodeToDescription(childNode, factoryMap);
            if (descr) {
                children.push(descr);
            }
        }

        return children;
    };

    var resolveFactory = function (node, factoryMap) {
        if (node.nodeType == 3) {
            return factoryMap.r.TextElement;
        }
        if (node.namespaceURI.indexOf("http://www.w3.org") === 0 && node.nodeType == 1) {
            return factoryMap.r.DomElement;
        }
        if (node.namespaceURI == "r") {
            //var dependency = getDependency(node.namespaceURI, localNameFromDomNode(node));
            return factoryMap.r[node.localName];
        }

        return factoryMap["rml!" + node.namespaceURI.replace(/\./g, "/") + "/" + node.localName];
    };

    var nodeToDescription = function (node, factoryMap) {
        if (node.nodeType == 8 || (node.nodeType == 3 && node.nodeValue.replace(/^(\s|\t|\r)+$/, "").length == 0)) {
            return null;
        }

        if (node.localName === "script" && node.namespaceURI === "http://www.w3.org/1999/xhtml") {
            return null;
        }

        var factory = resolveFactory(node, factoryMap);
        if (!factory) {
            throw "Couldn't resolve factory for ";
        }

        var attributes = resolveAttributes(node);

        var children = resolveChildren(node, factoryMap);

        return [factory, attributes, children];
    };

    var nodeToFactory = function (node, factoryMap, scriptObj) {
        var descriptor = nodeToDescription(node, factoryMap);
        var xamlFactory;
        scriptObj = scriptObj || {};

        scriptObj.defaultChildren = descriptor[2];
        scriptObj.nodeDefaults = descriptor[1];

        xamlFactory = descriptor[0].inherit(scriptObj);

        return xamlFactory;
    };

    var evaluateScript = function (name, node, parentRequire, callback) {

        var scripts = node.getElementsByTagName("script");

        if (scripts.length) {
            var f = "define('" + name + "Script',function(require){ var exports; \n %content% }) ";
            f += "\n//# sourceURL=" + name + ".js";

            var content = scripts[0].text + "\n";
            content += "return exports;";

            var fnc = new Function("define", f.replace("%content%", content));
            fnc.call(parentRequire, define);
            parentRequire([name + "Script"], callback);
        } else {
            callback(null);
        }
    };

    fetchTpl = function (url, callback) {

        var dataUrl = /^data:/;
        if (dataUrl.test(url)) {
            try {
                var data = url.replace(dataUrl, "").replace(/\.xml$/, "");
                callback(null, (new DOMParser()).parseFromString(data, "application/xml"));
            } catch (e) {
                callback(e);
            }

        } else {
            var xhr;

            try {
                xhr = createXhr();
                xhr.open('GET', url, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200 || xhr.status === 304) {
                            if (xhr.responseText) {
                                var parser = new DOMParser();
                                var xmlDoc = parser.parseFromString(xhr.responseText.replace(/&/g, "&amp;"), "text/xml");
                                callback(null, xmlDoc);
                            } else {
                                callback("no responseXML found");
                            }
                        } else {
                            callback("got status " + xhr.status + " for " + url);
                        }
                    }
                };
                xhr.send(null);
            } catch (e) {
                callback(e);
            }
        }
    };

    define('rml', [], {

        write: function (pluginName, name, write) {

            if (name in buildMap) {
                var text = buildMap[name];
                write.asModule(pluginName + "!" + name, text);
            }
        },

        version: '0.3.0',

        load: function (name, parentRequire, load, config) {

            var url = parentRequire.toUrl(name + ".rml");


            fetchTpl(url, function (err, xml) {

                if (!err && xml) {

                    //cleanUpDescriptor(xml.documentElement);

                    // require all dependencies
                    var dependencies = findDependencies(xml.documentElement,
                        config.namespaceMap, config.xamlClasses, config.rewriteMap, "xaml!" + name);

                    if (config.isBuild) {
                        dependencies.splice(1, 0, "js/core/Element");
                        // TODO: JSON stringify
                        var text = "define(%dependencies%, %function%)";
                        var fn = "function(baseClass, ELEMENT %parameter%){%GLOBALS% return baseClass.inherit({ %classDefinition% _$descriptor: ELEMENT.xmlStringToDom(%descriptor%)})}";

                        var depsEscaped = [];
                        for (var i = 0; i < dependencies.length; i++) {
                            depsEscaped.push("'" + dependencies[i] + "'");
                        }

                        text = text.replace('%dependencies%', '[' + depsEscaped.join(',') + ']');

                        var xmlContent = xml.documentElement.toString()
                            .replace(/\\/g, "\\\\")
                            .replace(/(\r\n|\n|\r)/gm, "\\n")
                            .replace(/'/g, "\\'");

                        if (config.removeSpaces === true) {
                            xmlContent = xmlContent.replace(/\s+/g, " ").replace(/\\[nr]/g, "");
                        }

                        var parameter = "",
                            classDefinition = "",
                            globals = "";

                        fn = fn.replace('%parameter%', parameter);
                        fn = fn.replace('%classDefinition%', classDefinition);
                        fn = fn.replace('%GLOBALS%', globals);
                        fn = fn.replace('%descriptor%', "'" + xmlContent + "'");

                        text = text.replace('%function%', fn);
                        load.fromText(name, "(function () {" + text + "}).call(this);");

                        buildMap[name] = text;

                        parentRequire([name], function (value) {
                            parentRequire(dependencies, function () {
                                load(value);
                            });
                        });
                    } else {
                        if (dependencies.indexOf("r") === -1) {
                            dependencies.unshift("r");
                        }
                        // first item should be the dependency of the document element
                        parentRequire(dependencies, function () {
                            var factories = Array.prototype.slice.call(arguments, 0);

                            var factoryMap = {};
                            for (var i = 0; i < dependencies.length; i++) {
                                var dependency = dependencies[i];
                                factoryMap[dependency] = factories[i];
                            }

                            evaluateScript(name, xml.documentElement, parentRequire, function (scriptObj) {

                                var classFactory = nodeToFactory(xml.documentElement, factoryMap, scriptObj);

                                load(classFactory);
                            });

                        }, function (err) {
                            load.error(err);
                        });
                    }
                } else {
                    load.error(new Error("XML " + url + " not found." + err));
                }
            });
        }
    });

    var defaultPaths = {
        "inherit": "./r/inherit"
    };

    var defaultShim = {
        "inherit": {
            "exports": "inherit"
        },
        "r/r": {
            "exports": "r"
        }
    };


    var bootStrap = function (mainClass, config, callback) {

        config = config || {paths: {}, shim: {}};

        config.paths = config.paths || {};
        config.shim = config.shim || {};

        for (var k in defaultPaths) {
            if (defaultPaths.hasOwnProperty(k)) {
                if (!config.paths[k]) {
                    config.paths[k] = defaultPaths[k];
                }
            }
        }

        for (var s in defaultShim) {
            if (defaultShim.hasOwnProperty(s)) {
                if (!config.shim[s]) {
                    config.shim[s] = defaultShim[s];
                }
            }
        }

        var requirejsContext = require.config(config);

        //require.onResourceLoad = function(context, map, deps){
        //    console.log("onload");
        //};

        requirejsContext(["inherit", "r/r"], function (inherit, r) {

            define("r", function () {
                return r;
            });

            requirejsContext([mainClass], function (mainClassFactory) {


                callback(null, mainClassFactory);
            });


        });

    };

    exports.rRequire = {
        bootStrap: bootStrap
    };
})
(typeof exports !== "undefined" ? exports : window,
    typeof requirejs !== "undefined" ? requirejs : require('requirejs'),
    typeof requirejs !== "undefined" ? define : require('requirejs').define,
    typeof window !== "undefined" ? window : exports
);