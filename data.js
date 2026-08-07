/* ============ TyNet world data ============
   D.BLOB       , the baked truth blob from the desktop extractor (real save facts)
   D.SEED       , week-zero world content generated for this career (regenerates via AI at sync)
   D.NEIGHBORHOODS, D.CARS, D.YACHTS, D.PLANES, offline catalogs (world data, never rides the blob)
   Rule: save facts are truth; everything else is authored world fiction keyed to those facts. */
window.D = {};

/* ---------- THE TRUTH BLOB (extracted from CAREER-ZADEY1-PSTEST, Aug 6 2026) ---------- */
D.BLOB = {"v":1,"game":"madden27","careerId":"tyzadey172026","clock":{"seasonYear":2026,"seasonIndex":0,"week":1,"weekType":"PreSeason","stage":"PreSeason"},
"player":{"first":"Ty","last":"Zadey","pos":"QB","teamIndex":17,"team":"Jets","teamShort":"NYJ","ovr":99,"age":20,"yearsPro":0,"jersey":0,"status":"PracticeSquad","isIR":false,"capSalary":760000,
"injury":{"status":"Uninjured","type":"","sev":""},"confidence":50,"fatigue":0,
"wear":{"Back":10,"LAnkle":10,"LArm":10,"LElbow":10,"LFoot":10,"LHand":10,"LHip":10,"LKnee":10,"LLeg":10,"LShoulder":10,"RAnkle":10,"RArm":10,"RElbow":10,"RFoot":10,"RHand":10,"RHip":10,"RKnee":10,"RLeg":10,"RShoulder":10,"Rib":10},
"contract":{"length":1,"currentYear":0,"salary":[1140000],"bonus":[0],"voidYears":0,"noTradeClause":false,"guaranteedMask":0,"distribution":"BackLoaded"}},
"schedule":[[0,"PreSeason",0,"Buccaneers",1,"Friday","1140",[28,39]],[1,"PreSeason",0,"Steelers",0,"Friday","1140",null],[2,"PreSeason",0,"Giants",1,"Friday","1170",null],
[0,"RegularSeason",0,"Titans",0,"Sunday","780",null],[1,"RegularSeason",0,"Packers",1,"Sunday","780",null],[2,"RegularSeason",0,"Lions",0,"Sunday","780",null],[3,"RegularSeason",0,"Bears",0,"Sunday","780",null],[4,"RegularSeason",0,"Browns",1,"Sunday","780",null],[5,"RegularSeason",0,"Patriots",0,"Sunday","780",null],[6,"RegularSeason",0,"Dolphins",1,"Sunday","780",null],[7,"RegularSeason",0,"Raiders",1,"Sunday","780",null],[8,"RegularSeason",0,"Chiefs",0,"Sunday","1245",null],[9,"RegularSeason",0,"Bills",1,"Sunday","780",null],[10,"RegularSeason",0,"Chargers",0,"Sunday","1245",null],[11,"RegularSeason",0,"Dolphins",0,"Sunday","780",null],[13,"RegularSeason",0,"Broncos",1,"Sunday","1020",null],[14,"RegularSeason",0,"Cardinals",0,"Sunday","1245",null],[15,"RegularSeason",0,"Patriots",1,"Sunday","780",null],[16,"RegularSeason",0,"Vikings",1,"Sunday","780",null],[17,"RegularSeason",0,"Bills",0,"Sunday","780",null]],
"seasonStats":[],
"roster":[["Ty","Zadey","QB",99,0,"PracticeSquad"],["Demario","Davis","MLB",90,56,"Signed"],["Minkah","Fitzpatrick","SS",89,29,"Signed"],["Breece","Hall","HB",87,20,"Signed"],["Garrett","Wilson","WR",86,5,"Signed"],["Armand","Membou","RT",83,70,"Signed"],["David","Bailey","RE",81,31,"Signed"],["Joe","Tippmann","RG",80,66,"Signed"],["T'Vondre","Sweat","DT",79,99,"Signed"],["Will","McDonald IV","LE",78,9,"Signed"],["Braelon","Allen","HB",77,12,"Signed"],["Sauce","Gardner","CB",77,1,"Signed"],["Jermaine","Johnson","ROLB",77,52,"Signed"],["Quinnen","Williams","DT",77,95,"Signed"],["Alijah","Vera-Tucker","LG",76,75,"Signed"],["Olu","Fashanu","LT",76,74,"Signed"],["Geno","Smith","QB",72,7,"Signed"],["Mason","Taylor","TE",72,85,"Signed"],["Josh","Reynolds","WR",71,18,"Signed"],["Cade","Klubnik","QB",67,10,"Signed"],["Bailey","Zappe","QB",64,11,"Signed"],["Brady","Cook","QB",63,4,"Signed"]]};

/* ---------- world cast (authored fiction, regenerates with the world) ---------- */
D.CAST = {
  agent:{name:"Dre Holloway", firm:"Apex Sports Group", phone:"(212) 555-0134"},
  mom:{name:"Mom", phone:"(330) 555-0198"},
  writer:{name:"Marcus Ellery", outlet:"United Chronicle"},
  podcast:{show:"The Walkthrough", hosts:["Rachel Otani","Dom Whitfield"]},
  banker:{name:"Meridian Private Client", phone:"(800) 555-0122"}
};

/* ---------- SEED WEEK CONTENT (Preseason Week 1 aftermath: Bucs 39, Jets 28) ---------- */
D.SEED = {
notifications:[
  {app:"messages", t:"Braelon Allen", p:"aight rook. number's yours. we'll discuss what it costs you at dinner 😤"},
  {app:"huddle", t:"h/jetsnation", p:"WHO IS THE QB WEARING ZERO, thread is at 1.4k upvotes"},
  {app:"tmail", t:"NFLPA", p:"Welcome to the National Football League Players Association"},
  {app:"meridian", t:"Meridian", p:"Camp stipend deposited: $1,750.00"}
],
texts:[
 {id:"braelon", name:"Braelon Allen", color:"#274a2f", msgs:[
   ["them","yo. coach said you been asking about my number"],
   ["me","man I wore 0 my whole life. HS, college. it's a whole thing. what would it take"],
   ["them","0 is a vibe I'm not gonna lie. I look good in it"],
   ["them","but I came in wearing 12 anyway. zero was a experiment"],
   ["me","so it's mine??"],
   ["them","easy rook. nothing in this building is free"],
   ["them","aight. number's yours. we'll discuss what it costs you at dinner 😤"],
 ]},
 {id:"qbroom", name:"QB Room", group:true, color:"#31404f", msgs:[
   ["them","Geno Smith|film at 7am tomorrow. bring the red zone install, all of it"],
   ["them","Cade Klubnik|bro who let the PS guy cook in the 4th quarter 😭 6 for 9??"],
   ["them","Bailey Zappe|scout team gonna be different this week I can feel it"],
   ["me","just trying to earn a hat on sundays 🙏"],
   ["them","Geno Smith|stay ready young. this league changes fast"],
 ]},
 {id:"agent", name:"Dre Holloway (Apex)", color:"#6b5b2a", msgs:[
   ["them","Ty. Dre. Saw the fourth quarter. So did two front offices, allegedly."],
   ["them","PS money is $6,222 a week before taxes. I need you boring with it until it isn't PS money. We clear?"],
   ["me","crystal"],
   ["them","Crestline wants a call when you're active-roster. Sit tight. Don't buy anything stupid."],
 ]},
 {id:"mom", name:"Mom", color:"#5a3a56", msgs:[
   ["them","I watched the whole game even the parts you weren't in 🥰"],
   ["them","Aunt Trish is asking if you can help with her transmission. I told her you're on the PRACTICE team and to leave you alone"],
   ["me","I can help. lemme check my account after rent stuff. love you"],
   ["them","Pay yourself first baby. That's what your grandfather said and he died with a paid-off house."],
 ]}
],
emails:[
 {id:"nflpa", from:"NFLPA Member Services", subj:"Welcome to the NFLPA, dues & benefits enrollment", time:"7:02 AM", unread:true,
  body:"Dear Mr. Zadey,\n\nWelcome to the National Football League Players Association. As a practice squad member you are a full NFLPA member.\n\nKey items for your first month:\n\n• Union dues of $117 are deducted from each game-week paycheck during the season.\n• Your 401(k) enrollment window is open. The league matches 2-for-1 after your first credited season.\n• Health coverage begins immediately and continues through the plan year.\n• Free financial counseling is available to every rookie. We recommend using it before your first major purchase, not after.\n\nYour player services rep will contact you before Week 1.\n\nIn solidarity,\nNFLPA Member Services"},
 {id:"apex1", from:"Dre Holloway, Apex Sports Group", subj:"Representation summary + how you actually get paid", time:"Yesterday", unread:true,
  body:"Ty,\n\nPutting this in writing like I do for every rookie.\n\nYOUR DEAL. You are on the New York practice squad. That pays $6,222 per week the roster exists (18 weeks), roughly $112,000 for the season. If the team elevates you for a game day you are paid an active-week rate for that week instead. If you are signed to the 53, your active contract kicks in at $1.14M rate, prorated weekly.\n\nMY CUT. Apex takes 3% of playing contract money only. Endorsements are negotiated separately.\n\nTHE PART EVERY ROOKIE SKIPS. Taxes will take roughly 40% of every check between federal, New Jersey, and city. The check that hits your account is NOT your money to spend, it is your money to allocate. Meridian will set up the tax hold account this week.\n\nDon't buy anything with a motor yet.\n\nDre"},
 {id:"merid1", from:"Meridian Private Client", subj:"Your accounts are live, camp stipend deposited", time:"Tuesday", unread:false,
  body:"Welcome to Meridian.\n\nYour Player Checking, Reserve Savings, and Tax Hold accounts are open. Today's deposit: training camp stipend, $1,750.00.\n\nAuto-Sweep is available but OFF by default: when enabled it moves a percentage of every deposit into Tax Hold and Reserve before you ever see it. Most first-year clients who end year one in good shape enabled it in August.\n\nYour dedicated line: (800) 555-0122.\n\n,  Meridian Private Client"},
 {id:"psrules", from:"Dre Holloway, Apex Sports Group", subj:"FWD: Practice squad elevation rules (read this)", time:"Tuesday", unread:false,
  body:"Forwarding from our ops desk. Short version:\n\n• Teams may elevate a practice squad player to the game-day roster up to 3 times per season.\n• After 3 elevations, keeping you on game days requires signing you to the active roster.\n• Any other club can sign you off our practice squad to THEIR active roster at any time. New York can protect 4 PS players per week.\n\nTranslation: play well enough and the phone rings, one way or the other.\n\nDre"}
],
article:{
 kick:"Florham Park Notebook", 
 head:"Bucs Expose a Thin Jets Roster, but the Fourth Quarter Belonged to a Ghost in No. 0",
 stand:"Tampa Bay left MetLife with a 39-28 preseason win nobody will remember. The eleven minutes that followed the third quarter are a different story.",
 by:"Marcus Ellery · United Chronicle Sports",
 paras:[
"EAST RUTHERFORD: For three quarters on Friday night, the first preseason game of the Aaron Glenn era went the way August football usually goes. The starters played two series and looked like men trying not to get hurt. The backups played the middle two quarters and looked like backups. Tampa Bay's second unit was sharper than New York's second unit, and by the time the fourth quarter arrived the scoreboard read 39-14 and the crowd had thinned to family members and the deeply committed.",
"Then the Jets sent out a quarterback the game notes listed as Ty Zadey, No. 0, and the night got interesting.",
"Zadey, 20, is the youngest player in the building and might be its best-kept secret. Undrafted out of nowhere in particular (the team bio is a masterpiece of vagueness), he was signed to the practice squad after a camp that coaches have gone out of their way not to discuss. Friday was the first public evidence of why they might be protective. He went 6 of 9 for 78 yards against Tampa Bay's deep reserves, and the completions were not checkdowns. There was a back-shoulder throw to the left sideline, dropped in over a defender who had perfect position, that made the Jets bench audibly react.",
"\"I'm not doing this,\" Glenn said afterward, smiling before the question about Zadey finished. \"He's on the practice squad. He helps us get ready to play. Next question.\" Asked a second time, differently, Glenn repeated it word for word, which is its own kind of answer.",
"The quarterback room he sits behind is settled, at least officially. Geno Smith is the starter and played like a professional in his two series. Cade Klubnik and Bailey Zappe split the middle quarters. Brady Cook is the fourth arm. Nobody in that group threw the back-shoulder ball.",
"What is verifiable: Zadey wears No. 0, which until this week belonged to running back Braelon Allen. Allen was in No. 12 on Friday. Asked about the switch, Allen grinned and said the terms of the transaction were \"still being finalized,\" which suggests the rookie owes somebody a dinner, or possibly a car.",
"What is also verifiable: practice squad players make $6,222 a week, the same whether they throw back-shoulder fades or hold a clipboard, and other teams are allowed to sign them away. The Jets can protect four practice squad players from poaching each week once the season begins. It would be a surprise if No. 0 is not one of them.",
"The rest of the evening's business was ordinary. The first-team offensive line allowed pressure on three of Smith's eleven dropbacks, which will get cleaned up or get someone benched. Breece Hall did not play. Garrett Wilson played six snaps and caught two balls, including a third-down conversion that was the only first-half play drawn up to look like the regular season. The defense, missing four starters held out with soft-tissue caution, tackled poorly in space, and Glenn said so without being asked.",
"New York travels to Pittsburgh on Friday for preseason week two. The starters are expected to play into the second quarter. The fourth quarter, as of this week, is appointment viewing.",
 ],
 pq:"\"He's on the practice squad. He helps us get ready to play. Next question.\""
},
earlier:[
 {h:"Glenn's first camp: what the new staff kept, what it burned down", s:"Coaching · Aug 3"},
 {h:"Jets 53-man projection 1.0: three roster spots are genuinely open", s:"Roster · Aug 1"},
 {h:"Geno Smith on the mentor question: 'I'm here to win games'", s:"Quotes · Jul 29"}
],
chirps:[
 {n:"Jets Videos", h:"@snyjets", vf:1, av:"#1a7a41", t:"Ty Zadey to the left sideline. That's a practice squad quarterback. Sure.", li:4211, rp:892, tm:"2h"},
 {n:"Marcus Ellery", h:"@mellery_UC", vf:1, av:"#1160a8", t:"Aaron Glenn answered the Zadey question twice with the same 11 words. Coaches only do that when the real answer is interesting.", li:2377, rp:341, tm:"3h"},
 {n:"NFL Rumor Central", h:"@NFLrumorcntrl", vf:1, av:"#333", t:"Multiple teams made calls on Jets PS QB Ty Zadey after Friday's preseason game, per source. Jets are expected to use a weekly protection on him.", li:8930, rp:1755, tm:"4h"},
 {n:"jetsfan since the blackout", h:"@sackexchange86", av:"#274a2f", t:"we are NOT letting the front office bury the number 0 guy behind THREE backup qbs. i've watched this franchise do this before. i know how this movie ends", li:1204, rp:87, tm:"5h"},
 {n:"Tampa Bay Buccaneers", h:"@Buccaneers", vf:1, av:"#8c2f22", t:"Final from New Jersey: Bucs 39, Jets 28. On to week two.", li:3011, rp:212, tm:"6h"},
 {n:"Chelle", h:"@michellehartley", av:"#5a3a56", t:"my cousin was AT the game and said the zero qb was throwing DIMES in warmups an hour before kickoff to nobody. just vibing. league not ready", li:522, rp:34, tm:"6h"}
],
huddle:[
 {id:"h1", flair:"DISCUSSION", u:"FlightBoysZn", tm:"7h", up:1437,
  h:"WHO IS THE QB WEARING ZERO (serious answers only)",
  b:"Undrafted. 20 years old. Bio says a juco I can't find film of. Signed to the PS after a closed camp. Then he walks into garbage time of a preseason game and throws a back shoulder fade that our ACTUAL quarterbacks don't attempt.\n\nI have watched every terrible Jets QB of the last 20 years. I know what bad looks like in August. That was not it. What is going on in Florham Park and why is the coaching staff acting like he's classified?",
  cmts:[
   {u:"EastRutherfordSewer", tm:"7h", up:892, t:"glenn saying 'next question' twice with a smile is the most information a jets coach has ever given us voluntarily", r:[
     {u:"FlightBoysZn", op:1, tm:"6h", up:344, t:"right?? that's a man protecting an asset. you don't protect nothing"},
     {u:"TrustTheTank", tm:"6h", up:118, t:"or he's protecting the locker room from a QB controversy in AUGUST. geno has been fine. let's not do this again", r:[
       {u:"EastRutherfordSewer", tm:"5h", up:203, t:"'let's not do this again' brother WHICH time. doing this is our entire identity"}
     ]}
  ]},
   {u:"GangGreenGrandpa", tm:"6h", up:517, t:"I was at the game. The second read throws were on time. TV won't show you that. The kid was moving through progressions against a real (bad) defense. That back shoulder ball was the 4th best throw he made imo", r:[
     {u:"stat_daddy_nyj", tm:"6h", up:96, t:"this. the 78 yards undersells it, two drops and a throwaway on a busted protection. success rate on his dropbacks was 67%. sample size stuff obviously but the film is the film"}
  ]},
   {u:"ZeroIsAQBNumberNow", tm:"6h", up:301, t:"also can we talk about him getting the number OFF BRAELON in his first month. rookie on the practice squad walked up to a starting RB and negotiated. that's a dawg move honestly"},
   {u:"JetLagged_Miserable", tm:"5h", up:-47, t:"78 garbage time yards against tampa's practice squad and you people are naming stadiums after him. this fanbase is a disease", r:[
     {u:"FlightBoysZn", op:1, tm:"5h", up:210, t:"found geno's burner"},
     {u:"JetLagged_Miserable", tm:"5h", up:-31, t:"remindme in december when he's on the bengals practice squad and you've all moved on"}
  ]},
   {u:"MetLifeMortgage", tm:"5h", up:227, t:"the poaching rules are what scares me. any team can sign him to their ACTIVE roster off our PS. we can only protect 4 guys a week. if the front office lets a team steal this kid for free I'm done. again. for real this time"},
   {u:"CoachTapeAndCoffee", tm:"4h", up:154, awd:"🏅", t:"long post but I charted his 9 dropbacks from the broadcast + all-22 angle where available:\n\n1. quick game, RPO glance, complete (+6)\n2. play action boot, throwaway (protection busted, RT never set)\n3. back shoulder left sideline, complete (+21), THE throw\n4. drop (on the WR, hit him in the numbers)\n5. checkdown, complete (+4)\n6. seam to the TE vs cover 3, complete (+17), placed away from the hook defender\n7. scramble +9, slid like a grownup\n8. deep out, complete (+13), threw before the break\n9. drop (again. our 4th string WRs are not it)\n\nverdict: processes fast, arm is real, footwork already NFL-clean which makes zero sense for a 20yo juco kid. either the bio is fake or scouting departments across the league should be fired."},
   {u:"WoodysWallet", tm:"4h", up:88, t:"PS pay is $6,222/wk. this man threw the best jets pass since 2015 and makes less than my regional sales manager. sport is unwell"},
   {u:"tannenbaum_apologist", tm:"3h", up:41, t:"careful. we have literally seen this exact movie. august hero, september clipboard, october waivers. let the coaches cook"},
   {u:"Sarah_JetsGameday", tm:"3h", up:63, t:"my section was chanting ZE-RO by the last drive lmaooo the vibes were genuinely playoff game for a 39-28 preseason L. this fanbase is so broken and I love us"},
   {u:"BuffaloTroll716", tm:"2h", up:-89, t:"bills fan checking in. please do start the practice squad guy over geno. please. we're begging", r:[
     {u:"EastRutherfordSewer", tm:"2h", up:130, t:"mods"}
  ]},
   {u:"DrFlightPath", tm:"1h", up:29, t:"the real question nobody's asking: WHY was a closed camp closed. teams don't hide bad players. teams hide leverage."}
 ]},
 {id:"h2", flair:"GAME THREAD", u:"AutoModerator", tm:"1d", up:212,
  h:"Post-Game Thread: Buccaneers 39, Jets 28 (Preseason Week 1)",
  b:"Starters: 2 series. Final: 39-28 Tampa Bay. Injuries: none reported. Next: at Pittsburgh, Friday 7:00 PM.",
  cmts:[
   {u:"TrustTheTank", tm:"1d", up:184, t:"first team o-line gave up pressure on 3 of 11 dropbacks. against tampa's twos. fix it or bench somebody, glenn already called it out unprompted which I respect"},
   {u:"stat_daddy_nyj", tm:"1d", up:97, t:"garrett wilson 6 snaps 2 catches, the 3rd down conversion was the only real play call of the half. everything else was vanilla by design"},
   {u:"JetLagged_Miserable", tm:"1d", up:-12, t:"39 points to backups. this defense is going to get us all hurt"},
   {u:"GangGreenGrandpa", tm:"23h", up:76, t:"nobody got injured. that's a preseason win. everything else including the score is noise (except the 4th quarter QB, that was not noise)"}
 ]}
],
podium:{
 show:"The Walkthrough", hosts:"Rachel Otani & Dom Whitfield",
 eps:[
  {id:"ep1", t:"Ep. 41, Preseason Week 1: Panic Rankings, a Chiefs Injury Scare, and the Ghost of Florham Park", dur:"8:47", d:"Rachel and Dom tour the league's opening preseason weekend: which contenders looked disorganized, the injury news out of Kansas City, Chicago's rookie class arriving early, and a closing segment on why a practice-squad quarterback in New Jersey had scouts texting on a Friday night.", played:false}
 ],
 srcNote:"Generate this week's episode brief, feed it to NotebookLM, and paste the episode link or file back here. The brief keeps the hosts honest: league-wide first, your story earns its minutes."
},
espnExtra:[
 {st:"FINAL · PRESEASON WK 1", a:["Buccaneers",39,1],h:["Jets",28,0], net:"NFLN"},
 {st:"FRI 7:00 PM · PRESEASON WK 2", a:["Jets",null,0], h:["Steelers",null,1], net:"NFLN"}
]
};

/* ---------- NEIGHBORHOODS: 5 real areas per NFL market (NY + LA shared) ---------- */
D.METROS = {
 "Jets":       {city:"New York", hoods:[["Hoboken, NJ",1.45],["Williamsburg, Brooklyn",1.7],["Tribeca, Manhattan",3.4],["Fort Lee, NJ",0.95],["Garden City, Long Island",1.2]]},
 "Giants":     {city:"New York", hoods:[["Hoboken, NJ",1.45],["Williamsburg, Brooklyn",1.7],["Tribeca, Manhattan",3.4],["Fort Lee, NJ",0.95],["Garden City, Long Island",1.2]]},
 "Rams":       {city:"Los Angeles", hoods:[["Manhattan Beach",2.6],["Calabasas",1.9],["Silver Lake",1.25],["Playa Vista",1.35],["Hidden Hills",3.1]]},
 "Chargers":   {city:"Los Angeles", hoods:[["Manhattan Beach",2.6],["Calabasas",1.9],["Silver Lake",1.25],["Playa Vista",1.35],["Hidden Hills",3.1]]},
 "Bills":      {city:"Buffalo", hoods:[["Elmwood Village",0.42],["Orchard Park",0.5],["East Aurora",0.48],["North Buffalo",0.38],["Clarence",0.62]]},
 "Dolphins":   {city:"Miami", hoods:[["Brickell",0.95],["Coral Gables",1.4],["Fort Lauderdale (Victoria Park)",0.8],["Wynwood",0.7],["Pinecrest",1.6]]},
 "Patriots":   {city:"Boston", hoods:[["Back Bay",1.9],["South Boston",1.05],["Foxborough",0.62],["Providence (East Side)",0.55],["Newton",1.35]]},
 "Ravens":     {city:"Baltimore", hoods:[["Federal Hill",0.42],["Canton",0.45],["Towson",0.5],["Owings Mills",0.55],["Fells Point",0.48]]},
 "Bengals":    {city:"Cincinnati", hoods:[["Over-the-Rhine",0.42],["Hyde Park",0.62],["Mount Adams",0.55],["Fort Thomas, KY",0.45],["Indian Hill",1.3]]},
 "Browns":     {city:"Cleveland", hoods:[["Ohio City",0.38],["Tremont",0.36],["Rocky River",0.5],["Shaker Heights",0.48],["Westlake",0.55]]},
 "Steelers":   {city:"Pittsburgh", hoods:[["Shadyside",0.5],["Lawrenceville",0.42],["Mount Washington",0.4],["Sewickley",0.75],["South Side Flats",0.38]]},
 "Texans":     {city:"Houston", hoods:[["The Heights",0.58],["Montrose",0.6],["River Oaks",2.2],["Memorial",1.1],["Midtown",0.5]]},
 "Colts":      {city:"Indianapolis", hoods:[["Broad Ripple",0.4],["Fountain Square",0.34],["Carmel",0.62],["Meridian-Kessler",0.5],["Zionsville",0.68]]},
 "Jaguars":    {city:"Jacksonville", hoods:[["Riverside",0.42],["San Marco",0.48],["Jacksonville Beach",0.66],["Ponte Vedra",1.15],["Avondale",0.45]]},
 "Titans":     {city:"Nashville", hoods:[["The Gulch",0.75],["East Nashville",0.55],["12 South",0.8],["Franklin",0.85],["Green Hills",0.95]]},
 "Broncos":    {city:"Denver", hoods:[["LoDo",0.72],["Washington Park",0.85],["Cherry Creek",1.25],["Highlands",0.78],["Greenwood Village",1.05]]},
 "Chiefs":     {city:"Kansas City", hoods:[["Country Club Plaza",0.55],["Brookside",0.48],["River Market",0.4],["Leawood, KS",0.72],["Westport",0.38]]},
 "Raiders":    {city:"Las Vegas", hoods:[["Summerlin",0.72],["The Ridges",1.9],["Henderson (Green Valley)",0.55],["Downtown (Arts District)",0.42],["Southern Highlands",0.85]]},
 "Cowboys":    {city:"Dallas", hoods:[["Uptown",0.75],["Highland Park",2.4],["Deep Ellum",0.5],["Frisco",0.72],["Lakewood",0.68]]},
 "Eagles":     {city:"Philadelphia", hoods:[["Rittenhouse Square",0.95],["Fishtown",0.48],["Old City",0.6],["Haddonfield, NJ",0.68],["Chestnut Hill",0.72]]},
 "Commanders": {city:"Washington", hoods:[["Georgetown",1.5],["Arlington (Clarendon)",0.95],["Navy Yard",0.8],["Alexandria (Old Town)",0.9],["Bethesda, MD",1.15]]},
 "Bears":      {city:"Chicago", hoods:[["Lincoln Park",0.95],["West Loop",0.85],["Wicker Park",0.7],["Gold Coast",1.4],["Lake Forest",1.1]]},
 "Lions":      {city:"Detroit", hoods:[["Corktown",0.34],["Midtown",0.36],["Birmingham",0.85],["Royal Oak",0.45],["Grosse Pointe",0.6]]},
 "Packers":    {city:"Green Bay", hoods:[["Astor Park",0.28],["De Pere",0.36],["Allouez",0.32],["Suamico",0.4],["Door County (Egg Harbor)",0.55]]},
 "Vikings":    {city:"Minneapolis", hoods:[["North Loop",0.6],["Uptown",0.5],["Edina",0.85],["Wayzata",1.2],["Linden Hills",0.7]]},
 "Falcons":    {city:"Atlanta", hoods:[["Buckhead",0.9],["Inman Park",0.68],["Midtown",0.62],["Old Fourth Ward",0.6],["Alpharetta",0.66]]},
 "Panthers":   {city:"Charlotte", hoods:[["South End",0.55],["Dilworth",0.62],["Myers Park",1.05],["NoDa",0.45],["Ballantyne",0.6]]},
 "Saints":     {city:"New Orleans", hoods:[["Garden District",0.75],["Uptown",0.6],["Marigny",0.45],["Lakeview",0.5],["Metairie (Old Metairie)",0.62]]},
 "Buccaneers": {city:"Tampa", hoods:[["Hyde Park",0.72],["Davis Islands",1.3],["Seminole Heights",0.42],["Westchase",0.5],["St. Pete (Old Northeast)",0.6]]},
 "Cardinals":  {city:"Phoenix", hoods:[["Arcadia",0.85],["Scottsdale (Old Town)",0.7],["Paradise Valley",2.1],["Biltmore",0.8],["Gilbert",0.5]]},
 "49ers":      {city:"San Francisco", hoods:[["Marina District",1.9],["Noe Valley",1.7],["Palo Alto",2.6],["Los Gatos",2.2],["Santa Clara (Rivermark)",1.3]]},
 "Seahawks":   {city:"Seattle", hoods:[["Capitol Hill",0.85],["Ballard",0.8],["Queen Anne",1.05],["Bellevue (West)",1.6],["Kirkland",1.1]]}
};

/* street name pools for fake addresses */
D.STREETS = ["Alder","Beaumont","Cedar Hollow","Dunmore","Ellery","Fairbanks","Granite","Halstead","Ivywood","Juniper","Kingsbury","Larkspur","Mercer","Northfield","Orchard","Pembroke","Quarry","Rosalind","Sycamore","Thornbury","Vesper","Waverly","Yardley","Bristlecone","Cormorant"];
D.STTYPES = ["St","Ave","Ln","Ct","Dr","Terrace","Pl","Rd"];

/* ---------- CAR CATALOG (make, model, body, base new price $k, first yr, hot factor) ---------- */
D.CARDATA = [
["Toyota","Camry","sedan",29,2018,.9],["Toyota","Corolla","sedan",23,2018,.85],["Toyota","RAV4","suv",31,2018,.95],["Toyota","Tacoma","truck",34,2018,1],["Toyota","Tundra","truck",44,2018,.95],["Toyota","4Runner","suv",42,2018,1.05],["Toyota","Supra","sports",56,2020,1.1],
["Honda","Accord","sedan",30,2018,.9],["Honda","Civic","sedan",25,2018,.9],["Honda","CR-V","suv",31,2018,.9],["Honda","Pilot","suv",40,2018,.9],
["Ford","F-150","truck",42,2018,1],["Ford","F-150 Raptor","truck",78,2019,1.15],["Ford","Mustang GT","sports",44,2018,1],["Ford","Explorer","suv",39,2018,.85],["Ford","Bronco","suv",41,2021,1.1],["Ford","Expedition","suv",57,2018,.9],
["Chevrolet","Silverado","truck",41,2018,.95],["Chevrolet","Tahoe","suv",58,2018,1],["Chevrolet","Suburban","suv",61,2018,.95],["Chevrolet","Corvette Stingray","sports",68,2020,1.2],["Chevrolet","Camaro SS","sports",44,2018,.95],
["GMC","Yukon Denali","suv",76,2018,1.05],["GMC","Sierra Denali","truck",64,2018,1],
["Ram","1500 TRX","truck",84,2021,1.15],["Ram","1500","truck",42,2018,.95],
["Jeep","Wrangler Rubicon","suv",48,2018,1.05],["Jeep","Grand Cherokee","suv",44,2018,.9],
["Dodge","Charger Scat Pack","sports",48,2018,1.05],["Dodge","Durango SRT","suv",68,2019,1],
["Cadillac","Escalade","suv",92,2018,1.2],["Cadillac","Escalade-V","suv",152,2023,1.3],["Cadillac","CT5-V Blackwing","sports",93,2022,1.1],
["Lincoln","Navigator","suv",88,2018,1.05],
["BMW","M3","sports",76,2018,1.1],["BMW","M5","sports",108,2018,1.1],["BMW","X5 M","suv",112,2019,1.1],["BMW","X7","suv",84,2019,1.05],["BMW","740i","sedan",96,2018,1],["BMW","M8 Competition","sports",134,2020,1.15],
["Mercedes-Benz","C 300","sedan",47,2018,.95],["Mercedes-Benz","E 450","sedan",64,2018,.95],["Mercedes-Benz","S 580","sedan",128,2021,1.15],["Mercedes-Benz","G 550","suv",144,2018,1.35],["Mercedes-Benz","AMG G 63","suv",186,2018,1.45],["Mercedes-Benz","GLE 450","suv",66,2019,1],["Mercedes-Benz","AMG GT","sports",122,2018,1.1],["Mercedes-Benz","Maybach S 680","sedan",232,2021,1.2],
["Audi","RS 7","sports",126,2019,1.1],["Audi","Q8","suv",74,2019,1],["Audi","R8 V10","exotic",162,2018,1.1],["Audi","S5","sports",56,2018,.95],
["Porsche","911 Carrera S","sports",122,2018,1.25],["Porsche","911 Turbo S","exotic",212,2019,1.3],["Porsche","Cayenne Turbo","suv",132,2018,1.1],["Porsche","Taycan Turbo","sedan",152,2020,1.05],["Porsche","Macan GTS","suv",82,2019,1],
["Tesla","Model S Plaid","sedan",108,2021,1.05],["Tesla","Model X","suv",92,2018,.95],["Tesla","Model 3 Performance","sedan",54,2018,.9],["Tesla","Cybertruck","truck",92,2024,1.2],
["Lexus","LX 600","suv",94,2022,1.05],["Lexus","ES 350","sedan",44,2018,.9],["Lexus","LC 500","sports",96,2018,1.05],
["Range Rover","Autobiography","suv",158,2018,1.25],["Range Rover","Sport SVR","suv",122,2018,1.15],["Range Rover","Defender 110","suv",62,2020,1.1],
["Lamborghini","Urus","exotic",232,2019,1.4],["Lamborghini","Huracán EVO","exotic",268,2019,1.35],["Lamborghini","Revuelto","exotic",608,2024,1.45],
["Ferrari","Roma","exotic",247,2021,1.35],["Ferrari","296 GTB","exotic",322,2022,1.4],["Ferrari","SF90","exotic",524,2021,1.4],["Ferrari","Purosangue","exotic",398,2023,1.45],
["McLaren","720S","exotic",301,2018,1.25],["McLaren","765LT","exotic",382,2021,1.3],
["Rolls-Royce","Cullinan","exotic",382,2019,1.5],["Rolls-Royce","Ghost","exotic",343,2021,1.4],["Rolls-Royce","Phantom","exotic",474,2018,1.4],
["Bentley","Continental GT","exotic",236,2018,1.3],["Bentley","Bentayga","exotic",198,2018,1.25],["Bentley","Flying Spur","exotic",219,2020,1.25],
["Aston Martin","DB12","exotic",248,2024,1.3],["Aston Martin","Vantage","exotic",146,2019,1.2],
["Maserati","Levante Trofeo","suv",156,2019,1.05],["Maserati","MC20","exotic",217,2021,1.2],
["Bugatti","Chiron","exotic",3300,2018,1.6],
["Nissan","GT-R Nismo","sports",212,2018,1.15],["Nissan","Z","sports",42,2023,.95],["Nissan","Titan","truck",41,2018,.85],
["Hyundai","Palisade","suv",38,2020,.85],["Kia","Telluride","suv",38,2020,.9],["Kia","EV6 GT","sedan",62,2022,.9],
["Subaru","WRX STI","sports",38,2018,.95],["Subaru","Outback","suv",29,2018,.85],
["Volkswagen","Golf R","sports",45,2019,.95],["Volvo","XC90","suv",57,2018,.9],
["Genesis","G90","sedan",90,2020,.95],["Genesis","GV80","suv",58,2021,.95],
["Land Rover","Discovery","suv",56,2018,.9],["Infiniti","QX80","suv",72,2018,.85],
["Acura","NSX","exotic",157,2018,1.05],["Acura","MDX Type S","suv",67,2022,.9],
["Wagoneer","Grand Wagoneer L","suv",112,2022,1]
];

/* ---------- YACHTS (builder, model, type, length ft, price $M new, yr0) ---------- */
D.YACHTDATA = [
["Sea Ray","Sundancer 320","cruiser",32,.34,2018],["Sea Ray","SLX 400","dayboat",40,.79,2019],["Boston Whaler","345 Conquest","fishing",34,.52,2018],["Boston Whaler","420 Outrage","fishing",42,1.1,2019],
["Grady-White","Canyon 456","fishing",45,1.4,2020],["Scout","530 LXF","fishing",53,2.4,2021],["Yellowfin","54 Offshore","fishing",54,2.1,2020],["Contender","44 ST","fishing",44,1.05,2019],
["Axopar","37 Sun-Top","dayboat",37,.42,2019],["Chris-Craft","Launch 35 GT","dayboat",35,.55,2020],
["Azimut","Fly 68","flybridge",68,3.9,2019],["Azimut","S7","sport",70,4.6,2020],["Azimut","Grande 32M","superyacht",105,12.4,2021],
["Sunseeker","Manhattan 68","flybridge",68,3.8,2019],["Sunseeker","Predator 75","sport",75,4.9,2020],["Sunseeker","95 Yacht","superyacht",95,10.8,2021],
["Princess","V55","sport",55,1.9,2019],["Princess","Y72","flybridge",72,4.4,2020],["Princess","X95","superyacht",95,11.9,2021],
["Ferretti","720","flybridge",72,4.7,2020],["Ferretti","920","superyacht",92,9.9,2021],
["Riva","76 Perseo Super","sport",76,6.8,2021],["Riva","Aquarama Special (restored)","classic",28,.65,2018],["Riva","110 Dolcevita","superyacht",110,17.5,2022],
["Pershing","8X","sport",84,7.2,2021],["Pershing","140","superyacht",140,24.9,2022],
["Prestige","M48","catamaran",48,1.3,2022],["Lagoon","SIXTY 5","catamaran",65,2.4,2020],["Leopard","53 PC","catamaran",53,1.5,2021],
["Viking","64 Convertible","sportfish",64,4.1,2020],["Viking","80 Convertible","sportfish",80,8.9,2021],["Hatteras","GT65 Carolina","sportfish",65,4.6,2019],
["Benetti","Oasis 40M","superyacht",131,21.5,2021],["Benetti","Diamond 145","superyacht",145,29.8,2022],
["Sanlorenzo","SL90A","superyacht",90,9.4,2021],["Sanlorenzo","SX112","superyacht",112,16.8,2022],
["Westport","112","superyacht",112,13.9,2019],["Westport","125","superyacht",125,18.9,2021],
["Ocean Alexander","28R","superyacht",92,8.9,2021],["Feadship","Custom 46M (brokerage)","superyacht",151,34,2018],
["MasterCraft","X26","wake",26,.24,2022],["Malibu","Wakesetter 25 LSV","wake",25,.21,2022],["Nautique","G25 Paragon","wake",25,.33,2023],
["Intrepid","438 Evolution","fishing",43,1.0,2021],["Formula","500 SSC","dayboat",50,1.9,2022],["Tiara","EX 60","dayboat",60,3.2,2022],
["Absolute","60 Fly","flybridge",60,2.6,2021],["Galeon","640 Fly","flybridge",64,3.1,2021],["Cranchi","67 Sessantasette","flybridge",67,3.4,2022]
];

/* ---------- PLANES (maker, model, class, price $M new, yr0, seats) ---------- */
D.PLANEDATA = [
["Cirrus","SR22T","piston",1.1,2019,4],["Cirrus","Vision Jet SF50","vlj",3.3,2019,6],
["Daher","TBM 960","turboprop",4.8,2022,6],["Pilatus","PC-12 NGX","turboprop",5.4,2020,8],["Beechcraft","King Air 360","turboprop",8.1,2020,9],
["Embraer","Phenom 100EV","light",4.7,2019,6],["Embraer","Phenom 300E","light",9.9,2020,9],["Embraer","Praetor 500","midsize",17.9,2020,9],["Embraer","Praetor 600","super-mid",21.5,2020,12],
["Cessna","Citation M2 Gen2","light",6.4,2021,7],["Cessna","Citation CJ4 Gen2","light",11.9,2021,9],["Cessna","Citation XLS Gen2","midsize",15.8,2021,9],["Cessna","Citation Latitude","midsize",18.9,2019,9],["Cessna","Citation Longitude","super-mid",29.9,2019,12],
["HondaJet","Elite II","vlj",7.0,2022,6],
["Bombardier","Challenger 350","super-mid",27.4,2019,10],["Bombardier","Challenger 650","large",32.9,2019,12],["Bombardier","Global 5500","large",47.5,2020,16],["Bombardier","Global 6500","large",57.5,2020,17],["Bombardier","Global 7500","ultra",76.5,2019,19],
["Gulfstream","G280","super-mid",25.5,2019,10],["Gulfstream","G450 (pre-owned)","large",16.5,2018,16],["Gulfstream","G550 (pre-owned)","large",24.5,2018,18],["Gulfstream","G600","large",59.5,2020,17],["Gulfstream","G650ER","ultra",70.5,2019,18],["Gulfstream","G700","ultra",78.5,2022,19],
["Dassault","Falcon 2000LXS","large",36.5,2019,10],["Dassault","Falcon 900LX","large",45.5,2019,14],["Dassault","Falcon 8X","ultra",64.5,2019,16],
["Boeing","BBJ MAX 7 (charter share)","bizliner",112,2021,25],["Airbus","ACJ319neo (charter share)","bizliner",108,2020,19]
];

/* ---------- Investments universe ---------- */
D.INVEST = [
 {id:"idx500", n:"Foundry 500 Index", kind:"index", d:"Broad market index fund", mu:0.0017, sig:0.021},
 {id:"idxtech", n:"Vanguard-Class Tech Index", kind:"index", d:"Large-cap tech index", mu:0.0022, sig:0.032},
 {id:"bond", n:"Treasury Ladder 2-10yr", kind:"bonds", d:"Government bond ladder", mu:0.0008, sig:0.004},
 {id:"muni", n:"NJ Municipal Bonds", kind:"bonds", d:"Tax-advantaged munis", mu:0.0007, sig:0.003},
 {id:"stkA", n:"Helios Motors (HLS)", kind:"stock", d:"EV manufacturer, volatile", mu:0.003, sig:0.075},
 {id:"stkB", n:"Corian Health (CRH)", kind:"stock", d:"Healthcare, steady", mu:0.0015, sig:0.028},
 {id:"stkC", n:"Northbeam Media (NBM)", kind:"stock", d:"Streaming, story stock", mu:0.001, sig:0.06},
 {id:"btc", n:"Bitcoin", kind:"crypto", d:"You know what this is", mu:0.004, sig:0.11},
 {id:"eth", n:"Ethereum", kind:"crypto", d:"Smart-contract chain", mu:0.0035, sig:0.12},
 {id:"memec", n:"$TOUCHDOWN Coin", kind:"crypto", d:"A teammate will pitch you this", mu:-0.004, sig:0.35},
 {id:"bizWash", n:"Car Wash (Paterson, NJ)", kind:"business", d:"$180k buy-in · monthly draw, can fail", mu:0.006, sig:0.09, buyin:180000},
 {id:"bizLaund", n:"Laundromat Partnership", kind:"business", d:"$120k buy-in · boring, resilient", mu:0.004, sig:0.04, buyin:120000},
 {id:"bizRest", n:"Restaurant Stake (Hoboken)", kind:"business", d:"$250k buy-in · high upside, most fail", mu:0.007, sig:0.16, buyin:250000}
];

/* ---------- Loans on offer ---------- */
D.LOANS = [
 {id:"pl1", n:"Personal Loan, Prime", apr:9.5, max:50000, minScore:700, term:36},
 {id:"pl2", n:"Personal Loan, Standard", apr:14.9, max:35000, minScore:640, term:36},
 {id:"pl3", n:"Personal Loan, Rebuild", apr:21.9, max:15000, minScore:0, term:24},
 {id:"adv", n:"Salary Advance", apr:22.0, max:40000, minScore:0, term:12, trap:true, note:"Always approved. Read the APR twice."}
];
