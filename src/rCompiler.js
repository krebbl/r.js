(function (window, r) {
    var attributeMap = {
        "class": "className",
        "for": "htmlFor"
    };

    var factoryMap = {
        r: r
    };

    var resolveAttributes = function (node) {
        var attributes = {};

        if (!node.namespaceURI || node.namespaceURI == "http://www.w3.org/1999/xhtml") {
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
        if (!node.namespaceURI || node.namespaceURI == "http://www.w3.org/1999/xhtml" && node.nodeType == 1) {
            return factoryMap.r.DomElement;
        }
        if (node.namespaceURI == "r") {
            //var dependency = getDependency(node.namespaceURI, localNameFromDomNode(node));
            return factoryMap.r[node.localName];
        }

        return factoryMap[node.namespaceURI.replace(/\./g, "/") + "/" + node.localName];
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

    var tplToChildren = function (id) {

    };

    window.rCompiler = {
        createClass: function (BaseClass, logic, tpl) {
            logic.defaultChildren = this.txtToChildren(tpl);

            return BaseClass.inherit(logic);
        },
        tplToChildren: function (tplId, fMap) {
            return this.txtToChildren(document.getElementById(tplId).textContent, factoryMap);
        },
        txtToChildren: function (txt, fMap) {
            var parser = new DOMParser();
            var xmlDoc = parser.parseFromString(txt.replace(/&/g, "&amp;"), "text/xml");
            return nodeToDescription(xmlDoc.documentElement, factoryMap)[2];
        }
    }
})(window, r);