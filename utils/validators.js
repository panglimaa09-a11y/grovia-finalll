export function cleanString(value,max=200){return typeof value==='string'?value.trim().slice(0,max):'';}
export function validDate(value){return typeof value==='string'&&!Number.isNaN(new Date(value).getTime());}
export function inList(value,list){return list.includes(value);}
