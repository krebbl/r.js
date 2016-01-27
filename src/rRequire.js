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

        if (namespace == "http://www.w3.org/1999/xhtml" || namespace == "r") {
            return null;
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

            var dep = getDependency(domNode.namespaceURI, localName, namespaceMap, xamlClasses, rewriteMap);
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
        "class": "className",
        "for": "htmlFor"
    };

    var resolveAttributes = function (node) {
        var attributes = {};

        if (node.namespaceURI == "http://www.w3.org/1999/xhtml") {
            attributes["tagName"] = node.tagName;
        }

        if (node.nodeType == 1) {
            for (var i = 0; i < node.attributes.length; i++) {
                var attribute = node.attributes[i];
                attributes[attributeMap[attribute.localName] || attribute.localName] = attribute.nodeValue;

            }
        } else if (node.nodeType == 3) {
            attributes["text"] = node.nodeValue.replace(/^(\s|\t|\r)+\n/, "").replace(/\n(\s|\t|\r)+$/, "");
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
        if (node.namespaceURI == "http://www.w3.org/1999/xhtml" && node.nodeType == 1) {
            return factoryMap.r.DomElement;
        }
        if (node.namespaceURI == "r") {
            //var dependency = getDependency(node.namespaceURI, localNameFromDomNode(node));
            return factoryMap.r[node.localName];
        }

        return factoryMap[node.namespaceURI.replace(/\./g,"/") + "/" + node.localName];
    };

    var nodeToDescription = function (node, factoryMap) {
        if (node.nodeType == 8 || (node.nodeType == 3 && node.nodeValue.replace(/^(\s|\t|\r)+$/, "").length == 0)) {
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

    define('tpl', [], {

        write: function (pluginName, name, write) {

            if (name in buildMap) {
                var text = buildMap[name];
                write.asModule(pluginName + "!" + name, text);
            }
        },

        version: '0.3.0',

        load: function (name, parentRequire, load, config) {

            var url = parentRequire.toUrl(name + ".tpl");


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
                        dependencies.unshift("r");
                        // first item should be the dependency of the document element
                        parentRequire(dependencies, function () {
                            var factories = Array.prototype.slice.call(arguments, 0);

                            var factoryMap = {};
                            for (var i = 0; i < dependencies.length; i++) {
                                var dependency = dependencies[i];
                                factoryMap[dependency] = factories[i];
                            }

                            var description = nodeToDescription(xml.documentElement, factoryMap);

                            load(description[2]);
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

    var requirejsContext = require.config({
        "paths": {
            "parser": "./r/parser",
            "inherit": "./r/inherit",
            "r": "./r/r"
        },
        "shim": {
            "underscore": {
                "exports": "_"
            },
            "inherit": {
                "exports": "inherit"
            },
            "parser": {
                "exports": "parser"
            },
            "r": {
                "exports": "r"
            }
        }
    });


    var bootStrap = function (mainClass, config, callback) {

        requirejsContext(["inherit", "parser", "r"], function (inherit, parser, r) {

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