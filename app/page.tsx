'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------
// 1. 背景と木
// ---------------------------------------------------------
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
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#a3b08d" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* 木 */}
      <primitive object={treeScene} position={[0, 0, 0]} scale={2.0} />
      {/* 木の根元用の接地影（これはそのまま） */}
      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={20} blur={2.5} far={4.5} />
    </group>
  );
}

// ---------------------------------------------------------
// キャラクターコンポーネント (変更なし)
// ---------------------------------------------------------
function Mint({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/mint.glb');
  const { actions } = useAnimations(animations, group);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false; 
      }
    });

    let timeoutId: NodeJS.Timeout;
    const playSequence = async () => {
      const randomWait = Math.random() * 5000 + 5000; 
      const a1 = actions['sleepidle'];
      const a2 = actions['sleeping'];
      if(a1) a1.reset().fadeIn(0.5).play();
      if(a2) a2.fadeOut(0.5);
      timeoutId = setTimeout(() => {
        if(a1) a1.fadeOut(0.5);
        if(a2) a2.reset().fadeIn(0.5).play();
        timeoutId = setTimeout(() => {
          playSequence();
        }, 17700);
      }, randomWait);
    };
    playSequence();
    return () => clearTimeout(timeoutId);
  }, [actions, scene]);

  useEffect(() => {
    let bubbleTimeoutId: NodeJS.Timeout;
    const scheduleBubble = () => {
      const randomInterval = Math.random() * 10000 + 20000;
      bubbleTimeoutId = setTimeout(() => {
        setShowBubble(true); 
        setTimeout(() => {
          setShowBubble(false);
          scheduleBubble(); 
        }, 4000); 
      }, randomInterval);
    };
    scheduleBubble();
    return () => clearTimeout(bubbleTimeoutId);
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
            <div style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
              borderTop: '8px solid white' }} />
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
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
    const action = actions['sitting'];
    if (action) action.reset().fadeIn(0.5).play();
    return () => { if (action) action.fadeOut(0.5); };
  }, [actions, scene]);
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

function Red({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/red.glb');
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
    const action = actions['laying'];
    if (action) action.reset().fadeIn(0.5).play();
    return () => { if (action) action.fadeOut(0.5); };
  }, [actions, scene]);
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

function Yellow({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/yellow.glb');
  const { actions, names } = useAnimations(animations, group);
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
    const anim = actions['idle01'];
    if (anim) anim.reset().fadeIn(0.5).play();
    return () => { anim?.fadeOut(0.5); };
  }, [actions, scene, names]);
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

function Hedoban({ position }: { position: [number, number, number] }) {
  const modelRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/hedoban.glb');
  const { actions, names } = useAnimations(animations, modelRef);
  useEffect(() => {
    console.log('🎸 Hedobanのアニメーション一覧:', names);
  }, [names]);
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
    const anim = actions['teeder'];
    if (anim) anim.reset().fadeIn(0.5).play();
    return () => { anim?.fadeOut(0.5); };
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

// ---------------------------------------------------------
// ★修正: 雲の共通設定
// ---------------------------------------------------------
const useCloudMaterial = (scene: THREE.Group) => {
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        
        // ★変更点: 雲自体の標準シャドウはOFFに戻す
        mesh.castShadow = false; 
        mesh.receiveShadow = false;

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((mat) => {
          mat.transparent = true;
          mat.opacity = 0.4;
          // 半透明表現のために depthWrite は false が望ましい
          mat.depthWrite = false;
        });
      }
    });
  }, [scene]);
};

// ---------------------------------------------------------
// 雲パターン1 (左上から右下へ)
// ---------------------------------------------------------
function FloatingCloud1() {
  const group = useRef<THREE.Group>(null);
  const { scene: originalScene } = useGLTF('/models/cloud.glb');
  const scene = useMemo(() => originalScene.clone(), [originalScene]);
  
  useCloudMaterial(scene);

  // 開始位置Yを少し下げる
  const startPos = new THREE.Vector3(-25, 10, -15);
  
  useEffect(() => {
    if (group.current) group.current.position.copy(startPos);
  }, []);

  useFrame(() => {
    if (!group.current) return;
    // ★変更点: 横の動き(x)を強く、縦の動き(y)を弱く
    group.current.position.x += 0.04; // 0.02 -> 0.04
    group.current.position.y -= 0.002; // 0.005 -> 0.002
    group.current.position.z += 0.01;  // 0.015 -> 0.01

    if (group.current.position.x > 35) {
      group.current.position.copy(startPos);
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} scale={2.5} />
      {/* ★追加: 雲専用の薄くてボケた影 */}
      {/* position-y で雲の高さ分だけ下にずらして地面に影を落とす */}
      <ContactShadows
        position={[0, -10, 0]} 
        opacity={0.15} // 薄く (0.3 -> 0.15)
        scale={8}      // 大きく
        blur={4}       // 強くぼかす
        far={20}       // 遠くまで描画
        color="#5a665e" // 少し緑がかったグレー
      />
    </group>
  );
}

// ---------------------------------------------------------
// 雲パターン2 (右下→消える→左中→消える の繰り返し)
// ---------------------------------------------------------
function FloatingCloud2() {
  const group = useRef<THREE.Group>(null);
  const { scene: originalScene } = useGLTF('/models/cloud.glb');
  const scene = useMemo(() => originalScene.clone(), [originalScene]);
  
  useCloudMaterial(scene);

  const nextStartFromLeftMid = useRef(false);
  // 開始位置Yを少し下げる
  const startPosRight = new THREE.Vector3(15, 6, 10);
  const startPosLeftMid = new THREE.Vector3(-30, 8, 0);

  useEffect(() => {
    if (group.current) group.current.position.copy(startPosRight);
  }, []);

  useFrame(() => {
    if (!group.current) return;
    // ★変更点: 横の動き(x)を強く、縦の動き(y)を弱く
    group.current.position.x += 0.05;  // 0.025 -> 0.05
    group.current.position.y -= 0.003; // 0.008 -> 0.003
    group.current.position.z += 0.008; // 0.01 -> 0.008

    if (group.current.position.x > 40) {
      if (nextStartFromLeftMid.current) {
        group.current.position.copy(startPosLeftMid);
        nextStartFromLeftMid.current = false; 
      } else {
        group.current.position.copy(startPosRight);
        nextStartFromLeftMid.current = true; 
      }
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} scale={2.0} />
      {/* ★追加: 雲専用の薄くてボケた影 */}
      <ContactShadows
        position={[0, -7, 0]} // 高さに合わせて調整
        opacity={0.15}
        scale={6}
        blur={4}
        far={20}
        color="#5a665e"
      />
    </group>
  );
}


// ---------------------------------------------------------
// メインページ
// ---------------------------------------------------------
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
        <OrthographicCamera 
          makeDefault position={[20, 20, 20]} zoom={zoom} near={0.1} far={200}
          onUpdate={c => c.lookAt(0, 2.5, 0)}
        />
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[10, 20, 10]} intensity={1.5} castShadow 
          shadow-mapSize={[2048, 2048]} shadow-camera-top={25} shadow-camera-right={25}
          shadow-camera-bottom={-25} shadow-camera-left={-25} shadow-camera-far={50} shadow-bias={-0.0001}
        />

        <Suspense fallback={null}>
          <SceneEnvironment />
          <Mint position={[-2.5, 0, 1.5]} />
          <Kariage position={[2.5, 0, -1.5]} />
          <Red position={[0, 0, 2.5]} />
          <Yellow position={[1.5, 0, 0.5]} />
          <Hedoban position={[3.0, 0, 3.0]} />

          <FloatingCloud1 />
          <FloatingCloud2 />
        </Suspense>

      </Canvas>
    </div>
  );
}