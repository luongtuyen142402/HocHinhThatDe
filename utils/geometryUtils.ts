import { Point3D, Point2D } from '../types';

// Simple weak perspective projection
export const projectPoint = (
  point: Point3D,
  angleX: number,
  angleY: number,
  scale: number,
  canvasWidth: number,
  canvasHeight: number
): Point2D => {
  const radX = (angleX * Math.PI) / 180;
  const radY = (angleY * Math.PI) / 180;

  // Rotate around Y axis
  let x = point.x * Math.cos(radY) - point.z * Math.sin(radY);
  let z = point.x * Math.sin(radY) + point.z * Math.cos(radY);
  let y = point.y;

  // Rotate around X axis
  let y_new = y * Math.cos(radX) - z * Math.sin(radX);
  z = y * Math.sin(radX) + z * Math.cos(radX);
  y = y_new;

  const projectedX = x * scale + canvasWidth / 2;
  const projectedY = -y * scale + canvasHeight / 2;

  return { x: projectedX, y: projectedY };
};

export const get3DCentroid = (points: Point3D[]): Point3D => {
  if (points.length === 0) return { id: 'temp_center', x: 0, y: 0, z: 0 };
  const count = points.length;
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 });
  return {
    id: 'temp_center',
    x: sum.x / count,
    y: sum.y / count,
    z: sum.z / count
  };
};

export const get2DCentroid = (points: Point2D[]): Point2D => {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
};

export const getLabelPosition = (point: Point2D, center: Point2D, offset: number = 22): Point2D => {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length < 1) return { x: point.x + offset, y: point.y - offset };
  
  return {
    x: point.x + (dx / length) * offset,
    y: point.y + (dy / length) * offset
  };
};
