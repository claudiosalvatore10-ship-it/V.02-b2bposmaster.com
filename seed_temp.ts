import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const rubros = [
    {
      id: "restaurant",
      name: "Restaurant / Food",
      enabledFields: {
        upc: false, sku: false, stock: false, lote: false, vencimiento: false, componenteActivo: false, laboratorio: false, unidad: false,
        descuento: true, costo: true, categoria: true, nombre: true, precio: true, threshold: false, imagenUrl: true, descripcion: true,
        thermal80mm: true, printA4: false, modifiers: true
      }
    },
    {
      id: "wholesale",
      name: "Retail / Wholesale",
      enabledFields: {
        upc: true, sku: true, stock: true, lote: true, vencimiento: true, componenteActivo: false, laboratorio: false, unidad: true,
        descuento: true, costo: true, categoria: true, nombre: true, precio: true, threshold: true, imagenUrl: true, descripcion: true,
        thermal80mm: true, printA4: true, modifiers: false
      }
    },
    {
      id: "pharmacy",
      name: "Pharmacy",
      enabledFields: {
        upc: true, sku: true, stock: true, lote: true, vencimiento: true, componenteActivo: true, laboratorio: true, unidad: true,
        descuento: true, costo: true, categoria: true, nombre: true, precio: true, threshold: true, imagenUrl: true, descripcion: true,
        thermal80mm: false, printA4: true, modifiers: false
      }
    }
  ];

  for (const r of rubros) {
    try {
      await setDoc(doc(db, "system/config/rubros", r.id), r);
      console.log("Seeded " + r.id);
    } catch(e) {
      console.error(e);
    }
  }
  process.exit(0);
}

run();
