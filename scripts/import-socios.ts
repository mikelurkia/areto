import "dotenv/config";

import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { clubMembers, personGuardians, persons } from "../src/db/schema";
import { isValidIban } from "../src/lib/iban";
import { findCandidates, normalizeName, type PersonForMatching } from "../src/lib/person-matching";

/**
 * Importación puntual de la hoja "Socios 2025-2026"
 * (https://docs.google.com/spreadsheets/d/1iC_YNxiup9OPtSNNb4h7oDYgOS1OTBQU2x-uNWuWhZA),
 * snapshot descargado el 2026-08-20. Respeta el nº de socio y la fecha de
 * alta de la hoja. Idempotente: se puede volver a ejecutar sin duplicar nada.
 *
 * Uso (DATABASE_URL vive en .env.local, no en .env, hay que exportarla antes):
 *   export DATABASE_URL=$(node -e "require('dotenv').config({path:'.env.local',quiet:true}); process.stdout.write((process.env.DATABASE_URL||'').trim())")
 *   npx tsx scripts/import-socios.ts            (dry-run, no escribe nada)
 *   npx tsx scripts/import-socios.ts --commit    (escribe de verdad)
 */

type RawRow = {
  memberNumber: number;
  joinedAtRaw: string; // "D/M/YYYY..."
  fullName: string;
  /** Nº de palabras iniciales de fullName que son el nombre (resto = apellidos). Por defecto 1. */
  firstNameWords?: number;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  isMinor: boolean;
  ibanRaw: string | null;
  /** Aviso manual para casos concretos de datos corregidos a mano (ver notas del plan). */
  manualNote?: string;
};

const ROWS: RawRow[] = [
  { memberNumber: 1, joinedAtRaw: "15/12/2024", fullName: "Santi Bernal Julian", address: "Olakua 17 1 C", city: "Oñati", phone: "688718245", email: "santibernal337@gmail.com", isMinor: false, ibanRaw: "ES36 2100 4460 10 0100114209" },
  { memberNumber: 2, joinedAtRaw: "6/12/2024", fullName: "Aitor Sánchez Viana", address: "Olakua 10c piso 3 derecha", city: "Oñati", phone: "627704446", email: "aitorsv1@gmail.com", isMinor: false, ibanRaw: "ES18 3035 0170 55 1700025935" },
  { memberNumber: 10, joinedAtRaw: "8/12/2024", fullName: "Mikel Urkia Kortabarria", address: "Euskadi Etorbidea 3, 4 Dcha", city: "Oñati", phone: "666265409", email: "mikel.urquia@gmail.com", isMinor: false, ibanRaw: "ES13 3035 0170 52 1700032186" },
  { memberNumber: 11, joinedAtRaw: "1/02/2025", fullName: "Iñaki Iglesias Martin", address: "Euskadi Etorbidea 13, 3 ezkerra", city: "Oñati", phone: "699830650", email: "inaki.iglesias.9@gmail.com", isMinor: false, ibanRaw: "ES15 3035 0170 55 1700026183" },
  { memberNumber: 12, joinedAtRaw: "6/12/2024", fullName: "Maialen Regueiro Aramburu", address: "Euskadi Etorbidea 13, 3 ezkerra", city: "Oñati", phone: "685768829", email: "matzalena@gmail.com", isMinor: false, ibanRaw: "ES95 3035 0170 55 1700009805" },
  { memberNumber: 13, joinedAtRaw: "9/12/2024", fullName: "Markel Larrea Ugarte", address: "Errementari Plaza 3, 1-C", city: "Oñati", phone: "688878074", email: "markel.larrea@gmail.com", isMinor: false, ibanRaw: "ES95 3035 0005 37 0050079201" },
  { memberNumber: 14, joinedAtRaw: "11/12/2024", fullName: "Oihan Buquete Maniega", address: "Obispo Otadui 40 2°", city: "Oñati", phone: "608240791", email: "n_maniega@hotmail.com", isMinor: true, ibanRaw: "ES51 2095 5057 40 9113948967" },
  { memberNumber: 15, joinedAtRaw: "11/12/2024", fullName: "Naiara Maniega Osa", address: "Obispo Otadui 40 2°", city: "Oñati", phone: "608240791", email: "n_maniega@hotmail.com", isMinor: false, ibanRaw: "ES51 2095 5057 40 9113948967" },
  { memberNumber: 16, joinedAtRaw: "11/12/2024", fullName: "Ibon Jausoro Murgiondo", address: "San Juan kale 13-1-B", city: "Oñati", phone: "661238469", email: "ibonjausoro@gmail.com", isMinor: false, ibanRaw: "ES21 2095 5057 43 1066211276" },
  { memberNumber: 17, joinedAtRaw: "11/12/2024", fullName: "Edurne Diaz Urzelai", address: "Kale Zaharra, 39-Ezk", city: "Oñati", phone: "610992687", email: "diured1@gmail.com", isMinor: false, ibanRaw: "ES08 0182 0326 11 0201530091" },
  { memberNumber: 18, joinedAtRaw: "12/12/2024", fullName: "Gorka Garitano Otamendi", address: "San lorenzo 15 2izq", city: "Oñati", phone: "646057478", email: "gorkagaritano@gmail.com", isMinor: false, ibanRaw: "ES17 3035 0170 57 1700033518" },
  { memberNumber: 19, joinedAtRaw: "12/12/2024", fullName: "Maider Biain Regueiro", address: "Errekalde N 5 - 5 izquierda", city: "Oñati", phone: "659741077", email: "maiderbiain@hotmail.com", isMinor: false, ibanRaw: "ES74 3035 0005 33 0050035737" },
  { memberNumber: 20, joinedAtRaw: "12/12/2024", fullName: "Iker Galdos Fernandez", address: "Errekalde N 5 - 5 izquierda", city: "Oñati", phone: "627807680", email: "igaldos@hotmail.com", isMinor: false, ibanRaw: "ES74 3035 0005 33 0050035737" },
  { memberNumber: 21, joinedAtRaw: "14/12/2024", fullName: "Iñaki Guridi Gezalaga", address: "Errekalde 19 4a", city: "Oñati", phone: "616255120", email: "xanxig@gmail.com", isMinor: false, ibanRaw: "ES22 3035 0170 51 1700013158" },
  { memberNumber: 22, joinedAtRaw: "14/12/2024", fullName: "Nagore Ugarte Prieto", address: "Errekalde 19 4-A", city: "Oñati", phone: "679154426", email: "xanxig@gmail.com", isMinor: false, ibanRaw: "ES22 3035 0170 51 1700013158" },
  { memberNumber: 23, joinedAtRaw: "14/12/2024", fullName: "Ander Guridi Ugarte", address: "Errekalde 19 4-A", city: "Oñati", phone: "688759783", email: "xanxig@gmail.com", isMinor: true, ibanRaw: "ES22 3035 0170 51 1700013158" },
  { memberNumber: 24, joinedAtRaw: "15/12/2024", fullName: "Amaia Rekarte Auzmendi", address: "Olakua 17 1 C", city: "Oñati", phone: "645713860", email: "amaiarekarte1@gmail.com", isMinor: false, ibanRaw: "ES93 3035 0005 33 0050016868" },
  { memberNumber: 25, joinedAtRaw: "15/12/2024", fullName: "Tomas Bernal Hernández", address: "Lizaur Kalea 5 2 Ezk", city: "Oñati", phone: "688624866", email: "santibernal337@gmail.com", isMinor: false, ibanRaw: "ES93 3035 0005 33 0050016868" },
  { memberNumber: 26, joinedAtRaw: "16/12/2024", fullName: "Mertxe Muñoz Rodríguez", address: "Olakua, 1 - B - 1° derecha", city: "Oñati", phone: "669133071", email: "mertxe.munoz.r60@gmail.com", isMinor: false, ibanRaw: "ES14 0081 4248 51 0001061412" },
  { memberNumber: 27, joinedAtRaw: "17/12/2024", fullName: "José Carlos Serrano Flores", firstNameWords: 2, address: "Olakua auzoa 11-b 2.eskuma", city: "Oñati", phone: "619834810", email: "josete.lose@yahoo.es", isMinor: false, ibanRaw: "ES62 2100 4460 16 0100072901" },
  { memberNumber: 28, joinedAtRaw: "17/12/2024", fullName: "María Teresa López Rojas", firstNameWords: 2, address: "Olakua auzoa 11-b 2.eskuma", city: "Oñati", phone: "652767263", email: "josete.lose@yahoo.es", isMinor: false, ibanRaw: "ES62 2100 4460 16 0100072901" },
  { memberNumber: 29, joinedAtRaw: "3/01/2025", fullName: "Mikel Saiz Muñoz", address: "Jose Luis Iñarra 18, 1° Izq", city: "Arrasate", phone: "615780227", email: "mikel.saiz99@gmail.com", isMinor: false, ibanRaw: "ES18 0081 4248 53 0001065316" },
  { memberNumber: 30, joinedAtRaw: "25/01/2025", fullName: "Juan Rodriguez Salinero", address: "Errekalde 15 2izq", city: "Oñati", phone: "696279970", email: "juansalinero@gmail.com", isMinor: false, ibanRaw: "ES20 3008 0198 21 5040869926" },
  { memberNumber: 31, joinedAtRaw: "27/01/2025", fullName: "Eider Larrea Ugarte", address: "Errementari Plaza 3, 1ºC", city: "Oñati", phone: "653731815", email: "mikel.larrea.alava@gmail.com", isMinor: false, ibanRaw: "ES18 2100 4460 16 0100198435" },
  { memberNumber: 32, joinedAtRaw: "27/01/2025", fullName: "Miren Gurutze Ugarte Alcelay", firstNameWords: 2, address: "Errementari Plaza 3, 1ºC", city: "Oñati", phone: "653731815", email: "mikel.larrea.alava@gmail.com", isMinor: false, ibanRaw: "ES18 2100 4460 16 0100198435" },
  { memberNumber: 33, joinedAtRaw: "27/01/2025", fullName: "Mikel Larrea Alava", address: "Errementari Plaza 3, 1ºC", city: "Oñati", phone: "653731815", email: "mikel.larrea.alava@gmail.com", isMinor: false, ibanRaw: "ES18 2100 4460 16 0100198435" },
  { memberNumber: 34, joinedAtRaw: "6/12/2024", fullName: "Saioa Bikuña Murua", address: "Olakua 10C 3 eskuma", city: "Oñati", phone: "685063997", email: "saioa91kj@gmail.com", isMinor: false, ibanRaw: "ES18 3035 0170 55 1700025935" },
  { memberNumber: 35, joinedAtRaw: "1/02/2025", fullName: "Javier Azpiazu", address: "Kale Zaharra, 32 - 1 ezkerra", city: "Oñati", phone: "619718557", email: "jazpiazu2@gmail.com", isMinor: false, ibanRaw: "ES19 2095 5057 49 1067179951" },
  { memberNumber: 36, joinedAtRaw: "15/02/2025", fullName: "Koldo Crespo Lamariano", address: "Kale Zaharra 10-3A", city: "Oñati", phone: "683366378", email: "koldo.crespo11@gmail.com", isMinor: false, ibanRaw: "ES84 2100 4460 16 0100173579" },
  { memberNumber: 37, joinedAtRaw: "16/02/2025", fullName: "Julen Ugarte Arabaolaza", address: "San Lorentzo 66", city: "Oñati", phone: "674433278", email: "julenugartearabaolaza@gmail.com", isMinor: false, ibanRaw: "ES38 0182 0326 12 0200552809" },
  { memberNumber: 38, joinedAtRaw: "12/03/2025", fullName: "Iban Arregi Markuleta", address: "Kale zaharra 15-3 esk", city: "Oñati", phone: "615799964", email: "ibanarregimarkuleta@gmail.com", isMinor: false, ibanRaw: "ES93 2095 5057 47 1064008757" },
  { memberNumber: 39, joinedAtRaw: "12/03/2025", fullName: "Eli Iñurritegi Alzelai", address: "Kale Zahara 15-3esk", city: "Oñati", phone: "635746226", email: "e.inurritegi@gmail.com", isMinor: false, ibanRaw: "ES93 2095 5057 47 1064008757" },
  { memberNumber: 40, joinedAtRaw: "12/03/2025", fullName: "Aimar Arregi Iñurritegi", address: "Kale zaharra 15-3esk", city: "Oñati", phone: "635746226", email: "e.inurritegi@gmail.com", isMinor: true, ibanRaw: "ES93 2095 5057 47 1064008757" },
  { memberNumber: 41, joinedAtRaw: "12/03/2025", fullName: "Jon Arregi Iñurritegi", address: "Kale zaharra 15-3 esk", city: "Oñati", phone: "635746226", email: "e.inurritegi@gmail.com", isMinor: true, ibanRaw: "ES93 2095 5057 47 1064008757" },
  { memberNumber: 42, joinedAtRaw: "30/03/2025", fullName: "Roberto Lizarralde Unzurrunzaga", address: "Errekalde 43 - 2 izq", city: "Oñati", phone: "645005447", email: "robertolizarraldeunzurrunzaga@gmail.com", isMinor: false, ibanRaw: "ES20 2095 5057 49 1065254871" },
  { memberNumber: 43, joinedAtRaw: "30/03/2025", fullName: "Julen Carr Ugarte", address: "Bidebarrieta 4 - 1 esk", city: "Oñati", phone: "688870442", email: "julen.carr@alumni.mondragon.edu", isMinor: false, ibanRaw: "ES54 3035 0005 37 0050077126" },
  { memberNumber: 44, joinedAtRaw: "30/03/2025", fullName: "Egoitz Hervás", address: "Bidebarrieta Kalea 13 - 1ºC", city: "Oñati", phone: "663928102", email: "hervasegoitz@gmail.com", isMinor: false, ibanRaw: "ES69 3035 0005 33 0050037753" },
  { memberNumber: 45, joinedAtRaw: "30/03/2025", fullName: "Carlos Odriozola Zubia", address: "San Lorenzo 12", city: "Oñati", phone: "662918427", email: "carlosodri9@gmail.com", isMinor: false, ibanRaw: "ES38 3035 0170 50 1700028730" },
  { memberNumber: 46, joinedAtRaw: "30/03/2025", fullName: "Matias Nicolas Teixidó Alba", firstNameWords: 2, address: "Ugarkalde 5, Bajo C", city: "Oñati", phone: "675863151", email: "mktmteixido@imaltuna.com", isMinor: false, ibanRaw: "ES69 3035 0009 11 0090098093" },
  { memberNumber: 47, joinedAtRaw: "30/03/2025", fullName: "Juan Pablo Osorio Pineda", firstNameWords: 2, address: "Bidebarrieta 4 - 1ºC", city: "Oñati", phone: "747423848", email: "pinedathiago.10@gmail.com", isMinor: false, ibanRaw: "ES13 0182 0326 15 0201536983" },
  { memberNumber: 48, joinedAtRaw: "4/04/2025", fullName: "Peio Gil Gil", address: "Otaduy 17 2 izq", city: "Oñati", phone: "687474592", email: "peiogil@yahoo.es", isMinor: false, ibanRaw: "ES07 2100 4460 15 0100058614" },
  { memberNumber: 49, joinedAtRaw: "4/04/2025", fullName: "Hugo Gil Hoyas", address: "Otaduy zuhaiztia 17 2izq", city: "Oñati", phone: "641042831", email: "huggilho027@gmail.com", isMinor: true, ibanRaw: "ES07 2100 4460 15 0100058614" },
  { memberNumber: 50, joinedAtRaw: "13/06/2025", fullName: "Anton Inza Biain", address: "San Lorentzo auzoa, 14 - 4. Eskuma", city: "Oñati", phone: "655729967", email: "anton.inza@gmail.com", isMinor: false, ibanRaw: "ES54 2095 5057 42 1075668425" },
  { memberNumber: 51, joinedAtRaw: "30/08/2025", fullName: "Sara Zendegi Zelaia", address: "Arantzazuko ama kalea 2B 2°derecha", city: "Oñati", phone: "686258609", email: "sarazende@gmail.com", isMinor: false, ibanRaw: "ES77 3035 0005 32 0050087530" },
  { memberNumber: 52, joinedAtRaw: "31/08/2025", fullName: "José María Domínguez Benito", firstNameWords: 2, address: "C/Bidebarrieta N13 2A", city: "Oñati", phone: "654865629", email: "veroymay@gmail.com", isMinor: false, ibanRaw: "ES34 2095 5057 44 1071402142" },
  { memberNumber: 53, joinedAtRaw: "31/08/2025", fullName: "Jon Aramburu Zubia", address: "Kale zaharra 24-2ezkerra", city: "Oñati", phone: "645009502", email: "jaramburuzubia@gmail.com", isMinor: false, ibanRaw: "ES95 2095 5057 40 1066792770" },
  { memberNumber: 54, joinedAtRaw: "31/08/2025", fullName: "Lierni Arregui", address: "Ugarkalde 8 4B", city: "Oñati", phone: "625700656", email: "sorginli.la@gmail.com", isMinor: false, ibanRaw: "ES78 2095 5057 46 1070024822" },
  { memberNumber: 55, joinedAtRaw: "1/09/2025", fullName: "Ana Ugarte Zubia", address: "Ugarkalde 1. 1A", city: "Oñati", phone: "623208204", email: "auzu1980@hotmail.com", isMinor: false, ibanRaw: "ES02 3035 0170 57 1700036601" },
  { memberNumber: 56, joinedAtRaw: "1/09/2025", fullName: "Óscar Mauricio Zapata Garcia", firstNameWords: 2, address: "Ugarkalde 1. 1A", city: "Oñati", phone: "623213216", email: "auzu1980@hotmail.com", isMinor: false, ibanRaw: "ES57 3035 0170 59 1701042955" },
  { memberNumber: 57, joinedAtRaw: "1/09/2025", fullName: "Mireia Otxandategi Rodriguez", address: "Kalebarria 41, 2.esk", city: "Oñati", phone: "605732328", email: "mireia.otxandategi@gmail.com", isMinor: false, ibanRaw: "ES73 3035 0005 30 0051049261" },
  { memberNumber: 58, joinedAtRaw: "1/09/2025", fullName: "Arkaitz Madinagoitia Martin", address: "San Martin 2 2E", city: "Oñati", phone: "605750835", email: "kortamadi@gmail.com", isMinor: false, ibanRaw: "ES55 3035 0005 37 0050041800" },
  { memberNumber: 59, joinedAtRaw: "2/09/2025", fullName: "Julen Iriondo Martinez de Zuazo", address: "San Lorentzo 18-3. Esk", city: "Oñati", phone: "626151019", email: "juleniriondo58@gmail.com", isMinor: false, ibanRaw: "ES05 3035 0170 53 1700023481" },
  { memberNumber: 60, joinedAtRaw: "6/09/2025", fullName: "Imanol Elorza Beitia", address: "Kalegoiena 8 3B", city: "Oñati", phone: "670986875", email: "imelorza@gmail.com", isMinor: false, ibanRaw: "ES88 0182 0326 11 0200553413" },
  { memberNumber: 61, joinedAtRaw: "6/09/2025", fullName: "Araceli Guridi Astiazaran", address: "Kalegoiena 8-3B", city: "Oñati", phone: "636857563", email: "ara.pianist@gmail.com", isMinor: false, ibanRaw: "ES88 0182 0326 11 0200553413" },
  { memberNumber: 62, joinedAtRaw: "9/09/2025", fullName: "Gorka Villar Iturbe", address: "San Martin 9 1-C", city: "Oñati", phone: "615758169", email: "go.2lly@gmail.com", isMinor: false, ibanRaw: "ES75 3035 0170 53 1700005025" },
  { memberNumber: 63, joinedAtRaw: "27/09/2025", fullName: "Ainhoa Barrena Arriaran", address: "olakua 11b 2izda", city: "Oñati", phone: "629674453", email: "ainhoaolaku@gmail.com", isMinor: false, ibanRaw: "ES86 2095 5057 40 9124054185" },
  { memberNumber: 64, joinedAtRaw: "30/09/2025", fullName: "Amaia Arriaran Senar", address: "Kalegoiena 10 - Behea B", city: "Oñati", phone: "615712033", email: "amasenar@gmail.com", isMinor: false, ibanRaw: "ES40 3035 0005 31 0051025168" },
  { memberNumber: 65, joinedAtRaw: "27/10/2025", fullName: "Maribel Alzelai Perez", address: "Olakua 7-1D", city: "Oñati", phone: "635746226", email: "e.inurritegi@gmail.com", isMinor: false, ibanRaw: "ES93 2095 5057 47 1064008757" },
  { memberNumber: 66, joinedAtRaw: "27/10/2025", fullName: "Izaskun Guridi Gesalaga", address: "Ugarkalde 11-3 C", city: "Oñati", phone: "652733307", email: "izaskunguridiguesalaga@gmail.com", isMinor: false, ibanRaw: "ES12 3035 0170 51 1700014890" },
  { memberNumber: 67, joinedAtRaw: "27/10/2025", fullName: "Jokin Mugarza Ezpeleta", address: "Kurtze Bide 1B 3A", city: "Oñati", phone: "688686468", email: "andarto@gmail.com", isMinor: false, ibanRaw: "ES09 3035 0005 38 0050048496" },
  { memberNumber: 68, joinedAtRaw: "27/10/2025", fullName: "Fran Plaza de la Natividad", address: "San lorenzo 43 3/D", city: "Oñati", phone: "683383164", email: "franplaza25@gmail.com", isMinor: false, ibanRaw: "ES57 2100 4460 11 0200073252" },
  { memberNumber: 69, joinedAtRaw: "30/03/2025", fullName: "Oihan Ugarte Zabaleta", address: "Lope de Agirre 4 - 1 esk", city: "Oñati", phone: "637916430", email: "oihanugartez@gmail.com", isMinor: false, ibanRaw: "ES38 3035 0005 35 0050038130" },
  { memberNumber: 70, joinedAtRaw: "28/10/2025", fullName: "Maria Teresa Lopez Rojas", firstNameWords: 2, address: "Olakua auzoa nº11B-2º dcha", city: "Oñati", phone: "652767263", email: "josete.lose@yahoo.es", isMinor: false, ibanRaw: "ES62 2100 4460 16 0100072901" },
  { memberNumber: 71, joinedAtRaw: "28/10/2025", fullName: "Mayra Veronica Peralta Granda", firstNameWords: 2, address: "Euskadi etorbidea 4-1ºezk", city: "Oñati", phone: "697155020", email: "veroniksamuelisac@hotmail.com", isMinor: false, ibanRaw: "ES42 0081 4248 58 0006064213" },
  { memberNumber: 72, joinedAtRaw: "28/10/2025", fullName: "Isaac Jimenez Peralta", address: "Euskadi Etorbidea 4-1ºezk", city: "Oñati", phone: "697155020", email: "veroniksamuelisac@hotmail.com", isMinor: true, ibanRaw: "ES42 0081 4248 58 0006064213" },
  { memberNumber: 73, joinedAtRaw: "28/10/2025", fullName: "Asier De la Natividad Mohacho", address: "Moyua 15, 1-D", city: "Oñati", phone: "655362329", email: "natividadasier@gmail.com", isMinor: false, ibanRaw: "ES55 2095 5057 40 9116662373" },
  { memberNumber: 74, joinedAtRaw: "28/10/2025", fullName: "Julen Murua Mesonero", address: "Bidebarrieta Kalea 13 3C", city: "Oñati", phone: "688665804", email: "jmm2410@gmail.com", isMinor: false, ibanRaw: "ES11 0049 0929 91 2310006114" },
  { memberNumber: 75, joinedAtRaw: "28/10/2025", fullName: "Diego Teixidó Carballido", address: "Ugarkalde 5 bajo C", city: "Oñati", phone: "722733712", email: "diegoteixido@gmail.com", isMinor: false, ibanRaw: "ES60 2100 4460 17 0100098981" },
  { memberNumber: 76, joinedAtRaw: "28/10/2025", fullName: "Aitor Herrera Moreno", address: "Zerrajera 6-3ºF", city: "Arrasate", phone: "699491438", email: "aitorherrera66@gmail.com", isMinor: false, ibanRaw: "ES50 2095 5055 54 1070551162" },
  { memberNumber: 77, joinedAtRaw: "29/10/2025", fullName: "Jagoba Igartua Urzelai", address: "Otadui Zuahiztia 62 1B", city: "Oñati", phone: "665702088", email: "iagobaigartua71@gmail.com", isMinor: false, ibanRaw: "3530 0005 32 0050024980", manualNote: "IBAN de la hoja original sin prefijo ES ni dígitos de control (\"3530 0005 32 0050024980\"); reconstruido automáticamente a partir del CCC, verificar." },
  { memberNumber: 78, joinedAtRaw: "29/10/2025", fullName: "Jabier Etxeberria Agiriano", address: "San Anton, 14-3.", city: "Oñati", phone: "606666963", email: "jabetxebe@gmail.com", isMinor: false, ibanRaw: "ES79 3035 0005 34 0051062828" },
  { memberNumber: 79, joinedAtRaw: "7/11/2025", fullName: "Jesús Fernando Duran Bakaikoa", firstNameWords: 2, address: "Kale Zahara 17 1 C", city: "Oñati", phone: "660576277", email: "fernanfish2@gmail.com", isMinor: false, ibanRaw: "ES43 2095 5057 48 1070167944" },
  { memberNumber: 80, joinedAtRaw: "8/11/2025", fullName: "Antonio Jiménez Caballero", address: "José María Salaberria 39-1°-A", city: "Donostia", phone: "646136370", email: "ajcmilan@gmail.com", isMinor: false, ibanRaw: "ES97 3035 0009 11 0090038031" },
  { memberNumber: 81, joinedAtRaw: "12/11/2025", fullName: "Iker Alcelay", address: null, city: "Oñati", phone: "686879861", email: null, isMinor: false, ibanRaw: "ESKUZ" },
  { memberNumber: 82, joinedAtRaw: "13/11/2025", fullName: "Unai Aranzabal Urcelay", address: "Kale Zaharra 24, 2 eskuma", city: "Oñati", phone: "664753199", email: "uaranzabal49@gmail.com", isMinor: false, ibanRaw: "ES82 3035 0005 32 0050035933" },
  { memberNumber: 83, joinedAtRaw: "14/11/2025", fullName: "Miren Urzelai Ugarte", address: "San Martin 5-2A", city: "Oñati", phone: "675705611", email: "urzem@yahoo.com", isMinor: false, ibanRaw: "ES85 3035 0005 32 0050020650" },
  { memberNumber: 84, joinedAtRaw: "16/11/2025", fullName: "Jon Aranzabal Urzelai", address: "Kale Zaharra 24, 2. Esk", city: "Oñati", phone: "655352230", email: "jaranzabalurzelai@gmail.com", isMinor: false, ibanRaw: "ES75 3035 0009 15 0090097498" },
  { memberNumber: 85, joinedAtRaw: "16/11/2025", fullName: "Izaskun Iriondo", address: "Bidebarrieta 13-1ºB", city: "Oñati", phone: "615708026", email: "eguirislan@hotmail.com", isMinor: false, ibanRaw: "ES18 3035 0170 54 1700701589", manualNote: "Fecha de alta corregida: la hoja original decía \"16/11/0225\" (año con errata); se ha tomado 2025 por encajar cronológicamente entre los socios nº84 y nº86." },
  { memberNumber: 86, joinedAtRaw: "25/11/2025", fullName: "Esperanza Herrera Moreno", address: "Zerrajera 4 bajo", city: "Arrasate", phone: "699491435", email: "espeherrera67@gmail.com", isMinor: false, ibanRaw: "ES71 2095 5055 54 1066433813" },
];

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function splitName(fullName: string, firstNameWords = 1): { firstName: string; lastName: string } {
  const words = titleCase(fullName.trim()).split(" ").filter(Boolean);
  return {
    firstName: words.slice(0, firstNameWords).join(" "),
    lastName: words.slice(firstNameWords).join(" "),
  };
}

function parseSheetDate(raw: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw.trim());
  if (!match) throw new Error(`Fecha con formato inesperado: "${raw}"`);
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function computeIbanCheckDigits(countryCode: string, bban: string): string {
  const rearranged = `${bban}${countryCode}00`;
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  const remainder = BigInt(numeric) % BigInt(97);
  return (BigInt(98) - remainder).toString().padStart(2, "0");
}

/** Limpia y valida un IBAN; si viene como CCC español de 20 dígitos sin país
 * ni dígitos de control, los calcula (ISO 7064 mod 97) en vez de descartarlo. */
function cleanIban(raw: string | null): { iban: string | null; note: string | null } {
  if (!raw) return { iban: null, note: null };
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (isValidIban(compact)) return { iban: compact, note: null };
  if (/^\d{20}$/.test(compact)) {
    const rebuilt = `ES${computeIbanCheckDigits("ES", compact)}${compact}`;
    if (isValidIban(rebuilt)) return { iban: rebuilt, note: null };
  }
  return { iban: null, note: `IBAN inválido en la hoja original ("${raw}"); revisar y completarlo a mano.` };
}

type ParsedRow = RawRow & { firstName: string; lastName: string; joinedAt: string };

/**
 * Coincidencias verificadas a mano contra la BD real (comprobadas antes de
 * ejecutar la importación): la familia Iñurritegi/Arregi ya tiene fichas en la
 * app con una ortografía distinta a la de la hoja ("Arregi"/"Arregui",
 * "Alzelai"/"Alcelay", "Eli"/"Elisabeth"), que el emparejamiento automático
 * por nombre no detecta. Sin esto se crearían personas duplicadas.
 */
const MANUAL_EXISTING_MATCH: Record<number, string> = {
  21: "5725aa29-d073-4c15-8b83-91ca3fa82143", // Iñaki Guridi Gezalaga -> Iñaki Guridi Guesalaga
  39: "dc1bd2e3-33d9-48ae-a6dd-07356f5c0316", // Eli Iñurritegi Alzelai -> Elisabeth Iñurritegi Alzelai
  40: "a40756a9-6789-4cf3-860a-e72af3ff4ce3", // Aimar Arregi Iñurritegi -> Aimar Arregui Iñurritegui
};

async function main() {
  const commit = process.argv.includes("--commit");
  console.log(commit ? "🚀 Importando socios (ESCRITURA REAL)...\n" : "🔎 Dry-run de importación de socios (no se escribe nada)...\n");

  const parsedRows: ParsedRow[] = ROWS.map((r) => ({
    ...r,
    ...splitName(r.fullName, r.firstNameWords),
    joinedAt: parseSheetDate(r.joinedAtRaw),
  }));

  // --- Agrupación por email para el criterio de tutor/email compartido ---
  const groupsByEmail = new Map<string, ParsedRow[]>();
  for (const row of parsedRows) {
    if (!row.email) continue;
    const key = row.email.trim().toLowerCase();
    if (!groupsByEmail.has(key)) groupsByEmail.set(key, []);
    groupsByEmail.get(key)!.push(row);
  }

  // Emails que comparten 2+ filas de la hoja (familias): no sirven como señal
  // fuerte de "misma persona" al buscar coincidencias en la BD, porque
  // identificarían a cualquier miembro de la familia, no a uno en concreto.
  const sharedEmailKeys = new Set(
    [...groupsByEmail.entries()].filter(([, g]) => g.length > 1).map(([key]) => key),
  );

  const effectiveEmail = new Map<number, string | null>();
  const tutorOf = new Map<number, number>(); // memberNumber del menor -> memberNumber del tutor principal
  const extraGuardiansOf = new Map<number, number[]>();

  for (const group of groupsByEmail.values()) {
    if (group.length === 1) {
      effectiveEmail.set(group[0].memberNumber, group[0].email);
      continue;
    }
    const adults = group.filter((r) => !r.isMinor);
    const minors = group.filter((r) => r.isMinor);
    if (adults.length > 0 && minors.length > 0) {
      const tutor = adults[0];
      for (const r of group) {
        effectiveEmail.set(r.memberNumber, r.memberNumber === tutor.memberNumber ? r.email : null);
      }
      const extraAdultNumbers = adults.slice(1).map((a) => a.memberNumber);
      for (const minor of minors) {
        tutorOf.set(minor.memberNumber, tutor.memberNumber);
        if (extraAdultNumbers.length) extraGuardiansOf.set(minor.memberNumber, extraAdultNumbers);
      }
    } else {
      for (const [i, r] of group.entries()) {
        effectiveEmail.set(r.memberNumber, i === 0 ? r.email : null);
      }
    }
  }

  // --- Pools para detección de duplicados ---
  const existingPersons: PersonForMatching[] = (
    await db.query.persons.findMany({
      columns: { id: true, firstName: true, lastName: true, nationalId: true, email: true },
    })
  ).map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, nationalId: p.nationalId, email: p.email }));

  const runPool: { id: string; firstName: string; lastName: string }[] = [];
  const personIdByMemberNumber = new Map<number, string>();
  const claimedExistingIds = new Set<string>();

  const summary = {
    created: [] as { memberNumber: number; name: string }[],
    updatedExisting: [] as { memberNumber: number; name: string; existingId: string }[],
    duplicateInSheet: [] as { memberNumber: number; name: string; matchedMemberNumber: number }[],
    warnings: [] as string[],
    dataNotes: [] as { memberNumber: number; name: string; note: string }[],
  };

  async function mergePersonFillBlanksOnly(
    personId: string,
    incoming: { email: string | null; phone: string | null; address: string | null; city: string | null; iban: string | null; notes: string | null; joinedAt: string },
  ) {
    const existing = await db.query.persons.findFirst({ where: eq(persons.id, personId) });
    if (!existing) return;
    const patch: Record<string, unknown> = {};
    if (!existing.email && incoming.email) patch.email = incoming.email;
    if (!existing.phone && incoming.phone) patch.phone = incoming.phone;
    if (!existing.address && incoming.address) patch.address = incoming.address;
    if (!existing.city && incoming.city) patch.city = incoming.city;
    if (!existing.iban && incoming.iban) {
      patch.iban = incoming.iban;
      patch.sepaConsent = true;
      patch.sepaConsentAt = new Date(incoming.joinedAt);
    }
    if (incoming.notes) {
      patch.notes = existing.notes ? `${existing.notes}\n${incoming.notes}` : incoming.notes;
    }
    if (Object.keys(patch).length > 0 && commit) {
      await db.update(persons).set(patch).where(eq(persons.id, personId));
    }
  }

  async function upsertClubMembership(personId: string, memberNumber: number, joinedAt: string, personLabel: string) {
    const existing = await db.query.clubMembers.findFirst({ where: eq(clubMembers.personId, personId) });
    if (existing) {
      if (existing.status === "active") {
        summary.warnings.push(
          `${personLabel}: ya tenía una ficha de socio activa (nº ${existing.memberNumber}) antes de importar; no se ha tocado, revisa si el nº ${memberNumber} de la hoja debería sustituirlo.`,
        );
        return;
      }
      if (commit) {
        await db
          .update(clubMembers)
          .set({ status: "active", memberNumber, joinedAt, cancelledAt: null })
          .where(eq(clubMembers.id, existing.id));
      }
    } else if (commit) {
      await db.insert(clubMembers).values({ personId, status: "active", memberNumber, joinedAt });
    }
  }

  // --- Paso 1: crear/actualizar personas + socios ---
  for (const row of parsedRows) {
    const personLabel = `#${row.memberNumber} ${row.firstName} ${row.lastName}`;
    const isTutorDependent = tutorOf.has(row.memberNumber);
    const { iban: cleanedIban, note: ibanNote } = isTutorDependent ? { iban: null, note: null } : cleanIban(row.ibanRaw);
    const email = row.email ? (effectiveEmail.get(row.memberNumber) ?? null) : null;

    // Fase 1: ¿coincide con una persona ya existente en la BD? (DNI/email fuerte, nombre débil).
    // Si el email lo comparten varias filas de la hoja (familia), no se usa como
    // señal de coincidencia: identificaría al primer familiar que aparezca en la
    // BD sin importar cuál de ellos es realmente esta fila.
    const emailKey = row.email ? row.email.trim().toLowerCase() : null;
    const matchEmail = emailKey && !sharedEmailKeys.has(emailKey) ? row.email : null;
    const manualMatchId = MANUAL_EXISTING_MATCH[row.memberNumber];
    const rawStage1Matches = manualMatchId
      ? existingPersons.filter((p) => p.id === manualMatchId)
      : findCandidates(
          { firstName: row.firstName, lastName: row.lastName, nationalId: null, email: matchEmail },
          existingPersons,
        );
    const stage1Matches = rawStage1Matches.filter((c) => !claimedExistingIds.has(c.id));
    if (rawStage1Matches.length > 0 && stage1Matches.length === 0) {
      summary.warnings.push(
        `${personLabel}: coincide con una persona ya asignada a otra fila de la hoja (${rawStage1Matches[0].id}); se ha creado como persona nueva, revisa si es un duplicado real.`,
      );
    }

    // Si ya existe y ya tiene fecha de nacimiento, no hace falta el aviso de
    // "falta fecha de nacimiento" (típicamente ya es jugador/a con ficha completa).
    const existingBirthDate =
      stage1Matches.length > 0
        ? (await db.query.persons.findFirst({ where: eq(persons.id, stage1Matches[0].id), columns: { birthDate: true } }))?.birthDate ?? null
        : null;

    const notes: string[] = [];
    if (row.isMinor && !existingBirthDate) {
      notes.push("Menor de edad según la hoja de socios importada (falta fecha de nacimiento; complétala en la ficha).");
    }
    if (ibanNote) notes.push(ibanNote);
    if (row.manualNote) notes.push(row.manualNote);
    for (const n of notes) summary.dataNotes.push({ memberNumber: row.memberNumber, name: `${row.firstName} ${row.lastName}`, note: n });
    const notesText = notes.length ? notes.join("\n") : null;

    if (stage1Matches.length > 0) {
      const existing = stage1Matches[0];
      claimedExistingIds.add(existing.id);
      await mergePersonFillBlanksOnly(existing.id, {
        email,
        phone: row.phone,
        address: row.address,
        city: row.city,
        iban: cleanedIban,
        notes: notesText,
        joinedAt: row.joinedAt,
      });
      await upsertClubMembership(existing.id, row.memberNumber, row.joinedAt, personLabel);
      runPool.push({ id: existing.id, firstName: existing.firstName, lastName: existing.lastName });
      personIdByMemberNumber.set(row.memberNumber, existing.id);
      summary.updatedExisting.push({ memberNumber: row.memberNumber, name: `${row.firstName} ${row.lastName}`, existingId: existing.id });
      continue;
    }

    // Fase 2: ¿es la misma persona que otra fila ya procesada de esta misma hoja? (solo por nombre;
    // el email no sirve aquí porque puede compartirlo una familia entera sin ser la misma persona)
    const nameKey = normalizeName(`${row.firstName} ${row.lastName}`);
    const dup = runPool.find((p) => normalizeName(`${p.firstName} ${p.lastName}`) === nameKey);
    if (dup) {
      summary.duplicateInSheet.push({
        memberNumber: row.memberNumber,
        name: `${row.firstName} ${row.lastName}`,
        matchedMemberNumber: [...personIdByMemberNumber.entries()].find(([, id]) => id === dup.id)?.[0] ?? -1,
      });
      continue;
    }

    // Crear persona nueva
    let personId: string;
    if (commit) {
      const [created] = await db
        .insert(persons)
        .values({
          firstName: row.firstName,
          lastName: row.lastName,
          email,
          phone: row.phone,
          address: row.address,
          city: row.city,
          iban: cleanedIban,
          sepaConsent: Boolean(cleanedIban),
          sepaConsentAt: cleanedIban ? new Date(row.joinedAt) : null,
          notes: notesText,
        })
        .returning();
      personId = created.id;
      await db.insert(clubMembers).values({ personId, status: "active", memberNumber: row.memberNumber, joinedAt: row.joinedAt });
    } else {
      personId = `dryrun-${row.memberNumber}`;
    }
    runPool.push({ id: personId, firstName: row.firstName, lastName: row.lastName });
    personIdByMemberNumber.set(row.memberNumber, personId);
    summary.created.push({ memberNumber: row.memberNumber, name: `${row.firstName} ${row.lastName}` });
  }

  // --- Paso 2: tutores (mismo criterio que resolvePayerFields en personas/actions.ts:
  // el menor no domicilia por su cuenta, queda enlazado al tutor principal) ---
  for (const [minorNumber, tutorNumber] of tutorOf) {
    const minorId = personIdByMemberNumber.get(minorNumber);
    const tutorId = personIdByMemberNumber.get(tutorNumber);
    if (!minorId || !tutorId) {
      summary.warnings.push(`No se pudo enlazar tutor del socio nº${minorNumber} con el nº${tutorNumber} (falta algún id).`);
      continue;
    }
    if (commit) {
      await db.insert(personGuardians).values({ personId: minorId, guardianId: tutorId, isPrimary: true }).onConflictDoNothing();
    }
    for (const extraNumber of extraGuardiansOf.get(minorNumber) ?? []) {
      const extraId = personIdByMemberNumber.get(extraNumber);
      if (!extraId) continue;
      if (commit) {
        await db.insert(personGuardians).values({ personId: minorId, guardianId: extraId, isPrimary: false }).onConflictDoNothing();
      }
    }
    // Si el menor ya era una persona existente con su propio payerPersonId (p.ej. ya
    // enlazado a mano a su tutor real), no se toca: la hoja no debe pisar un vínculo
    // ya establecido, solo rellenar el hueco cuando no había ninguno. (Un id
    // "dryrun-" es una persona nueva simulada: no puede existir ya en la BD.)
    const minorExisting = minorId.startsWith("dryrun-")
      ? null
      : await db.query.persons.findFirst({ where: eq(persons.id, minorId), columns: { payerPersonId: true } });
    if (minorExisting && minorExisting.payerPersonId) {
      if (minorExisting.payerPersonId !== tutorId) {
        summary.warnings.push(
          `Socio nº${minorNumber}: ya tenía un tutor asignado distinto del de la hoja; se ha dejado el existente sin tocar.`,
        );
      }
    } else if (commit) {
      await db.update(persons).set({ payerPersonId: tutorId }).where(eq(persons.id, minorId));
    }
  }

  // --- Resumen ---
  console.log(
    `Total filas: ${parsedRows.length} | procesadas: ${summary.created.length + summary.updatedExisting.length + summary.duplicateInSheet.length}`,
  );
  console.log(`Creadas: ${summary.created.length}`);
  console.log(`Actualizadas (ya existían en la BD): ${summary.updatedExisting.length}`);
  for (const u of summary.updatedExisting) console.log(`  - #${u.memberNumber} ${u.name} -> persona existente ${u.existingId}`);
  console.log(`Duplicados dentro de la hoja (omitidos): ${summary.duplicateInSheet.length}`);
  for (const d of summary.duplicateInSheet) console.log(`  - fila #${d.memberNumber} ${d.name} parece la misma persona que el socio #${d.matchedMemberNumber}`);
  console.log(`Tutores enlazados: ${tutorOf.size}`);
  for (const [minorNumber, tutorNumber] of tutorOf) console.log(`  - socio #${minorNumber} -> tutor #${tutorNumber}`);
  if (summary.dataNotes.length) {
    console.log(`\nAvisos de datos (guardados en "notas" de cada ficha):`);
    for (const n of summary.dataNotes) console.log(`  - #${n.memberNumber} ${n.name}: ${n.note}`);
  }
  if (summary.warnings.length) {
    console.log(`\n⚠️  Avisos para revisar a mano:`);
    for (const w of summary.warnings) console.log(`  - ${w}`);
  }
  console.log(commit ? "\n✅ Importación aplicada." : "\nDry-run terminado. Repite con --commit para escribir de verdad.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en la importación:", err);
  process.exit(1);
});
