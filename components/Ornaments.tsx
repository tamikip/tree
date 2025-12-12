import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import { AppState, HandData, GestureType } from '../types';
import { CONFIG, COLORS } from '../constants';

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

interface OrnamentsProps {
  appState: AppState;
  handData: HandData;
}

export const Ornaments: React.FC<OrnamentsProps> = ({ appState, handData }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Generate data once
  const { positionsTree, positionsScatter, colors, rotations, types } = useMemo(() => {
    const count = CONFIG.PARTICLE_COUNT;
    const positionsTree = new Float32Array(count * 3);
    const positionsScatter = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const rotations = new Float32Array(count * 3);
    const types = new Float32Array(count); // 0: Sphere, 1: Cube

    const colorPalette = [
       new THREE.Color(COLORS.MATTE_GREEN),
       new THREE.Color(COLORS.CHRISTMAS_RED),
       new THREE.Color(COLORS.METALLIC_GOLD),
       new THREE.Color('#FFFFFF'), // Snow/Silver
    ];

    for (let i = 0; i < count; i++) {
      // Tree Shape (Cone spirals)
      const t = i / count;
      const angle = t * Math.PI * 20; // Spirals
      const radius = (1 - t) * CONFIG.TREE_RADIUS_BOTTOM;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (t * CONFIG.TREE_HEIGHT) - (CONFIG.TREE_HEIGHT / 2);
      
      positionsTree[i * 3] = x;
      positionsTree[i * 3 + 1] = y;
      positionsTree[i * 3 + 2] = z;

      // Scatter Shape (Random Cloud)
      const r = CONFIG.SCATTER_RADIUS;
      positionsScatter[i * 3] = (Math.random() - 0.5) * r * 2;
      positionsScatter[i * 3 + 1] = (Math.random() - 0.5) * r * 2;
      positionsScatter[i * 3 + 2] = (Math.random() - 0.5) * r * 1.5;

      // Rotations
      rotations[i * 3] = Math.random() * Math.PI;
      rotations[i * 3 + 1] = Math.random() * Math.PI;
      rotations[i * 3 + 2] = Math.random() * Math.PI;

      // Color
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      tempColor.set(color);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;

      // Type
      types[i] = Math.random() > 0.5 ? 0 : 1;
    }

    return { positionsTree, positionsScatter, colors, rotations, types };
  }, []);

  // Update loop
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Camera/Group Rotation based on Hand
    if (appState === AppState.SCATTERED && handData.gesture === GestureType.OPEN_HAND) {
       easing.dampE(
         meshRef.current.rotation,
         [handData.tiltY * 0.5, handData.tiltX * 0.5, 0],
         0.5,
         delta
       );
    } else {
       // Reset rotation when forming tree
       easing.dampE(meshRef.current.rotation, [0, 0, 0], 1, delta);
    }
  });

  // Mutable buffer for current positions
  const currentPositions = useRef(new Float32Array(positionsTree)); 

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        const isTree = appState === AppState.TREE;
        
        const tx = isTree ? positionsTree[i * 3] : positionsScatter[i * 3];
        const ty = isTree ? positionsTree[i * 3 + 1] : positionsScatter[i * 3 + 1];
        const tz = isTree ? positionsTree[i * 3 + 2] : positionsScatter[i * 3 + 2];

        // Damp current position towards target
        // Increased lambda to 12 for Tree for very snappy response
        const lambda = isTree ? 12 : 2;

        currentPositions.current[i*3] = THREE.MathUtils.damp(currentPositions.current[i*3], tx, lambda, delta);
        currentPositions.current[i*3+1] = THREE.MathUtils.damp(currentPositions.current[i*3+1], ty, lambda, delta);
        currentPositions.current[i*3+2] = THREE.MathUtils.damp(currentPositions.current[i*3+2], tz, lambda, delta);

        // Add floating noise
        const noiseAmt = isTree ? 0.02 : 0.2;
        const ix = currentPositions.current[i*3] + Math.sin(time + i) * noiseAmt;
        const iy = currentPositions.current[i*3+1] + Math.cos(time * 0.8 + i) * noiseAmt;
        const iz = currentPositions.current[i*3+2] + Math.sin(time * 0.5 + i) * noiseAmt;

        tempObject.position.set(ix, iy, iz);
        
        // Rotation
        tempObject.rotation.set(
            rotations[i*3] + time * 0.2,
            rotations[i*3+1] + time * 0.1,
            rotations[i*3+2]
        );

        // Scale
        const scale = types[i] === 0 ? 0.3 : 0.25; // Sphere vs Box
        tempObject.scale.setScalar(scale);

        tempObject.updateMatrix();
        meshRef.current.setMatrixAt(i, tempObject.matrix);
        
        // Color update
        tempColor.setRGB(colors[i*3], colors[i*3+1], colors[i*3+2]);
        meshRef.current.setColorAt(i, tempColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CONFIG.PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial 
        roughness={0.2} 
        metalness={0.8} 
        emissive={COLORS.CHRISTMAS_RED}
        emissiveIntensity={0.1}
      />
    </instancedMesh>
  );
};