const Database = require('better-sqlite3');
const db = new Database('/home/clawdbot/clawd/content-pipeline/pipeline.db');

const posts = [
  {
    article_id: 87,
    platform: "linkedin",
    content: "Avto za 22.000 €. Polog 6.600 €. Mesečni obrok 255 €. Sliši se znosno, kajne?\n\nAmpak drobni tisk pove drugo zgodbo.\n\nKo potegnete črto pod 7-letnim financiranjem, ste za ta avto plačali dodatnih 6.200 € samo za obresti. Efektivna obrestna mera (EOM) pogosto presega 11 %.\n\nIn to še preden plačate prvo zavarovalno polico, prvi servis ali nove pnevmatike. Te stroške leasing hiša prepusti vam.\n\nPri naročnini na vozilo (car subscription) je matematika preprostejša. Ena cena vključuje vse: zavarovanje, servis, pnevmatike, registracijo. Brez pologa, brez 7-letne vezave.\n\nPreden podpišete leasing pogodbo, vprašajte: \"Koliko me bo ta avto stal skupaj z vsemi obrestmi in stroški v 7 letih?\"\n\nSte kdaj preračunali svoj EOM?\n\n#avtomobil #najem #mobilnost #carsubscription",
    status: "draft"
  },
  {
    article_id: 87,
    platform: "instagram",
    content: "Leasing ali naročnina? Ena številka vas bo presenetila. 📉\n\nPri klasičnem leasingu vas financiranje v 7 letih stane dodatnih 6.000 €+. Pri naročnini plačate samo tisto, kar uporabite. Brez pologa, brez vezave, vse vključeno.\n\nLink v bio za celo primerjavo. 🔗\n\n#avtomobil #najem #mobilnost #carsubscription",
    media_brief: "Vizual: Infografika primerjave. Leva stran 'Leasing': '22.000€ cena + 6.200€ obresti + stroški servisa/gum'. Desna stran 'Naročnina': 'Ena cena, vse vključeno'. Ozadje temno modro, beli tekst, rdeč klicaj pri obrestih.",
    status: "draft"
  },
  {
    article_id: 88,
    platform: "linkedin",
    content: "Koliko vas v resnici stane vaš avto na mesec? 200 €? 300 €?\n\nVerjetno ste zgrešili za vsaj polovico.\n\nNaredili smo izračun za rabljenega Golfa (18.000 €). Ko seštejete depreciacijo (izgubo vrednosti), zavarovanje, gorivo, servise, pnevmatike in registracijo...\n\n...pridete do številke 490 € na mesec.\n\nGorivo je manj kot tretjina tega stroška. Največji tihi strošek? Depreciacija. Avto izgublja vrednost, če ga vozite ali ne.\n\nPri naročnini na vozilo (car subscription) te neznanke ni. Cena je fiksna, riziko izgube vrednosti pa nosimo mi.\n\nKdaj ste nazadnje sešteli vse stroške svojega vozila?\n\n#avtomobil #najem #mobilnost #carsubscription",
    status: "draft"
  },
  {
    article_id: 88,
    platform: "instagram",
    content: "490 € na mesec. 💸\n\nTo je realni strošek lastništva rabljenega Golfa, ko vključite vse: izgubo vrednosti, zavarovanje, servise in gume. Gorivo je le vrh ledene gore.\n\nPreverite celoten izračun na blogu. Link v bio. 👆\n\n#avtomobil #najem #mobilnost #carsubscription",
    media_brief: "Vizual: Stat highlight. Velika številka '490 €/mesec' na sredini. Spodaj manjše: 'Realni strošek lastništva (Golf, 3 leta star)'. V krogu okoli številke segmenti: 'Zavarovanje', 'Servis', 'Gume', 'Izguba vrednosti'.",
    status: "draft"
  },
  {
    article_id: 89,
    platform: "linkedin",
    content: "Življenje se spreminja hitreje kot leasing pogodbe.\n\nDanes potrebujete mestni avto. Čez leto dni morda večjega karavana za družino. Ali pa dobite projekt v tujini za 6 mesecev.\n\nČe ste lastnik avta, je vsaka sprememba projekt: prodaja, birokracija, izguba vrednosti. Nov avto v prvem letu izgubi 20-30 % vrednosti (vir: AMZS).\n\nPri mesečnem najemu (car subscription) prilagajate avto svojemu življenju, ne obratno. 3 mesece, 12 mesecev ali 24 mesecev. Ko se potreba spremeni, vrnete ključe.\n\nZakaj bi se vezali za 5 let, če ne veste, kje boste čez eno leto?\n\n#avtomobil #najem #mobilnost #carsubscription",
    status: "draft"
  },
  {
    article_id: 89,
    platform: "instagram",
    content: "Nov avto izgubi 30 % vrednosti v prvem letu. 📉\n\nZakaj bi ta strošek nosili vi? Pri mesečnem najemu plačate le uporabo. Ko avta ne potrebujete več, ga vrnete. Brez prodaje, brez stresa.\n\n7 razlogov za najem na linku v bio. 🚗\n\n#avtomobil #najem #mobilnost #carsubscription",
    media_brief: "Vizual: Lifestyle foto. Oseba (expat ali freelancer) s kovčkom ob avtomobilu, sproščena. Tekst čez sliko: 'Avto za 6 mesecev? Brez problema.' Spodaj logotip Avant2Go Subscribe.",
    status: "draft"
  }
];

const insertStmt = db.prepare('INSERT INTO social_posts (article_id, platform, content, media_brief, status) VALUES (@article_id, @platform, @content, @media_brief, @status)');

db.transaction(() => {
  const insertedIds = [];
  for (const post of posts) {
    const info = insertStmt.run({
        article_id: post.article_id,
        platform: post.platform,
        content: post.content,
        media_brief: post.media_brief || null,
        status: post.status
    });
    insertedIds.push(info.lastInsertRowid);
    console.log(`Inserted post ID ${info.lastInsertRowid} for article ${post.article_id} (${post.platform})`);
  }
  
  // No logging here, will do externally
})();
