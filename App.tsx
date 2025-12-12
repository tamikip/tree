import React, { useState, useCallback, useRef } from 'react';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { AppState, GestureType, HandData, PhotoData } from './types';
import { Camera, Hand, Image as ImageIcon, Sparkles } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.TREE);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [handData, setHandData] = useState<HandData>({
    gesture: GestureType.NONE,
    x: 0.5,
    y: 0.5,
    tiltX: 0,
    tiltY: 0,
  });
  
  // Ref to track state changes to prevent rapid toggling
  const lastStateChange = useRef<number>(0);

  const handleHandUpdate = useCallback((data: HandData) => {
    setHandData(data);
    
    const now = Date.now();
    const timeSinceChange = now - lastStateChange.current;

    // --- STATE MACHINE LOGIC ---
    
    // 1. FIST -> TREE
    // NO DEBOUNCE: Immediate reaction when user makes a fist.
    if (data.gesture === GestureType.FIST && appState !== AppState.TREE) {
      setAppState(AppState.TREE);
      lastStateChange.current = now;
      return;
    }

    // For other transitions, we keep a debounce to prevent accidental switching
    if (timeSinceChange < 500) return;

    // 2. OPEN HAND -> SCATTER
    if (data.gesture === GestureType.OPEN_HAND && appState === AppState.TREE) {
      setAppState(AppState.SCATTERED);
      lastStateChange.current = now;
    } 
    // 3. PINCH -> ZOOM (Only if photos exist)
    else if (data.gesture === GestureType.PINCH && appState === AppState.SCATTERED) {
      if (photos.length > 0) {
        setAppState(AppState.ZOOM);
        lastStateChange.current = now;
      }
    } 
    // 4. OPEN HAND (from Zoom) -> SCATTER
    else if (data.gesture === GestureType.OPEN_HAND && appState === AppState.ZOOM) {
       setAppState(AppState.SCATTERED);
       lastStateChange.current = now;
    }
  }, [appState, photos.length]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos: PhotoData[] = Array.from(e.target.files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(file),
        aspectRatio: 1, // Will be updated when loaded in 3D, defaulting to square
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
      // Auto switch to scatter to see photos
      if(appState === AppState.TREE) setAppState(AppState.SCATTERED);
    }
  };

  return (
    <div className="w-full h-screen relative bg-black overflow-hidden select-none">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Scene appState={appState} handData={handData} photos={photos} />
      </div>

      {/* Webcam Layer (Hidden or Miniaturized) */}
      <HandController onHandUpdate={handleHandUpdate} />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-serif text-[#FFD700] tracking-widest drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
              NOEL
            </h1>
            <p className="text-white/60 text-sm mt-1 uppercase tracking-wider">
              Gesture Controlled Experience
            </p>
          </div>
          
          <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl max-w-xs text-white/80 text-xs space-y-2">
             <div className="flex items-center gap-3">
                <Hand className="w-4 h-4 text-[#FFD700]" />
                <span><strong>Fist:</strong> Form Tree (Instant)</span>
             </div>
             <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-[#FFD700]" />
                <span><strong>Open Hand:</strong> Scatter</span>
             </div>
             <div className="flex items-center gap-3">
                <Camera className="w-4 h-4 text-[#FFD700]" />
                <span><strong>Pinch:</strong> Zoom Photo</span>
             </div>
          </div>
        </div>

        {/* Footer / Controls */}
        <div className="flex justify-between items-end pointer-events-auto">
          <div className="flex flex-col gap-2">
             <div className="text-[#FFD700] text-sm font-bold uppercase tracking-widest mb-1">
                Current State: {appState}
             </div>
             <div className="text-white/40 text-xs">
                {photos.length} Photos Loaded
             </div>
          </div>

          <label className="cursor-pointer group">
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={handlePhotoUpload}
            />
            <div className="flex items-center gap-3 bg-[#8B0000] hover:bg-[#A00000] text-white px-6 py-3 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(139,0,0,0.4)] group-hover:scale-105">
              <ImageIcon className="w-5 h-5" />
              <span className="font-medium tracking-wide">Add Memories</span>
            </div>
          </label>
        </div>
      </div>
      
      {/* Cinematic Vignette */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  );
}