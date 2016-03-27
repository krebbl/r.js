(function (window, r) {
    var fs, createXhr,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];

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

    var factoryMap = {
        r: r
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
                attributes[attribute.localName] = attribute.nodeValue;

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
            return factoryMap.r.Component;
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

        if (node.localName === "script" && node.namespaceURI.indexOf("http://www.w3.org") > -1) {
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

    var loadScript = function (node, callback) {
        var xhr;
        var url = node.src;
        try {
            xhr = createXhr();
            xhr.open('GET', url);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200 || xhr.status === 304) {
                        if (xhr.responseText) {
                            var parser = new DOMParser();
                            var text = xhr.responseText.replace(/(<script[^>]+>)/, "$1\n  //<![CDATA[").replace(/(<\/script>)/, "//]]>\n$1");
                            var xmlDoc = parser.parseFromString(text.replace(/&/g, "&amp;"), "text/xml");
                            callback(null, xmlDoc.documentElement);
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
    };

    var define = function (name, fnc) {
        factoryMap[name] = fnc(require);
    };

    var require = function (module, callback) {
        var ret = factoryMap[module] || window[module];

        if (!ret) {
            throw new Error("Couldn't require " + module);
        }

        callback(ret);
    };

    var forEach = function (elements, fnc, cb) {
        var next = null;
        var i = -1;
        var element = elements[i];

        var done = function () {
            callNext();
        };

        var callNext = function () {
            i++;
            if (i < elements.length) {
                element = elements[i];
                fnc(element, done);
            } else {
                cb();
            }
        };

        callNext();
    };

    window.rCompiler = {
        compile: function (callback) {
            var scripts = window.document.getElementsByTagName("script");
            forEach(scripts, function (script, done) {
                if (script.type === "text/rml") {
                    var match = script.src.match(/(\w+)\.rml$/);
                    var name = match[1];
                    loadScript(script, function (err, node) {
                        if (!err) {
                            var so = evaluateScript(name, node, require, function (scriptObj) {
                                factoryMap[name] = nodeToFactory(node, factoryMap, scriptObj);
                                done();
                            });
                        } else {
                            done();
                        }
                    });
                } else {
                    done();
                }
            }, function () {
                callback(factoryMap);
            });


        }
    }
})(window, r);