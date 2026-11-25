// 节点编号按行从 0 到 24。同行同列的扫描顺序与原 C 程序一致。
function searchFrames(walls, start, goal) {
  const size = 5;
  const row = id => Math.floor(id / size);
  const col = id => id % size;
  const heuristic = id => Math.abs(row(id) - row(goal)) + Math.abs(col(id) - col(goal));
  const costs = Array(size * size).fill(Infinity);
  const parent = Array(size * size).fill(-1);
  const open = new Set([start]);
  const closed = new Set();
  const frames = [];
  costs[start] = 0;

  function record(phase, current, changed = [], path = []) {
    const queue = [...open].sort((a, b) =>
      (costs[a] + heuristic(a)) - (costs[b] + heuristic(b)) || a - b);
    frames.push({phase, current, changed, path, queue, closed: [...closed], costs: [...costs]});
  }
  record('ready', null);
  while (open.size) {
    const current = frames[frames.length - 1].queue[0];
    open.delete(current);
    if (current === goal) {
      const path = [];
      for (let id = goal; id !== -1; id = parent[id]) path.push(id);
      record('found', current, [], path.reverse());
      return frames;
    }
    closed.add(current);
    const changed = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = row(current) + dr;
      const c = col(current) + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const next = r * size + c;
      if (walls.has(next) || closed.has(next) || costs[next] <= costs[current] + 1) continue;
      costs[next] = costs[current] + 1;
      parent[next] = current;
      open.add(next);
      changed.push(next);
    }
    record('expand', current, changed);
  }
  record('blocked', null);
  return frames;
}

if (typeof module !== 'undefined' && module.exports) module.exports = searchFrames;
