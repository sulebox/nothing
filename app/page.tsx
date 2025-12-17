'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
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
      child.receiveShadow = false;
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

// ---------------------------------------------------------
// 2. Mint
// ---------------------------------------------------------
function Mint({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/mint.glb');
  const { actions } = useAnimations(animations, group);

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

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// 3. Kariage
// ---------------------------------------------------------
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

    return () => {
      if (action) action.fadeOut(0.5);
    };
  }, [actions, scene]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// 4. Red
// ---------------------------------------------------------
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

    return () => {
      if (action) action.fadeOut(0.5);
    };
  }, [actions, scene]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// 5. Yellow (旧 Hat)
// ---------------------------------------------------------
// ---------------------------------------------------------
// 5. Yellow (Tポーズ対策版)
// ---------------------------------------------------------
function Yellow({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/yellow.glb');
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    console.log('🟡 Yellowのアニメーション一覧:', names);
  }, [names]);

  useEffect(() => {
    // 影の設定
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });

    // ★修正ポイント: 無理にループ処理を書かず、標準のループ機能に任せます
    const anim = actions['idle01'];

    if (anim) {
      // 再生するだけ。これで自動的に14秒(アニメの長さ分)でループし続けます
      anim.reset().fadeIn(0.5).play();
    }

    return () => {
      // コンポーネントが消える時だけフェードアウト
      anim?.fadeOut(0.5);
    };
  }, [actions, scene, names]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// メインページ
// ---------------------------------------------------------
export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#c9d1b8' }}>
      <Canvas shadows>
        {/* ★ここを変更： zoom={80} */}
        <OrthographicCamera 
          makeDefault 
          position={[20, 20, 20]} 
          zoom={80} 
          near={0.1} 
          far={200}
          onUpdate={c => c.lookAt(0, 1.0, 0)}
        />
        
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-camera-top={25}
          shadow-camera-right={25}
          shadow-camera-bottom={-25}
          shadow-camera-left={-25}
          shadow-camera-far={50}
          shadow-bias={-0.0001}
        />

        <Suspense fallback={null}>
          <SceneEnvironment />
          <Mint position={[-2.5, 0, 1.5]} />
          <Kariage position={[2.5, 0, -1.5]} />
          <Red position={[0, 0, 2.5]} />
          {/* Hat を Yellow に変更 */}
          <Yellow position={[1.5, 0, 0.5]} />
        </Suspense>

      </Canvas>
    </div>
  );
}
