/*
    * GLOBAL VARIABLES
*/

var cols, rows; // number of colums and number of rows
var w = 40; // width of a cell in pixels
var size = 600; // total number of pixels for the canvas
var grid = []; // 2d array storing Cell objects for the maze
var mapSeed; // seed of the current maze
var database = firebase.database(); // initialise Firebase database object
var player; // stores client Player object
var players = []; // stores all local Player objects to be drawn (fetched in accordance with the database)
var initialised = false; // for setup, ensuring asynchronous execution of draw does not interfere with setup


/*
    * CLASS FUNCTIONS
*/

// Player object storing their (x,y) position and their ID (in correspondance with their ID in the database)
function Player(id) {
    this.i = 0; // x
    this.j = 0; // y
    this.id = id;
}

// Cell object storing its (x,y) position and its surrounding walls
function Cell(i, j) {
    this.i = i; // row
    this.j = j; // column
    this.walls = [true, true, true, true] // walls surrounding cell (north, east, south, west)

    // (x,y) coordinates of the top left of the cell (in pixels)
    var y = i*w;
    var x = j*w;

    // (x,y) coordinates of the corners of the cell (top left, top right, bottom left, bottom right)
    var tL = [x, y];
    var tR = [x + w, y];
    var bR = [x + w, y + w];
    var bL = [x, y + w];

    // Draws the cell to the screen by drawing lines between the corners of the cell if a wall exists there
    this.show = function() {
        stroke(255);
        if (this.walls[0]) { // if north wall exists, draw line between top left and top right corners
            line(tL[0], tL[1], tR[0], tR[1]);
        }
        if (this.walls[1]) { // if east wall exists, draw line between top right and bottom right corners
            line(tR[0], tR[1], bR[0], bR[1]);
        }
        if (this.walls[2]) { // if south wall exists, draw line between bottom left and bottom right corners
            line(bL[0], bL[1], bR[0], bR[1]);
        }
        if (this.walls[3]) { // if west wall exists, draw line between top left and bottom left corners
            line(tL[0], tL[1], bL[0], bL[1]);
        }
        stroke(255);
    }
}


/*
    * p5.js FUNCTIONS
*/

// p5.js setup function which is called once after initialising the script
function setup() {
    // Setup the canvas, of size provided by global
    createCanvas(size, size);
    // Store local player objects to display
    players = [];
    // Number of columns in maze grid
    cols = floor(width / w);
    // Number of rows in maze grid
    rows = floor(height / w);

    // Generator function for a randomised ID
    var ID = function() {
        // Math.random should be unique because of its seeding algorithm.
        // Convert it to base 36 (numbers + letters), and grab the first 9 characters
        // after the decimal.
        return '_' + Math.random().toString(36).substr(2, 9);
    };
    // Initialise new Player object with a randomised ID (for current client)
    player = new Player(ID());
    // Modify client player's (x,y) position in the database
    updatePlayer();
    // Fill players array storing local Player objects with those in accordance with the database
    fillLocalPlayers();
    // Obtain maze seed from database, store it globally, then generate the 2d array of Cell objects in a maze formation via the newMaze function.
    database.ref('mapData/seed').once("value").then(function(snapshot){
        s = snapshot.val();
        mapSeed = s;
        grid = newMaze(cols, rows, mapSeed);
        initialised = true; // have reached the end of the setup function, hence game has been initialised so set the boolean to true.
    });
}

// p5.js draw function (executed continuously)
function draw() {
    // Since draw is asynchronously called with setup, we check if the game has been initialised yet (initialised is set true after setup finishes). If not, we leave the method.
    if (!initialised) {
        return;
    }
    background(51); // set background of canvas to dark grey
    // Iterate over each cell object in the 2d array of cell objects, and call their show function to draw them to the canvas
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            grid[i][j].show();
        }
    }
    // Iterate over each player object in the local array of Player objects, and draw their circle to the canvas.
    players.forEach(function (p) {
        // We generate a random colour for the Player object, but it is seeded so that the same ID has the same colour each time. Seed is the player ID.
        var seed = p.id;
        // Generate three different seeded random numbers between 1 and 255 for the RGB values of their colour
        var r = Math.floor((new Math.seedrandom(seed))() * 255) + 1;
        var g = Math.floor((new Math.seedrandom(seed + 1))() * 255) + 1;
        var b = Math.floor((new Math.seedrandom(seed + 2))() * 255) + 1;
        fill(r, g, b); // set draw colour to generated RGB values
        // Draw a circle at the current Player object's location, scaled and positioned appropriately.
        ellipse((p.i + 0.5) * w, (p.j + 0.5) * w, 0.5 * w, 0.5 * w);
    });
    // Now fill in the bottom right cell with the golden square for victory
    fill(255,255,0);
    rect((cols - 1) * w + 0.2 * w, (rows - 1) * w + 0.2 * w, 0.6 * w, 0.6 * w);
}

// p5.js keyPressed event function, which is called whenever a key is pressed
function keyPressed() {
    // Obtain the walls surrounding the player, by obtaining the cell at its location and obtaining its walls array
    var walls = grid[player.j][player.i].walls;
    // If up arrow was pressed and there is no north wall then modify the player's location one cell north and update their location in the database
    if (keyCode === UP_ARROW) {
        if (!walls[0]) {
            player.j--;
            updatePlayer();
        }
    // If right arrow was pressed and there is no east wall then modify the player's location one cell east and update their location in the database
    } else if (keyCode === RIGHT_ARROW) {
        if (!walls[1]) {
            player.i++;
            updatePlayer();
        }
    // If down arrow was pressed and there is no south wall then modify the player's location one cell south and update their location in the database
    } else if (keyCode === DOWN_ARROW) {
        if (!walls[2]) {
            player.j++;
            updatePlayer();
        }
    // If west arrow was pressed and there is no west wall then modify the player's location one cell west and update their location in the database
    } else if (keyCode === LEFT_ARROW) {
        if (!walls[3]) {
            player.i--;
            updatePlayer();
        }
    }
    // If the player's location is at the bottom right cell then they have won, so reset the seed in the database and alert a win message.
    // ** An event for the seed change shall be generated, which will call a function to reset the maze.
    if (player.i == cols - 1 && player.j == rows - 1) {
        database.ref("mapData").set({
            seed: Math.random()
        });
        alert ("Player " + player.id + " (YOU) won!");
    }
}


/*
    * FIREBASE EVENT FUNCTIONS
*/

// Event handler functions for any player entry in the database being modified. Either will call the updateLocalPlayers function.
database.ref('players/').on("child_changed", updateLocalPlayers);
database.ref('players/').on("child_added", updateLocalPlayers);

// Event handler function for the seed being changed, which only occurs upon a victory of a player.
database.ref('mapData').on("child_changed", function(snapshot){
    // Remove all current players in the database (they will have to be recreated for the new maze) by removing the players reference
    database.ref("players/").remove();
    // Re-call the p5.js setup function to initialise the new maze
    setup();
});


/*
    * REST OF FUNCTIONS
*/

// Modify client player's (x,y) position in the database
function updatePlayer() {
    database.ref('players/' + player.id).set({
        x: player.i,
        y: player.j
    });
}

// Obtains each current player in the database, iterates through them and creates player objects for each, then pushes all of them to the local array of player objects.
function fillLocalPlayers() {
    database.ref('players/').once("value").then(function(snapshot){
        snapshot.forEach(function(childSnapshot) { // iterate over each obtained child snapshot, which is each player
            var childData = childSnapshot.val(); // stores the data of the current player
            var newPlayer = new Player(childSnapshot.key); // initialise player object with name of the key of the current child
            // set (x,y) coordinates of new player object
            newPlayer.i = childData.x;
            newPlayer.j = childData.y;
            players.push(newPlayer); // insert a new entry into the local players array of the new player object
        })
    });
}

// Is passed a modified player snapshot in the database, and updates the local players array with the modified data (or adds them if they're a new player)
function updateLocalPlayers(snapshot) {
    var modifiedPlayer = snapshot.val();
    var found = false; // predicate on whether the player has been found in our local players array (we search for them)
    players.forEach(function (p) { // iterate over the players array, where for each player we check if their id is equal to the id of the new player
        if (p.id == snapshot.key) { // if the id of the current player is equal to the key of the snapshot which is the modified player's id, we modify the stored (x,y) coordinates of the player object with the new coordinates
            p.i = modifiedPlayer.x;
            p.j = modifiedPlayer.y;
            found = true; // player was found
        }
    });
    // If the player is not found in the local players array then they are new so create new Player object and push it to the array of Player objects
    if (!found) {
        var newPlayer = new Player(snapshot.key);
        newPlayer.x = modifiedPlayer.x;
        newPlayer.y = modifiedPlayer.y;
        players.push(newPlayer);
    }
}

// Generates a 2d array of Cell objects representing a maze, with dimensions x * y, via a seed (same seed generates same maze)
function newMaze(x, y, seed) {
    var randomCounter = 0;
    function getSeededRandom() {
        var rng = new Math.seedrandom(seed + randomCounter);
        randomCounter++;
        return rng();
    }
    // Establish variables and starting grid
    var totalCells = x*y;
    var cells = new Array();
    var unvis = new Array();
    for (var i = 0; i < y; i++) {
        cells[i] = new Array();
        unvis[i] = new Array();
        for (var j = 0; j < x; j++) {
            cells[i][j] = new Cell(i, j);
            unvis[i][j] = true;
        }
    }
    
    // Set a random position to start from
    var currentCell = [Math.floor(getSeededRandom()*y), Math.floor(getSeededRandom()*x)];
    var path = [currentCell];
    unvis[currentCell[0]][currentCell[1]] = false;
    var visited = 1;
    
    // Loop through all available cell positions
    while (visited < totalCells) {
        // Determine neighboring cells
        var pot = [[currentCell[0]-1, currentCell[1], 0, 2],
                [currentCell[0], currentCell[1]+1, 1, 3],
                [currentCell[0]+1, currentCell[1], 2, 0],
                [currentCell[0], currentCell[1]-1, 3, 1]];
        var neighbors = new Array();
        
        // Determine if each neighboring cell is in game grid, and whether it has already been checked
        for (var l = 0; l < 4; l++) {
            if (pot[l][0] > -1 && pot[l][0] < y && pot[l][1] > -1 && pot[l][1] < x && unvis[pot[l][0]][pot[l][1]]) { 
                neighbors.push(pot[l]); 
            }
        }
        
        // If at least one active neighboring cell has been found
        if (neighbors.length) {
            // Choose one of the neighbors at random
            next = neighbors[Math.floor(getSeededRandom()*neighbors.length)];
            
            // Remove the wall between the current cell and the chosen neighboring cell
            cells[currentCell[0]][currentCell[1]].walls[next[2]] = false;
            cells[next[0]][next[1]].walls[next[3]] = false;
            
            // Mark the neighbor as visited, and set it as the current cell
            unvis[next[0]][next[1]] = false;
            visited++;
            currentCell = [next[0], next[1]];
            path.push(currentCell);
        }
        // Otherwise go back up a step and keep going
        else {
            currentCell = path.pop();
        }
    }
    return cells;
}