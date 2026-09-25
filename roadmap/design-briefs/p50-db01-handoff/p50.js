/* P50-DB01 shared content + chrome. Same copy/facts for every direction; each dir-*.css skins it. */
(function(){
var root=document.documentElement,Q=new URLSearchParams(location.search),D=root.dataset.dir;
var cfg=window.P50CFG||{};
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches||Q.get('static')==='1';
if(Q.get('embed')==='1')root.classList.add('embed');
if(Q.get('static')==='1')root.classList.add('static');
var st={view:Q.get('view')||'home',signed:Q.get('signed')==='1'};
var AUTH='../auth/Login &amp; Register.html';

var I={check:'<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
arrow:'<path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
plus:'<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
search:'<path d="M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
tag:'<path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/>',
card:'<rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="11" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.8 16c.5-1.5 1.7-2.3 3.2-2.3s2.7.8 3.2 2.3M14.5 10h3.5M14.5 13.5h3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
clock:'<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v4l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
file:'<path d="M6 3.5h8l4.5 4.5v12H5.5V3.5zM14 3.5V8h4.5M9 13h6M9 16.5h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>',
code:'<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
key:'<circle cx="8" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
lock:'<rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10.5V7.5a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="1.7"/>',
shield:'<path d="M12 3l8 3.5v5.3c0 4.4-3.2 7.6-8 9.2-4.8-1.6-8-4.8-8-9.2V6.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 8l8 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
export:'<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
sync:'<path d="M4 9a8 8 0 0114-3l2 2M20 15a8 8 0 01-14 3l-2-2M20 4v4h-4M4 20v-4h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
menu:'<path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
x:'<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'};
function ic(n,s){s=s||18;return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" aria-hidden="true">'+I[n]+'</svg>'}
window.P50ic=ic;
var TK=ic('check',16),YES='<svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-label="Yes">'+I.check+'</svg>',NO='<span class="no" aria-label="No">—</span>';

function lab(n,t,slug){
var N=n?'<span class="lab__n">'+n+'</span>':'';
if(D==='c')return '<p class="lab">'+N+'<span>'+(slug||t.toLowerCase())+'</span></p>';
if(D==='a')return '<p class="lab">'+N+'<span>'+t+'</span></p>';
return '<p class="lab"><span>'+t+'</span></p>'}
function shead(n,t,slug,h,lede,c){return '<div class="shead'+(c?' shead--c':'')+'">'+lab(n,t,slug)+'<h2 class="h2">'+h+'</h2>'+(lede?'<p class="lede">'+lede+'</p>':'')+'</div>'}
function win(bar,body,cls){return '<div class="win'+(cls?' '+cls:'')+'" aria-hidden="true">'+(bar?'<div class="win__bar"><i></i><i></i><i></i><span>'+bar+'</span></div>':'')+'<div class="win__body">'+body+'</div></div>'}
function go(v,t,c){return '<a href="?view='+v+'" data-go="'+v+'"'+(c?' class="'+c+'"':'')+'>'+t+'</a>'}

/* ---------- chrome ---------- */
function header(){
var links=go('home#features','Features')+go('security','Security')+go('pricing','Pricing')+'<a href="#">Changelog</a>';
var act=st.signed?'<a class="me" href="#"><span>Lina Mahmoud</span><span class="av av4">LM</span></a><a class="btn btn--pri btn--sm" href="#">Open Kontax</a>'
:'<a class="lnk" href="'+AUTH+'">Log in</a><a class="btn btn--pri btn--sm" href="'+AUTH+'">Get started free</a>';
var mact=st.signed?'<a class="btn btn--pri" href="#">Open Kontax</a><p class="mnav__who">Signed in as Lina Mahmoud</p>'
:'<a class="btn btn--pri" href="'+AUTH+'">Get started free</a><a class="btn btn--sec" href="'+AUTH+'">Log in</a>';
return '<header class="nav"><div class="nav__in">'+go('home','<span class="brand__k" aria-hidden="true">K</span><span class="brand__w">Kontax</span>','brand').replace('<a ','<a aria-label="Kontax home" ')
+'<nav class="nav__links" aria-label="Primary">'+links+'</nav><div class="nav__act">'+act+'</div>'
+'<button class="nav__menu" type="button" aria-expanded="false" aria-controls="mnav" aria-label="Menu">'+ic('menu',20)+'</button></div>'
+'<div class="mnav" id="mnav" hidden><nav aria-label="Mobile">'+links+'</nav><div class="mnav__act">'+mact+'</div></div></header>'}
function footer(){
function col(h,a){return '<div class="foot__col"><span class="foot__h">'+h+'</span>'+a+'</div>'}
return '<footer class="foot"><div class="foot__in"><div>'+go('home','<span class="brand__k" aria-hidden="true">K</span><span class="brand__w">Kontax</span>','brand')+'<p class="foot__tag">One address book for your phone, your laptop and the people you share with. Kept tidy, kept private, kept yours.</p></div><div class="foot__cols">'
+col('Product',go('home#features','Features')+go('pricing','Pricing')+go('security','Security')+'<a href="#">Changelog</a>')
+col('Company','<a href="#">About</a><a href="#">Contact</a>')
+col('Resources','<a href="#">Help centre</a><a href="#">Developers</a>')
+col('Legal','<a href="../Privacy.html">Privacy</a><a href="../Terms.html">Terms</a>')
+'</div></div><div class="foot__base"><span>© 2026 Kontax</span><span>Export or delete your data any time, from Settings.</span></div></footer>'}

/* ---------- home (after hero) ---------- */
var mSources=win('','<p class="vl">Add a source</p><div class="srcg"><div class="src src--on"><span class="glyph">G</span>Google</div><div class="src"><span class="glyph">iC</span>iCloud</div><div class="src"><span class="glyph">F</span>Fastmail</div><div class="src"><span class="glyph">'+ic('file',14)+'</span>CSV / vCard</div></div>');
var mMergeS=win('','<p class="nm" style="display:flex;gap:8px;align-items:center">'+ic('sync',15)+'2 contacts look like the same person</p><div class="row" style="padding:12px 0"><span class="stack" style="margin:0"><span class="av av5">BN</span><span class="av av5">BN</span></span><div class="row__m"><div class="nm">Ben Nakamura</div><div class="sb">Same phone · similar email</div></div></div><div style="display:flex;gap:8px"><span class="vbtn vbtn--s">Review merge</span><span class="vbtn">Not the same</span></div>');
var mIos=win('','<div class="ios"><div class="ios__h">Accounts</div><div class="ios__l"><div class="ios__r"><span class="k">K</span>Kontax<em>Contacts</em></div><div class="ios__r"><span class="k" style="background:#e5e5ea;color:#555">iC</span>iCloud<em>Off</em></div></div></div><span class="chip" style="margin-top:10px"><i></i>iPhone synced · 2 min ago</span>');
function okr(g,n,s,t){return '<div class="row"><span class="glyph">'+g+'</span><div class="row__m"><div class="nm">'+n+'</div><div class="sb">'+s+'</div></div><span class="ok">'+ic('check',13)+t+'</span></div>'}
var mSync=win('Settings · Sync','<p class="vl">Connections</p>'+okr('G','Google Contacts','lina@gmail.com','4 min ago')+okr('iC','iCloud','lina@icloud.com','4 min ago')+okr('F','Fastmail','lina@fastmail.com','4 min ago')+okr(ic('card',15),'Lina’s iPhone','CardDAV · app password','just now'));
function mf(on,k,v){return '<div class="mg__f"><span class="radio'+(on?' radio--on':'')+'"></span><div><div class="k">'+k+'</div><div class="v">'+v+'</div></div></div>'}
var mMerge=win('Review merge','<div class="mg"><div class="mg__c"><div class="mg__h"><span class="av av--s av5">BN</span><span class="nm">Ben Nakamura</span></div>'+mf(1,'Phone','+44 7700 900123')+mf(0,'Email','ben@acme.co')+mf(1,'Company','Acme Ltd')+'</div><div class="mg__c"><div class="mg__h"><span class="av av--s av5">BN</span><span class="nm">Ben N.</span></div>'+mf(0,'Phone','07700900123')+mf(1,'Email','ben.nakamura@acme.co')+mf(0,'Company','—')+'</div></div><div class="mg__foot"><span class="sb">From Google and iCloud · undo for 30 days</span><span class="vbtn vbtn--s">Merge</span></div>');
function mem(a,c,n,s,r){return '<div class="row"><span class="av '+c+'">'+a+'</span><div class="row__m"><div class="nm">'+n+'</div><div class="sb">'+s+'</div></div><span class="role'+(r?' role--e':'')+'">'+(r?'Can edit':'Can view')+'</span></div>'}
var mBook=win('Books · Family','<div class="row" style="padding-bottom:12px"><span class="glyph" style="background:var(--tint);color:var(--brand);border-color:transparent">F</span><div class="row__m"><div class="nm">Family</div><div class="sb">86 contacts · 4 members</div></div><span class="stack"><span class="av av--s av4">LM</span><span class="av av--s av1">JM</span><span class="av av--s av2">SM</span><span class="av av--s av3">RM</span></span></div>'+mem('LM','av4','Lina M. (you)','Owner',1)+mem('JM','av1','James M.','Joined 12 Aug',1)+mem('RM','av3','Rosa M.','Joined 3 Sep',0));
function frow(f,k,t,b,l,m,id){return '<div class="frow'+(f?' frow--f':'')+'"'+(id?' id="'+id+'"':'')+'><div class="frow__t0"><p class="frow__k">'+k+'</p><h3 class="frow__t">'+t+'</h3><p class="frow__b">'+b+'</p><ul class="ticks">'+l.map(function(x){return '<li>'+TK+x+'</li>'}).join('')+'</ul></div><div class="frow__m">'+m+'</div></div>'}
function si(i,t,p){return '<div class="sitem">'+ic(i,20)+'<h3>'+t+'</h3><p>'+p+'</p></div>'}
function step(n,t,b,m){return '<li class="step"><div><p class="step__n">'+(D==='c'?'0'+n:D==='b'?'No. '+n:n)+'</p><h3 class="step__t">'+t+'</h3><p class="step__b">'+b+'</p></div>'+m+'</li>'}
var FAQ=[['Do I need to install an app?','No. On iPhone and Mac, Kontax appears inside the Contacts app you already use, over CardDAV. Everywhere else, use Kontax in your browser.'],
['Does it work with iPhone?','Yes. Add Kontax as a CardDAV account in Settings with an app password. Changes made on your iPhone sync back to Kontax, and the other way round.'],
['Is Kontax free?','The Free plan holds up to 500 contacts with one sync source and one phone or Mac. No card needed. Pro removes the contact limit and adds up to five sync sources, five devices and the API. <a href="?view=pricing" data-go="pricing">Compare plans</a>.'],
['What happens to my contacts if I leave?','Export everything at any time as vCard, CSV or the documented Kontax format, then delete your account from Settings. Deletion completes after a 30-day grace period.'],
['Can I share contacts with my family?','Yes. The Family plan gives up to six people a shared address book. Each member can edit or view, and it syncs to everyone’s devices.']];
function faq(list){return '<div class="faq">'+list.map(function(q,i){return '<details'+(i===0?' open':'')+'><summary>'+q[0]+ic('plus',20)+'</summary><div class="faq__a">'+q[1]+'</div></details>'}).join('')+'</div>'}
function cta(){return '<section class="cta'+(D==='c'?' band--alt':'')+'" data-screen-label="CTA"><div class="wrap"><h2>'+(cfg.ctaTitle||'Start with the contacts you already have.')+'</h2><p>Free for up to 500 contacts. No card needed.</p><div class="cta__b"><a class="btn btn--pri" href="'+AUTH+'">Get started free</a>'+go('pricing','Compare plans','btn btn--sec')+'</div></div></section>'}
function plan(n,fr,pr,li,hl,btn){return '<div class="plan'+(hl?' plan--hl':'')+'"><div class="plan__top"><span class="plan__n">'+n+'</span>'+(hl?'<span class="tag">Most flexible</span>':'')+'</div><p class="plan__for">'+fr+'</p><div class="plan__pr">'+pr+'</div><ul>'+li.map(function(x){return '<li>'+TK+'<span>'+x+'</span></li>'}).join('')+'</ul>'+(btn||'')+'</div>'}
var FREE_L=['Up to 500 contacts','1 sync source','1 phone or Mac over CardDAV','CSV export'],PRO_L=['Unlimited contacts','Up to 5 sync sources','5 devices','Developer API','vCard and Kontax export'];

function home(){
return '<section class="works" aria-label="Works with"><div class="wrap"><p class="works__in"><b>Works with</b><span>Apple Contacts</span><span>Google Contacts</span><span>iCloud</span><span>Fastmail</span><span>any CardDAV server</span></p></div></section>'
+'<section class="band band--alt" id="how" data-screen-label="How it works"><div class="wrap">'+shead('01','How it works','how-it-works','From three address books to one, in an afternoon',0,D!=='a')
+'<ol class="steps">'+step(1,'Bring your contacts in','Connect Google, iCloud or Fastmail, or import a CSV or vCard file.',mSources)+step(2,'Kontax tidies them up','Duplicates found and merged, phone numbers formatted for their country, names sorted properly in any script.',mMergeS)+step(3,'They stay in sync everywhere','Add Kontax to the Contacts app on your iPhone or Mac with an app password. Changes flow both ways.',mIos)+'</ol></div></section>'
+'<section class="band" id="features" data-screen-label="Features"><div class="wrap">'+shead('02','Why people switch','why-switch','The things your built-in address book never quite did',0,D!=='a')
+frow(0,'Sync','One address book, on every device','Kontax keeps Google, iCloud and Fastmail in step with each other, and shows up natively in Contacts on iPhone and Mac. Edit anywhere; it’s everywhere a moment later.',['Two-way sync, not a one-off import','No app to install on iPhone or Mac'],mSync)
+frow(1,'Clean-up','Duplicates, found and fixed','Kontax spots the same person saved twice across your accounts, shows both records side by side, and lets you pick what to keep. Every merge can be undone for 30 days.',['Phone numbers formatted for their country','Names in any script sorted correctly'],mMerge)
+frow(0,'Sharing','Share a book with family or your team','Keep the plumber, the school and the grandparents in one shared book. Everyone sees the same numbers, and you decide who can edit.',['Edit or view-only roles for each member','Shared books sync to everyone’s phones'],mBook)
+'<div class="sgrid">'+si('search','Search','Find anyone by name, email, phone or company as you type.')+si('tag','Labels','Group contacts your way and filter in one tap.')+si('card','Public card','A shareable page with the details you choose to publish.')+si('clock','Change history','See what changed on each contact, when, and from where.')+si('file','Open export format','A documented format that keeps labels, notes and history.')+si('code','Developer API','Read and write your contacts from your own tools. Pro and Teams.')+'</div></div></section>'
+'<section class="band band--alt" id="compare" data-screen-label="Why Kontax"><div class="wrap">'+shead('03','Why Kontax','vs-built-in','Why not just use iCloud or Google Contacts?','They’re fine inside one company’s world. Kontax is for when your contacts live in more than one.',1)
+'<div class="cmpw"><table class="cmp"><caption class="sr-only">Kontax compared with Google Contacts and iCloud Contacts</caption><thead><tr><th scope="col"><span class="sr-only">Feature</span></th><th scope="col" class="us">Kontax</th><th scope="col">Google</th><th scope="col">iCloud</th></tr></thead><tbody>'
+'<tr><th scope="row">Keeps Google, iCloud and Fastmail in step</th><td class="us">'+YES+'</td><td>'+NO+'</td><td>'+NO+'</td></tr>'
+'<tr><th scope="row">Shared books for a family or team, with roles</th><td class="us">'+YES+'</td><td class="pt">Workspace only</td><td>'+NO+'</td></tr>'
+'<tr><th scope="row">Finds and merges duplicates</th><td class="us">'+YES+'</td><td>'+YES+'</td><td class="pt">Mac only</td></tr>'
+'<tr><th scope="row">Change history for each contact</th><td class="us">'+YES+'</td><td>'+NO+'</td><td>'+NO+'</td></tr>'
+'<tr><th scope="row">Export with labels, notes and history in a documented format</th><td class="us">'+YES+'</td><td>'+NO+'</td><td>'+NO+'</td></tr>'
+'</tbody></table><p class="note">Judged against each product’s own help pages in September 2026, on their free consumer tiers.</p></div></div></section>'
+'<section class="band" id="privacy" data-screen-label="Privacy"><div class="wrap priv"><div class="shead">'+lab('04','Privacy & security','privacy')+'<h2 class="h2">Your contacts are other people’s details. We treat them that way.</h2><p class="lede">Kontax is paid for by subscriptions, not advertising. Here’s what that means in practice.</p>'+go('security','How we keep your data safe'+ic('arrow',16),'more')+'</div>'
+'<div class="facts">'+[['key','Two-factor sign-in, and a separate app password for each device','Lose a phone? Revoke its password without touching anything else.'],['lock','Sync credentials encrypted at rest','Tokens for Google, iCloud and Fastmail are stored with AES-256-GCM.'],['shield','No ads, no tracking','Your contacts are never sold, rented or used to profile you.'],['export','Export everything, or delete your account, any time','It’s in Settings. Deletion completes after a 30-day grace period.']].map(function(f){return '<div class="fact">'+ic(f[0],22)+'<h3>'+f[1]+'</h3><p>'+f[2]+'</p></div>'}).join('')+'</div></div></section>'
+'<section class="band band--alt" data-screen-label="Who it’s for"><div class="wrap">'+shead('05','Who it’s for','who-its-for','One address book, however many people use it',0,1)
+'<div class="who">'+[['Free · Pro','Just you','Every account you’ve ever saved a number in, finally agreeing with each other.','sync, clean-up and change history on all your devices.','See Free and Pro'],['Family','Your family','The dentist, the school, the neighbours with the spare key. Kept in one place everyone can reach.','a shared book for up to six people.','See Family'],['Teams','Your team','Clients and suppliers that stay with the business when people move on.','shared books with roles, an audit log and the API, for up to 25 people.','See Teams']].map(function(w){return '<a class="who__c" href="?view=pricing" data-go="pricing"><span class="who__p">'+w[0]+'</span><h3>'+w[1]+'</h3><p>'+w[2]+'</p><p class="who__g"><b>You get</b> '+w[3]+'</p><span class="more">'+w[4]+ic('arrow',16)+'</span></a>'}).join('')+'</div></div></section>'
+'<section class="band" id="pricing-teaser" data-screen-label="Pricing teaser"><div class="wrap">'+shead('06','Pricing','pricing','Free until you need more',0,1)
+'<div class="plans plans--2">'+plan('Free','For one person getting organised.','<b>£0</b>',FREE_L)+plan('Pro','For you, across every account.','<span class="slot">stripe: pro.monthly</span>',PRO_L,1)+'</div><div class="plans-foot">'+go('pricing','Compare all plans'+ic('arrow',16),'more')+'</div></div></section>'
+'<section class="band band--alt" id="faq" data-screen-label="FAQ"><div class="wrap">'+shead('07','Questions','faq','Questions, answered',0,1)+faq(FAQ)+'</div></section>'+cta()}

/* ---------- pricing page ---------- */
function pricing(){
function r(h,v,hl){return '<tr><th scope="row">'+h+'</th>'+v.map(function(x,i){return '<td'+(i===1?' class="hl"':'')+'>'+(x===1?YES:x===0?NO:x)+'</td>'}).join('')+'</tr>'}
function g(t){return '<tr class="grp"><th colspan="5" scope="colgroup">'+t+'</th></tr>'}
var sl='<span class="slot">billing.ts</span>';
return '<section class="phead" data-screen-label="Pricing head"><div class="wrap">'+lab('','Pricing','pricing')+'<h1>Free until you need more</h1><p class="lede">Four plans, priced in pounds, with nothing hidden. Every plan includes two-factor sign-in and export any time.</p><div class="tog" role="group" aria-label="Billing period"><button type="button" aria-pressed="true" data-per="monthly">Monthly</button><button type="button" aria-pressed="false" data-per="annual">Annual</button></div></div></section>'
+'<section class="band" style="padding-top:48px" data-screen-label="Plans"><div class="wrap"><div class="plans plans--4" style="margin-top:0">'
+plan('Free','For one person getting organised.','<b>£0</b>',FREE_L,0,'<a class="btn btn--sec" href="'+AUTH+'">Get started free</a>')
+plan('Pro','For you, across every account.','<span class="slot" data-slot="pro">stripe: pro.monthly</span>',PRO_L,1,'<a class="btn btn--pri" href="'+AUTH+'">Start with Pro</a>')
+plan('Family','For a household that shares numbers.','<span class="slot" data-slot="family">stripe: family.monthly</span>',['A shared family book','Up to 6 members','Edit or view roles','No developer API'],0,'<a class="btn btn--sec" href="'+AUTH+'">Start with Family</a>')
+plan('Teams','For a business that keeps its contacts.','<span class="slot" data-slot="teams">stripe: teams.monthly</span>',['Shared books','Up to 25 members','Audit log','Developer API'],0,'<a class="btn btn--sec" href="'+AUTH+'">Start with Teams</a>')
+'</div>'
+'<div class="mx"><div class="shead">'+lab('','Compare plans','compare')+'<h2 class="h2">Every limit, in one table</h2><p class="lede">Values marked <span class="slot">billing.ts</span> are read from the plan catalogue at build time.</p></div>'
+'<div class="mxw"><table class="mxt"><caption class="sr-only">Plan comparison</caption><thead><tr><th scope="col">Plan</th><th scope="col">Free</th><th scope="col" class="hl">Pro</th><th scope="col">Family</th><th scope="col">Teams</th></tr></thead><tbody>'
+g('Contacts and sync')+r('Contacts',['Up to 500','Unlimited',sl,sl])+r('Sync sources (Google, iCloud, Fastmail, CardDAV)',['1','Up to 5',sl,sl])+r('Phones and Macs over CardDAV',['1','5',sl,sl])
+g('Sharing')+r('Shared books',[0,0,'1 family book',1])+r('Members',['1','1','Up to 6','Up to 25'])+r('Audit log',[0,0,0,1])
+g('Data and developers')+r('Export',['CSV','vCard, Kontax','vCard, Kontax','vCard, Kontax'])+r('Developer API',[0,1,0,1])+r('Two-factor sign-in',[1,1,1,1])
+'</tbody></table></div></div>'
+'<div class="mx"><div class="shead shead--c">'+lab('','Billing questions','billing-faq')+'<h2 class="h2">Before you choose</h2></div>'+faq([['What counts as a sync source?','Each connected Google, iCloud or Fastmail account, or any other CardDAV server, is one source. Phones and Macs that read your book over CardDAV are counted separately, as devices.'],['Do I need a card for Free?','No. Free has no time limit and needs no card.'],['What if I want to leave?','Export everything as vCard, CSV or the documented Kontax format, then delete your account in Settings. Deletion completes after a 30-day grace period.']])+'</div></div></section>'+cta()}

/* ---------- security (content page) ---------- */
function security(){
var mPw=win('Settings · App passwords','<p class="vl">Devices</p>'+[['Lina’s iPhone','Created 2 Sep · used just now'],['MacBook Air','Created 2 Sep · used 1 h ago'],['Old iPad','Created 14 Mar · used 5 months ago']].map(function(d){return '<div class="row"><span class="glyph">'+ic('key',15)+'</span><div class="row__m"><div class="nm">'+d[0]+'</div><div class="sb">'+d[1]+'</div></div><span class="vbtn">Revoke</span></div>'}).join(''));
var mEx=win('Settings · Export','<p class="vl">Export everything</p>'+[['vCard (.vcf)','For any contacts app'],['CSV','For spreadsheets'],['Kontax format','Keeps labels, notes and history · documented']].map(function(d,i){return '<div class="row"><span class="radio'+(i===2?' radio--on':'')+'"></span><div class="row__m"><div class="nm">'+d[0]+'</div><div class="sb">'+d[1]+'</div></div></div>'}).join('')+'<div style="margin-top:12px"><span class="vbtn vbtn--s">Download export</span></div>');
var mHist=win('Ben Nakamura · History','<p class="vl">Change history</p>'+[['Phone changed','From Lina’s iPhone · today 09:12'],['Merged with “Ben N.”','Undo available until 25 Oct'],['Imported','From Google · 2 Sep']].map(function(d){return '<div class="row"><span class="glyph">'+ic('clock',15)+'</span><div class="row__m"><div class="nm">'+d[0]+'</div><div class="sb">'+d[1]+'</div></div></div>'}).join(''));
function b(id,h,p,li,m){return '<div class="secb'+(m?'':' secb--solo')+'" id="'+id+'"><div><h2>'+h+'</h2>'+p.map(function(x){return '<p>'+x+'</p>'}).join('')+(li?'<ul class="ticks">'+li.map(function(x){return '<li>'+TK+x+'</li>'}).join('')+'</ul>':'')+'</div>'+(m||'')+'</div>'}
return '<section class="sech" data-screen-label="Security head"><div class="wrap">'+lab('','Security','security')+'<h1>Safe to hand your contacts to</h1><p class="lede">An address book is mostly other people’s details. This page lists what Kontax does to protect them. Each point describes something that ships today.</p></div></section>'
+'<div class="wrap seclay"><nav class="toc" aria-label="On this page"><b>On this page</b><a href="#s-sign">Signing in</a><a href="#s-enc">Encryption</a><a href="#s-ads">No ads, no tracking</a><a href="#s-own">Your data, your call</a><a href="#s-open">Open standards</a></nav><div>'
+b('s-sign','Signing in',['Turn on two-factor sign-in and every new login needs a code from your authenticator app as well as your password.','Phones and Macs connect with their own app password rather than your main one. Each password is listed in Settings with when it was last used, so a lost device can be cut off on its own.'],['Two-factor sign-in on every plan','One app password per device, revocable any time'],mPw)
+b('s-enc','Encryption',['When you connect Google, iCloud or Fastmail, Kontax stores the access tokens it needs to sync. Those credentials are encrypted at rest with AES-256-GCM.','Every connection between your devices and Kontax uses HTTPS.'],0,0)
+b('s-ads','No ads, no tracking',['Kontax is paid for by subscriptions. There is no advertising, no tracking pixels, and your contacts are never sold, rented or used to profile you or the people in your book.'],0,0)
+b('s-own','Your data, your call',['Every change is recorded in the contact’s history: what changed, when, and from which device or source. Merges can be undone for 30 days.','Export everything at any time. When you delete your account, deletion completes after a 30-day grace period, in case you change your mind.'],['vCard, CSV or the documented Kontax format','Delete from Settings, no request form'],mEx+'<div style="height:16px"></div>'+mHist)
+b('s-open','Open standards',['Kontax speaks CardDAV and vCard, the same standards Apple Contacts and most address books use. That is why there’s no app to install, and why you can always take your contacts somewhere else.'],0,0)
+'</div></div>'+cta()}

/* ---------- sampler ---------- */
function sampler(){
var tk=(cfg.tokens||[]).map(function(t){var v=getComputedStyle(root).getPropertyValue(t[0]).trim();return '<div class="sw__i"><i style="background:var('+t[0]+')"></i><b>'+t[1]+'</b><code>'+t[0]+'<br>'+v+'</code></div>'}).join('');
var ts=(cfg.type||[]).map(function(t){return '<div class="ts__r"><code>'+t[0]+'</code><div style="font:var('+t[1]+');letter-spacing:'+(t[2]||'normal')+';color:var(--head)">'+t[3]+'</div></div>'}).join('');
return '<section class="smp" data-screen-label="Sampler"><div class="wrap">'+lab('','Component sampler','sampler')+'<h1 style="margin-top:14px">'+(cfg.name||'')+' · components</h1>'
+'<div class="smp__g"><div class="smp__c smp__c--w"><p class="smp__t">Type scale</p><div class="ts">'+ts+'</div></div>'
+'<div class="smp__c smp__c--w"><p class="smp__t">Colour tokens</p><div class="sw">'+tk+'</div></div>'
+'<div class="smp__c"><p class="smp__t">Buttons &amp; links</p><div class="smp__row"><a class="btn btn--pri" href="#">Get started free</a><a class="btn btn--sec" href="#">Compare plans</a><a class="btn btn--pri btn--sm" href="#">Small</a></div><div class="smp__row" style="margin-top:20px"><a class="more" href="#">Text link'+ic('arrow',16)+'</a><a href="#" style="text-decoration:underline;text-underline-offset:2px">Inline link</a></div></div>'
+'<div class="smp__c"><p class="smp__t">Section header &amp; badges</p>'+lab('02','Why people switch','why-switch')+'<h2 class="h2" style="font:var(--h3)">The things your address book never did</h2><div class="smp__row" style="margin-top:18px"><span class="tag">Most flexible</span><span class="tag tag--soon">Coming soon</span><span class="chip"><i></i>Synced · just now</span><span class="role role--e">Can edit</span></div></div>'
+'<div class="smp__c"><p class="smp__t">Card</p><div class="who__c" style="padding:24px"><span class="who__p">Family</span><h3>Your family</h3><p>The dentist, the school, the neighbours with the spare key.</p><span class="more">See Family'+ic('arrow',16)+'</span></div></div>'
+'<div class="smp__c"><p class="smp__t">Product window frame</p>'+mSync+'</div>'
+'<div class="smp__c"><p class="smp__t">Form field (/contact)</p><div style="display:grid;gap:18px"><div class="fld"><label for="f1">Your email</label><input id="f1" type="email" placeholder="you@example.com"><small>We reply within two working days.</small></div><div class="fld fld--err"><label for="f2">Message</label><input id="f2" value=""><small>Please write a message.</small></div></div></div>'
+'<div class="smp__c"><p class="smp__t">Table</p><div class="mxw" style="margin:0"><table class="mxt" style="min-width:0"><thead><tr><th scope="col">Plan</th><th scope="col">Free</th><th scope="col" class="hl">Pro</th></tr></thead><tbody><tr><th scope="row">Contacts</th><td>500</td><td class="hl">Unlimited</td></tr><tr><th scope="row">API</th><td>'+NO+'</td><td class="hl">'+YES+'</td></tr></tbody></table></div></div>'
+(cfg.motif?'<div class="smp__c smp__c--w"><p class="smp__t">Motif &amp; illustration</p>'+(typeof cfg.motif==='function'?cfg.motif():cfg.motif)+'</div>':'')
+'</div></div></section>'}

/* ---------- mount ---------- */
function $(s){return document.querySelector(s)}
function paintHeader(){$('#hdr').innerHTML=header();wire($('#hdr'))}
$('#ftr').innerHTML=footer();
$('#homeRest').innerHTML=home();
$('#vPricing').innerHTML=pricing();
$('#vSecurity').innerHTML=security();
paintHeader();
function wire(el){
el.querySelectorAll('[data-go]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var p=a.dataset.go.split('#');show(p[0],p[1])})});
var mb=el.querySelector('.nav__menu');if(mb)mb.addEventListener('click',function(){var m=$('#mnav'),o=m.hidden;m.hidden=!o;mb.setAttribute('aria-expanded',o);mb.innerHTML=ic(o?'x':'menu',20)})}
['#ftr','#homeRest','#vPricing','#vSecurity'].forEach(function(s){wire($(s))});
document.querySelectorAll('.tog button').forEach(function(b){b.addEventListener('click',function(){var p=b.dataset.per;document.querySelectorAll('.tog button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});document.querySelectorAll('[data-slot]').forEach(function(s){s.textContent='stripe: '+s.dataset.slot+'.'+p})})});
function show(v,hash){
if(v==='sampler'&&!$('#vSampler').innerHTML)$('#vSampler').innerHTML=sampler();
st.view=v;document.querySelectorAll('[data-view]').forEach(function(s){s.hidden=s.dataset.view!==v});
document.querySelectorAll('.nav__links a').forEach(function(a){a.toggleAttribute('aria-current',a.dataset.go===v);if(a.dataset.go===v)a.setAttribute('aria-current','page')});
var m=$('#mnav');if(m&&!m.hidden)$('.nav__menu').click();
var u=new URL(location);u.searchParams.set('view',v);history.replaceState(null,'',u);
var t=hash&&document.getElementById(hash);window.scrollTo(0,t?t.getBoundingClientRect().top+scrollY-68:0);
syncBar();if(v==='home'&&window.P50sig)window.P50sig()}
window.P50show=show;
/* review bar */
var bar=document.createElement('div');bar.className='rbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Prototype controls');
bar.innerHTML=[['home','Home'],['pricing','Pricing'],['security','Security'],['sampler','Sampler']].map(function(v){return '<button type="button" data-v="'+v[0]+'">'+v[1]+'</button>'}).join('')+'<span></span><button type="button" data-sig>Signed in</button><span></span>'+['a','b','c'].map(function(d){return '<a href="'+({a:'Direction A - Evolved Calm.html',b:'Direction B - Personal and Warm.html',c:'Direction C - Precise.html'})[d]+'"'+(d===D?' style="color:#fff;font-weight:600"':'')+'>'+d.toUpperCase()+'</a>'}).join('');
document.body.appendChild(bar);
bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.dataset.v)show(b.dataset.v);if(b.hasAttribute('data-sig')){st.signed=!st.signed;paintHeader();var u=new URL(location);st.signed?u.searchParams.set('signed','1'):u.searchParams.delete('signed');history.replaceState(null,'',u);syncBar()}});
function syncBar(){bar.querySelectorAll('[data-v]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.v===st.view)});bar.querySelector('[data-sig]').setAttribute('aria-pressed',st.signed)}
window.P50reduce=reduce;
show(st.view);
})();
