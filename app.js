'use strict';
const $ = id => document.getElementById(id);
const coord = id => '(' + Math.floor(id / 5) + ',' + (id % 5) + ')';
const distance = (a, b) => Math.abs(Math.floor(a / 5) - Math.floor(b / 5)) + Math.abs(a % 5 - b % 5);
let start = 10, goal = 14, walls = new Set([7, 12, 17]);
let frames, index = 0, timer = null, tool = 'wall';
const cells = [];
const hints = {wall:'点击空格添加障碍，再点一次擦除。', start:'点击一个可通行的格子放置起点。', goal:'点击一个可通行的格子放置终点。'};
function setTool(name) {
  tool = name;
  document.querySelectorAll('[data-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tool === tool)));
  $('hint').textContent = hints[tool];
}
function pause() {
  clearInterval(timer);
  timer = null;
}
function restart() {
  pause();
  index = 0;
  frames = searchFrames(walls, start, goal);
  render();
}
function edit(id) {
  if (tool === 'wall') {
    if (id === start || id === goal) { $('hint').textContent = '起点和终点保持可通行。'; return; }
    if (walls.has(id)) walls.delete(id); else walls.add(id);
  } else {
    if (walls.has(id)) { $('hint').textContent = '这个格子是障碍，请先擦除障碍。'; return; }
    if (tool === 'start') start = id; else goal = id;
  }
  $('hint').textContent = hints[tool];
  restart();
}
function buildGrid() {
  for (let r = -1; r < 5; r++) {
    for (let c = -1; c < 5; c++) {
      if (r === -1 || c === -1) {
        const axis = document.createElement('span');
        axis.className = 'axis';
        axis.setAttribute('aria-hidden', 'true');
        axis.textContent = r === -1 && c === -1 ? '' : Math.max(r, c);
        $('grid').append(axis);
      } else {
        const id = r * 5 + c;
        const button = document.createElement('button');
        button.addEventListener('click', () => edit(id));
        $('grid').append(button);
        cells.push(button);
      }
    }
  }
}
function render() {
  const frame = frames[index];
  const {current, costs, closed, queue, path, phase, changed} = frame;
  const last = index === frames.length - 1;
  $('step').textContent = '第 ' + index + ' 步';
  $('play').textContent = timer === null ? '自动播放' : '暂停';
  $('next').disabled = $('play').disabled = last;
  $('prev').disabled = index === 0;
  $('reset').disabled = index === 0 && timer === null;
  const g = current === null ? null : costs[current];
  const h = current === null ? null : distance(current, goal);
  $('g').textContent = g ?? '—';
  $('h').textContent = h ?? '—';
  $('f').textContent = g === null ? '—' : g + h;
  if (phase === 'ready') {
    $('status').textContent = '起点已加入候选集合';
    $('explain').textContent = '从 ' + coord(start) + ' 出发，目标是 ' + coord(goal) + '。点击“下一步”取出 f 最小的候选格。';
  } else if (phase === 'expand') {
    $('status').textContent = '展开 ' + coord(current);
    $('explain').textContent = '本轮取出 f = ' + (g + h) + ' 的节点。' + (changed.length ? '更新相邻格 ' + changed.map(coord).join('、') + '，它们的 g = ' + (g + 1) + '。' : '相邻格中没有可更新的路径。');
  } else if (phase === 'found') {
    $('status').textContent = '到达终点 · 最短路径 ' + g + ' 步';
    $('explain').textContent = path.map(coord).join(' → ');
  } else {
    $('status').textContent = '终点不可达';
    $('explain').textContent = '候选集合已空，所有从起点可达的格子都已展开。可以擦除障碍后再试。';
  }
  $('count').textContent = queue.length;
  $('queue').replaceChildren();
  for (const id of queue) {
    const item = document.createElement('span');
    item.textContent = coord(id) + ' f=' + (costs[id] + distance(id, goal));
    $('queue').append(item);
  }
  if (!queue.length) $('queue').textContent = '空';
  cells.forEach((button, id) => {
    const state = walls.has(id) ? 'wall' : path.includes(id) ? 'path' : closed.includes(id) ? 'closed' : queue.includes(id) ? 'open' : '';
    const name = {wall:'障碍',path:'最短路径',closed:'已展开',open:'候选','':'空格'}[state];
    button.className = 'cell ' + state + (id === current ? ' current' : '');
    button.replaceChildren();
    const label = id === start && id === goal ? '起终' : id === start ? '起' : id === goal ? '终' : '';
    if (label) {
      const marker = document.createElement('span');
      marker.className = 'marker' + (id === goal ? ' goal-mark' : '');
      marker.textContent = label;
      button.append(marker);
    }
    let info = coord(id) + ' ' + label + ' ' + name + (id === current ? ' 当前节点' : '');
    if (Number.isFinite(costs[id])) {
      const hValue = distance(id, goal);
      info += '，g=' + costs[id] + '，h=' + hValue + '，f=' + (costs[id] + hValue);
      if (state === 'open') {
        const score = document.createElement('small');
        score.textContent = costs[id] + hValue;
        button.append(score);
      }
    }
    button.title = info;
    button.setAttribute('aria-label', info);
  });
}
function advance() {
  if (index < frames.length - 1) index++;
  if (index === frames.length - 1) pause();
  render();
}
function play() {
  pause();
  timer = setInterval(advance, Number($('speed').value));
  render();
}
document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('next').onclick = () => { pause(); advance(); };
$('prev').onclick = () => { pause(); index = Math.max(0, index - 1); render(); };
$('play').onclick = () => { if (timer === null) play(); else { pause(); render(); } };
$('speed').onchange = () => { if (timer !== null) play(); };
$('reset').onclick = restart;
$('example').onclick = () => { start = 10; goal = 14; walls = new Set([7, 12, 17]); setTool('wall'); restart(); };
buildGrid();
restart();
