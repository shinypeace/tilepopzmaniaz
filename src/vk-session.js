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
 constructor(bridge,{storage,search='',onBanner=()=>{},onVisibility=()=>{},onReady=()=>{},schedule=setTimeout,cancel=clearTimeout}={}){
  this.bridge=bridge;this.storage=storage;this.params=new URLSearchParams(search);this.onBanner=onBanner;this.onVisibility=onVisibility;
  this.userId=0;this.connected=false;this.cloudReady=false;this.bank=1;this.bannerClosed=false;this.bannerPromise=null;
  this.onReady=onReady;this.schedule=schedule;this.cancel=cancel;this.bannerAttempts=0;this.bannerVisible=false;this.hidden=false;this.disposed=false;
  this.diagnostics={init:'pending',banner:'pending',attempts:0,error:''};
  this.send=(method,args={})=>withTimeout(Promise.resolve().then(()=>this.bridge.send(method,args)));
  this.listener=event=>this.handleEvent(event.detail||event);
 }
 async connect(guest){
  // Query identity is used only for an offline cache if the host is unavailable.
  // The user returned by the initialized VK client takes precedence.
  const launchId=validUserId(this.params.get('vk_user_id'));
  const fallback=launchId?loadProfile(this.storage,launchId).profile:guest;
  try{await this.send('VKWebAppInit');this.connected=true;this.diagnostics.init='ready';}catch(error){this.diagnostics.init='failed';this.reportError(error);return {profile:fallback,cloud:false,user:null};}
  this.bridge.subscribe?.(this.listener);this.onReady();
  let user;
  try{user=await this.send('VKWebAppGetUserInfo');}catch{
   try{const launch=await this.send('VKWebAppGetLaunchParams');user={id:launch.vk_user_id};}catch{}
  }
  this.userId=validUserId(user?.id);
  if(!this.userId)return {profile:fallback,cloud:false,user:null};
  this.user={id:this.userId,firstName:String(user.first_name||'')};
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
  if(this.bannerClosed||this.hidden||this.disposed)return false;
  if(this.bannerPromise)return this.bannerPromise;
  if(this.bannerVisible)return true;
  if(!this.connected||this.bannerAttempts>=4)return false;
  this.cancel(this.bannerTimer);this.bannerAttempts++;this.diagnostics.attempts=this.bannerAttempts;this.diagnostics.banner='requesting';
  this.bannerPromise=(async()=>{
   try{
    // Query availability is not a reliable gate while the native client starts.
    // Use the common request fields supported by iOS, Android and desktop.
    const result=await this.send('VKWebAppShowBannerAd',{banner_location:'bottom',layout_type:'resize',can_close:true});
    if(this.bannerClosed||this.disposed)return false;
    this.bannerData=result;this.bannerVisible=!!result.result;this.diagnostics.banner=result.result?'shown':'unavailable';
    if(result.result)this.diagnostics.error='';else this.diagnostics.error='VK вернул result: false';
    this.onBanner(bannerInset(result));return !!result.result;
   }catch(error){this.reportError(error);this.diagnostics.banner='failed';this.onBanner(0);return false;}
  })();
  try{return await this.bannerPromise;}finally{this.bannerPromise=null;this.retryBanner();}
 }
 reportError(error){
  const data=error?.error_data||error||{};
  this.diagnostics.error=[data.error_code,data.error_reason||data.error_msg||data.message||error?.error_type||'Unknown VK error'].filter(x=>x!==undefined).join(': ').slice(0,250);
 }
 retryBanner(){
  if(this.bannerVisible||this.bannerClosed||this.hidden||this.disposed||!this.connected||this.bannerAttempts>=4)return;
  this.cancel(this.bannerTimer);this.bannerTimer=this.schedule(()=>this.showBanner(),[5000,20000,60000][Math.max(0,this.bannerAttempts-1)]);
  this.bannerTimer?.unref?.();
 }
 handleEvent({type,data}){
  if(type==='VKWebAppBannerAdClosedByUser'){this.bannerClosed=true;this.bannerVisible=false;this.cancel(this.bannerTimer);this.diagnostics.banner='closed';this.onBanner(0);}
  else if(type==='VKWebAppHideBannerAdResult'){this.bannerVisible=false;this.onBanner(0);}
  else if(type==='VKWebAppBannerAdUpdated'&&!this.bannerClosed){this.bannerData={...this.bannerData,...data};this.onBanner(bannerInset(this.bannerData));}
  else if(type==='VKWebAppViewHide'){this.hidden=true;this.cancel(this.bannerTimer);this.onVisibility(false);}
  else if(type==='VKWebAppViewRestore'){this.hidden=false;this.onVisibility(true);this.retryBanner();}
 }
 dispose(){this.disposed=true;this.cancel(this.bannerTimer);this.bridge.unsubscribe?.(this.listener);}
}
