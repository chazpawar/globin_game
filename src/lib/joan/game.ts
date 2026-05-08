import {
  addCollectedCoins,
  authenticateWithConvex,
  isConvexConfigured,
  readStoredSession,
  saveSession,
} from "@/lib/convex/auth";
import {
  Canvas,
  Graphic,
  readGraphic,
  type Sprite,
  sprites,
} from "@/lib/joan/pterodactyl";

type Behaviour = ((element: GameElement) => void) | false | undefined;
type KeyState = Record<string, boolean>;
type NameEntryField = "password" | "username";

const NAME_PROMPT_WIDTH = 33;
const NAME_PROMPT_Y = 1;
const PRIVATE_KEY =
  "oJkJmYxjkC59FBaiHa5JMz8ruxK8CZ8S1MED5Z1B8SXzdfWpRfKwEDMbY26JeYwUWYiAsTNmYogjZvvbzhpHksX";
const PRIVATE_KEY_LINE_WIDTH = 24;
const PRIVATE_KEY_LINE_COUNT = 5;

function cloneSprite(sprite: Sprite): Sprite {
  return JSON.parse(JSON.stringify(sprite)) as Sprite;
}

function fitText(text: string, width: number) {
  return text.length > width
    ? text.substring(0, width)
    : text.padEnd(width, " ");
}

function frameLine(text: string, width: number) {
  return `|${fitText(text, width)}|`;
}

function shuffleArray<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

function getRequiredElement<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }

  return element as T;
}

class GameElement {
  graphic: Graphic;
  speed: number;
  behaviour: Behaviour;
  xVelocity = 1;
  yVelocity = 1;
  jumping = false;
  double_jumping = false;
  dashing = false;
  jumpCapacity: number;
  maxRunSpeed: number;
  jumpTime: number;
  jumpTimeCounter = 0;
  dirX = 0;
  dirY = 0;
  coins = 0;
  cups = 0;
  swords = 0;
  wands = 0;
  cant_behave = false;
  freezed = false;
  talking = false;
  fall_quantity = 0;
  double_jump = false;

  constructor(
    graphic: Graphic,
    speed: number,
    behaviour: Behaviour,
    jumpCapacity?: number,
    maxRunSpeed?: number,
    collectible?: boolean,
  ) {
    this.graphic = graphic;
    this.speed = speed;
    this.behaviour = behaviour;
    this.jumpCapacity = jumpCapacity || 7;
    this.maxRunSpeed = maxRunSpeed || 3;
    this.jumpTime = this.jumpCapacity;

    if (collectible) {
      this.bootCollectibles();
    }

    this.bootTechnicals();
  }

  bootCollectibles(): boolean | undefined {
    return undefined;
  }

  bootTechnicals(): boolean | undefined {
    return undefined;
  }

  move(dirX: number, dirY: number, sequence?: string, speed?: number) {
    if (sequence) {
      if (this.dashing) {
        this.graphic.animate(sequence, this.speed);
      } else {
        this.graphic.animate(
          sequence,
          speed && speed < 0.3 ? speed : (speed || 0) / 6 + 0.25,
        );
      }
    }

    this.graphic.x += dirX;
    this.graphic.y += dirY;
  }

  collide(dirX: number, dirY: number, ground: Canvas) {
    return this.graphic.collide(ground, dirX, dirY);
  }
}

export function mountJoanJump() {
  const wrapper = getRequiredElement<HTMLDivElement>("wrapper");
  const leaderboardLink = document.getElementById("leaderbord-link");
  const homeLink = document.getElementById("home-link");
  const music = getRequiredElement<HTMLAudioElement>("music");
  const decorNode = getRequiredElement<HTMLPreElement>("decor");
  const groundNode = getRequiredElement<HTMLPreElement>("ground");
  const entitiesNode = getRequiredElement<HTMLPreElement>("entities");
  const infosNode = getRequiredElement<HTMLPreElement>("infos");
  const urlParams =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search);
  const autoLogin = urlParams?.get("login") === "1";

  const setLeaderboardLinkVisible = (visible: boolean) => {
    if (!leaderboardLink) {
      return;
    }

    leaderboardLink.style.display = visible ? "inline-flex" : "none";
  };

  const setHomeLinkVisible = (visible: boolean) => {
    if (!homeLink) {
      return;
    }

    homeLink.style.display = visible ? "inline-flex" : "none";
  };

  const showLoginPrompt = () => {
    // Level 0 contains the username/password prompt.
    nameEntryActive = true;
    setLeaderboardLinkVisible(true);
    setHomeLinkVisible(false);
    rebootLevel(0);
  };

  let noSfx = false;
  let playerName = "Joan";
  let typedKeys: string[] = [];
  let nameEntryActive = false;
  let selectNameEntryField: ((field: NameEntryField) => void) | null = null;
  const spriteTemplates: Record<string, Sprite> = {};
  const playerNameLimit = 12;
  const passwordInputLimit = 24;
  const collectibles: Array<[string, keyof GameElement & string]> = [
    ["♠", "swords"],
    ["♣", "wands"],
    ["♥", "cups"],
    ["♦", "coins"],
  ];
  const technicals: Array<[string, string]> = [["☻", "end"]];

  let pause = false;
  let gameSpeed = 25;
  let stop = false;
  let currentLevel = 0;
  let dialog: number | false = false;
  let time = Number.POSITIVE_INFINITY;
  const wantedFramerate = 40;
  let card = false;
  let win = false;
  let t0 = 0;
  let t1 = 0;
  let w = 0;
  let h = 0;
  let setupDone = false;
  let setupStarting = false;
  const setupStartTime = Date.now();
  let startDelay = 0;
  let level = 0;

  let ground!: Canvas;
  let entities!: Canvas;
  let decor!: Canvas;
  let infos!: Canvas;
  let player!: GameElement;
  const elements: GameElement[] = [];
  const keys: KeyState = {};
  const keysUp: KeyState = {};
  const commonKeys: KeyState = {};
  let currentSession = readStoredSession();
  let _totalCoinsCollected = currentSession?.totalCoinsCollected ?? 0;

  function syncCollectedCoins(amount = 1) {
    const sessionToken = currentSession?.sessionToken;

    _totalCoinsCollected += amount;

    if (!sessionToken || !isConvexConfigured()) {
      return;
    }

    void addCollectedCoins(sessionToken, amount)
      .then((result) => {
        _totalCoinsCollected = result.totalCoinsCollected;

        if (currentSession) {
          currentSession = {
            ...currentSession,
            totalCoinsCollected: result.totalCoinsCollected,
          };
          saveSession(currentSession);
        }
      })
      .catch(() => {});
  }

  function safePlay(audio: HTMLAudioElement) {
    const result = audio.play();

    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  }

  function sfx(name: string) {
    if (noSfx) return;

    const sound = document.createElement("audio");

    if (name === "death" || name === "start" || name === "item") {
      noSfx = true;
      music.volume = 0;
      window.setTimeout(() => {
        noSfx = false;
        music.volume = 1;
      }, 2000);
    }

    sound.src = `/sound/${name}.ogg`;
    document.body.appendChild(sound);
    safePlay(sound);
    sound.onended = () => {
      sound.remove();
    };
  }

  function setMood(
    bgColor: string,
    groundColor: string,
    entitiesColor: string,
    decorColor: string,
    musicSource: string,
  ) {
    wrapper.style.backgroundColor = bgColor;
    groundNode.style.color = groundColor;
    entitiesNode.style.color = entitiesColor;
    infosNode.style.color = entitiesColor;
    decorNode.style.color = decorColor;

    if (!music.src.includes(`/sound/${musicSource}.ogg`)) {
      music.pause();
      music.src = `/sound/${musicSource}.ogg`;
      safePlay(music);
    }
  }

  function updateNamePrompt(
    username: string,
    password: string,
    activeField: NameEntryField,
  ) {
    const width = 31;
    let displayName = username || "";
    const maskedPassword = password ? "*".repeat(password.length) : "_";

    if (!displayName) {
      displayName = "_";
    }

    sprites.log.name_prompt = [
      [
        ".-------------------------------.",

        frameLine(
          `${activeField === "username" ? ">" : " "} username: ${displayName}`,
          width,
        ),
        frameLine(
          `${activeField === "password" ? ">" : " "} password: ${maskedPassword}`,
          width,
        ),
        "`-------------------------------'",
      ],
    ];
  }

  function personalizeSprite(
    spriteName: string,
    replacements: Array<[string, string]>,
  ) {
    if (!spriteTemplates[spriteName]) return;

    sprites[spriteName] = cloneSprite(spriteTemplates[spriteName]);

    for (const sequence in sprites[spriteName]) {
      for (
        let frame = 0;
        frame < sprites[spriteName][sequence].length;
        frame += 1
      ) {
        sprites[spriteName][sequence][frame] = sprites[spriteName][sequence][
          frame
        ].map((line) => {
          let updated = line;

          for (let i = 0; i < replacements.length; i += 1) {
            updated = updated.replaceAll(
              replacements[i][0],
              replacements[i][1],
            );
          }

          if (updated === line) {
            return line;
          }

          return updated.length > line.length
            ? updated.substring(0, line.length)
            : updated.padEnd(line.length, " ");
        });
      }
    }
  }

  function getNamePromptX() {
    return Math.round(w / 2 - 16);
  }

  function personalizeGameText(name: string) {
    let safeName = name ? name.trim() : "";

    if (!safeName) {
      safeName = "Joan";
    }

    playerName = safeName.substring(0, playerNameLimit);
    personalizeSprite("intro", [
      ["Joan:", `${playerName}:`],
      ["Joan", playerName],
    ]);
    personalizeSprite("country", [
      ["Joan:", `${playerName}:`],
      ["Joan", playerName],
    ]);
    personalizeSprite("title", [
      ["PRESS░ENTER░TO░START", "░░░░░░░░░░░░░░░░░░░░"],
    ]);
  }

  function erase(element: GameElement) {
    let index = element.graphic.canvas.graphics.indexOf(element.graphic);

    if (index > -1) {
      element.graphic.canvas.graphics.splice(index, 1);
    }

    index = elements.indexOf(element);

    if (index > -1) {
      elements.splice(index, 1);
    }
  }

  function log(str: string, where: string, replace = false) {
    if (replace) {
      sprites.log[where][0][0] = str;
    } else {
      sprites.log[where][0].push(str);
    }

    infos.update();
    infosNode.innerText = infos.output;
  }

  function getPrivateKeyRevealLines() {
    const revealedCharacters = Math.min(
      PRIVATE_KEY.length,
      _totalCoinsCollected,
    );
    const maskedKey =
      PRIVATE_KEY.slice(0, revealedCharacters) +
      "_".repeat(PRIVATE_KEY.length - revealedCharacters);
    const lines: string[] = [];

    for (let i = 0; i < PRIVATE_KEY_LINE_COUNT; i += 1) {
      const start = i * PRIVATE_KEY_LINE_WIDTH;
      const end = start + PRIVATE_KEY_LINE_WIDTH;
      lines.push(maskedKey.slice(start, end));
    }

    return lines;
  }

  function updateRewardLog() {
    const privateKeyLines = getPrivateKeyRevealLines();

    log(`♦ ${player?.coins ?? 0}`, "coins", true);
    log(`TOTAL ♦ ${_totalCoinsCollected}`, "totalCoins", true);
    log("KEY", "keyLabel", true);

    for (let i = 0; i < PRIVATE_KEY_LINE_COUNT; i += 1) {
      log(privateKeyLines[i] ?? "", `key${i + 1}`, true);
    }
  }

  GameElement.prototype.bootCollectibles = function bootCollectibles() {
    if (!this.graphic.sequences.Collectibles) return false;

    for (let i = 0; i < collectibles.length; i += 1) {
      const collectiblePositions = this.graphic.getCharPos(
        collectibles[i][0],
        "Collectibles",
        0,
      );

      if (!collectiblePositions) continue;

      for (let j = 0; j < collectiblePositions.length; j += 1) {
        const item = new GameElement(
          new Graphic(
            collectibles[i][1],
            entities,
            "collectible",
            collectibles[i][0],
            collectiblePositions[j][0] + this.graphic.x,
            collectiblePositions[j][1] + this.graphic.y,
          ),
          0,
          (element) => {
            if (element.graphic.collideWith(player.graphic, 0, 0)) {
              const key = collectibles[i][1];
              (player[key] as number) += 1;
              if (key === "coins") {
                syncCollectedCoins(1);
              }
              sfx("coin");
              erase(element);
            }
          },
        );

        elements.push(item);
      }
    }
  };

  GameElement.prototype.bootTechnicals = function bootTechnicals() {
    if (!this.graphic.sequences.Collectibles) return false;

    for (let i = 0; i < technicals.length; i += 1) {
      const technicalPositions = this.graphic.getCharPos(
        technicals[i][0],
        "Collectibles",
        0,
      );

      if (!technicalPositions) continue;

      for (let j = 0; j < technicalPositions.length; j += 1) {
        const technical = new GameElement(
          new Graphic(
            technicals[i][1],
            entities,
            technicals[i][1] === "end" ? "flag" : "collectible",
            "A",
            technicalPositions[j][0] + this.graphic.x,
            technicalPositions[j][1] + this.graphic.y,
          ),
          0,
          technicals[i][1] === "end"
            ? (element) => {
                if (element.graphic.collideWith(player.graphic, 0, 0)) {
                  if (currentLevel === 1) {
                    level = 2;
                  } else if (currentLevel === 2) {
                    level = 0;
                  }

                  shutdown();
                  bootLevel(level);
                }
              }
            : false,
        );

        elements.push(technical);
      }
    }
  };

  function moving(
    element: GameElement,
    dirX: number,
    dirY: number,
    sequences: string[],
    speed: number,
  ) {
    const sequenceDirY = dirY;
    const sequenceDirX = dirX;

    if (element.collide(dirX, 0, ground)) {
      dirX = 0;
    }

    if (element.collide(0, dirY, ground)) {
      dirY = 0;
    }

    let sequence =
      dirX < 0 && dirY < 0
        ? sequences[0]
        : dirX === 0 && dirY < 0
          ? sequences[1]
          : dirX > 0 && dirY < 0
            ? sequences[2]
            : dirX < 0 && dirY === 0
              ? sequences[3]
              : dirX === 0 && dirY === 0
                ? sequences[4]
                : dirX > 0 && dirY === 0
                  ? sequences[5]
                  : dirX < 0 && dirY > 0
                    ? sequences[6]
                    : dirX === 0 && dirY > 0
                      ? sequences[7]
                      : sequences[8];

    let hardSequence =
      sequenceDirX < 0 && sequenceDirY < 0
        ? sequences[0]
        : sequenceDirX === 0 && sequenceDirY < 0
          ? sequences[1]
          : sequenceDirX > 0 && sequenceDirY < 0
            ? sequences[2]
            : sequenceDirX < 0 && sequenceDirY === 0
              ? sequences[3]
              : sequenceDirX === 0 && sequenceDirY === 0
                ? sequences[4]
                : sequenceDirX > 0 && sequenceDirY === 0
                  ? sequences[5]
                  : sequenceDirX < 0 && sequenceDirY > 0
                    ? sequences[6]
                    : sequenceDirX === 0 && sequenceDirY > 0
                      ? sequences[7]
                      : sequences[8];

    if (dirY >= 1) {
      element.fall_quantity += Math.round(dirY);
      log(`falling for ${element.fall_quantity}`, "initial", true);

      if (element.fall_quantity >= 15) {
        hardSequence = "fall";
        sequence = "fall";
      }
    } else if (element.fall_quantity >= 15 && element.collide(0, 1, ground)) {
      log("hurt by falling", "initial", true);
      element.fall_quantity = 0;
      element.cant_behave = true;
      element.graphic.changeSequence("crush");

      return window.setTimeout(
        () => {
          if (element === player && element.cups <= 0) {
            element.graphic.changeSequence("game_over");
            sfx("death");
            window.setTimeout(() => {
              rebootLevel(currentLevel);
            }, 2000);
          } else {
            element.cant_behave = false;
            element.cups -= 1;
          }
        },
        (gameSpeed + 1) * 30,
      );
    } else {
      element.fall_quantity = 0;
      log("not falling", "initial", true);
    }

    if (element.jumping && !element.dashing) {
      element.graphic.changeSequence(hardSequence);
    } else if (!element.dashing) {
      element.graphic.changeSequence(sequence);
    }

    if (!dirX && !dirY && !element.dashing) {
      return;
    }

    if (element.jumping) {
      element.move(dirX, dirY, hardSequence, speed);
    } else {
      element.move(dirX, dirY, sequence, speed);
    }
  }

  function accelerate(element: GameElement, axis: number, factor: number) {
    if (!axis && !element.jumping) {
      const nextVelocity = element.xVelocity * factor;
      element.xVelocity *=
        nextVelocity < element.maxRunSpeed &&
        nextVelocity > -element.maxRunSpeed
          ? factor
          : 1;
    } else {
      element.yVelocity *= factor;
    }
  }

  function control(element: GameElement, x: number, y: number) {
    element.dirY = y;

    if (element.freezed) return;
    element.dirX = x;
  }

  function stopJump(element: GameElement) {
    element.jumping = false;
    element.jumpTimeCounter = 0;
    element.yVelocity = 1;
    element.jumpTime = element.jumpCapacity;
    element.double_jump = false;
  }

  function jump(element: GameElement) {
    if (!element.jumping) return;

    if (element.jumpTimeCounter < element.jumpTime / 2) {
      element.dirY = -1;
      element.yVelocity /= 1 + 1 / (element.jumpTime / 1.5);
    } else {
      element.dirY = 1;
      element.yVelocity *= 1 + 1 / element.jumpTime;
    }

    element.jumpTimeCounter += 0.5;

    if (
      keys.arrowup &&
      element.jumpTimeCounter < element.jumpTime / 2 &&
      !element.collide(-1, 0, ground) &&
      !element.collide(1, 0, ground)
    ) {
      element.jumpTime += 0.6;
    }

    if (
      element.jumpTimeCounter > element.jumpTime ||
      (element.jumpTimeCounter > element.jumpTime / 2 &&
        element.collide(0, 2, ground)) ||
      (element.collide(0, -1, ground) &&
        element.jumpTimeCounter > element.jumpTime / 2)
    ) {
      stopJump(element);
    }
  }

  function obstruct(element: GameElement) {
    const directions: Array<[number, number]> = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];

    shuffleArray(directions);

    if (element.collide(0, 0, ground)) {
      element.graphic.x = Math.round(element.graphic.x);
      element.graphic.y = Math.round(element.graphic.y);

      for (let i = 0; i < directions.length; i += 1) {
        if (!element.collide(directions[i][0], directions[i][1], ground)) {
          return element.move(directions[i][0], directions[i][1]);
        }
      }

      element.graphic.animate("crush", element.speed);
    }
  }

  function bootLog(silent?: boolean) {
    if (!silent) {
      elements.push(
        new GameElement(
          new Graphic("log", infos, "log", "initial", w - 20, 0),
          0,
          undefined,
        ),
      );
    }

    elements.push(
      new GameElement(
        new Graphic("log", infos, "log", "framerate", 2, 0),
        0,
        undefined,
      ),
    );
    elements.push(
      new GameElement(
        new Graphic("log", infos, "log", "time", 2, 1),
        0,
        undefined,
      ),
    );
    elements.push(
      new GameElement(
        new Graphic("log", infos, "log", "coins", 2, 2),
        0,
        undefined,
      ),
    );
    elements.push(
      new GameElement(
        new Graphic("log", infos, "log", "totalCoins", 2, 3),
        0,
        undefined,
      ),
    );
    elements.push(
      new GameElement(
        new Graphic("log", infos, "log", "keyLabel", 2, 4),
        0,
        undefined,
      ),
    );

    for (let i = 0; i < PRIVATE_KEY_LINE_COUNT; i += 1) {
      elements.push(
        new GameElement(
          new Graphic("log", infos, "log", `key${i + 1}`, 2, 5 + i),
          0,
          undefined,
        ),
      );
    }
  }

  function bootPlayer(x: number, y: number) {
    player = new GameElement(
      new Graphic("player", entities, win ? "dog" : "player", "stand", x, y),
      1 / 3,
      (element) => {
        let xVelocity = element.xVelocity * element.dirX;
        let yVelocity = element.yVelocity * element.dirY;

        control(
          element,
          keys.arrowright &&
            !keys.arrowleft &&
            xVelocity > -1.1 &&
            xVelocity < 1.1
            ? 1
            : keys.arrowleft &&
                !keys.arrowright &&
                xVelocity > -1.1 &&
                xVelocity < 1.1
              ? -1
              : xVelocity > 1
                ? 1
                : xVelocity < -1
                  ? -1
                  : 0,
          1,
        );

        if (
          element.collide(element.speed * xVelocity, 0, ground) ||
          element.freezed
        ) {
          if (element.talking) {
            element.dirX = 0;
            element.dirY = 0;
          }

          element.xVelocity = 1;
          element.yVelocity = 1;
        } else if (element.dashing) {
          yVelocity = 0;
        } else if (
          !keys.shift ||
          (!keys.arrowleft && !keys.arrowright) ||
          (keys.arrowleft && element.dirX > 0) ||
          (keys.arrowright && element.dirX < 0)
        ) {
          accelerate(element, 0, element.xVelocity > 1 ? 0.9 : 1);
        } else {
          accelerate(
            element,
            0,
            (xVelocity > 0 &&
              keys.arrowright &&
              !keys.arrowleft &&
              keys.shift) ||
              (xVelocity < 0 &&
                keys.arrowleft &&
                !keys.arrowright &&
                keys.shift)
              ? 1 + 1 / 20
              : 1,
          );
        }

        if (
          element.collide(0, 1, ground) &&
          !element.dashing &&
          !element.jumping
        ) {
          element.swords = 1;
          element.wands = 1;
        }

        if (
          keys.arrowup &&
          element.collide(0, 1, ground) &&
          !element.collide(0, -1, ground) &&
          element.jumping === false
        ) {
          keysUp.arrowup = false;
          element.jumping = true;
          sfx("jump");
        }

        if (
          (keys.arrowup &&
            element.jumping === true &&
            keysUp.arrowup &&
            element.swords) ||
          (keys.arrowup &&
            element.jumping === false &&
            !element.collide(0, 1, ground) &&
            keysUp.arrowup &&
            element.swords)
        ) {
          keysUp.arrowup = false;
          stopJump(element);
          element.jumping = true;
          element.swords = 0;
          element.double_jump = true;
          sfx("jump");
        }

        if (
          keys[" "] &&
          element.dashing === false &&
          element.wands &&
          element.dirX !== 0
        ) {
          sfx("doge");
          element.dashing = true;
          element.wands = 0;

          if (keys.arrowright && !keys.arrowleft) {
            if (xVelocity < 0) xVelocity *= -1;
            element.dirX = 1;
            element.graphic.changeSequence("dash_right");
          }

          if (keys.arrowleft && !keys.arrowright) {
            if (xVelocity > 0) xVelocity *= -1;
            element.dirX = -1;
            element.graphic.changeSequence("dash_left");
          }
        }

        if (
          element.dashing &&
          element.graphic.sequenceIndex >
            element.graphic.sequences[element.graphic.sequence].length - 1
        ) {
          element.dashing = false;
        }

        moving(
          element,
          element.speed * xVelocity,
          yVelocity,
          [
            "jump_left",
            "jump",
            "jump_right",
            element.dashing
              ? "dash_left"
              : keys.s
                ? "crouch_left"
                : "stand_left",
            keys.s ? "crouch" : "stand",
            element.dashing
              ? "dash_right"
              : keys.s
                ? "crouch_right"
                : "stand_right",
            "jump_left",
            "jump",
            "jump_right",
          ],
          (element.speed / 1.5) *
            (element.xVelocity > 0 ? element.xVelocity : 0),
        );

        if (!element.freezed) {
          jump(element);
        }

        obstruct(element);
        element.graphic.hide(decor);
      },
      8.5,
    );

    elements.push(player);
  }

  const levels: Array<() => void> = [
    function level0() {
      setMood("#00C", "#0FF", "#FFF", "#F8C", "automne");
      elements.push(
        new GameElement(
          new Graphic("ground", ground, "title", "ground", 0, 0),
          0,
          (element) => {
            element.graphic.hide(decor);
          },
          0,
          0,
          true,
        ),
      );

      let enteredName = currentSession?.username ?? "";
      let enteredPassword = "";
      let activeField: NameEntryField = enteredName ? "password" : "username";
      let isSubmitting = false;

      const refreshPrompt = () => {
        updateNamePrompt(enteredName, enteredPassword, activeField);
      };

      selectNameEntryField = (field) => {
        activeField = field;
        refreshPrompt();
      };

      const advanceToGame = (username: string) => {
        nameEntryActive = false;
        selectNameEntryField = null;
        setLeaderboardLinkVisible(false);
        setHomeLinkVisible(true);
        personalizeGameText(username);
        keys.enter = false;
        keysUp.enter = false;
        shutdown();
        bootLevel(win ? currentLevel + 2 : currentLevel + 1);
        typedKeys = [];
      };

      nameEntryActive = true;
      setLeaderboardLinkVisible(true);
      setHomeLinkVisible(false);
      refreshPrompt();
      elements.push(
        new GameElement(
          new Graphic(
            "name_prompt",
            infos,
            "log",
            "name_prompt",
            Math.round(w / 2 - 16),
            1,
          ),
          0,
          (element) => {
            element.graphic.hide(decor);
            element.graphic.hide(ground);
            element.graphic.hide(entities);

            if (isSubmitting) {
              refreshPrompt();
              return;
            }

            while (typedKeys.length) {
              const key = typedKeys.shift();

              if (!key) {
                continue;
              }

              if (key === "Backspace") {
                if (activeField === "username") {
                  enteredName = enteredName.slice(0, -1);
                } else {
                  enteredPassword = enteredPassword.slice(0, -1);
                }
              } else if (key === "Tab") {
                activeField =
                  activeField === "username" ? "password" : "username";
              } else if (key === "Enter") {
                if (!isConvexConfigured()) {
                  continue;
                }

                if (!enteredName.trim()) {
                  activeField = "username";
                  continue;
                }

                if (!enteredPassword) {
                  activeField = "password";
                  continue;
                }

                isSubmitting = true;
                keys.enter = false;
                keysUp.enter = false;
                refreshPrompt();

                void authenticateWithConvex(enteredName.trim(), enteredPassword)
                  .then((auth) => {
                    _totalCoinsCollected = auth.totalCoinsCollected ?? 0;
                    currentSession = auth;
                    saveSession(auth);
                    isSubmitting = false;
                    advanceToGame(auth.username);
                  })
                  .catch(() => {
                    isSubmitting = false;
                    enteredPassword = "";
                    activeField = "password";
                    refreshPrompt();
                  });

                return;
              } else if (activeField === "username") {
                if (enteredName.length < playerNameLimit) {
                  enteredName += key;
                }
              } else if (enteredPassword.length < passwordInputLimit) {
                enteredPassword += key;
              }
            }

            refreshPrompt();
          },
          0,
          0,
          true,
        ),
      );

      elements.push(
        new GameElement(
          new Graphic("decor", decor, "title", "decor", 0, 0),
          0,
          undefined,
        ),
      );
      bootPlayer(50, 19);
      player.freezed = true;
      player.wands = Number.POSITIVE_INFINITY;
      player.swords = Number.POSITIVE_INFINITY;
    },
    function level1() {
      setMood("#101", "#F26", "#88F", "#DDB", "la_roue");
      elements.push(
        new GameElement(
          new Graphic("ground", ground, "intro", "ground", 0, 0),
          0,
          false,
          0,
          0,
          true,
        ),
      );
      elements.push(
        new GameElement(
          new Graphic("decor", decor, "intro", "decor", 0, 0),
          0,
          undefined,
        ),
      );
      elements.push(
        new GameElement(
          new Graphic("decor", decor, "intro", "decorB", 0, -56),
          0,
          undefined,
        ),
      );
      elements.push(
        new GameElement(
          new Graphic("decor", decor, "intro", "decorC", 0, -56 * 2),
          0,
          undefined,
        ),
      );

      dialog = 1;
      let tuto = 0;

      const magician = new GameElement(
        new Graphic("magician", entities, "magician", "invisible", 165, 26),
        0,
        (element) => {
          if (player.collide(0, 1, ground) && dialog === 1) {
            dialog = 1.5;
            elements.push(
              new GameElement(
                new Graphic("dialog", infos, "intro", "dialog1", 0, 0),
                0,
                (dialogElement) => {
                  dialogElement.graphic.hide(decor);
                  dialogElement.graphic.hide(ground);
                  if (keys.enter) {
                    dialog = 2;
                    keys.enter = false;
                    keysUp.enter = false;
                    erase(dialogElement);
                  }
                },
              ),
            );
          }

          if (dialog === 2) {
            dialog = 2.5;
            elements.push(
              new GameElement(
                new Graphic("dialog", infos, "intro", "dialog2", 0, 0),
                0,
                (dialogElement) => {
                  dialogElement.graphic.hide(decor);
                  dialogElement.graphic.hide(ground);
                  if (keys.enter && keysUp.enter) {
                    dialog = 3;
                    keys.enter = false;
                    keysUp.enter = false;
                    erase(dialogElement);
                  }
                },
              ),
            );
          }

          if (dialog === 3) {
            dialog = 3.5;
            elements.push(
              new GameElement(
                new Graphic("dialog", infos, "intro", "dialog3", w - 35, 0),
                0,
                (dialogElement) => {
                  dialogElement.graphic.hide(decor);
                  dialogElement.graphic.hide(ground);
                  if (keys.enter && keysUp.enter) {
                    dialog = 3.75;
                    keys.enter = false;
                    keysUp.enter = false;
                    erase(dialogElement);
                  }
                },
              ),
            );
          }

          if (dialog === 3.75) {
            dialog = 3.99;
            elements.push(
              new GameElement(
                new Graphic("dialog", infos, "intro", "dialog1", 0, 0),
                0,
                (dialogElement) => {
                  dialogElement.graphic.hide(decor);
                  dialogElement.graphic.hide(ground);
                  if (keys.enter) {
                    dialog = 4;
                    keys.enter = false;
                    keysUp.enter = false;
                    erase(dialogElement);
                  }
                },
              ),
            );
          }

          const introDialogs = [
            "dialog4",
            "dialog5",
            "dialog6",
            "dialog7",
            "dialog8",
            "dialog9",
            "dialog10",
            "dialog11",
            "dialog12",
            "dialog13",
            "dialog14",
          ];
          const introValues = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

          for (let i = 0; i < introValues.length; i += 1) {
            if (dialog === introValues[i]) {
              dialog = introValues[i] + 0.5;
              elements.push(
                new GameElement(
                  new Graphic(
                    "dialog",
                    infos,
                    "intro",
                    introDialogs[i],
                    i === 0 || i === 1 || i === 8 ? 0 : w - 35,
                    0,
                  ),
                  0,
                  (dialogElement) => {
                    dialogElement.graphic.hide(decor);
                    dialogElement.graphic.hide(ground);
                    if (keys.enter && keysUp.enter) {
                      keys.enter = false;
                      keysUp.enter = false;

                      if (introValues[i] === 14) {
                        decor.hide = {};
                        ground.hide = {};
                        dialog = false;
                      } else {
                        dialog = (introValues[i] + 1) as typeof dialog;
                      }

                      erase(dialogElement);
                    }
                  },
                ),
              );
            }
          }

          if (player.freezed && !dialog) {
            player.freezed = false;
            tuto = 1;
          }

          const clearHud = () => {
            decor.hide = {};
            ground.hide = {};
            entities.hide = {};
            keys.enter = false;
            keysUp.enter = false;
          };

          if (tuto === 1) {
            elements.push(
              new GameElement(
                new Graphic(
                  "tuto",
                  infos,
                  "intro",
                  "tuto1",
                  Math.round(w / 2 - 9),
                  0,
                ),
                0,
                (tutoElement) => {
                  tutoElement.graphic.hide(decor);
                  tutoElement.graphic.hide(ground);
                  tutoElement.graphic.hide(entities);
                  tuto = 1.5;
                  if (keys.arrowleft || keys.arrowright) {
                    clearHud();
                    erase(tutoElement);
                    tuto = 2;
                  }
                },
              ),
            );
          }

          if (tuto === 2) {
            elements.push(
              new GameElement(
                new Graphic(
                  "tuto",
                  infos,
                  "intro",
                  "tuto2",
                  Math.round(w / 2 - 14),
                  0,
                ),
                0,
                (tutoElement) => {
                  tutoElement.graphic.hide(decor);
                  tutoElement.graphic.hide(ground);
                  tutoElement.graphic.hide(entities);
                  tuto = 2.5;
                  if (
                    (keys.arrowleft && keys.shift) ||
                    (keys.arrowright && keys.shift)
                  ) {
                    clearHud();
                    erase(tutoElement);
                    tuto = 3;
                  }
                },
              ),
            );
          }

          if (tuto === 3) {
            elements.push(
              new GameElement(
                new Graphic(
                  "tuto",
                  infos,
                  "intro",
                  "tuto3",
                  Math.round(w / 2 - 9),
                  0,
                ),
                0,
                (tutoElement) => {
                  tutoElement.graphic.hide(decor);
                  tutoElement.graphic.hide(ground);
                  tutoElement.graphic.hide(entities);
                  tuto = 3.5;
                  if (keys.arrowup) {
                    clearHud();
                    erase(tutoElement);
                    tuto = 4;
                  }
                },
              ),
            );
          }

          if (tuto === 4) {
            elements.push(
              new GameElement(
                new Graphic(
                  "tuto",
                  infos,
                  "intro",
                  "tuto4",
                  Math.round(w / 2 - 14),
                  0,
                ),
                0,
                (tutoElement) => {
                  tutoElement.graphic.hide(decor);
                  tutoElement.graphic.hide(ground);
                  tutoElement.graphic.hide(entities);
                  tuto = 4.5;
                  if (player.double_jump) {
                    clearHud();
                    erase(tutoElement);
                    tuto = 5;
                  }
                },
              ),
            );
          }

          if (tuto === 5) {
            elements.push(
              new GameElement(
                new Graphic(
                  "tuto",
                  infos,
                  "intro",
                  "tuto5",
                  Math.round(w / 2 - 20),
                  0,
                ),
                0,
                (tutoElement) => {
                  tutoElement.graphic.hide(decor);
                  tutoElement.graphic.hide(ground);
                  tutoElement.graphic.hide(entities);
                  tuto = 5.5;
                  if (
                    (keys.arrowleft && keys[" "]) ||
                    (keys.arrowright && keys[" "])
                  ) {
                    clearHud();
                    magician.graphic.changeSequence("stand");
                    tuto = 6;
                    erase(tutoElement);
                  }
                },
              ),
            );
          }

          if (element.graphic.collideWith(player.graphic, 0, 0) && tuto === 6) {
            level = currentLevel + 1;
            if (currentLevel === 1) level = 2;
            else if (currentLevel === 2) level = 0;
            shutdown();
            bootLevel(level);
          }
        },
      );

      elements.push(magician);
      bootPlayer(40, -56 * 3);
      player.cups = 1;
      player.freezed = true;
    },
    function level2() {
      let busInit = false;
      setMood("#205", "#FC3", "#EFF", "#2C2", "cascade");
      const bg = new GameElement(
        new Graphic("decor", decor, "country", "decor", 0, 0),
        0,
        false,
        0,
        0,
      );
      elements.push(bg);
      elements.push(
        new GameElement(
          new Graphic("ground", ground, "country", "ground", 0, 0),
          0,
          undefined,
        ),
      );

      dialog = 1;
      elements.push(
        new GameElement(
          new Graphic("dog_entity", entities, "dog", "stand_left", 137, 47),
          0,
          (element) => {
            element.graphic.hide(decor);
            if (
              element.graphic.collideWith(player.graphic, -3, 0) ||
              element.graphic.collideWith(player.graphic, 3, 0)
            ) {
              element.graphic.changeSequence(
                player.graphic.x > element.graphic.x
                  ? "interact_right"
                  : "interact_left",
              );
              if (keys.enter && dialog === 1) {
                dialog = 1.5;
                player.freezed = true;
                player.talking = true;
                keys.enter = false;
                keysUp.enter = true;
                elements.push(
                  new GameElement(
                    new Graphic(
                      "dialog",
                      infos,
                      "country",
                      "dialog2",
                      w - 35,
                      0,
                    ),
                    0,
                    (dialogElement) => {
                      dialogElement.graphic.hide(decor);
                      dialogElement.graphic.hide(ground);
                      dialogElement.graphic.hide(entities);
                      if (keys.e) {
                        decor.hide = {};
                        ground.hide = {};
                        entities.hide = {};
                        rebootLevel(currentLevel);
                      }
                      if (keys.enter && keysUp.enter) {
                        keys.enter = false;
                        keysUp.enter = false;
                        decor.hide = {};
                        ground.hide = {};
                        entities.hide = {};
                        dialog = 1;
                        erase(dialogElement);
                      }
                    },
                  ),
                );
              }
            } else {
              element.graphic.changeSequence(
                player.graphic.x > element.graphic.x
                  ? "stand_right"
                  : "stand_left",
              );
            }
            if (player.freezed && dialog === 1) {
              player.freezed = false;
              player.talking = false;
            }
          },
        ),
      );

      let busLeftInfo = false;
      elements.push(
        new GameElement(
          new Graphic("entity", entities, "country", "bus", 174, 43),
          0,
          (element) => {
            element.graphic.hide(decor);
            element.graphic.hide(ground);

            if (!Math.round(time / 1000) && !busLeftInfo) {
              busLeftInfo = true;
              player.freezed = true;
              player.talking = true;
              sfx("start");
              elements.push(
                new GameElement(
                  new Graphic(
                    "dialog",
                    infos,
                    "country",
                    "timeout",
                    Math.round(w / 2 - 10),
                    Math.round(h / 2 - 3),
                  ),
                  0,
                  (dialogElement) => {
                    dialogElement.graphic.hide(decor);
                    dialogElement.graphic.hide(ground);
                    dialogElement.graphic.hide(entities);
                    if (keys.enter && keysUp.enter) {
                      keys.enter = false;
                      keysUp.enter = false;
                      decor.hide = {};
                      ground.hide = {};
                      entities.hide = {};
                      time = 0;
                      player.freezed = false;
                      player.talking = false;
                      erase(dialogElement);
                    }
                  },
                ),
              );
            }

            if (!Math.round(time / 1000)) {
              element.graphic.x += 1;
            }

            if (
              element.graphic.collideWith(player.graphic, -3, 0) ||
              element.graphic.collideWith(player.graphic, 3, 0)
            ) {
              if (busInit) {
                element.graphic.changeSequence("bus_price");
                if (
                  keys.enter &&
                  player.coins >= 100 &&
                  time &&
                  !player.cant_behave
                ) {
                  keys.enter = false;
                  keysUp.enter = false;
                  decor.hide = {};
                  ground.hide = {};
                  entities.hide = {};
                  erase(player);
                  time = 0;
                  busLeftInfo = true;
                  player.coins = 0;
                  window.setTimeout(() => {
                    shutdown();
                    element.graphic.hide(decor);
                    element.graphic.hide(ground);
                    element.graphic.hide(entities);
                    bootLevel(currentLevel + 1);
                  }, 2000);
                }
              } else if (dialog === 1) {
                element.graphic.changeSequence("bus_init");
                if (keys.enter) {
                  player.freezed = true;
                  player.talking = true;
                  keys.enter = false;
                  keysUp.enter = true;
                  dialog = 3;
                  elements.push(
                    new GameElement(
                      new Graphic(
                        "dialog",
                        infos,
                        "country",
                        "dialog3",
                        Math.round(w / 2 - 17),
                        Math.round(h / 2 - 4),
                      ),
                      0,
                      (dialogElement) => {
                        dialogElement.graphic.hide(decor);
                        dialogElement.graphic.hide(ground);
                        dialogElement.graphic.hide(entities);
                        if (keys.enter && keysUp.enter) {
                          keys.enter = false;
                          keysUp.enter = false;
                          decor.hide = {};
                          ground.hide = {};
                          entities.hide = {};
                          bootLog(true);
                          bg.bootCollectibles();
                          sfx("start");
                          time = 180000;
                          busInit = true;
                          player.freezed = false;
                          player.talking = false;
                          dialog = 1;
                          erase(dialogElement);
                        }
                      },
                    ),
                  );
                }
              }
            } else {
              element.graphic.changeSequence("bus");
            }
          },
        ),
      );

      bootPlayer(95, 34);
    },
    function level3() {
      setMood("#000", "#688", "#CDD", "#448", "fleur");
      const bg = new GameElement(
        new Graphic("decor", decor, "city", "decor", 0, 0),
        0,
        false,
        0,
        0,
      );
      elements.push(bg);
      elements.push(
        new GameElement(
          new Graphic("ground", ground, "city", "ground", 0, 0),
          0,
          undefined,
        ),
      );

      if (!card) {
        elements.push(
          new GameElement(
            new Graphic("entity", entities, "city", "item", 107, 2),
            0,
            (element) => {
              if (element.graphic.collideWith(player.graphic, 0, 0)) {
                sfx("item");
                elements.push(
                  new GameElement(
                    new Graphic(
                      "dialog",
                      infos,
                      "city",
                      "fool_card",
                      Math.round(w / 2 - 7),
                      Math.round(h / 2 - 6),
                    ),
                    0,
                    (dialogElement) => {
                      dialogElement.graphic.hide(decor);
                      dialogElement.graphic.hide(ground);
                      dialogElement.graphic.hide(entities);
                      pause = true;
                      window.setTimeout(() => {
                        decor.hide = {};
                        ground.hide = {};
                        entities.hide = {};
                        erase(dialogElement);
                        pause = false;
                      }, 4000);
                    },
                  ),
                );
                erase(element);
                card = true;
              }
            },
          ),
        );
      }

      elements.push(
        new GameElement(
          new Graphic("dog_entity", entities, "dog", "stand_left", 100, 47),
          0,
          (element) => {
            element.graphic.hide(decor);
            if (
              element.graphic.collideWith(player.graphic, -3, 0) ||
              element.graphic.collideWith(player.graphic, 3, 0)
            ) {
              element.graphic.changeSequence(
                player.graphic.x > element.graphic.x
                  ? "interact_right"
                  : "interact_left",
              );
              if (keys.enter && dialog === 1) {
                dialog = 1.5;
                player.freezed = true;
                player.talking = true;
                keys.enter = false;
                keysUp.enter = true;
                elements.push(
                  new GameElement(
                    new Graphic(
                      "dialog",
                      infos,
                      "country",
                      "dialog2",
                      w - 35,
                      0,
                    ),
                    0,
                    (dialogElement) => {
                      dialogElement.graphic.hide(decor);
                      dialogElement.graphic.hide(ground);
                      dialogElement.graphic.hide(entities);
                      if (keys.e) {
                        decor.hide = {};
                        ground.hide = {};
                        entities.hide = {};
                        rebootLevel(currentLevel);
                      }
                      if (keys.enter && keysUp.enter) {
                        keys.enter = false;
                        keysUp.enter = false;
                        decor.hide = {};
                        ground.hide = {};
                        entities.hide = {};
                        dialog = 1;
                        erase(dialogElement);
                      }
                    },
                  ),
                );
              }
            } else {
              element.graphic.changeSequence(
                player.graphic.x > element.graphic.x
                  ? "stand_right"
                  : "stand_left",
              );
            }
            if (player.freezed && dialog === 1) {
              player.freezed = false;
              player.talking = false;
            }
          },
        ),
      );

      let doorkeeperInit = false;
      let cityDialog = 1;
      let reservationClosedInfo = false;
      elements.push(
        new GameElement(
          new Graphic("entity", entities, "city", "doorkeeper", 180, 42),
          0,
          (element) => {
            element.graphic.hide(decor);
            element.graphic.hide(ground);
            if (!Math.round(time / 1000) && !reservationClosedInfo) {
              reservationClosedInfo = true;
              player.freezed = true;
              player.talking = true;
              sfx("start");
              elements.push(
                new GameElement(
                  new Graphic(
                    "dialog",
                    infos,
                    "city",
                    "timeout",
                    Math.round(w / 2 - 16),
                    Math.round(h / 2 - 3),
                  ),
                  0,
                  (dialogElement) => {
                    dialogElement.graphic.hide(decor);
                    dialogElement.graphic.hide(ground);
                    dialogElement.graphic.hide(entities);
                    if (keys.enter && keysUp.enter) {
                      keys.enter = false;
                      keysUp.enter = false;
                      decor.hide = {};
                      ground.hide = {};
                      entities.hide = {};
                      time = 0;
                      player.freezed = false;
                      player.talking = false;
                      erase(dialogElement);
                    }
                  },
                ),
              );
            }
            if (reservationClosedInfo) {
              erase(element);
              decor.hide = {};
              ground.hide = {};
              entities.hide = {};
            }
            if (
              element.graphic.collideWith(player.graphic, -3, 0) ||
              element.graphic.collideWith(player.graphic, 3, 0)
            ) {
              if (doorkeeperInit) {
                element.graphic.changeSequence("doorkeeper_price");
                if (
                  keys.enter &&
                  player.coins >= 150 &&
                  time &&
                  !player.cant_behave
                ) {
                  keys.enter = false;
                  keysUp.enter = false;
                  decor.hide = {};
                  ground.hide = {};
                  entities.hide = {};
                  erase(player);
                  time = 0;
                  player.coins = 0;
                  shutdown();
                  element.graphic.hide(decor);
                  element.graphic.hide(ground);
                  element.graphic.hide(entities);
                  bootLevel(currentLevel + 1);
                }
              } else if (cityDialog === 1) {
                element.graphic.changeSequence("doorkeeper_init");
                if (keys.enter) {
                  player.freezed = true;
                  player.talking = true;
                  keys.enter = false;
                  keysUp.enter = true;
                  cityDialog = 3;
                  elements.push(
                    new GameElement(
                      new Graphic(
                        "dialog",
                        infos,
                        "city",
                        "dialog1",
                        Math.round(w / 2 - 17),
                        Math.round(h / 2 - 4),
                      ),
                      0,
                      (dialogElement) => {
                        dialogElement.graphic.hide(decor);
                        dialogElement.graphic.hide(ground);
                        dialogElement.graphic.hide(entities);
                        if (keys.enter && keysUp.enter) {
                          keys.enter = false;
                          keysUp.enter = false;
                          decor.hide = {};
                          ground.hide = {};
                          entities.hide = {};
                          bootLog(true);
                          bg.bootCollectibles();
                          sfx("start");
                          time = 120000;
                          doorkeeperInit = true;
                          player.freezed = false;
                          player.talking = false;
                          cityDialog = 1;
                          erase(dialogElement);
                        }
                      },
                    ),
                  );
                }
              }
            } else {
              element.graphic.changeSequence("doorkeeper");
            }
          },
        ),
      );

      bootPlayer(32, 48);
    },
    function level4() {
      setMood("#000", "#C00", "#FEE", "#600", "la_roue");
      elements.push(
        new GameElement(
          new Graphic("ground", ground, "hotel", "ground", 0, 0),
          0,
          undefined,
          0,
          0,
          true,
        ),
      );
      elements.push(
        new GameElement(
          new Graphic("decor", decor, "hotel", "decor", 0, 0),
          0,
          undefined,
          0,
          0,
          true,
        ),
      );
      dialog = 1;
      elements.push(
        new GameElement(
          new Graphic("magician", entities, "magician", "stand", 13, 4),
          0,
          (element) => {
            if (card) {
              const hotelDialogs = [
                "dialog1",
                "dialog2",
                "dialog3",
                "dialog4",
                "dialog5",
              ];
              for (let i = 0; i < hotelDialogs.length; i += 1) {
                const step = i + 1;
                if (
                  dialog === step &&
                  element.graphic.collideWith(player.graphic, 3, 0)
                ) {
                  dialog = step + 0.5;
                  player.freezed = true;
                  player.talking = true;
                  elements.push(
                    new GameElement(
                      new Graphic(
                        "dialog",
                        infos,
                        "hotel",
                        hotelDialogs[i],
                        w / 2 - 17,
                        0,
                      ),
                      0,
                      (dialogElement) => {
                        dialogElement.graphic.hide(decor);
                        dialogElement.graphic.hide(ground);
                        dialogElement.graphic.hide(entities);
                        if (keys.enter && (i === 0 || keysUp.enter)) {
                          if (step === 5) {
                            win = true;
                            player.freezed = false;
                            player.talking = false;
                            keys.enter = false;
                            keysUp.enter = false;
                            erase(dialogElement);
                            shutdown();
                            bootLevel(0);
                            return;
                          }
                          dialog = step + 1;
                          keys.enter = false;
                          keysUp.enter = false;
                          erase(dialogElement);
                        }
                      },
                    ),
                  );
                }
              }
            } else {
              const hotelDialogs = ["dialog1B", "dialog2B", "dialog3B"];
              for (let i = 0; i < hotelDialogs.length; i += 1) {
                const step = i + 1;
                if (
                  dialog === step &&
                  element.graphic.collideWith(player.graphic, 3, 0)
                ) {
                  dialog = step + 0.5;
                  player.freezed = true;
                  player.talking = true;
                  elements.push(
                    new GameElement(
                      new Graphic(
                        "dialog",
                        infos,
                        "hotel",
                        hotelDialogs[i],
                        w / 2 - 17,
                        0,
                      ),
                      0,
                      (dialogElement) => {
                        dialogElement.graphic.hide(decor);
                        dialogElement.graphic.hide(ground);
                        dialogElement.graphic.hide(entities);
                        if (keys.enter && (i === 0 || keysUp.enter)) {
                          if (step === 3) {
                            player.freezed = false;
                            player.talking = false;
                            keys.enter = false;
                            keysUp.enter = false;
                            erase(dialogElement);
                            shutdown();
                            bootLevel(0);
                            return;
                          }
                          dialog = step + 1;
                          keys.enter = false;
                          keysUp.enter = false;
                          erase(dialogElement);
                        }
                      },
                    ),
                  );
                }
              }
            }
          },
        ),
      );

      elements.push(
        new GameElement(
          new Graphic("dog_entity", entities, "dog", "stand_left", 20, 184),
          0,
          (element) => {
            element.graphic.hide(decor);
            if (
              element.graphic.collideWith(player.graphic, -3, 0) ||
              element.graphic.collideWith(player.graphic, 3, 0)
            ) {
              element.graphic.changeSequence(
                player.graphic.x > element.graphic.x
                  ? "interact_right"
                  : "interact_left",
              );
              if (keys.enter && dialog === 1) {
                dialog = 1.5;
                player.freezed = true;
                player.talking = true;
                keys.enter = false;
                keysUp.enter = true;
                elements.push(
                  new GameElement(
                    new Graphic(
                      "dialog",
                      infos,
                      "country",
                      "dialog2",
                      w - 35,
                      0,
                    ),
                    0,
                    (dialogElement) => {
                      dialogElement.graphic.hide(decor);
                      dialogElement.graphic.hide(ground);
                      dialogElement.graphic.hide(entities);
                      if (keys.e) {
                        decor.hide = {};
                        ground.hide = {};
                        entities.hide = {};
                        rebootLevel(currentLevel);
                      }
                      if (keys.enter && keysUp.enter) {
                        keys.enter = false;
                        keysUp.enter = false;
                        decor.hide = {};
                        ground.hide = {};
                        entities.hide = {};
                        dialog = 1;
                        erase(dialogElement);
                      }
                    },
                  ),
                );
              }
            } else {
              element.graphic.changeSequence(
                player.graphic.x > element.graphic.x
                  ? "stand_right"
                  : "stand_left",
              );
            }
            if (player.freezed && dialog === 1) {
              player.freezed = false;
              player.talking = false;
            }
          },
        ),
      );

      bootPlayer(37, 185);
    },
  ];

  async function setup(files: string[], index = 0): Promise<number> {
    if (index === 0) {
      bootLog();
    }

    const graphic = await readGraphic(`/sprites/${files[index]}`);
    sprites[files[index]] = graphic;
    spriteTemplates[files[index]] = cloneSprite(graphic);
    log(`setup ${files[index]}`, "initial");

    if (index === files.length - 1) {
      setupDone = true;
      shutdown();
      return Date.now();
    }

    return setup(files, index + 1);
  }

  function bootLevel(levelIndex: number) {
    decor.hide = {};
    ground.hide = {};
    entities.hide = {};
    infos.hide = {};
    time = Number.POSITIVE_INFINITY;
    levels[levelIndex]();
    currentLevel = levelIndex;
    entities.camX = -player.graphic.x + player.graphic.canvas.w / 2;
    entities.camY = -player.graphic.y + player.graphic.canvas.h / 1.75;
    ground.camX = -player.graphic.x + player.graphic.canvas.w / 2;
    ground.camY = -player.graphic.y + player.graphic.canvas.h / 1.75;
    decor.camX = -player.graphic.x + player.graphic.canvas.w / 2;
    decor.camY = -player.graphic.y + player.graphic.canvas.h / 1.75;
  }

  function shutdown() {
    while (elements.length) {
      erase(elements[0]);
    }
  }

  function rebootLevel(levelIndex: number) {
    shutdown();
    bootLevel(levelIndex);
  }

  function fullscreen() {
    startDelay = 1000;
    window.scrollTo(0, 0);
    const elem = document.body as HTMLBodyElement & {
      webkitRequestFullscreen?: () => void;
      msRequestFullscreen?: () => void;
    };

    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  }

  function startSetup({ requestFullscreen }: { requestFullscreen: boolean }) {
    if (setupDone || setupStarting) {
      return;
    }

    setupStarting = true;

    if (requestFullscreen) {
      fullscreen();
    } else {
      startDelay = 0;
      window.scrollTo(0, 0);
    }

    window.setTimeout(() => {
      if (useLargeViewportScale()) {
        w = parseInt(String(window.innerWidth / 18), 10) - 1;
        h = parseInt(String(window.innerHeight / 36), 10) - 1;
      } else {
        w = Math.floor(window.innerWidth / 9) - 1;
        h = Math.floor(window.innerHeight / 18) - 1;
      }

      entities = new Canvas("entities", w, h);
      ground = new Canvas("ground", w, h);
      decor = new Canvas("decor", w, h);
      infos = new Canvas("infos", w, h);
      sprites.collectible = {
        "♠": [["♠"]],
        "♣": [["♣"]],
        "♥": [["♥"]],
        "♦": [["♦"]],
      };
      sprites.log = {
        initial: [[]],
        framerate: [[]],
        time: [[]],
        swords: [[]],
        wands: [[]],
        cups: [[]],
        coins: [[]],
        totalCoins: [[]],
        keyLabel: [[]],
        key1: [[]],
        key2: [[]],
        key3: [[]],
        key4: [[]],
        key5: [[]],
      };

      draw();
      void setup([
        "player",
        "title",
        "intro",
        "country",
        "dog",
        "magician",
        "city",
        "hotel",
      ]).then((endTime) => {
        log(`setup is done in ${endTime - setupStartTime} instants`, "initial");
        personalizeGameText(playerName);
        bootLevel(0);
      });
    }, startDelay);
  }

  function useLargeViewportScale() {
    return window.innerWidth >= 1920 && window.innerHeight >= 1080;
  }

  function draw() {
    if (stop) return;
    if (pause) {
      window.setTimeout(draw, gameSpeed);
      return;
    }

    t1 = performance.now();
    if (t0 && t1) {
      const t3 = t1 - t0;
      const fps = 1000 / t3;
      if (t3 > 0 && time > 0) time -= t3;
      log(String(Math.round(time / 1000)), "time", true);
      if (fps > wantedFramerate) {
        gameSpeed += 1;
      } else if (fps < wantedFramerate && gameSpeed > 0) {
        gameSpeed -= 1;
      }
      log(`${Math.round(fps)}FPS (${gameSpeed})`, "framerate", true);
    }

    t0 = performance.now();

    if (player) {
      updateRewardLog();
      if (player.graphic.x + entities.camX < w / 3) {
        entities.camX = -player.graphic.x + player.graphic.canvas.w / 3;
        ground.camX = -player.graphic.x + player.graphic.canvas.w / 3;
        decor.camX = -player.graphic.x + player.graphic.canvas.w / 3;
      }
      if (player.graphic.x + entities.camX > (w / 3) * 2) {
        entities.camX = -player.graphic.x + (player.graphic.canvas.w / 3) * 2;
        ground.camX = -player.graphic.x + (player.graphic.canvas.w / 3) * 2;
        decor.camX = -player.graphic.x + (player.graphic.canvas.w / 3) * 2;
      }
      if (player.graphic.y + entities.camY < h / 3) {
        entities.camY = -player.graphic.y + player.graphic.canvas.h / 3;
        ground.camY = -player.graphic.y + player.graphic.canvas.h / 3;
        decor.camY = -player.graphic.y + player.graphic.canvas.h / 3;
      }
      if (player.graphic.y + entities.camY > (h / 3) * 2) {
        entities.camY = -player.graphic.y + (player.graphic.canvas.h / 3) * 2;
        ground.camY = -player.graphic.y + (player.graphic.canvas.h / 3) * 2;
        decor.camY = -player.graphic.y + (player.graphic.canvas.h / 3) * 2;
      }
    }

    entities.update();
    ground.update();
    decor.update();

    for (let i = 0; i < elements.length; i += 1) {
      const element = elements[i];
      if (element.cant_behave) continue;
      if (element.behaviour) {
        element.behaviour(element);
      }
    }

    if (entitiesNode.innerText !== entities.output) {
      entitiesNode.innerText = entities.output;
    }
    if (groundNode.innerText !== ground.output) {
      groundNode.innerText = ground.output;
    }
    if (decorNode.innerText !== decor.output) {
      decorNode.innerText = decor.output;
    }

    window.setTimeout(draw, gameSpeed);
  }

  function handleSetupKeyUp(event: KeyboardEvent) {
    if (event.key === "Enter" && !setupDone) {
      startSetup({ requestFullscreen: true });
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (startDelay) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (nameEntryActive) {
      if (
        event.key === "Backspace" ||
        event.key === "Enter" ||
        event.key === "Tab"
      ) {
        event.preventDefault();
        typedKeys.push(event.key);
      } else if (event.key.length === 1 && /[\x20-\x7E]/.test(event.key)) {
        event.preventDefault();
        typedKeys.push(event.key);
      }
    }

    keys[event.key.toLowerCase()] = true;
    commonKeys[event.key.toLowerCase()] = true;
  }

  function handleKeyUp(event: KeyboardEvent) {
    keys[event.key.toLowerCase()] = false;
    keysUp[event.key.toLowerCase()] = true;
    commonKeys[event.key.toLowerCase()] = false;
  }

  const visibilityHandler = () => {
    pause = document.hidden;
  };

  document.addEventListener("visibilitychange", visibilityHandler, false);
  document.addEventListener("keyup", handleSetupKeyUp);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  const handleHomeClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!setupDone) {
      return;
    }

    showLoginPrompt();
  };

  const handleNamePromptClick = (event: MouseEvent) => {
    if (!nameEntryActive || !selectNameEntryField) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const cellWidth = rect.width / Math.max(w + 1, 1);
    const cellHeight = rect.height / Math.max(h + 1, 1);
    const column = Math.floor((event.clientX - rect.left) / cellWidth);
    const row = Math.floor((event.clientY - rect.top) / cellHeight);
    const promptX = getNamePromptX();

    if (column < promptX || column >= promptX + NAME_PROMPT_WIDTH) {
      return;
    }

    if (row === NAME_PROMPT_Y + 1) {
      selectNameEntryField("username");
    } else if (row === NAME_PROMPT_Y + 2) {
      selectNameEntryField("password");
    }
  };

  if (homeLink) {
    homeLink.addEventListener("click", handleHomeClick);
  }

  wrapper.addEventListener("click", handleNamePromptClick);

  if (autoLogin) {
    startSetup({ requestFullscreen: false });
  }

  return () => {
    stop = true;
    setLeaderboardLinkVisible(false);
    setHomeLinkVisible(false);
    if (homeLink) {
      homeLink.removeEventListener("click", handleHomeClick);
    }
    wrapper.removeEventListener("click", handleNamePromptClick);
    document.removeEventListener("visibilitychange", visibilityHandler, false);
    document.removeEventListener("keyup", handleSetupKeyUp);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    music.pause();
    music.removeAttribute("src");
    wrapper.style.backgroundColor = "#000";
    decorNode.innerText = "";
    groundNode.innerText = "";
    entitiesNode.innerText = "";
  };
}
