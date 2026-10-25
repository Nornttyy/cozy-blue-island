// Shared by gameplay and the material inspection pages; no geometry or save edits.
export function finishMaterials(assets,renderer){
  const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  assets.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      m.envMapIntensity=.28;
      for(const t of [m.map,m.normalMap,m.roughnessMap])if(t)t.anisotropy=anisotropy;
    }
  });
  return assets;
}
