import MatterJS from 'matter-js';

const CATEGORY_DEFAULT = 0x0001; // 壁など（デフォルト）
const CATEGORY_DYNAMIC = 0x0002; // ボールなど
const CATEGORY_LADDER = 0x0004;  // ハシゴ
const CATEGORY_HUMANOID = 0x0008; // 人型キャラクター

/**
 * シンプルなキャラクター（エンティティ）を生成する
 * 丸い体に目と足を持つ可愛らしいデザイン
 */
export function createEntity(x: number, y: number): MatterJS.Body {
    // メインの体（円形） - サイズを50%縮小 (20 -> 10)
    const bodyRadius = 10;

    // ランダムなパステルカラー（色味を強調）
    const hue = Math.floor(Math.random() * 360);
    const color = `hsl(${hue}, 90%, 60%)`;

    const body = MatterJS.Bodies.circle(x, y, bodyRadius, {
        restitution: 0.9,  // 高反発
        friction: 0.01,     // 極低摩擦
        density: 0.001,
        collisionFilter: {
            category: CATEGORY_DYNAMIC,
            mask: CATEGORY_DEFAULT | CATEGORY_DYNAMIC | CATEGORY_HUMANOID // 全てと衝突
        },
        render: {
            fillStyle: color,
            strokeStyle: '#ffffff', // 白い縁取り
            lineWidth: 2
        }
    });

    return body;
}

/**
 * 雲（エンティティ）を生成する
 * 複数の円を組み合わせた静的な障害物
 */
export function createCloudEntity(x: number, y: number): MatterJS.Body {
    const { Bodies, Body } = MatterJS;

    // 各パーツに明示的に白色を指定しないと、Matter.jsがランダムカラーを割り当てる場合がある
    const cloudStyle = { fillStyle: '#ffffff', strokeStyle: '#dddddd', lineWidth: 1 };

    const parts = [
        Bodies.circle(x, y, 30, { render: cloudStyle }),
        Bodies.circle(x - 25, y + 10, 25, { render: cloudStyle }),
        Bodies.circle(x + 25, y + 10, 25, { render: cloudStyle }),
        Bodies.circle(x - 15, y - 15, 20, { render: cloudStyle }),
        Bodies.circle(x + 15, y - 15, 20, { render: cloudStyle })
    ];

    const cloud = Body.create({
        parts: parts,
        isStatic: false, // 手で動かせるように動的にする
        restitution: 0.5,
        friction: 0.1,
        frictionAir: 0.05, // 空気抵抗を増やしてふわふわさせる
        density: 0.001,
        render: {
            fillStyle: '#ffffff',
            strokeStyle: '#dddddd',
            lineWidth: 1
        },
        collisionFilter: {
            category: CATEGORY_DEFAULT,
            // Mouse(設定されていれば)で掴めるようにする
            // 現状のMouseConstraintはcollisionFilterを指定していない(default is all)のでOK
            mask: CATEGORY_DYNAMIC | CATEGORY_HUMANOID
        }
    });

    // カスタムプロパティ：浮遊（重力無視）
    (cloud as any).isFloating = true;

    return cloud;
}

/**
 * 泡（エンティティ）を生成する
 * ふわふわと上昇する
 */
export function createBubbleEntity(x: number, y: number): MatterJS.Body {
    // 泡を大きくする (15 -> 30)
    const bubble = MatterJS.Bodies.circle(x, y, 30, {
        restitution: 0.9,
        friction: 0.1,
        frictionAir: 0.05, // 空気抵抗大
        density: 0.0001, // 非常に軽い
        collisionFilter: {
            category: CATEGORY_DYNAMIC,
            mask: CATEGORY_DEFAULT | CATEGORY_DYNAMIC | CATEGORY_HUMANOID
        },
        render: {
            fillStyle: 'rgba(255, 255, 255, 0.3)',
            strokeStyle: '#ffffff',
            lineWidth: 1
        }
    });

    // カスタムプロパティ：上昇フラグ
    (bubble as any).isBubble = true;
    (bubble as any).bubbleCapacity = 1; // 1人まで入れる
    (bubble as any).containedEntity = null;

    return bubble;
}

/**
 * 人型キャラクター（エンティティ）を生成する
 * 1つの長方形として実装、カスタムレンダリングで可愛い人型に見せる
 */
export function createHumanoidEntity(x: number, y: number): MatterJS.Body {
    // 人型（1つの長方形）- さらに小さく可愛いサイズ (20x34) - 身長削減
    const humanoid = MatterJS.Bodies.rectangle(x, y, 20, 34, {
        restitution: 0.2,
        friction: 0.8,
        density: 0.002,
        inertia: Infinity, // 回転防止
        collisionFilter: {
            category: CATEGORY_HUMANOID,
            mask: CATEGORY_DEFAULT | CATEGORY_DYNAMIC // 壁・ボールとは衝突するが、他のHUMANOIDとは衝突しない
        },
        render: {
            fillStyle: 'transparent', // カスタムレンダリングで描画するため透明に
        }
    });

    // カスタムデータ
    (humanoid as any).isHumanoid = true;
    (humanoid as any).legPhase = 0;
    (humanoid as any).direction = 1;
    (humanoid as any).isClimbing = false;
    (humanoid as any).inBubble = false; // 泡に入っているフラグ

    return humanoid;
}

/**
 * 人型キャラクターを描画（カスタムレンダリング）
 * 小型化に合わせて各数値を調整
 */
export function renderHumanoid(
    context: CanvasRenderingContext2D,
    humanoid: MatterJS.Body,
    legPhase: number,
    direction: number,
    isClimbing: boolean = false
) {
    const pos = humanoid.position;

    context.save();
    context.translate(pos.x, pos.y);

    if (isClimbing) {
        // 登り状態（背中）
        context.fillStyle = '#ffffff';
        context.strokeStyle = '#333333';
        context.lineWidth = 1.5;
        context.beginPath();
        context.roundRect(-6, 2, 12, 16, 6); // 体の位置調整
        context.fill();
        context.stroke();

        // 頭（隙間をなくすために下げる）
        const headRadius = 8;
        context.beginPath();
        context.arc(0, -5, headRadius, 0, Math.PI * 2); // -14 -> -5
        context.fill();
        context.stroke();

        // 手足のアニメーション
        const climbOffset = Math.sin(legPhase * 2) * 3;
        context.strokeStyle = '#ffffff';
        context.lineWidth = 3;

        // 足
        context.beginPath();
        context.moveTo(-3, 15);
        context.lineTo(-3, 20 - climbOffset); // 長さ調整
        context.stroke();
        context.beginPath();
        context.moveTo(3, 15);
        context.lineTo(3, 20 + climbOffset);
        context.stroke();

        // 手
        context.lineWidth = 2.5;
        context.beginPath();
        context.moveTo(-6, 0); // 付け根調整
        context.lineTo(-9, -6 + climbOffset);
        context.stroke();
        context.beginPath();
        context.moveTo(6, 0);
        context.lineTo(9, -6 - climbOffset);
        context.stroke();

    } else {
        // 通常状態
        // 体
        context.fillStyle = '#ffffff';
        context.strokeStyle = '#333333';
        context.lineWidth = 1.5;
        context.beginPath();
        context.roundRect(-6, 2, 12, 16, 6); // 体の位置を下げる
        context.fill();
        context.stroke();

        // 頭（隙間をなくすために下げる）
        const headRadius = 8;
        context.beginPath();
        context.arc(0, -5, headRadius, 0, Math.PI * 2); // -14 -> -5
        context.fill();
        context.stroke();

        // 目（より可愛く大きめに）
        context.fillStyle = '#333333';
        context.beginPath();
        context.arc(-direction * 3, -6, 2, 0, Math.PI * 2); // Y座標調整
        context.fill();
        context.beginPath();
        context.arc(direction * 3, -6, 2, 0, Math.PI * 2);
        context.fill();

        // 笑顔
        context.strokeStyle = '#333333';
        context.lineWidth = 1;
        context.beginPath();
        context.arc(0, -3, 4, 0.3, Math.PI - 0.3); // Y座標調整
        context.stroke();

        // 歩行
        const leftLegOffset = Math.sin(legPhase) * 3;
        const rightLegOffset = Math.sin(legPhase + Math.PI) * 3;
        context.strokeStyle = '#ffffff';
        context.lineWidth = 3;

        // 足
        context.beginPath();
        context.moveTo(-3, 15);
        context.lineTo(-3 + leftLegOffset, 20); // 長さ調整
        context.stroke();
        context.beginPath();
        context.moveTo(3, 15);
        context.lineTo(3 + rightLegOffset, 20);
        context.stroke();

        // 手
        context.lineWidth = 2.5;
        context.beginPath();
        context.moveTo(-6, 4); // 付け根調整
        context.lineTo(-9 - rightLegOffset, 10);
        context.stroke();
        context.beginPath();
        context.moveTo(6, 4);
        context.lineTo(9 - leftLegOffset, 10);
        context.stroke();
    }

    context.restore();
}

/**
 * ハシゴ（エンティティ）を生成する
 * 上部の当たり判定を完全に平らにする
 */
export function createLadderEntity(x: number, y: number): MatterJS.Body {
    const width = 60;
    const height = 180;
    const railWidth = 6;
    const rungHeight = 5;
    const rungCount = 6;

    const parts = [];
    const filter = {
        category: CATEGORY_LADDER,
        mask: CATEGORY_DEFAULT
    };

    const topBarHeight = 8; // 少し厚めにして安定させる

    // トップバー（一番上の平らな台）
    const topBar = MatterJS.Bodies.rectangle(x, y - height / 2 + topBarHeight / 2, width, topBarHeight, {
        render: { fillStyle: '#8B4513' }, // SaddleBrown
        collisionFilter: filter,
        label: 'LadderTop'
    });
    parts.push(topBar);

    // レール（支柱）がトップバーから突き出ないように高さを調整
    const railHeight = height - topBarHeight;
    const railY = y + topBarHeight / 2;

    // 左のレール
    parts.push(MatterJS.Bodies.rectangle(x - width / 2 + railWidth / 2, railY, railWidth, railHeight, {
        render: { fillStyle: '#8B4513' },
        collisionFilter: filter
    }));

    // 右のレール
    parts.push(MatterJS.Bodies.rectangle(x + width / 2 - railWidth / 2, railY, railWidth, railHeight, {
        render: { fillStyle: '#8B4513' },
        collisionFilter: filter
    }));

    // 横桟
    const availableHeight = height - topBarHeight;
    const step = availableHeight / (rungCount + 1);

    for (let i = 1; i <= rungCount; i++) {
        const py = (y - height / 2 + topBarHeight) + step * i;
        parts.push(MatterJS.Bodies.rectangle(x, py, width - railWidth * 2, rungHeight, {
            render: { fillStyle: '#DEB887' }, // BurlyWood
            collisionFilter: filter
        }));
    }

    const ladder = MatterJS.Body.create({
        parts: parts,
        restitution: 0.1,
        friction: 0.5,
        density: 0.005,
        inertia: Infinity,
        collisionFilter: filter,
        label: 'Ladder'
    });

    return ladder;
}

/**
 * 左右または上からランダムにエンティティを生成する位置を決定
 * （丸型キャラクター用）
 */
export function getRandomSpawnPosition(
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number; vx: number; vy: number } {
    const spawnType = Math.random();

    if (spawnType < 0.33) {
        // 左から
        return {
            x: -30,
            y: Math.random() * canvasHeight * 0.5,
            vx: Math.random() * 3 + 2,
            vy: 0
        };
    } else if (spawnType < 0.66) {
        // 右から
        return {
            x: canvasWidth + 30,
            y: Math.random() * canvasHeight * 0.5,
            vx: -(Math.random() * 3 + 2),
            vy: 0
        };
    } else {
        // 上から
        return {
            x: Math.random() * canvasWidth,
            y: -30,
            vx: 0,
            vy: 0
        };
    }
}

/**
 * 人型キャラクター専用のスポーン位置を決定
 * 画面内の左右に直接スポーン（すぐに見える）
 */
export function getHumanoidSpawnPosition(
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number; direction: number } {
    const fromLeft = Math.random() > 0.5;

    if (fromLeft) {
        // 画面内の左側に直接スポーン
        return {
            x: 100, // 画面内
            y: canvasHeight - 150, // 地面から十分な高さ
            direction: 1 // 右向きに歩く
        };
    } else {
        // 画面内の右側に直接スポーン
        return {
            x: canvasWidth - 100, // 画面内
            y: canvasHeight - 150, // 地面から十分な高さ
            direction: -1 // 左向きに歩く
        };
    }
}
