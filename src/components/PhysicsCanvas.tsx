'use client';

import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { createEntity, createHumanoidEntity, createLadderEntity, getRandomSpawnPosition, getHumanoidSpawnPosition, renderHumanoid } from '@/lib/entityFactory';

interface PhysicsCanvasProps {
    onClear: () => void;
}

interface HumanoidData {
    body: Matter.Body;
    direction: number; // 1: right, -1: left
    legPhase: number; // 歩行アニメーション用のフェーズ
    stuckCounter: number; // 行き止まり検知用カウンター
}

const PhysicsCanvas: React.FC<PhysicsCanvasProps> = ({ onClear }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Matter.Engine | null>(null);
    const renderRef = useRef<Matter.Render | null>(null);
    const runnerRef = useRef<Matter.Runner | null>(null);
    const wallsRef = useRef<Matter.Body[]>([]);
    const entitiesRef = useRef<Matter.Body[]>([]);
    const humanoidDataRef = useRef<HumanoidData[]>([]); // 人型キャラクター専用リスト（方向情報付き）
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
    const [cursorMode, setCursorMode] = useState<'draw' | 'grab' | 'eraser'>('draw');
    const [isSpawning, setIsSpawning] = useState(true); // スタート/ストップ状態

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        // Canvasのサイズを明示的に設定
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        // Matter.js エンジンとレンダラーの初期化
        const { Engine, Render, Runner, World, Bodies, Events, MouseConstraint, Mouse } = Matter;

        const engine = Engine.create({
            gravity: { x: 0, y: 1, scale: 0.001 }
        });

        const width = canvas.width;
        const height = canvas.height;

        const render = Render.create({
            canvas: canvas,
            engine: engine,
            options: {
                width,
                height,
                wireframes: false,
                background: '#2d5016', // 黒板の緑色
            }
        });

        // 見える地面を作成（画面下部、白い線）
        const groundY = height - 30; // 画面下部から少し上
        const ground = Bodies.rectangle(width / 2, groundY, width, 10, {
            isStatic: true,
            restitution: 0.3,
            friction: 0.8, // 地面との摩擦を上げる
            render: {
                fillStyle: '#ffffff', // 白い地面
                strokeStyle: '#ffffff',
                lineWidth: 2
            }
        });

        World.add(engine.world, [ground]);

        engineRef.current = engine;
        renderRef.current = render;

        // マウス操作（グラブ）の設定
        const mouse = Mouse.create(render.canvas);
        const mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: {
                    visible: false
                }
            }
        });
        mouseConstraintRef.current = mouseConstraint;

        // 初期モードに応じた設定
        if (cursorMode === 'grab') {
            World.add(engine.world, mouseConstraint);
        }

        const runner = Runner.create();
        runnerRef.current = runner;

        Render.run(render);
        Runner.run(runner, engine);

        // カスタムレンダリング（人型キャラクターを個別に描画）
        Events.on(render, 'afterRender', () => {
            const context = render.context;

            humanoidDataRef.current.forEach(humanoidData => {
                const humanoid = humanoidData.body;

                // カスタムレンダリング
                renderHumanoid(context, humanoid, humanoidData.legPhase, humanoidData.direction);
            });
        });

        // 物理演算更新前の処理
        Events.on(engine, 'beforeUpdate', () => {
            // ハシゴの回転を防止（常に縦向き）
            const bodies = Matter.Composite.allBodies(engine.world);
            bodies.forEach(body => {
                if (body.label === 'Ladder') {
                    Matter.Body.setAngle(body, 0);
                    Matter.Body.setAngularVelocity(body, 0);
                }
            });
        });

        // エンティティの自動生成
        const spawnEntity = () => {
            if (!isSpawning) return;

            const isHumanoid = Math.random() > 0.5;

            if (isHumanoid) {
                // 人型キャラクター - 左右から出現
                const spawn = getHumanoidSpawnPosition(width, height);
                const humanoid = createHumanoidEntity(spawn.x, spawn.y);

                World.add(engine.world, humanoid);
                entitiesRef.current.push(humanoid);
                humanoidDataRef.current.push({
                    body: humanoid,
                    direction: spawn.direction,
                    legPhase: 0,
                    stuckCounter: 0
                });
            } else {
                // 丸型キャラクター - 左右上から出現
                const spawn = getRandomSpawnPosition(width, height);
                const entity = createEntity(spawn.x, spawn.y);
                Matter.Body.setVelocity(entity, { x: spawn.vx, y: spawn.vy });

                World.add(engine.world, entity);
                entitiesRef.current.push(entity);
            }
        };

        // ランダムなタイミングでエンティティを生成
        spawnIntervalRef.current = setInterval(() => {
            if (isSpawning && Math.random() > 0.5) {
                spawnEntity();
            }
        }, 2000);

        // 人型キャラクターの高度なAI（障害物検知、歩行、ジャンプ）
        aiIntervalRef.current = setInterval(() => {
            humanoidDataRef.current.forEach(humanoidData => {
                const humanoid = humanoidData.body;
                const direction = humanoidData.direction;

                if (!humanoid.position) return;

                // 角度を強制的に0に保つ（直立状態維持）
                Matter.Body.setAngle(humanoid, 0);

                // 常に歩行方向に移動
                const walkSpeed = 2;
                Matter.Body.setVelocity(humanoid, {
                    x: direction * walkSpeed,
                    y: humanoid.velocity.y
                });

                // 行き止まり検知：移動速度が極端に低い場合
                const actualSpeed = Math.abs(humanoid.velocity.x);
                if (actualSpeed < 0.5 && Math.abs(humanoid.velocity.y) < 0.1) {
                    // 地上にいて、ほとんど動いていない = 詰まっている
                    humanoidData.stuckCounter = (humanoidData.stuckCounter || 0) + 1;

                    // 一定時間詰まったら方向転換
                    if (humanoidData.stuckCounter > 30) { // 約3秒
                        humanoidData.direction *= -1; // 方向転換
                        humanoidData.stuckCounter = 0; //カウンターリセット

                        // 方向転換時に少しジャンプして脱出を試みる
                        Matter.Body.applyForce(humanoid, humanoid.position, {
                            x: humanoidData.direction * 0.03,
                            y: -0.1
                        });
                    }
                } else {
                    // 順調に動いている場合はカウンターリセット
                    humanoidData.stuckCounter = 0;
                }

                // 歩行アニメーションのフェーズを更新
                humanoidData.legPhase += 0.2;

                // 前方の障害物検知（レイキャスト的な処理）
                const checkDistance = 60;
                const checkX = humanoid.position.x + (direction * checkDistance);
                const checkY = humanoid.position.y;

                // 前方に壁があるか確認
                let obstacleDetected = false;
                wallsRef.current.forEach(wall => {
                    const dx = wall.position.x - checkX;
                    const dy = wall.position.y - checkY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 50) {
                        obstacleDetected = true;
                    }
                });

                // 障害物があればジャンプ
                if (obstacleDetected && Math.abs(humanoid.velocity.y) < 0.1) {
                    // ジャンプ力を上方向に加える（地面にいる時のみ）
                    Matter.Body.applyForce(humanoid, humanoid.position, {
                        x: direction * 0.04, // 前方にも少し力を加える
                        y: -0.12 // 上方向に大きな力
                    });

                    // ジャンプアニメーション用のフェーズをリセット
                    humanoidData.legPhase = 0;
                } else if (Math.random() < 0.02 && Math.abs(humanoid.velocity.y) < 0.1) {
                    // ランダムジャンプ（2%の確率で小ジャンプ）
                    Matter.Body.applyForce(humanoid, humanoid.position, {
                        x: 0,
                        y: -0.08 // 障害物ジャンプより少し弱め
                    });
                }
            });
        }, 100); // より頻繁にチェック（アニメーションのため）

        // ライフサイクル管理：画面外のエンティティを削除
        const cleanupInterval = setInterval(() => {
            entitiesRef.current = entitiesRef.current.filter(entity => {
                const pos = entity.position;
                const isOutOfBounds = pos.x < -200 || pos.x > width + 200 || pos.y > height + 200;

                if (isOutOfBounds) {
                    World.remove(engine.world, entity);
                    // 人型リストからも削除
                    const humanoidIndex = humanoidDataRef.current.findIndex(h => h.body === entity);
                    if (humanoidIndex > -1) {
                        humanoidDataRef.current.splice(humanoidIndex, 1);
                    }
                    return false;
                }
                return true;
            });
        }, 3000);

        return () => {
            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
            if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
            clearInterval(cleanupInterval);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            Render.stop(render);
            Runner.stop(runner);
            World.clear(engine.world, false);
            Engine.clear(engine);
            render.canvas.remove();
        };
    }, [isSpawning]);

    // カーソルモード変更時の副作用
    useEffect(() => {
        if (!engineRef.current || !mouseConstraintRef.current) return;

        const world = engineRef.current.world;
        const mouseConstraint = mouseConstraintRef.current;

        if (cursorMode === 'grab') {
            Matter.World.add(world, mouseConstraint);
        } else {
            Matter.World.remove(world, mouseConstraint);
        }
    }, [cursorMode]);

    // 人型キャラクターを手動で追加
    const spawnHumanoid = () => {
        if (!engineRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const width = canvas.width;
        const height = canvas.height;

        const spawn = getHumanoidSpawnPosition(width, height);
        const humanoid = createHumanoidEntity(spawn.x, spawn.y);

        Matter.World.add(engineRef.current.world, humanoid);
        entitiesRef.current.push(humanoid);
        humanoidDataRef.current.push({
            body: humanoid,
            direction: spawn.direction,
            legPhase: 0,
            stuckCounter: 0
        });
    };

    // ハシゴを手動で追加
    const spawnLadder = () => {
        if (!engineRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const width = canvas.width;

        // 画面中央上部から少し下にスポーン
        const ladder = createLadderEntity(width / 2, 200);

        Matter.World.add(engineRef.current.world, ladder);
        entitiesRef.current.push(ladder);
    };

    // ボールを手動で追加
    const spawnBall = () => {
        if (!engineRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const width = canvas.width;
        const height = canvas.height;

        const spawn = getRandomSpawnPosition(width, height);
        const entity = createEntity(spawn.x, spawn.y);
        Matter.Body.setVelocity(entity, { x: spawn.vx, y: spawn.vy });

        Matter.World.add(engineRef.current.world, entity);
        entitiesRef.current.push(entity);
    };

    // 描画機能
    // 描画機能
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!canvasRef.current || !engineRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (cursorMode === 'grab') {
            // グラブモード時はMatter.jsのmouseConstraintが処理するため、ここでは何もしない
            return;
        } else if (cursorMode === 'eraser') {
            // 消しゴムモード: タップした位置の壁を削除
            eraseAtPosition(x, y);
            isDrawingRef.current = true; // ドラッグ消去を有効化
        } else {
            // 描画モード
            isDrawingRef.current = true;
            lastPointRef.current = { x, y };
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!canvasRef.current || !engineRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (cursorMode === 'grab') {
            // グラブモード時はMatter.jsのmouseConstraintが処理するため、ここでは何もしない
            return;
        } else if (isDrawingRef.current && cursorMode === 'eraser') {
            // 消しゴムモードではドラッグしながら消す
            eraseAtPosition(x, y);
        } else if (isDrawingRef.current && cursorMode === 'draw') {
            // 描画モード
            if (lastPointRef.current) {
                const dx = x - lastPointRef.current.x;
                const dy = y - lastPointRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 線を補完して隙間をなくす（超高密度に：2px間隔）
                const segments = Math.max(1, Math.floor(distance / 2));

                for (let i = 0; i < segments; i++) {
                    const t = i / segments;
                    const px = lastPointRef.current.x + dx * t;
                    const py = lastPointRef.current.y + dy * t;

                    // チョーク風のランダムなズレ（少し控えめに）
                    const offset = (Math.random() - 0.5) * 1.5;

                    const wall = Matter.Bodies.circle(px + offset, py + offset, 3, {
                        isStatic: true,
                        restitution: 0.9,
                        friction: 0.5,
                        render: {
                            fillStyle: '#ffffff', // 白いチョーク
                            strokeStyle: '#ffffff',
                            lineWidth: 1
                        }
                    });

                    Matter.World.add(engineRef.current.world, wall);
                    wallsRef.current.push(wall);
                }
            }

            lastPointRef.current = { x, y };
        }
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        lastPointRef.current = null;
    };

    // 消しゴム機能: 指定位置の壁を削除
    const eraseAtPosition = (x: number, y: number) => {
        if (!engineRef.current) return;

        const eraseRadius = 20; // 消しゴムの範囲
        const wallsToRemove: Matter.Body[] = [];

        wallsRef.current.forEach(wall => {
            const dx = wall.position.x - x;
            const dy = wall.position.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < eraseRadius) {
                wallsToRemove.push(wall);
            }
        });

        wallsToRemove.forEach(wall => {
            Matter.World.remove(engineRef.current!.world, wall);
            const index = wallsRef.current.indexOf(wall);
            if (index > -1) {
                wallsRef.current.splice(index, 1);
            }
        });
    };

    // 消去機能
    const handleClear = () => {
        if (!engineRef.current) return;

        // 全ての描画された壁を削除
        wallsRef.current.forEach(wall => {
            Matter.World.remove(engineRef.current!.world, wall);
        });
        wallsRef.current = [];

        onClear();
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none', // スクロール防止
                    cursor: cursorMode === 'grab' ? 'grab' : (cursorMode === 'eraser' ? 'pointer' : 'crosshair')
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />
            {/* ボタンコンテナ - 上部中央（ノッチを避ける） */}
            <div
                style={{
                    position: 'absolute',
                    top: '50px', // ノッチを避けるため下に移動
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    maxWidth: '95%',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                }}
            >
                <button
                    onClick={() => setIsSpawning(!isSpawning)}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: isSpawning ? '#2d5016' : '#ffffff',
                        color: isSpawning ? '#ffffff' : '#2d5016',
                        border: '2px solid #ffffff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        touchAction: 'manipulation',
                        minWidth: '100px'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {isSpawning ? '⏸️ ストップ' : '▶️ スタート'}
                </button>
                <button
                    onClick={spawnHumanoid}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: '#2d5016',
                        color: '#ffffff',
                        border: '2px solid #ffffff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        touchAction: 'manipulation',
                        minWidth: '100px'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    🚶 人を追加
                </button>
                <button
                    onClick={spawnLadder}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: '#2d5016',
                        color: '#ffffff',
                        border: '2px solid #ffffff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        touchAction: 'manipulation',
                        minWidth: '100px'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    🪜 ハシゴ
                </button>
                <button
                    onClick={spawnBall}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: '#2d5016',
                        color: '#ffffff',
                        border: '2px solid #ffffff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        touchAction: 'manipulation',
                        minWidth: '120px'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    ⚽ ボールを追加
                </button>
                <div style={{ width: '100%', height: '8px' }}></div>
                <button
                    onClick={() => setCursorMode('draw')}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: cursorMode === 'draw' ? '#ffffff' : '#2d5016',
                        color: cursorMode === 'draw' ? '#2d5016' : '#ffffff',
                        border: '1px solid #ffffff',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    ✏️ 鉛筆
                </button>
                <button
                    onClick={() => setCursorMode('grab')}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: cursorMode === 'grab' ? '#ffffff' : '#2d5016',
                        color: cursorMode === 'grab' ? '#2d5016' : '#ffffff',
                        border: '1px solid #ffffff',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    ✋ 手
                </button>
                <button
                    onClick={() => setCursorMode('eraser')}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: cursorMode === 'eraser' ? '#ffffff' : '#2d5016',
                        color: cursorMode === 'eraser' ? '#2d5016' : '#ffffff',
                        border: '1px solid #ffffff',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    🧹 消しゴム
                </button>
                <button
                    onClick={handleClear}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: '#2d5016',
                        color: '#ffffff',
                        border: '2px solid #ffffff',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        touchAction: 'manipulation',
                        minWidth: '80px'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    消去
                </button>
            </div>
        </div>
    );
};

export default PhysicsCanvas;
