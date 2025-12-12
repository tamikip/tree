import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import * as THREE from 'three';
import { easing } from 'maath';
import { AppState, HandData, PhotoData } from '../types';
import { CONFIG } from '../constants';

interface PhotoCloudProps {
  appState: AppState;
  handData: HandData;
  photos: PhotoData[];
}

export const PhotoCloud: React.FC<PhotoCloudProps> = ({ appState, handData, photos }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(-1);

  // Cycle active photo when entering ZOOM state
  useEffect(() => {
    if (appState === AppState.ZOOM && photos.length > 0) {
      // Pick random or cycle.
      const nextIndex = Math.floor(Math.random() * photos.length);
      setActivePhotoIndex(nextIndex);
    } else {
      setActivePhotoIndex(-1);
    }
  }, [appState, photos.length]);

  // Static layout positions
  const positions = useMemo(() => {
    return photos.map((_, i) => {
        // Tree positions for photos (interspersed in the tree)
        const t = (i + 0.5) / Math.max(photos.length, 1);
        const angle = t * Math.PI * 10;
        const rTree = (1 - t) * (CONFIG.TREE_RADIUS_BOTTOM + 1); // Slightly outside ornaments
        const xTree = Math.cos(angle) * rTree;
        const zTree = Math.sin(angle) * rTree;
        const yTree = (t * CONFIG.TREE_HEIGHT) - (CONFIG.TREE_HEIGHT / 2);

        // Scatter positions
        const rScatter = CONFIG.SCATTER_RADIUS * 0.8;
        const xScatter = (Math.random() - 0.5) * rScatter * 2;
        const yScatter = (Math.random() - 0.5) * rScatter * 2;
        const zScatter = (Math.random() - 0.5) * rScatter * 1.5;

        return {
            tree: new THREE.Vector3(xTree, yTree, zTree),
            scatter: new THREE.Vector3(xScatter, yScatter, zScatter),
            rotation: new THREE.Euler(0, -angle, 0)
        };
    });
  }, [photos]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Rotate the whole group gently if in tree mode
    if (appState === AppState.TREE) {
        groupRef.current.rotation.y += delta * 0.1;
    }

    // Process each child (Image)
    groupRef.current.children.forEach((child, i) => {
        if (!positions[i]) return;
        
        const isZoomed = appState === AppState.ZOOM && activePhotoIndex === i;
        const isTree = appState === AppState.TREE;
        
        let targetPos = isTree ? positions[i].tree : positions[i].scatter;
        let targetRot = isTree ? positions[i].rotation : new THREE.Euler(0, 0, 0);
        let targetScale = 1.5;

        if (isZoomed) {
             // Position in front of camera
             targetPos = new THREE.Vector3(0, 0, 12);
             targetRot = new THREE.Euler(0, 0, 0);
             targetScale = 8;
        }

        // Apply Damping
        // Match Ornaments: 0.15 for Tree (very fast), 0.6 for Scatter
        const smoothTime = isTree ? 0.15 : 0.6;
        
        easing.damp3(child.position, targetPos, smoothTime, delta);
        easing.dampE(child.rotation, targetRot, smoothTime, delta);
        easing.damp(child.scale, 'x', targetScale * (photos[i].aspectRatio || 1), smoothTime, delta);
        easing.damp(child.scale, 'y', targetScale, smoothTime, delta);

        // Fade out others when zoomed
        const material = (child as any).material;
        if (material) {
            const targetOpacity = (appState === AppState.ZOOM && !isZoomed) ? 0.1 : 1;
            easing.damp(material, 'opacity', targetOpacity, 0.4, delta);
            material.transparent = true;
        }
    });

    // Reset group rotation when interacting
    if (appState !== AppState.TREE) {
        easing.dampE(groupRef.current.rotation, [0, 0, 0], 0.5, delta);
    }
  });

  return (
    <group ref={groupRef}>
      {photos.map((photo, i) => (
        <Image 
          key={photo.id}
          url={photo.url}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          toneMapped={false} // Keep colors vivid
        >
             {/* Add a glowing border frame */}
            <mesh position={[0,0,-0.05]}>
                <planeGeometry args={[1.05, 1.05]} />
                <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
            </mesh>
        </Image>
      ))}
    </group>
  );
};