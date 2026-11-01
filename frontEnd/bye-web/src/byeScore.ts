export const BYE_RATING_WEIGHT=0.5;
export const BYE_TRUST_AFTER=10;
export function byeScore(rating:number|null,difficulty:number|null,count:number|null):number|null{
 if(rating==null||difficulty==null)return null;
 const n=Math.max(0,count??0),w=BYE_RATING_WEIGHT,k=BYE_TRUST_AFTER;
 const base=w*(rating-1)/4+(1-w)*(5-difficulty)/4;
 return Math.round(100*(n*base+k*0.5)/(n+k));
}
