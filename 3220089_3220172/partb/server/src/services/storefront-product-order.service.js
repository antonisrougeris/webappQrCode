// Shared deterministic ordering across Homepage, Catalog and Admin.
export function compareStorefrontProducts(a,b){
  const rank=p=>Number.isSafeInteger(p?.displayOrder)&&p.displayOrder>=1
    ?p.displayOrder:Number.POSITIVE_INFINITY;
  const left=rank(a),right=rank(b);
  if(left!==right)return left-right;
  const dates=String(b?.createdAt||"").localeCompare(String(a?.createdAt||""));
  return dates||String(a?.id||"").localeCompare(String(b?.id||""));
}
