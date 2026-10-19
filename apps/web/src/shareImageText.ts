// SPDX-License-Identifier: MPL-2.0
/** Conservative Arial advances, in ems. Rendering stays deterministic and offline. */
export function shareTextWidth(value:string,size:number,bold=false):number{
  return Array.from(value).reduce((width,c)=>width+(
    /\s/u.test(c)?.35:c==='r'?.4:/[ilIjtf.,:;'!|]/u.test(c)?.36:
    /[MW@%]/u.test(c)?1.05:/[mw]/u.test(c)?.94:
    /[A-Z]/u.test(c)?.8:/[0-9]/u.test(c)?.6:/[a-z]/u.test(c)?(bold?.63:.59):
    c==='+'?.6:/[()\-\/]/u.test(c)?.5:1
  )*size*(bold?1.04:1),0);
}

/** Wrap to available pixels instead of treating a narrow digit like a wide W. */
export function wrapShareText(value:string,width:number,size:number,bold=false):string[]{
  const lines:string[]=[];
  for(const token of value.trim().split(/\s+/u).filter(Boolean)){
    const pieces:string[]=[];let piece='';
    for(const c of token){
      if(piece&&shareTextWidth(piece+c,size,bold)>width){pieces.push(piece);piece='';}
      piece+=c;
    }
    if(piece)pieces.push(piece);
    for(const word of pieces){
      const last=lines.at(-1);
      if(last&&shareTextWidth(`${last} ${word}`,size,bold)<=width)lines[lines.length-1]+=` ${word}`;
      else lines.push(word);
    }
  }
  return lines;
}
