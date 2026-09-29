/** Compact, versioned cloud snapshot. Commit its manifest only after every part. */
import {normalizeProfile} from './progress.js';
export const CLOUD_KEY='wonder_match_cloud_v3';
export const cloudKeyFor=userId=>userId?`${CLOUD_KEY}_u${userId}`:CLOUD_KEY;
export const cloudPartKey=(bank,i,userId=0)=>`${cloudKeyFor(userId)}_${bank}_${i}`;
export function checksum(text){let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return (n>>>0).toString(16);}
export function packCloud(profile,bank){
 const {active,levels,...meta}=profile;
 const rows=Object.entries(levels).map(([id,r])=>[Number(id),r.stars,r.score,r.moves,r.wins,r.attempts,r.bestTime]);
 const data=JSON.stringify({meta,rows}),parts=[];
 for(let i=0;i<data.length;i+=3000)parts.push(data.slice(i,i+3000));
 return {parts,manifest:{format:1,bank,count:parts.length,hash:checksum(data),updatedAt:profile.updatedAt}};
}
export function unpackCloud(manifest,parts){
 if(manifest?.format!==1||![0,1].includes(manifest.bank)||!Number.isInteger(manifest.count)||manifest.count<1||manifest.count>64||parts.length!==manifest.count||parts.some(p=>typeof p!=='string'||!p.length))throw new Error('Incomplete cloud snapshot');
 const text=parts.join('');if(checksum(text)!==manifest.hash)throw new Error('Cloud checksum mismatch');
 const {meta,rows}=JSON.parse(text);if(!meta||!Array.isArray(rows)||rows.length>500)throw new Error('Invalid cloud snapshot');
 const levels={};for(const [id,stars,score,moves,wins,attempts,bestTime] of rows)levels[id]={stars,score,moves,wins,attempts,bestTime};
 return normalizeProfile({...meta,levels,active:null});
}
export async function writeCloud(send,profile,previousBank=1){
 const packed=packCloud(profile,1-previousBank);
 for(const [i,value] of packed.parts.entries())await send('VKWebAppStorageSet',{key:cloudPartKey(packed.manifest.bank,i,profile.vkUserId),value});
 await send('VKWebAppStorageSet',{key:cloudKeyFor(profile.vkUserId),value:JSON.stringify(packed.manifest)});
 return packed.manifest.bank;
}
export async function readCloud(send,manifest,userId=0){
 if(manifest?.format!==1||![0,1].includes(manifest.bank)||!Number.isInteger(manifest.count)||manifest.count<1||manifest.count>64)throw new Error('Invalid cloud manifest');
 const keys=Array.from({length:manifest.count},(_,i)=>cloudPartKey(manifest.bank,i,userId)),values=new Map();
 for(let i=0;i<keys.length;i+=20){const result=await send('VKWebAppStorageGet',{keys:keys.slice(i,i+20)});for(const x of result.keys||[])values.set(x.key,x.value);}
 const profile=unpackCloud(manifest,keys.map(k=>values.get(k)));
 if(userId&&profile.vkUserId!==userId)throw new Error('Cloud profile owner mismatch');
 return profile;
}
