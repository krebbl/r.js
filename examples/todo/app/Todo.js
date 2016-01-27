define(["r", "tpl!app/Todo", "underscore"], function (r, TodoTpl, _) {

    return r.DomElement.inherit({
        defaults: {
            todos: [],
            editingTodo: null,
            newItemTitle: ""
        },
        handleKeyUp: function (event) {
            var e = event.domEvent;
            if (e.which == 13) {
                var val = event.src.el.value.replace(/^\s+|\s+$/, "");
                if (val) {
                    var todo = {
                        id: new Date().getTime(),
                        title: val,
                        completed: false
                    };
                    this.$.todos.push(todo);

                    this.set('newItemTitle', "");
                    this.set('todos', this.$.todos);
                }
            }
        },

        allCompleted: function (items) {
            var completed = this.completed(items);
            return completed.length === items.length && items.length > 0;
        },

        completeAll: function (event) {
            var checked = event.src.el.checked;
            _.each(this.$.todos, function (todo) {
                todo.completed = checked;
            });
            this.set("todos", this.$.todos);
        },

        check: function (item, e) {
            item.completed = !!e.src.el.checked;
            this.set('todos', this.$.todos);
        },

        notCompleted: function (todos) {
            var ret = [];
            for (var i = 0; i < todos.length; i++) {
                var todo = todos[i];
                if (!todo.completed) {
                    ret.push(todo);
                }
            }

            return ret;
        },

        removeTodo: function (todo) {
            //e.domEvent.stopPropagation();
            var i = _.indexOf(this.$.todos, todo);
            this.$.todos.splice(i, 1);
            this.set('todos', this.$.todos);
        },

        clearCompleted: function () {
            var newTodos = [];

            for (var i = 0; i < this.$.todos.length; i++) {
                var todo = this.$.todos[i];
                if (!todo.completed) {
                    newTodos.push(todo);
                }
            }

            this.$.todos = newTodos;
        },

        startEditing: function (item, event) {
            this.set('editingTodo', item);
            event.src.refs.input.el.focus();
        },

        stopEditing: function () {
            this.set('editingTodo', null);
        },

        saveChanges: function (todo, event) {
            if (event.domEvent.type == "blur" || event.domEvent.which == 13) {
                var val = event.src.el.value.replace(/^\s+|\s+$/, "");
                if (val) {
                    todo.title = val;
                } else {
                    var i = _.indexOf(this.$.todos, todo);
                    this.$.todos.splice(i, 1);
                    this.set('todos', this.$.todos);
                }
                this.set('editingTodo', null);
            } else if (event.domEvent.which == 27) {
                // revert input
                this.$.editingTodo.title = todo.title;
                this.set('editingTodo', null);
            }
        },

        handleUp: function (event) {
            if (event.domEvent.which == 27) {
                this.set('editingItem', null);
            }
        },

        completed: function (items) {
            return _.filter(items, function (item) {
                return item.completed;
            });
        },

        deleteItem: function (e) {
            var item = e.src.$.item;
            this.$.items.splice(this.$.items.indexOf(item), 1);
            this.set('items', this.$.items);
        },
        defaultChildren: TodoTpl
    });

});