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
 * 頭、体、手、足で構成
 */
export function createHumanoidEntity(x: number, y: number): Matter.Body {
    const { Bodies, Body } = Matter;

    // 頭（円形）
    const head = Bodies.circle(x, y - 25, 12, {
        restitution: 0.9,
        friction: 0.01,
        density: 0.001,
        render: {
            fillStyle: '#ffffff',
            strokeStyle: '#333333',
            lineWidth: 2
        }
    });

    // 体（長方形）
    const torso = Bodies.rectangle(x, y, 16, 30, {
        restitution: 0.9,
        friction: 0.01,
        density: 0.001,
        render: {
            fillStyle: '#ffffff',
            strokeStyle: '#333333',
            lineWidth: 2
        }
    });

    // 手（2つの小さい円）
    const leftHand = Bodies.circle(x - 12, y - 5, 5, {
        restitution: 0.9,
        friction: 0.01,
        density: 0.001,
        render: {
            fillStyle: '#ffffff',
            strokeStyle: '#333333',
            lineWidth: 1
        }
    });

    const rightHand = Bodies.circle(x + 12, y - 5, 5, {
        restitution: 0.9,
        friction: 0.01,
        density: 0.001,
        render: {
            fillStyle: '#ffffff',
            strokeStyle: '#333333',
            lineWidth: 1
        }
    });

    // 足（2つの小さい長方形）
    const leftFoot = Bodies.rectangle(x - 6, y + 20, 6, 10, {
        restitution: 0.9,
        friction: 0.01,
        density: 0.001,
        render: {
            fillStyle: '#ffffff',
            strokeStyle: '#333333',
            lineWidth: 1
        }
    });

    const rightFoot = Bodies.rectangle(x + 6, y + 20, 6, 10, {
        restitution: 0.9,
        friction: 0.01,
        density: 0.001,
        render: {
            fillStyle: '#ffffff',
            strokeStyle: '#333333',
            lineWidth: 1
        }
    });

    // 全てのパーツを複合体として結合
    const humanoid = Body.create({
        parts: [torso, head, leftHand, rightHand, leftFoot, rightFoot],
        restitution: 0.9,
        friction: 0.01,
    });

    return humanoid;
}

/**
 * 左右または上からランダムにエンティティを生成する位置を決定
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
