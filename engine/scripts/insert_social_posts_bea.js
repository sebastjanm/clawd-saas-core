const db = require('/home/clawdbot/clawd/node_modules/better-sqlite3')('/home/clawdbot/clawd/content-pipeline/pipeline.db');

const articles = [
  {
    id: 87,
    title: "Kaj je avto leasing",
    url: "https://www.avant2subscribe.com/blog/avto-leasing-kaj-morate-vedeti",
    project: "avant2go-subscribe"
  },
  {
    id: 88,
    title: "Skriti stroški lastništva avta: kaj plačujete, pa sploh ne opazite",
    url: "https://avant2subscribe.com/blog/skriti-stroski-lastnistva-avta",
    project: "avant2go-subscribe"
  },
  {
    id: 89,
    title: "7 razlogov, zakaj je mesečni najem vozila lahko pravi za vas",
    url: "https://www.avant2subscribe.com/blog/7-razlogov-mesecni-najem-vozila",
    project: "avant2go-subscribe"
  }
];

const posts = [
  // Article 87 - LinkedIn
  {
    article_id: 87,
    platform: 'linkedin',
    content: `Ste kdaj izračunali, koliko vas avto leasing *dejansko* stane? 📉\\n\\nVečina ljudi gleda samo mesečni obrok. "255 € na mesec? To zmorem."\\n\\nAmpak matematika v ozadju pogosto pove drugo zgodbo. Pri tipičnem finančnem leasingu za vozilo vrednosti 22.000 € na 7 let:\\n👉 Polog: 6.600 €\\n👉 Mesečni obroki: 21.420 €\\n👉 Skupni strošek financiranja: +6.200 € nad ceno vozila.\\n\\nTo je skoraj 30 % vrednosti vozila, ki gre samo za obresti in stroške. Efektivna obrestna mera (EOM) pogosto preseže 11 %.\\n\\nIn to še ni vse. Leasing pogodba običajno ne vključuje:\\n❌ Registracije in letnih dajatev\\n❌ Vzdrževanja in servisov\\n❌ Menjave pnevmatik\\n\\nKo potegnete črto, je tistih "255 €" hitro bližje 500 €. Preden podpišete, vedno preverite EOM in seštejte *vse* stroške, ne le obroka.\\n\\nSte preverili svoj EOM, preden ste podpisali? 🤔\\n\\n#avtomobil #najem #mobilnost #carsubscription`,
    status: 'draft',
    media_brief: null
  },
  // Article 87 - Instagram
  {
    article_id: 87,
    platform: 'instagram',
    content: `255 € na mesec... ali 500 €? 🤔\\n\\nAvto leasing se sliši ugodno, dokler ne prebereš drobnega tiska. Obresti, polog, servisi, gume, registracija... stroški se hitro naberejo.\\n\\nNaša analiza kaže, da pri 7-letnem leasingu za povprečen avto preplačate vozilo za več kot 6.000 €. 💸\\n\\nPreverite, kaj dejansko podpisujete.\\n\\n#avtomobil #najem #mobilnost #carsubscription`,
    status: 'draft',
    media_brief: "Vizual: Razdeljen ekran. Levo: 'Leasing obrok: 255 €'. Desno: 'Dejanski strošek: 500 €+' (z ikonami za servis, gume, zavarovanje). Ozadje: clean, moderno, automotive."
  },

  // Article 88 - LinkedIn
  {
    article_id: 88,
    platform: 'linkedin',
    content: `Koliko vas stane vaš avto, ko stoji na parkirišču? 🚗💸\\n\\nNaredili smo izračun za 3 leta starega Golfa (vrednost 18.000 €). Rezultat marsikoga preseneti.\\n\\nKo seštejemo:\\n📉 Depreciacijo (tihi ubijalec vrednosti)\\n🛡️ Zavarovanje in registracijo\\n🔧 Servise in pnevmatike\\n⛽ Gorivo in parkiranje\\n\\n...pridemo do številke **5.900 € letno**. To je **490 € na mesec**.\\n\\nGorivo je manj kot tretjina tega zneska. Večino denarja "poje" izguba vrednosti in fiksni stroški, ki jih plačate, tudi če se ne peljete nikamor.\\n\\nČe avto potrebujete le občasno ali za krajše obdobje, je lastništvo verjetno najdražja oblika mobilnosti. Ste kdaj naredili tak izračun za svoje vozilo?\\n\\n#avtomobil #najem #mobilnost #carsubscription`,
    status: 'draft',
    media_brief: null
  },
  // Article 88 - Instagram
  {
    article_id: 88,
    platform: 'instagram',
    content: `490 € na mesec. 😱\\n\\nToliko vas v resnici stane rabljen Golf, tudi če nimate kredita. Depreciacija, zavarovanje, servisi, gume... večina stroškov je nevidnih, dokler ne udarijo po žepu.\\n\\nSte prepričani, da se vam lastništvo splača?\\n\\nLink v bio za celoten izračun! 👆\\n\\n#avtomobil #najem #mobilnost #carsubscription`,
    status: 'draft',
    media_brief: "Vizual: Infografika 'Ledena gora'. Nad vodo: 'Gorivo (150 €)'. Pod vodo (veliko večje): 'Izguba vrednosti', 'Zavarovanje', 'Servisi', 'Gume'. Skupaj: '490 €/mesec'."
  },

  // Article 89 - LinkedIn
  {
    article_id: 89,
    platform: 'linkedin',
    content: `Življenje se spreminja hitreje kot leasing pogodbe. 🔄\\n\\nNov projekt v tujini? Prihod otroka? Menjava službe?\\n\\nKlasičen leasing vas veže za 3 do 5 let. Če želite izstopiti prej, plačate penale. Prodaja avta pa vzame čas in živce.\\n\\nMesečni najem (car subscription) je odgovor na to negotovost. Avto imate 3, 6 ali 12 mesecev. Ko se vaše potrebe spremenijo, se spremeni tudi avto — ali pa ga preprosto vrnete.\\n\\nFleksibilnost ni več luksuz, ampak nuja sodobne mobilnosti. Zakaj bi vezali kapital v pločevino, ki izgublja vrednost?\\n\\nKaj vam je pomembneje pri avtu: lastništvo ali brezskrbnost? 👇\\n\\n#avtomobil #najem #mobilnost #carsubscription`,
    status: 'draft',
    media_brief: null
  },
  // Article 89 - Instagram
  {
    article_id: 89,
    platform: 'instagram',
    content: `Nov avto v prvem letu izgubi 20–30 % vrednosti. 📉\\n\\nZakaj bi bil ta strošek vaš? Pri mesečnem najemu (car subscription) riziko izgube vrednosti nosimo mi. Vi plačate le uporabo.\\n\\nFleksibilno. Brez pologa. Brez vezave za 5 let.\\n\\nPreverite 7 razlogov, zakaj je to pametnejša izbira. Link v bio! 🔗\\n\\n#avtomobil #najem #mobilnost #carsubscription`,
    status: 'draft',
    media_brief: "Vizual: Checklist 'Lastništvo vs. Naročnina'. Lastništvo: 'Vezava 5 let ❌', 'Polog ❌', 'Servisi ❌'. Naročnina: 'Fleksibilno ✅', 'Brez pologa ✅', 'Vse vključeno ✅'."
  }
];

const insertStmt = db.prepare(`
  INSERT INTO social_posts (article_id, platform, content, status, media_brief, created_at)
  VALUES (@article_id, @platform, @content, @status, @media_brief, CURRENT_TIMESTAMP)
`);

db.transaction(() => {
  for (const post of posts) {
    insertStmt.run(post);
  }
})();

console.log(`Inserted ${posts.length} posts successfully.`);
