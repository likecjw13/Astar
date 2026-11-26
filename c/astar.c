#include <stdio.h>
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
    initNodes();
    nodes[sx][sy].g = 0;
    nodes[sx][sy].h = heuristic(sx, sy, ex, ey);
    nodes[sx][sy].f = nodes[sx][sy].g + nodes[sx][sy].h;
    nodes[sx][sy].opened = 1;
    while (1) {
        int x = -1, y = -1, minf = INT_MAX;
        for (int i = 0; i < ROW; ++i) {
            for (int j = 0; j < COL; ++j) {
                if (nodes[i][j].opened && nodes[i][j].f < minf) {
                    x = i;
                    y = j;
                    minf = nodes[i][j].f;
                }
            }
        }
        if (x == -1) return 0;
        if (trace) printf("S %d %d %d\n", x, y, minf);
        if (x == ex && y == ey) {
            printpath(x, y);
            printf("\nLength: %d\n", nodes[x][y].g);
            return 1;
        }
        nodes[x][y].opened = 0;
        nodes[x][y].closed = 1;
        for (int d = 0; d < 4; ++d) {
            int nx = x + dx[d], ny = y + dy[d];
            if (!valid(nx, ny)) continue;
            if (nodes[nx][ny].closed) continue;
            int newg = nodes[x][y].g + 1;
            if (trace) printf("G %d %d %d %d %d %d\n",
                              x, y, nx, ny, nodes[nx][ny].g, newg);
            if (newg < nodes[nx][ny].g) {
                nodes[nx][ny].g = newg;
                nodes[nx][ny].h = heuristic(nx, ny, ex, ey);
                nodes[nx][ny].f = newg + nodes[nx][ny].h;
                nodes[nx][ny].parentx = x;
                nodes[nx][ny].parenty = y;
                nodes[nx][ny].opened = 1;
            }
        }
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
