'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// =========================================================
// 定数・設定
// =========================================================
const OBSTACLES = [
  new THREE.Vector3(0, 0, 0),      // Tree & Watches center
  new THREE.Vector3(-2.5, 0, 1.0), // Mint
  new THREE.Vector3(3.5, 0, -1.0), // Kariage
  new THREE.Vector3(0, 0, 2.5),    // Red
  new THREE.Vector3(1.0, 0, 0),    // Yellow
  new THREE.Vector3(4.0, 0, 2.0),  // Kuro
];
const SAFE_DISTANCE = 1.5; 
const MOVE_SPEED = 0.008; // ゆっくり歩く
const WATCH_AREA_RADIUS = 2.0; 
const FLOAT_HEIGHT = 0.3; 
const ACTION_RADIUS = 5.0;

type ActionState = 'walk1' | 'walk2' | 'walk3' | 'idleForWatch';

// =========================================================
// 1. 背景と木
// =========================================================
function SceneEnvironment() {
  const { scene: treeScene } = useGLTF('/models/tree.glb');
  treeScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true; 
    }
  });
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
// 2. Watces (時計)
// =========================================================
function Watces({ position }: { position: [number, number, number] }) {
  const { scene } = useGLTF('/models/watces.glb');
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
  }, [scene]);
  return <primitive object={scene} position={position} scale={2.0} />;
}

// =========================================================
// 3. Hedoban (自律行動AI + その場歩き強制修正)
// =========================================================
function Hedoban({ initialPosition }: { initialPosition: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/hedoban.glb');

  // -------------------------------------------------------
  // ★重要修正: アニメーションデータのクレンジング
  // useAnimationsに渡す「前」に、移動情報を削除した新しいアニメーションデータを作成します
  // -------------------------------------------------------
  const cleanAnimations = useMemo(() => {
    // 元のデータを汚さないように複製
    const clonedAnimations = animations.map((clip) => clip.clone());

    // 'walk' アニメーションを探す
    const walkClip = clonedAnimations.find((clip) => clip.name === 'walk');

    if (walkClip) {
      // トラック（動きのデータ）の中から、'.position'（位置移動）を含むものを全て除外する
      // これにより、腰やルートボーンの移動がなくなり、完全な「その場歩き」になります
      walkClip.tracks = walkClip.tracks.filter((track) => !track.name.endsWith('.position'));
    }

    return clonedAnimations;
  }, [animations]);

  // ★修正後の cleanAnimations を使ってアクションを作成
  const { actions } = useAnimations(cleanAnimations, group);
  
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const currentStateStr = useRef<ActionState>('idleForWatch');
  const currentActionAnim = useRef<THREE.AnimationAction | null>(null);

  const currentPos = useRef(new THREE.Vector3(...initialPosition));
  const targetPos = useRef<THREE.Vector3 | null>(null);

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

    if (currentActionAnim.current) {
      currentActionAnim.current.fadeOut(duration);
    }
    // アニメーション速度調整 (少しゆっくり歩かせるなど)
    newAction.reset().setEffectiveTimeScale(1.0).fadeIn(duration).play();
    currentActionAnim.current = newAction;
  }, [actions]);

  const findSafeTarget = useCallback((): THREE.Vector3 => {
    let safePos: THREE.Vector3 | null = null;
    let attempts = 0;
    while (!safePos && attempts < 30) {
      attempts++;
      const r = Math.random() * ACTION_RADIUS;
      const theta = Math.random() * Math.PI * 2;
      const candidate = new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r);
      const isSafe = OBSTACLES.every(obstacle => candidate.distanceTo(obstacle) > SAFE_DISTANCE);
      if (isSafe) safePos = candidate;
    }
    return safePos || currentPos.current.clone();
  }, []);

  const decideNextAction = useCallback(() => {
    const rand = Math.random();
    let nextState: ActionState;

    if (rand < 0.25) nextState = 'idleForWatch';
    else if (rand < 0.5) nextState = 'walk1';
    else if (rand < 0.75) nextState = 'walk2';
    else nextState = 'walk3';

    currentStateStr.current = nextState;

    if (nextState === 'idleForWatch') {
      targetPos.current = null;
      setBubbleText("砂時計見よっと");
      fadeToAction('idle');
      setTimeout(decideNextAction, 4000);
    } else {
      targetPos.current = findSafeTarget();
      fadeToAction('walk'); // ここで再生されるのは「移動削除済み」のwalkです
      if (group.current && targetPos.current) {
        group.current.lookAt(targetPos.current.x, group.current.position.y, targetPos.current.z);
      }
      switch (nextState) {
        case 'walk1': setBubbleText("いいお天気"); break;
        case 'walk2': setBubbleText("お散歩しよっと"); break;
        case 'walk3': setBubbleText("いいことありそう"); break;
      }
    }
  }, [fadeToAction, findSafeTarget]);

  // 初期化：Tポーズ対策
  useEffect(() => {
    if (group.current) {
      group.current.position.set(...initialPosition);
    }
    // 即座にIdle再生
    if (actions['idle']) {
      actions['idle'].reset().play();
      currentActionAnim.current = actions['idle'];
    }
    const timer = setTimeout(decideNextAction, 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (!group.current) return;
    if (targetPos.current) {
      const direction = targetPos.current.clone().sub(currentPos.current);
      const distance = direction.length();
      if (distance > MOVE_SPEED) {
        direction.normalize().multiplyScalar(MOVE_SPEED);
        currentPos.current.add(direction);
      } else {
        currentPos.current.copy(targetPos.current);
        targetPos.current = null;
        decideNextAction();
      }
    }
    const distFromCenter = Math.sqrt(currentPos.current.x ** 2 + currentPos.current.z ** 2);
    let targetY = 0;
    if (distFromCenter < WATCH_AREA_RADIUS) {
      targetY = FLOAT_HEIGHT;
    }
    currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, targetY, 0.1);
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
// 他キャラクター (Mint, Kariage, Red, Yellow, Kuro)
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
