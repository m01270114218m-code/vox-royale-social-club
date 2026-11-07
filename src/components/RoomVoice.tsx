import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Peer = { pc: RTCPeerConnection; audio?: HTMLAudioElement };
type Props = { roomId:string; uid:string; members:string[]; micEnabled:boolean };

const iceServers: RTCConfiguration = { iceServers:[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}] };

export function RoomVoice({roomId,uid,members,micEnabled}:Props){
 const peers=useRef(new Map<string,Peer>()); const stream=useRef<MediaStream|null>(null); const channel=useRef<ReturnType<typeof supabase.channel>|null>(null);
 useEffect(()=>{
  const ch=supabase.channel(`voice-${roomId}`,{config:{broadcast:{self:false}}});
  channel.current=ch;
  ch.on("broadcast",{event:"signal"},async ({payload})=>{
   if(payload?.roomId!==roomId||payload?.to!==uid)return;
   const from=String(payload.from); let peer=peers.current.get(from);
   if(!peer) peer=await makePeer(from,false);
   const pc=peer.pc;
   try{
    if(payload.kind==="offer"){await pc.setRemoteDescription(payload.data); const answer=await pc.createAnswer(); await pc.setLocalDescription(answer); await send(from,"answer",answer);}
    else if(payload.kind==="answer"){await pc.setRemoteDescription(payload.data);}
    else if(payload.kind==="ice" && payload.data){await pc.addIceCandidate(payload.data);}
   }catch{}
  }).subscribe();
  return ()=>{supabase.removeChannel(ch);channel.current=null;peers.current.forEach(p=>p.pc.close());peers.current.clear(); if(stream.current){stream.current.getTracks().forEach(t=>t.stop());stream.current=null;}};
 },[roomId,uid]);

 useEffect(()=>{ if(!channel.current)return; void syncPeers(); },[members.join(","),micEnabled]);

 async function send(to:string,kind:string,data:unknown){await channel.current?.send({type:"broadcast",event:"signal",payload:{roomId,from:uid,to,kind,data}});}
 async function makePeer(peerId:string,initiator:boolean){
  const existing=peers.current.get(peerId); if(existing)return existing;
  const pc=new RTCPeerConnection(iceServers); const audio=new Audio(); audio.autoplay=true; audio.playsInline=true;
  pc.ontrack=e=>{audio.srcObject=e.streams[0]; void audio.play().catch(()=>{});};
  pc.onicecandidate=e=>{if(e.candidate)void send(peerId,"ice",e.candidate.toJSON());};
  peers.current.set(peerId,{pc,audio});
  if(stream.current)stream.current.getTracks().forEach(t=>pc.addTrack(t,stream.current!));
  else pc.addTransceiver("audio",{direction:"recvonly"});
  if(initiator){const offer=await pc.createOffer();await pc.setLocalDescription(offer);await send(peerId,"offer",offer);}
  return {pc,audio};
 }
 async function syncPeers(){
  const targets=members.filter(x=>x&&x!==uid);
  // Keep the peer graph warm. Never tear down/recreate it just because the mic toggled.
  await Promise.all(targets.filter(id=>!peers.current.has(id)).map(id=>makePeer(id,uid<id)));
  for(const [id,p] of peers.current){if(!targets.includes(id)){p.pc.close();p.audio?.remove();peers.current.delete(id);}}

  if(micEnabled && !stream.current){
    try{
      stream.current=await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}
      });
    }catch{toast.error("اسمح للميكروفون من صلاحيات التطبيق");return;}
  }

  const track=stream.current?.getAudioTracks()[0];
  if(track) track.enabled=micEnabled;

  await Promise.all([...peers.current.entries()].map(async ([peerId,{pc}])=>{
    let transceiver=pc.getTransceivers().find(t=>t.receiver.track?.kind==="audio" && t.sender);
    let sender=transceiver?.sender || pc.getSenders().find(s=>s.track?.kind==="audio" || s.track===null);
    let needsNegotiation=false;

    if(sender){
      await sender.replaceTrack(micEnabled ? track ?? null : null);
      transceiver=pc.getTransceivers().find(t=>t.sender===sender);
      if(transceiver){
        const desired=micEnabled ? "sendrecv" : "recvonly";
        if(transceiver.direction!==desired){transceiver.direction=desired; needsNegotiation=true;}
      }
    }else if(track){
      pc.addTrack(track,stream.current!);
      needsNegotiation=true;
    }

    if(needsNegotiation){
      const offer=await pc.createOffer();
      await pc.setLocalDescription(offer);
      await send(peerId,"offer",offer);
    }
  }));
 }
 return null;
}
