'use client';

import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { createEntity, getRandomSpawnPosition } from '@/lib/entityFactory';
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
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
            const spawn = getRandomSpawnPosition(width, height);
            const entity = createEntity(spawn.x, spawn.y);
            Matter.Body.setVelocity(entity, { x: spawn.vx, y: spawn.vy });

            World.add(engine.world, entity);
            entitiesRef.current.push(entity);
        };

        // ランダムなタイミングでエンティティを生成
        spawnIntervalRef.current = setInterval(() => {
            if (Math.random() > 0.5) {
                spawnEntity();
            }
        }, 2000);

        // ライフサイクル管理：画面外のエンティティを削除
        const cleanupInterval = setInterval(() => {
            entitiesRef.current = entitiesRef.current.filter(entity => {
                const pos = entity.position;
                const isOutOfBounds = pos.x < -100 || pos.x > width + 100 || pos.y > height + 100;

                if (isOutOfBounds) {
                    World.remove(engine.world, entity);
                    return false;
                }
                return true;
            });
        }, 3000);

        return () => {
            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
            clearInterval(cleanupInterval);
            Render.stop(render);
            Runner.stop(runner);
            World.clear(engine.world, false);
            Engine.clear(engine);
            render.canvas.remove();
        };
    }, []);

    // 描画機能
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!canvasRef.current || !engineRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        isDrawingRef.current = true;
        lastPointRef.current = { x, y };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current || !canvasRef.current || !engineRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

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
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        lastPointRef.current = null;
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
                    cursor: 'crosshair'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />
            <button
                onClick={handleClear}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    padding: '12px 24px',
                    fontSize: '16px',
                    backgroundColor: '#2d5016',
                    color: '#ffffff',
                    border: '2px solid #ffffff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    touchAction: 'manipulation' // ボタンと描画の排他制御
                }}
                onPointerDown={(e) => e.stopPropagation()} // ボタン操作時にキャンバス描画を防止
            >
                {t('clearButton')}
            </button>
        </div>
    );
};

export default PhysicsCanvas;
