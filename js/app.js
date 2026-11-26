'use strict';

(function () {
  const {$, make} = View;
  function defaultMap() {
    return Astar.fromRows(['..#..', '..#..', '..#..', '..#..', '.....']);
  }

  const experiments = {
    basic: ['观察默认地图中 A* 如何绕过障碍，并沿父节点回溯路径。', defaultMap],
    equal: ['在无障碍网格中，多个方向可得到同样短的路径。遇到 newg = 原 g 时，观察父节点为何保持不变。', () => Astar.fromRows(Array(5).fill('.....'))],
    improve: ['从 (1,5) 到 (4,2)。跟踪 (3,3) 的 g 如何从 6 降到 4，父节点如何改为 (3,4)。', () =>
      Astar.fromRows(['..###...', '......#.', '...##...', '........', '#....#.#', '..#.....', '.#.#....', '...#...#'], 13, 34)],
    blocked: ['竖向障碍把区域完全隔开。跟踪 Open 集合逐步耗尽，直至返回失败。', () =>
      Astar.fromRows(Array(5).fill('..#..'))],
    maze: ['观察候选集合在多个入口之间切换，以及回溯路径如何穿过缺口。', () =>
      Astar.fromRows(Array.from({length: 15}, (_, r) => Array.from({length: 15}, (_, c) =>
        c % 2 === 1 && r !== (c % 4 === 1 ? 13 : 1) ? '#' : '.').join('')))],
    random: ['在 20 × 20 地图用当前密度随机生成障碍。观察成功或失败时的扩展规模与计算耗时。', () =>
      Astar.randomMap(20, 20, Number($('density').value))]
  };

  let map, source, iterator, frames, index, logFloor;
  let selected, tool = 'wall', drag = null;
  let searchTimer = null, carTimer = null, car = -1, toastTimer;
  let logKey = '';

  function notify(text) {
    clearTimeout(toastTimer);
    $('toast').textContent = text;
    toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 2200);
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('theme').textContent = theme === 'dark' ? '切换浅色' : '切换深色';
    try { localStorage.setItem('astar-theme', theme); } catch { /* file:// may not permit storage */ }
  }

  function haltSearch() {
    clearTimeout(searchTimer);
    searchTimer = null;
  }

  function haltCar() {
    clearInterval(carTimer);
    carTimer = null;
    car = -1;
  }

  function resetSearch() {
    haltSearch();
    haltCar();
    iterator = Astar.search(map);
    frames = [iterator.next().value];
    index = 0;
    logFloor = 1;
    logKey = '';
    render();
  }

  function updateSource() {
    source = CSource(map);
    View.buildCode(source);
    $('stdin').value = source.input;
  }

  function loadMap(next) {
    drag = null;
    map = next;
    selected = map.start;
    $('dimensions').textContent = map.rows + ' × ' + map.cols;
    $('rows').value = map.rows;
    $('cols').value = map.cols;
    $('size').value = map.rows === map.cols && [5, 8, 10, 15, 20].includes(map.rows) ? String(map.rows) : 'custom';
    $('custom').hidden = $('size').value !== 'custom';
    View.buildBoard(map);
    updateSource();
    resetSearch();
  }

  function loadPreset(name) {
    $('preset').value = name;
    const [guide, create] = experiments[name];
    $('lesson').textContent = guide;
    loadMap(create());
  }

  function editMap() {
    $('lesson').textContent = '当前为自定义布局。可从实验列表重新载入预设。';
    $('preset').selectedIndex = -1;
    updateSource();
    resetSearch();
  }

  function advance() {
    if (index < frames.length - 1) {
      index++;
    } else if (!frames[index].done) {
      frames.push(iterator.next().value);
      index++;
    }
  }

  function schedule() {
    const delay = 1250 - (Number($('speed').value) - 1) * 128;
    searchTimer = setTimeout(() => {
      advance();
      if (frames[index].done) haltSearch();
      else schedule();
      render();
    }, delay);
  }

  function carRun() {
    const path = frames[index].path;
    if (!path.length) return;
    if (carTimer !== null) {
      haltCar();
      render();
      return;
    }
    let at = 0;
    car = path[at];
    if (path.length > 1) {
      carTimer = setInterval(() => {
        car = path[++at];
        if (at === path.length - 1) {
          clearInterval(carTimer);
          carTimer = null;
        }
        View.renderBoard(map, frames[index], selected, car);
        updateControls();
      }, 270);
    }
    render();
  }

  function formatLog(frame) {
    return (frame.round ? '[第 ' + frame.round + ' 轮] ' : '[初始化] ') + frame.title + ' · ' + frame.message;
  }

  function renderLog() {
    const key = index + ':' + logFloor;
    if (key === logKey) return;
    logKey = key;
    const first = Math.max(logFloor, index - 119);
    const lines = frames.slice(first, index + 1).map(frame => make('div', '', formatLog(frame)));
    $('log').replaceChildren(...(lines.length ? lines : [make('p', 'empty', '暂无日志')]));
    $('log').scrollTop = $('log').scrollHeight;
  }

  function updateControls() {
    const done = frames[index].done;
    $('play').disabled = Boolean(done) || searchTimer !== null;
    $('pause').disabled = searchTimer === null;
    for (const id of ['step', 'round', 'finish']) $(id).disabled = Boolean(done);
    $('back').disabled = index === 0;
    $('car').disabled = !frames[index].path.length;
    $('car').textContent = carTimer === null ? '播放小车' : '停止小车';
    $('timeline').max = frames.length - 1;
    $('timeline').value = index;
    $('position').value = index + ' / ' + (frames.length - 1);
    $('run-state').textContent = searchTimer !== null ? '搜索动画播放中' : carTimer !== null ? '小车移动中' :
      done ? (frames[index].path.length ? '寻路成功' : '终点不可达') : index ? '已暂停' : '等待执行';
  }

  function render() {
    const frame = frames[index];
    View.renderBoard(map, frame, selected, car);
    View.showTrace(frame, source);
    View.showNode(map, frame, selected);
    View.showData(map, frame);
    renderLog();
    updateControls();
  }

  function manual(action) {
    haltSearch();
    haltCar();
    action();
    render();
  }

  function selectNode(id) {
    selected = id;
    View.renderBoard(map, frames[index], selected, car);
    View.showNode(map, frames[index], selected);
  }

  function useTool(id) {
    if (tool === 'wall') {
      if (id === map.start || id === map.goal) {
        $('map-hint').textContent = '起点和终点需要保持可通行。';
        selectNode(id);
      } else {
        paint(id, !map.walls.has(id));
      }
    } else if (tool === 'inspect' || map.walls.has(id)) {
      if (tool !== 'inspect') $('map-hint').textContent = '请先擦除这个格子的障碍，再设为端点。';
      selectNode(id);
    } else {
      map[tool] = id;
      selected = id;
      editMap();
    }
  }

  function paint(id, adding) {
    if (id === map.start || id === map.goal || map.walls.has(id) === adding) return;
    if (adding) map.walls.add(id);
    else map.walls.delete(id);
    selected = id;
    $('map-hint').textContent = adding ? '正在添加障碍。要擦除时，从已有障碍开始拖动。' : '正在擦除障碍。要添加时，从空格开始拖动。';
    editMap();
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = make('textarea');
      field.value = text;
      field.style.position = 'fixed';
      field.style.left = '-9999px';
      const focused = document.activeElement;
      document.body.append(field);
      field.select();
      const success = document.execCommand('copy');
      field.remove();
      focused?.focus();
      if (!success) { notify('浏览器未允许复制，可手动选中文本。'); return; }
    }
    notify('已复制');
  }

  function download() {
    const url = URL.createObjectURL(new Blob([source.code], {type: 'text/plain;charset=utf-8'}));
    const a = make('a');
    a.href = url;
    a.download = 'astar.c';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  $('size').onchange = () => {
    const choice = $('size').value;
    $('custom').hidden = choice !== 'custom';
    if (choice !== 'custom') resize(Number(choice), Number(choice));
  };

  function resize(rows, cols) {
    loadMap({rows, cols, start: 0, goal: rows * cols - 1, walls: new Set()});
    $('preset').selectedIndex = -1;
    $('lesson').textContent = '已创建空白地图。可以手工绘制障碍或按密度随机生成。';
  }

  $('apply-size').onclick = () => {
    if (!$('rows').reportValidity() || !$('cols').reportValidity()) return;
    const rows = $('rows').valueAsNumber, cols = $('cols').valueAsNumber;
    if (!Number.isInteger(rows) || !Number.isInteger(cols)) { notify('请输入 1 到 30 之间的整数行列数。'); return; }
    resize(rows, cols);
  };
  $('default').onclick = () => loadPreset('basic');
  $('preset').onchange = () => loadPreset($('preset').value);
  $('clear').onclick = () => { map.walls.clear(); editMap(); };
  $('density').oninput = () => { $('density-value').value = $('density').value + '%'; };
  $('random').onclick = () => {
    map.walls = Astar.randomMap(map.rows, map.cols, Number($('density').value), map.start, map.goal).walls;
    editMap();
  };

  const hints = {inspect: '点击任意格子查看节点详情。', wall: '点击或拖动。以首个格子的状态决定本次画笔是添加还是擦除。',
    start: '点击可通行的格子设置起点。', goal: '点击可通行的格子设置终点。'};
  const board = $('board');
  board.classList.add('paint');
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.onclick = () => {
      tool = button.dataset.tool;
      board.classList.toggle('paint', tool === 'wall');
      document.querySelectorAll('[data-tool]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
      $('map-hint').textContent = hints[tool];
    };
  });
  board.onclick = event => {
    const cell = event.target.closest('[data-id]');
    if (cell && (tool !== 'wall' || event.detail === 0)) useTool(Number(cell.dataset.id));
  };
  board.onpointerdown = event => {
    const cell = event.target.closest('[data-id]');
    if (tool !== 'wall' || !cell || event.button !== 0 || drag) return;
    const id = Number(cell.dataset.id);
    if (id === map.start || id === map.goal) { useTool(id); return; }
    drag = {pointer: event.pointerId, adding: !map.walls.has(id)};
    board.setPointerCapture(event.pointerId);
    paint(id, drag.adding);
  };
  board.onpointermove = event => {
    if (drag?.pointer !== event.pointerId) return;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('#board [data-id]');
    if (cell) paint(Number(cell.dataset.id), drag.adding);
  };
  board.onlostpointercapture = () => { drag = null; };
  for (const id of ['coord', 'score', 'parent']) {
    $('show-' + id).onchange = () => board.classList.toggle('hide-' + id, !$('show-' + id).checked);
  }
  $('data').onclick = event => {
    const button = event.target.closest('[data-locate]');
    if (button) {
      const id = Number(button.dataset.locate);
      selectNode(id);
      View.locate(id);
    }
  };
  $('play').onclick = () => { haltCar(); schedule(); render(); };
  $('pause').onclick = () => { haltSearch(); updateControls(); };
  $('step').onclick = () => manual(advance);
  $('back').onclick = () => manual(() => { index = Math.max(0, index - 1); });
  $('round').onclick = () => manual(() => {
    do { advance(); } while (!frames[index].done && frames[index].mark !== 'round');
  });
  $('finish').onclick = () => manual(() => { while (!frames[index].done) advance(); });
  $('reset').onclick = resetSearch;
  $('car').onclick = carRun;
  $('speed').oninput = () => {
    $('speed-value').value = $('speed').value + ' / 10';
    if (searchTimer !== null) { haltSearch(); schedule(); }
  };
  $('timeline').oninput = () => manual(() => { index = Number($('timeline').value); });
  $('clear-log').onclick = () => { logFloor = index + 1; renderLog(); };
  $('copy-log').onclick = () => copy(frames.slice(logFloor, index + 1).map(formatLog).join('\n'));
  $('all-logs').onclick = () => {
    $('history-content').textContent = frames.slice(1).map(formatLog).join('\n') || '暂无已执行的步骤。';
    $('history').showModal();
  };
  $('close-history').onclick = () => $('history').close();
  $('copy-code').onclick = () => copy(source.code);
  $('copy-input').onclick = () => copy(source.input);
  $('download').onclick = download;
  $('theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

  let theme = 'dark';
  try { if (localStorage.getItem('astar-theme') === 'light') theme = 'light'; } catch { /* keep default */ }
  setTheme(theme);
  loadPreset('basic');
})();
