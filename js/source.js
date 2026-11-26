'use strict';

(function (root) {
  const template = String.raw`#include <stdio.h>
#include <stdlib.h>
#include <limits.h>
#include <string.h>

#define ROW 5
#define COL 5
int map[ROW][COL] = {
    {0, 0, 1, 0, 0},
    {0, 0, 1, 0, 0},
    {0, 0, 1, 0, 0},
    {0, 0, 1, 0, 0},
    {0, 0, 0, 0, 0}
};

typedef struct {
    int x, y;
    int g, h, f;
    int parentx, parenty;
    int opened, closed;
} Node;

Node nodes[ROW][COL];
const int dx[4] = {-1, 1, 0, 0};
const int dy[4] = {0, 0, -1, 1};
static int trace;

void initNodes(void) {
    for (int i = 0; i < ROW; ++i) {
        for (int j = 0; j < COL; ++j) {
            nodes[i][j] = (Node){i, j, INT_MAX, 0, INT_MAX, -1, -1, 0, 0};
        }
    }
}

int heuristic(int x, int y, int ex, int ey) {
    return abs(x - ex) + abs(y - ey);
}

int valid(int x, int y) {
    return x >= 0 && x < ROW && y >= 0 && y < COL && map[x][y] == 0;
}

void printpath(int x, int y) {
    int px = nodes[x][y].parentx, py = nodes[x][y].parenty;
    if (px != -1) {
        printpath(px, py);
        printf(" -> ");
    }
    printf("(%d,%d)", x, y);
}

int Astar(int sx, int sy, int ex, int ey) {
    if (!valid(sx, sy) || !valid(ex, ey)) return 0;
    initNodes(); /* @init */
    nodes[sx][sy].g = 0; /* @start */
    nodes[sx][sy].h = heuristic(sx, sy, ex, ey);
    nodes[sx][sy].f = nodes[sx][sy].g + nodes[sx][sy].h;
    nodes[sx][sy].opened = 1;
    while (1) { /* @loop */
        int x = -1, y = -1, minf = INT_MAX;
        for (int i = 0; i < ROW; ++i) {
            for (int j = 0; j < COL; ++j) {
                if (nodes[i][j].opened && nodes[i][j].f < minf) { /* @select */
                    x = i;
                    y = j;
                    minf = nodes[i][j].f;
                }
            }
        }
        if (x == -1) return 0; /* @empty */
        if (trace) printf("S %d %d %d\n", x, y, minf);
        if (x == ex && y == ey) { /* @goal */
            printpath(x, y); /* @path */
            printf("\nLength: %d\n", nodes[x][y].g);
            return 1;
        }
        nodes[x][y].opened = 0; /* @close */
        nodes[x][y].closed = 1;
        for (int d = 0; d < 4; ++d) { /* @direction */
            int nx = x + dx[d], ny = y + dy[d];
            if (!valid(nx, ny)) continue; /* @valid */
            if (nodes[nx][ny].closed) continue; /* @closed */
            int newg = nodes[x][y].g + 1; /* @newg */
            if (trace) printf("G %d %d %d %d %d %d\n",
                              x, y, nx, ny, nodes[nx][ny].g, newg);
            if (newg < nodes[nx][ny].g) { /* @compare */
                nodes[nx][ny].g = newg; /* @update */
                nodes[nx][ny].h = heuristic(nx, ny, ex, ey);
                nodes[nx][ny].f = newg + nodes[nx][ny].h;
                nodes[nx][ny].parentx = x;
                nodes[nx][ny].parenty = y;
                nodes[nx][ny].opened = 1;
            }
        } /* @round */
    }
}

int main(int argc, char **argv) {
    int sx = 0, sy = 0, ex = 4, ey = 4;
    trace = argc > 1 && strcmp(argv[1], "--trace") == 0;
    int count = scanf("%d%d%d%d", &sx, &sy, &ex, &ey);
    if (count != EOF) {
        if (count != 4) return 2;
        for (int i = 0; i < ROW; ++i)
            for (int j = 0; j < COL; ++j)
                if (scanf("%d", &map[i][j]) != 1 ||
                    (map[i][j] != 0 && map[i][j] != 1)) return 2;
    }
    if (!Astar(sx, sy, ex, ey)) puts("No path");
    return 0;
}
`;

  function generate(map) {
    const point = id => [Math.floor(id / map.cols), id % map.cols];
    const matrix = Array.from({length: map.rows}, (_, x) =>
      Array.from({length: map.cols}, (_, y) => Number(map.walls.has(x * map.cols + y))));
    const dimensions = template.replace('#define ROW 5', '#define ROW ' + map.rows)
      .replace('#define COL 5', '#define COL ' + map.cols)
      .replace(/int map\[ROW\]\[COL\] = \{[\s\S]*?\n\};/,
        'int map[ROW][COL] = {\n' + matrix.map(row => '    {' + row.join(', ') + '}').join(',\n') + '\n};')
      .replace('int sx = 0, sy = 0, ex = 4, ey = 4;',
        'int sx = ' + point(map.start)[0] + ', sy = ' + point(map.start)[1] +
        ', ex = ' + point(map.goal)[0] + ', ey = ' + point(map.goal)[1] + ';');
    const marks = {};
    const lines = dimensions.split('\n').map((line, index) => line.replace(/ \/\* @(\w+) \*\//, (_, mark) => {
      marks[mark] = index;
      return '';
    }));
    return {code: lines.join('\n'), marks, input: [
      [...point(map.start), ...point(map.goal)].join(' '), ...matrix.map(row => row.join(' '))
    ].join('\n') + '\n'};
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = generate;
  else root.CSource = generate;
})(globalThis);
