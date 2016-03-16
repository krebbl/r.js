(function (exports) {
    exports.injection = {
        injected: [],
        init: function (component) {
            var originalCreateInstance = component.context.createInstance;
            var self = this;
            component.context.createInstance = function () {
                var instance = originalCreateInstance.apply(component.context, arguments);
                if(instance.inject){
                    for (var key in instance.inject) {
                        if (instance.inject.hasOwnProperty(key)) {
                            var s = self.getInstance(instance.inject[key]);
                            if (s) {
                                instance.set(key, s);
                            }
                        }
                    }
                }

                return instance;
            }
        },
        getInstance: function (Factory) {
            for (var i = 0; i < this.injected.length; i++) {
                var inj = this.injected[i];
                if (inj instanceof Factory) {
                    return inj;
                }
            }
            return null;
        },
        addInstance: function (instance) {
            this.injected.push(instance);
        }

    };
})(this, typeof exports === "undefined" ? this : exports);
