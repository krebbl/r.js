# r.js

r.js is a React-like component-based frontend library based on web standards.

## Why another library?

Yeah I know there are a lot of frontend frameworks and libraries out there but
I wanted to create one with the following key criterias.

* Usage of web standards like HTML, XHTML and Javascript
* Support for most IDEs (Highlighting and Autocompletion)
* Custom and extendable tags (components)
* Small footprint (size)
* No event listeners on the data models
* Clear separation of declarative (markup) and imperative (logic) parts.
* Usage of XML namespacing for resolving custom tags
* Virtual DOM


## Lets get started.

r.js is meant to be a component-based render library.
So every component can be reused inside other components.


### Define a component

Components are defined via RML which lets you combine HTML markup and Javascript.

The following example shows a simple timer component:

```xml
<div xmlns="http://www.w3.org/1999/xhtml" class="timer-app">
   <div class="time">{time}</div>
   <button onclick="start" disabled="{started}">Start</button>
   <button onclick="stop" disabled="{!started}">Stop</button>

   <!-- The script tag contains the logic for the component e.g. EventHandler, defaults -->
   <script type="text/javascript">
       exports = {
           // default attributes for the component
           defaults: {
               time: 0,
               started: false
           },
           // default attributes for the rendered DOM node
           nodeDefaults: {
           },
           // event handler
           start: function () {
               var self = this;

               this.set("started", true);
               this.set('time', 0);
               this.interval = setInterval(function () {
                   self.set("time", self.$.time + 1);
               }, 1000);
           },
           // event handler
           stop: function () {
               clearTimeout(this.interval);
               this.set("started", false);
           }
       };
   </script>
</div>
```

The first tag defines the base component from which this component inherits.
In this case its a simple "div".

The script tag contains all the logic like event handlers and default attributes.
To tell the component that it's state has changed we call the "set" method.
This will trigger an update routine which renders all changes to the DOM.


### Use a component

The simplest way to include a component is to require it via a script tag and run the RML-compiler like this:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title></title>
    <script src="./r/inherit.js" type="text/javascript" id="inheritScript"></script>
    <script src="./r/r.js" type="text/javascript"></script>
    <script src="./r/rCompiler.js" type="text/javascript"></script>
</head>
<body>

<div id="timerApp"/>

<script type="text/rml" src="./Timer.rml"></script>
<script type="text/javascript">
    rCompiler.compile(function(f){
        var timer = new f.Timer({time: 2});

        // mount the timer instance
        timer.mount(document.getElementById("timerApp"));
    });
</script>
</body>
</html>
```


## Documentation

**in progress**

## Examples

To test the examples just serve the example directory via an http server.


## Todos

* write documentation
* add tests
* add more examples
* implement simple Router