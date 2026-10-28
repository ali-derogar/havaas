import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { isValidText } from '../src/core/clients.js';
export { isValidText };
const derive=promisify(scrypt);
export class HttpError extends Error{constructor(status,message,code='REQUEST_ERROR'){super(message);this.status=status;this.code=code;}}
export const requireValue=(test,message,status=400,code)=>{if(!test)throw new HttpError(status,message,code);};
export function textOf(value,message){requireValue(typeof value==='string'&&isValidText(value),message);return value.trim();}
export const token=()=>randomBytes(32).toString('hex');
export const digest=value=>createHash('sha256').update(String(value)).digest('hex');
export function validPassword(password){requireValue(typeof password==='string'&&password.length>=12&&password.length<=128,'رمز باید بین ۱۲ تا ۱۲۸ نویسه باشد.');}
export async function passwordHash(password){validPassword(password);const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64,{N:131072,r:8,p:1,maxmem:192*1024*1024});return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password,hash){if(typeof password!=='string'||password.length>128)return false;const [name,N,r,p,salt,expected]=String(hash).split('$');if(name!=='scrypt'||!expected)return false;const key=await derive(password,salt,64,{N:Number(N),r:Number(r),p:Number(p),maxmem:192*1024*1024});const buffer=Buffer.from(expected,'hex');return buffer.length===key.length&&timingSafeEqual(key,buffer);}
export function emailOf(value){const message='نشانی ایمیل معتبر وارد کنید.',email=textOf(value,message).toLowerCase();requireValue(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),message);return email;}
export function uuid(value){requireValue(typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),'شناسه معتبر نیست.');return value;}
export function usernameOf(value){const message='نام کاربری باید ۳ تا ۶۴ نویسهٔ انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.',username=textOf(value,message).toLowerCase();requireValue(/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username),message);return username;}
export const publicUser=u=>({id:u.id,username:u.username,email:u.email,name:u.name,role:u.role,active:u.active,pending:u.pending,passwordChangeRequired:u.password_change_required,createdAt:u.created_at,lastLoginAt:u.last_login_at});
