/**
 * Spain administrative geography types.
 *
 * These types conform to the SessionItemLike shape expected by useSession
 * (name, capital, coordinates, id) so the generic session engine can
 * be used directly without any Spain-specific engine changes.
 */

export type SpainCategory =
  | "autonomous_community"
  | "province"
  | "capital_autonomous_community"
  | "capital_province";

export interface SpainEntity {
  /** Canonical identifier — ISO 3166-2 subdivision code, e.g. 'ES-AN', 'ES-VI', 'ES-SVQ' */
  id: string;
  /** Primary display name (may be bilingual if both forms are officially used) */
  name: string;
  /** Alternative official name (e.g. Catalan/Valencian/Basque form) */
  nameAlt?: string;
  /** Always 'spain' for this module */
  domain: "spain";
  /** Entity classification */
  category: SpainCategory;
  /** [lat, lng] centroid / anchor — for administrative units this is the capital location */
  coordinates: [number, number];
  /** Geometry representation type */
  geometryKind: "polygon" | "point" | "line";
  /** ID of the parent entity in the hierarchy */
  parentId?: string;
  /** ID of the capital entity (only on CCAA and province entities) */
  capitalId?: string;
  /** Name of the capital (denormalised for quiz convenience) */
  capital?: string;
  /** Flag asset code (only on autonomous_community entities) — e.g. 'es-an' */
  flagCode?: string;
  /** 2-digit INE code used in the TopoJSON, e.g. '01', '28' */
  ineCode?: string;
}

/** The INE 2-digit code → ISO 3166-2 mapping for Autonomous Communities. */
export const CCAA_INE_TO_ISO: Record<string, string> = {
  "01": "ES-AN",
  "02": "ES-AR",
  "03": "ES-AS",
  "04": "ES-IB",
  "05": "ES-CN",
  "06": "ES-CB",
  "07": "ES-CL",
  "08": "ES-CM",
  "09": "ES-CT",
  "10": "ES-VC",
  "11": "ES-EX",
  "12": "ES-GA",
  "13": "ES-MD",
  "14": "ES-MC",
  "15": "ES-NC",
  "16": "ES-PV",
  "17": "ES-RI",
  "18": "ES-CE",
  "19": "ES-ML",
};

/** The INE 2-digit code → ISO 3166-2 mapping for Provinces. */
export const PROVINCE_INE_TO_ISO: Record<string, string> = {
  "01": "ES-VI",
  "02": "ES-AB",
  "03": "ES-A",
  "04": "ES-AL",
  "05": "ES-AV",
  "06": "ES-BA",
  "07": "ES-PM",
  "08": "ES-B",
  "09": "ES-BU",
  "10": "ES-CC",
  "11": "ES-CA",
  "12": "ES-CS",
  "13": "ES-CR",
  "14": "ES-CO",
  "15": "ES-C",
  "16": "ES-CU",
  "17": "ES-GI",
  "18": "ES-GR",
  "19": "ES-GU",
  "20": "ES-SS",
  "21": "ES-H",
  "22": "ES-HU",
  "23": "ES-J",
  "24": "ES-LE",
  "25": "ES-L",
  "26": "ES-LO",
  "27": "ES-LU",
  "28": "ES-M",
  "29": "ES-MA",
  "30": "ES-MU",
  "31": "ES-NA",
  "32": "ES-OR",
  "33": "ES-O",
  "34": "ES-P",
  "35": "ES-GC",
  "36": "ES-PO",
  "37": "ES-SA",
  "38": "ES-TF",
  "39": "ES-S",
  "40": "ES-SG",
  "41": "ES-SE",
  "42": "ES-SO",
  "43": "ES-T",
  "44": "ES-TE",
  "45": "ES-TO",
  "46": "ES-V",
  "47": "ES-VA",
  "48": "ES-BI",
  "49": "ES-ZA",
  "50": "ES-Z",
  "51": "ES-CE",
  "52": "ES-ML",
};
