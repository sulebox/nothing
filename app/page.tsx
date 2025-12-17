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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#aaddaa" />
      </mesh>
      <primitive object={scene} position={[0, 0, 0]} scale={1.5} />
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
    </group>
  );
}

// ---------------------------------------------------------
// 2. Mint (診断機能付き)
// ---------------------------------------------------------
function Mint({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/mint.glb');
  const { actions, names } = useAnimations(animations, group);

  // ★ここで正しいアニメーション名をコンソールに表示
  useEffect(() => {
    console.log('🐧 Mintのアニメーション一覧:', names);
  }, [names]);

  useEffect(() => {
    // 安全に再生する関数
    const playSafe = (animName: string) => {
      const action = actions[animName];
      if (action) {
        action.reset().fadeIn(0.5).play();
      }
    };
    
    // とりあえず最初のアニメーションを再生
    if (names.length > 0) {
      playSafe(names[0]); 
    }
  }, [actions, names]);

  return <primitive ref={group} object={scene} position={position} />;
}

// ---------------------------------------------------------
// 3. Kariage (診断機能付き)
// ---------------------------------------------------------
function Kariage({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/kariage.glb');
  const { actions, names } = useAnimations(animations, group);
  const [showBubble, setShowBubble] = useState(true);

  // ★ここで正しいアニメーション名をコンソールに表示
  useEffect(() => {
    console.log('👦 Kariageのアニメーション一覧:', names);
  }, [names]);

  useEffect(() => {
    // 安全に再生する関数
    const playSafe = (animName: string) => {
      const action = actions[animName];
      if (action) {
        action.reset().fadeIn(0.5).play();
      }
    };

    // とりあえず最初のアニメーションを再生
    if (names.length > 0) {
      playSafe(names[0]);
    }
  }, [actions, names]);

  return (
    <group ref={group} position={position}>
      <primitive object={scene} />
      {showBubble && (
        <Html position={[0, 2, 0]} center>
          <div style={{
            background: 'white', padding: '8px 12px', borderRadius: '12px', border: '2px solid #333',
            whiteSpace: 'nowrap', fontSize: '14px', fontFamily: 'sans-serif', 
            boxShadow: '2px 2px 0px rgba(0,0,0,0.2)', position: 'relative'
          }}>
            名前確認中...
            <div style={{
              position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid white'
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
        <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={40} near={0.1} far={100} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />

        {/* 修正箇所：ここをnullに戻しました。これでエラーは消えます！ */}
        <Suspense fallback={null}>
          <SceneEnvironment />
          <Mint position={[-1.5, 0, 1]} />
          <Kariage position={[1.5, 0, -1]} />
        </Suspense>

      </Canvas>
    </div>
  );
}
