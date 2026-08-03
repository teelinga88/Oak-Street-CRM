import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth, TEAM_ROSTER } from '../context/AuthContext';
import { useAccounts, useDeals, useFollowups, useBucket, dismissNetworkLead, disqualifyBucketLead, useCelebrations, addCelebration, useLeadCriteria, requestBucketRefill, getZoomInfoIndustries } from '../hooks/useData';

const ACCT_COLORS=[['#E6F1FB','#0C447C'],['#E1F5EE','#085041'],['#FAEEDA','#633806'],['#EEEDFE','#3C3489'],['#FAECE7','#712B13'],['#FBEAF0','#72243E'],['#F0FFF4','#276749'],['#FFF5F5','#C53030'],['#FFFFF0','#744210'],['#E9F0FF','#2B4ECF']];
const acctColor = n => ACCT_COLORS[(n.charCodeAt(0)+(n.charCodeAt(1)||0))%ACCT_COLORS.length];
const initials = n => n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const today = () => new Date().toISOString().split('T')[0];
const nowLabel = () => new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const fmtDate = d => { if(!d) return '—'; return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
const daysAgo = iso => { if(!iso) return '—'; const d=Math.floor((Date.now()-new Date(iso))/(864e5)); if(d===0)return'Today'; if(d===1)return'Yesterday'; if(d<7)return d+' days ago'; return Math.floor(d/7)+' wks ago'; };
const daysSince = iso => { if(!iso) return null; return Math.floor((Date.now()-new Date(iso))/(864e5)); };
const isThisMonth = iso => { if(!iso) return false; const d=new Date(iso); const n=new Date(); return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth(); };
const fmtMoney = n => { const v=Number(n)||0; return v<0 ? '-$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}) : '$'+v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}); };
const formatPhone = v => { const d=(v||'').replace(/\D/g,'').slice(0,10); if(d.length===0) return ''; if(d.length<4) return '('+d; if(d.length<7) return '('+d.slice(0,3)+') '+d.slice(3); return '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6); };
const isAtRisk = a => { const d = daysSince(a.lastShipmentDate); return d === null ? false : d >= 60; };

function getMonthKey(offset=0) {
  const d=new Date(); d.setMonth(d.getMonth()+offset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function getTrending(account) {
  const counts=account.shipmentCounts||{};
  const cur=counts[getMonthKey(0)]||0, prev=counts[getMonthKey(-1)]||0;
  if(prev===0&&cur===0) return null;
  if(prev===0) return {pct:100,dir:'up'};
  const pct=Math.round(((cur-prev)/prev)*100);
  if(pct>0) return {pct,dir:'up'};
  if(pct<0) return {pct:Math.abs(pct),dir:'down'};
  return {pct:0,dir:'flat'};
}

const STAGES=['New Lead','Attempted','Contact Made','Quoting'];
const SCOLS={'New Lead':['#F1EFE8','#5F5E5A'],'Attempted':['#FDF0D9','#8A5A12'],'Contact Made':['#FAEEDA','#633806'],'Quoting':['#E6F1FB','#0C447C'],'Closed Won':['#EAF3DE','#3B6D11'],'Closed Lost':['#FCEBEB','#A32D2D']};
const SOURCES=['Cold Call','Referral','Network Lead'];
const LOST_REASONS=['Price too high','Went with competitor','No volume available','No response','Other'];
const ACT_TYPES=['Call','Email','Meeting','Note','Other'];
const BUCKET_CAP=50;
const ACCT_STATUSES=['Active','At risk','Inactive'];
const badgeStyle=s=>({Active:{background:'#EAF3DE',color:'#3B6D11'},['At risk']:{background:'#FCEBEB',color:'#A32D2D'},Inactive:{background:'#F1EFE8',color:'#5F5E5A'}}[s]||{background:'#eee',color:'#666'});
const srcStyle=s=>({'Cold Call':{background:'#EEF2FF',color:'#3730A3'},Referral:{background:'#EAF3DE',color:'#3B6D11'},'Network Lead':{background:'#FAEEDA',color:'#633806'}}[s]||{background:'#eee',color:'#666'});

const S={
  input:{width:'100%',fontSize:13,fontFamily:'inherit',padding:'7px 10px',border:'0.5px solid #D5D4CF',borderRadius:8,background:'#fff',color:'#1a1a1a',outline:'none',boxSizing:'border-box'},
  label:{display:'block',fontSize:11,color:'#666',marginBottom:4,fontWeight:500},
  btn:{padding:'6px 12px',borderRadius:8,fontSize:12,cursor:'pointer',border:'0.5px solid #D5D4CF',background:'transparent',color:'#1a1a1a',display:'flex',alignItems:'center',gap:5,fontFamily:'inherit'},
  btnPrimary:{padding:'6px 12px',borderRadius:8,fontSize:12,cursor:'pointer',border:'0.5px solid #1a1a1a',background:'#1a1a1a',color:'#fff',display:'flex',alignItems:'center',gap:5,fontFamily:'inherit'},
  btnLog:{padding:'6px 12px',borderRadius:8,fontSize:12,cursor:'pointer',border:'0.5px solid #A8C8F0',background:'#E6F1FB',color:'#0C447C',display:'flex',alignItems:'center',gap:5,fontFamily:'inherit'},
  btnFu:{padding:'6px 12px',borderRadius:8,fontSize:12,cursor:'pointer',border:'0.5px solid #FAC775',background:'#FAEEDA',color:'#633806',display:'flex',alignItems:'center',gap:5,fontFamily:'inherit'},
  card:{background:'#F7F6F3',borderRadius:10,padding:'12px 14px'},
};

function HeaderTruck(){return <svg width="140" height="69" viewBox="0 0 650 320" role="img" aria-label="Flatbed truck" style={{flexShrink:0}}><ellipse cx="330" cy="284" rx="290" ry="9" fill="rgba(0,0,0,0.18)"/><circle cx="125" cy="250" r="30" fill="#111418"/><circle cx="125" cy="250" r="16" fill="#D7DBDE"/><circle cx="125" cy="250" r="6" fill="#2A2E33"/><circle cx="225" cy="250" r="30" fill="#111418"/><circle cx="225" cy="250" r="16" fill="#D7DBDE"/><circle cx="225" cy="250" r="6" fill="#2A2E33"/><circle cx="268" cy="250" r="30" fill="#111418"/><circle cx="268" cy="250" r="16" fill="#D7DBDE"/><circle cx="268" cy="250" r="6" fill="#2A2E33"/><circle cx="460" cy="250" r="30" fill="#111418"/><circle cx="460" cy="250" r="16" fill="#D7DBDE"/><circle cx="460" cy="250" r="6" fill="#2A2E33"/><circle cx="505" cy="250" r="30" fill="#111418"/><circle cx="505" cy="250" r="16" fill="#D7DBDE"/><circle cx="505" cy="250" r="6" fill="#2A2E33"/><rect x="130" y="212" width="430" height="8" fill="#2A2E33"/><rect x="58" y="206" width="28" height="12" rx="2" fill="#D7DBDE"/><rect x="66" y="148" width="16" height="60" rx="2" fill="#D7DBDE"/><line x1="68" y1="158" x2="80" y2="158" stroke="#9AA0A5" strokeWidth="2"/><line x1="68" y1="168" x2="80" y2="168" stroke="#9AA0A5" strokeWidth="2"/><line x1="68" y1="178" x2="80" y2="178" stroke="#9AA0A5" strokeWidth="2"/><line x1="68" y1="188" x2="80" y2="188" stroke="#9AA0A5" strokeWidth="2"/><rect x="68" y="152" width="10" height="8" rx="1" fill="#F2D98A"/><rect x="82" y="148" width="95" height="64" rx="4" fill="#111418"/><rect x="82" y="178" width="95" height="4" fill="#D7DBDE"/><rect x="177" y="108" width="95" height="104" rx="6" fill="#111418"/><rect x="190" y="120" width="68" height="42" rx="6" fill="#0B0D10" stroke="#D7DBDE" strokeWidth="2"/><rect x="182" y="116" width="6" height="18" rx="2" fill="#2A2E33"/><circle cx="200" cy="112" r="4" fill="#B3272C"/><rect x="252" y="38" width="11" height="112" rx="3" fill="#D7DBDE"/><rect x="249" y="32" width="17" height="9" rx="2" fill="#2A2E33"/><rect x="268" y="38" width="11" height="112" rx="3" fill="#D7DBDE"/><rect x="265" y="32" width="17" height="9" rx="2" fill="#2A2E33"/><polygon points="272,212 300,212 296,200 276,200" fill="#2A2E33"/><rect x="296" y="198" width="264" height="14" rx="2" fill="#8A929B"/><rect x="308" y="136" width="112" height="62" rx="2" fill="#5B6470" stroke="#333A42" strokeWidth="2.5"/><line x1="340" y1="136" x2="340" y2="198" stroke="#333A42" strokeWidth="1.5"/><line x1="380" y1="136" x2="380" y2="198" stroke="#333A42" strokeWidth="1.5"/><rect x="432" y="136" width="112" height="62" rx="2" fill="#5B6470" stroke="#333A42" strokeWidth="2.5"/><line x1="464" y1="136" x2="464" y2="198" stroke="#333A42" strokeWidth="1.5"/><line x1="504" y1="136" x2="504" y2="198" stroke="#333A42" strokeWidth="1.5"/><line x1="364" y1="130" x2="364" y2="198" stroke="#2A2E33" strokeWidth="5"/><line x1="484" y1="130" x2="484" y2="198" stroke="#2A2E33" strokeWidth="5"/><rect x="357" y="196" width="14" height="9" rx="1" fill="#9AA0A5"/><rect x="477" y="196" width="14" height="9" rx="1" fill="#9AA0A5"/><line x1="575" y1="228" x2="602" y2="222" stroke="#9AA0A5" strokeWidth="3" opacity="0.5"/><line x1="575" y1="244" x2="606" y2="240" stroke="#9AA0A5" strokeWidth="3" opacity="0.4"/></svg>;}

function Modal({title,sub,onClose,onSave,saveLabel='Save',showDelete=false,onDelete,children}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:100,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:24}}>
      <div style={{background:'#fff',borderRadius:12,border:'0.5px solid #E5E4DF',padding:20,width:400,maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        <h3 style={{fontSize:15,fontWeight:600,marginBottom:sub?4:14}}>{title}</h3>
        {sub&&<p style={{fontSize:12,color:'#888',marginBottom:14}}>{sub}</p>}
        <div style={{overflowY:'auto',flex:1,paddingRight:2}}>{children}</div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16,flexShrink:0}}>
          {showDelete&&<button style={{...S.btn,color:'#A32D2D',borderColor:'#F09595'}} onClick={onDelete}>🗑 Delete</button>}
          <button style={S.btn} onClick={onClose}>Cancel</button>
          <button style={S.btnPrimary} onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
function FRow({label,children}){return <div style={{marginBottom:12}}><label style={S.label}>{label}</label>{children}</div>;}

function IndustryPicker({value,onChange,options}){
  // value: array of selected industry name strings. options: [{id,name}] from ZoomInfo.
  const[text,setText]=useState('');
  const[open,setOpen]=useState(false);
  const wrapRef=useRef(null);
  useEffect(()=>{
    function onDocClick(e){ if(wrapRef.current&&!wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown',onDocClick);
    return ()=>document.removeEventListener('mousedown',onDocClick);
  },[]);
  const selected=value||[];
  const q=text.trim().toLowerCase();
  const filtered=(options||[]).filter(o=>!selected.includes(o.name)&&(!q||o.name.toLowerCase().includes(q))).slice(0,40);
  function addIndustry(name){
    if(!name||selected.includes(name)) return;
    onChange([...selected,name]);
    setText('');
  }
  function removeIndustry(name){
    onChange(selected.filter(n=>n!==name));
  }
  function onKeyDown(e){
    if(e.key==='Enter'){
      e.preventDefault();
      if(filtered.length>0) addIndustry(filtered[0].name);
      else if(text.trim()) addIndustry(text.trim());
    } else if(e.key==='Backspace'&&!text&&selected.length){
      removeIndustry(selected[selected.length-1]);
    } else if(e.key==='Escape'){
      setOpen(false);
    }
  }
  return(
    <div ref={wrapRef} style={{position:'relative'}}>
      <div style={{...S.input,display:'flex',flexWrap:'wrap',gap:6,minHeight:34,alignItems:'center',padding:'6px 8px'}} onClick={()=>setOpen(true)}>
        {selected.map(name=>(
          <span key={name} style={{background:'#EEF2FF',color:'#3730A3',borderRadius:6,padding:'2px 6px',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
            {name}
            <span style={{cursor:'pointer',fontWeight:700}} onClick={(e)=>{e.stopPropagation();removeIndustry(name);}}>×</span>
          </span>
        ))}
        <input
          style={{border:'none',outline:'none',fontSize:13,fontFamily:'inherit',flex:1,minWidth:100,background:'transparent'}}
          value={text}
          onFocus={()=>setOpen(true)}
          onChange={e=>{setText(e.target.value);setOpen(true);}}
          onKeyDown={onKeyDown}
          placeholder={selected.length?'':'Start typing an industry…'}
        />
      </div>
      {open&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,marginTop:4,background:'#fff',border:'0.5px solid #D5D4CF',borderRadius:8,maxHeight:220,overflowY:'auto',zIndex:50,boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
          {options===null&&<div style={{padding:'8px 10px',fontSize:12,color:'#888'}}>Loading industries…</div>}
          {options!==null&&filtered.length===0&&(
            <div style={{padding:'8px 10px',fontSize:12,color:'#888'}}>
              {q?`No match — press Enter to add "${text.trim()}" as-is.`:'No more industries to add.'}
            </div>
          )}
          {options!==null&&filtered.map(o=>(
            <div key={o.id} style={{padding:'7px 10px',fontSize:13,cursor:'pointer'}}
              onMouseDown={(e)=>{e.preventDefault();addIndustry(o.name);}}
              onMouseEnter={e=>e.currentTarget.style.background='#F7F6F3'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {o.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Wraps IndustryPicker (a multi-select chip autocomplete) to behave as a
// single-industry select for one allocation row: reuses the same searchable
// ZoomInfo-taxonomy dropdown UX, but only ever keeps the most recently picked
// value instead of a growing chip list.
function IndustryRowPicker({industry,onChange,options}){
  const value=industry?[industry]:[];
  return(
    <IndustryPicker
      value={value}
      options={options}
      onChange={(arr)=>onChange(arr.length?arr[arr.length-1]:'')}
    />
  );
}
function FGrid({children}){return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{children}</div>;}
function DetailSection({title,children}){return(<div style={{marginBottom:20}}><div style={{fontSize:11,fontWeight:500,color:'#aaa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>{title}</div>{children}</div>);}
function DetailRow({k,v}){return(<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,padding:'8px 0',borderBottom:'0.5px solid #F0EFE8'}}><span style={{color:'#888'}}>{k}</span><span style={{fontWeight:500,textAlign:'right',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</span></div>);}

// ── Closed Won celebration ───────────────────────────────────────────────
// A short ascending 4-note chime, synthesized with the Web Audio API so no
// audio file needs to be bundled/hosted. Fires locally for whoever triggers
// it, and — via the shared `celebrations` Firestore doc — for every other
// rep's browser too.
function playFanfare(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return;
    const ctx=new Ctx();
    const notes=[523.25,659.25,783.99,1046.50];
    notes.forEach((freq,i)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='triangle';
      osc.frequency.value=freq;
      const start=ctx.currentTime+i*0.12;
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(0.28,start+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001,start+0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);osc.stop(start+0.42);
    });
  }catch(e){/* audio not available — visual fireworks still show */}
}

function Fireworks(){
  const colors=['#FFC700','#FF3D71','#00D9FF','#7ED957','#FF8A00','#C77DFF'];
  const bursts=useMemo(()=>['22%','50%','78%','36%','64%'].map((x,bi)=>({
    x, y:['30%','18%','32%','56%','52%'][bi],
    particles:Array.from({length:18}).map((_,i)=>{
      const angle=(i/18)*2*Math.PI;
      const dist=55+Math.random()*55;
      return{dx:Math.cos(angle)*dist,dy:Math.sin(angle)*dist,color:colors[(i+bi)%colors.length],dur:0.9+Math.random()*0.5};
    }),
  })),[]);
  return(
    <div style={{position:'fixed',inset:0,zIndex:300,pointerEvents:'none',overflow:'hidden'}}>
      <style>{`
        @keyframes fwParticle{
          0%{transform:translate(0,0) scale(1);opacity:1;}
          100%{transform:translate(var(--dx),var(--dy)) scale(0.3);opacity:0;}
        }
        @keyframes fwBanner{
          0%{transform:translate(-50%,-60%) scale(0.6);opacity:0;}
          15%{transform:translate(-50%,-50%) scale(1.05);opacity:1;}
          85%{transform:translate(-50%,-50%) scale(1);opacity:1;}
          100%{transform:translate(-50%,-50%) scale(0.9);opacity:0;}
        }
      `}</style>
      {bursts.map((b,bi)=>(
        <div key={bi} style={{position:'absolute',left:b.x,top:b.y}}>
          {b.particles.map((p,i)=>(
            <div key={i} style={{
              position:'absolute',width:6,height:6,borderRadius:'50%',background:p.color,
              '--dx':`${p.dx}px`,'--dy':`${p.dy}px`,
              animation:`fwParticle ${p.dur}s ease-out ${bi*0.15}s forwards`,
            }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function CRM(){
  const{repProfile,currentUser,logout}=useAuth();
  const isManager=repProfile?.isManager||false;
  const repName=repProfile?.name||'';
  const repEmail=currentUser?.email||'';
  const{accounts,addAccount,updateAccount,deleteAccount}=useAccounts(repName,isManager);
  const{deals,addDeal,updateDeal,deleteDeal}=useDeals(repName,isManager);
  const{followups,addFollowup,updateFollowup,deleteFollowup}=useFollowups(repName,isManager);
  const{leads,addLead,updateLead,deleteLead}=useBucket(repName,isManager);

  // Manager-only "viewing as" — lets a manager pull up any rep's My
  // Accounts / My Pipeline / Cold Call Bucket exactly like that rep sees
  // them (switch via the sidebar selector, or "View this rep's screens" on
  // the Manager Dashboard), instead of only ever seeing their own. Defaults
  // to — and for non-managers always stays — the logged-in rep's own name.
  const[viewAsRep,setViewAsRep]=useState(repName);
  useEffect(()=>{ if(repName)setViewAsRep(repName); },[repName]);
  // Email of whichever rep is currently being viewed — so "My lead
  // criteria" reads/writes THAT rep's saved ZoomInfo criteria rather than
  // always the logged-in manager's own.
  const viewAsEmail=useMemo(()=>{
    const entry=Object.entries(TEAM_ROSTER).find(([,r])=>r.name===viewAsRep);
    return entry?entry[0]:repEmail;
  },[viewAsRep,repEmail]);
  const{criteria:leadCriteria,saveLeadCriteria}=useLeadCriteria(viewAsEmail);

  const[view,setView]=useState('accounts');
  const[selId,setSelId]=useState(null);
  const[modal,setModal]=useState(null);
  const[search,setSearch]=useState('');
  const[statusFilter,setStatusFilter]=useState('');
  const[atRiskOnly,setAtRiskOnly]=useState(false);
  const[daysSortDir,setDaysSortDir]=useState(null);
  const[srcFilter,setSrcFilter]=useState('');
  const[mgrSel,setMgrSel]=useState(null);
  const[toast,setToast]=useState('');
  function showToast(msg){setToast(msg);setTimeout(()=>setToast(''),3000);}
  const[colSearch,setColSearch]=useState({});
  const celebration=useCelebrations();
  const[activeCelebration,setActiveCelebration]=useState(null);
  useEffect(()=>{
    if(!celebration)return;
    setActiveCelebration(celebration);
    playFanfare();
    const t=setTimeout(()=>setActiveCelebration(null),4500);
    return()=>clearTimeout(t);
  },[celebration?.id]);

  const myAccounts=useMemo(()=>accounts.filter(a=>a.rep===viewAsRep),[accounts,viewAsRep]);
  const myDeals=useMemo(()=>deals.filter(d=>d.rep===viewAsRep),[deals,viewAsRep]);
  const myFollowups=useMemo(()=>followups.filter(f=>f.rep===viewAsRep),[followups,viewAsRep]);
  // `leads` is every rep's bucket when the caller is a manager (see useBucket
  // above) — myLeads narrows it back down to whichever rep's bucket is
  // currently being viewed, same pattern as myAccounts/myDeals.
  const myLeads=useMemo(()=>leads.filter(l=>l.rep===viewAsRep),[leads,viewAsRep]);

  // Manager-only: move an account, prospect, or bucket lead to a different
  // rep — triggered by the 🔁 Reassign button right on that record's own
  // detail panel or card (see openReassignModal/reassignState below).
  async function reassignRecord(kind,id,newRep){
    if(kind==='account')await updateAccount(id,{rep:newRep});
    else if(kind==='deal')await updateDeal(id,{rep:newRep});
    else if(kind==='lead')await updateLead(id,{rep:newRep});
    showToast(`Reassigned to ${newRep.split(' ')[0]}`);
  }
  const[reassignState,setReassignState]=useState({});
  function openReassignModal(kind,id,currentRep){
    setReassignState({kind,id,rep:currentRep||viewAsRep});
    setModal({type:'reassign'});
  }
  async function saveReassign(){
    await reassignRecord(reassignState.kind,reassignState.id,reassignState.rep);
    setModal(null);
  }
  const sortedAccounts=useMemo(()=>{
    const w=myAccounts.filter(a=>(a.shipmentsThisMonth||0)>0).sort((a,b)=>(b.shipmentsThisMonth||0)-(a.shipmentsThisMonth||0));
    const wo=myAccounts.filter(a=>!(a.shipmentsThisMonth>0)).sort((a,b)=>a.name.localeCompare(b.name));
    return[...w,...wo];
  },[myAccounts]);
  const filteredAccounts=useMemo(()=>{
    let list=sortedAccounts.filter(a=>{
      const q=search.toLowerCase();
      return(!q||(a.name+a.contact+a.email+a.location+a.shipmentType).toLowerCase().includes(q))&&(!statusFilter||a.status===statusFilter)&&(!atRiskOnly||isAtRisk(a));
    });
    if(daysSortDir&&atRiskOnly){
      list=[...list].sort((a,b)=>{
        const da=daysSince(a.lastShipmentDate),db=daysSince(b.lastShipmentDate);
        if(da===null&&db===null)return 0;
        if(da===null)return 1;
        if(db===null)return -1;
        return daysSortDir==='asc'?da-db:db-da;
      });
    }
    return list;
  },[sortedAccounts,search,statusFilter,atRiskOnly,daysSortDir]);
  const selectedAccount=useMemo(()=>accounts.find(a=>a.id===selId),[accounts,selId]);
  const selectedDeal=useMemo(()=>deals.find(d=>d.id===selId),[deals,selId]);
  const selectedLead=useMemo(()=>leads.find(l=>l.id===selId),[leads,selId]);
  const selectedFollowup=useMemo(()=>followups.find(f=>f.id===selId),[followups,selId]);
  const shipmentsPerRep=useMemo(()=>{
    const map={};
    Object.values(TEAM_ROSTER).forEach(r=>{map[r.name]=accounts.filter(a=>a.rep===r.name).reduce((s,a)=>s+(a.shipmentsThisMonth||0),0);});
    return map;
  },[accounts]);
  const marginPerRep=useMemo(()=>{
    const map={};
    Object.values(TEAM_ROSTER).forEach(r=>{map[r.name]=accounts.filter(a=>a.rep===r.name).reduce((s,a)=>s+(a.marginThisMonth||0),0);});
    return map;
  },[accounts]);
  const myShipmentsThisMonth=useMemo(()=>myAccounts.reduce((s,a)=>s+(a.shipmentsThisMonth||0),0),[myAccounts]);
  const myMarginThisMonth=useMemo(()=>myAccounts.reduce((s,a)=>s+(a.marginThisMonth||0),0),[myAccounts]);
  const atRiskCount=useMemo(()=>myAccounts.filter(a=>isAtRisk(a)).length,[myAccounts]);

  const[af,setAf]=useState({});
  function openAccountModal(id=null){
    const a=id?accounts.find(x=>x.id===id):null;
    setAf(a?{...a}:{name:'',industry:'',location:'',status:'Active',contact:'',email:'',phone:'',shipmentType:'',commodity:'',notes:'',rep:viewAsRep});
    setModal({type:'account',id});
  }
  async function saveAccount(){
    if(!af.name?.trim()){showToast('Company name required');return;}
    if(modal.id){await updateAccount(modal.id,{...af,rep:af.rep||viewAsRep});}
    else{await addAccount({...af,rep:af.rep||viewAsRep});}
    setModal(null);showToast('Account saved!');
  }
  async function handleDeleteAccount(){
    if(!window.confirm('Delete this account?'))return;
    await deleteAccount(modal.id);setModal(null);setSelId(null);showToast('Account deleted');
  }

  const[df,setDf]=useState({});
  const[dealCompany,setDealCompany]=useState('');
  const[companySuggs,setCompanySuggs]=useState([]);
  const[isNewProspect,setIsNewProspect]=useState(false);
  function openDealModal(id=null){
    const d=id?deals.find(x=>x.id===id):null;
    const linkedAcct=d?.accountId?accounts.find(x=>x.id===d.accountId):null;
    setDf(d?{...d,...(linkedAcct?{contact:linkedAcct.contact||'',email:linkedAcct.email||'',phone:linkedAcct.phone||'',address:linkedAcct.address||'',location:linkedAcct.location||'',zip:linkedAcct.zip||''}:{})}:{stage:'New Lead',source:'Cold Call',lostReason:'',activities:[]});
    setDealCompany(d?.account||'');setIsNewProspect(false);setCompanySuggs([]);setModal({type:'deal',id});
  }
  function handleCompanyInput(val){
    setDealCompany(val);setIsNewProspect(false);
    if(!val.trim()){setCompanySuggs([]);return;}
    const all=[...new Set([...accounts.map(a=>a.name),...deals.map(d=>d.account)])];
    setCompanySuggs(all.filter(n=>n.toLowerCase().includes(val.toLowerCase())).slice(0,6));
  }
  async function saveDeal(){
    const accountName=modal.id?df.account:dealCompany.trim();
    if(!accountName){showToast('Company name required');return;}
    const stage=df.stage||'New Lead';
    const accountId=df.accountId||null;
    const note=df.newNote?.trim();
    const activities=df.activities||[];
    if(note)activities.unshift({text:note,time:nowLabel()});
    if(modal.id){
      const oldStage=deals.find(x=>x.id===modal.id)?.stage;
      if(stage!==oldStage)activities.unshift({text:`Stage changed: ${oldStage} → ${stage}`,time:nowLabel()});
      if(accountId){
        await updateAccount(accountId,{contact:df.contact||'',email:df.email||'',phone:df.phone||'',address:df.address||'',location:df.location||'',zip:df.zip||''});
      }
      await updateDeal(modal.id,{...df,activities,newNote:null});
    }else{
      // Note: a brand-new prospect never gets an Account here, even if optional
      // contact details were filled in — it isn't a real customer yet. The
      // contact info lives on the deal itself until it's actually Closed Won
      // (see handleCloseWon), which is the only place an Account gets created.
      activities.push({text:'Prospect added to pipeline',time:nowLabel()});
      await addDeal({
        account:accountName,accountId:null,stage,source:df.source,rep:viewAsRep,lostReason:'',activities,
        contact:df.npContact||'',email:df.npEmail||'',phone:df.npPhone||'',location:df.npLocation||'',shipmentType:df.npShipmentType||'',
      });
    }
    setModal(null);showToast('Prospect saved!');
  }
  async function handleDeleteDeal(){
    if(!window.confirm('Delete this prospect?'))return;
    const deal=deals.find(x=>x.id===modal.id);
    if(deal?.source==='Network Lead')await dismissNetworkLead(deal.account);
    await deleteDeal(modal.id);setModal(null);setSelId(null);showToast('Prospect deleted');
  }

  async function handleCloseWon(dealId){
    const deal=deals.find(x=>x.id===dealId);
    if(!deal)return;
    if(!window.confirm(`Mark "${deal.account}" as Closed Won? This moves it into My Accounts as an Active account.`))return;
    let accountId=deal.accountId;
    const wonAt=new Date().toISOString();
    if(accountId){
      const acct=accounts.find(a=>a.id===accountId);
      const activities=[{text:'🎉 Closed Won — converted from pipeline',time:nowLabel()},...(acct?.activities||[])];
      await updateAccount(accountId,{status:'Active',activities,wonAt});
    }else{
      const newAcct=await addAccount({
        name:deal.account,industry:'',location:deal.location||'',status:'Active',
        contact:deal.contact||'',email:deal.email||'',phone:deal.phone||'',
        rep:deal.rep||viewAsRep,shipmentType:'',commodity:'',notes:'',wonAt,
        activities:[{text:'🎉 Closed Won — converted from pipeline',time:nowLabel()}],
      });
      accountId=newAcct.id;
    }
    await deleteDeal(dealId);
    await addCelebration({rep:deal.rep||viewAsRep,account:deal.account});
    setSelId(null);
    showToast(`🎉 ${deal.account} marked Closed Won!`);
  }

  const[ff,setFf]=useState({});
  function openFollowupModal(id=null,prefillAccountId=null,prefillDealId=null){
    const f=id?followups.find(x=>x.id===id):null;
    const tomorrow=new Date(Date.now()+864e5).toISOString().split('T')[0];
    const deal=prefillDealId?deals.find(x=>x.id===prefillDealId):null;
    const acct=prefillAccountId?accounts.find(x=>x.id===prefillAccountId):null;
    setFf(f?{...f}:{accountId:prefillAccountId||'',dealId:prefillDealId||'',account:deal?.account||acct?.name||'',dueDate:tomorrow,contact:deal?.contact||acct?.contact||'',email:deal?.email||acct?.email||'',phone:deal?.phone||acct?.phone||'',notes:''});
    setModal({type:'followup',id});
  }
  async function saveFollowup(){
    if(!ff.dueDate){showToast('Due date required');return;}
    let account=ff.account;
    if(ff.accountId){const acct=accounts.find(a=>a.id===ff.accountId);account=acct?.name||account;}
    const data={...ff,account,rep:viewAsRep};
    if(modal.id){await updateFollowup(modal.id,data);}else{await addFollowup(data);}
    setModal(null);showToast('Follow-up saved!');
  }
  async function handleDeleteFollowup(){
    if(!window.confirm('Delete this follow-up?'))return;
    await deleteFollowup(modal.id);setModal(null);setSelId(null);showToast('Follow-up deleted');
  }

  const[logState,setLogState]=useState({type:'Call',text:''});
  function openLogModal(accountId,followupId=null,dealId=null){setLogState({accountId,followupId,dealId,type:'Call',text:''});setModal({type:'log'});}
  async function saveLog(){
    if(!logState.text?.trim()){showToast('Description required');return;}
    const entry={text:`[${logState.type}] ${logState.text.trim()}`,time:nowLabel()};
    if(logState.accountId){
      const a=accounts.find(x=>x.id===logState.accountId);if(!a)return;
      await updateAccount(a.id,{activities:[entry,...(a.activities||[])],lastContact:new Date().toISOString()});
    }else if(logState.dealId){
      // No linked Account yet (still just a prospect) — log against the deal itself.
      const d=deals.find(x=>x.id===logState.dealId);if(!d)return;
      await updateDeal(d.id,{activities:[entry,...(d.activities||[])]});
    }else return;
    if(logState.followupId)await updateFollowup(logState.followupId,{done:true,completedAt:today()});
    setModal(null);showToast('Activity logged!');
  }

  const[bucketForm,setBucketForm]=useState({});
  function openBucketForm(){setBucketForm({company:'',contact:'',email:'',phone:'',location:'',address:'',zip:'',industry:'',jobTitle:'',website:''});setModal({type:'addLead'});}
  async function saveLead(){
    if(!bucketForm.company?.trim()){showToast('Company name required');return;}
    await addLead({...bucketForm,rep:viewAsRep});setModal(null);showToast('Lead added!');
  }

  // Editing an EXISTING bucket lead — separate from "Add lead" above. Reps
  // need this after a failed attempt turns up better info (a bad number,
  // the real decision-maker's name, a corrected email, etc.) so the next
  // attempt at this same lead actually has a shot. Only the editable fields
  // are touched; attempts/notes/createdAt/rep/source are left alone.
  function openEditLeadModal(lead){
    setBucketForm({...lead});
    setModal({type:'editLead',id:lead.id});
  }
  async function saveEditLead(){
    if(!bucketForm.company?.trim()){showToast('Company name required');return;}
    await updateLead(modal.id,{
      company:bucketForm.company,contact:bucketForm.contact||'',email:bucketForm.email||'',phone:bucketForm.phone||'',
      location:bucketForm.location||'',address:bucketForm.address||'',zip:bucketForm.zip||'',industry:bucketForm.industry||'',
      jobTitle:bucketForm.jobTitle||'',website:bucketForm.website||'',leadNotes:bucketForm.leadNotes||'',
    });
    setModal(null);showToast('Lead updated!');
  }

  const[lcForm,setLcForm]=useState({});
  function openLeadCriteriaModal(){setLcForm(leadCriteria||{});setModal({type:'leadCriteria'});}
  async function saveLeadCriteriaForm(){
    await saveLeadCriteria(lcForm);setModal(null);showToast('Lead criteria saved!');
  }

  const[zoomInfoIndustries,setZoomInfoIndustries]=useState(null);
  useEffect(()=>{
    if(modal?.type==='leadCriteria'&&zoomInfoIndustries===null){
      getZoomInfoIndustries().then(setZoomInfoIndustries).catch(()=>setZoomInfoIndustries([]));
    }
  },[modal,zoomInfoIndustries]);

  // Each industry allocation is one { industry, count } row — ZoomInfo can't
  // reliably OR multiple industries together in one search, so reps instead
  // pick a single industry per row and say how many leads they want from it
  // (e.g. 30 Manufacturing, 20 Building Materials); fillBucketForRep runs one
  // plain search per row on the backend.
  function updateIndustryAllocation(idx,patch){
    const list=lcForm.industryAllocations&&lcForm.industryAllocations.length?[...lcForm.industryAllocations]:[{industry:'',count:''}];
    list[idx]={...list[idx],...patch};
    setLcForm({...lcForm,industryAllocations:list});
  }
  function addIndustryAllocationRow(){
    const list=lcForm.industryAllocations&&lcForm.industryAllocations.length?[...lcForm.industryAllocations]:[{industry:'',count:''}];
    setLcForm({...lcForm,industryAllocations:[...list,{industry:'',count:''}]});
  }
  function removeIndustryAllocationRow(idx){
    const list=(lcForm.industryAllocations||[]).filter((_,i)=>i!==idx);
    setLcForm({...lcForm,industryAllocations:list});
  }

  const[refillingBucket,setRefillingBucket]=useState(false);
  async function handleRefillBucket(){
    setRefillingBucket(true);
    try{
      const{added}=await requestBucketRefill();
      showToast(added>0?`Added ${added} new lead${added===1?'':'s'} to your bucket!`:'No matching leads found for your saved criteria.');
    }catch(err){
      showToast(err.message||'Could not refill bucket — try again.');
    }finally{
      setRefillingBucket(false);
    }
  }

  // Manager-only override: pull extra ZoomInfo leads into WHICHEVER rep's
  // bucket is currently being viewed (viewAsRep/viewAsEmail), bypassing both
  // the "already full" and "already used this week's allotment" checks on
  // the backend. This is the escape hatch for "every rep's bucket is maxed
  // out but we still need a lead pulled" — the normal Refill button above
  // can't do this (it's capped, and only ever targets your OWN bucket).
  const[overrideState,setOverrideState]=useState({count:10});
  const[overriding,setOverriding]=useState(false);
  function openOverrideModal(){setOverrideState({count:10});setModal({type:'override'});}
  async function saveOverride(){
    if(overriding)return;
    setOverriding(true);
    try{
      const{added}=await requestBucketRefill({targetRepEmail:viewAsEmail,override:true,count:Number(overrideState.count)||10});
      showToast(added>0?`Pulled ${added} new lead${added===1?'':'s'} for ${viewAsRep.split(' ')[0]} — cap overridden.`:'No matching leads found for the saved criteria.');
      setModal(null);
    }catch(err){
      showToast(err.message||'Could not override — try again.');
    }finally{
      setOverriding(false);
    }
  }

  const navItems=[
    {id:'accounts',label:'My Accounts',icon:'👥'},
    {id:'pipeline',label:'My Pipeline',icon:'📊'},
    {id:'bucket',label:'Cold Call Bucket',icon:'📞'},
    {id:'followups',label:'My Follow-ups',icon:'📅'},
    ...(isManager?[{id:'manager',label:'Manager',icon:'🛡'}]:[]),
  ];

  return(
    <div style={{display:'flex',height:'100vh',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:14,color:'#1a1a1a',background:'#fff'}}>

      {/* Sidebar */}
      <div style={{width:240,borderRight:'0.5px solid #E5E4DF',background:'#F7F6F3',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{height:96,boxSizing:'border-box',padding:'0 14px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:18}}>
            <img src="/oak-street-logo.png" alt="Oak Street Logistics" style={{width:84,height:84,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
            <div><div style={{fontWeight:600,fontSize:13}}>Oak Street Logistics</div><div style={{fontSize:11,color:'#888'}}>Sales CRM</div></div>
          </div>
        </div>
        <div style={{padding:'10px 14px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,background:repProfile?.color[0],color:repProfile?.color[1],flexShrink:0}}>{repProfile?.initials}</div>
          <div><div style={{fontSize:12,fontWeight:500}}>{repProfile?.name}</div><div style={{fontSize:10,color:'#888'}}>{isManager?'Rep & Manager':'Sales Rep'}</div></div>
        </div>
        {isManager&&(
          <div style={{padding:'10px 14px',borderBottom:'0.5px solid #E5E4DF'}}>
            <label style={{fontSize:10,color:'#aaa',textTransform:'uppercase',letterSpacing:'.05em',display:'block',marginBottom:4}}>Viewing as</label>
            <select style={{...S.input,fontSize:12,padding:'6px 8px'}} value={viewAsRep} onChange={e=>{setViewAsRep(e.target.value);setSelId(null);}}>
              {Object.values(TEAM_ROSTER).map(r=><option key={r.name} value={r.name}>{r.name}{r.name===repName?' (you)':''}</option>)}
            </select>
          </div>
        )}
        <nav style={{padding:8,flex:1}}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>{setView(item.id);setSelId(null);}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:8,cursor:'pointer',fontSize:13,color:view===item.id?'#1a1a1a':'#666',marginBottom:2,border:view===item.id?'0.5px solid #E5E4DF':'0.5px solid transparent',background:view===item.id?'#fff':'transparent',width:'100%',textAlign:'left',fontFamily:'inherit',fontWeight:view===item.id?500:400}}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
          <div style={{textAlign:'center',marginTop:64}}><svg width="150" height="142" viewBox="0 0 180 170" role="img" aria-label="Wrapped pallet"><ellipse cx="90" cy="160" rx="70" ry="7" fill="rgba(0,0,0,0.15)"/><rect x="25" y="140" width="18" height="15" fill="#5A3A1F"/><rect x="81" y="140" width="18" height="15" fill="#5A3A1F"/><rect x="137" y="140" width="18" height="15" fill="#5A3A1F"/><rect x="15" y="132" width="150" height="10" rx="1" fill="#8B6239" stroke="#6B4423" strokeWidth="1"/><line x1="50" y1="132" x2="50" y2="142" stroke="#6B4423" strokeWidth="1.5"/><line x1="85" y1="132" x2="85" y2="142" stroke="#6B4423" strokeWidth="1.5"/><line x1="120" y1="132" x2="120" y2="142" stroke="#6B4423" strokeWidth="1.5"/><rect x="25" y="75" width="130" height="57" rx="2" fill="#C9A063" stroke="#8B6239" strokeWidth="2"/><line x1="90" y1="75" x2="90" y2="132" stroke="#8B6239" strokeWidth="2"/><line x1="25" y1="103" x2="155" y2="103" stroke="#8B6239" strokeWidth="1.5"/><rect x="40" y="30" width="100" height="48" rx="2" fill="#C9A063" stroke="#8B6239" strokeWidth="2"/><line x1="90" y1="30" x2="90" y2="78" stroke="#8B6239" strokeWidth="2"/><line x1="40" y1="54" x2="140" y2="54" stroke="#8B6239" strokeWidth="1.5"/><rect x="105" y="108" width="22" height="13" fill="#F5F1E8" stroke="#8B6239" strokeWidth="1"/><line x1="109" y1="110" x2="109" y2="119" stroke="#8B6239" strokeWidth="1"/><line x1="113" y1="110" x2="113" y2="119" stroke="#8B6239" strokeWidth="1.5"/><line x1="117" y1="110" x2="117" y2="119" stroke="#8B6239" strokeWidth="1"/><line x1="121" y1="110" x2="121" y2="119" stroke="#8B6239" strokeWidth="1.5"/><rect x="22" y="28" width="136" height="107" fill="rgba(255,255,255,0.16)"/><line x1="30" y1="132" x2="60" y2="26" stroke="rgba(255,255,255,0.5)" strokeWidth="3"/><line x1="55" y1="132" x2="85" y2="26" stroke="rgba(255,255,255,0.5)" strokeWidth="3"/><line x1="80" y1="132" x2="110" y2="26" stroke="rgba(255,255,255,0.5)" strokeWidth="3"/><line x1="105" y1="132" x2="135" y2="26" stroke="rgba(255,255,255,0.5)" strokeWidth="3"/><line x1="130" y1="132" x2="153" y2="45" stroke="rgba(255,255,255,0.5)" strokeWidth="3"/><line x1="40" y1="130" x2="65" y2="30" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5"/><line x1="95" y1="130" x2="120" y2="30" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5"/><polygon points="135,32 150,28 148,42 137,44" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/></svg></div>
        </nav>
        <div style={{padding:'10px 14px',borderTop:'0.5px solid #E5E4DF'}}>
          <button onClick={logout} style={{...S.btn,width:'100%',justifyContent:'center',fontSize:12,color:'#888'}}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

        {/* ACCOUNTS */}
        {view==='accounts'&&(
          <>
            <div style={{height:96,boxSizing:'border-box',padding:'0 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}><h2 style={{fontSize:15,fontWeight:600,margin:0,minWidth:220}}>{viewAsRep===repName?'My Accounts':`${viewAsRep.split(' ')[0]}'s Accounts`}</h2><HeaderTruck/></div>
              <div style={{display:'flex',gap:8}}>
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...S.input,width:'auto',padding:'5px 10px'}}>
                  <option value="">All statuses</option>{ACCT_STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
                <button style={S.btnPrimary} onClick={()=>openAccountModal()}>+ New account</button>
              </div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
                {[
                  {label:'My accounts',value:myAccounts.length},
                  {label:'At-risk',value:atRiskCount,warn:atRiskCount>0,clickable:true,active:atRiskOnly,onClick:()=>setAtRiskOnly(v=>!v),hint:' (click to filter)',activeHint:' — click to clear'},
                  {label:'Shipments this month',value:myShipmentsThisMonth,highlight:true},
                  {label:'Margin this month',value:fmtMoney(myMarginThisMonth),highlight:true},
                ].map((m,i)=>(
                  <div key={i} onClick={m.onClick} style={{...S.card,...(m.highlight?{background:'#E6F1FB',border:'0.5px solid #A8C8F0'}:{}),...(m.clickable?{cursor:'pointer'}:{}),...(m.active&&m.label==='At-risk'?{background:'#FCEBEB',border:'0.5px solid #F09595'}:{}),...(m.active&&m.label!=='At-risk'?{border:'0.5px solid #0C447C'}:{})}}>
                    <div style={{fontSize:11,color:m.highlight?'#0C447C':'#888',marginBottom:4}}>{m.label}{m.active?m.activeHint:m.clickable?m.hint:''}</div>
                    <div style={{fontSize:22,fontWeight:600,color:m.warn?'#A32D2D':m.highlight?'#0C447C':'#1a1a1a'}}>{m.value}</div>
                    {m.sub&&<div style={{fontSize:11,color:'#888',marginTop:3}}>{m.sub}</div>}
                    {m.highlight&&!m.active&&<div style={{fontSize:11,color:'#0C447C',marginTop:3,opacity:.7}}>resets monthly</div>}
                  </div>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontWeight:500}}>My accounts</span>
                <span style={{fontSize:12,color:'#888'}}>{filteredAccounts.length} account{filteredAccounts.length!==1?'s':''}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',border:'0.5px solid #E5E4DF',borderRadius:8,background:'#F7F6F3',marginBottom:10}}>
                <span style={{color:'#888'}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search accounts, contacts, email…" style={{border:'none',background:'transparent',outline:'none',fontSize:12,flex:1,fontFamily:'inherit'}}/>
              </div>
              <div style={{border:'0.5px solid #E5E4DF',borderRadius:10,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,tableLayout:'fixed'}}>
                  <thead>
                    <tr style={{background:'#F7F6F3'}}>
                      <th style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:'#888',width:'34%',borderBottom:'0.5px solid #E5E4DF'}}>Account</th>
                      <th style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:'#888',width:'15%',borderBottom:'0.5px solid #E5E4DF'}}>Status</th>
                      <th style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:'#888',width:'12%',borderBottom:'0.5px solid #E5E4DF'}}>Trending</th>
                      <th onClick={()=>setDaysSortDir(d=>d==='asc'?'desc':'asc')} style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:atRiskOnly?'#0C447C':'#888',width:'22%',borderBottom:'0.5px solid #E5E4DF',cursor:'pointer',userSelect:'none'}} title={atRiskOnly?'Click to sort by days since last shipment':'Filter to At-risk to sort by days'}>Shipments this month{atRiskOnly?(daysSortDir==='asc'?' ↑':daysSortDir==='desc'?' ↓':' ↕'):''}</th>
                      <th style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:'#888',width:'17%',borderBottom:'0.5px solid #E5E4DF'}}>Margin this month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.length===0?(
                      <tr><td colSpan={5} style={{textAlign:'center',padding:30,color:'#888'}}>No accounts found</td></tr>
                    ):filteredAccounts.map(a=>{
                      const[bg,fg]=acctColor(a.name);
                      const shipCount=a.shipmentsThisMonth||0;
                      const atRisk=isAtRisk(a);
                      const trend=getTrending(a);
                      return(
                        <tr key={a.id} onClick={()=>setSelId(a.id)} style={{cursor:'pointer',background:a.id===selId?'#F7F6F3':'#fff',borderBottom:'0.5px solid #E5E4DF'}}>
                          <td style={{padding:'10px 12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:500,background:bg,color:fg,flexShrink:0}}>{initials(a.name)}</div>
                              <div>
                                <div style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</div>
                                <div style={{fontSize:11,color:'#555'}}>{a.contact||a.location||'—'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding:'10px 12px'}}>
                            <span style={{...badgeStyle(atRisk?'At risk':a.status),padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>{atRisk?'At risk':a.status}</span>
                          </td>
                          <td style={{padding:'10px 12px'}}>
                            {trend===null?<span style={{fontSize:11,color:'#aaa'}}>—</span>
                            :trend.dir==='up'?<span style={{fontSize:11,fontWeight:600,color:'#3B6D11'}}>↑ {trend.pct}%</span>
                            :trend.dir==='down'?<span style={{fontSize:11,fontWeight:600,color:'#A32D2D'}}>↓ {trend.pct}%</span>
                            :<span style={{fontSize:11,color:'#888'}}>→ 0%</span>}
                          </td>
                          <td style={{padding:'10px 12px'}}>
                            {atRisk?<span style={{fontSize:11,color:'#A32D2D',fontWeight:500}}>⚠ {daysSince(a.lastShipmentDate)}d ago</span>
                            :shipCount>0?<span style={{fontSize:13,fontWeight:600,color:'#0C447C'}}>{shipCount}</span>
                            :<span style={{fontSize:11,color:'#aaa'}}>—</span>}
                          </td>
                          <td style={{padding:'10px 12px'}}>
                            {a.marginThisMonth?<span style={{fontSize:13,fontWeight:600,color:'#3B6D11'}}>{fmtMoney(a.marginThisMonth)}</span>
                            :<span style={{fontSize:11,color:'#aaa'}}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* PIPELINE */}
        {view==='pipeline'&&(
          <>
            <div style={{height:96,boxSizing:'border-box',padding:'0 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}><h2 style={{fontSize:15,fontWeight:600,margin:0,minWidth:220}}>{viewAsRep===repName?'My Pipeline':`${viewAsRep.split(' ')[0]}'s Pipeline`}</h2><HeaderTruck/></div>
              <div style={{display:'flex',gap:8}}>
                <select value={srcFilter} onChange={e=>setSrcFilter(e.target.value)} style={{...S.input,width:'auto',padding:'5px 10px'}}>
                  <option value="">All sources</option>{SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
                <button style={S.btnPrimary} onClick={()=>openDealModal()}>+ New prospect</button>
              </div>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:16,display:'flex',flexDirection:'column'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16,flexShrink:0}}>
                {[
                  {label:'Active prospects',value:myDeals.filter(d=>!['Closed Won','Closed Lost'].includes(d.stage)).length},
                  {label:'In quoting',value:myDeals.filter(d=>d.stage==='Quoting').length},
                  {label:'Closed won (this month)',value:myAccounts.filter(a=>a.wonAt&&isThisMonth(a.wonAt)).length,up:true},
                ].map((m,i)=>(
                  <div key={i} style={S.card}>
                    <div style={{fontSize:11,color:'#888',marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:22,fontWeight:600,color:m.up?'#3B6D11':'#1a1a1a'}}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gridTemplateRows:'1fr',gap:8,flex:1,minHeight:0}}>
                {STAGES.map(s=>{
                  const[bg,fg]=SCOLS[s];
                  const q=(colSearch[s]||'').trim().toLowerCase();
                  const stageDeal=myDeals.filter(d=>d.stage===s&&(!srcFilter||d.source===srcFilter)&&(!q||d.account.toLowerCase().includes(q)));
                  return(
                    <div key={s} style={{border:'0.5px solid #E5E4DF',borderRadius:10,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                      <div style={{padding:'8px 10px',background:bg,borderBottom:'0.5px solid #E5E4DF'}}>
                        <span style={{fontSize:12,fontWeight:500,color:fg}}>{s}</span>
                        <span style={{fontSize:11,color:fg,marginLeft:5,opacity:.7}}>{stageDeal.length}</span>
                      </div>
                      <div style={{padding:'6px 8px',borderBottom:'0.5px solid #E5E4DF',background:'#fff'}}>
                        <input value={colSearch[s]||''} onChange={e=>setColSearch({...colSearch,[s]:e.target.value})} placeholder="Search…" style={{width:'100%',fontSize:11,fontFamily:'inherit',padding:'5px 8px',border:'0.5px solid #E5E4DF',borderRadius:6,outline:'none',boxSizing:'border-box'}}/>
                      </div>
                      <div style={{padding:8,flex:1,overflowY:'auto',minHeight:0}}>
                        {stageDeal.length===0?(
                          <div style={{fontSize:11,color:'#aaa',padding:'10px 4px',textAlign:'center'}}>No prospects</div>
                        ):stageDeal.map(d=>(
                          <div key={d.id} onClick={()=>setSelId(d.id)}
                            style={{padding:'10px 12px',border:'0.5px solid #E5E4DF',borderRadius:8,marginBottom:6,cursor:'pointer',background:d.id===selId?'#F7F6F3':'#fff'}}>
                            <div style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2}}>{d.account}</div>
                            {d.location&&<div style={{fontSize:11,color:'#555',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.location}</div>}
                            <span style={{...srcStyle(d.source),padding:'1px 6px',borderRadius:20,fontSize:10,fontWeight:500}}>{d.source}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* BUCKET */}
        {view==='bucket'&&(
          <>
            <div style={{height:96,boxSizing:'border-box',padding:'0 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}><h2 style={{fontSize:15,fontWeight:600,margin:0,minWidth:220}}>{viewAsRep.split(' ')[0]}'s Cold Call Bucket</h2><HeaderTruck/></div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:12,color:'#888'}}>{myLeads.length} / {BUCKET_CAP}</span>
                <button style={S.btn} onClick={openLeadCriteriaModal}>⚙️ My lead criteria</button>
                {viewAsRep===repName&&myLeads.length<BUCKET_CAP&&(
                  <button style={S.btn} onClick={handleRefillBucket} disabled={refillingBucket} title="Top your bucket off to 50 right now — useful after saving new/broader lead criteria. Otherwise it refills automatically every Monday at 6am.">
                    {refillingBucket?'Refilling…':'🔄 Refill bucket now'}
                  </button>
                )}
                {isManager&&(
                  <button style={{...S.btn,background:'#FFF7E6',borderColor:'#E8B54A',color:'#7A4E00'}} onClick={openOverrideModal} title="Manager-only: pull extra ZoomInfo leads for this rep even though their bucket is already full or has used this week's 50-lead allotment.">
                    🎯 Override cap & pull
                  </button>
                )}
                <button style={S.btnPrimary} onClick={openBucketForm}>+ Add lead</button>
              </div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{...S.card,marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:500}}>Bucket capacity</span>
                  <span style={{fontSize:12,fontWeight:500,color:myLeads.length>=BUCKET_CAP?'#A32D2D':myLeads.length>=80?'#633806':'#3B6D11'}}>{myLeads.length} / {BUCKET_CAP}</span>
                </div>
                <div style={{height:6,borderRadius:3,background:'#E5E4DF',overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:3,width:`${Math.min(myLeads.length/BUCKET_CAP*100,100)}%`,background:myLeads.length>=BUCKET_CAP?'#A32D2D':myLeads.length>=80?'#FAC775':'#3B6D11'}}/>
                </div>
              </div>
              {myLeads.length===0?(
                <div style={{textAlign:'center',padding:40,color:'#888'}}><div style={{fontSize:28,marginBottom:8}}>📞</div>Bucket empty. Add leads to get started.</div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                  {myLeads.map(lead=>(
                    <div key={lead.id} onClick={()=>setSelId(lead.id)} style={{...S.card,cursor:'pointer',background:lead.id===selId?'#E6F1FB':S.card.background}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{lead.company}</div>
                          {lead.industry&&<div style={{fontSize:11,color:'#555'}}>{lead.industry}</div>}
                          <div style={{fontSize:11,color:'#555'}}>{lead.contact||''}{lead.jobTitle?` — ${lead.jobTitle}`:''}</div>
                          {lead.email&&<a href={`mailto:${lead.email}`} onClick={e=>e.stopPropagation()} style={{fontSize:11,color:'#0C447C',textDecoration:'none',display:'block'}}>{lead.email}</a>}
                          {lead.phone&&<div style={{fontSize:11,color:'#555'}}>{formatPhone(lead.phone)}</div>}
                          {(lead.address||lead.location||lead.zip)&&<div style={{fontSize:11,color:'#aaa'}}>{[lead.address,lead.location,lead.zip].filter(Boolean).join(', ')}</div>}
                          {lead.website&&<a href={lead.website.match(/^https?:\/\//)?lead.website:`https://${lead.website}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:'#0C447C',textDecoration:'underline'}}>{lead.website.replace(/^https?:\/\//,'').replace(/\/$/,'')}</a>}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                          <span style={{background:'#EEF2FF',color:'#3730A3',borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:500}}>{lead.attempts||0} att.</span>
                          <button style={{...S.btn,padding:'2px 6px',fontSize:11}} title="Edit this lead's info (fix a bad number, update the contact, etc.)" onClick={e=>{e.stopPropagation();openEditLeadModal(lead);}}>✏️</button>
                          {isManager&&<button style={{...S.btn,padding:'2px 6px',fontSize:11}} title="Reassign to another rep" onClick={e=>{e.stopPropagation();openReassignModal('lead',lead.id,lead.rep);}}>👤</button>}
                        </div>
                      </div>
                      {lead.notes?.length>0&&<div style={{fontSize:11,color:'#555',background:'#fff',borderRadius:6,padding:'5px 8px',marginBottom:8}}>{lead.notes[0].text} · {lead.notes[0].time}</div>}
                      <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                        <button style={{...S.btn,flex:1,justifyContent:'center',fontSize:11}} onClick={()=>{
                          const notes=[{text:window.prompt('Notes (optional):')||'No contact',time:nowLabel()},...(lead.notes||[])];
                          updateLead(lead.id,{attempts:(lead.attempts||0)+1,notes});showToast('Attempt logged');
                        }}>📵 Attempted</button>
                        <button style={{...S.btnPrimary,flex:1,justifyContent:'center',fontSize:11}} onClick={async()=>{
                          const note=window.prompt('What happened?');if(!note)return;
                          await deleteLead(lead.id);
                          // No Account gets created here — a cold call being
                          // contacted isn't a customer yet. Contact info rides
                          // on the deal itself; an Account only gets created
                          // once this prospect is actually Closed Won. No
                          // follow-up is auto-scheduled either — reps set
                          // those manually now via "🔔 Set follow-up" on the
                          // prospect detail panel.
                          await addDeal({account:lead.company,accountId:null,stage:'Contact Made',source:'Cold Call',rep:viewAsRep,lostReason:'',contact:lead.contact||'',email:lead.email||'',phone:lead.phone||'',location:lead.location||'',address:lead.address||'',zip:lead.zip||'',industry:lead.industry||'',jobTitle:lead.jobTitle||'',website:lead.website||'',activities:[{text:note,time:nowLabel()}]});
                          showToast('Lead moved to Contact Made!');
                        }}>📞 Contacted</button>
                        <button style={{...S.btn,flex:'0 0 auto',justifyContent:'center',fontSize:11,color:'#A32D2D',padding:'0 10px'}} title="Not worth pursuing — removes this lead and keeps ZoomInfo from resurfacing this company" onClick={async()=>{
                          if(!window.confirm(`Disqualify ${lead.company}? This removes it from your bucket and it won't be resurfaced by future ZoomInfo refills.`))return;
                          const reason=window.prompt('Reason (optional — bad number, not a fit, do-not-call, etc.):')||'';
                          await deleteLead(lead.id);
                          await disqualifyBucketLead(lead.company,reason);
                          showToast('Lead disqualified');
                        }}>🚫</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* FOLLOWUPS */}
        {view==='followups'&&(
          <>
            <div style={{height:96,boxSizing:'border-box',padding:'0 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}><h2 style={{fontSize:15,fontWeight:600,margin:0,minWidth:220}}>{viewAsRep===repName?'My Follow-ups':`${viewAsRep.split(' ')[0]}'s Follow-ups`}</h2><HeaderTruck/></div>
              <button style={S.btnPrimary} onClick={()=>openFollowupModal()}>+ Schedule follow-up</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {(()=>{
                const overdue=myFollowups.filter(f=>!f.done&&f.dueDate<today());
                const dueToday=myFollowups.filter(f=>!f.done&&f.dueDate===today());
                const upcoming=myFollowups.filter(f=>!f.done&&f.dueDate>today());
                const done=myFollowups.filter(f=>f.done&&f.completedAt===today());
                const FuCard=({f})=>{
                  const linkedAcct=f.accountId?accounts.find(a=>a.id===f.accountId):null;
                  const linkedDeal=f.dealId?deals.find(d=>d.id===f.dealId):null;
                  const fuContact=linkedAcct?.contact||linkedDeal?.contact||f.contact;
                  const fuEmail=linkedAcct?.email||linkedDeal?.email||f.email;
                  const fuPhone=linkedAcct?.phone||linkedDeal?.phone||f.phone;
                  return(
                  <div onClick={()=>setSelId(f.id)} style={{border:f.id===selId?'1px solid #0C447C':'0.5px solid #E5E4DF',borderRadius:10,padding:12,marginBottom:8,background:f.id===selId?'#E6F1FB':'#fff',cursor:'pointer'}}>
                    <div style={{display:'flex',gap:10}}>
                      <input type="checkbox" checked={f.done} onClick={e=>e.stopPropagation()} onChange={async e=>{await updateFollowup(f.id,{done:e.target.checked,completedAt:e.target.checked?today():null});}} style={{flexShrink:0,width:15,height:15,cursor:'pointer',marginTop:2}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,textDecoration:f.done?'line-through':'none',color:f.done?'#aaa':'#1a1a1a'}}>{f.account}</div>
                        {fuContact&&<div style={{fontSize:11,color:'#555',marginTop:1}}>{fuContact}</div>}
                        {fuPhone&&<div style={{fontSize:11,color:'#555',marginTop:1}}>{formatPhone(fuPhone)}</div>}
                        {fuEmail&&<div style={{fontSize:11,color:'#0C447C',marginTop:1}}>{fuEmail}</div>}
                        {f.notes&&<div style={{fontSize:11,color:'#555',marginTop:3,fontStyle:'italic'}}>"{f.notes}"</div>}
                        <div style={{fontSize:11,color:!f.done&&f.dueDate<today()?'#A32D2D':'#888',marginTop:4,fontWeight:!f.done&&f.dueDate<today()?600:400}}>
                          {!f.done&&f.dueDate<today()?'⚠ Overdue · ':''}{fmtDate(f.dueDate)}
                        </div>
                      </div>
                    </div>
                    {!f.done&&(f.accountId||f.dealId)&&<div style={{marginTop:8}}><button style={{...S.btnLog,width:'100%',justifyContent:'center',fontSize:11}} onClick={e=>{e.stopPropagation();openLogModal(f.accountId,f.id,f.dealId);}}>✏️ Log what happened</button></div>}
                  </div>
                  );
                };
                return(
                  <>
                    {overdue.length>0&&<><div style={{fontWeight:500,color:'#A32D2D',marginBottom:10}}>⚠ Overdue ({overdue.length})</div>{overdue.map(f=><FuCard key={f.id} f={f}/>)}</>}
                    {dueToday.length>0&&<><div style={{fontWeight:500,marginBottom:10,marginTop:overdue.length?14:0}}>Due today ({dueToday.length})</div>{dueToday.map(f=><FuCard key={f.id} f={f}/>)}</>}
                    {upcoming.length>0&&<><div style={{fontWeight:500,color:'#888',marginBottom:10,marginTop:14}}>Upcoming</div>{upcoming.map(f=><FuCard key={f.id} f={f}/>)}</>}
                    {done.length>0&&<><div style={{fontWeight:500,color:'#aaa',marginBottom:10,marginTop:14}}>Completed</div>{done.map(f=><FuCard key={f.id} f={f}/>)}</>}
                    {myFollowups.length===0&&<div style={{textAlign:'center',padding:40,color:'#888'}}>✅<br/>No follow-ups scheduled</div>}
                  </>
                );
              })()}
            </div>
          </>
        )}

        {/* MANAGER */}
        {view==='manager'&&isManager&&(
          <>
            <div style={{height:96,boxSizing:'border-box',padding:'0 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}><h2 style={{fontSize:15,fontWeight:600,margin:0,minWidth:220}}>Manager Dashboard</h2><HeaderTruck/></div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{marginBottom:20}}>
                <div style={{fontWeight:500,marginBottom:10}}>Shipments this month</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {Object.entries(TEAM_ROSTER).map(([email,rep])=>{
                    const count=shipmentsPerRep[rep.name]||0;
                    return(
                      <div key={email} style={{...S.card,background:'#E6F1FB',border:'0.5px solid #A8C8F0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                          <div style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600,background:rep.color[0],color:rep.color[1],flexShrink:0}}>{rep.initials}</div>
                          <div style={{fontSize:11,color:'#0C447C',fontWeight:500}}>{rep.name.split(' ')[0]}</div>
                        </div>
                        <div style={{fontSize:22,fontWeight:600,color:'#0C447C'}}>{count}</div>
                        <div style={{fontSize:10,color:'#0C447C',opacity:.7,marginTop:2}}>shipments</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{marginBottom:20}}>
                <div style={{fontWeight:500,marginBottom:10}}>Margin this month</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {Object.entries(TEAM_ROSTER).map(([email,rep])=>{
                    const margin=marginPerRep[rep.name]||0;
                    return(
                      <div key={email} style={{...S.card,background:'#EAF3DE',border:'0.5px solid #C3DDA0'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                          <div style={{width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600,background:rep.color[0],color:rep.color[1],flexShrink:0}}>{rep.initials}</div>
                          <div style={{fontSize:11,color:'#3B6D11',fontWeight:500}}>{rep.name.split(' ')[0]}</div>
                        </div>
                        <div style={{fontSize:22,fontWeight:600,color:'#3B6D11'}}>{fmtMoney(margin)}</div>
                        <div style={{fontSize:10,color:'#3B6D11',opacity:.7,marginTop:2}}>margin</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{marginBottom:20}}>
                <div style={{fontWeight:500,marginBottom:10}}>Rep performance</div>
                <div style={{border:'0.5px solid #E5E4DF',borderRadius:10,overflow:'hidden'}}>
                  {Object.entries(TEAM_ROSTER).map(([email,rep],i)=>{
                    const repAccts=accounts.filter(a=>a.rep===rep.name);
                    const repDeals=deals.filter(d=>d.rep===rep.name);
                    const repFu=followups.filter(f=>f.rep===rep.name&&!f.done);
                    const isSelected=mgrSel?.type==='rep'&&mgrSel?.value===email;
                    return(
                      <div key={email} onClick={()=>setMgrSel({type:'rep',value:email})}
                        style={{display:'grid',gridTemplateColumns:'140px 1fr 60px 60px 60px 60px 80px',gap:8,alignItems:'center',padding:'10px 12px',borderBottom:i<Object.keys(TEAM_ROSTER).length-1?'0.5px solid #E5E4DF':'none',cursor:'pointer',background:isSelected?'#F7F6F3':'#fff'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,background:rep.color[0],color:rep.color[1],flexShrink:0}}>{rep.initials}</div>
                          <div><div style={{fontSize:12,fontWeight:500}}>{rep.name.split(' ')[0]}</div>{rep.isManager&&<div style={{fontSize:10,color:'#aaa'}}>Mgr</div>}</div>
                        </div>
                        <div style={{fontSize:11,color:'#888'}}>{repAccts.length} accts</div>
                        <div style={{textAlign:'center',fontSize:13,fontWeight:500}}>{repDeals.filter(d=>d.stage==='New Lead').length}</div>
                        <div style={{textAlign:'center',fontSize:13,fontWeight:500}}>{repDeals.filter(d=>d.stage==='Contact Made').length}</div>
                        <div style={{textAlign:'center',fontSize:13,fontWeight:600,color:'#3B6D11'}}>{repAccts.filter(a=>a.wonAt&&isThisMonth(a.wonAt)).length}</div>
                        <div style={{textAlign:'center',fontSize:13}}>{repFu.length} F/U</div>
                        <div style={{textAlign:'right',fontSize:12,fontWeight:600,color:'#3B6D11'}}>{fmtMoney(marginPerRep[rep.name]||0)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{fontWeight:500,marginBottom:10}}>Pipeline — all reps</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {STAGES.filter(s=>s!=='Closed Lost').map(s=>{
                    const[,fg]=SCOLS[s];
                    const sd=deals.filter(d=>d.stage===s);
                    const isSelected=mgrSel?.type==='stage'&&mgrSel?.value===s;
                    return(
                      <div key={s} onClick={()=>setMgrSel({type:'stage',value:s})}
                        style={{...S.card,borderTop:`3px solid ${fg}`,cursor:'pointer',outline:isSelected?`2px solid ${fg}`:'none'}}>
                        <div style={{fontSize:11,color:'#888',marginBottom:4}}>{s}</div>
                        <div style={{fontSize:22,fontWeight:600}}>{sd.length}</div>
                        <div style={{fontSize:11,color:'#aaa',marginTop:4}}>Click to view</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* DETAIL PANEL */}
      <div style={{width:420,maxWidth:'38vw',borderLeft:'0.5px solid #E5E4DF',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
        <div style={{height:96,boxSizing:'border-box',padding:'0 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <h3 style={{fontSize:14,fontWeight:600,margin:0}}>{view==='accounts'?'Account detail':view==='pipeline'?'Prospect detail':view==='followups'?'Follow-up detail':'Detail'}</h3>
        </div>
        {((selId&&view==='accounts')||(selId&&view==='pipeline')||(selId&&view==='bucket'&&selectedLead)||(selId&&view==='followups'&&selectedFollowup))&&(
          <div style={{boxSizing:'border-box',padding:'10px 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',gap:8,flexWrap:'wrap',flexShrink:0}}>
            {selId&&view==='accounts'&&(
              <>
                <button style={{...S.btn,padding:'4px 10px',fontSize:11}} onClick={()=>openAccountModal(selId)}>✏️ Edit</button>
                {isManager&&<button style={{...S.btn,padding:'4px 8px',fontSize:11}} title="Reassign to another rep" onClick={()=>openReassignModal('account',selId,selectedAccount?.rep)}>👤 Reassign</button>}
              </>
            )}
            {selId&&view==='pipeline'&&(
              <>
                <button style={{...S.btn,padding:'4px 10px',fontSize:11}} onClick={()=>openDealModal(selId)}>✏️ Edit prospect</button>
                <button style={{...S.btnFu,padding:'4px 10px',fontSize:11}} onClick={()=>openFollowupModal(null,null,selId)}>🔔 Set follow-up</button>
                <button style={{...S.btnPrimary,padding:'4px 10px',fontSize:11,background:'#3B6D11',borderColor:'#3B6D11'}} onClick={()=>handleCloseWon(selId)}>🎉 Closed Won</button>
                {isManager&&<button style={{...S.btn,padding:'4px 8px',fontSize:11}} title="Reassign to another rep" onClick={()=>openReassignModal('deal',selId,selectedDeal?.rep)}>👤 Reassign</button>}
              </>
            )}
            {selId&&view==='bucket'&&selectedLead&&(
              <>
                <button style={{...S.btn,padding:'4px 10px',fontSize:11}} onClick={()=>openEditLeadModal(selectedLead)}>✏️ Edit lead</button>
                {isManager&&<button style={{...S.btn,padding:'4px 8px',fontSize:11}} title="Reassign to another rep" onClick={()=>openReassignModal('lead',selId,selectedLead?.rep)}>👤 Reassign</button>}
              </>
            )}
            {selId&&view==='followups'&&selectedFollowup&&(
              <>
                <button style={{...S.btn,padding:'4px 10px',fontSize:11}} onClick={()=>openFollowupModal(selId)}>✏️ Edit follow-up</button>
                {!selectedFollowup.done&&(selectedFollowup.accountId||selectedFollowup.dealId)&&<button style={{...S.btnLog,padding:'4px 10px',fontSize:11}} onClick={()=>openLogModal(selectedFollowup.accountId,selectedFollowup.id,selectedFollowup.dealId)}>✏️ Log what happened</button>}
              </>
            )}
          </div>
        )}
        <div style={{flex:1,overflowY:'auto',padding:20}}>

          {/* Account detail */}
          {view==='accounts'&&selectedAccount&&(()=>{
            const a=selectedAccount;
            const[bg,fg]=acctColor(a.name);
            const nf=myFollowups.filter(f=>!f.done&&f.accountId===a.id).sort((x,y)=>x.dueDate.localeCompare(y.dueDate))[0];
            const atRisk=isAtRisk(a);
            const shipCount=a.shipmentsThisMonth||0;
            const dSince=daysSince(a.lastShipmentDate);
            const trend=getTrending(a);
            return(
              <>
                <div style={{textAlign:'center',marginBottom:14}}>
                  <div style={{width:40,height:40,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,background:bg,color:fg,margin:'0 auto 8px'}}>{initials(a.name)}</div>
                  <div style={{fontSize:15,fontWeight:600}}>{a.name}</div>
                  <div style={{fontSize:12,color:'#555'}}>{a.industry||''}{a.location?' · '+a.location:''}</div>
                  <span style={{...badgeStyle(atRisk?'At risk':a.status),padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,marginTop:4,display:'inline-block'}}>{atRisk?'At risk':a.status}</span>
                </div>
                <div style={{background:atRisk?'#FCEBEB':'#E6F1FB',border:`0.5px solid ${atRisk?'#F09595':'#A8C8F0'}`,borderRadius:8,padding:'10px 12px',marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:500,color:atRisk?'#A32D2D':'#0C447C',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>{atRisk?'⚠ At Risk':'📦 Shipments'}</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:20,fontWeight:700,color:atRisk?'#A32D2D':'#0C447C'}}>{shipCount}</div>
                      <div style={{fontSize:10,color:atRisk?'#A32D2D':'#0C447C',opacity:.8}}>this month</div>
                    </div>
                    {trend&&<div style={{textAlign:'center'}}>
                      {trend.dir!=='flat'&&<div style={{fontSize:14,fontWeight:700,color:trend.dir==='up'?'#3B6D11':'#A32D2D'}}>{trend.dir==='up'?'↑':'↓'} {trend.pct}%</div>}
                      <div style={{fontSize:10,color:'#aaa'}}>vs last month</div>
                    </div>}
                    {a.lastShipmentDate&&<div style={{textAlign:'right'}}>
                      <div style={{fontSize:11,color:atRisk?'#A32D2D':'#888',fontWeight:atRisk?600:400}}>{atRisk?`${dSince} days ago`:daysAgo(a.lastShipmentDate)}</div>
                      <div style={{fontSize:10,color:'#aaa'}}>last shipment</div>
                    </div>}
                  </div>
                  {atRisk&&<div style={{fontSize:11,color:'#A32D2D',marginTop:6,fontWeight:500}}>No shipment in {dSince} days — follow up!</div>}
                </div>
                {nf&&<div style={{textAlign:'center',marginBottom:14}}><span style={{background:'#FAEEDA',color:'#633806',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:500}}>🕐 Follow-up due {fmtDate(nf.dueDate)}</span></div>}
                <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
                  <button style={{...S.btnFu,justifyContent:'center',width:'100%'}} onClick={()=>openFollowupModal(null,a.id)}>🔔 Set follow-up reminder</button>
                  <button style={{...S.btn,justifyContent:'center',width:'100%'}} onClick={()=>openLogModal(a.id)}>✏️ Log activity</button>
                </div>
                <DetailSection title="Contact info">
                  {a.contact&&<DetailRow k="Contact" v={a.contact}/>}
                  {a.email&&<DetailRow k="Email" v={<a href={`mailto:${a.email}`} style={{color:'#0C447C',textDecoration:'none'}}>{a.email}</a>}/>}
                  {a.phone&&<DetailRow k="Phone" v={formatPhone(a.phone)}/>}
                  {a.address&&<DetailRow k="Address" v={a.address}/>}
                  {a.location&&<DetailRow k="Location" v={a.location}/>}
                  {a.zip&&<DetailRow k="Zip" v={a.zip}/>}
                  {!a.contact&&!a.email&&!a.phone&&!a.address&&!a.location&&!a.zip&&<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No contact info yet — click Edit</div>}
                </DetailSection>
                {(a.shipmentType||a.commodity)&&<DetailSection title="Shipment info">
                  {a.shipmentType&&<DetailRow k="Shipment Type" v={a.shipmentType}/>}
                  {a.commodity&&<DetailRow k="Commodity" v={a.commodity}/>}
                </DetailSection>}
                {a.notes&&<DetailSection title="Notes"><p style={{fontSize:12,color:'#555',lineHeight:1.5}}>{a.notes}</p></DetailSection>}
                {a.activities?.length>0&&<DetailSection title="Activity log">
                  {a.activities.map((act,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:10}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:'#D5D4CF',flexShrink:0,marginTop:4}}/>
                      <div><div style={{fontSize:12,color:'#555',lineHeight:1.5}}>{act.text}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>{act.time}</div></div>
                    </div>
                  ))}
                </DetailSection>}
              </>
            );
          })()}

          {/* Deal detail */}
          {view==='pipeline'&&selectedDeal&&(()=>{
            const d=selectedDeal;
            const a=accounts.find(x=>x.id===d.accountId);
            return(
              <>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>{d.account}</div>
                <div style={{textAlign:'center',marginBottom:14}}><span style={{...srcStyle(d.source),padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>{d.source}</span></div>
                <DetailSection title="Prospect info">
                  <DetailRow k="Stage" v={d.stage}/>
                  <DetailRow k="Source" v={d.source}/>
                  {d.customerName&&<DetailRow k="From Customer" v={d.customerName}/>}
                  {d.shipmentId&&<DetailRow k="Shipment ID" v={d.shipmentId}/>}
                  {d.lostReason&&<DetailRow k="Lost reason" v={d.lostReason}/>}
                </DetailSection>
                <DetailSection title="Account info">
                  {(a?.contact||d.contact)&&<DetailRow k="Contact" v={a?.contact||d.contact}/>}
                  <DetailRow k="Email" v={(a?.email||d.email)?<a href={`mailto:${a?.email||d.email}`} style={{color:'#0C447C',textDecoration:'none'}}>{a?.email||d.email}</a>:<span style={{color:'#bbb'}}>Not set — click Edit prospect to add</span>}/>
                  {(a?.phone||d.phone)&&<DetailRow k="Phone" v={formatPhone(a?.phone||d.phone)}/>}
                  {a?.shipmentType&&<DetailRow k="Shipment Type" v={a.shipmentType}/>}
                  {d.address&&<DetailRow k="Address" v={d.address}/>}
                  {(a?.location||d.location)&&<DetailRow k="Location" v={a?.location||d.location}/>}
                  {d.zip&&<DetailRow k="Zip" v={d.zip}/>}
                </DetailSection>
                <DetailSection title="Notes & activity">
                  {d.activities?.length>0?d.activities.map((n,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:10}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:'#D5D4CF',flexShrink:0,marginTop:4}}/>
                      <div><div style={{fontSize:12,color:'#555'}}>{n.text}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>{n.time}</div></div>
                    </div>
                  )):<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No notes yet — click Edit prospect to add</div>}
                </DetailSection>
              </>
            );
          })()}

          {/* Bucket lead detail */}
          {view==='bucket'&&selectedLead&&(()=>{
            const l=selectedLead;
            return(
              <>
                <div style={{fontSize:15,fontWeight:600,marginBottom:2}}>{l.company}</div>
                {l.industry&&<div style={{fontSize:12,color:'#555',marginBottom:10}}>{l.industry}</div>}
                <div style={{textAlign:'center',marginBottom:14}}><span style={{background:'#EEF2FF',color:'#3730A3',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:500}}>{l.attempts||0} attempt{l.attempts===1?'':'s'}</span></div>
                <DetailSection title="Contact info">
                  {l.contact&&<DetailRow k="Contact" v={l.contact}/>}
                  {l.jobTitle&&<DetailRow k="Job title" v={l.jobTitle}/>}
                  {l.email&&<DetailRow k="Email" v={<a href={`mailto:${l.email}`} style={{color:'#0C447C',textDecoration:'none'}}>{l.email}</a>}/>}
                  {l.phone&&<DetailRow k="Phone" v={formatPhone(l.phone)}/>}
                  {l.address&&<DetailRow k="Address" v={l.address}/>}
                  {l.location&&<DetailRow k="Location" v={l.location}/>}
                  {l.zip&&<DetailRow k="Zip" v={l.zip}/>}
                  {l.website&&<DetailRow k="Website" v={<a href={l.website.match(/^https?:\/\//)?l.website:`https://${l.website}`} target="_blank" rel="noopener noreferrer" style={{color:'#0C447C',textDecoration:'underline'}}>{l.website.replace(/^https?:\/\//,'').replace(/\/$/,'')}</a>}/>}
                  {!l.contact&&!l.email&&!l.phone&&!l.address&&!l.location&&!l.zip&&<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No contact info — click Edit lead to add</div>}
                </DetailSection>
                {l.leadNotes&&<DetailSection title="Notes"><p style={{fontSize:12,color:'#555',lineHeight:1.5}}>{l.leadNotes}</p></DetailSection>}
                <DetailSection title="Attempt history">
                  {l.notes?.length>0?l.notes.map((n,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:10}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:'#D5D4CF',flexShrink:0,marginTop:4}}/>
                      <div><div style={{fontSize:12,color:'#555'}}>{n.text}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>{n.time}</div></div>
                    </div>
                  )):<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No attempts logged yet — click 📵 Attempted on the card to log one (each one is time-stamped).</div>}
                </DetailSection>
              </>
            );
          })()}

          {/* Follow-up detail */}
          {view==='followups'&&selectedFollowup&&(()=>{
            const f=selectedFollowup;
            const linkedAcct=f.accountId?accounts.find(a=>a.id===f.accountId):null;
            const linkedDeal=f.dealId?deals.find(d=>d.id===f.dealId):null;
            const overdue=!f.done&&f.dueDate<today();
            const fuStatusBadge=(
              <div style={{textAlign:'center',marginBottom:14}}>
                <span style={{background:f.done?'#EEF2FF':overdue?'#FCEBEB':'#FAEEDA',color:f.done?'#3730A3':overdue?'#A32D2D':'#633806',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:500}}>
                  {f.done?'✓ Done':overdue?'⚠ Overdue':'🕐 Scheduled'} · {fmtDate(f.dueDate)}
                </span>
              </div>
            );
            if(linkedAcct){
              const a=linkedAcct;
              const[bg,fg]=acctColor(a.name);
              const atRisk=isAtRisk(a);
              const shipCount=a.shipmentsThisMonth||0;
              const dSince=daysSince(a.lastShipmentDate);
              const trend=getTrending(a);
              return(
                <>
                  <div style={{textAlign:'center',marginBottom:14}}>
                    <div style={{width:40,height:40,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,background:bg,color:fg,margin:'0 auto 8px'}}>{initials(a.name)}</div>
                    <div style={{fontSize:15,fontWeight:600}}>{a.name}</div>
                    <div style={{fontSize:12,color:'#555'}}>{a.industry||''}{a.location?' · '+a.location:''}</div>
                    <span style={{...badgeStyle(atRisk?'At risk':a.status),padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,marginTop:4,display:'inline-block'}}>{atRisk?'At risk':a.status}</span>
                  </div>
                  {fuStatusBadge}
                  <div style={{background:atRisk?'#FCEBEB':'#E6F1FB',border:`0.5px solid ${atRisk?'#F09595':'#A8C8F0'}`,borderRadius:8,padding:'10px 12px',marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:500,color:atRisk?'#A32D2D':'#0C447C',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>{atRisk?'⚠ At Risk':'📦 Shipments'}</div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:20,fontWeight:700,color:atRisk?'#A32D2D':'#0C447C'}}>{shipCount}</div>
                        <div style={{fontSize:10,color:atRisk?'#A32D2D':'#0C447C',opacity:.8}}>this month</div>
                      </div>
                      {trend&&<div style={{textAlign:'center'}}>
                        {trend.dir!=='flat'&&<div style={{fontSize:14,fontWeight:700,color:trend.dir==='up'?'#3B6D11':'#A32D2D'}}>{trend.dir==='up'?'↑':'↓'} {trend.pct}%</div>}
                        <div style={{fontSize:10,color:'#aaa'}}>vs last month</div>
                      </div>}
                      {a.lastShipmentDate&&<div style={{textAlign:'right'}}>
                        <div style={{fontSize:11,color:atRisk?'#A32D2D':'#888',fontWeight:atRisk?600:400}}>{atRisk?`${dSince} days ago`:daysAgo(a.lastShipmentDate)}</div>
                        <div style={{fontSize:10,color:'#aaa'}}>last shipment</div>
                      </div>}
                    </div>
                    {atRisk&&<div style={{fontSize:11,color:'#A32D2D',marginTop:6,fontWeight:500}}>No shipment in {dSince} days — follow up!</div>}
                  </div>
                  <DetailSection title="Contact info">
                    {a.contact&&<DetailRow k="Contact" v={a.contact}/>}
                    {a.email&&<DetailRow k="Email" v={<a href={`mailto:${a.email}`} style={{color:'#0C447C',textDecoration:'none'}}>{a.email}</a>}/>}
                    {a.phone&&<DetailRow k="Phone" v={formatPhone(a.phone)}/>}
                    {a.address&&<DetailRow k="Address" v={a.address}/>}
                    {a.location&&<DetailRow k="Location" v={a.location}/>}
                    {a.zip&&<DetailRow k="Zip" v={a.zip}/>}
                    {!a.contact&&!a.email&&!a.phone&&!a.address&&!a.location&&!a.zip&&<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No contact info yet</div>}
                  </DetailSection>
                  {(a.shipmentType||a.commodity)&&<DetailSection title="Shipment info">
                    {a.shipmentType&&<DetailRow k="Shipment Type" v={a.shipmentType}/>}
                    {a.commodity&&<DetailRow k="Commodity" v={a.commodity}/>}
                  </DetailSection>}
                  {a.notes&&<DetailSection title="Notes"><p style={{fontSize:12,color:'#555',lineHeight:1.5}}>{a.notes}</p></DetailSection>}
                  {a.activities?.length>0&&<DetailSection title="Activity log">
                    {a.activities.map((act,i)=>(
                      <div key={i} style={{display:'flex',gap:8,marginBottom:10}}>
                        <div style={{width:7,height:7,borderRadius:'50%',background:'#D5D4CF',flexShrink:0,marginTop:4}}/>
                        <div><div style={{fontSize:12,color:'#555',lineHeight:1.5}}>{act.text}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>{act.time}</div></div>
                      </div>
                    ))}
                  </DetailSection>}
                  {f.notes&&<DetailSection title="Follow-up note"><p style={{fontSize:12,color:'#555',lineHeight:1.5}}>"{f.notes}"</p></DetailSection>}
                </>
              );
            }
            const fuContact=linkedDeal?.contact||f.contact;
            const fuEmail=linkedDeal?.email||f.email;
            const fuPhone=linkedDeal?.phone||f.phone;
            return(
              <>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>{f.account}</div>
                {fuStatusBadge}
                <DetailSection title="Contact info">
                  {fuContact&&<DetailRow k="Contact" v={fuContact}/>}
                  {fuEmail&&<DetailRow k="Email" v={<a href={`mailto:${fuEmail}`} style={{color:'#0C447C',textDecoration:'none'}}>{fuEmail}</a>}/>}
                  {fuPhone&&<DetailRow k="Phone" v={formatPhone(fuPhone)}/>}
                  {!fuContact&&!fuEmail&&!fuPhone&&<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No contact info on file</div>}
                </DetailSection>
                {linkedDeal&&<DetailSection title="Linked record"><DetailRow k="Prospect" v={linkedDeal.account}/></DetailSection>}
                {linkedDeal?.activities?.length>0&&<DetailSection title="Notes & activity">
                  {linkedDeal.activities.map((act,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:10}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:'#D5D4CF',flexShrink:0,marginTop:4}}/>
                      <div><div style={{fontSize:12,color:'#555',lineHeight:1.5}}>{act.text}</div><div style={{fontSize:11,color:'#888',marginTop:2}}>{act.time}</div></div>
                    </div>
                  ))}
                </DetailSection>}
                {f.notes&&<DetailSection title="Follow-up note"><p style={{fontSize:12,color:'#555',lineHeight:1.5}}>"{f.notes}"</p></DetailSection>}
              </>
            );
          })()}

          {/* Manager detail */}
          {view==='manager'&&mgrSel&&(()=>{
            if(mgrSel.type==='rep'){
              const rep=TEAM_ROSTER[mgrSel.value];if(!rep)return null;
              const repDeals=deals.filter(d=>d.rep===rep.name);
              const repAccts=accounts.filter(a=>a.rep===rep.name);
              const repFu=followups.filter(f=>f.rep===rep.name&&!f.done);
              return(
                <>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                    <div style={{width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,background:rep.color[0],color:rep.color[1]}}>{rep.initials}</div>
                    <div><div style={{fontSize:14,fontWeight:600}}>{rep.name}</div><div style={{fontSize:11,color:'#888'}}>{rep.isManager?'Rep & Manager':'Sales Rep'}</div></div>
                  </div>
                  <button style={{...S.btnPrimary,justifyContent:'center',width:'100%',marginBottom:14}} onClick={()=>{setViewAsRep(rep.name);setView('accounts');setSelId(null);}}>👀 View {rep.name.split(' ')[0]}'s screens</button>
                  <DetailSection title="Shipments this month"><DetailRow k="Total" v={shipmentsPerRep[rep.name]||0}/><DetailRow k="Margin" v={fmtMoney(marginPerRep[rep.name]||0)}/></DetailSection>
                  <DetailSection title="Accounts">
                    <DetailRow k="Total" v={repAccts.length}/>
                    <DetailRow k="Active" v={repAccts.filter(a=>a.status==='Active').length}/>
                    <DetailRow k="At risk" v={repAccts.filter(a=>isAtRisk(a)).length}/>
                  </DetailSection>
                  <DetailSection title="Pipeline">{STAGES.filter(s=>s!=='Closed Lost').map(s=><DetailRow key={s} k={s} v={repDeals.filter(d=>d.stage===s).length}/>)}</DetailSection>
                  <DetailSection title="Follow-ups">
                    <DetailRow k="Pending" v={repFu.length}/>
                    <DetailRow k="Overdue" v={repFu.filter(f=>f.dueDate<today()).length}/>
                  </DetailSection>
                </>
              );
            }
            if(mgrSel.type==='stage'){
              const sd=deals.filter(d=>d.stage===mgrSel.value);
              const[,fg]=SCOLS[mgrSel.value];
              return(
                <>
                  <div style={{fontSize:13,fontWeight:600,color:fg,marginBottom:12}}>{sd.length} prospect{sd.length!==1?'s':''} in {mgrSel.value}</div>
                  {sd.map(d=>{
                    const rep=Object.values(TEAM_ROSTER).find(r=>r.name===d.rep);
                    return(
                      <div key={d.id} style={{border:'0.5px solid #E5E4DF',borderRadius:8,padding:'8px 10px',marginBottom:8}}>
                        <div style={{fontWeight:600,fontSize:13}}>{d.account}</div>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                          <div style={{width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600,background:rep?.color[0]||'#eee',color:rep?.color[1]||'#666'}}>{rep?.initials||'?'}</div>
                          <span style={{fontSize:11,color:'#888'}}>{d.rep}</span>
                        </div>
                        {d.activities?.length>0&&<div style={{fontSize:11,color:'#555',marginTop:4}}>{d.activities[0].text} · {d.activities[0].time}</div>}
                      </div>
                    );
                  })}
                  {sd.length===0&&<div style={{fontSize:12,color:'#aaa',textAlign:'center',padding:'16px 0'}}>No prospects in this stage</div>}
                </>
              );
            }
            return null;
          })()}

          {!selId&&!mgrSel&&<div style={{textAlign:'center',padding:40,color:'#888',lineHeight:1.8}}><div style={{fontSize:24,marginBottom:8}}>←</div>Select a record<br/>to view details</div>}
        </div>
      </div>

      {/* MODALS */}
      {modal?.type==='account'&&(
        <Modal title={modal.id?'Edit account':'New account'} onClose={()=>setModal(null)} onSave={saveAccount} showDelete={!!modal.id} onDelete={handleDeleteAccount}>
          <FGrid>
            <FRow label="Company name *"><input style={S.input} value={af.name||''} onChange={e=>setAf({...af,name:e.target.value})} placeholder="Company Name"/></FRow>
            <FRow label="Industry"><input style={S.input} value={af.industry||''} onChange={e=>setAf({...af,industry:e.target.value})} placeholder="Manufacturing"/></FRow>
          </FGrid>
          <FRow label="Address"><input style={S.input} value={af.address||''} onChange={e=>setAf({...af,address:e.target.value})} placeholder="123 Main St"/></FRow>
          <FGrid>
            <FRow label="City, State"><input style={S.input} value={af.location||''} onChange={e=>setAf({...af,location:e.target.value})} placeholder="Chicago, IL"/></FRow>
            <FRow label="Zip"><input style={S.input} value={af.zip||''} onChange={e=>setAf({...af,zip:e.target.value})} placeholder="60601"/></FRow>
          </FGrid>
          <FRow label="Status"><select style={S.input} value={af.status||'Active'} onChange={e=>setAf({...af,status:e.target.value})}>{ACCT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></FRow>
          <FRow label="Primary contact"><input style={S.input} value={af.contact||''} onChange={e=>setAf({...af,contact:e.target.value})} placeholder="John Smith"/></FRow>
          <FRow label="Email"><input style={S.input} type="email" value={af.email||''} onChange={e=>setAf({...af,email:e.target.value})} placeholder="john@company.com"/></FRow>
          <FRow label="Phone"><input style={S.input} value={formatPhone(af.phone||'')} onChange={e=>setAf({...af,phone:formatPhone(e.target.value)})} placeholder="(555) 000-0000"/></FRow>
          <FRow label="Shipment Type"><input style={S.input} value={af.shipmentType||''} onChange={e=>setAf({...af,shipmentType:e.target.value})} placeholder="FTL Dry Van, LTL, Reefer"/></FRow>
          <FRow label="Commodity"><input style={S.input} value={af.commodity||''} onChange={e=>setAf({...af,commodity:e.target.value})} placeholder="General freight"/></FRow>
          <FRow label="Notes"><textarea style={{...S.input,minHeight:60,resize:'vertical'}} value={af.notes||''} onChange={e=>setAf({...af,notes:e.target.value})} placeholder="Notes…"/></FRow>
          {isManager&&<FRow label="Assign to rep"><select style={S.input} value={af.rep||viewAsRep} onChange={e=>setAf({...af,rep:e.target.value})}>{Object.values(TEAM_ROSTER).map(r=><option key={r.name} value={r.name}>{r.name}</option>)}</select></FRow>}
        </Modal>
      )}

      {modal?.type==='deal'&&(
        <Modal title={modal.id?'Edit prospect':'New prospect'} onClose={()=>setModal(null)} onSave={saveDeal} showDelete={!!modal.id} onDelete={handleDeleteDeal}>
          {modal.id?(
            <>
              <FRow label="Prospect"><div style={{fontSize:15,fontWeight:600,padding:'4px 0'}}>{df.account}</div></FRow>
              {(
                <div style={{background:'#F7F6F3',border:'0.5px solid #E5E4DF',borderRadius:8,padding:12,marginTop:4,marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:500,color:'#0C447C',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>📇 Account info</div>
                  <FRow label="Contact name"><input style={S.input} value={df.contact||''} onChange={e=>setDf({...df,contact:e.target.value})} placeholder="John Smith"/></FRow>
                  <FRow label="Email"><input style={S.input} type="email" value={df.email||''} onChange={e=>setDf({...df,email:e.target.value})} placeholder="john@company.com"/></FRow>
                  <FRow label="Phone"><input style={S.input} value={formatPhone(df.phone||'')} onChange={e=>setDf({...df,phone:formatPhone(e.target.value)})} placeholder="(555) 000-0000"/></FRow>
                  <FRow label="Address"><input style={S.input} value={df.address||''} onChange={e=>setDf({...df,address:e.target.value})} placeholder="123 Main St"/></FRow>
                  <FGrid>
                    <FRow label="City, State"><input style={S.input} value={df.location||''} onChange={e=>setDf({...df,location:e.target.value})} placeholder="Chicago, IL"/></FRow>
                    <FRow label="Zip"><input style={S.input} value={df.zip||''} onChange={e=>setDf({...df,zip:e.target.value})} placeholder="60601"/></FRow>
                  </FGrid>
                </div>
              )}
            </>
          ):(
            <FRow label="Company name *">
              <input style={S.input} value={dealCompany} onChange={e=>handleCompanyInput(e.target.value)} placeholder="Search or type new company…" autoComplete="off"/>
              {companySuggs.length>0&&(
                <div style={{border:'0.5px solid #D5D4CF',borderRadius:8,marginTop:3,overflow:'hidden'}}>
                  {companySuggs.map(n=><div key={n} onMouseDown={()=>{setDealCompany(n);setIsNewProspect(false);setCompanySuggs([]);}} style={{padding:'9px 12px',fontSize:13,cursor:'pointer',borderBottom:'0.5px solid #E5E4DF',background:'#fff'}}>{n}</div>)}
                  <div onMouseDown={()=>{setIsNewProspect(true);setCompanySuggs([]);}} style={{padding:'9px 12px',fontSize:13,cursor:'pointer',color:'#0C447C',fontWeight:500,background:'#fff'}}>+ Add "{dealCompany}" as new prospect</div>
                </div>
              )}
              {isNewProspect&&(
                <div style={{background:'#F7F6F3',border:'0.5px solid #E5E4DF',borderRadius:8,padding:12,marginTop:8}}>
                  <div style={{fontSize:11,fontWeight:500,color:'#0C447C',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>👤 Prospect details (optional)</div>
                  <FRow label="Contact name"><input style={S.input} value={df.npContact||''} onChange={e=>setDf({...df,npContact:e.target.value})} placeholder="John Smith"/></FRow>
                  <FRow label="Email"><input style={S.input} type="email" value={df.npEmail||''} onChange={e=>setDf({...df,npEmail:e.target.value})} placeholder="john@company.com"/></FRow>
                  <FRow label="Phone"><input style={S.input} value={formatPhone(df.npPhone||'')} onChange={e=>setDf({...df,npPhone:formatPhone(e.target.value)})} placeholder="(555) 000-0000"/></FRow>
                  <FGrid>
                    <FRow label="City, State"><input style={S.input} value={df.npLocation||''} onChange={e=>setDf({...df,npLocation:e.target.value})} placeholder="Chicago, IL"/></FRow>
                    <FRow label="Industry"><input style={S.input} value={df.npIndustry||''} onChange={e=>setDf({...df,npIndustry:e.target.value})} placeholder="Manufacturing"/></FRow>
                  </FGrid>
                  <FRow label="Shipment Type"><input style={S.input} value={df.npShipmentType||''} onChange={e=>setDf({...df,npShipmentType:e.target.value})} placeholder="FTL Dry Van, LTL, Reefer"/></FRow>
                </div>
              )}
            </FRow>
          )}
          <FGrid>
            <FRow label="Stage"><select style={S.input} value={df.stage||'New Lead'} onChange={e=>setDf({...df,stage:e.target.value})}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></FRow>
            <FRow label="Lead source"><select style={S.input} value={df.source||'Cold Call'} onChange={e=>setDf({...df,source:e.target.value})}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select></FRow>
          </FGrid>
          {df.stage==='Closed Lost'&&<FRow label="Lost reason"><select style={S.input} value={df.lostReason||''} onChange={e=>setDf({...df,lostReason:e.target.value})}>{LOST_REASONS.map(r=><option key={r}>{r}</option>)}</select></FRow>}
          <FRow label="Add note">
            <textarea style={{...S.input,minHeight:70,resize:'vertical'}} value={df.newNote||''} onChange={e=>setDf({...df,newNote:e.target.value})} placeholder="e.g. Emailed about FTL rates — waiting to hear back…"/>
            <div style={{fontSize:11,color:'#aaa',marginTop:4}}>Each note is timestamped and added to the activity log.</div>
          </FRow>
        </Modal>
      )}

      {modal?.type==='followup'&&(
        <Modal title={modal.id?'Edit follow-up':'New follow-up'} onClose={()=>setModal(null)} onSave={saveFollowup} showDelete={!!modal.id} onDelete={handleDeleteFollowup}>
          {ff.dealId?(
            <FRow label="Prospect"><div style={{fontSize:15,fontWeight:600,padding:'4px 0'}}>{ff.account}</div></FRow>
          ):(
            <FRow label="Account">
              <select style={S.input} value={ff.accountId||''} onChange={e=>setFf({...ff,accountId:e.target.value})}>
                <option value="">Select account</option>
                {myAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FRow>
          )}
          <FRow label="Due date *"><input style={S.input} type="date" value={ff.dueDate||''} onChange={e=>setFf({...ff,dueDate:e.target.value})}/></FRow>
          <FRow label="Contact name"><input style={S.input} value={ff.contact||''} onChange={e=>setFf({...ff,contact:e.target.value})} placeholder="John Smith"/></FRow>
          <FRow label="Email"><input style={S.input} type="email" value={ff.email||''} onChange={e=>setFf({...ff,email:e.target.value})} placeholder="john@company.com"/></FRow>
          <FRow label="Phone"><input style={S.input} value={formatPhone(ff.phone||'')} onChange={e=>setFf({...ff,phone:formatPhone(e.target.value)})} placeholder="(555) 000-0000"/></FRow>
          <FRow label="Notes"><textarea style={{...S.input,minHeight:60,resize:'vertical'}} value={ff.notes||''} onChange={e=>setFf({...ff,notes:e.target.value})} placeholder="What to follow up about…"/></FRow>
        </Modal>
      )}

      {modal?.type==='log'&&(
        <Modal title="Log activity" sub={logState.followupId?'Logging follow-up activity':'Log activity'} onClose={()=>setModal(null)} onSave={saveLog} saveLabel="Log activity">
          <FRow label="Activity type"><select style={S.input} value={logState.type} onChange={e=>setLogState({...logState,type:e.target.value})}>{ACT_TYPES.map(t=><option key={t}>{t}</option>)}</select></FRow>
          <FRow label="Description *"><textarea style={{...S.input,minHeight:80,resize:'vertical'}} value={logState.text} onChange={e=>setLogState({...logState,text:e.target.value})} placeholder="e.g. Emailed John about FTL rates — he's reviewing with his team…" autoFocus/></FRow>
          {logState.followupId&&<div style={{fontSize:12,color:'#3B6D11',background:'#EAF3DE',padding:'8px 12px',borderRadius:8}}>✓ This follow-up will be marked as done after logging.</div>}
        </Modal>
      )}

      {modal?.type==='addLead'&&(
        <Modal title="Add lead to bucket" onClose={()=>setModal(null)} onSave={saveLead}>
          <FRow label="Company name *"><input style={S.input} value={bucketForm.company||''} onChange={e=>setBucketForm({...bucketForm,company:e.target.value})} placeholder="Acme Corp" autoFocus/></FRow>
          <FRow label="Contact name"><input style={S.input} value={bucketForm.contact||''} onChange={e=>setBucketForm({...bucketForm,contact:e.target.value})} placeholder="John Smith"/></FRow>
          <FRow label="Email"><input style={S.input} type="email" value={bucketForm.email||''} onChange={e=>setBucketForm({...bucketForm,email:e.target.value})} placeholder="john@company.com"/></FRow>
          <FRow label="Phone"><input style={S.input} value={formatPhone(bucketForm.phone||'')} onChange={e=>setBucketForm({...bucketForm,phone:formatPhone(e.target.value)})} placeholder="(555) 000-0000"/></FRow>
          <FRow label="Location"><input style={S.input} value={bucketForm.location||''} onChange={e=>setBucketForm({...bucketForm,location:e.target.value})} placeholder="Chicago, IL"/></FRow>
          <FRow label="Address"><input style={S.input} value={bucketForm.address||''} onChange={e=>setBucketForm({...bucketForm,address:e.target.value})} placeholder="123 Main St"/></FRow>
          <FRow label="Zip"><input style={S.input} value={bucketForm.zip||''} onChange={e=>setBucketForm({...bucketForm,zip:e.target.value})} placeholder="60601"/></FRow>
          <FRow label="Industry"><input style={S.input} value={bucketForm.industry||''} onChange={e=>setBucketForm({...bucketForm,industry:e.target.value})} placeholder="Manufacturing"/></FRow>
          <FRow label="Job title"><input style={S.input} value={bucketForm.jobTitle||''} onChange={e=>setBucketForm({...bucketForm,jobTitle:e.target.value})} placeholder="Logistics Manager"/></FRow>
          <FRow label="Website"><input style={S.input} value={bucketForm.website||''} onChange={e=>setBucketForm({...bucketForm,website:e.target.value})} placeholder="www.company.com"/></FRow>
        </Modal>
      )}

      {modal?.type==='editLead'&&(
        <Modal title="Edit lead" sub="Fix a bad number, update the contact, or correct any other info before the next attempt." onClose={()=>setModal(null)} onSave={saveEditLead}>
          <FRow label="Company name *"><input style={S.input} value={bucketForm.company||''} onChange={e=>setBucketForm({...bucketForm,company:e.target.value})} placeholder="Acme Corp" autoFocus/></FRow>
          <FRow label="Contact name"><input style={S.input} value={bucketForm.contact||''} onChange={e=>setBucketForm({...bucketForm,contact:e.target.value})} placeholder="John Smith"/></FRow>
          <FRow label="Email"><input style={S.input} type="email" value={bucketForm.email||''} onChange={e=>setBucketForm({...bucketForm,email:e.target.value})} placeholder="john@company.com"/></FRow>
          <FRow label="Phone"><input style={S.input} value={formatPhone(bucketForm.phone||'')} onChange={e=>setBucketForm({...bucketForm,phone:formatPhone(e.target.value)})} placeholder="(555) 000-0000"/></FRow>
          <FRow label="Location"><input style={S.input} value={bucketForm.location||''} onChange={e=>setBucketForm({...bucketForm,location:e.target.value})} placeholder="Chicago, IL"/></FRow>
          <FRow label="Address"><input style={S.input} value={bucketForm.address||''} onChange={e=>setBucketForm({...bucketForm,address:e.target.value})} placeholder="123 Main St"/></FRow>
          <FRow label="Zip"><input style={S.input} value={bucketForm.zip||''} onChange={e=>setBucketForm({...bucketForm,zip:e.target.value})} placeholder="60601"/></FRow>
          <FRow label="Industry"><input style={S.input} value={bucketForm.industry||''} onChange={e=>setBucketForm({...bucketForm,industry:e.target.value})} placeholder="Manufacturing"/></FRow>
          <FRow label="Job title"><input style={S.input} value={bucketForm.jobTitle||''} onChange={e=>setBucketForm({...bucketForm,jobTitle:e.target.value})} placeholder="Logistics Manager"/></FRow>
          <FRow label="Website"><input style={S.input} value={bucketForm.website||''} onChange={e=>setBucketForm({...bucketForm,website:e.target.value})} placeholder="www.company.com"/></FRow>
          <FRow label="Notes"><textarea style={{...S.input,minHeight:60,resize:'vertical'}} value={bucketForm.leadNotes||''} onChange={e=>setBucketForm({...bucketForm,leadNotes:e.target.value})} placeholder="Notes about this lead…"/></FRow>
        </Modal>
      )}

      {modal?.type==='reassign'&&(
        <Modal title="Reassign" sub="Move this record to a different rep." onClose={()=>setModal(null)} onSave={saveReassign} saveLabel="Reassign">
          <FRow label="Assign to">
            <select style={S.input} value={reassignState.rep||''} onChange={e=>setReassignState({...reassignState,rep:e.target.value})}>
              {Object.values(TEAM_ROSTER).map(r=><option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </FRow>
        </Modal>
      )}

      {modal?.type==='override'&&(
        <Modal title="Override cap & pull from ZoomInfo" sub={`Manager-only: pull new leads for ${viewAsRep.split(' ')[0]} from ZoomInfo even though their bucket is already full or has used this week's allotment. Doesn't change the normal 50-lead cap for anyone else.`} onClose={()=>setModal(null)} onSave={saveOverride} saveLabel={overriding?'Pulling…':'Pull leads'}>
          <FRow label="How many leads?">
            <input type="number" min={1} max={25} style={S.input} value={overrideState.count} onChange={e=>setOverrideState({...overrideState,count:e.target.value})}/>
          </FRow>
        </Modal>
      )}

      {modal?.type==='leadCriteria'&&(
        <Modal title={viewAsRep===repName?"My Lead Criteria":`${viewAsRep}'s Lead Criteria`} sub="Used every Monday to refill this rep's Cold Call Bucket back to 50 via ZoomInfo" onClose={()=>setModal(null)} onSave={saveLeadCriteriaForm} saveLabel="Save criteria">
          <FRow label="Industries & lead counts">
            {(lcForm.industryAllocations&&lcForm.industryAllocations.length?lcForm.industryAllocations:[{industry:'',count:''}]).map((alloc,idx)=>(
              <div key={idx} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                <div style={{flex:1}}>
                  <IndustryRowPicker industry={alloc.industry||''} options={zoomInfoIndustries} onChange={name=>updateIndustryAllocation(idx,{industry:name})}/>
                </div>
                <input style={{...S.input,width:80}} type="number" min="0" value={alloc.count||''} placeholder="# leads" onChange={e=>updateIndustryAllocation(idx,{count:e.target.value})}/>
                <button style={{...S.btn,padding:'6px 10px'}} onClick={()=>removeIndustryAllocationRow(idx)}>✕</button>
              </div>
            ))}
            <button style={S.btn} onClick={addIndustryAllocationRow}>+ Add another industry</button>
            <div style={{fontSize:11,color:'#aaa',marginTop:4}}>Each industry is searched on its own — set how many leads you want from it (e.g. 30 Manufacturing, 20 Building Materials). ZoomInfo can't reliably combine multiple industries in one search, so each row pulls independently.</div>
          </FRow>
          <FGrid>
            <FRow label="State(s)"><input style={S.input} value={lcForm.state||''} onChange={e=>setLcForm({...lcForm,state:e.target.value})} placeholder="TX, OK, AR"/></FRow>
            <FRow label="Zip code"><input style={S.input} value={lcForm.zipCode||''} onChange={e=>setLcForm({...lcForm,zipCode:e.target.value})} placeholder="75201"/></FRow>
          </FGrid>
          <FRow label="Radius around zip">
            <select style={S.input} value={lcForm.zipRadius||''} onChange={e=>setLcForm({...lcForm,zipRadius:e.target.value})}>
              <option value="">No radius (state only)</option>
              <option value="10">10 miles</option>
              <option value="25">25 miles</option>
              <option value="50">50 miles</option>
              <option value="100">100 miles</option>
              <option value="250">250 miles</option>
            </select>
            <div style={{fontSize:11,color:'#aaa',marginTop:4}}>Only used if a zip code is set above; otherwise state(s) apply.</div>
          </FRow>
          <FGrid>
            <FRow label="Min employees"><input style={S.input} type="number" value={lcForm.employeeMin||''} onChange={e=>setLcForm({...lcForm,employeeMin:e.target.value})} placeholder="10"/></FRow>
            <FRow label="Max employees"><input style={S.input} type="number" value={lcForm.employeeMax||''} onChange={e=>setLcForm({...lcForm,employeeMax:e.target.value})} placeholder="500"/></FRow>
          </FGrid>
          <FRow label="Target job title(s)">
            <input style={S.input} value={lcForm.jobTitles||''} onChange={e=>setLcForm({...lcForm,jobTitles:e.target.value})} placeholder="Logistics Manager, Supply Chain Director, Operations Manager"/>
            <div style={{fontSize:11,color:'#aaa',marginTop:4}}>Comma-separated — any contact matching one of these titles qualifies.</div>
          </FRow>
        </Modal>
      )}

      {toast&&<div style={{position:'fixed',bottom:16,left:'50%',transform:'translateX(-50%)',background:'#1a1a1a',color:'#fff',padding:'8px 16px',borderRadius:8,fontSize:12,zIndex:200,whiteSpace:'nowrap'}}>{toast}</div>}

      {activeCelebration&&(
        <>
          <Fireworks/>
          <div style={{position:'fixed',top:'50%',left:'50%',zIndex:301,textAlign:'center',animation:'fwBanner 4.5s ease-out forwards',pointerEvents:'none'}}>
            <div style={{fontSize:42,marginBottom:6}}>🎉🎆🎉</div>
            <div style={{background:'#1a1a1a',color:'#fff',padding:'10px 22px',borderRadius:12,fontSize:16,fontWeight:600,boxShadow:'0 8px 30px rgba(0,0,0,.25)'}}>
              {activeCelebration.rep} just closed <span style={{color:'#8FE388'}}>{activeCelebration.account}</span>! 🎉
            </div>
          </div>
        </>
      )}
    </div>
  );
}
