#!/usr/bin/env npx tsx
/**
 * generate_wards_sql.ts
 * =====================
 * Reads an INEC ward-list CSV and writes infra/db/seed/0003_wards.sql
 * containing INSERT OR IGNORE statements for all 8,814+ Nigerian wards.
 *
 * USAGE
 * -----
 *   npx tsx infra/db/seed/scripts/generate_wards_sql.ts <path-to-csv>
 *
 * DATA SOURCE
 * -----------
 * Download the ward list from INEC's Polling Unit Lookup portal:
 *   https://www.inec.gov.ng/party-regulation-monitoring/polling-units
 *
 * The INEC CSV may use any of these column header sets (auto-detected):
 *   (a) State | LGA | Ward
 *   (b) state_name | lga_name | ward_name
 *   (c) STATE | LGA | WARD
 *   (d) StateName | LGAName | WardName
 *   (e) State Name | LGA Name | Ward Name
 *
 * Extra columns (ward_code, polling_unit_count, etc.) are ignored.
 *
 * ARCHITECTURE
 * ------------
 * Ward ID format  : place_ward_<lga_slug>_<ward_slug>
 * Level           : 5
 * Geography type  : ward
 * Parent          : place_lga_<state>_<lga_slug>  (from 0002_lgas.sql)
 * Ancestry path   : ["place_nigeria_001","<zone_id>","<state_id>","<lga_id>"]
 *
 * The script uses a compiled LGA lookup table built from the same 774-LGA
 * master list used in 0002_lgas.sql, with fuzzy matching for common INEC
 * name variations (e.g. "Abua/Odual" ↔ "Abua Odual", apostrophes, etc.).
 *
 * OUTPUT
 * ------
 * Writes  infra/db/seed/0003_wards.sql  (relative to project root).
 * Prints  a summary table to stdout:   state | LGA count | ward count | errors
 * Writes  infra/db/seed/scripts/unmatched_lgas.txt  if any rows couldn't be
 *         matched so you can add aliases and re-run.
 */

import fs, { createReadStream } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LgaRecord {
  placeId:       string;   // e.g. place_lga_kano_kano_municipal
  statePlaceId:  string;   // e.g. place_state_kano
  zonePlaceId:   string;   // e.g. place_zone_north_west
  stateKey:      string;   // e.g. "kano"
  lgaKey:        string;   // e.g. "kano_municipal"
  canonicalName: string;   // e.g. "Kano Municipal"
  aliases:       string[]; // alternate spellings INEC uses
}

interface WardRow {
  stateName: string;
  lgaName:   string;
  wardName:  string;
}

interface UnmatchedLga {
  stateName: string;
  lgaName:   string;
  rowCount:  number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a display name to a stable SQL slug. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/['''`]/g, '')            // strip apostrophes
    .replace(/[^a-z0-9]+/g, '_')      // non-alnum → underscore
    .replace(/^_+|_+$/g, '');         // trim leading/trailing _
}

/** Escape a string for SQLite single-quoted literal. */
function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

/** Build a normalised lookup key from a raw name. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['''`\-\/\\().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Master LGA table  (774 LGAs from 0002_lgas.sql + common INEC aliases)
// Each entry: [placeId, statePlaceId, zonePlaceId, canonicalName, ...aliases]
// ---------------------------------------------------------------------------
// Format per row: [lga_place_id, state_place_id, zone_place_id, name, alias1, alias2, ...]

type RawLgaRow = [string, string, string, string, ...string[]];

const RAW_LGA_TABLE: RawLgaRow[] = [
  // =========================================================
  // NORTH CENTRAL
  // =========================================================
  // --- Benue ---
  ['place_lga_benue_ado','place_state_benue','place_zone_north_central','Ado'],
  ['place_lga_benue_agatu','place_state_benue','place_zone_north_central','Agatu'],
  ['place_lga_benue_apa','place_state_benue','place_zone_north_central','Apa'],
  ['place_lga_benue_buruku','place_state_benue','place_zone_north_central','Buruku'],
  ['place_lga_benue_gboko','place_state_benue','place_zone_north_central','Gboko'],
  ['place_lga_benue_guma','place_state_benue','place_zone_north_central','Guma'],
  ['place_lga_benue_gwer_east','place_state_benue','place_zone_north_central','Gwer East','Gwer-East'],
  ['place_lga_benue_gwer_west','place_state_benue','place_zone_north_central','Gwer West','Gwer-West'],
  ['place_lga_benue_katsina_ala','place_state_benue','place_zone_north_central','Katsina-Ala','Katsina Ala'],
  ['place_lga_benue_konshisha','place_state_benue','place_zone_north_central','Konshisha'],
  ['place_lga_benue_kwande','place_state_benue','place_zone_north_central','Kwande'],
  ['place_lga_benue_logo','place_state_benue','place_zone_north_central','Logo'],
  ['place_lga_benue_makurdi','place_state_benue','place_zone_north_central','Makurdi'],
  ['place_lga_benue_obi','place_state_benue','place_zone_north_central','Obi'],
  ['place_lga_benue_ogbadibo','place_state_benue','place_zone_north_central','Ogbadibo'],
  ['place_lga_benue_ohimini','place_state_benue','place_zone_north_central','Ohimini'],
  ['place_lga_benue_oju','place_state_benue','place_zone_north_central','Oju'],
  ['place_lga_benue_okpokwu','place_state_benue','place_zone_north_central','Okpokwu'],
  ['place_lga_benue_otukpo','place_state_benue','place_zone_north_central','Otukpo'],
  ['place_lga_benue_tarka','place_state_benue','place_zone_north_central','Tarka'],
  ['place_lga_benue_ukum','place_state_benue','place_zone_north_central','Ukum'],
  ['place_lga_benue_ushongo','place_state_benue','place_zone_north_central','Ushongo'],
  ['place_lga_benue_vandeikya','place_state_benue','place_zone_north_central','Vandeikya'],
  // --- Kogi ---
  ['place_lga_kogi_adavi','place_state_kogi','place_zone_north_central','Adavi'],
  ['place_lga_kogi_ajaokuta','place_state_kogi','place_zone_north_central','Ajaokuta'],
  ['place_lga_kogi_ankpa','place_state_kogi','place_zone_north_central','Ankpa'],
  ['place_lga_kogi_bassa','place_state_kogi','place_zone_north_central','Bassa'],
  ['place_lga_kogi_dekina','place_state_kogi','place_zone_north_central','Dekina'],
  ['place_lga_kogi_ibaji','place_state_kogi','place_zone_north_central','Ibaji'],
  ['place_lga_kogi_idah','place_state_kogi','place_zone_north_central','Idah'],
  ['place_lga_kogi_igalamela_odolu','place_state_kogi','place_zone_north_central','Igalamela-Odolu','Igalamela Odolu','Igalamela/Odolu'],
  ['place_lga_kogi_ijumu','place_state_kogi','place_zone_north_central','Ijumu'],
  ['place_lga_kogi_kabba_bunu','place_state_kogi','place_zone_north_central','Kabba/Bunu','Kabba Bunu'],
  ['place_lga_kogi_kogi','place_state_kogi','place_zone_north_central','Kogi'],
  ['place_lga_kogi_lokoja','place_state_kogi','place_zone_north_central','Lokoja'],
  ['place_lga_kogi_mopa_muro','place_state_kogi','place_zone_north_central','Mopa-Muro','Mopa Muro'],
  ['place_lga_kogi_ofu','place_state_kogi','place_zone_north_central','Ofu'],
  ['place_lga_kogi_ogori_magongo','place_state_kogi','place_zone_north_central','Ogori/Magongo','Ogori Magongo'],
  ['place_lga_kogi_okehi','place_state_kogi','place_zone_north_central','Okehi'],
  ['place_lga_kogi_okene','place_state_kogi','place_zone_north_central','Okene'],
  ['place_lga_kogi_olamaboro','place_state_kogi','place_zone_north_central','Olamaboro'],
  ['place_lga_kogi_omala','place_state_kogi','place_zone_north_central','Omala'],
  ['place_lga_kogi_yagba_east','place_state_kogi','place_zone_north_central','Yagba East'],
  ['place_lga_kogi_yagba_west','place_state_kogi','place_zone_north_central','Yagba West'],
  // --- Kwara ---
  ['place_lga_kwara_asa','place_state_kwara','place_zone_north_central','Asa'],
  ['place_lga_kwara_baruten','place_state_kwara','place_zone_north_central','Baruten'],
  ['place_lga_kwara_edu','place_state_kwara','place_zone_north_central','Edu'],
  ['place_lga_kwara_ekiti','place_state_kwara','place_zone_north_central','Ekiti'],
  ['place_lga_kwara_ifelodun','place_state_kwara','place_zone_north_central','Ifelodun'],
  ['place_lga_kwara_ilorin_east','place_state_kwara','place_zone_north_central','Ilorin East'],
  ['place_lga_kwara_ilorin_south','place_state_kwara','place_zone_north_central','Ilorin South'],
  ['place_lga_kwara_ilorin_west','place_state_kwara','place_zone_north_central','Ilorin West'],
  ['place_lga_kwara_irepodun','place_state_kwara','place_zone_north_central','Irepodun'],
  ['place_lga_kwara_isin','place_state_kwara','place_zone_north_central','Isin'],
  ['place_lga_kwara_kaiama','place_state_kwara','place_zone_north_central','Kaiama'],
  ['place_lga_kwara_moro','place_state_kwara','place_zone_north_central','Moro'],
  ['place_lga_kwara_offa','place_state_kwara','place_zone_north_central','Offa'],
  ['place_lga_kwara_oke_ero','place_state_kwara','place_zone_north_central','Oke Ero','Oke-Ero'],
  ['place_lga_kwara_oyun','place_state_kwara','place_zone_north_central','Oyun'],
  ['place_lga_kwara_pategi','place_state_kwara','place_zone_north_central','Pategi'],
  // --- Nasarawa ---
  ['place_lga_nasarawa_akwanga','place_state_nasarawa','place_zone_north_central','Akwanga'],
  ['place_lga_nasarawa_awe','place_state_nasarawa','place_zone_north_central','Awe'],
  ['place_lga_nasarawa_doma','place_state_nasarawa','place_zone_north_central','Doma'],
  ['place_lga_nasarawa_karu','place_state_nasarawa','place_zone_north_central','Karu'],
  ['place_lga_nasarawa_keana','place_state_nasarawa','place_zone_north_central','Keana'],
  ['place_lga_nasarawa_keffi','place_state_nasarawa','place_zone_north_central','Keffi'],
  ['place_lga_nasarawa_kokona','place_state_nasarawa','place_zone_north_central','Kokona'],
  ['place_lga_nasarawa_lafia','place_state_nasarawa','place_zone_north_central','Lafia'],
  ['place_lga_nasarawa_nasarawa','place_state_nasarawa','place_zone_north_central','Nasarawa'],
  ['place_lga_nasarawa_nasarawa_egon','place_state_nasarawa','place_zone_north_central','Nasarawa Egon','Nasarawa-Egon'],
  ['place_lga_nasarawa_obi','place_state_nasarawa','place_zone_north_central','Obi'],
  ['place_lga_nasarawa_toto','place_state_nasarawa','place_zone_north_central','Toto'],
  ['place_lga_nasarawa_wamba','place_state_nasarawa','place_zone_north_central','Wamba'],
  // --- Niger ---
  ['place_lga_niger_agaie','place_state_niger','place_zone_north_central','Agaie'],
  ['place_lga_niger_agwara','place_state_niger','place_zone_north_central','Agwara'],
  ['place_lga_niger_bida','place_state_niger','place_zone_north_central','Bida'],
  ['place_lga_niger_borgu','place_state_niger','place_zone_north_central','Borgu'],
  ['place_lga_niger_bosso','place_state_niger','place_zone_north_central','Bosso'],
  ['place_lga_niger_chanchaga','place_state_niger','place_zone_north_central','Chanchaga'],
  ['place_lga_niger_edati','place_state_niger','place_zone_north_central','Edati'],
  ['place_lga_niger_gbako','place_state_niger','place_zone_north_central','Gbako'],
  ['place_lga_niger_gurara','place_state_niger','place_zone_north_central','Gurara'],
  ['place_lga_niger_katcha','place_state_niger','place_zone_north_central','Katcha'],
  ['place_lga_niger_kontagora','place_state_niger','place_zone_north_central','Kontagora'],
  ['place_lga_niger_lapai','place_state_niger','place_zone_north_central','Lapai'],
  ['place_lga_niger_lavun','place_state_niger','place_zone_north_central','Lavun'],
  ['place_lga_niger_magama','place_state_niger','place_zone_north_central','Magama'],
  ['place_lga_niger_mariga','place_state_niger','place_zone_north_central','Mariga'],
  ['place_lga_niger_mashegu','place_state_niger','place_zone_north_central','Mashegu'],
  ['place_lga_niger_mokwa','place_state_niger','place_zone_north_central','Mokwa'],
  ['place_lga_niger_moya','place_state_niger','place_zone_north_central','Moya'],
  ['place_lga_niger_paikoro','place_state_niger','place_zone_north_central','Paikoro'],
  ['place_lga_niger_rafi','place_state_niger','place_zone_north_central','Rafi'],
  ['place_lga_niger_rijau','place_state_niger','place_zone_north_central','Rijau'],
  ['place_lga_niger_shiroro','place_state_niger','place_zone_north_central','Shiroro'],
  ['place_lga_niger_suleja','place_state_niger','place_zone_north_central','Suleja'],
  ['place_lga_niger_tafa','place_state_niger','place_zone_north_central','Tafa'],
  ['place_lga_niger_wushishi','place_state_niger','place_zone_north_central','Wushishi'],
  // --- Plateau ---
  ['place_lga_plateau_barkin_ladi','place_state_plateau','place_zone_north_central','Barkin Ladi','Barikin Ladi'],
  ['place_lga_plateau_bassa','place_state_plateau','place_zone_north_central','Bassa'],
  ['place_lga_plateau_bokkos','place_state_plateau','place_zone_north_central','Bokkos'],
  ['place_lga_plateau_jos_east','place_state_plateau','place_zone_north_central','Jos East'],
  ['place_lga_plateau_jos_north','place_state_plateau','place_zone_north_central','Jos North'],
  ['place_lga_plateau_jos_south','place_state_plateau','place_zone_north_central','Jos South'],
  ['place_lga_plateau_kanam','place_state_plateau','place_zone_north_central','Kanam'],
  ['place_lga_plateau_kanke','place_state_plateau','place_zone_north_central','Kanke'],
  ['place_lga_plateau_langtang_north','place_state_plateau','place_zone_north_central','Langtang North'],
  ['place_lga_plateau_langtang_south','place_state_plateau','place_zone_north_central','Langtang South'],
  ['place_lga_plateau_mangu','place_state_plateau','place_zone_north_central','Mangu'],
  ['place_lga_plateau_mikang','place_state_plateau','place_zone_north_central','Mikang'],
  ['place_lga_plateau_pankshin','place_state_plateau','place_zone_north_central','Pankshin'],
  ['place_lga_plateau_quaan_pan','place_state_plateau','place_zone_north_central','Qua\'an Pan','Quan Pan','Quaan Pan'],
  ['place_lga_plateau_riyom','place_state_plateau','place_zone_north_central','Riyom'],
  ['place_lga_plateau_shendam','place_state_plateau','place_zone_north_central','Shendam'],
  ['place_lga_plateau_wase','place_state_plateau','place_zone_north_central','Wase'],
  // --- FCT ---
  ['place_lga_fct_abaji','place_state_fct','place_zone_north_central','Abaji'],
  ['place_lga_fct_amac','place_state_fct','place_zone_north_central','Abuja Municipal','Municipal Area Council','AMAC'],
  ['place_lga_fct_bwari','place_state_fct','place_zone_north_central','Bwari'],
  ['place_lga_fct_gwagwalada','place_state_fct','place_zone_north_central','Gwagwalada'],
  ['place_lga_fct_kuje','place_state_fct','place_zone_north_central','Kuje'],
  ['place_lga_fct_kwali','place_state_fct','place_zone_north_central','Kwali'],
  // =========================================================
  // NORTH EAST
  // =========================================================
  // --- Adamawa ---
  ['place_lga_adamawa_demsa','place_state_adamawa','place_zone_north_east','Demsa'],
  ['place_lga_adamawa_fufure','place_state_adamawa','place_zone_north_east','Fufure'],
  ['place_lga_adamawa_ganye','place_state_adamawa','place_zone_north_east','Ganye'],
  ['place_lga_adamawa_gayuk','place_state_adamawa','place_zone_north_east','Gayuk'],
  ['place_lga_adamawa_gombi','place_state_adamawa','place_zone_north_east','Gombi'],
  ['place_lga_adamawa_grie','place_state_adamawa','place_zone_north_east','Grie'],
  ['place_lga_adamawa_hong','place_state_adamawa','place_zone_north_east','Hong'],
  ['place_lga_adamawa_jada','place_state_adamawa','place_zone_north_east','Jada'],
  ['place_lga_adamawa_larmurde','place_state_adamawa','place_zone_north_east','Lamurde','Larmurde'],
  ['place_lga_adamawa_madagali','place_state_adamawa','place_zone_north_east','Madagali'],
  ['place_lga_adamawa_maiha','place_state_adamawa','place_zone_north_east','Maiha'],
  ['place_lga_adamawa_mayo_belwa','place_state_adamawa','place_zone_north_east','Mayo-Belwa','Mayo Belwa'],
  ['place_lga_adamawa_michika','place_state_adamawa','place_zone_north_east','Michika'],
  ['place_lga_adamawa_mubi_north','place_state_adamawa','place_zone_north_east','Mubi North'],
  ['place_lga_adamawa_mubi_south','place_state_adamawa','place_zone_north_east','Mubi South'],
  ['place_lga_adamawa_numan','place_state_adamawa','place_zone_north_east','Numan'],
  ['place_lga_adamawa_shelleng','place_state_adamawa','place_zone_north_east','Shelleng'],
  ['place_lga_adamawa_song','place_state_adamawa','place_zone_north_east','Song'],
  ['place_lga_adamawa_toungo','place_state_adamawa','place_zone_north_east','Toungo'],
  ['place_lga_adamawa_yola_north','place_state_adamawa','place_zone_north_east','Yola North'],
  ['place_lga_adamawa_yola_south','place_state_adamawa','place_zone_north_east','Yola South'],
  // --- Bauchi ---
  ['place_lga_bauchi_alkaleri','place_state_bauchi','place_zone_north_east','Alkaleri'],
  ['place_lga_bauchi_bauchi','place_state_bauchi','place_zone_north_east','Bauchi'],
  ['place_lga_bauchi_bogoro','place_state_bauchi','place_zone_north_east','Bogoro'],
  ['place_lga_bauchi_damban','place_state_bauchi','place_zone_north_east','Damban'],
  ['place_lga_bauchi_darazo','place_state_bauchi','place_zone_north_east','Darazo'],
  ['place_lga_bauchi_dass','place_state_bauchi','place_zone_north_east','Dass'],
  ['place_lga_bauchi_gamawa','place_state_bauchi','place_zone_north_east','Gamawa'],
  ['place_lga_bauchi_ganjuwa','place_state_bauchi','place_zone_north_east','Ganjuwa'],
  ['place_lga_bauchi_giade','place_state_bauchi','place_zone_north_east','Giade'],
  ['place_lga_bauchi_itas_gadau','place_state_bauchi','place_zone_north_east','Itas/Gadau','Itas Gadau'],
  ['place_lga_bauchi_jamaare','place_state_bauchi','place_zone_north_east','Jama\'are','Jamaare'],
  ['place_lga_bauchi_katagum','place_state_bauchi','place_zone_north_east','Katagum'],
  ['place_lga_bauchi_kirfi','place_state_bauchi','place_zone_north_east','Kirfi'],
  ['place_lga_bauchi_misau','place_state_bauchi','place_zone_north_east','Misau'],
  ['place_lga_bauchi_ningi','place_state_bauchi','place_zone_north_east','Ningi'],
  ['place_lga_bauchi_shira','place_state_bauchi','place_zone_north_east','Shira'],
  ['place_lga_bauchi_tafawa_balewa','place_state_bauchi','place_zone_north_east','Tafawa Balewa'],
  ['place_lga_bauchi_toro','place_state_bauchi','place_zone_north_east','Toro'],
  ['place_lga_bauchi_warji','place_state_bauchi','place_zone_north_east','Warji'],
  ['place_lga_bauchi_zaki','place_state_bauchi','place_zone_north_east','Zaki'],
  // --- Borno ---
  ['place_lga_borno_abadam','place_state_borno','place_zone_north_east','Abadam'],
  ['place_lga_borno_askira_uba','place_state_borno','place_zone_north_east','Askira/Uba','Askira Uba'],
  ['place_lga_borno_bama','place_state_borno','place_zone_north_east','Bama'],
  ['place_lga_borno_bayo','place_state_borno','place_zone_north_east','Bayo'],
  ['place_lga_borno_biu','place_state_borno','place_zone_north_east','Biu'],
  ['place_lga_borno_chibok','place_state_borno','place_zone_north_east','Chibok'],
  ['place_lga_borno_damboa','place_state_borno','place_zone_north_east','Damboa'],
  ['place_lga_borno_dikwa','place_state_borno','place_zone_north_east','Dikwa'],
  ['place_lga_borno_gubio','place_state_borno','place_zone_north_east','Gubio'],
  ['place_lga_borno_guzamala','place_state_borno','place_zone_north_east','Guzamala'],
  ['place_lga_borno_gwoza','place_state_borno','place_zone_north_east','Gwoza'],
  ['place_lga_borno_hawul','place_state_borno','place_zone_north_east','Hawul'],
  ['place_lga_borno_jere','place_state_borno','place_zone_north_east','Jere'],
  ['place_lga_borno_kaga','place_state_borno','place_zone_north_east','Kaga'],
  ['place_lga_borno_kala_balge','place_state_borno','place_zone_north_east','Kala/Balge','Kala Balge'],
  ['place_lga_borno_konduga','place_state_borno','place_zone_north_east','Konduga'],
  ['place_lga_borno_kukawa','place_state_borno','place_zone_north_east','Kukawa'],
  ['place_lga_borno_kwaya_kusar','place_state_borno','place_zone_north_east','Kwaya Kusar'],
  ['place_lga_borno_mafa','place_state_borno','place_zone_north_east','Mafa'],
  ['place_lga_borno_magumeri','place_state_borno','place_zone_north_east','Magumeri'],
  ['place_lga_borno_maiduguri','place_state_borno','place_zone_north_east','Maiduguri','Metropolitan'],
  ['place_lga_borno_marte','place_state_borno','place_zone_north_east','Marte'],
  ['place_lga_borno_mobbar','place_state_borno','place_zone_north_east','Mobbar'],
  ['place_lga_borno_monguno','place_state_borno','place_zone_north_east','Monguno'],
  ['place_lga_borno_ngala','place_state_borno','place_zone_north_east','Ngala'],
  ['place_lga_borno_nganzai','place_state_borno','place_zone_north_east','Nganzai'],
  ['place_lga_borno_shani','place_state_borno','place_zone_north_east','Shani'],
  // --- Gombe ---
  ['place_lga_gombe_akko','place_state_gombe','place_zone_north_east','Akko'],
  ['place_lga_gombe_balanga','place_state_gombe','place_zone_north_east','Balanga'],
  ['place_lga_gombe_billiri','place_state_gombe','place_zone_north_east','Billiri'],
  ['place_lga_gombe_dukku','place_state_gombe','place_zone_north_east','Dukku'],
  ['place_lga_gombe_funakaye','place_state_gombe','place_zone_north_east','Funakaye'],
  ['place_lga_gombe_gombe','place_state_gombe','place_zone_north_east','Gombe'],
  ['place_lga_gombe_kaltungo','place_state_gombe','place_zone_north_east','Kaltungo'],
  ['place_lga_gombe_kwami','place_state_gombe','place_zone_north_east','Kwami'],
  ['place_lga_gombe_nafada','place_state_gombe','place_zone_north_east','Nafada'],
  ['place_lga_gombe_shongom','place_state_gombe','place_zone_north_east','Shongom'],
  ['place_lga_gombe_yamaltu_deba','place_state_gombe','place_zone_north_east','Yamaltu/Deba','Yamaltu Deba'],
  // --- Taraba ---
  ['place_lga_taraba_ardo_kola','place_state_taraba','place_zone_north_east','Ardo Kola','Ardokola'],
  ['place_lga_taraba_bali','place_state_taraba','place_zone_north_east','Bali'],
  ['place_lga_taraba_donga','place_state_taraba','place_zone_north_east','Donga'],
  ['place_lga_taraba_gashaka','place_state_taraba','place_zone_north_east','Gashaka'],
  ['place_lga_taraba_gassol','place_state_taraba','place_zone_north_east','Gassol'],
  ['place_lga_taraba_ibi','place_state_taraba','place_zone_north_east','Ibi'],
  ['place_lga_taraba_jalingo','place_state_taraba','place_zone_north_east','Jalingo'],
  ['place_lga_taraba_karim_lamido','place_state_taraba','place_zone_north_east','Karim Lamido','Karim-Lamido'],
  ['place_lga_taraba_kumi','place_state_taraba','place_zone_north_east','Kumi'],
  ['place_lga_taraba_lau','place_state_taraba','place_zone_north_east','Lau'],
  ['place_lga_taraba_sardauna','place_state_taraba','place_zone_north_east','Sardauna'],
  ['place_lga_taraba_takum','place_state_taraba','place_zone_north_east','Takum'],
  ['place_lga_taraba_ussa','place_state_taraba','place_zone_north_east','Ussa'],
  ['place_lga_taraba_wukari','place_state_taraba','place_zone_north_east','Wukari'],
  ['place_lga_taraba_yorro','place_state_taraba','place_zone_north_east','Yorro'],
  ['place_lga_taraba_zing','place_state_taraba','place_zone_north_east','Zing'],
  // --- Yobe ---
  ['place_lga_yobe_bade','place_state_yobe','place_zone_north_east','Bade'],
  ['place_lga_yobe_bursari','place_state_yobe','place_zone_north_east','Bursari'],
  ['place_lga_yobe_damaturu','place_state_yobe','place_zone_north_east','Damaturu'],
  ['place_lga_yobe_fika','place_state_yobe','place_zone_north_east','Fika'],
  ['place_lga_yobe_fune','place_state_yobe','place_zone_north_east','Fune'],
  ['place_lga_yobe_geidam','place_state_yobe','place_zone_north_east','Geidam'],
  ['place_lga_yobe_gujba','place_state_yobe','place_zone_north_east','Gujba'],
  ['place_lga_yobe_gulani','place_state_yobe','place_zone_north_east','Gulani'],
  ['place_lga_yobe_jakusko','place_state_yobe','place_zone_north_east','Jakusko'],
  ['place_lga_yobe_karasuwa','place_state_yobe','place_zone_north_east','Karasuwa'],
  ['place_lga_yobe_machina','place_state_yobe','place_zone_north_east','Machina'],
  ['place_lga_yobe_nangere','place_state_yobe','place_zone_north_east','Nangere'],
  ['place_lga_yobe_nguru','place_state_yobe','place_zone_north_east','Nguru'],
  ['place_lga_yobe_potiskum','place_state_yobe','place_zone_north_east','Potiskum'],
  ['place_lga_yobe_tarmua','place_state_yobe','place_zone_north_east','Tarmua'],
  ['place_lga_yobe_yunusari','place_state_yobe','place_zone_north_east','Yunusari'],
  ['place_lga_yobe_yusufari','place_state_yobe','place_zone_north_east','Yusufari'],
  // =========================================================
  // NORTH WEST
  // =========================================================
  // --- Jigawa ---
  ['place_lga_jigawa_auyo','place_state_jigawa','place_zone_north_west','Auyo'],
  ['place_lga_jigawa_babura','place_state_jigawa','place_zone_north_west','Babura'],
  ['place_lga_jigawa_biriniwa','place_state_jigawa','place_zone_north_west','Biriniwa'],
  ['place_lga_jigawa_birnin_kudu','place_state_jigawa','place_zone_north_west','Birnin Kudu'],
  ['place_lga_jigawa_buji','place_state_jigawa','place_zone_north_west','Buji'],
  ['place_lga_jigawa_dutse','place_state_jigawa','place_zone_north_west','Dutse'],
  ['place_lga_jigawa_gagarawa','place_state_jigawa','place_zone_north_west','Gagarawa'],
  ['place_lga_jigawa_garki','place_state_jigawa','place_zone_north_west','Garki'],
  ['place_lga_jigawa_gumel','place_state_jigawa','place_zone_north_west','Gumel'],
  ['place_lga_jigawa_guri','place_state_jigawa','place_zone_north_west','Guri'],
  ['place_lga_jigawa_gwaram','place_state_jigawa','place_zone_north_west','Gwaram'],
  ['place_lga_jigawa_gwiwa','place_state_jigawa','place_zone_north_west','Gwiwa'],
  ['place_lga_jigawa_hadejia','place_state_jigawa','place_zone_north_west','Hadejia'],
  ['place_lga_jigawa_jahun','place_state_jigawa','place_zone_north_west','Jahun'],
  ['place_lga_jigawa_kafin_hausa','place_state_jigawa','place_zone_north_west','Kafin Hausa'],
  ['place_lga_jigawa_kaugama','place_state_jigawa','place_zone_north_west','Kaugama'],
  ['place_lga_jigawa_kazaure','place_state_jigawa','place_zone_north_west','Kazaure'],
  ['place_lga_jigawa_kiri_kasama','place_state_jigawa','place_zone_north_west','Kiri Kasama','Kirikasamma'],
  ['place_lga_jigawa_kiyawa','place_state_jigawa','place_zone_north_west','Kiyawa'],
  ['place_lga_jigawa_maigatari','place_state_jigawa','place_zone_north_west','Maigatari'],
  ['place_lga_jigawa_malam_maduri','place_state_jigawa','place_zone_north_west','Malam Maduri','Malam Madori'],
  ['place_lga_jigawa_miga','place_state_jigawa','place_zone_north_west','Miga'],
  ['place_lga_jigawa_ringim','place_state_jigawa','place_zone_north_west','Ringim'],
  ['place_lga_jigawa_roni','place_state_jigawa','place_zone_north_west','Roni'],
  ['place_lga_jigawa_sule_tankarkar','place_state_jigawa','place_zone_north_west','Sule-Tankarkar','Sule Tankarkar'],
  ['place_lga_jigawa_taura','place_state_jigawa','place_zone_north_west','Taura'],
  ['place_lga_jigawa_yankwashi','place_state_jigawa','place_zone_north_west','Yankwashi'],
  // --- Kaduna ---
  ['place_lga_kaduna_birnin_gwari','place_state_kaduna','place_zone_north_west','Birnin Gwari'],
  ['place_lga_kaduna_chikun','place_state_kaduna','place_zone_north_west','Chikun'],
  ['place_lga_kaduna_giwa','place_state_kaduna','place_zone_north_west','Giwa'],
  ['place_lga_kaduna_igabi','place_state_kaduna','place_zone_north_west','Igabi'],
  ['place_lga_kaduna_ikara','place_state_kaduna','place_zone_north_west','Ikara'],
  ['place_lga_kaduna_jaba','place_state_kaduna','place_zone_north_west','Jaba'],
  ['place_lga_kaduna_jemaa','place_state_kaduna','place_zone_north_west','Jema\'a','Jemaa'],
  ['place_lga_kaduna_kachia','place_state_kaduna','place_zone_north_west','Kachia'],
  ['place_lga_kaduna_kaduna_north','place_state_kaduna','place_zone_north_west','Kaduna North'],
  ['place_lga_kaduna_kaduna_south','place_state_kaduna','place_zone_north_west','Kaduna South'],
  ['place_lga_kaduna_kagarko','place_state_kaduna','place_zone_north_west','Kagarko'],
  ['place_lga_kaduna_kajuru','place_state_kaduna','place_zone_north_west','Kajuru'],
  ['place_lga_kaduna_kaura','place_state_kaduna','place_zone_north_west','Kaura'],
  ['place_lga_kaduna_kauru','place_state_kaduna','place_zone_north_west','Kauru'],
  ['place_lga_kaduna_kubau','place_state_kaduna','place_zone_north_west','Kubau'],
  ['place_lga_kaduna_kudan','place_state_kaduna','place_zone_north_west','Kudan'],
  ['place_lga_kaduna_lere','place_state_kaduna','place_zone_north_west','Lere'],
  ['place_lga_kaduna_makarfi','place_state_kaduna','place_zone_north_west','Makarfi'],
  ['place_lga_kaduna_sabon_gari','place_state_kaduna','place_zone_north_west','Sabon Gari','Soba'],
  ['place_lga_kaduna_sanga','place_state_kaduna','place_zone_north_west','Sanga'],
  ['place_lga_kaduna_soba','place_state_kaduna','place_zone_north_west','Soba'],
  ['place_lga_kaduna_zangon_kataf','place_state_kaduna','place_zone_north_west','Zangon Kataf','Zango Kataf'],
  ['place_lga_kaduna_zaria','place_state_kaduna','place_zone_north_west','Zaria'],
  // --- Kano ---
  ['place_lga_kano_ajingi','place_state_kano','place_zone_north_west','Ajingi'],
  ['place_lga_kano_albasu','place_state_kano','place_zone_north_west','Albasu'],
  ['place_lga_kano_bagwai','place_state_kano','place_zone_north_west','Bagwai'],
  ['place_lga_kano_bebeji','place_state_kano','place_zone_north_west','Bebeji'],
  ['place_lga_kano_bichi','place_state_kano','place_zone_north_west','Bichi'],
  ['place_lga_kano_bunkure','place_state_kano','place_zone_north_west','Bunkure'],
  ['place_lga_kano_dala','place_state_kano','place_zone_north_west','Dala'],
  ['place_lga_kano_dambatta','place_state_kano','place_zone_north_west','Dambatta'],
  ['place_lga_kano_dawakin_kudu','place_state_kano','place_zone_north_west','Dawakin Kudu'],
  ['place_lga_kano_dawakin_tofa','place_state_kano','place_zone_north_west','Dawakin Tofa'],
  ['place_lga_kano_doguwa','place_state_kano','place_zone_north_west','Doguwa'],
  ['place_lga_kano_fagge','place_state_kano','place_zone_north_west','Fagge'],
  ['place_lga_kano_gabasawa','place_state_kano','place_zone_north_west','Gabasawa'],
  ['place_lga_kano_garko','place_state_kano','place_zone_north_west','Garko'],
  ['place_lga_kano_garun_mallam','place_state_kano','place_zone_north_west','Garun Mallam'],
  ['place_lga_kano_gaya','place_state_kano','place_zone_north_west','Gaya'],
  ['place_lga_kano_gezawa','place_state_kano','place_zone_north_west','Gezawa'],
  ['place_lga_kano_gwale','place_state_kano','place_zone_north_west','Gwale'],
  ['place_lga_kano_gwarzo','place_state_kano','place_zone_north_west','Gwarzo'],
  ['place_lga_kano_kabo','place_state_kano','place_zone_north_west','Kabo'],
  ['place_lga_kano_kano_municipal','place_state_kano','place_zone_north_west','Kano Municipal','Municipal'],
  ['place_lga_kano_karaye','place_state_kano','place_zone_north_west','Karaye'],
  ['place_lga_kano_kibiya','place_state_kano','place_zone_north_west','Kibiya'],
  ['place_lga_kano_kiru','place_state_kano','place_zone_north_west','Kiru'],
  ['place_lga_kano_kumbotso','place_state_kano','place_zone_north_west','Kumbotso'],
  ['place_lga_kano_kunchi','place_state_kano','place_zone_north_west','Kunchi'],
  ['place_lga_kano_kura','place_state_kano','place_zone_north_west','Kura'],
  ['place_lga_kano_madobi','place_state_kano','place_zone_north_west','Madobi'],
  ['place_lga_kano_makoda','place_state_kano','place_zone_north_west','Makoda'],
  ['place_lga_kano_minjibir','place_state_kano','place_zone_north_west','Minjibir'],
  ['place_lga_kano_nasarawa','place_state_kano','place_zone_north_west','Nasarawa'],
  ['place_lga_kano_rano','place_state_kano','place_zone_north_west','Rano'],
  ['place_lga_kano_rimin_gado','place_state_kano','place_zone_north_west','Rimin Gado'],
  ['place_lga_kano_rogo','place_state_kano','place_zone_north_west','Rogo'],
  ['place_lga_kano_shanono','place_state_kano','place_zone_north_west','Shanono'],
  ['place_lga_kano_sumaila','place_state_kano','place_zone_north_west','Sumaila'],
  ['place_lga_kano_takai','place_state_kano','place_zone_north_west','Takai'],
  ['place_lga_kano_tarauni','place_state_kano','place_zone_north_west','Tarauni'],
  ['place_lga_kano_tofa','place_state_kano','place_zone_north_west','Tofa'],
  ['place_lga_kano_tsanyawa','place_state_kano','place_zone_north_west','Tsanyawa'],
  ['place_lga_kano_tudun_wada','place_state_kano','place_zone_north_west','Tudun Wada'],
  ['place_lga_kano_ungogo','place_state_kano','place_zone_north_west','Ungogo'],
  ['place_lga_kano_warawa','place_state_kano','place_zone_north_west','Warawa'],
  ['place_lga_kano_wudil','place_state_kano','place_zone_north_west','Wudil'],
  // --- Katsina ---
  ['place_lga_katsina_bakori','place_state_katsina','place_zone_north_west','Bakori'],
  ['place_lga_katsina_batagarawa','place_state_katsina','place_zone_north_west','Batagarawa'],
  ['place_lga_katsina_batsari','place_state_katsina','place_zone_north_west','Batsari'],
  ['place_lga_katsina_baure','place_state_katsina','place_zone_north_west','Baure'],
  ['place_lga_katsina_bindawa','place_state_katsina','place_zone_north_west','Bindawa'],
  ['place_lga_katsina_charanchi','place_state_katsina','place_zone_north_west','Charanchi'],
  ['place_lga_katsina_dan_musa','place_state_katsina','place_zone_north_west','Dan Musa'],
  ['place_lga_katsina_dandume','place_state_katsina','place_zone_north_west','Dandume'],
  ['place_lga_katsina_danja','place_state_katsina','place_zone_north_west','Danja'],
  ['place_lga_katsina_daura','place_state_katsina','place_zone_north_west','Daura'],
  ['place_lga_katsina_dutsi','place_state_katsina','place_zone_north_west','Dutsi'],
  ['place_lga_katsina_dutsin_ma','place_state_katsina','place_zone_north_west','Dutsin-Ma','Dutsin Ma'],
  ['place_lga_katsina_faskari','place_state_katsina','place_zone_north_west','Faskari'],
  ['place_lga_katsina_funtua','place_state_katsina','place_zone_north_west','Funtua'],
  ['place_lga_katsina_ingawa','place_state_katsina','place_zone_north_west','Ingawa'],
  ['place_lga_katsina_jibia','place_state_katsina','place_zone_north_west','Jibia'],
  ['place_lga_katsina_kafur','place_state_katsina','place_zone_north_west','Kafur'],
  ['place_lga_katsina_kaita','place_state_katsina','place_zone_north_west','Kaita'],
  ['place_lga_katsina_kankara','place_state_katsina','place_zone_north_west','Kankara'],
  ['place_lga_katsina_kankia','place_state_katsina','place_zone_north_west','Kankia'],
  ['place_lga_katsina_katsina','place_state_katsina','place_zone_north_west','Katsina'],
  ['place_lga_katsina_kurfi','place_state_katsina','place_zone_north_west','Kurfi'],
  ['place_lga_katsina_kusada','place_state_katsina','place_zone_north_west','Kusada'],
  ['place_lga_katsina_maiadua','place_state_katsina','place_zone_north_west','Mai\'adua','Maiadua','Mai Adua'],
  ['place_lga_katsina_malumfashi','place_state_katsina','place_zone_north_west','Malumfashi'],
  ['place_lga_katsina_mani','place_state_katsina','place_zone_north_west','Mani'],
  ['place_lga_katsina_mashi','place_state_katsina','place_zone_north_west','Mashi'],
  ['place_lga_katsina_matazu','place_state_katsina','place_zone_north_west','Matazu'],
  ['place_lga_katsina_musawa','place_state_katsina','place_zone_north_west','Musawa'],
  ['place_lga_katsina_rimi','place_state_katsina','place_zone_north_west','Rimi'],
  ['place_lga_katsina_sabuwa','place_state_katsina','place_zone_north_west','Sabuwa'],
  ['place_lga_katsina_safana','place_state_katsina','place_zone_north_west','Safana'],
  ['place_lga_katsina_sandamu','place_state_katsina','place_zone_north_west','Sandamu'],
  ['place_lga_katsina_zango','place_state_katsina','place_zone_north_west','Zango'],
  // --- Kebbi ---
  ['place_lga_kebbi_aleiro','place_state_kebbi','place_zone_north_west','Aleiro'],
  ['place_lga_kebbi_arewa_dandi','place_state_kebbi','place_zone_north_west','Arewa Dandi'],
  ['place_lga_kebbi_argungu','place_state_kebbi','place_zone_north_west','Argungu'],
  ['place_lga_kebbi_augie','place_state_kebbi','place_zone_north_west','Augie'],
  ['place_lga_kebbi_bagudo','place_state_kebbi','place_zone_north_west','Bagudo'],
  ['place_lga_kebbi_birnin_kebbi','place_state_kebbi','place_zone_north_west','Birnin Kebbi'],
  ['place_lga_kebbi_bunza','place_state_kebbi','place_zone_north_west','Bunza'],
  ['place_lga_kebbi_dandi','place_state_kebbi','place_zone_north_west','Dandi'],
  ['place_lga_kebbi_fakai','place_state_kebbi','place_zone_north_west','Fakai'],
  ['place_lga_kebbi_gwandu','place_state_kebbi','place_zone_north_west','Gwandu'],
  ['place_lga_kebbi_jega','place_state_kebbi','place_zone_north_west','Jega'],
  ['place_lga_kebbi_kalgo','place_state_kebbi','place_zone_north_west','Kalgo'],
  ['place_lga_kebbi_koko_besse','place_state_kebbi','place_zone_north_west','Koko/Besse','Koko Besse'],
  ['place_lga_kebbi_maiyama','place_state_kebbi','place_zone_north_west','Maiyama'],
  ['place_lga_kebbi_ngaski','place_state_kebbi','place_zone_north_west','Ngaski'],
  ['place_lga_kebbi_sakaba','place_state_kebbi','place_zone_north_west','Sakaba'],
  ['place_lga_kebbi_shanga','place_state_kebbi','place_zone_north_west','Shanga'],
  ['place_lga_kebbi_suru','place_state_kebbi','place_zone_north_west','Suru'],
  ['place_lga_kebbi_wasagu_danko','place_state_kebbi','place_zone_north_west','Wasagu/Danko','Wasagu Danko'],
  ['place_lga_kebbi_yauri','place_state_kebbi','place_zone_north_west','Yauri'],
  ['place_lga_kebbi_zuru','place_state_kebbi','place_zone_north_west','Zuru'],
  // --- Sokoto ---
  ['place_lga_sokoto_binji','place_state_sokoto','place_zone_north_west','Binji'],
  ['place_lga_sokoto_bodinga','place_state_sokoto','place_zone_north_west','Bodinga'],
  ['place_lga_sokoto_dange_shuni','place_state_sokoto','place_zone_north_west','Dange Shuni'],
  ['place_lga_sokoto_gada','place_state_sokoto','place_zone_north_west','Gada'],
  ['place_lga_sokoto_goronyo','place_state_sokoto','place_zone_north_west','Goronyo'],
  ['place_lga_sokoto_gudu','place_state_sokoto','place_zone_north_west','Gudu'],
  ['place_lga_sokoto_gwadabawa','place_state_sokoto','place_zone_north_west','Gwadabawa'],
  ['place_lga_sokoto_illela','place_state_sokoto','place_zone_north_west','Illela'],
  ['place_lga_sokoto_isa','place_state_sokoto','place_zone_north_west','Isa'],
  ['place_lga_sokoto_kebbe','place_state_sokoto','place_zone_north_west','Kebbe'],
  ['place_lga_sokoto_kware','place_state_sokoto','place_zone_north_west','Kware'],
  ['place_lga_sokoto_rabah','place_state_sokoto','place_zone_north_west','Rabah'],
  ['place_lga_sokoto_sabon_birni','place_state_sokoto','place_zone_north_west','Sabon Birni'],
  ['place_lga_sokoto_shagari','place_state_sokoto','place_zone_north_west','Shagari'],
  ['place_lga_sokoto_silame','place_state_sokoto','place_zone_north_west','Silame'],
  ['place_lga_sokoto_sokoto_north','place_state_sokoto','place_zone_north_west','Sokoto North'],
  ['place_lga_sokoto_sokoto_south','place_state_sokoto','place_zone_north_west','Sokoto South'],
  ['place_lga_sokoto_tambuwal','place_state_sokoto','place_zone_north_west','Tambuwal'],
  ['place_lga_sokoto_tangaza','place_state_sokoto','place_zone_north_west','Tangaza'],
  ['place_lga_sokoto_tureta','place_state_sokoto','place_zone_north_west','Tureta'],
  ['place_lga_sokoto_wamako','place_state_sokoto','place_zone_north_west','Wamako'],
  ['place_lga_sokoto_wurno','place_state_sokoto','place_zone_north_west','Wurno'],
  ['place_lga_sokoto_yabo','place_state_sokoto','place_zone_north_west','Yabo'],
  // --- Zamfara ---
  ['place_lga_zamfara_anka','place_state_zamfara','place_zone_north_west','Anka'],
  ['place_lga_zamfara_bakura','place_state_zamfara','place_zone_north_west','Bakura'],
  ['place_lga_zamfara_birnin_magaji','place_state_zamfara','place_zone_north_west','Birnin Magaji/Kiyaw','Birnin Magaji'],
  ['place_lga_zamfara_bukkuyum','place_state_zamfara','place_zone_north_west','Bukkuyum'],
  ['place_lga_zamfara_bungudu','place_state_zamfara','place_zone_north_west','Bungudu'],
  ['place_lga_zamfara_gummi','place_state_zamfara','place_zone_north_west','Gummi'],
  ['place_lga_zamfara_gusau','place_state_zamfara','place_zone_north_west','Gusau'],
  ['place_lga_zamfara_kaura_namoda','place_state_zamfara','place_zone_north_west','Kaura Namoda'],
  ['place_lga_zamfara_maradun','place_state_zamfara','place_zone_north_west','Maradun'],
  ['place_lga_zamfara_maru','place_state_zamfara','place_zone_north_west','Maru'],
  ['place_lga_zamfara_shinkafi','place_state_zamfara','place_zone_north_west','Shinkafi'],
  ['place_lga_zamfara_talata_mafara','place_state_zamfara','place_zone_north_west','Talata Mafara'],
  ['place_lga_zamfara_tsafe','place_state_zamfara','place_zone_north_west','Tsafe'],
  ['place_lga_zamfara_zurmi','place_state_zamfara','place_zone_north_west','Zurmi'],
  // =========================================================
  // SOUTH EAST
  // =========================================================
  // --- Abia ---
  ['place_lga_abia_aba_north','place_state_abia','place_zone_south_east','Aba North'],
  ['place_lga_abia_aba_south','place_state_abia','place_zone_south_east','Aba South'],
  ['place_lga_abia_arochukwu','place_state_abia','place_zone_south_east','Arochukwu'],
  ['place_lga_abia_bende','place_state_abia','place_zone_south_east','Bende'],
  ['place_lga_abia_ikwuano','place_state_abia','place_zone_south_east','Ikwuano'],
  ['place_lga_abia_isiala_ngwa_n','place_state_abia','place_zone_south_east','Isiala Ngwa North'],
  ['place_lga_abia_isiala_ngwa_s','place_state_abia','place_zone_south_east','Isiala Ngwa South'],
  ['place_lga_abia_isuikwuato','place_state_abia','place_zone_south_east','Isuikwuato'],
  ['place_lga_abia_obi_ngwa','place_state_abia','place_zone_south_east','Obi Ngwa'],
  ['place_lga_abia_ohafia','place_state_abia','place_zone_south_east','Ohafia'],
  ['place_lga_abia_osisioma_ngwa','place_state_abia','place_zone_south_east','Osisioma Ngwa','Osisioma'],
  ['place_lga_abia_ugwunagbo','place_state_abia','place_zone_south_east','Ugwunagbo'],
  ['place_lga_abia_ukwa_east','place_state_abia','place_zone_south_east','Ukwa East'],
  ['place_lga_abia_ukwa_west','place_state_abia','place_zone_south_east','Ukwa West'],
  ['place_lga_abia_umuahia_north','place_state_abia','place_zone_south_east','Umuahia North'],
  ['place_lga_abia_umuahia_south','place_state_abia','place_zone_south_east','Umuahia South'],
  ['place_lga_abia_umu_nneochi','place_state_abia','place_zone_south_east','Umu Nneochi','Umu-Nneochi'],
  // --- Anambra ---
  ['place_lga_anambra_aguata','place_state_anambra','place_zone_south_east','Aguata'],
  ['place_lga_anambra_anambra_east','place_state_anambra','place_zone_south_east','Anambra East'],
  ['place_lga_anambra_anambra_west','place_state_anambra','place_zone_south_east','Anambra West'],
  ['place_lga_anambra_anaocha','place_state_anambra','place_zone_south_east','Anaocha'],
  ['place_lga_anambra_awka_north','place_state_anambra','place_zone_south_east','Awka North'],
  ['place_lga_anambra_awka_south','place_state_anambra','place_zone_south_east','Awka South'],
  ['place_lga_anambra_ayamelum','place_state_anambra','place_zone_south_east','Ayamelum'],
  ['place_lga_anambra_dunukofia','place_state_anambra','place_zone_south_east','Dunukofia'],
  ['place_lga_anambra_ekwusigo','place_state_anambra','place_zone_south_east','Ekwusigo'],
  ['place_lga_anambra_idemili_north','place_state_anambra','place_zone_south_east','Idemili North'],
  ['place_lga_anambra_idemili_south','place_state_anambra','place_zone_south_east','Idemili South'],
  ['place_lga_anambra_ihiala','place_state_anambra','place_zone_south_east','Ihiala'],
  ['place_lga_anambra_njikoka','place_state_anambra','place_zone_south_east','Njikoka'],
  ['place_lga_anambra_nnewi_north','place_state_anambra','place_zone_south_east','Nnewi North'],
  ['place_lga_anambra_nnewi_south','place_state_anambra','place_zone_south_east','Nnewi South'],
  ['place_lga_anambra_ogbaru','place_state_anambra','place_zone_south_east','Ogbaru'],
  ['place_lga_anambra_onitsha_north','place_state_anambra','place_zone_south_east','Onitsha North'],
  ['place_lga_anambra_onitsha_south','place_state_anambra','place_zone_south_east','Onitsha South'],
  ['place_lga_anambra_orumba_north','place_state_anambra','place_zone_south_east','Orumba North'],
  ['place_lga_anambra_orumba_south','place_state_anambra','place_zone_south_east','Orumba South'],
  ['place_lga_anambra_oyi','place_state_anambra','place_zone_south_east','Oyi'],
  // --- Ebonyi ---
  ['place_lga_ebonyi_abakaliki','place_state_ebonyi','place_zone_south_east','Abakaliki'],
  ['place_lga_ebonyi_afikpo_north','place_state_ebonyi','place_zone_south_east','Afikpo North'],
  ['place_lga_ebonyi_afikpo_south','place_state_ebonyi','place_zone_south_east','Afikpo South'],
  ['place_lga_ebonyi_ebonyi','place_state_ebonyi','place_zone_south_east','Ebonyi'],
  ['place_lga_ebonyi_ezza_north','place_state_ebonyi','place_zone_south_east','Ezza North'],
  ['place_lga_ebonyi_ezza_south','place_state_ebonyi','place_zone_south_east','Ezza South'],
  ['place_lga_ebonyi_ikwo','place_state_ebonyi','place_zone_south_east','Ikwo'],
  ['place_lga_ebonyi_ishielu','place_state_ebonyi','place_zone_south_east','Ishielu'],
  ['place_lga_ebonyi_ivo','place_state_ebonyi','place_zone_south_east','Ivo'],
  ['place_lga_ebonyi_izzi','place_state_ebonyi','place_zone_south_east','Izzi'],
  ['place_lga_ebonyi_ohaozara','place_state_ebonyi','place_zone_south_east','Ohaozara'],
  ['place_lga_ebonyi_ohaukwu','place_state_ebonyi','place_zone_south_east','Ohaukwu'],
  ['place_lga_ebonyi_onicha','place_state_ebonyi','place_zone_south_east','Onicha'],
  // --- Enugu ---
  ['place_lga_enugu_aninri','place_state_enugu','place_zone_south_east','Aninri'],
  ['place_lga_enugu_awgu','place_state_enugu','place_zone_south_east','Awgu'],
  ['place_lga_enugu_enugu_east','place_state_enugu','place_zone_south_east','Enugu East'],
  ['place_lga_enugu_enugu_north','place_state_enugu','place_zone_south_east','Enugu North'],
  ['place_lga_enugu_enugu_south','place_state_enugu','place_zone_south_east','Enugu South'],
  ['place_lga_enugu_ezeagu','place_state_enugu','place_zone_south_east','Ezeagu'],
  ['place_lga_enugu_igbo_etiti','place_state_enugu','place_zone_south_east','Igbo Etiti'],
  ['place_lga_enugu_igbo_eze_north','place_state_enugu','place_zone_south_east','Igbo Eze North'],
  ['place_lga_enugu_igbo_eze_south','place_state_enugu','place_zone_south_east','Igbo Eze South'],
  ['place_lga_enugu_isi_uzo','place_state_enugu','place_zone_south_east','Isi Uzo'],
  ['place_lga_enugu_nkanu_east','place_state_enugu','place_zone_south_east','Nkanu East'],
  ['place_lga_enugu_nkanu_west','place_state_enugu','place_zone_south_east','Nkanu West'],
  ['place_lga_enugu_nsukka','place_state_enugu','place_zone_south_east','Nsukka'],
  ['place_lga_enugu_oji_river','place_state_enugu','place_zone_south_east','Oji River'],
  ['place_lga_enugu_udenu','place_state_enugu','place_zone_south_east','Udenu'],
  ['place_lga_enugu_udi','place_state_enugu','place_zone_south_east','Udi'],
  ['place_lga_enugu_uzo_uwani','place_state_enugu','place_zone_south_east','Uzo-Uwani','Uzo Uwani'],
  // --- Imo ---
  ['place_lga_imo_aboh_mbaise','place_state_imo','place_zone_south_east','Aboh Mbaise'],
  ['place_lga_imo_ahiazu_mbaise','place_state_imo','place_zone_south_east','Ahiazu Mbaise'],
  ['place_lga_imo_ehime_mbano','place_state_imo','place_zone_south_east','Ehime Mbano'],
  ['place_lga_imo_ezinihitte','place_state_imo','place_zone_south_east','Ezinihitte'],
  ['place_lga_imo_ideato_north','place_state_imo','place_zone_south_east','Ideato North'],
  ['place_lga_imo_ideato_south','place_state_imo','place_zone_south_east','Ideato South'],
  ['place_lga_imo_ihitte_uboma','place_state_imo','place_zone_south_east','Ihitte/Uboma','Ihitte Uboma'],
  ['place_lga_imo_ikeduru','place_state_imo','place_zone_south_east','Ikeduru'],
  ['place_lga_imo_isiala_mbano','place_state_imo','place_zone_south_east','Isiala Mbano'],
  ['place_lga_imo_isu','place_state_imo','place_zone_south_east','Isu'],
  ['place_lga_imo_mbaitoli','place_state_imo','place_zone_south_east','Mbaitoli'],
  ['place_lga_imo_ngor_okpala','place_state_imo','place_zone_south_east','Ngor Okpala'],
  ['place_lga_imo_njaba','place_state_imo','place_zone_south_east','Njaba'],
  ['place_lga_imo_nkwerre','place_state_imo','place_zone_south_east','Nkwerre'],
  ['place_lga_imo_nwangele','place_state_imo','place_zone_south_east','Nwangele'],
  ['place_lga_imo_obowo','place_state_imo','place_zone_south_east','Obowo'],
  ['place_lga_imo_oguta','place_state_imo','place_zone_south_east','Oguta'],
  ['place_lga_imo_ohaji_egbema','place_state_imo','place_zone_south_east','Ohaji/Egbema','Ohaji Egbema'],
  ['place_lga_imo_okigwe','place_state_imo','place_zone_south_east','Okigwe'],
  ['place_lga_imo_orlu','place_state_imo','place_zone_south_east','Orlu'],
  ['place_lga_imo_orsu','place_state_imo','place_zone_south_east','Orsu'],
  ['place_lga_imo_oru_east','place_state_imo','place_zone_south_east','Oru East'],
  ['place_lga_imo_oru_west','place_state_imo','place_zone_south_east','Oru West'],
  ['place_lga_imo_owerri_muni','place_state_imo','place_zone_south_east','Owerri Municipal'],
  ['place_lga_imo_owerri_north','place_state_imo','place_zone_south_east','Owerri North'],
  ['place_lga_imo_owerri_west','place_state_imo','place_zone_south_east','Owerri West'],
  ['place_lga_imo_unuimo','place_state_imo','place_zone_south_east','Unuimo'],
  // =========================================================
  // SOUTH SOUTH
  // =========================================================
  // --- Akwa Ibom ---
  ['place_lga_akwaibom_abak','place_state_akwaibom','place_zone_south_south','Abak'],
  ['place_lga_akwaibom_eastern_obolo','place_state_akwaibom','place_zone_south_south','Eastern Obolo'],
  ['place_lga_akwaibom_eket','place_state_akwaibom','place_zone_south_south','Eket'],
  ['place_lga_akwaibom_esit_eket','place_state_akwaibom','place_zone_south_south','Esit Eket'],
  ['place_lga_akwaibom_essien_udim','place_state_akwaibom','place_zone_south_south','Essien Udim'],
  ['place_lga_akwaibom_etim_ekpo','place_state_akwaibom','place_zone_south_south','Etim Ekpo'],
  ['place_lga_akwaibom_etinan','place_state_akwaibom','place_zone_south_south','Etinan'],
  ['place_lga_akwaibom_ibeno','place_state_akwaibom','place_zone_south_south','Ibeno'],
  ['place_lga_akwaibom_ibesikpo','place_state_akwaibom','place_zone_south_south','Ibesikpo Asutan','Ibesikpo'],
  ['place_lga_akwaibom_ibiono_ibom','place_state_akwaibom','place_zone_south_south','Ibiono-Ibom','Ibiono Ibom'],
  ['place_lga_akwaibom_ika','place_state_akwaibom','place_zone_south_south','Ika'],
  ['place_lga_akwaibom_ikono','place_state_akwaibom','place_zone_south_south','Ikono'],
  ['place_lga_akwaibom_ikot_abasi','place_state_akwaibom','place_zone_south_south','Ikot Abasi'],
  ['place_lga_akwaibom_ikot_ekpene','place_state_akwaibom','place_zone_south_south','Ikot Ekpene'],
  ['place_lga_akwaibom_ini','place_state_akwaibom','place_zone_south_south','Ini'],
  ['place_lga_akwaibom_itu','place_state_akwaibom','place_zone_south_south','Itu'],
  ['place_lga_akwaibom_mbo','place_state_akwaibom','place_zone_south_south','Mbo'],
  ['place_lga_akwaibom_mkpat_enin','place_state_akwaibom','place_zone_south_south','Mkpat-Enin','Mkpat Enin'],
  ['place_lga_akwaibom_nsit_atai','place_state_akwaibom','place_zone_south_south','Nsit-Atai','Nsit Atai'],
  ['place_lga_akwaibom_nsit_ibom','place_state_akwaibom','place_zone_south_south','Nsit-Ibom','Nsit Ibom'],
  ['place_lga_akwaibom_nsit_ubium','place_state_akwaibom','place_zone_south_south','Nsit-Ubium','Nsit Ubium'],
  ['place_lga_akwaibom_obot_akara','place_state_akwaibom','place_zone_south_south','Obot Akara'],
  ['place_lga_akwaibom_okobo','place_state_akwaibom','place_zone_south_south','Okobo'],
  ['place_lga_akwaibom_onna','place_state_akwaibom','place_zone_south_south','Onna'],
  ['place_lga_akwaibom_oron','place_state_akwaibom','place_zone_south_south','Oron'],
  ['place_lga_akwaibom_oruk_anam','place_state_akwaibom','place_zone_south_south','Oruk Anam'],
  ['place_lga_akwaibom_udung_uko','place_state_akwaibom','place_zone_south_south','Udung-Uko','Udung Uko'],
  ['place_lga_akwaibom_ukanafun','place_state_akwaibom','place_zone_south_south','Ukanafun'],
  ['place_lga_akwaibom_uruan','place_state_akwaibom','place_zone_south_south','Uruan'],
  ['place_lga_akwaibom_urue_offong','place_state_akwaibom','place_zone_south_south','Urue-Offong/Oruko','Urue Offong Oruko'],
  ['place_lga_akwaibom_uyo','place_state_akwaibom','place_zone_south_south','Uyo'],
  // --- Bayelsa ---
  ['place_lga_bayelsa_brass','place_state_bayelsa','place_zone_south_south','Brass'],
  ['place_lga_bayelsa_ekeremor','place_state_bayelsa','place_zone_south_south','Ekeremor'],
  ['place_lga_bayelsa_kolokuma_opokuma','place_state_bayelsa','place_zone_south_south','Kolokuma/Opokuma','Kolokuma Opokuma'],
  ['place_lga_bayelsa_nembe','place_state_bayelsa','place_zone_south_south','Nembe'],
  ['place_lga_bayelsa_ogbia','place_state_bayelsa','place_zone_south_south','Ogbia'],
  ['place_lga_bayelsa_sagbama','place_state_bayelsa','place_zone_south_south','Sagbama'],
  ['place_lga_bayelsa_southern_ijaw','place_state_bayelsa','place_zone_south_south','Southern Ijaw'],
  ['place_lga_bayelsa_yenagoa','place_state_bayelsa','place_zone_south_south','Yenagoa'],
  // --- Cross River ---
  ['place_lga_crossriver_abi','place_state_crossriver','place_zone_south_south','Abi'],
  ['place_lga_crossriver_akamkpa','place_state_crossriver','place_zone_south_south','Akamkpa'],
  ['place_lga_crossriver_akpabuyo','place_state_crossriver','place_zone_south_south','Akpabuyo'],
  ['place_lga_crossriver_bakassi','place_state_crossriver','place_zone_south_south','Bakassi'],
  ['place_lga_crossriver_bekwarra','place_state_crossriver','place_zone_south_south','Bekwarra'],
  ['place_lga_crossriver_biase','place_state_crossriver','place_zone_south_south','Biase'],
  ['place_lga_crossriver_boki','place_state_crossriver','place_zone_south_south','Boki'],
  ['place_lga_crossriver_calabar_muni','place_state_crossriver','place_zone_south_south','Calabar Municipal'],
  ['place_lga_crossriver_calabar_south','place_state_crossriver','place_zone_south_south','Calabar South'],
  ['place_lga_crossriver_etung','place_state_crossriver','place_zone_south_south','Etung'],
  ['place_lga_crossriver_ikom','place_state_crossriver','place_zone_south_south','Ikom'],
  ['place_lga_crossriver_obanliku','place_state_crossriver','place_zone_south_south','Obanliku'],
  ['place_lga_crossriver_obubra','place_state_crossriver','place_zone_south_south','Obubra'],
  ['place_lga_crossriver_obudu','place_state_crossriver','place_zone_south_south','Obudu'],
  ['place_lga_crossriver_odukpani','place_state_crossriver','place_zone_south_south','Odukpani'],
  ['place_lga_crossriver_ogoja','place_state_crossriver','place_zone_south_south','Ogoja'],
  ['place_lga_crossriver_yakurr','place_state_crossriver','place_zone_south_south','Yakurr'],
  ['place_lga_crossriver_yala','place_state_crossriver','place_zone_south_south','Yala'],
  // --- Delta ---
  ['place_lga_delta_aniocha_north','place_state_delta','place_zone_south_south','Aniocha North'],
  ['place_lga_delta_aniocha_south','place_state_delta','place_zone_south_south','Aniocha South'],
  ['place_lga_delta_bomadi','place_state_delta','place_zone_south_south','Bomadi'],
  ['place_lga_delta_burutu','place_state_delta','place_zone_south_south','Burutu'],
  ['place_lga_delta_ethiope_east','place_state_delta','place_zone_south_south','Ethiope East'],
  ['place_lga_delta_ethiope_west','place_state_delta','place_zone_south_south','Ethiope West'],
  ['place_lga_delta_ika_north_east','place_state_delta','place_zone_south_south','Ika North East'],
  ['place_lga_delta_ika_south','place_state_delta','place_zone_south_south','Ika South'],
  ['place_lga_delta_isoko_north','place_state_delta','place_zone_south_south','Isoko North'],
  ['place_lga_delta_isoko_south','place_state_delta','place_zone_south_south','Isoko South'],
  ['place_lga_delta_ndokwa_east','place_state_delta','place_zone_south_south','Ndokwa East'],
  ['place_lga_delta_ndokwa_west','place_state_delta','place_zone_south_south','Ndokwa West'],
  ['place_lga_delta_okpe','place_state_delta','place_zone_south_south','Okpe'],
  ['place_lga_delta_oshimili_north','place_state_delta','place_zone_south_south','Oshimili North'],
  ['place_lga_delta_oshimili_south','place_state_delta','place_zone_south_south','Oshimili South'],
  ['place_lga_delta_patani','place_state_delta','place_zone_south_south','Patani'],
  ['place_lga_delta_sapele','place_state_delta','place_zone_south_south','Sapele'],
  ['place_lga_delta_udu','place_state_delta','place_zone_south_south','Udu'],
  ['place_lga_delta_ughelli_north','place_state_delta','place_zone_south_south','Ughelli North'],
  ['place_lga_delta_ughelli_south','place_state_delta','place_zone_south_south','Ughelli South'],
  ['place_lga_delta_ukwuani','place_state_delta','place_zone_south_south','Ukwuani'],
  ['place_lga_delta_uvwie','place_state_delta','place_zone_south_south','Uvwie'],
  ['place_lga_delta_warri_north','place_state_delta','place_zone_south_south','Warri North'],
  ['place_lga_delta_warri_south','place_state_delta','place_zone_south_south','Warri South'],
  ['place_lga_delta_warri_south_west','place_state_delta','place_zone_south_south','Warri South West'],
  // --- Edo ---
  ['place_lga_edo_akoko_edo','place_state_edo','place_zone_south_south','Akoko-Edo','Akoko Edo'],
  ['place_lga_edo_egor','place_state_edo','place_zone_south_south','Egor'],
  ['place_lga_edo_esan_central','place_state_edo','place_zone_south_south','Esan Central'],
  ['place_lga_edo_esan_north_east','place_state_edo','place_zone_south_south','Esan North-East','Esan North East'],
  ['place_lga_edo_esan_south_east','place_state_edo','place_zone_south_south','Esan South-East','Esan South East'],
  ['place_lga_edo_esan_west','place_state_edo','place_zone_south_south','Esan West'],
  ['place_lga_edo_etsako_central','place_state_edo','place_zone_south_south','Etsako Central'],
  ['place_lga_edo_etsako_east','place_state_edo','place_zone_south_south','Etsako East'],
  ['place_lga_edo_etsako_west','place_state_edo','place_zone_south_south','Etsako West'],
  ['place_lga_edo_igueben','place_state_edo','place_zone_south_south','Igueben'],
  ['place_lga_edo_ikpoba_okha','place_state_edo','place_zone_south_south','Ikpoba-Okha','Ikpoba Okha'],
  ['place_lga_edo_orhionmwon','place_state_edo','place_zone_south_south','Orhionmwon'],
  ['place_lga_edo_oredo','place_state_edo','place_zone_south_south','Oredo'],
  ['place_lga_edo_ovia_north_east','place_state_edo','place_zone_south_south','Ovia North-East','Ovia North East'],
  ['place_lga_edo_ovia_south_west','place_state_edo','place_zone_south_south','Ovia South-West','Ovia South West'],
  ['place_lga_edo_owan_east','place_state_edo','place_zone_south_south','Owan East'],
  ['place_lga_edo_owan_west','place_state_edo','place_zone_south_south','Owan West'],
  ['place_lga_edo_uhunmwonde','place_state_edo','place_zone_south_south','Uhunmwonde'],
  // --- Rivers ---
  ['place_lga_rivers_abua_odual','place_state_rivers','place_zone_south_south','Abua/Odual','Abua Odual'],
  ['place_lga_rivers_ahoada_east','place_state_rivers','place_zone_south_south','Ahoada East'],
  ['place_lga_rivers_ahoada_west','place_state_rivers','place_zone_south_south','Ahoada West'],
  ['place_lga_rivers_akuku_toru','place_state_rivers','place_zone_south_south','Akuku-Toru','Akuku Toru'],
  ['place_lga_rivers_andoni','place_state_rivers','place_zone_south_south','Andoni'],
  ['place_lga_rivers_asari_toru','place_state_rivers','place_zone_south_south','Asari-Toru','Asari Toru'],
  ['place_lga_rivers_bonny','place_state_rivers','place_zone_south_south','Bonny'],
  ['place_lga_rivers_degema','place_state_rivers','place_zone_south_south','Degema'],
  ['place_lga_rivers_eleme','place_state_rivers','place_zone_south_south','Eleme'],
  ['place_lga_rivers_emohua','place_state_rivers','place_zone_south_south','Emohua'],
  ['place_lga_rivers_etche','place_state_rivers','place_zone_south_south','Etche'],
  ['place_lga_rivers_gokana','place_state_rivers','place_zone_south_south','Gokana'],
  ['place_lga_rivers_ikwerre','place_state_rivers','place_zone_south_south','Ikwerre'],
  ['place_lga_rivers_khana','place_state_rivers','place_zone_south_south','Khana'],
  ['place_lga_rivers_obio_akpor','place_state_rivers','place_zone_south_south','Obio-Akpor','Obio Akpor'],
  ['place_lga_rivers_ogba_egbema','place_state_rivers','place_zone_south_south','Ogba/Egbema/Ndoni','Ogba Egbema Ndoni'],
  ['place_lga_rivers_ogu_bolo','place_state_rivers','place_zone_south_south','Ogu/Bolo','Ogu Bolo'],
  ['place_lga_rivers_okrika','place_state_rivers','place_zone_south_south','Okrika'],
  ['place_lga_rivers_omuma','place_state_rivers','place_zone_south_south','Omuma'],
  ['place_lga_rivers_opobo_nkoro','place_state_rivers','place_zone_south_south','Opobo/Nkoro','Opobo Nkoro'],
  ['place_lga_rivers_oyigbo','place_state_rivers','place_zone_south_south','Oyigbo'],
  ['place_lga_rivers_port_harcourt','place_state_rivers','place_zone_south_south','Port Harcourt'],
  ['place_lga_rivers_tai','place_state_rivers','place_zone_south_south','Tai'],
  // =========================================================
  // SOUTH WEST
  // =========================================================
  // --- Ekiti ---
  ['place_lga_ekiti_ado_ekiti','place_state_ekiti','place_zone_south_west','Ado Ekiti'],
  ['place_lga_ekiti_efon','place_state_ekiti','place_zone_south_west','Efon'],
  ['place_lga_ekiti_ekiti_east','place_state_ekiti','place_zone_south_west','Ekiti East'],
  ['place_lga_ekiti_ekiti_south_west','place_state_ekiti','place_zone_south_west','Ekiti South-West','Ekiti South West'],
  ['place_lga_ekiti_ekiti_west','place_state_ekiti','place_zone_south_west','Ekiti West'],
  ['place_lga_ekiti_emure','place_state_ekiti','place_zone_south_west','Emure'],
  ['place_lga_ekiti_gbonyin','place_state_ekiti','place_zone_south_west','Gbonyin'],
  ['place_lga_ekiti_ido_osi','place_state_ekiti','place_zone_south_west','Ido/Osi','Ido Osi'],
  ['place_lga_ekiti_ijero','place_state_ekiti','place_zone_south_west','Ijero'],
  ['place_lga_ekiti_ikere','place_state_ekiti','place_zone_south_west','Ikere'],
  ['place_lga_ekiti_ikole','place_state_ekiti','place_zone_south_west','Ikole'],
  ['place_lga_ekiti_ilejemeje','place_state_ekiti','place_zone_south_west','Ilejemeje'],
  ['place_lga_ekiti_irepodun_ifelodun','place_state_ekiti','place_zone_south_west','Irepodun/Ifelodun','Irepodun Ifelodun'],
  ['place_lga_ekiti_ise_orun','place_state_ekiti','place_zone_south_west','Ise/Orun','Ise Orun'],
  ['place_lga_ekiti_moba','place_state_ekiti','place_zone_south_west','Moba'],
  ['place_lga_ekiti_oye','place_state_ekiti','place_zone_south_west','Oye'],
  // --- Lagos ---
  ['place_lga_lagos_agege','place_state_lagos','place_zone_south_west','Agege'],
  ['place_lga_lagos_ajeromi_ifelodun','place_state_lagos','place_zone_south_west','Ajeromi-Ifelodun','Ajeromi Ifelodun'],
  ['place_lga_lagos_alimosho','place_state_lagos','place_zone_south_west','Alimosho'],
  ['place_lga_lagos_amuwo_odofin','place_state_lagos','place_zone_south_west','Amuwo-Odofin','Amuwo Odofin'],
  ['place_lga_lagos_apapa','place_state_lagos','place_zone_south_west','Apapa'],
  ['place_lga_lagos_badagry','place_state_lagos','place_zone_south_west','Badagry'],
  ['place_lga_lagos_epe','place_state_lagos','place_zone_south_west','Epe'],
  ['place_lga_lagos_eti_osa','place_state_lagos','place_zone_south_west','Eti-Osa','Eti Osa'],
  ['place_lga_lagos_ibeju_lekki','place_state_lagos','place_zone_south_west','Ibeju-Lekki','Ibeju Lekki'],
  ['place_lga_lagos_ifako_ijaiye','place_state_lagos','place_zone_south_west','Ifako-Ijaiye','Ifako Ijaiye'],
  ['place_lga_lagos_ikeja','place_state_lagos','place_zone_south_west','Ikeja'],
  ['place_lga_lagos_ikorodu','place_state_lagos','place_zone_south_west','Ikorodu'],
  ['place_lga_lagos_kosofe','place_state_lagos','place_zone_south_west','Kosofe'],
  ['place_lga_lagos_lagos_island','place_state_lagos','place_zone_south_west','Lagos Island'],
  ['place_lga_lagos_lagos_mainland','place_state_lagos','place_zone_south_west','Lagos Mainland'],
  ['place_lga_lagos_mushin','place_state_lagos','place_zone_south_west','Mushin'],
  ['place_lga_lagos_ojo','place_state_lagos','place_zone_south_west','Ojo'],
  ['place_lga_lagos_oshodi_isolo','place_state_lagos','place_zone_south_west','Oshodi-Isolo','Oshodi Isolo'],
  ['place_lga_lagos_shomolu','place_state_lagos','place_zone_south_west','Shomolu'],
  ['place_lga_lagos_surulere','place_state_lagos','place_zone_south_west','Surulere'],
  // --- Ogun ---
  ['place_lga_ogun_abeokuta_north','place_state_ogun','place_zone_south_west','Abeokuta North'],
  ['place_lga_ogun_abeokuta_south','place_state_ogun','place_zone_south_west','Abeokuta South'],
  ['place_lga_ogun_ado_odo_ota','place_state_ogun','place_zone_south_west','Ado-Odo/Ota','Ado Odo Ota'],
  ['place_lga_ogun_ewekoro','place_state_ogun','place_zone_south_west','Ewekoro'],
  ['place_lga_ogun_ifo','place_state_ogun','place_zone_south_west','Ifo'],
  ['place_lga_ogun_ijebu_east','place_state_ogun','place_zone_south_west','Ijebu East'],
  ['place_lga_ogun_ijebu_north','place_state_ogun','place_zone_south_west','Ijebu North'],
  ['place_lga_ogun_ijebu_north_east','place_state_ogun','place_zone_south_west','Ijebu North East'],
  ['place_lga_ogun_ijebu_ode','place_state_ogun','place_zone_south_west','Ijebu Ode'],
  ['place_lga_ogun_ikenne','place_state_ogun','place_zone_south_west','Ikenne'],
  ['place_lga_ogun_ipokia','place_state_ogun','place_zone_south_west','Ipokia'],
  ['place_lga_ogun_obafemi_owode','place_state_ogun','place_zone_south_west','Obafemi Owode','Obafemi-Owode'],
  ['place_lga_ogun_odeda','place_state_ogun','place_zone_south_west','Odeda'],
  ['place_lga_ogun_odogbolu','place_state_ogun','place_zone_south_west','Odogbolu'],
  ['place_lga_ogun_ogun_waterside','place_state_ogun','place_zone_south_west','Ogun Waterside'],
  ['place_lga_ogun_remo_north','place_state_ogun','place_zone_south_west','Remo North'],
  ['place_lga_ogun_sagamu','place_state_ogun','place_zone_south_west','Sagamu','Shagamu'],
  ['place_lga_ogun_yewa_north','place_state_ogun','place_zone_south_west','Yewa North','Egbado North'],
  ['place_lga_ogun_yewa_south','place_state_ogun','place_zone_south_west','Yewa South','Egbado South'],
  ['place_lga_ogun_shagamu','place_state_ogun','place_zone_south_west','Shagamu','Sagamu'],
  // --- Ondo ---
  ['place_lga_ondo_akoko_north_east','place_state_ondo','place_zone_south_west','Akoko North-East','Akoko North East'],
  ['place_lga_ondo_akoko_north_west','place_state_ondo','place_zone_south_west','Akoko North-West','Akoko North West'],
  ['place_lga_ondo_akoko_south_east','place_state_ondo','place_zone_south_west','Akoko South-East','Akoko South East'],
  ['place_lga_ondo_akoko_south_west','place_state_ondo','place_zone_south_west','Akoko South-West','Akoko South West'],
  ['place_lga_ondo_akure_north','place_state_ondo','place_zone_south_west','Akure North'],
  ['place_lga_ondo_akure_south','place_state_ondo','place_zone_south_west','Akure South'],
  ['place_lga_ondo_ese_odo','place_state_ondo','place_zone_south_west','Ese Odo'],
  ['place_lga_ondo_idanre','place_state_ondo','place_zone_south_west','Idanre'],
  ['place_lga_ondo_ifedore','place_state_ondo','place_zone_south_west','Ifedore'],
  ['place_lga_ondo_ilaje','place_state_ondo','place_zone_south_west','Ilaje'],
  ['place_lga_ondo_ile_oluji','place_state_ondo','place_zone_south_west','Ile Oluji/Okeigbo','Ile Oluji Okeigbo'],
  ['place_lga_ondo_irele','place_state_ondo','place_zone_south_west','Irele'],
  ['place_lga_ondo_odigbo','place_state_ondo','place_zone_south_west','Odigbo'],
  ['place_lga_ondo_okitipupa','place_state_ondo','place_zone_south_west','Okitipupa'],
  ['place_lga_ondo_ondo_east','place_state_ondo','place_zone_south_west','Ondo East'],
  ['place_lga_ondo_ondo_west','place_state_ondo','place_zone_south_west','Ondo West'],
  ['place_lga_ondo_ose','place_state_ondo','place_zone_south_west','Ose'],
  ['place_lga_ondo_owo','place_state_ondo','place_zone_south_west','Owo'],
  // --- Osun ---
  ['place_lga_osun_aiyedaade','place_state_osun','place_zone_south_west','Aiyedaade'],
  ['place_lga_osun_aiyedire','place_state_osun','place_zone_south_west','Aiyedire'],
  ['place_lga_osun_atakumosa_east','place_state_osun','place_zone_south_west','Atakumosa East'],
  ['place_lga_osun_atakumosa_west','place_state_osun','place_zone_south_west','Atakumosa West'],
  ['place_lga_osun_boluwaduro','place_state_osun','place_zone_south_west','Boluwaduro'],
  ['place_lga_osun_boripe','place_state_osun','place_zone_south_west','Boripe'],
  ['place_lga_osun_ede_north','place_state_osun','place_zone_south_west','Ede North'],
  ['place_lga_osun_ede_south','place_state_osun','place_zone_south_west','Ede South'],
  ['place_lga_osun_egbedore','place_state_osun','place_zone_south_west','Egbedore'],
  ['place_lga_osun_ejigbo','place_state_osun','place_zone_south_west','Ejigbo'],
  ['place_lga_osun_ife_central','place_state_osun','place_zone_south_west','Ife Central'],
  ['place_lga_osun_ife_east','place_state_osun','place_zone_south_west','Ife East'],
  ['place_lga_osun_ife_north','place_state_osun','place_zone_south_west','Ife North'],
  ['place_lga_osun_ife_south','place_state_osun','place_zone_south_west','Ife South'],
  ['place_lga_osun_ifedayo','place_state_osun','place_zone_south_west','Ifedayo'],
  ['place_lga_osun_ifelodun','place_state_osun','place_zone_south_west','Ifelodun'],
  ['place_lga_osun_ila','place_state_osun','place_zone_south_west','Ila'],
  ['place_lga_osun_ilesa_east','place_state_osun','place_zone_south_west','Ilesa East'],
  ['place_lga_osun_ilesa_west','place_state_osun','place_zone_south_west','Ilesa West'],
  ['place_lga_osun_irepodun','place_state_osun','place_zone_south_west','Irepodun'],
  ['place_lga_osun_irewole','place_state_osun','place_zone_south_west','Irewole'],
  ['place_lga_osun_isokan','place_state_osun','place_zone_south_west','Isokan'],
  ['place_lga_osun_iwo','place_state_osun','place_zone_south_west','Iwo'],
  ['place_lga_osun_obokun','place_state_osun','place_zone_south_west','Obokun'],
  ['place_lga_osun_odo_otin','place_state_osun','place_zone_south_west','Odo Otin'],
  ['place_lga_osun_ola_oluwa','place_state_osun','place_zone_south_west','Ola-Oluwa','Ola Oluwa'],
  ['place_lga_osun_olorunda','place_state_osun','place_zone_south_west','Olorunda'],
  ['place_lga_osun_oriade','place_state_osun','place_zone_south_west','Oriade'],
  ['place_lga_osun_orolu','place_state_osun','place_zone_south_west','Orolu'],
  ['place_lga_osun_osogbo','place_state_osun','place_zone_south_west','Osogbo'],
  // --- Oyo ---
  ['place_lga_oyo_afijio','place_state_oyo','place_zone_south_west','Afijio'],
  ['place_lga_oyo_akinyele','place_state_oyo','place_zone_south_west','Akinyele'],
  ['place_lga_oyo_atiba','place_state_oyo','place_zone_south_west','Atiba'],
  ['place_lga_oyo_atisbo','place_state_oyo','place_zone_south_west','Atisbo'],
  ['place_lga_oyo_egbeda','place_state_oyo','place_zone_south_west','Egbeda'],
  ['place_lga_oyo_ibadan_north','place_state_oyo','place_zone_south_west','Ibadan North'],
  ['place_lga_oyo_ibadan_north_east','place_state_oyo','place_zone_south_west','Ibadan North-East','Ibadan North East'],
  ['place_lga_oyo_ibadan_north_west','place_state_oyo','place_zone_south_west','Ibadan North-West','Ibadan North West'],
  ['place_lga_oyo_ibadan_south_east','place_state_oyo','place_zone_south_west','Ibadan South-East','Ibadan South East'],
  ['place_lga_oyo_ibadan_south_west','place_state_oyo','place_zone_south_west','Ibadan South-West','Ibadan South West'],
  ['place_lga_oyo_ibarapa_central','place_state_oyo','place_zone_south_west','Ibarapa Central'],
  ['place_lga_oyo_ibarapa_east','place_state_oyo','place_zone_south_west','Ibarapa East'],
  ['place_lga_oyo_ibarapa_north','place_state_oyo','place_zone_south_west','Ibarapa North'],
  ['place_lga_oyo_ido','place_state_oyo','place_zone_south_west','Ido'],
  ['place_lga_oyo_irepo','place_state_oyo','place_zone_south_west','Irepo'],
  ['place_lga_oyo_iseyin','place_state_oyo','place_zone_south_west','Iseyin'],
  ['place_lga_oyo_itesiwaju','place_state_oyo','place_zone_south_west','Itesiwaju'],
  ['place_lga_oyo_iwajowa','place_state_oyo','place_zone_south_west','Iwajowa'],
  ['place_lga_oyo_kajola','place_state_oyo','place_zone_south_west','Kajola'],
  ['place_lga_oyo_lagelu','place_state_oyo','place_zone_south_west','Lagelu'],
  ['place_lga_oyo_ogbomosho_north','place_state_oyo','place_zone_south_west','Ogbomosho North'],
  ['place_lga_oyo_ogbomosho_south','place_state_oyo','place_zone_south_west','Ogbomosho South'],
  ['place_lga_oyo_ogo_oluwa','place_state_oyo','place_zone_south_west','Ogo Oluwa'],
  ['place_lga_oyo_olorunsogo','place_state_oyo','place_zone_south_west','Olorunsogo'],
  ['place_lga_oyo_oluyole','place_state_oyo','place_zone_south_west','Oluyole'],
  ['place_lga_oyo_ona_ara','place_state_oyo','place_zone_south_west','Ona Ara'],
  ['place_lga_oyo_orelope','place_state_oyo','place_zone_south_west','Orelope'],
  ['place_lga_oyo_ori_ire','place_state_oyo','place_zone_south_west','Ori Ire'],
  ['place_lga_oyo_oyo_east','place_state_oyo','place_zone_south_west','Oyo East'],
  ['place_lga_oyo_oyo_west','place_state_oyo','place_zone_south_west','Oyo West'],
  ['place_lga_oyo_saki_east','place_state_oyo','place_zone_south_west','Saki East'],
  ['place_lga_oyo_saki_west','place_state_oyo','place_zone_south_west','Saki West'],
  ['place_lga_oyo_surulere','place_state_oyo','place_zone_south_west','Surulere'],
];

// ---------------------------------------------------------------------------
// Build two lookup maps from the raw table:
//   1. By canonical name key  (state, lga) → LgaRecord
//   2. By alias key           (state, alias) → LgaRecord
// ---------------------------------------------------------------------------

/** Map key: `<stateKey>||<normalisedLgaName>` → LgaRecord */
const lgaByNormalisedName = new Map<string, LgaRecord>();

// State name → stateKey mapping (INEC uses various state spellings)
const STATE_KEY_MAP: Record<string, string> = {
  'abia': 'abia',
  'adamawa': 'adamawa',
  'akwa ibom': 'akwaibom',
  'akwaibom': 'akwaibom',
  'anambra': 'anambra',
  'bauchi': 'bauchi',
  'bayelsa': 'bayelsa',
  'benue': 'benue',
  'borno': 'borno',
  'cross river': 'crossriver',
  'crossriver': 'crossriver',
  'delta': 'delta',
  'ebonyi': 'ebonyi',
  'edo': 'edo',
  'ekiti': 'ekiti',
  'enugu': 'enugu',
  'fct': 'fct',
  'abuja': 'fct',
  'federal capital territory': 'fct',
  'gombe': 'gombe',
  'imo': 'imo',
  'jigawa': 'jigawa',
  'kaduna': 'kaduna',
  'kano': 'kano',
  'katsina': 'katsina',
  'kebbi': 'kebbi',
  'kogi': 'kogi',
  'kwara': 'kwara',
  'lagos': 'lagos',
  'nasarawa': 'nasarawa',
  'niger': 'niger',
  'ogun': 'ogun',
  'ondo': 'ondo',
  'osun': 'osun',
  'oyo': 'oyo',
  'plateau': 'plateau',
  'rivers': 'rivers',
  'river': 'rivers',
  'sokoto': 'sokoto',
  'taraba': 'taraba',
  'yobe': 'yobe',
  'zamfara': 'zamfara',
};

// Populate lookup maps
for (const row of RAW_LGA_TABLE) {
  const [placeId, statePlaceId, zonePlaceId, canonicalName, ...aliases] = row;
  // Derive stateKey from statePlaceId: "place_state_kano" → "kano"
  const stateKey = statePlaceId.replace('place_state_', '');
  const lgaKey   = placeId.replace(`place_lga_${stateKey}_`, '');

  const record: LgaRecord = {
    placeId, statePlaceId, zonePlaceId, stateKey, lgaKey,
    canonicalName,
    aliases: [canonicalName, ...aliases],
  };

  // Index by every alias
  for (const alias of record.aliases) {
    const key = `${stateKey}||${normalise(alias)}`;
    lgaByNormalisedName.set(key, record);
  }
}

// ---------------------------------------------------------------------------
// LGA lookup  (state name from CSV → stateKey, lga name from CSV → LgaRecord)
// ---------------------------------------------------------------------------

function lookupLga(stateName: string, lgaName: string): LgaRecord | null {
  const stateKey = STATE_KEY_MAP[normalise(stateName)];
  if (!stateKey) return null;

  const key = `${stateKey}||${normalise(lgaName)}`;
  return lgaByNormalisedName.get(key) ?? null;
}

// ---------------------------------------------------------------------------
// CSV parsing  (handles quoted fields, multiple delimiter styles)
// ---------------------------------------------------------------------------

function detectDelimiter(headerLine: string): string {
  const counts = {
    ',': (headerLine.match(/,/g) ?? []).length,
    ';': (headerLine.match(/;/g) ?? []).length,
    '\t': (headerLine.match(/\t/g) ?? []).length,
    '|': (headerLine.match(/\|/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function detectColumns(headers: string[]): { stateIdx: number; lgaIdx: number; wardIdx: number } | null {
  const h = headers.map((s) => s.toLowerCase().replace(/[^a-z]/g, ''));
  const stateIdx = h.findIndex((s) => ['state','statename','statetname'].includes(s));
  const lgaIdx   = h.findIndex((s) => ['lga','lganame','lgaame'].includes(s));
  const wardIdx  = h.findIndex((s) => ['ward','wardname','wardname'].includes(s));

  if (stateIdx === -1 || lgaIdx === -1 || wardIdx === -1) {
    // Try positional fallback: assume State=0, LGA=1, Ward=2
    if (headers.length >= 3) {
      return { stateIdx: 0, lgaIdx: 1, wardIdx: 2 };
    }
    return null;
  }
  return { stateIdx, lgaIdx, wardIdx };
}

// ---------------------------------------------------------------------------
// Ward slug de-duplication within each LGA
// ---------------------------------------------------------------------------

/** Track ward slugs per LGA to avoid duplicate IDs when ward names normalise the same. */
const wardSlugCounters = new Map<string, Map<string, number>>();

function getUniqueWardId(lgaPlaceId: string, wardName: string): string {
  const base = slugify(wardName);

  if (!wardSlugCounters.has(lgaPlaceId)) {
    wardSlugCounters.set(lgaPlaceId, new Map());
  }
  const counters = wardSlugCounters.get(lgaPlaceId)!;
  const count = counters.get(base) ?? 0;
  counters.set(base, count + 1);

  const suffix = count === 0 ? '' : `_${count}`;
  const lgaSlug = lgaPlaceId.replace('place_lga_', '');
  return `place_ward_${lgaSlug}_${base}${suffix}`;
}

// ---------------------------------------------------------------------------
// SQL generation helpers
// ---------------------------------------------------------------------------

const SQL_BATCH_SIZE = 50;

function buildInsertBlock(
  rows: Array<{
    id: string;
    name: string;
    parentId: string;
    statePlaceId: string;
    zonePlaceId: string;
  }>,
  comment: string,
): string {
  if (rows.length === 0) return '';

  const lines = rows.map(({ id, name, parentId, statePlaceId, zonePlaceId }) => {
    const ancestryPath = JSON.stringify([
      'place_nigeria_001',
      zonePlaceId,
      statePlaceId,
      parentId,
    ]);
    return (
      `  ('${id}', '${sqlEscape(name)}', 'ward', 5, '${parentId}',` +
      ` '${sqlEscape(ancestryPath)}', NULL)`
    );
  });

  return (
    `-- ${comment}\n` +
    `INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id) VALUES\n` +
    lines.join(',\n') +
    `;\n`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('Usage: npx tsx generate_wards_sql.ts <path-to-inec-wards.csv>');
    console.error('');
    console.error('Download from: https://www.inec.gov.ng (ward list CSV)');
    process.exit(1);
  }

  const resolvedCsvPath = path.resolve(csvPath);
  if (!fs.existsSync(resolvedCsvPath)) {
    console.error(`File not found: ${resolvedCsvPath}`);
    process.exit(1);
  }

  // Resolve output paths relative to project root
  const scriptDir  = path.dirname(new URL(import.meta.url).pathname);
  const seedDir    = path.resolve(scriptDir, '..');
  const outputSql  = path.join(seedDir, '0003_wards.sql');
  const unmatchedF = path.join(scriptDir, 'unmatched_lgas.txt');

  console.log(`Reading:  ${resolvedCsvPath}`);
  console.log(`Writing:  ${outputSql}`);

  // --- Read CSV ---
  const rl = readline.createInterface({
    input: createReadStream(resolvedCsvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const rawLines: string[] = [];
  for await (const line of rl) {
    rawLines.push(line);
  }

  if (rawLines.length < 2) {
    console.error('CSV file appears empty or has only headers.');
    process.exit(1);
  }

  const delimiter = detectDelimiter(rawLines[0]);
  const headers   = parseCSVLine(rawLines[0], delimiter);
  const cols      = detectColumns(headers);

  if (!cols) {
    console.error('Could not detect State/LGA/Ward columns in CSV headers:');
    console.error(headers.join(' | '));
    process.exit(1);
  }

  console.log(`Detected delimiter: '${delimiter === '\t' ? '\\t' : delimiter}'`);
  console.log(`Columns: State=${cols.stateIdx}, LGA=${cols.lgaIdx}, Ward=${cols.wardIdx}`);

  // --- Parse rows ---
  const wardRows: WardRow[] = [];
  let skippedEmpty = 0;

  for (let i = 1; i < rawLines.length; i++) {
    const fields = parseCSVLine(rawLines[i], delimiter);
    const stateName = fields[cols.stateIdx]?.trim() ?? '';
    const lgaName   = fields[cols.lgaIdx]?.trim()   ?? '';
    const wardName  = fields[cols.wardIdx]?.trim()  ?? '';

    if (!stateName || !lgaName || !wardName) {
      skippedEmpty++;
      continue;
    }
    wardRows.push({ stateName, lgaName, wardName });
  }

  console.log(`Parsed ${wardRows.length} ward rows (skipped ${skippedEmpty} empty).`);

  // --- Group by LGA, track unmatched ---
  type WardGroup = {
    lga: LgaRecord;
    wards: string[];
  };

  const lgaGroups = new Map<string, WardGroup>();
  const unmatchedMap = new Map<string, UnmatchedLga>();

  for (const { stateName, lgaName, wardName } of wardRows) {
    const lga = lookupLga(stateName, lgaName);

    if (!lga) {
      const key = `${stateName}||${lgaName}`;
      const existing = unmatchedMap.get(key);
      if (existing) {
        existing.rowCount++;
      } else {
        unmatchedMap.set(key, { stateName, lgaName, rowCount: 1 });
      }
      continue;
    }

    const existing = lgaGroups.get(lga.placeId);
    if (existing) {
      existing.wards.push(wardName);
    } else {
      lgaGroups.set(lga.placeId, { lga, wards: [wardName] });
    }
  }

  // --- Build SQL output ---
  const sqlParts: string[] = [];

  sqlParts.push(`-- =============================================================
-- Seed: All Nigerian Wards (level 5)
-- Generated by: infra/db/seed/scripts/generate_wards_sql.ts
-- Source CSV: ${path.basename(resolvedCsvPath)}
-- Generated at: ${new Date().toISOString()}
-- Total wards: ${wardRows.length - unmatchedMap.size} matched
-- Unmatched LGAs: ${unmatchedMap.size}
-- =============================================================
`);

  // Group by zone → state → LGA for organised SQL output
  const zoneOrder = [
    'place_zone_north_central',
    'place_zone_north_east',
    'place_zone_north_west',
    'place_zone_south_east',
    'place_zone_south_south',
    'place_zone_south_west',
  ];

  const ZONE_LABELS: Record<string, string> = {
    'place_zone_north_central': 'NORTH CENTRAL',
    'place_zone_north_east':    'NORTH EAST',
    'place_zone_north_west':    'NORTH WEST',
    'place_zone_south_east':    'SOUTH EAST',
    'place_zone_south_south':   'SOUTH SOUTH',
    'place_zone_south_west':    'SOUTH WEST',
  };

  // Bucket groups by zone
  const byZone = new Map<string, WardGroup[]>();
  for (const zone of zoneOrder) byZone.set(zone, []);

  for (const group of lgaGroups.values()) {
    const bucket = byZone.get(group.lga.zonePlaceId);
    if (bucket) bucket.push(group);
  }

  // Summary stats
  const statsSummary: Array<[string, number, number]> = []; // [stateKey, lgaCount, wardCount]
  const stateAcc = new Map<string, { lgaCount: number; wardCount: number }>();

  for (const zone of zoneOrder) {
    const groups = byZone.get(zone) ?? [];
    if (groups.length === 0) continue;

    sqlParts.push(`-- ===========================================================\n-- ${ZONE_LABELS[zone]}\n-- ===========================================================\n`);

    // Sort by state then LGA
    groups.sort((a, b) =>
      a.lga.stateKey.localeCompare(b.lga.stateKey) ||
      a.lga.lgaKey.localeCompare(b.lga.lgaKey),
    );

    for (const group of groups) {
      const { lga, wards } = group;

      // Accumulate stats
      const acc = stateAcc.get(lga.stateKey) ?? { lgaCount: 0, wardCount: 0 };
      acc.lgaCount++;
      acc.wardCount += wards.length;
      stateAcc.set(lga.stateKey, acc);

      // Emit in batches of SQL_BATCH_SIZE
      let batchNo = 0;
      for (let i = 0; i < wards.length; i += SQL_BATCH_SIZE) {
        const batch = wards.slice(i, i + SQL_BATCH_SIZE);

        const insertRows = batch.map((wardName) => ({
          id:          getUniqueWardId(lga.placeId, wardName),
          name:        wardName,
          parentId:    lga.placeId,
          statePlaceId: lga.statePlaceId,
          zonePlaceId:  lga.zonePlaceId,
        }));

        const batchLabel = wards.length > SQL_BATCH_SIZE
          ? `${lga.canonicalName} — batch ${++batchNo} of ${Math.ceil(wards.length / SQL_BATCH_SIZE)}`
          : lga.canonicalName;

        sqlParts.push(buildInsertBlock(insertRows, `${lga.statePlaceId} / ${batchLabel} (${batch.length} wards)`));
      }
    }
  }

  // --- Write SQL file ---
  fs.writeFileSync(outputSql, sqlParts.join('\n'), 'utf8');
  console.log(`\nWrote SQL: ${outputSql}`);

  // --- Print summary table ---
  console.log('\n=== Summary ===');
  console.log('State'.padEnd(20) + 'LGAs'.padStart(6) + 'Wards'.padStart(8));
  console.log('-'.repeat(36));
  let totalLgas = 0, totalWards = 0;
  for (const [stateKey, { lgaCount, wardCount }] of [...stateAcc.entries()].sort()) {
    console.log(stateKey.padEnd(20) + String(lgaCount).padStart(6) + String(wardCount).padStart(8));
    totalLgas  += lgaCount;
    totalWards += wardCount;
  }
  console.log('-'.repeat(36));
  console.log('TOTAL'.padEnd(20) + String(totalLgas).padStart(6) + String(totalWards).padStart(8));

  // --- Write unmatched LGAs ---
  if (unmatchedMap.size > 0) {
    const lines = [
      '# Unmatched LGAs',
      '# Fix by adding aliases to RAW_LGA_TABLE in generate_wards_sql.ts',
      '# then re-run the script.',
      '',
      '# State | LGA | Ward Rows',
      ...Array.from(unmatchedMap.values()).map(
        ({ stateName, lgaName, rowCount }) =>
          `${stateName} | ${lgaName} | ${rowCount} rows`,
      ),
    ];
    fs.writeFileSync(unmatchedF, lines.join('\n'), 'utf8');
    console.log(`\n⚠  ${unmatchedMap.size} LGA(s) could not be matched.`);
    console.log(`   See: ${unmatchedF}`);
    console.log('   Add the spelling as an alias in RAW_LGA_TABLE and re-run.');
  } else {
    console.log('\n✓ All LGAs matched successfully.');
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
