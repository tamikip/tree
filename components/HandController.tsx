import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { GestureType, HandData } from '../types';

interface HandControllerProps {
  onHandUpdate: (data: HandData) => void;
}

export const HandController: React.FC<HandControllerProps> = ({ onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const isComponentMounted = useRef(true);
  
  const [isReady, setIsReady] = useState(false);
  const [debugGesture, setDebugGesture] = useState<string>('');

  // Use a ref to track the latest callback function to avoid stale closures
  const onHandUpdateRef = useRef(onHandUpdate);

  useEffect(() => {
    onHandUpdateRef.current = onHandUpdate;
  }, [onHandUpdate]);

  useEffect(() => {
    isComponentMounted.current = true;

    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        if (!isComponentMounted.current) return;

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        if (!isComponentMounted.current) return;

        // Start Webcam
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        if (!isComponentMounted.current) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', () => {
             if (isComponentMounted.current) {
                setIsReady(true);
                predict();
             }
          });
        }
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    initMediaPipe();
    
    return () => {
      isComponentMounted.current = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predict = () => {
    if (!isComponentMounted.current) return;

    if (videoRef.current && handLandmarkerRef.current && videoRef.current.readyState >= 2) {
      try {
        const nowInMs = Date.now();
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, nowInMs);
        processResults(results);
      } catch (e) {
        console.warn("Detection error:", e);
      }
    }
    // Loop request regardless of success to keep it alive
    requestRef.current = requestAnimationFrame(predict);
  };

  const processResults = (results: HandLandmarkerResult) => {
    let gesture = GestureType.NONE;
    let x = 0.5;
    let y = 0.5;
    let tiltX = 0;
    let tiltY = 0;

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      // --- POSITION & TILT (Using Screen Landmarks) ---
      const wrist = landmarks[0];
      const indexMCP = landmarks[5];
      const pinkyMCP = landmarks[17];
      
      const palmCenterX = (wrist.x + indexMCP.x + pinkyMCP.x) / 3;
      const palmCenterY = (wrist.y + indexMCP.y + pinkyMCP.y) / 3;

      // Invert X because webcam is mirrored
      x = 1 - palmCenterX;
      y = palmCenterY;

      tiltX = (indexMCP.x - pinkyMCP.x) * 10; 
      tiltY = (wrist.y - indexMCP.y) * 5;

      // --- GESTURE RECOGNITION (Using World Landmarks if available) ---
      // Safety Check: Ensure worldLandmarks exists before accessing properties
      if (results.worldLandmarks && results.worldLandmarks.length > 0) {
        const wl = results.worldLandmarks[0];
        const wrist3D = wl[0];
        const thumbTip3D = wl[4];
        const indexTip3D = wl[8];
        const middleTip3D = wl[12];
        const ringTip3D = wl[16];
        const pinkyTip3D = wl[20];

        // 3D Distance Helper
        const dist3D = (p1: any, p2: any) => Math.sqrt(
          Math.pow(p1.x - p2.x, 2) + 
          Math.pow(p1.y - p2.y, 2) + 
          Math.pow(p1.z - p2.z, 2)
        );

        // 1. Avg Distance from 4 fingertips to wrist (Fist Measure)
        const tips = [indexTip3D, middleTip3D, ringTip3D, pinkyTip3D];
        const avgDistToWrist = tips.reduce((acc, tip) => acc + dist3D(tip, wrist3D), 0) / 4;

        // 2. Pinch Distance (Thumb to Index)
        const pinchDist = dist3D(thumbTip3D, indexTip3D);

        // --- PRIORITY LOGIC ---
        // Fist: < 0.08m (8cm) - Compact hand
        // Pinch: < 0.03m (3cm) - Tips touching
        // Open: > 0.12m (12cm) - Fingers extended
        
        if (avgDistToWrist < 0.085) { 
           gesture = GestureType.FIST;
        } else if (pinchDist < 0.035) {
           gesture = GestureType.PINCH;
        } else if (avgDistToWrist > 0.11) {
           gesture = GestureType.OPEN_HAND;
        }

      } else {
        // Fallback to 2D Screen coords if World Landmarks unavailable
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        const dist2D = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        
        const avgDistToWrist = [indexTip, middleTip, ringTip, pinkyTip]
          .reduce((acc, tip) => acc + dist2D(tip, wrist), 0) / 4;

        if (avgDistToWrist < 0.3) { 
           gesture = GestureType.FIST;
        } else if (dist2D(thumbTip, indexTip) < 0.05) {
           gesture = GestureType.PINCH;
        } else if (avgDistToWrist > 0.4) {
           gesture = GestureType.OPEN_HAND;
        }
      }
    }
    
    setDebugGesture(gesture);
    // Use the Ref to call the latest callback
    if (onHandUpdateRef.current) {
        onHandUpdateRef.current({ gesture, x, y, tiltX, tiltY });
    }
  };

  return (
    <div className="absolute bottom-6 right-6 z-30 opacity-80 hover:opacity-100 transition-opacity">
      <div className="relative rounded-lg overflow-hidden border-2 border-white/20 shadow-lg w-32 h-24 bg-black">
         <video 
           ref={videoRef} 
           autoPlay 
           playsInline 
           muted
           className="w-full h-full object-cover transform -scale-x-100" 
         />
         {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/50 text-center p-2">
               Loading Vision...
            </div>
         )}
         {isReady && (
            <div className={`absolute bottom-0 left-0 right-0 text-center text-[10px] font-bold font-mono py-1
              ${debugGesture === GestureType.FIST ? 'bg-green-900 text-white' : 'bg-black/60 text-[#FFD700]'}
            `}>
               {debugGesture || "NO HAND"}
            </div>
         )}
      </div>
    </div>
  );
};