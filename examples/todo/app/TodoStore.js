define(["r", "rAction", "underscore"], function (r, rAction, _) {

    return rAction.Store.inherit({
        defaults: {
            activeFilter: "",
            todos: {},
            loadingTodos: false
        },
        getTodoById: function (id) {
            return this.todos[id];
        },
        name: "todoStore",
        ns: "TodoActions",

        loadTodos: function () {
            this.loadingTodos = true;

            var self = this;
            setTimeout(function () {
                var todos = JSON.parse(window.localStorage.getItem("todos") || "{}");
                if (todos) {
                    for (var id in todos) {
                        self.todos[id] = todos[id];
                    }
                }

                self.loadingTodos = false;

                self.emit("change");
            }, 1000);
        },

        deleteTodo: function (payload) {
            var todoId = payload.id;

            delete this.todos[todoId];
        },
        addTodo: function (payload) {
            var todo = {
                id: new Date().getTime() + "",
                title: payload.title.trim(),
                completed: false
            };
            this.todos[todo.id] = todo;
        },
        checkTodo: function (payload) {
            var todo = this.getTodoById(payload.id);

            todo.completed = payload.completed;

            this.emit("change", {listItemChange: {item: todo}});
        },
        updateTitle: function (payload) {
            var todo = this.getTodoById(payload.id);

            todo.title = payload.title;

            this.emit("change", {listItemChange: {item: todo}});
        },

        filterTodos: function(payload){
            this.activeFilter = payload.filter;
        },

        filteredTodos: function(){
            if(!this.activeFilter) {
                return this.todos;
            }
            var filter = this.activeFilter;
            return _.filter(this.todos, function(t){
                return filter === "completed" && t.completed || filter === "active" && !t.completed
            });

        },

        clearCompleted: function () {
            this.todos = _.reduce(this.todos, function (memo, todo) {
                if (!todo.completed) {
                    memo[todo.id] = todo;
                }
                return memo;
            }, {});
        },
        checkAll: function (payload) {
            _.each(this.todos, function (todo) {
                todo.completed = payload.completed;
            });
        },

        afterAll: function (payload, ns, action) {
            if (!this.loadingTodos) {
                window.localStorage.setItem("todos", JSON.stringify(this.todos));
            }
        }

    });

});