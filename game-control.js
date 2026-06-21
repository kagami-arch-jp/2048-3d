import { Game } from './game.js';
import { GameView } from './game-view.js';

const SAVE_KEY = 'game2048';
const CAM_KEY = 'game2048_cam';

export class GameController {
  constructor() {
    this.game = null;
    this.view = new GameView();
    this._isAnimating = false;
    this._lastTime = 0;
    this._camSaveCounter = 0;
    this._boundLoop = (t) => this._loop(t);
    this._initInput();
    this._startLoop();
  }

  init(fresh = false) {
    this.game = new Game();
    this.view.clearAll();
    this.view.hideModal();

    if (!fresh) {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        this.game.loadState(saved);
        for (const t of this.game.grid.flat()) if (t) this.view.restoreTile(t);
        this.view.updateScore(this.game.score, this.game.best);
        if (this.game.over) setTimeout(() => this.view.showModal('Game Over', `Final: ${this.game.score}`, 'Click New Game to try again'), 400);
        else if (this.game.won) setTimeout(() => this.view.showModal('2048!', `Score: ${this.game.score}`, 'Keep going? Click New Game'), 400);
        window.G = this.game;
        window.restartGame = () => this.init();
        this._restoreCamera();
        return;
      }
    }

    const t1 = this.game.spawn();
    const t2 = this.game.spawn();
    for (const t of [t1, t2]) if (t) this.view.animateSpawn(this.view.spawnTile(t), t === t1 ? 0 : 100);
    this.view.updateScore(this.game.score, this.game.best);
    localStorage.removeItem(SAVE_KEY);
    this._restoreCamera();
    window.G = this.game;
    window.restartGame = () => this.init();
  }

  _saveCamera() {
    localStorage.setItem(CAM_KEY, JSON.stringify(this.view.getCameraState()));
  }

  _restoreCamera() {
    const raw = localStorage.getItem(CAM_KEY);
    if (raw) this.view.setCameraState(JSON.parse(raw));
  }

  // ===== INPUT =====

  _initInput() {
    const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    window.addEventListener('keydown', e => {
      const dir = keyMap[e.code];
      if (!dir) return;
      e.preventDefault();
      this._handleMove(dir);
    });

    let tx = 0, ty = 0;
    window.addEventListener('touchstart', e => { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; });
    window.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < 20) return;
      this._handleMove(ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });

    document.getElementById('new-game-btn').addEventListener('click', () => { localStorage.removeItem(SAVE_KEY); this.init(); });
    document.getElementById('modal-btn').addEventListener('click', () => { localStorage.removeItem(SAVE_KEY); this.init(); });
    document.getElementById('reset-cam-btn').addEventListener('click', () => { localStorage.setItem(CAM_KEY, JSON.stringify(this.view.resetCamera())); });
  }

  // ===== MOVE ORCHESTRATION =====

  async _handleMove(dir) {
    if (this._isAnimating || !this.game) return;
    const result = this.game.move(dir);
    if (!result.moved) {
      this.view.rejectMove();
      return;
    }
    this._isAnimating = true;

    const promises = result.moves.map(m => {
      if (!m.merged) return this.view.animateMoveTo(m.id, m.toR, m.toC);
      if (m.fromR === m.toR && m.fromC === m.toC) return Promise.resolve();
      return this.view.animateMergeTo(m.id, m.toR, m.toC);
    });
    await Promise.all(promises);

    this.view.applyMoveResult(result, this.game.grid);
    this.view.updateScore(this.game.score, this.game.best);
    this._saveGame();

    if (result.won) {
      setTimeout(() => this.view.showModal('2048!', `Score: ${this.game.score}`, 'Keep going? Click New Game'), 400);
    } else if (result.gameOver) {
      this.view.animateGameOver(() => {
        setTimeout(() => this.view.showModal('Game Over', `Final: ${this.game.score}`, 'Click New Game to try again'), 300);
      });
    }

    this._isAnimating = false;
  }

  _saveGame() {
    localStorage.setItem(SAVE_KEY, this.game.saveState());
  }

  // ===== RENDER LOOP =====

  _startLoop() {
    this._lastTime = performance.now();
    requestAnimationFrame(this._boundLoop);
  }

  _loop(time) {
    const dt = Math.min((time - this._lastTime) / 1000, .05);
    this._lastTime = time;
    this.view.update(dt);
    this.view.render();
    if (++this._camSaveCounter % 60 === 0) this._saveCamera();
    requestAnimationFrame(this._boundLoop);
  }
}
