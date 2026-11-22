import lockfile from 'proper-lockfile';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';

// All SDK authentication (including token invalidation) must run inside the same
// cross-process lease. Atomic rename alone cannot protect a rotating refresh grant.
export function createOAuthStateStore(storage){
 const context=new AsyncLocalStorage();let state={};
 async function read(){
  try{return JSON.parse(await readFile(storage,'utf8'));}
  catch(error){if(error.code==='ENOENT')return {};throw new Error('Knowledge OAuth storage cannot be read');}
 }
 function assertLease(){const lease=context.getStore();if(!lease?.active||lease.compromised)throw new Error('Knowledge OAuth lease is unavailable');}
 async function save(){
  assertLease();const temporary=storage+'.'+randomBytes(8).toString('hex');
  try{await writeFile(temporary,JSON.stringify(state),{mode:0o600,flag:'wx'});assertLease();await rename(temporary,storage);}
  finally{await rm(temporary,{force:true});}
 }
 return {
  get state(){assertLease();return state;},
  async current(){return context.getStore()?.active?(assertLease(),state):read();},
  async update(fn){assertLease();fn(state);await save();},
  async run(fn){
   if(context.getStore()?.active){assertLease();return fn();}
   const lease={active:true,compromised:false};
   const release=await lockfile.lock(storage,{realpath:false,stale:30000,update:5000,retries:{retries:120,factor:1,minTimeout:250,maxTimeout:250,randomize:false},onCompromised:()=>{lease.compromised=true;}});
   try{return await context.run(lease,async()=>{state=await read();return fn();});}
   finally{lease.active=false;await release();}
  },
 };
}
