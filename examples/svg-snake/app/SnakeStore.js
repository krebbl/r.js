define(["r", "rAction", "underscore"], function (r, rAction, _) {

    return rAction.Store.inherit({
        defaults: {
            snake: [{
                x: 30,
                y: 20
            }, {
                x: 31,
                y: 20
            },
                {
                    x: 31,
                    y: 20
                },
                {
                    x: 32,
                    y: 20
                },
                {
                    x: 33,
                    y: 20
                }],
            points: [
                {
                    x: 15,
                    y: 20
                }
            ],
            size: 30,
            direction: [-1, 0]
        },
        name: "snakeStore",
        ns: "SnakeActions",

        changeDirection: function (payload) {
            if (this.direction[0] !== 0 && payload.direction[1] !== 0) {
                this.direction = [0, payload.direction[1]];
            } else if (this.direction[1] !== 0 && payload.direction[0] !== 0) {
                this.direction = [payload.direction[0], 0];
            }
            this._changeEmitted = true;
        },

        _addRandomPoint: function () {
            this.points.push({x: Math.floor(Math.random() * this.size), y: Math.floor(Math.random() * this.size)})
        },
        start: function () {
            var self = this;
            this.gameInterval = setInterval(function () {
                var snake = self.snake;
                var first = snake[0];
                var last = snake[snake.length - 1];
                var n = {x: last.x, y: last.y};
                var i;

                // update snake positions
                for (i = snake.length - 1; i >= 0; i--) {
                    var s = snake[i];
                    if (i > 0) {
                        s.x = snake[i - 1].x;
                        s.y = snake[i - 1].y;
                    } else {
                        s.x += self.direction[0];
                        s.y += self.direction[1];

                        if (s.x >= self.size) {
                            s.x = 0;
                        }
                        if (s.x < 0) {
                            s.x = self.size - 1;
                        }
                        if (s.y >= self.size) {
                            s.y = 0;
                        }
                        if (s.y < 0) {
                            s.y = self.size - 1;
                        }
                    }

                }


                var collectedPoint = false;
                for (i = 0; i < self.points.length; i++) {
                    var p = self.points[i];
                    if (p.x === first.x && p.y === first.y) {
                        collectedPoint = true;
                        break;
                    }
                }

                if (collectedPoint) {
                    snake.push(n);
                    self.points.splice(i, 1);
                    self._addRandomPoint();
                }

                self.emit("change");
            }, 33);
        },

        stop: function () {

            clearInterval(this.gameInterval);

        }

    });

});