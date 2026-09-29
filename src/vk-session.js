import {loadProfile,normalizeProfile,validUserId,SAVE_KEY} from './progress.js';
import {CLOUD_KEY,cloudKeyFor,readCloud,writeCloud} from './cloud-save.js';

export async function withTimeout(promise,ms=5000){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('VK request timed out')),ms);})]);}finally{clearTimeout(timer);}
}
export function bannerInset(data){
 if(!data?.result||data.layout_type!=='overlay'||data.banner_location!=='bottom')return 0;
 return Math.max(0,Math.min(200,Number(data.banner_height)||0));
}
export class VKSession{
 constructor(bridge,{storage,search='',onBanner=()=>{},onVisibility=()=>{}}={}){
  this.bridge=bridge;this.storage=storage;this.params=new URLSearchParams(search);this.onBanner=onBanner;this.onVisibility=onVisibility;
  this.userId=0;this.connected=false;this.cloudReady=false;this.bank=1;this.bannerClosed=false;this.bannerAttempted=false;this.bannerPromise=null;
  this.send=(method,args={})=>withTimeout(Promise.resolve().then(()=>this.bridge.send(method,args)));
  this.listener=event=>this.handleEvent(event.detail||event);
 }
 async connect(guest){
  // Query identity is used only for an offline cache if the host is unavailable.
  // The user returned by the initialized VK client takes precedence.
  const launchId=validUserId(this.params.get('vk_user_id'));
  const fallback=launchId?loadProfile(this.storage,launchId).profile:guest;
  try{await this.send('VKWebAppInit');this.connected=true;}catch{return {profile:fallback,cloud:false,user:null};}
  let user;
  try{user=await this.send('VKWebAppGetUserInfo');}catch{
   try{const launch=await this.send('VKWebAppGetLaunchParams');user={id:launch.vk_user_id};}catch{}
  }
  this.userId=validUserId(user?.id);
  if(!this.userId)return {profile:fallback,cloud:false,user:null};
  this.user={id:this.userId,firstName:String(user.first_name||'')};
  this.bridge.subscribe?.(this.listener);
  const local=loadProfile(this.storage,this.userId).profile;
  let remote=null;
  try{
   const root=cloudKeyFor(this.userId);
   const response=await this.send('VKWebAppStorageGet',{keys:[root,CLOUD_KEY,SAVE_KEY,'tilepop_save']});
   if(!Array.isArray(response.keys))throw new Error('Invalid storage response');
   const values=new Map(response.keys.map(x=>[x.key,x.value]));
   if(values.get(root)){
    const manifest=JSON.parse(values.get(root));remote=await readCloud(this.send,manifest,this.userId);this.bank=manifest.bank;
   }else if(values.get(CLOUD_KEY)){
    // Legacy cloud storage was already private to the current VK user.
    remote=await readCloud(this.send,JSON.parse(values.get(CLOUD_KEY)));
   }else{
    const legacy=values.get(SAVE_KEY)||values.get('tilepop_save');if(legacy)remote=normalizeProfile(JSON.parse(legacy));
   }
   if(remote?.vkUserId&&remote.vkUserId!==this.userId)throw new Error('Cloud identity mismatch');
   this.cloudReady=true;
  }catch{
   // A failed read must never be followed by an upload of an empty profile.
   return {profile:local,cloud:false,user:this.user};
  }
  let profile=local;
  if(remote&&(remote.updatedAt>local.updatedAt||!local.updatedAt&&remote.unlocked>local.unlocked)){
   profile=remote;profile.active=local.active;
  }
  profile.vkUserId=this.userId;
  return {profile,cloud:true,user:this.user};
 }
 async write(profile){
  if(!this.cloudReady||profile.vkUserId!==this.userId)throw new Error('No matching VK session');
  this.bank=await writeCloud(this.send,profile,this.bank);
 }
 async showBanner(){
  if(this.bannerClosed)return false;
  if(this.bannerPromise)return this.bannerPromise;
  if(!this.connected||!this.userId||this.bannerClosed||this.bannerAttempted)return false;
  this.bannerAttempted=true;
  this.bannerPromise=(async()=>{
   try{
    if(this.bridge.supportsAsync&&!await withTimeout(this.bridge.supportsAsync('VKWebAppShowBannerAd'),3000))return false;
    const result=await this.send('VKWebAppShowBannerAd',{banner_location:'bottom',banner_align:'center',layout_type:'resize',height_type:'compact',orientation:'horizontal',can_close:true});
    if(!this.bannerClosed)this.onBanner(bannerInset(result));
    return !!result.result;
   }catch{this.onBanner(0);return false;}
  })();
  return this.bannerPromise;
 }
 handleEvent({type,data}){
  if(type==='VKWebAppBannerAdClosedByUser'){this.bannerClosed=true;this.onBanner(0);}
  else if(type==='VKWebAppHideBannerAdResult')this.onBanner(0);
  else if(type==='VKWebAppBannerAdUpdated'&&!this.bannerClosed)this.onBanner(bannerInset(data));
  else if(type==='VKWebAppViewHide')this.onVisibility(false);
  else if(type==='VKWebAppViewRestore')this.onVisibility(true);
 }
 dispose(){this.bridge.unsubscribe?.(this.listener);}
}
