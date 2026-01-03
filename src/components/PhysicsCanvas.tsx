'use client';

import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import {
    createEntity,
    createHumanoidEntity,
    createLadderEntity,
    createCloudEntity,
    createBubbleEntity,
    createFloatingBarEntity,
    createQuestionBlockEntity,
    createCoinEntity,
    getRandomSpawnPosition,
    getHumanoidSpawnPosition,
    renderHumanoid
} from '@/lib/entityFactory';
import { soundManager } from '@/lib/soundManager';

const CATEGORY_PLATEFORM = 0x0020;

interface PhysicsCanvasProps {
    onClear: () => void;
}

interface HumanoidData {
    body: Matter.Body;
    direction: number; // 1: right, -1: left
    legPhase: number;
    stuckCounter: number;
    isClimbing?: boolean;
}

const PhysicsCanvas: React.FC<PhysicsCanvasProps> = ({ onClear }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Matter.js Refs
    const engineRef = useRef<Matter.Engine | null>(null);
    const renderRef = useRef<Matter.Render | null>(null);
    const runnerRef = useRef<Matter.Runner | null>(null);
    const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);

    // Logic Refs
    const wallsRef = useRef<Matter.Body[]>([]);
    const entitiesRef = useRef<Matter.Body[]>([]);
    const humanoidDataRef = useRef<HumanoidData[]>([]);
    const currentStrokeBodiesRef = useRef<Matter.Body[]>([]);

    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const isSpawningRef = useRef(true);

    // React State (UI only)
    const [cursorMode, setCursorMode] = useState<'draw' | 'grab' | 'eraser'>('draw');
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false); // Default unmuted, but soundManager starts unmuted check internal state

    // Toggle Pause/Play
    const togglePause = () => {
        const newState = !isPlaying;
        setIsPlaying(newState);
        isSpawningRef.current = newState; // Reuse ref for Logic (renaming ref would require more changes, treating as 'isActive')

        if (engineRef.current && runnerRef.current) {
            if (newState) {
                Matter.Runner.run(runnerRef.current, engineRef.current);
                if (!isMuted) soundManager.startBGM();
            } else {
                Matter.Runner.stop(runnerRef.current);
                soundManager.stopBGM();
            }
        }
    };

    const toggleMute = () => {
        soundManager.toggleMute();
        setIsMuted(soundManager.getMutedState());
        if (!soundManager.getMutedState()) {
            soundManager.startBGM();
        } else {
            soundManager.stopBGM();
        }
    };

    // Auto-start BGM on first interaction (optional or user-triggered)
    const handleFirstInteraction = () => {
        // soundManager.startBGM(); // Allow user to turn it on via button instead to avoid annoying auto-play
    };

    // Initialize Engine (Mount Once)
    useEffect(() => {
        if (!canvasRef.current) return;

        const { Engine, Render, Runner, World, Bodies, Events, MouseConstraint, Mouse, Query } = Matter;
        const canvas = canvasRef.current;
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || window.innerHeight;

        canvas.width = width;
        canvas.height = height;

        const engine = Engine.create({
            gravity: { x: 0, y: 1, scale: 0.001 }
        });
        engineRef.current = engine;

        const render = Render.create({
            canvas: canvas,
            engine: engine,
            options: {
                width,
                height,
                wireframes: false,
                background: '#89CFF0', // Sky Blue
            }
        });
        renderRef.current = render;

        // Ground (Visible) - Shifted Up for Toolbar
        const groundHeight = 80;
        const groundY = height - 120; // ツールバーのスペースを確保
        const ground = Bodies.rectangle(width / 2, groundY, width, groundHeight, {
            isStatic: true,
            label: 'Ground',
            render: {
                fillStyle: '#90EE90', // Light Green Grass
                strokeStyle: '#2E8B57', // Sea Green Border
                lineWidth: 2
            }
        });
        World.add(engine.world, [ground]);
        wallsRef.current.push(ground);

        // Initial Environment
        for (let i = 0; i < 4; i++) {
            const cloud = createCloudEntity(Math.random() * width, Math.random() * (height / 3));
            World.add(engine.world, cloud);
            entitiesRef.current.push(cloud);
        }
        for (let i = 0; i < 6; i++) {
            const bubble = createBubbleEntity(Math.random() * width, Math.random() * height);
            World.add(engine.world, bubble);
            entitiesRef.current.push(bubble);
        }

        // Try to start BGM if allowed
        if (!isMuted) soundManager.startBGM();

        // Mouse/Touch Constraint for 'Grab' mode
        const mouse = Mouse.create(render.canvas);
        const mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: { visible: false }
            }
        });
        mouseConstraintRef.current = mouseConstraint;
        // Note: We'll add/remove this from world based on mode in a separate useEffect

        const runner = Runner.create();
        runnerRef.current = runner;

        Render.run(render);
        Runner.run(runner, engine);

        // Rendering Loop for Humanoids
        Events.on(render, 'afterRender', () => {
            const context = render.context;
            if (!context) return;
            humanoidDataRef.current.forEach(data => {
                renderHumanoid(context, data.body, data.legPhase, data.direction, data.isClimbing || false);
            });
        });

        // AI & floating logic
        Events.on(engine, 'beforeUpdate', () => {
            const bodies = Matter.Composite.allBodies(engine.world);
            const humanoids = bodies.filter(b => (b as any).isHumanoid);
            const bubbles = bodies.filter(b => (b as any).isBubble);

            // Bubble capture logic
            humanoids.forEach(h => {
                if ((h as any).inBubble) return; // すでに中ならスキップ

                for (const b of bubbles) {
                    if ((b as any).containedEntity) continue; // 満員ならスキップ

                    const dist = Matter.Vector.magnitude(Matter.Vector.sub(h.position, b.position));
                    if (dist < 25) { // 衝突判定（小型化に合わせて調整）
                        (h as any).inBubble = true;
                        (b as any).containedEntity = h;
                        (h as any).inBubble = true;
                        (b as any).containedEntity = h;
                        h.collisionFilter.mask = 0x0001; // 地面(CATEGORY_DEFAULT)のみと衝突するように
                        soundManager.playPop(); // SE: Bubble Capture
                        break;
                    }
                }
            });

            // Question Block Logic
            const blocks = bodies.filter(b => (b as any).isQuestionBlock);
            if (blocks.length > 0) {
                const now = Date.now();
                const hitters = bodies.filter(b => !b.isStatic && !(b as any).isQuestionBlock && !(b as any).isCoin && !(b as any).isBubble);

                blocks.forEach(block => {
                    const blockData = block as any;
                    if (now - blockData.lastHitTime < 500) return; // Cooldown

                    for (const hitter of hitters) {
                        // Check if hitter is below block and moving up
                        if (hitter.position.y > block.position.y + 15 && hitter.velocity.y < -0.5) {
                            // Check horizontal overlap
                            if (Math.abs(hitter.position.x - block.position.x) < 25) {
                                // Simple distance check for triggering
                                const dist = Matter.Vector.magnitude(Matter.Vector.sub(hitter.position, block.position));
                                if (dist < 40) {
                                    // HIT!
                                    blockData.lastHitTime = now;
                                    soundManager.playCoin();

                                    // Spawn Coin
                                    const coin = createCoinEntity(block.position.x, block.position.y - 30);
                                    Matter.Body.setVelocity(coin, { x: (Math.random() - 0.5) * 2, y: -10 }); // Pop up!
                                    Matter.World.add(engine.world, coin);
                                    entitiesRef.current.push(coin);
                                    break;
                                }
                            }
                        }
                    }
                });
            }

            // Clean up fallen coins
            const coins = bodies.filter(b => (b as any).isCoin);
            coins.forEach(c => {
                if (c.position.y > engine.world.bounds.max.y + 100) {
                    Matter.World.remove(engine.world, c);
                }
            });

            bodies.forEach(body => {
                // Keep ladders and blocks upright
                if (body.label === 'Ladder' || body.label === 'FloatingBar' || body.label === 'QuestionBlock') {
                    Matter.Body.setAngle(body, 0);
                    Matter.Body.setAngularVelocity(body, 0);
                }

                // Bubble carrying logic
                if ((body as any).isBubble && (body as any).containedEntity) {
                    const h = (body as any).containedEntity;
                    // 小人を泡の真ん中に固定
                    Matter.Body.setPosition(h, body.position);
                    Matter.Body.setVelocity(h, body.velocity);
                }

                // Anti-gravity for floating objects (clouds, drawings, BUBBLES, LADDER TOP)
                // Note: FixedFloating handles its own anti-gravity by forcing position
                if (((body as any).isFloating && !(body as any).isFixedFloating) || (body as any).isBubble || (body as any).isOnLadderTop) {
                    Matter.Body.applyForce(body, body.position, {
                        x: 0,
                        y: -engine.gravity.y * engine.gravity.scale * body.mass
                    });
                }

                // Fixed Floating Logic (FloatingBar)
                if ((body as any).isFixedFloating) {
                    const isDragged = mouseConstraintRef.current?.body === body;

                    if (isDragged) {
                        // Update fixed position while dragging
                        (body as any).fixedPosition = { x: body.position.x, y: body.position.y };
                        // Apply Anti-gravity to make it light while dragging
                        Matter.Body.applyForce(body, body.position, {
                            x: 0,
                            y: -engine.gravity.y * engine.gravity.scale * body.mass
                        });
                    } else {
                        // Force position lock when not dragged
                        // This makes it act like a static body but movable logic allows simple state switch
                        const fixedPos = (body as any).fixedPosition;
                        if (fixedPos) {
                            Matter.Body.setPosition(body, fixedPos);
                            Matter.Body.setVelocity(body, { x: 0, y: 0 });
                            Matter.Body.setAngularVelocity(body, 0);
                        }
                    }
                }

                // Bubble Sway logic
                if ((body as any).isBubble) {
                    const time = engine.timing.timestamp;
                    Matter.Body.applyForce(body, body.position, {
                        x: Math.sin(time * 0.002) * 0.0005, // Gentle sway
                        y: -0.00005 // Slight updraft to ensure it rises slowly
                    });
                }
            });
        });

        // AI Tick
        const aiInterval = setInterval(() => {
            if (!isSpawningRef.current) return; // Paused
            humanoidDataRef.current.forEach(data => {
                const body = data.body;
                if (!body.position || (body as any).inBubble) return; // 泡の中ならAI停止

                // Ladder logic
                let isClimbing = false;
                let isOnLadderTop = false;
                const ladders = entitiesRef.current.filter(e => e.label === 'Ladder');

                for (const ladder of ladders) {
                    if (Matter.Bounds.overlaps(body.bounds, ladder.bounds)) {

                        // Check if at the top (Virtual Floor)
                        // Ladder Top Y is bounds.min.y. Body H is 40 (center -20). 
                        // If body.y < min.y + 30, we consider them "on top" or "exiting".
                        if (body.position.y < ladder.bounds.min.y + 20) {
                            isOnLadderTop = true;
                            // Allow walking on top
                            // We don't set isClimbing=true here, so the main walk logic below triggers!
                            // But we need to neutalize Y velocity drift? 
                            // Anti-gravity in beforeUpdate handles the force, 
                            // but we should damp Y velocity here to prevent bouncing.
                            Matter.Body.setVelocity(body, { x: body.velocity.x, y: body.velocity.y * 0.5 });
                        } else {
                            // Normal Climbing
                            isClimbing = true;
                            // Avoid ceiling
                            let headBlocked = Query.point(wallsRef.current, { x: body.position.x, y: body.position.y - 30 }).length > 0;
                            const vY = headBlocked ? 2 : -1.5;
                            Matter.Body.setVelocity(body, {
                                x: (ladder.position.x - body.position.x) * 0.2, // Stronger alignment
                                y: vY
                            });
                            data.legPhase += 0.2;
                        }
                        break;
                    }
                }

                (body as any).isOnLadderTop = isOnLadderTop;
                data.isClimbing = isClimbing;

                // Collision Filtering for Climbing through Platforms
                const defaultMask = 0x0001 | 0x0002 | 0x0020; // DEFAULT | DYNAMIC | PLATEFORM
                if (isClimbing && !isOnLadderTop) {
                    body.collisionFilter.mask = defaultMask & ~CATEGORY_PLATEFORM;
                } else {
                    body.collisionFilter.mask = defaultMask;
                }

                if (isClimbing) {
                    Matter.Body.setAngle(body, 0);
                    return;
                }

                // Walk logic
                Matter.Body.setAngle(body, 0);
                Matter.Body.setVelocity(body, { x: data.direction * 2, y: body.velocity.y });

                // Stuck detection
                if (Math.abs(body.velocity.x) < 0.5 && Math.abs(body.velocity.y) < 0.1) {
                    data.stuckCounter++;
                    if (data.stuckCounter > 30) {
                        data.direction *= -1;
                        data.stuckCounter = 0;
                        Matter.Body.applyForce(body, body.position, { x: data.direction * 0.03, y: -0.1 });
                    }
                } else {
                    data.stuckCounter = 0;
                }
                data.legPhase += 0.2;

                // Footstep sound
                const currentLegInteger = Math.floor(data.legPhase);
                const previousLegInteger = Math.floor(data.legPhase - 0.2); // Approximate previous state
                if (currentLegInteger !== previousLegInteger && Math.abs(body.velocity.x) > 0.5) {
                    soundManager.playFootstep();
                }


                // Jump logic (Obstacle)
                const isBlockedFront = Query.point(wallsRef.current, { x: body.position.x + data.direction * 50, y: body.position.y }).length > 0;
                if (isBlockedFront && Math.abs(body.velocity.y) < 0.1) {
                    Matter.Body.applyForce(body, body.position, { x: data.direction * 0.04, y: -0.12 });
                    soundManager.playJump(); // SE: Jump
                } else if (Math.random() < 0.02 && Math.abs(body.velocity.y) < 0.1) {
                    // Random Jump (2% probability)
                    Matter.Body.applyForce(body, body.position, {
                        x: 0,
                        y: -0.08 // Slightly weaker than obstacle jump
                    });
                    soundManager.playJump(); // SE: Jump
                }
            });
        }, 100);

        // Spawn Tick
        const spawnInterval = setInterval(() => {
            if (!isSpawningRef.current) return;
            if (Math.random() > 0.4) {
                const isHumanoid = Math.random() > 0.5;
                if (isHumanoid) {
                    const spawn = getHumanoidSpawnPosition(width, height);
                    const body = createHumanoidEntity(spawn.x, spawn.y);
                    World.add(engine.world, body);
                    entitiesRef.current.push(body);
                    humanoidDataRef.current.push({ body, direction: spawn.direction, legPhase: 0, stuckCounter: 0 });
                    soundManager.playSpawn(); // SE: Spawn

                } else {
                    const spawn = getRandomSpawnPosition(width, height);
                    const body = createEntity(spawn.x, spawn.y);
                    Matter.Body.setVelocity(body, { x: spawn.vx, y: spawn.vy });
                    World.add(engine.world, body);
                    entitiesRef.current.push(body);
                }
            }
        }, 2000);

        // Cleanup Tick
        const cleanupInterval = setInterval(() => {
            entitiesRef.current = entitiesRef.current.filter(body => {
                if (body.position.y > height + 200 || body.position.x < -200 || body.position.x > width + 200) {
                    // If a bubble with a contained entity is removed, play bubble pop sound
                    if ((body as any).isBubble && (body as any).containedEntity) {
                        soundManager.playBubblePop();
                    }
                    World.remove(engine.world, body);
                    const idx = humanoidDataRef.current.findIndex(d => d.body === body);
                    if (idx > -1) humanoidDataRef.current.splice(idx, 1);
                    return false;
                }
                return true;
            });
        }, 5000);

        // Resize
        const ob = new ResizeObserver(() => {
            const w = canvas.clientWidth || window.innerWidth;
            const h = canvas.clientHeight || window.innerHeight;
            canvas.width = w;
            canvas.height = h;
            render.options.width = w;
            render.options.height = h;
            Matter.Body.setPosition(ground, { x: w / 2, y: h - 120 });
            Matter.Body.setVertices(ground, Matter.Bodies.rectangle(w / 2, h - 120, w, groundHeight).vertices); // 幅変更対応
        });
        ob.observe(canvas);

        return () => {
            clearInterval(aiInterval);
            clearInterval(spawnInterval);
            clearInterval(cleanupInterval);
            ob.disconnect();
            Render.stop(render);
            Runner.stop(runner);
            World.clear(engine.world, false);
            Engine.clear(engine);
        };
    }, []);

    // Mode Sidebar Side-effect
    useEffect(() => {
        if (!engineRef.current || !mouseConstraintRef.current) return;
        if (cursorMode === 'grab') {
            Matter.World.add(engineRef.current.world, mouseConstraintRef.current);
        } else {
            Matter.World.remove(engineRef.current.world, mouseConstraintRef.current);
        }
    }, [cursorMode]);

    // Handlers
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!canvasRef.current || !engineRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (cursorMode === 'eraser') {
            eraseAt(x, y);
            isDrawingRef.current = true;
        } else if (cursorMode === 'draw') {
            isDrawingRef.current = true;
            lastPointRef.current = { x, y };
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current || !canvasRef.current || !engineRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (cursorMode === 'eraser') {
            eraseAt(x, y);
        } else if (cursorMode === 'draw' && lastPointRef.current) {
            const lp = lastPointRef.current;
            const d = Math.hypot(x - lp.x, y - lp.y);
            const steps = Math.max(1, Math.floor(d / 2));
            for (let i = 0; i < steps; i++) {
                const px = lp.x + (x - lp.x) * (i / steps);
                const py = lp.y + (y - lp.y) * (i / steps);
                const part = Matter.Bodies.circle(px, py, 3, {
                    isStatic: true,
                    render: { fillStyle: '#ffffff' }
                });
                Matter.World.add(engineRef.current.world, part);
                currentStrokeBodiesRef.current.push(part);
            }
            lastPointRef.current = { x, y };
        }
    };

    const handlePointerUp = () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        if (cursorMode === 'draw' && currentStrokeBodiesRef.current.length > 0 && engineRef.current) {
            const parts = currentStrokeBodiesRef.current;
            parts.forEach(p => Matter.World.remove(engineRef.current!.world, p));

            const compound = Matter.Body.create({
                parts: parts.map(p => Matter.Bodies.circle(p.position.x, p.position.y, 3, { render: p.render })),
                isStatic: false,
                frictionAir: 0.1,
                restitution: 0.1
            });
            (compound as any).isFloating = true;
            Matter.World.add(engineRef.current.world, compound);
            wallsRef.current.push(compound); // Eligible for eraser
            currentStrokeBodiesRef.current = [];
        }
        lastPointRef.current = null;
    };

    const eraseAt = (x: number, y: number) => {
        if (!engineRef.current) return;
        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        const hits = Matter.Query.point(bodies, { x, y });
        hits.forEach(b => {
            if (b.label !== 'Ground' && b.label !== 'Ladder') {
                // If a bubble with a contained entity is removed, play bubble pop sound
                if ((b as any).isBubble && (b as any).containedEntity) {
                    soundManager.playBubblePop();
                }
                Matter.World.remove(engineRef.current!.world, b);
                // Clean lists
                entitiesRef.current = entitiesRef.current.filter(e => e !== b);
                wallsRef.current = wallsRef.current.filter(w => w !== b);
                humanoidDataRef.current = humanoidDataRef.current.filter(d => d.body !== b);
            }
        });
    };

    const handleClear = () => {
        if (!engineRef.current) return;
        wallsRef.current.forEach(w => Matter.World.remove(engineRef.current!.world, w));
        wallsRef.current = [];
        onClear();
    };

    // 大きくしたボタンスタイル
    const btnStyle = (active: boolean) => ({
        padding: '0 24px', // 横幅を広げる
        height: '60px',    // 高さを60pxに固定（タップしやすく）
        fontSize: '20px',  // 文字サイズアップ
        backgroundColor: active ? '#ffffff' : 'rgba(255, 255, 255, 0.3)', // アクティブは白、非アクティブは半透明白
        color: active ? '#555555' : '#ffffff', // テキスト色調整
        border: active ? '4px solid #FFD700' : '3px solid rgba(255, 255, 255, 0.8)', // 枠線調整
        borderRadius: '30px', // 丸みを強く
        cursor: 'pointer',
        fontWeight: 'bold' as const,
        touchAction: 'manipulation' as const,
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as const,
        WebkitTouchCallout: 'none' as const, // iOSで長押しメニューを出さない
        flexShrink: 0,
        whiteSpace: 'nowrap' as const,
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)', // 影を強く
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    });

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ width: '100%', height: '100%', touchAction: 'none' }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: '0',
                    left: 0,
                    width: '100%',
                    height: '120px', // 地面と同じ高さに合わせる
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    paddingBottom: '0',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)', // 明るい半透明
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderTop: '2px solid rgba(255, 255, 255, 0.5)',
                    zIndex: 20, // 地面より手前に
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                <div style={{
                    display: 'inline-flex',
                    gap: '16px', // 間隔を広げる
                    padding: '0 24px',
                    minWidth: 'max-content',
                    height: '100%',
                    alignItems: 'center'
                }}>
                    <button onClick={togglePause} style={btnStyle(!isPlaying)}>
                        {isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <button onClick={() => {
                        const width = canvasRef.current?.width || 800;
                        const spawn = getHumanoidSpawnPosition(width, 600);
                        const body = createHumanoidEntity(spawn.x, spawn.y);
                        Matter.World.add(engineRef.current!.world, body);
                        entitiesRef.current.push(body);
                        humanoidDataRef.current.push({ body, direction: spawn.direction, legPhase: 0, stuckCounter: 0 });
                        soundManager.playSpawn();
                    }} style={btnStyle(false)}>🚶</button>

                    <button onClick={() => {
                        const width = canvasRef.current?.width || 800;
                        const randomX = width / 2 + (Math.random() - 0.5) * 200; // Random X offset
                        const ladder = createLadderEntity(randomX, 200);
                        Matter.World.add(engineRef.current!.world, ladder);
                        entitiesRef.current.push(ladder);
                        soundManager.playSpawn();
                    }} style={btnStyle(false)}>🪜</button>

                    <button onClick={() => {
                        const spawn = getRandomSpawnPosition(canvasRef.current?.width || 800, 600);
                        const body = createBubbleEntity(spawn.x, spawn.y);
                        Matter.World.add(engineRef.current!.world, body);
                        entitiesRef.current.push(body);
                        soundManager.playSpawn();
                    }} style={btnStyle(false)}>🫧</button>

                    <button onClick={() => {
                        const spawn = getRandomSpawnPosition(canvasRef.current?.width || 800, 600);
                        const body = createEntity(spawn.x, spawn.y);
                        Matter.Body.setVelocity(body, { x: spawn.vx, y: spawn.vy });
                        Matter.World.add(engineRef.current!.world, body);
                        entitiesRef.current.push(body);
                        soundManager.playSpawn();
                    }} style={btnStyle(false)}>⚽</button>

                    <button onClick={() => {
                        const width = canvasRef.current?.width || 800;
                        const height = canvasRef.current?.height || 600;
                        const randomX = width / 2 + (Math.random() - 0.5) * 200; // Random X offset
                        const bar = createFloatingBarEntity(randomX, height / 2);
                        Matter.World.add(engineRef.current!.world, bar);
                        entitiesRef.current.push(bar);
                        soundManager.playSpawn();
                    }} style={btnStyle(false)}>🪵</button>

                    <button onClick={() => {
                        const width = canvasRef.current?.width || 800;
                        const height = canvasRef.current?.height || 600;
                        const randomX = width / 2 + (Math.random() - 0.5) * 200;
                        const block = createQuestionBlockEntity(randomX, height / 2 - 100);
                        Matter.World.add(engineRef.current!.world, block);
                        entitiesRef.current.push(block);
                        soundManager.playSpawn();
                    }} style={btnStyle(false)}>📦</button>

                    <button onClick={() => setCursorMode('draw')} style={btnStyle(cursorMode === 'draw')}>✏️</button>
                    <button onClick={() => setCursorMode('grab')} style={btnStyle(cursorMode === 'grab')}>✋</button>
                    <button onClick={() => setCursorMode('eraser')} style={btnStyle(cursorMode === 'eraser')}>🧹</button>
                    <button onClick={handleClear} style={btnStyle(false)}>🗑️</button>

                    {/* Mute Button */}
                    <button
                        onPointerDown={toggleMute}
                        style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            backgroundColor: isMuted ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.8)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '30px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                            flexShrink: 0
                        }}
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                div::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default PhysicsCanvas;
