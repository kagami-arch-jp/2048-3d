globalThis.localStorage ??= { getItem: () => null, setItem: () => {} };
import { Game } from './game.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('  FAIL:', msg); failed++; }
}

// Build a game from a values grid, ignoring spawned tiles for grid checks
function gridFromVals(arrays) {
  const g = new Game();
  g.idSeq = 100;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (arrays[r][c] !== null)
        g.grid[r][c] = { id: g.newId(), value: arrays[r][c], row: r, col: c };
  return g;
}

function vals(g) {
  return g.grid.map(r => r.map(t => t ? t.value : null));
}

// Check that grid CONTAINS the expected tiles (ignoring extra spawned tile)
function assertGridContains(g, expected) {
  const av = vals(g);
  // expected: array of [r, c, value]
  for (const [r, c, v] of expected) {
    assert(av[r]?.[c] === v, `expected grid[${r}][${c}] = ${v}, got ${av[r]?.[c]}`);
  }
  return av;
}

// Check that move returns moved=true/false
function assertMove(label, initial, dir, expectMove, expectedTiles) {
  const g = gridFromVals(initial);
  const result = g.move(dir);
  assert(result.moved === expectMove, `${label}: expected moved=${expectMove}, got ${result.moved}`);
  if (expectedTiles) assertGridContains(g, expectedTiles);
}

// === LEFT ===
console.log('--- LEFT ---');
assertMove('simple pair', [[2,2,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', true, [[0,0,4]]);
// [2,4,null,null] already at left edge, 2≠4 → no move
assertMove('no merge diff', [[2,4,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', false);
assertMove('triple same', [[2,2,2,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', true, [[0,0,4],[0,1,2]]);
assertMove('four same', [[2,2,2,2],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', true, [[0,0,4],[0,1,4]]);
assertMove('double merge', [[2,2,4,4],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', true, [[0,0,4],[0,1,8]]);
assertMove('shift then merge', [[2,null,2,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', true, [[0,0,4]]);
assertMove('no cascade', [[4,2,2,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', true, [[0,0,4],[0,1,4]]);
assertMove('already edge', [[2,4,8,16],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', false, [[0,0,2],[0,1,4],[0,2,8],[0,3,16]]);
assertMove('separated pair', [[4,null,null,4],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'left', true, [[0,0,8]]);

// === RIGHT ===
console.log('--- RIGHT ---');
assertMove('simple pair', [[null,null,2,2],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'right', true, [[0,3,4]]);
assertMove('spread', [[2,null,null,2],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'right', true, [[0,3,4]]);
assertMove('double merge', [[2,2,4,4],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'right', true, [[0,2,4],[0,3,8]]);
assertMove('triple right', [[2,2,2,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'right', true, [[0,2,2],[0,3,4]]);
assertMove('four right', [[2,2,2,2],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'right', true, [[0,2,4],[0,3,4]]);

// === UP ===
console.log('--- UP ---');
assertMove('pair col 0', [[2,null,null,null],[2,null,null,null],[null,null,null,null],[null,null,null,null]], 'up', true, [[0,0,4]]);
assertMove('pair col 1', [[null,2,null,null],[null,2,null,null],[null,null,null,null],[null,null,null,null]], 'up', true, [[0,1,4]]);
assertMove('pair col 3', [[null,null,null,2],[null,null,null,2],[null,null,null,null],[null,null,null,null]], 'up', true, [[0,3,4]]);
assertMove('spread vertical', [[2,null,null,null],[null,null,null,null],[2,null,null,null],[null,null,null,null]], 'up', true, [[0,0,4]]);
assertMove('double merge up', [[2,null,null,null],[2,null,null,null],[4,null,null,null],[4,null,null,null]], 'up', true, [[0,0,4],[1,0,8]]);
assertMove('4 same col up', [[2,null,null,null],[2,null,null,null],[2,null,null,null],[2,null,null,null]], 'up', true, [[0,0,4],[1,0,4]]);
assertMove('triple same col up', [[2,null,null,null],[2,null,null,null],[2,null,null,null],[null,null,null,null]], 'up', true, [[0,0,4],[1,0,2]]);
assertMove('multi col up', [[2,4,null,null],[2,4,null,null],[null,null,null,null],[null,null,null,null]], 'up', true, [[0,0,4],[0,1,8]]);
assertMove('already top', [[4,null,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]], 'up', false, [[0,0,4]]);

// === DOWN ===
console.log('--- DOWN ---');
assertMove('pair col 0 down', [[2,null,null,null],[2,null,null,null],[null,null,null,null],[null,null,null,null]], 'down', true, [[3,0,4]]);
assertMove('spread down', [[2,null,null,null],[null,null,null,null],[null,null,null,null],[2,null,null,null]], 'down', true, [[3,0,4]]);
assertMove('double merge down', [[2,null,null,null],[2,null,null,null],[4,null,null,null],[4,null,null,null]], 'down', true, [[2,0,4],[3,0,8]]);
assertMove('4 same col down', [[2,null,null,null],[2,null,null,null],[2,null,null,null],[2,null,null,null]], 'down', true, [[2,0,4],[3,0,4]]);
assertMove('col 2 down', [[null,null,2,null],[null,null,null,null],[null,null,2,null],[null,null,null,null]], 'down', true, [[3,2,4]]);
assertMove('triple col 2 down', [[null,null,2,null],[null,null,2,null],[null,null,2,null],[null,null,null,null]], 'down', true, [[2,2,2],[3,2,4]]);

// === GAME OVER ===
console.log('--- GAME OVER ---');
(function testGameOver() {
  const g = gridFromVals([
    [2,4,2,4],
    [4,2,4,2],
    [2,4,2,4],
    [4,2,4,2],
  ]);
  assert(!g.move('left').moved, 'game over - no left');
  assert(!g.move('right').moved, 'game over - no right');
  assert(!g.move('up').moved, 'game over - no up');
  assert(!g.move('down').moved, 'game over - no down');
  assert(g.checkGameOver(), 'game should be over');
  assert(!g.over, 'game.over only set after a move attempt');
})();

(function testNotGameOver() {
  const g = gridFromVals([
    [2,2,2,4],
    [4,2,4,2],
    [2,4,2,4],
    [4,2,4,2],
  ]);
  const r = g.move('left');
  assert(r.moved, 'should be able to move left');
  assert(!g.checkGameOver(), 'game not over');
  assert(!g.over, 'game.over should be false');
})();

// === WIN ===
console.log('--- WIN ---');
(function testWin() {
  const g = gridFromVals([
    [1024,1024,null,null],
    [null,null,null,null],
    [null,null,null,null],
    [null,null,null,null],
  ]);
  const r = g.move('left');
  assert(r.moved, 'win move should move');
  assert(r.won, 'should trigger win');
  assert(g.won, 'game.won should be true');
  assert(g.grid[0][0].value === 2048, 'merged tile should be 2048');
})();

// === SCORE ===
console.log('--- SCORE ---');
(function testScore() {
  const g = gridFromVals([
    [2,2,2,2],
    [null,null,null,null],
    [null,null,null,null],
    [null,null,null,null],
  ]);
  const r = g.move('left');
  assert(r.score === 8, 'score should be 8 (4+4)');
  assert(g.score === 8, 'game.score should be 8');
})();

// === NO MUTATION ===
console.log('--- NO MUTATION ---');
(function testNoMutation() {
  const g = gridFromVals([
    [2,4,8,16],
    [null,null,null,null],
    [null,null,null,null],
    [null,null,null,null],
  ]);
  const before = JSON.stringify(vals(g));
  g.move('left');
  assert(JSON.stringify(vals(g)) === before, 'grid unchanged on no-move');
})();

// === COMPLEX ===
console.log('--- COMPLEX ---');
(function testComplex() {
  const g = gridFromVals([
    [2,null,null,2],
    [null,4,4,null],
    [null,null,null,null],
    [8,null,null,8],
  ]);
  const r = g.move('left');
  assert(r.moved, 'complex left should move');
  assertGridContains(g, [[0,0,4],[1,0,8],[3,0,16]]);
})();

// === SEPARATE COLUMNS ===
console.log('--- SEPARATE COLUMNS ---');
// Both tiles in col 0 merge; tile in col 1 slides to top
assertMove('col 0 moves, col 1 stays',
  [[2,null,null,null],[null,null,null,null],[2,null,null,null],[null,2,null,null]], 'up',
  true, [[0,0,4],[0,1,2]]);
// Tile in col 0 stays; tiles in col 1 merge
assertMove('col 0 stays, col 1 moves',
  [[2,2,null,null],[null,null,null,null],[null,2,null,null],[null,null,null,null]], 'up',
  true, [[0,0,2],[0,1,4]]);

// === SUMMARY ===
const total = passed + failed;
console.log(`\n${passed} passed, ${failed} failed out of ${total} tests`);
process.exit(failed > 0 ? 1 : 0);
