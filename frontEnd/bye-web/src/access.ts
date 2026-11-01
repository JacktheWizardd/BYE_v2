import {api,auth,ApiError} from './api';
export type Membership={user_id:string,role:'owner'|'reader',expires_at:string,revoked_at:string|null,invite_id:string|null};
export function formatAccessCode(value:string){const raw=value.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,8);return raw.length>4?raw.slice(0,4)+'-'+raw.slice(4):raw}
export async function readAccess():Promise<Membership>{const {data}=await api<{data:Membership}>('/me');if(!data||!['reader','owner'].includes(data.role))throw new ApiError(503,'invalid_access','Access could not be verified.');return data}
export async function redeemAccess(code:string):Promise<Membership>{
 if(!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code))throw Error('Enter all 8 characters.');
 const {data:{session}}=await auth.auth.getSession();if(!session){const {error}=await auth.auth.signInAnonymously();if(error)throw error}
 await api('/auth/invites/redeem',undefined,{code});return readAccess();
}
export function unlockDestination(role:Membership['role'],next:unknown,ownerScreen=false){if(typeof next==='string'&&/^\/(?:plan(?:\?|$)|search(?:\?|$)|results(?:\?|$)|report\/)/.test(next))return next;return role==='owner'||ownerScreen?'/owner':'/search'}
