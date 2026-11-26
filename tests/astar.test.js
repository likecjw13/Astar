'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const Astar = require('../js/astar');
const cSource = require('../js/source');

const basic = Astar.fromRows(['..#..', '..#..', '..#..', '..#..', '.....']);
const equal = Astar.fromRows(Array(5).fill('.....'));
const blocked = Astar.fromRows(Array(5).fill('..#..'));
const improve = Astar.fromRows(['..###...', '......#.', '...##...', '........',
  '#....#.#', '..#.....', '.#.#....', '...#...#'], 13, 34);
const same = Astar.fromRows(['.']);
const samples = [basic, equal, blocked, improve, same, Astar.fromRows(['......']),
  Astar.fromRows(['.', '.', '.', '.'], 3, 0)];

function bfs(map) {
  const {rows, cols, walls, start, goal} = map;
  const distances = new Map([[start, 0]]);
  const queue = [start];
  for (const id of queue) {
    if (id === goal) return distances.get(id);
    const x = Math.floor(id / cols), y = id % cols;
    for (const [a, b] of [[x-1, y], [x+1, y], [x, y-1], [x, y+1]]) {
      const next = a * cols + b;
      if (a < 0 || a >= rows || b < 0 || b >= cols || walls.has(next) || distances.has(next)) continue;
      distances.set(next, distances.get(id) + 1);
      queue.push(next);
    }
  }
  return -1;
}

function evaluate(map) {
  const frames = [...Astar.search(map)];
  const end = frames.at(-1);
  assert.equal(end.done, true);
  assert.equal(end.path.length - 1, bfs(map));
  if (end.path.length) {
    assert.equal(end.path[0], map.start);
    assert.equal(end.path.at(-1), map.goal);
  }
  end.path.forEach((id, i) => {
    assert(!map.walls.has(id));
    if (i) assert.equal(Astar.distance(end.path[i - 1], id, map.cols), 1);
  });
  return frames;
}

test('默认、空白、隔断、重合、单行与单列地图均与 BFS 一致', () => {
  samples.forEach(evaluate);
  assert.equal(evaluate(basic).at(-1).path.length - 1, 8);
  assert.equal(evaluate(same).at(-1).path.length - 1, 0);
  assert.equal(evaluate(blocked).at(-1).mark, 'empty');
});

test('1000 张可复现的随机矩形地图与 BFS 一致', () => {
  let seed = 0xA57A;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 1000; i++) {
    const rows = 1 + Math.floor(rand() * 10);
    const cols = 1 + Math.floor(rand() * 13);
    const start = Math.floor(rand() * rows * cols);
    const goal = Math.floor(rand() * rows * cols);
    const density = rand() * 0.9;
    const walls = new Set();
    for (let id = 0; id < rows * cols; id++) {
      if (id !== start && id !== goal && rand() < density) walls.add(id);
    }
    evaluate({rows, cols, start, goal, walls});
  }
});

test('扫描顺序、方向及每帧集合、坐标和父节点保持一致', () => {
  const frames = evaluate(equal);
  assert.deepEqual(frames.filter(f => f.mark === 'select').slice(0, 6).map(f => f.current), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(frames.filter(f => f.mark === 'direction').slice(0, 4).map(f => f.neighbor), [-1, 5, -1, 1]);
  assert(frames.some(f => f.mark === 'compare' && f.message.includes('两条路线代价相同')));
  for (const frame of frames) {
    const nodes = frame.board.flat();
    assert.equal(frame.stats.open, nodes.filter(n => n.opened).length);
    assert.equal(frame.stats.closed, nodes.filter(n => n.closed).length);
    assert.equal(frame.stats.discovered, nodes.filter(n => n.g !== Astar.MAX).length);
    nodes.forEach((node, id) => {
      assert(!(node.opened && node.closed));
      if (node.g < Astar.MAX) {
        assert.equal(node.h, Astar.distance(id, equal.goal, equal.cols));
        assert.equal(node.f, node.g + node.h);
      }
      if (node.parent >= 0) {
        assert.equal(Astar.distance(id, node.parent, equal.cols), 1);
        assert(nodes[node.parent].g < node.g);
      }
    });
  }
});

test('实验三中 (3,3) 的新代价更低，回看仍可读到旧父节点和原 g', () => {
  const frames = evaluate(improve);
  const idx = frames.findIndex(f => f.mark === 'update' && f.title === '更新为更短路径');
  assert(idx > 0);
  const id = 3 * improve.cols + 3;
  const original = Astar.get(frames[idx - 1].board, id, improve.cols);
  const updated = Astar.get(frames[idx].board, id, improve.cols);
  assert.deepEqual([original.g, updated.g, updated.parent], [6, 4, 28]);
  assert.notEqual(original.parent, updated.parent);
  assert.equal(Astar.get(frames[0].board, id, improve.cols).g, Astar.MAX);
  assert(frames.at(-1).stats.improved > 0);
});

test('提交的 C99 示例与导出器一致，所有追踪帧可定位到实际源码', () => {
  const exported = cSource(basic);
  const file = fs.readFileSync(path.join(__dirname, '../c/astar.c'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(file, exported.code);
  assert.equal(exported.input, '0 0 4 4\n0 0 1 0 0\n0 0 1 0 0\n0 0 1 0 0\n0 0 1 0 0\n0 0 0 0 0\n');
  const lines = exported.code.split('\n');
  for (const frame of evaluate(basic)) assert(lines[exported.marks[frame.mark]].trim());
});

test('实际编译 C99，逐轮对照选点、代价比较、最短路径和失败结果',
  {skip: !process.env.ASTAR_CC || !process.env.ASTAR_TEST_DIR ? '设置 ASTAR_CC 和 ASTAR_TEST_DIR 以启用 C99 编译验证' : false}, () => {
    const directory = fs.mkdtempSync(path.join(process.env.ASTAR_TEST_DIR, 'astar-c99-'));
    const src = path.join(directory, 'astar.c');
    const exe = path.join(directory, process.platform === 'win32' ? 'astar.exe' : 'astar');
    const maps = [...samples, Astar.randomMap(10, 14, 20), Astar.randomMap(15, 10, 42)];
    try {
      for (const map of maps) {
        const source = cSource(map);
        fs.writeFileSync(src, source.code);
        execFileSync(process.env.ASTAR_CC, ['-std=c99', '-pedantic-errors', '-Wall', '-Wextra', '-Werror', src, '-o', exe]);
        const run = input => execFileSync(exe, ['--trace'], {input, encoding: 'utf8'}).trim().split(/\r?\n/);
        const expected = evaluate(map);
        const result = run(source.input);
        assert.deepEqual(result.filter(line => /^[SG] /.test(line)), expected.map(f => f.trace).filter(Boolean));
        const route = expected.at(-1).path;
        const ending = route.length ? [route.map(id => Astar.coord(id, map.cols)).join(' -> '), 'Length: ' + (route.length - 1)] : ['No path'];
        assert.deepEqual(result.slice(-ending.length), ending);
        assert.deepEqual(run(''), result);
      }
    } finally {
      fs.unlinkSync(src);
      if (fs.existsSync(exe)) fs.unlinkSync(exe);
      fs.rmdirSync(directory);
    }
  });
