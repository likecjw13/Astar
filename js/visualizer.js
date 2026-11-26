'use strict';

(function (root) {
  const {MAX, value, point, coord, get, route} = Astar;
  const $ = id => document.getElementById(id);
  const make = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  let cells = [], codeLines = [], activeLine = -1;

  function buildBoard(map) {
    const board = $('board');
    board.style.setProperty('--cols', map.cols);
    board.style.setProperty('--board-width', 'max(min(100%, ' + (25 + map.cols * 68) +
      'px), ' + (25 + map.cols * 50) + 'px)');
    cells = [];
    const children = document.createDocumentFragment();
    for (let r = -1; r < map.rows; r++) {
      for (let c = -1; c < map.cols; c++) {
        if (r === -1 || c === -1) {
          children.append(make('span', 'axis', r === -1 && c === -1 ? '' : Math.max(r, c)));
          continue;
        }
        const id = r * map.cols + c;
        const cell = make('button', 'cell');
        cell.type = 'button';
        cell.dataset.id = id;
        const coordinate = make('span', 'coordinate', coord(id, map.cols));
        const scores = make('span', 'scores');
        const endpoint = make('b', 'endpoint');
        const arrow = make('b', 'arrow');
        cell.append(coordinate, scores, endpoint, arrow);
        children.append(cell);
        cells.push({cell, scores, endpoint, arrow});
      }
    }
    board.replaceChildren(children);
  }

  function locate(id) {
    const {cell} = cells[id];
    cell.scrollIntoView({block: 'center', inline: 'nearest'});
    cell.focus({preventScroll: true});
  }

  function state(map, frame, id, node) {
    if (map.walls.has(id)) return '障碍物';
    const labels = [];
    if (id === map.start) labels.push('起点');
    if (id === map.goal) labels.push('终点');
    if (frame.path.includes(id)) labels.push('最短路径');
    if (id === frame.current) labels.push('当前节点');
    if (id === frame.neighbor) labels.push('当前相邻格');
    if (node.opened) labels.push('Open');
    else if (node.closed) labels.push('Closed');
    else if (!labels.length) labels.push('未发现');
    return labels.join(' · ');
  }

  function renderBoard(map, frame, selected, car) {
    const path = new Set(frame.path);
    cells.forEach(({cell, scores, endpoint, arrow}, id) => {
      const node = get(frame.board, id, map.cols);
      let color = '';
      if (map.walls.has(id)) color = 'wall';
      else if (id === map.start || id === map.goal) {
        color = [id === map.start ? 'start' : '', id === map.goal ? 'goal' : ''].join(' ');
      } else if (path.has(id)) color = 'path';
      else if (id === frame.current) color = 'current';
      else if (node.opened) color = 'open';
      else if (node.closed) color = 'closed';
      const cls = ['cell', color, selected === id ? 'selected' : '',
        id === frame.neighbor ? 'neighbor' : '', car === id ? 'car' : ''].join(' ');
      const name = coord(id, map.cols) + ' ' + state(map, frame, id, node) +
        '，g = ' + value(node.g) + '，h = ' + node.h + '，f = ' + value(node.f) +
        '，父节点 ' + coord(node.parent, map.cols);
      const summary = node.g === MAX ? 'g∞ h0 f∞' : 'g' + node.g + ' h' + node.h + ' f' + node.f;
      const marker = id === map.start && id === map.goal ? '起终' : id === map.start ? '起' : id === map.goal ? '终' : '';
      const direction = node.parent < 0 ? '' : node.parent === id - map.cols ? '↑' :
        node.parent === id + map.cols ? '↓' : node.parent < id ? '←' : '→';
      if (cell.className !== cls) cell.className = cls;
      if (cell.title !== name) {
        cell.title = name;
        cell.setAttribute('aria-label', name);
      }
      if (scores.textContent !== summary) scores.textContent = summary;
      if (endpoint.textContent !== marker) endpoint.textContent = marker;
      if (arrow.textContent !== direction) arrow.textContent = direction;
    });
  }

  function buildCode(source) {
    const tokens = /"(?:\\.|[^"\\])*"|#\w+|\b(?:int|char|void|const|typedef|struct|static|return|for|if|while|continue|sizeof|INT_MAX|EOF)\b|\b\d+\b/g;
    codeLines = source.code.trimEnd().split('\n').map((line, i) => {
      const div = make('div', 'code-line');
      const number = make('span', 'line-no', i + 1);
      number.setAttribute('aria-hidden', 'true');
      const code = make('code');
      let end = 0;
      for (const match of line.matchAll(tokens)) {
        code.append(document.createTextNode(line.slice(end, match.index)));
        const word = match[0];
        code.append(make('span', word[0] === '"' ? 'str' : /^\d/.test(word) ? 'num' : 'kw', word));
        end = match.index + word.length;
      }
      code.append(document.createTextNode(line.slice(end)));
      div.append(number, code);
      return div;
    });
    $('code').replaceChildren(...codeLines);
    activeLine = -1;
  }

  function showTrace(frame, source) {
    const line = source.marks[frame.mark];
    if (line !== activeLine) {
      codeLines[activeLine]?.classList.remove('active');
      const element = codeLines[line];
      element.classList.add('active');
      const box = $('code');
      box.scrollTop += element.getBoundingClientRect().top - box.getBoundingClientRect().top -
        (box.clientHeight - element.offsetHeight) / 2;
      box.scrollLeft = 0;
      activeLine = line;
    }
    $('statement').textContent = frame.title;
    $('explain').textContent = frame.message;
  }

  function showNode(map, frame, id) {
    const n = get(frame.board, id, map.cols);
    const [x, y] = point(id, map.cols);
    const [ex, ey] = point(map.goal, map.cols);
    const [px, py] = n.parent < 0 ? [-1, -1] : point(n.parent, map.cols);
    $('node-status').textContent = state(map, frame, id, n);
    const values = [
      '.x = ' + x + ', .y = ' + y,
      '.g = ' + value(n.g) + ', .h = ' + n.h + ', .f = ' + value(n.f),
      '.parentx = ' + px + ', .parenty = ' + py,
      '.opened = ' + n.opened + ', .closed = ' + n.closed
    ];
    $('node-struct').textContent = 'nodes[' + x + '][' + y + '] = {\n  ' + values.join(',\n  ') + '\n};';
    const estimate = Math.abs(x - ex) + Math.abs(y - ey);
    const details = [
      ['g / h / f', '起点到此的已知代价 / 到终点的估算 / 两者之和。'],
      ['曼哈顿距离', '|' + x + '−' + ex + '| + |' + y + '−' + ey + '| = ' + estimate + (n.g === MAX ? '。此节点尚未发现，h 字段仍为 0。' : '')],
      ['父节点与已知路线', coord(n.parent, map.cols) + ' · ' + (route(frame.board, id, map.cols).map(cell => coord(cell, map.cols)).join(' → ') || '暂无路线')],
      ['扩展资格', n.opened ? (frame.done ? '仍在 Open，搜索已结束。' : '在 Open 中，按 f 和行列顺序参与选择。') : '当前不在 Open 中。']
    ];
    $('node-info').replaceChildren(...details.flatMap(([key, text]) => [make('dt', '', key), make('dd', '', text)]));
  }

  function table(target, items, cols, open) {
    if (!items.length) {
      $(target).replaceChildren(make('p', 'empty', '集合为空'));
      return;
    }
    const table = make('table');
    const header = table.createTHead().insertRow();
    const headings = open ? ['坐标', 'g', 'h', 'f', '父节点', '状态'] : ['顺序', '坐标', 'g', 'h', 'f', '父节点', '状态'];
    for (const name of headings) header.append(make('th', '', name));
    const body = table.createTBody();
    items.forEach(({id, n}, i) => {
      const row = body.insertRow();
      if (open && i === 0) row.className = 'next';
      if (!open) row.insertCell().textContent = n.order;
      const button = make('button', '', coord(id, cols));
      button.type = 'button';
      button.dataset.locate = id;
      row.insertCell().append(button);
      for (const value of [n.g, n.h, n.f, coord(n.parent, cols), open ? (i === 0 ? '队首' : '待搜索') : '已扩展']) {
        row.insertCell().textContent = value;
      }
    });
    $(target).replaceChildren(table);
  }

  function showData(map, frame) {
    const open = [], closed = [];
    frame.board.forEach((row, x) => row.forEach((n, y) => {
      const id = x * map.cols + y;
      if (n.opened) open.push({id, n});
      if (n.closed) closed.push({id, n});
    }));
    open.sort((a, b) => a.n.f - b.n.f || a.id - b.id);
    closed.sort((a, b) => a.n.order - b.n.order);
    $('open-count').textContent = open.length;
    $('closed-count').textContent = closed.length;
    table('open', open, map.cols, true);
    table('closed', closed, map.cols, false);
    const s = frame.stats;
    const metrics = [
      ['搜索轮数', frame.round], ['Open', s.open], ['Closed', s.closed], ['已发现', s.discovered],
      ['节点更新', s.updates], ['重复发现', s.repeated], ['更短路径更新', s.improved],
      ['障碍物', map.walls.size], ['最短路径', frame.path.length ? frame.path.length - 1 + ' 步' : '—'],
      ['计算耗时', frame.work.toFixed(2) + ' ms']
    ];
    $('metrics').replaceChildren(...metrics.map(([label, val]) => {
      const div = make('div', 'metric');
      div.append(make('span', '', label), make('strong', '', val));
      return div;
    }));
  }

  root.View = {$, make, buildBoard, locate, renderBoard, buildCode, showTrace, showNode, showData};
})(globalThis);
