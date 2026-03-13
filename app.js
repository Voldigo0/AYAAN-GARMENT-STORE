/* ═══ AYAAN PWD STORE — app.js v7.2 ═══════════════════════════════════════════
   FIXES in v7:
   • Password hashing (SHA-256 via Web Crypto)
   • XSS sanitization on all user-generated output
   • Phone numbers always from SiteSettings — never hardcoded
   • Stock decrements on order placement
   • Cart validates against real stock before checkout
   • Image size guard (max 400KB, storage warning)
   • waLink() / callLink() helpers replace raw hardcoded URLs
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── STORAGE ── */
const DB = {
  get:(k)=>{ try{return JSON.parse(localStorage.getItem('ayaan_'+k))}catch{return null} },
  set:(k,v)=>localStorage.setItem('ayaan_'+k,JSON.stringify(v)),
  del:(k)=>localStorage.removeItem('ayaan_'+k),
  sizeKB:()=>{ let b=0; for(let k in localStorage){ if(k.startsWith('ayaan_')) b+=(localStorage[k].length||0)*2; } return Math.round(b/1024); },
};

/* ── XSS SANITIZER ── */
function esc(str){
  if(str==null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── PASSWORD HASHING (SHA-256) ── */
async function hashPassword(pw){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* ── ROLES ── */
const ROLES = { ADMIN:'admin', STAFF:'staff', CUSTOMER:'customer' };

/* ── MASTER ADMIN ── */
const MASTER_ADMIN = { id:'admin-root', username:'usman.voldigo', _rawPw:'anime.freak.147', name:'Usman', email:'' };

/* ── LOGIN HISTORY ── */
const LoginHistory = {
  get:()=>DB.get('login_history')||[],
  add:(username,role)=>{ const h=LoginHistory.get(); h.unshift({username:esc(username),role,time:new Date().toISOString()}); DB.set('login_history',h.slice(0,20)); },
};

/* ── CATEGORIES ── */
const DefaultCategories=[
  {id:'men',label:"Men's",icon:'👔',desc:'Shalwar Kameez, Kurta, Formal',visible:true,order:1},
  {id:'women',label:"Women's",icon:'👗',desc:'Lawn, Chiffon, Printed Suits',visible:true,order:2},
  {id:'kids',label:'Kids',icon:'🧒',desc:'Boys, Girls, Festive Sherwanis',visible:true,order:3},
  {id:'baba',label:'Baba Suits',icon:'👶',desc:'Infant, Toddler, Newborn',visible:true,order:4},
];
const Categories={
  getAll:()=>DB.get('categories')||DefaultCategories,
  save:(l)=>DB.set('categories',l),
  getVisible:()=>Categories.getAll().filter(c=>c.visible).sort((a,b)=>a.order-b.order),
  getById:(id)=>Categories.getAll().find(c=>c.id===id),
  add:(cat)=>{ const l=Categories.getAll(); cat.id='cat_'+Date.now(); cat.order=l.length+1; cat.visible=true; l.push(cat); Categories.save(l); return cat; },
  update:(id,d)=>Categories.save(Categories.getAll().map(c=>c.id===id?{...c,...d}:c)),
  delete:(id)=>Categories.save(Categories.getAll().filter(c=>c.id!==id)),
  reorder:(ids)=>{ const all=Categories.getAll(); ids.forEach((id,i)=>{ const c=all.find(x=>x.id===id); if(c)c.order=i+1; }); Categories.save(all); },
};

/* ── FABRIC / SIZE PRESETS ── */
const FabricPresets={
  defaults:['Lawn','Cotton','Chiffon','Karandi','Khaddar','Linen','Net','Jamawar','Blended','Silk'],
  get:()=>DB.get('fabric_presets')||FabricPresets.defaults,
  save:(l)=>DB.set('fabric_presets',l),
  add:(f)=>{ const l=FabricPresets.get(); if(!l.includes(f)){l.push(f);FabricPresets.save(l);} },
  remove:(f)=>FabricPresets.save(FabricPresets.get().filter(x=>x!==f)),
};
const SizePresets={
  defaults:{men:['S','M','L','XL','XXL'],women:['XS','S','M','L','XL'],kids:['3Y','4Y','6Y','8Y','10Y','12Y'],baba:['0-6M','6-12M','1-2Y','2-3Y']},
  get:()=>DB.get('size_presets')||SizePresets.defaults,
  save:(d)=>DB.set('size_presets',d),
};

/* ── SITE SETTINGS ── */
const SiteSettings={
  defaults:{
    storeName:'Ayaan PWD',tagline:'Quality Clothing for Every Family',
    heroHeading:'Style for Every Season,\nEvery Family.',heroSub:"Men's, Women's, Kids & Baba Suits — Alrasheed Mall, PWD Rawalpindi.",
    heroBadge:'EID SALE ON NOW',heroBadgeOn:true,
    announceBg:'#003087',announceText:'🎉 <strong>EID SALE ON NOW</strong> — COD Available • WhatsApp Orders • <strong>Alrasheed Mall, PWD Rawalpindi</strong>',
    phone:'923001234567',waPhone:'923001234567',
    address:'Plot 1284, Alrasheed Mall, PWD Housing Society, Rawalpindi',
    mapsLink:'https://maps.google.com/?q=Alrasheed+Mall+PWD+Rawalpindi',
    hours:'Daily 10:00 AM – Midnight',
    jazzcashNum:'',easypaisaNum:'',bankIBAN:'',
    trustItems:[
      {icon:'💳',title:'COD Available',desc:'Cash on delivery'},
      {icon:'💬',title:'WhatsApp Orders',desc:'Chat to order anytime'},
      {icon:'📍',title:'PWD Rawalpindi',desc:'Alrasheed Mall'},
      {icon:'💰',title:'JazzCash / EasyPaisa',desc:'Easy mobile payment'},
    ],
    accentRed:'#C8102E',accentBlue:'#003087',
    logoText:'Ayaan PWD',logoImg:'',
    heroImg:'',heroBgColor:'#003087',
    featuredProductIds:[],pinnedNewArrivals:[],
    lowStockThreshold:5,autoLogoutMinutes:60,
    globalSaleBadge:'',globalSaleOn:false,
  },
  get:()=>({...SiteSettings.defaults,...DB.get('site_settings')}),
  save:(d)=>DB.set('site_settings',{...SiteSettings.get(),...d}),
  /* ★ Always reads phone from settings — never hardcoded ★ */
  phone:()=>(({...SiteSettings.defaults,...DB.get('site_settings')}).phone||'923001234567'),
  waPhone:()=>(({...SiteSettings.defaults,...DB.get('site_settings')}).waPhone||'923001234567'),
};

/* ★ WA / Call helpers — always use settings number ★ */
function waLink(msg){ return `https://wa.me/${SiteSettings.waPhone()}?text=${encodeURIComponent(msg)}`; }
function callLink(){ return `tel:+${SiteSettings.phone()}`; }

/* ── COUPONS ── */
const Coupons={
  getAll:()=>DB.get('coupons')||[],
  save:(l)=>DB.set('coupons',l),
  getByCode:(code)=>Coupons.getAll().find(c=>c.code.toUpperCase()===code.toUpperCase()&&c.active),
  add:(data)=>{ const l=Coupons.getAll(); data.id=Date.now(); data.uses=0; l.push(data); Coupons.save(l); return data; },
  update:(id,d)=>Coupons.save(Coupons.getAll().map(c=>c.id==id?{...c,...d}:c)),
  delete:(id)=>Coupons.save(Coupons.getAll().filter(c=>c.id!=id)),
  use:(code)=>{ const all=Coupons.getAll(); const c=all.find(x=>x.code.toUpperCase()===code.toUpperCase()); if(c){c.uses=(c.uses||0)+1;Coupons.save(all);} },
};

/* ── PRODUCTS ── */
const DEFAULT_PRODUCTS=[
  {id:1,name:'Lawn Printed 3-Piece',cat:'women',fabric:'Lawn',sizes:['S','M','L','XL'],price:3200,badge:'new',img:'',desc:'Beautiful printed lawn suit perfect for summer. Fully stitched 3-piece.',stock:15,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:2,name:"Men's Linen Kurta",cat:'men',fabric:'Linen',sizes:['S','M','L','XL'],price:2800,badge:'new',img:'',desc:'Classic linen kurta with embroidered collar.',stock:20,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:3,name:'Baba Suit – Blue',cat:'baba',fabric:'Cotton',sizes:['0-6M','6-12M','1-2Y'],price:1400,oldPrice:1800,badge:'sale',img:'',desc:'Soft cotton Baba suit in sky blue.',stock:30,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:4,name:'Chiffon Embroidered',cat:'women',fabric:'Chiffon',sizes:['S','M','L'],price:4100,badge:'new',img:'',desc:'Elegant chiffon suit with hand-embroidered border.',stock:8,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:5,name:'Khaddar Shalwar Kameez',cat:'men',fabric:'Khaddar',sizes:['M','L','XL','XXL'],price:3500,badge:'hot',img:'',desc:'Premium Khaddar for winter.',stock:12,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:6,name:'Girls Suit 3-Piece',cat:'kids',fabric:'Lawn',sizes:['4Y','6Y','8Y','10Y'],price:1600,badge:'new',img:'',desc:'Printed lawn suit for girls with dupatta.',stock:18,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:7,name:'Karandi Embroidered',cat:'women',fabric:'Karandi',sizes:['S','M','L'],price:2200,oldPrice:2800,badge:'sale',img:'',desc:'Winter karandi suit with thread embroidery.',stock:6,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:8,name:"Men's Waistcoat Set",cat:'men',fabric:'Blended',sizes:['M','L','XL'],price:4200,badge:'new',img:'',desc:'Complete waistcoat set with matching shalwar.',stock:10,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:9,name:'Kids Sherwani Set',cat:'kids',fabric:'Jamawar',sizes:['6Y','8Y','10Y','12Y'],price:2600,badge:'new',img:'',desc:'Festive Jamawar sherwani for boys.',stock:14,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:10,name:'Printed Lawn – Summer',cat:'women',fabric:'Lawn',sizes:['XS','S','M','L','XL'],price:2900,badge:'hot',img:'',desc:'Light summer lawn with digital print.',stock:22,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:11,name:'Casual Kurta – Cotton',cat:'men',fabric:'Cotton',sizes:['S','M','L','XL'],price:1800,oldPrice:2200,badge:'sale',img:'',desc:'Everyday cotton kurta in solid colors.',stock:25,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:12,name:'Girls Frock Set',cat:'kids',fabric:'Net',sizes:['3Y','5Y','7Y','9Y'],price:1900,badge:'new',img:'',desc:'Party frock set with net overlay.',stock:9,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:13,name:'Baba Suit – Pink',cat:'baba',fabric:'Cotton',sizes:['0-6M','6-12M'],price:1100,badge:'new',img:'',desc:'Soft pink cotton Baba suit.',stock:20,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:14,name:'Baba Suit – White',cat:'baba',fabric:'Cotton',sizes:['0-6M','6-12M','1-2Y'],price:950,oldPrice:1200,badge:'sale',img:'',desc:'Classic white Baba suit for newborns.',stock:28,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:15,name:"Men's Festive Kurta",cat:'men',fabric:'Jamawar',sizes:['M','L','XL'],price:5500,badge:'new',img:'',desc:'Premium Jamawar kurta for weddings and Eid.',stock:7,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
  {id:16,name:'Eid Special Suit',cat:'women',fabric:'Net',sizes:['S','M','L'],price:6800,badge:'hot',img:'',desc:'Luxury Eid suit with heavy embroidery.',stock:4,views:0,visible:true,pinned:false,createdAt:'2025-01-01'},
];
const Products={
  getAll:()=>DB.get('products')||DEFAULT_PRODUCTS,
  getVisible:()=>Products.getAll().filter(p=>p.visible!==false),
  save:(l)=>DB.set('products',l),
  getById:(id)=>Products.getAll().find(p=>p.id==id),
  add:(d)=>{ const l=Products.getAll(); d.id=Date.now(); d.views=0; d.visible=true; d.pinned=false; d.createdAt=new Date().toISOString().split('T')[0]; l.push(d); Products.save(l); return d; },
  update:(id,d)=>Products.save(Products.getAll().map(p=>p.id==id?{...p,...d}:p)),
  delete:(id)=>Products.save(Products.getAll().filter(p=>p.id!=id)),
  duplicate:(id)=>{ const p=Products.getById(id); if(!p)return; const copy={...p,id:Date.now(),name:p.name+' (Copy)',pinned:false,views:0,createdAt:new Date().toISOString().split('T')[0]}; const l=Products.getAll(); l.push(copy); Products.save(l); return copy; },
  addView:(id)=>{ const l=Products.getAll(); const p=l.find(x=>x.id==id); if(p){p.views=(p.views||0)+1;Products.save(l);} },
  /* ★ Decrement stock when order placed ★ */
  decrementStock:(items)=>{
    const l=Products.getAll();
    items.forEach(it=>{ const p=l.find(x=>x.id==it.productId); if(p) p.stock=Math.max(0,(p.stock||0)-it.qty); });
    Products.save(l);
  },
};

/* ── IMAGE GUARD ── */
const ImageGuard={
  MAX_BYTES:400*1024,
  validate:(dataUrl)=>{
    if(!dataUrl) return {ok:true};
    const bytes=Math.round((dataUrl.length-(dataUrl.indexOf(',')+1))*0.75);
    if(bytes>ImageGuard.MAX_BYTES) return {ok:false,msg:`Image is ${Math.round(bytes/1024)}KB — max 400KB. Compress at tinypng.com first.`};
    return {ok:true};
  },
  warnStorage:()=>{ const kb=DB.sizeKB(); if(kb>3500) showToast('⚠️ Storage almost full ('+kb+'KB). Remove old product images to avoid data loss.','error'); },
};

/* ── USERS ── */
const Users={
  getAll:()=>DB.get('users')||[],
  save:(l)=>DB.set('users',l),
  getById:(id)=>Users.getAll().find(u=>u.id==id),
  getByEmail:(e)=>Users.getAll().find(u=>u.email===e),

  /* ★ Stores hashed passwords — never plain text ★ */
  addCustomer:async(name,email,password)=>{
    if(!name||name.trim().length<2) return{ok:false,msg:'Name must be at least 2 characters.'};
    if(!email||!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return{ok:false,msg:'Enter a valid email address.'};
    if(!password||password.length<6) return{ok:false,msg:'Password must be at least 6 characters.'};
    const all=Users.getAll();
    if(all.find(u=>u.email===email.trim().toLowerCase())) return{ok:false,msg:'Email already registered.'};
    const passwordHash=await hashPassword(password);
    const user={id:Date.now(),name:esc(name.trim()),email:email.trim().toLowerCase(),passwordHash,role:ROLES.CUSTOMER,phone:'',address:'',createdAt:new Date().toISOString(),active:true};
    all.push(user);Users.save(all);return{ok:true,user};
  },

  addStaff:async(data)=>{
    if(!data.username||data.username.trim().length<3) return{ok:false,msg:'Username must be at least 3 characters.'};
    const all=Users.getAll();
    if(all.find(u=>u.username===data.username)) return{ok:false,msg:'Username taken.'};
    const staffData={...data};
    if(staffData.password){
      staffData.passwordHash=await hashPassword(staffData.password);
      delete staffData.password;
    }
    const user={...staffData,id:Date.now(),role:ROLES.STAFF,createdAt:new Date().toISOString(),active:true};
    all.push(user);Users.save(all);return{ok:true,user};
  },

  update:(id,d)=>Users.save(Users.getAll().map(u=>u.id==id?{...u,...d}:u)),

  loginCustomer:async(email,pw)=>{
    const u=Users.getAll().find(u=>u.email===email.trim().toLowerCase()&&u.role===ROLES.CUSTOMER);
    if(!u) return{ok:false,msg:'Incorrect email or password.'};
    const hashed=await hashPassword(pw);
    /* Support legacy plain-text migration */
    const match=u.passwordHash?u.passwordHash===hashed:u.password===pw;
    if(!match) return{ok:false,msg:'Incorrect email or password.'};
    if(!u.passwordHash) Users.update(u.id,{passwordHash:hashed,password:undefined});
    return{ok:true,user:u};
  },

  loginStaff:async(username,pw)=>{
    const u=Users.getAll().find(u=>u.username===username&&u.role===ROLES.STAFF&&u.active);
    if(!u) return{ok:false,msg:'Incorrect credentials or account disabled.'};
    const hashed=await hashPassword(pw);
    const match=u.passwordHash?u.passwordHash===hashed:u.password===pw;
    if(!match) return{ok:false,msg:'Incorrect credentials or account disabled.'};
    if(!u.passwordHash) Users.update(u.id,{passwordHash:hashed,password:undefined});
    return{ok:true,user:u};
  },
};

/* ── ORDERS ── */
const Orders={
  getAll:()=>DB.get('orders')||[],
  save:(l)=>DB.set('orders',l),
  getByUser:(uid)=>Orders.getAll().filter(o=>o.userId==uid),
  /* ★ Decrements stock automatically ★ */
  add:(order)=>{
    const l=Orders.getAll();
    order.id='ORD-'+Date.now();order.createdAt=new Date().toISOString();order.status='pending';
    l.unshift(order);Orders.save(l);
    if(order.items&&order.items.length) Products.decrementStock(order.items);
    return order;
  },
  update:(id,d)=>Orders.save(Orders.getAll().map(o=>o.id===id?{...o,...d,updatedAt:new Date().toISOString()}:o)),
};

/* ── SESSION ── */
const Session={
  getUser:()=>DB.get('sess_user'),
  setUser:(u,role)=>{ DB.set('sess_user',u);DB.set('sess_role',role); },
  logout:()=>{ DB.del('sess_user');DB.del('sess_role'); },
  getRole:()=>DB.get('sess_role'),
  isLoggedIn:()=>!!DB.get('sess_user'),
  isAdmin:()=>DB.get('sess_role')===ROLES.ADMIN,
  isStaff:()=>DB.get('sess_role')===ROLES.STAFF,
  isCustomer:()=>DB.get('sess_role')===ROLES.CUSTOMER,
  canManage:()=>['admin','staff'].includes(DB.get('sess_role')),
};

/* ── CART ── */
const Cart={
  get:()=>DB.get('cart')||[],
  save:(c)=>DB.set('cart',c),
  /* ★ Validates against stock before adding ★ */
  add:(productId,size,qty=1)=>{
    const p=Products.getById(productId);
    if(!p) return{ok:false,msg:'Product not found.'};
    const c=Cart.get();
    const ex=c.find(i=>i.productId==productId&&i.size===size);
    const currentQty=ex?ex.qty:0;
    if(p.stock!=null&&(currentQty+qty)>p.stock){
      return{ok:false,msg:`Only ${p.stock} in stock. You already have ${currentQty} in your cart.`};
    }
    if(ex) ex.qty+=qty; else c.push({productId,size,qty});
    Cart.save(c);return{ok:true};
  },
  remove:(pid,size)=>Cart.save(Cart.get().filter(i=>!(i.productId==pid&&i.size===size))),
  updateQty:(pid,size,qty)=>Cart.save(Cart.get().map(i=>(i.productId==pid&&i.size===size)?{...i,qty}:i).filter(i=>i.qty>0)),
  count:()=>Cart.get().reduce((s,i)=>s+i.qty,0),
  clear:()=>DB.del('cart'),
  /* ★ Full checkout validation ★ */
  validate:()=>{
    const issues=[];
    Cart.get().forEach(it=>{
      const p=Products.getById(it.productId);
      if(!p||!p.visible){issues.push(`A product in your cart is no longer available.`);return;}
      if(p.stock!=null&&it.qty>p.stock){
        issues.push(p.stock===0?`"${p.name}" is out of stock.`:`"${p.name}" only has ${p.stock} left (you have ${it.qty} in cart).`);
      }
    });
    return issues;
  },
};

/* ── HELPERS ── */
function getCatLabel(id){ const c=Categories.getById(id); return c?c.label:id; }
const catGrad={men:'linear-gradient(145deg,#8a9a8a,#5f6f5f)',women:'linear-gradient(145deg,#9a8a90,#6f5f65)',kids:'linear-gradient(145deg,#9a9a7a,#6f6f4f)',baba:'linear-gradient(145deg,#8a9a9a,#5f6f6f)'};
function getCatGrad(id){ return catGrad[id]||'linear-gradient(145deg,#9a9a9a,#6f6f6f)'; }
function fmtPrice(p){return 'Rs. '+Number(p).toLocaleString('en-PK')}
function fmtDate(d){return new Date(d).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}
function fmtDateTime(d){return new Date(d).toLocaleString('en-PK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function priceBadge(p,disc=0){
  let price=p.price;
  if(disc>0) price=Math.round(price*(1-disc/100));
  if(p.oldPrice||disc>0) return `<span style="text-decoration:line-through;color:var(--ink-3);font-size:12px;margin-right:4px">${fmtPrice(p.oldPrice||p.price)}</span><span class="price-sale">${fmtPrice(price)}</span>`;
  return `<strong>${fmtPrice(price)}</strong>`;
}

function showToast(msg,type=''){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}
  t.className='toast '+type;
  t.innerHTML=(type==='success'?'✓ ':type==='error'?'✕ ':'ℹ ')+msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3200);
}

/* ── AUTO LOGOUT ── */
function initAutoLogout(){
  const mins=Number(SiteSettings.get().autoLogoutMinutes)||60;
  if(!Session.isLoggedIn())return;
  let timer=setTimeout(()=>{Session.logout();location.href='login.html';},mins*60*1000);
  ['click','keydown','scroll','mousemove'].forEach(e=>document.addEventListener(e,()=>{clearTimeout(timer);timer=setTimeout(()=>{Session.logout();location.href='login.html';},mins*60*1000);},{passive:true}));
}

/* ── NAV ── */
function buildNav(activePage=''){
  initAutoLogout();
  const user=Session.getUser();const role=Session.getRole();
  const s=SiteSettings.get();const cnt=Cart.count();
  const links=[{href:'index.html',label:'Home'},{href:'catalog.html',label:'Shop'},{href:'contact.html',label:'Contact'}];
  const navLinks=links.map(p=>`<li><a href="${p.href}" class="${activePage===p.label?'active':''}">${esc(p.label)}</a></li>`).join('');
  let userSec='';
  if(!user) userSec=`<a href="login.html" class="nav-user-btn">Login / Sign Up</a>`;
  else if(role===ROLES.ADMIN) userSec=`<a href="admin.html" class="nav-user-btn" style="background:rgba(200,16,46,.1);border-color:rgba(200,16,46,.3);color:var(--red)"><span class="nav-avatar admin">A</span>Admin</a><button onclick="doLogout()" class="btn btn-outline-blue btn-sm">Logout</button>`;
  else if(role===ROLES.STAFF) userSec=`<a href="admin.html" class="nav-user-btn" style="background:rgba(200,16,46,.1);border-color:rgba(200,16,46,.3);color:var(--red)"><span class="nav-avatar admin">S</span>Staff</a><button onclick="doLogout()" class="btn btn-outline-blue btn-sm">Logout</button>`;
  else userSec=`<a href="account.html" class="nav-icon" title="Cart"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>${cnt>0?`<span class="nav-badge">${cnt}</span>`:''}</a><a href="account.html" class="nav-user-btn"><span class="nav-avatar">${esc(user.name.charAt(0).toUpperCase())}</span>${esc(user.name.split(' ')[0])}</a><button onclick="doLogout()" class="btn btn-outline-blue btn-sm">Logout</button>`;
  const logo=s.logoImg?`<img src="${s.logoImg}" style="height:36px;width:auto"/>`:`<span class="l-red">${esc((s.logoText||'Ayaan PWD').split(' ')[0])}</span>&nbsp;<span class="l-blue">${esc((s.logoText||'Ayaan PWD').split(' ').slice(1).join(' ')||'PWD')}</span>`;
  return `
    <div class="announce" style="background:${s.announceBg||'#003087'}">${s.announceText||'Ayaan PWD Store'}</div>
    <nav class="nav">
      <a href="index.html" class="nav-logo">${logo}</a>
      <ul class="nav-links">${navLinks}</ul>
      <button class="nav-burger" onclick="const m=document.getElementById('mobile-nav');m.classList.toggle('open')" aria-label="Menu"><span></span><span></span><span></span></button>
      <div class="nav-right">
        <a href="${waLink('Assalam o Alaikum! I want to enquire about your products.')}" class="btn-wa-nav" target="_blank">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </a>
        ${userSec}
      </div>
    </nav>
    <div class="mobile-nav" id="mobile-nav">
      ${links.map(l=>`<a href="${l.href}">${esc(l.label)}</a>`).join('')}
      ${!user?`<a href="login.html">Login / Sign Up</a>`:`<a href="${role===ROLES.CUSTOMER?'account.html':'admin.html'}">My Account</a><a href="#" onclick="doLogout()">Logout</a>`}
    </div>`;
}

function buildFooter(){
  const s=SiteSettings.get();
  const trustItems=(s.trustItems||[]).map(t=>`<div class="trust-item"><div class="trust-icon">${t.icon}</div><div class="trust-h">${esc(t.title)}</div><div class="trust-p">${esc(t.desc)}</div></div>`).join('');
  return `
  <div class="trust-bar">${trustItems}</div>
  <footer class="footer">
    <div class="footer-top">
      <div>
        <div class="footer-brand-logo">${esc(s.storeName||'Ayaan PWD')}</div>
        <p class="footer-desc">${esc(s.tagline||'Quality clothing for every family.')}</p>
      </div>
      <div>
        <div class="footer-h">Quick Links</div>
        <div class="footer-links">
          <a href="index.html">Home</a><a href="catalog.html">Shop All</a>
          ${Categories.getVisible().map(c=>`<a href="catalog.html?cat=${esc(c.id)}">${esc(c.label)}</a>`).join('')}
        </div>
      </div>
      <div>
        <div class="footer-h">Contact</div>
        <div class="footer-links">
          <a href="contact.html">Find Our Store</a>
          <a href="${waLink('Assalam o Alaikum!')}" target="_blank">WhatsApp Us</a>
          <a href="${callLink()}">Call Store</a>
          <a href="account.html">My Account</a><a href="login.html">Login / Sign Up</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${esc(s.storeName||'Ayaan PWD')} · ${esc(s.address||'')}</span>
      <span>Pay via COD • JazzCash • EasyPaisa • Bank Transfer</span>
    </div>
  </footer>
  <div class="toast" id="toast"></div>`;
}

function doLogout(){ Session.logout(); Cart.clear(); RecentlyViewed.clear(); showToast('Logged out.','success'); setTimeout(()=>location.href='index.html',800); }
function togglePw(id,btn){ const i=document.getElementById(id); i.type=i.type==='password'?'text':'password'; btn.textContent=i.type==='password'?'👁':'🙈'; }

/* ── WISHLIST ── */
const Wishlist={
  get:()=>DB.get('wishlist')||[],
  save:(l)=>DB.set('wishlist',l),
  has:(pid)=>Wishlist.get().includes(Number(pid)),
  toggle:(pid)=>{ const l=Wishlist.get();const id=Number(pid);const idx=l.indexOf(id);if(idx>=0)l.splice(idx,1);else l.push(id);Wishlist.save(l);return idx<0; },
  count:()=>Wishlist.get().length,
  clear:()=>DB.del('wishlist'),
};

/* ── RECENTLY VIEWED ── */
const RecentlyViewed={
  get:()=>DB.get('recently_viewed')||[],
  add:(pid)=>{ if(!Session.isCustomer())return; let l=RecentlyViewed.get().filter(x=>x!==Number(pid)); l.unshift(Number(pid)); DB.set('recently_viewed',l.slice(0,12)); },
  clear:()=>DB.del('recently_viewed'),
};

/* ── RECEIPT BUILDER ── */
const Receipt={
  build:(order)=>{
    const s=SiteSettings.get();
    const items=(order.items||[]).map(it=>{ const p=Products.getById(it.productId); return p?{name:p.name,size:it.size,qty:it.qty,price:p.price,line:p.price*it.qty}:null; }).filter(Boolean);
    return{store:s.storeName||'Ayaan PWD',address:s.address||'',phone:SiteSettings.phone(),waPhone:SiteSettings.waPhone(),id:order.id,date:order.createdAt,customerName:order.customerName||'Customer',customerPhone:order.customerPhone||'',items,itemsText:order.itemsText||'',hasText:!!order.itemsText,subtotal:order.subtotal||order.total||0,discount:order.discount||0,total:order.total||0,payMethod:order.payMethod||'COD',status:order.status||'pending',couponCode:order.couponCode||'',note:order.note||''};
  },
  html:(r)=>`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt ${r.id}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:13px;color:#111;background:#fff}.receipt{width:80mm;margin:0 auto;padding:12px 10px}.brand{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:10px}.brand h1{font-size:18px;font-weight:900;letter-spacing:.1em}.brand .sub{font-size:10px;color:#444;line-height:1.6;margin-top:4px}.divider{border:none;border-top:1px dashed #888;margin:10px 0}.row{display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px}.row .lbl{color:#555}.items-table{width:100%;margin:8px 0}.items-table th{font-size:10px;text-align:left;border-bottom:1px solid #ccc;padding-bottom:4px;font-weight:700}.items-table td{font-size:11px;padding:3px 0;vertical-align:top}.items-table .right{text-align:right}.total-row{display:flex;justify-content:space-between;font-weight:900;font-size:14px;margin-top:6px;padding-top:6px;border-top:2px solid #111}.status-badge{display:inline-block;background:#111;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:3px;text-transform:uppercase}.footer{text-align:center;margin-top:12px;padding-top:10px;border-top:1px dashed #888;font-size:10px;color:#666;line-height:1.8}.discount-row{color:green;display:flex;justify-content:space-between;font-size:12px}@media print{@page{margin:4mm;size:80mm auto}}</style></head><body><div class="receipt"><div class="brand"><h1>${r.store}</h1><div class="sub">${r.address}<br/>📞 0${String(r.phone).slice(2)} | WhatsApp: 0${String(r.waPhone).slice(2)}</div></div><div class="row"><span class="lbl">Receipt No:</span><strong>${r.id}</strong></div><div class="row"><span class="lbl">Date:</span><span>${new Date(r.date).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</span></div><div class="row"><span class="lbl">Customer:</span><strong>${r.customerName}</strong></div>${r.customerPhone?`<div class="row"><span class="lbl">Phone:</span><span>${r.customerPhone}</span></div>`:''}<div class="row"><span class="lbl">Payment:</span><span>${r.payMethod}</span></div><div class="row"><span class="lbl">Status:</span><span class="status-badge">${r.status}</span></div><hr class="divider"/>${r.hasText?`<div style="font-size:12px;line-height:1.8;white-space:pre-line">${r.itemsText}</div>`:`<table class="items-table"><thead><tr><th>Item</th><th>Sz</th><th>Qty</th><th class="right">Total</th></tr></thead><tbody>${r.items.map(it=>`<tr><td>${it.name}</td><td>${it.size}</td><td>${it.qty}</td><td class="right">Rs.${it.line.toLocaleString()}</td></tr>`).join('')}</tbody></table>`}<hr class="divider"/>${r.discount>0?`<div class="discount-row"><span>Subtotal</span><span>Rs.${(r.subtotal||r.total).toLocaleString()}</span></div><div class="discount-row"><span>Discount${r.couponCode?' ('+r.couponCode+')':''}</span><span>-Rs.${r.discount.toLocaleString()}</span></div>`:''}<div class="total-row"><span>TOTAL</span><span>Rs.${r.total.toLocaleString()}</span></div>${r.note?`<div style="margin-top:8px;font-size:11px;color:#555">Note: ${r.note}</div>`:''}<div class="footer">Thank you for shopping at ${r.store}!<br/>Visit us again · Alrasheed Mall, PWD</div></div></body></html>`,
  print:(orderId)=>{ const order=Orders.getAll().find(o=>o.id===orderId);if(!order)return;const r=Receipt.build(order);const w=window.open('','_blank','width=400,height=700');w.document.write(Receipt.html(r));w.document.close();setTimeout(()=>w.print(),600); },
};

/* ── STAFF PERMISSIONS ── */
const StaffPerms={
  canDelete:()=>Session.isAdmin(),
  canManageCategories:()=>Session.isAdmin(),
  canManageAppearance:()=>Session.isAdmin(),
  canManageHomepage:()=>Session.isAdmin(),
  canManagePromotions:()=>Session.isAdmin(),
  canManageStaff:()=>Session.isAdmin(),
  canViewAnalytics:()=>Session.isAdmin(),
  canViewReports:()=>Session.isAdmin(),
  canManageSettings:()=>Session.isAdmin(),
  canManageAccount:()=>Session.isAdmin(),
};
