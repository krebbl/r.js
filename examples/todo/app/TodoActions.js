define(["rAction"], function (rAction) {

    return rAction.Actions.inherit({
        ns: "TodoActions",
        actions: {
            addTodo: {
                title: "",
                completed: false
            },
            deleteTodo: {
                id: ""
            },
            checkTodo: {
                id: "",
                completed: true
            },
            clearCompleted: {},
            checkAll: {
                completed: true
            },
            filterTodos: {
                filter: ""
            },
            updateTitle: {
                id: "",
                title: ""
            },
            loadTodos: {}
        }
    })

});