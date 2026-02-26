// ==============================================
// נתוני יישובים בישראל - נשלפים מ-3 מקורות API של data.gov.il
// 1. רשות האוכלוסין - אוכלוסייה לפי קבוצות גיל
// 2. מפקד 2022 - נתונים נבחרים (צפיפות, גיל חציוני, שכר, אקדמאים, תעסוקה ועוד)
// 3. מדד חברתי-כלכלי 2019
// ==============================================

const DATA_API = {
  POPULATION: {
    id: "64edd0ee-3d5d-43ce-8562-c336c24dbc1f",
    label: "אוכלוסייה לפי גיל",
  },
  CENSUS2022: {
    id: "9a9e085f-3bc8-41df-b15f-be0daaf99e30",
    label: "מפקד 2022",
  },
  SOCIOECONOMIC: {
    id: "7c860e04-9f8d-41c2-9f24-6249958d2081",
    label: "מדד חברתי-כלכלי",
  },
  BASE_URL: "https://data.gov.il/api/3/action/datastore_search",
  PAGE_SIZE: 10000,
};

// נפות -> מחוזות
const NAPA_TO_MAHOZ = {
  "ירושלים": "ירושלים", "בית שמש": "ירושלים",
  "צפת": "צפון", "כנרת": "צפון", "גולן": "צפון", "עכו": "צפון", "יזרעאל": "צפון",
  "חיפה": "חיפה", "חדרה": "חיפה",
  "השרון": "מרכז", "פתח תקוה": "מרכז", "פתח תקווה": "מרכז", "רמלה": "מרכז", "רחובות": "מרכז",
  "תל אביב": "תל אביב",
  "אשקלון": "דרום", "באר שבע": "דרום", "אשדוד": "דרום",
};

let YISHUVIM = [];
let DATA_LOADED = false;
let LOAD_ERROR = null;

// ====== פונקציית שליפה עם דפדוף ======
async function fetchAll(resourceId, onProgress) {
  let all = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const url = `${DATA_API.BASE_URL}?resource_id=${resourceId}&limit=${DATA_API.PAGE_SIZE}&offset=${offset}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const json = await resp.json();
    total = json.result.total;
    all = all.concat(json.result.records);
    offset += DATA_API.PAGE_SIZE;
    if (onProgress) onProgress(Math.min(100, Math.round((offset / total) * 100)));
  }
  return all;
}

// ====== שליפת מפקד 2022 - רק ברמת ישוב ======
async function fetchCensus2022(onProgress) {
  const all = await fetchAll(DATA_API.CENSUS2022.id, onProgress);
  // סינון רק ברמת יישוב (StatArea ריק)
  return all.filter(r => r.LocalityCode && (!r.StatArea || r.StatArea === "" || r.StatArea === null));
}

// ====== שליפת מדד חברתי-כלכלי ======
async function fetchSocioEconomic(onProgress) {
  return await fetchAll(DATA_API.SOCIOECONOMIC.id, onProgress);
}

// ====== מיזוג ועיבוד כל הנתונים ======
function mergeAndProcess(popRecords, censusRecords, socioRecords) {
  // בניית מפות לפי קוד ישוב
  const censusMap = {};
  censusRecords.forEach(r => {
    const code = String(r.LocalityCode).trim();
    if (code) censusMap[code] = r;
  });

  const socioMap = {};
  socioRecords.forEach(r => {
    const code = String(r["LOCALITY SYMBOL"]).trim();
    if (code) socioMap[code] = r;
  });

  return popRecords
    .filter(r => r["סהכ"] && r["סהכ"] > 0 && r["סמל_ישוב"] > 0)
    .map(r => {
      const code = String(r["סמל_ישוב"]).trim();
      const name = (r["שם_ישוב"] || "").trim();
      const napa = (r["נפה"] || "").trim();
      const council = (r["מועצה_אזורית"] || "").trim();
      const population = r["סהכ"] || 0;
      const age0_5 = r["גיל_0_5"] || 0;
      const age6_18 = r["גיל_6_18"] || 0;
      const age19_45 = r["גיל_19_45"] || 0;
      const age46_55 = r["גיל_46_55"] || 0;
      const age56_64 = r["גיל_56_64"] || 0;
      const age65plus = r["גיל_65_פלוס"] || 0;
      const district = NAPA_TO_MAHOZ[napa] || napa;
      const type = council && council.trim() !== "" ? "מועצה אזורית" : (population >= 20000 ? "עיר" : "יישוב");

      // מפקד 2022
      const c = censusMap[code] || {};
      const density = parseFloat(c.pop_density) || null;
      const medianAge = parseFloat(c.age_median) || null;
      const medianWage = parseFloat(c.employeesAnnual_medWage) || null;
      const academicPct = parseFloat(c.AcadmCert_pcnt) || null;
      const employmentPct = parseFloat(c.Empl_pcnt) || null;
      const avgHouseholdSize = parseFloat(c.size_avg) || null;
      const religion = c.ReligionHeb || null;
      const sexRatio = parseFloat(c.sexRatio) || null;
      const avgChildrenBorn = parseFloat(c.ChldBorn_avg) || null;
      const medianMarriageAge = parseFloat(c.MarriageAge_mdn) || null;
      const workParticipation = parseFloat(c.WrkY_pcnt) || null;
      const ownPct = parseFloat(c.own_pcnt) || null;
      const rentPct = parseFloat(c.rent_pcnt) || null;

      // מדד חברתי-כלכלי
      const s = socioMap[code] || {};
      const socioCluster = parseFloat(s["ESHKOL 2019"]) || null;

      return {
        name,
        code,
        population,
        district,
        napa,
        council,
        type,
        age0_5,
        age6_18,
        age19_45,
        age46_55,
        age56_64,
        age65plus,
        youthPercent: population > 0 ? Math.round(((age0_5 + age6_18) / population) * 100) : 0,
        elderPercent: population > 0 ? Math.round((age65plus / population) * 100) : 0,
        density,
        medianAge,
        medianWage,
        academicPct,
        employmentPct,
        avgHouseholdSize,
        religion,
        sexRatio,
        avgChildrenBorn,
        medianMarriageAge,
        workParticipation,
        ownPct,
        rentPct,
        socioCluster,
      };
    })
    .sort((a, b) => b.population - a.population);
}

// ====== טעינה ראשית ======
async function loadData(onStatus) {
  try {
    const status = (msg) => {
      const el = document.getElementById("loading-status");
      if (el) el.textContent = msg;
      if (onStatus) onStatus(msg);
    };

    status("טוען נתונים מ-3 מקורות במקביל...");
    const [popRecords, censusRecords, socioRecords] = await Promise.all([
      fetchAll(DATA_API.POPULATION.id),
      fetchCensus2022(),
      fetchSocioEconomic(),
    ]);

    status("ממזג ומעבד נתונים...");
    YISHUVIM = mergeAndProcess(popRecords, censusRecords, socioRecords);
    DATA_LOADED = true;

    status(`נטענו ${YISHUVIM.length} יישובים`);
    return YISHUVIM;
  } catch (err) {
    LOAD_ERROR = err;
    console.error("שגיאה בטעינת נתונים:", err);
    throw err;
  }
}

// ====== קטגוריות מיון ======
const RANKING_CATEGORIES = [
  { id: "population", label: "אוכלוסייה", icon: "👥", unit: "תושבים", key: "population" },
  { id: "youthPercent", label: "% צעירים (0-18)", icon: "👶", unit: "%", key: "youthPercent" },
  { id: "elderPercent", label: "% קשישים (65+)", icon: "👴", unit: "%", key: "elderPercent" },
  { id: "density", label: "צפיפות", icon: "🏘️", unit: "לקמ״ר", key: "density" },
  { id: "medianAge", label: "גיל חציוני", icon: "📅", unit: "", key: "medianAge" },
  { id: "medianWage", label: "שכר חציוני", icon: "💰", unit: "₪", key: "medianWage" },
  { id: "academicPct", label: "% אקדמאים", icon: "🎓", unit: "%", key: "academicPct" },
  { id: "employmentPct", label: "% מועסקים", icon: "💼", unit: "%", key: "employmentPct" },
  { id: "socioCluster", label: "אשכול חברתי-כלכלי", icon: "📊", unit: "", key: "socioCluster" },
  { id: "avgHouseholdSize", label: "גודל משק בית", icon: "🏠", unit: "", key: "avgHouseholdSize" },
  { id: "avgChildrenBorn", label: "ילדים שנולדו (ממוצע)", icon: "👶", unit: "", key: "avgChildrenBorn" },
];

const DISTRICTS = ["הכל", "ירושלים", "תל אביב", "חיפה", "מרכז", "צפון", "דרום"];
const TYPES = ["הכל", "עיר", "יישוב", "מועצה אזורית"];

// ====== הגדרות פילטרים מתקדמים ======
const FILTER_FIELDS = [
  { id: "population", label: "אוכלוסייה", icon: "👥", type: "range", min: 0, max: 1000000, step: 1000, format: "number" },
  { id: "socioCluster", label: "אשכול חברתי-כלכלי", icon: "📊", type: "range", min: 1, max: 10, step: 1, format: "number" },
  { id: "medianAge", label: "גיל חציוני", icon: "📅", type: "range", min: 15, max: 50, step: 1, format: "number" },
  { id: "medianWage", label: "שכר חציוני שנתי (₪)", icon: "💰", type: "range", min: 0, max: 400000, step: 5000, format: "number" },
  { id: "academicPct", label: "% אקדמאים", icon: "🎓", type: "range", min: 0, max: 70, step: 1, format: "pct" },
  { id: "employmentPct", label: "% מועסקים", icon: "💼", type: "range", min: 0, max: 100, step: 1, format: "pct" },
  { id: "density", label: "צפיפות (לקמ״ר)", icon: "🏘️", type: "range", min: 0, max: 30000, step: 500, format: "number" },
  { id: "avgHouseholdSize", label: "גודל משק בית ממוצע", icon: "🏠", type: "range", min: 1, max: 8, step: 0.5, format: "number" },
  { id: "religion", label: "דת עיקרית", icon: "🛐", type: "select", options: ["הכל", "יהודים", "מוסלמים", "נוצרים", "דרוזים"] },
];
