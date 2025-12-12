import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Ornaments } from './Ornaments';
import { PhotoCloud } from './PhotoCloud';
import { AppState, HandData, PhotoData } from '../types';
import { COLORS } from '../constants';

interface SceneProps {
  appState: AppState;
  handData: HandData;
  photos: PhotoData[];
}

export const Scene: React.FC<SceneProps> = ({ appState, handData, photos }) => {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 18], fov: 45 }}
      gl={{ antialias: false, toneMappingExposure: 1.5 }}
    >
      <color attach="background" args={['#050505']} />
      
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} color={COLORS.METALLIC_GOLD} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color={COLORS.CHRISTMAS_RED} />
      <spotLight 
        position={[0, 20, 0]} 
        angle={0.5} 
        penumbra={1} 
        intensity={2} 
        color="#fff" 
        castShadow 
      />

      <Suspense fallback={null}>
        <group>
          <Ornaments appState={appState} handData={handData} />
          <PhotoCloud appState={appState} handData={handData} photos={photos} />
        </group>
        
        {/* Environment & Background */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="city" />
      </Suspense>

      {/* Post Processing */}
      <EffectComposer disableNormalPass>
        <Bloom 
          luminanceThreshold={0.2} 
          mipmapBlur 
          intensity={1.5} 
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>

      {/* Controls - Only active if needed, mostly controlled by hand */}
      <OrbitControls 
        enableZoom={false} 
        enablePan={false} 
        enableRotate={appState === AppState.SCATTERED} // Allow mouse backup
        autoRotate={appState === AppState.TREE}
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
};
