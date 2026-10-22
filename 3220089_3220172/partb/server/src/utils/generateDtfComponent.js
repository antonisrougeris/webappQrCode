import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage, registerFont } from "canvas";
import { componentSpec, normalizeSize } from "../services/dtf-inventory.service.js";

const DPI=300;
registerFont(path.join(process.cwd(),"fonts","DejaVuSans-Bold.ttf"),{family:"PrintFont"});
const px=cm=>Math.round(cm/2.54*DPI);
const assets=path.resolve(process.cwd(),"../client/public/assets/print");
const output=canvas=>canvas.toBuffer("image/png", { resolution: DPI });

export async function generateDtfComponentArtwork(spec) {
  const safe=componentSpec(spec.type,spec.color,{size:spec.size,text:spec.text});
  if (safe.type === "logo" || safe.type === "neck") {
    const file=safe.type==="logo" ? `logo-${safe.color}.png` : `neck-label-${safe.color}-l.png`;
    const image=await loadImage(await fs.readFile(path.join(assets,file)));
    // The size letter is printed separately. Remove the bottom letter region.
    // Existing 590x281 neck artwork has its size below the slogan.
    const sourceHeight=safe.type==="neck" ? Math.round(image.height*0.73) : image.height;
    const width=px(7);
    const height=Math.ceil(width*sourceHeight/image.width);
    const canvas=createCanvas(width,height);
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,width,height);
    ctx.drawImage(image,0,0,image.width,sourceHeight,0,0,width,height);
    return output(canvas);
  }
  if (safe.type==="size") {
    const size=normalizeSize(safe.size);
    const canvas=createCanvas(px(3),px(2.2));
    const ctx=canvas.getContext("2d");
    ctx.fillStyle=safe.color==="white"?"#ffffff":"#000000";
    ctx.font=`bold ${px(1.5)}px "PrintFont"`;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(size,canvas.width/2,canvas.height/2);
    return output(canvas);
  }
  if (safe.type==="text") {
    const canvas=createCanvas(px(28),px(5));
    const ctx=canvas.getContext("2d");
    ctx.fillStyle=safe.color==="white"?"#ffffff":"#000000";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.font=`bold ${px(2.8)}px "PrintFont"`;
    const words=safe.text.split(" ");
    const lines=[];let line="";
    for (const word of words) {
      const candidate=line?`${line} ${word}`:word;
      if(line && ctx.measureText(candidate).width>canvas.width*0.91){lines.push(line);line=word;}else line=candidate;
    }
    if(line)lines.push(line);
    if(lines.length>2)throw new Error("DTF slogan is too long for a two-line print");
    const gap=px(2.1);
    lines.forEach((value,i)=>ctx.fillText(value,canvas.width/2,canvas.height/2+(i-(lines.length-1)/2)*gap,canvas.width*.92));
    return output(canvas);
  }
  throw new Error("Invalid DTF artwork request");
}
