/* Générateur XLSX autonome (ZIP non compressé + SpreadsheetML).
   Aucun script externe, aucune donnée envoyée à un serveur. */
(function(){
"use strict";
const te=new TextEncoder();
const escape=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const letters=n=>{let out=""; for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
function xmlSheet(rows,widths){
  const rowXml=rows.map((cells,r)=>`<row r="${r+1}">${cells.map((v,c)=>{
    if(v===null||v===undefined||v==="")return "";
    const col=letters(c)+(r+1); const sty=r===0?' s="1"':(typeof v==="number"?' s="2"':'');
    if(typeof v==="number"&&Number.isFinite(v))return `<c r="${col}"${sty}><v>${v}</v></c>`;
    return `<c r="${col}"${sty} t="inlineStr"><is><t xml:space="preserve">${escape(v)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const cols=widths?`<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols>`:"";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/>${cols}<sheetData>${rowXml}</sheetData></worksheet>`;
}
const crcTable=(()=>{const table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
function crc32(bytes){let c=0xFFFFFFFF;for(let i=0;i<bytes.length;i++)c=crcTable[(c^bytes[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zip(files){
  const local=[],central=[]; let offset=0;
  const u16=(dv,o,v)=>dv.setUint16(o,v,true),u32=(dv,o,v)=>dv.setUint32(o,v>>>0,true);
  for(const [name,content] of files){
    const fn=te.encode(name), data=te.encode(content), checksum=crc32(data);
    const loc=new Uint8Array(30+fn.length+data.length), dl=new DataView(loc.buffer);
    u32(dl,0,0x04034B50);u16(dl,4,20);u16(dl,6,0x800);u16(dl,8,0);u16(dl,10,0);u16(dl,12,0);u32(dl,14,checksum);u32(dl,18,data.length);u32(dl,22,data.length);u16(dl,26,fn.length);u16(dl,28,0);loc.set(fn,30);loc.set(data,30+fn.length);local.push(loc);
    const cen=new Uint8Array(46+fn.length), dc=new DataView(cen.buffer);
    u32(dc,0,0x02014B50);u16(dc,4,20);u16(dc,6,20);u16(dc,8,0x800);u16(dc,10,0);u16(dc,12,0);u16(dc,14,0);u32(dc,16,checksum);u32(dc,20,data.length);u32(dc,24,data.length);u16(dc,28,fn.length);u16(dc,30,0);u16(dc,32,0);u16(dc,34,0);u16(dc,36,0);u32(dc,38,0);u32(dc,42,offset);cen.set(fn,46);central.push(cen);
    offset+=loc.length;
  }
  const centralSize=central.reduce((s,a)=>s+a.length,0);
  const end=new Uint8Array(22), de=new DataView(end.buffer);u32(de,0,0x06054B50);u16(de,4,0);u16(de,6,0);u16(de,8,central.length);u16(de,10,central.length);u32(de,12,centralSize);u32(de,16,offset);u16(de,20,0);
  return new Blob([...local,...central,end],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function create(sheets){
  const files=[];
  files.push(["[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`]);
  files.push(["_rels/.rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  files.push(["xl/workbook.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${escape(s.name||`Feuille ${i+1}`)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`]);
  files.push(["xl/_rels/workbook.xml.rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  files.push(["xl/styles.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B292E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]);
  sheets.forEach((s,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,xmlSheet(s.rows,s.widths)]));
  return zip(files);
}
window.TempoXLSX={create};
})();
