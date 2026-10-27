export class ApiError extends Error {constructor(message,status,code){super(message);this.status=status;this.code=code;}}
export class ApiClient {
  constructor(fetcher=(...args)=>fetch(...args)){this.fetcher=fetcher;this.csrfToken=null;}
  async request(path,{method='GET',body}={}){
    const response=await this.fetcher(`/api${path}`,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':this.csrfToken||''}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const data=await response.json();if(!response.ok)throw new ApiError(data.error||'ارتباط با سرور ناموفق بود.',response.status,data.code);
    if(data.csrfToken)this.csrfToken=data.csrfToken;return data;
  }
}
