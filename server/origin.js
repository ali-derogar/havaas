export function normalizeAppOrigin(value){
  if(value===undefined||value==='')return '';
  try{
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error();
    return url.origin;
  }catch{throw Error('APP_ORIGIN must be an HTTP(S) origin without a path, query, fragment or credentials.');}
}

export function appOrigin(req){
  return normalizeAppOrigin(process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`);
}
