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
 * 1つの長方形として実装、カスタムレンダリングで人型に見せる
 */
export function createHumanoidEntity(x: number, y: number): Matter.Body {
    const { Bodies } = Matter;

    // 人型（1つの長方形）
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

    // 体（長方形）
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#333333';
    context.lineWidth = 2;
    context.fillRect(-10, -20, 20, 40);
    context.strokeRect(-10, -20, 20, 40);

    // 頭（円）
    context.beginPath();
    context.arc(0, -32, 8, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    // 目
    context.fillStyle = '#333333';
    context.beginPath();
    context.arc(-3, -34, 1.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(3, -34, 1.5, 0, Math.PI * 2);
    context.fill();

    // 歩行アニメーション用の足の位置計算
    const leftLegOffset = Math.sin(legPhase) * 5;
    const rightLegOffset = Math.sin(legPhase + Math.PI) * 5;

    // 左足
    context.strokeStyle = '#ffffff';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-5, 20);
    context.lineTo(-5 + leftLegOffset, 35);
    context.stroke();

    // 右足
    context.beginPath();
    context.moveTo(5, 20);
    context.lineTo(5 + rightLegOffset, 35);
    context.stroke();

    // 左手
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-10, -10);
    context.lineTo(-15 - rightLegOffset, 5);
    context.stroke();

    // 右手
    context.beginPath();
    context.moveTo(10, -10);
    context.lineTo(15 - leftLegOffset, 5);
    context.stroke();

    context.restore();
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
