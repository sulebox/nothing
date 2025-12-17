'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Html, OrthographicCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------
// 1. 背景（薄い抹茶色の草原）と木
// ---------------------------------------------------------
function SceneEnvironment() {
  // 木のモデルを読み込み
  const { scene: treeScene } = useGLTF('/models/tree.glb');

  // 木にも影を落とす設定を追加
  treeScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return (
    <group>
      {/* 地面: 影を受ける設定 (receiveShadow) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        {/* roughnessを上げてマットな質感にし、影を強調 */}
        <meshStandardMaterial color="#a3b08d" roughness={0.8} metalness={0.1} />
      </mesh>
      
      {/* 木 (真ん中) */}
      <primitive 
        object={treeScene} 
        position={[0, 0, 0]} 
        scale={1.0} // サイズを1.0に
      />
      
      {/* 接地感を出すための補助的な影 */}
      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={20} blur={2.5} far={4.5} />
    </group>
  );
}

// ---------------------------------------------------------
// 2. Mint (ペンギン) - 変更なし
// ---------------------------------------------------------
function Mint({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/mint.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // モデルの全メッシュに影の設定を適用
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
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
        }, 10900);

      }, randomWait);
    };

    playSequence();
    return () => clearTimeout(timeoutId);
  }, [actions, scene]);

  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// 3. Kariage (少年) - アニメーション変更、吹き出し削除
// ---------------------------------------------------------
function Kariage({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/kariage.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // モデルの全メッシュに影の設定を適用
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // 'sitting' アニメーションのみをループ再生
    actions['sitting']?.reset().fadeIn(0.5).play();

    // クリーンアップは不要ですが念のため
    return () => {
      actions['sitting']?.fadeOut(0.5);
    };
  }, [actions, scene]);

  // 吹き出しを削除しました
  return <primitive ref={group} object={scene} position={position} scale={1.8} />;
}

// ---------------------------------------------------------
// メインページ
// ---------------------------------------------------------
export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#c9d1b8' }}>
      {/* shadows を有効化 */}
      <Canvas shadows>
        <OrthographicCamera 
          makeDefault 
          position={[20, 20, 20]} 
          zoom={60} 
          near={0.1} 
          far={200}
          onUpdate={c => c.lookAt(0, 0, 0)}
        />
        
        {/* 環境光を少し弱めて影を強調 */}
        <ambientLight intensity={0.5} />
        
        {/* 影の設定を調整 */}
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.5} // ライトを少し強く
          castShadow 
          // 影の品質と範囲の設定
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
          {/* 木を挟むように配置 */}
          <Mint position={[-2.5, 0, 1.5]} />
          <Kariage position={[2.5, 0, -1.5]} />
        </Suspense>

      </Canvas>
    </div>
  );
}
