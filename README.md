# r.js

r.js is a React-like component-based frontend library based on web standards.

## Why another library?

Yeah I know there are a lot of frontend frameworks and libraries out there but
I wanted to create one with the following key criterias.


* Usage of web standards like HTML, XHTML and Javascript
* Support (Highlighting and Autocompletion) for most IDEs
* Custom tags (components)
* Extendable tags (Inheritance, Mixins)
* Small footprint (size)
* No event listeners on the data models
* Virtual DOM

## How do you define a component?

Components are described via RML which lets you combine HTML markup and Javascript.

The following example shows a timer component:

```xml
<div xmlns="http://www.w3.org/1999/xhtml">
   <div class="time">{time}</div>
   <button onclick="start" disabled="{started}">Start</button>
   <button onclick="stop" disabled="{!started}">Stop</button>

   <!-- The script tag contains the logic for the component e.g. EventHandler, defaults -->
   <script type="text/javascript">
       exports = {
           // default attributes
           defaults: {
               time: 0,
               started: false
           },
           // defaults for the node
           nodeDefaults: {
               className: "timer-app"
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

The first tag defines from which class this component inherits.
In this case we inherit from the core class DomElement.

The script tag contains all the logic of a component like event handlers and defaults.
To tell the component that it's state has changed we call the set method.
After this all changes are rendered to the DOM.




## Documentation

**in progress**

## Examples

To test the examples just serve the example directory via an http server.


## Todos

* write documentation
* add tests
* add more examples
* implement simple Router