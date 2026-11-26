'use strict';

(function (root) {
  const MAX = 2147483647;
  const fresh = Object.freeze({g: MAX, h: 0, f: MAX, parent: -1, opened: 0, closed: 0, order: 0});
  const directions = [[-1, 0, '上'], [1, 0, '下'], [0, -1, '左'], [0, 1, '右']];
  const point = (id, cols) => [Math.floor(id / cols), id % cols];
  const coord = (id, cols) => id < 0 ? '—' : '(' + point(id, cols).join(',') + ')';
  const value = n => n === MAX ? 'INT_MAX' : String(n);
  const distance = (a, b, cols) => {
    const [x, y] = point(a, cols);
    const [ex, ey] = point(b, cols);
    return Math.abs(x - ex) + Math.abs(y - ey);
  };
  const get = (board, id, cols) => board[Math.floor(id / cols)][id % cols];
  const tick = () => performance.now();

  function route(board, end, cols) {
    const path = [];
    if (end >= 0 && get(board, end, cols).g < MAX) {
      for (let id = end; id >= 0; id = get(board, id, cols).parent) path.push(id);
    }
    return path.reverse();
  }

  function* search(map) {
    const {rows, cols, start, goal, walls} = map;
    let board = Array.from({length: rows}, () => Array(cols).fill(fresh));
    let round = 0, current = -1, neighbor = -1, path = [], work = 0;
    let began = tick();
    const stats = {open: 0, closed: 0, discovered: 0, updates: 0, repeated: 0, improved: 0};
    const p = id => coord(id, cols);

    function update(id, fields) {
      const [r, c] = point(id, cols);
      const row = board[r].slice();
      row[c] = {...row[c], ...fields};
      board = board.slice();
      board[r] = row;
    }

    // 每帧可独立读取全部节点。修改只复制所在行，其余行与此前帧共享。
    function* frame(mark, title, message, extra = {}) {
      work += tick() - began;
      yield {mark, title, message, board, round, current, neighbor, path, work,
        stats: {...stats}, ...extra};
      began = tick();
    }

    yield* frame('init', '等待执行', '节点已初始化，起点将在第一步加入 Open 集合。');
    const h = distance(start, goal, cols);
    update(start, {g: 0, h, f: h, opened: 1});
    stats.discovered = stats.open = 1;
    yield* frame('start', '初始化起点', p(start) + ' 的 g = 0，h = ' + h + '，f = ' + h + '，加入 Open。');

    while (true) {
      round++;
      current = neighbor = -1;
      yield* frame('loop', '进入第 ' + round + ' 轮', '按行、按列扫描二维数组，遇到严格更小的 f 才替换候选。');
      let min = MAX;
      for (let x = 0; x < rows; x++) {
        for (let y = 0; y < cols; y++) {
          const node = board[x][y];
          if (node.opened && node.f < min) {
            current = x * cols + y;
            min = node.f;
          }
        }
      }
      if (current === -1) {
        yield* frame('empty', '寻路失败', 'Open 集合已空，终点不可达。', {done: true});
        return;
      }
      yield* frame('select', '选择 ' + p(current), '扫描得到最小 f = ' + min + '。同分时保留最先扫描到的节点。',
        {trace: 'S ' + [...point(current, cols), min].join(' ')});
      const reached = current === goal;
      yield* frame('goal', '判断是否到达终点', p(current) + (reached ? ' 等于 ' : ' 不等于 ') + p(goal) +
        (reached ? '，开始沿父节点回溯。' : '，继续扩展当前节点。'));
      if (reached) {
        path = route(board, goal, cols);
        yield* frame('path', '找到最短路径', '父节点链回溯完成，最短路径为 ' + (path.length - 1) + ' 步。', {done: true});
        return;
      }
      const [x, y] = point(current, cols);
      update(current, {opened: 0, closed: 1, order: ++stats.closed});
      stats.open--;
      yield* frame('close', '移入 Closed', p(current) + ' 的 opened = 0、closed = 1。');
      for (const [dr, dc, direction] of directions) {
        const nx = x + dr, ny = y + dc;
        const name = '(' + nx + ',' + ny + ')';
        const inside = nx >= 0 && nx < rows && ny >= 0 && ny < cols;
        neighbor = inside ? nx * cols + ny : -1;
        yield* frame('direction', '检查' + direction + '方', p(current) + ' + (' + dr + ',' + dc + ') = ' + name + '。');
        if (!inside || walls.has(neighbor)) {
          yield* frame('valid', '跳过' + direction + '方', name + (inside ? ' 是障碍物' : ' 越界') + '，valid 返回 0，执行 continue。');
          continue;
        }
        const old = get(board, neighbor, cols);
        if (old.closed) {
          yield* frame('closed', '跳过已关闭节点', name + ' 已在 Closed 中，执行 continue。');
          continue;
        }
        const g = get(board, current, cols).g;
        const nextG = g + 1;
        yield* frame('newg', '计算新代价', '当前节点 ' + p(current) + ' 的 g = ' + g + '，因此 newg = ' + g + ' + 1 = ' + nextG + '。');
        if (old.opened) stats.repeated++;
        const shorter = nextG < old.g;
        const result = shorter ? '成立，下一步更新节点。' :
          nextG === old.g ? '不成立。两条路线代价相同，保留原父节点。' : '不成立。新路线更长，保留原记录。';
        yield* frame('compare', '比较 ' + name + ' 的代价', '原 g = ' + value(old.g) + '，newg = ' + nextG +
          '。判断 ' + nextG + ' < ' + value(old.g) + '，' + result,
          {trace: 'G ' + [x, y, nx, ny, old.g, nextG].join(' ')});
        if (shorter) {
          const nh = distance(neighbor, goal, cols);
          stats.updates++;
          if (old.opened) stats.improved++;
          else {
            stats.open++;
            stats.discovered++;
          }
          update(neighbor, {g: nextG, h: nh, f: nextG + nh, parent: current, opened: 1});
          yield* frame('update', old.opened ? '更新为更短路径' : '首次发现 ' + name,
            'g 从 ' + value(old.g) + ' 变为 ' + nextG + '，h = ' + nh + '，f = ' + (nextG + nh) +
            '，父节点设为 ' + p(current) + '，opened = 1。');
        }
      }
      neighbor = -1;
      yield* frame('round', '第 ' + round + ' 轮结束', '四个方向检查完毕，返回 while 循环。');
    }
  }

  function randomMap(rows, cols, density, start = 0, goal = rows * cols - 1) {
    const walls = new Set();
    const available = Array.from({length: rows * cols}, (_, i) => i).filter(id => id !== start && id !== goal);
    const count = Math.round(available.length * density / 100);
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (available.length - i));
      [available[i], available[j]] = [available[j], available[i]];
      walls.add(available[i]);
    }
    return {rows, cols, start, goal, walls};
  }

  function fromRows(lines, start = 0, goal = lines.length * lines[0].length - 1) {
    const walls = new Set();
    lines.join('').split('').forEach((cell, id) => { if (cell === '#') walls.add(id); });
    return {rows: lines.length, cols: lines[0].length, start, goal, walls};
  }

  const api = {MAX, value, point, coord, distance, get, route, search, fromRows, randomMap};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Astar = api;
})(globalThis);
