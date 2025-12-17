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
      {/* 地面: 影を受ける設定 (receiveShadow) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#a3b08d" />
      </mesh>
      
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

  // 影を落とす (castShadow)
  return <primitive ref={group} object={scene} position={position} scale={1.8} castShadow />;
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
    // 影を落とす (castShadow)
    <group ref={group} position={position} castShadow>
      <primitive object={scene} scale={1.8} />
      
      {/* 吹き出し */}
      {showBubble && (
        <Html position={[0, 3, 0]} center>
          <div style={{
            background: 'white',
            padding: '10px 16px',
            borderRadius: '20px',
            color: 'black',
            whiteSpace: 'nowrap',
            fontSize: '16px',
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
            position: 'relative'
          }}>
            てぶらでインド行く
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid white'
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
    <div style={{ width: '100vw', height: '100vh', background: '#c9d1b8' }}>
      <Canvas shadows>
        {/* ★ここが修正ポイント！
          1. onUpdate={c => c.lookAt(0, 0, 0)} を追加
             これでカメラが強制的に「ワールドの真ん中」を見続けるようになります。
          2. zoom={60} に変更
             かなり大きくしました。これでキャラがはっきり見えるはずです。
        */}
        <OrthographicCamera 
          makeDefault 
          position={[20, 20, 20]} 
          zoom={60} 
          near={0.1} 
          far={200}
          onUpdate={c => c.lookAt(0, 0, 0)}
        />
        
        <ambientLight intensity={0.7} />
        
        {/* 影の設定 */}
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-camera-top={20}
          shadow-camera-right={20}
          shadow-camera-bottom={-20}
          shadow-camera-left={-20}
          shadow-camera-far={50}
          shadow-bias={-0.0001}
        />

        <Suspense fallback={null}>
          <SceneEnvironment />
          {/* 位置は変えていません */}
          <Mint position={[-2.5, 0, 1.5]} />
          <Kariage position={[2.5, 0, -1.5]} />
        </Suspense>

      </Canvas>
    </div>
  );
}
