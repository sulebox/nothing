'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------
// 1. 背景（薄い抹茶色の草原）
// ---------------------------------------------------------
function SceneEnvironment() {
  return (
    <group>
      {/* 地面: 色を薄い抹茶色に変更 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        {/* ご希望の画像に近い、少しグレーがかった落ち着いた黄緑色 */}
        <meshStandardMaterial color="#a3b08d" />
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

  // スケールを少し大きく調整
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
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
      {/* スケールを少し大きく調整 */}
      <primitive object={scene} scale={1.8} />
      
      {/* 吹き出し: デザインを変更 */}
      {showBubble && (
        <Html position={[0, 3, 0]} center>
          <div style={{
            background: 'white',
            padding: '10px 16px', // 少し大きめに
            borderRadius: '20px', // 丸みを強く
            // border: '2px solid #333', // ←枠線を削除
            color: 'black', // 文字色を黒に
            whiteSpace: 'nowrap',
            fontSize: '16px', // フォントサイズを少し大きく
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', // 影を薄く
            position: 'relative'
          }}>
            てぶらでインド行く
            {/* 吹き出しのしっぽ */}
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid white' // 枠線なしの白い三角
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
    // 背景色も原っぱの色に合わせて調整
    <div style={{ width: '100vw', height: '100vh', background: '#c9d1b8' }}>
      <Canvas shadows>
        {/* 1) カメラ固定＆ズームイン: zoomの数字を小さくして寄せる (30 -> 15) */}
        <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={15} near={0.1} far={200} />
        
        {/* OrbitControls を削除してカメラを固定 */}

        <ambientLight intensity={0.7} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize={[1024, 1024]} 
        />

        <Suspense fallback={null}>
          <SceneEnvironment />
          {/* キャラクターの間隔を少し広げる */}
          <Mint position={[-2.5, 0, 1.5]} />
          <Kariage position={[2.5, 0, -1.5]} />
        </Suspense>

      </Canvas>
    </div>
  );
}
