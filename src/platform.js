import { normalizeProfile, SAVE_KEY } from './progress.js';
const timeout=(promise,ms=2500)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),ms))]);
let bridge=null,saveTimer=null;
export async function connectPlatform(local){
  if(!new URLSearchParams(location.search).has('vk_app_id'))return {profile:local,cloud:false};
  try{
    if(!window.vkBridge)await timeout(new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://unpkg.com/@vkontakte/vk-bridge@2.15.11/dist/browser.min.js';s.onload=resolve;s.onerror=reject;document.head.append(s);}));
    bridge=window.vkBridge;await timeout(bridge.send('VKWebAppInit'));
    const result=await timeout(bridge.send('VKWebAppStorageGet',{keys:[SAVE_KEY,'tilepop_save']}));
    const value=result.keys?.find(k=>k.key===SAVE_KEY)?.value||result.keys?.find(k=>k.key==='tilepop_save')?.value;
    if(value){const remote=normalizeProfile(JSON.parse(value));if(remote.updatedAt>local.updatedAt || (!local.updatedAt&&remote.unlocked>local.unlocked))return {profile:remote,cloud:true};}
    return {profile:local,cloud:true};
  }catch{return {profile:local,cloud:false};}
}
export function syncCloud(profile,onError=()=>{}){
  if(!bridge)return;
  clearTimeout(saveTimer);
  // VK values have size limits: keep live run locally; sync compact permanent progress.
  const data={...profile,active:null};
  saveTimer=setTimeout(()=>timeout(bridge.send('VKWebAppStorageSet',{key:SAVE_KEY,value:JSON.stringify(data)})).catch(onError),500);
}
