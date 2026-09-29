import {loadProfile,validUserId} from './progress.js';
import {VKSession,withTimeout} from './vk-session.js';
let session=null,saveTimer=null,saving=false,queued=null;

export async function connectPlatform(guest){
 const params=new URLSearchParams(location.search);
 try{
  if(!window.vkBridge)await withTimeout(new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=new URL('../assets/vendor/vk-bridge.min.js',import.meta.url).href;script.onload=resolve;script.onerror=reject;document.head.append(script);
  }));
  if(!params.has('vk_app_id')&&!window.vkBridge?.isWebView?.())return {profile:guest,cloud:false,user:null};
  session=new VKSession(window.vkBridge,{
   storage:localStorage,search:location.search,
   onBanner:height=>document.documentElement.style.setProperty('--vk-banner-inset',`${height}px`),
   onVisibility:visible=>document.dispatchEvent(new CustomEvent('vk-app-visibility',{detail:{visible}})),
   onReady:()=>session.showBanner(),
  });
  return await session.connect(guest);
 }catch{
  const id=validUserId(params.get('vk_user_id'));
  return {profile:id?loadProfile(localStorage,id).profile:guest,cloud:false,user:null};
 }
}
export function showBanner(){return session?.showBanner();}
export function platformDiagnostics(){return session?{...session.diagnostics,cloud:session.cloudReady}:null;}
async function flush(){
 if(saving||!queued||!session?.cloudReady)return;
 saving=true;const {profile,onError}=queued;queued=null;
 try{await session.write(profile);}catch{onError();}
 finally{saving=false;if(queued)flush();}
}
export function flushCloud(){clearTimeout(saveTimer);return flush();}
export function syncCloud(profile,onError=()=>{}){
 if(!session?.cloudReady||profile.vkUserId!==session.userId)return;
 clearTimeout(saveTimer);queued={profile:JSON.parse(JSON.stringify({...profile,active:null})),onError};
 saveTimer=setTimeout(flush,700);
}
