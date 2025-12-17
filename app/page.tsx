'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------
// 1. 背景（野原）と木
// ---------------------------------------------------------
function SceneEnvironment() {
  const { scene } = useGLTF('/models/tree.glb');
  
  return (
    <group>
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#aaddaa" />
      </mesh>
      
      {/* 木 (真ん中) */}
      <primitive object={scene} position={[0, 0, 0]} scale={1.5} />
      
      {/* 影を落として接地感を出す */}
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
    </group>
  );
}

// ---------------------------------------------------------
// 2. Mint (ペンギン?) のコンポーネント
// ---------------------------------------------------------
function Mint({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/mint.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const playSequence = async () => {
      // Step 1: sleepidle (5~10秒ランダム)
      const randomWait = Math.random() * 5000 + 5000; // 5000ms ~ 10000ms
      actions['sleepidle']?.reset().fadeIn(0.5).play();
      actions['sleeping']?.fadeOut(0.5);

      timeoutId = setTimeout(() => {
        // Step 2: sleeping (10.9秒)
        actions['sleepidle']?.fadeOut(0.5);
        actions['sleeping']?.reset().fadeIn(0.5).play();

        timeoutId = setTimeout(() => {
          // ループするために再帰呼び出し
          playSequence();
        }, 10900); // 10.9秒

      }, randomWait);
    };

    playSequence();

    return () => clearTimeout(timeoutId);
  }, [actions]);

  return <primitive ref={group} object={scene} position={position} />;
}

// ---------------------------------------------------------
// 3. Kariage (少年?) のコンポーネント
// ---------------------------------------------------------
function Kariage({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/kariage.glb');
  const { actions } = useAnimations(animations, group);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const playSequence = async () => {
      // Step 1: sitting (5~15秒ランダム)
      const randomWait = Math.random() * 10000 + 5000; // 5000ms ~ 15000ms
      
      // 前のアニメーションをフェードアウトして sitting を再生
      actions['sittingdown']?.fadeOut(0.5);
      actions['sitting']?.reset().fadeIn(0.5).play();

      timeoutId = setTimeout(() => {
        // Step 2: sittingup (6秒)
        actions['sitting']?.fadeOut(0.5);
        actions['sittingup']?.reset().fadeIn(0.5).play();

        timeoutId = setTimeout(() => {
          // Step 3: idle (5秒) + 吹き出し表示
          actions['sittingup']?.fadeOut(0.5);
          actions['idle']?.reset().fadeIn(0.5).play();
          setShowBubble(true); // 吹き出しON

          timeoutId = setTimeout(() => {
            // Step 4: sittingdown (2.2秒) + 吹き出し消去
            setShowBubble(false); // 吹き出しOFF
            actions['idle']?.fadeOut(0.5);
            actions['sittingdown']?.reset().fadeIn(0.5).play();

            timeoutId = setTimeout(() => {
              // ループ
              playSequence();
            }, 2200); // 2.2秒

          }, 5000); // idle 5秒

        }, 6000); // sittingup 6秒

      }, randomWait);
    };

    playSequence();

    return () => clearTimeout(timeoutId);
  }, [actions]);

  return (
    <group ref={group} position={position}>
      <primitive object={scene} />
      
      {/* 吹き出し (HTML要素を3D空間に配置) */}
      {showBubble && (
        <Html position={[0, 2, 0]} center>
          <div style={{
            background: 'white',
            padding: '8px 12px',
            borderRadius: '12px',
            border: '2px solid #333',
            whiteSpace: 'nowrap',
            fontSize: '14px',
            fontFamily: 'sans-serif',
            boxShadow: '2px 2px 0px rgba(0,0,0,0.2)',
            position: 'relative'
          }}>
            てぶらでインド行く
            {/* 吹き出しの三角部分 */}
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid white'
            }} />
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------
// メインページ
// ---------------------------------------------------------
export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f0f0d0' }}>
      <Canvas shadows>
        {/* カメラ設定: アイソメトリックにするためOrthographicを使用 */}
        <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={40} near={0.1} far={100} />
        
        {/* ライティング */}
        <ambientLight intensity={0.7} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize={[1024, 1024]} 
        />

        {/* Suspenseで囲むことで、読み込み完了まで待機させる */}
        <Suspense fallback={null}>
          {/* 環境とキャラクター */}
          <SceneEnvironment />
          
          {/* 木のそばに配置 (位置は適宜調整してください) */}
          <Mint position={[-1.5, 0, 1]} />
          <Kariage position={[1.5, 0, -1]} />
        </Suspense>

      </Canvas>
    </div>
  );
}
