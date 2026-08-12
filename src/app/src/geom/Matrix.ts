import type { Point } from './Vector';

interface MatrixLike {
    a: number; b: number; c: number; d: number; e: number; f: number;
}

export default class Matrix implements MatrixLike {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;

    identity(): void {
        this.a = 1; this.b = 0; this.c = 0;
        this.d = 1; this.e = 0; this.f = 0;
    }

    setMatrix(mtx: MatrixLike): void {
        this.a = mtx.a; this.b = mtx.b; this.c = mtx.c;
        this.d = mtx.d; this.e = mtx.e; this.f = mtx.f;
    }

    isIdentity(): boolean {
        return this.a == 1 && this.b == 0 && this.c == 0
            && this.d == 1 && this.e == 0 && this.f == 0;
    }

    rotate(angleDeg: number): void {
        const cos = Math.cos(angleDeg * Math.PI / 180);
        const sin = Math.sin(angleDeg * Math.PI / 180);
        this.a = cos; this.b = sin;
        this.c = -sin; this.d = cos;
    }

    scale(scalex: number, scaley?: number): void {
        this.a = scalex;
        this.d = scaley ? scaley : scalex;
    }

    translate(dx: number, dy: number): void {
        this.e = dx;
        this.f = dy;
    }

    transformPoint(pt: Point): Point {
        return {
            x: this.a * pt.x + this.c * pt.y + this.e,
            y: this.b * pt.x + this.d * pt.y + this.f,
        };
    }

    multiply(m2: Matrix): Matrix {
        const zero = 1e-14;
        const m = new Matrix();
        m.a = this.a * m2.a + this.c * m2.b;
        m.b = this.b * m2.a + this.d * m2.b;
        m.c = this.a * m2.c + this.c * m2.d;
        m.d = this.b * m2.c + this.d * m2.d;
        m.e = this.a * m2.e + this.c * m2.f + this.e;
        m.f = this.b * m2.e + this.d * m2.f + this.f;
        if (Math.abs(m.a) < zero) m.a = 0;
        if (Math.abs(m.b) < zero) m.b = 0;
        if (Math.abs(m.c) < zero) m.c = 0;
        if (Math.abs(m.d) < zero) m.d = 0;
        if (Math.abs(m.e) < zero) m.e = 0;
        if (Math.abs(m.f) < zero) m.f = 0;
        return m;
    }
}
