export interface Point {
    x: number;
    y: number;
}

export default class Vector {
    static sum(a: Point, b: Point): Point {
        return { x: a.x + b.x, y: a.y + b.y };
    }

    static diff(a: Point, b: Point): Point {
        return { x: a.x - b.x, y: a.y - b.y };
    }

    static equal(a: Point, b: Point): boolean {
        return Vector.len(Vector.diff(a, b)) == 0;
    }

    static floor(a: Point): Point {
        return { x: Math.floor(a.x), y: Math.floor(a.y) };
    }

    static neg(a: Point): Point {
        return { x: -a.x, y: -a.y };
    }

    static len(a: Point): number {
        return Math.sqrt(a.x * a.x + a.y * a.y);
    }

    static norm(a: Point): Point {
        let len = Vector.len(a);
        if (len == 0) {
            len = 0.001;
        }
        return { x: a.x / len, y: a.y / len };
    }

    static perp(a: Point): Point {
        return { x: -a.y, y: a.x };
    }

    static scale(a: Point, s: number): Point {
        return { x: a.x * s, y: a.y * s };
    }

    static dot(a: Point, b: Point): number {
        return a.x * b.x + a.y * b.y;
    }

    static mid(a: Point, b: Point): Point {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    static lineIntersect(v1: Point, v2: Point, v3: Point, v4: Point): Point | null {
        const seg1 = Vector.diff(v2, v1);
        const seg2 = Vector.diff(v4, v3);
        const seg3 = Vector.diff(v1, v3);
        const denom = seg2.y * seg1.x - seg2.x * seg1.y;
        const numera = seg2.x * seg3.y - seg2.y * seg3.x;
        const numerb = seg1.x * seg3.y - seg1.y * seg3.x;
        if (denom == 0) {
            return null;
        }
        const mua = numera / denom;
        const mub = numerb / denom;
        if (mua < 0 || mua > 1 || mub < 0 || mub > 1) {
            return null;
        }
        return { x: v1.x + mua * seg1.x, y: v1.y + mua * seg1.y };
    }
}
