import * as fs from "fs";

let rand_float = () => Math.random() * 4 - 2;

class PercentageReporter {
    private reporetedValue: number = 0;
    public report(value: number) {
        let integerValue = Math.round(value * 100);
        if (integerValue > this.reporetedValue) {
            console.log("Progress: " + integerValue + "%");
            this.reporetedValue = integerValue;
            return true;
        } else {
            return false;
        }
    }
}

class PointWriter {
    private buffer: Buffer;
    private current: number;
    private count: number;

    constructor(maxCount: number) {
        this.buffer = new Buffer(4 * maxCount * 4);
        this.current = 0;
        this.count = 0;
    }

    public isFull() {
        return this.current >= this.buffer.length;
    }

    public size() {
        return this.count;
    }

    public write(p: Point, z0: Point) {
        if(this.isFull()) return;
        this.buffer.writeFloatLE(p[0], this.current);
        this.current += 4;
        this.buffer.writeFloatLE(p[1], this.current);
        this.current += 4;
        this.buffer.writeFloatLE(z0[0], this.current);
        this.current += 4;
        this.buffer.writeFloatLE(z0[1], this.current);
        this.current += 4;
        this.count += 1;
    }

    public save(filename: string) {
        fs.writeFileSync(filename, this.buffer.slice(0, this.current));
    }
}

type Point = [number, number];

class Generator {
    private cx: number;
    private cy: number;
    private zx: number;
    private zy: number;

    constructor(c: Point) {
        this.cx = c[0];
        this.cy = c[1];
        this.zx = 0;
        this.zy = 0;
    }

    public next(): Point {
        let zx = this.zx;
        let zy = this.zy;
        let z1x = zx * zx - zy * zy + this.cx;
        let z1y = 2 * zx * zy + this.cy;
        this.zx = z1x;
        this.zy = z1y;
        let len2 = z1x * z1x + z1y * z1y;
        if (len2 > 4) {
            return null;
        } else {
            return [z1x, z1y];
        }
    }
}

class CycleDetector {
    private points = new Map<string, number>();
    private index: number = 0;
    public feed(p: Point): [number, number] {
        let index = this.index;
        this.index += 1;
        let s = JSON.stringify(p);
        if (this.points.has(s)) {
            let p = this.points.get(s);
            return [p, index - p];
        } else {
            this.points.set(s, index);
            return null;
        }
    }
}

function generatePoints() {
    let reporter = new PercentageReporter();

    let points_to_generate = 1000000;
    let max_iterate = 1024;
    let writer = new PointWriter(points_to_generate);



    while (!writer.isFull()) {
        let hasCycle = false;
        let cycleLength = 0;
        let cx = rand_float();
        let cy = rand_float();
        let z0x = 0;
        let z0y = 0;
        let diverged = false;
        let generator = new Generator([cx, cy]);
        let cycle = new CycleDetector();
        for (let i = 0; i < max_iterate; i++) {
            let p = generator.next();
            if (!p) {
                break;
            } else {
                let r = cycle.feed(p);

                if (r != null) {
                    if(r[1] >= 16) {
                        hasCycle = true;
                        cycleLength = r[1];
                        // console.log(r[1]);
                        z0x = p[0];
                        z0y = p[1];
                    }
                    break;
                }
            }
        }

        if (hasCycle) {
            for(let i = 0; i < cycleLength; i += 4) {
                writer.write([cx, cy], [z0x, z0y]);
                for(let j = 0; j < 4; j++) {
                    let p = generator.next();
                    z0x = p[0];
                    z0y = p[1];
                }
            }
            if(reporter.report(writer.size() / points_to_generate)) {
                writer.save("data.bin");
            }
        }
    }

    writer.save("data.bin");
}

generatePoints();