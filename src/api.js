export class ApiError extends Error {constructor(message,status,code,options){super(message,options);this.status=status;this.code=code;}}
export class ApiClient {
  constructor(fetcher=(...args)=>fetch(...args)){this.fetcher=fetcher;this.csrfToken=null;}
  async request(path,{method='GET',body}={}){
    let response,data;
    try{response=await this.fetcher(`/api${path}`,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':this.csrfToken||''}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
    catch(cause){throw new ApiError('اتصال به مرکز برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.',0,'NETWORK_ERROR',{cause});}
    const invalidResponse='اطلاعات درست دریافت نشد. صفحه را دوباره باز کنید یا کمی بعد تلاش کنید.';
    try{data=await response.json();}
    catch(cause){throw new ApiError(invalidResponse,response.status,'INVALID_RESPONSE',{cause});}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError(invalidResponse,response.status,'INVALID_RESPONSE');
    if(!response.ok){const error=new ApiError(typeof data.error==='string'&&data.error?data.error:'درخواست انجام نشد. دوباره تلاش کنید.',response.status,typeof data.code==='string'&&data.code?data.code:'API_ERROR');if(data.code==='EDIT_CONFLICT')error.details=data.details;throw error;}
    if(Object.hasOwn(data,'csrfToken')){
      if(typeof data.csrfToken!=='string'||!data.csrfToken)throw new ApiError(invalidResponse,response.status,'INVALID_RESPONSE');
      this.csrfToken=data.csrfToken;
    }
    return data;
  }
}
