export class Game {
  constructor() {
    this.grid = Array.from({ length: 4 }, () => Array(4).fill(null));
    this.score = 0;
    this.best = parseInt(localStorage.getItem('best2048') || '0');
    this.won = false;
    this.over = false;
    this.idSeq = 0;
  }

  newId() { return this.idSeq++ }

  emptyCells() {
    const cells = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (!this.grid[r][c]) cells.push({ r, c });
    return cells;
  }

  spawn() {
    const empty = this.emptyCells();
    if (!empty.length) return null;
    const pos = empty[Math.floor(Math.random() * empty.length)];
    const val = Math.random() < 0.9 ? 2 : 4;
    const tile = { id: this.newId(), value: val, row: pos.r, col: pos.c };
    this.grid[pos.r][pos.c] = tile;
    return tile;
  }

  move(dir) {
    const isH = dir === 'left' || dir === 'right';
    const revDir = dir === 'right' || dir === 'down';

    const lines = [[], [], [], []];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const r = isH ? i : j;
        const c = isH ? j : i;
        const tile = this.grid[r][c];
        if (tile) lines[i].push({ ...tile, row: r, col: c });
      }

    const mergeLine = (tiles, rev) => {
      const ordered = rev ? [...tiles].reverse() : tiles;
      const result = [];
      let i = 0;
      while (i < ordered.length) {
        if (i + 1 < ordered.length && ordered[i].value === ordered[i + 1].value) {
          result.push({ tile: ordered[i], mergeWith: ordered[i + 1] });
          i += 2;
        } else {
          result.push({ tile: ordered[i] });
          i += 1;
        }
      }
      return result;
    };

    const newGrid = Array.from({ length: 4 }, () => Array(4).fill(null));
    const moves = [];
    let totalScore = 0;

    for (let i = 0; i < 4; i++) {
      const merged = mergeLine(lines[i], revDir);
      const indices = revDir ? [3, 2, 1, 0] : [0, 1, 2, 3];
      let idx = 0;
      for (const entry of merged) {
        let tr, tc;
        if (isH) { tr = i; tc = indices[idx] }
        else { tr = indices[idx]; tc = i }

        if (entry.mergeWith) {
          const val = entry.tile.value * 2;
          const newId = this.newId();
          newGrid[tr][tc] = { id: newId, value: val, row: tr, col: tc };
          moves.push({ id: entry.tile.id, fromR: entry.tile.row, fromC: entry.tile.col, toR: tr, toC: tc, value: entry.tile.value, merged: true, newId });
          moves.push({ id: entry.mergeWith.id, fromR: entry.mergeWith.row, fromC: entry.mergeWith.col, toR: tr, toC: tc, value: entry.mergeWith.value, merged: true, newId });
          totalScore += val;
        } else {
          newGrid[tr][tc] = { id: entry.tile.id, value: entry.tile.value, row: tr, col: tc };
          if (entry.tile.row !== tr || entry.tile.col !== tc)
            moves.push({ id: entry.tile.id, fromR: entry.tile.row, fromC: entry.tile.col, toR: tr, toC: tc, value: entry.tile.value, merged: false });
        }
        idx++;
      }
    }

    if (!moves.length) return { moved: false };
    this.grid = newGrid;
    this.score += totalScore;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('best2048', this.best);
    }
    const spawnTile = this.spawn();
    this.over = this.checkGameOver();
    if (!this.won && this.grid.some(r => r.some(t => t && t.value >= 2048))) { this.won = true }
    return { moved: true, score: this.score, moves, spawn: spawnTile, gameOver: this.over, won: this.won };
  }

  saveState() {
    return JSON.stringify({
      grid: this.grid,
      score: this.score,
      best: this.best,
      over: this.over,
      won: this.won,
      idSeq: this.idSeq,
    });
  }

  loadState(json) {
    const s = JSON.parse(json);
    this.grid = s.grid;
    this.score = s.score;
    if (s.best > this.best) { this.best = s.best; localStorage.setItem('best2048', this.best) }
    else this.best = s.best;
    this.over = s.over;
    this.won = s.won;
    this.idSeq = s.idSeq;
  }

  checkGameOver() {
    if (this.emptyCells().length > 0) return false;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const v = this.grid[r][c].value;
        if ((c < 3 && this.grid[r][c + 1] && this.grid[r][c + 1].value === v) ||
            (r < 3 && this.grid[r + 1][c] && this.grid[r + 1][c].value === v)) return false;
      }
    return true;
  }
}
