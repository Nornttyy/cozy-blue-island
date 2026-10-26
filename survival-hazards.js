// Personal state only; room snapshots never overwrite another player's oxygen.
export const OXYGEN_SECONDS=40;
export function fallDamage(landing){
 if(!landing||landing.waterDepth>=1.08||!Number.isFinite(landing.distance))return 0;
 return Math.min(100,Math.max(0,landing.distance-3)*12*(1-Math.max(0,landing.waterDepth||0)*.45));
}
export function updateHazards(vitals,dt,environment={}){
 vitals.oxygen=Number.isFinite(vitals.oxygen)?Math.max(0,Math.min(100,vitals.oxygen)):100;
 const before=vitals.oxygen,submerged=environment.depth>.12&&!environment.vehicle;
 vitals.oxygen=Math.max(0,Math.min(100,before+dt*(submerged?-100/OXYGEN_SECONDS:12.5)));
 let damage=0;
 if(submerged){const emptyTime=Math.max(0,dt-before/(100/OXYGEN_SECONDS));damage+=emptyTime*8;}
 for(const landing of environment.landings||[])damage+=fallDamage(landing);
 vitals.health=Math.max(0,vitals.health-damage);
 return {damage,low:submerged&&before>25&&vitals.oxygen<=25,empty:submerged&&before>0&&vitals.oxygen===0};
}
