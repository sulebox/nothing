'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------
// 1. 背景（シンプルな黄緑色の草原）
// ---------------------------------------------------------
function SceneEnvironment() {
  // ★ tree.glb の読み込みを削除しました
  
  return (
    <group>
      {/* 地面: シンプルな黄緑色の板 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        {/* 黄緑色 (YellowGreen: #9ACD32) に設定 */}
        <meshStandardMaterial color="#9ACD32" />
      </mesh>
      
      {/* 影 */}
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
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
    let timeoutId: NodeJS.Timeout;

    const playSequence = async () => {
      // 判明した名前: 'sleepidle', 'sleeping'
      
      const randomWait = Math.random() * 5000 + 5000; 
      
      actions['sleepidle']?.reset().fadeIn(0.5).play();
      actions['sleeping']?.fadeOut(0.5);

      timeoutId = setTimeout(() => {
        actions['sleepidle']?.fadeOut(0.5);
        actions['sleeping']?.reset().fadeIn(0.5).play();

        timeoutId = setTimeout(() => {
          playSequence();
        }, 10900);

      }, randomWait);
    };

    playSequence();
    return () => clearTimeout(timeoutId);
  }, [actions]);

  return <primitive ref={group} object={scene} position={position} scale={1.5} />;
}

// ---------------------------------------------------------
// 3. Kariage (少年)
// ---------------------------------------------------------
function Kariage({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/kariage.glb');
  const { actions } = useAnimations(animations, group);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const playSequence = async () => {
      // 判明した名前: 'idle', 'sitting', 'sittingdown', 'sittingup'

      const randomWait = Math.random() * 10000 + 5000;
      
      actions['sittingdown']?.fadeOut(0.5);
      actions['sitting']?.reset().fadeIn(0.5).play();

      timeoutId = setTimeout(() => {
        actions['sitting']?.fadeOut(0.5);
        actions['sittingup']?.reset().fadeIn(0.5).play();

        timeoutId = setTimeout(() => {
          actions['sittingup']?.fadeOut(0.5);
          actions['idle']?.reset().fadeIn(0.5).play();
          setShowBubble(true);

          timeoutId = setTimeout(() => {
            setShowBubble(false);
            actions['idle']?.fadeOut(0.5);
            actions['sittingdown']?.reset().fadeIn(0.5).play();

            timeoutId = setTimeout(() => {
              playSequence();
            }, 2200);

          }, 5000); 

        }, 6000); 

      }, randomWait);
    };

    playSequence();
    return () => clearTimeout(timeoutId);
  }, [actions]);

  return (
    <group ref={group} position={position}>
      <primitive object={scene} scale={1.5} />
      
      {/* 吹き出し */}
      {showBubble && (
        <Html position={[0, 2.5, 0]} center>
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
        {/* カメラ設定 */}
        <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={30} near={0.1} far={200} />
        
        {/* グリグリ動かせるようにOrbitControlsを入れています */}
        <OrbitControls />

        <ambientLight intensity={0.7} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize={[1024, 1024]} 
        />

        {/* 読み込み待機 */}
        <Suspense fallback={null}>
          <SceneEnvironment />
          {/* キャラクターのみ配置 */}
          <Mint position={[-2, 0, 1]} />
          <Kariage position={[2, 0, -1]} />
        </Suspense>

      </Canvas>
    </div>
  );
}
