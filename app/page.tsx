'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------
// 1. 背景（薄い抹茶色の草原）と木
// ---------------------------------------------------------
function SceneEnvironment() {
  const { scene: treeScene } = useGLTF('/models/tree.glb');

  // 木はリアルでいいので、影を受けたり落としたりする
  treeScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return (
    <group>
      {/* 地面: ここに影が落ちる */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#a3b08d" roughness={0.8} metalness={0.1} />
      </mesh>
      
      {/* 木 (サイズ 2.0) */}
      <primitive 
        object={treeScene} 
        position={[0, 0, 0]} 
        scale={2.0} 
      />
      
      {/* 接地感を出すための補助的な影 */}
      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={20} blur={2.5} far={4.5} />
    </group>
  );
}

// ---------------------------------------------------------
// 2. Mint (ペンギン)
// ---------------------------------------------------------
function Mint({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/mint.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        // 顔をきれいに保つため receiveShadow: false
        child.castShadow = true;
        child.receiveShadow = false; 
      }
    });

    let timeoutId: NodeJS.Timeout;

    const playSequence = async () => {
      const randomWait = Math.random() * 5000 + 5000; 
      
      actions['sleepidle']?.reset().fadeIn(0.5).play();
      actions['sleeping']?.fadeOut(0.5);

      timeoutId = setTimeout(() => {
        actions['sleepidle']?.fadeOut(0.5);
        actions['sleeping']?.reset().fadeIn(0.5).play();

        timeoutId = setTimeout(() => {
          playSequence();
        }, 17700); // 17.7秒

      }, randomWait);
    };

    playSequence();
    return () => clearTimeout(timeoutId);
  }, [actions, scene]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// 3. Kariage (少年)
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

    actions['sitting']?.reset().fadeIn(0.5).play();

    return () => {
      actions['sitting']?.fadeOut(0.5);
    };
  }, [actions, scene]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// 4. Red (少年2)
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

    actions['laying']?.reset().fadeIn(0.5).play();

    return () => {
      actions['laying']?.fadeOut(0.5);
    };
  }, [actions, scene]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// 5. Hat (新規追加) - idle01(8.8s) -> idle02(13.9s) ループ
// ---------------------------------------------------------
function Hat({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  // hat.glb を読み込み
  const { scene, animations } = useGLTF('/models/hat.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // 影の設定
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });

    let timeoutId: NodeJS.Timeout;

    const playSequence = async () => {
      // Step 1: idle01 (8.8秒)
      // 前のアニメーションをフェードアウトさせ、idle01を再生
      actions['idle02']?.fadeOut(0.5);
      actions['idle01']?.reset().fadeIn(0.5).play();

      timeoutId = setTimeout(() => {
        // Step 2: idle02 (13.9秒)
        actions['idle01']?.fadeOut(0.5);
        actions['idle02']?.reset().fadeIn(0.5).play();

        timeoutId = setTimeout(() => {
          // ループ
          playSequence();
        }, 13900); // 13.9秒

      }, 8800); // 8.8秒
    };

    playSequence();

    return () => {
      clearTimeout(timeoutId);
      actions['idle01']?.fadeOut(0.5);
      actions['idle02']?.fadeOut(0.5);
    };
  }, [actions, scene]);

  // 他のキャラと同じくらいのスケールに設定
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// メインページ
// ---------------------------------------------------------
export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#c9d1b8' }}>
      <Canvas shadows>
        <OrthographicCamera 
          makeDefault 
          position={[20, 20, 20]} 
          zoom={60} 
          near={0.1} 
          far={200}
          onUpdate={c => c.lookAt(0, 0, 0)}
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
          
          {/* Hatを追加: RedとKariageの間あたり */}
          <Hat position={[1.5, 0, 0.5]} />
        </Suspense>

      </Canvas>
    </div>
  );
}
