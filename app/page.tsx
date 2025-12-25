'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// =========================================================
// 定数・設定
// =========================================================
const OBSTACLES = [
  new THREE.Vector3(0, 0, 0),      // Tree center
  new THREE.Vector3(-2.5, 0, 1.0), // Mint
  new THREE.Vector3(3.5, 0, -1.0), // Kariage
  new THREE.Vector3(0, 0, 2.5),    // Red
  new THREE.Vector3(1.0, 0, 0),    // Yellow
  new THREE.Vector3(4.0, 0, 2.0),  // Kuro
];

const SAFE_DISTANCE = 1.2; // 障害物判定の距離
const MOVE_SPEED = 0.008; 
const ACTION_RADIUS = 5.0;
const CLIMB_OFFSET = 0.3; // 時計の上に乗った時の浮く高さ

type ActionState = 'walk1' | 'walk2' | 'walk3' | 'idleForWatch';

// =========================================================
// 1. 背景と木
// =========================================================
function SceneEnvironment() {
  const { scene: treeScene } = useGLTF('/models/tree.glb');
  
  // 木にも当たり判定用の名前をつける
  useEffect(() => {
    treeScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData = { isObstacle: true }; // 障害物タグ
      }
    });
  }, [treeScene]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#a3b08d" roughness={0.8} metalness={0.1} />
      </mesh>
      <primitive object={treeScene} position={[0, 0, 0]} scale={2.0} />
      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={20} blur={2.5} far={4.5} />
    </group>
  );
}

// =========================================================
// 2. Watces (時計) - 地形認識対応
// =========================================================
function Watces({ position }: { position: [number, number, number] }) {
  const { scene } = useGLTF('/models/watces.glb');

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
        // ★重要: レイキャスト（足元の地形判定）のためにタグ付け
        child.userData = { isWalkable: true }; 
        child.name = 'watch_surface';
      }
    });
  }, [scene]);

  return <primitive object={scene} position={position} scale={2.0} />;
}

// =========================================================
// 3. Hedoban (AIフル装備)
// =========================================================
function Hedoban({ initialPosition }: { initialPosition: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/hedoban.glb');
  
  // Three.jsのシーン全体を取得（レイキャスト用）
  const { scene: globalScene } = useThree();

  // アニメーションの移動成分削除（その場歩き化）
  const cleanAnimations = useMemo(() => {
    const clonedAnimations = animations.map((clip) => clip.clone());
    const walkClip = clonedAnimations.find((clip) => clip.name === 'walk');
    if (walkClip) {
      walkClip.tracks = walkClip.tracks.filter((track) => !track.name.endsWith('.position'));
    }
    return clonedAnimations;
  }, [animations]);

  const { actions } = useAnimations(cleanAnimations, group);
  
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  
  // 状態管理
  const currentStateStr = useRef<ActionState>('idleForWatch');
  const currentActionAnim = useRef<THREE.AnimationAction | null>(null);
  
  // 移動管理
  const currentPos = useRef(new THREE.Vector3(...initialPosition));
  const targetPos = useRef<THREE.Vector3 | null>(null);
  
  // ★スタック（ハマり）検知用
  const lastFramePos = useRef(new THREE.Vector3(...initialPosition));
  const stuckCounter = useRef(0);

  // ★レイキャスト（足元の地形判定）用
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const downVector = useMemo(() => new THREE.Vector3(0, -1, 0), []);

  // 影の設定
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
  }, [scene]);

  const fadeToAction = useCallback((animName: string, duration: number = 0.5) => {
    const newAction = actions[animName];
    if (!newAction || currentActionAnim.current === newAction) return;
    if (currentActionAnim.current) currentActionAnim.current.fadeOut(duration);
    newAction.reset().setEffectiveTimeScale(1.0).fadeIn(duration).play();
    currentActionAnim.current = newAction;
  }, [actions]);

  // 目的地決定（障害物から離れた位置を探す）
  const findSafeTarget = useCallback((): THREE.Vector3 => {
    let safePos: THREE.Vector3 | null = null;
    let attempts = 0;
    while (!safePos && attempts < 30) {
      attempts++;
      const r = Math.random() * ACTION_RADIUS;
      const theta = Math.random() * Math.PI * 2;
      const candidate = new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      // 固定障害物との距離チェック
      const isSafe = OBSTACLES.every(obstacle => candidate.distanceTo(obstacle) > SAFE_DISTANCE);
      if (isSafe) safePos = candidate;
    }
    return safePos || currentPos.current.clone();
  }, []);

  // 次の行動を決定
  const decideNextAction = useCallback(() => {
    let nextState: ActionState;
    let attempts = 0;
    
    // ★修正1: 同じ行動を繰り返さないロジック
    do {
      const rand = Math.random();
      if (rand < 0.25) nextState = 'idleForWatch';
      else if (rand < 0.5) nextState = 'walk1';
      else if (rand < 0.75) nextState = 'walk2';
      else nextState = 'walk3';
      attempts++;
    } while (nextState === currentStateStr.current && attempts < 5); // 前回と同じならやり直し

    currentStateStr.current = nextState;
    stuckCounter.current = 0; // スタックカウンターリセット

    if (nextState === 'idleForWatch') {
      targetPos.current = null;
      setBubbleText("砂時計見よっと");
      fadeToAction('idle');
      setTimeout(decideNextAction, 4000);
    } else {
      targetPos.current = findSafeTarget();
      fadeToAction('walk');
      // 向き調整
      if (group.current && targetPos.current) {
        group.current.lookAt(targetPos.current.x, group.current.position.y, targetPos.current.z);
      }
      // セリフ
      switch (nextState) {
        case 'walk1': setBubbleText("いいお天気"); break;
        case 'walk2': setBubbleText("お散歩しよっと"); break;
        case 'walk3': setBubbleText("いいことありそう"); break;
      }
    }
  }, [fadeToAction, findSafeTarget]);

  // 初期化
  useEffect(() => {
    if (group.current) group.current.position.set(...initialPosition);
    if (actions['idle']) {
      actions['idle'].reset().play();
      currentActionAnim.current = actions['idle'];
    }
    const timer = setTimeout(decideNextAction, 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------
  // 毎フレームの物理・AI計算
  // -------------------------------------------------------------
  useFrame(() => {
    if (!group.current) return;

    // --- 1. 移動処理 ---
    if (targetPos.current) {
      // ベクトル計算
      const direction = targetPos.current.clone().sub(currentPos.current);
      const distance = direction.length();

      // ★修正2: スタック検知（移動中なのに座標が変わっていない場合）
      const movedDistance = currentPos.current.distanceTo(lastFramePos.current);
      if (movedDistance < 0.001) {
        stuckCounter.current++;
        if (stuckCounter.current > 60) { // 約1秒間ハマり続けたら
          // 強制的に目的地を変更して脱出
          targetPos.current = null;
          decideNextAction();
          return;
        }
      } else {
        stuckCounter.current = 0;
      }
      lastFramePos.current.copy(currentPos.current);

      if (distance > MOVE_SPEED) {
        // ★修正4: 衝突回避（Repulsion Force）
        // 障害物に近づきすぎたら反発力を加えて避ける
        const repulsion = new THREE.Vector3(0, 0, 0);
        OBSTACLES.forEach(obstacle => {
          const distToObstacle = currentPos.current.distanceTo(obstacle);
          if (distToObstacle < SAFE_DISTANCE) {
            // 障害物から自分へのベクトル
            const push = currentPos.current.clone().sub(obstacle).normalize();
            // 近いほど強く押す
            const force = (SAFE_DISTANCE - distToObstacle) * 0.05; 
            repulsion.add(push.multiplyScalar(force));
          }
        });

        // 本来の進行方向 + 反発力
        direction.normalize().multiplyScalar(MOVE_SPEED);
        direction.add(repulsion); // 合成
        
        // Y軸の移動は無視（地形判定に任せる）
        direction.y = 0;

        currentPos.current.add(direction);
        
        // 進行方向を向く（反発力で向きが変わるため毎フレーム更新）
        const lookAtTarget = currentPos.current.clone().add(direction);
        group.current.lookAt(lookAtTarget.x, group.current.position.y, lookAtTarget.z);

      } else {
        // 到着
        currentPos.current.copy(targetPos.current);
        targetPos.current = null;
        decideNextAction();
      }
    }

    // --- 3. 地形判定（Raycast）で高さを合わせる ---
    // 足元少し上から下に向けてレイを撃つ
    const rayOrigin = currentPos.current.clone();
    rayOrigin.y += 1.0; 
    raycaster.set(rayOrigin, downVector);

    // シーン内の「isWalkable」なオブジェクトと交差判定
    // filterを使って時計のメッシュだけを対象にする
    const intersects = raycaster.intersectObjects(globalScene.children, true);
    
    // 時計（watch_surface）に当たったか探す
    const hitWatch = intersects.find(hit => hit.object.userData.isWalkable);

    let targetY = 0; // 地面
    if (hitWatch) {
      // 時計の上なら、その表面の高さ + オフセット
      targetY = hitWatch.point.y + CLIMB_OFFSET;
    }

    // 高さをスムーズに補間（階段を登るように）
    currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, targetY, 0.2);

    // 最終的な座標を適用
    group.current.position.copy(currentPos.current);
  });

  return (
    <group ref={group}>
      <primitive object={scene} scale={1.8} />
      {bubbleText && (
        <Html position={[0, 2.2, 0]} center>
          <div style={{
            background: 'white', padding: '8px 12px', borderRadius: '16px', color: '#333',
            whiteSpace: 'nowrap', fontSize: '12px', fontFamily: 'sans-serif', fontWeight: 'bold',
            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', position: 'relative', border: '1px solid #ddd'
          }}>
            {bubbleText}
            <div style={{
              position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
              borderTop: '6px solid white'
            }} />
          </div>
        </Html>
      )}
    </group>
  );
}

// =========================================================
// 他キャラクター (変更なし)
// =========================================================
function Mint({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/mint.glb');
  const { actions } = useAnimations(animations, group);
  const [showBubble, setShowBubble] = useState(false);
  useEffect(() => {
    scene.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = false; } });
    let timeoutId: NodeJS.Timeout;
    const playSequence = async () => {
      const randomWait = Math.random() * 5000 + 5000; 
      const a1 = actions['sleepidle']; const a2 = actions['sleeping'];
      if(a1) a1.reset().fadeIn(0.5).play(); if(a2) a2.fadeOut(0.5);
      timeoutId = setTimeout(() => {
        if(a1) a1.fadeOut(0.5); if(a2) a2.reset().fadeIn(0.5).play();
        timeoutId = setTimeout(() => { playSequence(); }, 17700);
      }, randomWait);
    };
    playSequence(); return () => clearTimeout(timeoutId);
  }, [actions, scene]);
  useEffect(() => {
    let bubbleTimeoutId: NodeJS.Timeout;
    const scheduleBubble = () => {
      const randomInterval = Math.random() * 10000 + 20000;
      bubbleTimeoutId = setTimeout(() => {
        setShowBubble(true); 
        setTimeout(() => { setShowBubble(false); scheduleBubble(); }, 4000); 
      }, randomInterval);
    };
    scheduleBubble(); return () => clearTimeout(bubbleTimeoutId);
  }, []);
  return (
    <group ref={group} position={position}>
      <primitive object={scene} scale={1.8} />
      {showBubble && (
        <Html position={[0, 1.2, 0]} center>
          <div style={{
            background: 'white', padding: '10px 16px', borderRadius: '20px', color: 'black',
            whiteSpace: 'nowrap', fontSize: '14px', fontFamily: 'sans-serif', fontWeight: 'normal',
            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', position: 'relative'
          }}>
            あしたから本気だす
            <div style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid white' }} />
          </div>
        </Html>
      )}
    </group>
  );
}
function Kariage({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/kariage.glb');
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    scene.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = false; } });
    const action = actions['sitting']; if (action) action.reset().fadeIn(0.5).play(); return () => { if (action) action.fadeOut(0.5); };
  }, [actions, scene]);
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}
function Red({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/red.glb');
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    scene.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = false; } });
    const action = actions['laying']; if (action) action.reset().fadeIn(0.5).play(); return () => { if (action) action.fadeOut(0.5); };
  }, [actions, scene]);
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}
function Yellow({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/yellow.glb');
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    scene.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = false; } });
    const anim = actions['idle01']; if (anim) anim.reset().fadeIn(0.5).play(); return () => { anim?.fadeOut(0.5); };
  }, [actions, scene]);
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}
function Kuro({ position }: { position: [number, number, number] }) {
  const modelRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/kuro.glb');
  const { actions } = useAnimations(animations, modelRef);
  useEffect(() => {
    scene.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = false; } });
    const anim = actions['teeder']; if (anim) anim.reset().fadeIn(0.5).play(); return () => { anim?.fadeOut(0.5); };
  }, [actions, scene]);
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.35, 0.3, 32]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <primitive ref={modelRef} object={scene} position={[0, 0.3, 0]} scale={1.8} />
    </group>
  );
}

// =========================================================
// 雲の設定
// =========================================================
const useCloudMaterial = (scene: THREE.Group) => {
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false; mesh.receiveShadow = false;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => { mat.transparent = true; mat.opacity = 0.4; mat.depthWrite = false; });
      }
    });
  }, [scene]);
};
function FloatingCloud1() {
  const group = useRef<THREE.Group>(null);
  const { scene: originalScene } = useGLTF('/models/cloud.glb');
  const scene = useMemo(() => originalScene.clone(), [originalScene]);
  useCloudMaterial(scene);
  const startPos = new THREE.Vector3(-25, 10, -15);
  useEffect(() => { if (group.current) group.current.position.copy(startPos); }, []);
  useFrame(() => {
    if (!group.current) return;
    group.current.position.x += 0.02; group.current.position.y -= 0.001; group.current.position.z += 0.005;
    if (group.current.position.x > 35) group.current.position.copy(startPos);
  });
  return (
    <group ref={group}>
      <primitive object={scene} scale={2.5} />
      <ContactShadows position={[0, -10, 0]} opacity={0.15} scale={8} blur={4} far={20} color="#5a665e" />
    </group>
  );
}
function FloatingCloud2() {
  const group = useRef<THREE.Group>(null);
  const { scene: originalScene } = useGLTF('/models/cloud.glb');
  const scene = useMemo(() => originalScene.clone(), [originalScene]);
  useCloudMaterial(scene);
  const nextStartFromLeftMid = useRef(false);
  const startPosRight = new THREE.Vector3(15, 6, 10);
  const startPosLeftMid = new THREE.Vector3(-30, 8, 0);
  useEffect(() => { if (group.current) group.current.position.copy(startPosRight); }, []);
  useFrame(() => {
    if (!group.current) return;
    group.current.position.x += 0.025; group.current.position.y -= 0.0015; group.current.position.z += 0.004;
    if (group.current.position.x > 40) {
      if (nextStartFromLeftMid.current) { group.current.position.copy(startPosLeftMid); nextStartFromLeftMid.current = false; }
      else { group.current.position.copy(startPosRight); nextStartFromLeftMid.current = true; }
    }
  });
  return (
    <group ref={group}>
      <primitive object={scene} scale={2.0} />
      <ContactShadows position={[0, -7, 0]} opacity={0.15} scale={6} blur={4} far={20} color="#5a665e" />
    </group>
  );
}

// =========================================================
// メインページ
// =========================================================
export default function Home() {
  const [zoom, setZoom] = useState(80);
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setZoom(isMobile ? 55 : 80);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const redPos = new THREE.Vector3(0, 0, 2.5);
  const yellowPos = new THREE.Vector3(1.0, 0, 0);
  const hedobanInitPos = new THREE.Vector3().addVectors(redPos, yellowPos).multiplyScalar(0.5);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#c9d1b8', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 10, pointerEvents: 'none', textAlign: 'center', width: '100%',
      }}>
        <h1 style={{
          color: '#ff6e6e', fontSize: 'clamp(24px, 5vw, 42px)', fontFamily: '"Times New Roman", Times, serif',
          fontWeight: 'normal', letterSpacing: '0.05em', textShadow: '0px 1px 2px rgba(0,0,0,0.1)'
        }}>We are doing nothing.</h1>
      </div>

      <Canvas shadows>
        <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={zoom} near={0.1} far={200} onUpdate={c => c.lookAt(0, 2.5, 0)} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-top={25} shadow-camera-right={25} shadow-camera-bottom={-25} shadow-camera-left={-25} shadow-camera-far={50} shadow-bias={-0.0001} />

        <Suspense fallback={null}>
          <SceneEnvironment />
          <Watces position={[0, 0, 0]} />

          <Mint position={[-2.5, 0, 1.0]} />
          <Kariage position={[3.5, 0, -1.0]} />
          <Red position={[0, 0, 2.5]} />
          <Yellow position={[1.0, 0, 0]} />
          <Kuro position={[4.0, 0, 2.0]} />

          <Hedoban initialPosition={[hedobanInitPos.x, hedobanInitPos.y, hedobanInitPos.z]} />

          <FloatingCloud1 />
          <FloatingCloud2 />
        </Suspense>
      </Canvas>
    </div>
  );
}
