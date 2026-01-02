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
    // メインの体（円形）
    const bodyRadius = 20;
    const body = MatterJS.Bodies.circle(x, y, bodyRadius, {
        restitution: 0.9,  // 高反発
        friction: 0.01,     // 極低摩擦
        density: 0.001,
        collisionFilter: {
            category: CATEGORY_DYNAMIC,
            mask: CATEGORY_DEFAULT | CATEGORY_DYNAMIC | CATEGORY_HUMANOID // 全てと衝突
        },
        render: {
            fillStyle: '#ffffff',
            strokeStyle: '#333333',
            lineWidth: 2
        }
    });

    return body;
}

/**
 * 人型キャラクター（エンティティ）を生成する
 * 1つの長方形として実装、カスタムレンダリングで可愛い人型に見せる
 */
export function createHumanoidEntity(x: number, y: number): MatterJS.Body {
    // 人型（1つの長方形）- 2.5頭身くらいの可愛いプロポーション
    const humanoid = MatterJS.Bodies.rectangle(x, y, 30, 60, {
        restitution: 0.3,
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
    (humanoid as any).isClimbing = false; // 登り状態フラグ

    return humanoid;
}

/**
 * 人型キャラクターを描画（カスタムレンダリング）
 * 可愛らしい2.5頭身キャラクター
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
        // 体（丸みのある長方形）
        context.fillStyle = '#ffffff';
        context.strokeStyle = '#333333';
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(-8, -5, 16, 25, 8);
        context.fill();
        context.stroke();

        // 頭（後ろ姿なので目はなし）
        const headRadius = 12;
        context.beginPath();
        context.arc(0, -22, headRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        // リュック？あるいはシンプルな背中
        context.fillStyle = '#eeeeee';
        context.beginPath();
        context.roundRect(-5, -5, 10, 18, 4);
        context.fill();
        context.stroke();

        // 手足のアニメーション（登っている動き）
        const climbOffset = Math.sin(legPhase * 2) * 4;

        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;

        // 足
        context.beginPath();
        context.moveTo(-4, 20);
        context.lineTo(-4, 32 - climbOffset);
        context.stroke();

        context.beginPath();
        context.moveTo(4, 20);
        context.lineTo(4, 32 + climbOffset);
        context.stroke();

        // 手（バンザイ）
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-8, 0);
        context.lineTo(-12, -15 + climbOffset);
        context.stroke();

        context.beginPath();
        context.moveTo(8, 0);
        context.lineTo(12, -15 - climbOffset);
        context.stroke();

    } else {
        // 通常状態（正面または横）

        // 体
        context.fillStyle = '#ffffff';
        context.strokeStyle = '#333333';
        context.lineWidth = 2;
        context.beginPath();
        context.roundRect(-8, -5, 16, 25, 8);
        context.fill();
        context.stroke();

        // 頭
        const headRadius = 12;
        context.beginPath();
        context.arc(0, -22, headRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        // 目
        context.fillStyle = '#333333';
        context.beginPath();
        context.arc(-4, -24, 2.5, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(4, -24, 2.5, 0, Math.PI * 2);
        context.fill();

        // 笑顔
        context.strokeStyle = '#333333';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(0, -20, 5, 0.2, Math.PI - 0.2);
        context.stroke();

        // ほっぺた
        context.fillStyle = '#ffcccc';
        context.beginPath();
        context.arc(-8, -19, 2, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(8, -19, 2, 0, Math.PI * 2);
        context.fill();

        // 手足（歩行）
        const leftLegOffset = Math.sin(legPhase) * 4;
        const rightLegOffset = Math.sin(legPhase + Math.PI) * 4;

        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;
        // 足
        context.beginPath();
        context.moveTo(-4, 20);
        context.lineTo(-4 + leftLegOffset, 32);
        context.stroke();
        context.beginPath();
        context.moveTo(4, 20);
        context.lineTo(4 + rightLegOffset, 32);
        context.stroke();

        // 手
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-8, 0);
        context.lineTo(-12 - rightLegOffset, 8);
        context.stroke();
        context.beginPath();
        context.moveTo(8, 0);
        context.lineTo(12 - leftLegOffset, 8);
        context.stroke();
    }

    context.restore();
}

/**
 * ハシゴ（エンティティ）を生成する
 * 複数のパーツで構成された動的な物理オブジェクト
 */
export function createLadderEntity(x: number, y: number): MatterJS.Body {
    const width = 60;
    const height = 180;
    const railWidth = 6;
    const rungHeight = 5;
    const rungCount = 6;

    const parts = [];

    // パーツごとのcollisionFilter設定も必要
    const filter = {
        category: CATEGORY_LADDER,
        mask: CATEGORY_DEFAULT // 壁(0x0001)とは衝突するが、DYNAMIC(0x0002)とは衝突しない
    };

    // 左のレール
    parts.push(MatterJS.Bodies.rectangle(x - width / 2 + railWidth / 2, y, railWidth, height, {
        render: { fillStyle: '#ffffff' },
        collisionFilter: filter
    }));

    // 右のレール
    parts.push(MatterJS.Bodies.rectangle(x + width / 2 - railWidth / 2, y, railWidth, height, {
        render: { fillStyle: '#ffffff' },
        collisionFilter: filter
    }));

    // 横桟（ラング）
    const step = height / (rungCount + 1);
    for (let i = 1; i <= rungCount; i++) {
        const py = y - height / 2 + step * i;
        parts.push(MatterJS.Bodies.rectangle(x, py, width - railWidth * 2, rungHeight, {
            render: { fillStyle: '#ffffff' },
            collisionFilter: filter
        }));
    }

    // 複合体を作成
    const ladder = MatterJS.Body.create({
        parts: parts,
        restitution: 0.2,
        friction: 0.5,
        density: 0.005,
        inertia: Infinity, // 回転ロック
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
