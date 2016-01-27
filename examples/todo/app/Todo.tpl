<div xmlns='http://www.w3.org/1999/xhtml' xmlns:r="r">
    <section class="todoapp">
        <header class="header">
            <h1>todos</h1>
            <input class="new-todo" placeholder="What needs to be done?" autofocus="autofocus" onkeyup="handleKeyUp" value="{newItemTitle}"/>
        </header>
        <!-- This section should be hidden by default and shown when there are todos -->
        <section class="main">
            <input class="toggle-all" type="checkbox" checked="{allCompleted(todos) ? 'checked' : ''}"
                   onchange="completeAll"/>
            <label for="toggle-all">Mark all as complete</label>
            <ul class="todo-list">
                <!-- These are here just to show the structure of the list items -->
                <!-- List items should get the class `editing` when editing and `completed` when marked as completed -->
                <r:Repeat items="{todos}" itemKey="todo">
                    <li class="{todo.completed ? 'completed' : ''}  {todo === editingTodo ? 'editing' : ''}">
                        <div class="view">
                            <input class="toggle" type="checkbox" checked="{todo.completed ? 'checked' : ''}" onclick="check(todo, event)"/>
                            <label ondblclick="startEditing(todo, event)">{todo.title}</label>
                            <button class="destroy" onclick="removeTodo(todo)"></button>
                        </div>
                        <input class="edit" ref="input" value="{editingTodo.title}" onkeyup="saveChanges(todo, event)" onblur="saveChanges(todo, event)"/>
                    </li>
                </r:Repeat>
            </ul>
        </section>
        <!-- This footer should hidden by default and shown when there are todos -->
        <footer class="footer" visible="{todos.length > 0}" _notCompleted="{notCompleted(todos)}">
            <!-- This should be `0 items left` by default -->
            <span class="todo-count"><strong>{_notCompleted.length}</strong> {_notCompleted.length == 1 ? 'item' : 'items'} left</span>
            <!-- Remove this if you don't implement routing -->
            <!--
            <ul class="filters">
                <li>
                    <a class="selected" href="#/">All</a>
                </li>
                <li>
                    <a href="#/active">Active</a>
                </li>
                <li>
                    <a href="#/completed">Completed</a>
                </li>
            </ul> -->
            <!-- Hidden if no completed items are left ↓ -->
            <button class="clear-completed" onclick="clearCompleted" visible="{completed(todos).length > 0}">Clear completed</button>
        </footer>
    </section>
    <footer class="info">
        <p>Double-click to edit a todo</p>
        <!-- Remove the below line ↓ -->
        <p>Template by <a href="http://sindresorhus.com">Sindre Sorhus</a></p>
        <!-- Change this out with your name and url ↓ -->
        <p>Created by <a href="http://marcuskrejpowicz.com">Marcus Krejpowicz</a></p>

        <p>Part of <a href="http://todomvc.com">TodoMVC</a></p>
    </footer>
</div>
