define(["r", "rAction", "underscore"], function (r, rAction, _) {

    var X_AXIS = 0;
    var Y_AXIS = 1;

    return rAction.Store.inherit({
        defaults: {
            tiles: []
        },
        ns: "1024Actions",
        moveRight: function () {
            this._clearTiles();

            var tiles = this.tiles.slice(0);

            tiles.sort(function (t1, t2) {
                return t1.position[X_AXIS] + 4 * t1.position[Y_AXIS] > t2.position[X_AXIS] + t2.position[Y_AXIS] * 4 ? 1 : -1;
            });

            for (var i = tiles.length - 1; i >= 0; i--) {
                var t = tiles[i];
                this._moveTile(t, 1, X_AXIS);
            }

            this._addNewTile();
        },

        _clearTiles: function () {
            this.tiles = _.filter(this.tiles, function (t) {
                return !t.remove;
            });
        },

        _addNewTile: function () {
            var tiles = this.tiles;
            var positionsTaken = [];
            var moved = false;
            for (var i = 0; i < this.tiles.length; i++) {
                var t = this.tiles[i];
                if (!t.remove) {
                    //tiles.push(t);
                    if (t.moved) {
                        moved = true;
                    }
                    positionsTaken.push(t.position[X_AXIS] + t.position[Y_AXIS] * 4);
                }
            }

            if (moved && positionsTaken.length < 16) {
                var availablePositions = [];
                for (var j = 0; j < 16; j++) {
                    if (positionsTaken.indexOf(j) === -1) {
                        availablePositions.push(j);
                    }
                }

                var index = Math.floor(Math.random() * availablePositions.length)
                var pos = availablePositions[index];
                var y = Math.floor(pos / 4);
                tiles.push({
                    id: new Date().getTime() + "",
                    position: [pos - 4 * y, y],
                    points: Math.random() < 0.3 ? 2 : 1,
                    "new": true
                });
            }

            if (!moved && positionsTaken > 15) {
                console.log("game over");
            }
            //console.log(this.tiles);
        },

        _moveTile: function (tile, diff, axis) {
            tile.new = false;
            tile.moved = false;
            tile.merged = false;
            if (diff !== 0 && tile.position[axis] + diff > -1 && tile.position[axis] + diff < 4) {
                var nextTile = this._getNextTile(tile, diff, axis);
                if (nextTile) {
                    if (nextTile.points == tile.points && !nextTile.merged) {
                        nextTile.merged = true;
                        nextTile.points += tile.points;
                        tile.position[axis] = nextTile.position[axis];
                        tile.remove = true;
                    } else if (Math.abs(tile.position[axis] - nextTile.position[axis]) > 1) {
                        tile.position[axis] = nextTile.position[axis] - Math.sign(diff);
                        tile.moved = true;
                    }
                } else {
                    if (diff !== 0) {
                        var oldPosition = tile.position[axis];
                        tile.position[axis] = diff > 0 ? 3 : 0;
                        tile.moved = oldPosition !== tile.position[axis];
                    }
                }
            }
        },

        _getNextTile: function (tile, diff, axis) {
            var closestTile = null;
            var anti_axis = axis === X_AXIS ? Y_AXIS : X_AXIS;
            for (var i = 0; i < this.tiles.length; i++) {
                var t = this.tiles[i];
                if (!t.remove && t.position[anti_axis] === tile.position[anti_axis]) {
                    if (diff > 0) {
                        if (t.position[axis] > tile.position[axis] && (closestTile === null || closestTile.position[axis] > t.position[axis])) {
                            closestTile = t;
                        }
                    } else if (diff < 0) {
                        if (t.position[axis] < tile.position[axis] && (closestTile === null || closestTile.position[axis] < t.position[axis])) {
                            closestTile = t;
                        }
                    }
                }
            }
            return closestTile;
        },

        moveLeft: function () {
            this._clearTiles();

            var tiles = this.tiles.slice(0);

            tiles.sort(function (t1, t2) {
                return t1.position[X_AXIS] + 4 * t1.position[Y_AXIS] > t2.position[X_AXIS] + t2.position[Y_AXIS] * 4 ? 1 : -1;
            });

            for (var i = 0; i < tiles.length; i++) {
                var t = tiles[i];
                this._moveTile(t, -1, X_AXIS);
            }
            this._addNewTile();
        },
        moveDown: function () {
            this._clearTiles();

            var tiles = this.tiles.slice(0);

            tiles.sort(function (t1, t2) {
                return t1.position[X_AXIS] + 4 * t1.position[Y_AXIS] > t2.position[X_AXIS] + t2.position[Y_AXIS] * 4 ? 1 : -1;
            });

            for (var i = tiles.length - 1; i >= 0; i--) {
                var t = tiles[i];
                this._moveTile(t, 1, Y_AXIS);
            }
            this._addNewTile();

        },
        moveUp: function () {
            this._clearTiles();

            var tiles = this.tiles.slice(0);

            tiles.sort(function (t1, t2) {
                return t1.position[X_AXIS] + 4 * t1.position[Y_AXIS] > t2.position[X_AXIS] + t2.position[Y_AXIS] * 4 ? 1 : -1;
            });

            for (var i = 0; i < tiles.length; i++) {
                var t = tiles[i];
                this._moveTile(t, -1, Y_AXIS);
            }
            this._addNewTile();

            //this.tiles.sort(function () {
            //    return Math.random() < 0.5 ? -1 : 1;
            //});
        },
        initData: function () {

            this.tiles = [
                {id: "0", position: [0, 3], points: 1},
                {id: "1", position: [1, 3], points: 1},
                {id: "2", position: [2, 3], points: 1},
                {id: "3", position: [3, 3], points: 2}
            ];

            //this.tiles = [
            //    {id: "1", position: [0, 0], points: 1},
            //    {id: "3", position: [2, 0], points: 1},
            //    {id: "2", position: [3, 0], points: 2}];
        }


    });

});