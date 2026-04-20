/* ===== CHASKIS PRICING MOCK =====
 * Simule l'endpoint /api/pricing du CRM.
 * Brackets, zones et formule identiques a Chaskis/src/app/pricing/config.ts + calculate.ts.
 * Le jour ou l'endpoint reel existe : remplacer le contenu de estimatePrice() par fetch('/api/pricing', ...).
 * Autocomplete/geocoding via api3.geo.admin.ch (public, pas de cle).
 * Routing via OpenRouteService (cle ci-dessous), fallback haversine.
 */

const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY1NDdjYjVlMzc0ODQ1ZTk4MDg1MzljMTczMzgyZmI2IiwiaCI6Im11cm11cjY0In0=';

const VAT_RATE = 0.077;

/* ===== ZONES ===== */
const ZONES = [
  {
    id: 1, code: 'geneva', name: 'Genève', shortLabel: 'Genève',
    centerAddress: '69 rue des Vollandes, 1207 Genève',
    centerCoords: { lat: 46.2044, lng: 6.1569 },
    urgencySupplement: 10,
    pickupAndDelivery: ['1201','1202','1203','1204','1205','1206','1207','1208','1209','1212','1213','1215','1217','1218','1219','1222','1223','1224','1225','1226','1227','1228','1245','1253','1290'],
    deliveryOnly: ['1232','1233','1234','1236','1237','1239','1241','1242','1243','1244','1246','1247','1248','1251','1252','1254','1255','1256','1257','1258','1281','1283','1284','1285','1286','1287','1288','1292','1293','1294','1298'],
  },
  {
    id: 2, code: 'lausanne', name: 'Lausanne', shortLabel: 'Lausanne',
    centerAddress: 'Place de la Gare 1, 1003 Lausanne',
    centerCoords: { lat: 46.5196, lng: 6.6323 },
    urgencySupplement: 50,
    pickupAndDelivery: ['1000','1001','1002','1003','1004','1005','1006','1007','1008','1009','1010','1011','1012','1014','1015','1018','1020','1022','1023','1024','1025','1026','1027','1028','1029','1030','1032','1033','1052','1053','1066','1068','1090','1092','1093','1094','1095','1110'],
    deliveryOnly: ['1112','1121','1122','1126','1127','1131','1132','1134','1135'],
  },
  {
    id: 3, code: 'nyon', name: 'Nyon', shortLabel: 'Nyon',
    centerAddress: 'Place de la Gare 1, 1260 Nyon',
    centerCoords: { lat: 46.3833, lng: 6.2394 },
    urgencySupplement: 45,
    pickupAndDelivery: ['1196','1197','1260','1262','1274'],
    deliveryOnly: ['1183','1184','1195','1263','1266','1267','1268','1270','1272','1277','1299'],
  },
  {
    id: 4, code: 'riviera', name: 'Riviera - Aigle', shortLabel: 'Riviera',
    centerAddress: 'Place de la Gare 1, 1800 Vevey',
    centerCoords: { lat: 46.4628, lng: 6.8419 },
    urgencySupplement: 60,
    pickupAndDelivery: ['1800','1802','1814','1818','1820'],
    deliveryOnly: ['1801','1803','1804','1805','1806','1807','1808','1809','1815','1816','1817','1822','1823','1824','1832','1833'],
  },
];

/* ===== BRACKETS (copies 1:1 du CRM) ===== */
const BRACKETS = {
  1: { // Geneva
    bike: {
      pickup:   [{min:0,max:3,amount:0},{min:3,max:4,amount:2},{min:4,max:20,amount:5}],
      segment:  [{min:0,max:3,amount:20},{min:3,max:4,amount:30},{min:4,max:20,amount:40}],
    },
    car: {
      pickup:   [{min:0,max:5,amount:0},{min:5,max:10,amount:3},{min:10,max:30,amount:8}],
      segment:  [{min:0,max:5,amount:25},{min:5,max:10,amount:35},{min:10,max:30,amount:50}],
    },
  },
  2: { // Lausanne
    bike: {
      pickup:   [{min:0,max:3,amount:0},{min:3,max:4,amount:2},{min:4,max:20,amount:6}],
      segment:  [{min:0,max:3,amount:22},{min:3,max:4,amount:32},{min:4,max:20,amount:45}],
    },
    car: {
      pickup:   [{min:0,max:5,amount:0},{min:5,max:10,amount:4},{min:10,max:30,amount:10}],
      segment:  [{min:0,max:5,amount:28},{min:5,max:10,amount:38},{min:10,max:30,amount:55}],
    },
  },
  3: { // Nyon
    bike: {
      pickup:   [{min:0,max:3,amount:0},{min:3,max:5,amount:3},{min:5,max:20,amount:8}],
      segment:  [{min:0,max:3,amount:24},{min:3,max:5,amount:35},{min:5,max:20,amount:50}],
    },
    car: {
      pickup:   [{min:0,max:5,amount:0},{min:5,max:10,amount:5},{min:10,max:30,amount:12}],
      segment:  [{min:0,max:5,amount:30},{min:5,max:10,amount:42},{min:10,max:30,amount:60}],
    },
  },
  4: { // Riviera
    bike: {
      pickup:   [{min:0,max:3,amount:0},{min:3,max:5,amount:4},{min:5,max:25,amount:10}],
      segment:  [{min:0,max:3,amount:26},{min:3,max:5,amount:38},{min:5,max:25,amount:54}],
    },
    car: {
      pickup:   [{min:0,max:5,amount:0},{min:5,max:10,amount:6},{min:10,max:35,amount:14}],
      segment:  [{min:0,max:5,amount:32},{min:5,max:10,amount:46},{min:10,max:35,amount:68}],
    },
  },
};

/* ===== UTILS ===== */
function round2(n) { return Math.round(n * 100) / 100; }

function extractPostalCode(addr) {
  if (!addr) return null;
  const m = String(addr).match(/\b(\d{4})\b/);
  return m ? m[1] : null;
}

function findBracket(distanceKm, brackets) {
  const match = brackets.find(b => distanceKm >= b.min && distanceKm < b.max);
  return match || brackets[brackets.length - 1];
}

function findZoneByPostalCode(postalCode) {
  if (!postalCode) return null;
  for (const z of ZONES) {
    if (z.pickupAndDelivery.includes(postalCode) || z.deliveryOnly.includes(postalCode)) {
      return z;
    }
  }
  return null;
}

/** Verifie si une adresse peut etre une prise en charge (pickup) : NPA dans pickupAndDelivery uniquement. */
function canPickupAt(postalCode) {
  if (!postalCode) return { ok: false, zone: null, reason: 'no_postal_code' };
  for (const z of ZONES) {
    if (z.pickupAndDelivery.includes(postalCode)) return { ok: true, zone: z, reason: null };
    if (z.deliveryOnly.includes(postalCode)) return { ok: false, zone: z, reason: 'delivery_only' };
  }
  return { ok: false, zone: null, reason: 'out_of_zone' };
}

/** Verifie si une adresse peut etre une livraison (dropoff) : NPA dans pickupAndDelivery OU deliveryOnly. */
function canDeliverAt(postalCode) {
  if (!postalCode) return { ok: false, zone: null, reason: 'no_postal_code' };
  for (const z of ZONES) {
    if (z.pickupAndDelivery.includes(postalCode) || z.deliveryOnly.includes(postalCode)) {
      return { ok: true, zone: z, reason: null };
    }
  }
  return { ok: false, zone: null, reason: 'out_of_zone' };
}

/* ===== GEOCODING (geo.admin.ch) ===== */
const _geocodeCache = new Map();

async function geocodeAddress(address) {
  const key = String(address || '').trim().toLowerCase();
  if (!key) return null;
  if (_geocodeCache.has(key)) return _geocodeCache.get(key);

  const req = (async () => {
    const url = new URL('https://api3.geo.admin.ch/rest/services/api/SearchServer');
    url.search = new URLSearchParams({
      searchText: address,
      type: 'locations',
      origins: 'address',
      limit: '1',
      geometryFormat: 'geojson',
      sr: '4326',
    }).toString();

    try {
      const r = await fetch(url.toString());
      if (!r.ok) return null;
      const data = await r.json();
      const feature = (data.features || data.results || [])[0];
      if (!feature) return null;
      const props = feature.properties || {};
      const coords = (feature.geometry && feature.geometry.coordinates) || [];
      const lng = Number(props.lon || props.x || coords[0]);
      const lat = Number(props.lat || props.y || coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const label = String(props.label || props.detail || address).replace(/<\/?[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      return {
        query: address,
        label,
        postalCode: extractPostalCode(address) || extractPostalCode(label),
        coordinates: { lat, lng },
      };
    } catch (e) {
      return null;
    }
  })();

  _geocodeCache.set(key, req);
  return req;
}

/** Autocomplete adresse Suisse via geo.admin.ch (retourne jusqu'a 8 suggestions). */
async function searchAddresses(query) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  const url = new URL('https://api3.geo.admin.ch/rest/services/api/SearchServer');
  url.search = new URLSearchParams({
    searchText: q,
    type: 'locations',
    origins: 'address',
    limit: '8',
    geometryFormat: 'geojson',
    sr: '4326',
  }).toString();
  try {
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    const data = await r.json();
    const features = data.features || data.results || [];
    return features.map(f => {
      const props = f.properties || {};
      const coords = (f.geometry && f.geometry.coordinates) || [];
      const lng = Number(props.lon || props.x || coords[0]);
      const lat = Number(props.lat || props.y || coords[1]);
      const label = String(props.label || props.detail || '').replace(/<\/?[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      return {
        label,
        postalCode: extractPostalCode(label),
        coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
      };
    }).filter(s => s.label && s.coordinates);
  } catch (e) {
    return [];
  }
}

/* ===== ROUTING (OpenRouteService + haversine fallback) ===== */
function haversineKm(from, to) {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(from.lat * Math.PI/180) * Math.cos(to.lat * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const _routeCache = new Map();

async function routeDistance(from, to, vehicleMode) {
  const cacheKey = [vehicleMode, from.lat.toFixed(6), from.lng.toFixed(6), to.lat.toFixed(6), to.lng.toFixed(6)].join(':');
  if (_routeCache.has(cacheKey)) return _routeCache.get(cacheKey);

  const req = (async () => {
    if (!ORS_API_KEY) {
      return fallbackHaversine(from, to, 'missing_key');
    }
    const profile = vehicleMode === 'bike' ? 'cycling-regular' : 'driving-car';
    try {
      const r = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
        method: 'POST',
        headers: { Authorization: ORS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
      });
      if (!r.ok) return fallbackHaversine(from, to, `http_${r.status}`);
      const data = await r.json();
      const summary = data.routes && data.routes[0] && data.routes[0].summary;
      if (!summary || typeof summary.distance !== 'number') {
        return fallbackHaversine(from, to, 'missing_summary');
      }
      return {
        distanceMeters: Math.round(summary.distance),
        distanceKm: Math.round(summary.distance / 10) / 100,
        durationSeconds: typeof summary.duration === 'number' ? summary.duration : null,
        source: 'routed',
        fallbackReason: null,
      };
    } catch (e) {
      console.warn('[pricing-mock] ORS failed, haversine fallback.', e);
      return fallbackHaversine(from, to, 'network_error');
    }
  })();

  _routeCache.set(cacheKey, req);
  return req;
}

function fallbackHaversine(from, to, reason) {
  const km = Math.round(haversineKm(from, to) * 100) / 100;
  return {
    distanceMeters: Math.round(km * 1000),
    distanceKm: km,
    durationSeconds: null,
    source: 'fallback_haversine',
    fallbackReason: reason,
  };
}

/* ===== PRICING (identique au CRM calculate.ts) ===== */

/**
 * Simule POST /api/pricing
 * @param {object} input
 * @param {{label:string, coordinates:{lat,lng}, postalCode:string}} input.pickup
 * @param {Array<{label:string, coordinates:{lat,lng}, postalCode:string}>} input.stops  // >= 1
 * @param {'bike'|'car'} input.vehicleMode
 * @param {boolean} input.isUrgent
 * @returns {Promise<object|{error:string, reason:string}>}
 */
async function estimatePrice(input) {
  const { pickup, stops, vehicleMode, isUrgent } = input;

  if (!pickup || !pickup.coordinates) return { error: 'INVALID_INPUT', reason: 'missing_pickup' };
  if (!stops || stops.length === 0) return { error: 'INVALID_INPUT', reason: 'missing_stops' };

  // 1. Resolution zone via NPA pickup
  const pickupCheck = canPickupAt(pickup.postalCode);
  if (!pickupCheck.ok) {
    return {
      error: 'PICKUP_NOT_COVERED',
      reason: pickupCheck.reason,
      zone: pickupCheck.zone ? pickupCheck.zone.shortLabel : null,
    };
  }
  const zone = pickupCheck.zone;

  // 2. Validation stops (tous doivent etre livrables)
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (!s || !s.coordinates) return { error: 'INVALID_INPUT', reason: `missing_stop_${i+1}` };
    const check = canDeliverAt(s.postalCode);
    if (!check.ok) {
      return {
        error: 'DROPOFF_NOT_COVERED',
        reason: check.reason,
        stopIndex: i,
        postalCode: s.postalCode,
      };
    }
  }

  const brackets = BRACKETS[zone.id][vehicleMode];
  if (!brackets) return { error: 'INTERNAL', reason: 'no_brackets' };

  // 3. Distance pickup (centre de zone -> pickup)
  const pickupDist = await routeDistance(zone.centerCoords, pickup.coordinates, vehicleMode);
  const pickupBracket = findBracket(pickupDist.distanceKm, brackets.pickup);
  const pickupCost = round2(pickupBracket.amount);
  let totalDurationSec = pickupDist.durationSeconds || null;

  // 4. Segments inter-stops (pickup -> stop1 -> stop2 -> ...)
  const points = [pickup.coordinates, ...stops.map(s => s.coordinates)];
  const segments = [];
  let deliveryCost = 0;
  let deliveryDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const dist = await routeDistance(points[i-1], points[i], vehicleMode);
    const br = findBracket(dist.distanceKm, brackets.segment);
    const costHT = round2(br.amount);
    segments.push({
      sequence: i,
      fromLabel: i === 1 ? 'Collecte' : `Stop ${i-1}`,
      toLabel: `Stop ${i}`,
      distanceKm: dist.distanceKm,
      costHT,
      source: dist.source,
      durationSeconds: dist.durationSeconds || null,
    });
    deliveryCost += costHT;
    deliveryDistance += dist.distanceKm;
    if (dist.durationSeconds && totalDurationSec !== null) totalDurationSec += dist.durationSeconds;
    else if (dist.durationSeconds) totalDurationSec = dist.durationSeconds;
  }
  // Fallback duree : 20km/h velo, 40km/h voiture (approximation urbaine suisse)
  if (totalDurationSec === null) {
    const speedKmh = vehicleMode === 'bike' ? 20 : 40;
    const totalKm = pickupDist.distanceKm + deliveryDistance;
    totalDurationSec = Math.round((totalKm / speedKmh) * 3600);
  }
  // Ajout marge de service (prise + depose) par stop
  const serviceSecPerStop = vehicleMode === 'bike' ? 180 : 240;
  totalDurationSec += serviceSecPerStop * (1 + stops.length);

  const routeSubtotalHT = round2(pickupCost + deliveryCost);

  // 5. Ajustements vehicule + poids (0 CHF dans la config actuelle, mais on respecte la structure)
  const vehicleAdjustmentCost = 0;
  const weightAdjustmentCost = 0;

  // 6. Urgence
  const urgencyCost = isUrgent ? round2(zone.urgencySupplement) : 0;

  // 7. Totaux
  const subtotalHT = round2(routeSubtotalHT + vehicleAdjustmentCost + weightAdjustmentCost + urgencyCost);
  const vat = round2(subtotalHT * VAT_RATE);
  const totalTTC = round2(subtotalHT + vat);

  return {
    ok: true,
    zone: { id: zone.id, name: zone.shortLabel },
    vehicleMode,
    isUrgent: !!isUrgent,
    pickup: {
      distanceKm: pickupDist.distanceKm,
      costHT: pickupCost,
      source: pickupDist.source,
    },
    segments,
    deliveryDistance: round2(deliveryDistance),
    deliveryCost: round2(deliveryCost),
    routeSubtotalHT,
    urgencyCost,
    subtotalHT,
    vat,
    vatRate: VAT_RATE,
    totalTTC,
    durationSeconds: totalDurationSec,
  };
}

/* ===== EXPORTS ===== */
window.ChaskisPricing = {
  estimatePrice,
  searchAddresses,
  geocodeAddress,
  canPickupAt,
  canDeliverAt,
  findZoneByPostalCode,
  extractPostalCode,
  ZONES,
  VAT_RATE,
};
