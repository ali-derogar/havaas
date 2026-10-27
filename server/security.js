import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
export class HttpError extends Error{constructor(status,message,code='REQUEST_ERROR'){super(message);this.status=status;this.code=code;}}
export const requireValue=(test,message,status=400,code)=>{if(!test)throw new HttpError(status,message,code);};
export const token=()=>randomBytes(32).toString('hex');
export const digest=value=>createHash('sha256').update(String(value)).digest('hex');
export function validPassword(password){requireValue(typeof password==='string'&&password.length>=12&&password.length<=128,'رمز باید بین ۱۲ تا ۱۲۸ نویسه باشد.');}
export async function passwordHash(password){validPassword(password);const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64,{N:131072,r:8,p:1,maxmem:192*1024*1024});return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password,hash){if(typeof password!=='string'||password.length>128)return false;const [name,N,r,p,salt,expected]=String(hash).split('$');if(name!=='scrypt'||!expected)return false;const key=await derive(password,salt,64,{N:Number(N),r:Number(r),p:Number(p),maxmem:192*1024*1024});const buffer=Buffer.from(expected,'hex');return buffer.length===key.length&&timingSafeEqual(key,buffer);}
export function emailOf(value){const email=String(value||'').trim().toLowerCase();requireValue(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'نشانی ایمیل معتبر وارد کنید.');return email;}
export function uuid(value){requireValue(typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),'شناسه معتبر نیست.');return value;}
export const publicUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role,active:u.active});
