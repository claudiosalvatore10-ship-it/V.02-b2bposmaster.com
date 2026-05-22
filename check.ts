import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

async function check() {
  const rubrosSnap = await getDocs(collection(db, 'system', 'config', 'rubros'));
  console.log("Rubros:");
  rubrosSnap.forEach(d => console.log(d.id, d.data()));

  const storeSnap = await getDoc(doc(db, 'stores', 'STR-00001'));
  if (storeSnap.exists()) {
    console.log("STR-00001 businessCategory:", storeSnap.data().businessCategory);
  }
  process.exit(0);
}
check();
