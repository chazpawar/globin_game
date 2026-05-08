export type Sprite = Record<string, string[][]>;

export const sprites: Record<string, Sprite> = {};

async function readText(filePath: string): Promise<string> {
  const response = await fetch(filePath);

  if (!response.ok) {
    throw new Error(`Failed to load asset: ${filePath}`);
  }

  return response.text();
}

export async function readGraphic(filePath: string): Promise<Sprite> {
  const content = await readText(filePath);
  const sprite: Sprite = {};
  const sequences = content.split("@");

  for (let i = 1; i < sequences.length; i += 1) {
    const sequenceName = sequences[i].split("\n", 1)[0];
    sprite[sequenceName] = [];
    const frames = sequences[i].split("&\n");

    for (let j = 0; j < frames.length; j += 1) {
      const frame = frames[j].split("\n");

      if (j === 0) {
        frame.shift();
      }

      frame.pop();
      sprite[sequenceName].push(frame);
    }
  }

  return sprite;
}

export class Canvas {
  name: string;
  camX = 0;
  camY = 0;
  hide: Record<string, string> = {};
  graphics: Graphic[] = [];
  matrix: string[][] = [];
  output = "";
  w = 0;
  h = 0;

  constructor(name: string, w: number, h: number) {
    this.name = name;
    this.build(w, h);
  }

  build(w: number, h: number) {
    this.matrix = [];
    this.w = w;
    this.h = h;

    for (let y = 0; y < h; y += 1) {
      this.matrix.push([]);

      for (let x = 0; x < w; x += 1) {
        this.matrix[y].push(" ");
      }
    }
  }

  clean() {
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        this.matrix[y][x] = " ";
      }
    }
  }

  update() {
    this.clean();

    for (let i = 0; i < this.graphics.length; i += 1) {
      this.graphics[i].setupDisplay();

      loop1: for (let p = 0; p < this.graphics[i].charsPos.length; p += 1) {
        const pos = this.graphics[i].charsPos[p].split(",");
        const row = Number(pos[1]);
        const column = Number(pos[0]);

        if (!this.matrix[row]) continue;
        if (typeof this.matrix[row][column] === "undefined") continue;

        for (const hiddenName in this.hide) {
          if (this.hide[hiddenName].indexOf(` ${column},${row} `) > -1) {
            continue loop1;
          }
        }

        this.matrix[row][column] = this.graphics[i].chars[p];
      }
    }

    let output = "";

    for (let y = 0; y < this.matrix.length; y += 1) {
      output += `${this.matrix[y].toString()}\n`;
    }

    this.output = output.replaceAll(",", "");
  }
}

export class Graphic {
  name: string;
  canvas: Canvas;
  sequences: Sprite;
  sequence: string;
  sequenceIndex = 0;
  charsPos: string[] = [];
  chars: string[] = [];
  x: number;
  y: number;

  constructor(
    name: string,
    canvas: Canvas,
    sequenceGroup: string,
    sequence: string,
    x = 0,
    y = 0,
  ) {
    this.name = name;
    this.canvas = canvas;
    this.canvas.graphics.push(this);
    this.sequences = sprites[sequenceGroup];
    this.sequence = sequence;
    this.x = x;
    this.y = y;
    this.setupDisplay();
  }

  changeSequence(sequence: string) {
    if (this.sequence !== sequence) {
      this.sequence = sequence;
      this.sequenceIndex = 0;
    }
  }

  animate(sequence: string, speed: number) {
    this.sequenceIndex += speed;

    if (
      this.sequence !== sequence ||
      Math.floor(this.sequenceIndex) > this.sequences[this.sequence].length - 1
    ) {
      this.sequence = sequence;
      this.sequenceIndex = 0;
    }
  }

  setupDisplay() {
    const frame =
      this.sequences[this.sequence]?.[Math.floor(this.sequenceIndex)];
    this.chars = [];
    this.charsPos = [];

    if (!frame) {
      return;
    }

    for (let line = 0; line < frame.length; line += 1) {
      for (let charIndex = 0; charIndex < frame[line].length; charIndex += 1) {
        if (frame[line][charIndex] === "░") continue;

        this.charsPos.push(
          `${parseInt(String(charIndex + this.x + this.canvas.camX), 10)},${parseInt(String(line + this.y + this.canvas.camY), 10)}`,
        );
        this.chars.push(frame[line][charIndex]);
      }
    }
  }

  collide(canvas: Canvas, dirX: number, dirY: number) {
    for (let i = 0; i < canvas.graphics.length; i += 1) {
      if (canvas.graphics[i].name === this.name) continue;
      if (this.collideWith(canvas.graphics[i], dirX, dirY)) return true;
    }

    return false;
  }

  getCharPos(character: string, sequence: string, frame: number) {
    const positions: Array<[number, number]> = [];

    for (let y = 0; y < this.sequences[sequence][frame].length; y += 1) {
      const text = this.sequences[sequence][frame][y];
      let index = -1;

      index = text.indexOf(character, index + 1);

      while (index >= 0) {
        positions.push([index, y]);
        index = text.indexOf(character, index + 1);
      }
    }

    return positions.length ? positions : false;
  }

  collideWith(graphic: Graphic, dirX: number, dirY: number) {
    const map = ` ${graphic.charsPos.join(" ")} `;

    for (let p = 0; p < this.charsPos.length; p += 1) {
      const pos = this.charsPos[p].split(",");
      const charPos = `${dirX > 0 ? Math.ceil(Number(pos[0]) + dirX) : Math.floor(Number(pos[0]) + dirX)},${dirY > 0 ? Math.ceil(Number(pos[1]) + dirY) : Math.floor(Number(pos[1]) + dirY)}`;

      if (map.indexOf(` ${charPos} `) > -1) {
        return true;
      }
    }

    return false;
  }

  hide(canvas: Canvas) {
    canvas.hide[this.name] = ` ${this.charsPos.join(" ")} `;
  }
}
