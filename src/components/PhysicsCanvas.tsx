'use client';

import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { createEntity, createHumanoidEntity, getRandomSpawnPosition } from '@/lib/entityFactory';
import { useTranslation } from 'react-i18next';

interface PhysicsCanvasProps {
    onClear: () => void;
}

const PhysicsCanvas: React.FC<PhysicsCanvasProps> = ({ onClear }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Matter.Engine | null>(null);
    const renderRef = useRef<Matter.Render | null>(null);
    const runnerRef = useRef<Matter.Runner | null>(null);
    const wallsRef = useRef<Matter.Body[]>([]);
    const entitiesRef = useRef<Matter.Body[]>([]);
    const humanoidEntitiesRef = useRef<Matter.Body[]>([]); // 人型キャラクター専用リスト
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isEraserMode, setIsEraserMode] = useState(false);
    const [isSpawning, setIsSpawning] = useState(true); // スタート/ストップ状態

    const { t } = useTranslation();

    useEffect(() => {
        if (!canvasRef.current) return;

        // Matter.js エンジンとレンダラーの初期化
        const { Engine, Render, Runner, World, Bodies } = Matter;

        const engine = Engine.create({
            gravity: { x: 0, y: 1, scale: 0.001 }
        });

        const canvas = canvasRef.current;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

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

        // 境界の壁を作成（画面の下部のみ、見えない壁）
        const ground = Bodies.rectangle(width / 2, height + 25, width, 50, {
            isStatic: true,
            restitution: 0.9,
            friction: 0.01,
            render: { fillStyle: 'transparent' }
        });

        World.add(engine.world, [ground]);

        engineRef.current = engine;
        renderRef.current = render;

        const runner = Runner.create();
        runnerRef.current = runner;

        Render.run(render);
        Runner.run(runner, engine);

        // エンティティの自動生成
        const spawnEntity = () => {
            if (!isSpawning) return;

            const spawn = getRandomSpawnPosition(width, height);
            // ランダムで丸型または人型を生成
            const isHumanoid = Math.random() > 0.5;
            const entity = isHumanoid
                ? createHumanoidEntity(spawn.x, spawn.y)
                : createEntity(spawn.x, spawn.y);

            Matter.Body.setVelocity(entity, { x: spawn.vx, y: spawn.vy });

            World.add(engine.world, entity);
            entitiesRef.current.push(entity);

            if (isHumanoid) {
                humanoidEntitiesRef.current.push(entity);
            }
        };

        // ランダムなタイミングでエンティティを生成
        spawnIntervalRef.current = setInterval(() => {
            if (isSpawning && Math.random() > 0.5) {
                spawnEntity();
            }
        }, 2000);

        // 人型キャラクターのAI（歩行、ジャンプ）
        aiIntervalRef.current = setInterval(() => {
            humanoidEntitiesRef.current.forEach(humanoid => {
                if (!humanoid.position) return;

                // ランダムで行動を決定
                const action = Math.random();

                if (action < 0.3) {
                    // 歩行（左または右に移動）
                    const walkDirection = Math.random() > 0.5 ? 1 : -1;
                    Matter.Body.setVelocity(humanoid, {
                        x: walkDirection * 2,
                        y: humanoid.velocity.y
                    });
                } else if (action < 0.5) {
                    // ジャンプ
                    Matter.Body.applyForce(humanoid, humanoid.position, {
                        x: 0,
                        y: -0.05
                    });
                }
                // それ以外は何もしない（物理演算に任せる）
            });
        }, 1000);

        // ライフサイクル管理：画面外のエンティティを削除
        const cleanupInterval = setInterval(() => {
            entitiesRef.current = entitiesRef.current.filter(entity => {
                const pos = entity.position;
                const isOutOfBounds = pos.x < -100 || pos.x > width + 100 || pos.y > height + 100;

                if (isOutOfBounds) {
                    World.remove(engine.world, entity);
                    // 人型リストからも削除
                    const humanoidIndex = humanoidEntitiesRef.current.indexOf(entity);
                    if (humanoidIndex > -1) {
                        humanoidEntitiesRef.current.splice(humanoidIndex, 1);
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
            Render.stop(render);
            Runner.stop(runner);
            World.clear(engine.world, false);
            Engine.clear(engine);
            render.canvas.remove();
        };
    }, [isSpawning]);

    // 描画機能
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!canvasRef.current || !engineRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (isEraserMode) {
            // 消しゴムモード: タップした位置の壁を削除
            eraseAtPosition(x, y);
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

        if (isEraserMode) {
            // 消しゴムモードではドラッグしながら消す
            eraseAtPosition(x, y);
        } else if (isDrawingRef.current) {
            // 描画モード
            if (lastPointRef.current) {
                const dx = x - lastPointRef.current.x;
                const dy = y - lastPointRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 線を補完して隙間をなくす
                const segments = Math.max(1, Math.floor(distance / 10));

                for (let i = 0; i < segments; i++) {
                    const t = i / segments;
                    const px = lastPointRef.current.x + dx * t;
                    const py = lastPointRef.current.y + dy * t;

                    const wall = Matter.Bodies.circle(px, py, 5, {
                        isStatic: true,
                        restitution: 0.9,
                        friction: 0.01,
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
                    touchAction: 'none', // スクロール防止
                    cursor: isEraserMode ? 'pointer' : 'crosshair'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />
            {/* ボタンコンテナ - 上部中央 */}
            <div
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center'
                }}
            >
                <button
                    onClick={() => setIsSpawning(!isSpawning)}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        backgroundColor: isSpawning ? '#2d5016' : '#ffffff',
                        color: isSpawning ? '#ffffff' : '#2d5016',
                        border: '2px solid #ffffff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        touchAction: 'manipulation'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {isSpawning ? '⏸️ ストップ' : '▶️ スタート'}
                </button>
                <button
                    onClick={() => setIsEraserMode(!isEraserMode)}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        backgroundColor: isEraserMode ? '#ffffff' : '#2d5016',
                        color: isEraserMode ? '#2d5016' : '#ffffff',
                        border: '2px solid #ffffff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        touchAction: 'manipulation'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {isEraserMode ? '✏️ 描画' : '🧹 消しゴム'}
                </button>
                <button
                    onClick={handleClear}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        backgroundColor: '#2d5016',
                        color: '#ffffff',
                        border: '2px solid #ffffff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        touchAction: 'manipulation'
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {t('clearButton')}
                </button>
            </div>
        </div>
    );
};

export default PhysicsCanvas;
