export enum AppState {
  TREE = 'TREE',
  SCATTERED = 'SCATTERED',
  ZOOM = 'ZOOM'
}

export enum GestureType {
  NONE = 'NONE',
  FIST = 'FIST',
  OPEN_HAND = 'OPEN_HAND',
  PINCH = 'PINCH'
}

export interface HandData {
  gesture: GestureType;
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  tiltX: number; // For rotation
  tiltY: number;
}

export interface PhotoData {
  id: string;
  url: string;
  aspectRatio: number;
}
