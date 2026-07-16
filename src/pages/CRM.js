import React, { useState, useMemo } from 'react';
import { useAuth, TEAM_ROSTER } from '../context/AuthContext';
import { useAccounts, useDeals, useFollowups, useBucket } from '../hooks/useData';

const ACCT_COLORS=[['#E6F1FB','#0C447C'],['#E1F5EE','#085041'],['#FAEEDA','#633806'],['#EEEDFE','#3C3489'],['#FAECE7','#712B13'],['#FBEAF0','#72243E'],['#F0FFF4','#276749'],['#FFF5F5','#C53030'],['#FFFFF0','#744210'],['#E9F0FF','#2B4ECF']];
const acctColor = n => ACCT_COLORS[(n.charCodeAt(0)+(n.charCodeAt(1)||0))%ACCT_COLORS.length];
const initials = n => n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const today = () => new Date().toISOString().split('T')[0];
const nowLabel = () => new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const fmtDate = d => { if(!d) return '—'; return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
const daysAgo = iso => { if(!iso) return '—'; const d=Math.floor((Date.now()-new Date(iso))/(864e5)); if(d===0)return'Today'; if(d===1)return'Yesterday'; if(d<7)return d+' days ago'; return Math.floor(d/7)+' wks ago'; };
const daysSince = iso => { if(!iso) return null; return Math.floor((Date.now()-new Date(iso))/(864e5)); };
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

const STAGES=['New Lead','Contact Made','Quoting','Closed Won'];
const SCOLS={'New Lead':['#F1EFE8','#5F5E5A'],'Contact Made':['#FAEEDA','#633806'],'Quoting':['#E6F1FB','#0C447C'],'Closed Won':['#EAF3DE','#3B6D11'],'Closed Lost':['#FCEBEB','#A32D2D']};
const SOURCES=['Cold Call','Referral','Network Lead'];
const LOST_REASONS=['Price too high','Went with competitor','No volume available','No response','Other'];
const ACT_TYPES=['Call','Email','Meeting','Note','Other'];
const BUCKET_CAP=100;
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
function FGrid({children}){return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{children}</div>;}
function DetailSection({title,children}){return(<div style={{marginBottom:14}}><div style={{fontSize:10,fontWeight:500,color:'#aaa',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>{title}</div>{children}</div>);}
function DetailRow({k,v}){return(<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,padding:'4px 0',borderBottom:'0.5px solid #F0EFE8'}}><span style={{color:'#888'}}>{k}</span><span style={{fontWeight:500,textAlign:'right',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</span></div>);}

export default function CRM(){
  const{repProfile,logout}=useAuth();
  const isManager=repProfile?.isManager||false;
  const repName=repProfile?.name||'';
  const{accounts,addAccount,updateAccount,deleteAccount}=useAccounts(repName,isManager);
  const{deals,addDeal,updateDeal,deleteDeal}=useDeals(repName,isManager);
  const{followups,addFollowup,updateFollowup,deleteFollowup}=useFollowups(repName,isManager);
  const{leads,addLead,updateLead,deleteLead}=useBucket(repName);
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

  const myAccounts=useMemo(()=>accounts.filter(a=>a.rep===repName),[accounts,repName]);
  const myDeals=useMemo(()=>deals.filter(d=>d.rep===repName),[deals,repName]);
  const myFollowups=useMemo(()=>followups.filter(f=>f.rep===repName),[followups,repName]);
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
  const shipmentsPerRep=useMemo(()=>{
    const map={};
    Object.values(TEAM_ROSTER).forEach(r=>{map[r.name]=accounts.filter(a=>a.rep===r.name).reduce((s,a)=>s+(a.shipmentsThisMonth||0),0);});
    return map;
  },[accounts]);
  const myShipmentsThisMonth=useMemo(()=>myAccounts.reduce((s,a)=>s+(a.shipmentsThisMonth||0),0),[myAccounts]);
  const atRiskCount=useMemo(()=>myAccounts.filter(a=>isAtRisk(a)).length,[myAccounts]);

  const[af,setAf]=useState({});
  function openAccountModal(id=null){
    const a=id?accounts.find(x=>x.id===id):null;
    setAf(a?{...a}:{name:'',industry:'',location:'',status:'Active',contact:'',email:'',phone:'',shipmentType:'',commodity:'',notes:'',rep:repName});
    setModal({type:'account',id});
  }
  async function saveAccount(){
    if(!af.name?.trim()){showToast('Company name required');return;}
    if(modal.id){await updateAccount(modal.id,{...af,rep:af.rep||repName});}
    else{await addAccount({...af,rep:af.rep||repName});}
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
    setDf(d?{...d}:{stage:'New Lead',source:'Cold Call',lostReason:'',activities:[]});
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
    let accountId=df.accountId||null;
    if(!modal.id&&isNewProspect){
      const newAcct=await addAccount({name:accountName,industry:df.npIndustry||'',location:df.npLocation||'',status:'Active',contact:df.npContact||'',email:df.npEmail||'',phone:df.npPhone||'',rep:repName,shipmentType:df.npShipmentType||'',commodity:'',notes:''});
      accountId=newAcct.id;
    }
    const note=df.newNote?.trim();
    const activities=df.activities||[];
    if(note)activities.unshift({text:note,time:nowLabel()});
    if(modal.id){
      const oldStage=deals.find(x=>x.id===modal.id)?.stage;
      if(stage!==oldStage)activities.unshift({text:`Stage changed: ${oldStage} → ${stage}`,time:nowLabel()});
      await updateDeal(modal.id,{...df,activities,newNote:null});
    }else{
      activities.push({text:'Prospect added to pipeline',time:nowLabel()});
      await addDeal({account:accountName,accountId,stage,source:df.source,rep:repName,lostReason:'',activities});
    }
    setModal(null);showToast('Prospect saved!');
  }
  async function handleDeleteDeal(){
    if(!window.confirm('Delete this prospect?'))return;
    await deleteDeal(modal.id);setModal(null);setSelId(null);showToast('Prospect deleted');
  }

  const[ff,setFf]=useState({});
  function openFollowupModal(id=null,prefillAccountId=null){
    const f=id?followups.find(x=>x.id===id):null;
    const tomorrow=new Date(Date.now()+864e5).toISOString().split('T')[0];
    setFf(f?{...f}:{accountId:prefillAccountId||'',account:'',dueDate:tomorrow,contact:'',email:'',notes:''});
    setModal({type:'followup',id});
  }
  async function saveFollowup(){
    if(!ff.dueDate){showToast('Due date required');return;}
    const acct=accounts.find(a=>a.id===ff.accountId);
    const data={...ff,account:acct?.name||ff.account,rep:repName};
    if(modal.id){await updateFollowup(modal.id,data);}else{await addFollowup(data);}
    setModal(null);showToast('Follow-up saved!');
  }
  async function handleDeleteFollowup(){
    if(!window.confirm('Delete this follow-up?'))return;
    await deleteFollowup(modal.id);setModal(null);setSelId(null);showToast('Follow-up deleted');
  }

  const[logState,setLogState]=useState({type:'Call',text:''});
  function openLogModal(accountId,followupId=null){setLogState({accountId,followupId,type:'Call',text:''});setModal({type:'log'});}
  async function saveLog(){
    if(!logState.text?.trim()){showToast('Description required');return;}
    const a=accounts.find(x=>x.id===logState.accountId);if(!a)return;
    const activities=[{text:`[${logState.type}] ${logState.text.trim()}`,time:nowLabel()},...(a.activities||[])];
    await updateAccount(a.id,{activities,lastContact:new Date().toISOString()});
    if(logState.followupId)await updateFollowup(logState.followupId,{done:true,completedAt:today()});
    setModal(null);showToast('Activity logged!');
  }

  const[bucketForm,setBucketForm]=useState({});
  function openBucketForm(){setBucketForm({company:'',contact:'',email:'',phone:'',location:''});setModal({type:'addLead'});}
  async function saveLead(){
    if(!bucketForm.company?.trim()){showToast('Company name required');return;}
    await addLead({...bucketForm,rep:repName});setModal(null);showToast('Lead added!');
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
      <div style={{width:210,borderRight:'0.5px solid #E5E4DF',background:'#F7F6F3',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'16px 16px 12px',borderBottom:'0.5px solid #E5E4DF'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16}}>🚚</span>
            <div><div style={{fontWeight:600,fontSize:13}}>Oak Street Logistics</div><div style={{fontSize:11,color:'#888'}}>Sales CRM</div></div>
          </div>
        </div>
        <div style={{padding:'10px 14px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,background:repProfile?.color[0],color:repProfile?.color[1],flexShrink:0}}>{repProfile?.initials}</div>
          <div><div style={{fontSize:12,fontWeight:500}}>{repProfile?.name}</div><div style={{fontSize:10,color:'#888'}}>{isManager?'Rep & Manager':'Sales Rep'}</div></div>
        </div>
        <nav style={{padding:8,flex:1}}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>{setView(item.id);setSelId(null);}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:8,cursor:'pointer',fontSize:13,color:view===item.id?'#1a1a1a':'#666',marginBottom:2,border:view===item.id?'0.5px solid #E5E4DF':'0.5px solid transparent',background:view===item.id?'#fff':'transparent',width:'100%',textAlign:'left',fontFamily:'inherit',fontWeight:view===item.id?500:400}}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
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
            <div style={{padding:'12px 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <h2 style={{fontSize:15,fontWeight:600}}>My Accounts</h2>
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
                  {label:'Active',value:myAccounts.filter(a=>a.status==='Active').length,sub:myAccounts.length?Math.round(myAccounts.filter(a=>a.status==='Active').length/myAccounts.length*100)+'%':'0%'},
                  {label:'At-risk',value:atRiskCount,warn:atRiskCount>0,clickable:true,active:atRiskOnly,onClick:()=>setAtRiskOnly(v=>!v),hint:' (click to filter)',activeHint:' — click to clear'},
                  {label:'Shipments this month',value:myShipmentsThisMonth,highlight:true},
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
                      <th style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:'#888',width:'42%',borderBottom:'0.5px solid #E5E4DF'}}>Account</th>
                      <th style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:'#888',width:'18%',borderBottom:'0.5px solid #E5E4DF'}}>Status</th>
                      <th style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:'#888',width:'14%',borderBottom:'0.5px solid #E5E4DF'}}>Trending</th>
                      <th onClick={()=>setDaysSortDir(d=>d==='asc'?'desc':'asc')} style={{padding:'8px 12px',textAlign:'left',fontWeight:500,fontSize:11,color:atRiskOnly?'#0C447C':'#888',width:'26%',borderBottom:'0.5px solid #E5E4DF',cursor:'pointer',userSelect:'none'}} title={atRiskOnly?'Click to sort by days since last shipment':'Filter to At-risk to sort by days'}>Shipments this month{atRiskOnly?(daysSortDir==='asc'?' ↑':daysSortDir==='desc'?' ↓':' ↕'):''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.length===0?(
                      <tr><td colSpan={4} style={{textAlign:'center',padding:30,color:'#888'}}>No accounts found</td></tr>
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
                                <div style={{fontSize:11,color:'#888'}}>{a.contact||a.location||'—'}</div>
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
            <div style={{padding:'12px 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <h2 style={{fontSize:15,fontWeight:600}}>My Pipeline</h2>
              <div style={{display:'flex',gap:8}}>
                <select value={srcFilter} onChange={e=>setSrcFilter(e.target.value)} style={{...S.input,width:'auto',padding:'5px 10px'}}>
                  <option value="">All sources</option>{SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
                <button style={S.btnPrimary} onClick={()=>openDealModal()}>+ New prospect</button>
              </div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
                {[
                  {label:'Active prospects',value:myDeals.filter(d=>!['Closed Won','Closed Lost'].includes(d.stage)).length},
                  {label:'In quoting',value:myDeals.filter(d=>d.stage==='Quoting').length},
                  {label:'Closed won',value:myDeals.filter(d=>d.stage==='Closed Won').length,up:true},
                ].map((m,i)=>(
                  <div key={i} style={S.card}>
                    <div style={{fontSize:11,color:'#888',marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:22,fontWeight:600,color:m.up?'#3B6D11':'#1a1a1a'}}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
                {STAGES.map(s=>{
                  const[bg,fg]=SCOLS[s];
                  const stageDeal=myDeals.filter(d=>d.stage===s&&(!srcFilter||d.source===srcFilter));
                  return(
                    <div key={s} style={{border:'0.5px solid #E5E4DF',borderRadius:10,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                      <div style={{padding:'8px 10px',background:bg,borderBottom:'0.5px solid #E5E4DF'}}>
                        <span style={{fontSize:12,fontWeight:500,color:fg}}>{s}</span>
                        <span style={{fontSize:11,color:fg,marginLeft:5,opacity:.7}}>{stageDeal.length}</span>
                      </div>
                      <div style={{padding:8,flex:1,overflowY:'auto',maxHeight:320}}>
                        {stageDeal.length===0?(
                          <div style={{fontSize:11,color:'#aaa',padding:'10px 4px',textAlign:'center'}}>No prospects</div>
                        ):stageDeal.map(d=>(
                          <div key={d.id} onClick={()=>setSelId(d.id)}
                            style={{padding:'10px 12px',border:'0.5px solid #E5E4DF',borderRadius:8,marginBottom:6,cursor:'pointer',background:d.id===selId?'#F7F6F3':'#fff'}}>
                            <div style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:6}}>{d.account}</div>
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
            <div style={{padding:'12px 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <h2 style={{fontSize:15,fontWeight:600}}>{repProfile?.name.split(' ')[0]}'s Cold Call Bucket</h2>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:12,color:'#888'}}>{leads.length} / {BUCKET_CAP}</span>
                <button style={S.btnPrimary} onClick={openBucketForm}>+ Add lead</button>
              </div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{...S.card,marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:500}}>Bucket capacity</span>
                  <span style={{fontSize:12,fontWeight:500,color:leads.length>=BUCKET_CAP?'#A32D2D':leads.length>=80?'#633806':'#3B6D11'}}>{leads.length} / {BUCKET_CAP}</span>
                </div>
                <div style={{height:6,borderRadius:3,background:'#E5E4DF',overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:3,width:`${Math.min(leads.length/BUCKET_CAP*100,100)}%`,background:leads.length>=BUCKET_CAP?'#A32D2D':leads.length>=80?'#FAC775':'#3B6D11'}}/>
                </div>
              </div>
              {leads.length===0?(
                <div style={{textAlign:'center',padding:40,color:'#888'}}><div style={{fontSize:28,marginBottom:8}}>📞</div>Bucket empty. Add leads to get started.</div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                  {leads.map(lead=>(
                    <div key={lead.id} style={S.card}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{lead.company}</div>
                          <div style={{fontSize:11,color:'#888'}}>{lead.contact||''}</div>
                          {lead.email&&<div style={{fontSize:11,color:'#0C447C'}}>{lead.email}</div>}
                          {lead.phone&&<div style={{fontSize:11,color:'#888'}}>{lead.phone}</div>}
                        </div>
                        <span style={{background:'#EEF2FF',color:'#3730A3',borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:500,flexShrink:0}}>{lead.attempts||0} att.</span>
                      </div>
                      {lead.notes?.length>0&&<div style={{fontSize:11,color:'#aaa',background:'#fff',borderRadius:6,padding:'5px 8px',marginBottom:8}}>{lead.notes[0].text} · {lead.notes[0].time}</div>}
                      <div style={{display:'flex',gap:6}}>
                        <button style={{...S.btn,flex:1,justifyContent:'center',fontSize:11}} onClick={()=>{
                          const notes=[{text:window.prompt('Notes (optional):')||'No contact',time:nowLabel()},...(lead.notes||[])];
                          updateLead(lead.id,{attempts:(lead.attempts||0)+1,notes});showToast('Attempt logged');
                        }}>📵 Attempted</button>
                        <button style={{...S.btnPrimary,flex:1,justifyContent:'center',fontSize:11}} onClick={async()=>{
                          const note=window.prompt('What happened?');if(!note)return;
                          const dueDate=new Date(Date.now()+864e5).toISOString().split('T')[0];
                          await deleteLead(lead.id);
                          let acct=accounts.find(a=>a.name.toLowerCase()===lead.company.toLowerCase());
                          if(!acct){const ref=await addAccount({name:lead.company,industry:'',location:lead.location||'',status:'Active',contact:lead.contact||'',email:lead.email||'',phone:lead.phone||'',rep:repName,shipmentType:'',commodity:'',notes:'',activities:[{text:`[Call] ${note}`,time:nowLabel()}],lastContact:new Date().toISOString()});acct={id:ref.id,name:lead.company};}
                          await addDeal({account:acct.name,accountId:acct.id,stage:'Contact Made',source:'Cold Call',rep:repName,lostReason:'',activities:[{text:note,time:nowLabel()}]});
                          await addFollowup({accountId:acct.id,account:acct.name,contact:lead.contact||'',email:lead.email||'',dueDate,rep:repName,notes:note,done:false});
                          showToast('Lead moved to Contact Made!');
                        }}>📞 Contacted</button>
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
            <div style={{padding:'12px 16px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <h2 style={{fontSize:15,fontWeight:600}}>My Follow-ups</h2>
              <button style={S.btnPrimary} onClick={()=>openFollowupModal()}>+ Schedule follow-up</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {(()=>{
                const overdue=myFollowups.filter(f=>!f.done&&f.dueDate<today());
                const dueToday=myFollowups.filter(f=>!f.done&&f.dueDate===today());
                const upcoming=myFollowups.filter(f=>!f.done&&f.dueDate>today());
                const done=myFollowups.filter(f=>f.done&&f.completedAt===today());
                const FuCard=({f})=>(
                  <div style={{border:'0.5px solid #E5E4DF',borderRadius:10,padding:12,marginBottom:8,background:'#fff'}}>
                    <div style={{display:'flex',gap:10}}>
                      <input type="checkbox" checked={f.done} onChange={async e=>{await updateFollowup(f.id,{done:e.target.checked,completedAt:e.target.checked?today():null});}} style={{flexShrink:0,width:15,height:15,cursor:'pointer',marginTop:2}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,textDecoration:f.done?'line-through':'none',color:f.done?'#aaa':'#1a1a1a'}}>{f.account}</div>
                        {f.contact&&<div style={{fontSize:11,color:'#888',marginTop:1}}>{f.contact}</div>}
                        {f.email&&<div style={{fontSize:11,color:'#0C447C',marginTop:1}}>{f.email}</div>}
                        {f.notes&&<div style={{fontSize:11,color:'#aaa',marginTop:3,fontStyle:'italic'}}>"{f.notes}"</div>}
                        <div style={{fontSize:11,color:!f.done&&f.dueDate<today()?'#A32D2D':'#888',marginTop:4,fontWeight:!f.done&&f.dueDate<today()?600:400}}>
                          {!f.done&&f.dueDate<today()?'⚠ Overdue · ':''}{fmtDate(f.dueDate)}
                        </div>
                      </div>
                    </div>
                    {!f.done&&f.accountId&&<div style={{marginTop:8}}><button style={{...S.btnLog,width:'100%',justifyContent:'center',fontSize:11}} onClick={()=>openLogModal(f.accountId,f.id)}>✏️ Log what happened</button></div>}
                  </div>
                );
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
            <div style={{padding:'12px 16px',borderBottom:'0.5px solid #E5E4DF',flexShrink:0}}>
              <h2 style={{fontSize:15,fontWeight:600}}>Manager Dashboard</h2>
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
                <div style={{fontWeight:500,marginBottom:10}}>Rep performance</div>
                <div style={{border:'0.5px solid #E5E4DF',borderRadius:10,overflow:'hidden'}}>
                  {Object.entries(TEAM_ROSTER).map(([email,rep],i)=>{
                    const repAccts=accounts.filter(a=>a.rep===rep.name);
                    const repDeals=deals.filter(d=>d.rep===rep.name);
                    const repFu=followups.filter(f=>f.rep===rep.name&&!f.done);
                    const isSelected=mgrSel?.type==='rep'&&mgrSel?.value===email;
                    return(
                      <div key={email} onClick={()=>setMgrSel({type:'rep',value:email})}
                        style={{display:'grid',gridTemplateColumns:'140px 1fr 60px 60px 60px 60px',gap:8,alignItems:'center',padding:'10px 12px',borderBottom:i<Object.keys(TEAM_ROSTER).length-1?'0.5px solid #E5E4DF':'none',cursor:'pointer',background:isSelected?'#F7F6F3':'#fff'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,background:rep.color[0],color:rep.color[1],flexShrink:0}}>{rep.initials}</div>
                          <div><div style={{fontSize:12,fontWeight:500}}>{rep.name.split(' ')[0]}</div>{rep.isManager&&<div style={{fontSize:10,color:'#aaa'}}>Mgr</div>}</div>
                        </div>
                        <div style={{fontSize:11,color:'#888'}}>{repAccts.length} accts</div>
                        <div style={{textAlign:'center',fontSize:13,fontWeight:500}}>{repDeals.filter(d=>d.stage==='New Lead').length}</div>
                        <div style={{textAlign:'center',fontSize:13,fontWeight:500}}>{repDeals.filter(d=>d.stage==='Contact Made').length}</div>
                        <div style={{textAlign:'center',fontSize:13,fontWeight:600,color:'#3B6D11'}}>{repDeals.filter(d=>d.stage==='Closed Won').length}</div>
                        <div style={{textAlign:'center',fontSize:13}}>{repFu.length} F/U</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{fontWeight:500,marginBottom:10}}>Pipeline — all reps</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
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
      <div style={{width:380,borderLeft:'0.5px solid #E5E4DF',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
        <div style={{padding:'12px 14px',borderBottom:'0.5px solid #E5E4DF',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <h3 style={{fontSize:13,fontWeight:600}}>{view==='accounts'?'Account detail':view==='pipeline'?'Prospect detail':'Detail'}</h3>
          <div style={{display:'flex',gap:6}}>
            {selId&&view==='accounts'&&<button style={{...S.btn,padding:'4px 10px',fontSize:11}} onClick={()=>openAccountModal(selId)}>✏️ Edit</button>}
            {selId&&view==='pipeline'&&(
              <>
                <button style={{...S.btn,padding:'4px 10px',fontSize:11}} onClick={()=>openDealModal(selId)}>✏️ Edit prospect</button>
                {selectedDeal?.accountId&&<button style={{...S.btn,padding:'4px 10px',fontSize:11}} onClick={()=>openAccountModal(selectedDeal.accountId)}>🏢 Edit account</button>}
              </>
            )}
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:14}}>

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
                  <div style={{fontSize:12,color:'#888'}}>{a.industry||''}{a.location?' · '+a.location:''}</div>
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
                  {a.phone&&<DetailRow k="Phone" v={a.phone}/>}
                  {!a.contact&&!a.email&&!a.phone&&<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No contact info yet — click Edit</div>}
                </DetailSection>
                {(a.shipmentType||a.commodity)&&<DetailSection title="Shipment info">
                  {a.shipmentType&&<DetailRow k="Shipment Type" v={a.shipmentType}/>}
                  {a.commodity&&<DetailRow k="Commodity" v={a.commodity}/>}
                </DetailSection>}
                {a.notes&&<DetailSection title="Notes"><p style={{fontSize:12,color:'#888',lineHeight:1.5}}>{a.notes}</p></DetailSection>}
                {a.activities?.length>0&&<DetailSection title="Activity log">
                  {a.activities.map((act,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:10}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:'#D5D4CF',flexShrink:0,marginTop:4}}/>
                      <div><div style={{fontSize:12,color:'#888',lineHeight:1.5}}>{act.text}</div><div style={{fontSize:11,color:'#aaa',marginTop:2}}>{act.time}</div></div>
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
                  {d.lostReason&&<DetailRow k="Lost reason" v={d.lostReason}/>}
                </DetailSection>
                {a&&<DetailSection title="Account info">
                  {a.contact&&<DetailRow k="Contact" v={a.contact}/>}
                  {a.email&&<DetailRow k="Email" v={<a href={`mailto:${a.email}`} style={{color:'#0C447C',textDecoration:'none'}}>{a.email}</a>}/>}
                  {a.phone&&<DetailRow k="Phone" v={a.phone}/>}
                  {a.shipmentType&&<DetailRow k="Shipment Type" v={a.shipmentType}/>}
                  {a.location&&<DetailRow k="Location" v={a.location}/>}
                  {!a.contact&&!a.email&&!a.phone&&<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No account info — click Edit account</div>}
                </DetailSection>}
                <DetailSection title="Notes & activity">
                  {d.activities?.length>0?d.activities.map((n,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:10}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:'#D5D4CF',flexShrink:0,marginTop:4}}/>
                      <div><div style={{fontSize:12,color:'#888'}}>{n.text}</div><div style={{fontSize:11,color:'#aaa',marginTop:2}}>{n.time}</div></div>
                    </div>
                  )):<div style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No notes yet — click Edit prospect to add</div>}
                </DetailSection>
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
                  <DetailSection title="Shipments this month"><DetailRow k="Total" v={shipmentsPerRep[rep.name]||0}/></DetailSection>
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
                        {d.activities?.length>0&&<div style={{fontSize:11,color:'#aaa',marginTop:4}}>{d.activities[0].text} · {d.activities[0].time}</div>}
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
          <FGrid>
            <FRow label="City, State"><input style={S.input} value={af.location||''} onChange={e=>setAf({...af,location:e.target.value})} placeholder="Chicago, IL"/></FRow>
            <FRow label="Status"><select style={S.input} value={af.status||'Active'} onChange={e=>setAf({...af,status:e.target.value})}>{ACCT_STATUSES.map(s=><option key={s}>{s}</option>)}</select></FRow>
          </FGrid>
          <FRow label="Primary contact"><input style={S.input} value={af.contact||''} onChange={e=>setAf({...af,contact:e.target.value})} placeholder="John Smith"/></FRow>
          <FRow label="Email"><input style={S.input} type="email" value={af.email||''} onChange={e=>setAf({...af,email:e.target.value})} placeholder="john@company.com"/></FRow>
          <FRow label="Phone"><input style={S.input} value={af.phone||''} onChange={e=>setAf({...af,phone:e.target.value})} placeholder="(555) 000-0000"/></FRow>
          <FRow label="Shipment Type"><input style={S.input} value={af.shipmentType||''} onChange={e=>setAf({...af,shipmentType:e.target.value})} placeholder="FTL Dry Van, LTL, Reefer"/></FRow>
          <FRow label="Commodity"><input style={S.input} value={af.commodity||''} onChange={e=>setAf({...af,commodity:e.target.value})} placeholder="General freight"/></FRow>
          <FRow label="Notes"><textarea style={{...S.input,minHeight:60,resize:'vertical'}} value={af.notes||''} onChange={e=>setAf({...af,notes:e.target.value})} placeholder="Notes…"/></FRow>
          {isManager&&<FRow label="Assign to rep"><select style={S.input} value={af.rep||repName} onChange={e=>setAf({...af,rep:e.target.value})}>{Object.values(TEAM_ROSTER).map(r=><option key={r.name} value={r.name}>{r.name}</option>)}</select></FRow>}
        </Modal>
      )}

      {modal?.type==='deal'&&(
        <Modal title={modal.id?'Edit prospect':'New prospect'} onClose={()=>setModal(null)} onSave={saveDeal} showDelete={!!modal.id} onDelete={handleDeleteDeal}>
          {modal.id?(
            <FRow label="Prospect"><div style={{fontSize:15,fontWeight:600,padding:'4px 0'}}>{df.account}</div></FRow>
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
                  <FRow label="Phone"><input style={S.input} value={df.npPhone||''} onChange={e=>setDf({...df,npPhone:e.target.value})} placeholder="(555) 000-0000"/></FRow>
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
          <FRow label="Account">
            <select style={S.input} value={ff.accountId||''} onChange={e=>setFf({...ff,accountId:e.target.value})}>
              <option value="">Select account</option>
              {myAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FRow>
          <FRow label="Due date *"><input style={S.input} type="date" value={ff.dueDate||''} onChange={e=>setFf({...ff,dueDate:e.target.value})}/></FRow>
          <FRow label="Contact name"><input style={S.input} value={ff.contact||''} onChange={e=>setFf({...ff,contact:e.target.value})} placeholder="John Smith"/></FRow>
          <FRow label="Email"><input style={S.input} type="email" value={ff.email||''} onChange={e=>setFf({...ff,email:e.target.value})} placeholder="john@company.com"/></FRow>
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
          <FRow label="Phone"><input style={S.input} value={bucketForm.phone||''} onChange={e=>setBucketForm({...bucketForm,phone:e.target.value})} placeholder="(555) 000-0000"/></FRow>
          <FRow label="Location"><input style={S.input} value={bucketForm.location||''} onChange={e=>setBucketForm({...bucketForm,location:e.target.value})} placeholder="Chicago, IL"/></FRow>
        </Modal>
      )}

      {toast&&<div style={{position:'fixed',bottom:16,left:'50%',transform:'translateX(-50%)',background:'#1a1a1a',color:'#fff',padding:'8px 16px',borderRadius:8,fontSize:12,zIndex:200,whiteSpace:'nowrap'}}>{toast}</div>}
    </div>
  );
}
