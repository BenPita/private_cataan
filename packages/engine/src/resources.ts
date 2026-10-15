import { RESOURCES, type ResMap, type Resource } from './types';

export const emptyRes = (): ResMap => ({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 });

export const resOf = (partial: Partial<ResMap>): ResMap => ({ ...emptyRes(), ...partial });

export const totalRes = (r: ResMap): number => RESOURCES.reduce((s, k) => s + r[k], 0);

export const hasRes = (have: ResMap, need: Partial<ResMap>): boolean =>
  RESOURCES.every((k) => have[k] >= (need[k] ?? 0));

export function addRes(target: ResMap, delta: Partial<ResMap>, sign = 1): void {
  for (const k of RESOURCES) target[k] += sign * (delta[k] ?? 0);
}

export function isValidResMap(value: unknown): value is ResMap {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return RESOURCES.every((k) => Number.isInteger(v[k]) && (v[k] as number) >= 0 && (v[k] as number) <= 99);
}

export const isResource = (value: unknown): value is Resource =>
  typeof value === 'string' && (RESOURCES as readonly string[]).includes(value);
