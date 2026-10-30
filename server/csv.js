function csvCell(value){
 let text=typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)?String(value):'';
 if(typeof value==='string'&&(/^[\t\r\n]|^\s*[=+\-@＝＋－＠]/u).test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}

export function serializeCsv(rows){
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
