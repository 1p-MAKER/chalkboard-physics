import Matter from 'matter-js';

/**
 * シンプルなキャラクター（エンティティ）を生成する
 * 丸い体に目と足を持つ可愛らしいデザイン
 */
export function createEntity(x: number, y: number): Matter.Body {
    const { Bodies } = Matter;

    // メインの体（円形）
    const bodyRadius = 20;
    const body = Bodies.circle(x, y, bodyRadius, {
        restitution: 0.9,  // 高反発
        friction: 0.01,     // 極低摩擦
        density: 0.001,
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
export function createHumanoidEntity(x: number, y: number): Matter.Body {
    const { Bodies } = Matter;

    // 人型（1つの長方形）- 2.5頭身くらいの可愛いプロポーション
    const humanoid = Bodies.rectangle(x, y, 30, 60, {
        restitution: 0.3,
        friction: 0.8,
        density: 0.002,
        inertia: Infinity, // 回転防止
        render: {
            fillStyle: 'transparent', // カスタムレンダリングで描画するため透明に
        }
    });

    // カスタムデータ
    (humanoid as any).isHumanoid = true;
    (humanoid as any).legPhase = 0;
    (humanoid as any).direction = 1;

    return humanoid;
}

/**
 * 人型キャラクターを描画（カスタムレンダリング）
 * 可愛らしい2.5頭身キャラクター
 */
export function renderHumanoid(
    context: CanvasRenderingContext2D,
    humanoid: Matter.Body,
    legPhase: number,
    direction: number
) {
    const pos = humanoid.position;

    context.save();
    context.translate(pos.x, pos.y);

    // 体（丸みのある長方形）- 小さめ
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#333333';
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(-8, -5, 16, 25, 8); // 丸い角
    context.fill();
    context.stroke();

    // 頭（大きな円）- 2.5頭身の可愛いプロポーション
    const headRadius = 12; // 大きな頭
    context.beginPath();
    context.arc(0, -22, headRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    // 目（大きくて可愛い）
    context.fillStyle = '#333333';
    // 左目
    context.beginPath();
    context.arc(-4, -24, 2.5, 0, Math.PI * 2);
    context.fill();
    // 右目
    context.beginPath();
    context.arc(4, -24, 2.5, 0, Math.PI * 2);
    context.fill();

    // 笑顔（にっこり）
    context.strokeStyle = '#333333';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, -20, 5, 0.2, Math.PI - 0.2);
    context.stroke();

    // ほっぺた（ピンク色）
    context.fillStyle = '#ffcccc';
    // 左ほっぺ
    context.beginPath();
    context.arc(-8, -19, 2, 0, Math.PI * 2);
    context.fill();
    // 右ほっぺ
    context.beginPath();
    context.arc(8, -19, 2, 0, Math.PI * 2);
    context.fill();

    // 歩行アニメーション用の足の位置計算
    const leftLegOffset = Math.sin(legPhase) * 4;
    const rightLegOffset = Math.sin(legPhase + Math.PI) * 4;

    // 足（短くて可愛い）
    context.strokeStyle = '#ffffff';
    context.lineWidth = 4;
    // 左足
    context.beginPath();
    context.moveTo(-4, 20);
    context.lineTo(-4 + leftLegOffset, 32);
    context.stroke();
    // 右足
    context.beginPath();
    context.moveTo(4, 20);
    context.lineTo(4 + rightLegOffset, 32);
    context.stroke();

    // 手（短くて可愛い）
    context.lineWidth = 3;
    // 左手
    context.beginPath();
    context.moveTo(-8, 0);
    context.lineTo(-12 - rightLegOffset, 8);
    context.stroke();
    // 右手
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(12 - leftLegOffset, 8);
    context.stroke();

    context.restore();
}

/**
 * ハシゴ（エンティティ）を生成する
 * 複数のパーツで構成された動的な物理オブジェクト
 */
export function createLadderEntity(x: number, y: number): Matter.Body {
    const { Bodies, Body } = Matter;

    const width = 60;
    const height = 180;
    const railWidth = 6;
    const rungHeight = 5;
    const rungCount = 6;

    const parts = [];

    // 左のレール
    parts.push(Bodies.rectangle(x - width / 2 + railWidth / 2, y, railWidth, height, {
        render: { fillStyle: '#ffffff' }
    }));

    // 右のレール
    parts.push(Bodies.rectangle(x + width / 2 - railWidth / 2, y, railWidth, height, {
        render: { fillStyle: '#ffffff' }
    }));

    // 横桟（ラング）
    const step = height / (rungCount + 1);
    for (let i = 1; i <= rungCount; i++) {
        const py = y - height / 2 + step * i;
        parts.push(Bodies.rectangle(x, py, width - railWidth * 2, rungHeight, {
            render: { fillStyle: '#ffffff' }
        }));
    }

    // 複合体を作成
    const ladder = Body.create({
        parts: parts,
        restitution: 0.2,
        friction: 0.5,
        density: 0.005,
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
