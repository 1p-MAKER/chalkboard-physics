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
 * シンプルな1つの長方形として実装（確実に動作させるため）
 */
export function createHumanoidEntity(x: number, y: number): Matter.Body {
    const { Bodies } = Matter;

    // シンプルな人型（1つの長方形）
    const humanoid = Bodies.rectangle(x, y, 20, 50, {
        restitution: 0.3,
        friction: 0.8,
        density: 0.002,
        inertia: Infinity, // 回転防止
        render: {
            fillStyle: '#ffcccc', // ピンク色で識別しやすく
            strokeStyle: '#ffffff',
            lineWidth: 3
        }
    });

    // カスタムデータ
    (humanoid as any).isHumanoid = true;
    (humanoid as any).legPhase = 0;

    return humanoid;
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
 * 左右からのみ、地面に立った状態で出現
 */
export function getHumanoidSpawnPosition(
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number; direction: number } {
    const fromLeft = Math.random() > 0.5;

    if (fromLeft) {
        // 左から歩いてくる
        return {
            x: -50,
            y: canvasHeight - 100, // 地面近く
            direction: 1 // 右向きに歩く
        };
    } else {
        // 右から歩いてくる
        return {
            x: canvasWidth + 50,
            y: canvasHeight - 100, // 地面近く
            direction: -1 // 左向きに歩く
        };
    }
}
