import { WORLD_FORM_SCHEMAS } from '../shared/world-forms';
import type { WorldKind, WorldRecord } from '../shared/worlds';
export function rememberWorldOptions(world: WorldRecord, kind: WorldKind, values: Record<string,string> = {}): WorldRecord {
 const fieldOptions={...world.fieldOptions};
 for(const field of WORLD_FORM_SCHEMAS[kind]?.fields??[]){const value=values[field.key]?.trim();if(field.type==='select'&&field.key!=='Importance'&&value&&!field.options?.includes(value)){const key=kind+':'+field.key;fieldOptions[key]=[...new Set([...fieldOptions[key]??[],value])];}}
 return {...world,fieldOptions};
}
