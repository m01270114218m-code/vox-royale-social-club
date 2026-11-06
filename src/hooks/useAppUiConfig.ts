import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppUiConfig = {
  branding: { app_name?: string; logo_url?: string; home_banner_url?: string };
  bottom_nav: { home_label?: string; explore_label?: string; room_label?: string; messages_label?: string; profile_label?: string; home_icon?: string; explore_icon?: string; room_icon?: string; messages_icon?: string; profile_icon?: string };
  mic: { open_asset_url?: string; closed_asset_url?: string; muted_asset_url?: string; host_asset_url?: string };
  buttons: { primary_asset_url?: string; secondary_asset_url?: string; gift_asset_url?: string; send_asset_url?: string };
  routes: Record<string, string>;
  features: Record<string, boolean>;
};
const fallback: AppUiConfig = {
  branding:{app_name:"VOX ROYALE"}, bottom_nav:{home_label:"الغرف",explore_label:"اللحظات",room_label:"غرفتي",messages_label:"الرسائل",profile_label:"أنا"},
  mic:{}, buttons:{}, routes:{}, features:{gifts:true,store:true,vip:true,wallet:true,rooms:true,moments:true,messages:true}
};
export function useAppUiConfig(){
  const [config,setConfig]=useState<AppUiConfig>(fallback);
  useEffect(()=>{
    let alive=true;
    async function load(){
      const {data}=await supabase.from("admin_settings").select("key,value").in("key",["ui.branding","ui.bottom_nav","ui.mic","ui.buttons","ui.routes","features"]);
      if(!alive)return;
      const next=JSON.parse(JSON.stringify(fallback)) as AppUiConfig;
      for(const row of data??[]){
        const v=(row.value??{}) as Record<string,unknown>;
        if(row.key==="ui.branding") next.branding={...next.branding,...v};
        if(row.key==="ui.bottom_nav") next.bottom_nav={...next.bottom_nav,...v};
        if(row.key==="ui.mic") next.mic={...next.mic,...v};
        if(row.key==="ui.buttons") next.buttons={...next.buttons,...v};
        if(row.key==="ui.routes") next.routes={...next.routes,...v as Record<string,string>};
        if(row.key==="features") next.features={...next.features,...v as Record<string,boolean>};
      }
      setConfig(next);
    }
    void load();
    const ch=supabase.channel("app-ui-config").on("postgres_changes",{event:"*",schema:"public",table:"admin_settings"},load).subscribe();
    return()=>{alive=false;supabase.removeChannel(ch);};
  },[]);
  return config;
}
