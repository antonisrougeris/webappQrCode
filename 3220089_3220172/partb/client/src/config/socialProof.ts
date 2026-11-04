export interface SkanareReel {
  id: string;
  src: string;
  poster: string;
  instagramUrl: string;
  label: {en:string;el:string};
}
// Actual MP4s and images are uploaded to public/assets/social-proof by the owner.
// Missing assets must never produce a broken video card in production.
export const homepageReels: SkanareReel[] = [
  {id:"Deuk7KftZ0U",src:"/assets/social-proof/reel-deuk7kftz0u.mp4",poster:"/assets/social-proof/reel-deuk7kftz0u.webp",instagramUrl:"https://www.instagram.com/reel/Deuk7KftZ0U/",label:{en:"SKANARE Reel 1",el:"SKANARE Reel 1"}},
  {id:"DfQFmantGtg",src:"/assets/social-proof/reel-dfqfmantgtg.mp4",poster:"/assets/social-proof/reel-dfqfmantgtg.webp",instagramUrl:"https://www.instagram.com/reel/DfQFmantGtg/",label:{en:"SKANARE Reel 2",el:"SKANARE Reel 2"}},
  {id:"DfSS309tnze",src:"/assets/social-proof/reel-dfss309tnze.mp4",poster:"/assets/social-proof/reel-dfss309tnze.webp",instagramUrl:"https://www.instagram.com/reel/DfSS309tnze/",label:{en:"SKANARE Reel 3",el:"SKANARE Reel 3"}}
];
